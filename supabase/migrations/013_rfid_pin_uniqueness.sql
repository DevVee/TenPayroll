-- ─── Migration 013: RFID & PIN uniqueness — verification only ────────────────
-- The unique constraints on rfid_hash and pin_hash were already added in
-- migration 001 (employees_rfid_hash_key, employees_pin_hash_key).
-- Migration 002 dropped the plaintext rfid_tag and pin_code columns.
--
-- This migration is intentionally a no-op on the DB side.
-- Its companion change lives in the application layer:
--   src/lib/_db/employees.ts → humanizeUniqueViolation()
--   Converts raw Postgres 23505 unique-violation errors into clear messages:
--     "This RFID card is already assigned to another employee."
--     "This PIN is already in use by another employee."
--
-- Run this verification to confirm the constraints from migration 001 are intact:
-- ─────────────────────────────────────────────────────────────────────────────
SELECT conname, contype
  FROM pg_constraint
 WHERE conrelid = 'employees'::regclass
   AND conname IN ('employees_pin_hash_key', 'employees_rfid_hash_key')
 ORDER BY conname;
-- Expected: 2 rows, both contype = 'u' (unique)
