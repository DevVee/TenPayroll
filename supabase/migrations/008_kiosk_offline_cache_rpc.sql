-- ─── Migration 008: Kiosk Offline Cache RPC ─────────────────────────────────
-- After migration 003 removed the broad anon employees policy, and migration 004
-- hashed all PINs, the kiosk sync engine could no longer fetch employee data
-- (including bcrypt PIN hashes and rfid tags) needed for offline verification.
--
-- This migration adds a SECURITY DEFINER RPC that the anon key can call to get
-- the employee data needed for offline kiosk operation (name, shift, hashed PIN,
-- rfid tag). It deliberately excludes salary, bank, and government ID columns.
--
-- FIX NOTE: "position" and "status" are quoted because both are PostgreSQL
-- reserved words / built-in function names.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_kiosk_employee_cache()
RETURNS TABLE (
  id           uuid,
  employee_no  text,
  full_name    text,
  pin_code     text,
  rfid_tag     text,
  shift_id     uuid,
  department   text,
  "position"   text,
  "status"     text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only return active employees; bcrypt pin_code hash is safe to expose
  -- (it can only be verified, not reversed) and rfid_tag is a hardware UID.
  -- Salary, bank details, government IDs are intentionally excluded.
  RETURN QUERY
    SELECT
      e.id,
      e.employee_no,
      e.full_name,
      e.pin_code,
      e.rfid_tag,
      e.shift_id,
      e.department,
      e.position    AS "position",
      e.status      AS "status"
    FROM employees e
    WHERE e.status = 'active';
END;
$$;

-- Allow the anon key (used by the kiosk) to call this function
GRANT EXECUTE ON FUNCTION get_kiosk_employee_cache() TO anon;
GRANT EXECUTE ON FUNCTION get_kiosk_employee_cache() TO authenticated;
