// ─── Supabase Client Singleton ─────────────────────────────────────────────────
// Import this everywhere you need DB access.
// The client is created once and reused across the app.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config/backend'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,          // keeps session in localStorage
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})

// ── Typed helper: throw on error, return data ─────────────────────────────────
export async function q<T>(
  promise: Promise<{ data: T | null; error: unknown }>
): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data as T
}

// ── User-friendly error messages ──────────────────────────────────────────────
export function humanizeError(err: unknown): string {
  if (!err) return 'An unknown error occurred.'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'An unexpected error occurred.'
}
