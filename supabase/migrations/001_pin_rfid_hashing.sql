-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — PIN & RFID hashing
-- Run once in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Purpose:
--   Adds pin_hash and rfid_hash columns so the application can store and query
--   hashed credentials instead of plaintext values.
--
-- Transition strategy:
--   • Both old (pin_code, rfid_tag) and new (*_hash) columns coexist.
--   • The application writes BOTH on every employee save (dual-write).
--   • The kiosk reads by *_hash; falls back to plaintext only during the
--     window before this migration runs.
--   • After all employees have been re-saved (triggering dual-write), the
--     plaintext columns can be dropped via Migration 002.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add hash columns (nullable — null until the employee is next saved)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pin_hash  TEXT,
  ADD COLUMN IF NOT EXISTS rfid_hash TEXT;

-- 2. Unique constraints (prevent two employees sharing the same hash)
--    Partial — only applied when the hash is not null.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_pin_hash_key'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_pin_hash_key UNIQUE (pin_hash);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_rfid_hash_key'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_rfid_hash_key UNIQUE (rfid_hash);
  END IF;
END $$;

-- 3. Indexes for fast kiosk lookups
CREATE INDEX IF NOT EXISTS idx_employees_pin_hash
  ON employees (pin_hash)
  WHERE pin_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_rfid_hash
  ON employees (rfid_hash)
  WHERE rfid_hash IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- After all employees have been re-saved through the updated application UI,
-- run Migration 002 below to drop the plaintext columns.
-- DO NOT run 002 before every employee record has a non-null pin_hash / rfid_hash.
-- ─────────────────────────────────────────────────────────────────────────────
