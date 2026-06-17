// ─── Navigation Configuration — permission-driven, role-agnostic ────────────
// Nav items declare which permission key grants access.
// Only super-admin is checked by role; everyone else uses profiles.permissions.
import type { UserPermissions } from '../types'

export type NavSection = 'OVERVIEW' | 'WORKFORCE' | 'PAYROLL' | 'SYSTEM'

export interface NavChild {
  label: string
  to: string
  end?: boolean
}

export interface NavItem {
  id: string
  label: string
  to: string
  icon: string              // lucide icon name
  section: NavSection
  module: string
  /**
   * Permission key required to see this nav item.
   * undefined = any admin user (someone with at least one permission = true)
   */
  permission?: keyof UserPermissions
  children?: NavChild[]
  badge?: string
}

export const NAV_ITEMS: NavItem[] = [
  // ── OVERVIEW ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    label: 'Dashboard', to: '/dashboard', icon: 'LayoutDashboard',
    permission: undefined,          // any admin (anyone with ≥1 permission)
    section: 'OVERVIEW', module: 'employees',
  },
  // ── WORKFORCE ────────────────────────────────────────────────────────────
  {
    id: 'employees',
    label: 'Employees', to: '/employees', icon: 'Users',
    permission: 'emp_view',
    section: 'WORKFORCE', module: 'employees',
    children: [
      { label: 'Directory',    to: '/employees',     end: true },
      { label: 'Add Employee', to: '/employees/new' },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance', to: '/attendance', icon: 'Clock',
    permission: 'att_view',
    section: 'WORKFORCE', module: 'attendance',
    children: [
      { label: "Today's Log",    to: '/attendance',     end: true },
      { label: 'Attendance Log', to: '/attendance/log' },
    ],
  },
  {
    id: 'leaves',
    label: 'Leave Management', to: '/leaves', icon: 'Umbrella',
    permission: 'leave_view',
    section: 'WORKFORCE', module: 'leaves',
  },
  {
    id: 'overtime',
    label: 'Overtime', to: '/overtime', icon: 'Timer',
    permission: 'ot_view',
    section: 'WORKFORCE', module: 'overtime',
  },
  {
    id: 'schedules',
    label: 'Schedules', to: '/schedules', icon: 'Calendar',
    permission: 'emp_edit',
    section: 'WORKFORCE', module: 'schedules',
    children: [
      { label: 'Work Shifts', to: '/schedules/shifts' },
      { label: 'Holidays',    to: '/schedules/holidays' },
    ],
  },

  // ── PAYROLL ───────────────────────────────────────────────────────────────
  {
    id: 'payroll',
    label: 'Payroll Runs', to: '/payroll', icon: 'Banknote',
    permission: 'pay_view',
    section: 'PAYROLL', module: 'payroll',
    children: [
      { label: 'Pay Runs', to: '/payroll', end: true },
    ],
  },
  {
    id: 'advances',
    label: 'Salary Advances', to: '/advances', icon: 'CircleDollarSign',
    permission: 'pay_view',
    section: 'PAYROLL', module: 'payroll',
  },
  {
    id: 'reports',
    label: 'Reports', to: '/reports', icon: 'BarChart2',
    permission: 'reports_view',
    section: 'PAYROLL', module: 'reports',
  },

  // ── SYSTEM ────────────────────────────────────────────────────────────────
  {
    id: 'users',
    label: 'User Management', to: '/users', icon: 'UserCog',
    permission: 'users_view',
    section: 'SYSTEM', module: 'users',
  },
  {
    id: 'audit',
    label: 'Audit Logs', to: '/audit-log', icon: 'Shield',
    permission: 'settings_edit',
    section: 'SYSTEM', module: 'audit',
  },
  {
    id: 'settings',
    label: 'Settings', to: '/settings', icon: 'Settings',
    permission: 'settings_view',
    section: 'SYSTEM', module: 'employees',
  },
]

export const NAV_SECTIONS: NavSection[] = ['OVERVIEW', 'WORKFORCE', 'PAYROLL', 'SYSTEM']

export const SECTION_LABELS: Record<NavSection, string> = {
  OVERVIEW:  'Overview',
  WORKFORCE: 'Workforce',
  PAYROLL:   'Payroll',
  SYSTEM:    'System',
}

// These are now loaded from role_templates in the DB.
// Kept here only as a fallback display map for slugs not yet in the DB.
export const ROLE_LABELS: Record<string, string> = {
  'super-admin':     'Super Admin',
  'hr-admin':        'HR Admin',
  'payroll-officer': 'Payroll Officer',
  'dept-head':       'Dept Head',
  'employee':        'Employee',
}

export const ROLE_COLORS: Record<string, string> = {
  'super-admin':     '#A78BFA',
  'hr-admin':        '#60A5FA',
  'payroll-officer': '#34D399',
  'dept-head':       '#FDBA74',
  'employee':        '#94A3B8',
}

export const ROLE_PILL_COLORS: Record<string, { bg: string; text: string }> = {
  'super-admin':     { bg: '#F5F3FF', text: '#7C3AED' },
  'hr-admin':        { bg: '#EFF6FF', text: '#2563EB' },
  'payroll-officer': { bg: '#ECFDF5', text: '#059669' },
  'dept-head':       { bg: '#FFFBEB', text: '#D97706' },
  'employee':        { bg: '#F1F5F9', text: '#64748B' },
}

// Fallback pill color for unknown / custom slugs
export const DEFAULT_PILL_COLOR = { bg: '#F1F5F9', text: '#475569' }

export const PAGE_TITLES: Record<string, { section?: string; title: string }> = {
  '/dashboard':          { title: 'Dashboard' },
  '/employees':          { section: 'Workforce', title: 'Employee Directory' },
  '/employees/new':      { section: 'Employees', title: 'New Employee' },
  '/attendance':         { section: 'Workforce', title: "Today's Attendance" },
  '/attendance/log':     { section: 'Attendance', title: 'Attendance Log' },
  '/leaves':             { section: 'Workforce', title: 'Leave Management' },
  '/overtime':           { section: 'Workforce', title: 'Overtime Requests' },
  '/schedules/shifts':   { section: 'Schedules', title: 'Work Shifts' },
  '/schedules/holidays': { section: 'Schedules', title: 'Holidays' },
  '/payroll':            { section: 'Payroll', title: 'Payroll Runs' },
  '/advances':           { section: 'Payroll', title: 'Salary Advances' },
  '/reports':            { section: 'Payroll', title: 'Reports & Analytics' },
  '/users':              { section: 'System', title: 'User Management' },
  '/audit-log':          { section: 'System', title: 'Audit Logs' },
  '/settings':           { section: 'System', title: 'Settings' },
}
