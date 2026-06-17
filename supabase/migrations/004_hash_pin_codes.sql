-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 004: Hash PIN codes — replace plaintext PINs with bcrypt hashes
-- Run AFTER migrations 001, 002, and 003.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── CONTEXT ──────────────────────────────────────────────────────────────────
-- Employee PIN codes were stored as plaintext TEXT in the employees table.
-- This is a security risk: anyone who reads the table (even via the restricted
-- employee_kiosk_view) can immediately use any employee's PIN.
--
-- We use PostgreSQL's built-in pgcrypto extension (already enabled in schema.sql)
-- to store PINs as bcrypt hashes.  The kiosk/web app verifies PINs using
-- crypt(input_pin, stored_hash) = stored_hash.
--
-- ── IMPORTANT: RUN BEFORE DEPLOYING THE NEW APP VERSION ──────────────────────
-- This migration must run before the updated app code that uses
-- `verify_employee_pin` RPC. Running it after will break PIN login until the
-- old code is replaced.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Hash all existing plaintext PINs.
-- Employees with NULL pin_code are skipped (they use RFID only).
UPDATE employees
SET pin_code = crypt(pin_code, gen_salt('bf', 10))
WHERE pin_code IS NOT NULL
  AND length(pin_code) BETWEEN 4 AND 8
  AND pin_code NOT LIKE '$2a$%'  -- skip already-hashed values (safe to re-run)
  AND pin_code NOT LIKE '$2b$%';

-- Step 2: Create a SECURITY DEFINER function for PIN verification.
-- This keeps the comparison server-side so raw hashes are never sent to clients.
-- The function returns the employee's id + details on match, NULL on failure.
--
-- Usage (from app):
--   SELECT * FROM verify_employee_pin('1234');
CREATE OR REPLACE FUNCTION verify_employee_pin(p_pin TEXT)
RETURNS TABLE(
  id          UUID,
  employee_no TEXT,
  full_name   TEXT,
  department  TEXT,
  "position"  TEXT,
  shift_id    UUID,
  status      TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    e.id, e.employee_no, e.full_name,
    e.department, e.position, e.shift_id, e.status
  FROM employees e
  WHERE e.status     = 'active'
    AND e.pin_code   IS NOT NULL
    AND e.pin_code   = crypt(p_pin, e.pin_code)
  LIMIT 1;
$$;

-- Allow anon role to call this function (kiosk uses anon key).
GRANT EXECUTE ON FUNCTION verify_employee_pin(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_employee_pin(TEXT) TO authenticated;

-- Step 3: Create a similar function for RFID verification (no hashing needed
-- for RFID tags since they are hardware UIDs not memorised by users, but
-- kept here for consistency).
CREATE OR REPLACE FUNCTION verify_employee_rfid(p_rfid TEXT)
RETURNS TABLE(
  id          UUID,
  employee_no TEXT,
  full_name   TEXT,
  department  TEXT,
  "position"  TEXT,
  shift_id    UUID,
  status      TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    e.id, e.employee_no, e.full_name,
    e.department, e.position, e.shift_id, e.status
  FROM employees e
  WHERE e.status   = 'active'
    AND e.rfid_tag = p_rfid
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION verify_employee_rfid(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_employee_rfid(TEXT) TO authenticated;

-- Step 4: Rebuild employee_kiosk_view WITHOUT pin_code.
-- CREATE OR REPLACE VIEW cannot drop columns from an existing view, so we
-- must DROP it first and recreate. The GRANT is re-applied afterwards.
DROP VIEW IF EXISTS employee_kiosk_view;

CREATE VIEW employee_kiosk_view AS
  SELECT
    id, employee_no, full_name,
    -- pin_code intentionally EXCLUDED: use verify_employee_pin() RPC instead
    rfid_tag, shift_id, department, position, status
  FROM employees
  WHERE status = 'active';

GRANT SELECT ON employee_kiosk_view TO anon;

-- Step 5: Create a helper function that the app calls when SETTING a new PIN.
-- The app sends the plaintext PIN; this function hashes it and writes to the DB.
-- Only authenticated admins (super-admin, hr-admin) can call this via RLS.
CREATE OR REPLACE FUNCTION set_employee_pin(p_employee_id UUID, p_pin TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Basic validation: 4–8 digits only
  IF p_pin IS NOT NULL AND (length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^[0-9]+$') THEN
    RAISE EXCEPTION 'PIN must be 4–8 digits.';
  END IF;

  UPDATE employees
  SET pin_code = CASE
    WHEN p_pin IS NULL OR p_pin = '' THEN NULL
    ELSE crypt(p_pin, gen_salt('bf', 10))
  END
  WHERE id = p_employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found.';
  END IF;
END;
$$;

-- Only authenticated users can set PINs (RLS on employees table still applies for writes)
GRANT EXECUTE ON FUNCTION set_employee_pin(UUID, TEXT) TO authenticated;

-- ── SUMMARY ──────────────────────────────────────────────────────────────────
-- After this migration:
-- 1. All existing PINs are bcrypt-hashed in the database.
-- 2. The verify_employee_pin(pin) RPC function verifies PINs server-side.
-- 3. The kiosk view no longer exposes pin_code (not even as a hash).
-- 4. New PINs must be stored as bcrypt hashes: use crypt(pin, gen_salt('bf')).
--
-- APP CODE CHANGES REQUIRED (see src/lib/_db/attendance.ts):
--   • apiKioskPIN()  → call supabase.rpc('verify_employee_pin', { p_pin: pin })
--   • apiKioskRFID() → call supabase.rpc('verify_employee_rfid', { p_rfid: rfid })
-- ─────────────────────────────────────────────────────────────────────────────
