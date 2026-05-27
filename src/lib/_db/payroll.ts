// ─── Payroll ──────────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import { computePayrollEntry, countWorkingDays, DEFAULT_DEDUCTION_SETTINGS } from '../payrollEngine'
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
    present_days:        e.presentDays,
    absent_days:         e.absentDays,
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
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetPayrollPeriods(): Promise<PayrollPeriod[]> {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw error
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

  // 2. Fetch active employees
  const { data: empRows } = await supabase
    .from('employees')
    .select('*')
    .eq('status', 'active')
  const employees: Employee[] = (empRows ?? []).map((r) => ({
    id: r.id, employeeNo: r.employee_no, firstName: r.first_name, lastName: r.last_name,
    middleName: r.middle_name ?? '', fullName: r.full_name, email: r.email, phone: r.phone ?? '',
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
    emergencyContactName: r.emergency_contact_name ?? '', emergencyContactPhone: r.emergency_contact_phone ?? '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  }))

  if (employees.length === 0) {
    throw new Error('No active employees found. Add at least one active employee before generating payroll.')
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

  const periodDays = countWorkingDays(input.startDate, input.endDate)

  // 5. Compute entries
  const computedEntries: PayrollEntry[] = []
  for (const emp of employees) {
    const { data: attRows } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', emp.id)
      .gte('date', input.startDate)
      .lte('date', input.endDate)
      .neq('status', 'rest-day')
    const attRecs: AttendanceRecord[] = (attRows ?? []).map((r) => ({
      id: r.id, employeeId: r.employee_id, employeeName: r.employee_name ?? '',
      employeeNo: r.employee_no ?? '', department: r.department ?? undefined,
      date: r.date, timeIn: r.time_in ?? undefined, timeOut: r.time_out ?? undefined,
      status: r.status, minutesLate: r.minutes_late ?? 0,
      overtimeMinutes: r.overtime_minutes ?? 0, nightDiffMinutes: r.night_diff_minutes ?? 0,
      undertimeMinutes: r.undertime_minutes ?? 0,
      source: r.source ?? 'kiosk',
    }))

    const entry = computePayrollEntry({
      employee: emp, attendanceRecords: attRecs, holidays, periodDays,
      payrollPeriodId: 'tmp', deductionSettings,
    })
    computedEntries.push(entry)
  }

  const totalGross      = Math.round(computedEntries.reduce((s, e) => s + e.grossPay,        0) * 100) / 100
  const totalDeductions = Math.round(computedEntries.reduce((s, e) => s + e.totalDeductions, 0) * 100) / 100
  const totalNet        = Math.round(computedEntries.reduce((s, e) => s + e.netPay,          0) * 100) / 100

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
  if (pErr || !periodRow) throw pErr ?? new Error('Failed to create payroll period')
  const period = toPeriod(periodRow)

  // 7. Insert entries with real period id
  const entryRows = computedEntries.map((e) => fromEntry({ ...e, payrollPeriodId: period.id }))
  const { data: insertedEntries, error: eErr } = await supabase
    .from('payroll_entries')
    .insert(entryRows)
    .select()
  if (eErr) throw eErr

  const entries = (insertedEntries ?? []).map(toEntry)

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
  const now   = new Date().toISOString()
  const patch: Record<string, unknown> = { status }
  if (status === 'reviewed') { patch.reviewed_by = by; patch.reviewed_at = now }
  if (status === 'approved') { patch.approved_by = by; patch.approved_at = now }
  if (status === 'paid')     { patch.paid_at = now }

  const { data, error } = await supabase
    .from('payroll_periods').update(patch).eq('id', id).select().single()
  if (error || !data) throw error ?? new Error('Payroll period not found')
  const period = toPeriod(data)
  await insertAudit({
    userId: 'sys', userName: by, action: status === 'approved' ? 'approve' : 'update',
    module: 'Payroll', description: `Payroll ${period.periodNo} status changed to ${status}`,
  })
  return period
}

export async function apiGetPayrollEntries(periodId: string): Promise<PayrollEntry[]> {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('*')
    .eq('payroll_period_id', periodId)
    .order('employee_name')
  if (error) throw error
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
  if (error || !data) throw error ?? new Error('Failed to update entry')
  const entry = toEntry(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Payroll',
    description: `${nowPaid ? 'Marked' : 'Unmarked'} payroll entry for ${entry.employeeName} as paid`,
  })
  return entry
}

export async function apiPayrollSummaryByMonth(): Promise<
  { month: string; gross: number; deductions: number; net: number }[]
> {
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('start_date, total_gross, total_deductions, total_net')
    .order('start_date')
  if (error) throw error
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
