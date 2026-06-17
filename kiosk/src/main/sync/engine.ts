// ─── Sync Engine — talks directly to Supabase ────────────────────────────────
// Runs in Electron main process. Flushes the local SQLite attendance_queue to
// Supabase every 30 s when online, and refreshes employee + shift + holiday caches.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import {
  getPendingRecords, markSynced, markFailed,
  replaceEmployeeCache, replaceShiftsCache, replaceHolidaysCache,
  getPendingCount,
  type CachedEmployee, type CachedShift, type CachedHoliday,
} from '../db'

// Injected at build time by electron.vite.config.ts define block.
declare const __SUPABASE_URL__:      string
declare const __SUPABASE_ANON_KEY__: string

const SYNC_INTERVAL_MS  = 30_000    // normal cadence when online
// H1: 30s offline retry — 5s was too aggressive and could hit Supabase rate
// limits on a metered connection (12 probes/min × 5s timeout = near-constant load).
const OFFLINE_RETRY_MS  = 30_000   // retry once per 30 s when offline
const ERROR_RETRY_MS    = 15_000   // back off after errors

// How many days of holidays to pre-download
const HOLIDAY_LOOKAHEAD_DAYS = 90

export interface SyncStatus {
  online:    boolean
  pending:   number
  failed:    number
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

    // Electron runs Node.js 20 which has no native WebSocket.
    // Pass the 'ws' package so Supabase Realtime doesn't throw on startup.
    this._client = createClient(url, key, {
      auth: {
        persistSession:     false,
        autoRefreshToken:   false,
        detectSessionInUrl: false,
      },
      realtime: {
        transport: ws,
      },
    })
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start(): void {
    if (this._running) return
    this._running = true
    this._scheduleNext(2_000)
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
      failed:    0,               // filled in by index.ts using getFailedCount()
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
      this._scheduleNext(OFFLINE_RETRY_MS)
      return
    }

    try {
      this._online = await this._checkOnline()

      if (this._online) {
        await this._flush()
        this._scheduleNext(SYNC_INTERVAL_MS)
      } else {
        this._state = 'offline'
        this._scheduleNext(OFFLINE_RETRY_MS)
      }
    } catch (err) {
      this._state     = 'error'
      this._lastError = String(err)
      console.error('[SyncEngine] cycle error:', err)
      this._scheduleNext(ERROR_RETRY_MS)
    }
  }

  // ── Connectivity check ────────────────────────────────────────────────────
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

    // Batch into groups of 20 to avoid request size limits
    const batches: typeof records[] = []
    for (let i = 0; i < records.length; i += 20) batches.push(records.slice(i, i + 20))

    for (const batch of batches) {
      const payload = batch.map(r => ({
        id:                  r.id,
        employee_id:         r.employee_id,
        employee_name:       r.full_name,
        employee_no:         r.employee_no,
        department:          r.department,
        date:                r.date,
        time_in:             r.time_in,
        time_out:            r.time_out,
        status:              r.status,
        minutes_late:        r.minutes_late,
        overtime_minutes:    r.overtime_minutes,
        undertime_minutes:   r.undertime_minutes,
        night_diff_minutes:  r.night_diff_minutes,
        source:              'kiosk',
      }))

      try {
        const { error } = await this._client
          .from('attendance_records')
          .upsert(payload, { onConflict: 'employee_id,date' })

        if (error) {
          // Categorise: RLS / constraint errors are permanent; others are transient
          const category = (error.code === '42501' || error.code === '23505')
            ? 'rls'
            : error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')
              ? 'network'
              : 'constraint'

          markFailed(batch.map(r => r.id), error.message, category)
          this._state     = 'error'
          this._lastError = error.message
          console.error('[SyncEngine] upsert error:', error.message)
        } else {
          markSynced(batch.map(r => r.id))
          this._lastSync  = new Date().toISOString()
          this._lastError = null
          this._state     = 'idle'
          console.log(`[SyncEngine] synced ${batch.length} record(s)`)
        }
      } catch (err) {
        markFailed(batch.map(r => r.id), String(err), 'network')
        this._state     = 'error'
        this._lastError = String(err)
        console.error('[SyncEngine] flush network error:', err)
      }
    }
  }

  // ── Refresh ALL caches (employees + shifts + holidays) ────────────────────
  async refreshAllCaches(): Promise<void> {
    if (!this._client) throw new Error('Supabase not configured')

    const online = await this._checkOnline()
    if (!online) throw new Error('Device is offline')

    await Promise.all([
      this._refreshEmployeesAndShifts(),
      this._refreshHolidays(),
    ])
  }

  private async _refreshEmployeesAndShifts(): Promise<void> {
    if (!this._client) return

    // Use the SECURITY DEFINER RPC that safely exposes SHA-256-hashed pin_hash
    // and rfid_hash for offline verification, while keeping salary/bank data hidden.
    const { data: employees, error: empErr } = await this._client
      .rpc('get_kiosk_employee_cache')

    if (empErr) throw new Error(`Employees fetch failed: ${empErr.message}`)

    const { data: shifts, error: shiftErr } = await this._client
      .from('work_shifts')
      .select('id, name, time_in, time_out, break_minutes, grace_minutes, overtime_threshold_minutes')

    if (shiftErr) throw new Error(`Shifts fetch failed: ${shiftErr.message}`)

    // C5: Guard against empty response wiping the cache.
    // If the RPC returns [] (due to RLS misconfiguration, partial API failure, etc.)
    // and we replace the cache, ALL employees are deleted and no one can clock in.
    // Skip the replace and log a critical warning so HR can investigate.
    if (!employees || employees.length === 0) {
      console.error(
        '[SyncEngine] CRITICAL: get_kiosk_employee_cache returned 0 employees — ' +
        'preserving existing local cache to maintain offline access. ' +
        'Check Supabase RLS policies and the get_kiosk_employee_cache function.'
      )
    } else {
      replaceEmployeeCache(employees as CachedEmployee[])
      console.log(`[SyncEngine] employee cache updated — ${employees.length} employees`)
    }

    if (!shifts || shifts.length === 0) {
      console.warn('[SyncEngine] Shifts fetch returned 0 results — preserving existing shift cache.')
    } else {
      replaceShiftsCache(shifts as CachedShift[])
      console.log(`[SyncEngine] shift cache updated — ${shifts.length} shifts`)
    }
  }

  private async _refreshHolidays(): Promise<void> {
    if (!this._client) return

    const today     = new Date()
    const startDate = today.toISOString().split('T')[0]
    const endDate   = new Date(today.getTime() + HOLIDAY_LOOKAHEAD_DAYS * 86_400_000)
                       .toISOString().split('T')[0]

    const { data: holidays, error } = await this._client
      .from('holidays')
      .select('id, name, date, type')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      // Non-fatal: log and continue. Old cache remains valid.
      console.warn(`[SyncEngine] Holiday fetch failed (non-fatal): ${error.message}`)
      return
    }

    replaceHolidaysCache((holidays ?? []) as CachedHoliday[])
    console.log(`[SyncEngine] holidays refreshed — ${holidays?.length ?? 0} entries (${startDate} → ${endDate})`)
  }

  // Keep old method name as alias for backwards compat
  async refreshEmployeeCache(): Promise<void> {
    return this.refreshAllCaches()
  }
}
