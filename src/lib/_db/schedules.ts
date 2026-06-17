// ─── Work Shifts + Holidays ───────────────────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import type { WorkShift, Holiday } from '../../types'

// ── Mappers ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toShift(r: any): WorkShift {
  return {
    id:                      r.id,
    name:                    r.name,
    timeIn:                  r.time_in,
    timeOut:                 r.time_out,
    breakMinutes:            r.break_minutes            ?? 60,
    graceMinutes:            r.grace_minutes            ?? 0,
    restDays:                r.rest_days                ?? [0, 6],
    overtimeEnabled:         r.overtime_enabled         ?? true,
    overtimeThresholdMinutes:r.overtime_threshold_minutes ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toHoliday(r: any): Holiday {
  return {
    id:          r.id,
    name:        r.name,
    date:        r.date,
    type:        r.type,
    isNationwide:r.is_nationwide ?? true,
    description: r.description   ?? undefined,
  }
}

// ── Public API: Shifts ────────────────────────────────────────────────────────
export async function apiGetShifts(): Promise<WorkShift[]> {
  const { data, error } = await supabase.from('work_shifts').select('*').order('name')
  if (error) throw error
  return (data ?? []).map(toShift)
}

export async function apiCreateShift(data: Omit<WorkShift, 'id'>): Promise<WorkShift> {
  const { data: row, error } = await supabase
    .from('work_shifts')
    .insert({
      name:                     data.name,
      time_in:                  data.timeIn,
      time_out:                 data.timeOut,
      break_minutes:            data.breakMinutes,
      grace_minutes:            data.graceMinutes,
      rest_days:                data.restDays,
      overtime_enabled:         data.overtimeEnabled,
      overtime_threshold_minutes: data.overtimeThresholdMinutes ?? null,
    })
    .select()
    .single()
  if (error || !row) throw error ?? new Error('Failed to create shift')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'create', module: 'Settings', description: `Created shift: ${data.name}` })
  return toShift(row)
}

export async function apiUpdateShift(id: string, data: Partial<WorkShift>): Promise<WorkShift> {
  const patch: Record<string, unknown> = {}
  if (data.name                     !== undefined) patch.name                      = data.name
  if (data.timeIn                   !== undefined) patch.time_in                   = data.timeIn
  if (data.timeOut                  !== undefined) patch.time_out                  = data.timeOut
  if (data.breakMinutes             !== undefined) patch.break_minutes             = data.breakMinutes
  if (data.graceMinutes             !== undefined) patch.grace_minutes             = data.graceMinutes
  if (data.restDays                 !== undefined) patch.rest_days                 = data.restDays
  if (data.overtimeEnabled          !== undefined) patch.overtime_enabled          = data.overtimeEnabled
  if (data.overtimeThresholdMinutes !== undefined) patch.overtime_threshold_minutes = data.overtimeThresholdMinutes

  const { data: row, error } = await supabase
    .from('work_shifts').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Shift not found')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'update', module: 'Settings', description: `Updated shift: ${row.name}` })
  return toShift(row)
}

export async function apiDeleteShift(id: string): Promise<void> {
  const { data: nameRow } = await supabase.from('work_shifts').select('name').eq('id', id).single()
  const { data: deleted, error } = await supabase.from('work_shifts').delete().eq('id', id).select('id')
  if (error) throw error
  if (!deleted?.length) throw new Error('Shift not found or you do not have permission to delete it.')
  if (nameRow) await insertAudit({ userId: 'sys', userName: 'System', action: 'delete', module: 'Settings', description: `Deleted shift: ${nameRow.name}` })
}

// ── Public API: Holidays ──────────────────────────────────────────────────────
export async function apiGetHolidays(year?: number): Promise<Holiday[]> {
  let query = supabase.from('holidays').select('*').order('date')
  if (year) {
    query = query
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toHoliday)
}

export async function apiCreateHoliday(data: Omit<Holiday, 'id'>): Promise<Holiday> {
  const { data: row, error } = await supabase
    .from('holidays')
    .insert({
      name:         data.name,
      date:         data.date,
      type:         data.type,
      is_nationwide:data.isNationwide,
      description:  data.description ?? null,
    })
    .select()
    .single()
  if (error || !row) throw error ?? new Error('Failed to create holiday')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'create', module: 'Settings', description: `Created holiday: ${data.name} (${data.date})` })
  return toHoliday(row)
}

export async function apiUpdateHoliday(id: string, data: Partial<Holiday>): Promise<Holiday> {
  const patch: Record<string, unknown> = {}
  if (data.name         !== undefined) patch.name          = data.name
  if (data.date         !== undefined) patch.date          = data.date
  if (data.type         !== undefined) patch.type          = data.type
  if (data.isNationwide !== undefined) patch.is_nationwide = data.isNationwide
  if (data.description  !== undefined) patch.description   = data.description

  const { data: row, error } = await supabase
    .from('holidays').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Holiday not found')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'update', module: 'Settings', description: `Updated holiday: ${row.name}` })
  return toHoliday(row)
}

export async function apiDeleteHoliday(id: string): Promise<void> {
  const { data: nameRow } = await supabase.from('holidays').select('name').eq('id', id).single()
  const { data: deleted, error } = await supabase.from('holidays').delete().eq('id', id).select('id')
  if (error) throw error
  if (!deleted?.length) throw new Error('Holiday not found or you do not have permission to delete it.')
  if (nameRow) await insertAudit({ userId: 'sys', userName: 'System', action: 'delete', module: 'Settings', description: `Deleted holiday: ${nameRow.name}` })
}
