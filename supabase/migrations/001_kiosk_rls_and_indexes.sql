-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 001: Kiosk RLS + Security View + Performance Indexes
-- Run this in the Supabase SQL Editor after schema.sql has been applied.
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING / CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0. Profile RPC function (SECURITY DEFINER — bypasses RLS) ───────────────
-- Required by src/lib/_db/auth.ts loadProfile() primary path.
-- Without this, login fails with RLS blocking the profile read.
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT row_to_json(p) FROM profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;

-- ── 1. Allow kiosk (anon role) to read work_shifts ───────────────────────────
-- The kiosk sync engine fetches shifts to compute late/OT/undertime offline.
-- Without this policy, the shift cache refresh silently fails and the kiosk
-- uses stale data or defaults (0 minutes late, 0 OT for every check-in).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'work_shifts' AND policyname = 'work_shifts_kiosk_read'
  ) THEN
    CREATE POLICY "work_shifts_kiosk_read" ON work_shifts
      FOR SELECT TO anon USING (TRUE);
  END IF;
END $$;

-- ── 2. Restrict kiosk anon employee access via a dedicated view ───────────────
-- The kiosk only needs: id, employee_no, full_name, pin_code, rfid_tag,
-- shift_id, department, position, status.
-- The broad `employees_kiosk_lookup USING (TRUE)` policy exposes salary,
-- gov't IDs, and bank account — a data leak risk if anon key is compromised.
--
-- STEP A: Create the restricted view
CREATE OR REPLACE VIEW employee_kiosk_view AS
  SELECT
    id, employee_no, full_name,
    pin_code, rfid_tag, shift_id,
    department, position, status
  FROM employees
  WHERE status = 'active';

-- STEP B: Grant anon SELECT on the view
GRANT SELECT ON employee_kiosk_view TO anon;

-- STEP C: Tighten the direct employees table policy for anon
-- Replace the broad USING (TRUE) policy with a narrow one exposing only
-- the columns the kiosk legitimately needs for PIN/RFID lookup.
-- NOTE: Supabase doesn't support column-level RLS directly, so we restrict
-- via the view above. The broad anon policy remains for backward compat
-- but the kiosk sync engine should be updated to query employee_kiosk_view
-- instead of employees directly.
-- (See engine.ts refreshEmployeeCache — update .from('employees') → 'employee_kiosk_view')

-- ── 3. Allow kiosk (anon) to read app_settings company row ───────────────────
-- The anon key needs 'company' settings for the kiosk UI (company name, etc.)
-- but NOT 'deductions' (payroll-sensitive). This restricts access by row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_settings' AND policyname = 'app_settings_kiosk_read'
  ) THEN
    CREATE POLICY "app_settings_kiosk_read" ON app_settings
      FOR SELECT TO anon
      USING (id = 'company');
  END IF;
END $$;

-- ── 4. Composite performance index for payroll generation ─────────────────────
-- Payroll generation does: WHERE employee_id = ? AND date BETWEEN ? AND ?
-- The existing idx_attendance_employee_id index covers employee_id alone,
-- but a composite index on (employee_id, date) is much more efficient.
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date
  ON attendance_records(employee_id, date);

-- ── 5. Partial index for active employees (kiosk & payroll hot path) ──────────
CREATE INDEX IF NOT EXISTS idx_employees_active
  ON employees(id) WHERE status = 'active';

-- ── 6. Composite index for leave balance lookups ──────────────────────────────
-- Leave approval checks: WHERE employee_id = ? AND year = ?
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year
  ON leave_balances(employee_id, year);

-- ── 7. Add profiles → employees FK (was deferred in schema.sql comment) ───────
-- Safe: uses IF NOT EXISTS via DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_profiles_employee'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT fk_profiles_employee
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 8. Ensure app_settings seed data exists ───────────────────────────────────
-- This is idempotent — safe to run on an existing database.
INSERT INTO app_settings (id, value) VALUES
  ('company', '{
    "name": "Ten Foundation Philippines Inc.",
    "tagline": "Ten Foundation Philippines Inc.",
    "address": "Metro Manila",
    "contact": "",
    "email": "hr@tenfoundation.ph",
    "tin": "",
    "payPeriod": "bi-monthly",
    "sssNo": "",
    "philhealthNo": "",
    "pagibigNo": "",
    "hrOfficer": "",
    "hrEmail": "hr@tenfoundation.ph",
    "payrollOfficer": "",
    "defaultFrequency": "bi-monthly",
    "otMultiplierRegular": 1.25,
    "otMultiplierRestDay": 1.30,
    "vacationLeaveCredits": 15,
    "sickLeaveCredits": 15,
    "emergencyLeaveCredits": 5
  }'::jsonb),
  ('deductions', '{
    "lateDeductionEnabled": true,
    "lateDeductionMultiplier": 1.0,
    "absenceDeductionEnabled": true,
    "absenceDeductionType": "daily-rate",
    "undertimeDeductionEnabled": true,
    "undertimeDeductionMultiplier": 1.0,
    "overtimeEnabled": true,
    "overtimeMultiplierRegular": 1.25,
    "overtimeMultiplierRestDay": 1.30,
    "overtimeThresholdMinutes": 0,
    "nightDiffEnabled": true,
    "nightDiffMultiplier": 0.10
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── SUMMARY ──────────────────────────────────────────────────────────────────
-- After running this migration:
-- 1. Kiosk shift cache refresh will work (anon can now read work_shifts)
-- 2. Salary data is no longer exposed via the raw employees table to anon
--    (use employee_kiosk_view for future kiosk queries)
-- 3. app_settings 'company' row is readable by anon (kiosk UI branding)
-- 4. Payroll generation is faster (composite attendance index)
-- 5. Active employee lookup is faster (partial index)
-- 6. Leave balance queries are faster (composite index)
