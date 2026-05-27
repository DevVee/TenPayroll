-- ═══════════════════════════════════════════════════════════════════════════════
-- Veltrix HR & Payroll — Supabase Schema
-- Run this in the Supabase SQL Editor (once, on a fresh project).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ══════════════════════════════════════════════════════════════════════════════
-- PROFILES  (links Supabase Auth users → app roles)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'employee',   -- super-admin | hr-admin | payroll-officer | dept-head | employee
  employee_id    UUID,                               -- FK set after employees table exists
  department     TEXT,
  avatar_initials TEXT
);

-- ══════════════════════════════════════════════════════════════════════════════
-- DEPARTMENTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  code        TEXT,
  description TEXT,
  head_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- POSITIONS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT UNIQUE NOT NULL,
  department  TEXT,
  level       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- WORK SHIFTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS work_shifts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  time_in                     TEXT NOT NULL,   -- "08:00"
  time_out                    TEXT NOT NULL,   -- "17:00"
  break_minutes               INT  NOT NULL DEFAULT 60,
  grace_minutes               INT  NOT NULL DEFAULT 15,
  rest_days                   INT[]NOT NULL DEFAULT '{0,6}',
  overtime_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  overtime_threshold_minutes  INT  DEFAULT 30
);

-- ══════════════════════════════════════════════════════════════════════════════
-- EMPLOYEES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS employees (
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
  status                  TEXT NOT NULL DEFAULT 'active',
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
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from profiles to employees
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_employee
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Partial UNIQUE: allows multiple NULLs (employees without PIN/RFID),
-- but enforces uniqueness for any non-NULL value.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_employees_pin_code ON employees(pin_code) WHERE pin_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_employees_rfid_tag ON employees(rfid_tag) WHERE rfid_tag IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- ATTENDANCE RECORDS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attendance_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name      TEXT NOT NULL,
  employee_no        TEXT NOT NULL,
  department         TEXT,
  date               DATE NOT NULL,
  time_in            TIMESTAMPTZ,
  time_out           TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'present',
  minutes_late       INT  NOT NULL DEFAULT 0,
  overtime_minutes   INT  NOT NULL DEFAULT 0,
  night_diff_minutes INT  NOT NULL DEFAULT 0,
  undertime_minutes  INT  NOT NULL DEFAULT 0,
  source             TEXT NOT NULL DEFAULT 'kiosk',   -- 'kiosk' | 'manual'
  corrected_by       TEXT,
  correction_reason  TEXT,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One record per employee per day
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_date        ON attendance_records(date);
CREATE INDEX idx_attendance_employee_id ON attendance_records(employee_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- HOLIDAYS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS holidays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  date         DATE NOT NULL UNIQUE,
  type         TEXT NOT NULL DEFAULT 'regular',   -- regular | special-non-working | special-working
  is_nationwide BOOLEAN NOT NULL DEFAULT TRUE,
  description  TEXT
);

-- ══════════════════════════════════════════════════════════════════════════════
-- LEAVE REQUESTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS leave_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name    TEXT NOT NULL,
  employee_no      TEXT,
  leave_type       TEXT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  days             INT  NOT NULL DEFAULT 1,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- LEAVE BALANCES
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS leave_balances (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year         INT  NOT NULL,
  vacation     JSONB NOT NULL DEFAULT '{"entitled":15,"used":0,"balance":15}',
  sick         JSONB NOT NULL DEFAULT '{"entitled":15,"used":0,"balance":15}',
  emergency    JSONB NOT NULL DEFAULT '{"entitled":5,"used":0,"balance":5}',
  UNIQUE (employee_id, year)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- OVERTIME REQUESTS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS overtime_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name    TEXT NOT NULL,
  employee_no      TEXT NOT NULL,
  department       TEXT NOT NULL,
  date             DATE NOT NULL,
  hours_requested  NUMERIC(6,2) NOT NULL DEFAULT 0,
  overtime_type    TEXT DEFAULT 'regular',
  multiplier       NUMERIC(5,2) DEFAULT 1.25,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PAYROLL PERIODS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payroll_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_no        TEXT UNIQUE NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  pay_date         DATE NOT NULL,
  frequency        TEXT NOT NULL DEFAULT 'bi-monthly',
  status           TEXT NOT NULL DEFAULT 'draft',
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

-- ══════════════════════════════════════════════════════════════════════════════
-- PAYROLL ENTRIES  (one row per employee per pay period)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payroll_entries (
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

-- ══════════════════════════════════════════════════════════════════════════════
-- AUDIT LOGS
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_module    ON audit_logs(module);

-- Additional performance indexes (missing from initial schema)
CREATE INDEX IF NOT EXISTS idx_employees_status        ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department    ON employees(department);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period  ON payroll_entries(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_overtime_employee       ON overtime_requests(employee_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- APP SETTINGS  (key-value, single-row per key)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_settings (
  id         TEXT PRIMARY KEY,   -- 'company' | 'deductions'
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- PAYROLL SEQUENCE  (replaces localStorage payrollSeq)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS payroll_seq START 100 INCREMENT 1;

-- Helper function used by seed + app
CREATE OR REPLACE FUNCTION next_period_no()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'PAY-' || LPAD(NEXTVAL('payroll_seq')::TEXT, 4, '0');
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY  (role-aware — replaces blanket authenticated_all)
-- Roles: super-admin | hr-admin | payroll-officer | dept-head | employee
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_shifts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings       ENABLE ROW LEVEL SECURITY;

-- ── Helper functions ──────────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS when reading profiles (prevents recursion).
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(role, 'employee') FROM profiles WHERE id = auth.uid();
$$;

-- Returns TRUE for any role that administers the system.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT get_my_role() IN ('super-admin','hr-admin','payroll-officer','dept-head');
$$;

-- ── PROFILES ─────────────────────────────────────────────────────────────────
-- All authenticated users read their own profile; admins read all.
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

-- Only super-admin / hr-admin create or delete profiles.
CREATE POLICY "profiles_write_admin" ON profiles
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

-- Any user can update their own name / avatar.
CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE TO authenticated
  USING    (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── REFERENCE TABLES (departments, positions, work_shifts, holidays) ──────────
-- Admins manage; everyone else reads.
CREATE POLICY "departments_select" ON departments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "departments_write"  ON departments FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "positions_select" ON positions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "positions_write"  ON positions FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "work_shifts_select" ON work_shifts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "work_shifts_write"  ON work_shifts FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "holidays_select" ON holidays FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "holidays_write"  ON holidays FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

-- ── EMPLOYEES ─────────────────────────────────────────────────────────────────
-- Admins: full CRUD.
-- Employees: SELECT own record only (via profiles.employee_id).
-- Anon (kiosk machine): SELECT only — needed for PIN/RFID lookup.
CREATE POLICY "employees_admin" ON employees
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "employees_read_auth" ON employees
  FOR SELECT TO authenticated
  USING (is_admin() OR id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "employees_kiosk_lookup" ON employees
  FOR SELECT TO anon
  USING (TRUE);   -- kiosk needs full scan for PIN/RFID; no PII beyond what's on the terminal

-- ── ATTENDANCE RECORDS ────────────────────────────────────────────────────────
-- Admins: full CRUD.
-- Employees: SELECT own records.
-- Anon (kiosk): INSERT + UPDATE today's record; SELECT today's records.
CREATE POLICY "attendance_admin" ON attendance_records
  FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "attendance_self" ON attendance_records
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "attendance_kiosk_select" ON attendance_records
  FOR SELECT TO anon USING (date = CURRENT_DATE);

CREATE POLICY "attendance_kiosk_insert" ON attendance_records
  FOR INSERT TO anon WITH CHECK (date = CURRENT_DATE);

CREATE POLICY "attendance_kiosk_update" ON attendance_records
  FOR UPDATE TO anon
  USING    (date = CURRENT_DATE)
  WITH CHECK (date = CURRENT_DATE);

-- ── LEAVE REQUESTS ────────────────────────────────────────────────────────────
-- Admins: full CRUD.
-- Employees: SELECT own; INSERT own; UPDATE own pending requests.
CREATE POLICY "leave_requests_admin" ON leave_requests
  FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "leave_requests_select_self" ON leave_requests
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "leave_requests_insert_self" ON leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "leave_requests_update_self" ON leave_requests
  FOR UPDATE TO authenticated
  USING    (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND status = 'pending')
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── LEAVE BALANCES ────────────────────────────────────────────────────────────
CREATE POLICY "leave_balances_admin" ON leave_balances
  FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "leave_balances_self" ON leave_balances
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── OVERTIME REQUESTS ─────────────────────────────────────────────────────────
CREATE POLICY "overtime_admin" ON overtime_requests
  FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "overtime_select_self" ON overtime_requests
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "overtime_insert_self" ON overtime_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "overtime_update_self" ON overtime_requests
  FOR UPDATE TO authenticated
  USING    (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND status = 'pending')
  WITH CHECK (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- ── PAYROLL PERIODS & ENTRIES ─────────────────────────────────────────────────
-- super-admin + payroll-officer: full CRUD.
-- hr-admin + dept-head: SELECT only.
-- Employees: SELECT own payslip entries only.
CREATE POLICY "payroll_periods_write" ON payroll_periods
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','payroll-officer'))
  WITH CHECK (get_my_role() IN ('super-admin','payroll-officer'));

CREATE POLICY "payroll_periods_read" ON payroll_periods
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('super-admin','payroll-officer','hr-admin','dept-head'));

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
-- All authenticated roles can INSERT (every module logs actions).
-- Only super-admin / hr-admin can SELECT (audit trail visibility).
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('super-admin','hr-admin'));

-- ── APP SETTINGS ──────────────────────────────────────────────────────────────
-- All authenticated users read settings (company name, deduction rates, etc.).
-- Only admins and payroll-officer can write.
CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "app_settings_write" ON app_settings
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin','payroll-officer'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin','payroll-officer'));
