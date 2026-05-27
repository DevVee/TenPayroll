// ─── Auth ─────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { SUPABASE_URL } from '../config/backend'
import type { HRUser } from '../../types'

// Derive storage key once at module load — no hardcoded project IDs
const _projectId = (() => {
  try { return new URL(SUPABASE_URL).hostname.split('.')[0] } catch { return '' }
})()
const _tokenKey = _projectId ? `sb-${_projectId}-auth-token` : null

// ── Helpers ───────────────────────────────────────────────────────────────────
export async function loadProfile(userId: string): Promise<HRUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (!data) return null
  return {
    id:             data.id,
    name:           data.name,
    email:          '',   // filled in by caller from auth session
    role:           data.role,
    employeeId:     data.employee_id ?? undefined,
    department:     data.department  ?? undefined,
    avatarInitials: data.avatar_initials ?? data.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiLogin(email: string, password: string): Promise<HRUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(error?.message ?? 'Login failed')

  const profile = await loadProfile(data.user.id)
  if (!profile) throw new Error('Account found but no profile record. Please contact admin.')

  return { ...profile, email: data.user.email! }
}

export async function apiLogout(): Promise<void> {
  await supabase.auth.signOut()
}

/** Returns the current HRUser from the active Supabase session, or null. */
export async function getCurrentUserAsync(): Promise<HRUser | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const profile = await loadProfile(session.user.id)
  if (!profile) return null
  return { ...profile, email: session.user.email! }
}

/** Synchronous token getter — reads Supabase's localStorage entry with a dynamic key. */
export function getToken(): string | null {
  try {
    if (!_tokenKey) return null
    const raw = localStorage.getItem(_tokenKey)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.access_token ?? null
  } catch {
    return null
  }
}

/** Legacy synchronous fallback — returns null (auth is async with Supabase). */
export function getCurrentUser(): HRUser | null { return null }
