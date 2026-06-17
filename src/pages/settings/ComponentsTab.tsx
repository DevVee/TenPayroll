// ComponentsTab.tsx — Component Templates (master catalog, push to employees)

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Info, ToggleLeft, ToggleRight, Send, Users, Search } from 'lucide-react'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import {
  loadPayrollComponents,
  apiCreatePayrollComponent, apiUpdatePayrollComponent,
  apiDeletePayrollComponent, apiTogglePayrollComponent,
  apiGetEmployees, apiUpdateEmployee,
  apiGetDepartments,
} from '../../lib/db'
import { useUIStore } from '../../store/uiStore'
import type { PayrollComponent, CalcType } from '../../types'

// ── Shared constants ───────────────────────────────────────────────────────────
const CATEGORY_OPTS: { value: PayrollComponent['category']; label: string; hint: string }[] = [
  { value: 'earning',      label: 'Earning',      hint: 'Added to gross pay (e.g. overtime bonus, incentive)' },
  { value: 'allowance',    label: 'Allowance',    hint: 'Added to gross, usually non-taxable (rice, transport)' },
  { value: 'benefit',      label: 'Benefit',      hint: 'Added to gross, often taxable (13th month, HMO)' },
  { value: 'deduction',    label: 'Deduction',    hint: 'Subtracted from net pay (loan repayment, cash bond)' },
  { value: 'contribution', label: 'Contribution', hint: 'Subtracted from net, may have employer share' },
  { value: 'tax',          label: 'Tax',          hint: 'Withholding tax on income' },
  { value: 'other',        label: 'Other',        hint: 'User-defined — set sign via category' },
]

const CALC_BASIS_OPTS = [
  { value: 'basic_pay',      label: 'Basic Pay'    },
  { value: 'gross_earnings', label: 'Gross Pay'    },
  { value: 'taxable_gross',  label: 'Taxable Gross'},
]

const GROSS_CATS: PayrollComponent['category'][] = ['earning', 'allowance', 'benefit']

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)
}

const BLANK: Omit<PayrollComponent, 'id'> = {
  name: '', code: '', description: '',
  category: 'allowance', calcType: 'fixed',
  fixedAmount: 0, percentageRate: 0.05,
  calcBasis: 'basic_pay',
  employeeShareRate: 1, employerShareRate: 0,
  isTaxable: false, affectsGross: true,
  isActive: true, priority: 50,
  deductionFrequency: 'every_payroll',  // kept for data compat, not shown in UI
}

// ── Mini toggle ────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 38, height: 21, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
        background: checked ? 'var(--color-primary)' : 'var(--color-border-strong)',
        position: 'relative', transition: 'background 0.18s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2.5, left: checked ? 19 : 2.5,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.18)', transition: 'left 0.15s',
      }} />
    </div>
  )
}

// ── Pill button ────────────────────────────────────────────────────────────────
function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary-light)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT MODAL — create / edit a template
   ══════════════════════════════════════════════════════════════════════════════ */
function ComponentModal({
  initial, onSave, onClose,
}: {
  initial: PayrollComponent | null
  onSave:  (data: Omit<PayrollComponent, 'id'>) => Promise<void>
  onClose: () => void
}) {
  const [form,   setForm]   = useState<Omit<PayrollComponent, 'id'>>(initial ?? { ...BLANK })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const patch = (p: Partial<typeof form>) => setForm(s => ({ ...s, ...p }))

  const handleName = (name: string) => {
    patch({ name, code: initial ? form.code : slugify(name) })
  }

  const handleCategory = (cat: PayrollComponent['category']) => {
    patch({ category: cat, affectsGross: GROSS_CATS.includes(cat) })
  }

  const categoryHint = CATEGORY_OPTS.find(o => o.value === form.category)?.hint ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())   { setErr('Name is required.'); return }
    const amount = form.calcType === 'fixed' ? form.fixedAmount : form.percentageRate
    if (!amount || amount <= 0) { setErr('Amount or rate must be greater than 0.'); return }
    setSaving(true); setErr('')
    try {
      await onSave({ ...form, code: form.code || slugify(form.name) })
      onClose()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full overflow-y-auto"
        style={{
          maxWidth: 480, maxHeight: '90vh', borderRadius: 20,
          background: 'var(--color-surface)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
        }}
      >
        {/* Sticky header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0,
          background: 'var(--color-surface)', zIndex: 1,
          borderRadius: '20px 20px 0 0',
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
              {initial ? 'Edit Template' : 'New Component Template'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
              Templates can be pushed to any employee directly from this page
            </p>
          </div>
          <button onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, lineHeight: 0 }}>
            <span style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Name */}
          <div>
            <label className="form-label">
              Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              className="input-base"
              value={form.name}
              onChange={e => handleName(e.target.value)}
              placeholder="e.g. Rice Allowance, Loan Deduction"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="form-label">Category</label>
            <select
              className="input-base"
              value={form.category}
              onChange={e => handleCategory(e.target.value as PayrollComponent['category'])}
            >
              {CATEGORY_OPTS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {categoryHint && (
              <p className="form-hint" style={{
                color: form.affectsGross ? 'var(--color-success, #16a34a)' : 'var(--color-danger)',
              }}>
                {form.affectsGross ? '↑ ' : '↓ '}{categoryHint}
              </p>
            )}
          </div>

          {/* Amount type */}
          <div>
            <label className="form-label">Amount Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Pill active={form.calcType === 'fixed'}      onClick={() => patch({ calcType: 'fixed' as CalcType })}>
                ₱ Fixed Amount
              </Pill>
              <Pill active={form.calcType === 'percentage'} onClick={() => patch({ calcType: 'percentage' as CalcType })}>
                % Percentage
              </Pill>
            </div>
          </div>

          {/* Amount / rate — "Applied To" only shown for percentage */}
          {form.calcType === 'fixed' ? (
            <div>
              <label className="form-label">
                Monthly Amount (₱) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number" step="0.01" min="0" className="input-base"
                value={form.fixedAmount || ''}
                onChange={e => patch({ fixedAmount: Number(e.target.value) })}
                placeholder="0.00"
              />
              <p className="form-hint">Pro-rated per pay period automatically</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">
                  Rate (%) <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="number" step="0.01" min="0" max="100" className="input-base"
                  value={form.percentageRate ? (form.percentageRate * 100).toFixed(2) : ''}
                  onChange={e => patch({ percentageRate: Number(e.target.value) / 100 })}
                  placeholder="e.g. 5 for 5%"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Applied To</label>
                <select
                  className="input-base"
                  value={form.calcBasis}
                  onChange={e => patch({ calcBasis: e.target.value as typeof form.calcBasis })}
                >
                  {CALC_BASIS_OPTS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="form-hint">What the percentage is calculated against</p>
              </div>
            </div>
          )}

          {/* Taxable */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Toggle checked={form.isTaxable} onChange={v => patch({ isTaxable: v })} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Taxable income</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Count this amount toward withholding tax computation
              </p>
            </div>
          </label>

          {err && (
            <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13,
              background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
              border: '1px solid var(--color-danger-border, #FECACA)' }}>
              {err}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Template'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   PUSH-TO-EMPLOYEES MODAL
   ══════════════════════════════════════════════════════════════════════════════ */
interface EmpRow { id: string; fullName: string; employeeNo: string; department?: string; status: string; payrollComponents: PayrollComponent[] }

function PushModal({
  comp,
  onClose,
  onDone,
}: {
  comp:    PayrollComponent
  onClose: () => void
  onDone:  (ok: number, fail: number) => void
}) {
  const addToast = useUIStore(s => s.addToast)

  const [employees,   setEmployees]   = useState<EmpRow[]>([])
  const [depts,       setDepts]       = useState<string[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [deptFilter,  setDeptFilter]  = useState('all')
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [pushing,     setPushing]     = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiGetEmployees({ status: 'active' }),
      apiGetDepartments(),
    ]).then(([emps, deptList]) => {
      setEmployees(emps as EmpRow[])
      setDepts(deptList.map(d => d.name))
      // Pre-select active employees who DON'T already have this component
      const pre = new Set(
        (emps as EmpRow[])
          .filter(e => !((e.payrollComponents ?? []) as PayrollComponent[]).some(c => c.id === comp.id))
          .map(e => e.id)
      )
      setSelected(pre)
      setLoading(false)
    })
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [comp.id])

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return (
      (deptFilter === 'all' || e.department === deptFilter) &&
      (!search || e.fullName.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q))
    )
  })

  const visibleIds     = filtered.map(e => e.id)
  const allVisible     = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const someVisible    = visibleIds.some(id => selected.has(id)) && !allVisible
  const hasExisting    = (e: EmpRow) => (e.payrollComponents ?? [] as PayrollComponent[]).some(c => c.id === comp.id)

  const toggleAll = (checked: boolean) => {
    setSelected(prev => {
      const s = new Set(prev)
      visibleIds.forEach(id => (checked ? s.add(id) : s.delete(id)))
      return s
    })
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const handlePush = async () => {
    if (!selected.size || pushing) return
    setPushing(true)
    let ok = 0, fail = 0

    for (const emp of employees.filter(e => selected.has(e.id))) {
      try {
        const existing = (emp.payrollComponents ?? []) as PayrollComponent[]
        const updated  = existing.some(c => c.id === comp.id)
          ? existing.map(c => c.id === comp.id ? { ...comp } : c)   // update existing
          : [...existing, { ...comp }]                                // add new
        await apiUpdateEmployee(emp.id, { payrollComponents: updated })
        ok++
      } catch { fail++ }
    }

    setPushing(false)
    onDone(ok, fail)
  }

  const amtStr = comp.calcType === 'fixed'
    ? `₱${comp.fixedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}/mo`
    : `${(comp.percentageRate * 100).toFixed(2)}% of ${
        comp.calcBasis === 'basic_pay' ? 'Basic Pay'
      : comp.calcBasis === 'gross_earnings' ? 'Gross Pay'
      : 'Taxable Gross'}`

  void addToast  // used by parent; suppress lint

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full flex flex-col"
        style={{
          maxWidth: 560, height: '82vh', borderRadius: 20,
          background: 'var(--color-surface)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
                Push to Employees
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                  background: comp.affectsGross ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  color: comp.affectsGross ? 'var(--color-success)' : 'var(--color-danger)',
                }}>
                  {comp.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{amtStr}</span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Employees already highlighted already have this component — selecting them will <strong>update</strong> their copy to match the current template values.
              </p>
            </div>
            <button onClick={onClose}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, lineHeight: 0, flexShrink: 0 }}>
              <span style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>✕</span>
            </button>
          </div>

          {/* Search + dept filter */}
          <div className="flex gap-2 mt-3">
            <div className="flex-1 relative">
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--color-text-muted)' }} />
              <input
                ref={searchRef}
                className="input-base input-sm"
                style={{ paddingLeft: 30 }}
                placeholder="Search name or ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {depts.length > 0 && (
              <select
                className="input-base input-sm"
                style={{ width: 160 }}
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '32px 24px', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No employees match your filters.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ width: 40, paddingLeft: 16, paddingTop: 8, paddingBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={allVisible}
                      ref={el => { if (el) el.indeterminate = someVisible }}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px 8px 0' }}>
                    Employee
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px 8px 0' }}>
                    Department
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingRight: 16 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const alreadyHas = hasExisting(e)
                  return (
                    <tr
                      key={e.id}
                      onClick={() => toggle(e.id)}
                      style={{
                        cursor: 'pointer',
                        background: selected.has(e.id)
                          ? 'var(--color-primary-light)'
                          : alreadyHas ? 'var(--color-surface-2)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <td style={{ paddingLeft: 16, paddingTop: 10, paddingBottom: 10 }}>
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                          onClick={ev => ev.stopPropagation()}
                        />
                      </td>
                      <td style={{ padding: '10px 12px 10px 0' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{e.fullName}</p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{e.employeeNo}</p>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)', paddingRight: 12 }}>
                        {e.department ?? '—'}
                      </td>
                      <td style={{ paddingRight: 16 }}>
                        {alreadyHas ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                            Has it
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                            Not set
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--color-surface)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {selected.size} of {employees.length} employee{employees.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              onClick={handlePush}
              disabled={!selected.size || pushing}
              className="btn btn-primary"
            >
              <Send style={{ width: 13, height: 13 }} />
              {pushing ? 'Pushing…' : `Push to ${selected.size} Employee${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENTS TAB
   ══════════════════════════════════════════════════════════════════════════════ */
export function ComponentsTab() {
  const addToast    = useUIStore(s => s.addToast)
  const openConfirm = useUIStore(s => s.openConfirm)

  const [components, setComponents] = useState<PayrollComponent[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState<PayrollComponent | null | 'new'>('close' as never)
  const [pushComp,   setPushComp]   = useState<PayrollComponent | null>(null)
  const [filter,     setFilter]     = useState<'all' | 'earnings' | 'deductions'>('all')

  const load = () => {
    setLoading(true)
    loadPayrollComponents().then(c => { setComponents(c); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const handleSave = async (data: Omit<PayrollComponent, 'id'>) => {
    if (modal === 'new') {
      await apiCreatePayrollComponent(data)
      addToast({ type: 'success', title: 'Template Added', message: `"${data.name}" added. Push it to employees using the → button.` })
    } else if (modal && typeof modal !== 'string') {
      await apiUpdatePayrollComponent(modal.id, data)
      addToast({ type: 'success', title: 'Template Updated', message: `"${data.name}" updated. Use Push to sync employees to the new values.` })
    }
    load()
  }

  const handleDelete = async (comp: PayrollComponent) => {
    const ok = await new Promise<boolean>(resolve => openConfirm({
      title:        `Delete "${comp.name}"?`,
      description:  'Removes this template from the catalog. Employee copies are not affected.',
      confirmLabel: 'Delete',
      cancelLabel:  'Cancel',
      variant:      'destructive',
      resolve,
    }))
    if (!ok) return
    await apiDeletePayrollComponent(comp.id)
    addToast({ type: 'success', title: 'Deleted', message: `"${comp.name}" removed from templates.` })
    load()
  }

  const handleToggle = async (comp: PayrollComponent) => {
    await apiTogglePayrollComponent(comp.id)
    load()
  }

  const handlePushDone = (ok: number, fail: number) => {
    setPushComp(null)
    addToast({
      type: fail > 0 ? 'warning' : 'success',
      title: 'Component Pushed',
      message: `Updated ${ok} employee${ok !== 1 ? 's' : ''}${fail > 0 ? `. ${fail} failed.` : '.'}`,
    })
  }

  const visible = components
    .filter(c => {
      if (filter === 'earnings')   return c.affectsGross
      if (filter === 'deductions') return !c.affectsGross
      return true
    })
    .sort((a, b) => a.priority - b.priority)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.025em' }}>
            Component Templates
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, maxWidth: 520 }}>
            Define reusable earnings and deductions. Use <strong>Push to Employees</strong> to
            assign a template to any set of employees — each employee gets an independent copy
            that can be further customized from their profile.
          </p>
          {components.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              {components.filter(c => c.isActive).length} active
              &nbsp;·&nbsp;{components.filter(c => !c.isActive).length} inactive
              &nbsp;·&nbsp;{components.length} total
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')} style={{ flexShrink: 0 }}>
          <Plus style={{ width: 15, height: 15 }} />
          New Template
        </button>
      </div>

      {/* Filter pills */}
      {components.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { value: 'all',        label: `All (${components.length})` },
            { value: 'earnings',   label: `Earnings (${components.filter(c => c.affectsGross).length})` },
            { value: 'deductions', label: `Deductions (${components.filter(c => !c.affectsGross).length})` },
          ] as const).map(opt => (
            <button
              key={opt.value}
              className={`filter-pill ${filter === opt.value ? 'active' : ''}`}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && components.length === 0 && (
        <div style={{ border: '2px dashed var(--color-border)', borderRadius: 16, padding: '52px 32px', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--color-primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Plus style={{ width: 22, height: 22, color: 'var(--color-primary)' }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            No templates yet
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '8px auto 0', maxWidth: 380 }}>
            Create templates — rice allowance, transportation, SSS contribution — then
            push them to any set of employees in one step.
          </p>
          <button onClick={() => setModal('new')} className="btn btn-primary" style={{ marginTop: 20 }}>
            <Plus style={{ width: 14, height: 14 }} />
            New Template
          </button>
        </div>
      )}

      {/* Component cards */}
      {!loading && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(comp => {
            const isEarning = comp.affectsGross
            const amtStr = comp.calcType === 'fixed'
              ? `₱${comp.fixedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}/mo`
              : `${(comp.percentageRate * 100).toFixed(2)}% of ${
                  comp.calcBasis === 'basic_pay' ? 'Basic Pay'
                : comp.calcBasis === 'gross_earnings' ? 'Gross Pay'
                : 'Taxable Gross'
                }`

            return (
              <div
                key={comp.id}
                className="card"
                style={{
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  opacity: comp.isActive ? 1 : 0.55,
                  transition: 'opacity 0.15s',
                }}
              >
                {/* Active toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle(comp)}
                  title={comp.isActive ? 'Active — click to disable' : 'Inactive — click to enable'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0, flexShrink: 0 }}
                >
                  {comp.isActive
                    ? <ToggleRight style={{ width: 24, height: 24, color: 'var(--color-primary)' }} />
                    : <ToggleLeft  style={{ width: 24, height: 24, color: 'var(--color-text-muted)' }} />
                  }
                </button>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.015em' }}>
                      {comp.name}
                    </p>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: isEarning ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: isEarning ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {isEarning ? '↑ Earning' : '↓ Deduction'}
                    </span>
                    {comp.isTaxable && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: 'var(--color-warning-bg, #FEF9C3)', color: 'var(--color-warning, #CA8A04)',
                      }}>
                        Taxable
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    {CATEGORY_OPTS.find(o => o.value === comp.category)?.label}
                    &nbsp;·&nbsp;<span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{comp.code}</span>
                  </p>
                </div>

                {/* Amount */}
                <p style={{
                  fontSize: 15, fontWeight: 800, flexShrink: 0,
                  color: isEarning ? 'var(--color-success, #16a34a)' : 'var(--color-danger)',
                  letterSpacing: '-0.025em',
                }}>
                  {isEarning ? '+' : '−'}{amtStr}
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {/* Push to employees */}
                  <button
                    onClick={() => setPushComp(comp)}
                    title="Push to employees"
                    className="inline-flex items-center gap-1 font-semibold"
                    style={{
                      height: 30, padding: '0 10px', borderRadius: 8, fontSize: 12,
                      background: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-primary-medium)',
                      cursor: 'pointer',
                    }}
                  >
                    <Users style={{ width: 11, height: 11 }} />
                    Push
                  </button>
                  <ActionIconBtn variant="edit"   icon={Pencil} onClick={() => setModal(comp)} title="Edit template" />
                  <ActionIconBtn variant="delete" icon={Trash2} onClick={() => handleDelete(comp)} title="Delete template" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info banner */}
      {!loading && components.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, fontSize: 12.5,
          background: 'var(--color-primary-light)',
          border: '1px solid var(--color-primary-medium)',
          color: 'var(--color-primary)',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Info style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Templates are a starting point, not a live link.</strong> Pushing copies the
            current values to selected employees. If you later edit the template and push again,
            employees who already have it will get their copy updated to the new values.
          </span>
        </div>
      )}

      {/* Edit / Create Modal */}
      {(modal === 'new' || (modal && typeof modal !== 'string')) && (
        <ComponentModal
          initial={modal === 'new' ? null : modal as PayrollComponent}
          onSave={handleSave}
          onClose={() => setModal('close' as never)}
        />
      )}

      {/* Push-to-Employees Modal */}
      {pushComp && (
        <PushModal
          comp={pushComp}
          onClose={() => setPushComp(null)}
          onDone={handlePushDone}
        />
      )}
    </div>
  )
}
