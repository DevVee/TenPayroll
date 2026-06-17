import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Clock, Umbrella, Timer, Banknote,
  ChevronRight, RefreshCw, TrendingUp, CheckCircle2,
  AlertCircle, UserX, Banknote as BanknoteIcon,
  CheckCircle, XCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  apiGetEmployees, apiGetTodayAttendance, apiGetAttendanceHistory,
  apiGetPayrollPeriods, apiGetLeaves, apiGetOvertime, apiGetAdvances,
  apiUpdateLeaveStatus, apiUpdateOvertimeStatus, apiGetAttendanceExceptions,
} from '../../lib/db'
import { useAuthStore } from '../../store/authStore'
import { usePermission } from '../../lib/permissions'
import { avatarColor } from '../../lib/utils/format'
import type { Employee, AttendanceRecord, PayrollPeriod, LeaveRequest, OvertimeRequest } from '../../types'

// ── Attendance status config ────────────────────────────────────────────────
const ATT_STATUS: Record<string, { pill: string; label: string }> = {
  present:    { pill: 'pill pill-green',   label: 'Present'  },
  late:       { pill: 'pill pill-yellow',  label: 'Late'     },
  absent:     { pill: 'pill pill-red',     label: 'Absent'   },
  'on-leave': { pill: 'pill pill-indigo',  label: 'On Leave' },
  'half-day': { pill: 'pill pill-orange',  label: 'Half-Day' },
  'rest-day': { pill: 'pill pill-gray',    label: 'Rest Day' },
  holiday:    { pill: 'pill pill-blue',    label: 'Holiday'  },
}

// ── Inline stat card ────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, accent, onClick,
}: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; accent?: string; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className="stat-tile text-left w-full"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        background: accent
          ? `linear-gradient(to bottom right, #ffffff 15%, ${accent}0D 55%, ${accent}1A 100%)`
          : 'linear-gradient(to bottom right, #ffffff 15%, #ECEEFF 55%, #E4E6FF 100%)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="stat-tile-label">{label}</span>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: accent ? `${accent}14` : 'var(--color-primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon style={{ width: 16, height: 16, color: accent ?? 'var(--color-primary)' }} />
        </div>
      </div>
      <div className="stat-tile-value">{value}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </Tag>
  )
}

// ── Attendance breakdown row ────────────────────────────────────────────────
function AttRow({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{count}</span>
      <div style={{ width: 60, height: 4, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}

// ── Quick link ──────────────────────────────────────────────────────────────
function QuickLink({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', width: '100%', textAlign: 'left', transition: 'background 0.12s',
        color: 'var(--color-text-secondary)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-light)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--color-primary)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'
      }}
    >
      <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em' }}>{label}</span>
      <ChevronRight style={{ width: 13, height: 13, marginLeft: 'auto', opacity: 0.5, flexShrink: 0 }} />
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
export function Dashboard() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const canApprove = usePermission('leave_approve')

  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayAtt,  setTodayAtt]  = useState<AttendanceRecord[]>([])
  const [periods,   setPeriods]   = useState<PayrollPeriod[]>([])
  const [leaves,    setLeaves]    = useState<LeaveRequest[]>([])
  const [otReqs,    setOtReqs]    = useState<OvertimeRequest[]>([])
  const [attHistory, setAttHistory] = useState<{ date: string; pct: number }[]>([])
  const [pendingAdv,       setPendingAdv]       = useState(0)
  const [missingTimeouts,  setMissingTimeouts]  = useState(0)
  const [loading,          setLoading]          = useState(true)
  const [approving,        setApproving]        = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      apiGetEmployees({ status: 'active' }),
      apiGetTodayAttendance(),
      apiGetPayrollPeriods(),
      apiGetLeaves({ status: 'pending' }),
      apiGetOvertime({ status: 'pending' }),
      apiGetAttendanceHistory(7),
      apiGetAdvances({ status: 'pending' }).then(a => a.length).catch(() => 0),
      apiGetAttendanceExceptions({ daysBack: 7 }).then(ex => ex.length).catch(() => 0),
    ]).then(([emps, att, pds, lv, ot, hist, advCount, exceptCount]) => {
      setEmployees(emps)
      setTodayAtt(att)
      setPeriods(pds)
      setLeaves(lv)
      setOtReqs(ot)
      setAttHistory(hist.map(h => ({
        date: new Date(h.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }),
        pct:  h.pct,
      })))
      setPendingAdv(advCount as number)
      setMissingTimeouts(exceptCount as number)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── Quick approve/reject leave ──────────────────────────────────────────
  const handleLeaveAction = async (id: string, action: 'approved' | 'rejected') => {
    if (approving) return
    setApproving(id)
    try {
      await apiUpdateLeaveStatus(id, action, user?.name)
      setLeaves(prev => prev.filter(l => l.id !== id))
    } finally {
      setApproving(null)
    }
  }
  const handleOtAction = async (id: string, action: 'approved' | 'rejected') => {
    if (approving) return
    setApproving(id)
    try {
      await apiUpdateOvertimeStatus(id, action, user?.name)
      setOtReqs(prev => prev.filter(o => o.id !== id))
    } finally {
      setApproving(null)
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const today     = new Date()
  const dateStr   = today.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const working    = todayAtt.filter(a => a.status !== 'rest-day' && a.status !== 'holiday')
  const present    = working.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half-day').length
  const late       = working.filter(a => a.status === 'late').length
  const absent     = working.filter(a => a.status === 'absent').length
  const onLeave    = working.filter(a => a.status === 'on-leave').length
  const attPct     = working.length > 0 ? Math.round((present / working.length) * 100) : 0

  const lastPeriod      = periods[0]
  const pendingPayrolls = periods.filter(p => p.status === 'draft' || p.status === 'reviewed').length
  const deptCount       = new Set(employees.map(e => e.department).filter(Boolean)).size
  const totalPending    = leaves.length + otReqs.length + pendingAdv

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 320 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
        style={{
          background: 'linear-gradient(135deg, #141760 0%, #2B2EA8 55%, #5355C6 100%)',
          borderRadius: 20, padding: '32px 36px', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* dot grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.15,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)',
          backgroundSize: '24px 24px', pointerEvents: 'none',
        }} />
        {/* glow blob top-right */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 300, height: 300,
          borderRadius: '50%', background: 'rgba(255,255,255,0.10)', filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        {/* glow blob bottom-left */}
        <div style={{
          position: 'absolute', bottom: -60, left: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'rgba(120,124,240,0.25)', filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(210,212,255,0.70)', letterSpacing: '-0.01em', marginBottom: 6 }}>{dateStr}</p>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 8 }}>
              {greeting}, {firstName}
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(210,212,255,0.60)', letterSpacing: '-0.01em' }}>
              {deptCount} department{deptCount !== 1 ? 's' : ''} · {employees.length} active employee{employees.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {totalPending > 0 && (
              <button
                onClick={() => navigate('/leaves')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: 'rgba(212,160,23,0.18)', border: '1px solid rgba(212,160,23,0.35)',
                  borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: '#FBBF24', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '-0.01em',
                }}
              >
                <AlertCircle style={{ width: 13, height: 13 }} />
                {totalPending} pending approval{totalPending !== 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={load}
              title="Refresh"
              style={{
                width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(165,168,240,0.7)', cursor: 'pointer',
              }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Row ── */}
      <motion.div
        className="grid grid-cols-2 xl:grid-cols-5 gap-4"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.06 }}
      >
        <StatCard icon={Users}        label="Active Employees"  value={employees.length}         sub={`${deptCount} departments`}                          accent="#9B87F5" onClick={() => navigate('/employees')} />
        <StatCard icon={CheckCircle2} label="Present Today"     value={`${present} / ${working.length}`} sub={`${attPct}% rate${late > 0 ? ` · ${late} late` : ''}`} accent="#34D399" onClick={() => navigate('/attendance')} />
        <StatCard icon={Umbrella}     label="Pending Leaves"    value={leaves.length}            sub={`${otReqs.length} overtime pending`}                 accent="#FBBF24" onClick={() => navigate('/leaves')} />
        <StatCard icon={Banknote}     label="Payroll Runs"      value={pendingPayrolls}          sub={lastPeriod ? `Last: ${lastPeriod.startDate}` : 'No runs yet'} accent="#818CF8" onClick={() => navigate('/payroll')} />
        <StatCard icon={BanknoteIcon} label="Advance Requests"  value={pendingAdv}               sub="Awaiting approval"                                   accent="#FC8181" onClick={() => navigate('/advances')} />
      </motion.div>

      {/* ── Missing time-out alert ── */}
      {missingTimeouts > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{
            background: '#FFF7ED',
            border: '1px solid #FCD34D',
            borderLeft: '4px solid #D97706',
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle style={{ width: 15, height: 15, color: '#D97706', flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
              {missingTimeouts} employee{missingTimeouts !== 1 ? 's' : ''} missing time-out in the last 7 days
            </p>
          </div>
          <button
            onClick={() => navigate('/attendance/log')}
            style={{
              fontSize: 12, fontWeight: 700, color: '#D97706', background: 'none',
              border: '1px solid #D97706', borderRadius: 7, padding: '4px 12px',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}
          >
            Review Attendance →
          </button>
        </motion.div>
      )}

      {/* ── Middle grid: chart + breakdown ── */}
      <motion.div
        className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-5"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.1 }}
      >
        {/* Attendance trend chart — REAL DATA from DB */}
        <div className="card" style={{ padding: '24px 24px 16px' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>Attendance Rate</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>7-day overview — % employees present</p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              background: 'var(--color-success-bg)', borderRadius: 999, fontSize: 12, fontWeight: 700,
              color: 'var(--color-success)', border: '1px solid #BBF7D0',
            }}>
              <TrendingUp style={{ width: 12, height: 12 }} />
              {attPct}% today
            </div>
          </div>
          {attHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={attHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#5B5FC7" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#5B5FC7" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'Plus Jakarta Sans' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#1B1D2E', border: 'none', borderRadius: 10, fontSize: 12, color: '#fff', fontFamily: 'Plus Jakarta Sans', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', padding: '8px 14px' }}
                  formatter={(v: number) => [`${v}%`, 'Present']}
                  labelStyle={{ color: 'rgba(165,168,240,0.7)', marginBottom: 4 }}
                  cursor={{ stroke: '#5B5FC7', strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Area type="monotone" dataKey="pct" stroke="#5B5FC7" strokeWidth={2.5} fill="url(#attGrad)" dot={false} activeDot={{ r: 4, fill: '#5B5FC7', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--color-text-muted)', fontSize: 13 }}>
              No attendance data for the past 7 days
            </div>
          )}
        </div>

        {/* Today's breakdown */}
        <div className="card flex flex-col gap-5">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>Today's Breakdown</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {today.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {working.length} scheduled
            </p>
          </div>
          {/* Progress bar */}
          <div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--color-surface-2)', overflow: 'hidden', display: 'flex' }}>
              {present > 0 && <div style={{ width: `${Math.round((present / Math.max(working.length, 1)) * 100)}%`, background: 'var(--color-success)' }} />}
              {absent  > 0 && <div style={{ width: `${Math.round((absent  / Math.max(working.length, 1)) * 100)}%`, background: 'var(--color-danger)'  }} />}
              {onLeave > 0 && <div style={{ width: `${Math.round((onLeave / Math.max(working.length, 1)) * 100)}%`, background: 'var(--color-primary)' }} />}
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, letterSpacing: '-0.01em' }}>Present · Absent · On Leave</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AttRow color="var(--color-success)" label="Present"  count={present - late} total={working.length} />
            <AttRow color="var(--color-warning)" label="Late"     count={late}           total={working.length} />
            <AttRow color="var(--color-danger)"  label="Absent"   count={absent}         total={working.length} />
            <AttRow color="var(--color-primary)" label="On Leave" count={onLeave}        total={working.length} />
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QuickLink icon={Clock}  label="View today's attendance"  onClick={() => navigate('/attendance')} />
            <QuickLink icon={Timer}  label="Review overtime requests"  onClick={() => navigate('/overtime')} />
            <QuickLink icon={Banknote} label="Process payroll run"     onClick={() => navigate('/payroll')} />
          </div>
        </div>
      </motion.div>

      {/* ── Pending Approvals panel ── */}
      {canApprove && (leaves.length > 0 || otReqs.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.14 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>Pending Approvals</h3>
            <span className="pill pill-yellow">{leaves.length + otReqs.length} pending</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaves.slice(0, 5).map(lv => (
              <div key={lv.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10, background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}>
                <Umbrella style={{ width: 14, height: 14, color: 'var(--color-primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lv.employeeName}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {lv.leaveType.charAt(0).toUpperCase() + lv.leaveType.slice(1)} leave · {lv.startDate}{lv.endDate !== lv.startDate ? ` – ${lv.endDate}` : ''} · {lv.days}d
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleLeaveAction(lv.id, 'approved')}
                    disabled={!!approving}
                    className="flex items-center gap-1"
                    style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-success-bg)', border: '1px solid #A7F3D0', fontSize: 11, fontWeight: 600, color: 'var(--color-success)', cursor: 'pointer', opacity: approving === lv.id ? 0.5 : 1 }}
                  >
                    <CheckCircle style={{ width: 10, height: 10 }} /> Approve
                  </button>
                  <button
                    onClick={() => handleLeaveAction(lv.id, 'rejected')}
                    disabled={!!approving}
                    className="flex items-center gap-1"
                    style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer', opacity: approving === lv.id ? 0.5 : 1 }}
                  >
                    <XCircle style={{ width: 10, height: 10 }} /> Reject
                  </button>
                </div>
              </div>
            ))}
            {otReqs.slice(0, 5).map(ot => (
              <div key={ot.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10, background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}>
                <Timer style={{ width: 14, height: 14, color: 'var(--color-warning)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ot.employeeName}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Overtime · {ot.date} · {ot.hoursRequested}h
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleOtAction(ot.id, 'approved')}
                    disabled={!!approving}
                    className="flex items-center gap-1"
                    style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-success-bg)', border: '1px solid #A7F3D0', fontSize: 11, fontWeight: 600, color: 'var(--color-success)', cursor: 'pointer', opacity: approving === ot.id ? 0.5 : 1 }}
                  >
                    <CheckCircle style={{ width: 10, height: 10 }} /> Approve
                  </button>
                  <button
                    onClick={() => handleOtAction(ot.id, 'rejected')}
                    disabled={!!approving}
                    className="flex items-center gap-1"
                    style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer', opacity: approving === ot.id ? 0.5 : 1 }}
                  >
                    <XCircle style={{ width: 10, height: 10 }} /> Reject
                  </button>
                </div>
              </div>
            ))}
            {(leaves.length + otReqs.length) > 10 && (
              <button onClick={() => navigate('/leaves')} className="btn btn-ghost btn-sm">
                View all {leaves.length + otReqs.length} pending approvals
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Today's attendance table ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.18 }}
        className="table-wrap"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Today's Attendance</h3>
            <span className="pill pill-indigo">{today.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
          </div>
          <button
            onClick={() => navigate('/attendance/log')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            View all <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="hidden sm:table-cell">Department</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {working.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)' }}>
                    <UserX style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
                    <p style={{ fontWeight: 600, fontSize: 14 }}>No attendance records yet</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>Records will appear once employees check in</p>
                  </td>
                </tr>
              )}
              {working.slice(0, 15).map(a => {
                const emp    = employees.find(e => e.id === a.employeeId)
                const sc     = ATT_STATUS[a.status] ?? ATT_STATUS['rest-day']
                const initials = a.employeeName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                const aColor = avatarColor(a.employeeId ?? a.id)
                const fmt    = (t?: string) => t
                  ? new Date(t).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
                  : '—'
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm avatar-round" style={{ background: aColor, flexShrink: 0 }}>{initials}</div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.015em', lineHeight: 1, color: 'var(--color-text)' }}>{a.employeeName}</p>
                          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{a.employeeNo ?? emp?.employeeNo ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{emp?.department ?? '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: a.timeIn ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{fmt(a.timeIn)}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: a.timeOut ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{fmt(a.timeOut)}</span>
                    </td>
                    <td><span className={sc.pill}>{sc.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {working.length > 15 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
            <button onClick={() => navigate('/attendance')} className="btn btn-ghost btn-sm">
              Show {working.length - 15} more employees
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
