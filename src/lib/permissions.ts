// permissions.ts — usePermission hook + PermissionGate component
import { useAuthStore } from '../store/authStore'
import { ROLE_PERMISSION_PRESETS } from '../types'
import type { UserPermissions } from '../types'

/**
 * Returns true if the current user has the given permission.
 * super-admin always returns true.
 * Falls back to role preset when profile.permissions is empty/missing.
 */
export function usePermission(key: keyof UserPermissions): boolean {
  const user = useAuthStore(s => s.user)
  if (!user) return false
  if (user.role === 'super-admin') return true

  // If the user has explicit granular permissions, use those
  const perms = user.permissions as UserPermissions | null | undefined
  if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
    return perms[key] ?? false
  }

  // Fall back to role preset
  const preset = ROLE_PERMISSION_PRESETS[user.role]
  return preset ? (preset[key] ?? false) : false
}

/**
 * Returns the full permissions object for the current user
 * (merges role preset with any explicit overrides).
 */
export function usePermissions(): UserPermissions {
  const user = useAuthStore(s => s.user)
  if (!user) return ROLE_PERMISSION_PRESETS['employee']
  if (user.role === 'super-admin') return ROLE_PERMISSION_PRESETS['super-admin']

  const preset = ROLE_PERMISSION_PRESETS[user.role] ?? ROLE_PERMISSION_PRESETS['employee']
  const perms  = user.permissions as Partial<UserPermissions> | null | undefined

  if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
    return { ...preset, ...perms }
  }
  return preset
}
