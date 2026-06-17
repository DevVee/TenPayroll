// ─── Reports & Analytics ──────────────────────────────────────────────────────
// Tabs: Attendance · Payroll Summary · Gov Contributions · Employee Masterlist
// All tabs support Excel + CSV export via exportService.ts
import { useState, useMemo } from 'react'
import {
  Download, BarChart3, FileText, Users, FileSpreadsheet,
  CircleDollarSign,
} from 'lucide-react'
import { useData } from '../../hooks/useData'
import {
  apiGetAttendance, apiGetPayrollPeriods, apiGetEmployees,
  apiGetPayrollEntries, apiGetAdvances,
} from '../../lib/db'
import { formatPeso } from '../../lib/payrollEngine'
import {
  exportAttendanceReport, exportPayrollRun, exportGovtContributions, exportEmployeeMasterlist, exportAdvanceReport,
} from '../../lib/exportService'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid,
} from 'recharts'
import type { PayrollPeriod } from '../../types'

// ── Config ───────────────────────────────────────────────────────────────────
const REPORT_TABS = [
  { id: 'attendance',  label: 'Attendance',          icon: Users },
  { id: 'payroll',     label: 'Payroll Summary',      icon: BarChart3 },
  { id: 'govcontrib',  label: "Gov't Contributions",  icon: CircleDollarSign },
  { id: 'employees',   label: 'Employee Masterlist',  icon: FileText },
  { id: 'advances',    label: 'Salary Advances',      icon: FileSpreadsheet },
] as const
type TabId = typeof REPORT_TABS[number]['id']

const PIE_COLORS = ['#5B5FC7','#16A34A','#D97706','#DC2626','#7C3AED','#0284C7']

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#1B1D2E', border: 'none', borderRadius: 10,
    fontSize: 11.5, color: '#fff', fontFamily: 'Plus Jakarta Sans',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)', padding: '8px 14px',
  },
  cursor: { fill: 'rgba(91,95,199,0.06)' },
  labelStyle: { color: 'rgba(165,168,240,0.6)', marginBottom: 4 },
}

function dateN(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

// ── Mini KPI ──────────────────────────────────────────────────────────────────
function Mini({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="stat-tile" style={{ padding: '14px 18px' }}>
      <p className="stat-tile-label">{label}</p>
      <p className="stat-tile-value" style={{ color: color ?? 'var(--color-text)', fontSize: 22 }}>{value}</p>
      {sub && <p className="stat-tile-sub">{sub}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════════════════════════
export function Reports() {
  const [activeTab,   setActiveTab]   = useState<TabId>('attendance')
  const [startDate,   setStartDate]   = useState(dateN(-30))
  const [endDate,     setEndDate]     = useState(dateN(0))
  const [selPeriodId, setSelPeriodId] = useState<string>('')

  const { data: attendance } = useData(() => apiGetAttendance({ startDate, endDate }), [startDate, endDate])
  const { data: periods }    = useData(() => apiGetPayrollPeriods(), [])
  const { data: employees }  = useData(() => apiGetEmployees(), [])
  const { data: advances }   = useData(() => apiGetAdvances(), [])

  // The selected payroll period for gov contrib tab
  const selectedPeriod: PayrollPeriod | undefined = useMemo(() => {
    const p = (periods ?? []).find(p => p.id === selPeriodId)
    return p ?? (periods ?? [])[0]
  }, [selPeriodId, periods])

  const { data: selEntries } = useData(
    () => selectedPeriod ? apiGetPayrollEntries(selectedPeriod.id) : Promise.resolve([]),
    [selectedPeriod?.id]
  )

  // ── Attendance aggregations ──────────────────────────────────────────────
  const att = (attendance ?? []).filter(a => a.status !== 'rest-day' && a.status !== 'holiday')

  const attByStatus = ['present','late','absent','on-leave','half-day'].map(s => ({
    name:  s === 'on-leave' ? 'On Leave' : s.replace('-',' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: att.filter(a => a.status === s).length,
  })).filter(x => x.value > 0)

  const deptMap: Record<string, Record<string, number>> = {}
  att.forEach(a => {
    const dept = (a as { department?: string }).department ?? 'Unknown'
    if (!deptMap[dept]) deptMap[dept] = { present: 0, late: 0, absent: 0 }
    if      (a.status === 'present') deptMap[dept].present++
    else if (a.status === 'late')    deptMap[dept].late++
    else if (a.status === 'absent')  deptMap[dept].absent++
  })
  const deptData = Object.entries(deptMap).map(([dept, s]) => ({
    dept: dept.length > 12 ? dept.slice(0, 10) + '…' : dept, ...s,
  }))

  const totalLateMinutes = att.reduce((s, a) => s + (a.minutesLate ?? 0), 0)
  const totalOtMinutes   = att.reduce((s, a) => s + (a.overtimeMinutes ?? 0), 0)
  const attPct = att.length > 0
    ? Math.round(att.filter(a => a.status === 'present' || a.status === 'late').length / att.length * 100)
    : 0

  // ── Payroll aggregations ──────────────────────────────────────────────────
  const payrollData = (periods ?? [])
    .filter(p => p.status !== 'draft')
    .slice(-8)
    .map(p => ({
      period:     p.periodNo.replace(/^PR-/i, ''),
      gross:      p.totalGross,
      net:        p.totalNet,
      deductions: p.totalDeductions,
    }))

  const totalNetAll   = (periods ?? []).reduce((s, p) => s + p.totalNet,   0)
  const totalGrossAll = (periods ?? []).reduce((s, p) => s + p.totalGross, 0)
  const paidRuns      = (periods ?? []).filter(p => p.status === 'paid').length

  // ── Gov contributions — REAL data from payroll entries ────────────────────
  const entries = selEntries ?? []

  const govSummary = {
    sssEE:  entries.reduce((s, e) => s + e.sssEmployee,       0),
    sssER:  entries.reduce((s, e) => s + e.sssEmployer,       0),
    phEE:   entries.reduce((s, e) => s + e.philhealthEmployee, 0),
    phER:   entries.reduce((s, e) => s + e.philhealthEmployer, 0),
    piEE:   entries.reduce((s, e) => s + e.pagibigEmployee,    0),
    piER:   entries.reduce((s, e) => s + e.pagibigEmployer,    0),
    tax:    entries.reduce((s, e) => s + e.withholdingTax,     0),
  }

  const govData = [
    { name: 'SSS',        ee: govSummary.sssEE, er: govSummary.sssER, total: govSummary.sssEE + govSummary.sssER },
    { name: 'PhilHealth', ee: govSummary.phEE,  er: govSummary.phER,  total: govSummary.phEE  + govSummary.phER  },
    { name: 'Pag-IBIG',   ee: govSummary.piEE,  er: govSummary.piER,  total: govSummary.piEE  + govSummary.piER  },
    { name: 'BIR (Tax)',  ee: govSummary.tax,   er: 0,                total: govSummary.tax                       },
  ]
  const totalGovt = govData.reduce((s, g) => s + g.total, 0)

  // ── Employee breakdowns ───────────────────────────────────────────────────
  const emps = employees ?? []
  const deptGroups = Object.entries(
    emps.reduce((map, e) => {
      const d = e.department ?? 'Unknown'
      map[d] = (map[d] ?? 0) + 1
      return map
    }, {} as Record<string, number>)
  ).map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count)

  const typeGroups = Object.entries(
    emps.reduce((map, e) => {
      const t = e.employmentType ?? 'unknown'
      map[t] = (map[t] ?? 0) + 1
      return map
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({ name: type, value: count }))

  // ── Advances summary ─────────────────────────────────────────────────────
  const advs       = advances ?? []
  const totalAdvAmount = advs.reduce((s, a) => s + a.amount, 0)
  const totalOutstanding = advs.reduce((s, a) => s + (a.outstanding ?? 0), 0)
  const advByStatus = (['pending','approved','released','fully_paid','rejected'] as const)
    .map(st => ({ name: st.replace('_',' '), value: advs.filter(a => a.status === st).length }))
    .filter(x => x.value > 0)

  // ── Export handlers ───────────────────────────────────────────────────────
  const handleExport = (format: 'excel' | 'csv') => {
    switch (activeTab) {
      case 'attendance':
        exportAttendanceReport(att, startDate, endDate, format)
        break
      case 'payroll':
        if (selectedPeriod && entries.length > 0) exportPayrollRun(selectedPeriod, entries, format)
        break
      case 'govcontrib':
        if (selectedPeriod && entries.length > 0) exportGovtContributions(selectedPeriod, entries, format)
        break
      case 'employees':
        exportEmployeeMasterlist(emps, format)
        break
      case 'advances':
        exportAdvanceReport(advs, format)
        break
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text)', lineHeight: 1 }}>
            Reports & Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Attendance patterns, payroll history, government contributions and workforce data
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            style={{ height: 34, fontSize: 12.5, gap: 5 }}
          >
            <Download style={{ width: 13, height: 13 }} />
            CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleExport('excel')}
            style={{ height: 34, fontSize: 12.5, gap: 5 }}
          >
            <FileSpreadsheet style={{ width: 13, height: 13 }} />
            Excel
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="card overflow-hidden">
        <div className="tab-bar px-2 pt-1" style={{ overflowX: 'auto' }}>
          {REPORT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon style={{ width: 13, height: 13, flexShrink: 0 }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Date range filter (attendance tab) ── */}
        {activeTab === 'attendance' && (
          <div
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Date Range
            </span>
            <input type="date" className="input-base" style={{ width: 142, height: 30, fontSize: 12 }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>to</span>
            <input type="date" className="input-base" style={{ width: 142, height: 30, fontSize: 12 }} value={endDate} onChange={e => setEndDate(e.target.value)} />
            <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginLeft: 4 }}>
              {att.length.toLocaleString()} record{att.length !== 1 ? 's' : ''} in range
            </span>
          </div>
        )}

        {/* ── Period selector (payroll / gov contrib tabs) ── */}
        {(activeTab === 'payroll' || activeTab === 'govcontrib') && (periods ?? []).length > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              padding: '10px 16px', borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Period
            </span>
            <select
              className="input-base"
              style={{ width: 240, height: 30, fontSize: 12 }}
              value={selPeriodId || selectedPeriod?.id || ''}
              onChange={e => setSelPeriodId(e.target.value)}
            >
              {(periods ?? []).filter(p => p.status !== 'draft').map(p => (
                <option key={p.id} value={p.id}>{p.periodNo} ({p.startDate} – {p.endDate})</option>
              ))}
            </select>
            {selectedPeriod && (
              <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                {entries.length} employee{entries.length !== 1 ? 's' : ''} · Status: <strong>{selectedPeriod.status}</strong>
              </span>
            )}
          </div>
        )}

        <div style={{ padding: 20 }}>

          {/* ════════════════ ATTENDANCE TAB ════════════════ */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* KPI strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Mini label="Total Records"    value={att.length.toLocaleString()}                                  />
                <Mini label="Attendance Rate"  value={`${attPct}%`}              color="var(--color-success)"      />
                <Mini label="Total Late Mins"  value={totalLateMinutes.toLocaleString()} sub="across all late records" color="var(--color-warning)" />
                <Mini label="Total OT Mins"    value={totalOtMinutes.toLocaleString()}   sub="approved overtime"       color="var(--color-primary)" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Pie */}
                <div className="card lg:col-span-2" style={{ padding: '16px 12px 8px' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingLeft: 4 }}>
                    Status Distribution
                  </h3>
                  {attByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={attByStatus} cx="50%" cy="46%" outerRadius={70} innerRadius={36} dataKey="value" paddingAngle={2}>
                          {attByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                      No records in selected range
                    </div>
                  )}
                </div>

                {/* Summary table */}
                <div className="card overflow-hidden lg:col-span-3">
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Summary by Status</p>
                  </div>
                  <table className="table-base">
                    <thead><tr><th>Status</th><th>Count</th><th>Percentage</th><th>Bar</th></tr></thead>
                    <tbody>
                      {attByStatus.map((s, i) => (
                        <tr key={s.name}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{s.value}</td>
                          <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                            {att.length > 0 ? ((s.value / att.length) * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td style={{ minWidth: 80 }}>
                            <div style={{ height: 5, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                              <div style={{ width: `${att.length > 0 ? (s.value / att.length) * 100 : 0}%`, height: '100%', background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 999 }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {att.length > 0 && (
                        <tr style={{ background: 'var(--color-surface-2)' }}>
                          <td style={{ fontWeight: 700, fontSize: 13 }}>Total</td>
                          <td style={{ fontWeight: 700, fontSize: 13, fontFamily: 'DM Mono, monospace' }}>{att.length}</td>
                          <td style={{ fontWeight: 700, fontSize: 12 }}>100%</td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dept bar chart */}
              {deptData.length > 0 && (
                <div className="card" style={{ padding: '16px 16px 8px' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                    Attendance by Department
                  </h3>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={deptData} margin={{ left: -16 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="dept" tick={{ fontSize: 10.5, fill: 'var(--color-text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="present" fill="#22c55e" name="Present" radius={[3,3,0,0]} />
                      <Bar dataKey="late"    fill="#f59e0b" name="Late"    radius={[3,3,0,0]} />
                      <Bar dataKey="absent"  fill="#ef4444" name="Absent"  radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ PAYROLL SUMMARY TAB ════════════════ */}
          {activeTab === 'payroll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Mini label="Total Periods"   value={(periods ?? []).length}                   />
                <Mini label="Paid Runs"       value={paidRuns}                                 color="var(--color-success)" />
                <Mini label="Total Gross"     value={formatPeso(totalGrossAll)}                color="var(--color-text)" />
                <Mini label="Total Net Paid"  value={formatPeso(totalNetAll)}                  color="var(--color-primary)" />
              </div>

              {payrollData.length > 0 ? (
                <>
                  {/* Gross vs Net area chart */}
                  <div className="card" style={{ padding: '16px 16px 8px' }}>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                      Gross vs Net Pay — Last 8 Closed Periods
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={payrollData} margin={{ left: 10, right: 4 }}>
                        <defs>
                          <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#5B5FC7" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#5B5FC7" stopOpacity={0.01} />
                          </linearGradient>
                          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: 'var(--color-text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatPeso(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="gross" stroke="#5B5FC7" strokeWidth={2} fill="url(#grossGrad)" name="Gross Pay" dot={false} activeDot={{ r: 4, fill: '#5B5FC7', stroke: '#fff', strokeWidth: 2 }} />
                        <Area type="monotone" dataKey="net"   stroke="#22c55e" strokeWidth={2} fill="url(#netGrad)"   name="Net Pay"   dot={false} activeDot={{ r: 4, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Period table */}
                  <div className="table-wrap">
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payroll Period Details</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table-base">
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th className="hidden md:table-cell">Date Range</th>
                            <th className="hidden lg:table-cell">Pay Date</th>
                            <th className="hidden md:table-cell">Employees</th>
                            <th>Gross Pay</th>
                            <th className="hidden lg:table-cell">Deductions</th>
                            <th>Net Pay</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(periods ?? []).map(p => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>{p.periodNo}</td>
                              <td className="hidden md:table-cell" style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'DM Mono, monospace' }}>{p.startDate} – {p.endDate}</td>
                              <td className="hidden lg:table-cell" style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'DM Mono, monospace' }}>{p.payDate}</td>
                              <td className="hidden md:table-cell" style={{ fontSize: 13, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{p.totalEmployees}</td>
                              <td style={{ fontSize: 13, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{formatPeso(p.totalGross)}</td>
                              <td className="hidden lg:table-cell" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)', fontFamily: 'DM Mono, monospace' }}>{formatPeso(p.totalDeductions)}</td>
                              <td style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'DM Mono, monospace' }}>{formatPeso(p.totalNet)}</td>
                              <td>
                                <span className={
                                  p.status === 'paid'     ? 'pill pill-green'  :
                                  p.status === 'approved' ? 'pill pill-indigo' :
                                  p.status === 'reviewed' ? 'pill pill-blue'   : 'pill pill-gray'
                                }>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
                  No finalized payroll runs yet
                </div>
              )}
            </div>
          )}

          {/* ════════════════ GOV CONTRIBUTIONS TAB ════════════════ */}
          {activeTab === 'govcontrib' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Mini label="SSS (EE+ER)"     value={formatPeso(govSummary.sssEE + govSummary.sssER)} color="var(--color-primary)" />
                <Mini label="PhilHealth"       value={formatPeso(govSummary.phEE  + govSummary.phER)}  color="#16A34A" />
                <Mini label="Pag-IBIG"         value={formatPeso(govSummary.piEE  + govSummary.piER)}  color="#D97706" />
                <Mini label="Total Remittance" value={formatPeso(totalGovt)}                            color="var(--color-text)" />
              </div>

              {selectedPeriod && entries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Bar chart */}
                  <div className="card" style={{ padding: '16px 12px 8px' }}>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                      Contributions — {selectedPeriod?.periodNo}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={govData.filter(g => g.name !== 'BIR (Tax)')} margin={{ left: 10 }} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatPeso(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="ee" fill="#5B5FC7" name="Employee Share" radius={[3,3,0,0]} />
                        <Bar dataKey="er" fill="#22c55e" name="Employer Share" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Breakdown table */}
                  <div className="card overflow-hidden">
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Remittance Breakdown</p>
                    </div>
                    <table className="table-base">
                      <thead><tr><th>Fund</th><th>EE Share</th><th>ER Share</th><th>Total</th></tr></thead>
                      <tbody>
                        {govData.map(g => (
                          <tr key={g.name}>
                            <td style={{ fontWeight: 700, fontSize: 13 }}>{g.name}</td>
                            <td style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--color-text-secondary)' }}>{formatPeso(g.ee)}</td>
                            <td style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--color-text-secondary)' }}>{g.name === 'BIR (Tax)' ? '—' : formatPeso(g.er)}</td>
                            <td style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{formatPeso(g.total)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--color-surface-2)', borderTop: '2px solid var(--color-border-strong)' }}>
                          <td style={{ fontWeight: 800, fontSize: 13 }}>TOTAL</td>
                          <td style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
                            {formatPeso(govSummary.sssEE + govSummary.phEE + govSummary.piEE + govSummary.tax)}
                          </td>
                          <td style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', fontSize: 13 }}>
                            {formatPeso(govSummary.sssER + govSummary.phER + govSummary.piER)}
                          </td>
                          <td style={{ fontWeight: 800, fontFamily: 'DM Mono, monospace', color: 'var(--color-primary)', fontSize: 14 }}>
                            {formatPeso(totalGovt)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
                  {(periods ?? []).length === 0 ? 'No finalized payroll runs available' : 'Loading contribution data…'}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ EMPLOYEE MASTERLIST TAB ════════════════ */}
          {activeTab === 'employees' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Mini label="Total Employees"  value={emps.length}                                                          />
                <Mini label="Active"           value={emps.filter(e => e.status === 'active').length}   color="var(--color-success)" />
                <Mini label="Inactive"         value={emps.filter(e => e.status !== 'active').length}   color="var(--color-danger)"  />
                <Mini label="Departments"      value={deptGroups.length}                                color="var(--color-primary)" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* By department */}
                <div className="card" style={{ padding: '16px 12px 8px' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                    Headcount by Department
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptGroups} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="dept" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="#5B5FC7" name="Employees" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* By employment type */}
                <div className="card" style={{ padding: '16px 12px 8px' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                    Employment Type Mix
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={typeGroups} cx="50%" cy="46%" outerRadius={72} innerRadius={36} dataKey="value" paddingAngle={2}>
                        {typeGroups.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11, textTransform: 'capitalize' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Masterlist table */}
              <div className="table-wrap">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Employee Directory ({emps.length})
                  </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Employee No</th>
                        <th>Name</th>
                        <th className="hidden md:table-cell">Department</th>
                        <th className="hidden lg:table-cell">Designation</th>
                        <th className="hidden md:table-cell">Type</th>
                        <th>Status</th>
                        <th className="hidden xl:table-cell">Hire Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emps.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600 }}>{e.employeeNo}</td>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{e.fullName}</td>
                          <td className="hidden md:table-cell" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{e.department ?? '—'}</td>
                          <td className="hidden lg:table-cell" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{e.position}</td>
                          <td className="hidden md:table-cell">
                            <span className="pill pill-blue" style={{ textTransform: 'capitalize' }}>{e.employmentType ?? '—'}</span>
                          </td>
                          <td>
                            <span className={e.status === 'active' ? 'pill pill-green' : 'pill pill-red'} style={{ textTransform: 'capitalize' }}>
                              {e.status}
                            </span>
                          </td>
                          <td className="hidden xl:table-cell" style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                            {e.hireDate ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ SALARY ADVANCES TAB ════════════════ */}
          {activeTab === 'advances' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Mini label="Total Advances"    value={advs.length}                                                                    />
                <Mini label="Total Disbursed"   value={formatPeso(totalAdvAmount)}                  color="var(--color-primary)"       />
                <Mini label="Outstanding"       value={formatPeso(totalOutstanding)}                color="var(--color-danger)"        />
                <Mini label="Recovered"         value={formatPeso(totalAdvAmount - totalOutstanding)} color="var(--color-success)"    />
              </div>

              {/* Status pie + distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card" style={{ padding: '16px 12px 8px' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                    Advances by Status
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={advByStatus} cx="50%" cy="46%" outerRadius={66} innerRadius={30} dataKey="value" paddingAngle={2}>
                        {advByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11, textTransform: 'capitalize' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Recovery progress */}
                <div className="card" style={{ padding: '16px 18px' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                    Recovery Summary
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: 'Total Disbursed',   value: totalAdvAmount,                   color: 'var(--color-primary)' },
                      { label: 'Total Repaid',       value: totalAdvAmount - totalOutstanding, color: 'var(--color-success)' },
                      { label: 'Still Outstanding',  value: totalOutstanding,                 color: 'var(--color-danger)' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'DM Mono, monospace' }}>{formatPeso(value)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                          <div style={{ width: `${totalAdvAmount > 0 ? (value / totalAdvAmount) * 100 : 0}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advances table */}
              <div className="table-wrap">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Advance Register ({advs.length})
                  </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th className="hidden md:table-cell">Requested</th>
                        <th>Amount</th>
                        <th>Repaid</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advs.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{a.employeeName ?? '—'}</td>
                          <td className="hidden md:table-cell" style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                            {new Date(a.requestedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{formatPeso(a.amount)}</td>
                          <td style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--color-success)' }}>{formatPeso(a.totalRepaid ?? 0)}</td>
                          <td style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: a.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                            {formatPeso(a.outstanding ?? 0)}
                          </td>
                          <td>
                            <span className={
                              a.status === 'fully_paid' ? 'pill pill-green'  :
                              a.status === 'released'   ? 'pill pill-blue'   :
                              a.status === 'approved'   ? 'pill pill-indigo' :
                              a.status === 'pending'    ? 'pill pill-yellow' :
                              a.status === 'rejected'   ? 'pill pill-red'    : 'pill pill-gray'
                            } style={{ textTransform: 'capitalize' }}>
                              {a.status.replace('_',' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {advs.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)', fontSize: 14 }}>
                            No salary advance records
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
