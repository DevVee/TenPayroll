-- ══════════════════════════════════════════════════════════════════════════════
-- TenPayroll — COMPLETE BACKEND SETUP
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times. Run this if ANY function or page is broken.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1: Core helper functions ─────────────────────────────────────────────
-- These are required by ALL RLS policies. Without them, every write operation fails.

-- get_my_role(): Returns the current user's role from the profiles table.
-- SECURITY DEFINER = bypasses RLS (prevents infinite recursion when reading profiles).
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(role, 'employee')
  FROM profiles
  WHERE id = auth.uid();
$$;

-- is_admin(): Returns true for any admin/staff role (not plain employee).
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT get_my_role() IN ('super-admin','hr-admin','payroll-officer','dept-head');
$$;

-- get_my_profile(): Returns the current user's full profile as JSON.
-- Used by the web app login flow to load the user profile after auth.
-- SECURITY DEFINER = bypasses RLS so it always works regardless of policy state.
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT row_to_json(p)
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- next_period_no(): Generates sequential payroll period numbers (PAY-0100, PAY-0101…)
CREATE SEQUENCE IF NOT EXISTS payroll_seq START 100 INCREMENT 1;

CREATE OR REPLACE FUNCTION next_period_no()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'PAY-' || LPAD(NEXTVAL('payroll_seq')::TEXT, 4, '0');
$$;

-- decrement_leave_balance(): Atomically decrements leave balance.
-- Prevents race condition where two simultaneous approvals both read same balance.
CREATE OR REPLACE FUNCTION decrement_leave_balance(
  p_employee_id UUID,
  p_year        INT,
  p_type        TEXT,
  p_days        INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

-- ── STEP 2: RLS Policies ──────────────────────────────────────────────────────
-- Enable RLS on all tables (idempotent).
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

-- Drop and recreate all policies to ensure they are correct.
-- (Dropping first prevents "policy already exists" errors on re-run.)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- PROFILES
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

-- DEPARTMENTS, POSITIONS, WORK SHIFTS, HOLIDAYS (read-all / write-admin)
CREATE POLICY "departments_select" ON departments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "departments_write"  ON departments FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "positions_select" ON positions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "positions_write"  ON positions FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "work_shifts_select"      ON work_shifts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "work_shifts_kiosk_read"  ON work_shifts FOR SELECT TO anon        USING (TRUE);
CREATE POLICY "work_shifts_write"       ON work_shifts FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "holidays_select" ON holidays FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "holidays_write"  ON holidays FOR ALL    TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

-- EMPLOYEES
CREATE POLICY "employees_admin" ON employees
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin'));

CREATE POLICY "employees_read_auth" ON employees
  FOR SELECT TO authenticated
  USING (is_admin() OR id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "employees_kiosk_lookup" ON employees
  FOR SELECT TO anon USING (TRUE);

-- EMPLOYEE KIOSK VIEW (restricted columns — no salary/IDs)
CREATE OR REPLACE VIEW employee_kiosk_view AS
  SELECT id, employee_no, full_name, pin_code, rfid_tag,
         shift_id, department, position, status
  FROM employees
  WHERE status = 'active';

GRANT SELECT ON employee_kiosk_view TO anon;
GRANT SELECT ON employee_kiosk_view TO authenticated;

-- ATTENDANCE RECORDS
CREATE POLICY "attendance_admin" ON attendance_records
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "attendance_self" ON attendance_records
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "attendance_kiosk_select" ON attendance_records
  FOR SELECT TO anon USING (date = CURRENT_DATE);

CREATE POLICY "attendance_kiosk_insert" ON attendance_records
  FOR INSERT TO anon WITH CHECK (date = CURRENT_DATE);

CREATE POLICY "attendance_kiosk_update" ON attendance_records
  FOR UPDATE TO anon
  USING (date = CURRENT_DATE) WITH CHECK (date = CURRENT_DATE);

-- LEAVE REQUESTS
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

-- LEAVE BALANCES
CREATE POLICY "leave_balances_admin" ON leave_balances
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "leave_balances_self" ON leave_balances
  FOR SELECT TO authenticated
  USING (employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()));

-- OVERTIME REQUESTS
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

-- PAYROLL PERIODS & ENTRIES
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

-- AUDIT LOGS
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('super-admin','hr-admin'));

-- APP SETTINGS
CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "app_settings_write" ON app_settings
  FOR ALL TO authenticated
  USING    (get_my_role() IN ('super-admin','hr-admin','payroll-officer'))
  WITH CHECK (get_my_role() IN ('super-admin','hr-admin','payroll-officer'));

CREATE POLICY "app_settings_kiosk_read" ON app_settings
  FOR SELECT TO anon USING (id = 'company');

-- ── STEP 3: Performance indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_date            ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id     ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date   ON attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_employees_status           ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department       ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_active           ON employees(id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee    ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status      ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_status  ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_year    ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period     ON payroll_entries(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status     ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_start_date ON payroll_periods(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_overtime_employee          ON overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_emp_status        ON overtime_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_holidays_date              ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp       ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module          ON audit_logs(module);

-- ── STEP 4: App settings seed data ────────────────────────────────────────────
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
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

-- ── STEP 5: Create admin account ──────────────────────────────────────────────
DO $$
DECLARE v_uid UUID;
BEGIN
  DELETE FROM profiles   WHERE id NOT IN (SELECT id FROM auth.users);
  DELETE FROM profiles   WHERE role = 'super-admin';
  DELETE FROM auth.users WHERE email = 'admin@tenpayroll.ph';

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    phone_change, phone_change_token, email_change_token_current,
    email_change_confirm_status, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated',
    'admin@tenpayroll.ph',
    crypt('Admin@2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"TenPayroll Admin"}',
    FALSE, FALSE, FALSE, NOW(), NOW(),
    '', '', '', '', '', '', '', 0, ''
  ) RETURNING id INTO v_uid;

  INSERT INTO profiles (id, name, role, avatar_initials)
  VALUES (v_uid, 'TenPayroll Admin', 'super-admin', 'TA')
  ON CONFLICT (id) DO UPDATE SET
    name = 'TenPayroll Admin', role = 'super-admin', avatar_initials = 'TA';

  RAISE NOTICE '✅ Admin created — UUID: %', v_uid;
END $$;

-- ── STEP 6: Verify everything ──────────────────────────────────────────────────
SELECT '=== FUNCTIONS ===' AS check;
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_role','is_admin','get_my_profile','next_period_no','decrement_leave_balance')
ORDER BY routine_name;

SELECT '=== APP SETTINGS ===' AS check;
SELECT id, jsonb_pretty(value) FROM app_settings;

SELECT '=== ADMIN ACCOUNT ===' AS check;
SELECT u.email, u.email_confirmed_at IS NOT NULL AS confirmed, p.role, p.name,
  '✅ Ready to login' AS status
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@tenpayroll.ph';
