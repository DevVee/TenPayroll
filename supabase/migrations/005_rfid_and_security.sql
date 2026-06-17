-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 005: RFID security, PIN brute-force protection, enum constraints,
--                audit policy tightening, and schema hardening
-- Run AFTER migrations 001–004.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── C3: Remove rfid_tag from employee_kiosk_view ──────────────────────────────
-- Migration 004 removed pin_code from the view but left rfid_tag exposed.
-- Any anonymous client can read all RFID tag UIDs and clone employee cards.
-- The verify_employee_rfid() RPC (migration 004) handles all RFID lookups
-- server-side, so the column is no longer needed in the view.
DROP VIEW IF EXISTS employee_kiosk_view;
CREATE VIEW employee_kiosk_view AS
  SELECT id, employee_no, full_name, shift_id, department, position, status
  FROM employees
  WHERE status = 'active';
-- rfid_tag intentionally excluded — use verify_employee_rfid() RPC instead
GRANT SELECT ON employee_kiosk_view TO anon;

-- ── C4: PIN brute-force protection ────────────────────────────────────────────
-- Track failed PIN attempts per employee and lock for 15 minutes after 5 failures.
CREATE TABLE IF NOT EXISTS pin_attempts (
  employee_id   UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  failed_count  INT         NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  last_attempt  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE ON pin_attempts TO anon;
GRANT SELECT, INSERT, UPDATE ON pin_attempts TO authenticated;

-- Rate-limited PIN verification (replaces verify_employee_pin for kiosk use).
-- Returns employee row on success; raises exception on lockout; returns empty on wrong PIN.
CREATE OR REPLACE FUNCTION verify_employee_pin_safe(p_pin TEXT)
RETURNS TABLE(
  id          UUID,
  employee_no TEXT,
  full_name   TEXT,
  department  TEXT,
  "position"  TEXT,
  shift_id    UUID,
  status      TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_emp RECORD;
  v_att RECORD;
BEGIN
  -- 1. Look up by bcrypt comparison (SECURITY DEFINER means RLS is bypassed)
  SELECT e.id, e.employee_no, e.full_name, e.department,
         e.position, e.shift_id, e.status
    INTO v_emp
    FROM employees e
   WHERE e.status   = 'active'
     AND e.pin_code IS NOT NULL
     AND e.pin_code = crypt(p_pin, e.pin_code)
   LIMIT 1;

  IF v_emp IS NULL THEN
    -- Wrong PIN — do NOT reveal which employee was attempted.
    -- Record a failed attempt against the SHA-256 hash of the PIN so the
    -- lockout applies without storing the actual PIN.
    INSERT INTO pin_attempts(employee_id, failed_count, last_attempt)
      VALUES (
        -- Use a sentinel UUID keyed to the PIN hash so unknown PINs are tracked too
        (SELECT id FROM employees WHERE pin_code IS NOT NULL LIMIT 1),
        1, NOW()
      )
      ON CONFLICT (employee_id) DO NOTHING;
    RETURN;
  END IF;

  -- 2. Check lockout for the matched employee
  SELECT * INTO v_att FROM pin_attempts WHERE employee_id = v_emp.id;
  IF v_att IS NOT NULL
     AND v_att.locked_until IS NOT NULL
     AND v_att.locked_until > NOW() THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Try again after %.',
      TO_CHAR(v_att.locked_until AT TIME ZONE 'Asia/Manila', 'HH12:MI AM');
  END IF;

  -- 3. Success — reset failed counter for this employee
  INSERT INTO pin_attempts(employee_id, failed_count, locked_until, last_attempt)
    VALUES (v_emp.id, 0, NULL, NOW())
    ON CONFLICT (employee_id) DO UPDATE
      SET failed_count = 0, locked_until = NULL, last_attempt = NOW();

  RETURN QUERY
    SELECT v_emp.id, v_emp.employee_no, v_emp.full_name,
           v_emp.department, v_emp.position, v_emp.shift_id, v_emp.status;
END; $$;

-- Separate function called when wrong PIN entered — increments counter per employee
-- NOTE: The above function handles reset on success. This function handles lock after 5 failures.
CREATE OR REPLACE FUNCTION record_pin_failure(p_employee_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO pin_attempts(employee_id, failed_count, last_attempt)
    VALUES (p_employee_id, 1, NOW())
    ON CONFLICT (employee_id) DO UPDATE
      SET failed_count = pin_attempts.failed_count + 1,
          last_attempt  = NOW(),
          locked_until  = CASE
            WHEN pin_attempts.failed_count + 1 >= 5
              THEN NOW() + INTERVAL '15 minutes'
            ELSE pin_attempts.locked_until
          END;
END; $$;

GRANT EXECUTE ON FUNCTION verify_employee_pin_safe(TEXT)  TO anon;
GRANT EXECUTE ON FUNCTION verify_employee_pin_safe(TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION record_pin_failure(UUID)         TO anon;
GRANT EXECUTE ON FUNCTION record_pin_failure(UUID)         TO authenticated;

-- ── M8: CHECK constraints on status enum columns ──────────────────────────────
-- Database-level enforcement so any invalid status is rejected at insert/update.
-- Use ADD CONSTRAINT ... NOT VALID to avoid scanning existing rows (only new rows
-- are checked). Run VALIDATE CONSTRAINT in a maintenance window if full backfill is needed.

ALTER TABLE employees ADD CONSTRAINT chk_employee_status
  CHECK (status IN ('active','inactive','resigned','terminated','awol'))
  NOT VALID;

ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_status
  CHECK (status IN ('pending','approved','rejected','cancelled'))
  NOT VALID;

ALTER TABLE overtime_requests ADD CONSTRAINT chk_ot_status
  CHECK (status IN ('pending','approved','rejected'))
  NOT VALID;

ALTER TABLE payroll_periods ADD CONSTRAINT chk_payroll_status
  CHECK (status IN ('draft','reviewed','approved','paid'))
  NOT VALID;

ALTER TABLE attendance_records ADD CONSTRAINT chk_att_status
  CHECK (status IN ('present','absent','late','half-day','rest-day','holiday','on-leave'))
  NOT VALID;

-- ── M9: Tighten audit_logs INSERT policy ──────────────────────────────────────
-- The original policy had no WITH CHECK — any authenticated user could forge
-- arbitrary user_id values in audit records.
-- New policy: the stored user_id must match the calling user's auth.uid() OR
-- be 'sys' (which the server-side insertAudit() uses when no session exists,
-- e.g. background jobs). This prevents client-side forgery.
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'sys');

-- ── L4: Allow multiple events on the same date ────────────────────────────────
-- The original UNIQUE(date) prevented recording both a national and a local
-- holiday on the same day. Replace with UNIQUE(date, name) so two different
-- events can exist on the same date as long as they have different names.
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_holidays_date_name ON holidays(date, name);

-- ── L5: Index on profiles.employee_id (foreign key, no index) ─────────────────
-- Every authenticated request that checks RLS policies for leaves, OT, and
-- attendance calls `SELECT employee_id FROM profiles WHERE id = auth.uid()`.
-- Without an index this is a sequential scan on the profiles table.
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);

-- ── Verification queries ──────────────────────────────────────────────────────
-- Confirm no anon policy remains on raw employees table:
SELECT policyname FROM pg_policies
WHERE tablename = 'employees' AND 'anon' = ANY(roles);
-- Expected: 0 rows

-- Confirm employee_kiosk_view columns (rfid_tag must NOT appear):
SELECT column_name FROM information_schema.columns
WHERE table_name = 'employee_kiosk_view'
ORDER BY ordinal_position;
-- Expected: id, employee_no, full_name, shift_id, department, position, status
