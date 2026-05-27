import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDB, getPendingRecords, markSynced, markFailed, upsertAttendance, getEmployeeCache, refreshEmployeeCache } from './db'
import { SyncEngine } from './sync/engine'

let mainWindow: BrowserWindow | null = null
let syncEngine: SyncEngine | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true,             // kiosk is always fullscreen
    kiosk: true,                  // true kiosk mode — no OS chrome
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

  // Dev: load Vite dev server; Prod: load built index.html
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('app.tenpayroll.kiosk')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Init SQLite DB
  initDB()

  // Start sync engine
  syncEngine = new SyncEngine()
  syncEngine.start()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  syncEngine?.stop()
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// PIN check-in/out
ipcMain.handle('kiosk:pin-checkin', async (_, pin: string) => {
  try {
    const employees = getEmployeeCache()
    const employee = employees.find(e => e.pin_code === pin && e.status === 'active')
    if (!employee) return { success: false, error: 'Unknown PIN. Please contact HR.' }

    const today = new Date().toISOString().split('T')[0]
    const now   = new Date().toISOString()

    // Determine time-in or time-out
    const record = upsertAttendance({
      employee_id:  employee.id,
      employee_no:  employee.employee_no,
      full_name:    employee.full_name,
      department:   employee.department,
      shift_id:     employee.shift_id,
      date:         today,
      now,
    })

    syncEngine?.nudge()  // trigger immediate sync if online

    return {
      success:   true,
      type:      record.type,
      employee:  { fullName: employee.full_name, department: employee.department, position: employee.position },
      message:   `${employee.full_name} — ${record.type === 'time-in' ? 'Time In' : 'Time Out'} recorded`,
    }
  } catch (err: unknown) {
    return { success: false, error: String(err) }
  }
})

// RFID check-in/out
ipcMain.handle('kiosk:rfid-checkin', async (_, rfid: string) => {
  try {
    const employees = getEmployeeCache()
    const employee = employees.find(e => e.rfid_tag === rfid && e.status === 'active')
    if (!employee) return { success: false, error: 'Card not recognized. Please contact HR.' }

    const today = new Date().toISOString().split('T')[0]
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

// Get recent check-ins (for display on idle screen)
ipcMain.handle('kiosk:recent-checkins', async () => {
  const { getRecentCheckins } = await import('./db')
  return getRecentCheckins(10)
})

// Get sync status
ipcMain.handle('kiosk:sync-status', async () => {
  return syncEngine?.getStatus() ?? { online: false, pending: 0, state: 'unknown' }
})

// Emergency exit kiosk (admin combo: Ctrl+Alt+Q)
ipcMain.handle('kiosk:exit', async () => {
  mainWindow?.setKiosk(false)
  mainWindow?.setFullScreen(false)
  mainWindow?.restore()
})

// Refresh employee cache from server
ipcMain.handle('kiosk:refresh-employees', async () => {
  await syncEngine?.refreshEmployeeCache()
  return { success: true }
})
