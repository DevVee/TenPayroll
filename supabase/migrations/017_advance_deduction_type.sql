-- ─── Migration 017: Advance Deduction Type & Installment Count ───────────────
-- Gives HR explicit control over HOW the deduction amount is interpreted:
--
--   'monthly'      (default / backward-compat)
--                  monthly_deduction = monthly budget.
--                  Payroll generator divides by actual period count (4 or 5 for
--                  weekly, 2 for bi-monthly, 1 for monthly) so the full monthly
--                  budget is always recovered within the calendar month.
--
--   'per_period'   monthly_deduction = exact per-period amount.
--                  Payroll generator uses it as-is — no division.
--                  Same peso amount is deducted every payroll run regardless of
--                  how many periods fall in a given month.
--
--   'installments' monthly_deduction = amount / installment_count (computed on save).
--                  Payroll generator uses it as-is — no division.
--                  installment_count stores the total number of payroll runs the
--                  advance is spread across.
--
-- Idempotent: safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salary_advances' AND column_name = 'deduction_type'
  ) THEN
    ALTER TABLE salary_advances
      ADD COLUMN deduction_type    TEXT    NOT NULL DEFAULT 'monthly'
        CHECK (deduction_type IN ('monthly', 'per_period', 'installments')),
      ADD COLUMN installment_count INTEGER CHECK (installment_count > 0);
  END IF;
END $$;

-- Index: payroll generator fetches by employee + status + is_suspended; the
-- planner already uses idx_advances_emp_status but adding deduction_type to the
-- select projection does not need a new index — it is a covering read.
