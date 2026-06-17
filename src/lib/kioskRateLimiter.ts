// ─── Kiosk brute-force rate limiter ──────────────────────────────────────────
// Tracks failed PIN/RFID attempts, persisted to sessionStorage so a page refresh
// does NOT reset the counter (C2 fix — previously in-memory closures were cleared
// by F5, allowing unlimited brute-force retries).
//
// M4: Lockout duration raised from 30 s → 120 s to match the Electron kiosk.
//
// Usage:
//   const limiter = createKioskRateLimiter()
//   limiter.assertNotLocked()         // throws LockoutError if locked
//   try {
//     await apiKioskPIN(pin)
//     limiter.onSuccess()
//   } catch {
//     limiter.onFailure()             // may throw LockoutError when threshold hit
//   }

export const MAX_FAILURES = 5
export const LOCKOUT_MS   = 120_000   // 2 minutes — matches Electron kiosk (M4)

const SS_LOCK    = 'kiosk_lock_until'   // sessionStorage key: epoch ms
const SS_FAILS   = 'kiosk_failures'     // sessionStorage key: failure count

// sessionStorage helpers — safe even if storage access is blocked
function ssGet(key: string, def = 0): number {
  try { return Number(sessionStorage.getItem(key) ?? def) } catch { return def }
}
function ssSet(key: string, val: number): void {
  try { sessionStorage.setItem(key, String(val)) } catch { /* storage blocked */ }
}
function ssClear(): void {
  try { sessionStorage.removeItem(SS_LOCK); sessionStorage.removeItem(SS_FAILS) } catch { /* blocked */ }
}

export class LockoutError extends Error {
  remainingMs: number
  constructor(remainingMs: number) {
    const secs = Math.ceil(remainingMs / 1000)
    super(`Too many failed attempts. Kiosk is locked for ${secs} second${secs !== 1 ? 's' : ''}.`)
    this.name        = 'LockoutError'
    this.remainingMs = remainingMs
  }
}

export interface KioskRateLimiter {
  /** Throws LockoutError if currently locked. Call before attempting login. */
  assertNotLocked(): void
  /** Call on every failed attempt. May throw LockoutError when threshold is hit. */
  onFailure(): void
  /** Call on successful login to reset the counter. */
  onSuccess(): void
  /** Current failure count (for UI display). */
  readonly failures: number
  /** Remaining lockout ms, or 0 if not locked. */
  readonly remainingLockoutMs: number
}

export function createKioskRateLimiter(): KioskRateLimiter {
  return {
    get failures() { return ssGet(SS_FAILS) },

    get remainingLockoutMs() {
      const rem = ssGet(SS_LOCK) - Date.now()
      return rem > 0 ? rem : 0
    },

    assertNotLocked() {
      const lockUntil = ssGet(SS_LOCK)
      const rem       = lockUntil - Date.now()
      if (rem > 0) throw new LockoutError(rem)
      if (lockUntil > 0) ssClear()   // expired — clean up stale entry
    },

    onSuccess() {
      ssClear()
    },

    onFailure() {
      const next = ssGet(SS_FAILS) + 1
      ssSet(SS_FAILS, next)
      if (next >= MAX_FAILURES) {
        const lockUntil = Date.now() + LOCKOUT_MS
        ssSet(SS_LOCK, lockUntil)
        ssSet(SS_FAILS, 0)   // reset counter so next lockout also needs MAX_FAILURES fails
        // Auto-clear sessionStorage after the lockout so a tab reload after the
        // period shows a clean state (not a stale "locked" entry).
        setTimeout(() => ssClear(), LOCKOUT_MS)
        throw new LockoutError(LOCKOUT_MS)
      }
    },
  }
}
