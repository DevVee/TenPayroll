// EmployeeForm.tsx — Simplified flat form matching TFPI Excel structure
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageHeader }    from '../../components/ui/PageHeader'
import { SearchSelect }  from '../../components/ui/SearchSelect'
import {
  apiGetEmployee, apiCreateEmployee, apiUpdateEmployee,
  apiGetDepartments, apiGetPositions, apiGetShifts,
  loadPayrollComponents,
} from '../../lib/db'
import type { Employee, Department, Position, PayrollComponent, WorkShift } from '../../types'

// ── Payroll component helpers ─────────────────────────────────────────────────
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}
function makeCompId() {
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

const BLANK_COMP: Omit<PayrollComponent, 'id'> = {
  name: '', code: '', category: 'earning', calcType: 'fixed',
  fixedAmount: 0, percentageRate: 0, calcBasis: 'basic_pay',
  employeeShareRate: 1, employerShareRate: 0,
  isTaxable: false, affectsGross: true, isActive: true, priority: 0,
  deductionFrequency: 'every_payroll',
}

const CATEGORY_LABELS: Record<PayrollComponent['category'], string> = {
  earning:      'Earning',
  allowance:    'Allowance',
  benefit:      'Benefit',
  deduction:    'Deduction',
  contribution: 'Contribution',
  tax:          'Tax',
  other:        'Other',
}

/** Categories that add to gross (positive sign) */
const GROSS_CATEGORIES: PayrollComponent['category'][] = ['earning', 'allowance', 'benefit']

type FormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

const BLANK: FormData = {
  employeeNo: '', firstName: '', lastName: '', middleName: '', fullName: '',
  email: '', phone: '', address: '', birthDate: '', gender: 'male', civilStatus: 'single',
  position: '', department: '', employmentType: 'regular', status: 'active',
  hireDate: new Date().toISOString().split('T')[0],
  compensationType: 'weekly', compensationRate: 0,
  basicSalary: 0, dailyRate: 0, payFrequency: 'weekly',
  pinCode: '', rfidTag: '',
  sssNo: '', philhealthNo: '', pagibigNo: '', tinNo: '',
  bankName: '', bankAccount: '', shiftId: '', taxStatus: 'S',
  allowances: [], payrollComponents: [],
  emergencyContactName: '', emergencyContactPhone: '',
}

/* ─── Small helpers ─────────────────────────────────────────────────────── */
function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="form-label">
      {children}
      {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      {!required && (
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 4 }}>
          optional
        </span>
      )}
    </label>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 2px' }}>
      <p style={{
        fontSize: 10.5, fontWeight: 800, color: 'var(--color-text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
      }}>{label}</p>
      <div style={{ flex: 1, borderTop: '1px solid var(--color-border)' }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPLOYEE FORM
   ═══════════════════════════════════════════════════════════════════════════ */
export function EmployeeForm() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form,         setForm]        = useState<FormData>(BLANK)
  const [designations, setDesignations]= useState<Department[]>([])
  const [deptOptions,  setDeptOptions] = useState<Position[]>([])
  const [shifts,       setShifts]      = useState<WorkShift[]>([])
  const [saving,       setSaving]      = useState(false)
  const [error,        setError]       = useState('')
  const [showExtra,    setShowExtra]   = useState(false)

  // ── Salary state ─────────────────────────────────────────────────────────────
  // Daily rate is the single source of truth.
  // Monthly, weekly, and bi-monthly are always derived — never stored independently.
  // The divisor (days/month) comes from the shift's rest days so 5-day shifts
  // use ×22 and 6-day shifts use ×26 automatically.
  const [dailyRate,     setDailyRateRaw]  = useState(0)
  const [monthlySalary, setMonthlySalaryRaw] = useState(0)

  // Derive the working days/month divisor from the selected shift
  const selectedShift   = shifts.find(s => s.id === form.shiftId)
  const workDaysPerWeek = selectedShift ? (7 - selectedShift.restDays.length) : 5
  const workDivisor     = Math.round(workDaysPerWeek * 52 / 12)  // 5d→22, 6d→26, 4d→17

  /** Update daily rate and sync monthly using shift's working days/month */
  const setDailyRate = (v: number) => {
    setDailyRateRaw(v)
    setMonthlySalaryRaw(v > 0 ? Math.round(v * workDivisor * 100) / 100 : 0)
  }
  /** Update monthly salary and sync daily using shift's working days/month */
  const setMonthlySalary = (v: number) => {
    setMonthlySalaryRaw(v)
    setDailyRateRaw(v > 0 ? Math.round((v / workDivisor) * 100) / 100 : 0)
  }

  // Derived — no state needed
  const weeklyRate    = dailyRate > 0 ? Math.round(dailyRate * workDaysPerWeek * 100) / 100 : 0
  const biMonthlyRate = monthlySalary > 0 ? Math.round((monthlySalary / 2) * 100) / 100 : 0

  // ── Payroll components ─────────────────────────────────────────────────────
  const [showCompForm,  setShowCompForm]  = useState(false)
  const [templates,     setTemplates]     = useState<PayrollComponent[]>([])
  const [selTplId,      setSelTplId]      = useState('')   // template pre-fill selector
  const [compForm,      setCompForm]      = useState<Omit<PayrollComponent, 'id'>>(BLANK_COMP)
  const [compErr,       setCompErr]       = useState('')

  /** Sync helper — commits updated component list back into form */
  const setComponents = (list: PayrollComponent[]) =>
    setForm(f => ({ ...f, payrollComponents: list }))

  const addComponent = () => {
    setCompErr('')
    if (!compForm.name.trim()) { setCompErr('Name is required.'); return }
    const amount = compForm.calcType === 'fixed' ? compForm.fixedAmount : compForm.percentageRate
    if (!amount || amount <= 0) { setCompErr('Amount / rate must be greater than 0.'); return }

    const newComp: PayrollComponent = {
      ...compForm,
      id:           makeCompId(),
      code:         compForm.code.trim() || slugify(compForm.name.trim()),
      affectsGross: GROSS_CATEGORIES.includes(compForm.category),
      priority:     (form.payrollComponents?.length ?? 0) + 1,
    }
    setComponents([...(form.payrollComponents ?? []), newComp])
    setCompForm(BLANK_COMP)
    setShowCompForm(false)
  }

  const removeComponent = (id: string) =>
    setComponents((form.payrollComponents ?? []).filter(c => c.id !== id))

  const toggleComponent = (id: string) =>
    setComponents((form.payrollComponents ?? []).map(c =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    ))

  /** When user picks a template from the dropdown, pre-fill the component form. */
  const handleTplSelect = (tplId: string) => {
    setSelTplId(tplId)
    if (!tplId) { setCompForm(BLANK_COMP); return }
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    setCompForm({
      name:             tpl.name,
      code:             tpl.code,
      description:      tpl.description,
      category:         tpl.category,
      calcType:         tpl.calcType === 'bracket' ? 'fixed' : tpl.calcType,
      fixedAmount:      tpl.fixedAmount,
      percentageRate:   tpl.percentageRate,
      calcBasis:        tpl.calcBasis,
      employeeShareRate: tpl.employeeShareRate,
      employerShareRate: tpl.employerShareRate,
      isTaxable:        tpl.isTaxable,
      affectsGross:     tpl.affectsGross,
      isActive:         true,
      priority:         (form.payrollComponents?.length ?? 0) + 1,
      deductionFrequency: 'every_payroll',
    })
  }

  useEffect(() => {
    apiGetDepartments().then(d => setDesignations(d))
    apiGetPositions().then(p => setDeptOptions(p))
    apiGetShifts().then(s => setShifts(s))
    // Load component templates for the pre-fill dropdown
    loadPayrollComponents().then(setTemplates)
    if (isEdit) {
      apiGetEmployee(id!).then(emp => {
        if (!emp) return
        setForm({ ...BLANK, ...emp })
        // Restore salary — both values come from the DB as-is (no cross-derivation here
        // since the correct shift divisor may not be loaded yet). The sync functions
        // will use the right divisor when the user edits either field.
        const daily   = emp.dailyRate ?? 0
        const monthly = emp.basicSalary ?? emp.compensationRate ?? 0
        if (daily   > 0) setDailyRateRaw(daily)
        if (monthly > 0) setMonthlySalaryRaw(monthly)
        // Show extra section if data exists
        if (emp.email || emp.phone || emp.sssNo || emp.bankName || emp.emergencyContactName) {
          setShowExtra(true)
        }
      })
    }
  }, [id, isEdit])

  const patch = (p: Partial<FormData>) => {
    setForm(f => {
      const next = { ...f, ...p }
      // Keep fullName in sync
      next.fullName = [next.firstName, next.middleName, next.lastName].filter(Boolean).join(' ')
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First Name and Last Name are required.'); return
    }
    if (!form.position.trim()) {
      setError('Designation is required.'); return
    }
    if (form.pinCode && form.pinCode.length > 0 && !/^\d{6}$/.test(form.pinCode)) {
      setError('Kiosk PIN must be exactly 6 digits (numbers only).'); return
    }

    // Build compensation — daily rate is source of truth
    // Use the shift-derived divisor so 6-day workers get ×26, not ×22
    const finalDaily   = dailyRate
    const finalMonthly = monthlySalary > 0 ? monthlySalary : Math.round(dailyRate * workDivisor * 100) / 100

    // Pay frequency drives compensationType for backward compat
    const freqToType: Record<string, Employee['compensationType']> = {
      weekly:     'weekly',
      'bi-monthly': 'monthly',
      monthly:    'monthly',
    }
    const finalCompType = freqToType[form.payFrequency ?? 'weekly'] ?? 'monthly'
    const finalCompRate = form.payFrequency === 'weekly'
      ? weeklyRate
      : form.payFrequency === 'bi-monthly'
        ? biMonthlyRate
        : finalMonthly

    const payload: FormData = {
      ...form,
      employeeNo:       form.employeeNo.trim() || `EMP-${Date.now().toString().slice(-6)}`,
      compensationType: finalCompType,
      compensationRate: finalCompRate,
      basicSalary:      finalMonthly,
      dailyRate:        finalDaily,
      allowances:       form.allowances ?? [],
    }

    setSaving(true)
    try {
      if (isEdit) await apiUpdateEmployee(id!, payload)
      else        await apiCreateEmployee(payload)
      navigate('/employees')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Employees"
        title={isEdit ? 'Edit Employee' : 'Add New Employee'}
        subtitle={isEdit ? form.fullName || 'Edit employee details' : 'Fill in the required fields below'}
        actions={[{
          label: 'Cancel', icon: ArrowLeft, variant: 'secondary',
          onClick: () => navigate('/employees'),
        }]}
      />

      {error && (
        <div className="px-4 py-3 text-sm font-medium rounded-xl"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">

        {/* ── Core Fields Card ── */}
        <div className="card p-5 space-y-5">

          {/* Identity */}
          <SectionDivider label="Identity" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <FLabel>Employee No.</FLabel>
              <input
                className="input-base"
                value={form.employeeNo}
                onChange={e => patch({ employeeNo: e.target.value })}
                placeholder="e.g. P002-12"
              />
              <p className="form-hint">Auto-assigned if left blank</p>
            </div>
            <div>
              <FLabel required>Last Name</FLabel>
              <input
                className="input-base"
                value={form.lastName}
                onChange={e => patch({ lastName: e.target.value })}
                placeholder="Dela Cruz"
                autoFocus
              />
            </div>
            <div>
              <FLabel required>First Name</FLabel>
              <input
                className="input-base"
                value={form.firstName}
                onChange={e => patch({ firstName: e.target.value })}
                placeholder="Maria"
              />
            </div>
            <div>
              <FLabel>Middle Name</FLabel>
              <input
                className="input-base"
                value={form.middleName}
                onChange={e => patch({ middleName: e.target.value })}
                placeholder="Santos"
              />
            </div>
          </div>

          {/* Kiosk credentials — in Identity so they're always visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FLabel>Kiosk PIN</FLabel>
              <input
                className="input-base"
                value={form.pinCode ?? ''}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  patch({ pinCode: v })
                }}
                placeholder="6-digit PIN"
                maxLength={6}
                inputMode="numeric"
                autoComplete="off"
                style={{
                  borderColor: form.pinCode && form.pinCode.length > 0 && form.pinCode.length < 6
                    ? 'var(--color-danger)'
                    : undefined,
                }}
              />
              <p className="form-hint">
                {form.pinCode && form.pinCode.length > 0 && form.pinCode.length < 6
                  ? <span style={{ color: 'var(--color-danger)' }}>PIN must be exactly 6 digits</span>
                  : 'Exactly 6 digits — kiosk fallback when RFID card is unavailable'
                }
              </p>
            </div>
            <div>
              <FLabel>RFID Tag</FLabel>
              <input
                className="input-base"
                value={form.rfidTag ?? ''}
                onChange={e => patch({ rfidTag: e.target.value })}
                placeholder="Tap card near reader or enter tag ID"
                autoComplete="off"
              />
              <p className="form-hint">Primary kiosk identification — scan the card or type the tag ID manually</p>
            </div>
          </div>

          {/* Designation + Department + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FLabel required>Designation</FLabel>
              <SearchSelect
                options={designations.map(d => ({ value: d.name, label: d.name }))}
                value={form.position}
                onChange={v => patch({ position: v })}
                placeholder="Search designation…"
                emptyHint="Add designations in Settings → Positions"
                required
              />
              <p className="form-hint">
                {designations.length === 0
                  ? 'Add designations in Settings → Positions'
                  : `${designations.length} available — type to filter`}
              </p>
            </div>
            <div>
              <FLabel>Department</FLabel>
              <SearchSelect
                options={deptOptions.map(d => ({ value: d.title, label: d.title }))}
                value={form.department ?? ''}
                onChange={v => patch({ department: v })}
                placeholder="Search department…"
                emptyHint="Add departments in Settings → Departments"
              />
              <p className="form-hint">
                {deptOptions.length === 0
                  ? 'Add departments in Settings → Departments'
                  : `${deptOptions.length} available — type to filter`}
              </p>
            </div>
            <div>
              <FLabel>Status</FLabel>
              <select
                className="input-base"
                value={form.status}
                onChange={e => patch({ status: e.target.value as Employee['status'] })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
                <option value="awol">AWOL</option>
              </select>
            </div>
          </div>

          {/* Compensation */}
          <SectionDivider label="Compensation" />

          {/* Row 1 — editable inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FLabel required>Daily Rate (₱)</FLabel>
              <input
                type="number" step="0.01" min="0" className="input-base"
                value={dailyRate || ''}
                onChange={e => setDailyRate(Number(e.target.value))}
                placeholder="0.00"
              />
              <p className="form-hint">Primary rate — all other figures auto-compute</p>
            </div>
            <div>
              <FLabel>Shift Schedule</FLabel>
              <select
                className="input-base"
                value={form.shiftId ?? ''}
                onChange={e => {
                  patch({ shiftId: e.target.value })
                  // Re-sync monthly when shift changes — new divisor applies from here on
                  if (dailyRate > 0) {
                    const shift = shifts.find(s => s.id === e.target.value)
                    const daysPerWeek = shift ? (7 - shift.restDays.length) : 5
                    const divisor = Math.round(daysPerWeek * 52 / 12)
                    setMonthlySalaryRaw(Math.round(dailyRate * divisor * 100) / 100)
                  }
                }}
              >
                <option value="">— No shift assigned —</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.timeIn && s.timeOut ? ` (${s.timeIn}–${s.timeOut})` : ''}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                {selectedShift
                  ? `${workDaysPerWeek}-day schedule → ×${workDivisor} days/month`
                  : shifts.length === 0
                    ? 'Add shifts in Settings → Work Shifts'
                    : 'Select a shift to use correct working-days divisor'}
              </p>
            </div>
            <div>
              <FLabel>Monthly Salary (₱)</FLabel>
              <input
                type="number" step="0.01" min="0" className="input-base"
                value={monthlySalary || ''}
                onChange={e => setMonthlySalary(Number(e.target.value))}
                placeholder={`Auto (Daily × ${workDivisor})`}
              />
              <p className="form-hint">
                Edit to override; updates daily rate
                {selectedShift ? ` · using ×${workDivisor} (${workDaysPerWeek}-day shift)` : ' · assign a shift for correct divisor'}
              </p>
            </div>
          </div>

          {/* Row 2 — auto-computed reference figures */}
          {dailyRate > 0 && (
            <div
              className="grid grid-cols-3 gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weekly (×5)</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                  ₱{weeklyRate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bi-Monthly (÷2)</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                  ₱{biMonthlyRate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Annual (×12)</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                  ₱{(monthlySalary * 12).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Optional / Additional Info ── */}
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowExtra(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: showExtra ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                Additional Info
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Contact details, government IDs, bank info, emergency contact — all optional
              </p>
            </div>
            {showExtra
              ? <ChevronUp style={{ width: 16, height: 16, color: 'var(--color-text-muted)', flexShrink: 0 }} />
              : <ChevronDown style={{ width: 16, height: 16, color: 'var(--color-text-muted)', flexShrink: 0 }} />
            }
          </button>

          {showExtra && (
            <div className="p-5 space-y-5">

              {/* Contact */}
              <SectionDivider label="Contact" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <FLabel>Email Address</FLabel>
                  <input type="email" className="input-base" value={form.email ?? ''}
                    onChange={e => patch({ email: e.target.value })} placeholder="employee@company.com" />
                </div>
                <div>
                  <FLabel>Phone Number</FLabel>
                  <input className="input-base" value={form.phone ?? ''}
                    onChange={e => patch({ phone: e.target.value })} placeholder="09XX XXX XXXX" />
                </div>
                <div>
                  <FLabel>Address</FLabel>
                  <input className="input-base" value={form.address ?? ''}
                    onChange={e => patch({ address: e.target.value })} placeholder="Complete address" />
                </div>
                <div>
                  <FLabel>Date of Birth</FLabel>
                  <input type="date" className="input-base" value={form.birthDate ?? ''}
                    onChange={e => patch({ birthDate: e.target.value })} />
                </div>
                <div>
                  <FLabel>Gender</FLabel>
                  <select className="input-base" value={form.gender ?? 'male'}
                    onChange={e => patch({ gender: e.target.value as 'male' | 'female' })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <FLabel>Civil Status</FLabel>
                  <select className="input-base" value={form.civilStatus ?? 'single'}
                    onChange={e => patch({ civilStatus: e.target.value as Employee['civilStatus'] })}>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="widowed">Widowed</option>
                    <option value="separated">Separated</option>
                  </select>
                </div>
              </div>

              {/* Employment details */}
              <SectionDivider label="Employment" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <FLabel>Employment Type</FLabel>
                  <select className="input-base" value={form.employmentType ?? 'regular'}
                    onChange={e => patch({ employmentType: e.target.value as Employee['employmentType'] })}>
                    <option value="regular">Regular</option>
                    <option value="probationary">Probationary</option>
                    <option value="contractual">Contractual</option>
                    <option value="part-time">Part-time</option>
                  </select>
                </div>
                <div>
                  <FLabel>Hire Date</FLabel>
                  <input type="date" className="input-base" value={form.hireDate ?? ''}
                    onChange={e => patch({ hireDate: e.target.value })} />
                </div>
                <div>
                  <FLabel>Pay Frequency</FLabel>
                  <select className="input-base" value={form.payFrequency ?? 'weekly'}
                    onChange={e => patch({ payFrequency: e.target.value as Employee['payFrequency'] })}>
                    <option value="weekly">Weekly</option>
                    <option value="bi-monthly">Bi-Monthly (Semi-Monthly)</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Government IDs */}
              <SectionDivider label="Government IDs" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <FLabel>SSS No.</FLabel>
                  <input className="input-base" value={form.sssNo ?? ''}
                    onChange={e => patch({ sssNo: e.target.value })} placeholder="XX-XXXXXXX-X" />
                </div>
                <div>
                  <FLabel>PhilHealth No.</FLabel>
                  <input className="input-base" value={form.philhealthNo ?? ''}
                    onChange={e => patch({ philhealthNo: e.target.value })} placeholder="XXXX-XXXXXXX-X" />
                </div>
                <div>
                  <FLabel>Pag-IBIG No.</FLabel>
                  <input className="input-base" value={form.pagibigNo ?? ''}
                    onChange={e => patch({ pagibigNo: e.target.value })} placeholder="XXXX-XXXX-XXXX" />
                </div>
                <div>
                  <FLabel>TIN No.</FLabel>
                  <input className="input-base" value={form.tinNo ?? ''}
                    onChange={e => patch({ tinNo: e.target.value })} placeholder="XXX-XXX-XXX" />
                </div>
              </div>

              {/* Bank */}
              <SectionDivider label="Bank Account" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FLabel>Bank Name</FLabel>
                  <input className="input-base" value={form.bankName ?? ''}
                    onChange={e => patch({ bankName: e.target.value })} placeholder="e.g. BDO, BPI, Landbank" />
                </div>
                <div>
                  <FLabel>Account Number</FLabel>
                  <input className="input-base" value={form.bankAccount ?? ''}
                    onChange={e => patch({ bankAccount: e.target.value })} placeholder="Account number" />
                </div>
              </div>

              {/* Emergency Contact */}
              <SectionDivider label="Emergency Contact" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FLabel>Contact Name</FLabel>
                  <input className="input-base" value={form.emergencyContactName ?? ''}
                    onChange={e => patch({ emergencyContactName: e.target.value })} placeholder="Full name" />
                </div>
                <div>
                  <FLabel>Contact Phone</FLabel>
                  <input className="input-base" value={form.emergencyContactPhone ?? ''}
                    onChange={e => patch({ emergencyContactPhone: e.target.value })} placeholder="09XX XXX XXXX" />
                </div>
              </div>


            </div>
          )}
        </div>

        {/* ── Payroll Components ── */}
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  Payroll Components
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Earnings, allowances, and deductions unique to this employee.
                  Leave empty to use the standard government-deductions-only calculation.
                </p>
              </div>
              <button
                  type="button"
                  onClick={() => { setShowCompForm(v => !v); setSelTplId(''); setCompForm(BLANK_COMP); setCompErr('') }}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  <Plus style={{ width: 13, height: 13 }} />
                  Add Component
                </button>
            </div>
          </div>

          {/* Add-component form */}
          {showCompForm && (
            <div className="p-5 space-y-3" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-raised)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                New Component
              </p>

              {compErr && (
                <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>{compErr}</p>
              )}

              {/* Template pre-fill dropdown */}
              {templates.filter(t => t.isActive).length > 0 && (
                <div>
                  <FLabel>Start from template <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional — pre-fills fields below)</span></FLabel>
                  <select
                    className="input-base"
                    value={selTplId}
                    onChange={e => handleTplSelect(e.target.value)}
                  >
                    <option value="">— Enter manually —</option>
                    {templates.filter(t => t.isActive).map(t => {
                      const alreadyAdded = (form.payrollComponents ?? []).some(c => c.code === t.code)
                      return (
                        <option key={t.id} value={t.id} disabled={alreadyAdded}>
                          {t.name} ({CATEGORY_LABELS[t.category]})
                          {alreadyAdded ? ' — already added' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <FLabel required>Name</FLabel>
                  <input
                    className="input-base"
                    value={compForm.name}
                    onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Rice Allowance, Loan Deduction"
                  />
                </div>
                <div>
                  <FLabel>Category</FLabel>
                  <select
                    className="input-base"
                    value={compForm.category}
                    onChange={e => {
                      const cat = e.target.value as PayrollComponent['category']
                      setCompForm(f => ({
                        ...f,
                        category: cat,
                        affectsGross: GROSS_CATEGORIES.includes(cat),
                      }))
                    }}
                  >
                    {(Object.keys(CATEGORY_LABELS) as PayrollComponent['category'][]).map(k => (
                      <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FLabel>Amount Type</FLabel>
                  <select
                    className="input-base"
                    value={compForm.calcType}
                    onChange={e => setCompForm(f => ({ ...f, calcType: e.target.value as PayrollComponent['calcType'] }))}
                  >
                    <option value="fixed">Fixed Amount (₱)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                {compForm.calcType === 'fixed' ? (
                  <div>
                    <FLabel required>Monthly Amount (₱)</FLabel>
                    <input
                      type="number" step="0.01" min="0" className="input-base"
                      value={compForm.fixedAmount || ''}
                      onChange={e => setCompForm(f => ({ ...f, fixedAmount: Number(e.target.value) }))}
                      placeholder="0.00"
                    />
                    <p className="form-hint">Pro-rated per pay period automatically</p>
                  </div>
                ) : (
                  <div>
                    <FLabel required>Rate (%)</FLabel>
                    <input
                      type="number" step="0.01" min="0" max="100" className="input-base"
                      value={compForm.percentageRate ? (compForm.percentageRate * 100).toFixed(2) : ''}
                      onChange={e => setCompForm(f => ({ ...f, percentageRate: Number(e.target.value) / 100 }))}
                      placeholder="e.g. 5 for 5%"
                    />
                  </div>
                )}


                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, paddingBottom: 2 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={compForm.isTaxable}
                      onChange={e => setCompForm(f => ({ ...f, isTaxable: e.target.checked }))}
                    />
                    Taxable
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }}
                  onClick={() => { setShowCompForm(false); setCompErr('') }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" style={{ fontSize: 12 }}
                  onClick={addComponent}>
                  <Plus style={{ width: 13, height: 13 }} />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Component rows */}
          {(form.payrollComponents ?? []).length === 0 && !showCompForm ? (
            <div className="px-5 py-8 text-center" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              No components added — this employee will use the standard govt deductions only.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {(form.payrollComponents ?? []).map(comp => (
                <div key={comp.id} className="flex items-center gap-3 px-5 py-3"
                  style={{ opacity: comp.isActive ? 1 : 0.5 }}>

                  {/* Enable / disable toggle */}
                  <button
                    type="button"
                    onClick={() => toggleComponent(comp.id)}
                    title={comp.isActive ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                  >
                    {comp.isActive
                      ? <ToggleRight style={{ width: 22, height: 22, color: 'var(--color-primary)' }} />
                      : <ToggleLeft  style={{ width: 22, height: 22, color: 'var(--color-text-muted)' }} />
                    }
                  </button>

                  {/* Name + category badge */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {comp.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                      {CATEGORY_LABELS[comp.category]}
                      {comp.isTaxable ? ' · Taxable' : ''}
                    </p>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 700,
                      color: comp.affectsGross ? 'var(--color-success, #16a34a)' : 'var(--color-danger)',
                    }}>
                      {comp.affectsGross ? '+' : '−'}
                      {comp.calcType === 'fixed'
                        ? `₱${comp.fixedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                        : `${(comp.percentageRate * 100).toFixed(2)}%`
                      }
                    </p>
                    {comp.calcType === 'fixed' && (
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>/ month</p>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeComponent(comp.id)}
                    title="Remove component"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0, color: 'var(--color-text-muted)' }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            type="button"
            onClick={() => navigate('/employees')}
            className="btn btn-secondary"
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save style={{ width: 14, height: 14 }} />
                {isEdit ? 'Save Changes' : 'Add Employee'}
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  )
}
