-- ─── Migration 015: SIL Accrual Function ─────────────────────────────────────
-- Creates a PostgreSQL function that credits 5 Service Incentive Leave days
-- to every active employee who has completed ≥1 year of service in a given
-- calendar year, without double-crediting employees who already have a record.
--
-- Per Labor Code Art. 95, SIL is 5 days/year, convertible to cash if unused.
-- Employees who have NOT yet reached 1 year are excluded automatically.
--
-- Usage (call from app via supabase.rpc):
--   SELECT * FROM credit_sil_accrual();             -- current year
--   SELECT * FROM credit_sil_accrual(2025);         -- back-fill previous year
--
-- Returns one row per eligible employee with whether they were newly credited
-- (credited = true) or were already credited (credited = false).
--
-- Idempotent: safe to run multiple times per year per employee.
-- SECURITY DEFINER: runs as the schema owner so RLS does not block the insert.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION credit_sil_accrual(
  p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
)
RETURNS TABLE (
  r_employee_id   UUID,
  r_full_name     TEXT,
  r_hire_date     DATE,
  r_service_years INT,
  r_credited      BOOLEAN   -- true = newly credited this call; false = already existed
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp       RECORD;
  v_svc_years INT;
  v_existed   BOOLEAN;
BEGIN
  -- Loop over all active employees who have reached their 1-year anniversary
  -- by the last day of the target year.
  FOR v_emp IN
    SELECT e.id, e.full_name, e.hire_date
    FROM   employees e
    WHERE  e.status    = 'active'
      AND  e.hire_date IS NOT NULL
      -- Must have completed at least 1 full year by Dec 31 of p_year
      AND  e.hire_date <= MAKE_DATE(p_year, 12, 31) - INTERVAL '1 year'
    ORDER  BY e.full_name
  LOOP
    -- Whole years of service as of Dec 31 of the target year
    v_svc_years := EXTRACT(
      YEAR FROM AGE(MAKE_DATE(p_year, 12, 31), v_emp.hire_date)
    )::INT;

    -- Check whether a record already exists for this employee/year
    SELECT EXISTS(
      SELECT 1
      FROM   leave_accruals
      WHERE  employee_id = v_emp.id
        AND  leave_type  = 'sil'
        AND  year        = p_year
    ) INTO v_existed;

    IF NOT v_existed THEN
      -- Credit 5 SIL days (entitled = 5, accrued = 5, used = 0)
      INSERT INTO leave_accruals (employee_id, leave_type, year, entitled, accrued, used)
      VALUES (v_emp.id, 'sil', p_year, 5, 5, 0);
    END IF;

    -- Return a row regardless (for the caller to see the full picture)
    r_employee_id   := v_emp.id;
    r_full_name     := v_emp.full_name;
    r_hire_date     := v_emp.hire_date;
    r_service_years := v_svc_years;
    r_credited      := NOT v_existed;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION credit_sil_accrual(INT) IS
  'Credits 5 SIL days in leave_accruals for every active employee with ≥1 year '
  'of service in p_year. Idempotent — already-credited employees are skipped '
  '(r_credited = false). Labor Code Art. 95 / DOLE compliance.';
