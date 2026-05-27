// ─── Attendance ───────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import type { AttendanceRecord, Holiday } from '../../types'

// ── Mapper ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRecord(r: any): AttendanceRecord {
  return {
    id:               r.id,
    employeeId:       r.employee_id,
    employeeName:     r.employee_name   ?? '',
    employeeNo:       r.employee_no     ?? '',
    department:       r.department      ?? undefined,
    date:             typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
    timeIn:           r.time_in         ?? undefined,
    timeOut:          r.time_out        ?? undefined,
    status:           r.status,
    minutesLate:      r.minutes_late       ?? 0,
    overtimeMinutes:  r.overtime_minutes   ?? 0,
    nightDiffMinutes: r.night_diff_minutes ?? 0,
    undertimeMinutes: r.undertime_minutes  ?? 0,
    source:           r.source             ?? 'kiosk',
    correctedBy:      r.corrected_by    ?? undefined,
    correctionReason: r.correction_reason ?? undefined,
    note:             r.note            ?? undefined,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetAttendance(p?: {
  employeeId?: string
  date?:       string
  startDate?:  string
  endDate?:    string
  status?:     string
}): Promise<AttendanceRecord[]> {
  let query = supabase
    .from('attendance_records')
    .select('*')
    .order('date', { ascending: false })
    .order('employee_name', { ascending: true })

  if (p?.employeeId) query = query.eq('employee_id', p.employeeId)
  if (p?.date)       query = query.eq('date', p.date)
  if (p?.startDate)  query = query.gte('date', p.startDate)
  if (p?.endDate)    query = query.lte('date', p.endDate)
  if (p?.status && p.status !== 'all') query = query.eq('status', p.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toRecord)
}

export async function apiGetTodayAttendance(): Promise<AttendanceRecord[]> {
  const today = new Date().toISOString().split('T')[0]
  return apiGetAttendance({ date: today })
}

export async function apiUpsertAttendance(r: Omit<AttendanceRecord, 'id'>): Promise<AttendanceRecord> {
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert({
      employee_id:       r.employeeId,
      employee_name:     r.employeeName,
      employee_no:       r.employeeNo,
      department:        r.department,
      date:              r.date,
      time_in:           r.timeIn,
      time_out:          r.timeOut,
      status:            r.status,
      minutes_late:      r.minutesLate,
      overtime_minutes:  r.overtimeMinutes,
      night_diff_minutes:r.nightDiffMinutes,
      source:            r.source,
      corrected_by:      r.correctedBy,
      correction_reason: r.correctionReason,
      note:              r.note,
    }, { onConflict: 'employee_id,date' })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('Upsert failed')
  return toRecord(data)
}

export async function apiCorrectAttendance(
  id: string,
  data: Partial<AttendanceRecord>,
  by: string,
  reason: string
): Promise<AttendanceRecord> {
  const patch: Record<string, unknown> = { source: 'manual', corrected_by: by, correction_reason: reason }
  if (data.timeIn   !== undefined) patch.time_in  = data.timeIn
  if (data.timeOut  !== undefined) patch.time_out = data.timeOut
  if (data.status   !== undefined) patch.status   = data.status
  if (data.minutesLate !== undefined) patch.minutes_late = data.minutesLate
  if (data.overtimeMinutes !== undefined) patch.overtime_minutes = data.overtimeMinutes

  const { data: row, error } = await supabase
    .from('attendance_records').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Record not found')
  const rec = toRecord(row)
  await insertAudit({ userId: 'sys', userName: by, action: 'update', module: 'Attendance', description: `Corrected attendance for ${rec.employeeName} on ${rec.date}: ${reason}` })
  return rec
}

export async function apiAddManualAttendance(
  data: { employeeId: string; date: string; timeIn?: string; timeOut?: string; status: AttendanceRecord['status']; reason: string },
  by = 'Admin'
): Promise<AttendanceRecord> {
  // Fetch employee + shift for late calculation
  const { data: emp } = await supabase
    .from('employees')
    .select('full_name, employee_no, department, shift_id')
    .eq('id', data.employeeId)
    .single()
  if (!emp) throw new Error('Employee not found')

  let minutesLate = 0
  if (data.timeIn && emp.shift_id && (data.status === 'present' || data.status === 'late')) {
    const { data: shift } = await supabase.from('work_shifts').select('time_in, grace_minutes').eq('id', emp.shift_id).single()
    if (shift) {
      const [sh, sm] = shift.time_in.split(':').map(Number)
      const deadline = new Date(data.timeIn)
      deadline.setHours(sh, sm + (shift.grace_minutes ?? 0), 0, 0)
      const tin = new Date(data.timeIn)
      if (tin > deadline) minutesLate = Math.round((tin.getTime() - deadline.getTime()) / 60000)
    }
  }

  const rec = await apiUpsertAttendance({
    employeeId:       data.employeeId,
    employeeName:     emp.full_name,
    employeeNo:       emp.employee_no,
    department:       emp.department,
    date:             data.date,
    timeIn:           data.timeIn,
    timeOut:          data.timeOut,
    status:           data.status,
    minutesLate,
    overtimeMinutes:  0,
    nightDiffMinutes: 0,
    undertimeMinutes: 0,
    source:           'manual',
    correctedBy:      by,
    correctionReason: data.reason,
  })

  await insertAudit({
    userId: 'sys', userName: by, action: 'create', module: 'Attendance',
    description: `Manual attendance for ${emp.full_name} on ${data.date} (${data.status}) — ${data.reason}`,
  })
  return rec
}

export async function apiGetTodayHoliday(): Promise<Holiday | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('holidays').select('*').eq('date', today).single()
  if (!data) return null
  return {
    id: data.id, name: data.name, date: data.date,
    type: data.type, isNationwide: data.is_nationwide, description: data.description ?? undefined,
  }
}

// ── Kiosk PIN check-in (web kiosk page, not Electron) ────────────────────────
export async function apiKioskPIN(pin: string): Promise<{ type: 'time-in' | 'time-out'; employee: { id: string; fullName: string; department: string | null; position: string | null }; message: string }> {
  const { data: emp } = await supabase
    .from('employees')
    .select('id, full_name, employee_no, department, position, shift_id, status')
    .eq('pin_code', pin)
    .eq('status', 'active')
    .single()
  if (!emp) throw new Error('Unknown PIN. Please contact HR.')
  return _kioskCheckin(emp)
}

// ── Kiosk RFID check-in (web kiosk page, not Electron) ───────────────────────
export async function apiKioskRFID(rfid: string): Promise<{ type: 'time-in' | 'time-out'; employee: { id: string; fullName: string; department: string | null; position: string | null }; message: string }> {
  const { data: emp } = await supabase
    .from('employees')
    .select('id, full_name, employee_no, department, position, shift_id, status')
    .eq('rfid_tag', rfid)
    .eq('status', 'active')
    .single()
  if (!emp) throw new Error('Card not recognized. Please contact HR.')
  return _kioskCheckin(emp)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _kioskCheckin(emp: any) {
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date().toISOString()

  const { data: existing } = await supabase
    .from('attendance_records')
    .select('id, time_in, time_out')
    .eq('employee_id', emp.id)
    .eq('date', today)
    .single()

  const type: 'time-in' | 'time-out' = (existing?.time_in && !existing?.time_out) ? 'time-out' : 'time-in'

  if (type === 'time-in') {
    let minutesLate = 0; let status: AttendanceRecord['status'] = 'present'
    if (emp.shift_id) {
      const { data: shift } = await supabase.from('work_shifts').select('time_in, grace_minutes').eq('id', emp.shift_id).single()
      if (shift) {
        const [ih, im] = shift.time_in.split(':').map(Number)
        const expected = new Date(); expected.setHours(ih, im + (shift.grace_minutes ?? 0), 0, 0)
        if (new Date() > expected) { minutesLate = Math.round((Date.now() - expected.getTime()) / 60000); status = 'late' }
      }
    }
    await apiUpsertAttendance({
      employeeId: emp.id, employeeName: emp.full_name, employeeNo: emp.employee_no,
      department: emp.department, date: today, timeIn: now, status,
      minutesLate, overtimeMinutes: 0, nightDiffMinutes: 0, undertimeMinutes: 0, source: 'kiosk',
    })
  } else {
    // Time-out: compute overtime and undertime vs shift schedule.
    let overtimeMinutes = 0; let undertimeMinutes = 0
    if (emp.shift_id) {
      const { data: shift } = await supabase.from('work_shifts').select('time_out').eq('id', emp.shift_id).single()
      if (shift) {
        const [oh, om] = shift.time_out.split(':').map(Number)
        const exp = new Date(); exp.setHours(oh, om, 0, 0)
        const now_ = new Date()
        if (now_ > exp) {
          overtimeMinutes = Math.round((now_.getTime() - exp.getTime()) / 60000)
        } else {
          undertimeMinutes = Math.round((exp.getTime() - now_.getTime()) / 60000)
        }
      }
    }
    await supabase
      .from('attendance_records')
      .update({ time_out: now, overtime_minutes: overtimeMinutes, undertime_minutes: undertimeMinutes })
      .eq('employee_id', emp.id)
      .eq('date', today)
  }

  return { type, employee: { id: emp.id, fullName: emp.full_name, department: emp.department, position: emp.position }, message: `${emp.full_name} — ${type === 'time-in' ? 'Time In' : 'Time Out'} recorded` }
}
