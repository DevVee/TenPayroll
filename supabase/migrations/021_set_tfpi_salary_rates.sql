-- ─── Migration 021: Set TFPI employee salary rates ───────────────────────────
-- All employees → ₱600 / day
--
--   Daily workers  (compensation_type = 'daily'):
--     compensation_rate = 600   ← engine reads this as the day rate
--     daily_rate        = 600
--     basic_salary      = 13 200  (600 × 22 working days, for reference)
--
--   Monthly workers (compensation_type = 'monthly'):
--     basic_salary      = 13 200  (600 × 22)
--     compensation_rate = 13 200  ← engine reads this as the monthly salary
--     daily_rate        = 600     ← engine uses this when dr > 0
--
-- Safe to re-run (plain UPDATEs with no side effects).
-- Update via HR → Employees once actual rates are confirmed.
-- ─────────────────────────────────────────────────────────────────────────────

-- Daily workers ───────────────────────────────────────────────────────────────
UPDATE employees
SET
  daily_rate        = 600,
  compensation_rate = 600,
  basic_salary      = 13200
WHERE compensation_type = 'daily'
  AND employee_no IN (
    -- Bag Production
    'S007-12','S008-12','S009-12','C010-12','S011-12',
    'S012-15','S013-16','S014-16','S015-16','S016-16',
    'C017-16','S018-16','S022-17','S023-18','C024-18',
    'S025-19','C026-19','C027-20','S028-20','S029-20',
    'C030-20','S031-20','S032-20','C034-21','S035-21',
    'S038-21','S039-21','C041-21','C042-21','C043-21',
    'S044-22','S045-22','C047-22','C048-22','C049-22',
    'S050-22','S053-22','C054-22','C055-23','C058-23',
    'S059-24','P062-25','P063-26',
    -- Maintenance
    'M020-17','M021-17','M052-22','M056-23'
  );

-- Monthly workers ─────────────────────────────────────────────────────────────
UPDATE employees
SET
  daily_rate        = 600,
  compensation_rate = 13200,
  basic_salary      = 13200
WHERE compensation_type = 'monthly'
  AND employee_no IN (
    -- Admin
    'A001-16','P002-12','P003-12','P004-12','P005-12',
    'H040-21','H051-22','A060-24','M061-25',
    -- Bag Production (monthly-salaried QC officer)
    'P006-12'
  );
