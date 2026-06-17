-- ─── Migration 016: Cash Advance Enhancements ────────────────────────────────
-- Adds suspension, write-off, balance correction, and repayment-type tracking
-- to the salary advance system.
--
-- Changes:
--   salary_advances:
--     + is_suspended        BOOLEAN — pauses automatic payroll deductions
--     + suspension_reason   TEXT
--     + suspended_by        TEXT
--     + suspended_at        TIMESTAMPTZ
--     + cancelled_by        TEXT    — who cancelled a pending/approved advance
--     + cancelled_at        TIMESTAMPTZ
--     + cancellation_reason TEXT
--     + status check updated to include 'written_off'
--
--   advance_repayments:
--     + type  TEXT — 'payroll' | 'manual' | 'adjustment' | 'reversal'
--     - amount CHECK(amount > 0) replaced with CHECK(amount != 0)
--       so balance corrections (negative adjustments) can be recorded.
--
-- Idempotent: safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Suspension fields on salary_advances ───────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salary_advances' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE salary_advances
      ADD COLUMN is_suspended       BOOLEAN     NOT NULL DEFAULT FALSE,
      ADD COLUMN suspension_reason  TEXT,
      ADD COLUMN suspended_by       TEXT,
      ADD COLUMN suspended_at       TIMESTAMPTZ;
  END IF;
END $$;

-- ── 2. Cancellation fields on salary_advances ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salary_advances' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE salary_advances
      ADD COLUMN cancelled_by        TEXT,
      ADD COLUMN cancelled_at        TIMESTAMPTZ,
      ADD COLUMN cancellation_reason TEXT;
  END IF;
END $$;

-- ── 3. Expand status check to include 'written_off' ──────────────────────────
-- Drop the existing check and recreate with the new value.
ALTER TABLE salary_advances
  DROP CONSTRAINT IF EXISTS salary_advances_status_check;

ALTER TABLE salary_advances
  ADD CONSTRAINT salary_advances_status_check
  CHECK (status IN (
    'pending', 'approved', 'released', 'fully_paid',
    'rejected', 'cancelled', 'written_off'
  ));

-- ── 4. Repayment type column ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'advance_repayments' AND column_name = 'type'
  ) THEN
    ALTER TABLE advance_repayments
      ADD COLUMN type TEXT NOT NULL DEFAULT 'manual'
        CHECK (type IN ('payroll', 'manual', 'adjustment', 'reversal'));
  END IF;
END $$;

-- ── 5. Allow signed amounts in advance_repayments ────────────────────────────
-- Negative amounts represent balance-reduction adjustments (e.g. HR corrects
-- an over-repayment, or records a write-off reversal of prior deductions).
-- We keep CHECK(amount != 0) so zero amounts are still rejected.
ALTER TABLE advance_repayments
  DROP CONSTRAINT IF EXISTS advance_repayments_amount_check;

ALTER TABLE advance_repayments
  ADD CONSTRAINT advance_repayments_amount_check
  CHECK (amount != 0);

-- ── 6. Index: payroll generator skips suspended advances ─────────────────────
CREATE INDEX IF NOT EXISTS idx_advances_suspended
  ON salary_advances (is_suspended, status)
  WHERE status = 'released';

-- ── 7. Backfill existing payroll-sourced repayments with type = 'payroll' ────
-- Repayments that already have a payroll_period_id were created by the payroll
-- engine — mark them correctly so history panels can show the right label.
UPDATE advance_repayments
SET    type = 'payroll'
WHERE  payroll_period_id IS NOT NULL
  AND  type = 'manual';
