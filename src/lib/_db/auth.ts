// ─── Auth ─────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { SUPABASE_URL } from '../config/backend'
import type { HRUser, UserPermissions, UserRole } from '../../types'
import { ROLE_PERMISSION_PRESETS } from '../../types'

// ── Profile & password management ─────────────────────────────────────────────

/** Upload a new profile photo to the 'avatars' bucket and return its public URL. */
export async function apiUploadAvatar(userId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw new Error(`Avatar upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  // Cache-bust so the browser picks up the new image
  return `${publicUrl}?t=${Date.now()}`
}

/** Update the profiles row for the current user (name and/or avatar URL). */
export async function apiUpdateProfile(
  userId: string,
  updates: { name?: string; avatarUrl?: string },
): Promise<void> {
  const patch: Record<string, unknown> = {}

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim()
    patch.name            = trimmed
    patch.avatar_initials = trimmed
      .split(' ').filter(Boolean)
      .map((w: string) => w[0]).join('')
      .slice(0, 2).toUpperCase()
  }
  if (updates.avatarUrl !== undefined) {
    patch.avatar_url = updates.avatarUrl
  }

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Change the currently signed-in user's password.
 * Caller is responsible for re-authenticating first to verify identity.
 */
export async function apiUpdatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

// Derive storage key once at module load — no hardcoded project IDs
const _projectId = (() => {
  try { return new URL(SUPABASE_URL).hostname.split('.')[0] } catch { return '' }
})()
const _tokenKey = _projectId ? `sb-${_projectId}-auth-token` : null

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch the permission grants for a role slug from hr_role_permissions.
 * Returns null when the table doesn't exist yet (migration 006 not run) so
 * callers can fall back gracefully to the TypeScript presets.
 */
async function loadRolePermissions(roleSlug: string): Promise<Partial<UserPermissions> | null> {
  try {
    // 1. Resolve role id from hr_roles
    const { data: roleRow, error: roleErr } = await supabase
      .from('hr_roles')
      .select('id')
      .eq('slug', roleSlug)
      .single()
    if (roleErr || !roleRow) return null

    // 2. Fetch all grants for this role
    const { data: permRows, error: permErr } = await supabase
      .from('hr_role_permissions')
      .select('permission, granted')
      .eq('role_id', roleRow.id)
    if (permErr || !permRows) return null

    // Build a partial UserPermissions map from the rows
    const perms: Record<string, boolean> = {}
    for (const r of permRows) perms[r.permission] = r.granted
    return perms as Partial<UserPermissions>
  } catch {
    // Table not created yet — graceful degradation
    return null
  }
}

export async function loadProfile(userId: string): Promise<HRUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (!data) return null

  // ── Permission resolution (priority order) ────────────────────────────────
  // 1. TypeScript preset for the role slug (backward compat for built-in slugs)
  // 2. DB role grants from hr_role_permissions (legacy table, may not exist)
  // 3. Per-user overrides from profiles.permissions JSONB (highest priority)
  // Result is always a complete UserPermissions object — never undefined.
  const builtInPreset  = ROLE_PERMISSION_PRESETS[data.role as UserRole] ?? null
  const dbRolePerms    = await loadRolePermissions(data.role)
  const profilePerms   = data.permissions as Partial<UserPermissions> | null | undefined

  const permissions: Partial<UserPermissions> = {
    ...(builtInPreset  ?? {}),
    ...(dbRolePerms    ?? {}),
    ...(profilePerms   ?? {}),
  }

  return {
    id:             data.id,
    name:           data.name,
    email:          '',   // filled in by caller from auth session
    role:           data.role,
    roleLabel:      data.role_label ?? undefined,
    employeeId:     data.employee_id ?? undefined,
    department:     data.department  ?? undefined,
    avatarInitials: data.avatar_initials ?? data.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    avatarUrl:      data.avatar_url  ?? undefined,
    permissions,
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
