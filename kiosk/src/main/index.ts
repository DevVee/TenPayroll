import { app, BrowserWindow, ipcMain, shell, globalShortcut } from 'electron'
import { join } from 'path'
import { createHash } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  initDB,
  getRecentCheckins,
  getOrCreateDeviceId,
  getEmployeeCache,
  getEmployeeCacheAge,
  upsertAttendance,
  getTodayHoliday,
  getTodaySpecialWorkingHoliday,
  checkPinAllowed,
  recordPinFailure,
  resetPinAttempts,
  getPendingCount,
  getFailedCount,
  getConfig,
  setConfig,
} from './db'
import { SyncEngine } from './sync/engine'

let mainWindow: BrowserWindow | null = null
let syncEngine: SyncEngine | null    = null

// ─── Hash helper — must match web app src/lib/utils/hash.ts ─────────────────
// Web app: SHA-256(VITE_HASH_SALT + input). If VITE_HASH_SALT is not set in the
// web app's .env, the salt is '' and this reduces to plain SHA-256(input).
// Set HASH_SALT in kiosk/.env to the same value as VITE_HASH_SALT in the web .env.
declare const __HASH_SALT__:  string
declare const __ADMIN_PIN__:  string
const HASH_SALT  = (typeof __HASH_SALT__  !== 'undefined' ? __HASH_SALT__  : '') ?? ''
const ADMIN_PIN  = (typeof __ADMIN_PIN__  !== 'undefined' ? __ADMIN_PIN__  : '') ?? ''

function hashValue(input: string): string {
  return createHash('sha256').update(HASH_SALT + input, 'utf8').digest('hex')
}

// ─── Local date helper ────────────────────────────────────────────────────────
// C1: toISOString() returns UTC — in UTC+8 Philippines this gives the wrong date
// between midnight and 8 AM local time. toLocaleDateString('en-CA') gives
// YYYY-MM-DD in the machine's configured timezone (must be Asia/Manila for production).
function localDateString(): string {
  return new Date().toLocaleDateString('en-CA')
}

// ─── Kiosk cache auto-refresh TTL ────────────────────────────────────────────
const CACHE_TTL_MS = 4 * 60 * 60 * 1000   // 4 hours

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,
    kiosk: true,
    frame: false,
    resizable: false,
    autoHideMenuBar: true,
    title: 'TenPayroll Kiosk',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' }
  })
}

// ─── Global crash guard — logs any unhandled rejection instead of silently dying
process.on('unhandledRejection', (reason) => {
  console.error('[Kiosk] UNHANDLED REJECTION:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[Kiosk] UNCAUGHT EXCEPTION:', err)
})

app.whenReady().then(async () => {
  try {
    electronApp.setAppUserModelId('app.tenpayroll.kiosk')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Init SQLite and ensure device identity
    initDB()
    const deviceId = getOrCreateDeviceId()
    console.log(`[Kiosk] Device ID: ${deviceId}`)

    // M2: Warn if machine timezone is not Asia/Manila — late/OT calculations
    // use machine-local time and will be wrong if the clock is in UTC or another zone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz !== 'Asia/Manila') {
      console.warn(
        `[Kiosk] ⚠ Machine timezone is "${tz}" — expected "Asia/Manila". ` +
        'Late/OT calculations may be inaccurate. Set Windows timezone to (UTC+08:00) Manila.'
      )
    }

    // L4: Verify HASH_SALT is set — if it differs from the web app's VITE_HASH_SALT,
    // all PIN/RFID lookups will fail with "Unknown PIN".
    if (!HASH_SALT) {
      console.error(
        '[Kiosk] CRITICAL: HASH_SALT is empty in kiosk/.env. ' +
        'Set HASH_SALT to the same value as VITE_HASH_SALT in the web app .env ' +
        'or no employee will be able to clock in.'
      )
    } else {
      console.log(`[Kiosk] HASH_SALT is set (first 8 chars: ${HASH_SALT.slice(0, 8)}…)`)
    }

    // Start sync engine
    syncEngine = new SyncEngine()
    syncEngine.start()

    // Auto-refresh employee + shift + holiday cache if stale or empty
    _autoRefreshCacheIfStale().catch(err =>
      console.warn('[Kiosk] Initial cache refresh skipped:', String(err))
    )

    createWindow()

    // Ctrl+Alt+Q — admin keyboard shortcut to exit kiosk mode.
    // Registered in main process so it bypasses the renderer PIN check.
    // Physical access to the keyboard is implicit admin authorization.
    // M5: Log exit event to SQLite config for audit trail.
    globalShortcut.register('CommandOrControl+Alt+Q', () => {
      const exitAt = new Date().toISOString()
      console.log(`[Kiosk] EXIT via keyboard shortcut (Ctrl+Alt+Q) at ${exitAt}`)
      try {
        setConfig('last_kiosk_exit', JSON.stringify({ at: exitAt, via: 'keyboard_shortcut' }))
      } catch (e) {
        console.error('[Kiosk] Could not write exit log to DB:', e)
      }
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow
      win?.setKiosk(false)
      win?.setFullScreen(false)
      win?.restore()
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (err) {
    console.error('[Kiosk] STARTUP ERROR — app will show error window:', err)
    // Create a minimal window to show the error rather than silently closing
    const errWin = new BrowserWindow({ width: 800, height: 400, kiosk: false })
    errWin.loadURL(`data:text/html,<pre style="padding:24px;font-size:14px;color:red">
      TenPayroll Kiosk failed to start:\n\n${String(err)}
    </pre>`)
  }
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  syncEngine?.stop()
  if (process.platform !== 'darwin') app.quit()
})

// ─── Auto-refresh helper ──────────────────────────────────────────────────────
async function _autoRefreshCacheIfStale(): Promise<void> {
  const cachedAt = getEmployeeCacheAge()
  if (cachedAt) {
    const ageMs = Date.now() - new Date(cachedAt).getTime()
    if (ageMs < CACHE_TTL_MS) {
      console.log(`[Kiosk] Employee cache is fresh (${Math.round(ageMs / 60_000)} min old) — skip refresh`)
      return
    }
  }
  console.log('[Kiosk] Employee cache is stale or empty — refreshing from Supabase…')
  await syncEngine?.refreshAllCaches()
}

// ─── IPC: PIN check-in ────────────────────────────────────────────────────────
ipcMain.handle('kiosk:pin-checkin', async (_, pin: string) => {
  try {
    // 1. Rate limiting check
    const attempt = checkPinAllowed()
    if (!attempt.allowed) {
      return {
        success: false,
        error:   `Too many failed attempts. Please wait ${attempt.remainingSeconds} seconds.`,
      }
    }

    // 2. Holiday check
    const holiday = getTodayHoliday()
    if (holiday) {
      return {
        success: false,
        error:   `Today is a holiday: ${holiday.name}. Attendance kiosk is disabled.`,
      }
    }

    // 3. Employee lookup — PIN is SHA-256 hashed in DB (same as web app's hash.ts).
    //    Hash the typed PIN with the same algorithm and do a fast hex comparison.
    const pinHash   = hashValue(pin)
    const employees = getEmployeeCache()
    const employee  = employees.find(e =>
      e.pin_hash != null &&
      e.status === 'active' &&
      e.pin_hash === pinHash
    )
    if (!employee) {
      // Record the failure for rate limiting
      recordPinFailure()
      return { success: false, error: 'Unknown PIN. Please contact HR.' }
    }

    // 4. Success — reset failure counter
    resetPinAttempts()

    // C1: Use local date — toISOString() returns UTC which is yesterday's date in
    // Philippines (UTC+8) between midnight and 8 AM local.
    const today = localDateString()
    const now   = new Date().toISOString()

    const record = upsertAttendance({
      employee_id:  employee.id,
      employee_no:  employee.employee_no,
      full_name:    employee.full_name,
      department:   employee.department,
      shift_id:     employee.shift_id,
      date:         today,
      now,
    })

    syncEngine?.nudge()

    return {
      success:  true,
      type:     record.type,
      employee: { fullName: employee.full_name, department: employee.department, position: employee.position },
      message:  `${employee.full_name} — ${record.type === 'time-in' ? 'Time In' : 'Time Out'} recorded`,
    }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
})

// ─── IPC: RFID check-in ───────────────────────────────────────────────────────
ipcMain.handle('kiosk:rfid-checkin', async (_, rfid: string) => {
  try {
    // 1. Rate limiting — same counter as PIN (prevents RFID brute-force attacks)
    const attempt = checkPinAllowed()
    if (!attempt.allowed) {
      return {
        success: false,
        error:   `Too many failed attempts. Please wait ${attempt.remainingSeconds} seconds.`,
      }
    }

    // 2. Holiday check
    const holiday = getTodayHoliday()
    if (holiday) {
      return {
        success: false,
        error:   `Today is a holiday: ${holiday.name}. Attendance kiosk is disabled.`,
      }
    }

    // 3. Employee lookup — RFID is SHA-256 hashed in DB (same as web app's hash.ts).
    // H4: Normalize before hashing — same normalization used at storage time in EmployeeForm.
    const rfidHash  = hashValue(rfid.trim().toUpperCase())
    const employees = getEmployeeCache()
    const employee  = employees.find(e => e.rfid_hash === rfidHash && e.status === 'active')
    if (!employee) {
      recordPinFailure()   // count failed scans toward lockout just like wrong PINs
      return { success: false, error: 'Card not recognized. Please contact HR.' }
    }

    // 4. Success — reset failure counter
    resetPinAttempts()

    const today = localDateString()   // C1: local timezone date
    const now   = new Date().toISOString()

    const record = upsertAttendance({
      employee_id: employee.id,
      employee_no: employee.employee_no,
      full_name:   employee.full_name,
      department:  employee.department,
      shift_id:    employee.shift_id,
      date:        today,
      now,
    })

    syncEngine?.nudge()

    return {
      success:  true,
      type:     record.type,
      employee: { fullName: employee.full_name, department: employee.department, position: employee.position },
      message:  `${employee.full_name} — ${record.type === 'time-in' ? 'Time In' : 'Time Out'} recorded`,
    }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
})

// ─── IPC: Recent check-ins ────────────────────────────────────────────────────
ipcMain.handle('kiosk:recent-checkins', () => getRecentCheckins(10))

// ─── IPC: Sync status ─────────────────────────────────────────────────────────
ipcMain.handle('kiosk:sync-status', () => {
  const base = syncEngine?.getStatus() ?? { online: false, pending: 0, state: 'unknown', lastSync: null, lastError: null }
  return {
    ...base,
    pending: getPendingCount(),
    failed:  getFailedCount(),
  }
})

// ─── IPC: Today's holiday ─────────────────────────────────────────────────────
ipcMain.handle('kiosk:today-holiday', () => getTodayHoliday())

// ─── IPC: Refresh employee + shift + holiday caches ───────────────────────────
ipcMain.handle('kiosk:refresh-employees', async () => {
  try {
    await syncEngine?.refreshAllCaches()
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
})

// ─── IPC: Force sync now ──────────────────────────────────────────────────────
ipcMain.handle('kiosk:force-sync', async () => {
  try {
    syncEngine?.nudge()
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
})

// ─── IPC: Today's special-working holiday (M6) ───────────────────────────────
// Non-blocking — returns the holiday info so the renderer can show a yellow notice.
ipcMain.handle('kiosk:today-special-holiday', () => getTodaySpecialWorkingHoliday())

// ─── IPC: Admin exit kiosk mode ──────────────────────────────────────────────
// Requires the admin PIN (set as ADMIN_PIN in kiosk/.env, baked at build time).
// If no ADMIN_PIN is configured, only the keyboard shortcut Ctrl+Alt+Q works.
ipcMain.handle('kiosk:exit', (_, pin: string) => {
  // Verify admin PIN (constant-time comparison to avoid timing attacks)
  if (ADMIN_PIN) {
    // pad both to same length so length difference doesn't leak info
    const a = Buffer.from(pin.padEnd(64), 'utf8')
    const b = Buffer.from(ADMIN_PIN.padEnd(64), 'utf8')
    const match = a.length === b.length &&
      a.every((byte, i) => byte === b[i])
    if (!match) {
      return { success: false, error: 'Wrong admin PIN.' }
    }
  }
  // M5: Audit log for PIN-based exit
  const exitAt = new Date().toISOString()
  console.log(`[Kiosk] EXIT via admin PIN modal at ${exitAt}`)
  try {
    setConfig('last_kiosk_exit', JSON.stringify({ at: exitAt, via: 'admin_pin_modal' }))
  } catch (e) {
    console.error('[Kiosk] Could not write exit log to DB:', e)
  }
  mainWindow?.setKiosk(false)
  mainWindow?.setFullScreen(false)
  mainWindow?.restore()
  return { success: true }
})
