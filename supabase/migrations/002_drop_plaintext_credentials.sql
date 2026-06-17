-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Drop plaintext PIN / RFID columns
-- ⚠  Only run this AFTER:
--    1. Migration 001 has been applied.
--    2. Every employee record has been re-saved through the app (dual-write
--       populated pin_hash / rfid_hash for all employees that have a PIN/RFID).
--    3. You have verified kiosk login works exclusively via hashed lookup.
-- ─────────────────────────────────────────────────────────────────────────────

-- Safety check: refuse to proceed if any employee with a pin_code has no pin_hash
DO $$
DECLARE
  unset_count INT;
BEGIN
  SELECT COUNT(*) INTO unset_count
  FROM employees
  WHERE pin_code IS NOT NULL AND pin_hash IS NULL;

  IF unset_count > 0 THEN
    RAISE EXCEPTION
      'Cannot drop pin_code: % employee(s) still have a PIN but no hash. '
      'Re-save those employees through the app first.', unset_count;
  END IF;

  SELECT COUNT(*) INTO unset_count
  FROM employees
  WHERE rfid_tag IS NOT NULL AND rfid_hash IS NULL;

  IF unset_count > 0 THEN
    RAISE EXCEPTION
      'Cannot drop rfid_tag: % employee(s) still have an RFID but no hash. '
      'Re-save those employees through the app first.', unset_count;
  END IF;
END $$;

-- Drop plaintext columns
ALTER TABLE employees
  DROP COLUMN IF EXISTS pin_code,
  DROP COLUMN IF EXISTS rfid_tag;
