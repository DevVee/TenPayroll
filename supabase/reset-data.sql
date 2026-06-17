-- ═══════════════════════════════════════════════════════════════════════════════
-- TenPayroll — Reset Data (keep user accounts)
-- Deletes ALL HR/payroll data while preserving Supabase Auth users and their
-- profiles so no one needs to log in again.
--
-- Use this to:
--   • Wipe fake/seed data before going live
--   • Start a clean test cycle without recreating auth accounts
--   • Reset a staging environment
--
-- WHAT IS KEPT:
--   ✅ auth.users          (Supabase manages these — not touched)
--   ✅ profiles            (user roles / names — kept intact)
--
-- WHAT IS DELETED:
--   ❌ audit_logs
--   ❌ payroll_entries
--   ❌ payroll_periods     (+ resets the payroll_seq sequence)
--   ❌ overtime_requests
--   ❌ leave_requests
--   ❌ leave_balances
--   ❌ attendance_records
--   ❌ holidays
--   ❌ employees           (+ clears employee_id link in profiles)
--   ❌ work_shifts
--   ❌ positions
--   ❌ departments
--   ❌ app_settings        (reverts to factory defaults)
--
-- ⚠️  THIS CANNOT BE UNDONE. Run in Supabase SQL Editor only.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Audit logs (no FK deps) ─────────────────────────────────────────────
TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;

-- ── 2. Payroll (entries first, then periods) ───────────────────────────────
TRUNCATE TABLE payroll_entries  RESTART IDENTITY CASCADE;
TRUNCATE TABLE payroll_periods  RESTART IDENTITY CASCADE;

-- Reset the payroll sequence back to 100 so the next run starts at PAY-0100
ALTER SEQUENCE IF EXISTS payroll_seq RESTART WITH 100;

-- ── 3. HR requests ─────────────────────────────────────────────────────────
TRUNCATE TABLE overtime_requests RESTART IDENTITY CASCADE;
TRUNCATE TABLE leave_requests    RESTART IDENTITY CASCADE;
TRUNCATE TABLE leave_balances    RESTART IDENTITY CASCADE;

-- ── 4. Attendance ──────────────────────────────────────────────────────────
TRUNCATE TABLE attendance_records RESTART IDENTITY CASCADE;

-- ── 5. Holidays ────────────────────────────────────────────────────────────
TRUNCATE TABLE holidays RESTART IDENTITY CASCADE;

-- ── 6. Employees ──────────────────────────────────────────────────────────
-- First clear the employee_id FK in profiles so the employee rows can be deleted.
UPDATE profiles SET employee_id = NULL WHERE employee_id IS NOT NULL;

TRUNCATE TABLE employees RESTART IDENTITY CASCADE;

-- ── 7. Reference tables ────────────────────────────────────────────────────
TRUNCATE TABLE work_shifts  RESTART IDENTITY CASCADE;
TRUNCATE TABLE positions    RESTART IDENTITY CASCADE;
TRUNCATE TABLE departments  RESTART IDENTITY CASCADE;

-- ── 8. App settings — revert to safe defaults ─────────────────────────────
DELETE FROM app_settings;

INSERT INTO app_settings (id, value) VALUES
('company', '{
  "name":             "Your Company Name",
  "tagline":          "",
  "address":          "",
  "contact":          "",
  "email":            "",
  "tin":              "",
  "payPeriod":        "bi-monthly",
  "sssNo":            "",
  "philhealthNo":     "",
  "pagibigNo":        "",
  "hrOfficer":        "",
  "hrEmail":          "",
  "payrollOfficer":   "",
  "defaultFrequency": "bi-monthly",
  "otMultiplierRegular": 1.25,
  "otMultiplierRestDay": 1.30,
  "vacationLeaveCredits": 15,
  "sickLeaveCredits": 15,
  "emergencyLeaveCredits": 5
}'::jsonb),
('deductions', '{
  "lateDeductionEnabled":       true,
  "lateDeductionMultiplier":    1.0,
  "absenceDeductionEnabled":    true,
  "absenceDeductionType":       "daily-rate",
  "undertimeDeductionEnabled":  false,
  "undertimeDeductionMultiplier": 1.0,
  "overtimeEnabled":            true,
  "overtimeMultiplierRegular":  1.25,
  "overtimeMultiplierRestDay":  1.30,
  "overtimeThresholdMinutes":   30,
  "nightDiffEnabled":           true,
  "nightDiffMultiplier":        0.10
}'::jsonb);

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM employees)        AS employees,
  (SELECT COUNT(*) FROM attendance_records) AS attendance,
  (SELECT COUNT(*) FROM payroll_periods)  AS payroll_periods,
  (SELECT COUNT(*) FROM leave_requests)   AS leave_requests,
  (SELECT COUNT(*) FROM holidays)         AS holidays,
  (SELECT COUNT(*) FROM profiles)         AS profiles_kept,
  (SELECT last_value FROM payroll_seq)    AS next_payroll_seq;
-- Expected: employees=0, attendance=0, payroll_periods=0, leave_requests=0,
--           holidays=0, profiles_kept=N (unchanged), next_payroll_seq=99
