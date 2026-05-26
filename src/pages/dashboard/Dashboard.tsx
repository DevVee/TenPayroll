import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Clock, Umbrella, Timer,
  CheckCircle, XCircle, Banknote, BarChart2,
  ChevronRight, RefreshCw, Bell, UserPlus,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  apiGetEmployees, apiGetTodayAttendance, apiGetPayrollPeriods,
  apiGetLeaves, apiGetOvertime,
} from '../../lib/db'
import { useAuthStore } from '../../store/authStore'
import { formatPeso } from '../../lib/payrollEngine'
import type { Employee, AttendanceRecord, PayrollPeriod, LeaveRequest, OvertimeRequest } from '../../types'

/* ── Avatar color (consistent per employee id) ──────────────────────────── */
const PALETTE = [
  '#2563EB','#7C3AED','#059669','#D97706',
  '#DC2626','#0891B2','#BE185D','#0D9488',
  '#4F46E5','#B45309','#16A34A','#9333EA',
]
function avatarColor(id: string) {
  let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/* ── Status config ───────────────────────────────────────────────────────── */
const ATT_STATUS: Record<string, { pill: string; label: string }> = {
  present:   { pill: 'pill pill-green',  label: 'Present'  },
  late:      { pill: 'pill pill-yellow', label: 'Late'     },
  absent:    { pill: 'pill pill-red',    label: 'Absent'   },
  'on-leave':{ pill: 'pill pill-blue',   label: 'On Leave' },
  'half-day':{ pill: 'pill pill-orange', label: 'Half-Day' },
  'rest-day':{ pill: 'pill pill-gray',   label: 'Rest Day' },
  holiday:   { pill: 'pill pill-purple', label: 'Holiday'  },
}

const PAYROLL_STATUS: Record<string, { pill: string; label: string }> = {
  draft:    { pill: 'pill pill-gray',   label: 'Draft'       },
  reviewed: { pill: 'pill pill-yellow', label: 'For Approval'},
  approved: { pill: 'pill pill-blue',   label: 'Approved'    },
  paid:     { pill: 'pill pill-green',  label: 'Paid'        },
}

/* ── KPI card ────────────────────────────────────────────────────────────── */
function KPICard({
  label, value, sub, badge, iconColor, icon: Icon, onClick,
}: {
  label: string; value: string | number; sub: string; badge?: string
  iconColor: string; icon: React.ElementType; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-full text-left transition-all duration-150"
      style={{ padding: '16px 18px' }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = '#CBD5E1'
        el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'var(--shadow-xs)'
        el.style.transform = 'translateY(0)'
      }}
    >
      <div className="flex items-start gap-4">
        {/* Large pastel circle icon */}
        <div
          className="icon-circle flex-shrink-0"
          style={{
            width: 48, height: 48,
            background: `${iconColor}18`,
          }}
        >
          <Icon style={{ width: 22, height: 22, color: iconColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {label}
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {value}
            </span>
            {badge && (
              <span
                style={{
                  fontSize: 10.5, fontWeight: 600,
                  color: badge.startsWith('+') ? '#059669' : badge.startsWith('-') ? '#DC2626' : '#6B7280',
                  background: badge.startsWith('+') ? '#ECFDF5' : badge.startsWith('-') ? '#FEF2F2' : '#F3F4F6',
                  padding: '1px 6px',
                  borderRadius: 99,
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4, lineHeight: 1.3 }}>{sub}</p>
        </div>
      </div>
    </button>
  )
}


/* ── Quick action button ─────────────────────────────────────────────────── */
function QuickAction({ icon: Icon, label, color, onClick }: {
  icon: React.ElementType; label: string; color: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 transition-all duration-150"
      style={{ borderRadius: 8, background: 'transparent' }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F8F9FC')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      <div
        className="icon-circle"
        style={{ width: 38, height: 38, background: `${color}14` }}
      >
        <Icon style={{ width: 17, height: 17, color }} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 500, color: '#6B7280', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </span>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayAtt,  setTodayAtt]  = useState<AttendanceRecord[]>([])
  const [periods,   setPeriods]   = useState<PayrollPeriod[]>([])
  const [leaves,    setLeaves]    = useState<LeaveRequest[]>([])
  const [otReqs,    setOtReqs]    = useState<OvertimeRequest[]>([])
  const [loading,   setLoading]   = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      apiGetEmployees({ status: 'active' }),
      apiGetTodayAttendance(),
      apiGetPayrollPeriods(),
      apiGetLeaves({ status: 'pending' }),
      apiGetOvertime({ status: 'pending' }),
    ]).then(([emps, att, pds, lv, ot]) => {
      setEmployees(emps); setTodayAtt(att); setPeriods(pds)
      setLeaves(lv); setOtReqs(ot); setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  /* ── Time-aware greeting ── */
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  /* ── Date string ── */
  const today   = new Date()
  const dateStr = today.toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric', weekday: 'short',
  })

  /* ── Attendance calculations ── */
  const working   = todayAtt.filter(a => a.status !== 'rest-day' && a.status !== 'holiday')
  const present   = working.filter(a => a.status === 'present' || a.status === 'late').length
  const late      = working.filter(a => a.status === 'late').length
  const absent    = working.filter(a => a.status === 'absent').length
  const onLeave   = working.filter(a => a.status === 'on-leave').length
  const attPct    = working.length > 0 ? Math.round((present / working.length) * 100) : 0

  /* ── Payroll ── */
  const lastPeriod      = periods[0]
  const pendingPayrolls = periods.filter(p => p.status === 'draft' || p.status === 'reviewed').length
  const totalPending    = leaves.length + otReqs.length + pendingPayrolls

  /* ── Dept breakdown ── */
  const deptMap  = employees.reduce<Record<string, number>>((acc, e) => {
    acc[e.department] = (acc[e.department] ?? 0) + 1; return acc
  }, {})

  /* ── Donut chart data ── */
  const donutData = [
    { name: 'Present',  value: present - late, color: '#059669' },
    { name: 'Late',     value: late,           color: '#D97706' },
    { name: 'Absent',   value: absent,         color: '#DC2626' },
    { name: 'On Leave', value: onLeave,        color: '#2563EB' },
  ].filter(d => d.value > 0)

  const donutTotal = working.length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Greeting header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-bold text-gray-900 leading-tight"
            style={{ fontSize: 22, letterSpacing: '-0.025em' }}
          >
            {greeting}, {firstName}! 👋
          </h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>
            Here's what's happening in your organization today.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Date badge */}
          <div
            className="hidden md:flex items-center gap-2"
            style={{
              padding: '6px 12px',
              background: '#fff',
              border: '1px solid #E4E7EC',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              color: '#374151',
            }}
          >
            <Clock style={{ width: 13, height: 13, color: '#9CA3AF' }} />
            {dateStr}
          </div>

          {/* Pending items */}
          {totalPending > 0 && (
            <button
              onClick={() => navigate('/leaves')}
              className="flex items-center gap-2 transition-colors"
              style={{
                padding: '6px 12px',
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: '#92400E',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FDE68A')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#FEF3C7')}
            >
              <Bell style={{ width: 13, height: 13 }} />
              {totalPending} pending item{totalPending !== 1 ? 's' : ''}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={load}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#9CA3AF', background: '#fff', border: '1px solid #E4E7EC' }}
            title="Refresh"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#F3F4F6'
              ;(e.currentTarget as HTMLElement).style.color = '#374151'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = '#fff'
              ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Active Employees"
          value={employees.length}
          sub={`${Object.keys(deptMap).length} department${Object.keys(deptMap).length !== 1 ? 's' : ''}`}
          badge="+3 this month"
          iconColor="#7C3AED"
          icon={Users}
          onClick={() => navigate('/employees')}
        />
        <KPICard
          label="Present Today"
          value={`${present} / ${working.length}`}
          sub={`${late > 0 ? `${late} late · ` : ''}${absent} absent`}
          badge={`${attPct}%`}
          iconColor="#059669"
          icon={CheckCircle}
          onClick={() => navigate('/attendance')}
        />
        <KPICard
          label="Pending Approvals"
          value={leaves.length + otReqs.length}
          sub={`${leaves.length} leave · ${otReqs.length} overtime`}
          iconColor="#D97706"
          icon={Bell}
          onClick={() => navigate('/leaves')}
        />
        <KPICard
          label="Payroll Pending"
          value={pendingPayrolls}
          sub={lastPeriod ? `${lastPeriod.frequency} · ${lastPeriod.startDate} – ${lastPeriod.endDate}` : 'No pay runs yet'}
          badge={pendingPayrolls > 0 ? 'Review' : undefined}
          iconColor="#2563EB"
          icon={Banknote}
          onClick={() => navigate('/payroll')}
        />
      </div>

      {/* ── Main grid: 3-col (2 + 1) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── Left: Today's Attendance ── */}
        <div className="xl:col-span-2 card overflow-hidden">
          {/* Card header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center gap-2.5">
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Today's Attendance</h2>
              <span
                style={{
                  fontSize: 11, fontWeight: 600, color: '#2563EB',
                  background: '#EFF6FF', padding: '2px 8px', borderRadius: 99,
                  border: '1px solid #BFDBFE',
                }}
              >
                {today.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <button
              onClick={() => navigate('/attendance/log')}
              className="flex items-center gap-1 font-semibold transition-colors"
              style={{ fontSize: 12, color: '#2563EB' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#1D4ED8')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2563EB')}
            >
              View all logs
              <ChevronRight style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
            <table className="table-base w-full">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="hidden sm:table-cell">Department</th>
                  <th>Time In</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {working.slice(0, 15).map(a => {
                  const emp      = employees.find(e => e.id === a.employeeId)
                  const sc       = ATT_STATUS[a.status] ?? ATT_STATUS['rest-day']
                  const initials = a.employeeName.split(' ')
                    .filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  const aColor   = avatarColor(a.employeeId ?? a.id)

                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {/* Round avatar */}
                          <div
                            className="avatar avatar-sm avatar-round flex-shrink-0"
                            style={{ background: aColor }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1 }}>
                              {a.employeeName}
                            </p>
                            <p style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>
                              {a.employeeNo ?? emp?.employeeNo ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span style={{ fontSize: 12.5, color: '#6B7280' }}>
                          {emp?.department?.split(' ').slice(0, 2).join(' ') ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span className="tabular-nums" style={{ fontSize: 12.5, color: '#374151' }}>
                          {a.timeIn
                            ? new Date(a.timeIn).toLocaleTimeString('en-PH', {
                                hour: '2-digit', minute: '2-digit', hour12: true,
                              })
                            : <span style={{ color: '#D1D5DB' }}>—</span>
                          }
                        </span>
                      </td>
                      <td>
                        <span className={sc.pill}>{sc.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {working.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <Clock style={{ width: 36, height: 36, color: '#E5E7EB', marginBottom: 10 }} />
                <p style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF' }}>No attendance recorded yet</p>
                <p style={{ fontSize: 11, color: '#D1D5DB', marginTop: 3 }}>Employees clock in via the Kiosk</p>
                <button
                  onClick={() => navigate('/kiosk')}
                  className="btn-primary btn-sm mt-4"
                >
                  Open Kiosk
                </button>
              </div>
            )}
          </div>

          {/* Footer legend */}
          {working.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-subtle)' }}
            >
              <div className="flex items-center gap-4 flex-wrap">
                {[
                  { label: 'Present', value: present, color: '#059669' },
                  { label: 'Late',    value: late,    color: '#D97706' },
                  { label: 'Absent',  value: absent,  color: '#DC2626' },
                  { label: 'Leave',   value: onLeave, color: '#2563EB' },
                ].map(item => (
                  <span key={item.label} className="flex items-center gap-1.5" style={{ fontSize: 11.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ color: '#6B7280' }}>{item.label}</span>
                    <span style={{ fontWeight: 700, color: item.color }} className="tabular-nums">{item.value}</span>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B7280' }} className="tabular-nums">
                {attPct}% attendance rate
              </span>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="space-y-4">

          {/* Attendance Overview — Donut chart */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Attendance Overview</h3>
              <span
                style={{
                  fontSize: 10.5, fontWeight: 600, color: '#6B7280',
                  background: '#F3F4F6', padding: '2px 8px', borderRadius: 6,
                  border: '1px solid #E5E7EB',
                }}
              >
                Today
              </span>
            </div>

            {donutData.length > 0 ? (
              <>
                <div style={{ position: 'relative', height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 11, border: '1px solid #E4E7EC',
                          borderRadius: 6, boxShadow: 'none', padding: '5px 10px',
                        }}
                        formatter={(v: number, name: string) => [`${v} (${Math.round((v / donutTotal) * 100)}%)`, name]}
                      />
                      {/* Center text as custom label */}
                      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: 22, fontWeight: 800, fill: '#111827' }}>
                        {donutTotal}
                      </text>
                      <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: 9.5, fill: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Total
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="space-y-2 mt-1">
                  {[
                    { label: 'Present',  value: present - late, color: '#059669' },
                    { label: 'Late',     value: late,           color: '#D97706' },
                    { label: 'Absent',   value: absent,         color: '#DC2626' },
                    { label: 'On Leave', value: onLeave,        color: '#2563EB' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, color: '#6B7280' }}>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }} className="tabular-nums">{item.value}</span>
                        <span style={{ fontSize: 10.5, color: '#9CA3AF', width: 38, textAlign: 'right' }} className="tabular-nums">
                          ({donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Compared to yesterday */}
                <div
                  className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: '1px solid var(--border-light)' }}
                >
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>Compared to yesterday</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>↑ {attPct}%</span>
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center" style={{ color: '#D1D5DB', fontSize: 12 }}>
                No attendance data yet
              </div>
            )}
          </div>

          {/* Payroll Summary */}
          {lastPeriod && (
            <div className="card overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border-light)' }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Payroll Summary</h3>
                <span className={(PAYROLL_STATUS[lastPeriod.status] ?? PAYROLL_STATUS.draft).pill}>
                  {(PAYROLL_STATUS[lastPeriod.status] ?? PAYROLL_STATUS.draft).label}
                </span>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: 8 }}>
                  Pay Run
                </p>
                <p style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 12 }}>
                  {new Date(lastPeriod.startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  {' – '}
                  {new Date(lastPeriod.endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                      Gross Payroll
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#374151' }} className="tabular-nums">
                      {formatPeso(lastPeriod.totalGross)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
                      Deductions
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#DC2626' }} className="tabular-nums">
                      − {formatPeso(lastPeriod.totalDeductions)}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between pt-2 mt-1"
                    style={{ borderTop: '1px solid var(--border-light)' }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
                      Net Payroll
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#2563EB', letterSpacing: '-0.03em' }} className="tabular-nums">
                      {formatPeso(lastPeriod.totalNet)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    <Users style={{ width: 11, height: 11, display: 'inline', marginRight: 4 }} />
                    {lastPeriod.totalEmployees} employees
                  </span>
                  <button
                    onClick={() => navigate('/payroll')}
                    className="flex items-center gap-0.5 font-semibold transition-colors"
                    style={{ fontSize: 11.5, color: '#2563EB' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#1D4ED8')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2563EB')}
                  >
                    View payroll run <ChevronRight style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card p-3">
            <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4, padding: '0 4px' }}>
              Quick Actions
            </p>
            <div className="grid grid-cols-3 gap-1">
              <QuickAction icon={UserPlus}  label="Add Employee"  color="#7C3AED" onClick={() => navigate('/employees/new')} />
              <QuickAction icon={Umbrella}  label="Leave Request" color="#D97706" onClick={() => navigate('/leaves')} />
              <QuickAction icon={Timer}     label="OT Request"    color="#BE185D" onClick={() => navigate('/overtime')} />
              <QuickAction icon={Banknote}  label="Run Payroll"   color="#2563EB" onClick={() => navigate('/payroll')} />
              <QuickAction icon={BarChart2} label="Reports"       color="#059669" onClick={() => navigate('/reports')} />
              <QuickAction icon={Users}     label="Employees"     color="#0891B2" onClick={() => navigate('/employees')} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Pending actions ── */}
      {(leaves.length > 0 || otReqs.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Leave Requests */}
          {leaves.length > 0 && (
            <div className="card overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid #FDE68A', background: '#FFFBEB' }}
              >
                <div className="flex items-center gap-2">
                  <Umbrella style={{ width: 14, height: 14, color: '#D97706' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Leave Requests</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, color: '#92400E',
                    background: '#FEF3C7', padding: '1px 7px', borderRadius: 99, border: '1px solid #FDE68A',
                  }}>{leaves.length}</span>
                </div>
                <button
                  onClick={() => navigate('/leaves')}
                  style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#1D4ED8')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2563EB')}
                >
                  View all
                </button>
              </div>
              {leaves.slice(0, 5).map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < Math.min(leaves.length, 5) - 1 ? '1px solid var(--border-light)' : 'none' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="avatar avatar-sm avatar-round" style={{ background: avatarColor(l.id), flexShrink: 0 }}>
                      {l.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{l.employeeName}</p>
                      <p style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1, textTransform: 'capitalize' }}>
                        {l.leaveType} leave · {l.days} day{l.days !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
                      {new Date(l.startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="pill pill-yellow" style={{ fontSize: 10 }}>Pending</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Overtime Requests */}
          {otReqs.length > 0 && (
            <div className="card overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid #DDD6FE', background: '#F5F3FF' }}
              >
                <div className="flex items-center gap-2">
                  <Timer style={{ width: 14, height: 14, color: '#7C3AED' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Overtime Requests</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, color: '#6D28D9',
                    background: '#EDE9FE', padding: '1px 7px', borderRadius: 99, border: '1px solid #DDD6FE',
                  }}>{otReqs.length}</span>
                </div>
                <button
                  onClick={() => navigate('/overtime')}
                  style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#1D4ED8')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#2563EB')}
                >
                  View all
                </button>
              </div>
              {otReqs.slice(0, 5).map((o, i) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < Math.min(otReqs.length, 5) - 1 ? '1px solid var(--border-light)' : 'none' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="avatar avatar-sm avatar-round" style={{ background: avatarColor(o.id), flexShrink: 0 }}>
                      {o.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{o.employeeName}</p>
                      <p style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1 }}>
                        {o.date} · {o.hoursRequested}h overtime
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate('/overtime')}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#9CA3AF' }}
                      title="Review"
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = '#ECFDF5'
                        ;(e.currentTarget as HTMLElement).style.color = '#059669'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
                      }}
                    >
                      <CheckCircle style={{ width: 15, height: 15 }} />
                    </button>
                    <button
                      onClick={() => navigate('/overtime')}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#9CA3AF' }}
                      title="Reject"
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = '#FEF2F2'
                        ;(e.currentTarget as HTMLElement).style.color = '#DC2626'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
                      }}
                    >
                      <XCircle style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
