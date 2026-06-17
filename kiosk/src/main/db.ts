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
  // L1: FULL sync mode — flushes WAL to disk before each write acknowledgement.
  // Safer than NORMAL against power-loss data loss. Slightly slower but
  // acceptable for the kiosk's low write frequency.
  db.pragma('synchronous = FULL')
  db.pragma('cache_size = -32000')   // 32 MB page cache

  db.exec(`
    -- Attendance queue (local records waiting to sync to Supabase)
    CREATE TABLE IF NOT EXISTS attendance_queue (
      id                   TEXT PRIMARY KEY,
      employee_id          TEXT NOT NULL,
      employee_no          TEXT,
      full_name            TEXT,
      department           TEXT,
      date                 TEXT NOT NULL,
      time_in              TEXT,
      time_out             TEXT,
      status               TEXT NOT NULL DEFAULT 'present',
      minutes_late         INTEGER NOT NULL DEFAULT 0,
      overtime_minutes     INTEGER NOT NULL DEFAULT 0,
      undertime_minutes    INTEGER NOT NULL DEFAULT 0,
      night_diff_minutes   INTEGER NOT NULL DEFAULT 0,
      source               TEXT NOT NULL DEFAULT 'kiosk',
      device_id            TEXT,
      created_at           TEXT NOT NULL,
      synced               INTEGER NOT NULL DEFAULT 0,
      sync_attempts        INTEGER NOT NULL DEFAULT 0,
      last_sync_at         TEXT,
      sync_error           TEXT,
      sync_error_category  TEXT,
      next_retry_at        TEXT
    );

    -- Device config key-value store
    CREATE TABLE IF NOT EXISTS device_config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Local employee cache (refreshed from Supabase when online)
    -- pin_hash / rfid_hash: SHA-256 hex digests — same algorithm as the web app.
    -- Older installs may have pin_code / rfid_tag columns; the addColumn block
    -- below adds pin_hash / rfid_hash on first run without dropping the DB.
    CREATE TABLE IF NOT EXISTS employee_cache (
      id          TEXT PRIMARY KEY,
      employee_no TEXT,
      full_name   TEXT NOT NULL,
      pin_hash    TEXT,
      rfid_hash   TEXT,
      shift_id    TEXT,
      department  TEXT,
      position    TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      cached_at   TEXT NOT NULL
    );

    -- Local shift cache (used to compute late/OT/undertime offline)
    CREATE TABLE IF NOT EXISTS shifts_cache (
      id                         TEXT PRIMARY KEY,
      name                       TEXT NOT NULL,
      time_in                    TEXT NOT NULL,
      time_out                   TEXT NOT NULL,
      break_minutes              INTEGER NOT NULL DEFAULT 60,
      grace_minutes              INTEGER NOT NULL DEFAULT 15,
      overtime_threshold_minutes INTEGER DEFAULT 30,
      cached_at                  TEXT NOT NULL
    );

    -- Holiday cache (next 90 days, downloaded on refresh)
    CREATE TABLE IF NOT EXISTS holidays_cache (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      date      TEXT NOT NULL,    -- YYYY-MM-DD
      type      TEXT NOT NULL,    -- 'regular' | 'special-non-working' | 'special-working'
      cached_at TEXT NOT NULL
    );

    -- PIN brute-force rate limiting (device-wide, resets on restart)
    CREATE TABLE IF NOT EXISTS pin_attempts (
      id           TEXT PRIMARY KEY DEFAULT 'kiosk',
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_attempt TEXT NOT NULL DEFAULT (datetime('now'))
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

  // Safe column migrations for existing DBs
  const addColumn = (tbl: string, col: string, def: string) => {
    try { db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`) } catch { /* already exists */ }
  }
  addColumn('attendance_queue', 'night_diff_minutes',  'INTEGER NOT NULL DEFAULT 0')
  addColumn('attendance_queue', 'sync_error_category', 'TEXT')
  addColumn('attendance_queue', 'next_retry_at',       'TEXT')
  // NOTE: NOT NULL with function-expression DEFAULT is forbidden in ALTER TABLE in SQLite,
  // so use a nullable TEXT and let the app fill it in at write-time.
  addColumn('device_config',    'updated_at',          'TEXT')
  // Migrate employee_cache from old bcrypt/plaintext scheme (pin_code, rfid_tag)
  // to SHA-256 hashes (pin_hash, rfid_hash) matching the web app.
  addColumn('employee_cache', 'pin_hash',  'TEXT')
  addColumn('employee_cache', 'rfid_hash', 'TEXT')

  // M3: Index for fast today's-record lookup during checkin
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_queue_emp_date
      ON attendance_queue (employee_id, date);
  `)

  // H5: Clean up permanently abandoned sync records (≥50 attempts AND older than 30 days).
  // These will never succeed — likely the employee was deleted or the DB schema changed.
  // Removed here to prevent indefinite accumulation and a permanently elevated failed badge.
  db.exec(`
    DELETE FROM attendance_queue
    WHERE synced = 0
      AND sync_attempts >= 50
      AND created_at < datetime('now', '-30 days');
  `)

  // Ensure pin_attempts row exists
  db.prepare(`INSERT OR IGNORE INTO pin_attempts (id, last_attempt) VALUES ('kiosk', datetime('now'))`).run()
}

// ─── Device Config ────────────────────────────────────────────────────────────
export function getConfig(key: string): string | null {
  const row = db.prepare('SELECT value FROM device_config WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  // INSERT OR REPLACE is used (not ON CONFLICT … DO UPDATE) so that the query
  // works even on old databases that don't yet have the updated_at column.
  db.prepare('INSERT OR REPLACE INTO device_config (key, value) VALUES (?, ?)').run(key, value)
}

/** Returns the device UUID, auto-generating and persisting one on first call. */
export function getOrCreateDeviceId(): string {
  let id = getConfig('device_id')
  if (!id) {
    id = uuid()
    setConfig('device_id', id)
    console.log(`[DB] Generated device_id: ${id}`)
  }
  return id
}

// ─── Employee Cache ───────────────────────────────────────────────────────────
// pin_hash / rfid_hash: SHA-256(HASH_SALT + rawValue) hex string.
// Must match the algorithm in the web app's src/lib/utils/hash.ts.
export interface CachedEmployee {
  id: string
  employee_no: string
  full_name: string
  pin_hash:  string | null   // was pin_code (bcrypt) — now SHA-256 hex
  rfid_hash: string | null   // was rfid_tag (plaintext) — now SHA-256 hex
  shift_id: string | null
  department: string | null
  position: string | null
  status: string
}

export function getEmployeeCache(): CachedEmployee[] {
  return db.prepare('SELECT * FROM employee_cache WHERE status = ?').all('active') as CachedEmployee[]
}

export function replaceEmployeeCache(employees: CachedEmployee[]): void {
  const now    = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR REPLACE INTO employee_cache
    (id, employee_no, full_name, pin_hash, rfid_hash, shift_id, department, position, status, cached_at)
    VALUES (@id, @employee_no, @full_name, @pin_hash, @rfid_hash, @shift_id, @department, @position, @status, @cached_at)
  `)
  db.transaction((emps: CachedEmployee[]) => {
    db.prepare('DELETE FROM employee_cache').run()
    for (const e of emps) insert.run({ ...e, cached_at: now })
  })(employees)
}

/** Timestamp of the last employee cache refresh, or null if never refreshed. */
export function getEmployeeCacheAge(): string | null {
  const row = db.prepare('SELECT cached_at FROM employee_cache ORDER BY cached_at DESC LIMIT 1').get() as
    { cached_at: string } | undefined
  return row?.cached_at ?? null
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
  const now    = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR REPLACE INTO shifts_cache
    (id, name, time_in, time_out, break_minutes, grace_minutes, overtime_threshold_minutes, cached_at)
    VALUES (@id, @name, @time_in, @time_out, @break_minutes, @grace_minutes, @overtime_threshold_minutes, @cached_at)
  `)
  db.transaction((s: CachedShift[]) => {
    db.prepare('DELETE FROM shifts_cache').run()
    for (const sh of s) insert.run({ ...sh, cached_at: now })
  })(shifts)
}

export function getShift(shiftId: string | null): CachedShift | null {
  if (!shiftId) return null
  return db.prepare('SELECT * FROM shifts_cache WHERE id = ?').get(shiftId) as CachedShift | null
}

// ─── Holidays Cache ───────────────────────────────────────────────────────────
export interface CachedHoliday {
  id: string
  name: string
  date: string   // YYYY-MM-DD
  type: string   // 'regular' | 'special-non-working' | 'special-working'
}

export function replaceHolidaysCache(holidays: CachedHoliday[]): void {
  const now    = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR REPLACE INTO holidays_cache (id, name, date, type, cached_at)
    VALUES (@id, @name, @date, @type, @cached_at)
  `)
  db.transaction((hols: CachedHoliday[]) => {
    // Only purge dates >= today to avoid re-downloading old holidays
    const today = new Date().toISOString().split('T')[0]
    db.prepare('DELETE FROM holidays_cache WHERE date >= ?').run(today)
    for (const h of hols) insert.run({ ...h, cached_at: now })
  })(holidays)
}

// C1: Use machine local date — toISOString() returns UTC, which is the wrong
// calendar day in Philippines (UTC+8) between midnight and 8 AM local.
function _localDateString(): string {
  return new Date().toLocaleDateString('en-CA')   // always YYYY-MM-DD in local tz
}

/** Returns today's BLOCKING holiday (regular or special-non-working). Returns null for special-working. */
export function getTodayHoliday(): CachedHoliday | null {
  const today = _localDateString()
  const row   = db.prepare(
    `SELECT * FROM holidays_cache WHERE date = ? AND type IN ('regular','special-non-working') LIMIT 1`
  ).get(today) as CachedHoliday | undefined
  return row ?? null
}

/**
 * M6: Returns today's special-working holiday if any — non-blocking but triggers a
 * yellow informational notice on the kiosk screen so HR knows premium pay applies.
 */
export function getTodaySpecialWorkingHoliday(): CachedHoliday | null {
  const today = _localDateString()
  const row   = db.prepare(
    `SELECT * FROM holidays_cache WHERE date = ? AND type = 'special-working' LIMIT 1`
  ).get(today) as CachedHoliday | undefined
  return row ?? null
}

// ─── PIN Rate Limiting ────────────────────────────────────────────────────────
const PIN_MAX_ATTEMPTS = 5
const PIN_LOCKOUT_MS   = 2 * 60 * 1000   // 2 minutes

export interface PinAttemptStatus {
  allowed: boolean
  lockedUntil: string | null
  remainingSeconds: number
}

export function checkPinAllowed(): PinAttemptStatus {
  const row = db.prepare('SELECT failed_count, locked_until FROM pin_attempts WHERE id = ?').get('kiosk') as
    { failed_count: number; locked_until: string | null } | undefined

  if (!row) return { allowed: true, lockedUntil: null, remainingSeconds: 0 }

  if (row.locked_until) {
    const unlockAt = new Date(row.locked_until).getTime()
    const now      = Date.now()
    if (now < unlockAt) {
      return {
        allowed:          false,
        lockedUntil:      row.locked_until,
        remainingSeconds: Math.ceil((unlockAt - now) / 1000),
      }
    }
    // Lockout expired — reset
    db.prepare(`UPDATE pin_attempts SET failed_count = 0, locked_until = NULL WHERE id = ?`).run('kiosk')
  }

  return { allowed: true, lockedUntil: null, remainingSeconds: 0 }
}

export function recordPinFailure(): PinAttemptStatus {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE pin_attempts
    SET failed_count = failed_count + 1, last_attempt = ?
    WHERE id = ?
  `).run(now, 'kiosk')

  const row = db.prepare('SELECT failed_count FROM pin_attempts WHERE id = ?').get('kiosk') as
    { failed_count: number }

  if (row.failed_count >= PIN_MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString()
    db.prepare('UPDATE pin_attempts SET locked_until = ? WHERE id = ?').run(lockedUntil, 'kiosk')
    return { allowed: false, lockedUntil, remainingSeconds: PIN_LOCKOUT_MS / 1000 }
  }

  return { allowed: true, lockedUntil: null, remainingSeconds: 0 }
}

export function resetPinAttempts(): void {
  db.prepare(`UPDATE pin_attempts SET failed_count = 0, locked_until = NULL WHERE id = ?`).run('kiosk')
}

// ─── Attendance Queue ─────────────────────────────────────────────────────────
export interface AttendanceInput {
  employee_id: string
  employee_no: string
  full_name: string
  department: string | null
  shift_id: string | null
  date: string
  now: string
}

export interface UpsertResult {
  type: 'time-in' | 'time-out'
  id: string
}

export function upsertAttendance(input: AttendanceInput): UpsertResult {
  const deviceId = getOrCreateDeviceId()
  const shift    = getShift(input.shift_id)

  // C1: input.date is already computed with _localDateString() in index.ts
  // Find existing record for today (the M3 index on (employee_id, date) makes this fast)
  const existing = db.prepare(`
    SELECT id, time_in, time_out FROM attendance_queue
    WHERE employee_id = ? AND date = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(input.employee_id, input.date) as
    { id: string; time_in: string | null; time_out: string | null } | undefined

  // ── Guard: shift already complete ─────────────────────────────────────────
  // Matches web kiosk rule in _kioskCheckin: if both time_in and time_out exist
  // for today, the shift is done — reject any further scan to avoid data loss.
  if (existing?.time_in && existing?.time_out) {
    throw new Error(
      `${input.full_name} — Shift already complete for today. ` +
      'Contact HR if a correction is needed.'
    )
  }

  if (!existing) {
    // ── TIME-IN ────────────────────────────────────────────────────────────
    const minutesLate = _computeLate(input.now, shift)
    const status      = minutesLate > 0 ? 'late' : 'present'
    const id          = uuid()

    db.prepare(`
      INSERT INTO attendance_queue
      (id, employee_id, employee_no, full_name, department,
       date, time_in, status, minutes_late, night_diff_minutes,
       source, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'kiosk', ?, ?)
    `).run(id, input.employee_id, input.employee_no, input.full_name,
           input.department, input.date, input.now, status,
           minutesLate, deviceId, input.now)

    _recordCheckin(input.employee_id, input.full_name, input.department, 'time-in', input.now)
    return { type: 'time-in', id }

  } else {
    // ── TIME-OUT ───────────────────────────────────────────────────────────
    // existing.time_in is non-null and time_out is null (guard above handles the rest)
    const { ot, ut }   = _computeOTandUT(input.now, shift)
    const nightDiff    = _computeNightDiff(existing.time_in!, input.now)

    db.prepare(`
      UPDATE attendance_queue
      SET time_out = ?, overtime_minutes = ?, undertime_minutes = ?,
          night_diff_minutes = ?, synced = 0
      WHERE id = ?
    `).run(input.now, ot, ut, nightDiff, existing.id)

    _recordCheckin(input.employee_id, input.full_name, input.department, 'time-out', input.now)
    return { type: 'time-out', id: existing.id }
  }
}

// ── Computation helpers ───────────────────────────────────────────────────────

/** Minutes past the grace deadline (time-in). Returns 0 if on time. */
function _computeLate(nowIso: string, shift: CachedShift | null): number {
  if (!shift) return 0
  const [h, m]   = shift.time_in.split(':').map(Number)
  const deadline = new Date(nowIso)
  deadline.setHours(h, m + shift.grace_minutes, 0, 0)
  const actual   = new Date(nowIso)
  return actual > deadline ? Math.round((actual.getTime() - deadline.getTime()) / 60_000) : 0
}

/** Overtime and undertime minutes relative to scheduled time_out. */
function _computeOTandUT(nowIso: string, shift: CachedShift | null): { ot: number; ut: number } {
  if (!shift) return { ot: 0, ut: 0 }
  const [h, m]     = shift.time_out.split(':').map(Number)
  const expected   = new Date(nowIso)
  expected.setHours(h, m, 0, 0)
  const actual     = new Date(nowIso)
  const diff       = Math.round((actual.getTime() - expected.getTime()) / 60_000)
  const threshold  = shift.overtime_threshold_minutes ?? 0
  if (diff >= threshold && diff > 0) return { ot: diff, ut: 0 }
  if (diff < 0)                      return { ot: 0,    ut: Math.abs(diff) }
  return { ot: 0, ut: 0 }
}

/**
 * Night differential minutes: Philippines labor code — 10% extra for hours
 * worked between 22:00 and 06:00.  Computed at time-out when both boundaries
 * are known.
 */
function _computeNightDiff(timeInIso: string, timeOutIso: string): number {
  const start = new Date(timeInIso).getTime()
  const end   = new Date(timeOutIso).getTime()
  if (end <= start) return 0

  // Build the two possible night windows that could overlap with [start, end]
  const refDate = new Date(timeInIso)

  // Window A: 22:00 on timeIn's date → 06:00 next day
  const wA_start = new Date(refDate); wA_start.setHours(22, 0, 0, 0)
  const wA_end   = new Date(wA_start); wA_end.setDate(wA_end.getDate() + 1); wA_end.setHours(6, 0, 0, 0)

  // Window B: 22:00 previous day → 06:00 on timeIn's date (covers overnight-in shifts)
  const wB_end   = new Date(refDate); wB_end.setHours(6, 0, 0, 0)
  const wB_start = new Date(wB_end);  wB_start.setDate(wB_start.getDate() - 1); wB_start.setHours(22, 0, 0, 0)

  let nightMinutes = 0
  for (const [ws, we] of [[wB_start.getTime(), wB_end.getTime()], [wA_start.getTime(), wA_end.getTime()]]) {
    const overlapStart = Math.max(start, ws)
    const overlapEnd   = Math.min(end,   we)
    if (overlapEnd > overlapStart) {
      nightMinutes += Math.round((overlapEnd - overlapStart) / 60_000)
    }
  }
  return nightMinutes
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
  night_diff_minutes: number
  source: string
  device_id: string
  created_at: string
  sync_attempts: number
}

const MAX_SYNC_ATTEMPTS = 50

export function getPendingRecords(limit = 100): QueueRecord[] {
  const now = new Date().toISOString()
  return db.prepare(`
    SELECT * FROM attendance_queue
    WHERE synced = 0
      AND sync_attempts < ?
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY created_at ASC
    LIMIT ?
  `).all(MAX_SYNC_ATTEMPTS, now, limit) as QueueRecord[]
}

export function markSynced(ids: string[]): void {
  if (!ids.length) return
  const now    = new Date().toISOString()
  const update = db.prepare(
    'UPDATE attendance_queue SET synced = 1, last_sync_at = ?, next_retry_at = NULL WHERE id = ?'
  )
  db.transaction((list: string[]) => { for (const id of list) update.run(now, id) })(ids)
}

export function markFailed(ids: string[], error: string, category: 'network' | 'constraint' | 'rls' | 'unknown' = 'unknown'): void {
  if (!ids.length) return
  const now = new Date().toISOString()

  // Exponential backoff: min(30s * 2^attempts, 15min) + small jitter
  const update = db.prepare(`
    UPDATE attendance_queue
    SET sync_attempts       = sync_attempts + 1,
        sync_error          = ?,
        sync_error_category = ?,
        last_sync_at        = ?,
        next_retry_at       = datetime('now', '+' || min(30 * (1 << min(sync_attempts, 5)), 900) || ' seconds')
    WHERE id = ?
  `)
  db.transaction((list: string[]) => {
    for (const id of list) update.run(error, category, now, id)
  })(ids)
}

// 'rls' / 'constraint' errors will never succeed by retrying (e.g. a unique-
// constraint clash because HR already entered the record, or an RLS policy
// gap). Counting them as "pending" left the sync badge stuck orange for up
// to 50 retries (hours) even though the device was fully online — they now
// count as "failed" immediately so the badge reflects reality.
export function getPendingCount(): number {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_queue
    WHERE synced = 0
      AND sync_attempts < ?
      AND (sync_error_category IS NULL OR sync_error_category NOT IN ('rls', 'constraint'))
  `).get(MAX_SYNC_ATTEMPTS) as { cnt: number }
  return row.cnt
}

export function getFailedCount(): number {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_queue
    WHERE synced = 0
      AND (sync_attempts >= ? OR sync_error_category IN ('rls', 'constraint'))
  `).get(MAX_SYNC_ATTEMPTS) as { cnt: number }
  return row.cnt
}
