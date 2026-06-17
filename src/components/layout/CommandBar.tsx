import {
  Bell, LogOut, ChevronDown,
  PanelLeftClose, PanelLeftOpen,
  Umbrella, Timer, Banknote, CheckCheck,
  Clock, AlertCircle, Sparkles, Check, X, Settings2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore }  from '../../store/authStore'
import { useUIStore }    from '../../store/uiStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { avatarColor }   from '../../lib/utils/format'
import { apiGetLeaves }  from '../../lib/_db/leaves'
import { apiGetOvertime } from '../../lib/_db/overtime'
import { apiGetPayrollPeriods } from '../../lib/_db/payroll'
import { usePermissions } from '../../lib/permissions'
import { ROLE_PILL_COLORS, ROLE_LABELS } from '../../config/nav'
import type { UserPermissions } from '../../types'

/* ── Permission module display grid ── */
const PERM_MODULES: { label: string; key: keyof UserPermissions }[] = [
  { label: 'Employees',  key: 'emp_view' },
  { label: 'Payroll',    key: 'pay_view' },
  { label: 'Attendance', key: 'att_view' },
  { label: 'Reports',    key: 'reports_view' },
  { label: 'Leaves',     key: 'leave_view' },
  { label: 'Settings',   key: 'settings_view' },
  { label: 'Overtime',   key: 'ot_view' },
  { label: 'Users',      key: 'users_view' },
]

/* ── Notification item shape ── */
interface Notif {
  id:      string
  icon:    React.ElementType
  iconBg:  string
  iconCol: string
  title:   string
  body:    string
  href:    string
  time:    string
}

/* ── Page title map ── */
function getPageMeta(pathname: string): { section?: string; title: string } {
  const map: Record<string, { section?: string; title: string }> = {
    '/dashboard':          { title: 'Dashboard' },
    '/account':            { section: 'Account', title: 'My Account' },
    '/employees':          { section: 'People',    title: 'Employees' },
    '/employees/new':      { section: 'People',    title: 'New Employee' },
    '/attendance':         { section: 'Time',      title: "Today's Attendance" },
    '/attendance/log':     { section: 'Time',      title: 'Attendance Log' },
    '/leaves':             { section: 'Time',      title: 'Leave Requests' },
    '/overtime':           { section: 'Time',      title: 'Overtime' },
    '/schedules/shifts':   { section: 'Schedules', title: 'Work Shifts' },
    '/schedules/holidays': { section: 'Schedules', title: 'Holidays' },
    '/payroll':            { section: 'Payroll',   title: 'Payroll Runs' },
    '/reports':            { section: 'Analytics', title: 'Reports' },
    '/audit-log':          { section: 'System',    title: 'Audit Log' },
    '/settings':           { section: 'System',    title: 'Settings' },
    '/users':              { section: 'System',    title: 'User Management' },
  }
  if (map[pathname]) return map[pathname]
  if (pathname.startsWith('/employees/') && pathname.endsWith('/edit'))
    return { section: 'People', title: 'Edit Employee' }
  if (pathname.startsWith('/employees/'))
    return { section: 'People', title: 'Employee Profile' }
  if (pathname.startsWith('/payroll/') && pathname.includes('/payslip/'))
    return { section: 'Payroll', title: 'Payslip' }
  if (pathname.startsWith('/payroll/'))
    return { section: 'Payroll', title: 'Payroll Detail' }
  return { title: 'TenPayroll' }
}

/* ══════════════════════════════════════════════════════════════════════════ */
export function CommandBar() {
  const { user, logout }                    = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const navigate                            = useNavigate()
  const location                            = useLocation()

  const [menuOpen,    setMenuOpen]    = useState(false)
  const [bellOpen,    setBellOpen]    = useState(false)
  const [notifs,    setNotifs]    = useState<Notif[]>([])
  const [loading,   setLoading]   = useState(false)
  const [readIds,   setReadIds]   = useState<Set<string>>(new Set())

  const bellRef = useRef<HTMLDivElement>(null)

  /* ── Fetch real notifications (skip for employee role — they have no approvals) ── */
  const fetchNotifs = async () => {
    if (user?.role === 'employee') return   // employees have no pending approvals to see
    setLoading(true)
    try {
      const [leaves, overtimes, periods] = await Promise.all([
        apiGetLeaves({ status: 'pending' }).catch(() => []),
        apiGetOvertime({ status: 'pending' }).catch(() => []),
        apiGetPayrollPeriods().catch(() => []),
      ])

      const items: Notif[] = []

      /* Pending leave requests */
      if (leaves.length > 0) {
        items.push({
          id:      'leaves-pending',
          icon:    Umbrella,
          iconBg:  '#FFFBEB',
          iconCol: '#B45309',
          title:   `${leaves.length} pending leave request${leaves.length !== 1 ? 's' : ''}`,
          body:    'Awaiting your approval',
          href:    '/leaves',
          time:    'Now',
        })
      }

      /* Pending overtime requests */
      if (overtimes.length > 0) {
        items.push({
          id:      'ot-pending',
          icon:    Timer,
          iconBg:  '#F0F9FF',
          iconCol: '#0284C7',
          title:   `${overtimes.length} overtime request${overtimes.length !== 1 ? 's' : ''}`,
          body:    'Awaiting your approval',
          href:    '/overtime',
          time:    'Now',
        })
      }

      /* Payroll runs needing action */
      const draftRuns    = periods.filter(p => p.status === 'draft')
      const reviewedRuns = periods.filter(p => p.status === 'reviewed')

      if (draftRuns.length > 0) {
        items.push({
          id:      'payroll-draft',
          icon:    Banknote,
          iconBg:  '#EEEEFF',
          iconCol: '#5B5FC7',
          title:   `${draftRuns.length} payroll run${draftRuns.length !== 1 ? 's' : ''} in draft`,
          body:    'Ready to be reviewed and processed',
          href:    '/payroll',
          time:    'Now',
        })
      }
      if (reviewedRuns.length > 0) {
        items.push({
          id:      'payroll-reviewed',
          icon:    Clock,
          iconBg:  '#F0FDF4',
          iconCol: '#16A34A',
          title:   `${reviewedRuns.length} payroll run${reviewedRuns.length !== 1 ? 's' : ''} awaiting approval`,
          body:    'Reviewed and ready for final approval',
          href:    '/payroll',
          time:    'Now',
        })
      }

      setNotifs(items)
    } catch {
      // silent — bell is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifs()
    // Refresh every 60s while the app is open
    const interval = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(interval)
  }, [])

  /* Close bell panel on outside click */
  useEffect(() => {
    if (!bellOpen) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  const unread     = notifs.filter(n => !readIds.has(n.id)).length
  const hasUnread  = unread > 0

  const handleBellOpen = () => {
    setBellOpen(v => !v)
    setMenuOpen(false)
  }

  const markAllRead = () => setReadIds(new Set(notifs.map(n => n.id)))

  const handleNotifClick = (n: Notif) => {
    setReadIds(prev => new Set([...prev, n.id]))
    setBellOpen(false)
    navigate(n.href)
  }

  /* ── Other state ── */
  const page       = getPageMeta(location.pathname)
  const rolePill   = user ? (ROLE_PILL_COLORS[user.role] ?? { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)' }) : { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)' }
  const avatarBg   = user ? avatarColor(user.id ?? user.email ?? 'x') : 'var(--color-primary)'
  const permissions = usePermissions()
  const isSuperAdmin = user?.role === 'super-admin'

  const handleLogout  = () => { logout(); navigate('/login'); setMenuOpen(false) }
  const ToggleIcon    = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <header
      className="no-print flex items-center gap-3 flex-shrink-0"
      style={{
        height: 58,
        padding: '0 24px',
        background: '#fff',
        borderBottom: '1px solid var(--color-border)',
        zIndex: 20,
        position: 'relative',
      }}
    >
      {/* ── Sidebar toggle ── */}
      <button
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={iconBtn}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        <ToggleIcon style={{ width: 17, height: 17 }} />
      </button>

      <div style={divider} />

      {/* ── Page breadcrumb / title ── */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        {page.section && (
          <>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {page.section}
            </span>
            <span style={{ color: 'var(--color-border-strong)', fontSize: 15, userSelect: 'none' }}>›</span>
          </>
        )}
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.025em', lineHeight: 1 }}>
          {page.title}
        </span>
      </div>

      <div className="flex-1" />

      {/* ═══════════════════════════════════════════════════════════════════
          NOTIFICATION BELL
          ═══════════════════════════════════════════════════════════════════ */}
      <div ref={bellRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={handleBellOpen}
          title="Notifications"
          style={{
            ...iconBtn,
            background: bellOpen ? 'var(--color-surface-2)' : 'transparent',
            color: bellOpen ? 'var(--color-text)' : 'var(--color-text-muted)',
          }}
          onMouseEnter={hoverOn}
          onMouseLeave={e => {
            if (!bellOpen) hoverOff(e)
          }}
        >
          <Bell style={{ width: 17, height: 17 }} />

          {/* Live count badge */}
          {hasUnread && (
            <span
              style={{
                position: 'absolute',
                top: 6, right: 6,
                minWidth: 16, height: 16,
                padding: '0 4px',
                background: 'var(--color-danger)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 9.5,
                fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid #fff',
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* ── Notification dropdown ── */}
        {bellOpen && (
          <>
            <div className="fixed inset-0 z-40" style={{ pointerEvents: 'none' }} />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                width: 360,
                background: '#fff',
                borderRadius: 18,
                boxShadow: 'var(--shadow-dropdown)',
                zIndex: 50,
                overflow: 'hidden',
                animation: 'slide-up 0.15s ease-out',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 18px 14px',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                    Notifications
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                    {notifs.length === 0
                      ? 'You\'re all caught up'
                      : `${unread} unread item${unread !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
                {hasUnread && (
                  <button
                    onClick={markAllRead}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 600,
                      color: 'var(--color-primary)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      padding: '4px 8px', borderRadius: 8,
                      transition: 'background 0.13s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-primary-light)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
                  >
                    <CheckCheck style={{ width: 13, height: 13 }} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Body */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {loading && notifs.length === 0 ? (
                  /* Loading state */
                  <div style={{ padding: '32px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div className="spinner" />
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>Checking for updates…</p>
                  </div>

                ) : notifs.length === 0 ? (
                  /* Empty state */
                  <div style={{ padding: '36px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                    <div
                      style={{
                        width: 52, height: 52,
                        borderRadius: '50%',
                        background: 'var(--color-surface-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Bell style={{ width: 22, height: 22, color: 'var(--color-text-muted)' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>All caught up!</p>
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>No pending items right now</p>
                    </div>
                  </div>

                ) : (
                  /* Notification list */
                  <div style={{ padding: '8px 0' }}>
                    {notifs.map(n => {
                      const Icon    = n.icon
                      const isRead  = readIds.has(n.id)
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 13,
                            width: '100%',
                            padding: '13px 18px',
                            border: 'none',
                            background: isRead ? 'transparent' : 'rgba(91,95,199,0.04)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                            transition: 'background 0.12s',
                            borderBottom: '1px solid rgba(227,229,239,0.5)',
                          }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(91,95,199,0.07)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = isRead ? 'transparent' : 'rgba(91,95,199,0.04)')}
                        >
                          {/* Icon */}
                          <div
                            style={{
                              width: 38, height: 38,
                              borderRadius: 11,
                              background: n.iconBg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            <Icon style={{ width: 17, height: 17, color: n.iconCol }} />
                          </div>

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                              <p style={{
                                fontSize: 13.5,
                                fontWeight: isRead ? 600 : 700,
                                color: 'var(--color-text)',
                                letterSpacing: '-0.015em',
                                lineHeight: 1.3,
                              }}>
                                {n.title}
                              </p>
                              {/* Unread dot */}
                              {!isRead && (
                                <span
                                  style={{
                                    width: 8, height: 8,
                                    borderRadius: '50%',
                                    background: 'var(--color-primary)',
                                    flexShrink: 0,
                                    marginTop: 4,
                                  }}
                                />
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3, fontWeight: 500, lineHeight: 1.4 }}>
                              {n.body}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 5, fontWeight: 500, opacity: 0.7 }}>
                              {n.time}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 18px' }}>
                <button
                  onClick={() => { setBellOpen(false); fetchNotifs() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    padding: '4px 0',
                    transition: 'color 0.13s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)')}
                >
                  <AlertCircle style={{ width: 13, height: 13 }} />
                  Refresh notifications
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={divider} />

      {/* ═══════════════════════════════════════════════════════════════════
          USER DROPDOWN
          ═══════════════════════════════════════════════════════════════════ */}
      {user && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => { setMenuOpen(v => !v); setBellOpen(false) }}
            className="flex items-center gap-2.5"
            style={{
              padding: '5px 8px 5px 5px',
              borderRadius: 12,
              border: 'none',
              background: menuOpen ? 'var(--color-bg)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.13s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-bg)')}
            onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  objectFit: 'cover', flexShrink: 0,
                  border: '1.5px solid var(--color-border)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 32, height: 32,
                  background: avatarBg,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  letterSpacing: '-0.02em',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                {user.avatarInitials}
              </div>
            )}

            <div className="hidden sm:block text-left" style={{ lineHeight: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                {user.name?.split(' ')[0]}
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>

            <ChevronDown
              style={{
                width: 13, height: 13,
                color: 'var(--color-text-muted)',
                flexShrink: 0,
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}
              className="hidden sm:block"
            />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 10px)',
                  width: 320, background: 'var(--color-surface)',
                  borderRadius: 18,
                  boxShadow: 'var(--shadow-modal)',
                  overflow: 'hidden',
                  zIndex: 50,
                  animation: 'slide-up 0.15s ease-out',
                }}
              >
                {/* ── User info ── */}
                <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          objectFit: 'cover', flexShrink: 0,
                          border: '2px solid var(--color-border)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44, height: 44,
                          background: avatarBg,
                          borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 700, color: '#fff',
                          letterSpacing: '-0.02em', fontFamily: 'inherit',
                          flexShrink: 0,
                        }}
                      >
                        {user.avatarInitials}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                        {user.name}
                      </p>
                      <p style={{
                        fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3,
                        letterSpacing: '-0.01em', lineHeight: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {user.email}
                      </p>
                      <span
                        style={{
                          display: 'inline-block', marginTop: 6,
                          fontSize: 11, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 999,
                          background: rolePill.bg, color: rolePill.text,
                        }}
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Permissions section ── */}
                <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{
                    fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'var(--color-text-muted)',
                    marginBottom: 10,
                  }}>
                    My Permissions
                  </p>

                  {isSuperAdmin ? (
                    /* Super admin full access banner */
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 10,
                      background: 'var(--color-primary-light)',
                      border: '1px solid rgba(91,95,199,0.15)',
                    }}>
                      <Sparkles style={{ width: 14, height: 14, color: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-primary)' }}>
                        Full Access — All modules enabled
                      </span>
                    </div>
                  ) : (
                    /* Permission grid 4 rows × 2 cols */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
                      {PERM_MODULES.map(({ label, key }) => {
                        const hasAccess = permissions[key]
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {hasAccess ? (
                              <Check style={{ width: 12, height: 12, color: 'var(--color-success)', flexShrink: 0 }} />
                            ) : (
                              <X style={{ width: 12, height: 12, color: 'var(--color-text-muted)', flexShrink: 0, opacity: 0.5 }} />
                            )}
                            <span style={{
                              fontSize: 12.5, fontWeight: 500,
                              color: hasAccess ? 'var(--color-text)' : 'var(--color-text-muted)',
                            }}>
                              {label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── My Account ── */}
                <div style={{ padding: '6px 0 0', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => { navigate('/account'); setMenuOpen(false) }}
                    className="flex items-center gap-2.5 w-full"
                    style={{
                      padding: '10px 18px', fontSize: 14,
                      color: 'var(--color-text-secondary)', fontWeight: 600,
                      border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit', letterSpacing: '-0.01em',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <Settings2 style={{ width: 15, height: 15, flexShrink: 0 }} />
                    My Account
                  </button>
                </div>

                {/* ── Sign out ── */}
                <div style={{ padding: '0 0 8px' }}>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full"
                    style={{
                      padding: '10px 18px', fontSize: 14,
                      color: 'var(--color-danger)', fontWeight: 600,
                      border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit', letterSpacing: '-0.01em',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--color-danger-bg, #FFF5F5)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </header>
  )
}

/* ── Shared style helpers ── */
const iconBtn: React.CSSProperties = {
  width: 34, height: 34,
  borderRadius: 9,
  border: 'none',
  background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  flexShrink: 0,
  transition: 'background 0.13s, color 0.13s',
  position: 'relative',
}

function hoverOn(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'
  ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text)'
}
function hoverOff(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.background = 'transparent'
  ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
}

const divider: React.CSSProperties = {
  width: 1, height: 18,
  background: 'var(--color-border)',
  flexShrink: 0,
}
