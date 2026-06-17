-- ═══════════════════════════════════════════════════════════════════════════════
-- TenPayroll — Ten Foundation Philippines Inc.
-- Seed Data: Run AFTER schema.sql in the Supabase SQL Editor.
-- Reference + sample data only. Auth users are created via Supabase Dashboard
-- or the invite flow — no hardcoded credentials here.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Departments ──────────────────────────────────────────────────────────────
INSERT INTO departments (id, name, code, description, head_name) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'Human Resources',        'HR',    'Handles recruitment, benefits, and employee relations', 'Maria Cruz Santos'),
  ('d0000001-0000-0000-0000-000000000002', 'Finance',                'FIN',   'Manages accounting, payroll, and financial reporting',  'Juan Reyes Villanueva'),
  ('d0000001-0000-0000-0000-000000000003', 'Operations',             'OPS',   'Oversees day-to-day business operations',              'Eduardo Garcia Torres'),
  ('d0000001-0000-0000-0000-000000000004', 'Information Technology', 'IT',    'Manages IT infrastructure and software systems',       'Kevin Uy Lim'),
  ('d0000001-0000-0000-0000-000000000005', 'Sales & Marketing',      'S&M',   'Drives sales strategy and marketing campaigns',        'Geraldine Vega Ocampo'),
  ('d0000001-0000-0000-0000-000000000006', 'Administration',         'ADMIN', 'General administrative and support functions',         NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Positions ─────────────────────────────────────────────────────────────────
INSERT INTO positions (id, title, level) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'HR Manager',          'Manager'),
  ('b0000001-0000-0000-0000-000000000002', 'HR Officer',          'Officer'),
  ('b0000001-0000-0000-0000-000000000003', 'HR Coordinator',      'Staff'),
  ('b0000001-0000-0000-0000-000000000004', 'Finance Manager',     'Manager'),
  ('b0000001-0000-0000-0000-000000000005', 'Payroll Officer',     'Officer'),
  ('b0000001-0000-0000-0000-000000000006', 'Accountant',          'Officer'),
  ('b0000001-0000-0000-0000-000000000007', 'Billing Clerk',       'Staff'),
  ('b0000001-0000-0000-0000-000000000008', 'Operations Manager',  'Manager'),
  ('b0000001-0000-0000-0000-000000000009', 'Supervisor',          'Supervisor'),
  ('b0000001-0000-0000-0000-000000000010', 'Clerk',               'Staff'),
  ('b0000001-0000-0000-0000-000000000011', 'Utility Staff',       'Staff'),
  ('b0000001-0000-0000-0000-000000000012', 'Security Guard',      'Staff'),
  ('b0000001-0000-0000-0000-000000000013', 'IT Manager',          'Manager'),
  ('b0000001-0000-0000-0000-000000000014', 'Software Developer',  'Senior'),
  ('b0000001-0000-0000-0000-000000000015', 'IT Support',          'Staff'),
  ('b0000001-0000-0000-0000-000000000016', 'Systems Analyst',     'Officer'),
  ('b0000001-0000-0000-0000-000000000017', 'Sales Manager',       'Manager'),
  ('b0000001-0000-0000-0000-000000000018', 'Sales Executive',     'Officer'),
  ('b0000001-0000-0000-0000-000000000019', 'Marketing Officer',   'Officer'),
  ('b0000001-0000-0000-0000-000000000020', 'Brand Associate',     'Staff'),
  ('b0000001-0000-0000-0000-000000000021', 'Admin Officer',       'Officer'),
  ('b0000001-0000-0000-0000-000000000022', 'Receptionist',        'Staff'),
  ('b0000001-0000-0000-0000-000000000023', 'Driver',              'Staff')
ON CONFLICT (id) DO NOTHING;

-- ── Work Shifts ───────────────────────────────────────────────────────────────
INSERT INTO work_shifts (id, name, time_in, time_out, break_minutes, grace_minutes, rest_days, overtime_enabled, overtime_threshold_minutes) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Morning Shift',   '08:00', '17:00', 60, 10, '{0,6}', TRUE,  30),
  ('c0000001-0000-0000-0000-000000000002', 'Afternoon Shift', '14:00', '23:00', 60, 10, '{0,6}', TRUE,  30),
  ('c0000001-0000-0000-0000-000000000003', 'Night Shift',     '22:00', '07:00', 60, 10, '{0,6}', TRUE,  30),
  ('c0000001-0000-0000-0000-000000000004', 'Flexible Shift',  '09:00', '18:00', 60, 30, '{0,6}', FALSE, 30)
ON CONFLICT (id) DO NOTHING;

-- ── Employees (20 across 5 departments) ──────────────────────────────────────
INSERT INTO employees (
  id, employee_no, first_name, last_name, middle_name, full_name, email, phone,
  address, birth_date, gender, civil_status, position, department, employment_type,
  status, hire_date, compensation_type, compensation_rate, basic_salary, daily_rate,
  pay_frequency, pin_code, sss_no, philhealth_no, pagibig_no, tin_no,
  bank_name, bank_account, shift_id, tax_status, allowances,
  emergency_contact_name, emergency_contact_phone
) VALUES
-- Human Resources
('e0000001-0000-0000-0000-000000000001','EMP-0001','Maria','Santos','Cruz','Maria Cruz Santos','maria.santos@tenfoundation.ph','09171111001','123 Rizal St, Quezon City','1988-03-15','female','married','HR Manager','Human Resources','regular','active',CURRENT_DATE-INTERVAL'900 days','monthly',55000,55000,2500,'bi-monthly','1001','34-1234567-8','12-345678901-2','1234-5678-9012','123-456-789-000','BDO','001234567890','c0000001-0000-0000-0000-000000000001','ME','[{"type":"Transportation","amount":2000,"taxable":false},{"type":"Meal","amount":1500,"taxable":false}]','Jose Santos','09170000001'),
('e0000001-0000-0000-0000-000000000002','EMP-0002','Lourdes','Reyes','Bautista','Lourdes Bautista Reyes','lourdes.reyes@tenfoundation.ph','09181111002','456 Mabini Ave, Makati','1992-07-22','female','single','HR Officer','Human Resources','regular','active',CURRENT_DATE-INTERVAL'540 days','monthly',35000,35000,1590.91,'bi-monthly','1002','34-2345678-9','12-456789012-3','2345-6789-0123','234-567-890-000','BPI','002345678901','c0000001-0000-0000-0000-000000000001','S','[{"type":"Transportation","amount":1500,"taxable":false}]','Corazon Reyes','09180000002'),
('e0000001-0000-0000-0000-000000000003','EMP-0003','Roberto','Dela Cruz','Garbo','Roberto Garbo Dela Cruz','roberto.delacruz@tenfoundation.ph','09191111003','789 Aguinaldo Blvd, Cavite','1995-11-05','male','single','HR Coordinator','Human Resources','probationary','active',CURRENT_DATE-INTERVAL'120 days','monthly',22000,22000,1000,'bi-monthly','1003','34-3456789-0','12-567890123-4','3456-7890-1234','345-678-901-000','Metrobank','003456789012','c0000001-0000-0000-0000-000000000004','S','[]','Ana Dela Cruz','09190000003'),
-- Finance
('e0000001-0000-0000-0000-000000000004','EMP-0004','Juan','Villanueva','Reyes','Juan Reyes Villanueva','juan.villanueva@tenfoundation.ph','09201111004','101 Katipunan, Loyola Heights','1985-09-18','male','married','Finance Manager','Finance','regular','active',CURRENT_DATE-INTERVAL'1200 days','monthly',60000,60000,2727.27,'bi-monthly','1004','34-4567890-1','12-678901234-5','4567-8901-2345','456-789-012-000','BDO','004567890123','c0000001-0000-0000-0000-000000000001','ME1','[{"type":"Transportation","amount":3000,"taxable":false},{"type":"Meal","amount":2000,"taxable":false}]','Carmen Villanueva','09200000004'),
('e0000001-0000-0000-0000-000000000005','EMP-0005','Ana','Mendoza','Lopez','Ana Lopez Mendoza','ana.mendoza@tenfoundation.ph','09211111005','202 Espana Blvd, Manila','1990-04-30','female','single','Payroll Officer','Finance','regular','active',CURRENT_DATE-INTERVAL'700 days','monthly',38000,38000,1727.27,'bi-monthly','1005','34-5678901-2','12-789012345-6','5678-9012-3456','567-890-123-000','UnionBank','005678901234','c0000001-0000-0000-0000-000000000001','S1','[{"type":"Transportation","amount":1500,"taxable":false}]','Pedro Mendoza','09210000005'),
('e0000001-0000-0000-0000-000000000006','EMP-0006','Carlos','Aquino','Santos','Carlos Santos Aquino','carlos.aquino@tenfoundation.ph','09221111006','303 Aurora Blvd, Pasig','1993-12-01','male','single','Accountant','Finance','regular','active',CURRENT_DATE-INTERVAL'400 days','monthly',32000,32000,1454.55,'bi-monthly','1006','34-6789012-3','12-890123456-7','6789-0123-4567','678-901-234-000','BPI','006789012345','c0000001-0000-0000-0000-000000000004','S','[{"type":"Meal","amount":1000,"taxable":false}]','Rosa Aquino','09220000006'),
('e0000001-0000-0000-0000-000000000007','EMP-0007','Patricia','Ramos','Flores','Patricia Flores Ramos','patricia.ramos@tenfoundation.ph','09231111007','404 Shaw Blvd, Mandaluyong','1997-06-14','female','single','Billing Clerk','Finance','probationary','active',CURRENT_DATE-INTERVAL'90 days','daily',818.18,18000,818.18,'weekly','1007','34-7890123-4','12-901234567-8','7890-1234-5678','789-012-345-000','Metrobank','007890123456','c0000001-0000-0000-0000-000000000001','S','[]','Antonio Ramos','09230000007'),
-- Operations
('e0000001-0000-0000-0000-000000000008','EMP-0008','Eduardo','Torres','Garcia','Eduardo Garcia Torres','eduardo.torres@tenfoundation.ph','09241111008','505 EDSA, Guadalupe, Makati','1984-02-28','male','married','Operations Manager','Operations','regular','active',CURRENT_DATE-INTERVAL'1500 days','monthly',65000,65000,2954.55,'bi-monthly','1008','34-8901234-5','12-012345678-9','8901-2345-6789','890-123-456-000','BDO','008901234567','c0000001-0000-0000-0000-000000000001','ME2','[{"type":"Transportation","amount":3000,"taxable":false},{"type":"Meal","amount":2000,"taxable":false},{"type":"Communication","amount":1000,"taxable":false}]','Ligaya Torres','09240000008'),
('e0000001-0000-0000-0000-000000000009','EMP-0009','Maricel','Castro','Bautista','Maricel Bautista Castro','maricel.castro@tenfoundation.ph','09251111009','606 Taft Ave, Pasay','1991-08-10','female','single','Supervisor','Operations','regular','active',CURRENT_DATE-INTERVAL'600 days','monthly',30000,30000,1363.64,'bi-monthly','1009','34-9012345-6','12-123456789-0','9012-3456-7890','901-234-567-000','BPI','009012345678','c0000001-0000-0000-0000-000000000002','S','[{"type":"Transportation","amount":1500,"taxable":false}]','Ricardo Castro','09250000009'),
('e0000001-0000-0000-0000-000000000010','EMP-0010','Renato','Navarro','Cruz','Renato Cruz Navarro','renato.navarro@tenfoundation.ph','09261111010','707 Ortigas Ave, Pasig','1994-05-20','male','single','Clerk','Operations','regular','active',CURRENT_DATE-INTERVAL'350 days','daily',909.09,20000,909.09,'weekly','1010','34-0123456-7','12-234567890-1','0123-4567-8901','012-345-678-000','UnionBank','010123456789','c0000001-0000-0000-0000-000000000001','S','[]','Elena Navarro','09260000010'),
('e0000001-0000-0000-0000-000000000011','EMP-0011','Josefina','Reyes','Aguilar','Josefina Aguilar Reyes','josefina.reyes@tenfoundation.ph','09271111011','808 Commonwealth Ave, QC','1996-01-07','female','single','Utility Staff','Operations','contractual','active',CURRENT_DATE-INTERVAL'180 days','daily',681.82,15000,681.82,'weekly','1011','34-1234568-9','12-345678902-3','1234-5679-0123','123-456-790-000','Metrobank','011234567890','c0000001-0000-0000-0000-000000000001','S','[]','Felix Reyes','09270000011'),
('e0000001-0000-0000-0000-000000000012','EMP-0012','Dennis','Morales','Salazar','Dennis Salazar Morales','dennis.morales@tenfoundation.ph','09281111012','909 Gen. Luna St, Manila','1993-03-15','male','married','Security Guard','Operations','regular','active',CURRENT_DATE-INTERVAL'800 days','daily',750,16500,750,'weekly','1012','34-2345679-0','12-456789013-4','2345-6790-1234','234-567-891-000','Metrobank','012345678901','c0000001-0000-0000-0000-000000000002','S','[]','Gloria Morales','09280000012'),
-- IT
('e0000001-0000-0000-0000-000000000013','EMP-0013','Kevin','Lim','Uy','Kevin Uy Lim','kevin.lim@tenfoundation.ph','09291111013','1010 Ayala Ave, Makati','1987-10-25','male','single','IT Manager','Information Technology','regular','active',CURRENT_DATE-INTERVAL'1100 days','monthly',58000,58000,2636.36,'bi-monthly','1013','34-3456790-1','12-567890124-5','3456-7891-2345','345-678-902-000','BDO','013456789012','c0000001-0000-0000-0000-000000000001','S','[{"type":"Transportation","amount":2000,"taxable":false},{"type":"Communication","amount":1500,"taxable":false}]','Patricia Lim','09290000013'),
('e0000001-0000-0000-0000-000000000014','EMP-0014','Stephanie','Chan','Go','Stephanie Go Chan','stephanie.chan@tenfoundation.ph','09301111014','1111 Bonifacio St, Taguig','1994-08-14','female','single','Software Developer','Information Technology','regular','active',CURRENT_DATE-INTERVAL'730 days','monthly',48000,48000,2181.82,'bi-monthly','1014','34-4567891-2','12-678901235-6','4567-8902-3456','456-789-013-000','UnionBank','014567890123','c0000001-0000-0000-0000-000000000001','S','[{"type":"Transportation","amount":1500,"taxable":false}]','Michael Chan','09300000014'),
('e0000001-0000-0000-0000-000000000015','EMP-0015','Mark','Tan','Sy','Mark Sy Tan','mark.tan@tenfoundation.ph','09311111015','1212 MacArthur Hwy, Pampanga','1996-12-30','male','single','IT Support','Information Technology','regular','active',CURRENT_DATE-INTERVAL'420 days','monthly',28000,28000,1272.73,'bi-monthly','1015','34-5678902-3','12-789012346-7','5678-9013-4567','567-890-124-000','BPI','015678901234','c0000001-0000-0000-0000-000000000001','S','[]','Alice Tan','09310000015'),
-- Sales & Marketing
('e0000001-0000-0000-0000-000000000016','EMP-0016','Jasmine','Wong','Chua','Jasmine Chua Wong','jasmine.wong@tenfoundation.ph','09321111016','1313 Meralco Ave, Pasig','1995-04-18','female','single','Systems Analyst','Information Technology','regular','active',CURRENT_DATE-INTERVAL'60 days','monthly',36000,36000,1636.36,'bi-monthly','1016','34-6789013-4','12-890123457-8','6789-0124-5678','678-901-235-000','Metrobank','016789012345','c0000001-0000-0000-0000-000000000001','S','[]','Henry Wong','09320000016'),
('e0000001-0000-0000-0000-000000000017','EMP-0017','Geraldine','Ocampo','Vega','Geraldine Vega Ocampo','geraldine.ocampo@tenfoundation.ph','09331111017','1414 P. Burgos St, Makati','1989-07-03','female','married','Sales Manager','Sales & Marketing','regular','active',CURRENT_DATE-INTERVAL'900 days','monthly',52000,52000,2363.64,'bi-monthly','1017','34-7890124-5','12-901234568-9','7890-1235-6789','789-012-346-000','BDO','017890123456','c0000001-0000-0000-0000-000000000001','ME','[{"type":"Transportation","amount":2500,"taxable":false},{"type":"Representation","amount":3000,"taxable":true}]','Rodrigo Ocampo','09330000017'),
('e0000001-0000-0000-0000-000000000018','EMP-0018','Ferdinand','Cruz','Santos','Ferdinand Santos Cruz','ferdinand.cruz@tenfoundation.ph','09341111018','1515 Quirino Ave, Manila','1992-02-14','male','single','Sales Executive','Sales & Marketing','regular','active',CURRENT_DATE-INTERVAL'500 days','monthly',32000,32000,1454.55,'bi-monthly','1018','34-8901235-6','12-012345679-0','8901-2346-7890','890-123-457-000','BPI','018901234567','c0000001-0000-0000-0000-000000000001','S','[{"type":"Transportation","amount":1500,"taxable":false}]','Remedios Cruz','09340000018'),
('e0000001-0000-0000-0000-000000000019','EMP-0019','Rowena','Garcia','Diaz','Rowena Diaz Garcia','rowena.garcia@tenfoundation.ph','09351111019','1616 Tomas Morato, QC','1991-11-28','female','single','Marketing Officer','Sales & Marketing','regular','active',CURRENT_DATE-INTERVAL'650 days','monthly',30000,30000,1363.64,'bi-monthly','1019','34-9012346-7','12-123456790-1','9012-3457-8901','901-234-568-000','Metrobank','019012345678','c0000001-0000-0000-0000-000000000001','S','[{"type":"Transportation","amount":1500,"taxable":false}]','Ernesto Garcia','09350000019'),
('e0000001-0000-0000-0000-000000000020','EMP-0020','Antonio','Reyes','dela Cruz','Antonio dela Cruz Reyes','antonio.reyes@tenfoundation.ph','09361111020','1717 Libertad St, Pasay','1998-05-09','male','single','Brand Associate','Sales & Marketing','probationary','active',CURRENT_DATE-INTERVAL'45 days','daily',818.18,18000,818.18,'weekly','1020','34-0123457-8','12-234567891-2','0123-4568-9012','012-345-679-000','BDO','020123456789','c0000001-0000-0000-0000-000000000001','S','[]','Teresita Reyes','09360000020')
ON CONFLICT (id) DO NOTHING;

-- ── Holidays 2025-2026 ────────────────────────────────────────────────────────
INSERT INTO holidays (name, date, type, is_nationwide, description) VALUES
  ('New Year''s Day',                  '2025-01-01', 'regular',               TRUE, 'New Year celebration'),
  ('EDSA People Power Anniversary',    '2025-02-25', 'special-non-working',  TRUE, 'Anniversary of the 1986 EDSA Revolution'),
  ('Araw ng Kagitingan',               '2025-04-09', 'regular',               TRUE, 'Day of Valor'),
  ('Maundy Thursday',                  '2025-04-17', 'regular',               TRUE, 'Holy Week'),
  ('Good Friday',                      '2025-04-18', 'regular',               TRUE, 'Holy Week'),
  ('Black Saturday',                   '2025-04-19', 'special-non-working',  TRUE, 'Holy Week'),
  ('Labor Day',                        '2025-05-01', 'regular',               TRUE, 'Workers'' Day'),
  ('Independence Day',                 '2025-06-12', 'regular',               TRUE, 'Philippine Independence Day'),
  ('Ninoy Aquino Day',                 '2025-08-21', 'special-non-working',  TRUE, 'Benigno Aquino Jr.'),
  ('National Heroes Day',              '2025-08-25', 'regular',               TRUE, 'Last Monday of August'),
  ('All Saints'' Day',                 '2025-11-01', 'special-non-working',  TRUE, 'Undas'),
  ('Bonifacio Day',                    '2025-11-30', 'regular',               TRUE, 'Andres Bonifacio Day'),
  ('Immaculate Conception',            '2025-12-08', 'special-non-working',  TRUE, 'Feast of the Immaculate Conception'),
  ('Christmas Day',                    '2025-12-25', 'regular',               TRUE, 'Christmas'),
  ('Rizal Day',                        '2025-12-30', 'regular',               TRUE, 'Jose Rizal Day'),
  ('New Year''s Eve',                  '2025-12-31', 'special-working',       TRUE, 'Last Day of the Year'),
  ('New Year''s Day 2026',             '2026-01-01', 'regular',               TRUE, 'New Year celebration'),
  ('Araw ng Kagitingan 2026',          '2026-04-09', 'regular',               TRUE, 'Day of Valor'),
  ('Maundy Thursday 2026',             '2026-04-02', 'regular',               TRUE, 'Holy Week 2026'),
  ('Good Friday 2026',                 '2026-04-03', 'regular',               TRUE, 'Holy Week 2026'),
  ('Labor Day 2026',                   '2026-05-01', 'regular',               TRUE, 'Workers'' Day 2026'),
  ('Independence Day 2026',            '2026-06-12', 'regular',               TRUE, 'Philippine Independence Day 2026')
ON CONFLICT (date) DO NOTHING;

-- ── Leave Balances (current year) ─────────────────────────────────────────────
INSERT INTO leave_balances (employee_id, year, vacation, sick, emergency)
SELECT
  id,
  2026,
  jsonb_build_object('entitled', 15, 'used',
    CASE WHEN employee_no IN ('EMP-0002','EMP-0014','EMP-0017') THEN 3
         WHEN employee_no IN ('EMP-0003','EMP-0007') THEN 1
         ELSE 0 END,
    'balance',
    15 - CASE WHEN employee_no IN ('EMP-0002','EMP-0014','EMP-0017') THEN 3
              WHEN employee_no IN ('EMP-0003','EMP-0007') THEN 1
              ELSE 0 END),
  jsonb_build_object('entitled', 15, 'used',
    CASE WHEN employee_no IN ('EMP-0005','EMP-0015','EMP-0018') THEN 2 ELSE 0 END,
    'balance',
    15 - CASE WHEN employee_no IN ('EMP-0005','EMP-0015','EMP-0018') THEN 2 ELSE 0 END),
  jsonb_build_object('entitled', 5, 'used',
    CASE WHEN employee_no = 'EMP-0009' THEN 1 ELSE 0 END,
    'balance',
    5 - CASE WHEN employee_no = 'EMP-0009' THEN 1 ELSE 0 END)
FROM employees
ON CONFLICT (employee_id, year) DO NOTHING;

-- ── Attendance Records (last 30 days sample) ──────────────────────────────────
-- Present records for last 7 days for first 10 employees
INSERT INTO attendance_records (employee_id, employee_name, employee_no, department, date, time_in, time_out, status, minutes_late, overtime_minutes, source)
SELECT
  e.id, e.full_name, e.employee_no, e.department,
  (CURRENT_DATE - (n || ' days')::INTERVAL)::DATE,
  ((CURRENT_DATE - (n || ' days')::INTERVAL)::DATE + '08:05:00'::TIME)::TIMESTAMPTZ,
  ((CURRENT_DATE - (n || ' days')::INTERVAL)::DATE + '17:02:00'::TIME)::TIMESTAMPTZ,
  'present', 0, 0, 'kiosk'
FROM employees e
CROSS JOIN generate_series(1, 14) AS n
WHERE e.employee_no IN ('EMP-0001','EMP-0002','EMP-0004','EMP-0005','EMP-0008','EMP-0009','EMP-0013','EMP-0017','EMP-0018','EMP-0019')
  AND EXTRACT(DOW FROM (CURRENT_DATE - (n || ' days')::INTERVAL)) NOT IN (0, 6)
ON CONFLICT (employee_id, date) DO NOTHING;

-- A few late arrivals
INSERT INTO attendance_records (employee_id, employee_name, employee_no, department, date, time_in, time_out, status, minutes_late, overtime_minutes, source)
SELECT
  e.id, e.full_name, e.employee_no, e.department,
  (CURRENT_DATE - INTERVAL '3 days')::DATE,
  ((CURRENT_DATE - INTERVAL '3 days')::DATE + '08:42:00'::TIME)::TIMESTAMPTZ,
  ((CURRENT_DATE - INTERVAL '3 days')::DATE + '17:05:00'::TIME)::TIMESTAMPTZ,
  'late', 32, 0, 'kiosk'
FROM employees e
WHERE e.employee_no IN ('EMP-0003','EMP-0006','EMP-0010')
ON CONFLICT (employee_id, date) DO NOTHING;

-- ── Leave Requests ─────────────────────────────────────────────────────────────
INSERT INTO leave_requests (id, employee_id, employee_name, employee_no, leave_type, start_date, end_date, days, reason, status, reviewed_by, reviewed_at)
VALUES
  ('1b000001-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000002','Lourdes Bautista Reyes','EMP-0002','vacation', CURRENT_DATE-INTERVAL'45 days', CURRENT_DATE-INTERVAL'43 days', 3, 'Family vacation in Batangas',        'approved', 'Maria Cruz Santos',  NOW()-INTERVAL'47 days'),
  ('1b000001-0000-0000-0000-000000000002','e0000001-0000-0000-0000-000000000005','Ana Lopez Mendoza',     'EMP-0005','sick',     CURRENT_DATE-INTERVAL'30 days', CURRENT_DATE-INTERVAL'29 days', 2, 'Fever and flu symptoms',             'approved', 'Maria Cruz Santos',  NOW()-INTERVAL'31 days'),
  ('1b000001-0000-0000-0000-000000000003','e0000001-0000-0000-0000-000000000009','Maricel Bautista Castro','EMP-0009','emergency',CURRENT_DATE-INTERVAL'20 days', CURRENT_DATE-INTERVAL'20 days', 1, 'Medical emergency for parent',       'approved', 'Maria Cruz Santos',  NOW()-INTERVAL'21 days'),
  ('1b000001-0000-0000-0000-000000000004','e0000001-0000-0000-0000-000000000010','Renato Cruz Navarro',   'EMP-0010','vacation', CURRENT_DATE-INTERVAL'3 days',  CURRENT_DATE-INTERVAL'2 days',  2, 'Personal affairs',                   'pending',  NULL,                 NULL),
  ('1b000001-0000-0000-0000-000000000005','e0000001-0000-0000-0000-000000000015','Mark Sy Tan',           'EMP-0015','sick',     CURRENT_DATE-INTERVAL'1 day',   CURRENT_DATE-INTERVAL'1 day',   1, 'Not feeling well',                   'pending',  NULL,                 NULL),
  ('1b000001-0000-0000-0000-000000000006','e0000001-0000-0000-0000-000000000019','Rowena Diaz Garcia',    'EMP-0019','vacation', CURRENT_DATE-INTERVAL'2 days',  CURRENT_DATE-INTERVAL'1 day',   2, 'Anniversary leave',                  'pending',  NULL,                 NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Overtime Requests ─────────────────────────────────────────────────────────
INSERT INTO overtime_requests (id, employee_id, employee_name, employee_no, department, date, hours_requested, reason, status, reviewed_by, reviewed_at)
VALUES
  ('2b000001-0000-0000-0000-000000000001','e0000001-0000-0000-0000-000000000004','Juan Reyes Villanueva',   'EMP-0004','Finance',              CURRENT_DATE-INTERVAL'5 days', 3,'Month-end closing reports',            'approved','Admin User',NOW()-INTERVAL'6 days'),
  ('2b000001-0000-0000-0000-000000000002','e0000001-0000-0000-0000-000000000005','Ana Lopez Mendoza',       'EMP-0005','Finance',              CURRENT_DATE-INTERVAL'5 days', 2,'Payroll processing cutoff',           'approved','Admin User',NOW()-INTERVAL'6 days'),
  ('2b000001-0000-0000-0000-000000000003','e0000001-0000-0000-0000-000000000008','Eduardo Garcia Torres',   'EMP-0008','Operations',           CURRENT_DATE-INTERVAL'8 days', 4,'Inventory count',                     'approved','Admin User',NOW()-INTERVAL'9 days'),
  ('2b000001-0000-0000-0000-000000000004','e0000001-0000-0000-0000-000000000013','Kevin Uy Lim',            'EMP-0013','Information Technology',CURRENT_DATE-INTERVAL'3 days', 3,'System maintenance downtime window',  'approved','Admin User',NOW()-INTERVAL'4 days'),
  ('2b000001-0000-0000-0000-000000000005','e0000001-0000-0000-0000-000000000009','Maricel Bautista Castro', 'EMP-0009','Operations',           CURRENT_DATE-INTERVAL'1 day',  2,'Urgent order fulfillment',            'pending', NULL,       NULL),
  ('2b000001-0000-0000-0000-000000000006','e0000001-0000-0000-0000-000000000006','Carlos Santos Aquino',    'EMP-0006','Finance',              CURRENT_DATE-INTERVAL'1 day',  1,'Audit document preparation',          'pending', NULL,       NULL),
  ('2b000001-0000-0000-0000-000000000007','e0000001-0000-0000-0000-000000000018','Ferdinand Santos Cruz',   'EMP-0018','Sales & Marketing',   CURRENT_DATE,                   2,'Client meeting follow-up',            'pending', NULL,       NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Company Settings ──────────────────────────────────────────────────────────
INSERT INTO app_settings (id, value) VALUES
  ('company', '{
    "name": "Ten Foundation Philippines Inc.",
    "tagline": "Ten Foundation Philippines Inc.",
    "address": "Ten Foundation Philippines Inc., Metro Manila",
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
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
