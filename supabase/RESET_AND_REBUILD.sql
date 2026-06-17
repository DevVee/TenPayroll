-- ═══════════════════════════════════════════════════════════════════════════════
-- TenPayroll — FULL RESET & REBUILD
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run
--
-- ⚠️  THIS DELETES ALL DATA.  Use only on a fresh or broken project.
--
-- Admin credentials after this script:
--   Email    : princearveeavena@gmail.com
--   Password : Arvee1407
-- ═══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 1: NUKE EVERYTHING
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1a. Drop triggers ─────────────────────────────────────────────────────────
-- auth.users trigger (handle_new_user) must be dropped FIRST — it fires on the
-- admin INSERT in Part 11 and can reference stale/wrong column names.
DROP TRIGGER IF EXISTS on_auth_user_created              ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user()                CASCADE;

DROP TRIGGER IF EXISTS kiosk_attendance_audit            ON attendance_records;
DROP TRIGGER IF EXISTS attendance_records_set_updated_at ON attendance_records;
DROP TRIGGER IF EXISTS trg_employees_updated_at          ON employees;
DROP TRIGGER IF EXISTS trg_sync_full_name                ON employees;

-- ── 1b. Drop views ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS employee_kiosk_view CASCADE;

-- ── 1c. Drop tables (leaf-first to respect FK constraints) ────────────────────
DROP TABLE IF EXISTS advance_repayments  CASCADE;
DROP TABLE IF EXISTS salary_advances     CASCADE;
DROP TABLE IF EXISTS employee_documents  CASCADE;
DROP TABLE IF EXISTS salary_histories    CASCADE;
DROP TABLE IF EXISTS leave_accruals      CASCADE;
DROP TABLE IF EXISTS notifications       CASCADE;
DROP TABLE IF EXISTS payroll_entries     CASCADE;
DROP TABLE IF EXISTS payroll_periods     CASCADE;
DROP TABLE IF EXISTS leave_balances      CASCADE;
DROP TABLE IF EXISTS leave_requests      CASCADE;
DROP TABLE IF EXISTS overtime_requests   CASCADE;
DROP TABLE IF EXISTS pin_attempts        CASCADE;
DROP TABLE IF EXISTS attendance_records  CASCADE;
DROP TABLE IF EXISTS profiles            CASCADE;
DROP TABLE IF EXISTS employees           CASCADE;
DROP TABLE IF EXISTS registered_devices  CASCADE;
DROP TABLE IF EXISTS work_shifts         CASCADE;
DROP TABLE IF EXISTS departments         CASCADE;
DROP TABLE IF EXISTS positions           CASCADE;
DROP TABLE IF EXISTS holidays            CASCADE;
DROP TABLE IF EXISTS app_settings        CASCADE;
DROP TABLE IF EXISTS audit_logs          CASCADE;

-- ── 1d. Drop functions ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_my_role()                                   CASCADE;
DROP FUNCTION IF EXISTS is_admin()                                      CASCADE;
DROP FUNCTION IF EXISTS get_my_profile()                                CASCADE;
DROP FUNCTION IF EXISTS next_period_no()                                CASCADE;
DROP FUNCTION IF EXISTS decrement_leave_balance(UUID, INT, TEXT, INT)  CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()                             CASCADE;
DROP FUNCTION IF EXISTS sync_full_name()                                CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()                                CASCADE;
DROP FUNCTION IF EXISTS audit_kiosk_attendance()                        CASCADE;
DROP FUNCTION IF EXISTS verify_employee_pin_safe(TEXT)                  CASCADE;
DROP FUNCTION IF EXISTS record_pin_failure(UUID)                        CASCADE;
DROP FUNCTION IF EXISTS get_kiosk_employee_cache()                      CASCADE;

-- ── 1e. Drop sequences ────────────────────────────────────────────────────────
DROP SEQUENCE IF EXISTS payroll_seq CASCADE;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 2: EXTENSIONS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 3: TABLES
-- (Incorporates all schema.sql columns + every ALTER TABLE from migrations 001–010)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────────
-- migration 008 adds email; migration 007c adds permissions
CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'employee',  -- super-admin | hr-admin | payroll-officer | dept-head | employee
  employee_id      UUID,                              -- FK added after employees table
  department       TEXT,
  avatar_initials  TEXT,
  email            TEXT,                              -- migration 008
  permissions      JSONB DEFAULT '{}'::jsonb          -- migration 007c
);

COMMENT ON COLUMN profiles.permissions IS
  'Granular per-action permission overrides. When empty, role presets apply.
   Keys: emp_view, emp_create, emp_edit, emp_delete,
         att_view, att_mark, att_edit,
         leave_view, leave_approve,
         ot_view, ot_approve,
         pay_view, pay_generate, pay_approve, pay_delete,
         reports_view, settings_view, settings_edit,
         users_view, users_create, users_edit';

-- ── departments ───────────────────────────────────────────────────────────────
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  code        TEXT,
  description TEXT,
  head_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── positions ─────────────────────────────────────────────────────────────────
CREATE TABLE positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT UNIQUE NOT NULL,
  department  TEXT,
  level       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── work_shifts ───────────────────────────────────────────────────────────────
CREATE TABLE work_shifts (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  time_in                    TEXT NOT NULL,
  time_out                   TEXT NOT NULL,
  break_minutes              INT  NOT NULL DEFAULT 60,
  grace_minutes              INT  NOT NULL DEFAULT 15,
  rest_days                  INT[]NOT NULL DEFAULT '{0,6}',
  overtime_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  overtime_threshold_minutes INT  DEFAULT 30
);

-- ── employees ─────────────────────────────────────────────────────────────────
-- migration 010 adds deleted_at; migration 005 adds CHECK constraints
CREATE TABLE employees (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no             TEXT UNIQUE NOT NULL,
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  middle_name             TEXT,
  full_name               TEXT NOT NULL,
  email                   TEXT UNIQUE NOT NULL,
  phone                   TEXT,
  address                 TEXT,
  birth_date              DATE,
  gender                  TEXT,
  civil_status            TEXT,
  position                TEXT,
  department              TEXT,
  employment_type         TEXT NOT NULL DEFAULT 'regular',
  status                  TEXT NOT NULL DEFAULT 'active'
                          CONSTRAINT chk_employee_status
                          CHECK (status IN ('active','inactive','resigned','terminated','awol')),
  hire_date               DATE,
  resign_date             DATE,
  -- Compensation
  compensation_type       TEXT NOT NULL DEFAULT 'monthly',
  compensation_rate       NUMERIC(14,4) NOT NULL DEFAULT 0,
  basic_salary            NUMERIC(14,4) NOT NULL DEFAULT 0,
  daily_rate              NUMERIC(14,4) NOT NULL DEFAULT 0,
  pay_frequency           TEXT NOT NULL DEFAULT 'bi-monthly',
  -- Identification
  pin_code                TEXT,
  rfid_tag                TEXT,
  photo_url               TEXT,
  sss_no                  TEXT,
  philhealth_no           TEXT,
  pagibig_no              TEXT,
  tin_no                  TEXT,
  bank_name               TEXT,
  bank_account            TEXT,
  shift_id                UUID REFERENCES work_shifts(id),
  tax_status              TEXT NOT NULL DEFAULT 'S',
  allowances              JSONB NOT NULL DEFAULT '[]',
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  deleted_at              TIMESTAMPTZ,                -- migration 010 soft-delete
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK: profiles → employees (set after both tables exist)
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Partial UNIQUE indexes (allow multiple NULLs, enforce non-NULL uniqueness)
CREATE UNIQUE INDEX uidx_employees_pin_code ON employees(pin_code)  WHERE pin_code  IS NOT NULL;
CREATE UNIQUE INDEX uidx_employees_rfid_tag ON employees(rfid_tag)  WHERE rfid_tag  IS NOT NULL;

-- ── attendance_records ────────────────────────────────────────────────────────
-- migration 006 adds updated_at; migration 005 adds CHECK constraint
CREATE TABLE attendance_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name      TEXT NOT NULL,
  employee_no        TEXT NOT NULL,
  department         TEXT,
  date               DATE NOT NULL,
  time_in            TIMESTAMPTZ,
  time_out           TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'present'
                     CONSTRAINT chk_att_status
                     CHECK (status IN ('present','absent','late','half-day','rest-day','holiday','on-leave')),
  minutes_late       INT  NOT NULL DEFAULT 0,
  overtime_minutes   INT  NOT NULL DEFAULT 0,
  night_diff_minutes INT  NOT NULL DEFAULT 0,
  undertime_minutes  INT  NOT NULL DEFAULT 0,
  source             TEXT NOT NULL DEFAULT 'kiosk',
  corrected_by       TEXT,
  correction_reason  TEXT,
  note               TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- migration 006
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, date)
);

-- ── holidays ──────────────────────────────────────────────────────────────────
-- migration 005 changes UNIQUE from (date) to (date, name)
CREATE TABLE holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  date          DATE NOT NULL,
  type          TEXT NOT NULL DEFAULT 'regular',
  is_nationwide BOOLEAN NOT NULL DEFAULT TRUE,
  description   TEXT
);
CREATE UNIQUE INDEX uidx_holidays_date_name ON holidays(date, name);

-- ── leave_requests ────────────────────────────────────────────────────────────
CREATE TABLE leave_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name    TEXT NOT NULL,
  employee_no      TEXT,
  leave_type       TEXT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  days             INT  NOT NULL DEFAULT 1,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CONSTRAINT chk_leave_status
                   CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── leave_balances ────────────────────────────────────────────────────────────
CREATE TABLE leave_balances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year        INT  NOT NULL,
  vacation    JSONB NOT NULL DEFAULT '{"entitled":15,"used":0,"balance":15}',
  sick        JSONB NOT NULL DEFAULT '{"entitled":15,"used":0,"balance":15}',
  emergency   JSONB NOT NULL DEFAULT '{"entitled":5,"used":0,"balance":5}',
  UNIQUE (employee_id, year)
);

-- ── overtime_requests ─────────────────────────────────────────────────────────
CREATE TABLE overtime_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name   TEXT NOT NULL,
  employee_no     TEXT NOT NULL,
  department      TEXT NOT NULL,
  date            DATE NOT NULL,
  hours_requested NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_type   TEXT DEFAULT 'regular',
  multiplier      NUMERIC(5,2) DEFAULT 1.25,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CONSTRAINT chk_ot_status
                  CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── payroll_periods ───────────────────────────────────────────────────────────
-- migration 005 adds chk_payroll_status; migration 009 adds chk_payroll_freq
CREATE TABLE payroll_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_no        TEXT UNIQUE NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  pay_date         DATE NOT NULL,
  frequency        TEXT NOT NULL DEFAULT 'bi-monthly'
                   CONSTRAINT chk_payroll_freq
                   CHECK (frequency IN ('weekly','bi-monthly','monthly','13th-month')),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CONSTRAINT chk_payroll_status
                   CHECK (status IN ('draft','reviewed','approved','paid')),
  total_employees  INT  NOT NULL DEFAULT 0,
  total_gross      NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_net        NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  notes            TEXT
);

-- ── payroll_entries ───────────────────────────────────────────────────────────
CREATE TABLE payroll_entries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id    UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id          UUID NOT NULL REFERENCES employees(id),
  employee_name        TEXT NOT NULL,
  employee_no          TEXT NOT NULL,
  position             TEXT,
  department           TEXT,
  employment_type      TEXT,
  scheduled_days       INT  NOT NULL DEFAULT 0,
  present_days         INT  NOT NULL DEFAULT 0,
  absent_days          INT  NOT NULL DEFAULT 0,
  late_days            INT  NOT NULL DEFAULT 0,
  half_days            INT  NOT NULL DEFAULT 0,
  leave_days           INT  NOT NULL DEFAULT 0,
  overtime_hours       NUMERIC(8,2) NOT NULL DEFAULT 0,
  night_diff_hours     NUMERIC(8,2) NOT NULL DEFAULT 0,
  regular_holiday_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  special_holiday_days NUMERIC(8,2) NOT NULL DEFAULT 0,
  basic_pay            NUMERIC(14,4) NOT NULL DEFAULT 0,
  overtime_pay         NUMERIC(14,4) NOT NULL DEFAULT 0,
  regular_holiday_pay  NUMERIC(14,4) NOT NULL DEFAULT 0,
  special_holiday_pay  NUMERIC(14,4) NOT NULL DEFAULT 0,
  night_differential   NUMERIC(14,4) NOT NULL DEFAULT 0,
  allowances           JSONB NOT NULL DEFAULT '[]',
  gross_pay            NUMERIC(14,4) NOT NULL DEFAULT 0,
  late_deductions      NUMERIC(14,4) NOT NULL DEFAULT 0,
  absence_deductions   NUMERIC(14,4) NOT NULL DEFAULT 0,
  undertime_deductions NUMERIC(14,4) NOT NULL DEFAULT 0,
  sss_employee         NUMERIC(14,4) NOT NULL DEFAULT 0,
  philhealth_employee  NUMERIC(14,4) NOT NULL DEFAULT 0,
  pagibig_employee     NUMERIC(14,4) NOT NULL DEFAULT 0,
  withholding_tax      NUMERIC(14,4) NOT NULL DEFAULT 0,
  other_deductions     JSONB NOT NULL DEFAULT '[]',
  total_deductions     NUMERIC(14,4) NOT NULL DEFAULT 0,
  sss_employer         NUMERIC(14,4) NOT NULL DEFAULT 0,
  philhealth_employer  NUMERIC(14,4) NOT NULL DEFAULT 0,
  pagibig_employer     NUMERIC(14,4) NOT NULL DEFAULT 0,
  net_pay              NUMERIC(14,4) NOT NULL DEFAULT 0,
  remarks              TEXT,
  marked_paid          BOOLEAN NOT NULL DEFAULT FALSE,
  marked_paid_at       TIMESTAMPTZ,
  marked_paid_by       TEXT,
  UNIQUE (payroll_period_id, employee_id)
);

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     TEXT,
  user_name   TEXT NOT NULL,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  description TEXT NOT NULL,
  before_data TEXT,
  after_data  TEXT,
  record_id   TEXT
);

-- ── app_settings ──────────────────────────────────────────────────────────────
CREATE TABLE app_settings (
  id         TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── pin_attempts (migration 005) ──────────────────────────────────────────────
CREATE TABLE pin_attempts (
  employee_id  UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  failed_count INT  NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── registered_devices (migration 006) ───────────────────────────────────────
CREATE TABLE registered_devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT NOT NULL UNIQUE,
  device_name TEXT,
  location    TEXT,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── salary_advances (migration 010) ──────────────────────────────────────────
CREATE TABLE salary_advances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  purpose           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','released','fully_paid','rejected','cancelled')),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  released_at       TIMESTAMPTZ,
  release_notes     TEXT,
  rejection_reason  TEXT,
  repayment_start   DATE,
  monthly_deduction NUMERIC(12,2),
  total_repaid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding       NUMERIC(12,2) GENERATED ALWAYS AS (amount - total_repaid) STORED,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── advance_repayments (migration 010) ───────────────────────────────────────
CREATE TABLE advance_repayments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id        UUID NOT NULL REFERENCES salary_advances(id) ON DELETE CASCADE,
  payroll_period_id UUID REFERENCES payroll_periods(id),
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes             TEXT,
  recorded_by       TEXT,
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── employee_documents (migration 010) ───────────────────────────────────────
CREATE TABLE employee_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'other',
  title         TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     INTEGER,
  uploaded_by   TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    DATE,
  notes         TEXT
);

-- ── salary_histories (migration 010) ─────────────────────────────────────────
CREATE TABLE salary_histories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_date    DATE NOT NULL,
  old_salary        NUMERIC(12,2),
  new_salary        NUMERIC(12,2) NOT NULL,
  old_daily_rate    NUMERIC(10,4),
  new_daily_rate    NUMERIC(10,4),
  compensation_type TEXT,
  reason            TEXT,
  changed_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── leave_accruals (migration 010) ────────────────────────────────────────────
CREATE TABLE leave_accruals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type   TEXT NOT NULL,
  year         INTEGER NOT NULL,
  entitled     NUMERIC(5,2) NOT NULL DEFAULT 0,
  accrued      NUMERIC(5,2) NOT NULL DEFAULT 0,
  used         NUMERIC(5,2) NOT NULL DEFAULT 0,
  carried_over NUMERIC(5,2) NOT NULL DEFAULT 0,
  forfeited    NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, leave_type, year)
);

-- ── notifications (migration 010) ─────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 4: SEQUENCES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE SEQUENCE payroll_seq START 100 INCREMENT 1;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 5: FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Core helper functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(role, 'employee') FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT get_my_role() IN ('super-admin','hr-admin','payroll-officer','dept-head');
$$;

CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT row_to_json(p) FROM profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION next_period_no()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'PAY-' || LPAD(NEXTVAL('payroll_seq')::TEXT, 4, '0');
$$;

-- ── decrement_leave_balance (atomic — prevents race conditions) ───────────────
CREATE OR REPLACE FUNCTION decrement_leave_balance(
  p_employee_id UUID,
  p_year        INT,
  p_type        TEXT,
  p_days        INT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_type NOT IN ('vacation','sick','emergency') THEN
    RAISE EXCEPTION 'Invalid leave type: %', p_type;
  END IF;

  IF p_type = 'vacation' THEN
    UPDATE leave_balances
    SET vacation = jsonb_set(
      jsonb_set(vacation, '{used}',    to_jsonb((vacation->>'used')::int    + p_days)),
                          '{balance}', to_jsonb((vacation->>'balance')::int - p_days)
    )
    WHERE employee_id = p_employee_id AND year = p_year;

  ELSIF p_type = 'sick' THEN
    UPDATE leave_balances
    SET sick = jsonb_set(
      jsonb_set(sick, '{used}',    to_jsonb((sick->>'used')::int    + p_days)),
                      '{balance}', to_jsonb((sick->>'balance')::int - p_days)
    )
    WHERE employee_id = p_employee_id AND year = p_year;

  ELSIF p_type = 'emergency' THEN
    UPDATE leave_balances
    SET emergency = jsonb_set(
      jsonb_set(emergency, '{used}',    to_jsonb((emergency->>'used')::int    + p_days)),
                            '{balance}', to_jsonb((emergency->>'balance')::int - p_days)
    )
    WHERE employee_id = p_employee_id AND year = p_year;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No leave balance found for employee % year %', p_employee_id, p_year;
  END IF;
END;
$$;

-- ── update_updated_at trigger function (employees) ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── set_updated_at trigger function (attendance) ──────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── sync_full_name trigger function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := TRIM(
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NULLIF(TRIM(NEW.middle_name), ''), '') || ' ' ||
    COALESCE(NEW.last_name, '')
  );
  NEW.full_name := REGEXP_REPLACE(NEW.full_name, '\s+', ' ', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── audit_kiosk_attendance trigger function (corrected column names) ───────────
CREATE OR REPLACE FUNCTION audit_kiosk_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.source = 'kiosk' THEN
    INSERT INTO audit_logs (
      id, timestamp, user_id, user_name, action, module, description, record_id
    ) VALUES (
      gen_random_uuid(),
      NOW(),
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

-- ── verify_employee_pin_safe (rate-limited PIN check for kiosk) ───────────────
CREATE OR REPLACE FUNCTION verify_employee_pin_safe(p_pin TEXT)
RETURNS TABLE(
  id          UUID,
  employee_no TEXT,
  full_name   TEXT,
  department  TEXT,
  "position"  TEXT,
  shift_id    UUID,
  status      TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_emp RECORD;
  v_att RECORD;
BEGIN
  SELECT e.id, e.employee_no, e.full_name, e.department,
         e.position, e.shift_id, e.status
    INTO v_emp
    FROM employees e
   WHERE e.status   = 'active'
     AND e.pin_code IS NOT NULL
     AND e.pin_code = crypt(p_pin, e.pin_code)
   LIMIT 1;

  IF v_emp IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_att FROM pin_attempts WHERE employee_id = v_emp.id;
  IF v_att IS NOT NULL
     AND v_att.locked_until IS NOT NULL
     AND v_att.locked_until > NOW() THEN
    RAISE EXCEPTION 'Too many failed PIN attempts. Try again after %.',
      TO_CHAR(v_att.locked_until AT TIME ZONE 'Asia/Manila', 'HH12:MI AM');
  END IF;

  INSERT INTO pin_attempts(employee_id, failed_count, locked_until, last_attempt)
    VALUES (v_emp.id, 0, NULL, NOW())
    ON CONFLICT (employee_id) DO UPDATE
      SET failed_count = 0, locked_until = NULL, last_attempt = NOW();

  RETURN QUERY
    SELECT v_emp.id, v_emp.employee_no, v_emp.full_name,
           v_emp.department, v_emp.position, v_emp.shift_id, v_emp.status;
END;
$$;

-- ── record_pin_failure ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_pin_failure(p_employee_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO pin_attempts(employee_id, failed_count, last_attempt)
    VALUES (p_employee_id, 1, NOW())
    ON CONFLICT (employee_id) DO UPDATE
      SET failed_count = pin_attempts.failed_count + 1,
          last_attempt  = NOW(),
          locked_until  = CASE
            WHEN pin_attempts.failed_count + 1 >= 5
              THEN NOW() + INTERVAL '15 minutes'
            ELSE pin_attempts.locked_until
          END;
END;
$$;

-- ── handle_new_user: auto-create profile row when a new auth user registers ────
-- Uses profiles.name (not full_name) and maps raw_user_meta_data correctly.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, avatar_initials)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'employee',
    UPPER(LEFT(COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NEW.email
    ), 2))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── get_kiosk_employee_cache (secure offline cache for Electron kiosk) ─────────
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
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT e.id, e.employee_no, e.full_name, e.pin_code, e.rfid_tag,
           e.shift_id, e.department, e.position, e.status
    FROM employees e
    WHERE e.status = 'active';
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 6: TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Auto-create profile when a new Supabase auth user signs up via the dashboard or app
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE OF first_name, middle_name, last_name ON employees
  FOR EACH ROW EXECUTE FUNCTION sync_full_name();

CREATE TRIGGER attendance_records_set_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER kiosk_attendance_audit
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_kiosk_attendance();


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 7: VIEWS
-- ══════════════════════════════════════════════════════════════════════════════

-- Kiosk view: NO rfid_tag, NO pin_code, NO salary columns exposed to anon
CREATE VIEW employee_kiosk_view AS
  SELECT id, employee_no, full_name, shift_id, department, position, status
  FROM employees
  WHERE status = 'active';

GRANT SELECT ON employee_kiosk_view TO anon;
GRANT SELECT ON employee_kiosk_view TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 8: INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Employees
CREATE INDEX idx_employees_status        ON employees(status);
CREATE INDEX idx_employees_department    ON employees(department);
CREATE INDEX idx_employees_active        ON employees(id) WHERE status = 'active';
CREATE INDEX idx_profiles_employee_id    ON profiles(employee_id);

-- Attendance
CREATE INDEX idx_attendance_date          ON attendance_records(date);
CREATE INDEX idx_attendance_employee_id   ON attendance_records(employee_id);
CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, date);
CREATE INDEX idx_attendance_source        ON attendance_records(source);
CREATE INDEX idx_attendance_updated_at    ON attendance_records(updated_at DESC);

-- Leaves
CREATE INDEX idx_leave_requests_employee   ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status     ON leave_requests(status);
CREATE INDEX idx_leave_requests_emp_status ON leave_requests(employee_id, status);
CREATE INDEX idx_leave_balances_emp_year   ON leave_balances(employee_id, year);

-- Overtime
CREATE INDEX idx_overtime_employee    ON overtime_requests(employee_id);
CREATE INDEX idx_overtime_emp_status  ON overtime_requests(employee_id, status);
CREATE INDEX idx_ot_emp_date          ON overtime_requests(employee_id, date);

-- Payroll
CREATE INDEX idx_payroll_entries_period     ON payroll_entries(payroll_period_id);
CREATE INDEX idx_payroll_entries_employee   ON payroll_entries(employee_id);
CREATE INDEX idx_payroll_periods_status     ON payroll_periods(status);
CREATE INDEX idx_payroll_periods_start_date ON payroll_periods(start_date DESC);

-- Audit
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_module    ON audit_logs(module);

-- Holidays
CREATE INDEX idx_holidays_date ON holidays(date);

-- Salary advances
CREATE INDEX idx_advances_emp_status ON salary_advances(employee_id, status);

-- Notifications
CREATE INDEX idx_notif_user_read ON notifications(user_id, read, created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 9: ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays            ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_devices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_repayments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_histories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_accruals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_write_admin" ON profiles
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated
  USING    (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── REFERENCE TABLES ─────────────────────────────────────────────────────────
CREATE POLICY "departments_select" ON departments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "departments_write"  ON departments FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "positions_select" ON positions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "positions_write"  ON positions FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "work_shifts_select"     ON work_shifts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "work_shifts_kiosk_read" ON work_shifts FOR SELECT TO anon        USING (TRUE);
CREATE POLICY "work_shifts_write"      ON work_shifts FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "holidays_select" ON holidays FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "holidays_write"  ON holidays FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

-- ── EMPLOYEES ─────────────────────────────────────────────────────────────────
CREATE POLICY "employees_admin" ON employees
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "employees_read_auth" ON employees
  FOR SELECT TO authenticated
  USING (is_admin() OR id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- Kiosk: no raw column access — use get_kiosk_employee_cache() RPC instead
-- (no anon policy on employees table itself — migration 005 removed it)

-- ── ATTENDANCE RECORDS ────────────────────────────────────────────────────────
CREATE POLICY "attendance_admin" ON attendance_records
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "attendance_self" ON attendance_records
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "attendance_kiosk_select" ON attendance_records
  FOR SELECT TO anon USING (date = CURRENT_DATE);

CREATE POLICY "kiosk_insert_attendance" ON attendance_records
  FOR INSERT TO anon WITH CHECK (source = 'kiosk');

CREATE POLICY "kiosk_update_attendance" ON attendance_records
  FOR UPDATE TO anon
  USING  (source = 'kiosk')
  WITH CHECK (source = 'kiosk');

-- ── LEAVE REQUESTS ────────────────────────────────────────────────────────────
CREATE POLICY "leave_requests_admin" ON leave_requests
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "leave_requests_select_self" ON leave_requests
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "leave_requests_insert_self" ON leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "leave_requests_update_self" ON leave_requests
  FOR UPDATE TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND status = 'pending')
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── LEAVE BALANCES ────────────────────────────────────────────────────────────
CREATE POLICY "leave_balances_admin" ON leave_balances
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "leave_balances_self" ON leave_balances
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── OVERTIME REQUESTS ─────────────────────────────────────────────────────────
CREATE POLICY "overtime_admin" ON overtime_requests
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "overtime_select_self" ON overtime_requests
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "overtime_insert_self" ON overtime_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "overtime_update_self" ON overtime_requests
  FOR UPDATE TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND status = 'pending')
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── PAYROLL PERIODS & ENTRIES ─────────────────────────────────────────────────
CREATE POLICY "payroll_periods_write" ON payroll_periods
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','payroll-officer'))
  WITH CHECK (get_my_role() IN ('super-admin','payroll-officer'));

CREATE POLICY "payroll_periods_read" ON payroll_periods
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('super-admin','payroll-officer','hr-admin','dept-head'));

-- Only draft periods can be deleted
CREATE POLICY "payroll_delete_draft_only" ON payroll_periods
  FOR DELETE TO authenticated
  USING (status = 'draft');

CREATE POLICY "payroll_entries_write" ON payroll_entries
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','payroll-officer'))
  WITH CHECK (get_my_role() IN ('super-admin','payroll-officer'));

CREATE POLICY "payroll_entries_read" ON payroll_entries
  FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('super-admin','payroll-officer','hr-admin','dept-head')
    OR employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- ── AUDIT LOGS ────────────────────────────────────────────────────────────────
-- user_id must match caller's auth.uid() or be 'sys' (background jobs)
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text OR user_id = 'sys');

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('super-admin','hr-admin'));

-- ── APP SETTINGS ──────────────────────────────────────────────────────────────
CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "app_settings_kiosk_read" ON app_settings
  FOR SELECT TO anon USING (id = 'company');

CREATE POLICY "app_settings_write" ON app_settings
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin','payroll-officer'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin','payroll-officer'));

-- ── REGISTERED DEVICES ────────────────────────────────────────────────────────
CREATE POLICY "kiosk_device_register"   ON registered_devices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "kiosk_device_update_own" ON registered_devices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "kiosk_device_read_own"   ON registered_devices FOR SELECT TO anon USING (true);

-- ── SALARY ADVANCES & REPAYMENTS ─────────────────────────────────────────────
CREATE POLICY "advances_auth_read"  ON salary_advances     FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "advances_auth_write" ON salary_advances     FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "repay_auth_read"     ON advance_repayments  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "repay_auth_write"    ON advance_repayments  FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── EMPLOYEE DOCUMENTS & HISTORIES ───────────────────────────────────────────
CREATE POLICY "docs_auth_read"         ON employee_documents FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "docs_auth_write"        ON employee_documents FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "salhistory_auth_read"   ON salary_histories   FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "salhistory_auth_write"  ON salary_histories   FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── LEAVE ACCRUALS ────────────────────────────────────────────────────────────
CREATE POLICY "accruals_auth_read"  ON leave_accruals FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "accruals_auth_write" ON leave_accruals FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
CREATE POLICY "notif_own_read"     ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_own_update"   ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_service_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ── GRANTS for kiosk RPCs ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON pin_attempts TO anon;
GRANT SELECT, INSERT, UPDATE ON pin_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION verify_employee_pin_safe(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_employee_pin_safe(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_pin_failure(UUID)       TO anon;
GRANT EXECUTE ON FUNCTION record_pin_failure(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION get_kiosk_employee_cache()     TO anon;
GRANT EXECUTE ON FUNCTION get_kiosk_employee_cache()     TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 10: APP SETTINGS SEED DATA
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO app_settings (id, value) VALUES
  ('company', '{
    "name": "Ten Foundation Philippines Inc.",
    "tagline": "HR & Payroll System",
    "address": "Metro Manila, Philippines",
    "contact": "",
    "email": "hr@tenfoundation.ph",
    "tin": "",
    "payPeriod": "bi-monthly",
    "sssNo": "",
    "philhealthNo": "",
    "pagibigNo": "",
    "hrOfficer": "",
    "hrEmail": "hr@tenfoundation.ph",
    "payrollOfficer": "",
    "defaultFrequency": "bi-monthly",
    "otMultiplierRegular": 1.25,
    "otMultiplierRestDay": 1.30,
    "vacationLeaveCredits": 15,
    "sickLeaveCredits": 15,
    "emergencyLeaveCredits": 5
  }'::jsonb),
  ('deductions', '{
    "lateDeductionEnabled": true,
    "lateDeductionMultiplier": 1.0,
    "absenceDeductionEnabled": true,
    "absenceDeductionType": "daily-rate",
    "undertimeDeductionEnabled": true,
    "undertimeDeductionMultiplier": 1.0,
    "overtimeEnabled": true,
    "overtimeMultiplierRegular": 1.25,
    "overtimeMultiplierRestDay": 1.30,
    "overtimeThresholdMinutes": 0,
    "nightDiffEnabled": true,
    "nightDiffMultiplier": 0.10
  }'::jsonb)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 11: ADMIN ACCOUNT
--   Email    : princearveeavena@gmail.com
--   Password : Arvee1407
--   Role     : super-admin
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_uid UUID;
BEGIN
  -- Remove any stale profiles/users with this email
  DELETE FROM profiles WHERE id IN (SELECT id FROM auth.users WHERE email = 'princearveeavena@gmail.com');
  DELETE FROM auth.users WHERE email = 'princearveeavena@gmail.com';

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    phone_change, phone_change_token, email_change_token_current,
    email_change_confirm_status, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'princearveeavena@gmail.com',
    crypt('Arvee1407', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Arvee Avena"}',
    FALSE, FALSE, FALSE, NOW(), NOW(),
    '', '', '', '', '', '', '', 0, ''
  ) RETURNING id INTO v_uid;

  INSERT INTO profiles (id, name, role, email, avatar_initials)
  VALUES (v_uid, 'Arvee Avena', 'super-admin', 'princearveeavena@gmail.com', 'AA')
  ON CONFLICT (id) DO UPDATE SET
    name            = 'Arvee Avena',
    role            = 'super-admin',
    email           = 'princearveeavena@gmail.com',
    avatar_initials = 'AA';

  RAISE NOTICE '✅ Admin created — UUID: %', v_uid;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- PART 12: VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════════════════════════════

SELECT '=== TABLES ===' AS check;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT '=== FUNCTIONS ===' AS check;
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

SELECT '=== APP SETTINGS ===' AS check;
SELECT id, updated_at FROM app_settings;

SELECT '=== ADMIN ACCOUNT ===' AS check;
SELECT u.email, u.email_confirmed_at IS NOT NULL AS confirmed, p.role, p.name,
  '✅ Ready to login' AS status
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'princearveeavena@gmail.com';
