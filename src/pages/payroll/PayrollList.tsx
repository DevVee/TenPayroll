import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Banknote, ChevronRight, AlertCircle,
  CheckCircle, Clock, DollarSign, TrendingUp, Gift, Trash2, Send,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import { useData } from '../../hooks/useData'
import { apiGetPayrollPeriods, apiCreatePayrollPeriod, apiGenerate13thMonth, apiDeletePayrollPeriod, apiGetAttendanceExceptions, apiBatchUpdatePayrollStatus } from '../../lib/db'
import { BatchActionBar } from '../../components/ui/BatchActionBar'
import type { AttendanceException } from '../../lib/_db/attendance'
import { formatPeso } from '../../lib/payrollEngine'
import { usePermission } from '../../lib/permissions'

const STATUS_CFG: Record<string, { label: string; step: number }> = {
  draft:    { label: 'Draft',        step: 1 },
  reviewed: { label: 'For Approval', step: 2 },
  approved: { label: 'Approved',     step: 3 },
  paid:     { label: 'Paid',         step: 4 },
}

const WORKFLOW_STEPS = [
  { step: 1, label: 'Draft',        icon: Clock,        color: '#94A3B8', activeColor: '#5B5FC7' },
  { step: 2, label: 'For Approval', icon: AlertCircle,  color: '#94A3B8', activeColor: '#D97706' },
  { step: 3, label: 'Approved',     icon: CheckCircle,  color: '#94A3B8', activeColor: '#16A34A' },
  { step: 4, label: 'Paid',         icon: DollarSign,   color: '#94A3B8', activeColor: '#5B5FC7' },
]

function dateN(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
function fmtDateRange(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  const sm = s.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  const em = e.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sm} – ${em}`
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const FREQ_DAYS: Record<string, number> = { weekly: 6, 'bi-monthly': 14, monthly: 29 }

export function PayrollList() {
  const navigate       = useNavigate()
  const addToast       = useUIStore(s => s.addToast)
  const canGenerate    = usePermission('pay_generate')
  const canDeletePay   = usePermission('pay_delete')
  const canApprove     = usePermission('pay_approve')
  const { data: periods, loading, refetch } = useData(() => apiGetPayrollPeriods(), [])
  const [modal,      setModal]      = useState(false)

  // ── Batch selection ───────────────────────────────────────────────────────
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [batchSaving, setBatchSaving] = useState(false)

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleSelectAll = (ids: string[], checked: boolean) =>
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => checked ? s.add(id) : s.delete(id)); return s })
  const [form,       setForm]       = useState({
    startDate: dateN(-7),
    endDate:   dateN(0),
    payDate:   dateN(3),
    frequency: 'weekly' as 'weekly' | 'bi-monthly' | 'monthly',
  })
  const [generating,       setGenerating]       = useState(false)
  const [generating13th,   setGenerating13th]   = useState(false)
  const [search,           setSearch]           = useState('')
  const [deleting,         setDeleting]         = useState<string | null>(null)
  // Attendance-exception warning shown before payroll generation
  const [attExceptions,    setAttExceptions]    = useState<AttendanceException[]>([])
  const [showAttWarn,      setShowAttWarn]      = useState(false)

  const openConfirm = useUIStore(s => s.openConfirm)

  const handleDelete = async (p: { id: string; periodNo: string; startDate: string; endDate: string }, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = await new Promise<boolean>(resolve =>
      openConfirm({
        title:        `Delete Payroll Run ${p.periodNo}?`,
        description:  `This will permanently delete the payroll run for ${fmtDateRange(p.startDate, p.endDate)} and all its computed entries. This cannot be undone.`,
        confirmLabel: 'Delete Run',
        cancelLabel:  'Keep It',
        variant:      'destructive',
        resolve,
      })
    )
    if (!confirmed) return
    setDeleting(p.id)
    try {
      await apiDeletePayrollPeriod(p.id)
      refetch()
      addToast({ type: 'success', title: 'Payroll Run Deleted', message: `${p.periodNo} has been removed.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Delete', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setDeleting(null)
    }
  }

  // Compute the suggested start date from the last period and open modal
  const openNewPayRunModal = () => {
    const freq: typeof form.frequency = 'bi-monthly'
    const lastPeriod = (periods ?? []).slice().sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
    const nextStart  = lastPeriod ? addDays(lastPeriod.endDate, 1) : dateN(-14)
    const nextEnd    = addDays(nextStart, FREQ_DAYS[freq] ?? 14)
    setForm({ startDate: nextStart, endDate: nextEnd, payDate: addDays(nextEnd, 3), frequency: freq })
    setModal(true)
  }

  const handle13thMonth = async () => {
    const year = new Date().getFullYear()
    setGenerating13th(true)
    try {
      await apiGenerate13thMonth(year, 'System')
      refetch()
      addToast({ type: 'success', title: '13th Month Pay Generated', message: `13th Month Pay for ${year} has been created as a draft. Review and approve before releasing.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Generate 13th Month', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setGenerating13th(false)
    }
  }

  /** Step 1 — check for open attendance records before generating.
   *  If exceptions found, surface the warning modal. Otherwise generate immediately. */
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const exceptions = await apiGetAttendanceExceptions({
        startDate: form.startDate,
        endDate:   form.endDate,
      })
      if (exceptions.length > 0) {
        setAttExceptions(exceptions)
        setShowAttWarn(true)
        return   // paused — user must choose Fix First or Generate Anyway
      }
      await doGenerate()
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Generate Payroll', message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
    } finally {
      setGenerating(false)
    }
  }

  /** Step 2 — actual generation (called either directly or after warning override). */
  const doGenerate = async () => {
    try {
      await apiCreatePayrollPeriod(form)
      setModal(false)
      setShowAttWarn(false)
      setAttExceptions([])
      refetch()
      addToast({ type: 'success', title: 'Pay Run Generated', message: 'Payroll has been computed for all active employees.' })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Generate Payroll', message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
    }
  }

  /** "Generate Anyway" handler from the warning modal. */
  const handleGenerateAnyway = async () => {
    setGenerating(true)
    try { await doGenerate() }
    finally { setGenerating(false) }
  }

  const handleBatchStatus = async (status: 'reviewed' | 'approved' | 'paid', label: string) => {
    if (!selected.size || batchSaving) return
    setBatchSaving(true)
    // Use 'System' as actor so maker-checker doesn't fire on batch
    const { ok, fail } = await apiBatchUpdatePayrollStatus([...selected], status, 'System')
    setSelected(new Set())
    refetch()
    addToast({
      type: fail > 0 ? 'warning' : 'success',
      title: `Batch ${label}`,
      message: `${ok} pay run${ok !== 1 ? 's' : ''} ${label.toLowerCase()}${fail > 0 ? `. ${fail} failed.` : '.'}`,
    })
    setBatchSaving(false)
  }

  const totalNet   = (periods ?? []).reduce((s, p) => s + p.totalNet, 0)
  const totalGross = (periods ?? []).reduce((s, p) => s + p.totalGross, 0)
  const paidCount  = (periods ?? []).filter(p => p.status === 'paid').length
  const draftCount = (periods ?? []).filter(p => p.status === 'draft' || p.status === 'reviewed').length

  const filteredPeriods = (periods ?? []).filter(p =>
    !search ||
    p.periodNo.toLowerCase().includes(search.toLowerCase()) ||
    p.startDate.includes(search) ||
    p.endDate.includes(search) ||
    p.status.includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll"
        subtitle="Manage pay periods, review computations, and release payslips"
        actions={[
          {
            label: generating13th ? 'Generating…' : '13th Month',
            icon: Gift,
            variant: 'secondary' as const,
            onClick: handle13thMonth,
          },
          ...(canGenerate ? [{ label: 'New Pay Run', icon: Plus, onClick: openNewPayRunModal }] : []),
        ]}
      />

      {/* ── KPI cards — match Attendance page design ── */}
      {(periods?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Pay Runs',   value: (periods?.length ?? 0).toString(), icon: Banknote,    color: '#5B5FC7' },
            { label: 'Completed (Paid)', value: paidCount.toString(),               icon: CheckCircle, color: '#16A34A' },
            { label: 'Total Gross',      value: formatPeso(totalGross),             icon: TrendingUp,  color: '#5B5FC7' },
            { label: 'Total Net Payout', value: formatPeso(totalNet),               icon: DollarSign,  color: '#D97706' },
          ].map(item => (
            <div
              key={item.label}
              className="card-sm"
              style={{ padding: '14px 18px', borderTop: `3px solid ${item.color}` }}
            >
              <div className="flex items-start justify-between mb-2">
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </p>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <item.icon style={{ width: 13, height: 13, color: item.color }} />
                </div>
              </div>
              <p className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Workflow pipeline ── */}
      <div
        className="flex overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14 }}
      >
        {WORKFLOW_STEPS.map((step, i) => {
          const hasActive = (periods ?? []).some(p => STATUS_CFG[p.status]?.step === step.step)
          const Icon = step.icon
          return (
            <div
              key={step.step}
              className="flex-1 flex items-center gap-2.5 px-4 py-3 transition-colors"
              style={{
                borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                background: hasActive ? `${step.activeColor}08` : 'transparent',
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: hasActive ? `${step.activeColor}1A` : 'var(--color-surface-2)',
                }}
              >
                <Icon style={{ width: 13, height: 13, color: hasActive ? step.activeColor : 'var(--color-border-strong)' }} />
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: 12, fontWeight: 600, color: hasActive ? step.activeColor : 'var(--color-text-muted)', lineHeight: 1 }}>
                  {step.label}
                </p>
                <p style={{ fontSize: 10, color: 'var(--color-border-strong)', marginTop: 2 }}>Step {step.step}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Pending alert ── */}
      {draftCount > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{
            background: 'var(--color-warning-bg)',
            border: '1px solid #FCD34D',
            borderLeft: '4px solid var(--color-warning)',
            borderRadius: 10,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <AlertCircle style={{ width: 16, height: 16, color: 'var(--color-warning)' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                {draftCount} pay run{draftCount !== 1 ? 's' : ''} pending review or approval
              </p>
              <p style={{ fontSize: 11.5, color: '#B45309', marginTop: 1 }}>
                Payroll cannot be released until all pending runs are reviewed and approved.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const p = (periods ?? []).find(p => p.status === 'draft' || p.status === 'reviewed')
              if (p) navigate(`/payroll/${p.id}`)
            }}
            className="btn flex-shrink-0"
            style={{
              background: 'var(--color-warning)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Review Now →
          </button>
        </div>
      )}

      {/* ── Pay Runs list ── */}
      {loading ? (
        <div className="card flex items-center justify-center h-48">
          <div className="spinner" />
        </div>
      ) : !periods?.length ? (
        <div className="card">
          <EmptyState
            icon={Banknote}
            title="No payroll periods yet"
            description="Create your first pay run to compute employee salaries and deductions."
            action={{ label: 'New Pay Run', onClick: openNewPayRunModal }}
          />
        </div>
      ) : (
        <div className="space-y-3">
        {canApprove && (
          <BatchActionBar
            count={selected.size}
            noun="pay run"
            onClear={() => setSelected(new Set())}
            actions={[
              {
                label:    batchSaving ? 'Processing…' : `Submit ${selected.size} for Review`,
                icon:     Send,
                onClick:  () => handleBatchStatus('reviewed', 'Submitted'),
                disabled: batchSaving,
                variant:  'secondary',
              },
              {
                label:    batchSaving ? 'Processing…' : `Approve ${selected.size} Selected`,
                icon:     CheckCircle,
                onClick:  () => handleBatchStatus('approved', 'Approved'),
                disabled: batchSaving,
                variant:  'success',
              },
              {
                label:    batchSaving ? 'Processing…' : `Mark ${selected.size} Paid`,
                icon:     DollarSign,
                onClick:  () => handleBatchStatus('paid', 'Marked Paid'),
                disabled: batchSaving,
                variant:  'primary',
              },
            ]}
          />
        )}
        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search period number, date, or status…"
              className="w-full"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="table-base w-full">
              <thead>
                <tr>
                  {canApprove && (
                    <th style={{ width: 36, paddingLeft: 16 }}>
                      {filteredPeriods.length > 0 && (
                        <input
                          type="checkbox"
                          checked={filteredPeriods.length > 0 && filteredPeriods.every(p => selected.has(p.id))}
                          onChange={e => toggleSelectAll(filteredPeriods.map(p => p.id), e.target.checked)}
                          title="Select all"
                        />
                      )}
                    </th>
                  )}
                  <th>Period</th>
                  <th className="hidden lg:table-cell">Date Range</th>
                  <th className="hidden lg:table-cell">Pay Date</th>
                  <th className="hidden md:table-cell text-right">Employees</th>
                  <th className="text-right">Gross Pay</th>
                  <th className="hidden xl:table-cell text-right">Deductions</th>
                  <th className="text-right">Net Pay</th>
                  <th>Status</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPeriods.map(p => {
                  const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/payroll/${p.id}`)}
                      style={selected.has(p.id) ? { background: 'var(--color-primary-light)' } : undefined}
                    >
                      {canApprove && (
                        <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                          />
                        </td>
                      )}
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{p.periodNo}</p>
                        <p style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                          {p.frequency.replace('-', '-')} payroll
                        </p>
                      </td>
                      <td className="hidden lg:table-cell tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {fmtDateRange(p.startDate, p.endDate)}
                      </td>
                      <td className="hidden lg:table-cell tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {fmtDate(p.payDate)}
                      </td>
                      <td className="hidden md:table-cell text-right tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        {p.totalEmployees}
                      </td>
                      <td className="text-right tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                        {formatPeso(p.totalGross)}
                      </td>
                      <td className="hidden xl:table-cell text-right tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)' }}>
                        −{formatPeso(p.totalDeductions)}
                      </td>
                      <td className="text-right tabular-nums" style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary)' }}>
                        {formatPeso(p.totalNet)}
                      </td>
                      <td>
                        <StatusBadge type="payroll" status={p.status}>
                          {cfg.label}
                        </StatusBadge>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 justify-end">
                          {canDeletePay && (
                            <ActionIconBtn
                              variant="delete"
                              icon={Trash2}
                              label="Delete"
                              title="Delete this payroll run"
                              disabled={deleting === p.id}
                              onClick={e => handleDelete(p, e)}
                            />
                          )}
                          <ChevronRight style={{ width: 14, height: 14, color: 'var(--color-border-strong)' }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
          >
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {filteredPeriods.length} pay run{filteredPeriods.length !== 1 ? 's' : ''} · Total net:{' '}
              <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }} className="tabular-nums">
                {formatPeso(totalNet)}
              </span>
            </span>
            <button
              onClick={openNewPayRunModal}
              className="flex items-center gap-1 hover:underline font-semibold"
              style={{ fontSize: 11, color: 'var(--color-primary)' }}
            >
              <Plus style={{ width: 11, height: 11 }} /> New pay run
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── Generate Modal ── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Generate New Pay Run"
        footer={
          <>
            <button onClick={() => setModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Plus style={{ width: 13, height: 13 }} />
                  Generate Pay Run
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="alert-info">
            <AlertCircle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12 }}>
              Payroll will be computed for all <strong>active</strong> employees based on
              attendance records within the selected period. Government deductions (SSS,
              PhilHealth, Pag-IBIG, Withholding Tax) are auto-calculated.
            </span>
          </div>

          {/* Last period hint */}
          {(() => {
            const last = (periods ?? []).slice().sort((a,b) => b.endDate.localeCompare(a.endDate))[0]
            return last ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Last period:</span>{' '}
                <strong style={{ color: 'var(--color-text)' }}>{last.periodNo}</strong> ended <strong style={{ color: 'var(--color-text)' }}>{fmtDate(last.endDate)}</strong>{' '}
                — suggested start: <strong style={{ color: 'var(--color-primary)' }}>{fmtDate(addDays(last.endDate, 1))}</strong>
              </div>
            ) : null
          })()}

          <div>
            <label className="form-label">Pay Frequency</label>
            <select
              className="input-base"
              value={form.frequency}
              onChange={e => {
                const freq = e.target.value as typeof form.frequency
                // Re-derive dates from the current startDate when frequency changes
                setForm(f => ({
                  ...f,
                  frequency: freq,
                  endDate:   addDays(f.startDate, FREQ_DAYS[freq] ?? 14),
                  payDate:   addDays(f.startDate, (FREQ_DAYS[freq] ?? 14) + 3),
                }))
              }}
            >
              <option value="weekly">Weekly (7 days)</option>
              <option value="bi-monthly">Bi-Monthly / Semi-Monthly (15 days)</option>
              <option value="monthly">Monthly (30 days)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Period Start</label>
              <input type="date" className="input-base" value={form.startDate}
                onChange={e => {
                  const s = e.target.value
                  setForm(f => ({ ...f, startDate: s, endDate: addDays(s, FREQ_DAYS[f.frequency] ?? 14), payDate: addDays(s, (FREQ_DAYS[f.frequency] ?? 14) + 3) }))
                }}
              />
            </div>
            <div>
              <label className="form-label">Period End</label>
              <input type="date" className="input-base" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="form-label">Pay Date</label>
            <input type="date" className="input-base" value={form.payDate} onChange={e => setForm(f => ({ ...f, payDate: e.target.value }))} />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              The date when salaries will be released to employees.
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Attendance Exception Warning Modal ── */}
      <Modal
        open={showAttWarn}
        onClose={() => { setShowAttWarn(false); setAttExceptions([]) }}
        title="Attendance Exceptions Detected"
        footer={
          <>
            <button
              onClick={() => { setShowAttWarn(false); setAttExceptions([]) }}
              className="btn btn-secondary"
            >
              Go Fix First
            </button>
            <button
              onClick={handleGenerateAnyway}
              disabled={generating}
              className="btn btn-primary"
              style={{ background: '#D97706' }}
            >
              {generating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : 'Generate Anyway'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="alert-warning" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1, color: '#D97706' }} />
            <span style={{ fontSize: 13 }}>
              <strong>{attExceptions.length} attendance record{attExceptions.length !== 1 ? 's' : ''}</strong> in
              this period have a <strong>time-in but no time-out</strong>.
              Payroll will compute <strong>zero overtime</strong> for these shifts.
              It is recommended to correct them in Attendance before generating.
            </span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {attExceptions.slice(0, 20).map(ex => (
              <div
                key={ex.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 12, padding: '6px 10px',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)', borderRadius: 6,
                }}
              >
                <span style={{ fontWeight: 600 }}>{ex.employeeName}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{ex.date}</span>
              </div>
            ))}
            {attExceptions.length > 20 && (
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', padding: '4px 0' }}>
                …and {attExceptions.length - 20} more
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
