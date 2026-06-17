import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Users, Edit2, Trash2, Eye,
  SlidersHorizontal, Filter, ChevronDown,
  Clock, Layers, UserCircle,
} from 'lucide-react'
import { PageHeader }    from '../../components/ui/PageHeader'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import { EmptyState }    from '../../components/ui/EmptyState'
import { SearchInput }   from '../../components/ui/SearchInput'
import { BatchActionBar } from '../../components/ui/BatchActionBar'
import { Modal }         from '../../components/ui/Modal'
import { useData }       from '../../hooks/useData'
import {
  apiGetEmployees, apiDeleteEmployee, apiGetDepartments,
  apiBatchUpdateEmployeeStatus, apiBatchUpdateEmployeeShift,
  apiGetShifts, apiUpdateEmployee, loadPayrollComponents,
} from '../../lib/db'
import { useUIStore }    from '../../store/uiStore'
import { useAuthStore }  from '../../store/authStore'
import { usePermission } from '../../lib/permissions'
import type { Employee, Department, WorkShift, PayrollComponent } from '../../types'

const STATUS_PILL: Record<string, string> = {
  active:     'pill pill-green',
  inactive:   'pill pill-gray',
  resigned:   'pill pill-yellow',
  terminated: 'pill pill-red',
  awol:       'pill pill-orange',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', inactive: 'Inactive', resigned: 'Resigned',
  terminated: 'Terminated', awol: 'AWOL',
}
const TYPE_PILL: Record<string, string> = {
  regular:      'pill pill-blue',
  probationary: 'pill pill-indigo',
  contractual:  'pill pill-purple',
  'part-time':  'pill pill-gray',
}
const TYPE_LABEL: Record<string, string> = {
  regular: 'Regular', probationary: 'Probationary',
  contractual: 'Contractual', 'part-time': 'Part-Time',
}
const COMP_LABEL: Record<string, string> = {
  monthly: '/mo', weekly: '/wk', daily: '/day',
}

// Deterministic avatar color from employee ID
const AVATAR_PALETTE = [
  '#1a56db','#0d9488','#7c3aed','#be185d',
  '#b45309','#15803d','#1d4ed8','#9d174d',
  '#0891b2','#6d28d9','#b91c1c','#065f46',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

export function EmployeeList() {
  const navigate   = useNavigate()
  const addToast   = useUIStore(s => s.addToast)
  const openConfirm = useUIStore(s => s.openConfirm)
  const { user }   = useAuthStore()
  const canCreate  = usePermission('emp_create')
  const canEdit    = usePermission('emp_edit')
  const canDelete  = usePermission('emp_delete')
  const [search,      setSearch]      = useState('')
  const [dept,        setDept]        = useState('all')
  const [status,      setStatus]      = useState('all')
  const [type,        setType]        = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // ── Batch selection ───────────────────────────────────────────────────────
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [batchSaving, setBatchSaving] = useState(false)

  // Status dropdown open state
  const [statusDropOpen, setStatusDropOpen] = useState(false)
  const statusDropRef = useRef<HTMLDivElement>(null)

  // Assign shift modal
  const [shiftModal,    setShiftModal]    = useState(false)
  const [selShiftId,    setSelShiftId]    = useState('')

  // Set components modal
  const [compModal,        setCompModal]     = useState(false)
  const [compAction,       setCompAction]    = useState<'add'|'remove'>('add')
  const [selCompId,        setSelCompId]     = useState('')
  const [compFixedAmt,     setCompFixedAmt]  = useState('')
  const [compPct,          setCompPct]       = useState('')

  // Shift + component template lists
  const { data: shifts }           = useData<WorkShift[]>(() => apiGetShifts(), [])
  const { data: compTplRaw }       = useData<PayrollComponent[]>(() => loadPayrollComponents(), [])
  const componentTemplates         = compTplRaw ?? []

  // Auto-select first template when list loads
  useEffect(() => {
    if (componentTemplates.length && !selCompId)
      setSelCompId(componentTemplates[0].id)
  }, [componentTemplates, selCompId])

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusDropOpen) return
    const handler = (e: MouseEvent) => {
      if (statusDropRef.current && !statusDropRef.current.contains(e.target as Node))
        setStatusDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [statusDropOpen])

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleSelectAll = (ids: string[], checked: boolean) =>
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => checked ? s.add(id) : s.delete(id)); return s })

  const batchSetStatus = async (newStatus: Employee['status'], label: string) => {
    if (!selected.size || batchSaving) return
    setStatusDropOpen(false)
    setBatchSaving(true)
    try {
      const { ok, fail } = await apiBatchUpdateEmployeeStatus([...selected], newStatus, user?.name ?? 'System')
      setSelected(new Set())
      refetch()
      addToast({
        type: fail > 0 ? 'warning' : 'success',
        title: `Batch ${label}`,
        message: `${ok} employee${ok !== 1 ? 's' : ''} marked as ${label.toLowerCase()}${fail > 0 ? `. ${fail} failed.` : '.'}`,
      })
    } finally {
      setBatchSaving(false)
    }
  }

  const batchAssignShift = async () => {
    if (!selected.size || !selShiftId || batchSaving) return
    setBatchSaving(true)
    const shiftName = shifts?.find(s => s.id === selShiftId)?.name ?? selShiftId
    try {
      const { ok, fail } = await apiBatchUpdateEmployeeShift([...selected], selShiftId, user?.name ?? 'System')
      setShiftModal(false)
      setSelShiftId('')
      setSelected(new Set())
      refetch()
      addToast({
        type: fail > 0 ? 'warning' : 'success',
        title: 'Shift Assigned',
        message: `${ok} employee${ok !== 1 ? 's' : ''} assigned to "${shiftName}"${fail > 0 ? `. ${fail} failed.` : '.'}`,
      })
    } finally {
      setBatchSaving(false)
    }
  }

  const batchSetComponent = async () => {
    if (!selected.size || batchSaving) return
    setBatchSaving(true)
    const tpl = componentTemplates.find(t => t.id === selCompId)
    if (!tpl) { setBatchSaving(false); return }

    const fixedAmt = compFixedAmt !== '' ? Number(compFixedAmt) : tpl.fixedAmount
    const pctRate  = compPct      !== '' ? Number(compPct)      : tpl.percentageRate

    // Spread all template fields so affectsGross, isTaxable, calcBasis etc. come from the real template
    const newComp: PayrollComponent = {
      ...tpl,
      fixedAmount:    fixedAmt,
      percentageRate: pctRate,
      isActive:       true,
    }

    const empList = employees?.filter(e => selected.has(e.id)) ?? []
    let ok = 0, fail = 0
    for (const emp of empList) {
      try {
        const existing: typeof newComp[] = Array.isArray(emp.payrollComponents) ? emp.payrollComponents as typeof newComp[] : []
        let updated: typeof newComp[]
        if (compAction === 'add') {
          updated = existing.some(c => c.id === tpl.id)
            ? existing.map(c => c.id === tpl.id ? { ...c, ...newComp } : c)
            : [...existing, newComp]
        } else {
          updated = existing.filter(c => c.id !== tpl.id)
        }
        await apiUpdateEmployee(emp.id, { payrollComponents: updated })
        ok++
      } catch { fail++ }
    }

    setCompModal(false)
    setSelected(new Set())
    setCompFixedAmt('')
    setCompPct('')
    refetch()
    addToast({
      type: fail > 0 ? 'warning' : 'success',
      title: compAction === 'add' ? 'Component Added' : 'Component Removed',
      message: `${ok} employee${ok !== 1 ? 's' : ''} updated${fail > 0 ? `. ${fail} failed.` : '.'}`,
    })
    setBatchSaving(false)
  }

  const { data: deptList } = useData<Department[]>(() => apiGetDepartments(), [])
  const { data: employees, loading, refetch } = useData(
    () => apiGetEmployees({ search, department: dept, status }),
    [search, dept, status],
  )

  // Client-side type filter
  const filtered = (employees ?? []).filter(e =>
    type === 'all' || e.employmentType === type
  )

  const handleDelete = async (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = await new Promise<boolean>(resolve =>
      openConfirm({
        title: `Delete ${emp.fullName}?`,
        description: 'This will permanently remove the employee and all their records. This cannot be undone.',
        confirmLabel: 'Delete Employee',
        cancelLabel: 'Cancel',
        variant: 'destructive',
        resolve,
      })
    )
    if (!confirmed) return
    try {
      await apiDeleteEmployee(emp.id)
      refetch()
      addToast({ type: 'success', title: 'Employee Deleted', message: `${emp.fullName} has been removed.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Delete Employee', message: err instanceof Error ? err.message : 'Something went wrong.' })
    }
  }

  const total     = filtered.length
  const active    = filtered.filter(e => e.status === 'active').length
  const inactive  = total - active
  const activeFilters = [dept !== 'all', status !== 'all', type !== 'all'].filter(Boolean).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employee Directory"
        subtitle={`${total} employee${total !== 1 ? 's' : ''}${dept !== 'all' ? ` · ${dept}` : ''} · ${active} active`}
        actions={canCreate ? [
          { label: 'Add Employee', icon: Plus, onClick: () => navigate('/employees/new') },
        ] : []}
      />

      {/* ── Toolbar ── */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {/* Search */}
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, ID, designation…"
            className="flex-1"
          />

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn btn-secondary ${showFilters ? 'border-brand text-brand' : ''}`}
            style={showFilters ? { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-light)' } : {}}
          >
            <SlidersHorizontal style={{ width: 13, height: 13 }} />
            Filters
            {activeFilters > 0 && (
              <span
                className="flex items-center justify-center text-white font-bold"
                style={{
                  width: 16, height: 16,
                  background: 'var(--color-primary)',
                  borderRadius: 999,
                  fontSize: 9,
                }}
              >
                {activeFilters}
              </span>
            )}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Stats */}
          <div
            className="hidden md:flex items-center gap-3"
            style={{ paddingLeft: 12, borderLeft: '1px solid var(--color-border)' }}
          >
            <span className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              <span className="text-gray-500">{active} active</span>
            </span>
            {inactive > 0 && (
              <span className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                <span className="text-gray-400">{inactive} inactive</span>
              </span>
            )}
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div
            className="flex flex-wrap items-end gap-3 px-3 py-2.5"
            style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
          >
            {/* Designation */}
            <div>
              <label className="data-label block mb-1">Designation</label>
              <select
                value={dept}
                onChange={e => setDept(e.target.value)}
                className="input-base input-sm"
                style={{ width: 180 }}
              >
                <option value="all">All Designations</option>
                {(deptList ?? []).map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="data-label block mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="input-base input-sm"
                style={{ width: 140 }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
                <option value="awol">AWOL</option>
              </select>
            </div>

            {/* Employment type */}
            <div>
              <label className="data-label block mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="input-base input-sm"
                style={{ width: 150 }}
              >
                <option value="all">All Types</option>
                <option value="regular">Regular</option>
                <option value="probationary">Probationary</option>
                <option value="contractual">Contractual</option>
                <option value="part-time">Part-Time</option>
              </select>
            </div>

            {activeFilters > 0 && (
              <button
                onClick={() => { setDept('all'); setStatus('all'); setType('all') }}
                className="text-red-500 hover:text-red-700 font-medium transition-colors"
                style={{ fontSize: 11, marginBottom: 1 }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Batch action bar ── */}
      {canEdit && (
        <BatchActionBar
          count={selected.size}
          noun="employee"
          onClear={() => { setSelected(new Set()); setStatusDropOpen(false) }}
          actions={[]}
        >
          {/* ── Status dropdown ── */}
          <div ref={statusDropRef} style={{ position: 'relative' }}>
            <button
              disabled={batchSaving}
              onClick={() => setStatusDropOpen(v => !v)}
              className="inline-flex items-center gap-1.5 font-semibold"
              style={{
                fontSize: 12, height: 30, padding: '0 12px', borderRadius: 8,
                background: 'var(--color-primary)', color: '#fff', border: 'none',
                opacity: batchSaving ? 0.5 : 1, cursor: batchSaving ? 'not-allowed' : 'pointer',
              }}
            >
              <UserCircle style={{ width: 12, height: 12 }} />
              {batchSaving ? 'Saving…' : 'Set Status'}
              <ChevronDown style={{ width: 11, height: 11, marginLeft: 1, transition: 'transform 0.15s', transform: statusDropOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {statusDropOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                  background: '#fff', borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                  minWidth: 160, overflow: 'hidden',
                }}
              >
                {([
                  { value: 'active',     label: 'Active',     color: 'var(--color-success)' },
                  { value: 'inactive',   label: 'Inactive',   color: 'var(--color-text-muted)' },
                  { value: 'resigned',   label: 'Resigned',   color: 'var(--color-warning)' },
                  { value: 'terminated', label: 'Terminated', color: 'var(--color-danger)' },
                  { value: 'awol',       label: 'AWOL',       color: '#F97316' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => batchSetStatus(opt.value, opt.label)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                    style={{ fontSize: 13, color: 'var(--color-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0, display: 'inline-block' }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Assign Shift ── */}
          <button
            disabled={batchSaving}
            onClick={() => setShiftModal(true)}
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{
              fontSize: 12, height: 30, padding: '0 12px', borderRadius: 8,
              background: 'var(--color-surface-2)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              opacity: batchSaving ? 0.5 : 1, cursor: batchSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <Clock style={{ width: 12, height: 12 }} />
            Assign Shift
          </button>

          {/* ── Set Components ── */}
          <button
            disabled={batchSaving}
            onClick={() => setCompModal(true)}
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{
              fontSize: 12, height: 30, padding: '0 12px', borderRadius: 8,
              background: 'var(--color-surface-2)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              opacity: batchSaving ? 0.5 : 1, cursor: batchSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <Layers style={{ width: 12, height: 12 }} />
            Set Components
          </button>
        </BatchActionBar>
      )}

      {/* ── Assign Shift Modal ── */}
      <Modal
        open={shiftModal}
        onClose={() => { setShiftModal(false); setSelShiftId('') }}
        title={`Assign Shift — ${selected.size} employee${selected.size !== 1 ? 's' : ''}`}
        footer={
          <>
            <button onClick={() => { setShiftModal(false); setSelShiftId('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={batchAssignShift} disabled={!selShiftId || batchSaving} className="btn btn-primary">
              {batchSaving ? 'Assigning…' : 'Assign Shift'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Select a shift schedule to assign to all {selected.size} selected employee{selected.size !== 1 ? 's' : ''}.
          </p>
          {(shifts ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-warning)' }}>
              No shifts defined yet. Create shifts in Schedules → Shifts first.
            </p>
          ) : (
            <div className="space-y-1.5">
              {(shifts ?? []).map(sh => (
                <label
                  key={sh.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${selShiftId === sh.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: selShiftId === sh.id ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
                  }}
                >
                  <input
                    type="radio"
                    name="batchShift"
                    value={sh.id}
                    checked={selShiftId === sh.id}
                    onChange={() => setSelShiftId(sh.id)}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{sh.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      {sh.timeIn} – {sh.timeOut} · {sh.breakMinutes}min break
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Set Components Modal ── */}
      <Modal
        open={compModal}
        onClose={() => { setCompModal(false); setCompFixedAmt(''); setCompPct('') }}
        title={`Set Component — ${selected.size} employee${selected.size !== 1 ? 's' : ''}`}
        footer={
          <>
            <button onClick={() => { setCompModal(false); setCompFixedAmt(''); setCompPct('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={batchSetComponent} disabled={batchSaving} className={compAction === 'remove' ? 'btn btn-danger' : 'btn btn-primary'}>
              {batchSaving ? 'Saving…' : compAction === 'add' ? 'Add to Employees' : 'Remove from Employees'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Action toggle */}
          <div className="flex gap-2">
            {(['add','remove'] as const).map(a => (
              <button
                key={a}
                onClick={() => setCompAction(a)}
                className="flex-1 py-2 font-semibold transition-colors"
                style={{
                  borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer',
                  background: compAction === a ? (a === 'add' ? 'var(--color-primary)' : 'var(--color-danger)') : 'var(--color-surface-2)',
                  color: compAction === a ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                {a === 'add' ? '+ Add Component' : '− Remove Component'}
              </button>
            ))}
          </div>

          {/* Component selector — live templates from Settings → Components */}
          <div>
            <label className="form-label">Component</label>
            {componentTemplates.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                No templates found — add component templates in <strong>Settings → Components</strong> first.
              </p>
            ) : (
              <select
                className="input-base"
                value={selCompId}
                onChange={e => { setSelCompId(e.target.value); setCompFixedAmt(''); setCompPct('') }}
              >
                {componentTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            )}
          </div>

          {/* Amount override (add only) */}
          {compAction === 'add' && (() => {
            const tpl = componentTemplates.find(t => t.id === selCompId)
            if (!tpl) return null
            return (
              <div>
                {tpl.calcType === 'fixed' && (
                  <div>
                    <label className="form-label">
                      Amount (₱)
                      <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                        template default: ₱{tpl.fixedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </label>
                    <input
                      type="number" step="0.01" className="input-base"
                      placeholder={tpl.fixedAmount.toFixed(2)}
                      value={compFixedAmt}
                      onChange={e => setCompFixedAmt(e.target.value)}
                    />
                  </div>
                )}
                {tpl.calcType === 'percentage' && (
                  <div>
                    <label className="form-label">
                      Rate (%)
                      <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                        template default: {(tpl.percentageRate * 100).toFixed(2)}%
                      </span>
                    </label>
                    <input
                      type="number" step="0.01" className="input-base"
                      placeholder={(tpl.percentageRate * 100).toFixed(2)}
                      value={compPct}
                      onChange={e => setCompPct(e.target.value)}
                    />
                  </div>
                )}
                {tpl.calcType === 'bracket' && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                    Bracket-based — amounts are computed automatically from salary brackets per payroll run.
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  This component will be added or updated on all {selected.size} selected employees.
                  Existing employees who already have this component will have their amount updated.
                </p>
              </div>
            )
          })()}

          {compAction === 'remove' && (
            <p style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
              This will remove the selected component from all {selected.size} employees. Employees who don't have it will be skipped.
            </p>
          )}
        </div>
      </Modal>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="spinner" />
          </div>
        ) : !filtered.length ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            description={
              search || dept !== 'all' || status !== 'all' || type !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Add your first employee to get started.'
            }
            action={
              !search && dept === 'all' && status === 'all' && type === 'all'
                ? { label: 'Add Employee', onClick: () => navigate('/employees/new') }
                : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    {canEdit && (
                      <th style={{ width: 36, paddingLeft: 16 }}>
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every(e => selected.has(e.id))}
                          onChange={ev => toggleSelectAll(filtered.map(e => e.id), ev.target.checked)}
                          title="Select all visible"
                        />
                      </th>
                    )}
                    <th>Employee</th>
                    <th className="hidden md:table-cell">Designation</th>
                    <th className="hidden lg:table-cell">Type</th>
                    <th className="hidden xl:table-cell">Salary</th>
                    <th>Status</th>
                    <th style={{ width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => {
                    const bgColor = avatarColor(emp.id)
                    const compSuffix = COMP_LABEL[emp.compensationType ?? 'monthly'] ?? '/mo'
                    return (
                      <tr
                        key={emp.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        style={selected.has(emp.id) ? { background: 'var(--color-primary-light)' } : undefined}
                      >
                        {canEdit && (
                          <td style={{ paddingLeft: 16 }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(emp.id)}
                              onChange={() => toggleSelect(emp.id)}
                            />
                          </td>
                        )}
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="avatar avatar-sm flex-shrink-0"
                              style={{ background: bgColor }}
                            >
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div>
                              <p className="font-semibold leading-none" style={{ fontSize: 12.5, color: 'var(--color-text)' }}>
                                {emp.fullName}
                              </p>
                              <p className="mt-0.5" style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                                {emp.employeeNo}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="hidden md:table-cell">
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                            {emp.position || emp.department || '—'}
                          </span>
                        </td>

                        <td className="hidden lg:table-cell">
                          <span className={TYPE_PILL[emp.employmentType ?? 'regular'] ?? 'pill pill-gray'}>
                            {TYPE_LABEL[emp.employmentType ?? 'regular'] ?? emp.employmentType}
                          </span>
                        </td>

                        <td className="hidden xl:table-cell">
                          <span className="font-semibold tabular-nums" style={{ fontSize: 12, color: 'var(--color-text)' }}>
                            ₱{emp.basicSalary.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: 10 }}>{compSuffix}</span>
                          </span>
                        </td>

                        <td>
                          <span className={STATUS_PILL[emp.status] ?? 'pill pill-gray'}>
                            {STATUS_LABEL[emp.status] ?? emp.status}
                          </span>
                        </td>

                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <ActionIconBtn variant="view"   icon={Eye}   onClick={() => navigate(`/employees/${emp.id}`)}         title="View profile" />
                            {canEdit   && <ActionIconBtn variant="edit"   icon={Edit2}  onClick={() => navigate(`/employees/${emp.id}/edit`)} title="Edit employee" />}
                            {canDelete && <ActionIconBtn variant="delete" icon={Trash2} onClick={e => handleDelete(emp, e)}                   title="Delete employee" />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
            >
              <div className="flex items-center gap-1.5">
                <Filter style={{ width: 11, height: 11, color: 'var(--color-text-muted)' }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {total} employee{total !== 1 ? 's' : ''} shown
                  {activeFilters > 0 && (
                    <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}> (filtered)</span>
                  )}
                </span>
              </div>
              <button
                onClick={() => navigate('/employees/new')}
                className="flex items-center gap-1 text-brand font-semibold hover:underline"
                style={{ fontSize: 11 }}
              >
                <Plus style={{ width: 11, height: 11 }} /> Add employee
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
