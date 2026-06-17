-- ─── Migration 020: Fix payroll_entries column types + add computed_components ──
-- Fixes two schema gaps that block payroll generation:
--
--   1. present_days / absent_days were INT but the engine produces 0.5 for half-days.
--      Promote to NUMERIC(8,2) so the exact value is stored.
--
--   2. computed_components JSONB was missing (should have been added by
--      007_computed_components.sql, but that migration was never applied).
--
-- Safe to re-run (all ALTER TABLE … ADD COLUMN use IF NOT EXISTS;
-- column-type changes use ALTER COLUMN … TYPE with USING cast).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Promote INT → NUMERIC(8,2) for fractional-day columns
ALTER TABLE payroll_entries
  ALTER COLUMN present_days TYPE NUMERIC(8,2) USING present_days::NUMERIC,
  ALTER COLUMN absent_days  TYPE NUMERIC(8,2) USING absent_days::NUMERIC;

-- 2. Add computed_components if it does not yet exist
ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS computed_components JSONB DEFAULT NULL;

COMMENT ON COLUMN payroll_entries.present_days IS
  'Days present this period (0.5 increments for half-days)';
COMMENT ON COLUMN payroll_entries.absent_days IS
  'Days absent this period (0.5 increments for half-days)';
COMMENT ON COLUMN payroll_entries.computed_components IS
  'Array of ComputedComponent objects from the dynamic payroll engine. '
  'NULL for legacy entries or runs before migration 007/020 was applied.';

-- ─── Done ────────────────────────────────────────────────────────────────────
-- After running this migration, uncomment the computed_components line in
-- src/lib/_db/payroll.ts → fromEntry() so component breakdowns are stored.
