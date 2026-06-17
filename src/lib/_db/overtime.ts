// ─── Overtime Requests ────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import type { OvertimeRequest, OTStatus } from '../../types'

// ── Mapper ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOT(r: any): OvertimeRequest {
  return {
    id:              r.id,
    employeeId:      r.employee_id,
    employeeName:    r.employee_name    ?? '',
    employeeNo:      r.employee_no      ?? '',
    department:      r.department       ?? '',
    date:            r.date,
    hoursRequested:  Number(r.hours_requested) || 0,
    overtimeType:    r.overtime_type    ?? undefined,
    multiplier:      r.multiplier       ? Number(r.multiplier) : undefined,
    reason:          r.reason           ?? '',
    status:          r.status           as OTStatus,
    reviewedBy:      r.reviewed_by      ?? undefined,
    approvedBy:      r.reviewed_by      ?? undefined,   // alias
    reviewedAt:      r.reviewed_at      ?? undefined,
    createdAt:       r.created_at,
    filedAt:         r.created_at       ?? undefined,   // alias
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetOvertime(p?: {
  employeeId?: string
  status?:     string
}): Promise<OvertimeRequest[]> {
  let query = supabase
    .from('overtime_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (p?.employeeId) query = query.eq('employee_id', p.employeeId)
  if (p?.status && p.status !== 'all') query = query.eq('status', p.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toOT)
}

export async function apiCreateOvertime(
  data: Omit<OvertimeRequest, 'id' | 'createdAt' | 'status'>,
  by = 'System'
): Promise<OvertimeRequest> {
  const { data: row, error } = await supabase
    .from('overtime_requests')
    .insert({
      employee_id:      data.employeeId,
      employee_name:    data.employeeName,
      employee_no:      data.employeeNo,
      department:       data.department,
      date:             data.date,
      hours_requested:  data.hoursRequested,
      overtime_type:    data.overtimeType ?? null,
      multiplier:       data.multiplier ?? null,
      reason:           data.reason,
      status:           'pending',
    })
    .select()
    .single()
  if (error || !row) throw error ?? new Error('Failed to create overtime request')
  const ot = toOT(row)
  await insertAudit({
    userId: 'sys', userName: by,
    action: 'create', module: 'Overtime',
    description: `OT request filed for ${ot.employeeName} on ${ot.date} (${ot.hoursRequested}h — ${data.overtimeType ?? 'regular-ot'})`,
    recordId: ot.id,
  })
  return ot
}

export async function apiUpdateOvertimeStatus(
  id:     string,
  status: OTStatus,
  by?:    string
): Promise<OvertimeRequest> {
  const { data: row, error } = await supabase
    .from('overtime_requests')
    .update({
      status,
      reviewed_by: by ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error || !row) throw error ?? new Error('Overtime request not found')
  const ot = toOT(row)
  await insertAudit({
    userId: 'sys', userName: by ?? 'System',
    action: status === 'approved' ? 'approve' : 'reject',
    module: 'Overtime',
    description: `${status === 'approved' ? 'Approved' : 'Rejected'} OT for ${ot.employeeName} on ${ot.date}`,
  })
  return ot
}

export async function apiBatchUpdateOvertimeStatus(
  ids:    string[],
  status: OTStatus,
  by = 'System',
): Promise<{ ok: number; fail: number }> {
  if (!ids.length) return { ok: 0, fail: 0 }
  const results = await Promise.allSettled(
    ids.map(id => apiUpdateOvertimeStatus(id, status, by))
  )
  const ok   = results.filter(r => r.status === 'fulfilled').length
  const fail = results.filter(r => r.status === 'rejected').length
  return { ok, fail }
}
