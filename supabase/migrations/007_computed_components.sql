-- ─── Migration 007: Add computed_components to payroll_entries ──────────────
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → Run).
-- Safe to run multiple times (uses IF NOT EXISTS).

-- 1. Add JSONB column to store dynamic payroll component results
ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS computed_components JSONB DEFAULT NULL;

COMMENT ON COLUMN payroll_entries.computed_components IS
  'Array of ComputedComponent objects from the dynamic payroll engine. '
  'NULL for legacy entries that used hardcoded SSS/PhilHealth/etc.';

-- 2. Create the payroll_components settings row (if not yet in app_settings)
--    The app manages this via UPSERT, so this is just a convenience insert.
INSERT INTO app_settings (id, value)
VALUES ('payroll_components', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─── Done ────────────────────────────────────────────────────────────────────
-- After running this migration, go to Settings → Payroll Components and
-- create your earnings, allowances, deductions, contributions, and taxes.
-- The payroll engine will automatically use them in future payroll runs.
