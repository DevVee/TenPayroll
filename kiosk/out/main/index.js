"use strict";
const electron = require("electron");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const uuid = require("uuid");
const supabaseJs = require("@supabase/supabase-js");
const ws = require("ws");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
let db;
function initDB() {
  const dbPath = path.join(electron.app.getPath("userData"), "kiosk.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = FULL");
  db.pragma("cache_size = -32000");
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
  `);
  const addColumn = (tbl, col, def) => {
    try {
      db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`);
    } catch {
    }
  };
  addColumn("attendance_queue", "night_diff_minutes", "INTEGER NOT NULL DEFAULT 0");
  addColumn("attendance_queue", "sync_error_category", "TEXT");
  addColumn("attendance_queue", "next_retry_at", "TEXT");
  addColumn("device_config", "updated_at", "TEXT");
  addColumn("employee_cache", "pin_hash", "TEXT");
  addColumn("employee_cache", "rfid_hash", "TEXT");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_queue_emp_date
      ON attendance_queue (employee_id, date);
  `);
  db.exec(`
    DELETE FROM attendance_queue
    WHERE synced = 0
      AND sync_attempts >= 50
      AND created_at < datetime('now', '-30 days');
  `);
  db.prepare(`INSERT OR IGNORE INTO pin_attempts (id, last_attempt) VALUES ('kiosk', datetime('now'))`).run();
}
function getConfig(key) {
  const row = db.prepare("SELECT value FROM device_config WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setConfig(key, value) {
  db.prepare("INSERT OR REPLACE INTO device_config (key, value) VALUES (?, ?)").run(key, value);
}
function getOrCreateDeviceId() {
  let id = getConfig("device_id");
  if (!id) {
    id = uuid.v4();
    setConfig("device_id", id);
    console.log(`[DB] Generated device_id: ${id}`);
  }
  return id;
}
function getEmployeeCache() {
  return db.prepare("SELECT * FROM employee_cache WHERE status = ?").all("active");
}
function replaceEmployeeCache(employees) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO employee_cache
    (id, employee_no, full_name, pin_hash, rfid_hash, shift_id, department, position, status, cached_at)
    VALUES (@id, @employee_no, @full_name, @pin_hash, @rfid_hash, @shift_id, @department, @position, @status, @cached_at)
  `);
  db.transaction((emps) => {
    db.prepare("DELETE FROM employee_cache").run();
    for (const e of emps) insert.run({ ...e, cached_at: now });
  })(employees);
}
function getEmployeeCacheAge() {
  const row = db.prepare("SELECT cached_at FROM employee_cache ORDER BY cached_at DESC LIMIT 1").get();
  return row?.cached_at ?? null;
}
function replaceShiftsCache(shifts) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO shifts_cache
    (id, name, time_in, time_out, break_minutes, grace_minutes, overtime_threshold_minutes, cached_at)
    VALUES (@id, @name, @time_in, @time_out, @break_minutes, @grace_minutes, @overtime_threshold_minutes, @cached_at)
  `);
  db.transaction((s) => {
    db.prepare("DELETE FROM shifts_cache").run();
    for (const sh of s) insert.run({ ...sh, cached_at: now });
  })(shifts);
}
function getShift(shiftId) {
  if (!shiftId) return null;
  return db.prepare("SELECT * FROM shifts_cache WHERE id = ?").get(shiftId);
}
function replaceHolidaysCache(holidays) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO holidays_cache (id, name, date, type, cached_at)
    VALUES (@id, @name, @date, @type, @cached_at)
  `);
  db.transaction((hols) => {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    db.prepare("DELETE FROM holidays_cache WHERE date >= ?").run(today);
    for (const h of hols) insert.run({ ...h, cached_at: now });
  })(holidays);
}
function _localDateString() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA");
}
function getTodayHoliday() {
  const today = _localDateString();
  const row = db.prepare(
    `SELECT * FROM holidays_cache WHERE date = ? AND type IN ('regular','special-non-working') LIMIT 1`
  ).get(today);
  return row ?? null;
}
function getTodaySpecialWorkingHoliday() {
  const today = _localDateString();
  const row = db.prepare(
    `SELECT * FROM holidays_cache WHERE date = ? AND type = 'special-working' LIMIT 1`
  ).get(today);
  return row ?? null;
}
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 2 * 60 * 1e3;
function checkPinAllowed() {
  const row = db.prepare("SELECT failed_count, locked_until FROM pin_attempts WHERE id = ?").get("kiosk");
  if (!row) return { allowed: true, lockedUntil: null, remainingSeconds: 0 };
  if (row.locked_until) {
    const unlockAt = new Date(row.locked_until).getTime();
    const now = Date.now();
    if (now < unlockAt) {
      return {
        allowed: false,
        lockedUntil: row.locked_until,
        remainingSeconds: Math.ceil((unlockAt - now) / 1e3)
      };
    }
    db.prepare(`UPDATE pin_attempts SET failed_count = 0, locked_until = NULL WHERE id = ?`).run("kiosk");
  }
  return { allowed: true, lockedUntil: null, remainingSeconds: 0 };
}
function recordPinFailure() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare(`
    UPDATE pin_attempts
    SET failed_count = failed_count + 1, last_attempt = ?
    WHERE id = ?
  `).run(now, "kiosk");
  const row = db.prepare("SELECT failed_count FROM pin_attempts WHERE id = ?").get("kiosk");
  if (row.failed_count >= PIN_MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString();
    db.prepare("UPDATE pin_attempts SET locked_until = ? WHERE id = ?").run(lockedUntil, "kiosk");
    return { allowed: false, lockedUntil, remainingSeconds: PIN_LOCKOUT_MS / 1e3 };
  }
  return { allowed: true, lockedUntil: null, remainingSeconds: 0 };
}
function resetPinAttempts() {
  db.prepare(`UPDATE pin_attempts SET failed_count = 0, locked_until = NULL WHERE id = ?`).run("kiosk");
}
function upsertAttendance(input) {
  const deviceId = getOrCreateDeviceId();
  const shift = getShift(input.shift_id);
  const existing = db.prepare(`
    SELECT id, time_in, time_out FROM attendance_queue
    WHERE employee_id = ? AND date = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(input.employee_id, input.date);
  if (existing?.time_in && existing?.time_out) {
    throw new Error(
      `${input.full_name} — Shift already complete for today. Contact HR if a correction is needed.`
    );
  }
  if (!existing) {
    const minutesLate = _computeLate(input.now, shift);
    const status = minutesLate > 0 ? "late" : "present";
    const id = uuid.v4();
    db.prepare(`
      INSERT INTO attendance_queue
      (id, employee_id, employee_no, full_name, department,
       date, time_in, status, minutes_late, night_diff_minutes,
       source, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'kiosk', ?, ?)
    `).run(
      id,
      input.employee_id,
      input.employee_no,
      input.full_name,
      input.department,
      input.date,
      input.now,
      status,
      minutesLate,
      deviceId,
      input.now
    );
    _recordCheckin(input.employee_id, input.full_name, input.department, "time-in", input.now);
    return { type: "time-in", id };
  } else {
    const { ot, ut } = _computeOTandUT(input.now, shift);
    const nightDiff = _computeNightDiff(existing.time_in, input.now);
    db.prepare(`
      UPDATE attendance_queue
      SET time_out = ?, overtime_minutes = ?, undertime_minutes = ?,
          night_diff_minutes = ?, synced = 0
      WHERE id = ?
    `).run(input.now, ot, ut, nightDiff, existing.id);
    _recordCheckin(input.employee_id, input.full_name, input.department, "time-out", input.now);
    return { type: "time-out", id: existing.id };
  }
}
function _computeLate(nowIso, shift) {
  if (!shift) return 0;
  const [h, m] = shift.time_in.split(":").map(Number);
  const deadline = new Date(nowIso);
  deadline.setHours(h, m + shift.grace_minutes, 0, 0);
  const actual = new Date(nowIso);
  return actual > deadline ? Math.round((actual.getTime() - deadline.getTime()) / 6e4) : 0;
}
function _computeOTandUT(nowIso, shift) {
  if (!shift) return { ot: 0, ut: 0 };
  const [h, m] = shift.time_out.split(":").map(Number);
  const expected = new Date(nowIso);
  expected.setHours(h, m, 0, 0);
  const actual = new Date(nowIso);
  const diff = Math.round((actual.getTime() - expected.getTime()) / 6e4);
  const threshold = shift.overtime_threshold_minutes ?? 0;
  if (diff >= threshold && diff > 0) return { ot: diff, ut: 0 };
  if (diff < 0) return { ot: 0, ut: Math.abs(diff) };
  return { ot: 0, ut: 0 };
}
function _computeNightDiff(timeInIso, timeOutIso) {
  const start = new Date(timeInIso).getTime();
  const end = new Date(timeOutIso).getTime();
  if (end <= start) return 0;
  const refDate = new Date(timeInIso);
  const wA_start = new Date(refDate);
  wA_start.setHours(22, 0, 0, 0);
  const wA_end = new Date(wA_start);
  wA_end.setDate(wA_end.getDate() + 1);
  wA_end.setHours(6, 0, 0, 0);
  const wB_end = new Date(refDate);
  wB_end.setHours(6, 0, 0, 0);
  const wB_start = new Date(wB_end);
  wB_start.setDate(wB_start.getDate() - 1);
  wB_start.setHours(22, 0, 0, 0);
  let nightMinutes = 0;
  for (const [ws2, we] of [[wB_start.getTime(), wB_end.getTime()], [wA_start.getTime(), wA_end.getTime()]]) {
    const overlapStart = Math.max(start, ws2);
    const overlapEnd = Math.min(end, we);
    if (overlapEnd > overlapStart) {
      nightMinutes += Math.round((overlapEnd - overlapStart) / 6e4);
    }
  }
  return nightMinutes;
}
function _recordCheckin(empId, fullName, dept, type, ts) {
  const id = uuid.v4();
  db.prepare(`
    INSERT INTO recent_checkins (id, employee_id, full_name, department, type, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, empId, fullName, dept, type, ts);
  db.prepare(`
    DELETE FROM recent_checkins WHERE id NOT IN (
      SELECT id FROM recent_checkins ORDER BY timestamp DESC LIMIT 50
    )
  `).run();
}
function getRecentCheckins(limit = 10) {
  return db.prepare("SELECT * FROM recent_checkins ORDER BY timestamp DESC LIMIT ?").all(limit);
}
const MAX_SYNC_ATTEMPTS = 50;
function getPendingRecords(limit = 100) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return db.prepare(`
    SELECT * FROM attendance_queue
    WHERE synced = 0
      AND sync_attempts < ?
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY created_at ASC
    LIMIT ?
  `).all(MAX_SYNC_ATTEMPTS, now, limit);
}
function markSynced(ids) {
  if (!ids.length) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const update = db.prepare(
    "UPDATE attendance_queue SET synced = 1, last_sync_at = ?, next_retry_at = NULL WHERE id = ?"
  );
  db.transaction((list) => {
    for (const id of list) update.run(now, id);
  })(ids);
}
function markFailed(ids, error, category = "unknown") {
  if (!ids.length) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const update = db.prepare(`
    UPDATE attendance_queue
    SET sync_attempts       = sync_attempts + 1,
        sync_error          = ?,
        sync_error_category = ?,
        last_sync_at        = ?,
        next_retry_at       = datetime('now', '+' || min(30 * (1 << min(sync_attempts, 5)), 900) || ' seconds')
    WHERE id = ?
  `);
  db.transaction((list) => {
    for (const id of list) update.run(error, category, now, id);
  })(ids);
}
function getPendingCount() {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_queue
    WHERE synced = 0
      AND sync_attempts < ?
      AND (sync_error_category IS NULL OR sync_error_category NOT IN ('rls', 'constraint'))
  `).get(MAX_SYNC_ATTEMPTS);
  return row.cnt;
}
function getFailedCount() {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_queue
    WHERE synced = 0
      AND (sync_attempts >= ? OR sync_error_category IN ('rls', 'constraint'))
  `).get(MAX_SYNC_ATTEMPTS);
  return row.cnt;
}
const SYNC_INTERVAL_MS = 3e4;
const OFFLINE_RETRY_MS = 3e4;
const ERROR_RETRY_MS = 15e3;
const HOLIDAY_LOOKAHEAD_DAYS = 90;
class SyncEngine {
  timer = null;
  _client = null;
  _online = false;
  _state = "idle";
  _lastSync = null;
  _lastError = null;
  _running = false;
  constructor() {
    const url = "https://paymnddcvkvtybcyjxhs.supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBheW1uZGRjdmt2dHliY3lqeGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Nzk4NDUsImV4cCI6MjA5NTQ1NTg0NX0.bUnu85nGRZEpwXBAGaV4gZ3t7ohD6KOUqIoBgIZHnI4";
    this._client = supabaseJs.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      realtime: {
        transport: ws
      }
    });
  }
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start() {
    if (this._running) return;
    this._running = true;
    this._scheduleNext(2e3);
    console.log("[SyncEngine] started");
  }
  stop() {
    this._running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log("[SyncEngine] stopped");
  }
  /** Trigger an immediate cycle (called right after a check-in while online). */
  nudge() {
    if (!this._running) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._scheduleNext(200);
  }
  // ── Status (read by IPC handler) ──────────────────────────────────────────
  getStatus() {
    return {
      online: this._online,
      pending: getPendingCount(),
      failed: 0,
      // filled in by index.ts using getFailedCount()
      state: this._state,
      lastSync: this._lastSync,
      lastError: this._lastError
    };
  }
  // ── Internal schedule ─────────────────────────────────────────────────────
  _scheduleNext(delayMs = SYNC_INTERVAL_MS) {
    if (!this._running) return;
    this.timer = setTimeout(() => this._cycle(), delayMs);
  }
  async _cycle() {
    if (!this._client) {
      this._state = "offline";
      this._scheduleNext(OFFLINE_RETRY_MS);
      return;
    }
    try {
      this._online = await this._checkOnline();
      if (this._online) {
        await this._flush();
        this._scheduleNext(SYNC_INTERVAL_MS);
      } else {
        this._state = "offline";
        this._scheduleNext(OFFLINE_RETRY_MS);
      }
    } catch (err) {
      this._state = "error";
      this._lastError = String(err);
      console.error("[SyncEngine] cycle error:", err);
      this._scheduleNext(ERROR_RETRY_MS);
    }
  }
  // ── Connectivity check ────────────────────────────────────────────────────
  async _checkOnline() {
    if (!this._client) return false;
    try {
      const { error } = await this._client.from("app_settings").select("id").limit(1).abortSignal(AbortSignal.timeout(5e3));
      return !error;
    } catch {
      return false;
    }
  }
  // ── Flush pending attendance records to Supabase ──────────────────────────
  async _flush() {
    if (!this._client) return;
    const records = getPendingRecords(100);
    if (!records.length) {
      this._state = "idle";
      return;
    }
    this._state = "syncing";
    console.log(`[SyncEngine] flushing ${records.length} record(s) to Supabase`);
    const batches = [];
    for (let i = 0; i < records.length; i += 20) batches.push(records.slice(i, i + 20));
    for (const batch of batches) {
      const payload = batch.map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        employee_name: r.full_name,
        employee_no: r.employee_no,
        department: r.department,
        date: r.date,
        time_in: r.time_in,
        time_out: r.time_out,
        status: r.status,
        minutes_late: r.minutes_late,
        overtime_minutes: r.overtime_minutes,
        undertime_minutes: r.undertime_minutes,
        night_diff_minutes: r.night_diff_minutes,
        source: "kiosk"
      }));
      try {
        const { error } = await this._client.from("attendance_records").upsert(payload, { onConflict: "employee_id,date" });
        if (error) {
          const category = error.code === "42501" || error.code === "23505" ? "rls" : error.message.toLowerCase().includes("network") || error.message.toLowerCase().includes("fetch") ? "network" : "constraint";
          markFailed(batch.map((r) => r.id), error.message, category);
          this._state = "error";
          this._lastError = error.message;
          console.error("[SyncEngine] upsert error:", error.message);
        } else {
          markSynced(batch.map((r) => r.id));
          this._lastSync = (/* @__PURE__ */ new Date()).toISOString();
          this._lastError = null;
          this._state = "idle";
          console.log(`[SyncEngine] synced ${batch.length} record(s)`);
        }
      } catch (err) {
        markFailed(batch.map((r) => r.id), String(err), "network");
        this._state = "error";
        this._lastError = String(err);
        console.error("[SyncEngine] flush network error:", err);
      }
    }
  }
  // ── Refresh ALL caches (employees + shifts + holidays) ────────────────────
  async refreshAllCaches() {
    if (!this._client) throw new Error("Supabase not configured");
    const online = await this._checkOnline();
    if (!online) throw new Error("Device is offline");
    await Promise.all([
      this._refreshEmployeesAndShifts(),
      this._refreshHolidays()
    ]);
  }
  async _refreshEmployeesAndShifts() {
    if (!this._client) return;
    const { data: employees, error: empErr } = await this._client.rpc("get_kiosk_employee_cache");
    if (empErr) throw new Error(`Employees fetch failed: ${empErr.message}`);
    const { data: shifts, error: shiftErr } = await this._client.from("work_shifts").select("id, name, time_in, time_out, break_minutes, grace_minutes, overtime_threshold_minutes");
    if (shiftErr) throw new Error(`Shifts fetch failed: ${shiftErr.message}`);
    if (!employees || employees.length === 0) {
      console.error(
        "[SyncEngine] CRITICAL: get_kiosk_employee_cache returned 0 employees — preserving existing local cache to maintain offline access. Check Supabase RLS policies and the get_kiosk_employee_cache function."
      );
    } else {
      replaceEmployeeCache(employees);
      console.log(`[SyncEngine] employee cache updated — ${employees.length} employees`);
    }
    if (!shifts || shifts.length === 0) {
      console.warn("[SyncEngine] Shifts fetch returned 0 results — preserving existing shift cache.");
    } else {
      replaceShiftsCache(shifts);
      console.log(`[SyncEngine] shift cache updated — ${shifts.length} shifts`);
    }
  }
  async _refreshHolidays() {
    if (!this._client) return;
    const today = /* @__PURE__ */ new Date();
    const startDate = today.toISOString().split("T")[0];
    const endDate = new Date(today.getTime() + HOLIDAY_LOOKAHEAD_DAYS * 864e5).toISOString().split("T")[0];
    const { data: holidays, error } = await this._client.from("holidays").select("id, name, date, type").gte("date", startDate).lte("date", endDate).order("date", { ascending: true });
    if (error) {
      console.warn(`[SyncEngine] Holiday fetch failed (non-fatal): ${error.message}`);
      return;
    }
    replaceHolidaysCache(holidays ?? []);
    console.log(`[SyncEngine] holidays refreshed — ${holidays?.length ?? 0} entries (${startDate} → ${endDate})`);
  }
  // Keep old method name as alias for backwards compat
  async refreshEmployeeCache() {
    return this.refreshAllCaches();
  }
}
let mainWindow = null;
let syncEngine = null;
const HASH_SALT = "pRuw6X6Z6FkdhaiiP0NPuLVMHHQ74aLnemcKTo0xQ6I=";
const ADMIN_PIN = "admin1234";
function hashValue(input) {
  return crypto.createHash("sha256").update(HASH_SALT + input, "utf8").digest("hex");
}
function localDateString() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA");
}
const CACHE_TTL_MS = 4 * 60 * 60 * 1e3;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,
    kiosk: true,
    frame: false,
    resizable: false,
    autoHideMenuBar: true,
    title: "TenPayroll Kiosk",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
process.on("unhandledRejection", (reason) => {
  console.error("[Kiosk] UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Kiosk] UNCAUGHT EXCEPTION:", err);
});
electron.app.whenReady().then(async () => {
  try {
    electronApp.setAppUserModelId("app.tenpayroll.kiosk");
    electron.app.on("browser-window-created", (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });
    initDB();
    const deviceId = getOrCreateDeviceId();
    console.log(`[Kiosk] Device ID: ${deviceId}`);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz !== "Asia/Manila") {
      console.warn(
        `[Kiosk] ⚠ Machine timezone is "${tz}" — expected "Asia/Manila". Late/OT calculations may be inaccurate. Set Windows timezone to (UTC+08:00) Manila.`
      );
    }
    if (!HASH_SALT) ;
    else {
      console.log(`[Kiosk] HASH_SALT is set (first 8 chars: ${HASH_SALT.slice(0, 8)}…)`);
    }
    syncEngine = new SyncEngine();
    syncEngine.start();
    _autoRefreshCacheIfStale().catch(
      (err) => console.warn("[Kiosk] Initial cache refresh skipped:", String(err))
    );
    createWindow();
    electron.globalShortcut.register("CommandOrControl+Alt+Q", () => {
      const exitAt = (/* @__PURE__ */ new Date()).toISOString();
      console.log(`[Kiosk] EXIT via keyboard shortcut (Ctrl+Alt+Q) at ${exitAt}`);
      try {
        setConfig("last_kiosk_exit", JSON.stringify({ at: exitAt, via: "keyboard_shortcut" }));
      } catch (e) {
        console.error("[Kiosk] Could not write exit log to DB:", e);
      }
      const win = electron.BrowserWindow.getFocusedWindow() ?? mainWindow;
      win?.setKiosk(false);
      win?.setFullScreen(false);
      win?.restore();
    });
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    console.error("[Kiosk] STARTUP ERROR — app will show error window:", err);
    const errWin = new electron.BrowserWindow({ width: 800, height: 400, kiosk: false });
    errWin.loadURL(`data:text/html,<pre style="padding:24px;font-size:14px;color:red">
      TenPayroll Kiosk failed to start:

${String(err)}
    </pre>`);
  }
});
electron.app.on("window-all-closed", () => {
  electron.globalShortcut.unregisterAll();
  syncEngine?.stop();
  if (process.platform !== "darwin") electron.app.quit();
});
async function _autoRefreshCacheIfStale() {
  const cachedAt = getEmployeeCacheAge();
  if (cachedAt) {
    const ageMs = Date.now() - new Date(cachedAt).getTime();
    if (ageMs < CACHE_TTL_MS) {
      console.log(`[Kiosk] Employee cache is fresh (${Math.round(ageMs / 6e4)} min old) — skip refresh`);
      return;
    }
  }
  console.log("[Kiosk] Employee cache is stale or empty — refreshing from Supabase…");
  await syncEngine?.refreshAllCaches();
}
electron.ipcMain.handle("kiosk:pin-checkin", async (_, pin) => {
  try {
    const attempt = checkPinAllowed();
    if (!attempt.allowed) {
      return {
        success: false,
        error: `Too many failed attempts. Please wait ${attempt.remainingSeconds} seconds.`
      };
    }
    const holiday = getTodayHoliday();
    if (holiday) {
      return {
        success: false,
        error: `Today is a holiday: ${holiday.name}. Attendance kiosk is disabled.`
      };
    }
    const pinHash = hashValue(pin);
    const employees = getEmployeeCache();
    const employee = employees.find(
      (e) => e.pin_hash != null && e.status === "active" && e.pin_hash === pinHash
    );
    if (!employee) {
      recordPinFailure();
      return { success: false, error: "Unknown PIN. Please contact HR." };
    }
    resetPinAttempts();
    const today = localDateString();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = upsertAttendance({
      employee_id: employee.id,
      employee_no: employee.employee_no,
      full_name: employee.full_name,
      department: employee.department,
      shift_id: employee.shift_id,
      date: today,
      now
    });
    syncEngine?.nudge();
    return {
      success: true,
      type: record.type,
      employee: { fullName: employee.full_name, department: employee.department, position: employee.position },
      message: `${employee.full_name} — ${record.type === "time-in" ? "Time In" : "Time Out"} recorded`
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
electron.ipcMain.handle("kiosk:rfid-checkin", async (_, rfid) => {
  try {
    const attempt = checkPinAllowed();
    if (!attempt.allowed) {
      return {
        success: false,
        error: `Too many failed attempts. Please wait ${attempt.remainingSeconds} seconds.`
      };
    }
    const holiday = getTodayHoliday();
    if (holiday) {
      return {
        success: false,
        error: `Today is a holiday: ${holiday.name}. Attendance kiosk is disabled.`
      };
    }
    const rfidHash = hashValue(rfid.trim().toUpperCase());
    const employees = getEmployeeCache();
    const employee = employees.find((e) => e.rfid_hash === rfidHash && e.status === "active");
    if (!employee) {
      recordPinFailure();
      return { success: false, error: "Card not recognized. Please contact HR." };
    }
    resetPinAttempts();
    const today = localDateString();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = upsertAttendance({
      employee_id: employee.id,
      employee_no: employee.employee_no,
      full_name: employee.full_name,
      department: employee.department,
      shift_id: employee.shift_id,
      date: today,
      now
    });
    syncEngine?.nudge();
    return {
      success: true,
      type: record.type,
      employee: { fullName: employee.full_name, department: employee.department, position: employee.position },
      message: `${employee.full_name} — ${record.type === "time-in" ? "Time In" : "Time Out"} recorded`
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
electron.ipcMain.handle("kiosk:recent-checkins", () => getRecentCheckins(10));
electron.ipcMain.handle("kiosk:sync-status", () => {
  const base = syncEngine?.getStatus() ?? { online: false, pending: 0, state: "unknown", lastSync: null, lastError: null };
  return {
    ...base,
    pending: getPendingCount(),
    failed: getFailedCount()
  };
});
electron.ipcMain.handle("kiosk:today-holiday", () => getTodayHoliday());
electron.ipcMain.handle("kiosk:refresh-employees", async () => {
  try {
    await syncEngine?.refreshAllCaches();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
electron.ipcMain.handle("kiosk:force-sync", async () => {
  try {
    syncEngine?.nudge();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});
electron.ipcMain.handle("kiosk:today-special-holiday", () => getTodaySpecialWorkingHoliday());
electron.ipcMain.handle("kiosk:exit", (_, pin) => {
  {
    const a = Buffer.from(pin.padEnd(64), "utf8");
    const b = Buffer.from(ADMIN_PIN.padEnd(64), "utf8");
    const match = a.length === b.length && a.every((byte, i) => byte === b[i]);
    if (!match) {
      return { success: false, error: "Wrong admin PIN." };
    }
  }
  const exitAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`[Kiosk] EXIT via admin PIN modal at ${exitAt}`);
  try {
    setConfig("last_kiosk_exit", JSON.stringify({ at: exitAt, via: "admin_pin_modal" }));
  } catch (e) {
    console.error("[Kiosk] Could not write exit log to DB:", e);
  }
  mainWindow?.setKiosk(false);
  mainWindow?.setFullScreen(false);
  mainWindow?.restore();
  return { success: true };
});
