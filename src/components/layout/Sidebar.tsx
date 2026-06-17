import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Clock, Calendar,
  Umbrella, Timer, BarChart2, Settings as SettingsIcon,
  LogOut, ChevronDown, Shield, Banknote,
  UserCircle, CircleDollarSign, UserCog,
} from 'lucide-react'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { getCompanySettings } from '../../lib/db'
import { brand } from '../../config/brand'
import {
  NAV_ITEMS, NAV_SECTIONS, SECTION_LABELS,
  ROLE_COLORS, ROLE_LABELS, type NavSection,
} from '../../config/nav'
import { avatarColor } from '../../lib/utils/format'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  Umbrella,
  Timer,
  BarChart2,
  Settings: SettingsIcon,
  Shield,
  Banknote,
  UserCircle,
  CircleDollarSign,
  UserCog,
}

const SB = brand.theme.sidebar

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const company = getCompanySettings()
  const [openMenus, setOpenMenus] = useState<string[]>(['Employees','Attendance','Payroll Runs','Schedules'])

  // Permission-driven nav: super-admin sees everything; all others filter by permissions.
  const hasAnyPerm = !!user?.permissions && Object.values(user.permissions).some(v => v === true)
  const visible = NAV_ITEMS.filter(n => {
    if (!user) return false
    if (user.role === 'super-admin') return true   // super-admin sees all
    if (!n.permission) return hasAnyPerm           // dashboard etc.
    return !!(user.permissions as Record<string, boolean> | undefined)?.[n.permission]
  })

  const toggle  = (label: string) =>
    setOpenMenus(p => p.includes(label) ? p.filter(l => l !== label) : [...p, label])

  const handleLogout = () => { logout(); navigate('/kiosk') }
  const roleColor = user ? (ROLE_COLORS[user.role] ?? '#94A3B8') : '#94A3B8'
  // Show custom role label if set, otherwise fall back to built-in label map, then the slug itself
  const roleLabel = user ? (user.roleLabel ?? ROLE_LABELS[user.role] ?? user.role) : ''
  const avBg  = user ? avatarColor(user.id ?? user.email ?? 'x') : brand.theme.primary

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col z-30 transition-all duration-300
        ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}
      style={{ background: SB.bg, borderRight: `1px solid ${SB.border}` }}
    >

      {/* ── Brand ── */}
      <div
        className={`flex items-center flex-shrink-0 h-[56px]
          ${collapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}
        style={{ borderBottom: `1px solid ${SB.border}` }}
      >
        <img
          src={brand.logoUrl}
          alt={brand.appName}
          style={{ width: 30, height: 30, objectFit: 'contain', flexShrink: 0 }}
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p
              className="text-white leading-none truncate"
              style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em' }}
            >
              {brand.appName}
            </p>
            <p
              className="truncate mt-0.5"
              style={{ fontSize: 10.5, color: SB.section, fontWeight: 500, lineHeight: 1.2 }}
            >
              {company.name || brand.appTagline}
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {NAV_SECTIONS.map((section: NavSection, si) => {
          const items = visible.filter(n => n.section === section)
          if (!items.length) return null

          return (
            <div key={section} style={{ marginBottom: 2 }}>
              {/* Section label / divider */}
              {!collapsed ? (
                <p className="nav-group-label" style={{ padding: si === 0 ? '8px 16px 4px' : '14px 16px 4px' }}>
                  {SECTION_LABELS[section]}
                </p>
              ) : (
                si > 0 && <div style={{ margin: '8px 14px 6px', height: 1, background: SB.border }} />
              )}

              <div style={{ padding: '0 8px' }}>
                {items.map(item => {
                  const Icon    = ICON_MAP[item.icon] ?? LayoutDashboard
                  const hasKids = !!item.children && !collapsed
                  const isOpen  = openMenus.includes(item.label)

                  if (hasKids) {
                    return (
                      <div key={item.label} style={{ marginBottom: 1 }}>
                        <button
                          onClick={() => toggle(item.label)}
                          className="w-full flex items-center justify-between"
                          style={{
                            padding: '0 10px', height: 36, borderRadius: 8,
                            fontSize: 13.5, fontWeight: 400, color: SB.text,
                            background: 'transparent', cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s', letterSpacing: '-0.01em',
                            border: 'none',
                          }}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = SB.hoverBg; el.style.color = SB.textHover
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement
                            el.style.background = 'transparent'; el.style.color = SB.text
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.55 }} />
                            <span>{item.label}</span>
                          </div>
                          <ChevronDown
                            style={{
                              width: 13, height: 13, color: SB.section, flexShrink: 0,
                              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.18s',
                            }}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                              style={{ overflow: 'hidden' }}
                            >
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
                                          display: 'flex', alignItems: 'center', gap: 8,
                                          padding: '0 10px 0 36px', height: 32, borderRadius: 7,
                                          fontSize: 13, fontWeight: isActive ? 500 : 400,
                                          color: isActive ? SB.childActive : SB.childText,
                                          background: isActive ? 'rgba(79,70,229,0.10)' : 'transparent',
                                          cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
                                          letterSpacing: '-0.01em',
                                        }}
                                        onMouseEnter={e => {
                                          if (!isActive) {
                                            (e.currentTarget as HTMLElement).style.color = SB.childHover
                                            ;(e.currentTarget as HTMLElement).style.background = SB.hoverBg
                                          }
                                        }}
                                        onMouseLeave={e => {
                                          if (!isActive) {
                                            (e.currentTarget as HTMLElement).style.color = SB.childText
                                            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                                          }
                                        }}
                                      >
                                        <span style={{
                                          width: 4, height: 4, borderRadius: '50%',
                                          background: isActive ? SB.childActive : SB.childText,
                                          flexShrink: 0, opacity: isActive ? 1 : 0.6,
                                        }} />
                                        {child.label}
                                      </div>
                                    )}
                                  </NavLink>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/dashboard'}
                      title={collapsed ? item.label : undefined}
                      style={{ display: 'block', textDecoration: 'none', marginBottom: 1 }}
                    >
                      {({ isActive }) => (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center',
                            gap: collapsed ? 0 : 10,
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? '0' : '0 10px',
                            height: 36, borderRadius: 8,
                            fontSize: 13.5, fontWeight: isActive ? 500 : 400,
                            color: isActive ? SB.textActive : SB.text,
                            background: isActive ? SB.activeBg : 'transparent',
                            cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
                            letterSpacing: '-0.01em', position: 'relative',
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = SB.hoverBg
                              ;(e.currentTarget as HTMLElement).style.color = SB.textHover
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = 'transparent'
                              ;(e.currentTarget as HTMLElement).style.color = SB.text
                            }
                          }}
                        >
                          {isActive && (
                            <div style={{
                              position: 'absolute', left: 0, top: '20%', bottom: '20%',
                              width: 2, borderRadius: '0 2px 2px 0',
                              background: SB.activeBorder,
                            }} />
                          )}
                          <Icon style={{
                            width: 16, height: 16, flexShrink: 0,
                            color: isActive ? '#A5B4FC' : 'inherit',
                            opacity: isActive ? 1 : 0.55,
                          }} />
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
      <div style={{ borderTop: `1px solid ${SB.border}`, flexShrink: 0 }}>
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '12px 0' : '10px 12px',
          }}>
            <div
              title={collapsed ? user.name : undefined}
              style={{
                width: 32, height: 32, background: avBg, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: '-0.01em',
              }}
            >
              {user.avatarInitials}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12.5, fontWeight: 600, color: '#E2E8F0', lineHeight: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em',
                }}>
                  {user.name}
                </p>
                <p style={{ fontSize: 10.5, fontWeight: 500, color: roleColor, marginTop: 3, lineHeight: 1 }}>
                  {roleLabel}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{
                  width: 28, height: 28, borderRadius: 7, color: SB.section,
                  background: 'transparent', cursor: 'pointer',
                  transition: 'color 0.12s, background 0.12s', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = '#EF4444'; el.style.background = 'rgba(239,68,68,0.1)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = SB.section; el.style.background = 'transparent'
                }}
              >
                <LogOut style={{ width: 14, height: 14, flexShrink: 0 }} />
              </button>
            )}
          </div>
        )}

        {user && collapsed && (
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="w-full flex justify-center"
            style={{
              padding: '10px 0', color: SB.section,
              background: 'transparent', cursor: 'pointer',
              borderTop: `1px solid ${SB.border}`, transition: 'color 0.12s, background 0.12s',
              border: 'none', borderTopStyle: 'solid',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#EF4444'; el.style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = SB.section; el.style.background = 'transparent'
            }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
    </aside>
  )
}
