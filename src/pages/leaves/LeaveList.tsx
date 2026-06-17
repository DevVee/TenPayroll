import { useState, useEffect } from 'react'
import { Calendar, CheckCircle, XCircle, Users, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useData } from '../../hooks/useData'
import { apiGetLeaves, apiUpdateLeaveStatus, apiBatchUpdateLeaveStatus, apiGetLeaveBalances, apiCreateLeave, apiGetEmployees, apiAccrueSIL } from '../../lib/db'
import { BatchActionBar } from '../../components/ui/BatchActionBar'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import type { LeaveRequest, Employee } from '../../types'

const LEAVE_TYPE_LABEL: Record<string, string> = {
  vacation:     'Vacation',
  sick:         'Sick',
  emergency:    'Emergency',
  maternity:    'Maternity',
  paternity:    'Paternity',
  'solo-parent':'Solo Parent',   // RA 8972 — 7 days/year
  sil:          'SIL',           // Labor Code Art. 95 — 5 days/year (≥1 yr service)
  bereavement:  'Bereavement',
  unpaid:       'Unpaid',
}

const LEAVE_TYPE_PILL: Record<string, string> = {
  vacation:     'pill pill-blue',
  sick:         'pill pill-orange',
  emergency:    'pill pill-red',
  maternity:    'pill pill-purple',
  paternity:    'pill pill-indigo',
  'solo-parent':'pill pill-teal',
  sil:          'pill pill-green',
  bereavement:  'pill pill-gray',
  unpaid:       'pill pill-gray',
}

export function LeaveList() {
  const user     = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const [tab,          setTab]          = useState<'requests'|'balances'>('requests')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter,   setTypeFilter]   = useState('all')

  const { data: leaves,   loading: lLoading, refetch } = useData(
    () => apiGetLeaves({ status: statusFilter !== 'all' ? statusFilter as LeaveRequest['status'] : undefined }),
    [statusFilter]
  )
  const { data: balances, loading: bLoading } = useData(() => apiGetLeaveBalances(), [])

  // Batch selection
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [batchSaving, setBatchSaving] = useState(false)

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleSelectAll = (pendingIds: string[], checked: boolean) =>
    setSelected(prev => {
      const s = new Set(prev)
      pendingIds.forEach(id => checked ? s.add(id) : s.delete(id))
      return s
    })

  const runBatch = async (status: 'approved' | 'rejected', label: string) => {
    if (!selected.size || batchSaving) return
    setBatchSaving(true)
    const { ok, fail } = await apiBatchUpdateLeaveStatus([...selected], status, user?.name ?? 'System')
    setSelected(new Set())
    refetch()
    addToast({
      type: fail > 0 ? 'warning' : 'success',
      title: `Batch ${label}`,
      message: `${ok} request${ok !== 1 ? 's' : ''} ${label.toLowerCase()}${fail > 0 ? `. ${fail} failed — check leave balances.` : '.'}`,
    })
    setBatchSaving(false)
  }
  const handleBatchApprove = () => runBatch('approved', 'Approved')
  const handleBatchReject  = () => runBatch('rejected', 'Rejected')

  // ── SIL Accrual ──────────────────────────────────────────────────────────
  const [silRunning, setSilRunning] = useState(false)
  const handleAccrueSIL = async () => {
    if (silRunning) return
    setSilRunning(true)
    try {
      const result = await apiAccrueSIL()
      if (result.credited === 0 && result.skipped === 0) {
        addToast({ type: 'info', title: 'SIL Accrual', message: 'No eligible employees found (no one with ≥1 year of service yet).' })
      } else if (result.credited === 0) {
        addToast({ type: 'info', title: 'SIL Already Credited', message: `All ${result.skipped} eligible employee${result.skipped !== 1 ? 's' : ''} already have SIL for ${new Date().getFullYear()}.` })
      } else {
        addToast({
          type: 'success',
          title: 'SIL Accrual Complete',
          message: `${result.credited} employee${result.credited !== 1 ? 's' : ''} credited with 5 SIL days each for ${new Date().getFullYear()}.` +
            (result.skipped > 0 ? ` (${result.skipped} already had SIL.)` : ''),
        })
      }
    } catch (err) {
      addToast({ type: 'error', title: 'SIL Accrual Failed', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally {
      setSilRunning(false)
    }
  }

  // ── Add-leave modal (admin files on behalf of employee) ──────────────────
  const [addOpen,    setAddOpen]    = useState(false)
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [addForm,    setAddForm]    = useState({
    employeeId: '', leaveType: 'vacation', startDate: '', endDate: '', reason: '', approveNow: true,
  })
  const [addSaving,  setAddSaving]  = useState(false)
  const [addErr,     setAddErr]     = useState('')

  useEffect(() => {
    if (addOpen && employees.length === 0)
      apiGetEmployees().then(e => setEmployees(e.filter(x => x.status === 'active')))
  }, [addOpen, employees.length])

  const addDays = (() => {
    if (!addForm.startDate || !addForm.endDate) return 0
    const ms = new Date(addForm.endDate).getTime() - new Date(addForm.startDate).getTime()
    return Math.max(1, Math.round(ms / 86400000) + 1)
  })()

  const submitAdd = async () => {
    setAddErr('')
    if (!addForm.employeeId)  { setAddErr('Select an employee.'); return }
    if (!addForm.startDate)   { setAddErr('Start date is required.'); return }
    if (!addForm.endDate)     { setAddErr('End date is required.'); return }
    if (addForm.endDate < addForm.startDate) { setAddErr('End date must be on or after start date.'); return }
    const emp = employees.find(e => e.id === addForm.employeeId)
    if (!emp) return
    setAddSaving(true)
    try {
      const leave = await apiCreateLeave({
        employeeId:   emp.id,
        employeeName: emp.fullName,
        employeeNo:   emp.employeeNo,
        leaveType:    addForm.leaveType,
        startDate:    addForm.startDate,
        endDate:      addForm.endDate,
        days:         addDays,
        reason:       addForm.reason || 'Filed by admin',
      }, user?.name)
      if (addForm.approveNow) {
        await apiUpdateLeaveStatus(leave.id, 'approved', user?.name)
      }
      setAddOpen(false)
      setAddForm({ employeeId: '', leaveType: 'vacation', startDate: '', endDate: '', reason: '', approveNow: true })
      refetch()
      addToast({
        type: 'success',
        title: 'Leave Filed',
        message: `${emp.fullName}'s ${addForm.leaveType} leave ${addForm.approveNow ? 'filed and approved' : 'filed as pending'}.`,
      })
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : 'Failed to file leave.')
    } finally {
      setAddSaving(false)
    }
  }

  // Action modal
  const [acting,     setActing]     = useState<LeaveRequest | null>(null)
  const [actionType, setActionType] = useState<'approve'|'reject'>('approve')
  const [remarks,    setRemarks]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const all      = leaves ?? []
  const pending  = all.filter(r => r.status === 'pending').length
  const approved = all.filter(r => r.status === 'approved').length
  const totalDays = all.filter(r => r.status === 'approved').reduce((s, r) => {
    const ms = new Date(r.endDate).getTime() - new Date(r.startDate).getTime()
    return s + Math.round(ms / 86400000) + 1
  }, 0)

  const filtered = all.filter(r => {
    const q = search.toLowerCase()
    return (
      (!search || r.employeeName.toLowerCase().includes(q) || (r.employeeNo ?? '').toLowerCase().includes(q)) &&
      (typeFilter === 'all' || r.leaveType === typeFilter)
    )
  })

  const pendingCount = filtered.filter(r => r.status === 'pending').length

  const openAction = (r: LeaveRequest, type: 'approve'|'reject') => {
    setActing(r); setActionType(type); setRemarks('')
  }

  const saveAction = async () => {
    if (!acting) return
    setSaving(true)
    try {
      await apiUpdateLeaveStatus(acting.id, actionType === 'approve' ? 'approved' : 'rejected', user?.name, remarks)
      setActing(null)
      refetch()
      addToast({ type: 'success', title: actionType === 'approve' ? 'Leave Approved' : 'Leave Rejected', message: `${acting.employeeName}'s request has been ${actionType === 'approve' ? 'approved' : 'rejected'}.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Action Failed', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally { setSaving(false) }
  }

  const days = (r: LeaveRequest) => {
    const ms = new Date(r.endDate).getTime() - new Date(r.startDate).getTime()
    return Math.round(ms / 86400000) + 1
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leave Management"
        subtitle="Review and manage employee time-off requests"
        actions={[
          { label: silRunning ? 'Running…' : 'Run SIL Accrual', icon: RefreshCw, onClick: handleAccrueSIL, variant: 'secondary' as const },
          { label: 'Add Leave', icon: Plus, onClick: () => setAddOpen(true) },
        ]}
      />

      {/* ── Summary strip ── */}
      <div
        className="grid grid-cols-3 bg-white"
        style={{ border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}
      >
        {[
          { label: 'Pending',        value: pending,              color: 'var(--color-warning)'  },
          { label: 'Approved',       value: approved,             color: 'var(--color-success)'  },
          { label: 'Total Days Off', value: `${totalDays}d`,      color: 'var(--color-primary)'  },
        ].map((s, i) => (
          <div key={s.label} className="px-4 py-3" style={{ borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }} className="tabular-nums">
              {s.value}
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="tab-bar">
        <button
          onClick={() => setTab('requests')}
          className={`tab-btn ${tab === 'requests' ? 'active' : ''}`}
        >
          Leave Requests
          {pendingCount > 0 && (
            <span
              className="flex items-center justify-center text-white font-bold"
              style={{
                background: 'var(--color-primary)', borderRadius: 9999,
                width: 16, height: 16, fontSize: 9, marginLeft: 2,
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('balances')}
          className={`tab-btn ${tab === 'balances' ? 'active' : ''}`}
        >
          Leave Balances
        </button>
      </div>

      {tab === 'requests' ? (
        <>
          {/* Filters */}
          <div className="card">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search employee…"
                className="flex-1"
              />
              {/* Status filter pills */}
              <div className="flex items-center gap-1">
                {(['all','pending','approved','rejected','cancelled'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="filter-pill"
                    style={statusFilter === s ? { background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: 'var(--color-primary-medium)', fontWeight: 600 } : {}}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="input-base input-sm"
                style={{ width: 130 }}
              >
                <option value="all">All Types</option>
                {Object.entries(LEAVE_TYPE_LABEL).map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Batch action bar */}
          <BatchActionBar
            count={selected.size}
            noun="request"
            onClear={() => setSelected(new Set())}
            actions={[
              {
                label:    batchSaving ? 'Processing…' : `Approve ${selected.size} Selected`,
                icon:     CheckCircle,
                onClick:  handleBatchApprove,
                disabled: batchSaving,
                variant:  'success',
              },
              {
                label:    batchSaving ? 'Processing…' : `Reject ${selected.size} Selected`,
                icon:     XCircle,
                onClick:  handleBatchReject,
                disabled: batchSaving,
                variant:  'danger',
              },
            ]}
          />

          <div className="card overflow-hidden">
            {lLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="spinner" />
              </div>
            ) : !filtered.length ? (
              <EmptyState
                icon={Calendar}
                title="No leave requests"
                description="No requests match your current filters."
              />
            ) : (
              <>
                {(() => {
                  const pendingIds = filtered.filter(r => r.status === 'pending').map(r => r.id)
                  const allPendingSelected = pendingIds.length > 0 && pendingIds.every(id => selected.has(id))
                  return (
                <div className="overflow-x-auto">
                  <table className="table-base w-full">
                    <thead>
                      <tr>
                        <th style={{ width: 36, paddingLeft: 16 }}>
                          {pendingIds.length > 0 && (
                            <input
                              type="checkbox"
                              checked={allPendingSelected}
                              onChange={e => toggleSelectAll(pendingIds, e.target.checked)}
                              title="Select all pending"
                            />
                          )}
                        </th>
                        <th>Employee</th>
                        <th>Type</th>
                        <th className="hidden md:table-cell">Dates</th>
                        <th>Days</th>
                        <th className="hidden lg:table-cell">Reason</th>
                        <th>Status</th>
                        <th className="hidden md:table-cell">Filed</th>
                        <th style={{ width: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => (
                        <tr key={r.id} style={selected.has(r.id) ? { background: 'var(--color-primary-light)' } : {}}>
                          <td style={{ paddingLeft: 16 }}>
                            {r.status === 'pending' && (
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                              />
                            )}
                          </td>
                          <td>
                            <p className="text-sm font-semibold text-gray-800 leading-none">{r.employeeName}</p>
                            {r.employeeNo && (
                              <p className="text-[11px] text-gray-400 mt-0.5">{r.employeeNo}</p>
                            )}
                          </td>
                          <td>
                            <span className={LEAVE_TYPE_PILL[r.leaveType] ?? 'pill pill-gray'}>
                              {LEAVE_TYPE_LABEL[r.leaveType] ?? r.leaveType}
                            </span>
                          </td>
                          <td className="hidden md:table-cell">
                            <span className="text-sm text-gray-700 tabular-nums">
                              {r.startDate === r.endDate ? r.startDate : `${r.startDate} – ${r.endDate}`}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm font-semibold text-gray-700 tabular-nums">{days(r)}</span>
                          </td>
                          <td className="hidden lg:table-cell" style={{ maxWidth: '200px' }}>
                            <span className="text-sm text-gray-500 line-clamp-1">{r.reason}</span>
                          </td>
                          <td>
                            <StatusBadge type="leave" status={r.status}>
                              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                            </StatusBadge>
                          </td>
                          <td className="hidden md:table-cell">
                            <span className="text-[11px] text-gray-400 tabular-nums">
                              {new Date(r.filedAt ?? r.createdAt).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
                            </span>
                          </td>
                          <td>
                            {r.status === 'pending' ? (
                              <div className="flex items-center gap-1.5">
                                <ActionIconBtn variant="green"  icon={CheckCircle} onClick={() => openAction(r, 'approve')} title="Approve" label="Approve" />
                                <ActionIconBtn variant="delete" icon={XCircle}     onClick={() => openAction(r, 'reject')}  title="Reject"  label="Reject"  />
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {(r.approvedBy ?? (r as any).reviewedBy) ? `by ${r.approvedBy ?? (r as any).reviewedBy}` : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  )
                })()}

                <div
                  className="px-4 py-2"
                  style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
                >
                  <span className="text-[11px] text-gray-400">
                    {filtered.length} request{filtered.length !== 1 ? 's' : ''}
                    {pendingCount > 0 && ` · ${pendingCount} pending`}
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Leave Balances */
        <div className="card overflow-hidden">
          {bLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="spinner" />
            </div>
          ) : !(balances ?? []).length ? (
            <EmptyState icon={Users} title="No balance data" description="Leave balances will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '16px' }}>Employee</th>
                    <th className="hidden md:table-cell">Department</th>
                    <th>Vacation</th>
                    <th>Sick</th>
                    <th>Emergency</th>
                    <th className="hidden md:table-cell">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {(balances ?? []).map(b => (
                    <tr key={b.employeeId}>
                      <td style={{ paddingLeft: '16px' }}>
                        <p className="text-sm font-semibold text-gray-800">{b.employeeName ?? b.employeeId}</p>
                        {b.employeeNo && <p className="text-[11px] text-gray-400 mt-0.5">{b.employeeNo}</p>}
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-sm text-gray-500">{b.department ?? '—'}</span>
                      </td>
                      <td><BalanceCell used={b.vacation.used} total={b.vacation.entitled} /></td>
                      <td><BalanceCell used={b.sick.used} total={b.sick.entitled} /></td>
                      <td><BalanceCell used={b.emergency.used} total={b.emergency.entitled} /></td>
                      <td className="hidden md:table-cell">
                        <span className="text-xs text-gray-400">{b.year}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add Leave Modal ── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddErr('') }}
        title="File Leave for Employee"
        footer={
          <>
            <button onClick={() => { setAddOpen(false); setAddErr('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={submitAdd} disabled={addSaving} className="btn btn-primary">
              {addSaving ? 'Filing…' : addForm.approveNow ? 'File & Approve' : 'File as Pending'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {addErr && (
            <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13,
              background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
              {addErr}
            </div>
          )}

          <div>
            <label className="form-label">Employee <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select
              className="input-base"
              value={addForm.employeeId}
              onChange={e => setAddForm(f => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">— Select employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.fullName} ({e.employeeNo})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Leave Type</label>
            <select
              className="input-base"
              value={addForm.leaveType}
              onChange={e => setAddForm(f => ({ ...f, leaveType: e.target.value }))}
            >
              {Object.entries(LEAVE_TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="date" className="input-base"
                value={addForm.startDate}
                onChange={e => setAddForm(f => ({
                  ...f, startDate: e.target.value,
                  endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
                }))}
              />
            </div>
            <div>
              <label className="form-label">End Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="date" className="input-base"
                value={addForm.endDate}
                min={addForm.startDate}
                onChange={e => setAddForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          {addDays > 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -8 }}>
              📅 {addDays} day{addDays !== 1 ? 's' : ''} off
            </p>
          )}

          <div>
            <label className="form-label">Reason <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>optional</span></label>
            <textarea
              className="input-base"
              style={{ height: 72, resize: 'none' }}
              value={addForm.reason}
              onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Reason for the leave…"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 14px', borderRadius: 10,
            background: addForm.approveNow ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
            border: `1px solid ${addForm.approveNow ? 'var(--color-primary-medium)' : 'var(--color-border)'}`,
          }}>
            <input
              type="checkbox"
              checked={addForm.approveNow}
              onChange={e => setAddForm(f => ({ ...f, approveNow: e.target.checked }))}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: addForm.approveNow ? 'var(--color-primary)' : 'var(--color-text)' }}>
                Approve immediately
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {addForm.approveNow
                  ? 'Leave balance will be deducted and attendance records created'
                  : 'Leave will be saved as pending — approve it separately'}
              </p>
            </div>
          </label>
        </div>
      </Modal>

      {/* Action Modal */}
      <Modal
        open={!!acting}
        onClose={() => setActing(null)}
        title={actionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        footer={
          <>
            <button onClick={() => setActing(null)} className="btn btn-secondary">Cancel</button>
            <button
              onClick={saveAction}
              disabled={saving}
              className={actionType === 'approve' ? 'btn btn-primary' : 'btn btn-danger'}
            >
              {saving ? 'Saving…' : actionType === 'approve' ? 'Approve Leave' : 'Reject Leave'}
            </button>
          </>
        }
      >
        {acting && (
          <div className="space-y-4">
            <div
              className="p-3"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8 }}
            >
              <p className="text-sm font-semibold text-gray-800">{acting.employeeName}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {LEAVE_TYPE_LABEL[acting.leaveType]} leave ·{' '}
                {acting.startDate}{acting.startDate !== acting.endDate ? ` – ${acting.endDate}` : ''} ·{' '}
                {days(acting)} day{days(acting) !== 1 ? 's' : ''}
              </p>
              {acting.reason && (
                <p className="text-[11px] text-gray-400 mt-1.5 italic">"{acting.reason}"</p>
              )}
            </div>

            <div>
              <label className="form-label">
                Remarks{' '}
                <span className="text-gray-300 font-normal normal-case text-[11px]">(optional)</span>
              </label>
              <textarea
                className="input-base"
                style={{ height: '80px', resize: 'none' }}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={actionType === 'approve'
                  ? 'Any notes for the employee…'
                  : 'Reason for rejection…'}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function BalanceCell({ used, total }: { used: number; total: number }) {
  const remaining = total - used
  const pct       = total > 0 ? (used / total) * 100 : 0
  const isLow     = pct > 70

  return (
    <div style={{ minWidth: '80px' }}>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-sm font-bold tabular-nums ${isLow ? 'text-amber-600' : 'text-gray-800'}`}>
          {remaining}
        </span>
        <span className="text-[11px] text-gray-400">/{total}</span>
      </div>
      <div className="h-1 mt-1 bg-gray-100" style={{ borderRadius: '999px' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: isLow ? 'var(--color-warning)' : 'var(--color-primary)',
            borderRadius: '999px',
          }}
        />
      </div>
    </div>
  )
}
