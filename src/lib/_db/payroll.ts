// ─── Payroll ──────────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import { computePayrollEntry, countWorkingDays, DEFAULT_DEDUCTION_SETTINGS } from '../payrollEngine'
import { getGovtConfig } from './settings'
// getPayrollComponents no longer used — components are now per-employee (migration 012)
import { apiRecordRepayment } from './advances'
import type {
  PayrollPeriod, PayrollEntry, PayrollStatus, PayFrequency,
  Employee, Holiday, AttendanceRecord, PayrollDeductionSettings,
} from '../../types'

// ── Mappers ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPeriod(r: any): PayrollPeriod {
  return {
    id:              r.id,
    periodNo:        r.period_no,
    startDate:       r.start_date,
    endDate:         r.end_date,
    payDate:         r.pay_date,
    frequency:       r.frequency         as PayFrequency,
    status:          r.status            as PayrollStatus,
    totalEmployees:  r.total_employees   ?? 0,
    totalGross:      Number(r.total_gross)      || 0,
    totalDeductions: Number(r.total_deductions) || 0,
    totalNet:        Number(r.total_net)        || 0,
    createdBy:       r.created_by        ?? '',
    createdAt:       r.created_at,
    reviewedBy:      r.reviewed_by       ?? undefined,
    reviewedAt:      r.reviewed_at       ?? undefined,
    approvedBy:      r.approved_by       ?? undefined,
    approvedAt:      r.approved_at       ?? undefined,
    paidAt:          r.paid_at           ?? undefined,
    notes:           r.notes             ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(r: any): PayrollEntry {
  return {
    id:                  r.id,
    payrollPeriodId:     r.payroll_period_id,
    employeeId:          r.employee_id,
    employeeName:        r.employee_name        ?? '',
    employeeNo:          r.employee_no          ?? '',
    position:            r.position             ?? '',
    department:          r.department           ?? '',
    employmentType:      r.employment_type      ?? 'regular',
    scheduledDays:       r.scheduled_days       ?? 0,
    presentDays:         Number(r.present_days)         || 0,
    absentDays:          Number(r.absent_days)          || 0,
    lateDays:            r.late_days            ?? 0,
    halfDays:            r.half_days            ?? 0,
    leaveDays:           r.leave_days           ?? 0,
    overtimeHours:       Number(r.overtime_hours)       || 0,
    nightDiffHours:      Number(r.night_diff_hours)     || 0,
    regularHolidayDays:  r.regular_holiday_days ?? 0,
    specialHolidayDays:  r.special_holiday_days ?? 0,
    basicPay:            Number(r.basic_pay)            || 0,
    overtimePay:         Number(r.overtime_pay)         || 0,
    regularHolidayPay:   Number(r.regular_holiday_pay)  || 0,
    specialHolidayPay:   Number(r.special_holiday_pay)  || 0,
    nightDifferential:   Number(r.night_differential)   || 0,
    allowances:          r.allowances           ?? [],
    grossPay:            Number(r.gross_pay)            || 0,
    lateDeductions:      Number(r.late_deductions)      || 0,
    absenceDeductions:   Number(r.absence_deductions)   || 0,
    undertimeDeductions: Number(r.undertime_deductions) || 0,
    sssEmployee:         Number(r.sss_employee)         || 0,
    philhealthEmployee:  Number(r.philhealth_employee)  || 0,
    pagibigEmployee:     Number(r.pagibig_employee)     || 0,
    withholdingTax:      Number(r.withholding_tax)      || 0,
    otherDeductions:     r.other_deductions     ?? [],
    totalDeductions:     Number(r.total_deductions)     || 0,
    sssEmployer:         Number(r.sss_employer)         || 0,
    philhealthEmployer:  Number(r.philhealth_employer)  || 0,
    pagibigEmployer:     Number(r.pagibig_employer)     || 0,
    netPay:              Number(r.net_pay)              || 0,
    remarks:             r.remarks              ?? undefined,
    markedPaid:          r.marked_paid          ?? false,
    markedPaidAt:        r.marked_paid_at       ?? undefined,
    markedPaidBy:        r.marked_paid_by       ?? undefined,
    // Dynamic engine results (null for legacy entries)
    computedComponents:  r.computed_components  ?? undefined,
  }
}

function fromEntry(e: PayrollEntry): Record<string, unknown> {
  return {
    payroll_period_id:   e.payrollPeriodId,
    employee_id:         e.employeeId,
    employee_name:       e.employeeName,
    employee_no:         e.employeeNo,
    position:            e.position,
    department:          e.department,
    employment_type:     e.employmentType,
    scheduled_days:      e.scheduledDays,
    present_days:        e.presentDays,   // NUMERIC(8,2) after migration 020 — supports half-days
    absent_days:         e.absentDays,    // NUMERIC(8,2) after migration 020 — supports half-days
    late_days:           e.lateDays,
    half_days:           e.halfDays,
    leave_days:          e.leaveDays,
    overtime_hours:      e.overtimeHours,
    night_diff_hours:    e.nightDiffHours,
    regular_holiday_days: e.regularHolidayDays,
    special_holiday_days: e.specialHolidayDays,
    basic_pay:           e.basicPay,
    overtime_pay:        e.overtimePay,
    regular_holiday_pay: e.regularHolidayPay,
    special_holiday_pay: e.specialHolidayPay,
    night_differential:  e.nightDifferential,
    allowances:          e.allowances,
    gross_pay:           e.grossPay,
    late_deductions:     e.lateDeductions,
    absence_deductions:  e.absenceDeductions,
    undertime_deductions:e.undertimeDeductions,
    sss_employee:        e.sssEmployee,
    philhealth_employee: e.philhealthEmployee,
    pagibig_employee:    e.pagibigEmployee,
    withholding_tax:     e.withholdingTax,
    other_deductions:    e.otherDeductions,
    total_deductions:    e.totalDeductions,
    sss_employer:        e.sssEmployer,
    philhealth_employer: e.philhealthEmployer,
    pagibig_employer:    e.pagibigEmployer,
    net_pay:             e.netPay,
    remarks:             e.remarks ?? null,
    marked_paid:         e.markedPaid ?? false,
    marked_paid_at:      e.markedPaidAt ?? null,
    marked_paid_by:      e.markedPaidBy ?? null,
    computed_components: e.computedComponents ?? null,  // JSONB — added by migration 020
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the actual number of pay periods that fall in the calendar month
 * of the given date (YYYY-MM-DD).
 *
 * For monthly  → 1 (always)
 * For bi-monthly → 2 (always)
 * For weekly   → 4 or 5.  A small number of months have 5 occurrences of the
 *                pay weekday (determined by the period's start-date weekday).
 *                Using 4 unconditionally over-deducts SSS/PhilHealth/Pag-IBIG
 *                by one period in 5-week months.
 */
function getActualFreqDivisor(frequency: string, periodStartDate: string): number {
  if (frequency === 'monthly')    return 1
  if (frequency === 'bi-monthly') return 2
  if (frequency === 'weekly') {
    // Count how many times the period's start weekday appears in the same month
    const d         = new Date(periodStartDate + 'T00:00:00')
    const year      = d.getFullYear()
    const month     = d.getMonth()
    const payWeekday = d.getDay()                              // 0=Sun … 6=Sat
    const daysInMo  = new Date(year, month + 1, 0).getDate()  // 28-31
    let count = 0
    for (let day = 1; day <= daysInMo; day++) {
      if (new Date(year, month, day).getDay() === payWeekday) count++
    }
    return count   // 4 or 5
  }
  return 1   // 13th-month or any future frequency
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetPayrollPeriods(): Promise<PayrollPeriod[]> {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toPeriod)
}

export async function apiGetPayrollPeriod(id: string): Promise<PayrollPeriod | null> {
  const { data, error } = await supabase.from('payroll_periods').select('*').eq('id', id).single()
  if (error || !data) return null
  return toPeriod(data)
}

export async function apiCreatePayrollPeriod(
  input: { startDate: string; endDate: string; payDate: string; frequency: PayFrequency },
  createdBy = 'System'
): Promise<{ period: PayrollPeriod; entries: PayrollEntry[] }> {

  // 0. Overlap guard — reject if any existing period's date range overlaps with the new one.
  const { data: overlapping } = await supabase
    .from('payroll_periods')
    .select('id, period_no, start_date, end_date')
    .lte('start_date', input.endDate)
    .gte('end_date',   input.startDate)
    .limit(1)
  if (overlapping && overlapping.length > 0) {
    const ov = overlapping[0] as { period_no: string; start_date: string; end_date: string }
    throw new Error(
      `Date range overlaps with existing period ${ov.period_no} (${ov.start_date} – ${ov.end_date}). ` +
      'Please select a non-overlapping range.'
    )
  }

  // 1. Get next period number from DB sequence
  const { data: seqData } = await supabase.rpc('next_period_no')
  const periodNo = (seqData as string | null) ?? `PAY-${Date.now()}`

  // 2. Fetch active employees whose pay frequency matches this payroll run.
  //    This prevents double-payment: a bi-monthly employee must not appear
  //    in a monthly run (and vice-versa).
  const { data: empRows } = await supabase
    .from('employees')
    .select('*')
    .eq('status', 'active')
    .eq('pay_frequency', input.frequency)

  const employees: Employee[] = (empRows ?? []).map((r) => ({
    id: r.id, employeeNo: r.employee_no, firstName: r.first_name, lastName: r.last_name,
    middleName: r.middle_name ?? '',
    fullName: r.full_name ?? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
    email: r.email, phone: r.phone ?? '',
    address: r.address ?? '', birthDate: r.birth_date ?? '', gender: r.gender ?? 'male',
    civilStatus: r.civil_status ?? 'single', position: r.position ?? '', department: r.department ?? '',
    employmentType: r.employment_type ?? 'regular', status: r.status ?? 'active',
    hireDate: r.hire_date ?? '', resignDate: r.resign_date ?? undefined,
    compensationType: r.compensation_type ?? 'monthly', compensationRate: Number(r.compensation_rate) || 0,
    basicSalary: Number(r.basic_salary) || 0, dailyRate: Number(r.daily_rate) || 0,
    payFrequency: r.pay_frequency ?? 'bi-monthly', pinCode: r.pin_code ?? undefined,
    rfidTag: r.rfid_tag ?? undefined, photoUrl: r.photo_url ?? undefined,
    sssNo: r.sss_no ?? '', philhealthNo: r.philhealth_no ?? '', pagibigNo: r.pagibig_no ?? '',
    tinNo: r.tin_no ?? '', bankName: r.bank_name ?? '', bankAccount: r.bank_account ?? '',
    shiftId: r.shift_id ?? '', taxStatus: r.tax_status ?? 'S',
    allowances: r.allowances ?? [],
    payrollComponents: r.payroll_components ?? [],
    emergencyContactName: r.emergency_contact_name ?? '', emergencyContactPhone: r.emergency_contact_phone ?? '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  }))

  if (employees.length === 0) {
    throw new Error(
      `No active employees with "${input.frequency}" pay frequency found. ` +
      'Check employee pay frequency settings in their profiles before generating payroll.'
    )
  }

  // 3. Fetch holidays in range
  const { data: holRows } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', input.startDate)
    .lte('date', input.endDate)
  const holidays: Holiday[] = (holRows ?? []).map((h) => ({
    id: h.id, name: h.name, date: h.date, type: h.type,
    isNationwide: h.is_nationwide, description: h.description ?? undefined,
  }))

  // 4. Fetch deduction settings
  const { data: settingRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'deductions')
    .single()
  const deductionSettings: PayrollDeductionSettings =
    (settingRow?.value as PayrollDeductionSettings) ?? DEFAULT_DEDUCTION_SETTINGS

  // 5-A. Batch fetch ALL attendance records for the period in a single query (fixes N+1)
  const { data: allAttRows } = await supabase
    .from('attendance_records')
    .select('*')
    .gte('date', input.startDate)
    .lte('date', input.endDate)
    .neq('status', 'rest-day')

  // Group attendance records by employee_id
  const toAttRec = (r: Record<string, unknown>): AttendanceRecord => ({
    id: r.id as string, employeeId: r.employee_id as string,
    employeeName: (r.employee_name as string) ?? '',
    employeeNo:   (r.employee_no   as string) ?? '',
    department:   (r.department    as string) ?? undefined,
    date: r.date as string, timeIn: (r.time_in as string) ?? undefined,
    timeOut: (r.time_out as string) ?? undefined,
    status: r.status as AttendanceRecord['status'],
    minutesLate:      Number(r.minutes_late)      || 0,
    overtimeMinutes:  Number(r.overtime_minutes)  || 0,
    nightDiffMinutes: Number(r.night_diff_minutes)|| 0,
    undertimeMinutes: Number(r.undertime_minutes) || 0,
    source: (r.source as 'kiosk' | 'manual') ?? 'kiosk',
  })
  const attByEmp = new Map<string, AttendanceRecord[]>()
  for (const r of allAttRows ?? []) {
    const list = attByEmp.get(r.employee_id as string) ?? []
    list.push(toAttRec(r as Record<string, unknown>))
    attByEmp.set(r.employee_id as string, list)
  }

  // 5-B. Fetch shifts for rest-day OT splitting + per-employee working days count
  const { data: shiftRows } = await supabase
    .from('work_shifts')
    .select('id, rest_days, overtime_threshold_minutes')
  const shiftMap = new Map<string, { restDays: number[] }>()
  for (const s of shiftRows ?? []) {
    shiftMap.set(s.id as string, { restDays: (s.rest_days as number[]) ?? [0, 6] })
  }

  // 5-C. Batch fetch ALL active salary advance deductions — one query for all employees
  //       (eliminates the previous N+1 pattern of one query per employee)
  //       Suspended advances are excluded: is_suspended=true means "skip this period".
  const employeeIds = employees.map(e => e.id)
  const { data: allAdvRows } = await supabase
    .from('salary_advances')
    .select('id, employee_id, monthly_deduction, outstanding, deduction_type')
    .in('employee_id', employeeIds)
    .eq('status', 'released')
    .eq('is_suspended', false)
    .gt('outstanding', 0)

  // 5-D. Compute entries using batched attendance + advance data
  const computedEntries: PayrollEntry[] = []
  // Track advance deductions to auto-record repayments after payroll is created
  const advanceDeductionsByEmp = new Map<string, { advanceId: string; amount: number }[]>()

  // Fetch govt config once (used when an employee has no dynamic components).
  // Components are now per-employee (migration 012) — each employee's payrollComponents
  // field holds their own list. Empty list → falls back to legacy govt-only engine path.
  const govtConfigSnapshot = getGovtConfig()
  // Compute the correct per-period divisor for BOTH govt contributions AND advance
  // deductions.  For weekly payroll this is 4 or 5 depending on the calendar month:
  //   • Using 4 unconditionally over-deducts in 5-week months.
  //   • getActualFreqDivisor() counts the real number of pay periods in the month.
  const periodDivisor = getActualFreqDivisor(input.frequency, input.startDate)

  // Group advance deductions by employee_id.
  // How the stored monthly_deduction is converted to a per-period amount depends
  // on the advance's deduction_type:
  //
  //   'monthly'      The stored value is a monthly budget → divide by periodDivisor
  //                  so the full budget is recovered across all periods in the month.
  //                  In 5-week months (periodDivisor=5) this correctly gives a lower
  //                  per-period amount than in 4-week months.
  //
  //   'per_period'   The stored value IS already the per-period amount → use as-is.
  //                  Same peso amount every payroll run, regardless of month length.
  //
  //   'installments' Stored as amount / installmentCount at save time → use as-is.
  //                  Same logic as per_period at deduction time.
  const advByEmp = new Map<string, { advanceId: string; amount: number }[]>()
  for (const a of allAdvRows ?? []) {
    const stored = Number(a.monthly_deduction)
    if (!(stored > 0)) continue
    const dtype     = (a.deduction_type as string) ?? 'monthly'
    const perPeriod = dtype === 'monthly' ? stored / periodDivisor : stored
    const amount    = Math.min(perPeriod, Number(a.outstanding))
    if (amount <= 0) continue
    const empId = a.employee_id as string
    const list  = advByEmp.get(empId) ?? []
    list.push({ advanceId: a.id as string, amount })
    advByEmp.set(empId, list)
  }

  for (const emp of employees) {
    const attRecs    = attByEmp.get(emp.id) ?? []
    const advDeds    = advByEmp.get(emp.id) ?? []
    const shiftInfo  = shiftMap.get(emp.shiftId ?? '') ?? { restDays: [0, 6] }
    const periodDays = countWorkingDays(input.startDate, input.endDate, shiftInfo.restDays)

    advanceDeductionsByEmp.set(emp.id, advDeds)

    // Convert advance deductions into payroll engine's additionalDeductions format
    const advAdditional = advDeds.map(d => ({
      type:   'Salary Advance',
      amount: d.amount,
    }))

    // Per-employee components: use the employee's own list; fall back to govt-only path
    // when the employee has no components configured (opt-in design).
    const empComponents = (emp.payrollComponents ?? []).filter(c => c.isActive)
    const entry = computePayrollEntry({
      employee: emp, attendanceRecords: attRecs, holidays, periodDays,
      payrollPeriodId: 'tmp', deductionSettings,
      additionalDeductions: advAdditional,
      payrollComponents: empComponents,
      govtConfig: empComponents.length === 0 ? govtConfigSnapshot : undefined,
      restDays:      shiftInfo.restDays,
      periodDivisor,                      // correct 4-or-5 divisor for weekly
      periodStart:   input.startDate,     // for mid-period hire proration
      periodEnd:     input.endDate,       // for mid-period resign proration
    })
    computedEntries.push(entry)
  }

  const totalGross      = Math.round(computedEntries.reduce((s, e) => s + (Number(e.grossPay)        || 0), 0) * 100) / 100
  const totalDeductions = Math.round(computedEntries.reduce((s, e) => s + (Number(e.totalDeductions) || 0), 0) * 100) / 100
  const totalNet        = Math.round(computedEntries.reduce((s, e) => s + (Number(e.netPay)          || 0), 0) * 100) / 100

  // 6. Insert period
  const { data: periodRow, error: pErr } = await supabase
    .from('payroll_periods')
    .insert({
      period_no:        periodNo,
      start_date:       input.startDate,
      end_date:         input.endDate,
      pay_date:         input.payDate,
      frequency:        input.frequency,
      status:           'draft',
      total_employees:  computedEntries.length,
      total_gross:      totalGross,
      total_deductions: totalDeductions,
      total_net:        totalNet,
      created_by:       createdBy,
    })
    .select()
    .single()
  if (pErr || !periodRow) throw new Error(pErr?.message ?? 'Failed to create payroll period')
  const period = toPeriod(periodRow)

  // 7. Insert entries with real period id
  const entryRows = computedEntries.map((e) => fromEntry({ ...e, payrollPeriodId: period.id }))
  const { data: insertedEntries, error: eErr } = await supabase
    .from('payroll_entries')
    .insert(entryRows)
    .select()
  if (eErr) throw new Error(eErr.message ?? 'Failed to insert payroll entries')

  const entries = (insertedEntries ?? []).map(toEntry)

  // 8. Auto-record salary advance repayments for this period
  for (const entry of entries) {
    const advDeds = advanceDeductionsByEmp.get(entry.employeeId) ?? []
    for (const ded of advDeds) {
      try {
        await apiRecordRepayment(ded.advanceId, ded.amount, {
          payrollPeriodId: period.id,
          notes: `Payroll deduction — ${period.periodNo}`,
          recordedBy: createdBy,
        })
      } catch {
        // Non-fatal: log but don't block payroll creation
        console.warn(`Failed to record advance repayment for advance ${ded.advanceId}`)
      }
    }
  }

  await insertAudit({
    userId: 'sys', userName: createdBy, action: 'generate', module: 'Payroll',
    description: `Generated payroll ${period.periodNo} (${input.startDate} – ${input.endDate})`,
  })
  return { period, entries }
}

export async function apiUpdatePayrollStatus(
  id: string,
  status: PayrollStatus,
  by = 'System'
): Promise<PayrollPeriod> {
  // ── Maker-checker: approver must differ from the person who generated ────────
  // Skip the check for placeholder actors ('System') to allow automated flows
  // and backfill runs that don't have a real user context.
  if (status === 'approved' && by && by !== 'System') {
    const { data: current } = await supabase
      .from('payroll_periods')
      .select('created_by, period_no')
      .eq('id', id)
      .single()

    if (current?.created_by && current.created_by !== 'System' && current.created_by === by) {
      throw new Error(
        `Maker-checker violation: "${by}" generated this payroll and cannot also approve it. ` +
        `Ask a different authorized user (Payroll Manager or Finance) to review and approve.`
      )
    }
  }

  const now   = new Date().toISOString()
  const patch: Record<string, unknown> = { status }
  if (status === 'reviewed') { patch.reviewed_by = by; patch.reviewed_at = now }
  if (status === 'approved') { patch.approved_by = by; patch.approved_at = now }
  if (status === 'paid')     { patch.paid_at = now }

  const { data, error } = await supabase
    .from('payroll_periods').update(patch).eq('id', id).select().single()
  if (error || !data) throw new Error(error?.message ?? 'Payroll period not found')
  const period = toPeriod(data)
  await insertAudit({
    userId: 'sys', userName: by, action: status === 'approved' ? 'approve' : 'update',
    module: 'Payroll', description: `Payroll ${period.periodNo} status changed to ${status}`,
  })
  return period
}

// Re-open a reviewed or approved payroll back to draft for corrections.
// Blocked for paid payrolls — those require a correction/reversal entry instead.
export async function apiReopenPayroll(id: string, by = 'System'): Promise<PayrollPeriod> {
  const { data: current } = await supabase
    .from('payroll_periods')
    .select('status, period_no')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Payroll period not found.')
  if (current.status === 'paid') {
    throw new Error(
      'Cannot re-open a paid payroll. Create a correction or reversal entry instead.'
    )
  }
  if (current.status === 'draft') {
    throw new Error('This payroll is already in Draft status.')
  }

  const { data, error } = await supabase
    .from('payroll_periods')
    .update({
      status:       'draft',
      reviewed_by:  null,
      reviewed_at:  null,
      approved_by:  null,
      approved_at:  null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to re-open payroll period.')

  const period = toPeriod(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Payroll',
    description: `Re-opened payroll ${period.periodNo} to Draft for corrections`,
  })
  return period
}

export async function apiGetPayrollEntries(
  periodId: string,
  opts?: { employeeId?: string },
): Promise<PayrollEntry[]> {
  let query = supabase
    .from('payroll_entries')
    .select('*')
    .eq('payroll_period_id', periodId)
    .order('employee_name')
  if (opts?.employeeId) query = query.eq('employee_id', opts.employeeId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(toEntry)
}

export async function apiGetPayrollEntry(periodId: string, employeeId: string): Promise<PayrollEntry | null> {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('*')
    .eq('payroll_period_id', periodId)
    .eq('employee_id', employeeId)
    .single()
  if (error || !data) return null
  return toEntry(data)
}

// ─── Edit individual deductions on a payroll entry ───────────────────────────
// Available on DRAFT payrolls only.  Replaces the full otherDeductions array,
// then recalculates totalDeductions and netPay so the entry stays consistent.
// Also refreshes the period-level totals so the header KPIs stay accurate.
export async function apiUpdatePayrollEntryDeductions(
  periodId:   string,
  employeeId: string,
  deductions: { type: string; amount: number }[],
  by = 'System'
): Promise<PayrollEntry> {
  // 1. Guard: only allow edits on draft payrolls
  const period = await apiGetPayrollPeriod(periodId)
  if (!period) throw new Error('Payroll period not found.')
  if (period.status !== 'draft') {
    throw new Error(
      `Deductions can only be edited on a Draft payroll. ` +
      `This payroll is currently "${period.status}". ` +
      `Re-open it to Draft first if a correction is needed.`
    )
  }

  // 2. Fetch the current entry for its existing pay figures
  const entry = await apiGetPayrollEntry(periodId, employeeId)
  if (!entry) throw new Error('Payroll entry not found.')

  // 3. Recalculate totals
  //    Mandatory deductions (govt contributions, late, absence, undertime) are
  //    kept as-is — we only replace the otherDeductions bucket.
  const mandatoryTotal =
    entry.lateDeductions +
    entry.absenceDeductions +
    entry.undertimeDeductions +
    entry.sssEmployee +
    entry.philhealthEmployee +
    entry.pagibigEmployee +
    entry.withholdingTax
  const otherTotal     = deductions.reduce((s, d) => s + d.amount, 0)
  const totalDeductions = Math.round((mandatoryTotal + otherTotal) * 100) / 100
  const netPay          = Math.max(0, Math.round((entry.grossPay - totalDeductions) * 100) / 100)

  // 4. Persist the entry
  const { data: row, error } = await supabase
    .from('payroll_entries')
    .update({
      other_deductions: deductions,
      total_deductions: totalDeductions,
      net_pay:          netPay,
    })
    .eq('payroll_period_id', periodId)
    .eq('employee_id',       employeeId)
    .select()
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Failed to update deductions.')

  // 5. Refresh the period-level totals so header KPIs stay accurate
  const { data: allEntries } = await supabase
    .from('payroll_entries')
    .select('gross_pay, total_deductions, net_pay')
    .eq('payroll_period_id', periodId)
  if (allEntries) {
    const totGross = Math.round(allEntries.reduce((s, e) => s + (Number(e.gross_pay) || 0),        0) * 100) / 100
    const totDed   = Math.round(allEntries.reduce((s, e) => s + (Number(e.total_deductions) || 0), 0) * 100) / 100
    const totNet   = Math.round(allEntries.reduce((s, e) => s + (Number(e.net_pay) || 0),          0) * 100) / 100
    await supabase
      .from('payroll_periods')
      .update({ total_gross: totGross, total_deductions: totDed, total_net: totNet })
      .eq('id', periodId)
  }

  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Payroll',
    description:
      `Updated deductions for ${entry.employeeName} in ${period.periodNo}: ` +
      deductions.map(d => `${d.type} ₱${d.amount.toLocaleString()}`).join(', ') || '(cleared)',
    recordId: entry.id,
  })
  return toEntry(row)
}

export async function apiMarkEntryPaid(
  periodId: string,
  employeeId: string,
  by = 'System'
): Promise<PayrollEntry> {
  // Toggle: fetch current state first
  const current = await apiGetPayrollEntry(periodId, employeeId)
  if (!current) throw new Error('Payroll entry not found')
  const nowPaid = !current.markedPaid
  const now     = new Date().toISOString()

  const { data, error } = await supabase
    .from('payroll_entries')
    .update({
      marked_paid:    nowPaid,
      marked_paid_at: nowPaid ? now  : null,
      marked_paid_by: nowPaid ? by   : null,
    })
    .eq('payroll_period_id', periodId)
    .eq('employee_id', employeeId)
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to update entry')
  const entry = toEntry(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Payroll',
    description: `${nowPaid ? 'Marked' : 'Unmarked'} payroll entry for ${entry.employeeName} as paid`,
  })
  return entry
}

export async function apiDeletePayrollPeriod(id: string): Promise<void> {
  const period = await apiGetPayrollPeriod(id)
  if (!period) throw new Error('Payroll period not found.')

  // Block deletion of approved or paid payrolls — these are financial records.
  // Draft and reviewed periods can be deleted (no money has moved yet).
  if (period.status === 'approved' || period.status === 'paid') {
    throw new Error(
      `Cannot delete a payroll period with status "${period.status}". ` +
      'Only draft or reviewed payrolls can be deleted. ' +
      'If a correction is needed on an approved payroll, re-open it first.'
    )
  }

  // ── 1. Reverse advance repayments auto-created during generation ─────────────
  // Each repayment row carries payroll_period_id so we can find and undo them all.
  // Process: fetch → for each: subtract amount from total_repaid, restore status
  // if the advance was marked fully_paid → delete repayment row.
  const { data: repaymentRows } = await supabase
    .from('advance_repayments')
    .select('id, advance_id, amount')
    .eq('payroll_period_id', id)

  for (const rep of repaymentRows ?? []) {
    const repAmount = Number(rep.amount)
    if (!(repAmount > 0)) continue

    // Fetch the parent advance to compute updated totals
    const { data: adv } = await supabase
      .from('salary_advances')
      .select('amount, total_repaid, status')
      .eq('id', rep.advance_id)
      .single()

    if (adv) {
      const newTotal       = Math.max(0, Number(adv.total_repaid) - repAmount)
      const originalAmount = Number(adv.amount)
      // If the advance was marked fully_paid by this deduction, revert to released
      const newStatus      = newTotal < originalAmount ? 'released' : adv.status
      await supabase
        .from('salary_advances')
        .update({
          total_repaid: newTotal,
          status:       newStatus,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', rep.advance_id)
    }

    // Delete the repayment record
    await supabase.from('advance_repayments').delete().eq('id', rep.id)
  }

  // ── 2. Delete child entries first, then the period ────────────────────────────
  // Avoid .select() after delete — RLS may block re-reading a just-deleted row,
  // which would cause a false "not found" error even when the delete succeeded.
  const { error: entryErr } = await supabase
    .from('payroll_entries').delete().eq('payroll_period_id', id)
  if (entryErr) throw new Error(entryErr.message ?? 'Failed to delete payroll entries.')

  const { error } = await supabase.from('payroll_periods').delete().eq('id', id)
  if (error) throw new Error(error.message ?? 'Failed to delete payroll period.')

  const reversedCount = (repaymentRows ?? []).length
  await insertAudit({
    userId:      'sys',
    userName:    'System',
    action:      'delete',
    module:      'Payroll',
    description: `Deleted payroll period ${period.periodNo} (${period.startDate} – ${period.endDate})` +
                 (reversedCount > 0 ? ` — reversed ${reversedCount} advance repayment(s)` : ''),
  })
}

export async function apiGenerate13thMonth(
  year: number,
  createdBy = 'System'
): Promise<{ period: PayrollPeriod; entries: PayrollEntry[] }> {
  // 1. Guard: prevent duplicate 13th-month for same year
  const { data: existing } = await supabase
    .from('payroll_periods')
    .select('id, period_no')
    .eq('frequency', '13th-month' as PayFrequency)
    .gte('start_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new Error(`13th month pay for ${year} already exists (${(existing[0] as { period_no: string }).period_no}).`)
  }

  // 2. Fetch only APPROVED or PAID payroll entries for the year to sum basicPay per employee.
  //    Draft and reviewed payrolls must NOT be included — they may still change.
  //    Per PD 851, 13th month is 1/12 of total basic salary *actually received* during the year.
  //
  //    First: count any periods that are still in "reviewed" status — these would be excluded
  //    from the 13th month computation and HR should be warned before proceeding.
  const { data: reviewedPeriods } = await supabase
    .from('payroll_periods')
    .select('period_no, start_date')
    .eq('status', 'reviewed')
    .gte('start_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`)
    .neq('frequency', '13th-month')

  if (reviewedPeriods && reviewedPeriods.length > 0) {
    const periodList = (reviewedPeriods as { period_no: string; start_date: string }[])
      .map(p => p.period_no)
      .join(', ')
    throw new Error(
      `Cannot generate 13th Month Pay: ${reviewedPeriods.length} payroll period(s) for ${year} ` +
      `are still in "Reviewed" status and would be excluded from the computation, ` +
      `resulting in under-payment (violation of PD 851). ` +
      `Please approve or pay these periods first: ${periodList}.`
    )
  }

  const { data: entryRows, error: entryErr } = await supabase
    .from('payroll_entries')
    .select('employee_id, basic_pay, payroll_periods!inner(start_date, status, frequency)')
    .gte('payroll_periods.start_date', `${year}-01-01`)
    .lte('payroll_periods.start_date', `${year}-12-31`)
    .neq('payroll_periods.frequency', '13th-month')
    .in('payroll_periods.status', ['approved', 'paid'])
  if (entryErr) throw new Error(entryErr.message)

  // 3. Sum basicPay per employee
  const basicByEmp = new Map<string, number>()
  for (const row of entryRows ?? []) {
    const prev = basicByEmp.get(row.employee_id) ?? 0
    basicByEmp.set(row.employee_id, prev + (Number(row.basic_pay) || 0))
  }
  if (basicByEmp.size === 0) {
    throw new Error(`No approved payroll entries found for ${year}. Run and approve regular payrolls first.`)
  }

  // 4. Fetch active employees to get names
  const { data: empRows } = await supabase
    .from('employees')
    .select('id, employee_no, full_name, department, position, employment_type')
    .eq('status', 'active')

  // 5. Compute 13th month per employee
  const computedEntries: Record<string, unknown>[] = []
  for (const emp of empRows ?? []) {
    const annualBasic = basicByEmp.get(emp.id) ?? 0
    if (annualBasic <= 0) continue
    const thirteenthAmount = Math.round((annualBasic / 12) * 100) / 100
    computedEntries.push({
      employee_id:    emp.id,
      employee_name:  emp.full_name,
      employee_no:    emp.employee_no,
      position:       emp.position ?? '',
      department:     emp.department ?? '',
      employment_type: emp.employment_type ?? 'regular',
      scheduled_days: 0, present_days: 0, absent_days: 0, late_days: 0,
      half_days: 0, leave_days: 0, overtime_hours: 0, night_diff_hours: 0,
      regular_holiday_days: 0, special_holiday_days: 0,
      basic_pay:        thirteenthAmount,
      overtime_pay:     0, regular_holiday_pay: 0, special_holiday_pay: 0,
      night_differential: 0, allowances: [],
      gross_pay:        thirteenthAmount,
      late_deductions:  0, absence_deductions: 0, undertime_deductions: 0,
      sss_employee:     0, philhealth_employee: 0, pagibig_employee: 0,
      withholding_tax:  0, other_deductions: [], total_deductions: 0,
      sss_employer:     0, philhealth_employer: 0, pagibig_employer: 0,
      net_pay:          thirteenthAmount,
    })
  }

  const totalNet = Math.round(computedEntries.reduce((s, e) => s + (e.net_pay as number), 0) * 100) / 100

  // 6. Get next period number
  const { data: seqData } = await supabase.rpc('next_period_no')
  const periodNo = (seqData as string | null) ?? `13TH-${year}`

  // 7. Insert period
  const { data: periodRow, error: pErr } = await supabase
    .from('payroll_periods')
    .insert({
      period_no:        periodNo,
      start_date:       `${year}-12-01`,
      end_date:         `${year}-12-24`,
      pay_date:         `${year}-12-24`,
      frequency:        '13th-month' as PayFrequency,
      status:           'draft',
      total_employees:  computedEntries.length,
      total_gross:      totalNet,
      total_deductions: 0,
      total_net:        totalNet,
      created_by:       createdBy,
      notes:            `13th Month Pay for ${year} — PD 851 compliance`,
    })
    .select()
    .single()
  if (pErr || !periodRow) throw new Error(pErr?.message ?? 'Failed to create 13th month period')
  const period = toPeriod(periodRow)

  // 8. Insert entries
  const entryInsertRows = computedEntries.map(e => ({
    ...e,
    payroll_period_id: period.id,
  }))
  const { data: insertedEntries, error: eErr } = await supabase
    .from('payroll_entries').insert(entryInsertRows).select()
  if (eErr) throw new Error(eErr.message)

  await insertAudit({
    userId: 'sys', userName: createdBy, action: 'generate', module: 'Payroll',
    description: `Generated 13th Month Pay ${periodNo} for ${year} (${computedEntries.length} employees, ₱${totalNet.toLocaleString('en-PH', { minimumFractionDigits: 2 })})`,
  })
  return { period, entries: (insertedEntries ?? []).map(toEntry) }
}

export async function apiPayrollSummaryByMonth(): Promise<
  { month: string; gross: number; deductions: number; net: number }[]
> {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('start_date, total_gross, total_deductions, total_net')
    .order('start_date')
  if (error) throw new Error(error.message)
  const map: Record<string, { gross: number; deductions: number; net: number }> = {}
  for (const p of data ?? []) {
    const m = (p.start_date as string).slice(0, 7)
    if (!map[m]) map[m] = { gross: 0, deductions: 0, net: 0 }
    map[m].gross      += Number(p.total_gross)       || 0
    map[m].deductions += Number(p.total_deductions)  || 0
    map[m].net        += Number(p.total_net)         || 0
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }))
}

// ── Batch payroll status update ───────────────────────────────────────────────
// Each period runs through apiUpdatePayrollStatus so maker-checker logic still fires.
export async function apiBatchUpdatePayrollStatus(
  ids:    string[],
  status: PayrollStatus,
  by = 'System',
): Promise<{ ok: number; fail: number }> {
  if (!ids.length) return { ok: 0, fail: 0 }
  const results = await Promise.allSettled(
    ids.map(id => apiUpdatePayrollStatus(id, status, by))
  )
  const ok   = results.filter(r => r.status === 'fulfilled').length
  const fail = results.filter(r => r.status === 'rejected').length
  return { ok, fail }
}
