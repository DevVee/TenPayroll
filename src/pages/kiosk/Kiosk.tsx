// ─── Web Kiosk ────────────────────────────────────────────────────────────────
// Idle display: KIOSK.png fills the screen.
// Bottom gradient overlay shows clock + PIN dots + status.
// When an employee checks in/out: full-screen result card covers the image for 5 s.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogIn, LogOut, Settings2, AlertCircle, CalendarX,
  CheckCircle2, Eye, EyeOff, Lock, XCircle,
} from 'lucide-react'
import {
  apiKioskRFID, apiKioskPIN, apiGetTodayHoliday,
  apiGetTodaySpecialWorkingHoliday,
  getCompanySettings, apiLogin,
} from '../../lib/db'
import { hashPin } from '../../lib/utils/hash'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { createKioskRateLimiter, LockoutError } from '../../lib/kioskRateLimiter'
import type { Holiday } from '../../types'

// ─── Constants ────────────────────────────────────────────────────────────────
// L2: Lowered from 80ms → 50ms. Most RFID HID scanners fire chars within 5–20ms.
// 50ms is a safer threshold that avoids misclassifying fast human numpad typing as RFID.
const RFID_CHAR_SPEED_MS = 50
const RFID_MIN_LEN       = 4
const RFID_TIMEOUT_MS    = 300
const PIN_LENGTH         = 6
const RESULT_HOLD_MS     = 5_000
const MAX_EXIT_ATTEMPTS  = 3
// M4: Match the Electron kiosk 2-minute lockout
const EXIT_LOCKOUT_MS    = 120_000

// C3: sessionStorage keys for persisting exit modal lockout across page refreshes
const SS_EXIT_LOCK = 'kiosk_exit_lock_until'   // epoch ms
const SS_EXIT_TRIES = 'kiosk_exit_attempts'     // int

// C4: Offline admin PIN fallback. Set VITE_KIOSK_ADMIN_PIN in .env
// When Supabase is unreachable, this PIN allows the admin to exit the kiosk.
// Leave blank if you only want online authentication.
const LOCAL_ADMIN_PIN = (import.meta.env.VITE_KIOSK_ADMIN_PIN as string | undefined) ?? ''

// ─── Types ────────────────────────────────────────────────────────────────────
type Employee = { id: string; fullName: string; department: string | null; position: string | null }
type Phase =
  | { kind: 'idle' }
  | { kind: 'processing' }
  | { kind: 'success'; type: 'time-in' | 'time-out'; employee: Employee; time: string }
  | { kind: 'error';   message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0') }

// ─── Component ────────────────────────────────────────────────────────────────
export function Kiosk() {
  const navigate  = useNavigate()
  const { login } = useAuthStore()
  const company   = getCompanySettings()

  // ── Clock ──────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const h     = now.getHours()
  const h12   = h % 12 || 12
  const ampm  = h >= 12 ? 'PM' : 'AM'
  const timeStr = `${h12}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // ── Online / offline + Supabase reachability (M1) ─────────────────────────
  // navigator.onLine only checks network adapter — it returns true even when
  // Supabase is specifically down (e.g. connected to LAN with no internet).
  // We track supabaseOk separately to show a more accurate 3-state indicator.
  const [isOnline,    setIsOnline]    = useState(navigator.onLine)
  const [supabaseOk,  setSupabaseOk]  = useState<boolean | null>(null)   // null = unknown yet

  useEffect(() => {
    const setOn  = () => setIsOnline(true)
    const setOff = () => setIsOnline(false)
    window.addEventListener('online',  setOn)
    window.addEventListener('offline', setOff)
    return () => {
      window.removeEventListener('online',  setOn)
      window.removeEventListener('offline', setOff)
    }
  }, [])

  // ── Holiday ────────────────────────────────────────────────────────────────
  const [holiday,         setHoliday]         = useState<Holiday | null>(null)
  const [specialHoliday,  setSpecialHoliday]  = useState<Holiday | null>(null)
  const holidayRef = useRef<Holiday | null>(null)
  useEffect(() => { holidayRef.current = holiday }, [holiday])

  useEffect(() => {
    // Initial load
    apiGetTodayHoliday()
      .then(h => { setHoliday(h); setSupabaseOk(true) })
      .catch(() => setSupabaseOk(false))

    // Poll every 5 min — covers midnight rollover to a new holiday.
    // H3: was missing .catch(), which caused an unhandled Promise rejection on network error.
    const id = setInterval(() => {
      apiGetTodayHoliday()
        .then(h => { setHoliday(h); setSupabaseOk(true) })
        .catch(() => { setSupabaseOk(false) /* keep last known holiday state */ })
    }, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  // M6: Poll for special-working holidays (non-blocking, yellow notice only)
  useEffect(() => {
    apiGetTodaySpecialWorkingHoliday().then(setSpecialHoliday).catch(() => {})
    const id = setInterval(() =>
      apiGetTodaySpecialWorkingHoliday().then(setSpecialHoliday).catch(() => {}),
      5 * 60_000
    )
    return () => clearInterval(id)
  }, [])

  // M1 follow-up: dedicated fast connectivity health-check, separate from the
  // 5-min holiday poll above. Without this, a single transient network blip
  // during a holiday/PIN/RFID call could leave the "Service unreachable"
  // badge stuck orange for up to 5 minutes even after the connection
  // recovered. This self-heals within ~20 s instead.
  useEffect(() => {
    let cancelled = false
    async function ping() {
      try {
        const { error } = await supabase.from('app_settings').select('id').limit(1)
        if (!cancelled) setSupabaseOk(!error)
      } catch {
        if (!cancelled) setSupabaseOk(false)
      }
    }
    ping()
    const id = setInterval(ping, 20_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // M6: Special-working holidays — non-blocking, yellow notice only.
  // These days allow check-in but premium pay (130%) applies per Philippine law.
  const isSpecialWorking = specialHoliday !== null

  const isBlocked = !!holiday && (holiday.type === 'regular' || holiday.type === 'special-non-working')

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase]    = useState<Phase>({ kind: 'idle' })
  const phaseRef             = useRef<Phase>({ kind: 'idle' })
  const dismissRef           = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processing           = useRef(false)
  const exitModalOpenRef     = useRef(false)
  // H6: Mirror isBlocked into a ref so the keydown closure always sees the
  // current value even if it was registered before the holiday state changed.
  const isBlockedRef         = useRef(false)
  useEffect(() => { phaseRef.current    = phase    }, [phase])
  useEffect(() => { isBlockedRef.current = isBlocked }, [isBlocked])

  const schedDismiss = useCallback((ms = RESULT_HOLD_MS) => {
    if (dismissRef.current) clearTimeout(dismissRef.current)
    dismissRef.current = setTimeout(() => {
      setPhase({ kind: 'idle' })
      processing.current = false
    }, ms)
  }, [])

  // ── PIN state ──────────────────────────────────────────────────────────────
  const [pinDigits, setPinDigits] = useState('')

  // ── Rate limiter ───────────────────────────────────────────────────────────
  const limiter = useRef(createKioskRateLimiter())

  // ── Process PIN ────────────────────────────────────────────────────────────
  const processPIN = useCallback(async (pin: string) => {
    if (processing.current) return
    try { limiter.current.assertNotLocked() } catch (err) {
      if (err instanceof LockoutError) {
        setPhase({ kind: 'error', message: err.message })
        schedDismiss(err.remainingMs); return
      }
    }
    processing.current = true
    setPinDigits('')
    setPhase({ kind: 'processing' })
    try {
      const res = await apiKioskPIN(pin)
      setSupabaseOk(true)
      limiter.current.onSuccess()
      setPhase({ kind: 'success', type: res.type, employee: res.employee, time: new Date().toISOString() })
      schedDismiss()
    } catch (err) {
      // M1: Track Supabase reachability based on error type
      const isNetworkErr = err instanceof TypeError || (err as { code?: string })?.code === 'NETWORK_ERROR'
      if (isNetworkErr) setSupabaseOk(false)
      else              setSupabaseOk(true)   // reached Supabase, just not a valid PIN
      try { limiter.current.onFailure() } catch (le) {
        if (le instanceof LockoutError) { setPhase({ kind: 'error', message: le.message }); schedDismiss(le.remainingMs); return }
      }
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'System error.' })
      schedDismiss(3_500)
    } finally { processing.current = false }
  }, [schedDismiss])

  // ── Process RFID ───────────────────────────────────────────────────────────
  const processRFID = useCallback(async (code: string) => {
    if (processing.current) return
    try { limiter.current.assertNotLocked() } catch (err) {
      if (err instanceof LockoutError) {
        setPhase({ kind: 'error', message: err.message })
        schedDismiss(err.remainingMs); return
      }
    }
    processing.current = true
    setPinDigits('')
    setPhase({ kind: 'processing' })
    try {
      const res = await apiKioskRFID(code)
      setSupabaseOk(true)
      limiter.current.onSuccess()
      setPhase({ kind: 'success', type: res.type, employee: res.employee, time: new Date().toISOString() })
      schedDismiss()
    } catch (err) {
      const isNetworkErr = err instanceof TypeError || (err as { code?: string })?.code === 'NETWORK_ERROR'
      if (isNetworkErr) setSupabaseOk(false)
      else              setSupabaseOk(true)
      try { limiter.current.onFailure() } catch (le) {
        if (le instanceof LockoutError) { setPhase({ kind: 'error', message: le.message }); schedDismiss(le.remainingMs); return }
      }
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'System error.' })
      schedDismiss(3_500)
    } finally { processing.current = false }
  }, [schedDismiss])

  // ── Global keydown — RFID + PIN detection ─────────────────────────────────
  const rfidBuf     = useRef('')
  const rfidTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeyTime = useRef(0)
  const inRfidMode  = useRef(false)

  useEffect(() => {
    function clearRTimer() {
      if (rfidTimer.current) { clearTimeout(rfidTimer.current); rfidTimer.current = null }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (exitModalOpenRef.current) return
      if (processing.current) return
      const ph = phaseRef.current
      if (ph.kind === 'success' || ph.kind === 'error') return
      // H6: Use ref instead of captured isBlocked — the closure would hold a stale
      // value if the holiday state changed after the effect registered.
      if (isBlockedRef.current) return

      const now      = Date.now()
      const prev     = lastKeyTime.current
      lastKeyTime.current = now
      const interval = now - prev
      const isFast   = prev > 0 && interval < RFID_CHAR_SPEED_MS

      if (e.key === 'Enter') {
        e.preventDefault()
        const captured = rfidBuf.current; clearRTimer()
        rfidBuf.current = ''; inRfidMode.current = false
        if (captured.length >= RFID_MIN_LEN) { setPinDigits(''); processRFID(captured) }
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault(); rfidBuf.current = ''; inRfidMode.current = false; clearRTimer()
        setPinDigits(p => p.slice(0, -1)); return
      }
      if (e.key === 'Escape') {
        rfidBuf.current = ''; inRfidMode.current = false; clearRTimer(); setPinDigits(''); return
      }
      if (e.key.length !== 1) return

      if (isFast || inRfidMode.current) {
        if (!inRfidMode.current) { inRfidMode.current = true; setPinDigits('') }
        rfidBuf.current += e.key; clearRTimer()
        rfidTimer.current = setTimeout(() => {
          const c = rfidBuf.current; rfidBuf.current = ''; inRfidMode.current = false; rfidTimer.current = null
          if (c.length >= RFID_MIN_LEN && !processing.current) processRFID(c)
        }, RFID_TIMEOUT_MS)
      } else if (/[0-9]/.test(e.key)) {
        rfidBuf.current += e.key; clearRTimer()
        rfidTimer.current = setTimeout(() => { rfidBuf.current = ''; rfidTimer.current = null; inRfidMode.current = false }, RFID_TIMEOUT_MS)
        setPinDigits(prev => {
          if (prev.length >= PIN_LENGTH) return prev
          const next = prev + e.key
          if (next.length === PIN_LENGTH) setTimeout(() => processPIN(next), 150)
          return next
        })
      } else {
        rfidBuf.current += e.key; clearRTimer()
        rfidTimer.current = setTimeout(() => {
          const c = rfidBuf.current; rfidBuf.current = ''; rfidTimer.current = null; inRfidMode.current = false
          if (c.length >= RFID_MIN_LEN && !processing.current) processRFID(c)
        }, RFID_TIMEOUT_MS)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); clearRTimer() }
  }, [processRFID, processPIN])   // H6: isBlockedRef used instead of isBlocked — effect is stable

  // ── Admin exit modal ───────────────────────────────────────────────────────
  const [exitModal,     setExitModal]    = useState(false)
  const [exitEmail,     setExitEmail]    = useState('')
  const [exitPassword,  setExitPassword] = useState('')
  const [exitShowPw,    setExitShowPw]   = useState(false)
  const [exitLoading,   setExitLoading]  = useState(false)
  const [exitError,     setExitError]    = useState('')
  const [lockCountdown, setLockCountdown]= useState(0)

  // C3: Persist lockout state to sessionStorage so it survives a page refresh.
  // Previously these were React state — F5 reset them, bypassing the lockout.
  const readExitLockUntil  = () => { try { return Number(sessionStorage.getItem(SS_EXIT_LOCK) ?? 0) } catch { return 0 } }
  const readExitAttempts   = () => { try { return Number(sessionStorage.getItem(SS_EXIT_TRIES) ?? 0) } catch { return 0 } }
  const writeExitLockUntil = (ts: number) => { try { sessionStorage.setItem(SS_EXIT_LOCK, String(ts)) } catch { /* blocked */ } }
  const writeExitAttempts  = (n:  number) => { try { sessionStorage.setItem(SS_EXIT_TRIES, String(n)) } catch { /* blocked */ } }
  const clearExitLock      = () => { try { sessionStorage.removeItem(SS_EXIT_LOCK); sessionStorage.removeItem(SS_EXIT_TRIES) } catch { /* blocked */ } }

  useEffect(() => { exitModalOpenRef.current = exitModal }, [exitModal])

  // Countdown ticker — reads live from sessionStorage so it works after a refresh
  useEffect(() => {
    const t = setInterval(() => {
      const rem = Math.ceil((readExitLockUntil() - Date.now()) / 1000)
      if (rem <= 0) { setLockCountdown(0) }
      else          { setLockCountdown(rem) }
    }, 500)
    return () => clearInterval(t)
  }, [])

  const openExit  = () => { setExitModal(true);  setExitEmail(''); setExitPassword(''); setExitError(''); setExitShowPw(false) }
  const closeExit = () => { setExitModal(false); setExitEmail(''); setExitPassword(''); setExitError(''); setExitShowPw(false) }

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const lockUntil = readExitLockUntil()
    if (lockUntil && Date.now() < lockUntil) return

    if (!exitPassword) { setExitError('Enter your password or offline PIN.'); return }
    setExitLoading(true); setExitError('')

    // C4: Offline admin PIN fallback.
    // If Supabase is unreachable (navigator.onLine=false OR supabaseOk=false)
    // AND a local admin PIN is configured, check it locally.
    // On match: just navigate to /login (the user is not authenticated yet,
    // but they're out of kiosk mode and can log in normally once online).
    if ((!isOnline || supabaseOk === false) && LOCAL_ADMIN_PIN) {
      try {
        const enteredHash = await hashPin(exitPassword)
        const adminHash   = await hashPin(LOCAL_ADMIN_PIN)
        if (enteredHash === adminHash) {
          clearExitLock()
          navigate('/login')
          return
        }
      } catch { /* hash failure — fall through to normal auth */ }
    }

    // Normal path: Supabase login
    if (!exitEmail) { setExitLoading(false); setExitError('Enter your email and password.'); return }
    try {
      const user = await apiLogin(exitEmail.trim().toLowerCase(), exitPassword)
      setSupabaseOk(true)
      clearExitLock()
      login(user); navigate('/dashboard')
    } catch {
      const next = readExitAttempts() + 1
      writeExitAttempts(next)
      if (next >= MAX_EXIT_ATTEMPTS) {
        const lockTs = Date.now() + EXIT_LOCKOUT_MS
        writeExitLockUntil(lockTs)
        writeExitAttempts(0)
        setExitError('Too many failed attempts. Locked for 2 minutes.')
      } else {
        setExitError(`Invalid credentials. ${MAX_EXIT_ATTEMPTS - next} attempt${MAX_EXIT_ATTEMPTS - next !== 1 ? 's' : ''} remaining.`)
      }
    } finally { setExitLoading(false) }
  }

  const isResult = phase.kind === 'success' || phase.kind === 'error'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#000' }}>

      {/* ══ Background image — full screen cover ═════════════════════════ */}
      <img
        src="/KIOSK.png"
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: phase.kind === 'processing' ? 0.4 : 1,
        }}
      />

      {/* ══ Holiday dimmer ═══════════════════════════════════════════════ */}
      {isBlocked && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
      )}

      {/* ══ M6: Special-working holiday notice (non-blocking, yellow) ════ */}
      {!isBlocked && isSpecialWorking && specialHoliday && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 8, padding: '6px 14px',
          fontSize: 11, fontWeight: 600, color: '#FCD34D',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          ⚠ Special Working Day: {specialHoliday.name} — 130% premium pay applies
        </div>
      )}

      {/* ══ Bottom gradient overlay (always visible) ═════════════════════ */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          // Gradient fades from solid dark at bottom to transparent ~40% up
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 40%, transparent 100%)',
          padding: '80px 48px 32px',
        }}
      >
        {/* ── Holiday banner ── */}
        {isBlocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, justifyContent: 'center' }}>
            <CalendarX style={{ width: 18, height: 18, color: '#FBBF24', flexShrink: 0 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#FBBF24' }}>
              {holiday?.name} — Attendance suspended today
            </p>
          </div>
        )}

        {/* ── Three-column bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>

          {/* Left: Logo + company */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img
              src="/Logo.png" alt="Logo"
              style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, opacity: 0.9 }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                TenPayroll
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, fontWeight: 500 }}>
                {company.name || 'Attendance Kiosk'}
              </p>
            </div>
          </div>

          {/* Center: PIN dots + status */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

            {/* Dots */}
            {!isBlocked && (
              <div style={{ display: 'flex', gap: 10 }}>
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background:   i < pinDigits.length ? '#fff' : 'transparent',
                      border:       `2px solid ${i < pinDigits.length ? '#fff' : 'rgba(255,255,255,0.35)'}`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Status text */}
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500, minHeight: '1.2rem', textAlign: 'center' }}>
              {phase.kind === 'processing'
                ? 'Verifying…'
                : isBlocked
                  ? ''
                  : pinDigits.length > 0
                    ? ''
                    : 'Tap your RFID card  ·  or type your PIN'}
            </p>
          </div>

          {/* Right: Clock */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {timeStr}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontWeight: 500 }}>
              {dateStr}
            </p>
          </div>
        </div>
      </div>

      {/* ══ Processing spinner ════════════════════════════════════════════ */}
      {phase.kind === 'processing' && (
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

      {/* ══ Connectivity indicator — top-left (M1: 3-state) ═════════════ */}
      {(() => {
        // Three states: network offline / network up but Supabase down / fully connected
        let dotColor = '#10B981'
        let label    = 'Online'
        if (!isOnline) {
          dotColor = '#EF4444'; label = 'Offline'
        } else if (supabaseOk === false) {
          dotColor = '#F59E0B'; label = 'Service unreachable'
        }
        return (
          <div style={{
            position: 'absolute', top: 16, left: 20,
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 500,
            color: 'rgba(255,255,255,0.45)',
            pointerEvents: 'none',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
            {label}
          </div>
        )
      })()}

      {/* ══ Admin exit button (top-right, ghost) ═════════════════════════ */}
      <button
        onClick={openExit}
        style={{
          position: 'absolute', top: 16, right: 20,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.18)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.18)' }}
      >
        <Settings2 style={{ width: 13, height: 13 }} />
        Admin Login
      </button>

      {/* ══ Result overlay ════════════════════════════════════════════════ */}
      {isResult && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
            background: phase.kind === 'success'
              ? phase.type === 'time-in'
                ? 'rgba(5, 20, 10, 0.97)'
                : 'rgba(5, 12, 28, 0.97)'
              : 'rgba(20, 5, 5, 0.97)',
          }}
        >
          {phase.kind === 'success' ? (
            <>
              {/* Icon */}
              <div style={{
                width: 100, height: 100, borderRadius: 24,
                background: phase.type === 'time-in' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                border: `2px solid ${phase.type === 'time-in' ? 'rgba(34,197,94,0.30)' : 'rgba(59,130,246,0.30)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {phase.type === 'time-in'
                  ? <CheckCircle2 style={{ width: 48, height: 48, color: '#4ADE80' }} />
                  : <LogOut       style={{ width: 48, height: 48, color: '#60A5FA' }} />
                }
              </div>

              {/* Label */}
              <p style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: phase.type === 'time-in' ? '#4ADE80' : '#60A5FA',
              }}>
                {phase.type === 'time-in' ? '✓  Time In Recorded' : '✓  Time Out Recorded'}
              </p>

              {/* Name */}
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: 52, fontWeight: 900, color: '#fff',
                  lineHeight: 1.05, letterSpacing: '-0.03em',
                }}>
                  {phase.employee.fullName}
                </p>
                {phase.employee.department && (
                  <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                    {phase.employee.department}
                    {phase.employee.position ? `  ·  ${phase.employee.position}` : ''}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <div style={{
                padding: '14px 36px', borderRadius: 12,
                background: phase.type === 'time-in' ? 'rgba(34,197,94,0.08)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${phase.type === 'time-in' ? 'rgba(34,197,94,0.20)' : 'rgba(59,130,246,0.20)'}`,
              }}>
                <p style={{
                  fontSize: 30, fontWeight: 700,
                  color: phase.type === 'time-in' ? '#4ADE80' : '#60A5FA',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {new Date(phase.time).toLocaleTimeString('en-PH', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                  })}
                </p>
              </div>

              <LogIn style={{ width: 0, height: 0 }} /> {/* keeps LogIn in bundle */}
            </>
          ) : (
            <>
              <div style={{
                width: 84, height: 84, borderRadius: 20,
                background: 'rgba(239,68,68,0.10)', border: '2px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <XCircle style={{ width: 42, height: 42, color: '#F87171' }} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F87171' }}>
                Check-in Failed
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center', maxWidth: 480 }}>
                {phase.message}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Please contact HR or try again.</p>
              <button
                onClick={() => { setPhase({ kind: 'idle' }); processing.current = false }}
                style={{
                  marginTop: 8, padding: '11px 32px', borderRadius: 10,
                  background: '#1D4ED8', border: 'none', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Try Again
              </button>

              {/* keep unused icons in bundle */}
              <AlertCircle style={{ width: 0, height: 0 }} />
            </>
          )}

          <p style={{ position: 'absolute', bottom: 28, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            Returning to screen…
          </p>
        </div>
      )}

      {/* ══ Admin exit modal ═════════════════════════════════════════════ */}
      {exitModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeExit() }}
        >
          <div style={{
            width: '100%', maxWidth: 380, background: '#13161D',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
            padding: '32px 32px 28px', boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          }}>
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
                Sign in with your admin credentials to exit kiosk mode.
              </p>
            </div>
            {/* C4: Show offline notice when Supabase is unreachable */}
            {(!isOnline || supabaseOk === false) && LOCAL_ADMIN_PIN && (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#FCD34D', lineHeight: 1.5, marginBottom: 8 }}>
                Network unavailable — enter the offline admin PIN in the password field to exit.
              </div>
            )}
            <form onSubmit={handleExitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Email field — hidden when offline and local PIN is set */}
              {(isOnline && supabaseOk !== false) && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 5 }}>Email address</label>
                  <input type="email" value={exitEmail} onChange={e => setExitEmail(e.target.value)}
                    placeholder="admin@company.com" autoComplete="email"
                    disabled={exitLoading || lockCountdown > 0}
                    style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13.5, padding: '0 12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 5 }}>
                  {(!isOnline || supabaseOk === false) && LOCAL_ADMIN_PIN ? 'Offline PIN' : 'Password'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input type={exitShowPw ? 'text' : 'password'} value={exitPassword} onChange={e => setExitPassword(e.target.value)}
                    placeholder={(!isOnline || supabaseOk === false) && LOCAL_ADMIN_PIN ? 'Enter offline admin PIN' : 'Enter password'}
                    autoComplete="current-password"
                    disabled={exitLoading || lockCountdown > 0}
                    style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13.5, padding: '0 40px 0 12px', outline: 'none', boxSizing: 'border-box' }} />
                  <button type="button" onClick={() => setExitShowPw(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563' }}>
                    {exitShowPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>
              {exitError && (
                <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 7, padding: '8px 12px', fontSize: 12.5, color: '#FCA5A5', lineHeight: 1.5 }}>
                  {exitError}{lockCountdown > 0 && <strong> ({lockCountdown}s)</strong>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={closeExit} disabled={exitLoading}
                  style={{ flex: 1, height: 38, borderRadius: 8, fontSize: 13.5, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={exitLoading || lockCountdown > 0}
                  style={{ flex: 1, height: 38, borderRadius: 8, fontSize: 13.5, fontWeight: 600, background: '#DC2626', border: 'none', color: '#fff', cursor: exitLoading || lockCountdown > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: exitLoading || lockCountdown > 0 ? 0.5 : 1 }}>
                  {exitLoading ? <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : 'Sign In & Exit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
