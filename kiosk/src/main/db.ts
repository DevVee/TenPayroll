// ─── Kiosk Local SQLite Database (better-sqlite3) ─────────────────────────────
import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuid } from 'uuid'

let db: Database.Database

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initDB(): void {
  const dbPath = join(app.getPath('userData'), 'kiosk.sqlite')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    -- Attendance queue (local records waiting to sync to Supabase)
    CREATE TABLE IF NOT EXISTS attendance_queue (
      id                TEXT PRIMARY KEY,
      employee_id       TEXT NOT NULL,
      employee_no       TEXT,
      full_name         TEXT,
      department        TEXT,
      date              TEXT NOT NULL,
      time_in           TEXT,
      time_out          TEXT,
      status            TEXT NOT NULL DEFAULT 'present',
      minutes_late      INTEGER NOT NULL DEFAULT 0,
      overtime_minutes  INTEGER NOT NULL DEFAULT 0,
      undertime_minutes INTEGER NOT NULL DEFAULT 0,
      source            TEXT NOT NULL DEFAULT 'kiosk',
      device_id         TEXT,
      created_at        TEXT NOT NULL,
      synced            INTEGER NOT NULL DEFAULT 0,
      sync_attempts     INTEGER NOT NULL DEFAULT 0,
      last_sync_at      TEXT,
      sync_error        TEXT
    );

    -- Add columns if upgrading from an older schema
    -- (SQLite ignores "duplicate column" errors only via separate statements)

    -- Device config key-value store
    CREATE TABLE IF NOT EXISTS device_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Local employee cache (refreshed from Supabase when online)
    CREATE TABLE IF NOT EXISTS employee_cache (
      id          TEXT PRIMARY KEY,
      employee_no TEXT,
      full_name   TEXT NOT NULL,
      pin_code    TEXT,
      rfid_tag    TEXT,
      shift_id    TEXT,
      department  TEXT,
      position    TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      cached_at   TEXT NOT NULL
    );

    -- Local shift cache (used to compute late/OT/undertime offline)
    CREATE TABLE IF NOT EXISTS shifts_cache (
      id                        TEXT PRIMARY KEY,
      name                      TEXT NOT NULL,
      time_in                   TEXT NOT NULL,
      time_out                  TEXT NOT NULL,
      break_minutes             INTEGER NOT NULL DEFAULT 60,
      grace_minutes             INTEGER NOT NULL DEFAULT 15,
      overtime_threshold_minutes INTEGER DEFAULT 30,
      cached_at                 TEXT NOT NULL
    );

    -- Recent check-ins (for idle screen display, last 50)
    CREATE TABLE IF NOT EXISTS recent_checkins (
      id          TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      full_name   TEXT NOT NULL,
      department  TEXT,
      type        TEXT NOT NULL,
      timestamp   TEXT NOT NULL
    );
  `)

  // Safe column migrations for existing DBs (ALTER TABLE IF NOT EXISTS is not supported
  // in older SQLite, so we catch the "duplicate column" error silently)
  const addColumn = (tbl: string, col: string, def: string) => {
    try { db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`) } catch { /* already exists */ }
  }
  addColumn('attendance_queue', 'minutes_late',      'INTEGER NOT NULL DEFAULT 0')
  addColumn('attendance_queue', 'overtime_minutes',  'INTEGER NOT NULL DEFAULT 0')
  addColumn('attendance_queue', 'undertime_minutes', 'INTEGER NOT NULL DEFAULT 0')
}

// ─── Device Config ────────────────────────────────────────────────────────────
export function getConfig(key: string): string | null {
  const row = db.prepare('SELECT value FROM device_config WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO device_config (key, value) VALUES (?, ?)').run(key, value)
}

// ─── Employee Cache ───────────────────────────────────────────────────────────
export interface CachedEmployee {
  id: string
  employee_no: string
  full_name: string
  pin_code: string | null
  rfid_tag: string | null
  shift_id: string | null
  department: string | null
  position: string | null
  status: string
}

export function getEmployeeCache(): CachedEmployee[] {
  return db.prepare('SELECT * FROM employee_cache WHERE status = ?').all('active') as CachedEmployee[]
}

export function replaceEmployeeCache(employees: CachedEmployee[]): void {
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR REPLACE INTO employee_cache
    (id, employee_no, full_name, pin_code, rfid_tag, shift_id, department, position, status, cached_at)
    VALUES (@id, @employee_no, @full_name, @pin_code, @rfid_tag, @shift_id, @department, @position, @status, @cached_at)
  `)
  const insertMany = db.transaction((emps: CachedEmployee[]) => {
    db.prepare('DELETE FROM employee_cache').run()
    for (const e of emps) insert.run({ ...e, cached_at: now })
  })
  insertMany(employees)
}

// ─── Shifts Cache ─────────────────────────────────────────────────────────────
export interface CachedShift {
  id: string
  name: string
  time_in: string                    // "08:00"
  time_out: string                   // "17:00"
  break_minutes: number
  grace_minutes: number
  overtime_threshold_minutes: number | null
}

export function replaceShiftsCache(shifts: CachedShift[]): void {
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR REPLACE INTO shifts_cache
    (id, name, time_in, time_out, break_minutes, grace_minutes, overtime_threshold_minutes, cached_at)
    VALUES (@id, @name, @time_in, @time_out, @break_minutes, @grace_minutes, @overtime_threshold_minutes, @cached_at)
  `)
  const many = db.transaction((s: CachedShift[]) => {
    db.prepare('DELETE FROM shifts_cache').run()
    for (const sh of s) insert.run({ ...sh, cached_at: now })
  })
  many(shifts)
}

export function getShift(shiftId: string | null): CachedShift | null {
  if (!shiftId) return null
  return db.prepare('SELECT * FROM shifts_cache WHERE id = ?').get(shiftId) as CachedShift | null
}

// ─── Attendance Queue ─────────────────────────────────────────────────────────
export interface AttendanceInput {
  employee_id: string
  employee_no: string
  full_name: string
  department: string | null
  shift_id: string | null           // used to compute late/OT/undertime
  date: string
  now: string
}

export interface UpsertResult {
  type: 'time-in' | 'time-out'
  id: string
}

export function upsertAttendance(input: AttendanceInput): UpsertResult {
  const deviceId = getConfig('device_id') ?? 'unknown'
  const shift    = getShift(input.shift_id)

  // Find existing record for today (prefer incomplete time-out first)
  const existing = db
    .prepare(`SELECT id, time_in, time_out FROM attendance_queue
              WHERE employee_id = ? AND date = ?
              ORDER BY created_at DESC LIMIT 1`)
    .get(input.employee_id, input.date) as
      { id: string; time_in: string | null; time_out: string | null } | undefined

  if (!existing || existing.time_out) {
    // ── TIME-IN ────────────────────────────────────────────────────────────
    const minutesLate = _computeLate(input.now, shift)
    const status      = minutesLate > 0 ? 'late' : 'present'
    const id          = uuid()

    db.prepare(`
      INSERT INTO attendance_queue
      (id, employee_id, employee_no, full_name, department,
       date, time_in, status, minutes_late, source, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'kiosk', ?, ?)
    `).run(id, input.employee_id, input.employee_no, input.full_name,
           input.department, input.date, input.now, status,
           minutesLate, deviceId, input.now)

    _recordCheckin(input.employee_id, input.full_name, input.department, 'time-in', input.now)
    return { type: 'time-in', id }

  } else if (existing.time_in && !existing.time_out) {
    // ── TIME-OUT ───────────────────────────────────────────────────────────
    const { ot, ut } = _computeOTandUT(input.now, shift)

    db.prepare(`
      UPDATE attendance_queue
      SET time_out = ?, overtime_minutes = ?, undertime_minutes = ?, synced = 0
      WHERE id = ?
    `).run(input.now, ot, ut, existing.id)

    _recordCheckin(input.employee_id, input.full_name, input.department, 'time-out', input.now)
    return { type: 'time-out', id: existing.id }

  } else {
    // Edge case: create new time-in
    const minutesLate = _computeLate(input.now, shift)
    const id          = uuid()

    db.prepare(`
      INSERT INTO attendance_queue
      (id, employee_id, employee_no, full_name, department,
       date, time_in, status, minutes_late, source, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'kiosk', ?, ?)
    `).run(id, input.employee_id, input.employee_no, input.full_name,
           input.department, input.date, input.now,
           minutesLate > 0 ? 'late' : 'present', minutesLate,
           deviceId, input.now)

    _recordCheckin(input.employee_id, input.full_name, input.department, 'time-in', input.now)
    return { type: 'time-in', id }
  }
}

// ── Shift computation helpers ─────────────────────────────────────────────────

/** Minutes past the grace deadline. Returns 0 if on time. */
function _computeLate(nowIso: string, shift: CachedShift | null): number {
  if (!shift) return 0
  const [h, m]    = shift.time_in.split(':').map(Number)
  const deadline  = new Date(nowIso)
  deadline.setHours(h, m + shift.grace_minutes, 0, 0)
  const actual    = new Date(nowIso)
  return actual > deadline ? Math.round((actual.getTime() - deadline.getTime()) / 60_000) : 0
}

/** Overtime and undertime minutes relative to scheduled time_out. */
function _computeOTandUT(nowIso: string, shift: CachedShift | null): { ot: number; ut: number } {
  if (!shift) return { ot: 0, ut: 0 }
  const [h, m]   = shift.time_out.split(':').map(Number)
  const expected = new Date(nowIso)
  expected.setHours(h, m, 0, 0)
  const actual   = new Date(nowIso)
  const diff     = Math.round((actual.getTime() - expected.getTime()) / 60_000)
  const threshold = shift.overtime_threshold_minutes ?? 0
  if (diff >= threshold) return { ot: diff,  ut: 0 }
  if (diff < 0)          return { ot: 0,     ut: Math.abs(diff) }
  return { ot: 0, ut: 0 }
}

function _recordCheckin(empId: string, fullName: string, dept: string | null, type: string, ts: string) {
  const id = uuid()
  db.prepare(`
    INSERT INTO recent_checkins (id, employee_id, full_name, department, type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, empId, fullName, dept, type, ts)
  db.prepare(`
    DELETE FROM recent_checkins WHERE id NOT IN (
      SELECT id FROM recent_checkins ORDER BY timestamp DESC LIMIT 50
    )
  `).run()
}

export function getRecentCheckins(limit = 10) {
  return db.prepare('SELECT * FROM recent_checkins ORDER BY timestamp DESC LIMIT ?').all(limit)
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────
export interface QueueRecord {
  id: string
  employee_id: string
  employee_no: string
  full_name: string
  department: string | null
  date: string
  time_in: string | null
  time_out: string | null
  status: string
  minutes_late: number
  overtime_minutes: number
  undertime_minutes: number
  source: string
  device_id: string
  created_at: string
  sync_attempts: number
}

export function getPendingRecords(limit = 100): QueueRecord[] {
  return db.prepare(`
    SELECT * FROM attendance_queue
    WHERE synced = 0 AND sync_attempts < 10
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as QueueRecord[]
}

export function markSynced(ids: string[]): void {
  if (!ids.length) return
  const now    = new Date().toISOString()
  const update = db.prepare('UPDATE attendance_queue SET synced = 1, last_sync_at = ? WHERE id = ?')
  db.transaction((ids: string[]) => { for (const id of ids) update.run(now, id) })(ids)
}

export function markFailed(ids: string[], error: string): void {
  if (!ids.length) return
  const update = db.prepare(
    'UPDATE attendance_queue SET sync_attempts = sync_attempts + 1, sync_error = ?, last_sync_at = ? WHERE id = ?'
  )
  db.transaction((ids: string[]) => {
    for (const id of ids) update.run(error, new Date().toISOString(), id)
  })(ids)
}

export function getPendingCount(): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM attendance_queue WHERE synced = 0').get() as { cnt: number }
  return row.cnt
}
