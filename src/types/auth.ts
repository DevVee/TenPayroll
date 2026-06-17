// ─── Auth & RBAC types ────────────────────────────────────────────────────────

export type UserRole = 'super-admin' | 'hr-admin' | 'payroll-officer' | 'dept-head' | 'employee'

// ─── Granular Permissions ─────────────────────────────────────────────────────
export interface UserPermissions {
  // Employees
  emp_view:    boolean; emp_create:  boolean; emp_edit:   boolean; emp_delete:  boolean
  // Attendance
  att_view:    boolean; att_mark:    boolean; att_edit:   boolean
  // Leaves
  leave_view:  boolean; leave_approve: boolean
  // Overtime
  ot_view:     boolean; ot_approve:  boolean
  // Payroll
  pay_view:    boolean; pay_generate: boolean; pay_approve: boolean; pay_delete: boolean
  // Reports
  reports_view: boolean
  // Settings
  settings_view: boolean; settings_edit: boolean
  // Users
  users_view:  boolean; users_create: boolean; users_edit: boolean
}

const _ALL_TRUE: UserPermissions = {
  emp_view: true, emp_create: true, emp_edit: true, emp_delete: true,
  att_view: true, att_mark: true, att_edit: true,
  leave_view: true, leave_approve: true,
  ot_view: true, ot_approve: true,
  pay_view: true, pay_generate: true, pay_approve: true, pay_delete: true,
  reports_view: true,
  settings_view: true, settings_edit: true,
  users_view: true, users_create: true, users_edit: true,
}
const _ALL_FALSE: UserPermissions = {
  emp_view: false, emp_create: false, emp_edit: false, emp_delete: false,
  att_view: false, att_mark: false, att_edit: false,
  leave_view: false, leave_approve: false,
  ot_view: false, ot_approve: false,
  pay_view: false, pay_generate: false, pay_approve: false, pay_delete: false,
  reports_view: false,
  settings_view: false, settings_edit: false,
  users_view: false, users_create: false, users_edit: false,
}

/**
 * Hardcoded permission presets per role.
 * TODO (DB Migration #6): move to a `role_permissions` table in Supabase so
 * HR admins can define custom roles without a code deploy.
 */
export const ROLE_PERMISSION_PRESETS: Record<UserRole, UserPermissions> = {
  'super-admin': { ..._ALL_TRUE },
  'hr-admin': {
    ..._ALL_FALSE,
    emp_view: true, emp_create: true, emp_edit: true, emp_delete: true,
    att_view: true, att_mark: true, att_edit: true,
    leave_view: true, leave_approve: true,
    ot_view: true, ot_approve: true,
    pay_view: true,
    reports_view: true,
    settings_view: true,
    users_view: true,
  },
  'payroll-officer': {
    ..._ALL_FALSE,
    emp_view: true,
    att_view: true,
    leave_view: true,
    ot_view: true,
    pay_view: true, pay_generate: true, pay_approve: true, pay_delete: true,
    reports_view: true,
    settings_view: true,
  },
  'dept-head': {
    ..._ALL_FALSE,
    emp_view: true,
    att_view: true,
    leave_view: true, leave_approve: true,
    ot_view: true, ot_approve: true,
    pay_view: true,
    reports_view: true,
  },
  'employee': { ..._ALL_FALSE },
}

// ─── Authenticated user profile ───────────────────────────────────────────────
export interface HRUser {
  id: string
  name: string
  email: string
  /** The built-in role slug — controls nav and RLS. */
  role: UserRole
  /**
   * Custom role display name (from role_templates.label).
   * When set, this is shown in the UI instead of ROLE_LABELS[role].
   * The underlying `role` field still holds the parent built-in slug.
   */
  roleLabel?: string
  employeeId?: string
  department?: string
  avatarInitials: string
  /** Supabase Storage public URL for the user's profile photo, if uploaded. */
  avatarUrl?: string
  permissions?: Partial<UserPermissions>
}
