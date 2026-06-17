import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid, UsersRound, Hourglass, Fingerprint,
  CalendarDays, Wallet, BarChart3, SlidersHorizontal,
  History, CalendarX2, UserCog, CircleDollarSign, Monitor,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore }  from '../../store/uiStore'
import { brand }       from '../../config/brand'
import { getCompanySettings } from '../../lib/db'
import { avatarColor } from '../../lib/utils/format'
import { ROLE_PILL_COLORS, ROLE_LABELS } from '../../config/nav'
import type { UserRole } from '../../types'

/* ── Layout constants ── */
export const SIDEBAR_W  = 260  // expanded px
export const SIDEBAR_CW = 72   // collapsed px

/* ── Section definitions ── */
interface NavItem {
  icon:      React.ElementType
  label:     string
  href:      string
  match:     string
  roles:     string[]
  iconBg:    string   // colored square background
  iconColor: string   // icon fill color
}
interface Section {
  label: string | null
  items: NavItem[]
}

const SECTIONS: Section[] = [
  {
    label: null,
    items: [
      { icon: LayoutGrid,   label: 'Dashboard', href: '/dashboard', match: '/dashboard',
        roles: ['super-admin','hr-admin','payroll-officer','dept-head','employee'],
        iconBg: '#EFF6FF', iconColor: '#2563EB' },
    ],
  },
  {
    label: 'People',
    items: [
      { icon: UsersRound, label: 'Employees',      href: '/employees', match: '/employees',  roles: ['super-admin','hr-admin','dept-head'],
        iconBg: '#ECFDF5', iconColor: '#059669' },
      { icon: CalendarX2, label: 'Leave Requests', href: '/leaves',    match: '/leaves',     roles: ['super-admin','hr-admin','dept-head','employee'],
        iconBg: '#FFF7ED', iconColor: '#EA580C' },
      { icon: Hourglass,  label: 'Overtime',       href: '/overtime',  match: '/overtime',   roles: ['super-admin','hr-admin','dept-head','employee'],
        iconBg: '#F0F9FF', iconColor: '#0284C7' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Fingerprint,  label: 'Attendance', href: '/attendance',       match: '/attendance', roles: ['*'],
        iconBg: '#F5F3FF', iconColor: '#7C3AED' },
      { icon: CalendarDays, label: 'Schedules',  href: '/schedules/shifts', match: '/schedules',  roles: ['super-admin','hr-admin'],
        iconBg: '#EEEEFF', iconColor: '#5B5FC7' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { icon: Wallet,             label: 'Payroll',          href: '/payroll',  match: '/payroll',  roles: ['super-admin','hr-admin','payroll-officer'],
        iconBg: '#F0FDF4', iconColor: '#16A34A' },
      { icon: CircleDollarSign,   label: 'Salary Advances',  href: '/advances', match: '/advances', roles: ['super-admin','hr-admin','payroll-officer'],
        iconBg: '#FFF7ED', iconColor: '#D97706' },
      { icon: BarChart3,          label: 'Reports',          href: '/reports',  match: '/reports',  roles: ['super-admin','hr-admin','payroll-officer'],
        iconBg: '#FDF4FF', iconColor: '#9333EA' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: UserCog,           label: 'Users',     href: '/users',     match: '/users',     roles: ['super-admin'],
        iconBg: '#F8FAFC', iconColor: '#334155' },
      { icon: SlidersHorizontal, label: 'Settings',  href: '/settings',  match: '/settings',  roles: ['super-admin'],
        iconBg: '#F1F5F9', iconColor: '#475569' },
      { icon: History,           label: 'Audit Log', href: '/audit-log', match: '/audit-log', roles: ['super-admin'],
        iconBg: '#FEF2F2', iconColor: '#DC2626' },
    ],
  },
]

/* ─────────────────────────────────────────────────────────────────────────
   Single nav item — Clinivia style: colored icon square + soft active state
   ───────────────────────────────────────────────────────────────────────── */
function NavItem({
  item, active, collapsed,
}: {
  item: NavItem; active: boolean; collapsed: boolean
}) {
  const Icon = item.icon

  /* ── Clinovia active: full gradient bg + white text + glow shadow ── */
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 42,
    borderRadius: 10,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 13.5,
    letterSpacing: '-0.015em',
    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
    justifyContent: collapsed ? 'center' : 'flex-start',
    flexShrink: 0,
    padding: collapsed ? '0 16px' : '0 10px',
    // Active: full gradient + white text + glow (Clinovia style)
    background: active
      ? 'linear-gradient(135deg, #5B5FC7 0%, #7C7FE0 100%)'
      : 'transparent',
    color: active ? '#fff' : 'var(--color-text-muted)',
    boxShadow: active ? '0 4px 15px rgba(91,95,199,0.35)' : 'none',
  }

  return (
    <NavLink
      to={item.href}
      title={collapsed ? item.label : undefined}
      style={baseStyle}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-light)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
        }
      }}
    >
      {/* Icon square — white/transparent when active, colored when inactive */}
      <div
        style={{
          width: 28, height: 28,
          borderRadius: 8,
          background: active ? 'rgba(255,255,255,0.22)' : item.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <Icon style={{ width: 15, height: 15, color: active ? '#fff' : item.iconColor }} />
      </div>

      {!collapsed && (
        <span style={{ flex: 1, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
      )}
    </NavLink>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   SIDEBAR — Clinivia layout: profile card at top, colored nav icons
   ───────────────────────────────────────────────────────────────────────── */
export function NavRail() {
  const { user } = useAuthStore()
  const { sidebarCollapsed } = useUIStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const company   = getCompanySettings()

  const role     = user?.role as UserRole | undefined
  const allowed  = (roles: string[]) => roles.includes('*') || !!(role && roles.includes(role))
  const isActive = (match: string) =>
    location.pathname === match || location.pathname.startsWith(match + '/')

  const avBg      = user ? avatarColor(user.id ?? user.email ?? 'x') : '#5B5FC7'
  const collapsed = sidebarCollapsed
  const width     = collapsed ? SIDEBAR_CW : SIDEBAR_W

  const rolePill  = user ? (ROLE_PILL_COLORS[user.role] ?? { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)' }) : { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)' }
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : ''

  return (
    <aside
      className="no-print fixed top-0 left-0 h-screen z-30 flex flex-col"
      style={{
        width,
        background: '#fff',
        borderRight: '1px solid var(--color-border)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}
    >

      {/* ── Logo header ── */}
      <div
        style={{
          height: 66,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 16px' : '0 20px',
          borderBottom: '1px solid var(--color-border)',
          gap: 10,
          flexShrink: 0,
          justifyContent: collapsed ? 'center' : 'flex-start',
          overflow: 'hidden',
        }}
      >
        {collapsed ? (
          <img
            src={brand.logoUrl}
            alt={brand.appName}
            style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }}
          />
        ) : (
          <img
            src={brand.logoUrl}
            alt={brand.appName}
            style={{ height: 32, objectFit: 'contain', maxWidth: 160, flexShrink: 0 }}
          />
        )}

        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: 15, fontWeight: 800, color: 'var(--color-text)',
              letterSpacing: '-0.03em', lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {brand.appName}
            </p>
            <p style={{
              fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500,
              marginTop: 2, lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {company.name || brand.appTagline}
            </p>
          </div>
        )}
      </div>

      {/* ── Profile card — Clinivia style: centered, avatar on top ── */}
      {user && (
        <div
          style={{
            padding: collapsed ? '12px 8px' : '18px 16px 14px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            background: 'linear-gradient(135deg, rgba(91,95,199,0.04) 0%, rgba(91,95,199,0.02) 100%)',
          }}
        >
          {/* Avatar — centered on top, with online ring */}
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              title={collapsed ? `${user.name} — ${roleLabel}` : undefined}
              style={{
                width: collapsed ? 36 : 56, height: collapsed ? 36 : 56,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 0 0 2.5px #fff, 0 0 0 4.5px #22C55E, 0 4px 14px rgba(91,95,199,0.28)',
                transition: 'width 0.25s, height 0.25s',
              }}
            />
          ) : (
            <div
              title={collapsed ? `${user.name} — ${roleLabel}` : undefined}
              style={{
                width: collapsed ? 36 : 56, height: collapsed ? 36 : 56,
                borderRadius: '50%',
                background: avBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: collapsed ? 12 : 18, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.02em',
                flexShrink: 0,
                fontFamily: 'inherit',
                boxShadow: '0 0 0 2.5px #fff, 0 0 0 4.5px #22C55E, 0 4px 14px rgba(91,95,199,0.28)',
                transition: 'width 0.25s, height 0.25s, font-size 0.25s',
              }}
            >
              {user.avatarInitials}
            </div>
          )}

          {/* Name + role pill — centered below avatar, expanded only */}
          {!collapsed && (
            <>
              <p style={{
                fontSize: 13, fontWeight: 700, color: 'var(--color-text)',
                letterSpacing: '-0.02em', lineHeight: 1.2, margin: '2px 0 0',
                textAlign: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                width: '100%',
              }}>
                {user.name}
              </p>
              <span style={{
                display: 'inline-block',
                fontSize: 10.5, fontWeight: 600,
                padding: '2px 10px', borderRadius: 999,
                background: rolePill.bg, color: rolePill.text,
                lineHeight: 1.6,
              }}>
                {roleLabel}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Nav sections ── */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ padding: collapsed ? '10px 8px' : '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {SECTIONS.map((section, si) => {
          const visible = section.items.filter(i => allowed(i.roles))
          if (visible.length === 0) return null
          return (
            <div key={si} style={{ marginBottom: 2 }}>
              {/* Section label */}
              {section.label && !collapsed && (
                <p
                  style={{
                    fontSize: 10.5, fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: 'var(--color-text-muted)',
                    padding: '10px 10px 5px',
                    lineHeight: 1,
                  }}
                >
                  {section.label}
                </p>
              )}
              {/* Items */}
              {visible.map(item => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={isActive(item.match)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          )
        })}

        {/* ── Kiosk shortcut ── */}
        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => navigate('/kiosk')}
            title="Attendance Kiosk"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '0 16px' : '0 10px',
              height: 42,
              width: '100%',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 13.5,
              letterSpacing: '-0.015em',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-light)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: '#F0F9FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Monitor style={{ width: 15, height: 15, color: '#0284C7' }} />
            </div>
            {!collapsed && <span>Kiosk</span>}
          </button>
        </div>
      </nav>
    </aside>
  )
}
