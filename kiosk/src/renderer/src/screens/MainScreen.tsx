// ─── Electron Kiosk — MainScreen ─────────────────────────────────────────────
// Visual appearance matches the web kiosk exactly.
// Offline functionality is provided by the window.kiosk IPC bridge.
// • KIOSK.png fills the screen as a full-cover background.
// • Bottom dark gradient: brand logo (left) | PIN dots (center) | clock + date (right).
// • Admin button (top-right, ghost) → PIN modal → exit kiosk mode.
// • Ctrl+Alt+Q is handled in the main process via globalShortcut (no PIN needed).

import { useState, useEffect, useRef } from 'react'
import { CalendarX, Settings2, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import type { PinMode } from '../App'

// __ADMIN_PIN_SET__ is injected by electron-vite at build time.
// true if ADMIN_PIN was set in kiosk/.env; false otherwise.
declare const __ADMIN_PIN_SET__: boolean

function pad(n: number) { return String(n).padStart(2, '0') }

const PIN_LENGTH       = 6
const MAX_ADMIN_TRIES  = 3
const ADMIN_LOCKOUT_MS = 30_000

// Sync status passed from App.tsx (polled every 10 s via IPC)
type SyncStatus = {
  online:    boolean
  pending:   number
  failed:    number
  state:     'idle' | 'syncing' | 'error' | 'offline' | 'unknown'
  lastSync:  string | null
  lastError: string | null
}

// Orange is reserved for things that actually need a human to look —
// `failed` only contains records that can never succeed by retrying (a
// duplicate clash with an HR-entered record, an RLS gap, or 50+ attempts).
// A few records mid-flight to Supabase (`pending`) are normal, expected
// behaviour every ~30 s and shown in green so the dot doesn't look "stuck"
// while the device is, in fact, online and working fine.
function getSyncBadge(s: SyncStatus): { label: string; dotColor: string; pulse: boolean } {
  if (!s.online) {
    return {
      label:    s.pending > 0 ? `Offline · ${s.pending} queued` : 'Offline',
      dotColor: '#EF4444',
      pulse:    false,
    }
  }
  if (s.state === 'syncing') {
    return { label: 'Online · Syncing…', dotColor: '#3B82F6', pulse: true }
  }
  if (s.failed > 0) {
    return { label: `Online · ${s.failed} need attention`, dotColor: '#F59E0B', pulse: false }
  }
  if (s.pending > 0) {
    return { label: `Online · ${s.pending} pending`, dotColor: '#10B981', pulse: true }
  }
  return { label: 'Online · Synced', dotColor: '#10B981', pulse: false }
}

interface Props {
  pinDigits:          string
  pinMode:            PinMode
  isHoliday:          boolean
  holidayInfo:        { name: string; type: string } | null
  // M6: Non-blocking special-working holiday (130% premium pay applies)
  specialHolidayInfo: { name: string; type: string } | null
  syncStatus:         SyncStatus | null
  // Lets the "Retry sync now" button in the diagnostics popover refresh the
  // badge immediately instead of waiting up to 10 s for the next poll tick.
  onRequestSyncStatus?: () => void
  onKeypadPress:      (key: string) => void
  onClear:            () => void
}

export function MainScreen({
  pinDigits, pinMode, isHoliday, holidayInfo, specialHolidayInfo, syncStatus, onRequestSyncStatus,
}: Props) {

  // ── Clock ─────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])
  const h       = now.getHours()
  const h12     = h % 12 || 12
  const ampm    = h >= 12 ? 'PM' : 'AM'
  const timeStr = `${h12}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`
  const dateStr = now.toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // ── Sync diagnostics popover ──────────────────────────────────────────────
  // Click the connectivity dot/label to see exactly what's pending or broken
  // (last sync time + the real error message) and force a retry — instead of
  // "stuck orange" being a mystery, it's now a click away from being explained
  // or fixed on the spot.
  const [syncDetailOpen, setSyncDetailOpen] = useState(false)
  const [retrying,       setRetrying]       = useState(false)

  const handleRetrySync = async () => {
    if (retrying) return
    setRetrying(true)
    try { await window.kiosk.forceSync() } catch { /* surfaced via next poll */ }
    // Give the nudged sync cycle a moment to actually run, then pull the
    // fresh status immediately instead of waiting up to 10 s for the next poll.
    setTimeout(() => {
      onRequestSyncStatus?.()
      setRetrying(false)
    }, 1_500)
  }

  // ── Admin modal state ─────────────────────────────────────────────────────
  const [adminOpen,      setAdminOpen]      = useState(false)
  const [adminPinInput,  setAdminPinInput]  = useState('')
  const [adminShowPin,   setAdminShowPin]   = useState(false)
  const [adminError,     setAdminError]     = useState('')
  const [adminLoading,   setAdminLoading]   = useState(false)
  const [adminTries,     setAdminTries]     = useState(0)
  const [adminLockUntil, setAdminLockUntil] = useState<number | null>(null)
  const [adminCountdown, setAdminCountdown] = useState(0)
  const adminPinRef = useRef<HTMLInputElement>(null)

  const isAdminLocked = adminLockUntil !== null && Date.now() < adminLockUntil

  // Countdown ticker while locked
  useEffect(() => {
    if (!adminLockUntil) return
    const t = setInterval(() => {
      const rem = Math.ceil((adminLockUntil - Date.now()) / 1_000)
      if (rem <= 0) {
        setAdminLockUntil(null)
        setAdminTries(0)
        setAdminCountdown(0)
      } else {
        setAdminCountdown(rem)
      }
    }, 500)
    return () => clearInterval(t)
  }, [adminLockUntil])

  const openAdmin = () => {
    setAdminOpen(true)
    setAdminPinInput('')
    setAdminError('')
    setAdminShowPin(false)
    // focus the input after the modal renders
    setTimeout(() => adminPinRef.current?.focus(), 80)
  }

  const closeAdmin = () => {
    setAdminOpen(false)
    setAdminPinInput('')
    setAdminError('')
    setAdminShowPin(false)
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAdminLocked || adminLoading) return
    if (!adminPinInput.trim()) { setAdminError('Enter admin PIN.'); return }

    setAdminLoading(true)
    setAdminError('')

    try {
      const result = await window.kiosk.exit(adminPinInput.trim())
      if (result.success) {
        // Main process will un-kiosk the window; close modal just in case
        closeAdmin()
      } else {
        const next = adminTries + 1
        setAdminTries(next)
        if (next >= MAX_ADMIN_TRIES) {
          const until = Date.now() + ADMIN_LOCKOUT_MS
          setAdminLockUntil(until)
          setAdminError('Too many failed attempts. Locked for 30 seconds.')
        } else {
          const left = MAX_ADMIN_TRIES - next
          setAdminError(`Wrong PIN. ${left} attempt${left !== 1 ? 's' : ''} remaining.`)
        }
        setAdminPinInput('')
      }
    } catch {
      setAdminError('Error communicating with system. Try again.')
    } finally {
      setAdminLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', userSelect: 'none', background: '#000' }}>

      {/* ══ Background image — full screen cover ═════════════════════════ */}
      <img
        src="./KIOSK.png"
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: pinMode === 'processing' ? 0.4 : 1,
        }}
      />

      {/* ══ Online / sync status — top-left (click for details) ═════════ */}
      {syncStatus !== null && (() => {
        const { label, dotColor, pulse } = getSyncBadge(syncStatus)
        const needsAttention = syncStatus.failed > 0
        return (
          <div style={{ position: 'absolute', top: 16, left: 20 }}>
            <button
              onClick={() => setSyncDetailOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 500,
                color: 'rgba(255,255,255,0.45)',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: dotColor, flexShrink: 0,
                animation: pulse ? 'syncPulse 1.4s ease-in-out infinite' : 'none',
              }} />
              {label}
            </button>

            {/* ── Diagnostics popover ── */}
            {syncDetailOpen && (
              <div style={{
                marginTop: 8, width: 280, background: '#13161D',
                border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
                padding: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                fontSize: 12, color: '#9CA3AF', lineHeight: 1.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Connection</span>
                  <strong style={{ color: syncStatus.online ? '#10B981' : '#EF4444' }}>
                    {syncStatus.online ? 'Online' : 'Offline'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Pending sync</span>
                  <strong style={{ color: '#fff' }}>{syncStatus.pending}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Needs attention</span>
                  <strong style={{ color: needsAttention ? '#F59E0B' : '#fff' }}>{syncStatus.failed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: needsAttention ? 10 : 0 }}>
                  <span>Last synced</span>
                  <strong style={{ color: '#fff' }}>
                    {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleTimeString('en-PH') : '—'}
                  </strong>
                </div>

                {needsAttention && syncStatus.lastError && (
                  <div style={{
                    background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 7, padding: '8px 10px', marginBottom: 10,
                    color: '#FCD34D', fontSize: 11, wordBreak: 'break-word',
                  }}>
                    {syncStatus.lastError}
                  </div>
                )}

                <button
                  onClick={handleRetrySync}
                  disabled={retrying || !syncStatus.online}
                  style={{
                    width: '100%', height: 32, borderRadius: 7, fontSize: 12, fontWeight: 600,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff', cursor: retrying || !syncStatus.online ? 'not-allowed' : 'pointer',
                    opacity: retrying || !syncStatus.online ? 0.5 : 1,
                  }}
                >
                  {retrying ? 'Retrying…' : 'Retry sync now'}
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* ══ Holiday dimmer ════════════════════════════════════════════════ */}
      {isHoliday && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
      )}

      {/* ══ M6: Special-working holiday banner (non-blocking, yellow) ════ */}
      {!isHoliday && specialHolidayInfo && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 8, padding: '6px 14px',
          fontSize: 11, fontWeight: 600, color: '#FCD34D',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
          Special Working Day: {specialHolidayInfo.name} — 130% premium pay applies
        </div>
      )}

      {/* ══ Bottom gradient overlay ═══════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 40%, transparent 100%)',
          padding: '80px 48px 32px',
        }}
      >
        {/* ── Holiday banner ── */}
        {isHoliday && holidayInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, justifyContent: 'center' }}>
            <CalendarX style={{ width: 18, height: 18, color: '#FBBF24', flexShrink: 0 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#FBBF24' }}>
              {holidayInfo.name} — Attendance suspended today
            </p>
          </div>
        )}

        {/* ── Three-column bar: brand | PIN dots | clock ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>

          {/* Left: Logo + company name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img
              src="./Logo.png" alt=""
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, opacity: 0.9 }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                TenPayroll
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, fontWeight: 500 }}>
                Attendance Kiosk
              </p>
            </div>
          </div>

          {/* Center: PIN dots + status hint */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {!isHoliday && (
              <div style={{ display: 'flex', gap: 10 }}>
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: i < pinDigits.length ? '#fff' : 'transparent',
                      border:     `2px solid ${i < pinDigits.length ? '#fff' : 'rgba(255,255,255,0.35)'}`,
                    }}
                  />
                ))}
              </div>
            )}
            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500,
              minHeight: '1.2rem', textAlign: 'center',
            }}>
              {pinMode === 'processing'
                ? 'Verifying…'
                : isHoliday
                  ? ''
                  : pinDigits.length > 0
                    ? ''
                    : 'Tap your RFID card  ·  or type your PIN'}
            </p>
          </div>

          {/* Right: Clock + date */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{
              fontSize: 28, fontWeight: 800, color: '#fff',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              {timeStr}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontWeight: 500 }}>
              {dateStr}
            </p>
          </div>
        </div>
      </div>

      {/* ══ Processing spinner ════════════════════════════════════════════ */}
      {pinMode === 'processing' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTopColor: '#fff',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* ══ Admin button (top-right) — only shown when ADMIN_PIN is set ══ */}
      {__ADMIN_PIN_SET__ && (
        <button
          onClick={openAdmin}
          style={{
            position: 'absolute', top: 16, right: 20,
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.18)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px', borderRadius: 6,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)' }}
        >
          <Settings2 style={{ width: 13, height: 13 }} />
          Admin Login
        </button>
      )}

      {/* ══ Admin PIN modal ═══════════════════════════════════════════════ */}
      {adminOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeAdmin() }}
        >
          <div style={{
            width: '100%', maxWidth: 380, background: '#13161D',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
            padding: '32px 32px 28px', boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, marginBottom: 14,
                background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock style={{ width: 22, height: 22, color: '#F87171' }} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Admin Access Required</p>
              <p style={{ fontSize: 13, color: '#4B5563', marginTop: 6, lineHeight: 1.5 }}>
                Enter admin PIN to exit kiosk mode.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 5 }}>
                  Admin PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={adminPinRef}
                    type={adminShowPin ? 'text' : 'password'}
                    value={adminPinInput}
                    onChange={e => setAdminPinInput(e.target.value)}
                    placeholder="Enter admin PIN"
                    autoComplete="off"
                    disabled={adminLoading || isAdminLocked}
                    style={{
                      width: '100%', height: 40, borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.04)', color: '#fff',
                      fontSize: 13.5, padding: '0 40px 0 12px',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setAdminShowPin(v => !v)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563',
                    }}
                  >
                    {adminShowPin
                      ? <EyeOff style={{ width: 15, height: 15 }} />
                      : <Eye    style={{ width: 15, height: 15 }} />
                    }
                  </button>
                </div>
              </div>

              {/* Error message */}
              {adminError && (
                <div style={{
                  background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)',
                  borderRadius: 7, padding: '8px 12px', fontSize: 12.5, color: '#FCA5A5', lineHeight: 1.5,
                }}>
                  {adminError}
                  {isAdminLocked && adminCountdown > 0 && (
                    <strong> ({adminCountdown}s)</strong>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={closeAdmin}
                  disabled={adminLoading}
                  style={{
                    flex: 1, height: 38, borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#9CA3AF', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminLoading || isAdminLocked}
                  style={{
                    flex: 1, height: 38, borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                    background: '#DC2626', border: 'none', color: '#fff',
                    cursor: adminLoading || isAdminLocked ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: adminLoading || isAdminLocked ? 0.5 : 1,
                  }}
                >
                  {adminLoading
                    ? <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                        display: 'inline-block', animation: 'spin 0.7s linear infinite',
                      }} />
                    : 'Exit Kiosk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes syncPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
      `}</style>
    </div>
  )
}
