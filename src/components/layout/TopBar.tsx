import { Menu, LogOut, Monitor, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useNavigate, useLocation } from 'react-router-dom'

const ROLE_LABELS: Record<string, string> = {
  'super-admin':     'Super Admin',
  'hr-admin':        'HR Admin',
  'payroll-officer': 'Payroll Officer',
  'dept-head':       'Department Head',
  'employee':        'Employee',
}

const ROLE_COLORS: Record<string, string> = {
  'super-admin':     '#7C3AED',
  'hr-admin':        '#2563EB',
  'payroll-officer': '#059669',
  'dept-head':       '#D97706',
  'employee':        '#6B7280',
}

function getPageTitle(pathname: string): { section?: string; title: string } {
  const map: Record<string, { section?: string; title: string }> = {
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
    '/reports':            { section: 'Payroll', title: 'Reports & Analytics' },
    '/audit-log':          { section: 'System', title: 'Audit Logs' },
    '/settings':           { section: 'System', title: 'Settings' },
  }
  if (map[pathname]) return map[pathname]
  if (pathname.startsWith('/employees/') && pathname.endsWith('/edit'))
    return { section: 'Employees', title: 'Edit Employee' }
  if (pathname.startsWith('/employees/'))
    return { section: 'Employees', title: 'Employee Profile' }
  if (pathname.startsWith('/payroll/') && pathname.includes('/payslip/'))
    return { section: 'Payroll', title: 'Payslip' }
  if (pathname.startsWith('/payroll/'))
    return { section: 'Payroll', title: 'Payroll Detail' }
  return { title: 'Veltrix' }
}

export function TopBar({ onToggle }: { onToggle: () => void; collapsed?: boolean }) {
  const { user, logout } = useAuthStore()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/kiosk'); setMenuOpen(false) }
  const page = getPageTitle(location.pathname)
  const roleColor = user ? (ROLE_COLORS[user.role] ?? '#6B7280') : '#6B7280'

  return (
    <header
      className="no-print flex items-center gap-3 px-4 flex-shrink-0 z-20 bg-white"
      style={{ height: 56, borderBottom: '1px solid #E8EBF0' }}
    >
      {/* ── Sidebar toggle ── */}
      <button
        onClick={onToggle}
        className="p-1.5 transition-colors rounded-md"
        style={{ color: '#9CA3AF' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = '#F3F4F6'
          ;(e.currentTarget as HTMLElement).style.color = '#374151'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
        }}
        aria-label="Toggle sidebar"
      >
        <Menu style={{ width: 16, height: 16 }} />
      </button>

      {/* ── Page title / breadcrumb ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {page.section && (
          <>
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }} className="hidden sm:inline select-none">
              {page.section}
            </span>
            <span style={{ color: '#D1D5DB', fontSize: 13 }} className="hidden sm:inline select-none">/</span>
          </>
        )}
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
          {page.title}
        </span>
      </div>

      {/* ── Right controls ── */}
      <div className="flex-1 flex justify-end items-center gap-2 min-w-0">

        {/* ── Kiosk shortcut ── */}
        <button
          onClick={() => navigate('/kiosk')}
          className="hidden sm:flex items-center gap-1.5 transition-colors"
          style={{
            height: 30,
            padding: '0 10px',
            background: '#EFF6FF',
            color: '#2563EB',
            borderRadius: 6,
            border: '1px solid #BFDBFE',
            fontSize: 11.5,
            fontWeight: 600,
            flexShrink: 0,
          }}
          title="Open Kiosk"
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#DBEAFE')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#EFF6FF')}
        >
          <Monitor style={{ width: 12, height: 12 }} />
          Kiosk
        </button>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 20, background: '#E5E7EB', flexShrink: 0 }} />

        {/* ── User dropdown ── */}
        {user && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 transition-colors rounded-lg"
              style={{ padding: '4px 6px' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F9FAFB')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              {/* Avatar — round */}
              <div
                className="flex-shrink-0 flex items-center justify-center text-white font-bold"
                style={{
                  width: 30, height: 30,
                  background: roleColor,
                  borderRadius: '50%',
                  fontSize: 10,
                  letterSpacing: '-0.01em',
                }}
              >
                {user.avatarInitials}
              </div>
              <div className="hidden sm:block text-left">
                <p style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', lineHeight: 1 }}>{user.name}</p>
                <p style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2, lineHeight: 1 }}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
              <ChevronDown style={{ width: 12, height: 12, color: '#C0C7D3' }} className="hidden sm:block flex-shrink-0" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1.5 bg-white z-50 py-1"
                  style={{
                    width: 196,
                    border: '1px solid #E4E7EC',
                    borderRadius: 8,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ padding: '10px 14px 10px', borderBottom: '1px solid #F0F2F5' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', lineHeight: 1 }}>{user.name}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </p>
                  </div>
                  <button
                    onClick={() => { navigate('/kiosk'); setMenuOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 transition-colors"
                    style={{ fontSize: 12.5, color: '#374151', fontWeight: 500 }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F9FAFB')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <Monitor style={{ width: 13, height: 13, color: '#9CA3AF' }} />
                    Open Kiosk
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 transition-colors"
                    style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FEF2F2')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    <LogOut style={{ width: 13, height: 13 }} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
