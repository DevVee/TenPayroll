-- ─── Migration 023: Attendance soft-delete ───────────────────────────────────
-- Adds is_voided flag so HR can void records without losing the audit trail.
-- Hard-delete would corrupt historical payroll periods that reference the record.
-- All existing SELECT queries gain a .eq('is_voided', false) filter after this.

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS is_voided  BOOLEAN        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_by  TEXT,
  ADD COLUMN IF NOT EXISTS voided_at  TIMESTAMPTZ;

-- Partial index keeps all normal queries fast (they always filter WHERE is_voided = false)
CREATE INDEX IF NOT EXISTS idx_att_not_voided
  ON attendance_records (date, employee_id)
  WHERE is_voided = false;

-- No RLS changes needed: the existing att_write policy already allows UPDATE
-- for super-admin, hr-admin, and payroll-officer, which covers voiding.
