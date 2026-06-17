import type { Employee, AttendanceRecord, Holiday, Allowance, PayrollEntry, PayrollDeductionSettings, GovtContribConfig, SSSBracket, TaxBracket, PayrollComponent } from '../types'
import { computePayrollComponents } from './payrollComponentEngine'

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
  specialHolidayRate: 0.30,     // 30% of daily rate for special non-working holidays
  workingDaysDivisor: 22,        // 22 or 26 working days divisor for daily rate
}

// ─── SSS — uses configurable bracket table ────────────────────────────────────
export function computeSSS(
  monthly: number,
  brackets?: SSSBracket[]
): { employee: number; employer: number } {
  if (!brackets || brackets.length === 0) {
    // Hardcoded fallback (matches DEFAULT_SSS_BRACKETS last two rows)
    return monthly > 34749.99
      ? { employee: 1620, employer: 3420 }
      : { employee: 1350, employer: 2850 }
  }
  const sorted = [...brackets].sort((a, b) => a.maxSalary - b.maxSalary)
  for (const b of sorted) {
    if (monthly <= b.maxSalary) return { employee: b.employeeAmount, employer: b.employerAmount }
  }
  const last = sorted[sorted.length - 1]
  return { employee: last.employeeAmount, employer: last.employerAmount }
}

// ─── PhilHealth — configurable rate/floor/ceiling ────────────────────────────
export function computePhilHealth(
  monthly: number,
  cfg?: Partial<GovtContribConfig>
): { employee: number; employer: number } {
  const rate    = cfg?.philhealthRate    ?? 0.05
  const floor   = cfg?.philhealthFloor   ?? 10000
  const ceiling = cfg?.philhealthCeiling ?? 100000
  const base    = Math.min(Math.max(monthly, floor), ceiling)
  const half    = r2((base * rate) / 2)
  return { employee: half, employer: half }
}

// ─── Pag-IBIG — configurable rates and caps ───────────────────────────────────
export function computePagIbig(
  monthly: number,
  cfg?: Partial<GovtContribConfig>
): { employee: number; employer: number } {
  const eeRate     = cfg?.pagibigEmployeeRate  ?? 0.02
  const erRate     = cfg?.pagibigEmployerRate  ?? 0.02
  const maxEE      = cfg?.pagibigMaxEmployee   ?? 100
  const maxER      = cfg?.pagibigMaxEmployer   ?? 100
  const lowMax     = cfg?.pagibigLowSalaryMax  ?? 1500
  const lowRate    = cfg?.pagibigLowSalaryRate ?? 0.01

  if (monthly <= lowMax) {
    return { employee: r2(monthly * lowRate), employer: r2(monthly * erRate) }
  }
  return {
    employee: Math.min(r2(monthly * eeRate), maxEE),
    employer: Math.min(r2(monthly * erRate), maxER),
  }
}

// ─── Withholding Tax — uses configurable bracket table ────────────────────────
export function computeWithholdingTax(
  taxable: number,
  brackets?: TaxBracket[]
): number {
  if (!brackets || brackets.length === 0) {
    // Hardcoded BIR TRAIN Law fallback
    if (taxable <= 20833)  return 0
    if (taxable <= 33332)  return r2((taxable - 20833) * 0.20)
    if (taxable <= 66666)  return r2(2500 + (taxable - 33333) * 0.25)
    if (taxable <= 166666) return r2(10833.33 + (taxable - 66667) * 0.30)
    if (taxable <= 666666) return r2(40833.33 + (taxable - 166667) * 0.32)
    return r2(200833.33 + (taxable - 666667) * 0.35)
  }
  const sorted = [...brackets].sort((a, b) => (a.maxIncome ?? Infinity) - (b.maxIncome ?? Infinity))
  for (const b of sorted) {
    if (b.maxIncome === null || taxable <= b.maxIncome) {
      return r2(b.baseTax + Math.max(0, taxable - b.excessOver) * b.rate)
    }
  }
  return 0
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
  /** Configurable government contribution rates. Falls back to PH 2024 defaults if omitted. */
  govtConfig?: GovtContribConfig
  /**
   * User-defined payroll components (from Settings → Payroll Components).
   * When this array is non-empty, the dynamic engine is used INSTEAD of the
   * hardcoded SSS / PhilHealth / Pag-IBIG / withholding tax calculations.
   * When empty/undefined, the legacy govtConfig path is used.
   */
  payrollComponents?: PayrollComponent[]
  /** Rest day numbers (0=Sun…6=Sat) from the employee's assigned shift. Used to split OT rate. */
  restDays?: number[]
  /**
   * Actual number of pay periods in the calendar month (4 or 5 for weekly).
   * Computed by the DB layer from the pay period start date.
   * When omitted, falls back to frequency-derived default (4 for weekly — which is
   * wrong in 5-week months). Always pass this for weekly payroll.
   */
  periodDivisor?: number
  /**
   * Pay period start date (YYYY-MM-DD).
   * Required for mid-period hire/resign proration.
   */
  periodStart?: string
  /**
   * Pay period end date (YYYY-MM-DD).
   * Required for mid-period hire/resign proration.
   */
  periodEnd?: string
}

export function computePayrollEntry(input: ComputeInput): PayrollEntry {
  const {
    employee, attendanceRecords, holidays,
    payrollPeriodId, additionalDeductions = [],
    deductionSettings = DEFAULT_DEDUCTION_SETTINGS,
    restDays = [0, 6],   // default Sun + Sat
  } = input

  const ds = deductionSettings

  // ── Per-period divisor — how many pay periods fall in this calendar month ──
  // For monthly → 1, bi-monthly → 2, weekly → 4 or 5 (varies by month).
  // The DB layer computes the exact count and passes it as periodDivisor.
  // Fallback: use frequency default (weekly defaults to 4 — incorrect in 5-week months).
  const divBy: number =
    input.periodDivisor ??
    (employee.payFrequency === 'monthly'    ? 1
    : employee.payFrequency === 'bi-monthly' ? 2
    : 4)

  // ── Mid-period hire / resign proration ─────────────────────────────────
  // If an employee was hired or resigned within the pay period, their scheduled
  // working days are prorated to their actual tenure in the period.
  let periodDays = input.periodDays
  if (input.periodStart && input.periodEnd) {
    const pStart     = input.periodStart
    const pEnd       = input.periodEnd
    const hireDate   = employee.hireDate   ?? ''
    const resignDate = employee.resignDate ?? ''

    if (hireDate && hireDate > pStart && hireDate <= pEnd) {
      // New hire: started after the period began — prorate from hire date
      periodDays = countWorkingDays(hireDate, pEnd, restDays)
    } else if (resignDate && resignDate >= pStart && resignDate < pEnd) {
      // Resignee: left before the period ended — prorate up to last day
      periodDays = countWorkingDays(pStart, resignDate, restDays)
    }
  }

  // ── Working-days divisor — derived from shift's rest days ──────────────────
  // Use the global setting if it differs from the default 22 (explicit company
  // override); otherwise derive from the employee's shift rest days so that
  // 6-day schedules naturally produce ×26 and 5-day schedules ×22.
  const shiftWorkDaysPerWeek = 7 - restDays.length   // e.g. [0,6] → 5, [0] → 6
  const shiftDivisor = Math.round(shiftWorkDaysPerWeek * 52 / 12)  // 5→22, 6→26
  const effectiveDivisor =
    ds.workingDaysDivisor !== DEFAULT_DEDUCTION_SETTINGS.workingDaysDivisor
      ? ds.workingDaysDivisor   // explicit company-wide override wins
      : shiftDivisor             // shift-derived (most accurate per-employee)

  // ── Daily & hourly rate based on compensation type ───────────────────────
  const compensationType = employee.compensationType ?? 'monthly'
  let daily: number
  let monthly: number

  if (compensationType === 'daily') {
    daily   = employee.compensationRate ?? employee.dailyRate ?? 0
    monthly = r2(daily * effectiveDivisor)
  } else if (compensationType === 'weekly') {
    daily   = r2((employee.compensationRate ?? (employee.dailyRate ?? 0) * shiftWorkDaysPerWeek) / shiftWorkDaysPerWeek)
    monthly = r2(daily * effectiveDivisor)
  } else {
    // monthly
    monthly = employee.compensationRate ?? employee.basicSalary
    const dr = employee.dailyRate ?? 0
    daily   = dr > 0 ? dr : r2(monthly / effectiveDivisor)
  }

  const hourly = r2(daily / 8)

  // ── Holiday sets ─────────────────────────────────────────────────────────
  const regHolSet = new Set(holidays.filter(h => h.type === 'regular').map(h => h.date))
  const spHolSet  = new Set(holidays.filter(h => h.type === 'special-non-working').map(h => h.date))

  // ── Tally attendance — split OT into regular-day and rest-day buckets ────
  let presentDays = 0, absentDays = 0, lateDays = 0, halfDays = 0, leaveDays = 0
  let totalMinLate = 0, regularOTMin = 0, restDayOTMin = 0, totalNDMin = 0, totalUTMin = 0

  // Holiday day tracking:
  // regHolDays = ALL regular holidays in period (used for paidDays — employee is paid even if not worked)
  // workedRegHolDays = regular holidays where the employee WORKED (earns the extra 100% premium)
  // workedSpHolDays  = special non-working holidays where the employee WORKED (earns +30% premium)
  //                    (non-worked special holidays = no-work-no-pay, so they stay out of paidDays)
  let regHolDays = 0, workedRegHolDays = 0, workedSpHolDays = 0

  for (const r of attendanceRecords) {
    const worked = r.status === 'present' || r.status === 'late'

    if (r.status === 'present')   { presentDays++ }
    else if (r.status === 'late') { presentDays++; lateDays++; totalMinLate += r.minutesLate }
    else if (r.status === 'absent') { absentDays++ }
    else if (r.status === 'half-day') { halfDays++; presentDays += 0.5; absentDays += 0.5 }
    else if (r.status === 'on-leave') { leaveDays++ }

    // Determine if this attendance day is a rest day for OT rate split
    const [y, m, d] = r.date.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()
    if (restDays.includes(dayOfWeek)) restDayOTMin += r.overtimeMinutes
    else                              regularOTMin  += r.overtimeMinutes

    totalNDMin += r.nightDiffMinutes
    totalUTMin += r.undertimeMinutes

    // Regular holiday: employee is paid regardless; track worked days for double-pay premium
    if (regHolSet.has(r.date)) {
      regHolDays++
      if (worked) workedRegHolDays++
    }

    // Special non-working holiday: no-work-no-pay (only track worked days for +30% premium)
    if (spHolSet.has(r.date) && worked) {
      workedSpHolDays++
    }
  }

  // ── Basic pay logic ───────────────────────────────────────────────────────
  // absencePolicy drives whether absent days are paid or forfeited.
  //
  //   'no-work-no-pay' (default — absenceDeductionEnabled=true, type='daily-rate'):
  //       Absent days are EXCLUDED from paidDays.  The deduction is therefore
  //       implicit in the attendance ratio (basicPay < periodSalary).
  //       absenceDeductions stays 0 in the ledger — no double-counting.
  //
  //   'paid-leave-policy' (absenceDeductionEnabled=false  OR  type='zero'):
  //       Absent days ARE counted as paid — they are added back into paidDays.
  //       absenceDeductions = 0 (nothing deducted).
  //
  const noWorkNoPay =
    ds.absenceDeductionEnabled && ds.absenceDeductionType === 'daily-rate'

  // paidDays includes:
  //   • Days actually worked (present + late + half-days counted at 0.5)
  //   • Approved leave days
  //   • ALL regular holidays (Art. 94 — employee is paid even without working)
  //   • Worked special non-working holidays (+30% premium; not-worked = no-work-no-pay)
  //   • When paid-leave policy (noWorkNoPay = false): absent days are also counted as paid
  const paidDays = presentDays + leaveDays + regHolDays + workedSpHolDays
                   + (noWorkNoPay ? 0 : absentDays)

  let basicPay: number

  if (compensationType === 'daily' || compensationType === 'weekly') {
    // Daily/weekly workers: pay exactly for paidDays at their day rate
    basicPay = r2(daily * paidDays)
  } else {
    // Monthly workers: full period pay × attendance ratio
    // divBy is hoisted to the top of this function (uses periodDivisor for accuracy)
    const periodSalary = r2(monthly / divBy)
    basicPay = periodDays > 0 ? r2(periodSalary * (paidDays / periodDays)) : r2(daily * paidDays)
  }

  // ── Pay additions ─────────────────────────────────────────────────────────
  const regularOTHours = r2(regularOTMin / 60)
  const restDayOTHours = r2(restDayOTMin / 60)
  const NDHours        = r2(totalNDMin / 60)
  const ndMult         = ds.nightDiffMultiplier
  const spHolRate      = ds.specialHolidayRate ?? 0.30   // configurable, default 30%

  // Split OT pay: regular day OT at 1.25×, rest day OT at 1.30× (as per Labour Code)
  const overtimePay = ds.overtimeEnabled
    ? r2(hourly * regularOTHours * ds.overtimeMultiplierRegular +
         hourly * restDayOTHours * ds.overtimeMultiplierRestDay)
    : 0

  // ── Holiday pay — Philippine Labor Code Art. 94 & DOLE Rules ─────────────
  // Regular Holiday:
  //   • Not worked: 100% daily rate (already embedded in basicPay via paidDays/periodDays)
  //   • Worked: 200% total = basic (already in basicPay) + 100% premium here
  const regularHolidayPay = r2(daily * workedRegHolDays)   // extra 100% for worked regular holidays

  // Special Non-Working Holiday:
  //   • Not worked: 0 pay (no-work-no-pay; not in paidDays)
  //   • Worked: 130% total = basic in paidDays + 30% premium here
  const specialHolidayPay = r2(daily * workedSpHolDays * spHolRate)  // +30% for worked special holidays

  const nightDifferential = ds.nightDiffEnabled ? r2(hourly * NDHours * ndMult) : 0

  // ── Allowances from employee profile (static, prorated by frequency) ──────
  // divBy is hoisted to the top of the function — it is already correct here.
  const allowances: Allowance[] = (employee.allowances ?? []).map(a => ({ ...a, amount: r2(a.amount / divBy) }))
  const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0)

  // Pre-component gross: basic + OT + holiday + static allowances (no dynamic components yet)
  const preComponentGross = r2(basicPay + overtimePay + regularHolidayPay + specialHolidayPay + nightDifferential + totalAllowances)

  // ── Attendance-only deductions (late, absence, undertime) ─────────────────
  const lateDeductions = ds.lateDeductionEnabled
    ? r2((hourly / 60) * totalMinLate * ds.lateDeductionMultiplier)
    : 0

  // absenceDeductions:
  //   noWorkNoPay = true  → 0  (deduction is already implicit via the paidDays ratio above;
  //                              adding an explicit amount here would double-deduct)
  //   noWorkNoPay = false → 0  (paid-leave policy; absentDays included in paidDays = full pay)
  const absenceDeductions = 0

  const undertimeDeductions = ds.undertimeDeductionEnabled
    ? r2((hourly / 60) * totalUTMin * ds.undertimeDeductionMultiplier)
    : 0

  // ════════════════════════════════════════════════════════════════════════════
  // DYNAMIC PATH — user-defined PayrollComponents take full control
  // ════════════════════════════════════════════════════════════════════════════
  const dynComponents = input.payrollComponents ?? []

  if (dynComponents.length > 0) {
    const dynResult = computePayrollComponents({
      basicPay: monthly,          // monthly basis for % calculations
      preComponentGross,
      components: dynComponents,
      periodDivisor: divBy,
    })

    const grossPay      = dynResult.finalGross
    const componentDeds = dynResult.componentDeductions
    const totalDeductions = r2(
      lateDeductions + absenceDeductions + undertimeDeductions +
      componentDeds +
      additionalDeductions.reduce((s, d) => s + d.amount, 0)
    )
    const netPay = Math.max(0, r2(grossPay - totalDeductions))

    // Legacy numeric fields zeroed out — display comes from computedComponents
    return {
      id: `pe-${payrollPeriodId}-${employee.id}`,
      payrollPeriodId,
      employeeId:     employee.id,
      employeeName:   employee.fullName ?? `${employee.firstName} ${employee.lastName}`.trim(),
      employeeNo:     employee.employeeNo,
      position:       employee.position,
      department:     employee.department ?? '',
      employmentType: employee.employmentType ?? 'regular',
      scheduledDays:  periodDays,
      presentDays, absentDays, lateDays, halfDays, leaveDays,
      overtimeHours: r2(regularOTHours + restDayOTHours), nightDiffHours: NDHours,
      regularHolidayDays: regHolDays, specialHolidayDays: workedSpHolDays,
      basicPay, overtimePay, regularHolidayPay, specialHolidayPay,
      nightDifferential, allowances, grossPay,
      lateDeductions, absenceDeductions, undertimeDeductions,
      // Legacy fields — zeroed (components now tracked in computedComponents)
      sssEmployee: 0, philhealthEmployee: 0, pagibigEmployee: 0, withholdingTax: 0,
      otherDeductions: additionalDeductions,
      totalDeductions,
      sssEmployer: 0, philhealthEmployer: 0, pagibigEmployer: 0,
      netPay,
      // Dynamic results
      computedComponents: dynResult.components,
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LEGACY PATH — govtConfig-based calculations (backward compatibility)
  // ════════════════════════════════════════════════════════════════════════════
  const grossPay = preComponentGross

  const gc  = input.govtConfig
  const sss = gc && !gc.sssEnabled         ? { employee: 0, employer: 0 } : computeSSS(monthly, gc?.sssBrackets)
  const ph  = gc && !gc.philhealthEnabled  ? { employee: 0, employer: 0 } : computePhilHealth(monthly, gc)
  const pi  = gc && !gc.pagibigEnabled     ? { employee: 0, employer: 0 } : computePagIbig(monthly, gc)

  const sssEmployee        = r2(sss.employee / divBy)
  const philhealthEmployee = r2(ph.employee  / divBy)
  const pagibigEmployee    = r2(pi.employee  / divBy)
  const sssEmployer        = r2(sss.employer / divBy)
  const philhealthEmployer = r2(ph.employer  / divBy)
  const pagibigEmployer    = r2(pi.employer  / divBy)

  const nonTaxable    = allowances.filter(a => !a.taxable).reduce((s, a) => s + a.amount, 0)
  const mandatoryDed  = sssEmployee + philhealthEmployee + pagibigEmployee
  const taxableIncome = Math.max(0, grossPay - nonTaxable - mandatoryDed)
  const withholdingTax = (gc && !gc.taxEnabled)
    ? 0
    : r2(computeWithholdingTax(taxableIncome * divBy, gc?.taxBrackets) / divBy)

  const totalDeductions = r2(
    lateDeductions + absenceDeductions + undertimeDeductions +
    sssEmployee + philhealthEmployee + pagibigEmployee +
    withholdingTax +
    additionalDeductions.reduce((s, d) => s + d.amount, 0)
  )
  const netPay = Math.max(0, r2(grossPay - totalDeductions))

  return {
    id: `pe-${payrollPeriodId}-${employee.id}`,
    payrollPeriodId,
    employeeId:     employee.id,
    employeeName:   employee.fullName ?? `${employee.firstName} ${employee.lastName}`.trim(),
    employeeNo:     employee.employeeNo,
    position:       employee.position,
    department:     employee.department ?? '',
    employmentType: employee.employmentType ?? 'regular',
    scheduledDays:  periodDays,
    presentDays, absentDays, lateDays, halfDays, leaveDays,
    overtimeHours: r2(regularOTHours + restDayOTHours), nightDiffHours: NDHours,
    regularHolidayDays: regHolDays, specialHolidayDays: workedSpHolDays,
    basicPay, overtimePay, regularHolidayPay, specialHolidayPay,
    nightDifferential, allowances, grossPay,
    lateDeductions, absenceDeductions, undertimeDeductions,
    sssEmployee, philhealthEmployee, pagibigEmployee, withholdingTax,
    otherDeductions: additionalDeductions, totalDeductions,
    sssEmployer, philhealthEmployer, pagibigEmployer, netPay,
  }
}

// ─── 13th Month Pay ───────────────────────────────────────────────────────────
// Per Presidential Decree No. 851: 1/12 of total basic salary earned Jan–Dec.
// annualBasicSalary = sum of all basicPay entries for the calendar year.
export function compute13thMonth(annualBasicSalary: number): number {
  return r2(annualBasicSalary / 12)
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
