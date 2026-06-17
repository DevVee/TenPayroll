-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 010: New tables (salary_advances, employee_documents, salary_history,
--                leave_accruals, notifications) + critical performance indexes
--                + full_name auto-sync trigger.
-- Safe to run multiple times (uses IF NOT EXISTS / CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. full_name auto-sync trigger ───────────────────────────────────────────
-- Ensures first_name + middle_name + last_name always stays in sync with full_name.
CREATE OR REPLACE FUNCTION sync_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := TRIM(
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NULLIF(TRIM(NEW.middle_name), ''), '') || ' ' ||
    COALESCE(NEW.last_name, '')
  );
  -- Collapse multiple spaces that arise when middle_name is empty
  NEW.full_name := REGEXP_REPLACE(NEW.full_name, '\s+', ' ', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_full_name ON employees;
CREATE TRIGGER trg_sync_full_name
  BEFORE INSERT OR UPDATE OF first_name, middle_name, last_name
  ON employees
  FOR EACH ROW EXECUTE FUNCTION sync_full_name();

-- ── 2. Soft-delete column on employees ───────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE employees ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── 3. Salary Advances ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_advances (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES employees(id),
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  purpose            TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','released','fully_paid','rejected','cancelled')),
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by        TEXT,
  approved_at        TIMESTAMPTZ,
  released_at        TIMESTAMPTZ,
  release_notes      TEXT,
  rejection_reason   TEXT,
  repayment_start    DATE,
  monthly_deduction  NUMERIC(12,2),
  total_repaid       NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding        NUMERIC(12,2) GENERATED ALWAYS AS (amount - total_repaid) STORED,
  notes              TEXT,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Advance repayment tracking
CREATE TABLE IF NOT EXISTS advance_repayments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id        UUID NOT NULL REFERENCES salary_advances(id) ON DELETE CASCADE,
  payroll_period_id UUID REFERENCES payroll_periods(id),
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes             TEXT,
  recorded_by       TEXT,
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Employee Documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'other',  -- 'contract', 'id', 'certificate', 'other'
  title         TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     INTEGER,
  uploaded_by   TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    DATE,
  notes         TEXT
);

-- ── 5. Salary History ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_histories (
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

-- ── 6. Leave Accruals ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_accruals (
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

-- ── 7. Notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,   -- references auth.users(id)
  type       TEXT NOT NULL,   -- 'leave_pending', 'payroll_ready', 'ot_pending', 'advance_pending'
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. Critical Performance Indexes ──────────────────────────────────────────

-- attendance: the payroll generator runs a range scan per period — must be fast
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date
  ON attendance_records (employee_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON attendance_records (date);

-- payroll entries: joining from periods
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period
  ON payroll_entries (payroll_period_id);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_emp
  ON payroll_entries (employee_id);

-- leave requests: employee + status queries
CREATE INDEX IF NOT EXISTS idx_leave_emp_status
  ON leave_requests (employee_id, status);

-- overtime requests: employee + date
CREATE INDEX IF NOT EXISTS idx_ot_emp_date
  ON overtime_requests (employee_id, date);

-- salary advances: employee + status
CREATE INDEX IF NOT EXISTS idx_advances_emp_status
  ON salary_advances (employee_id, status);

-- notifications: user + read status
CREATE INDEX IF NOT EXISTS idx_notif_user_read
  ON notifications (user_id, read, created_at DESC);

-- ── 9. Row-Level Security for new tables ─────────────────────────────────────

ALTER TABLE salary_advances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_histories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_accruals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read salary_advances (HR view)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'salary_advances' AND policyname = 'advances_auth_read'
  ) THEN
    CREATE POLICY "advances_auth_read" ON salary_advances FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY "advances_auth_write" ON salary_advances FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'advance_repayments' AND policyname = 'repay_auth_read'
  ) THEN
    CREATE POLICY "repay_auth_read"  ON advance_repayments FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY "repay_auth_write" ON advance_repayments FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_documents' AND policyname = 'docs_auth_read'
  ) THEN
    CREATE POLICY "docs_auth_read"  ON employee_documents FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY "docs_auth_write" ON employee_documents FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'salary_histories' AND policyname = 'salhistory_auth_read'
  ) THEN
    CREATE POLICY "salhistory_auth_read"  ON salary_histories FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY "salhistory_auth_write" ON salary_histories FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leave_accruals' AND policyname = 'accruals_auth_read'
  ) THEN
    CREATE POLICY "accruals_auth_read"  ON leave_accruals FOR SELECT TO authenticated USING (TRUE);
    CREATE POLICY "accruals_auth_write" ON leave_accruals FOR ALL    TO authenticated USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notif_own_read'
  ) THEN
    -- Users can only read their own notifications
    CREATE POLICY "notif_own_read"  ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "notif_own_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
    CREATE POLICY "notif_service_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (TRUE);
  END IF;
END $$;

-- ── 10. Payroll deletion guard: only draft periods may be deleted ─────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payroll_periods' AND policyname = 'payroll_delete_draft_only'
  ) THEN
    CREATE POLICY "payroll_delete_draft_only" ON payroll_periods
      FOR DELETE TO authenticated
      USING (status = 'draft');
  END IF;
END $$;
