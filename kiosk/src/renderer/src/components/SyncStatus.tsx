import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, CloudUpload, Wifi, WifiOff } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type SyncStatus = {
  online:    boolean
  pending:   number
  failed:    number
  state:     'idle' | 'syncing' | 'error' | 'offline' | 'unknown'
  lastSync:  string | null
  lastError: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      if (cancelled) return
      try {
        const s = await window.kiosk.syncStatus()
        if (!cancelled) setStatus(s)
      } catch { /* ignore */ }
      if (!cancelled) setTimeout(poll, 5_000)
    }
    poll()
    return () => { cancelled = true }
  }, [])

  if (!status) return null

  const { online, state, pending, failed = 0 } = status
  const isSyncing = state === 'syncing'
  const isError   = state === 'error'

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium select-none">

      {/* Online / Offline */}
      <span
        className="flex items-center gap-1 px-2 py-1 rounded-full"
        style={online
          ? { background: 'rgba(16,185,129,0.12)', color: '#6EE7B7' }
          : { background: 'rgba(239,68,68,0.12)',  color: '#FCA5A5' }}
      >
        {online ? <Wifi size={11} /> : <WifiOff size={11} />}
        {online ? 'Online' : 'Offline'}
      </span>

      {/* Syncing */}
      {isSyncing && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: 'rgba(99,102,241,0.14)', color: '#A5B4FC' }}
        >
          <CloudUpload size={11} />
          Syncing
        </span>
      )}

      {/* Sync error */}
      {isError && !isSyncing && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D' }}
        >
          <AlertCircle size={11} />
          Sync error
        </span>
      )}

      {/* Pending queue */}
      {pending > 0 && !isSyncing && (
        <span
          className="px-2 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.07)', color: '#94A3B8' }}
        >
          {pending} pending
        </span>
      )}

      {/* Failed records */}
      {failed > 0 && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}
        >
          <AlertTriangle size={11} />
          {failed} failed
        </span>
      )}

      {/* All clear */}
      {pending === 0 && !isSyncing && online && failed === 0 && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: 'rgba(16,185,129,0.08)', color: '#6EE7B7' }}
        >
          <CheckCircle2 size={11} />
          Synced
        </span>
      )}
    </div>
  )
}
