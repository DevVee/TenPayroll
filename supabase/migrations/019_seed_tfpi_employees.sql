-- ─── Migration 019: Seed TFPI employee roster ────────────────────────────────
-- Source: "TFPI PAYROLL DATA.xlsx"
--   Sheet "EE DATA"              → 57 employee records
--   Sheet "EE PAYROLL DEDUCTION" → SSS fixed deduction per employee
--
-- Run order:
--   1. Departments (3 rows)   — ON CONFLICT (name) DO NOTHING
--   2. Positions   (13 rows)  — ON CONFLICT (title) DO NOTHING
--   3. Employees   (57 rows)  — ON CONFLICT (employee_no) DO NOTHING
--   4. Back-fill   department_id / position_id FK columns on employees
--
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
-- Salary rates are all 0 in the source file — update via the HR module later.
-- SSS deduction amounts are stored as per-employee payroll_components (fixed).
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. DEPARTMENTS
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO departments (name, created_at)
VALUES
  ('Admin',          NOW()),
  ('Bag Production', NOW()),
  ('Maintenance',    NOW())
ON CONFLICT (name) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. POSITIONS  (title + which department they primarily belong to)
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO positions (title, department, created_at)
VALUES
  ('ED/General Manager',          'Admin',          NOW()),
  ('Operations Manager',          'Admin',          NOW()),
  ('Admin/Finance Officer',       'Admin',          NOW()),
  ('Admin Officer',               'Admin',          NOW()),
  ('Media and Relations Officer', 'Admin',          NOW()),
  ('Quality Control Officer',     'Admin',          NOW()),
  ('Bag Research and Design',     'Admin',          NOW()),
  ('Bag Production Supervisor',   'Admin',          NOW()),
  ('Bag Production-Sewer',        'Bag Production', NOW()),
  ('Bag Production-Cutter',       'Bag Production', NOW()),
  ('Bag puller maker',            'Bag Production', NOW()),
  ('Maintenance Staff',           'Maintenance',    NOW()),
  ('Company Driver',              'Maintenance',    NOW())
ON CONFLICT (title) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. EMPLOYEES
--    email is NOT NULL → generated as  lower(employee_no) || '@tfpi.local'
--    Using SELECT FROM (VALUES …) so no per-row email is needed.
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO employees (
  employee_no, email,
  first_name, last_name, middle_name,
  full_name,
  position, department,
  status, employment_type, compensation_type,
  basic_salary, compensation_rate, daily_rate,
  pay_frequency, tax_status,
  hire_date,
  payroll_components,
  created_at, updated_at
)
SELECT
  v.employee_no,
  lower(v.employee_no) || '@tfpi.local',   -- placeholder; update via HR module
  v.first_name, v.last_name, v.middle_name,
  TRIM(v.first_name || ' ' || v.last_name),  -- full_name derived from first + last
  v.position, v.department,
  v.status, v.employment_type, v.compensation_type,
  v.basic_salary, v.compensation_rate, v.daily_rate,
  v.pay_frequency, v.tax_status,
  v.hire_date::date,
  v.payroll_components::jsonb,
  v.created_at, v.updated_at
FROM (VALUES

-- ── Admin department ──────────────────────────────────────────────────────────

-- A001-16 | Monroyo, Arline Gajisan | ED/General Manager | SSS 825
('A001-16','Arline','Monroyo','Gajisan',
 'ED/General Manager','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":825,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- P002-12 | Troyo, Raul Zeta | Bag Research and Design | SSS 450
('P002-12','Raul','Troyo','Zeta',
 'Bag Research and Design','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":450,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- P003-12 | Troyo, Simplicia Señores | Bag Production Supervisor | SSS 450
('P003-12','Simplicia','Troyo','Señores',
 'Bag Production Supervisor','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":450,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- P004-12 | Villanueva, Analiza Manalo | Admin/Finance Officer | SSS 450
('P004-12','Analiza','Villanueva','Manalo',
 'Admin/Finance Officer','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":450,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- P005-12 | Urbina, Leonida Atienza | Quality Control Officer | SSS 450
('P005-12','Leonida','Urbina','Atienza',
 'Quality Control Officer','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":450,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- H040-21 | Gajisan, Zhelmark Maaba | Media and Relations Officer | SSS 400
('H040-21','Zhelmark','Gajisan','Maaba',
 'Media and Relations Officer','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":400,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- H051-22 | Salvador, Mikah Ela Alba | Admin Officer | SSS 400
('H051-22','Mikah Ela','Salvador','Alba',
 'Admin Officer','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":400,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- A060-24 | Dayandayan, Esmeralda Umandap | Operations Manager | SSS 450
('A060-24','Esmeralda','Dayandayan','Umandap',
 'Operations Manager','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2024-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":450,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- M061-25 | Erilla, Angelica | Maintenance Staff (dept: Admin) | SSS not on file
('M061-25','Angelica','Erilla',NULL,
 'Maintenance Staff','Admin',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2025-01-01',
 '[]',
 NOW(),NOW()),

-- ── Bag Production department ─────────────────────────────────────────────────

-- P006-12 | Jambalos, Analyn Ostonal | Quality Control Officer | SSS 400
('P006-12','Analyn','Jambalos','Ostonal',
 'Quality Control Officer','Bag Production',
 'active','regular','monthly',0,0,0,'bi-monthly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":400,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S007-12 | Canale, Lourdes Espedillion | Bag Production-Sewer | SSS 350
('S007-12','Lourdes','Canale','Espedillion',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S008-12 | Carandang, Juliana Medrano | Bag Production-Sewer | SSS 350
('S008-12','Juliana','Carandang','Medrano',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S009-12 | Cabañas, Babalyn Paleria | Bag Production-Sewer | SSS 350
('S009-12','Babalyn','Cabañas','Paleria',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C010-12 | Sarasa, Jomarwin Pronto | Bag Production-Cutter | SSS 350
('C010-12','Jomarwin','Sarasa','Pronto',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S011-12 | Bituin, Rosemarie De Mesa | Bag Production-Sewer | SSS 350
('S011-12','Rosemarie','Bituin','De Mesa',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2012-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S012-15 | Arroyo, Marissa Didal | Bag Production-Sewer | SSS 350
('S012-15','Marissa','Arroyo','Didal',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2015-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S013-16 | Jornadal, Brendalen Dela Vega | Bag Production-Sewer | SSS 350
('S013-16','Brendalen','Jornadal','Dela Vega',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S014-16 | Dayao, Teresa De Mesa | Bag Production-Sewer | SSS 350
('S014-16','Teresa','Dayao','De Mesa',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S015-16 | Dela Vega, Ronalyn Bermejo | Bag Production-Sewer | SSS 300
('S015-16','Ronalyn','Dela Vega','Bermejo',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S016-16 | Cortez, Maricel Lasheras | Bag Production-Sewer | SSS 350
('S016-16','Maricel','Cortez','Lasheras',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C017-16 | Canta, Olivia Hernandez | Bag Production-Cutter | SSS 300
('C017-16','Olivia','Canta','Hernandez',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S018-16 | Bascuguin, Elizabeth Alindugan | Bag Production-Sewer | SSS 350
('S018-16','Elizabeth','Bascuguin','Alindugan',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2016-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S022-17 | Corisis, Gina Laloma | Bag Production-Sewer | SSS 350
('S022-17','Gina','Corisis','Laloma',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2017-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":350,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S023-18 | Hernandez, Rosenda Quiroz | Bag Production-Sewer | SSS 300
('S023-18','Rosenda','Hernandez','Quiroz',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2018-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C024-18 | Isar, Celidad Ramirez | Bag Production-Cutter | SSS 300
('C024-18','Celidad','Isar','Ramirez',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2018-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S025-19 | Bandoquillo, Elvira De Mesa | Bag Production-Sewer | SSS 300
('S025-19','Elvira','Bandoquillo','De Mesa',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2019-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C026-19 | Caisip, Emma Andallon | Bag Production-Cutter | SSS 300
('C026-19','Emma','Caisip','Andallon',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2019-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C027-20 | Señorez, Teodora Mayuga | Bag Production-Cutter | SSS 300
('C027-20','Teodora','Señorez','Mayuga',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2020-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S028-20 | Sistona, Lucia Polliente | Bag Production-Sewer | SSS 300
('S028-20','Lucia','Sistona','Polliente',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2020-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S029-20 | Toledo, Ma. Cecilia Corisis | Bag Production-Sewer | SSS 300
('S029-20','Ma. Cecilia','Toledo','Corisis',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2020-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C030-20 | Barase, Lenie | Bag Production-Cutter | SSS 300
('C030-20','Lenie','Barase',NULL,
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2020-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S031-20 | Izar, Lenie Aplon | Bag Production-Sewer | SSS 300
('S031-20','Lenie','Izar','Aplon',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2020-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S032-20 | Morados, Maribel Dimailig | Bag Production-Sewer | SSS 300
('S032-20','Maribel','Morados','Dimailig',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2020-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C034-21 | Castromero, Anna Lena Paras | Bag Production-Cutter | SSS 300
('C034-21','Anna Lena','Castromero','Paras',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S035-21 | Paala, Mylene Corises | Bag Production-Sewer | SSS 300
('S035-21','Mylene','Paala','Corises',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S038-21 | Bobadilla, Melchor De Guzman | Bag Production-Sewer | SSS 300
('S038-21','Melchor','Bobadilla','De Guzman',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S039-21 | Didal, Alejandro Sueno | Bag Production-Sewer | SSS 300
('S039-21','Alejandro','Didal','Sueno',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C041-21 | Sedamon, Guillerma Mayuga | Bag Production-Sewer | SSS 300
('C041-21','Guillerma','Sedamon','Mayuga',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C042-21 | Padilla, Guillerma | Bag Production-Sewer | SSS 300
('C042-21','Guillerma','Padilla',NULL,
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C043-21 | Bagunas, Dominga Felices | Bag Production-Cutter | SSS 300
('C043-21','Dominga','Bagunas','Felices',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2021-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S044-22 | Sta. Rosa, Renante Eboña | Bag Production-Sewer | SSS 300
('S044-22','Renante','Sta. Rosa','Eboña',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S045-22 | Cari-an Jr., Loreto Gengoyon | Bag Production-Sewer | SSS 300
('S045-22','Loreto','Cari-an Jr.','Gengoyon',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C047-22 | Roxas, Sabena Pagdunsulan | Bag Production-Cutter | SSS 300
('C047-22','Sabena','Roxas','Pagdunsulan',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C048-22 | Alicante, Christina Alcaraz | Bag Production-Sewer | SSS 300
('C048-22','Christina','Alicante','Alcaraz',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C049-22 | Garcia, Michelle Bandoquillo | Bag Production-Sewer | SSS 300
('C049-22','Michelle','Garcia','Bandoquillo',
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S050-22 | Castro, Raffy | Bag Production-Sewer | SSS 0 (not contributing)
('S050-22','Raffy','Castro',NULL,
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[]',
 NOW(),NOW()),

-- S053-22 | Didal, Isa Christen | Bag Production-Sewer | SSS 300
('S053-22','Isa Christen','Didal',NULL,
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C054-22 | Gebe, Carol Agquiz | Bag Production-Cutter | SSS 300
('C054-22','Carol','Gebe','Agquiz',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2022-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C055-23 | De Mesa, Maricris | Bag Production-Sewer | SSS 300
('C055-23','Maricris','De Mesa',NULL,
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2023-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- C058-23 | Ladlad, Dia Pilit | Bag Production-Cutter | SSS 300
('C058-23','Dia','Ladlad','Pilit',
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2023-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- S059-24 | Bascuguin, Maribel | Bag Production-Sewer | SSS 300
('S059-24','Maribel','Bascuguin',NULL,
 'Bag Production-Sewer','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2024-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":300,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- P062-25 | Mabilin, Fatima | Bag puller maker | SSS not on file
('P062-25','Fatima','Mabilin',NULL,
 'Bag puller maker','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2025-01-01',
 '[]',
 NOW(),NOW()),

-- P063-26 | Marquez, Ana Margarita | Bag Production-Cutter | SSS not on file
('P063-26','Ana Margarita','Marquez',NULL,
 'Bag Production-Cutter','Bag Production',
 'active','regular','daily',0,0,0,'weekly','S','2026-01-01',
 '[]',
 NOW(),NOW()),

-- ── Maintenance department ────────────────────────────────────────────────────

-- M020-17 | De Padua, Rodney Atienza | Maintenance Staff | SSS 400
('M020-17','Rodney','De Padua','Atienza',
 'Maintenance Staff','Maintenance',
 'active','regular','daily',0,0,0,'bi-monthly','S','2017-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":400,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- M021-17 | Mayuga, Edgardo Manalo | Maintenance Staff | SSS 400
('M021-17','Edgardo','Mayuga','Manalo',
 'Maintenance Staff','Maintenance',
 'active','regular','daily',0,0,0,'bi-monthly','S','2017-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":400,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW()),

-- M052-22 | Bugayon, Leonila | Maintenance Staff | SSS 0 (not contributing)
('M052-22','Leonila','Bugayon',NULL,
 'Maintenance Staff','Maintenance',
 'active','regular','daily',0,0,0,'bi-monthly','S','2022-01-01',
 '[]',
 NOW(),NOW()),

-- M056-23 | Gajisan, Ian Maaba | Company Driver | SSS 400
('M056-23','Ian','Gajisan','Maaba',
 'Company Driver','Maintenance',
 'active','regular','daily',0,0,0,'bi-monthly','S','2023-01-01',
 '[{"id":"sss","name":"SSS Contribution","code":"sss","category":"contribution","calcType":"fixed","fixedAmount":400,"percentageRate":0,"calcBasis":"basic_pay","employeeShareRate":1.0,"employerShareRate":0.0,"isTaxable":false,"affectsGross":false,"isActive":true,"priority":10,"deductionFrequency":"monthly"}]',
 NOW(),NOW())

) AS v(employee_no, first_name, last_name, middle_name,
       position, department,
       status, employment_type, compensation_type,
       basic_salary, compensation_rate, daily_rate,
       pay_frequency, tax_status,
       hire_date,
       payroll_components,
       created_at, updated_at)
ON CONFLICT (employee_no) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3-B. BACK-FILL full_name for any employees where it is NULL
--      (covers rows inserted by earlier runs of this migration before full_name
--       was added to the column list, as well as any other legacy records)
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE employees
  SET full_name = TRIM(first_name || ' ' || last_name)
  WHERE full_name IS NULL OR full_name = '';

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. BACK-FILL FK COLUMNS  (mirrors migration 004 — safe to re-run)
--    Matches the free-text department/position columns to the table rows
--    that were just inserted above, then sets the FK columns.
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE employees e
  SET department_id = d.id
  FROM departments d
  WHERE LOWER(TRIM(e.department)) = LOWER(TRIM(d.name))
    AND e.department_id IS NULL;

UPDATE employees e
  SET position_id = p.id
  FROM positions p
  WHERE LOWER(TRIM(e.position)) = LOWER(TRIM(p.title))
    AND e.position_id IS NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. ATTENDANCE RECORDS — 2026-06-07 to 2026-06-13 (7 days before 2026-06-14)
-- ══════════════════════════════════════════════════════════════════════════════
--  Schedule:
--    2026-06-07 (Sun) → rest-day       — all employees
--    2026-06-08 (Mon) → work day       — hashed attendance spread
--    2026-06-09 (Tue) → work day
--    2026-06-10 (Wed) → work day
--    2026-06-11 (Thu) → work day
--    2026-06-12 (Fri) → holiday        — Philippine Independence Day
--    2026-06-13 (Sat) → rest-day       — Admin dept only
--                        work day      — Bag Production + Maintenance (daily)
--
--  Weekday distribution (deterministic hash h = ABS(HASHTEXT(...)) % 20):
--    h  0–1   10% → absent
--    h  2–4   15% → late  (+10 / +20 / +30 min)
--    h  5      5% → half-day  (out at noon)
--    h  6–19  70% → present
--    ~10% of present/late rows get +30 min overtime (separate OT hash)
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO attendance_records (
  employee_id, employee_name, employee_no, department,
  date, time_in, time_out,
  status, minutes_late, overtime_minutes, night_diff_minutes, undertime_minutes,
  source
)
SELECT
  e.id,
  e.first_name || ' ' || e.last_name                                    AS employee_name,
  e.employee_no,
  e.department,
  d.work_date                                                            AS date,

  -- ── time_in ──────────────────────────────────────────────────────────────
  CASE
    WHEN d.work_date = '2026-06-07'                            THEN NULL  -- Sunday
    WHEN d.work_date = '2026-06-12'                            THEN NULL  -- Independence Day
    WHEN r.dow = 6 AND e.department = 'Admin'                  THEN NULL  -- Admin rest on Sat
    WHEN r.dow BETWEEN 1 AND 5 AND r.h IN (0, 1)              THEN NULL  -- absent
    WHEN r.dow BETWEEN 1 AND 5 AND r.h IN (2, 3, 4)           THEN       -- late (+10/+20/+30 min)
      (d.work_date::text || ' 08:' || LPAD(((r.h - 1) * 10)::text, 2, '0') || ':00+08:00')::timestamptz
    ELSE (d.work_date::text || ' 08:00:00+08:00')::timestamptz
  END                                                                    AS time_in,

  -- ── time_out ─────────────────────────────────────────────────────────────
  CASE
    WHEN d.work_date = '2026-06-07'                            THEN NULL
    WHEN d.work_date = '2026-06-12'                            THEN NULL
    WHEN r.dow = 6 AND e.department = 'Admin'                  THEN NULL
    WHEN r.dow BETWEEN 1 AND 5 AND r.h IN (0, 1)              THEN NULL  -- absent
    WHEN r.dow BETWEEN 1 AND 5 AND r.h = 5                    THEN       -- half-day → out at noon
      (d.work_date::text || ' 12:00:00+08:00')::timestamptz
    ELSE  -- present / late / Saturday production (±30 min OT)
      (d.work_date::text || ' 17:' || LPAD(r.ot::text, 2, '0') || ':00+08:00')::timestamptz
  END                                                                    AS time_out,

  -- ── status ───────────────────────────────────────────────────────────────
  CASE
    WHEN d.work_date = '2026-06-07'                            THEN 'rest-day'
    WHEN d.work_date = '2026-06-12'                            THEN 'holiday'
    WHEN r.dow = 6 AND e.department = 'Admin'                  THEN 'rest-day'
    WHEN r.dow = 6                                             THEN 'present'  -- Prod/Maint Sat
    WHEN r.h IN (0, 1)                                         THEN 'absent'
    WHEN r.h IN (2, 3, 4)                                      THEN 'late'
    WHEN r.h = 5                                               THEN 'half-day'
    ELSE                                                            'present'
  END                                                                    AS status,

  -- ── minutes_late ─────────────────────────────────────────────────────────
  CASE WHEN r.dow BETWEEN 1 AND 5 AND r.h IN (2, 3, 4)
       THEN (r.h - 1) * 10
       ELSE 0 END                                                       AS minutes_late,

  -- ── overtime_minutes ─────────────────────────────────────────────────────
  CASE
    WHEN d.work_date = '2026-06-07'               THEN 0
    WHEN d.work_date = '2026-06-12'               THEN 0
    WHEN r.dow = 6 AND e.department = 'Admin'     THEN 0
    WHEN r.h IN (0, 1, 5)                         THEN 0  -- absent / half-day no OT
    ELSE r.ot
  END                                                                    AS overtime_minutes,

  0                                                                      AS night_diff_minutes,

  -- ── undertime_minutes ────────────────────────────────────────────────────
  CASE WHEN r.dow BETWEEN 1 AND 5 AND r.h = 5 THEN 240 ELSE 0 END      AS undertime_minutes,

  'manual'                                                               AS source

FROM employees e

CROSS JOIN (
  SELECT gs::date AS work_date
  FROM generate_series(
         '2026-06-07'::date,
         '2026-06-13'::date,
         '1 day'::interval
       ) gs
) d

-- Precompute: day-of-week, presence hash, and OT hash — all deterministic
CROSS JOIN LATERAL (
  SELECT
    EXTRACT(DOW FROM d.work_date)::int                                        AS dow,
    ABS(HASHTEXT(e.employee_no || '|' || d.work_date::text))    % 20         AS h,
    CASE
      WHEN ABS(HASHTEXT(e.employee_no || '|ot|' || d.work_date::text)) % 10 = 0
      THEN 30 ELSE 0
    END                                                                       AS ot
) r

WHERE e.employee_no IN (
  -- Admin (9)
  'A001-16','P002-12','P003-12','P004-12','P005-12',
  'H040-21','H051-22','A060-24','M061-25',
  -- Bag Production (44)
  'P006-12','S007-12','S008-12','S009-12','C010-12',
  'S011-12','S012-15','S013-16','S014-16','S015-16',
  'S016-16','C017-16','S018-16','S022-17','S023-18',
  'C024-18','S025-19','C026-19','C027-20','S028-20',
  'S029-20','C030-20','S031-20','S032-20','C034-21',
  'S035-21','S038-21','S039-21','C041-21','C042-21',
  'C043-21','S044-22','S045-22','C047-22','C048-22',
  'C049-22','S050-22','S053-22','C054-22','C055-23',
  'C058-23','S059-24','P062-25','P063-26',
  -- Maintenance (4)
  'M020-17','M021-17','M052-22','M056-23'
)
ON CONFLICT (employee_id, date) DO NOTHING;

-- ─── Summary ──────────────────────────────────────────────────────────────────
-- Departments  : 3   (Admin, Bag Production, Maintenance)
-- Positions    : 13  (ED/General Manager … Company Driver)
-- Employees    : 57  (employee_no A001-16 … P063-26)
--   Admin dept        :  9 (A001-16, P002–P005, H040, H051, A060, M061)
--   Bag Production    : 44
--   Maintenance       :  4 (M020, M021, M052, M056)
--
-- SSS deduction coverage (payroll_components JSONB):
--   Fixed amounts set : 54 employees (from "EE PAYROLL DEDUCTION" sheet)
--   SSS = 0           : S050-22 Castro Raffy, M052-22 Bugayon Leonila
--   Not in sheet      : M061-25 Erilla, P062-25 Mabilin, P063-26 Marquez
--
-- Attendance records : 399 rows (57 emp × 7 days, 2026-06-07→2026-06-13)
--   rest-day rows    : all employees Sun 06-07 + Admin Sat 06-13
--   holiday rows     : all employees Fri 06-12 (Independence Day)
--   weekday spread   : ~70% present / 15% late / 10% absent / 5% half-day
--   Saturday prod    : Bag Production + Maintenance all present 08:00–17:xx
--
-- Next steps for the admin:
--   1. Enter actual salary rates (basic_salary / compensation_rate / daily_rate)
--      via HR → Employees for each employee.
--   2. Correct hire dates where needed.
--   3. Assign work shifts to production workers.
--   4. Add PhilHealth, Pag-IBIG components once rates are confirmed.
-- ─────────────────────────────────────────────────────────────────────────────
