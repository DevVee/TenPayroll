-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002: Atomic DB Functions + Missing Performance Indexes
-- Run AFTER migration 001 in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses CREATE OR REPLACE / IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Atomic leave balance decrement ────────────────────────────────────────
-- Prevents the race condition where two concurrent approvals both read the
-- same balance, decrement it independently, and write back wrong totals.
-- This function runs as a single UPDATE in the DB engine (atomic).
--
-- Used by: src/lib/_db/leaves.ts apiUpdateLeaveStatus
CREATE OR REPLACE FUNCTION decrement_leave_balance(
  p_employee_id UUID,
  p_year        INT,
  p_type        TEXT,   -- 'vacation' | 'sick' | 'emergency'
  p_days        INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_field TEXT := p_type;   -- column name matches leave type
BEGIN
  -- Validate leave type to prevent SQL injection via dynamic field name
  IF p_type NOT IN ('vacation', 'sick', 'emergency') THEN
    RAISE EXCEPTION 'Invalid leave type: %', p_type;
  END IF;

  -- Atomic JSONB update: increment used + decrement balance in a single statement
  EXECUTE format(
    'UPDATE leave_balances
     SET %I = jsonb_set(
       jsonb_set(%I, ''{used}'',    to_jsonb((%I->>''used'')::int    + $1)),
                        ''{balance}'', to_jsonb((%I->>''balance'')::int - $1)
     )
     WHERE employee_id = $2 AND year = $3',
    v_field, v_field, v_field, v_field
  ) USING p_days, p_employee_id, p_year;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No leave balance record found for employee % in year %', p_employee_id, p_year;
  END IF;
END;
$$;

-- ── 2. Performance indexes (missing from initial schema) ─────────────────────

-- holidays: payroll generation queries holidays WHERE date BETWEEN start AND end
CREATE INDEX IF NOT EXISTS idx_holidays_date
  ON holidays(date);

-- payroll_periods: dashboard and list queries filter by status
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status
  ON payroll_periods(status);

-- payroll_periods: sorting + status combined (most common pattern)
CREATE INDEX IF NOT EXISTS idx_payroll_periods_start_date
  ON payroll_periods(start_date DESC);

-- leave_requests: "my pending leaves" query: WHERE employee_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
  ON leave_requests(employee_id, status);

-- overtime_requests: similar pattern to leave_requests
CREATE INDEX IF NOT EXISTS idx_overtime_employee_status
  ON overtime_requests(employee_id, status);

-- ── 3. Verify functions exist ─────────────────────────────────────────────────
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_profile', 'decrement_leave_balance', 'get_my_role', 'is_admin', 'next_period_no')
ORDER BY routine_name;
