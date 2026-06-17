import { useState, useEffect, useCallback, useRef } from 'react'
import { MainScreen }     from './screens/MainScreen'
import { ResultOverlay }  from './screens/ResultOverlay'

// ─── Shared types ─────────────────────────────────────────────────────────────
export type PinMode = 'idle' | 'typing' | 'processing'

export type ResultData = {
  success:   boolean
  type?:     'time-in' | 'time-out'
  employee?: { fullName: string; department: string | null; position: string | null }
  error?:    string
}

// ─── Input detection constants ────────────────────────────────────────────────
// RFID scanners are HID keyboards that fire chars extremely fast (< 10 ms apart).
// A human typing on a numpad is 150–500 ms between keys.
// We classify by the inter-key interval of each arriving character.
// L2: Lowered from 80ms → 50ms to reduce risk of fast human typing being
// misclassified as RFID. Most HID RFID scanners fire chars within 5–20ms.
const RFID_CHAR_SPEED_MS = 50   // chars within 50 ms of each other → RFID scanner
const RFID_MIN_LEN       = 4   // ignore bursts shorter than 4 chars
const RFID_TIMEOUT_MS    = 300  // drain buffer after 300 ms of silence
const PIN_LENGTH         = 6
const RESULT_HOLD_MS     = 4_000

// Mirrors the SyncStatus type declared in src/preload/index.ts
type SyncStatus = {
  online:    boolean
  pending:   number
  failed:    number
  state:     'idle' | 'syncing' | 'error' | 'offline' | 'unknown'
  lastSync:  string | null
  lastError: string | null
}

export default function App() {
  const [pinDigits,          setPinDigits]          = useState('')
  const [pinMode,            setPinMode]            = useState<PinMode>('idle')
  const [result,             setResult]             = useState<ResultData | null>(null)
  const [isHoliday,          setIsHoliday]          = useState(false)
  const [holidayInfo,        setHolidayInfo]        = useState<{ name: string; type: string } | null>(null)
  // M6: Special-working holiday — non-blocking, yellow notice
  const [specialHolidayInfo, setSpecialHolidayInfo] = useState<{ name: string; type: string } | null>(null)
  const [syncStatus,         setSyncStatus]         = useState<SyncStatus | null>(null)

  // Mutable refs — mutated without re-renders
  const rfidBuf     = useRef('')
  const rfidTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeyTime = useRef(0)          // 0 = no key pressed yet this session
  const inRfidMode  = useRef(false)      // true while accumulating an RFID burst
  const processing  = useRef(false)      // true while awaiting IPC result
  const resultRef   = useRef<ResultData | null>(null)   // mirrors result state (avoids stale closure)
  const holidayRef  = useRef(false)                     // mirrors isHoliday state

  // Keep refs in sync with state
  useEffect(() => { resultRef.current  = result    }, [result])
  useEffect(() => { holidayRef.current = isHoliday }, [isHoliday])

  // ── Sync status poll (every 10 s) ────────────────────────────────────────
  // pollSyncStatus is also exposed to MainScreen so the "Retry sync now"
  // button in the diagnostics popover can refresh the badge immediately
  // instead of waiting up to 10 s for the next scheduled tick.
  const pollSyncStatus = useCallback(async () => {
    try { setSyncStatus(await window.kiosk.syncStatus()) } catch { /* preload not ready yet */ }
  }, [])

  useEffect(() => {
    pollSyncStatus()
    const id = setInterval(pollSyncStatus, 10_000)
    return () => clearInterval(id)
  }, [pollSyncStatus])

  // ── Holiday polls (every 5 min — covers midnight rollover) ────────────────
  useEffect(() => {
    async function checkBlocking() {
      try {
        const h = await window.kiosk.todayHoliday()
        setIsHoliday(h !== null)
        setHolidayInfo(h ? { name: h.name, type: h.type } : null)
      } catch { /* offline — keep current state */ }
    }
    checkBlocking()
    const id = setInterval(checkBlocking, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  // M6: Special-working holiday (non-blocking, yellow notice)
  useEffect(() => {
    async function checkSpecial() {
      try {
        const h = await window.kiosk.todaySpecialHoliday()
        setSpecialHolidayInfo(h ? { name: h.name, type: h.type } : null)
      } catch { /* offline — keep current state */ }
    }
    checkSpecial()
    const id = setInterval(checkSpecial, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Result: show overlay then return to idle ───────────────────────────────
  const showResult = useCallback((res: ResultData) => {
    setResult(res)
    setPinDigits('')
    setPinMode('idle')
    setTimeout(() => {
      setResult(null)
      processing.current = false
    }, RESULT_HOLD_MS)
  }, [])

  // ── PIN check-in ──────────────────────────────────────────────────────────
  const triggerPIN = useCallback(async (pin: string) => {
    if (processing.current) return
    processing.current = true
    setPinMode('processing')
    const res = await window.kiosk.pinCheckin(pin)
    showResult(res)
  }, [showResult])

  // ── RFID check-in ─────────────────────────────────────────────────────────
  const triggerRFID = useCallback(async (rfid: string) => {
    if (processing.current) return
    processing.current = true
    setPinMode('processing')
    const res = await window.kiosk.rfidCheckin(rfid)
    showResult(res)
  }, [showResult])

  // ── Global keyboard listener ──────────────────────────────────────────────
  // This single listener handles BOTH input methods — no clicking required.
  //
  // Classification algorithm:
  //   1. Track the time between consecutive keypresses.
  //   2. If the interval to the previous key < RFID_CHAR_SPEED_MS OR we are
  //      already buffering a fast burst → RFID mode (accumulate in rfidBuf).
  //   3. Otherwise (human pace) + digit key → PIN digit.
  //   4. Enter key: fire RFID if buffer is long enough (≥ 4 chars).
  //   5. Timeout (300 ms of silence): drain rfidBuf as RFID if ≥ 4 chars.
  //
  // Edge case: first char of an RFID scan always appears "slow" (no prior key).
  //   We also push it into rfidBuf so that when the fast burst follows from
  //   char 2 onward, the whole sequence is captured and length ≥ 4.
  useEffect(() => {
    function clearRTimer() {
      if (rfidTimer.current) { clearTimeout(rfidTimer.current); rfidTimer.current = null }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keystrokes while a text/password input has focus
      // (e.g. admin PIN modal — its keys must go to the input, not the PIN dots)
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Block input during processing or while result is on screen
      if (processing.current) return
      if (resultRef.current)  return
      if (holidayRef.current) return

      // Measure inter-key interval
      const now         = Date.now()
      const prevTime    = lastKeyTime.current
      lastKeyTime.current = now
      const interval    = now - prevTime
      // "Fast" means: a previous key existed AND it arrived within threshold
      const isFast      = prevTime > 0 && interval < RFID_CHAR_SPEED_MS

      // ── Enter: fire RFID if buffer has content ──────────────────────────
      if (e.key === 'Enter') {
        e.preventDefault()
        const captured = rfidBuf.current
        clearRTimer()
        rfidBuf.current    = ''
        inRfidMode.current = false
        if (captured.length >= RFID_MIN_LEN) {
          setPinDigits('')
          setPinMode('idle')
          triggerRFID(captured)
        }
        return
      }

      // ── Backspace: remove last PIN digit ─────────────────────────────────
      if (e.key === 'Backspace') {
        e.preventDefault()
        rfidBuf.current    = ''
        inRfidMode.current = false
        clearRTimer()
        setPinDigits(p => {
          const next = p.slice(0, -1)
          setPinMode(next.length === 0 ? 'idle' : 'typing')
          return next
        })
        return
      }

      // ── Escape: clear PIN input ───────────────────────────────────────────
      if (e.key === 'Escape') {
        rfidBuf.current    = ''
        inRfidMode.current = false
        clearRTimer()
        setPinDigits('')
        setPinMode('idle')
        return
      }

      // Ignore non-printable keys (shift, ctrl, arrows, F-keys, etc.)
      if (e.key.length !== 1) return

      // ── Fast character OR already accumulating RFID → RFID mode ──────────
      if (isFast || inRfidMode.current) {
        if (!inRfidMode.current) {
          // Transition into RFID mode — erase any partial PIN display
          inRfidMode.current = true
          setPinDigits('')
          setPinMode('idle')
        }
        rfidBuf.current += e.key

        clearRTimer()
        rfidTimer.current = setTimeout(() => {
          const captured     = rfidBuf.current
          rfidBuf.current    = ''
          inRfidMode.current = false
          rfidTimer.current  = null
          if (captured.length >= RFID_MIN_LEN && !processing.current) {
            triggerRFID(captured)
          }
        }, RFID_TIMEOUT_MS)

      // ── Slow digit → PIN input ────────────────────────────────────────────
      } else if (/[0-9]/.test(e.key)) {
        // Also push into rfidBuf so that if the NEXT key arrives fast we can
        // reclassify the whole sequence as RFID (e.g. RFID card tag starts
        // with a digit that was inadvertently "slow" on the very first press).
        rfidBuf.current += e.key
        clearRTimer()
        rfidTimer.current = setTimeout(() => {
          // Timer fired without a fast burst → was just a PIN digit; discard buffer.
          rfidBuf.current   = ''
          rfidTimer.current = null
          inRfidMode.current = false
        }, RFID_TIMEOUT_MS)

        setPinDigits(prev => {
          if (prev.length >= PIN_LENGTH) return prev
          const next = prev + e.key
          setPinMode('typing')
          if (next.length === PIN_LENGTH) {
            // Let the dots paint, then submit
            setTimeout(() => triggerPIN(next), 150)
          }
          return next
        })

      // ── Slow non-digit → likely the first char of an RFID tag ────────────
      } else {
        rfidBuf.current += e.key
        clearRTimer()
        rfidTimer.current = setTimeout(() => {
          const captured     = rfidBuf.current
          rfidBuf.current    = ''
          rfidTimer.current  = null
          inRfidMode.current = false
          if (captured.length >= RFID_MIN_LEN && !processing.current) {
            triggerRFID(captured)
          }
        }, RFID_TIMEOUT_MS)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearRTimer()
    }
  }, [triggerPIN, triggerRFID])  // both are stable useCallback refs — runs once

  // ── On-screen keypad handler (mouse/touch fallback) ───────────────────────
  const handleKeypadPress = useCallback((key: string) => {
    if (processing.current || resultRef.current || holidayRef.current) return
    if (key === '⌫') {
      setPinDigits(p => {
        const next = p.slice(0, -1)
        setPinMode(next.length === 0 ? 'idle' : 'typing')
        return next
      })
      return
    }
    setPinDigits(prev => {
      if (prev.length >= PIN_LENGTH) return prev
      const next = prev + key
      setPinMode('typing')
      if (next.length === PIN_LENGTH) {
        setTimeout(() => triggerPIN(next), 150)
      }
      return next
    })
  }, [triggerPIN])

  const handleClear = useCallback(() => {
    if (processing.current) return
    rfidBuf.current    = ''
    inRfidMode.current = false
    if (rfidTimer.current) { clearTimeout(rfidTimer.current); rfidTimer.current = null }
    setPinDigits('')
    setPinMode('idle')
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <MainScreen
        pinDigits={pinDigits}
        pinMode={pinMode}
        isHoliday={isHoliday}
        holidayInfo={holidayInfo}
        specialHolidayInfo={specialHolidayInfo}
        syncStatus={syncStatus}
        onRequestSyncStatus={pollSyncStatus}
        onKeypadPress={handleKeypadPress}
        onClear={handleClear}
      />
      {result && <ResultOverlay data={result} />}
    </div>
  )
}
