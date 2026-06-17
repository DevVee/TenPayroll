// ─── Kiosk Preload — contextBridge IPC Bridge ─────────────────────────────────
import { contextBridge, ipcRenderer } from 'electron'

export type CheckinResult = {
  success: boolean
  type?: 'time-in' | 'time-out'
  employee?: { fullName: string; department: string | null; position: string | null }
  message?: string
  error?: string
}

export type RecentCheckin = {
  id: string
  employee_id: string
  full_name: string
  department: string | null
  type: 'time-in' | 'time-out'
  timestamp: string
}

export type SyncStatus = {
  online: boolean
  pending: number
  failed: number
  state: 'idle' | 'syncing' | 'error' | 'offline' | 'unknown'
  lastSync: string | null
  lastError: string | null
}

export type Holiday = {
  id: string
  name: string
  date: string
  type: string
}

const kioskAPI = {
  // Check in/out via PIN
  pinCheckin: (pin: string): Promise<CheckinResult> =>
    ipcRenderer.invoke('kiosk:pin-checkin', pin),

  // Check in/out via RFID
  rfidCheckin: (rfid: string): Promise<CheckinResult> =>
    ipcRenderer.invoke('kiosk:rfid-checkin', rfid),

  // Get recent check-ins for idle screen
  recentCheckins: (): Promise<RecentCheckin[]> =>
    ipcRenderer.invoke('kiosk:recent-checkins'),

  // Get sync status
  syncStatus: (): Promise<SyncStatus> =>
    ipcRenderer.invoke('kiosk:sync-status'),

  // Get today's BLOCKING holiday (null if not a blocking holiday)
  todayHoliday: (): Promise<Holiday | null> =>
    ipcRenderer.invoke('kiosk:today-holiday'),

  // M6: Get today's special-working holiday (non-blocking, yellow notice only)
  todaySpecialHoliday: (): Promise<Holiday | null> =>
    ipcRenderer.invoke('kiosk:today-special-holiday'),

  // Refresh employee + shift + holiday caches from Supabase
  refreshEmployees: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('kiosk:refresh-employees'),

  // Force an immediate sync cycle
  forceSync: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('kiosk:force-sync'),

  // Exit kiosk mode — requires admin PIN (set via ADMIN_PIN in kiosk/.env)
  exit: (pin: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('kiosk:exit', pin),

  // Listen for RFID scan events pushed from main process
  onRfidScan: (cb: (rfid: string) => void) => {
    ipcRenderer.on('rfid:scan', (_event, rfid: string) => cb(rfid))
    return () => ipcRenderer.removeAllListeners('rfid:scan')
  },
}

contextBridge.exposeInMainWorld('kiosk', kioskAPI)

// Type augmentation for renderer
declare global {
  interface Window {
    kiosk: typeof kioskAPI
  }
}
