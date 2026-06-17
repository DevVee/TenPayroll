import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, CheckCircle,
  Users, Banknote, TrendingDown, DollarSign, Printer, Trash2,
  BadgeCheck, RotateCcw, Download, SlidersHorizontal, Plus, X, AlertCircle,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useData } from '../../hooks/useData'
import { apiGetPayrollPeriod, apiGetPayrollEntries, apiUpdatePayrollStatus, apiReopenPayroll, apiMarkEntryPaid, apiDeletePayrollPeriod, apiGetEmployees, apiUpdatePayrollEntryDeductions, getCompanySettings } from '../../lib/db'
import { Modal } from '../../components/ui/Modal'
import type { PayrollEntry, DeductionLine } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { usePermission } from '../../lib/permissions'
import { formatPeso } from '../../lib/payrollEngine'
import { exportPayrollRun, exportGovtContributions, exportBankDisbursement } from '../../lib/exportService'

const STATUS_FLOW: Record<string, string> = {
  draft: 'reviewed', reviewed: 'approved', approved: 'paid',
}
const STATUS_ACTION: Record<string, { label: string }> = {
  draft:    { label: 'Mark Reviewed' },
  reviewed: { label: 'Approve' },
  approved: { label: 'Mark as Paid' },
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', reviewed: 'For Approval', approved: 'Approved', paid: 'Paid',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PayrollDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const user       = useAuthStore(s => s.user)
  const addToast   = useUIStore(s => s.addToast)
  const [search,       setSearch]       = useState('')
  const [advancing,    setAdvancing]    = useState(false)
  const [reopening,    setReopening]    = useState(false)
  const [markingId,    setMarkingId]    = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── Edit Deductions modal state ───────────────────────────────────────────
  const [dedEntry,  setDedEntry]  = useState<PayrollEntry | null>(null)
  const [dedLines,  setDedLines]  = useState<DeductionLine[]>([])
  const [dedNew,    setDedNew]    = useState({ type: '', amount: '' })
  const [dedSaving, setDedSaving] = useState(false)
  const [dedErr,    setDedErr]    = useState('')

  const canDeletePerm = usePermission('pay_delete')

  const { data: period, loading: pLoading, refetch }                  = useData(() => apiGetPayrollPeriod(id!), [id])
  const { data: entries, loading: eLoading, refetch: refetchEntries } = useData(() => apiGetPayrollEntries(id!), [id])
  // Fetch employees for bank disbursement export (bank details live on Employee, not PayrollEntry)
  const { data: employees } = useData(() => apiGetEmployees(), [])
  const company = getCompanySettings()

  const handleMarkEntryPaid = async (employeeId: string) => {
    if (markingId) return
    setMarkingId(employeeId)
    try {
      await apiMarkEntryPaid(id!, employeeId, user?.name)
      refetchEntries()
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to update', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setMarkingId(null)
    }
  }

  const loading = pLoading || eLoading

  const filtered = (entries ?? []).filter(e =>
    !search ||
    e.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdvance = async () => {
    if (!period) return
    const next = STATUS_FLOW[period.status]
    if (!next) return
    setAdvancing(true)
    try {
      await apiUpdatePayrollStatus(id!, next as 'reviewed' | 'approved' | 'paid', user?.name)
      refetch()
      addToast({ type: 'success', title: 'Status Updated', message: `Payroll moved to "${next}".` })
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to advance', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setAdvancing(false)
    }
  }

  const handleReopen = async () => {
    if (!period) return
    setReopening(true)
    try {
      await apiReopenPayroll(id!, user?.name)
      refetch()
      addToast({ type: 'success', title: 'Payroll Re-opened', message: `${period.periodNo} is back in Draft. Make corrections and re-advance when ready.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Re-open', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setReopening(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiDeletePayrollPeriod(id!)
      addToast({ type: 'success', title: 'Pay Run Deleted', message: 'The draft payroll period has been removed.' })
      navigate('/payroll')
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Delete', message: err instanceof Error ? err.message : 'Something went wrong.' })
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  // ── Deductions modal handlers ─────────────────────────────────────────────
  const openDedModal = (entry: PayrollEntry) => {
    setDedEntry(entry)
    setDedLines([...(entry.otherDeductions ?? [])])
    setDedNew({ type: '', amount: '' })
    setDedErr('')
  }
  const addDedLine = () => {
    const amt = parseFloat(dedNew.amount)
    if (!dedNew.type.trim()) { setDedErr('Deduction label is required.'); return }
    if (!amt || amt <= 0)    { setDedErr('Amount must be greater than 0.'); return }
    setDedErr('')
    setDedLines(prev => [...prev, { type: dedNew.type.trim(), amount: Math.round(amt * 100) / 100 }])
    setDedNew({ type: '', amount: '' })
  }
  const removeDedLine = (idx: number) => setDedLines(prev => prev.filter((_, i) => i !== idx))
  const saveDed = async () => {
    if (!dedEntry || !id) return
    setDedSaving(true); setDedErr('')
    try {
      await apiUpdatePayrollEntryDeductions(id, dedEntry.employeeId, dedLines, user?.name)
      setDedEntry(null)
      refetch()
      refetchEntries()
      addToast({ type: 'success', title: 'Deductions Saved', message: `Updated for ${dedEntry.employeeName}.` })
    } catch (err) {
      setDedErr(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setDedSaving(false)
    }
  }

  if (loading || !period) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  const canAdvance = !!STATUS_FLOW[period.status]
  // Can re-open if reviewed or approved (never paid — that requires a reversal)
  const canReopen  = period.status === 'reviewed' || period.status === 'approved'
  // Only draft payrolls can be deleted; only users with pay_delete permission
  const canDelete  = canDeletePerm && period.status === 'draft'
  const actionCfg  = STATUS_ACTION[period.status]
  const totalAllowances = (entries ?? []).reduce((s, e) => s + e.allowances.reduce((a, x) => a + x.amount, 0), 0)
  const totalOT         = (entries ?? []).reduce((s, e) => s + e.overtimePay, 0)

  // Status bar colors
  const statusBarBg     = period.status === 'paid' ? 'var(--color-success-bg)' : 'var(--color-primary-light)'
  const statusBarBorder = period.status === 'paid' ? '#A7F3D0' : 'var(--color-primary-medium)'

  return (
    <div className="space-y-4">
      {/* Screen-only page header — hidden on print */}
      <div className="no-print">
      <PageHeader
        breadcrumb="Payroll"
        title={`Payroll — ${period.periodNo}`}
        subtitle={`${fmtDate(period.startDate)} – ${fmtDate(period.endDate)} · Pay Date: ${fmtDate(period.payDate)}`}
        actions={[
          { label: 'Back', icon: ArrowLeft, variant: 'secondary', onClick: () => navigate('/payroll') },
          ...(canDelete ? [{
            label: 'Delete',
            icon: Trash2,
            variant: 'danger' as const,
            onClick: () => setConfirmDelete(true),
          }] : []),
          ...(canReopen ? [{
            label: reopening ? 'Re-opening…' : 'Re-open to Draft',
            icon: RotateCcw,
            variant: 'secondary' as const,
            onClick: handleReopen,
          }] : []),
          ...(canAdvance ? [{
            label: advancing ? 'Processing…' : actionCfg.label,
            icon: CheckCircle,
            onClick: handleAdvance,
          }] : []),
        ]}
      />
      </div>{/* /no-print PageHeader */}

      {/* ── Summary KPI strip ── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 bg-white no-print"
        style={{ border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}
      >
        {[
          { label: 'Employees',  value: period.totalEmployees.toString(), icon: Users,       color: '#5B5FC7', highlight: false },
          { label: 'Gross Pay',  value: formatPeso(period.totalGross),    icon: Banknote,    color: '#5B5FC7', highlight: false },
          { label: 'Deductions', value: formatPeso(period.totalDeductions), icon: TrendingDown, color: '#DC2626', highlight: false },
          { label: 'Net Pay',    value: formatPeso(period.totalNet),      icon: DollarSign,  color: '#5B5FC7', highlight: true },
        ].map((item, i) => (
          <div
            key={item.label}
            className="px-4 py-3"
            style={{ borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none' }}
          >
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {item.label}
              </p>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: `${item.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon style={{ width: 12, height: 12, color: item.color }} />
              </div>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: item.highlight ? 'var(--color-primary)' : 'var(--color-text)' }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Status + metadata bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 no-print"
        style={{ background: statusBarBg, border: `1px solid ${statusBarBorder}`, borderRadius: 10 }}
      >
        <div className="flex items-center gap-3">
          <StatusBadge type="payroll" status={period.status}>
            {STATUS_LABEL[period.status]}
          </StatusBadge>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {period.frequency.replace('-', '-')} payroll ·{' '}
            {period.totalEmployees} employees
          </span>
        </div>
        <div className="flex items-center gap-3">
          {period.approvedBy && (
            <span style={{ fontSize: 11, color: '#64748B' }}>
              Approved by <strong>{period.approvedBy}</strong>
              {period.approvedAt && ` on ${fmtDate(period.approvedAt)}`}
            </span>
          )}
          {period.paidAt && (
            <span style={{ fontSize: 11, color: '#64748B' }}>
              Paid on <strong>{fmtDate(period.paidAt)}</strong>
            </span>
          )}
          <button onClick={() => window.print()} className="btn btn-secondary no-print" style={{ height: 30, fontSize: 12 }}>
            <Printer style={{ width: 12, height: 12 }} />
            Print
          </button>
          <div className="relative no-print" style={{ display: 'inline-flex' }}>
            <button
              className="btn btn-secondary"
              style={{ height: 30, fontSize: 12, gap: 4 }}
              onClick={() => exportPayrollRun(period, entries ?? [], 'excel')}
              title="Export payroll run to Excel"
            >
              <Download style={{ width: 12, height: 12 }} />
              Excel
            </button>
          </div>
          <div className="relative no-print" style={{ display: 'inline-flex' }}>
            <button
              className="btn btn-secondary"
              style={{ height: 30, fontSize: 12, gap: 4 }}
              onClick={() => exportGovtContributions(period, entries ?? [], 'excel')}
              title="Export government contributions"
            >
              <FileText style={{ width: 12, height: 12 }} />
              Contributions
            </button>
          </div>
          <div className="relative no-print" style={{ display: 'inline-flex' }}>
            <button
              className="btn btn-secondary"
              style={{ height: 30, fontSize: 12, gap: 4 }}
              onClick={() => exportBankDisbursement(period, entries ?? [], employees ?? [], 'csv')}
              title="Export bank disbursement CSV for payroll upload"
            >
              <Download style={{ width: 12, height: 12 }} />
              Bank CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Print-only document header ── */}
      <div className="print-only" style={{ marginBottom: 16, borderBottom: '3px solid #5B5FC7', paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>{company.name}</p>
            {company.address && <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{company.address}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#5B5FC7', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', padding: '2px 10px', borderRadius: 3, marginBottom: 4 }}>
              PAYROLL SUMMARY
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{period.periodNo}</p>
            <p style={{ fontSize: 11, color: '#64748B' }}>
              {fmtDate(period.startDate)} – {fmtDate(period.endDate)}
            </p>
            <p style={{ fontSize: 11, color: '#64748B' }}>
              Pay Date: <strong style={{ color: '#0F172A' }}>{fmtDate(period.payDate)}</strong>
              {' · '}{period.frequency} · {period.totalEmployees} employees
            </p>
          </div>
        </div>
      </div>

      {/* ── Entries Table ── */}
      <div className="card overflow-hidden">
        {/* Toolbar — screen only */}
        <div className="flex items-center gap-3 px-4 py-2.5 no-print" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee, department…"
            className="flex-1"
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
          </span>
          {/* Summary totals */}
          <div className="hidden lg:flex items-center gap-5 ml-2 pl-4" style={{ borderLeft: '1px solid var(--color-border)' }}>
            {[
              { label: 'OT Pay',     value: totalOT,         color: 'var(--color-primary)' },
              { label: 'Allowances', value: totalAllowances,  color: 'var(--color-success)' },
            ].map(item => (
              <div key={item.label}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: item.color }} className="tabular-nums">
                  {formatPeso(item.value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {(() => {
            // ── Group filtered entries by department ──────────────────────────
            const byDept = new Map<string, typeof filtered>()
            for (const e of filtered) {
              const dept = e.department || 'Unassigned'
              const list = byDept.get(dept) ?? []
              list.push(e)
              byDept.set(dept, list)
            }
            const deptGroups = [...byDept.entries()].sort(([a], [b]) => a.localeCompare(b))

            return (
          <table className="table-base w-full payroll-print-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="hidden lg:table-cell text-right">Days</th>
                <th className="text-right">Basic Pay</th>
                <th className="hidden xl:table-cell text-right">OT Pay</th>
                <th className="hidden xl:table-cell text-right">Allowances</th>
                <th className="text-right">Gross Pay</th>
                <th className="text-right">Deductions</th>
                <th className="text-right">Net Pay</th>
                <th className="no-print text-right" style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {deptGroups.map(([dept, deptEntries]) => (
                <>
                  {/* Department header row */}
                  <tr key={`dept-${dept}`} className="payroll-dept-row">
                    <td colSpan={9} style={{
                      padding: '6px 16px',
                      background: 'var(--color-surface-2)',
                      borderTop: '2px solid var(--color-border)',
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: 'var(--color-text-muted)',
                    }}>
                      {dept}
                      <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 8 }}>
                        · {deptEntries.length} employee{deptEntries.length !== 1 ? 's' : ''}
                        · Net {formatPeso(deptEntries.reduce((s, e) => s + e.netPay, 0))}
                      </span>
                    </td>
                  </tr>
                  {deptEntries.map(e => {
                const totalAllow = e.allowances.reduce((s, a) => s + a.amount, 0)
                return (
                  <tr key={e.id}>
                    <td className="payroll-emp-cell">
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>{e.employeeName}</p>
                      <p style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {e.employeeNo}
                      </p>
                    </td>

                    <td className="hidden lg:table-cell text-right tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {e.presentDays}<span style={{ color: 'var(--color-border-strong)' }}>/{e.scheduledDays}</span>
                    </td>

                    <td className="text-right tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {formatPeso(e.basicPay)}
                    </td>

                    <td className="hidden xl:table-cell text-right tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {e.overtimePay > 0 ? formatPeso(e.overtimePay) : <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                    </td>

                    <td className="hidden xl:table-cell text-right tabular-nums" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {totalAllow > 0 ? formatPeso(totalAllow) : <span style={{ color: 'var(--color-border-strong)' }}>—</span>}
                    </td>

                    <td className="text-right tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                      {formatPeso(e.grossPay)}
                    </td>

                    <td className="text-right tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)' }}>
                      −{formatPeso(e.totalDeductions)}
                    </td>

                    <td className="text-right tabular-nums" style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)' }}>
                      {formatPeso(e.netPay)}
                    </td>

                    <td className="no-print">
                      <div className="flex items-center gap-1.5 justify-end">
                        {/* Mark Paid / Undo button */}
                        {e.markedPaid ? (
                          <button
                            onClick={() => handleMarkEntryPaid(e.employeeId)}
                            disabled={markingId === e.employeeId}
                            title="Undo — remove paid mark"
                            className="flex items-center gap-1.5"
                            style={{
                              fontSize: 11, fontWeight: 700,
                              color: 'var(--color-success)',
                              background: 'var(--color-success-bg)',
                              border: '1px solid #86EFAC',
                              borderRadius: 7,
                              padding: '4px 9px',
                              opacity: markingId === e.employeeId ? 0.5 : 1,
                              cursor: markingId === e.employeeId ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <BadgeCheck style={{ width: 12, height: 12 }} />
                            Paid
                            <RotateCcw style={{ width: 10, height: 10, opacity: 0.6 }} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkEntryPaid(e.employeeId)}
                            disabled={markingId === e.employeeId}
                            title="Mark this employee as paid"
                            className="flex items-center gap-1.5"
                            style={{
                              fontSize: 11, fontWeight: 600,
                              color: period.status === 'paid' ? 'var(--color-text-muted)' : '#64748B',
                              background: 'var(--color-surface-2)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 7,
                              padding: '4px 9px',
                              opacity: markingId === e.employeeId ? 0.5 : 1,
                              cursor: markingId === e.employeeId ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <CheckCircle style={{ width: 12, height: 12 }} />
                            Mark Paid
                          </button>
                        )}

                        {/* Edit Deductions — draft only */}
                        {period.status === 'draft' && (
                          <button
                            onClick={() => openDedModal(e)}
                            title="Add or remove deductions for this employee"
                            className="flex items-center gap-1"
                            style={{
                              fontSize: 11, fontWeight: 600,
                              color: '#B45309',
                              background: '#FEF3C7',
                              border: '1px solid #FDE68A',
                              borderRadius: 7,
                              padding: '4px 9px',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                          >
                            <SlidersHorizontal style={{ width: 11, height: 11 }} />
                            Deductions
                          </button>
                        )}

                        {/* Payslip button */}
                        <button
                          onClick={() => navigate(`/payroll/${id}/payslip/${e.employeeId}`)}
                          title="View payslip"
                          className="flex items-center gap-1"
                          style={{
                            fontSize: 11, fontWeight: 600,
                            color: 'var(--color-primary)',
                            background: 'var(--color-primary-light)',
                            border: '1px solid var(--color-primary-medium)',
                            borderRadius: 7,
                            padding: '4px 9px',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                        >
                          <FileText style={{ width: 11, height: 11 }} />
                          Payslip
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
                </>
              ))}
            </tbody>
          </table>
            )
          })()}
        </div>

        {/* Footer totals */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total Gross
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }} className="tabular-nums">
                {formatPeso(period.totalGross)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Deductions
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-danger)' }} className="tabular-nums">
                −{formatPeso(period.totalDeductions)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pl-4" style={{ borderLeft: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Net Pay
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-primary)' }} className="tabular-nums">
                {formatPeso(period.totalNet)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ EDIT DEDUCTIONS MODAL ════════════════════════════════════════════ */}
      <Modal
        open={!!dedEntry}
        onClose={() => !dedSaving && setDedEntry(null)}
        title={`Edit Deductions — ${dedEntry?.employeeName ?? ''}`}
        footer={
          <>
            <button onClick={() => setDedEntry(null)} disabled={dedSaving} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={saveDed} disabled={dedSaving} className="btn btn-primary">
              {dedSaving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                : <><SlidersHorizontal style={{ width: 13, height: 13 }} />Save Deductions</>
              }
            </button>
          </>
        }
      >
        <div className="space-y-4">

          {dedErr && (
            <div className="flex items-center gap-2 p-3 rounded-lg"
              style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
              {dedErr}
            </div>
          )}

          {/* Info */}
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Add or remove <strong>other deductions</strong> for this employee in this pay period.
            Mandatory deductions (SSS, PhilHealth, Pag-IBIG, late, tax) are computed automatically and cannot be changed here.
          </p>

          {/* Existing lines */}
          {dedLines.length > 0 ? (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '7px 12px', fontSize: 10.5, fontWeight: 700, textAlign: 'left', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Description
                    </th>
                    <th style={{ padding: '7px 12px', fontSize: 10.5, fontWeight: 700, textAlign: 'right', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Amount
                    </th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dedLines.map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < dedLines.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{line.type}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--color-danger)' }} className="tabular-nums">
                        −{formatPeso(line.amount)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => removeDedLine(idx)}
                          style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #FECACA', background: 'var(--color-danger-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}
                          title="Remove this deduction"
                        >
                          <X style={{ width: 11, height: 11 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                    <td style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Total Other Deductions
                    </td>
                    <td colSpan={2} style={{ padding: '7px 12px', fontSize: 13, fontWeight: 800, textAlign: 'right', color: 'var(--color-danger)' }} className="tabular-nums">
                      −{formatPeso(dedLines.reduce((s, d) => s + d.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 13, border: '1px dashed var(--color-border)', borderRadius: 10 }}>
              No other deductions. Add one below.
            </div>
          )}

          {/* Add new line */}
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Add Deduction
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input-base"
                style={{ flex: 1 }}
                placeholder="Description (e.g. Uniform, Tool damage, Memo fine)"
                value={dedNew.type}
                onChange={e => { setDedNew(p => ({ ...p, type: e.target.value })); setDedErr('') }}
                onKeyDown={e => e.key === 'Enter' && addDedLine()}
              />
              <input
                className="input-base"
                style={{ width: 110 }}
                type="number"
                min="1"
                step="0.01"
                placeholder="Amount"
                value={dedNew.amount}
                onChange={e => { setDedNew(p => ({ ...p, amount: e.target.value })); setDedErr('') }}
                onKeyDown={e => e.key === 'Enter' && addDedLine()}
              />
              <button
                onClick={addDedLine}
                className="btn btn-primary"
                style={{ flexShrink: 0, padding: '0 14px' }}
                title="Add this deduction line"
              >
                <Plus style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 5 }}>
              Press Enter or click + to add. Changes are not saved until you click Save Deductions.
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-danger-bg)' }}>
                <Trash2 style={{ width: 18, height: 18, color: 'var(--color-danger)' }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Delete Pay Run?</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{period.periodNo}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              This will permanently delete the draft payroll period and all{' '}
              <strong>{period.totalEmployees} computed entries</strong>. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-danger"
              >
                {deleting ? 'Deleting…' : 'Delete Pay Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
