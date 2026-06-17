-- ─── Migration 022: Fix kiosk RLS — restore anon SELECT on attendance +
--                   add SECURITY DEFINER RPCs for employee lookup
-- ─────────────────────────────────────────────────────────────────────────────
-- ROOT CAUSE:
--   Bug 1 — apiKioskPIN / apiKioskRFID query employees table directly as anon.
--            Migration 003 dropped the broad anon SELECT policy on employees and
--            migration 003/005 never replaced it with a hash-aware one.
--            Result: every PIN/RFID scan returns null → "Unknown PIN" always.
--
--   Bug 2 — _kioskCheckin reads attendance_records to detect time-in vs time-out.
--            Migration 009 split the FOR ALL anon policy into INSERT+UPDATE only,
--            accidentally removing SELECT. Result: existing record always null →
--            every scan is treated as time-in; second tap errors on unique constraint.
--
-- FIX:
--   1. Add anon SELECT policy on attendance_records (kiosk source rows only).
--   2. Add two SECURITY DEFINER RPCs so anon can look up employees by SHA-256 hash
--      without needing a direct SELECT policy on the employees table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Restore anon SELECT on attendance_records (kiosk rows only) ────────────
-- Migration 009 kept INSERT + UPDATE for anon but removed SELECT.
-- _kioskCheckin needs SELECT to know if a time-in already exists before deciding
-- whether the current scan should be a time-in or a time-out.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance_records'
      AND policyname = 'kiosk_select_attendance'
  ) THEN
    CREATE POLICY "kiosk_select_attendance" ON attendance_records
      FOR SELECT
      TO anon
      USING (source = 'kiosk');
  END IF;
END $$;

-- ── 2. SECURITY DEFINER employee lookup by SHA-256 PIN hash ───────────────────
-- The web kiosk hashes the typed PIN with SHA-256 + VITE_HASH_SALT and passes
-- the hex digest. This RPC bypasses RLS (SECURITY DEFINER runs as the owner)
-- so anon does not need a direct SELECT policy on the employees table.
-- Only returns the columns the kiosk needs; salary/bank/gov't IDs excluded.
CREATE OR REPLACE FUNCTION kiosk_lookup_pin(p_pin_hash text)
RETURNS TABLE (
  id          uuid,
  full_name   text,
  employee_no text,
  department  text,
  "position"  text,
  shift_id    uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id,
    full_name,
    employee_no,
    department,
    position,
    shift_id
  FROM employees
  WHERE pin_hash = p_pin_hash
    AND status   = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION kiosk_lookup_pin(text) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_lookup_pin(text) TO authenticated;

-- ── 3. SECURITY DEFINER employee lookup by SHA-256 RFID hash ─────────────────
-- Same pattern as kiosk_lookup_pin but matches on rfid_hash.
CREATE OR REPLACE FUNCTION kiosk_lookup_rfid(p_rfid_hash text)
RETURNS TABLE (
  id          uuid,
  full_name   text,
  employee_no text,
  department  text,
  "position"  text,
  shift_id    uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id,
    full_name,
    employee_no,
    department,
    position,
    shift_id
  FROM employees
  WHERE rfid_hash = p_rfid_hash
    AND status    = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION kiosk_lookup_rfid(text) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_lookup_rfid(text) TO authenticated;

-- ── 4. Fix get_kiosk_employee_cache() — update to hash columns ───────────────
-- Migration 008/008b still returns pin_code and rfid_tag (dropped in migration
-- 002_drop_plaintext_credentials.sql). UPDATE the function signature and body to
-- use pin_hash / rfid_hash instead. Used by the Electron desktop kiosk offline cache.
--
-- CREATE OR REPLACE cannot change the return type, so we DROP first.
DROP FUNCTION IF EXISTS get_kiosk_employee_cache();
CREATE FUNCTION get_kiosk_employee_cache()
RETURNS TABLE (
  id          uuid,
  employee_no text,
  full_name   text,
  pin_hash    text,
  rfid_hash   text,
  shift_id    uuid,
  department  text,
  "position"  text,
  "status"    text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only return active employees. pin_hash / rfid_hash are SHA-256 digests —
  -- safe to expose since they can only be verified, not reversed.
  -- Salary, bank details, and government IDs are intentionally excluded.
  RETURN QUERY
    SELECT
      e.id,
      e.employee_no,
      e.full_name,
      e.pin_hash,
      e.rfid_hash,
      e.shift_id,
      e.department,
      e.position  AS "position",
      e.status    AS "status"
    FROM employees e
    WHERE e.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION get_kiosk_employee_cache() TO anon;
GRANT EXECUTE ON FUNCTION get_kiosk_employee_cache() TO authenticated;

-- ── 5. Fix employee_kiosk_view — update to hash columns ───────────────────────
-- Migrations 001, 003, and 005 each recreated employee_kiosk_view referencing
-- pin_code / rfid_tag (dropped in migration 002). Recreate with current columns.
DROP VIEW IF EXISTS employee_kiosk_view;
CREATE VIEW employee_kiosk_view AS
  SELECT
    id, employee_no, full_name,
    -- pin_hash / rfid_hash intentionally excluded from the view:
    -- use kiosk_lookup_pin() / kiosk_lookup_rfid() RPCs instead.
    shift_id, department, position, status
  FROM employees
  WHERE status = 'active';

GRANT SELECT ON employee_kiosk_view TO anon;

-- ── Verification ──────────────────────────────────────────────────────────────
-- Run these to confirm the fixes are in place:

-- Should return: kiosk_select_attendance (SELECT, anon)
--               kiosk_insert_attendance  (INSERT, anon)
--               kiosk_update_attendance  (UPDATE, anon)
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'attendance_records' AND 'anon' = ANY(roles)
-- ORDER BY cmd;

-- Should return 2 rows: kiosk_lookup_pin, kiosk_lookup_rfid
-- SELECT proname FROM pg_proc WHERE proname IN ('kiosk_lookup_pin','kiosk_lookup_rfid');
