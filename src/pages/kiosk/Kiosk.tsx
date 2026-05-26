import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings2, AlertCircle, CalendarX, CheckCircle2, CreditCard } from 'lucide-react'
import { apiKioskRFID, apiGetTodayHoliday, getCompanySettings } from '../../lib/db'
import type { Employee, Holiday } from '../../types'

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'processing' }
  | { kind: 'success'; type: 'time-in' | 'time-out'; employee: Employee; time: string }
  | { kind: 'error'; message: string }

const AUTO_DISMISS   = 5000
const MIN_RFID_LEN   = 4    // reject buffers shorter than this (avoids stray keystrokes)
const RFID_TIMEOUT   = 300  // ms of silence after which we discard a partial buffer

export function Kiosk() {
  const navigate    = useNavigate()
  const [time,     setTime]    = useState(new Date())
  const [phase,    setPhase]   = useState<Phase>({ kind: 'idle' })
  const [holiday,  setHoliday] = useState<Holiday | null>(null)
  const dismissRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rfidBuf     = useRef('')
  const rfidTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const phaseRef    = useRef<Phase>({ kind: 'idle' })
  const holidayRef  = useRef<Holiday | null>(null)
  const company     = getCompanySettings()

  // Keep refs in sync so the keydown handler always reads current values
  useEffect(() => { phaseRef.current  = phase   }, [phase])
  useEffect(() => { holidayRef.current = holiday }, [holiday])

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load today's holiday
  useEffect(() => { apiGetTodayHoliday().then(setHoliday) }, [])

  const schedDismiss = useCallback((ms = AUTO_DISMISS) => {
    if (dismissRef.current) clearTimeout(dismissRef.current)
    dismissRef.current = setTimeout(() => setPhase({ kind: 'idle' }), ms)
  }, [])

  const processRFID = useCallback(async (code: string) => {
    setPhase({ kind: 'processing' })
    try {
      const res = await apiKioskRFID(code)
      setPhase({ kind: 'success', type: res.type, employee: res.employee, time: new Date().toISOString() })
      schedDismiss(AUTO_DISMISS)
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'System error. Try again.' })
      schedDismiss(3000)
    }
  }, [schedDismiss])

  // ── RFID keyboard listener ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ph  = phaseRef.current
      const hol = holidayRef.current

      // Block input during processing / success / no-work holiday
      if (ph.kind === 'processing' || ph.kind === 'success') return
      if (hol && (hol.type === 'regular' || hol.type === 'special-non-working')) return

      if (e.key === 'Enter') {
        const code = rfidBuf.current.trim()
        rfidBuf.current = ''
        clearTimeout(rfidTimer.current)
        if (code.length >= MIN_RFID_LEN) {
          processRFID(code)
        } else {
          // Too short — stray Enter key; reset to idle
          setPhase(prev => prev.kind === 'scanning' ? { kind: 'idle' } : prev)
        }
        return
      }

      if (e.key === 'Escape') {
        rfidBuf.current = ''
        clearTimeout(rfidTimer.current)
        setPhase({ kind: 'idle' })
        return
      }

      // Accumulate printable characters (RFID reader emits these very fast)
      if (e.key.length === 1) {
        rfidBuf.current += e.key
        // Show "scanning" state while characters arrive
        setPhase(prev =>
          prev.kind === 'idle' || prev.kind === 'error' ? { kind: 'scanning' } : prev
        )
        // After RFID_TIMEOUT ms of silence, assume it wasn't an RFID scan
        clearTimeout(rfidTimer.current)
        rfidTimer.current = setTimeout(() => {
          rfidBuf.current = ''
          setPhase(prev => prev.kind === 'scanning' ? { kind: 'idle' } : prev)
        }, RFID_TIMEOUT)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [processRFID])  // re-register only when processRFID changes (which is never, due to useCallback)

  const timeStr   = time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateStr   = time.toLocaleDateString('en-PH',  { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const isBlocked = holiday && (holiday.type === 'regular' || holiday.type === 'special-non-working')
  const isScanning = phase.kind === 'idle' || phase.kind === 'scanning'

  return (
    <div
      className="min-h-screen flex flex-col select-none overflow-hidden"
      style={{ background: '#0D1117' }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-8 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center font-black text-white text-base"
            style={{ background: 'linear-gradient(135deg,#2563EB 0%,#7C3AED 100%)', borderRadius: '8px' }}
          >
            V
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">{company.name}</p>
            <p className="text-[10px] mt-0.5 font-medium uppercase tracking-widest" style={{ color: '#3D4452' }}>
              Attendance Kiosk
            </p>
          </div>
        </div>

        {/* Clock — centered */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <p
            className="text-white font-bold tabular-nums leading-none"
            style={{ fontSize: '38px', letterSpacing: '-0.02em' }}
          >
            {timeStr}
          </p>
          <p className="text-[11px] mt-1.5 font-medium" style={{ color: '#4B5563' }}>{dateStr}</p>
        </div>

        {/* Admin link */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors"
          style={{ color: '#3D4452', borderRadius: '5px' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3D4452' }}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Admin Login
        </button>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">

        {/* HOLIDAY BLOCKED */}
        {isBlocked && (
          <div className="flex flex-col items-center text-center animate-slide-in">
            <div
              className="w-20 h-20 flex items-center justify-center mb-6"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '12px',
              }}
            >
              <CalendarX className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">No Work Today</p>
            <p className="text-white font-bold mb-2" style={{ fontSize: '32px' }}>{holiday.name}</p>
            <p className="text-base capitalize" style={{ color: '#4B5563' }}>
              {holiday.type.replace(/-/g, ' ')} · Attendance suspended
            </p>
          </div>
        )}

        {/* IDLE / SCANNING — RFID prompt */}
        {!isBlocked && isScanning && (
          <div className="flex flex-col items-center text-center animate-slide-in">
            {/* Pulsing RFID ring animation */}
            <div className="relative flex items-center justify-center mb-10" style={{ width: 160, height: 160 }}>
              {/* Outer ring 1 */}
              <div
                className="absolute animate-ping"
                style={{
                  width: 160, height: 160,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(37,99,235,0.35)',
                  animationDuration: '2s',
                }}
              />
              {/* Outer ring 2 — delayed */}
              <div
                className="absolute animate-ping"
                style={{
                  width: 128, height: 128,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(37,99,235,0.22)',
                  animationDuration: '2s',
                  animationDelay: '0.5s',
                }}
              />
              {/* Card icon circle */}
              <div
                className="relative z-10 flex items-center justify-center transition-all duration-300"
                style={{
                  width: 96, height: 96,
                  borderRadius: '50%',
                  background: phase.kind === 'scanning'
                    ? 'rgba(37,99,235,0.22)'
                    : 'rgba(37,99,235,0.10)',
                  border: `1.5px solid ${phase.kind === 'scanning' ? 'rgba(37,99,235,0.6)' : 'rgba(37,99,235,0.25)'}`,
                  transform: phase.kind === 'scanning' ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: phase.kind === 'scanning'
                    ? '0 0 32px rgba(37,99,235,0.25)'
                    : 'none',
                }}
              >
                <CreditCard
                  style={{
                    width: 42, height: 42,
                    color: phase.kind === 'scanning' ? '#93C5FD' : '#3B82F6',
                    transition: 'color 0.2s',
                  }}
                />
              </div>
            </div>

            <p className="text-white font-bold leading-tight mb-3" style={{ fontSize: '30px' }}>
              {phase.kind === 'scanning' ? 'Reading Card…' : 'Tap Your RFID Card'}
            </p>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#4B5563' }}>
              {phase.kind === 'scanning'
                ? 'Please hold still'
                : 'Hold your ID card near the card reader to record your attendance'}
            </p>

            {/* Scan hint badge */}
            {phase.kind === 'idle' && (
              <div
                className="mt-8 flex items-center gap-2 px-4 py-2"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '999px',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                <span className="text-[11px] font-medium" style={{ color: '#4B5563' }}>
                  Reader active · Waiting for card scan
                </span>
              </div>
            )}
          </div>
        )}

        {/* PROCESSING */}
        {!isBlocked && phase.kind === 'processing' && (
          <div className="flex flex-col items-center text-center animate-slide-in">
            <div
              className="rounded-full animate-spin mb-6"
              style={{
                width: 56, height: 56,
                border: '2.5px solid rgba(255,255,255,0.08)',
                borderTopColor: '#2563EB',
              }}
            />
            <p className="text-white font-bold text-xl">Verifying card…</p>
            <p className="text-sm mt-1" style={{ color: '#4B5563' }}>Please wait</p>
          </div>
        )}

        {/* SUCCESS */}
        {!isBlocked && phase.kind === 'success' && (
          <div className="flex flex-col items-center text-center animate-slide-in">
            <div
              className="flex items-center justify-center mb-5"
              style={{
                width: 80, height: 80,
                background: phase.type === 'time-in' ? 'rgba(34,197,94,0.10)' : 'rgba(59,130,246,0.10)',
                border: `1px solid ${phase.type === 'time-in' ? 'rgba(34,197,94,0.30)' : 'rgba(59,130,246,0.30)'}`,
                borderRadius: '12px',
              }}
            >
              {phase.type === 'time-in'
                ? <CheckCircle2 className="w-10 h-10 text-green-400" />
                : <LogOut        className="w-10 h-10 text-blue-400"  />
              }
            </div>

            <p
              className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${
                phase.type === 'time-in' ? 'text-green-400' : 'text-blue-400'
              }`}
            >
              {phase.type === 'time-in' ? '● Time In Recorded' : '● Time Out Recorded'}
            </p>

            <p className="text-white font-bold mb-1 leading-tight" style={{ fontSize: '28px' }}>
              {phase.employee.fullName}
            </p>
            <p className="text-sm mb-5" style={{ color: '#4B5563' }}>
              {phase.employee.position} · {phase.employee.department}
            </p>

            {/* Timestamp box */}
            <div
              className="px-8 py-3 mb-6"
              style={{
                background: phase.type === 'time-in' ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${phase.type === 'time-in' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)'}`,
                borderRadius: '8px',
              }}
            >
              <p
                className={`text-2xl font-bold tabular-nums ${
                  phase.type === 'time-in' ? 'text-green-400' : 'text-blue-400'
                }`}
              >
                {new Date(phase.time).toLocaleTimeString('en-PH', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                })}
              </p>
            </div>

            {/* Auto-dismiss progress bar */}
            <div
              className="overflow-hidden"
              style={{ width: 192, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: '999px' }}
            >
              <div
                className="h-full animate-shrink"
                style={{
                  background: phase.type === 'time-in' ? '#22C55E' : '#3B82F6',
                  borderRadius: '999px',
                }}
              />
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: '#374151' }}>
              Returning to idle in 5 seconds…
            </p>
          </div>
        )}

        {/* ERROR */}
        {!isBlocked && phase.kind === 'error' && (
          <div className="flex flex-col items-center text-center animate-slide-in">
            <div
              className="flex items-center justify-center mb-5"
              style={{
                width: 80, height: 80,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '12px',
              }}
            >
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-red-400 mb-3">Card Error</p>
            <p className="text-white text-lg font-semibold mb-6 max-w-xs leading-snug">
              {phase.message}
            </p>
            <button
              onClick={() => setPhase({ kind: 'idle' })}
              className="px-6 py-2.5 text-sm font-semibold text-white transition-all"
              style={{ background: '#1565C0', borderRadius: '6px' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1251A0')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#1565C0')}
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className="flex items-center justify-between px-8 pb-5 pt-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <p className="text-[10px]" style={{ color: '#1F2937' }}>
          © {new Date().getFullYear()} {company.name}
        </p>
        <p className="text-[10px]" style={{ color: '#1F2937' }}>
          {time.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </footer>
    </div>
  )
}
