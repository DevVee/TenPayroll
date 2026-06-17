// ─── Leave Requests ───────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import type { LeaveRequest, LeaveStatus } from '../../types'

// ── Mapper ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLeave(r: any): LeaveRequest {
  return {
    id:              r.id,
    employeeId:      r.employee_id,
    employeeName:    r.employee_name   ?? '',
    employeeNo:      r.employee_no     ?? undefined,
    leaveType:       r.leave_type,
    startDate:       r.start_date,
    endDate:         r.end_date,
    days:            r.days            ?? 1,
    reason:          r.reason          ?? '',
    status:          r.status          as LeaveStatus,
    reviewedBy:      r.reviewed_by     ?? undefined,
    approvedBy:      r.reviewed_by     ?? undefined,   // alias
    reviewedAt:      r.reviewed_at     ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
    createdAt:       r.created_at,
    filedAt:         r.created_at      ?? undefined,   // alias
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetLeaves(p?: {
  employeeId?: string
  status?:     string
}): Promise<LeaveRequest[]> {
  let query = supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (p?.employeeId) query = query.eq('employee_id', p.employeeId)
  if (p?.status && p.status !== 'all') query = query.eq('status', p.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toLeave)
}

export async function apiCreateLeave(
  data: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>,
  by = 'System'
): Promise<LeaveRequest> {
  const { data: row, error } = await supabase
    .from('leave_requests')
    .insert({
      employee_id:   data.employeeId,
      employee_name: data.employeeName,
      employee_no:   data.employeeNo ?? null,
      leave_type:    data.leaveType,
      start_date:    data.startDate,
      end_date:      data.endDate,
      days:          data.days,
      reason:        data.reason,
      status:        'pending',
    })
    .select()
    .single()
  if (error || !row) throw error ?? new Error('Failed to create leave request')
  const leave = toLeave(row)
  await insertAudit({
    userId: 'sys', userName: by,
    action: 'create', module: 'Leaves',
    description: `Leave request filed for ${leave.employeeName}: ${leave.leaveType} (${leave.startDate} – ${leave.endDate}, ${leave.days} day${leave.days !== 1 ? 's' : ''})`,
    recordId: leave.id,
  })
  return leave
}

export async function apiUpdateLeaveStatus(
  id:     string,
  status: LeaveStatus,
  by?:    string,
  reason?: string
): Promise<LeaveRequest> {
  // Fetch the current leave request so we know its previous status and details
  const { data: req } = await supabase
    .from('leave_requests')
    .select('employee_id, leave_type, days, status, start_date, end_date')
    .eq('id', id)
    .single()

  // ── Guard: check leave balance before approving ───────────────────────────
  if (status === 'approved') {
    if (req && req.leave_type !== 'unpaid') {
      if (req.leave_type === 'sil') {
        // SIL balance is tracked in leave_accruals (entitled - used = remaining)
        const silYear = new Date(req.start_date).getFullYear()
        const { data: acc } = await supabase
          .from('leave_accruals')
          .select('entitled, used')
          .eq('employee_id', req.employee_id)
          .eq('leave_type', 'sil')
          .eq('year', silYear)
          .maybeSingle()

        if (acc !== null && acc !== undefined) {
          const remaining = Number(acc.entitled) - Number(acc.used)
          if (remaining < Number(req.days)) {
            throw new Error(
              `Insufficient SIL balance — ` +
              `${remaining} day(s) available, ${req.days} day(s) requested. ` +
              `Unused SIL is convertible to cash at year-end.`
            )
          }
          await supabase
            .from('leave_accruals')
            .update({ used: Number(acc.used) + Number(req.days), updated_at: new Date().toISOString() })
            .eq('employee_id', req.employee_id)
            .eq('leave_type', 'sil')
            .eq('year', silYear)
        }
        // No accrual record → employee may not have been accrued yet; allow with no deduction
      } else {
        // Existing JSONB leave_balances check for vacation / sick / emergency / etc.
        const { data: bal } = await supabase
          .from('leave_balances')
          .select('balance')
          .eq('employee_id', req.employee_id)
          .eq('leave_type', req.leave_type)
          .maybeSingle()

        if (bal !== null && bal !== undefined && Number(bal.balance) < Number(req.days)) {
          throw new Error(
            `Insufficient ${req.leave_type} leave balance — ` +
            `${bal.balance} day(s) available, ${req.days} day(s) requested.`
          )
        }
        if (bal !== null && bal !== undefined) {
          await supabase
            .from('leave_balances')
            .update({ balance: Math.max(0, Number(bal.balance) - Number(req.days)) })
            .eq('employee_id', req.employee_id)
            .eq('leave_type', req.leave_type)
        }
      }
    }
  }

  // ── Restore balance when rejecting a previously-approved leave ───────────
  // Without this, approving then rejecting a leave permanently deducts the
  // balance even though the employee never took the days.
  if (status === 'rejected' && req?.status === 'approved' && req.leave_type !== 'unpaid') {
    if (req.leave_type === 'sil') {
      // Reverse SIL deduction in leave_accruals
      const silYear = new Date(req.start_date).getFullYear()
      const { data: acc } = await supabase
        .from('leave_accruals')
        .select('used')
        .eq('employee_id', req.employee_id)
        .eq('leave_type', 'sil')
        .eq('year', silYear)
        .maybeSingle()

      if (acc !== null && acc !== undefined) {
        await supabase
          .from('leave_accruals')
          .update({ used: Math.max(0, Number(acc.used) - Number(req.days)), updated_at: new Date().toISOString() })
          .eq('employee_id', req.employee_id)
          .eq('leave_type', 'sil')
          .eq('year', silYear)
      }
    } else {
      // Restore JSONB leave_balances for other types
      const { data: bal } = await supabase
        .from('leave_balances')
        .select('balance')
        .eq('employee_id', req.employee_id)
        .eq('leave_type', req.leave_type)
        .maybeSingle()

      if (bal !== null && bal !== undefined) {
        await supabase
          .from('leave_balances')
          .update({ balance: Number(bal.balance) + Number(req.days) })
          .eq('employee_id', req.employee_id)
          .eq('leave_type', req.leave_type)
      }
    }

    // Also reverse the attendance records that were auto-created on approval
    if (req.start_date && req.end_date) {
      await supabase
        .from('attendance_records')
        .delete()
        .eq('employee_id', req.employee_id)
        .eq('status', 'on-leave')
        .gte('date', req.start_date)
        .lte('date', req.end_date)
    }
  }

  const patch: Record<string, unknown> = {
    status,
    reviewed_by:      by ?? null,
    reviewed_at:      new Date().toISOString(),
    rejection_reason: reason ?? null,
  }
  const { data: row, error } = await supabase
    .from('leave_requests').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Leave request not found')
  const leave = toLeave(row)

  await insertAudit({
    userId: 'sys', userName: by ?? 'System',
    action: status === 'approved' ? 'approve' : 'reject',
    module: 'Leaves',
    description: `${status === 'approved' ? 'Approved' : 'Rejected'} leave for ${leave.employeeName}`,
  })

  // Auto-create attendance records for each approved leave day
  if (status === 'approved') {
    const d = new Date(leave.startDate)
    const end = new Date(leave.endDate)
    while (d <= end) {
      const dateStr = d.toISOString().split('T')[0]
      // Only insert if no record already exists for that day
      await supabase.from('attendance_records').upsert({
        employee_id:    leave.employeeId,
        employee_name:  leave.employeeName,
        employee_no:    leave.employeeNo ?? '',
        date:           dateStr,
        status:         'on-leave',
        minutes_late:   0,
        overtime_minutes: 0,
        night_diff_minutes: 0,
        source:         'manual',
        note:           `${leave.leaveType} leave`,
      }, { onConflict: 'employee_id,date', ignoreDuplicates: true })
      d.setDate(d.getDate() + 1)
    }
  }

  return leave
}

// ── Batch status update ───────────────────────────────────────────────────────
// For REJECT of pending leaves no balance side-effects are needed so we use a
// bulk UPDATE via .in() and skip per-row balance logic.
// For APPROVE we must call the single-record handler to handle balance deduction.
export async function apiBatchUpdateLeaveStatus(
  ids:    string[],
  status: LeaveStatus,
  by = 'System',
): Promise<{ ok: number; fail: number }> {
  if (!ids.length) return { ok: 0, fail: 0 }
  // Use per-record handler so balance checks / attendance creation are correct
  const results = await Promise.allSettled(
    ids.map(id => apiUpdateLeaveStatus(id, status, by))
  )
  const ok   = results.filter(r => r.status === 'fulfilled').length
  const fail = results.filter(r => r.status === 'rejected').length
  return { ok, fail }
}

// ── SIL Accrual ───────────────────────────────────────────────────────────────
// Calls the credit_sil_accrual() Postgres function (migration 015) which
// inserts a leave_accruals row (leave_type='sil', entitled=5) for every active
// employee who has completed ≥1 year of service in `year`.  Idempotent — rows
// that already exist are skipped (r_credited = false).
export async function apiAccrueSIL(year?: number): Promise<{
  credited: number
  skipped:  number
  details:  Array<{ employeeId: string; fullName: string; hireDate: string; serviceYears: number; credited: boolean }>
}> {
  const y = year ?? new Date().getFullYear()

  const { data, error } = await supabase.rpc('credit_sil_accrual', { p_year: y })
  if (error) throw error

  type RpcRow = {
    r_employee_id:   string
    r_full_name:     string
    r_hire_date:     string
    r_service_years: number
    r_credited:      boolean
  }
  const rows = (data ?? []) as RpcRow[]
  const credited = rows.filter(r => r.r_credited).length
  const skipped  = rows.length - credited

  if (credited > 0) {
    await insertAudit({
      userId: 'sys', userName: 'System',
      action: 'accrue', module: 'Leaves',
      description:
        `SIL accrual for ${y}: ${credited} employee${credited !== 1 ? 's' : ''} credited ` +
        `(5 days each), ${skipped} already had SIL for this year.`,
    })
  }

  return {
    credited,
    skipped,
    details: rows.map(r => ({
      employeeId:   r.r_employee_id,
      fullName:     r.r_full_name,
      hireDate:     r.r_hire_date,
      serviceYears: r.r_service_years,
      credited:     r.r_credited,
    })),
  }
}
