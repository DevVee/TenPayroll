import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Monitor, Filter, CheckCircle, AlertTriangle, XCircle, Umbrella, Plus } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useData } from '../../hooks/useData'
import { apiGetTodayAttendance, apiGetEmployees, apiAddManualAttendance } from '../../lib/db'
import { useAuthStore } from '../../store/authStore'
import { formatMinutes } from '../../lib/utils/format'
import type { AttendanceStatus } from '../../types'

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', hour12:true })
}

const TODAY = new Date().toISOString().split('T')[0]

const BLANK_FORM = {
  employeeId: '', date: TODAY, status: 'present' as AttendanceStatus,
  timeIn: '', timeOut: '', reason: '',
}

const STAT_CARDS = [
  { key: 'present', label: 'Present',  iconColor: 'var(--color-success)', bg: 'var(--color-success-bg)', border: '#A7F3D0', icon: CheckCircle },
  { key: 'late',    label: 'Late',     iconColor: 'var(--color-warning)', bg: 'var(--color-warning-bg)', border: '#FDE68A', icon: AlertTriangle },
  { key: 'absent',  label: 'Absent',   iconColor: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  border: '#FECACA', icon: XCircle },
  { key: 'on-leave',label: 'On Leave', iconColor: 'var(--color-primary)', bg: 'var(--color-primary-light)', border: 'var(--color-primary-medium)', icon: Umbrella },
]

export function AttendanceToday() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  // Manual entry modal
  const [manualOpen, setManualOpen] = useState(false)
  const [form,       setForm]       = useState(BLANK_FORM)
  const [saving,     setSaving]     = useState(false)

  const { data: todayAtt, refetch } = useData(() => apiGetTodayAttendance(), [])
  const { data: employees }         = useData(() => apiGetEmployees({ status: 'active' }), [])

  const att        = (todayAtt  ?? []).filter(a => a.status !== 'rest-day')
  const employees_ = employees ?? []

  const present  = att.filter(a => a.status === 'present' || a.status === 'late').length
  const late     = att.filter(a => a.status === 'late').length
  const absent   = att.filter(a => a.status === 'absent').length
  const onLeave  = att.filter(a => a.status === 'on-leave').length
  const notScanned = employees_.filter(e => !att.find(a => a.employeeId === e.id))

  const COUNTS: Record<string, number> = {
    present, late, absent, 'on-leave': onLeave,
  }

  const filtered = att.filter(a => {
    const matchSearch = !search || a.employeeName.toLowerCase().includes(search.toLowerCase()) || a.employeeNo.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || a.status === filter
    return matchSearch && matchFilter
  })

  const today = new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  const needsTime = form.status === 'present' || form.status === 'late' || form.status === 'half-day'

  const saveManual = async () => {
    if (!form.employeeId || !form.date || !form.reason.trim()) return
    setSaving(true)
    try {
      await apiAddManualAttendance({
        employeeId: form.employeeId,
        date:       form.date,
        status:     form.status,
        timeIn:     form.timeIn  ? `${form.date}T${form.timeIn}:00` : undefined,
        timeOut:    form.timeOut ? `${form.date}T${form.timeOut}:00` : undefined,
        reason:     form.reason,
      }, user?.name)
      setManualOpen(false)
      setForm(BLANK_FORM)
      refetch()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Today's Attendance"
        subtitle={today}
        actions={[
          { label: 'Manual Entry', icon: Plus,    variant: 'secondary', onClick: () => setManualOpen(true) },
          { label: 'Open Kiosk',   icon: Monitor, onClick: () => navigate('/kiosk') },
          { label: 'Full Log',     variant: 'secondary', onClick: () => navigate('/attendance/log') },
        ]}
      />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map(card => {
          const isActive = filter === card.key
          const Icon = card.icon
          const value = COUNTS[card.key] ?? 0
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setFilter(isActive ? 'all' : card.key)}
              className="card text-left w-full transition-all duration-150"
              style={{
                padding: '14px 16px',
                borderColor: isActive ? card.border : 'var(--color-border)',
                background:  isActive ? card.bg : 'var(--color-surface)',
                boxShadow:   isActive ? `0 0 0 3px ${card.border}88` : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {card.label}
                </p>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${card.iconColor}1A`,
                  }}
                >
                  <Icon style={{ width: 14, height: 14, color: card.iconColor }} />
                </div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: card.iconColor, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {value}
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {card.key === 'present' && (late > 0 ? `${late} arrived late` : 'All on time')}
                {card.key === 'late'    && (late > 0 ? 'Arrived after shift start' : 'None late today')}
                {card.key === 'absent'  && (absent > 0 ? 'No time-in recorded' : 'All accounted for')}
                {card.key === 'on-leave'&& (onLeave > 0 ? 'Approved leave' : 'No leaves today')}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── Not yet scanned ── */}
      {notScanned.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span
              className="flex items-center justify-center text-white font-bold"
              style={{ width: 18, height: 18, borderRadius: 9999, background: 'var(--color-text-muted)', fontSize: 9 }}
            >
              {notScanned.length}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-muted)' }}>Not Yet Scanned</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {notScanned.map(e => (
              <span
                key={e.id}
                style={{
                  fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)',
                  padding: '3px 10px', background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)', borderRadius: 9999,
                }}
              >
                {e.fullName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 px-3 py-2.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee name or ID…"
            className="flex-1"
          />

          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {(['all', 'present', 'late', 'absent', 'on-leave', 'half-day'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="filter-pill"
                style={filter === f ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: 'var(--color-primary-medium)', fontWeight: 600 } : {}}
              >
                {f === 'all' ? 'All' : f === 'on-leave' ? 'On Leave' : f === 'half-day' ? 'Half Day' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th className="hidden md:table-cell">Hours</th>
                <th className="hidden md:table-cell">Late</th>
                <th className="hidden lg:table-cell">OT</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const hours = a.timeIn && a.timeOut
                  ? ((new Date(a.timeOut).getTime() - new Date(a.timeIn).getTime()) / 3600000).toFixed(1)
                  : null

                return (
                  <tr key={a.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {a.source === 'manual' && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-medium)', borderRadius: 4, padding: '1px 5px' }}>
                            MANUAL
                          </span>
                        )}
                        <div>
                          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1 }}>{a.employeeName}</p>
                          <p style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{a.employeeNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {a.timeIn ? fmt(a.timeIn) : <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                    </td>
                    <td className="tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {a.timeOut ? fmt(a.timeOut) : <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                    </td>
                    <td className="hidden md:table-cell tabular-nums" style={{ fontSize: 12, color: hours ? 'var(--color-text-muted)' : 'var(--color-border-strong)' }}>
                      {hours ? `${hours}h` : '—'}
                    </td>
                    <td className="hidden md:table-cell tabular-nums">
                      {a.minutesLate > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning)' }}>{formatMinutes(a.minutesLate)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--color-border-strong)' }}>—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell tabular-nums">
                      {a.overtimeMinutes > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>{formatMinutes(a.overtimeMinutes)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--color-border-strong)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge type="attendance" status={a.status}>
                        {a.status === 'on-leave' ? 'On Leave' : a.status === 'half-day' ? 'Half Day' : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </StatusBadge>
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Clock style={{ width: 32, height: 32, color: 'var(--color-border)', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No records match your filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
        >
          <div className="flex items-center gap-1.5">
            <Filter style={{ width: 11, height: 11, color: 'var(--color-border-strong)' }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {filtered.length} of {att.length} records
            </span>
          </div>
          <button
            onClick={() => navigate('/kiosk')}
            style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}
            className="hover:underline"
          >
            Open Kiosk →
          </button>
        </div>
      </div>

      {/* ── Manual Entry Modal ── */}
      <Modal
        open={manualOpen}
        onClose={() => { setManualOpen(false); setForm(BLANK_FORM) }}
        title="Manual Attendance Entry"
        footer={
          <>
            <button onClick={() => { setManualOpen(false); setForm(BLANK_FORM) }} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={saveManual}
              disabled={saving || !form.employeeId || !form.date || !form.reason.trim()}
              className="btn btn-primary"
            >
              {saving ? 'Saving…' : 'Save Entry'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            className="px-3 py-2.5"
            style={{ background: 'var(--color-warning-bg)', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: 'var(--color-warning)' }}
          >
            Use this for employees who were present but forgot to scan the RFID kiosk. This entry will be marked as manually added in the audit log.
          </div>

          <div>
            <label className="form-label">Employee <span className="text-red-500">*</span></label>
            <select
              className="input-base"
              value={form.employeeId}
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">— Select employee —</option>
              {employees_.map(e => (
                <option key={e.id} value={e.id}>{e.fullName} ({e.employeeNo})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="input-base"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Status <span className="text-red-500">*</span></label>
              <select
                className="input-base"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as AttendanceStatus }))}
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>

          {needsTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Time In</label>
                <input
                  type="time"
                  className="input-base"
                  value={form.timeIn}
                  onChange={e => setForm(f => ({ ...f, timeIn: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">
                  Time Out <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="time"
                  className="input-base"
                  value={form.timeOut}
                  onChange={e => setForm(f => ({ ...f, timeOut: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Admin Note / Reason <span className="text-red-500">*</span></label>
            <textarea
              className="input-base"
              style={{ height: 72, resize: 'none', paddingTop: 8, paddingBottom: 8 }}
              placeholder="e.g. Employee was present but forgot to scan RFID badge"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
