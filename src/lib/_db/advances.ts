// ─── Salary Advances ──────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import type { SalaryAdvance, AdvanceRepayment, AdvanceStatus, RepaymentType, DeductionType } from '../../types'

// ── Deduction storage helper ──────────────────────────────────────────────────
// The `monthly_deduction` column stores different values depending on type:
//   'monthly'      → the monthly budget amount (payroll divides by periodDivisor)
//   'per_period'   → the per-payroll-run amount (payroll uses as-is)
//   'installments' → amount / installmentCount  (payroll uses as-is)
//
// This function returns the value that should be stored in `monthly_deduction`.
function computeStoredDeduction(
  inputValue:      number | undefined,
  deductionType:   DeductionType,
  installmentCount: number | null,
  advanceAmount?:  number | null,
): number | null {
  if (!inputValue && deductionType !== 'installments') return null
  if (deductionType === 'installments') {
    if (!installmentCount || installmentCount <= 0) return null
    const base = advanceAmount ?? inputValue ?? 0
    return Math.round((base / installmentCount) * 100) / 100
  }
  // 'monthly' or 'per_period' — store the entered value directly
  return inputValue ?? null
}

// ── Mappers ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAdvance(r: any): SalaryAdvance {
  return {
    id:               r.id,
    employeeId:       r.employee_id,
    employeeName:     r.employee_name  ?? r.employees?.full_name   ?? undefined,
    employeeNo:       r.employee_no    ?? r.employees?.employee_no ?? undefined,
    department:       r.department     ?? r.employees?.department  ?? undefined,
    amount:           Number(r.amount)          || 0,
    purpose:          r.purpose        ?? undefined,
    status:           r.status         as AdvanceStatus,
    requestedAt:      r.requested_at,
    approvedBy:       r.approved_by    ?? undefined,
    approvedAt:       r.approved_at    ?? undefined,
    releasedAt:       r.released_at    ?? undefined,
    releaseNotes:     r.release_notes  ?? undefined,
    rejectionReason:  r.rejection_reason ?? undefined,
    repaymentStart:   r.repayment_start  ?? undefined,
    monthlyDeduction: r.monthly_deduction ? Number(r.monthly_deduction) : undefined,
    deductionType:    (r.deduction_type   ?? 'monthly') as DeductionType,
    installmentCount: r.installment_count ?? undefined,
    totalRepaid:      Number(r.total_repaid) || 0,
    outstanding:      Number(r.outstanding)  || 0,
    notes:            r.notes          ?? undefined,
    createdBy:        r.created_by     ?? undefined,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
    // ── Suspension ──────────────────────────────────────────────────────────
    isSuspended:       r.is_suspended       ?? false,
    suspensionReason:  r.suspension_reason  ?? undefined,
    suspendedBy:       r.suspended_by       ?? undefined,
    suspendedAt:       r.suspended_at       ?? undefined,
    // ── Cancellation ────────────────────────────────────────────────────────
    cancelledBy:        r.cancelled_by        ?? undefined,
    cancelledAt:        r.cancelled_at        ?? undefined,
    cancellationReason: r.cancellation_reason ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRepayment(r: any): AdvanceRepayment {
  return {
    id:              r.id,
    advanceId:       r.advance_id,
    payrollPeriodId: r.payroll_period_id ?? undefined,
    amount:          Number(r.amount) || 0,
    type:            (r.type ?? 'manual') as RepaymentType,
    notes:           r.notes       ?? undefined,
    recordedBy:      r.recorded_by ?? undefined,
    paidAt:          r.paid_at,
  }
}

// ── Shared employee join columns ──────────────────────────────────────────────
const ADVANCE_SELECT = '*, employees!inner(full_name, employee_no, department)'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withJoined(data: any): SalaryAdvance {
  return {
    ...toAdvance(data),
    employeeName: data.employees?.full_name   ?? '',
    employeeNo:   data.employees?.employee_no ?? '',
    department:   data.employees?.department  ?? '',
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetAdvances(p?: {
  employeeId?: string
  status?:     AdvanceStatus | 'all'
}): Promise<SalaryAdvance[]> {
  let query = supabase
    .from('salary_advances')
    .select(ADVANCE_SELECT)
    .order('requested_at', { ascending: false })

  if (p?.employeeId) query = query.eq('employee_id', p.employeeId)
  if (p?.status && p.status !== 'all') query = query.eq('status', p.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(withJoined)
}

export async function apiGetAdvance(id: string): Promise<SalaryAdvance | null> {
  const { data, error } = await supabase
    .from('salary_advances')
    .select(ADVANCE_SELECT)
    .eq('id', id)
    .single()
  if (error || !data) return null
  return withJoined(data)
}

export async function apiCreateAdvance(
  input: {
    employeeId:        string
    amount:            number
    purpose?:          string
    notes?:            string
    /** Raw value entered by HR — meaning depends on deductionType. */
    monthlyDeduction?: number
    deductionType?:    DeductionType
    installmentCount?: number
    repaymentStart?:   string
  },
  by = 'System'
): Promise<SalaryAdvance> {
  // Compute the stored per-period amount based on deduction type:
  //   'monthly'      → store as-is; payroll generator will divide by periodDivisor
  //   'per_period'   → store as-is; payroll generator uses without division
  //   'installments' → store amount / installmentCount; payroll uses without division
  const deductionType    = input.deductionType    ?? 'monthly'
  const installmentCount = input.installmentCount ?? null
  const storedDeduction  = computeStoredDeduction(
    input.monthlyDeduction, deductionType, installmentCount, input.amount
  )

  const { data, error } = await supabase
    .from('salary_advances')
    .insert({
      employee_id:       input.employeeId,
      amount:            input.amount,
      purpose:           input.purpose    ?? null,
      notes:             input.notes      ?? null,
      monthly_deduction: storedDeduction,
      deduction_type:    deductionType,
      installment_count: installmentCount,
      repayment_start:   input.repaymentStart ?? null,
      status:            'pending',
      created_by:        by,
    })
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to create advance request')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'create', module: 'Salary Advance',
    description: `Advance request of ₱${input.amount.toLocaleString()} for ${adv.employeeName}`,
    recordId: adv.id,
  })
  return adv
}

export async function apiUpdateAdvanceStatus(
  id:     string,
  status: Exclude<AdvanceStatus, 'pending'>,
  by:     string,
  opts?: {
    releaseNotes?:     string
    rejectionReason?:  string
    repaymentStart?:   string
    monthlyDeduction?: number
    deductionType?:    DeductionType
    installmentCount?: number
    /** Full advance amount — needed to compute installment per-period amount. */
    advanceAmount?:    number
  }
): Promise<SalaryAdvance> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status, updated_at: now }

  if (status === 'approved') {
    patch.approved_by = by
    patch.approved_at = now
  }
  if (status === 'released') {
    patch.released_at   = now
    patch.release_notes = opts?.releaseNotes ?? null
    if (opts?.repaymentStart) patch.repayment_start = opts.repaymentStart

    if (opts?.monthlyDeduction !== undefined) {
      const dtype = opts.deductionType    ?? 'monthly'
      const icount = opts.installmentCount ?? null
      patch.monthly_deduction = computeStoredDeduction(
        opts.monthlyDeduction, dtype, icount, opts.advanceAmount
      )
      patch.deduction_type    = dtype
      patch.installment_count = icount
    }
  }
  if (status === 'rejected') {
    patch.rejection_reason = opts?.rejectionReason ?? null
  }

  const { data, error } = await supabase
    .from('salary_advances')
    .update(patch)
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Advance not found')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by,
    action: status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'update',
    module: 'Salary Advance',
    description: `Advance for ${adv.employeeName} status → ${status}`,
    recordId: id,
  })
  return adv
}

// ── Cancel a pending or approved advance ──────────────────────────────────────
// Once an advance is released the employee has received the cash. Use
// apiWriteOffAdvance() instead to forgive the remaining balance.
export async function apiCancelAdvance(
  id:     string,
  reason: string,
  by:     string,
): Promise<SalaryAdvance> {
  const { data: current } = await supabase
    .from('salary_advances')
    .select('status, employee_id, amount, employees!inner(full_name)')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Advance not found.')
  if (current.status === 'released' || current.status === 'fully_paid') {
    throw new Error(
      'This advance has already been released. Use "Write Off" to forgive the outstanding balance instead.'
    )
  }
  if (current.status === 'cancelled' || current.status === 'rejected') {
    throw new Error(`Advance is already ${current.status}.`)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('salary_advances')
    .update({
      status:              'cancelled',
      cancelled_by:        by,
      cancelled_at:        now,
      cancellation_reason: reason,
      updated_at:          now,
    })
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to cancel advance')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Salary Advance',
    description: `Cancelled advance for ${adv.employeeName} — ${reason}`,
    recordId: id,
  })
  return adv
}

// ── Write off a released advance ──────────────────────────────────────────────
// Forgives the remaining outstanding balance. Marks the advance as written_off
// and zeroes future payroll deductions. Records a reversal entry so the history
// shows exactly what was forgiven.
export async function apiWriteOffAdvance(
  id:     string,
  reason: string,
  by:     string,
): Promise<SalaryAdvance> {
  const { data: current } = await supabase
    .from('salary_advances')
    .select('status, amount, total_repaid, outstanding, employees!inner(full_name)')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Advance not found.')
  if (current.status !== 'released') {
    throw new Error(
      `Only released advances can be written off. This advance is "${current.status}".`
    )
  }

  const outstanding = Number(current.outstanding) || 0
  if (outstanding <= 0) throw new Error('This advance has no outstanding balance to write off.')

  const now = new Date().toISOString()

  // Record a reversal entry so the history panel shows the write-off amount
  await supabase.from('advance_repayments').insert({
    advance_id:  id,
    amount:      outstanding,
    type:        'reversal',
    notes:       `Write-off: ${reason}`,
    recorded_by: by,
    paid_at:     now,
  })

  // Zero out the outstanding by advancing total_repaid to equal amount
  const { data, error } = await supabase
    .from('salary_advances')
    .update({
      status:       'written_off',
      total_repaid: Number(current.amount),   // outstanding → 0
      updated_at:   now,
    })
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to write off advance')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Salary Advance',
    description:
      `Written off ₱${outstanding.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ` +
      `outstanding balance for ${adv.employeeName} — ${reason}`,
    recordId: id,
  })
  return adv
}

// ── Suspend / resume automatic payroll deductions ─────────────────────────────
// While suspended, the advance is excluded from the payroll deduction batch.
// The outstanding balance remains; deductions resume when un-suspended.
export async function apiSuspendAdvance(
  id:     string,
  reason: string,
  by:     string,
): Promise<SalaryAdvance> {
  const { data: current } = await supabase
    .from('salary_advances')
    .select('status, is_suspended, employees!inner(full_name)')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Advance not found.')
  if (current.status !== 'released') {
    throw new Error('Only released advances can be suspended.')
  }
  if (current.is_suspended) throw new Error('This advance is already suspended.')

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('salary_advances')
    .update({
      is_suspended:      true,
      suspension_reason: reason,
      suspended_by:      by,
      suspended_at:      now,
      updated_at:        now,
    })
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to suspend advance')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Salary Advance',
    description: `Suspended deductions for ${adv.employeeName}'s advance — ${reason}`,
    recordId: id,
  })
  return adv
}

export async function apiResumeAdvance(
  id: string,
  by: string,
): Promise<SalaryAdvance> {
  const { data: current } = await supabase
    .from('salary_advances')
    .select('is_suspended, employees!inner(full_name)')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Advance not found.')
  if (!current.is_suspended) throw new Error('This advance is not suspended.')

  const { data, error } = await supabase
    .from('salary_advances')
    .update({
      is_suspended:      false,
      suspension_reason: null,
      suspended_by:      null,
      suspended_at:      null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to resume advance')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Salary Advance',
    description: `Resumed deductions for ${adv.employeeName}'s advance`,
    recordId: id,
  })
  return adv
}

// ── Edit the deduction setup on a released advance ────────────────────────────
// Use when an employee's repayment arrangement is renegotiated.
export async function apiUpdateAdvanceDeduction(
  id:               string,
  /** Raw value entered by HR — meaning depends on deductionType. */
  deductionValue:   number,
  by:               string,
  deductionType:    DeductionType = 'monthly',
  installmentCount?: number,
): Promise<SalaryAdvance> {
  if (deductionValue <= 0) throw new Error('Deduction amount must be greater than ₱0.')

  const { data: current } = await supabase
    .from('salary_advances')
    .select('status, outstanding, amount, employees!inner(full_name)')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Advance not found.')
  if (current.status !== 'released') {
    throw new Error('Deduction setup can only be changed on released advances.')
  }

  // For installments when EDITING, base the per-period slice on the *outstanding*
  // balance — not the original amount — because some has already been repaid.
  // (On create/release we use the full amount since nothing has been repaid yet.)
  const baseAmount = deductionType === 'installments'
    ? Number(current.outstanding)
    : Number(current.amount)
  const storedDeduction = computeStoredDeduction(
    deductionValue, deductionType, installmentCount ?? null, baseAmount
  )

  // For per_period / installments the stored value IS the per-period amount —
  // validate it doesn't exceed the outstanding balance.
  if (deductionType !== 'monthly' && storedDeduction > Number(current.outstanding)) {
    throw new Error(
      `Per-period deduction (₱${storedDeduction.toLocaleString()}) exceeds outstanding balance ` +
      `(₱${Number(current.outstanding).toLocaleString()}). ` +
      'Reduce the amount or number of installments.'
    )
  }

  const { data, error } = await supabase
    .from('salary_advances')
    .update({
      monthly_deduction: storedDeduction,
      deduction_type:    deductionType,
      installment_count: installmentCount ?? null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to update deduction setup')
  const adv = withJoined(data)
  const typeLabel =
    deductionType === 'monthly'      ? `₱${deductionValue.toLocaleString('en-PH')}/month`
    : deductionType === 'per_period' ? `₱${storedDeduction.toLocaleString('en-PH')}/period`
    : `${installmentCount} installments of ₱${storedDeduction.toLocaleString('en-PH')}`
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Salary Advance',
    description: `Updated deduction setup for ${adv.employeeName}'s advance → ${typeLabel}`,
    recordId: id,
  })
  return adv
}

// ── Balance correction / adjustment ───────────────────────────────────────────
// Used to correct the recorded balance when a manual payment was missed (positive
// adjustment), or to reverse an over-deduction (negative adjustment).
//
//   adjustmentAmount > 0  →  reduces outstanding (employee paid cash outside system)
//   adjustmentAmount < 0  →  increases outstanding (previous deduction was reversed)
//
// Cannot make outstanding go negative (over-credit) or reduce below zero.
export async function apiAdjustAdvanceBalance(
  id:               string,
  adjustmentAmount: number,   // signed
  reason:           string,
  by:               string,
): Promise<SalaryAdvance> {
  if (adjustmentAmount === 0) throw new Error('Adjustment amount cannot be zero.')
  if (!reason.trim()) throw new Error('A reason is required for balance adjustments.')

  const { data: current } = await supabase
    .from('salary_advances')
    .select('status, total_repaid, outstanding, amount, employees!inner(full_name)')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Advance not found.')
  if (current.status !== 'released') {
    throw new Error('Balance adjustments can only be made on released advances.')
  }

  const newTotalRepaid = Number(current.total_repaid) + adjustmentAmount
  const newOutstanding = Number(current.amount) - newTotalRepaid

  if (newTotalRepaid < 0) {
    throw new Error(
      `Adjustment of ₱${Math.abs(adjustmentAmount).toLocaleString()} would make total repaid negative. ` +
      `Maximum negative adjustment is ₱${Number(current.total_repaid).toLocaleString()}.`
    )
  }
  if (newOutstanding < 0) {
    throw new Error(
      `Adjustment of ₱${adjustmentAmount.toLocaleString()} exceeds the outstanding balance ` +
      `(₱${Number(current.outstanding).toLocaleString()}). ` +
      'Reduce the adjustment amount or use Write Off to forgive the full balance.'
    )
  }

  const now = new Date().toISOString()
  const isFullyPaid = newOutstanding <= 0

  // Record the signed adjustment in repayment history
  const { error: repErr } = await supabase.from('advance_repayments').insert({
    advance_id:  id,
    amount:      adjustmentAmount,
    type:        'adjustment',
    notes:       reason,
    recorded_by: by,
    paid_at:     now,
  })
  if (repErr) throw repErr

  const { data, error } = await supabase
    .from('salary_advances')
    .update({
      total_repaid: newTotalRepaid,
      status:       isFullyPaid ? 'fully_paid' : 'released',
      updated_at:   now,
    })
    .eq('id', id)
    .select(ADVANCE_SELECT)
    .single()
  if (error || !data) throw error ?? new Error('Failed to apply adjustment')
  const adv = withJoined(data)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Salary Advance',
    description:
      `Balance adjustment of ${adjustmentAmount >= 0 ? '+' : ''}` +
      `₱${adjustmentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ` +
      `on ${adv.employeeName}'s advance — ${reason}`,
    recordId: id,
  })
  return adv
}

// ── Record a manual repayment (cash, bank transfer, etc.) ─────────────────────
export async function apiRecordRepayment(
  advanceId: string,
  amount:    number,
  opts?: {
    payrollPeriodId?: string
    notes?:           string
    recordedBy?:      string
    type?:            RepaymentType
  }
): Promise<AdvanceRepayment> {
  if (amount <= 0) throw new Error('Repayment amount must be greater than zero.')

  // Validate against outstanding balance
  const { data: adv } = await supabase
    .from('salary_advances')
    .select('amount, total_repaid, outstanding')
    .eq('id', advanceId)
    .single()

  if (!adv) throw new Error('Advance not found.')
  if (amount > Number(adv.outstanding)) {
    throw new Error(
      `Repayment of ₱${amount.toLocaleString()} exceeds outstanding balance ` +
      `(₱${Number(adv.outstanding).toLocaleString()}).`
    )
  }

  const now = new Date().toISOString()
  const repType: RepaymentType = opts?.type ?? (opts?.payrollPeriodId ? 'payroll' : 'manual')

  const { data: repRow, error: repErr } = await supabase
    .from('advance_repayments')
    .insert({
      advance_id:        advanceId,
      payroll_period_id: opts?.payrollPeriodId ?? null,
      amount,
      type:              repType,
      notes:             opts?.notes      ?? null,
      recorded_by:       opts?.recordedBy ?? null,
      paid_at:           now,
    })
    .select()
    .single()
  if (repErr || !repRow) throw repErr ?? new Error('Failed to record repayment')

  const newTotal    = Number(adv.total_repaid) + amount
  const fullyPaid   = newTotal >= Number(adv.amount)

  await supabase
    .from('salary_advances')
    .update({
      total_repaid: newTotal,
      status:       fullyPaid ? 'fully_paid' : 'released',
      updated_at:   now,
    })
    .eq('id', advanceId)

  await insertAudit({
    userId: 'sys', userName: opts?.recordedBy ?? 'System',
    action: 'update', module: 'Salary Advance',
    description: `Repayment of ₱${amount.toLocaleString()} (${repType}) recorded for advance ${advanceId}`,
    recordId: advanceId,
  })
  return toRepayment(repRow)
}

export async function apiGetRepayments(advanceId: string): Promise<AdvanceRepayment[]> {
  const { data, error } = await supabase
    .from('advance_repayments')
    .select('*')
    .eq('advance_id', advanceId)
    .order('paid_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toRepayment)
}

// ── Batch advance status update ───────────────────────────────────────────────
export async function apiBatchUpdateAdvanceStatus(
  ids:    string[],
  status: Exclude<AdvanceStatus, 'pending'>,
  by:     string,
): Promise<{ ok: number; fail: number }> {
  if (!ids.length) return { ok: 0, fail: 0 }
  const results = await Promise.allSettled(
    ids.map(id => apiUpdateAdvanceStatus(id, status, by))
  )
  const ok   = results.filter(r => r.status === 'fulfilled').length
  const fail = results.filter(r => r.status === 'rejected').length
  return { ok, fail }
}

// ── Used during payroll generation: active monthly deductions per employee ────
// Excludes suspended advances — suspended means "skip this period".
export async function getActiveAdvanceDeductions(employeeId: string): Promise<{ advanceId: string; amount: number }[]> {
  const { data } = await supabase
    .from('salary_advances')
    .select('id, monthly_deduction, outstanding')
    .eq('employee_id', employeeId)
    .eq('status', 'released')
    .eq('is_suspended', false)
    .gt('outstanding', 0)

  return (data ?? [])
    .filter(a => a.monthly_deduction && a.monthly_deduction > 0)
    .map(a => ({
      advanceId: a.id as string,
      amount:    Math.min(Number(a.monthly_deduction), Number(a.outstanding)),
    }))
}
