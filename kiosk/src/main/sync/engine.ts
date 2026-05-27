// ─── Sync Engine — talks directly to Supabase (no custom server needed) ────────
// Runs in Electron main process. Flushes the local SQLite attendance_queue to
// Supabase every 30 s when online, and refreshes the employee + shift caches.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getPendingRecords, markSynced, markFailed,
  replaceEmployeeCache, replaceShiftsCache,
  getPendingCount,
  type CachedEmployee, type CachedShift,
} from '../db'

// Injected at build time by electron.vite.config.ts define block.
declare const __SUPABASE_URL__:      string
declare const __SUPABASE_ANON_KEY__: string

const SYNC_INTERVAL_MS = 30_000   // normal cadence
const RETRY_DELAY_MS   = 5_000    // after offline/error cycle

export interface SyncStatus {
  online:    boolean
  pending:   number
  state:     'idle' | 'syncing' | 'error' | 'offline' | 'unknown'
  lastSync:  string | null
  lastError: string | null
}

export class SyncEngine {
  private timer:      NodeJS.Timeout | null = null
  private _client:    SupabaseClient | null = null
  private _online     = false
  private _state:     SyncStatus['state'] = 'idle'
  private _lastSync:  string | null = null
  private _lastError: string | null = null
  private _running    = false

  constructor() {
    const url = __SUPABASE_URL__
    const key = __SUPABASE_ANON_KEY__

    if (!url || !key) {
      console.warn('[SyncEngine] SUPABASE_URL / SUPABASE_ANON_KEY not set — sync disabled.')
      return
    }

    // Create a Supabase client for the main process (Node.js).
    // auth.persistSession: false → no localStorage dependency (Node.js has none).
    // We only use the anon key for table operations — no auth.signIn needed.
    this._client = createClient(url, key, {
      auth: {
        persistSession:    false,
        autoRefreshToken:  false,
        detectSessionInUrl: false,
      },
    })
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start(): void {
    if (this._running) return
    this._running = true
    this._scheduleNext(2_000)   // first cycle 2 s after start
    console.log('[SyncEngine] started')
  }

  stop(): void {
    this._running = false
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    console.log('[SyncEngine] stopped')
  }

  /** Trigger an immediate cycle (called right after a check-in while online). */
  nudge(): void {
    if (!this._running) return
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this._scheduleNext(200)
  }

  // ── Status (read by IPC handler) ──────────────────────────────────────────
  getStatus(): SyncStatus {
    return {
      online:    this._online,
      pending:   getPendingCount(),
      state:     this._state,
      lastSync:  this._lastSync,
      lastError: this._lastError,
    }
  }

  // ── Internal schedule ─────────────────────────────────────────────────────
  private _scheduleNext(delayMs = SYNC_INTERVAL_MS): void {
    if (!this._running) return
    this.timer = setTimeout(() => this._cycle(), delayMs)
  }

  private async _cycle(): Promise<void> {
    if (!this._client) {
      this._state = 'offline'
      this._scheduleNext()
      return
    }

    try {
      this._online = await this._checkOnline()

      if (this._online) {
        await this._flush()
      } else {
        this._state = 'offline'
      }
    } catch (err) {
      this._state     = 'error'
      this._lastError = String(err)
      console.error('[SyncEngine] cycle error:', err)
    } finally {
      this._scheduleNext(this._online ? SYNC_INTERVAL_MS : RETRY_DELAY_MS)
    }
  }

  // ── Connectivity check ────────────────────────────────────────────────────
  // A lightweight query to app_settings (1 row read) — fast and cheap.
  private async _checkOnline(): Promise<boolean> {
    if (!this._client) return false
    try {
      const { error } = await this._client
        .from('app_settings')
        .select('id')
        .limit(1)
        .abortSignal(AbortSignal.timeout(5_000))
      return !error
    } catch {
      return false
    }
  }

  // ── Flush pending attendance records to Supabase ──────────────────────────
  private async _flush(): Promise<void> {
    if (!this._client) return

    const records = getPendingRecords(100)
    if (!records.length) {
      this._state = 'idle'
      return
    }

    this._state = 'syncing'
    console.log(`[SyncEngine] flushing ${records.length} record(s) to Supabase`)

    // Map local queue records → Supabase attendance_records shape.
    // We use the kiosk-generated UUID as the Supabase row ID to make upsert
    // idempotent — re-sending the same record is safe.
    const payload = records.map(r => ({
      id:               r.id,
      employee_id:      r.employee_id,
      employee_name:    r.full_name,
      employee_no:      r.employee_no,
      department:       r.department,
      date:             r.date,
      time_in:          r.time_in,
      time_out:         r.time_out,
      status:           r.status,
      minutes_late:     r.minutes_late,
      overtime_minutes: r.overtime_minutes,
      undertime_minutes: r.undertime_minutes,
      night_diff_minutes: 0,    // not computed by kiosk — filled by web app if needed
      source:           'kiosk',
    }))

    try {
      const { error } = await this._client
        .from('attendance_records')
        .upsert(payload, { onConflict: 'employee_id,date' })

      if (error) {
        // Permanent error (constraint, RLS, etc.) — mark failed to avoid infinite retry.
        markFailed(records.map(r => r.id), error.message)
        this._state     = 'error'
        this._lastError = error.message
        console.error('[SyncEngine] upsert error:', error.message)
      } else {
        markSynced(records.map(r => r.id))
        this._lastSync  = new Date().toISOString()
        this._lastError = null
        this._state     = 'idle'
        console.log(`[SyncEngine] synced ${records.length} record(s)`)
      }
    } catch (err) {
      // Network error — increment attempts, will retry
      markFailed(records.map(r => r.id), String(err))
      this._state     = 'error'
      this._lastError = String(err)
      console.error('[SyncEngine] flush network error:', err)
    }
  }

  // ── Refresh employee + shift caches from Supabase ─────────────────────────
  async refreshEmployeeCache(): Promise<void> {
    if (!this._client) throw new Error('Supabase not configured')

    const online = await this._checkOnline()
    if (!online) throw new Error('Device is offline')

    // Fetch active employees
    const { data: employees, error: empErr } = await this._client
      .from('employees')
      .select('id, employee_no, full_name, pin_code, rfid_tag, shift_id, department, position, status')
      .eq('status', 'active')

    if (empErr) throw new Error(empErr.message)

    // Fetch all shifts (needed to compute late/OT/undertime offline)
    const { data: shifts, error: shiftErr } = await this._client
      .from('work_shifts')
      .select('id, name, time_in, time_out, break_minutes, grace_minutes, overtime_threshold_minutes')

    if (shiftErr) throw new Error(shiftErr.message)

    replaceEmployeeCache((employees ?? []) as CachedEmployee[])
    replaceShiftsCache((shifts ?? []) as CachedShift[])

    console.log(
      `[SyncEngine] cache refreshed — ${employees?.length ?? 0} employees, ${shifts?.length ?? 0} shifts`
    )
  }
}
