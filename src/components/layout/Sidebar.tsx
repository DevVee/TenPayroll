import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Clock, Calendar,
  Umbrella, Timer, BarChart2, Settings, LogOut, ChevronDown,
  Shield, Monitor, Banknote,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { getCompanySettings } from '../../lib/db'
import type { UserRole } from '../../types'

interface NavChild { label: string; to: string; end?: boolean }
interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  roles: UserRole[]
  children?: NavChild[]
  section: string
}

const NAV: NavItem[] = [
  // ── OVERVIEW ──
  {
    label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard,
    roles: ['super-admin','hr-admin','payroll-officer','dept-head'], section: 'OVERVIEW',
  },
  {
    label: 'Kiosk', to: '/kiosk', icon: Monitor,
    roles: ['super-admin','hr-admin'], section: 'OVERVIEW',
  },

  // ── WORKFORCE ──
  {
    label: 'Employees', to: '/employees', icon: Users,
    roles: ['super-admin','hr-admin'], section: 'WORKFORCE',
    children: [
      { label: 'Directory',    to: '/employees', end: true },
      { label: 'Add Employee', to: '/employees/new' },
    ],
  },
  {
    label: 'Attendance', to: '/attendance', icon: Clock,
    roles: ['super-admin','hr-admin','payroll-officer'], section: 'WORKFORCE',
    children: [
      { label: "Today's Log",    to: '/attendance',     end: true },
      { label: 'Attendance Log', to: '/attendance/log' },
    ],
  },
  {
    label: 'Leave Management', to: '/leaves', icon: Umbrella,
    roles: ['super-admin','hr-admin','dept-head'], section: 'WORKFORCE',
  },
  {
    label: 'Overtime', to: '/overtime', icon: Timer,
    roles: ['super-admin','hr-admin','dept-head'], section: 'WORKFORCE',
  },
  {
    label: 'Schedules', to: '/schedules', icon: Calendar,
    roles: ['super-admin','hr-admin'], section: 'WORKFORCE',
    children: [
      { label: 'Work Shifts', to: '/schedules/shifts' },
      { label: 'Holidays',    to: '/schedules/holidays' },
    ],
  },

  // ── PAYROLL ──
  {
    label: 'Payroll Runs', to: '/payroll', icon: Banknote,
    roles: ['super-admin','hr-admin','payroll-officer'], section: 'PAYROLL',
    children: [
      { label: 'Pay Runs', to: '/payroll', end: true },
    ],
  },
  {
    label: 'Reports', to: '/reports', icon: BarChart2,
    roles: ['super-admin','hr-admin','payroll-officer'], section: 'PAYROLL',
  },

  // ── SYSTEM ──
  {
    label: 'Audit Logs', to: '/audit-log', icon: Shield,
    roles: ['super-admin'], section: 'SYSTEM',
  },
  {
    label: 'Settings', to: '/settings', icon: Settings,
    roles: ['super-admin'], section: 'SYSTEM',
  },
]

const SECTIONS = ['OVERVIEW', 'WORKFORCE', 'PAYROLL', 'SYSTEM'] as const
const SECTION_LABELS: Record<string, string> = {
  OVERVIEW:  'Overview',
  WORKFORCE: 'Workforce',
  PAYROLL:   'Payroll',
  SYSTEM:    'Settings',
}

const ROLE_COLORS: Record<string, string> = {
  'super-admin':     '#A78BFA',
  'hr-admin':        '#60A5FA',
  'payroll-officer': '#34D399',
  'dept-head':       '#FDBA74',
  'employee':        '#94A3B8',
}
const ROLE_LABELS: Record<string, string> = {
  'super-admin':     'Super Admin',
  'hr-admin':        'HR Admin',
  'payroll-officer': 'Payroll Officer',
  'dept-head':       'Dept Head',
  'employee':        'Employee',
}

/* ── Color constants ── */
const SB_BG      = '#111827'
const SB_BORDER  = 'rgba(255,255,255,0.07)'
const SB_TEXT    = '#8B95A6'
const SB_HOVER   = 'rgba(255,255,255,0.07)'
const SB_HOVER_T = '#C4CDD8'
const SB_ACTIVE  = '#2563EB'
const SB_SECT    = '#4B5563'
const SB_CHILD   = '#5A6578'
const SB_CHILD_H = '#99A3B2'
const SB_CHILD_A = '#93C5FD'

function avatarColor(id: string) {
  const PALETTE = [
    '#2563EB','#7C3AED','#059669','#D97706',
    '#DC2626','#0891B2','#BE185D','#0D9488',
    '#4F46E5','#B45309','#16A34A','#9333EA',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const company = getCompanySettings()
  const [openMenus, setOpenMenus] = useState<string[]>(['Employees','Attendance','Payroll Runs','Schedules'])

  const visible = NAV.filter(n => user && n.roles.includes(user.role as UserRole))
  const toggle  = (label: string) =>
    setOpenMenus(p => p.includes(label) ? p.filter(l => l !== label) : [...p, label])

  const handleLogout = () => { logout(); navigate('/kiosk') }
  const roleColor = user ? (ROLE_COLORS[user.role] ?? '#94A3B8') : '#94A3B8'
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : ''
  const avatarBg  = user ? avatarColor(user.id ?? user.email ?? 'x') : '#2563EB'

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-30 transition-all duration-200
        ${collapsed ? 'w-[56px]' : 'w-[220px]'}`}
      style={{ background: SB_BG, borderRight: `1px solid ${SB_BORDER}` }}
    >

      {/* ── Brand ── */}
      <div
        className={`flex items-center flex-shrink-0 h-[56px]
          ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}
        style={{ borderBottom: `1px solid ${SB_BORDER}` }}
      >
        {/* Logo mark — actual Veltrix logo */}
        <img
          src="/Veltrix.png"
          alt="Veltrix"
          style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
        />

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p
              className="text-white font-extrabold leading-none truncate"
              style={{ fontSize: 14, letterSpacing: '-0.025em' }}
            >
              Veltrix
            </p>
            <p
              className="truncate mt-0.5"
              style={{ fontSize: 10.5, color: SB_SECT, fontWeight: 500, lineHeight: 1.2 }}
            >
              {company.name || 'HR & Payroll System'}
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none' }}>
        {SECTIONS.map((section, si) => {
          const items = visible.filter(n => n.section === section)
          if (!items.length) return null

          return (
            <div key={section} style={{ marginBottom: 4 }}>
              {/* Section label */}
              {!collapsed ? (
                <p
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: SB_SECT,
                    padding: si === 0 ? '2px 16px 6px' : '10px 16px 6px',
                  }}
                >
                  {SECTION_LABELS[section]}
                </p>
              ) : (
                si > 0 && (
                  <div style={{ margin: '8px 12px 6px', height: 1, background: SB_BORDER }} />
                )
              )}

              <div style={{ padding: '0 8px' }}>
                {items.map(item => {
                  const Icon    = item.icon
                  const hasKids = !!item.children && !collapsed
                  const isOpen  = openMenus.includes(item.label)

                  if (hasKids) {
                    return (
                      <div key={item.label} style={{ marginBottom: 2 }}>
                        {/* Expandable parent */}
                        <button
                          onClick={() => toggle(item.label)}
                          className="w-full flex items-center justify-between"
                          style={{
                            padding: '7px 10px',
                            borderRadius: 7,
                            fontSize: 13,
                            fontWeight: 400,
                            color: SB_TEXT,
                            background: 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = SB_HOVER
                            el.style.color = SB_HOVER_T
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'transparent'
                            el.style.color = SB_TEXT
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon style={{ width: 15, height: 15, flexShrink: 0, opacity: 0.6 }} />
                            <span>{item.label}</span>
                          </div>
                          <ChevronDown
                            style={{
                              width: 12, height: 12,
                              color: SB_SECT,
                              flexShrink: 0,
                              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.15s',
                            }}
                          />
                        </button>

                        {isOpen && (
                          <div style={{ paddingBottom: 4 }}>
                            {item.children!.map(child => (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                end={child.end}
                                style={{ display: 'block', textDecoration: 'none' }}
                              >
                                {({ isActive }) => (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 7,
                                      padding: '6px 10px 6px 34px',
                                      borderRadius: 6,
                                      fontSize: 12.5,
                                      fontWeight: isActive ? 500 : 400,
                                      color: isActive ? SB_CHILD_A : SB_CHILD,
                                      background: isActive ? 'rgba(37,99,235,0.15)' : 'transparent',
                                      cursor: 'pointer',
                                      transition: 'background 0.12s, color 0.12s',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isActive) {
                                        (e.currentTarget as HTMLElement).style.color = SB_CHILD_H
                                        ;(e.currentTarget as HTMLElement).style.background = SB_HOVER
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      if (!isActive) {
                                        (e.currentTarget as HTMLElement).style.color = SB_CHILD
                                        ;(e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(37,99,235,0.15)' : 'transparent'
                                      }
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 5, height: 5,
                                        borderRadius: '50%',
                                        background: isActive ? SB_CHILD_A : SB_CHILD,
                                        flexShrink: 0,
                                        opacity: isActive ? 1 : 0.5,
                                      }}
                                    />
                                    {child.label}
                                  </div>
                                )}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // ── Leaf item ──
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/dashboard'}
                      title={collapsed ? item.label : undefined}
                      style={{ display: 'block', textDecoration: 'none', marginBottom: 2 }}
                    >
                      {({ isActive }) => (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: collapsed ? 0 : 10,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '8px 0' : '7px 10px',
                            borderRadius: 7,
                            fontSize: 13,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? '#FFFFFF' : SB_TEXT,
                            background: isActive ? SB_ACTIVE : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s',
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = SB_HOVER
                              ;(e.currentTarget as HTMLElement).style.color = SB_HOVER_T
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = 'transparent'
                              ;(e.currentTarget as HTMLElement).style.color = SB_TEXT
                            }
                          }}
                        >
                          <Icon
                            style={{
                              width: 15, height: 15,
                              flexShrink: 0,
                              opacity: isActive ? 1 : 0.6,
                            }}
                          />
                          {!collapsed && <span>{item.label}</span>}
                        </div>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── User panel ── */}
      <div style={{ borderTop: `1px solid ${SB_BORDER}`, flexShrink: 0 }}>

        {/* User info row */}
        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '12px 0' : '10px 12px',
            }}
          >
            {/* Avatar — round */}
            <div
              title={collapsed ? user.name : undefined}
              style={{
                width: 32, height: 32,
                background: avatarBg,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {user.avatarInitials}
            </div>

            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#E2E8F0',
                    lineHeight: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </p>
                <p style={{ fontSize: 10.5, fontWeight: 500, color: roleColor, marginTop: 3, lineHeight: 1 }}>
                  {roleLabel}
                </p>
              </div>
            )}

            {/* Collapse indicator (only in expanded mode) */}
            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{
                  padding: 4,
                  borderRadius: 4,
                  color: SB_SECT,
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'color 0.12s, background 0.12s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = '#EF4444'
                  el.style.background = 'rgba(239,68,68,0.1)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = SB_SECT
                  el.style.background = 'transparent'
                }}
              >
                <LogOut style={{ width: 13, height: 13, flexShrink: 0 }} />
              </button>
            )}
          </div>
        )}

        {/* Collapsed sign out button */}
        {user && collapsed && (
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="w-full flex justify-center"
            style={{
              padding: '8px 0',
              color: SB_SECT,
              background: 'transparent',
              cursor: 'pointer',
              borderTop: `1px solid ${SB_BORDER}`,
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#EF4444'
              el.style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = SB_SECT
              el.style.background = 'transparent'
            }}
          >
            <LogOut style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>
    </aside>
  )
}
