-- ─── Migration 014: SIL and Solo-Parent leave types ──────────────────────────
-- Adds two legally-mandated Philippine leave types to the leave_types table:
--
--   sil         — Service Incentive Leave (Labor Code Art. 95 / Book III Rule V)
--                 5 days paid leave per year for employees with ≥1 year of service.
--                 Convertible to cash at year-end if unused. Accrual is handled by
--                 the SIL anniversary cron (see migration 015).
--
--   solo-parent — Solo Parent Leave (RA 8972, Implementing Rules Sec. 22)
--                 7 days paid leave per year for employees who are solo parents
--                 as certified by their DSWD Solo Parent ID.
--
-- Both types are already in the TypeScript LeaveType union (added in the same
-- sprint). The leave_requests.leave_type column has no CHECK constraint on its
-- value, so no ALTER TABLE is needed.
--
-- Safe to run multiple times (INSERT … WHERE NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO leave_types (code, name, is_paid, max_days_per_year, requires_approval, sort_order)
SELECT code, name, is_paid, max_days_per_year, requires_approval, sort_order FROM (VALUES
  ('sil',          'Service Incentive Leave', true,  5,    false, 8),
  ('solo-parent',  'Solo Parent Leave',       true,  7,    true,  9)
) AS t(code, name, is_paid, max_days_per_year, requires_approval, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE leave_types.code = t.code);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT code, name, max_days_per_year, sort_order
FROM   leave_types
ORDER  BY sort_order;
