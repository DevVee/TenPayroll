-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 003: Remove broad anon SELECT on employees (data-breach fix)
-- Run AFTER migrations 001 and 002.
-- Safe to run multiple times (uses DROP POLICY IF EXISTS / CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── PROBLEM ──────────────────────────────────────────────────────────────────
-- The original schema.sql created this policy:
--
--   CREATE POLICY "employees_kiosk_lookup" ON employees
--     FOR SELECT TO anon USING (TRUE);
--
-- This lets ANY unauthenticated request (using only the public anon key) read
-- the entire employees table — including:
--   • basic_salary, compensation_rate, daily_rate   (salary data)
--   • sss_no, philhealth_no, pagibig_no, tin_no     (government IDs)
--   • bank_name, bank_account                        (banking details)
--   • pin_code                                       (kiosk auth credential, plaintext)
--
-- Migration 001 created `employee_kiosk_view` (a restricted view exposing only
-- the 9 columns the kiosk actually needs) and noted "the broad anon policy
-- remains for backward compat." This migration closes that gap.
--
-- ── SOLUTION ─────────────────────────────────────────────────────────────────
-- 1. Drop the broad anon SELECT policy on the raw employees table.
-- 2. The kiosk now reads from `employee_kiosk_view` exclusively (already done
--    in the sync engine's refreshEmployeeCache and the web kiosk helpers).
-- 3. Keep the work_shifts_kiosk_read policy from 001 (shifts are not sensitive).
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Remove the broad anon policy that exposed salary/bank/PIN data.
DROP POLICY IF EXISTS "employees_kiosk_lookup" ON employees;

-- Step 2: Confirm that the restricted kiosk view still exists and is accessible.
-- This is idempotent — safe if run again after 001.
CREATE OR REPLACE VIEW employee_kiosk_view AS
  SELECT
    id, employee_no, full_name,
    pin_code, rfid_tag, shift_id,
    department, position, status
  FROM employees
  WHERE status = 'active';

-- Re-grant in case it was revoked
GRANT SELECT ON employee_kiosk_view TO anon;

-- Step 3: The `employees_admin` and `employees_read_auth` policies (schema.sql)
-- remain intact — authenticated users can still read employee data per their role.
-- Verify the remaining authenticated policies are in place:
-- • employees_admin   FOR ALL TO authenticated (super-admin, hr-admin)
-- • employees_read_auth FOR SELECT TO authenticated (admins OR own record)
-- These require no changes.

-- ── AUDIT NOTE ────────────────────────────────────────────────────────────────
-- After this migration, the only way an unauthenticated party can read employee
-- data is through `employee_kiosk_view`, which exposes only:
--   id, employee_no, full_name, pin_code, rfid_tag, shift_id, department,
--   position, status
--
-- Salary, government IDs, bank account, and contact details are no longer
-- accessible without an authenticated session.
--
-- RECOMMENDED FOLLOW-UP:
--   • Rotate the Supabase anon key as a precaution (Settings → API in dashboard).
--   • Hash PIN codes (see migration 004 when implemented).
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify: list anon policies remaining on employees table
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'employees' AND 'anon' = ANY(roles);
-- Expected result: 0 rows (no anon policies on raw employees table remain)
