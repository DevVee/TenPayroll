import type { Employee, AttendanceRecord, Holiday, Allowance, PayrollEntry, PayrollDeductionSettings } from '../types'

function r2(n: number) { return Math.round(n * 100) / 100 }

// ─── Default deduction settings ───────────────────────────────────────────────
export const DEFAULT_DEDUCTION_SETTINGS: PayrollDeductionSettings = {
  lateDeductionEnabled: true,
  lateDeductionMultiplier: 1.0,
  absenceDeductionEnabled: true,
  absenceDeductionType: 'daily-rate',
  undertimeDeductionEnabled: false,
  undertimeDeductionMultiplier: 1.0,
  overtimeEnabled: true,
  overtimeMultiplierRegular: 1.25,
  overtimeMultiplierRestDay: 1.30,
  overtimeThresholdMinutes: 0,
  nightDiffEnabled: true,
  nightDiffMultiplier: 0.10,
}

// ─── SSS 2024 table ───────────────────────────────────────────────────────────
export function computeSSS(monthly: number): { employee: number; employer: number } {
  const tbl: [number, number, number][] = [
    [4249.99, 180, 380],   [4749.99, 202.5, 427.5], [5249.99, 225, 475],
    [5749.99, 247.5, 522.5],[6249.99, 270, 570],     [6749.99, 292.5, 617.5],
    [7249.99, 315, 665],   [7749.99, 337.5, 712.5],  [8249.99, 360, 760],
    [8749.99, 382.5, 807.5],[9249.99, 405, 855],      [9749.99, 427.5, 902.5],
    [10249.99,450, 950],   [10749.99,472.5,997.5],   [11249.99,495,1045],
    [11749.99,517.5,1092.5],[12249.99,540,1140],     [12749.99,562.5,1187.5],
    [13249.99,585,1235],   [13749.99,607.5,1282.5],  [14249.99,630,1330],
    [14749.99,652.5,1377.5],[15249.99,675,1425],     [15749.99,697.5,1472.5],
    [16249.99,720,1520],   [16749.99,742.5,1567.5],  [17249.99,765,1615],
    [17749.99,787.5,1662.5],[18249.99,810,1710],     [18749.99,832.5,1757.5],
    [19249.99,855,1805],   [19749.99,877.5,1852.5],  [20249.99,900,1900],
    [20749.99,922.5,1947.5],[29749.99,1125,2375],    [34749.99,1350,2850],
    [Infinity,1620,3420],
  ]
  for (const [max, ee, er] of tbl) {
    if (monthly <= max) return { employee: ee, employer: er }
  }
  return { employee: 1620, employer: 3420 }
}

// ─── PhilHealth 2024 — 5% total, 2.5% each; floor 10k, ceiling 100k ──────────
export function computePhilHealth(monthly: number): { employee: number; employer: number } {
  const base = Math.min(Math.max(monthly, 10000), 100000)
  const half = r2((base * 0.05) / 2)
  return { employee: half, employer: half }
}

// ─── Pag-IBIG ─────────────────────────────────────────────────────────────────
export function computePagIbig(monthly: number): { employee: number; employer: number } {
  if (monthly <= 1500) return { employee: r2(monthly * 0.01), employer: r2(monthly * 0.02) }
  return { employee: Math.min(r2(monthly * 0.02), 200), employer: Math.min(r2(monthly * 0.02), 200) }
}

// ─── BIR TRAIN Law — monthly withholding tax ─────────────────────────────────
export function computeWithholdingTax(taxable: number): number {
  if (taxable <= 20833)  return 0
  if (taxable <= 33332)  return r2((taxable - 20833) * 0.20)
  if (taxable <= 66666)  return r2(2500 + (taxable - 33333) * 0.25)
  if (taxable <= 166666) return r2(10833.33 + (taxable - 66667) * 0.30)
  if (taxable <= 666666) return r2(40833.33 + (taxable - 166667) * 0.32)
  return r2(200833.33 + (taxable - 666667) * 0.35)
}

// ─── Payroll entry computation ────────────────────────────────────────────────
export interface ComputeInput {
  employee: Employee
  attendanceRecords: AttendanceRecord[]
  holidays: Holiday[]
  periodDays: number
  payrollPeriodId: string
  additionalDeductions?: { type: string; amount: number }[]
  deductionSettings?: PayrollDeductionSettings
}

export function computePayrollEntry(input: ComputeInput): PayrollEntry {
  const {
    employee, attendanceRecords, holidays, periodDays,
    payrollPeriodId, additionalDeductions = [],
    deductionSettings = DEFAULT_DEDUCTION_SETTINGS,
  } = input

  const ds = deductionSettings

  // ── Daily & hourly rate based on compensation type ───────────────────────
  const compensationType = employee.compensationType ?? 'monthly'
  let daily: number
  let monthly: number

  if (compensationType === 'daily') {
    daily   = employee.compensationRate ?? employee.dailyRate
    monthly = r2(daily * 22)                        // approximate monthly for gov't deductions
  } else if (compensationType === 'weekly') {
    daily   = r2((employee.compensationRate ?? employee.dailyRate * 5) / 5)
    monthly = r2(daily * 22)
  } else {
    // monthly
    monthly = employee.compensationRate ?? employee.basicSalary
    daily   = employee.dailyRate > 0 ? employee.dailyRate : r2(monthly / 22)
  }

  const hourly = r2(daily / 8)

  // ── Holiday sets ─────────────────────────────────────────────────────────
  const regHolSet = new Set(holidays.filter(h => h.type === 'regular').map(h => h.date))
  const spHolSet  = new Set(holidays.filter(h => h.type === 'special-non-working').map(h => h.date))

  // ── Tally attendance ─────────────────────────────────────────────────────
  let presentDays = 0, absentDays = 0, lateDays = 0, halfDays = 0, leaveDays = 0
  let totalMinLate = 0, totalOTMin = 0, totalNDMin = 0, totalUTMin = 0
  let regHolDays = 0, spHolDays = 0

  for (const r of attendanceRecords) {
    if (r.status === 'present')   { presentDays++ }
    else if (r.status === 'late') { presentDays++; lateDays++; totalMinLate += r.minutesLate }
    else if (r.status === 'absent') { absentDays++ }
    else if (r.status === 'half-day') { halfDays++; presentDays += 0.5; absentDays += 0.5 }
    else if (r.status === 'on-leave') { leaveDays++ }
    totalOTMin += r.overtimeMinutes
    totalNDMin += r.nightDiffMinutes
    totalUTMin += r.undertimeMinutes
    if (regHolSet.has(r.date)) regHolDays++
    if (spHolSet.has(r.date))  spHolDays++
  }

  // ── Basic pay logic ───────────────────────────────────────────────────────
  const paidDays  = presentDays + leaveDays + regHolDays
  let basicPay: number

  if (compensationType === 'daily' || compensationType === 'weekly') {
    // For daily/weekly workers: pay exactly for days present + leave + holidays
    basicPay = r2(daily * paidDays)
  } else {
    // Monthly workers: full period pay × attendance ratio
    const divBy = employee.payFrequency === 'monthly' ? 1 : employee.payFrequency === 'bi-monthly' ? 2 : 4
    const periodSalary = r2(monthly / divBy)
    basicPay = periodDays > 0 ? r2(periodSalary * (paidDays / periodDays)) : r2(daily * paidDays)
  }

  // ── Pay additions ─────────────────────────────────────────────────────────
  const OTHours  = r2(totalOTMin / 60)
  const NDHours  = r2(totalNDMin / 60)
  const otMult   = ds.overtimeMultiplierRegular
  const ndMult   = ds.nightDiffMultiplier

  const overtimePay       = ds.overtimeEnabled  ? r2(hourly * OTHours * otMult)          : 0
  const regularHolidayPay = r2(daily * regHolDays)
  const specialHolidayPay = r2(daily * spHolDays * 0.30)
  const nightDifferential = ds.nightDiffEnabled ? r2(hourly * NDHours * ndMult)          : 0

  // ── Allowances prorated by frequency ─────────────────────────────────────
  const divBy = employee.payFrequency === 'monthly' ? 1 : employee.payFrequency === 'bi-monthly' ? 2 : 4
  const allowances: Allowance[] = employee.allowances.map(a => ({ ...a, amount: r2(a.amount / divBy) }))
  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0)

  const grossPay = r2(basicPay + overtimePay + regularHolidayPay + specialHolidayPay + nightDifferential + totalAllowances)

  // ── Government deductions (always monthly basis for compliance) ───────────
  const sss = computeSSS(monthly)
  const ph  = computePhilHealth(monthly)
  const pi  = computePagIbig(monthly)

  const sssEmployee        = r2(sss.employee / divBy)
  const philhealthEmployee = r2(ph.employee  / divBy)
  const pagibigEmployee    = r2(pi.employee  / divBy)
  const sssEmployer        = r2(sss.employer / divBy)
  const philhealthEmployer = r2(ph.employer  / divBy)
  const pagibigEmployer    = r2(pi.employer  / divBy)

  // ── Tax ───────────────────────────────────────────────────────────────────
  const nonTaxable    = allowances.filter(a => !a.taxable).reduce((s, a) => s + a.amount, 0)
  const mandatoryDed  = sssEmployee + philhealthEmployee + pagibigEmployee
  const taxableIncome = Math.max(0, grossPay - nonTaxable - mandatoryDed)
  const withholdingTax = r2(computeWithholdingTax(taxableIncome * divBy) / divBy)

  // ── Configurable deductions ───────────────────────────────────────────────
  const lateDeductions    = ds.lateDeductionEnabled
    ? r2((hourly / 60) * totalMinLate * ds.lateDeductionMultiplier)
    : 0

  const absenceDeductions = ds.absenceDeductionEnabled && ds.absenceDeductionType === 'daily-rate'
    ? r2(daily * absentDays)
    : 0

  // Undertime: deduct for minutes left early, using the same per-minute rate as late deductions.
  // undertimeMinutes is recorded at kiosk clock-out time (shift.timeOut vs actual timeOut).
  const undertimeDeductions = ds.undertimeDeductionEnabled
    ? r2((hourly / 60) * totalUTMin * ds.undertimeDeductionMultiplier)
    : 0

  const totalDeductions = r2(
    lateDeductions + absenceDeductions + undertimeDeductions +
    sssEmployee + philhealthEmployee + pagibigEmployee +
    withholdingTax +
    additionalDeductions.reduce((s, d) => s + d.amount, 0)
  )
  // Net pay is floored at 0 — mandatory deductions cannot create a debt to the employer.
  const netPay = Math.max(0, r2(grossPay - totalDeductions))

  return {
    id: `pe-${payrollPeriodId}-${employee.id}`,
    payrollPeriodId,
    employeeId: employee.id,
    employeeName: employee.fullName,
    employeeNo: employee.employeeNo,
    position: employee.position,
    department: employee.department,
    employmentType: employee.employmentType,
    scheduledDays: periodDays,
    presentDays, absentDays, lateDays, halfDays, leaveDays,
    overtimeHours: OTHours, nightDiffHours: NDHours,
    regularHolidayDays: regHolDays, specialHolidayDays: spHolDays,
    basicPay, overtimePay, regularHolidayPay, specialHolidayPay,
    nightDifferential, allowances, grossPay,
    lateDeductions, absenceDeductions, undertimeDeductions,
    sssEmployee, philhealthEmployee, pagibigEmployee, withholdingTax,
    otherDeductions: additionalDeductions, totalDeductions,
    sssEmployer, philhealthEmployer, pagibigEmployer, netPay,
  }
}

export function countWorkingDays(start: string, end: string, restDays: number[] = [0, 6]) {
  let count = 0
  const d = new Date(start), e = new Date(end)
  while (d <= e) { if (!restDays.includes(d.getDay())) count++; d.setDate(d.getDate() + 1) }
  return count
}

export function formatPeso(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
