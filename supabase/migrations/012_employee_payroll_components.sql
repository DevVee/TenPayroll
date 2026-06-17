-- Migration 012: Per-employee payroll components
-- Moves payroll component configuration from the global app_settings table
-- to individual employee records. Each employee now carries their own
-- payroll_components JSONB array (opt-in — defaults to empty).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payroll_components JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN employees.payroll_components IS
  'Per-employee payroll components (earnings, allowances, deductions, etc.).
   Structure: PayrollComponent[]. Empty array = no dynamic components (uses govt-only engine path).
   Set via Employee Form in the HR admin app.';
