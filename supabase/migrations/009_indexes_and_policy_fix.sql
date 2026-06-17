-- ─── Migration 009: Index + Policy Fixes ────────────────────────────────────
-- BUG-008: kiosk_upsert_attendance used FOR ALL (includes DELETE). Fix to
--          only allow INSERT and UPDATE from the kiosk anon role.
-- BUG-016: Add missing index on payroll_entries(employee_id) for payslip queries.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fix kiosk attendance policy — remove DELETE permission ────────────────
DROP POLICY IF EXISTS "kiosk_upsert_attendance" ON attendance_records;

CREATE POLICY "kiosk_insert_attendance" ON attendance_records
  FOR INSERT
  TO anon
  WITH CHECK (source = 'kiosk');

CREATE POLICY "kiosk_update_attendance" ON attendance_records
  FOR UPDATE
  TO anon
  USING  (source = 'kiosk')
  WITH CHECK (source = 'kiosk');

-- ── 2. Add missing payroll_entries employee_id index ─────────────────────────
-- Speeds up payslip lookups and employee-specific payroll queries.
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee
  ON payroll_entries (employee_id);

-- ── 3. Support 13th-month frequency in payroll_periods ───────────────────────
-- Ensure the frequency column allows the '13th-month' value.
-- The CHECK constraint from migration 005 only covers the standard values.
-- Drop and recreate to add the new value (NOT VALID so existing rows unaffected).
ALTER TABLE payroll_periods
  DROP CONSTRAINT IF EXISTS chk_payroll_freq;

ALTER TABLE payroll_periods
  ADD CONSTRAINT chk_payroll_freq
  CHECK (frequency IN ('weekly', 'bi-monthly', 'monthly', '13th-month'))
  NOT VALID;
