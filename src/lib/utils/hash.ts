// ─── Cryptographic hashing — Web Crypto API (available in all modern browsers) ─
//
// Uses SHA-256 + a site-specific salt sourced from VITE_HASH_SALT.
// The salt must be an arbitrary non-empty string set in your .env file:
//
//   VITE_HASH_SALT=<any long random string you generate once>
//
// Purpose: prevents rainbow-table attacks on stored PIN / RFID values.
// Without a salt, an attacker who reads the DB can look up all 4-6 digit
// PINs from a precomputed SHA-256 table in milliseconds.

const SALT = import.meta.env.VITE_HASH_SALT as string | undefined

if (!SALT && import.meta.env.DEV) {
  console.warn(
    '[hash] VITE_HASH_SALT is not set. ' +
    'Add it to .env before going to production, otherwise PINs are salted with an empty string.'
  )
}

/**
 * Returns the hex-encoded SHA-256 digest of `input` concatenated with the
 * site salt.  Always resolves; never throws.
 *
 * Example:
 *   await hashSecret('1234')  // → '8d969e...'  (deterministic per salt)
 */
export async function hashSecret(input: string): Promise<string> {
  const raw     = (SALT ?? '') + input
  const encoded = new TextEncoder().encode(raw)
  const buffer  = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convenience: hash and return the first N hex chars (default 64 = full SHA-256).
 * Not currently truncated — kept for future flexibility.
 */
export const hashPin  = (pin:  string) => hashSecret(pin)
export const hashRfid = (rfid: string) => hashSecret(rfid)
