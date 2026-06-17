-- ─── Migration 007: Row-Level Security (RLS) ─────────────────────────────────
-- Locks down every user-facing table so that:
--   • Authenticated users can only read/write what their role allows.
--   • The service-role key (used by admin scripts) bypasses RLS entirely.
--   • Unauthenticated requests are blocked on all tables.
--
-- Table names verified against the application source code:
--   employees, attendance_records, leave_requests, leave_balances,
--   overtime_requests, payroll_periods, payroll_entries,
--   salary_advances, advance_repayments, salary_history,
--   audit_logs, profiles, departments, positions, work_shifts,
--   holidays, app_settings, leave_types, hr_roles, hr_role_permissions
--
-- Run in Supabase SQL Editor. Safe to re-run (DROP IF EXISTS before every policy).
--
-- ⚠️  Test every app flow in staging before applying to production.
--     A misconfigured policy returns empty results, not errors.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: current user's role from profiles ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
  RETURNS TEXT
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_read"  ON employees;
DROP POLICY IF EXISTS "emp_write" ON employees;

CREATE POLICY "emp_read" ON employees
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "emp_write" ON employees
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE RECORDS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_read"  ON attendance_records;
DROP POLICY IF EXISTS "att_write" ON attendance_records;

CREATE POLICY "att_read" ON attendance_records
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "att_write" ON attendance_records
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- LEAVE REQUESTS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_read"  ON leave_requests;
DROP POLICY IF EXISTS "leave_write" ON leave_requests;

CREATE POLICY "leave_read" ON leave_requests
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "leave_write" ON leave_requests
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- LEAVE BALANCES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_bal_read"  ON leave_balances;
DROP POLICY IF EXISTS "leave_bal_write" ON leave_balances;

CREATE POLICY "leave_bal_read" ON leave_balances
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "leave_bal_write" ON leave_balances
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- OVERTIME REQUESTS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ot_read"  ON overtime_requests;
DROP POLICY IF EXISTS "ot_write" ON overtime_requests;

CREATE POLICY "ot_read" ON overtime_requests
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "ot_write" ON overtime_requests
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','dept-head')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PAYROLL PERIODS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pay_period_read"  ON payroll_periods;
DROP POLICY IF EXISTS "pay_period_write" ON payroll_periods;

CREATE POLICY "pay_period_read" ON payroll_periods
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
  );

CREATE POLICY "pay_period_write" ON payroll_periods
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PAYROLL ENTRIES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pay_entry_read"  ON payroll_entries;
DROP POLICY IF EXISTS "pay_entry_write" ON payroll_entries;

CREATE POLICY "pay_entry_read" ON payroll_entries
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer','dept-head')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "pay_entry_write" ON payroll_entries
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SALARY ADVANCES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advance_read"  ON salary_advances;
DROP POLICY IF EXISTS "advance_write" ON salary_advances;

CREATE POLICY "advance_read" ON salary_advances
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
    OR (
      public.current_user_role() = 'employee'
      AND employee_id = (SELECT employee_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "advance_write" ON salary_advances
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ADVANCE REPAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE advance_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repayment_read"  ON advance_repayments;
DROP POLICY IF EXISTS "repayment_write" ON advance_repayments;

CREATE POLICY "repayment_read" ON advance_repayments
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

CREATE POLICY "repayment_write" ON advance_repayments
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SALARY HISTORY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sal_hist_read"   ON salary_history;
DROP POLICY IF EXISTS "sal_hist_insert" ON salary_history;

CREATE POLICY "sal_hist_read" ON salary_history
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

CREATE POLICY "sal_hist_insert" ON salary_history
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOGS — append-only (no UPDATE / DELETE by anyone via app)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_read"   ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

CREATE POLICY "audit_read" ON audit_logs
  FOR SELECT USING (
    public.current_user_role() IN ('super-admin','hr-admin','payroll-officer')
  );

CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read"  ON profiles;
DROP POLICY IF EXISTS "profiles_write" ON profiles;

CREATE POLICY "profiles_read" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.current_user_role() IN ('super-admin','hr-admin')
  );

CREATE POLICY "profiles_write" ON profiles
  FOR ALL USING (
    public.current_user_role() IN ('super-admin','hr-admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- REFERENCE TABLES
-- Any authenticated user can read; only HR/Admin can write.
-- Table names verified against source: work_shifts (NOT shifts).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'departments',
    'positions',
    'work_shifts',
    'holidays',
    'leave_types',
    'app_settings',
    'hr_roles',
    'hr_role_permissions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "ref_read"  ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "ref_write" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "ref_read" ON %I FOR SELECT USING (auth.uid() IS NOT NULL)',
      tbl
    );
    EXECUTE format(
      $p$CREATE POLICY "ref_write" ON %I FOR ALL USING (
        public.current_user_role() IN ('super-admin','hr-admin')
      )$p$,
      tbl
    );
  END LOOP;
END $$;
