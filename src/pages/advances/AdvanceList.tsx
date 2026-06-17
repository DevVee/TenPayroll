import { useState } from 'react'
import {
  Plus, Banknote, CheckCircle, XCircle, DollarSign, RotateCcw,
  PauseCircle, PlayCircle, Pencil, AlertTriangle, Sliders, Calendar,
  TrendingDown, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'
import { PageHeader }   from '../../components/ui/PageHeader'
import { SearchInput }  from '../../components/ui/SearchInput'
import { Modal }        from '../../components/ui/Modal'
import { EmptyState }   from '../../components/ui/EmptyState'
import { useData }      from '../../hooks/useData'
import {
  apiGetAdvances, apiGetEmployees,
  apiCreateAdvance, apiUpdateAdvanceStatus, apiBatchUpdateAdvanceStatus,
  apiCancelAdvance, apiWriteOffAdvance,
  apiSuspendAdvance, apiResumeAdvance,
  apiUpdateAdvanceDeduction, apiAdjustAdvanceBalance,
  apiRecordRepayment, apiGetRepayments,
} from '../../lib/db'
import { BatchActionBar } from '../../components/ui/BatchActionBar'
import { useAuthStore } from '../../store/authStore'
import { useUIStore }   from '../../store/uiStore'
import { usePermission } from '../../lib/permissions'
import type { SalaryAdvance, AdvanceStatus, Employee, AdvanceRepayment, RepaymentType, DeductionType } from '../../types'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<AdvanceStatus, { label: string; pill: string }> = {
  pending:    { label: 'Pending',     pill: 'pill pill-yellow'  },
  approved:   { label: 'Approved',    pill: 'pill pill-blue'    },
  released:   { label: 'Released',    pill: 'pill pill-indigo'  },
  fully_paid: { label: 'Fully Paid',  pill: 'pill pill-green'   },
  rejected:   { label: 'Rejected',    pill: 'pill pill-red'     },
  cancelled:  { label: 'Cancelled',   pill: 'pill pill-gray'    },
  written_off:{ label: 'Written Off', pill: 'pill pill-gray'    },
}

const REPAYMENT_TYPE_CFG: Record<RepaymentType, { label: string; color: string }> = {
  payroll:    { label: 'Payroll Deduction', color: 'var(--color-primary)'  },
  manual:     { label: 'Manual Payment',    color: 'var(--color-success)'  },
  adjustment: { label: 'Adjustment',        color: 'var(--color-warning)'  },
  reversal:   { label: 'Write-Off',         color: 'var(--color-text-muted)' },
}

/** Display suffix for the stored deduction value based on its interpretation type. */
const DED_SUFFIX: Record<DeductionType, string> = {
  monthly:      '/mo',
  per_period:   '/period',
  installments: '/run',
}

function fmtPeso(n: number) {
  return `₱${Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Projected payoff label.
 * - 'monthly':     stored value = monthly budget → result is a calendar month name.
 * - 'per_period' / 'installments': stored value = per-run amount → result is "N runs".
 */
function projectedPayoff(
  outstanding:      number,
  monthlyDeduction: number | undefined,
  deductionType:    DeductionType | undefined = 'monthly',
): string {
  if (!monthlyDeduction || monthlyDeduction <= 0 || outstanding <= 0) return '—'
  const periodsLeft = Math.ceil(outstanding / monthlyDeduction)
  if ((deductionType ?? 'monthly') === 'monthly') {
    const d = new Date()
    d.setMonth(d.getMonth() + periodsLeft)
    return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
  }
  return `${periodsLeft} run${periodsLeft !== 1 ? 's' : ''}`
}

// ── Deduction-type options ────────────────────────────────────────────────────
const DEDUCTION_TYPE_OPTIONS: { type: DeductionType; label: string; desc: string }[] = [
  {
    type:  'monthly',
    label: 'Monthly budget',
    desc:  'Enter a monthly total. Payroll splits it across pay periods (÷2 for bi-monthly, ÷4–5 for weekly).',
  },
  {
    type:  'per_period',
    label: 'Per payroll period',
    desc:  'Same exact peso amount deducted every run — never divided by pay frequency.',
  },
  {
    type:  'installments',
    label: 'Fixed installments',
    desc:  'N equal payroll deductions across the loan term. Enter the count; we calculate each slice.',
  },
]

/**
 * Reusable deduction-setup section used in RequestForm, ReleaseModal, EditDeductionModal.
 * advanceAmount — used to compute the per-run slice when mode = 'installments'.
 */
function DeductionSetup({
  advanceAmount,
  deductionType,
  onTypeChange,
  inputValue,
  onInputChange,
  installmentCount,
  onInstallmentCountChange,
}: {
  advanceAmount:           number
  deductionType:           DeductionType
  onTypeChange:            (t: DeductionType) => void
  inputValue:              string
  onInputChange:           (v: string) => void
  installmentCount:        string
  onInstallmentCountChange:(v: string) => void
}) {
  const iv   = Number(inputValue)
  const ic   = Number(installmentCount)
  const base = advanceAmount > 0 ? advanceAmount : 0

  let preview: string | null = null
  if (deductionType === 'monthly' && iv > 0) {
    preview = `${fmtPeso(iv)}/month — divided by the number of pay periods in each month`
  } else if (deductionType === 'per_period' && iv > 0) {
    const runs = base > 0 ? Math.ceil(base / iv) : null
    preview = `${fmtPeso(iv)} every payroll run${runs !== null ? ` · ${runs} run${runs !== 1 ? 's' : ''} to pay off` : ''}`
  } else if (deductionType === 'installments' && ic > 0 && base > 0) {
    const slice = Math.round((base / ic) * 100) / 100
    preview = `${fmtPeso(slice)}/run × ${ic} payroll runs = ${fmtPeso(base)} total`
  }

  return (
    <div className="space-y-2">
      <label className="form-label">Deduction Setup</label>

      {/* Mode selector */}
      <div className="space-y-1">
        {DEDUCTION_TYPE_OPTIONS.map(opt => (
          <label
            key={opt.type}
            style={{
              display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${deductionType === opt.type ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: deductionType === opt.type ? 'var(--color-primary-subtle, #eff6ff)' : 'var(--color-surface-2)',
              transition: 'border-color 0.12s',
            }}
          >
            <input
              type="radio"
              name="ded_type"
              value={opt.type}
              checked={deductionType === opt.type}
              onChange={() => onTypeChange(opt.type)}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>{opt.label}</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4, margin: '2px 0 0' }}>{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Value input */}
      {deductionType !== 'installments' ? (
        <div>
          <label className="form-label" style={{ marginTop: 6 }}>
            {deductionType === 'monthly' ? 'Monthly Budget (₱)' : 'Amount per Period (₱)'}
          </label>
          <input
            type="number"
            className="input-base w-full"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            min="1"
            step="100"
            placeholder={deductionType === 'monthly' ? 'e.g. 2000 per month' : 'e.g. 1000 per run'}
          />
        </div>
      ) : (
        <div>
          <label className="form-label" style={{ marginTop: 6 }}>Number of Payroll Runs *</label>
          <input
            type="number"
            className="input-base w-full"
            value={installmentCount}
            onChange={e => onInstallmentCountChange(e.target.value)}
            min="1"
            step="1"
            placeholder={base > 0 ? `e.g. ${Math.ceil(base / 500)} runs at ₱500 each` : 'e.g. 10'}
          />
        </div>
      )}

      {/* Live preview */}
      {preview && (
        <div className="card" style={{ padding: '8px 12px', background: 'var(--color-surface-2)', fontSize: 12 }}>
          📅 {preview}
        </div>
      )}
    </div>
  )
}

// ── KPI stat ──────────────────────────────────────────────────────────────────
function AdvanceStat({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

// ── Request form ──────────────────────────────────────────────────────────────
function RequestForm({ employees, onClose, onSaved }: {
  employees: Employee[]; onClose: () => void; onSaved: () => void
}) {
  const { user }   = useAuthStore()
  const addToast   = useUIStore(s => s.addToast)
  const [form, setForm] = useState({
    employeeId: '', amount: '', purpose: '', monthlyDeduction: '', repaymentStart: '', notes: '',
  })
  const [deductionType,    setDeductionType]    = useState<DeductionType>('monthly')
  const [installmentCount, setInstallmentCount] = useState('')
  const [saving, setSaving] = useState(false)

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.employeeId || !form.amount || Number(form.amount) <= 0) return
    const iv = Number(form.monthlyDeduction)
    const ic = Number(installmentCount)
    setSaving(true)
    try {
      await apiCreateAdvance({
        employeeId:       form.employeeId,
        amount:           Number(form.amount),
        purpose:          form.purpose || undefined,
        notes:            form.notes || undefined,
        monthlyDeduction: deductionType !== 'installments' && iv > 0 ? iv : undefined,
        repaymentStart:   form.repaymentStart || undefined,
        deductionType,
        installmentCount: ic > 0 ? ic : undefined,
      }, user?.name)
      addToast({ type: 'success', title: 'Advance Requested', message: 'Salary advance request has been filed.' })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Failed to create request.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="New Salary Advance Request" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.employeeId || !form.amount}>
          {saving ? 'Saving…' : 'Submit Request'}
        </button>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label className="form-label">Employee *</label>
          <select className="input-base w-full" value={form.employeeId} onChange={e => u('employeeId', e.target.value)}>
            <option value="">Select employee…</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.fullName} — {e.employeeNo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Amount (₱) *</label>
          <input type="number" className="input-base w-full" value={form.amount} onChange={e => u('amount', e.target.value)} min="1" step="100" placeholder="5000" />
        </div>
        <DeductionSetup
          advanceAmount={Number(form.amount)}
          deductionType={deductionType}
          onTypeChange={setDeductionType}
          inputValue={form.monthlyDeduction}
          onInputChange={v => u('monthlyDeduction', v)}
          installmentCount={installmentCount}
          onInstallmentCountChange={setInstallmentCount}
        />
        <div>
          <label className="form-label">Repayment Start Date</label>
          <input type="date" className="input-base w-full" value={form.repaymentStart} onChange={e => u('repaymentStart', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Purpose</label>
          <input type="text" className="input-base w-full" value={form.purpose} onChange={e => u('purpose', e.target.value)} placeholder="Medical, emergency, etc." />
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="input-base w-full" rows={2} value={form.notes} onChange={e => u('notes', e.target.value)} placeholder="Additional notes…" />
        </div>
      </div>
    </Modal>
  )
}

// ── Approve modal ─────────────────────────────────────────────────────────────
function ApproveModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await apiUpdateAdvanceStatus(advance.id, 'approved', user?.name ?? 'System')
      addToast({ type: 'success', title: 'Approved', message: `Advance for ${advance.employeeName} approved.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Approve Advance" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Processing…' : 'Approve'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>
        Approve this advance request? The employee can receive the funds once approved and released.
      </p>
    </Modal>
  )
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await apiUpdateAdvanceStatus(advance.id, 'rejected', user?.name ?? 'System', { rejectionReason: reason })
      addToast({ type: 'success', title: 'Rejected', message: `Advance for ${advance.employeeName} rejected.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Reject Advance" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-danger" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Processing…' : 'Reject'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div style={{ marginTop: 12 }}>
        <label className="form-label">Rejection Reason</label>
        <textarea className="input-base w-full" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection…" />
      </div>
    </Modal>
  )
}

// ── Release modal ─────────────────────────────────────────────────────────────
function ReleaseModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [form, setForm] = useState({
    monthlyDeduction: String(advance.monthlyDeduction ?? ''),
    repaymentStart:   advance.repaymentStart ?? '',
    releaseNotes:     '',
  })
  const [deductionType,    setDeductionType]    = useState<DeductionType>(advance.deductionType ?? 'monthly')
  const [installmentCount, setInstallmentCount] = useState(String(advance.installmentCount ?? ''))
  const [saving, setSaving] = useState(false)

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    const iv = Number(form.monthlyDeduction)
    const ic = Number(installmentCount)
    setSaving(true)
    try {
      await apiUpdateAdvanceStatus(advance.id, 'released', user?.name ?? 'System', {
        releaseNotes:     form.releaseNotes    || undefined,
        repaymentStart:   form.repaymentStart  || undefined,
        monthlyDeduction: deductionType !== 'installments' && iv > 0 ? iv : undefined,
        deductionType,
        installmentCount: ic > 0 ? ic : undefined,
        advanceAmount:    advance.amount,
      })
      addToast({ type: 'success', title: 'Released', message: `Funds released for ${advance.employeeName}.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Release Funds" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Processing…' : 'Release Funds'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div className="space-y-3" style={{ marginTop: 12 }}>
        <DeductionSetup
          advanceAmount={advance.amount}
          deductionType={deductionType}
          onTypeChange={setDeductionType}
          inputValue={form.monthlyDeduction}
          onInputChange={v => u('monthlyDeduction', v)}
          installmentCount={installmentCount}
          onInstallmentCountChange={setInstallmentCount}
        />
        <div>
          <label className="form-label">Repayment Start</label>
          <input type="date" className="input-base w-full" value={form.repaymentStart} onChange={e => u('repaymentStart', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Release Notes</label>
          <textarea className="input-base w-full" rows={2} value={form.releaseNotes} onChange={e => u('releaseNotes', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ── Manual repayment modal ────────────────────────────────────────────────────
function RepaymentModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [amount, setAmount] = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const n = Number(amount)
    if (!n || n <= 0) return
    setSaving(true)
    try {
      await apiRecordRepayment(advance.id, n, {
        recordedBy: user?.name,
        notes:      notes || undefined,
        type:       'manual',
      })
      addToast({ type: 'success', title: 'Repayment Recorded', message: `${fmtPeso(n)} recorded.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Record Manual Repayment" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !amount}>
          {saving ? 'Processing…' : 'Record Repayment'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div className="space-y-3" style={{ marginTop: 12 }}>
        <div>
          <label className="form-label">Amount (₱) *</label>
          <input
            type="number" className="input-base w-full"
            value={amount} onChange={e => setAmount(e.target.value)}
            min="0.01" step="0.01" max={advance.outstanding}
          />
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Max: {fmtPeso(advance.outstanding)} remaining
          </p>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <input type="text" className="input-base w-full" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cash payment, bank transfer, etc." />
        </div>
      </div>
    </Modal>
  )
}

// ── Suspend modal ─────────────────────────────────────────────────────────────
function SuspendModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSaving(true)
    try {
      await apiSuspendAdvance(advance.id, reason, user?.name ?? 'System')
      addToast({ type: 'success', title: 'Deductions Suspended', message: `Advance deductions for ${advance.employeeName} paused.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Suspend Deductions" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !reason.trim()}>
          {saving ? 'Processing…' : 'Suspend'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div style={{ marginTop: 12 }}>
        <label className="form-label">Reason for Suspension *</label>
        <textarea className="input-base w-full" rows={2} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Maternity leave, employee request, renegotiation pending…" />
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
          ⚠️ While suspended, this advance will be <strong>skipped</strong> during payroll generation. The balance remains outstanding.
        </p>
      </div>
    </Modal>
  )
}

// ── Edit deduction modal ──────────────────────────────────────────────────────
function EditDeductionModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [deductionType,    setDeductionType]    = useState<DeductionType>(advance.deductionType ?? 'monthly')
  const [inputValue,       setInputValue]       = useState(String(advance.monthlyDeduction ?? ''))
  const [installmentCount, setInstallmentCount] = useState(String(advance.installmentCount ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const iv = Number(inputValue)
    const ic = Number(installmentCount)
    const hasValue = deductionType === 'installments' ? ic > 0 : iv > 0
    if (!hasValue) return
    setSaving(true)
    try {
      await apiUpdateAdvanceDeduction(
        advance.id,
        deductionType !== 'installments' ? iv : 1,  // raw value; installments: base from outstanding in API
        user?.name ?? 'System',
        deductionType,
        ic > 0 ? ic : undefined,
      )
      addToast({ type: 'success', title: 'Deduction Updated', message: 'Repayment schedule updated.' })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  const iv = Number(inputValue)
  const ic = Number(installmentCount)
  const canSave = deductionType === 'installments' ? ic > 0 : iv > 0

  return (
    <Modal open title="Edit Repayment Schedule" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !canSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div style={{ marginTop: 12 }}>
        <DeductionSetup
          advanceAmount={advance.outstanding}
          deductionType={deductionType}
          onTypeChange={setDeductionType}
          inputValue={inputValue}
          onInputChange={setInputValue}
          installmentCount={installmentCount}
          onInstallmentCountChange={setInstallmentCount}
        />
      </div>
    </Modal>
  )
}

// ── Balance adjustment modal ──────────────────────────────────────────────────
function AdjustBalanceModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [direction, setDirection] = useState<'decrease' | 'increase'>('decrease')
  const [amount,    setAmount]    = useState('')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)

  const n          = Number(amount)
  const signed     = direction === 'decrease' ? n : -n
  const newOutstanding = advance.outstanding - signed

  const handleSubmit = async () => {
    if (!n || n <= 0 || !reason.trim()) return
    setSaving(true)
    try {
      await apiAdjustAdvanceBalance(advance.id, signed, reason, user?.name ?? 'System')
      addToast({
        type: 'success',
        title: 'Balance Adjusted',
        message: `Outstanding balance ${direction === 'decrease' ? 'reduced' : 'increased'} by ${fmtPeso(n)}.`,
      })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Adjust Outstanding Balance" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !n || !reason.trim()}>
          {saving ? 'Processing…' : 'Apply Adjustment'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div className="space-y-3" style={{ marginTop: 12 }}>
        <div>
          <label className="form-label">Adjustment Type *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection('decrease')}
              className={`btn btn-sm flex-1 ${direction === 'decrease' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <ArrowDownCircle style={{ width: 14, height: 14 }} />
              Decrease Outstanding
            </button>
            <button
              type="button"
              onClick={() => setDirection('increase')}
              className={`btn btn-sm flex-1 ${direction === 'increase' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <ArrowUpCircle style={{ width: 14, height: 14 }} />
              Increase Outstanding
            </button>
          </div>
        </div>
        <div>
          <label className="form-label">Amount (₱) *</label>
          <input type="number" className="input-base w-full" value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.01" />
        </div>
        {n > 0 && (
          <div className="card" style={{ padding: '10px 14px', background: 'var(--color-surface-2)', fontSize: 12 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Current outstanding: </span>
            <strong>{fmtPeso(advance.outstanding)}</strong>
            <span style={{ color: 'var(--color-text-muted)' }}> → </span>
            <strong style={{ color: newOutstanding < 0 ? 'var(--color-danger)' : newOutstanding === 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
              {newOutstanding < 0 ? '(Invalid)' : fmtPeso(newOutstanding)}
            </strong>
          </div>
        )}
        <div>
          <label className="form-label">Reason *</label>
          <textarea className="input-base w-full" rows={2} value={reason} onChange={e => setReason(e.target.value)}
            placeholder={direction === 'decrease'
              ? 'Cash payment made outside system, correction of over-deduction…'
              : 'Reversal of previous deduction, error correction…'
            }
          />
        </div>
      </div>
    </Modal>
  )
}

// ── Cancel modal (pending/approved only) ──────────────────────────────────────
function CancelModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    setSaving(true)
    try {
      await apiCancelAdvance(advance.id, reason, user?.name ?? 'System')
      addToast({ type: 'success', title: 'Cancelled', message: `Advance for ${advance.employeeName} cancelled.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Cancel Advance Request" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-danger" onClick={handleSubmit} disabled={saving || !reason.trim()}>
          {saving ? 'Processing…' : 'Confirm Cancellation'}
        </button>
      </div>
    }>
      <AdvanceSummaryCard advance={advance} />
      <div style={{ marginTop: 12 }}>
        <label className="form-label">Cancellation Reason *</label>
        <textarea className="input-base w-full" rows={2} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Employee withdrew request, duplicate entry, no longer needed…" />
      </div>
    </Modal>
  )
}

// ── Write-off modal (released only) ──────────────────────────────────────────
function WriteOffModal({ advance, onClose, onSaved }: {
  advance: SalaryAdvance; onClose: () => void; onSaved: () => void
}) {
  const { user } = useAuthStore()
  const addToast = useUIStore(s => s.addToast)
  const [reason,  setReason]  = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving,  setSaving]  = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim() || !confirm) return
    setSaving(true)
    try {
      await apiWriteOffAdvance(advance.id, reason, user?.name ?? 'System')
      addToast({ type: 'success', title: 'Written Off', message: `Outstanding balance of ${fmtPeso(advance.outstanding)} forgiven.` })
      onSaved()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'Action failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="Write Off Outstanding Balance" onClose={onClose} footer={
      <div className="flex gap-2 justify-end">
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-danger" onClick={handleSubmit} disabled={saving || !reason.trim() || !confirm}>
          {saving ? 'Processing…' : 'Write Off'}
        </button>
      </div>
    }>
      <div className="card" style={{ padding: '12px 16px', background: 'var(--color-danger-subtle, #fff1f0)', border: '1px solid var(--color-danger)', marginBottom: 12 }}>
        <div className="flex items-center gap-2" style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: 13 }}>
          <AlertTriangle style={{ width: 16, height: 16 }} />
          This will forgive {fmtPeso(advance.outstanding)} outstanding balance permanently.
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          The advance will be marked as Written Off. No further payroll deductions will be made. This action cannot be undone.
        </p>
      </div>
      <AdvanceSummaryCard advance={advance} />
      <div className="space-y-3" style={{ marginTop: 12 }}>
        <div>
          <label className="form-label">Reason for Write-Off *</label>
          <textarea className="input-base w-full" rows={2} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Employee separated, management approval, bad debt write-off…" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
          I confirm this write-off has been authorized by management.
        </label>
      </div>
    </Modal>
  )
}

// ── Shared advance summary card ───────────────────────────────────────────────
function AdvanceSummaryCard({ advance }: { advance: SalaryAdvance }) {
  return (
    <div className="card" style={{ background: 'var(--color-surface-2)', padding: '12px 16px' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{advance.employeeName}</p>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        {fmtPeso(advance.amount)} total · {fmtPeso(advance.totalRepaid)} repaid · <strong style={{ color: advance.outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtPeso(advance.outstanding)} outstanding</strong>
      </p>
      {advance.monthlyDeduction && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {fmtPeso(advance.monthlyDeduction)}{DED_SUFFIX[advance.deductionType ?? 'monthly']} deduction
          {' '}· payoff ~{projectedPayoff(advance.outstanding, advance.monthlyDeduction, advance.deductionType)}
        </p>
      )}
    </div>
  )
}

// ── Repayment history + schedule panel ───────────────────────────────────────
function RepaymentHistory({ advance, onClose }: { advance: SalaryAdvance; onClose: () => void }) {
  const { data: repayments } = useData<AdvanceRepayment[]>(() => apiGetRepayments(advance.id), [advance.id])

  const paidTotal    = (repayments ?? []).filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  const adjustTotal  = (repayments ?? []).filter(r => r.type === 'adjustment' && r.amount < 0).reduce((s, r) => s + r.amount, 0)

  // Build projected future schedule
  const schedule: { period: number; deduction: number; balanceAfter: number }[] = []
  if (advance.outstanding > 0 && advance.monthlyDeduction && advance.status === 'released' && !advance.isSuspended) {
    let remaining = advance.outstanding
    let i = 1
    while (remaining > 0 && i <= 36) {  // cap at 3 years
      const ded = Math.min(advance.monthlyDeduction, remaining)
      remaining -= ded
      schedule.push({ period: i, deduction: ded, balanceAfter: remaining })
      i++
    }
  }

  return (
    <Modal open title="Repayment History & Schedule" onClose={onClose} footer={
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    }>
      <AdvanceSummaryCard advance={advance} />

      {/* ── History ─────────────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: '16px 0 8px' }}>
        Payment History
      </p>
      {!repayments?.length ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 0' }}>No repayments recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {repayments.map(r => {
            const cfg = REPAYMENT_TYPE_CFG[r.type]
            const neg = r.amount < 0
            return (
              <div key={r.id} className="card" style={{ padding: '8px 12px', background: 'var(--color-surface-2)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: 'var(--color-surface-3, #f5f5f5)', padding: '2px 6px', borderRadius: 4 }}>
                      {cfg.label}
                    </span>
                    {neg && <span style={{ fontSize: 11, color: 'var(--color-warning)' }}>Reversal</span>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{fmtDate(r.paidAt)}</span>
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: neg ? 'var(--color-warning)' : 'var(--color-success)' }}>
                    {neg ? '−' : '+'}{fmtPeso(r.amount)}
                  </span>
                  {r.notes && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.notes}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(adjustTotal !== 0) && (
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Paid: <strong>{fmtPeso(paidTotal)}</strong> · Adjustments: <strong>{fmtPeso(adjustTotal)}</strong>
        </p>
      )}

      {/* ── Future schedule ─────────────────────────────────────── */}
      {schedule.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', margin: '16px 0 8px' }}>
            Projected Repayment Schedule
          </p>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>
                    {(advance.deductionType ?? 'monthly') === 'monthly' ? 'Month' : 'Pay Run'}
                  </th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Deduction</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)', background: s.balanceAfter === 0 ? 'var(--color-success-subtle, #f0fdf4)' : undefined }}>
                    <td style={{ padding: '5px 10px' }}>
                      {(advance.deductionType ?? 'monthly') === 'monthly' ? 'Month' : 'Run'} {s.period}
                    </td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--color-danger)' }}>{fmtPeso(s.deduction)}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: s.balanceAfter === 0 ? 'var(--color-success)' : 'var(--color-text)' }}>
                      {s.balanceAfter === 0 ? '✓ Paid off' : fmtPeso(s.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Projected payoff: <strong>{projectedPayoff(advance.outstanding, advance.monthlyDeduction, advance.deductionType)}</strong>
          </p>
        </>
      )}

      {advance.isSuspended && (
        <div className="card" style={{ padding: '10px 14px', background: 'var(--color-warning-subtle, #fffbeb)', border: '1px solid var(--color-warning)', marginTop: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)' }}>⚠️ Deductions suspended</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{advance.suspensionReason}</p>
        </div>
      )}
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
type ModalType =
  | 'approve' | 'reject' | 'release' | 'repayment'
  | 'suspend' | 'edit-deduction' | 'adjust-balance'
  | 'cancel' | 'write-off'

export function AdvanceList() {
  const canApprove = usePermission('pay_approve')
  const canCreate  = usePermission('emp_view')   // HR or higher
  const { user }   = useAuthStore()
  const addToast   = useUIStore(s => s.addToast)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<AdvanceStatus | 'all'>('all')
  const [activeModal,  setActiveModal]  = useState<{ advance: SalaryAdvance; type: ModalType } | null>(null)
  const [historyAdv,   setHistoryAdv]   = useState<SalaryAdvance | null>(null)
  const [showForm,     setShowForm]     = useState(false)

  // ── Batch selection ───────────────────────────────────────────────────────
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [batchSaving, setBatchSaving] = useState(false)

  const toggleSelect = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleSelectAll = (ids: string[], checked: boolean) =>
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => checked ? s.add(id) : s.delete(id)); return s })

  const runBatch = async (status: 'approved' | 'rejected', label: string) => {
    if (!selected.size || batchSaving) return
    setBatchSaving(true)
    const { ok, fail } = await apiBatchUpdateAdvanceStatus([...selected], status, user?.name ?? 'System')
    setSelected(new Set())
    refetch()
    addToast({
      type: fail > 0 ? 'warning' : 'success',
      title: `Batch ${label}`,
      message: `${ok} advance${ok !== 1 ? 's' : ''} ${label.toLowerCase()}${fail > 0 ? `. ${fail} failed.` : '.'}`,
    })
    setBatchSaving(false)
  }

  const { data: advances, loading, refetch } = useData(
    () => apiGetAdvances({ status: statusFilter }),
    [statusFilter],
  )
  const { data: employees } = useData(() => apiGetEmployees({ status: 'active' }), [])

  const filtered = (advances ?? []).filter(a =>
    !search ||
    (a.employeeName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.employeeNo   ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // ── KPI stats ──────────────────────────────────────────────────────────────
  const all       = advances ?? []
  const pending   = all.filter(a => a.status === 'pending').length
  const released  = all.filter(a => a.status === 'released')
  const suspended = released.filter(a => a.isSuspended)
  const totalOut  = released.reduce((s, a) => s + a.outstanding, 0)
  const totalAdv  = all.filter(a => !['rejected', 'cancelled'].includes(a.status)).reduce((s, a) => s + a.amount, 0)

  const open = (advance: SalaryAdvance, type: ModalType) => setActiveModal({ advance, type })
  const close = () => setActiveModal(null)
  const done  = () => { close(); refetch() }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Salary Advances"
        subtitle="Manage cash advance requests, approvals, repayment tracking, and deduction schedules"
        actions={canCreate ? [{ label: 'New Request', icon: Plus, onClick: () => setShowForm(true) }] : []}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <AdvanceStat label="Pending Requests"    value={String(pending)}       sub="Awaiting approval"                    color="var(--color-warning)"  />
        <AdvanceStat label="Active Advances"     value={String(released.length)} sub={suspended.length > 0 ? `${suspended.length} suspended` : 'Currently released'} color="var(--color-primary)"  />
        <AdvanceStat label="Outstanding Balance" value={fmtPeso(totalOut)}     sub="Total to be recovered"                color="var(--color-danger)"   />
        <AdvanceStat label="Total Advanced"      value={fmtPeso(totalAdv)}     sub="All time (excl. rejected/cancelled)" color="var(--color-text)"     />
      </div>

      {/* Suspended advances alert */}
      {suspended.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', background: 'var(--color-warning-subtle, #fffbeb)', border: '1px solid var(--color-warning)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PauseCircle style={{ width: 16, height: 16, color: 'var(--color-warning)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--color-text)' }}>
            <strong>{suspended.length} advance{suspended.length !== 1 ? 's' : ''} suspended</strong> — payroll deductions paused.{' '}
            {suspended.map(a => a.employeeName).join(', ')}
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employee…" className="flex-1" />
          <select
            className="input-base input-sm"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as AdvanceStatus | 'all'); setSelected(new Set()) }}
            style={{ width: 160 }}
          >
            <option value="all">All Status</option>
            {(Object.keys(STATUS_CFG) as AdvanceStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CFG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Batch bar — shown only when pending advances are selected */}
      {canApprove && (
        <BatchActionBar
          count={selected.size}
          noun="advance"
          onClear={() => setSelected(new Set())}
          actions={[
            {
              label:    batchSaving ? 'Processing…' : `Approve ${selected.size} Selected`,
              icon:     CheckCircle,
              onClick:  () => runBatch('approved', 'Approved'),
              disabled: batchSaving,
              variant:  'success',
            },
            {
              label:    batchSaving ? 'Processing…' : `Reject ${selected.size} Selected`,
              icon:     XCircle,
              onClick:  () => runBatch('rejected', 'Rejected'),
              disabled: batchSaving,
              variant:  'danger',
            },
          ]}
        />
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="spinner" /></div>
        ) : !filtered.length ? (
          <EmptyState
            icon={Banknote}
            title="No advances found"
            description={search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'No salary advance requests yet.'}
            action={canCreate ? { label: 'New Request', onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    {canApprove && (
                      <th style={{ width: 36, paddingLeft: 16 }}>
                        {(() => {
                          const pendingIds = filtered.filter(a => a.status === 'pending').map(a => a.id)
                          return pendingIds.length > 0 ? (
                            <input
                              type="checkbox"
                              checked={pendingIds.length > 0 && pendingIds.every(id => selected.has(id))}
                              onChange={e => toggleSelectAll(pendingIds, e.target.checked)}
                              title="Select all pending"
                            />
                          ) : null
                        })()}
                      </th>
                    )}
                    <th>Employee</th>
                    <th className="text-right">Amount</th>
                    <th className="hidden md:table-cell text-right">Outstanding</th>
                    <th className="hidden lg:table-cell">Schedule</th>
                    <th className="hidden xl:table-cell">Requested</th>
                    <th>Status</th>
                    <th style={{ width: 220 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(adv => (
                    <tr key={adv.id} style={{
                      ...(adv.isSuspended ? { background: 'var(--color-warning-subtle, #fffbeb)' } : {}),
                      ...(selected.has(adv.id) ? { background: 'var(--color-primary-light)' } : {}),
                    }}>
                      {canApprove && (
                        <td style={{ paddingLeft: 16 }}>
                          {adv.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selected.has(adv.id)}
                              onChange={() => toggleSelect(adv.id)}
                            />
                          )}
                        </td>
                      )}
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{adv.employeeName}</p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{adv.employeeNo} · {adv.department}</p>
                        {adv.purpose && <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{adv.purpose}</p>}
                      </td>
                      <td className="text-right tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                        {fmtPeso(adv.amount)}
                      </td>
                      <td className="hidden md:table-cell text-right tabular-nums" style={{ fontSize: 12 }}>
                        {adv.outstanding > 0
                          ? <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{fmtPeso(adv.outstanding)}</span>
                          : <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Fully paid</span>
                        }
                      </td>
                      <td className="hidden lg:table-cell">
                        {adv.status === 'released' && adv.monthlyDeduction ? (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            {fmtPeso(adv.monthlyDeduction)}{DED_SUFFIX[adv.deductionType ?? 'monthly']} · ~{projectedPayoff(adv.outstanding, adv.monthlyDeduction, adv.deductionType)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="hidden xl:table-cell">
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{fmtDate(adv.requestedAt)}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={STATUS_CFG[adv.status].pill}>{STATUS_CFG[adv.status].label}</span>
                          {adv.isSuspended && (
                            <span className="pill pill-yellow" style={{ fontSize: 10 }}>⏸ Suspended</span>
                          )}
                        </div>
                      </td>

                      {/* ── Action buttons ── */}
                      <td>
                        <div className="flex items-center gap-1 justify-end flex-wrap">

                          {/* History / Schedule — always shown for released/paid */}
                          {(adv.status === 'released' || adv.status === 'fully_paid' || adv.status === 'written_off') && (
                            <button onClick={() => setHistoryAdv(adv)} className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                              <Calendar style={{ width: 10, height: 10 }} /> Schedule
                            </button>
                          )}

                          {/* PENDING actions */}
                          {canApprove && adv.status === 'pending' && (
                            <>
                              <button onClick={() => open(adv, 'approve')} className="btn btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11, background: 'var(--color-success)', color: '#fff' }}>
                                <CheckCircle style={{ width: 10, height: 10 }} /> Approve
                              </button>
                              <button onClick={() => open(adv, 'reject')} className="btn btn-danger btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                                <XCircle style={{ width: 10, height: 10 }} /> Reject
                              </button>
                              <button onClick={() => open(adv, 'cancel')} className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                                <XCircle style={{ width: 10, height: 10 }} /> Cancel
                              </button>
                            </>
                          )}

                          {/* APPROVED actions */}
                          {canApprove && adv.status === 'approved' && (
                            <>
                              <button onClick={() => open(adv, 'release')} className="btn btn-primary btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                                <DollarSign style={{ width: 10, height: 10 }} /> Release
                              </button>
                              <button onClick={() => open(adv, 'cancel')} className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                                <XCircle style={{ width: 10, height: 10 }} /> Cancel
                              </button>
                            </>
                          )}

                          {/* RELEASED actions */}
                          {canApprove && adv.status === 'released' && (
                            <>
                              {/* Manual repayment */}
                              {adv.outstanding > 0 && (
                                <button onClick={() => open(adv, 'repayment')} className="btn btn-secondary btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                                  <RotateCcw style={{ width: 10, height: 10 }} /> Repay
                                </button>
                              )}

                              {/* Suspend / Resume */}
                              {adv.isSuspended ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      await apiResumeAdvance(adv.id, user?.name ?? 'System')
                                      refetch()
                                    } catch (e) {
                                      addToast({ type: 'error', title: 'Error', message: e instanceof Error ? e.message : 'Failed.' })
                                    }
                                  }}
                                  className="btn btn-success btn-sm"
                                  style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                                >
                                  <PlayCircle style={{ width: 10, height: 10 }} /> Resume
                                </button>
                              ) : (
                                <button onClick={() => open(adv, 'suspend')} className="btn btn-ghost btn-sm" style={{ height: 28, padding: '0 8px', fontSize: 11 }}>
                                  <PauseCircle style={{ width: 10, height: 10 }} /> Suspend
                                </button>
                              )}

                              {/* More actions dropdown hint — individual buttons */}
                              <button onClick={() => open(adv, 'edit-deduction')} className="btn btn-ghost btn-sm" title="Edit monthly deduction" style={{ height: 28, width: 28, padding: 0 }}>
                                <Pencil style={{ width: 11, height: 11 }} />
                              </button>
                              <button onClick={() => open(adv, 'adjust-balance')} className="btn btn-ghost btn-sm" title="Adjust balance" style={{ height: 28, width: 28, padding: 0 }}>
                                <Sliders style={{ width: 11, height: 11 }} />
                              </button>
                              <button onClick={() => open(adv, 'write-off')} className="btn btn-ghost btn-sm" title="Write off" style={{ height: 28, width: 28, padding: 0, color: 'var(--color-danger)' }}>
                                <TrendingDown style={{ width: 11, height: 11 }} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{filtered.length} records shown</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Total outstanding: <strong style={{ color: 'var(--color-danger)' }}>{fmtPeso(totalOut)}</strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showForm && (
        <RequestForm employees={employees ?? []} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} />
      )}

      {activeModal?.type === 'approve'        && <ApproveModal        advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'reject'         && <RejectModal         advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'release'        && <ReleaseModal        advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'repayment'      && <RepaymentModal      advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'suspend'        && <SuspendModal        advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'edit-deduction' && <EditDeductionModal  advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'adjust-balance' && <AdjustBalanceModal  advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'cancel'         && <CancelModal         advance={activeModal.advance} onClose={close} onSaved={done} />}
      {activeModal?.type === 'write-off'      && <WriteOffModal       advance={activeModal.advance} onClose={close} onSaved={done} />}

      {historyAdv && <RepaymentHistory advance={historyAdv} onClose={() => setHistoryAdv(null)} />}
    </div>
  )
}
