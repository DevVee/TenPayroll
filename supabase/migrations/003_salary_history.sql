-- ─── Migration 003: Salary history ───────────────────────────────────────────
-- Records every basic_salary change for an employee so HR can audit pay
-- progression over time.
--
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run multiple times (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS salary_history (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID         NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  old_salary    NUMERIC(12,2),                      -- NULL on first-ever record
  new_salary    NUMERIC(12,2) NOT NULL,
  effective_date DATE         NOT NULL DEFAULT CURRENT_DATE,
  changed_by    TEXT,                               -- user display name or 'System'
  reason        TEXT,                               -- optional note (e.g. "Annual review")
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Fast lookup: "all salary events for employee X, newest first"
CREATE INDEX IF NOT EXISTS salary_history_employee_date_idx
  ON salary_history (employee_id, effective_date DESC);

-- ── RLS (add after enabling RLS on this table in the Supabase dashboard) ──────
-- ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
--
-- HR admin / payroll-officer / super-admin can see all records:
-- CREATE POLICY "hr_read_salary_history" ON salary_history
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role IN ('super-admin','hr-admin','payroll-officer')
--     )
--   );
--
-- Only authenticated backend (service role) may insert:
-- CREATE POLICY "service_insert_salary_history" ON salary_history
--   FOR INSERT WITH CHECK (auth.role() = 'service_role');
