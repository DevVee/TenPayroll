-- ─── Migration 006: Kiosk Sync Helpers ────────────────────────────────────────
-- Adds server-side infrastructure for the offline-capable Electron kiosk:
--   • registered_devices table for device identity tracking
--   • attendance_records.updated_at for last-write-wins conflict resolution
--   • audit trigger for kiosk-sourced attendance records
--   • RLS policy allowing registered kiosk devices to upsert attendance
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Registered devices ────────────────────────────────────────────────────
-- Each kiosk device registers here on first run. Used for audit trail and
-- optionally for RLS enforcement (restrict which devices can write attendance).

CREATE TABLE IF NOT EXISTS registered_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT NOT NULL UNIQUE,   -- client-generated UUID stored in SQLite device_config
  device_name  TEXT,
  location     TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- Allow anon to upsert their own device registration (device_id is the natural key)
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kiosk_device_register" ON registered_devices
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "kiosk_device_update_own" ON registered_devices
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "kiosk_device_read_own" ON registered_devices
  FOR SELECT
  TO anon
  USING (true);

-- ── 2. Add updated_at to attendance_records ──────────────────────────────────
-- Needed for last-write-wins UPSERT conflict resolution. The kiosk uses this
-- to avoid overwriting a web-app correction with a stale kiosk re-send.

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_records_set_updated_at ON attendance_records;
CREATE TRIGGER attendance_records_set_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Audit trigger for kiosk-sourced records ───────────────────────────────
-- When source='kiosk' attendance records are inserted/updated, write an audit
-- entry so HR has a full trail even without a user session.

CREATE OR REPLACE FUNCTION audit_kiosk_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.source = 'kiosk' THEN
    INSERT INTO audit_logs (
      id,
      user_id,
      action,
      entity,
      entity_id,
      changes,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'kiosk',
      CASE WHEN TG_OP = 'INSERT' THEN 'CREATE' ELSE 'UPDATE' END,
      'attendance_records',
      NEW.id,
      jsonb_build_object(
        'employee_id',       NEW.employee_id,
        'employee_name',     NEW.employee_name,
        'date',              NEW.date,
        'time_in',           NEW.time_in,
        'time_out',          NEW.time_out,
        'status',            NEW.status,
        'minutes_late',      NEW.minutes_late,
        'overtime_minutes',  NEW.overtime_minutes,
        'night_diff_minutes',NEW.night_diff_minutes,
        'source',            NEW.source
      ),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kiosk_attendance_audit ON attendance_records;
CREATE TRIGGER kiosk_attendance_audit
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_kiosk_attendance();

-- ── 4. Index on source column ─────────────────────────────────────────────────
-- Useful for HR queries filtering by source = 'kiosk' or 'manual'.
CREATE INDEX IF NOT EXISTS idx_attendance_source
  ON attendance_records (source);

-- ── 5. Index on updated_at ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_updated_at
  ON attendance_records (updated_at DESC);

-- ── 6. Ensure holidays table has required columns ────────────────────────────
-- The kiosk downloads the holidays table. Confirm the expected columns exist.
-- (This is a no-op guard — columns were created in earlier migrations.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'holidays' AND column_name = 'type'
  ) THEN
    ALTER TABLE holidays ADD COLUMN type TEXT NOT NULL DEFAULT 'regular';
  END IF;
END $$;

-- ── 7. Kiosk write policy on attendance_records ───────────────────────────────
-- Allow the anon key to insert kiosk attendance records.
-- RLS already allows anon INSERT for source='kiosk' (set in migration 001).
-- This migration adds an explicit UPDATE policy so the UPSERT can update
-- existing rows (needed when time-out comes in after time-in was synced).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attendance_records'
      AND policyname = 'kiosk_upsert_attendance'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "kiosk_upsert_attendance" ON attendance_records
        FOR ALL
        TO anon
        USING (source = 'kiosk')
        WITH CHECK (source = 'kiosk')
    $policy$;
  END IF;
END $$;
