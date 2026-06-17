import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Edit2, ArrowLeft, Mail, Phone, Calendar, CreditCard,
  Clock, TrendingUp, Users, BarChart2, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useData } from '../../hooks/useData'
import {
  apiGetEmployee, apiGetAttendance, apiGetLeaves,
  apiGetPayrollPeriods, apiGetPayrollEntries, apiGetSalaryHistory,
} from '../../lib/db'
import { apiGetOvertime } from '../../lib/_db/overtime'
import { formatPeso } from '../../lib/payrollEngine'
import type { PayrollEntry } from '../../types'

const TABS = ['Overview', 'Analytics', 'Attendance', 'Payroll History', 'Leaves', 'Salary History'] as const
type Tab = typeof TABS[number]

// Deterministic avatar color
const AVATAR_PALETTE = [
  '#4F46E5','#7C3AED','#059669','#D97706',
  '#DC2626','#0284C7','#BE185D','#065F46',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

/** Group an array by a string key → Record<key, item[]> */
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    ;(acc[k] = acc[k] ?? []).push(item)
    return acc
  }, {})
}

const MONTH_FMT = new Intl.DateTimeFormat('en-PH', { month: 'short', year: '2-digit' })
function monthLabel(dateStr: string) {
  return MONTH_FMT.format(new Date(dateStr))
}

// ── Custom recharts tooltip ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <p style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, margin: '1px 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('Overview')

  // ── Core data ──────────────────────────────────────────────────────────────
  const { data: emp, loading } = useData(() => apiGetEmployee(id!), [id])

  // 30-day attendance for hero strip + Attendance tab
  const { data: attendance } = useData(
    () => apiGetAttendance({ employeeId: id, startDate: new Date(Date.now()-30*864e5).toISOString().split('T')[0] }),
    [id],
  )

  // 90-day attendance for Analytics charts
  const { data: attExtended } = useData(
    () => apiGetAttendance({ employeeId: id, startDate: new Date(Date.now()-90*864e5).toISOString().split('T')[0] }),
    [id],
  )

  // Leave requests
  const { data: leaves } = useData(() => apiGetLeaves({ employeeId: id }), [id])

  // Overtime requests
  const { data: overtime } = useData(() => apiGetOvertime({ employeeId: id }), [id])

  // Salary history
  const { data: salaryHistory } = useData(() => apiGetSalaryHistory(id!), [id])

  // Payroll data (used by both Analytics + Payroll History tabs)
  const { data: periods } = useData(() => apiGetPayrollPeriods(), [])
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)

  const loadEntries = async () => {
    if (entriesLoaded || !periods) return
    const all: PayrollEntry[] = []
    for (const p of periods.slice(0, 6)) {
      const entries = await apiGetPayrollEntries(p.id)
      const e = entries.find(e => e.employeeId === id)
      if (e) all.push({ ...e, payrollPeriodId: p.id })
    }
    setPayrollEntries(all.reverse()) // oldest → newest for trend chart
    setEntriesLoaded(true)
  }

  if ((tab === 'Payroll History' || tab === 'Analytics') && !entriesLoaded) loadEntries()

  if (loading || !emp) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  // ── Derived stats ──────────────────────────────────────────────────────────
  const att        = attendance ?? []
  const attExt     = attExtended ?? []
  const lv         = leaves ?? []
  const ot         = overtime ?? []
  const presentDays = att.filter(a => a.status === 'present' || a.status === 'late').length
  const lateDays    = att.filter(a => a.status === 'late').length
  const absentDays  = att.filter(a => a.status === 'absent').length
  const bgColor     = avatarColor(emp.id)

  // ── Analytics helpers ──────────────────────────────────────────────────────
  // Monthly attendance breakdown (last 3 months)
  const attByMonth = groupBy(
    attExt.filter(a => a.status !== 'rest-day'),
    a => monthLabel(a.date),
  )
  const attendanceChartData = Object.entries(attByMonth).map(([month, recs]) => ({
    month,
    Present: recs.filter(r => r.status === 'present').length,
    Late:    recs.filter(r => r.status === 'late').length,
    Absent:  recs.filter(r => r.status === 'absent').length,
    'On Leave': recs.filter(r => r.status === 'on-leave').length,
  }))

  // Leave type breakdown
  const leaveByType = groupBy(lv.filter(l => l.status === 'approved'), l => l.leaveType)
  const leaveChartData = Object.entries(leaveByType).map(([type, reqs]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    days: reqs.reduce((s, r) => {
      const ms = new Date(r.endDate).getTime() - new Date(r.startDate).getTime()
      return s + Math.round(ms / 86400000) + 1
    }, 0),
  }))

  // OT summary
  const approvedOT   = ot.filter(o => o.status === 'approved')
  const totalOTHours = approvedOT.reduce((s, o) => s + o.hoursRequested, 0)
  const otByMonth    = groupBy(approvedOT, o => monthLabel(o.date))
  const otChartData  = Object.entries(otByMonth).map(([month, recs]) => ({
    month,
    Hours: recs.reduce((s, r) => s + r.hoursRequested, 0),
  }))

  // Payroll trend
  const payrollChartData = payrollEntries.map(pe => {
    const period = periods?.find(p => p.id === pe.payrollPeriodId)
    return {
      period: period?.periodNo ?? '—',
      'Net Pay': pe.netPay,
      'Gross Pay': pe.grossPay,
    }
  })

  // Leave totals
  const totalLeaveDays   = lv.filter(l => l.status === 'approved').reduce((s, l) => {
    const ms = new Date(l.endDate).getTime() - new Date(l.startDate).getTime()
    return s + Math.round(ms / 86400000) + 1
  }, 0)
  const pendingLeaves    = lv.filter(l => l.status === 'pending').length

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Employees"
        title={emp.fullName}
        subtitle={`${emp.employeeNo} · ${emp.position}`}
        actions={[
          { label: 'Back', icon: ArrowLeft, variant: 'secondary', onClick: () => navigate('/employees') },
          { label: 'Edit', icon: Edit2, onClick: () => navigate(`/employees/${id}/edit`) },
        ]}
      />

      {/* ── Profile hero card ── */}
      <div className="card overflow-hidden">
        <div style={{ height: 5, background: 'linear-gradient(90deg, var(--color-primary), #8B8FF0)' }} />
        <div className="p-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="flex-shrink-0 flex items-center justify-center text-white font-bold select-none"
              style={{
                width: 64, height: 64, borderRadius: '50%', background: bgColor,
                fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                boxShadow: `0 0 0 3px white, 0 0 0 5px ${bgColor}33`,
              }}
            >
              {emp.firstName[0]}{emp.lastName[0]}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.025em' }}>
                  {emp.fullName}
                </h2>
                <StatusBadge type="employee" status={emp.status}>
                  {emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                </StatusBadge>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {emp.position}
                <span style={{ color: 'var(--color-border)', margin: '0 6px' }}>·</span>
                {emp.department}
              </p>
              <div className="flex flex-wrap gap-4 mt-3">
                {[
                  { icon: Mail,       text: emp.email },
                  { icon: Phone,      text: emp.phone },
                  { icon: Calendar,   text: emp.hireDate ? `Hired ${new Date(emp.hireDate).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'})}` : 'Hire date N/A' },
                  { icon: CreditCard, text: `₱${emp.basicSalary.toLocaleString()} / mo` },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <Icon style={{ width: 13, height: 13 }} />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick stats strip — 30-day snapshot */}
            <div className="hidden lg:flex items-stretch gap-0" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
              {[
                { label: 'Present (30d)', value: presentDays, color: 'var(--color-success)' },
                { label: 'Late (30d)',    value: lateDays,    color: 'var(--color-warning)' },
                { label: 'Absent (30d)', value: absentDays,  color: 'var(--color-danger)' },
              ].map((s, i) => (
                <div key={s.label} className="text-center px-5" style={{ borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
                  <p style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.04em' }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? 'active' : ''}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          OVERVIEW TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoSection title="Personal Information" rows={[
            ['Full Name',      emp.fullName],
            ['Employee No.',   emp.employeeNo],
            ['Date of Birth',  emp.birthDate ? new Date(emp.birthDate).toLocaleDateString('en-PH') : '—'],
            ['Gender',         emp.gender ?? '—'],
            ['Civil Status',   emp.civilStatus ?? '—'],
            ['Address',        emp.address ?? '—'],
            ['Phone',          emp.phone ?? '—'],
            ['Email',          emp.email ?? '—'],
          ]} />
          <InfoSection title="Employment Details" rows={[
            ['Designation',     emp.position],
            ['Department',      emp.department ?? '—'],
            ['Employment Type', emp.employmentType ?? '—'],
            ['Hire Date',       emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('en-PH') : '—'],
            ['Pay Frequency',   emp.payFrequency ?? '—'],
            ['Tax Status',      emp.taxStatus ?? '—'],
            ['Basic Salary',    formatPeso(emp.basicSalary)],
            ['Daily Rate',      formatPeso(emp.dailyRate ?? 0)],
          ]} />
          <InfoSection title="Government IDs" rows={[
            ['SSS No.',        emp.sssNo ?? '—'],
            ['PhilHealth No.', emp.philhealthNo ?? '—'],
            ['Pag-IBIG No.',   emp.pagibigNo ?? '—'],
            ['TIN No.',        emp.tinNo ?? '—'],
          ]} />
          <InfoSection title="Banking & Emergency Contact" rows={[
            ['Bank Name',       emp.bankName ?? '—'],
            ['Bank Account',    emp.bankAccount ?? '—'],
            ['Emergency Name',  emp.emergencyContactName ?? '—'],
            ['Emergency Phone', emp.emergencyContactPhone ?? '—'],
          ]} />
          {(emp.allowances?.length ?? 0) > 0 && (
            <div className="card p-4 lg:col-span-2">
              <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Allowances
              </h3>
              <div className="flex flex-wrap gap-2">
                {(emp.allowances ?? []).map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{a.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{formatPeso(a.amount)}</span>
                    {!a.taxable && <span style={{ fontSize: 10, color: 'var(--color-success)', fontWeight: 600 }}>NON-TAX</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ANALYTICS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'Analytics' && (
        <div className="space-y-4">

          {/* ── Row 1: Quick KPI chips ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Attendance Rate',
                value: attExt.length > 0
                  ? `${Math.round((attExt.filter(a => a.status === 'present' || a.status === 'late').length / Math.max(attExt.filter(a => a.status !== 'rest-day').length, 1)) * 100)}%`
                  : '—',
                icon: Users,
                color: 'var(--color-success)',
                sub: 'Last 90 days',
              },
              {
                label: 'Late Incidents',
                value: attExt.filter(a => a.status === 'late').length,
                icon: AlertTriangle,
                color: 'var(--color-warning)',
                sub: 'Last 90 days',
              },
              {
                label: 'OT Hours Logged',
                value: `${totalOTHours.toFixed(1)}h`,
                icon: Clock,
                color: 'var(--color-primary)',
                sub: `${approvedOT.length} approved requests`,
              },
              {
                label: 'Leave Days Used',
                value: `${totalLeaveDays}d`,
                icon: Calendar,
                color: 'var(--color-info)',
                sub: pendingLeaves > 0 ? `${pendingLeaves} pending` : 'All time',
              },
            ].map(k => (
              <div key={k.label} className="card p-4" style={{ borderTop: `3px solid ${k.color}` }}>
                <div className="flex items-start justify-between mb-2">
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {k.label}
                  </p>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <k.icon style={{ width: 13, height: 13, color: k.color }} />
                  </div>
                </div>
                <p className="tabular-nums" style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {k.value}
                </p>
                <p style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4 }}>{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Row 2: Attendance Trend Chart ── */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Monthly Attendance Breakdown</h3>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Last 90 days</span>
            </div>
            {attendanceChartData.length === 0 ? (
              <NoDataPlaceholder text="No attendance records in the last 90 days" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={attendanceChartData} barCategoryGap="30%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    axisLine={false} tickLine={false} allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  <Bar dataKey="Present"  fill="#16A34A" radius={[3,3,0,0]} />
                  <Bar dataKey="Late"     fill="#D97706" radius={[3,3,0,0]} />
                  <Bar dataKey="Absent"   fill="#DC2626" radius={[3,3,0,0]} />
                  <Bar dataKey="On Leave" fill="#0284C7" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Row 3: Overtime + Leave side by side ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Overtime Hours Chart */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Overtime by Month</h3>
              </div>
              {otChartData.length === 0 ? (
                <NoDataPlaceholder text="No approved overtime records" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={otChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="h" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Hours" fill="#5B5FC7" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {approvedOT.length > 0 && (
                <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total Approved OT</p>
                    <p className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-0.03em' }}>
                      {totalOTHours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="text-right">
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total Requests</p>
                    <p className="tabular-nums" style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
                      {approvedOT.length}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Leave Breakdown */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar style={{ width: 14, height: 14, color: 'var(--color-info)' }} />
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Leave Usage</h3>
              </div>
              {leaveChartData.length === 0 ? (
                <NoDataPlaceholder text="No approved leave records" />
              ) : (
                <div className="space-y-3">
                  {leaveChartData.sort((a,b) => b.days - a.days).map(item => {
                    const maxDays = Math.max(...leaveChartData.map(x => x.days))
                    const pct = maxDays > 0 ? (item.days / maxDays) * 100 : 0
                    return (
                      <div key={item.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{item.type}</span>
                          <span className="tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                            {item.days} day{item.days !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 9999, background: 'var(--color-surface-2)' }}>
                          <div
                            style={{
                              height: '100%', borderRadius: 9999,
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, var(--color-info), #38BDF8)',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Leave summary footer */}
              <div className="mt-4 pt-3 grid grid-cols-3 gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                {[
                  { label: 'Approved',  value: lv.filter(l => l.status === 'approved').length,  color: 'var(--color-success)' },
                  { label: 'Pending',   value: lv.filter(l => l.status === 'pending').length,   color: 'var(--color-warning)' },
                  { label: 'Rejected',  value: lv.filter(l => l.status === 'rejected').length,  color: 'var(--color-danger)' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
                    <p style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Row 4: Salary Trend ── */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>Salary Trend</h3>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                Last {payrollChartData.length} pay periods
              </span>
            </div>
            {!entriesLoaded ? (
              <div className="flex items-center justify-center h-40">
                <div className="spinner" />
              </div>
            ) : payrollChartData.length === 0 ? (
              <NoDataPlaceholder text="No payroll records found" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={payrollChartData} margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `₱${(v/1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-md)' }}>
                            <p style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</p>
                            {payload.map((p: any) => (
                              <p key={p.name} style={{ color: p.color, margin: '1px 0' }}>
                                {p.name}: <strong>{formatPeso(p.value)}</strong>
                              </p>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Line
                      type="monotone" dataKey="Gross Pay"
                      stroke="#94A3B8" strokeWidth={2} dot={{ r: 3, fill: '#94A3B8' }}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone" dataKey="Net Pay"
                      stroke="#5B5FC7" strokeWidth={2.5} dot={{ r: 4, fill: '#5B5FC7', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Summary row */}
                {payrollChartData.length > 0 && (() => {
                  const latest = payrollEntries[payrollEntries.length - 1]
                  return latest ? (
                    <div className="mt-3 pt-3 grid grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                      {[
                        { label: 'Latest Gross',      value: formatPeso(latest.grossPay),      color: 'var(--color-text)' },
                        { label: 'Latest Deductions', value: formatPeso(latest.totalDeductions), color: 'var(--color-danger)' },
                        { label: 'Latest Net Pay',    value: formatPeso(latest.netPay),         color: 'var(--color-primary)' },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                          <p style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}
              </>
            )}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ATTENDANCE TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'Attendance' && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <Clock style={{ width: 15, height: 15, color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Last 30 Days Attendance</span>
          </div>
          {att.length === 0 ? (
            <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No attendance records found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    {['Date','Time In','Time Out','Hours','Late','Status'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {att.filter(a => a.status !== 'rest-day').map(a => {
                    const hours = a.timeIn && a.timeOut
                      ? ((new Date(a.timeOut).getTime() - new Date(a.timeIn).getTime()) / 3600000).toFixed(1)
                      : '—'
                    return (
                      <tr key={a.id}>
                        <td className="tabular-nums" style={{ fontWeight: 500 }}>{a.date}</td>
                        <td className="tabular-nums text-gray-600">
                          {a.timeIn ? new Date(a.timeIn).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',hour12:true}) : '—'}
                        </td>
                        <td className="tabular-nums text-gray-600">
                          {a.timeOut ? new Date(a.timeOut).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',hour12:true}) : '—'}
                        </td>
                        <td className="tabular-nums text-gray-600">{hours}</td>
                        <td className="tabular-nums text-gray-600">
                          {a.minutesLate > 0 ? `${a.minutesLate}m` : '—'}
                        </td>
                        <td>
                          <StatusBadge type="attendance" status={a.status}>
                            {a.status.replace('-', ' ')}
                          </StatusBadge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PAYROLL HISTORY TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'Payroll History' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Payroll History</span>
          </div>
          {payrollEntries.length === 0 ? (
            <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {entriesLoaded ? 'No payroll records found' : 'Loading…'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    {['Period','Gross Pay','Deductions','Net Pay',''].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...payrollEntries].reverse().map(pe => {
                    const period = periods?.find(p => p.id === pe.payrollPeriodId)
                    return (
                      <tr key={pe.id}>
                        <td>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                            {period?.periodNo ?? '—'}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            {period?.startDate} – {period?.endDate}
                          </p>
                        </td>
                        <td className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {formatPeso(pe.grossPay)}
                        </td>
                        <td className="tabular-nums" style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                          −{formatPeso(pe.totalDeductions)}
                        </td>
                        <td className="tabular-nums" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                          {formatPeso(pe.netPay)}
                        </td>
                        <td>
                          <button
                            onClick={() => navigate(`/payroll/${pe.payrollPeriodId}/payslip/${pe.employeeId}`)}
                            style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}
                            className="hover:underline"
                          >
                            Payslip →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SALARY HISTORY TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'Salary History' && (() => {
        const history = salaryHistory ?? []
        return (
          <div className="space-y-4">
            {/* Summary card */}
            {history.length > 0 && (() => {
              const latest  = history[0]
              const oldest  = history[history.length - 1]
              const delta   = latest.newSalary - (oldest.oldSalary ?? oldest.newSalary)
              const pct     = oldest.oldSalary
                ? ((delta / oldest.oldSalary) * 100).toFixed(1)
                : null
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Current Salary',   value: formatPeso(emp.basicSalary),          color: 'var(--color-primary)' },
                    { label: 'Total Adjustments',value: history.length,                        color: 'var(--color-text)' },
                    { label: 'Lifetime Change',  value: pct ? `${delta >= 0 ? '+' : ''}${pct}%` : '—', color: delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
                  ].map(s => (
                    <div key={s.label} className="card p-4 text-center">
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                      <p className="tabular-nums mt-1" style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <TrendingUp style={{ width: 14, height: 14, color: 'var(--color-primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Salary Change Log</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  {history.length} record{history.length !== 1 ? 's' : ''}
                </span>
              </div>

              {history.length === 0 ? (
                <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  No salary changes recorded yet.{' '}
                  <span style={{ fontSize: 12 }}>Changes are tracked automatically when you edit an employee's basic salary.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base w-full">
                    <thead>
                      <tr>
                        <th>Effective Date</th>
                        <th>Previous</th>
                        <th>New Salary</th>
                        <th>Change</th>
                        <th>Changed By</th>
                        <th className="hidden md:table-cell">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => {
                        const diff    = h.newSalary - (h.oldSalary ?? h.newSalary)
                        const pctVal  = h.oldSalary && h.oldSalary > 0
                          ? ((diff / h.oldSalary) * 100).toFixed(1)
                          : null
                        const isUp    = diff > 0
                        const isFlat  = diff === 0 || h.oldSalary === null
                        return (
                          <tr key={h.id}>
                            <td className="tabular-nums" style={{ fontWeight: 600 }}>
                              {new Date(h.effectiveDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                              {h.oldSalary !== null ? formatPeso(h.oldSalary) : <span style={{ color: 'var(--color-border-strong)' }}>— (first)</span>}
                            </td>
                            <td className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                              {formatPeso(h.newSalary)}
                            </td>
                            <td>
                              {isFlat ? (
                                <span className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                  <Minus style={{ width: 12, height: 12 }} /> Initial
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 tabular-nums" style={{ fontSize: 12, fontWeight: 700, color: isUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                  {isUp
                                    ? <ArrowUpRight style={{ width: 13, height: 13 }} />
                                    : <ArrowDownRight style={{ width: 13, height: 13 }} />}
                                  {isUp ? '+' : ''}{formatPeso(diff)}
                                  {pctVal && <span style={{ fontWeight: 500, opacity: 0.8 }}>({isUp ? '+' : ''}{pctVal}%)</span>}
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              {h.changedBy ?? '—'}
                            </td>
                            <td className="hidden md:table-cell" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              {h.reason ?? <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          LEAVES TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'Leaves' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Leave Requests</span>
          </div>
          {lv.length === 0 ? (
            <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No leave records found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    {['Type','Start','End','Days','Reason','Status'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lv.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{l.leaveType}</td>
                      <td className="tabular-nums text-gray-600">{l.startDate}</td>
                      <td className="tabular-nums text-gray-600">{l.endDate}</td>
                      <td className="tabular-nums text-gray-600">{l.days}</td>
                      <td className="max-w-xs truncate text-gray-600">{l.reason}</td>
                      <td>
                        <StatusBadge type="leave" status={l.status}>
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function InfoSection({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  return (
    <div className="card p-4">
      <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        {title}
      </h3>
      <div className="space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start gap-3">
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 128, flexShrink: 0, paddingTop: 1 }}>{label}</span>
            <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
              {value || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NoDataPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <BarChart2 style={{ width: 32, height: 32, color: 'var(--color-border-strong)' }} />
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{text}</p>
    </div>
  )
}
