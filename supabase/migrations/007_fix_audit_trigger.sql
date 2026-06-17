-- ─── Migration 007: Fix Kiosk Audit Trigger Column Mismatch ─────────────────
-- Migration 006 created audit_kiosk_attendance() using wrong column names:
--   entity, entity_id, changes, created_at
-- The actual audit_logs schema uses:
--   module, record_id, description (+ before_data/after_data), timestamp
-- This migration corrects the trigger to use the right columns.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_kiosk_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.source = 'kiosk' THEN
    INSERT INTO audit_logs (
      id,
      timestamp,
      user_id,
      user_name,
      action,
      module,
      description,
      record_id
    ) VALUES (
      gen_random_uuid(),
      now(),
      'kiosk',
      'Kiosk Device',
      CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
      'Attendance',
      TG_OP || ' kiosk attendance for '
        || COALESCE(NEW.employee_name, NEW.employee_id::text)
        || ' on ' || NEW.date::text
        || ' (' || NEW.status || ')',
      NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to ensure fresh definition
DROP TRIGGER IF EXISTS kiosk_attendance_audit ON attendance_records;
CREATE TRIGGER kiosk_attendance_audit
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_kiosk_attendance();
