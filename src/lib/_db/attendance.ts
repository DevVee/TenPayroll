// ─── Attendance ───────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import { hashPin, hashRfid } from '../utils/hash'
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
    isVoided:         r.is_voided       ?? false,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Night Differential Computation
// Philippine Labor Code: 10% additional pay for work between 10:00 PM – 6:00 AM
// ────────────────────────────────────────────────────────────────────────────
export function computeNightDiffMinutes(timeInISO: string, timeOutISO: string): number {
  if (!timeInISO || !timeOutISO) return 0
  const timeIn  = new Date(timeInISO)
  const timeOut = new Date(timeOutISO)
  if (timeOut <= timeIn) return 0   // invalid range

  // Build night-period intervals that overlap with [timeIn, timeOut].
  // Night band repeats each calendar day: 10 PM of day D → 6 AM of day D+1.
  // We check both the night band that started on the day before timeIn
  // and the one that starts on the day of timeIn (handles overnight shifts).

  const NIGHT_START_HOUR = 22   // 10 PM
  const NIGHT_END_HOUR   =  6   // 6 AM next day

  let nightMs = 0

  // Generate candidate night bands spanning [timeIn, timeOut]
  // Start from the night band that *could* have begun the day before timeIn
  const startDate = new Date(timeIn)
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - 1)   // day before

  for (let d = 0; d < 4; d++) {                 // 4 iterations covers any shift ≤ 72 h
    const bandStart = new Date(startDate)
    bandStart.setDate(bandStart.getDate() + d)
    bandStart.setHours(NIGHT_START_HOUR, 0, 0, 0)

    const bandEnd = new Date(bandStart)
    bandEnd.setDate(bandEnd.getDate() + 1)
    bandEnd.setHours(NIGHT_END_HOUR, 0, 0, 0)

    // Intersection of [bandStart, bandEnd] with [timeIn, timeOut]
    const overlapStart = Math.max(bandStart.getTime(), timeIn.getTime())
    const overlapEnd   = Math.min(bandEnd.getTime(),   timeOut.getTime())
    if (overlapEnd > overlapStart) nightMs += overlapEnd - overlapStart

    // Stop once the band starts beyond the timeOut
    if (bandStart.getTime() > timeOut.getTime()) break
  }

  return Math.round(nightMs / 60000)
}

// ────────────────────────────────────────────────────────────────────────────
// Shift-based metrics — shared by kiosk and manual entry
// ────────────────────────────────────────────────────────────────────────────
interface ShiftMetrics {
  minutesLate:      number
  overtimeMinutes:  number
  undertimeMinutes: number
  nightDiffMinutes: number
  status:           AttendanceRecord['status']
}

async function computeShiftMetrics(
  empShiftId: string | null | undefined,
  timeInISO:  string | undefined,
  timeOutISO: string | undefined,
  _baseDate:  string,         // YYYY-MM-DD (reserved for future shift-crossing logic)
  inputStatus: AttendanceRecord['status'],
): Promise<ShiftMetrics> {
  let minutesLate = 0, overtimeMinutes = 0, undertimeMinutes = 0, nightDiffMinutes = 0
  let status = inputStatus

  if (empShiftId && timeInISO) {
    const { data: shift } = await supabase
      .from('work_shifts')
      .select('time_in, time_out, grace_minutes, overtime_threshold_minutes')
      .eq('id', empShiftId)
      .single()

    if (shift) {
      const [ih, im] = (shift.time_in as string).split(':').map(Number)
      const graceMs  = ((shift.grace_minutes as number) ?? 0) * 60000

      // Expected time-in (grace period applied)
      const expectedIn = new Date(timeInISO)
      expectedIn.setHours(ih, im, 0, 0)
      expectedIn.setTime(expectedIn.getTime() + graceMs)

      const actualIn = new Date(timeInISO)
      if (actualIn > expectedIn) {
        minutesLate = Math.round((actualIn.getTime() - expectedIn.getTime()) / 60000)
        status = 'late'
      }

      if (timeOutISO && shift.time_out) {
        const [oh, om] = (shift.time_out as string).split(':').map(Number)
        const expectedOut = new Date(timeOutISO)
        expectedOut.setHours(oh, om, 0, 0)

        // If expected time-out is before time-in (overnight shift), push it to next day
        if (expectedOut <= new Date(timeInISO)) {
          expectedOut.setDate(expectedOut.getDate() + 1)
        }

        const otThreshMs = ((shift.overtime_threshold_minutes as number) ?? 0) * 60000
        const actualOut  = new Date(timeOutISO)

        if (actualOut.getTime() > expectedOut.getTime() + otThreshMs) {
          overtimeMinutes = Math.round((actualOut.getTime() - expectedOut.getTime()) / 60000)
        } else if (actualOut < expectedOut) {
          undertimeMinutes = Math.round((expectedOut.getTime() - actualOut.getTime()) / 60000)
        }

        // Night differential: compute over the full [timeIn, timeOut] window
        nightDiffMinutes = computeNightDiffMinutes(timeInISO, timeOutISO)
      } else if (timeInISO) {
        // No time-out yet — leave night diff at 0.
        // It will be computed correctly when the employee clocks out.
        // Computing to "now()" here inflates payroll for missed clock-outs.
        nightDiffMinutes = 0
      }
    }
  } else if (timeInISO && timeOutISO) {
    // No shift assigned — still compute night differential
    nightDiffMinutes = computeNightDiffMinutes(timeInISO, timeOutISO)
  }

  return { minutesLate, overtimeMinutes, undertimeMinutes, nightDiffMinutes, status }
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
    .eq('is_voided', false)          // never show voided records
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

// ── N-day attendance history — used by dashboard chart ───────────────────────
// Single range query instead of N individual queries (was N+1).
export async function apiGetAttendanceHistory(days = 7): Promise<
  { date: string; present: number; total: number; pct: number }[]
> {
  const today = new Date()

  // Build the date range [startDate, todayStr]
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  const startStr = start.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  // One query covering the entire range
  const { data } = await supabase
    .from('attendance_records')
    .select('date, status')
    .gte('date', startStr)
    .lte('date', todayStr)
    .neq('status', 'rest-day')
    .neq('status', 'holiday')

  // Group by date in memory
  const byDate = new Map<string, { present: number; total: number }>()

  // Pre-fill every date in range so days with zero records still appear
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    byDate.set(d.toISOString().split('T')[0], { present: 0, total: 0 })
  }

  const PRESENT_STATUSES = new Set(['present', 'late', 'half-day'])
  for (const r of data ?? []) {
    const bucket = byDate.get(r.date as string)
    if (!bucket) continue
    bucket.total++
    if (PRESENT_STATUSES.has(r.status as string)) bucket.present++
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { present, total }]) => ({
      date, present, total,
      pct: total > 0 ? Math.round((present / total) * 100) : 0,
    }))
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
      undertime_minutes: r.undertimeMinutes,
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
  // Fetch the current record so we can recompute metrics with the new times
  const { data: existing } = await supabase
    .from('attendance_records')
    .select('employee_id, time_in, time_out, date')
    .eq('id', id)
    .single()

  const { data: emp } = existing
    ? await supabase.from('employees').select('shift_id').eq('id', existing.employee_id).single()
    : { data: null }

  const newTimeIn  = data.timeIn  ?? existing?.time_in  ?? undefined
  const newTimeOut = data.timeOut ?? existing?.time_out ?? undefined
  const baseDate   = existing?.date ?? new Date().toISOString().split('T')[0]

  const metrics = await computeShiftMetrics(
    emp?.shift_id, newTimeIn, newTimeOut, baseDate,
    data.status ?? 'present',
  )

  const patch: Record<string, unknown> = {
    source:           'manual',
    corrected_by:     by,
    correction_reason: reason,
    minutes_late:     metrics.minutesLate,
    overtime_minutes: metrics.overtimeMinutes,
    undertime_minutes: metrics.undertimeMinutes,
    night_diff_minutes: metrics.nightDiffMinutes,
  }
  if (data.timeIn   !== undefined) patch.time_in  = data.timeIn
  if (data.timeOut  !== undefined) patch.time_out = data.timeOut
  if (data.status   !== undefined) patch.status   = data.status ?? metrics.status

  const { data: row, error } = await supabase
    .from('attendance_records').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Record not found')
  const rec = toRecord(row)
  await insertAudit({
    userId: 'sys', userName: by, action: 'update', module: 'Attendance',
    description: `Corrected attendance for ${rec.employeeName} on ${rec.date}: ${reason}`,
    recordId: id,
  })
  return rec
}

export async function apiAddManualAttendance(
  data: {
    employeeId: string
    date:       string
    timeIn?:    string
    timeOut?:   string
    status:     AttendanceRecord['status']
    reason:     string
  },
  by = 'Admin'
): Promise<AttendanceRecord> {
  // Fetch employee + shift
  const { data: emp } = await supabase
    .from('employees')
    .select('full_name, employee_no, department, shift_id')
    .eq('id', data.employeeId)
    .single()
  if (!emp) throw new Error('Employee not found')

  // Compute all shift-based metrics: late minutes, OT, undertime, night diff
  const metrics = await computeShiftMetrics(
    emp.shift_id, data.timeIn, data.timeOut, data.date, data.status,
  )

  const rec = await apiUpsertAttendance({
    employeeId:       data.employeeId,
    employeeName:     emp.full_name,
    employeeNo:       emp.employee_no,
    department:       emp.department,
    date:             data.date,
    timeIn:           data.timeIn,
    timeOut:          data.timeOut,
    status:           metrics.status,
    minutesLate:      metrics.minutesLate,
    overtimeMinutes:  metrics.overtimeMinutes,
    nightDiffMinutes: metrics.nightDiffMinutes,
    undertimeMinutes: metrics.undertimeMinutes,
    source:           'manual',
    correctedBy:      by,
    correctionReason: data.reason,
  })

  await insertAudit({
    userId: 'sys', userName: by, action: 'create', module: 'Attendance',
    description: `Manual attendance for ${emp.full_name} on ${data.date} (${metrics.status}) — ${data.reason}`,
    recordId: rec.id,
  })
  return rec
}

// ── Void (soft-delete) an attendance record ───────────────────────────────────
// Sets is_voided = true so the record is hidden from all queries but preserved
// for audit purposes. Hard-delete would corrupt locked payroll periods.
export async function apiVoidAttendance(
  id: string,
  by: string,
  reason: string,
): Promise<void> {
  const { data: row, error } = await supabase
    .from('attendance_records')
    .update({
      is_voided:  true,
      voided_by:  by,
      voided_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .select('employee_name, date')
    .single()

  if (error) throw error

  await insertAudit({
    userId:      'sys',
    userName:    by,
    action:      'delete',
    module:      'Attendance',
    description: `Voided attendance for ${row?.employee_name ?? '?'} on ${row?.date ?? '?'}: ${reason}`,
    recordId:    id,
  })
}

export async function apiGetTodayHoliday(): Promise<Holiday | null> {
  // Use local date (en-CA locale forces YYYY-MM-DD in machine's timezone).
  // toISOString() returns UTC — in Philippines (UTC+8) that means dates between
  // midnight and 8 AM local would return yesterday's date and miss today's holiday.
  const today = new Date().toLocaleDateString('en-CA')
  const { data } = await supabase
    .from('holidays')
    .select('*')
    .eq('date', today)
    .in('type', ['regular', 'special-non-working'])
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id, name: data.name, date: data.date,
    type: data.type, isNationwide: data.is_nationwide, description: data.description ?? undefined,
  }
}

/**
 * M6: Returns today's special-working holiday if any.
 * These are non-blocking (check-in is allowed) but trigger a yellow notice on the
 * kiosk screen so employees and HR know that 130% premium pay applies.
 */
export async function apiGetTodaySpecialWorkingHoliday(): Promise<Holiday | null> {
  const today = new Date().toLocaleDateString('en-CA')
  const { data } = await supabase
    .from('holidays')
    .select('*')
    .eq('date', today)
    .eq('type', 'special-working')
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id, name: data.name, date: data.date,
    type: data.type, isNationwide: data.is_nationwide, description: data.description ?? undefined,
  }
}

// ── Kiosk PIN check-in (web kiosk page, not Electron) ────────────────────────
// Uses kiosk_lookup_pin() SECURITY DEFINER RPC (migration 022) so anon does not
// need a direct SELECT policy on the employees table (removed in migration 003).
export async function apiKioskPIN(pin: string): Promise<{
  type: 'time-in' | 'time-out'
  employee: { id: string; fullName: string; department: string | null; position: string | null }
  message: string
}> {
  const pinHash = await hashPin(pin)

  const { data, error } = await supabase
    .rpc('kiosk_lookup_pin', { p_pin_hash: pinHash })

  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emp = (data as any[])?.[0] ?? null
  if (!emp) throw new Error('Unknown PIN. Please contact HR.')

  return _kioskCheckinSafe(emp)
}

// ── Kiosk RFID check-in (web kiosk page, not Electron) ───────────────────────
// Uses kiosk_lookup_rfid() SECURITY DEFINER RPC (migration 022) so anon does not
// need a direct SELECT policy on the employees table (removed in migration 003).
export async function apiKioskRFID(rfid: string): Promise<{
  type: 'time-in' | 'time-out'
  employee: { id: string; fullName: string; department: string | null; position: string | null }
  message: string
}> {
  // H4: Normalize RFID before hashing — scanners can emit mixed case / leading spaces.
  // Must match the normalization applied when the RFID was first saved in EmployeeForm.
  const rfidHash = await hashRfid(rfid.trim().toUpperCase())

  const { data, error } = await supabase
    .rpc('kiosk_lookup_rfid', { p_rfid_hash: rfidHash })

  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emp = (data as any[])?.[0] ?? null
  if (!emp) throw new Error('Card not recognized. Please contact HR.')

  return _kioskCheckinSafe(emp)
}

// M7: Wrap _kioskCheckin to convert raw Postgres constraint errors into
// human-readable messages before they reach the kiosk screen.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _kioskCheckinSafe(emp: any) {
  try {
    return await _kioskCheckin(emp)
  } catch (err: unknown) {
    // 23505 = unique_violation — means (employee_id, date) already exists with a
    // different source (e.g., HR created the record manually). Give a clear message.
    const pg = err as { code?: string }
    if (pg?.code === '23505') {
      throw new Error(
        `Attendance already recorded for today by HR or another device. ` +
        'Contact HR to correct your time.'
      )
    }
    throw err
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _kioskCheckin(emp: any) {
  // C1: Use local date — toISOString() is UTC and returns the wrong calendar day
  // in Philippines (UTC+8) between midnight and 8 AM local time.
  const today = new Date().toLocaleDateString('en-CA')
  const now   = new Date().toISOString()

  // Use maybeSingle() so a missing row returns null without an error.
  // With the kiosk_select_attendance RLS policy (migration 022), anon can read
  // rows where source = 'kiosk'. If the row was written by a web-admin (source ≠ 'kiosk')
  // it will also appear as null here — the subsequent upsert will then conflict on the
  // (employee_id, date) unique key and fail with a clear Postgres error, which the
  // caller in Kiosk.tsx surfaces as "System error. Please contact HR."
  const { data: existing, error: selErr } = await supabase
    .from('attendance_records')
    .select('id, time_in, time_out')
    .eq('employee_id', emp.id)
    .eq('date', today)
    .maybeSingle()

  // A real DB/network error (not just "no row") must not be silently ignored —
  // treating it as "no record" could create a phantom time-in over an existing one.
  if (selErr) throw selErr

  // Guard: if both time_in and time_out already exist the shift is complete for today.
  // Allowing another scan would overwrite the time_out and lose the completed record.
  if (existing?.time_in && existing?.time_out) {
    throw new Error(
      `${emp.full_name} — Shift already complete for today. ` +
      'Contact HR if a correction is needed.'
    )
  }

  const type: 'time-in' | 'time-out' = (existing?.time_in && !existing?.time_out) ? 'time-out' : 'time-in'

  if (type === 'time-in') {
    const metrics = await computeShiftMetrics(
      emp.shift_id, now, undefined, today, 'present',
    )
    await apiUpsertAttendance({
      employeeId: emp.id, employeeName: emp.full_name, employeeNo: emp.employee_no,
      department: emp.department, date: today, timeIn: now, status: metrics.status,
      minutesLate: metrics.minutesLate, overtimeMinutes: 0,
      nightDiffMinutes: metrics.nightDiffMinutes, undertimeMinutes: 0, source: 'kiosk',
    })
  } else {
    // Time-out: recompute all metrics with the real time-out
    const metrics = await computeShiftMetrics(
      emp.shift_id, existing?.time_in, now, today, 'present',
    )
    // H2: Use .select() so we get back the affected rows — Supabase UPDATE returns
    // { error: null } even when 0 rows matched (no error for empty result set).
    // If the row was created by HR (source ≠ 'kiosk'), the RLS policy blocks it
    // and we get 0 rows back. Surface a clear message instead of silent data loss.
    const { data: updated, error: updErr } = await supabase
      .from('attendance_records')
      .update({
        time_out:           now,
        overtime_minutes:   metrics.overtimeMinutes,
        undertime_minutes:  metrics.undertimeMinutes,
        night_diff_minutes: metrics.nightDiffMinutes,
      })
      .eq('employee_id', emp.id)
      .eq('date', today)
      .select('id')

    if (updErr) throw updErr
    if (!updated?.length) {
      throw new Error(
        `Time-out could not be saved — today's record may have been locked or created by HR. ` +
        'Please contact HR to record your time-out manually.'
      )
    }
  }

  return {
    type,
    employee: {
      id:         emp.id,
      fullName:   emp.full_name,
      department: emp.department,
      position:   emp.position,
    },
    message: `${emp.full_name} — ${type === 'time-in' ? 'Time In' : 'Time Out'} recorded`,
  }
}

// ── Attendance exceptions (missing time-out detection) ────────────────────────

export interface AttendanceException {
  id:           string
  employeeId:   string
  employeeName: string
  employeeNo:   string
  department?:  string
  date:         string
  timeIn:       string    // always present for this exception type
  exceptionType: 'missing_timeout'
}

/**
 * Returns attendance records where an employee clocked IN but never clocked OUT
 * and whose date is before today (so today's in-progress shifts are excluded).
 * Used by HR to flag and manually close open records before payroll.
 *
 * Pass `startDate` + `endDate` to scope the check to a specific pay period
 * (e.g. payroll generation guard). When omitted, scans the last `daysBack` days.
 */
export async function apiGetAttendanceExceptions(p?: {
  daysBack?:  number
  startDate?: string   // YYYY-MM-DD — inclusive lower bound when scoping to a period
  endDate?:   string   // YYYY-MM-DD — inclusive upper bound
}): Promise<AttendanceException[]> {
  const today    = new Date().toISOString().split('T')[0]

  // Use explicit date range when provided; otherwise fall back to rolling window.
  const fromDate = p?.startDate ?? new Date(Date.now() - ((p?.daysBack ?? 30) * 86_400_000))
    .toISOString().split('T')[0]
  // When scoping to a pay period include the end date; rolling window excludes today.
  const toDate   = p?.endDate   ?? today

  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, employee_id, employee_name, employee_no, department, date, time_in, time_out, status')
    .gte('date', fromDate)
    .lte('date', toDate)           // inclusive — pay period end is a valid working day
    .lt('date', today)             // never include today — shift may still be in progress
    .not('time_in', 'is', null)    // has a time-in
    .is('time_out', null)          // but no time-out
    .in('status', ['present', 'late'])  // only real shifts (not manual absences)
    .order('date', { ascending: false })

  if (error) throw error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any): AttendanceException => ({
    id:            r.id,
    employeeId:    r.employee_id,
    employeeName:  r.employee_name ?? '',
    employeeNo:    r.employee_no   ?? '',
    department:    r.department    ?? undefined,
    date:          r.date,
    timeIn:        r.time_in,
    exceptionType: 'missing_timeout',
  }))
}
