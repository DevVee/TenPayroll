import { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, Plus } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BatchActionBar } from '../../components/ui/BatchActionBar'
import { useData } from '../../hooks/useData'
import { apiGetOvertime, apiUpdateOvertimeStatus, apiBatchUpdateOvertimeStatus, apiCreateOvertime, apiGetEmployees } from '../../lib/db'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import type { OvertimeRequest, Employee } from '../../types'

const OT_TYPES = [
  { value: 'regular-ot',  label: 'Regular Overtime'  },
  { value: 'rest-day-ot', label: 'Rest Day Overtime'  },
  { value: 'holiday-ot',  label: 'Holiday Overtime'   },
  { value: 'special-ot',  label: 'Special Overtime'   },
]

export function OvertimeList() {
  const user     = useAuthStore(s => s.user)
  const addToast = useUIStore(s => s.addToast)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: otList, loading, refetch } = useData(
    () => apiGetOvertime({ status: statusFilter !== 'all' ? statusFilter as OvertimeRequest['status'] : undefined }),
    [statusFilter]
  )

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
    const { ok, fail } = await apiBatchUpdateOvertimeStatus([...selected], status, user?.name ?? 'System')
    setSelected(new Set())
    refetch()
    addToast({
      type: fail > 0 ? 'warning' : 'success',
      title: `Batch ${label}`,
      message: `${ok} overtime request${ok !== 1 ? 's' : ''} ${label.toLowerCase()}${fail > 0 ? `. ${fail} failed.` : '.'}`,
    })
    setBatchSaving(false)
  }
  const handleBatchApprove = () => runBatch('approved', 'Approved')
  const handleBatchReject  = () => runBatch('rejected', 'Rejected')

  // ── Add-overtime modal ────────────────────────────────────────────────────
  const [addOpen,   setAddOpen]   = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [addForm,   setAddForm]   = useState({
    employeeId: '', date: new Date().toISOString().split('T')[0],
    hours: '', overtimeType: 'regular-ot', reason: '', approveNow: true,
  })
  const [addSaving, setAddSaving] = useState(false)
  const [addErr,    setAddErr]    = useState('')

  useEffect(() => {
    if (addOpen && employees.length === 0)
      apiGetEmployees().then(e => setEmployees(e.filter(x => x.status === 'active')))
  }, [addOpen, employees.length])

  const submitAdd = async () => {
    setAddErr('')
    if (!addForm.employeeId)           { setAddErr('Select an employee.'); return }
    if (!addForm.date)                 { setAddErr('Date is required.'); return }
    const hrs = Number(addForm.hours)
    if (!hrs || hrs <= 0 || hrs > 24) { setAddErr('Hours must be between 0.5 and 24.'); return }
    const emp = employees.find(e => e.id === addForm.employeeId)
    if (!emp) return
    setAddSaving(true)
    try {
      const ot = await apiCreateOvertime({
        employeeId:     emp.id,
        employeeName:   emp.fullName,
        employeeNo:     emp.employeeNo,
        department:     emp.department ?? '',
        date:           addForm.date,
        hoursRequested: hrs,
        overtimeType:   addForm.overtimeType,
        reason:         addForm.reason || 'Filed by admin',
      }, user?.name)
      if (addForm.approveNow) {
        await apiUpdateOvertimeStatus(ot.id, 'approved', user?.name)
      }
      setAddOpen(false)
      setAddForm({ employeeId: '', date: new Date().toISOString().split('T')[0], hours: '', overtimeType: 'regular-ot', reason: '', approveNow: true })
      refetch()
      addToast({
        type: 'success',
        title: 'Overtime Filed',
        message: `${emp.fullName}'s ${hrs}h OT on ${addForm.date} ${addForm.approveNow ? 'filed and approved' : 'filed as pending'}.`,
      })
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : 'Failed to file overtime.')
    } finally {
      setAddSaving(false)
    }
  }

  const [acting,     setActing]     = useState<OvertimeRequest | null>(null)
  const [actionType, setActionType] = useState<'approve'|'reject'>('approve')
  const [remarks,    setRemarks]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const filtered = (otList ?? []).filter(r => {
    const q = search.toLowerCase()
    return !search || r.employeeName.toLowerCase().includes(q) || r.employeeNo.toLowerCase().includes(q)
  })

  const all       = otList ?? []
  const pending   = all.filter(r => r.status === 'pending').length
  const approved  = all.filter(r => r.status === 'approved').length
  const totalHrs  = all.filter(r => r.status === 'approved').reduce((s,r) => s + r.hoursRequested, 0)

  const openAction = (r: OvertimeRequest, type: 'approve'|'reject') => {
    setActing(r); setActionType(type); setRemarks('')
  }

  const saveAction = async () => {
    if (!acting) return
    setSaving(true)
    try {
      await apiUpdateOvertimeStatus(acting.id, actionType === 'approve' ? 'approved' : 'rejected', user?.name)
      setActing(null)
      refetch()
      addToast({ type: 'success', title: actionType === 'approve' ? 'OT Approved' : 'OT Rejected', message: `${acting.employeeName}'s overtime request has been ${actionType === 'approve' ? 'approved' : 'rejected'}.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Action Failed', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overtime Requests"
        subtitle="Review and approve employee overtime"
        actions={[{ label: 'Add Overtime', icon: Plus, onClick: () => setAddOpen(true) }]}
      />

      {/* ── Summary strip ── */}
      <div
        className="grid grid-cols-3 bg-white"
        style={{ border: '1px solid var(--color-border)', borderRadius: 14, overflow: 'hidden' }}
      >
        {[
          { label: 'Pending',        value: pending,                  color: 'var(--color-warning)' },
          { label: 'Approved',       value: approved,                 color: 'var(--color-success)' },
          { label: 'Total OT Hours', value: `${totalHrs.toFixed(1)}h`, color: 'var(--color-primary)' },
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

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search employee…"
            className="flex-1"
          />
          <div className="flex items-center gap-1">
            {(['all','pending','approved','rejected'] as const).map(s => (
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
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="spinner" />
          </div>
        ) : !filtered.length ? (
          <EmptyState
            icon={Clock}
            title="No overtime requests"
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
                    <th>Date</th>
                    <th className="hidden md:table-cell">Type</th>
                    <th>Hours</th>
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
                        <p className="text-[11px] text-gray-400 mt-0.5">{r.employeeNo}</p>
                      </td>
                      <td>
                        <span className="text-sm tabular-nums text-gray-700">{r.date}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-sm text-gray-600">
                          {r.overtimeType
                            ? r.overtimeType.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase())
                            : 'Regular OT'}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-semibold text-gray-800 tabular-nums">{r.hoursRequested}h</span>
                      </td>
                      <td className="hidden lg:table-cell" style={{ maxWidth: '200px' }}>
                        <span className="text-sm text-gray-500 line-clamp-1">{r.reason}</span>
                      </td>
                      <td>
                        <StatusBadge type="overtime" status={r.status}>
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
                {pending > 0 && ` · ${pending} pending review`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Add Overtime Modal ── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setAddErr('') }}
        title="File Overtime for Employee"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="date" className="input-base"
                value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Hours Worked OT <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="number" step="0.5" min="0.5" max="24" className="input-base"
                value={addForm.hours}
                onChange={e => setAddForm(f => ({ ...f, hours: e.target.value }))}
                placeholder="e.g. 2"
              />
            </div>
          </div>

          <div>
            <label className="form-label">OT Type</label>
            <select
              className="input-base"
              value={addForm.overtimeType}
              onChange={e => setAddForm(f => ({ ...f, overtimeType: e.target.value }))}
            >
              {OT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Reason <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>optional</span></label>
            <textarea
              className="input-base"
              style={{ height: 72, resize: 'none' }}
              value={addForm.reason}
              onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Why the overtime was rendered…"
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
                  ? 'OT hours will count in the next payroll computation'
                  : 'Saved as pending — approve it separately'}
              </p>
            </div>
          </label>
        </div>
      </Modal>

      {/* Action Modal */}
      <Modal
        open={!!acting}
        onClose={() => setActing(null)}
        title={actionType === 'approve' ? 'Approve Overtime' : 'Reject Overtime'}
        footer={
          <>
            <button onClick={() => setActing(null)} className="btn btn-secondary">Cancel</button>
            <button
              onClick={saveAction}
              disabled={saving}
              className={actionType === 'approve' ? 'btn btn-primary' : 'btn btn-danger'}
            >
              {saving ? 'Saving…' : actionType === 'approve' ? 'Approve OT' : 'Reject OT'}
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
                {acting.date} · {acting.hoursRequested} hours overtime
              </p>
              {acting.reason && (
                <p className="text-[11px] text-gray-400 mt-1 italic">"{acting.reason}"</p>
              )}
            </div>

            <div>
              <label className="form-label">
                Remarks{' '}
                <span className="text-gray-300 font-normal normal-case text-[11px]">(optional)</span>
              </label>
              <textarea
                className="input-base"
                style={{ height: '72px', resize: 'none' }}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={actionType === 'approve' ? 'Any notes…' : 'Reason for rejection…'}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
