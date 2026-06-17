-- ─── Migration 004: Department & Position FK columns on employees ─────────────
-- Adds proper foreign-key references alongside the existing free-text columns.
-- The free-text columns (department, position) are kept for now and used as a
-- fallback — remove them in a future migration once the UI is fully FK-driven.
--
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks).

-- 1. Add FK columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE employees
      ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'position_id'
  ) THEN
    ALTER TABLE employees
      ADD COLUMN position_id UUID REFERENCES positions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Back-fill FK values by matching free-text columns to table names/titles.
--    This is a best-effort match — records that don't match are left NULL.
UPDATE employees e
  SET department_id = d.id
  FROM departments d
  WHERE LOWER(TRIM(e.department)) = LOWER(TRIM(d.name))
    AND e.department_id IS NULL;

UPDATE employees e
  SET position_id = p.id
  FROM positions p
  WHERE LOWER(TRIM(e.position)) = LOWER(TRIM(p.title))
    AND e.position_id IS NULL;

-- 3. Indexes for FK lookups
CREATE INDEX IF NOT EXISTS employees_department_id_idx ON employees (department_id);
CREATE INDEX IF NOT EXISTS employees_position_id_idx   ON employees (position_id);

-- ── Future steps (run separately, after the UI is FK-driven) ──────────────────
-- Once every employee row has department_id / position_id populated and the
-- forms write these columns directly, you can drop the free-text columns:
--
--   ALTER TABLE employees DROP COLUMN department;
--   ALTER TABLE employees DROP COLUMN position;
