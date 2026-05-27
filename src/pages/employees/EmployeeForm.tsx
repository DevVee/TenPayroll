import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import {
  apiGetEmployee, apiCreateEmployee, apiUpdateEmployee,
  apiGetShifts, apiGetDepartments, apiGetPositions,
} from '../../lib/db'
import type { Employee, WorkShift, Department, Position, CompensationType } from '../../types'

type FormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

const BLANK: FormData = {
  employeeNo:'', firstName:'', lastName:'', middleName:'', fullName:'',
  email:'', phone:'', address:'', birthDate:'', gender:'male', civilStatus:'single',
  position:'', department:'', employmentType:'regular', status:'active',
  hireDate: new Date().toISOString().split('T')[0],
  compensationType: 'monthly', compensationRate: 0,
  basicSalary: 0, dailyRate: 0, payFrequency:'weekly', pinCode:'', rfidTag:'',
  sssNo:'', philhealthNo:'', pagibigNo:'', tinNo:'',
  bankName:'', bankAccount:'', shiftId:'sh-1', taxStatus:'S',
  allowances:[], emergencyContactName:'', emergencyContactPhone:'',
}

const SECTIONS = ['Personal', 'Employment', 'Compensation', 'Government IDs', 'Emergency & Bank'] as const
const STEPPER_STEPS = SECTIONS.map(s => ({ label: s }))

const COMP_LABELS: Record<CompensationType, { rate: string; hint: string }> = {
  daily:   { rate: 'Daily Rate (₱)',     hint: 'Pay per working day. Monthly salary ≈ daily × 22.' },
  weekly:  { rate: 'Weekly Rate (₱)',    hint: 'Pay per week. Monthly salary ≈ weekly × 4.33.' },
  monthly: { rate: 'Monthly Salary (₱)', hint: 'Full monthly salary. Daily rate auto-computed ÷ 22.' },
}

// ── Field — MODULE-LEVEL (prevents re-mount/focus-loss bug) ──────────────────
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── PSGC Cascading Address ───────────────────────────────────────────────────
interface PSGCItem { code: string; name: string }

/** Fetch JSON from PSGC API with sessionStorage caching (avoids repeat calls on re-mount). */
async function fetchPSGC<T>(url: string): Promise<T> {
  const cached = sessionStorage.getItem(`psgc:${url}`)
  if (cached) return JSON.parse(cached) as T
  const res  = await fetch(url)
  const data = await res.json() as T
  sessionStorage.setItem(`psgc:${url}`, JSON.stringify(data))
  return data
}

function AddressSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [manual,      setManual]      = useState(false)
  const [house,       setHouse]       = useState('')
  const [regionCode,  setRegionCode]  = useState('')
  const [provinceCode,setProvinceCode]= useState('')
  const [cityCode,    setCityCode]    = useState('')
  const [barangay,    setBarangay]    = useState('')

  const [regions,   setRegions]   = useState<PSGCItem[]>([])
  const [provinces, setProvinces] = useState<PSGCItem[]>([])
  const [cities,    setCities]    = useState<PSGCItem[]>([])
  const [barangays, setBarangays] = useState<PSGCItem[]>([])

  const [loadP, setLoadP] = useState(false)
  const [loadC, setLoadC] = useState(false)
  const [loadB, setLoadB] = useState(false)

  // Stable ref to onChange to avoid stale closure in effects
  const cbRef = useRef(onChange)
  useEffect(() => { cbRef.current = onChange }, [onChange])

  // Seed house from existing address on first non-empty load (edit mode)
  const seeded = useRef(false)
  useEffect(() => {
    if (!seeded.current && value) {
      setHouse(value)
      seeded.current = true
    }
  }, [value])

  // Fetch regions on mount (cached in sessionStorage)
  useEffect(() => {
    fetchPSGC<PSGCItem[]>('https://psgc.gitlab.io/api/regions.json')
      .then(data => setRegions(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setManual(true))
  }, [])

  // Fetch provinces when region selected (cached)
  useEffect(() => {
    if (!regionCode) { setProvinces([]); return }
    setLoadP(true)
    fetchPSGC<PSGCItem[]>(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces.json`)
      .then(data => { setProvinces(data.sort((a,b)=>a.name.localeCompare(b.name))); setLoadP(false) })
      .catch(() => { setLoadP(false); setManual(true) })
  }, [regionCode])

  // Fetch cities when province selected (cached)
  useEffect(() => {
    if (!provinceCode) { setCities([]); return }
    setLoadC(true)
    fetchPSGC<PSGCItem[]>(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities.json`)
      .then(data => { setCities(data.sort((a,b)=>a.name.localeCompare(b.name))); setLoadC(false) })
      .catch(() => { setLoadC(false); setManual(true) })
  }, [provinceCode])

  // Fetch barangays when city selected (cached)
  useEffect(() => {
    if (!cityCode) { setBarangays([]); return }
    setLoadB(true)
    fetchPSGC<PSGCItem[]>(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays.json`)
      .then(data => { setBarangays(data.sort((a,b)=>a.name.localeCompare(b.name))); setLoadB(false) })
      .catch(() => { setLoadB(false); setManual(true) })
  }, [cityCode])

  // Compose address and notify parent
  useEffect(() => {
    const rName = regions.find(r => r.code === regionCode)?.name   ?? ''
    const pName = provinces.find(p => p.code === provinceCode)?.name ?? ''
    const cName = cities.find(c => c.code === cityCode)?.name       ?? ''
    const parts = [house, barangay, cName, pName, rName].filter(Boolean)
    if (parts.length > 0) cbRef.current(parts.join(', '))
  }, [house, barangay, cityCode, provinceCode, regionCode, regions, provinces, cities])

  if (manual) {
    return (
      <div>
        <label className="form-label">Home Address</label>
        <input className="input-base" value={value} onChange={e => onChange(e.target.value)} placeholder="Complete home address..." />
      </div>
    )
  }

  const preview = [
    house, barangay,
    cities.find(c => c.code === cityCode)?.name     ?? '',
    provinces.find(p => p.code === provinceCode)?.name ?? '',
    regions.find(r => r.code === regionCode)?.name   ?? '',
  ].filter(Boolean).join(', ')

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="form-label" style={{ marginBottom: 0 }}>Home Address</label>
        <button
          type="button"
          onClick={() => setManual(true)}
          style={{ fontSize: 11, color: '#4F46E5', fontWeight: 500, cursor: 'pointer' }}
        >
          Type manually instead
        </button>
      </div>

      {/* House / Street */}
      <input
        className="input-base"
        value={house}
        onChange={e => setHouse(e.target.value)}
        placeholder="House No. / Street (optional)"
      />

      {/* Cascading dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          className="input-base"
          value={regionCode}
          onChange={e => {
            setRegionCode(e.target.value)
            setProvinceCode(''); setProvinces([])
            setCityCode(''); setCities([])
            setBarangay(''); setBarangays([])
          }}
        >
          <option value="">— Select Region —</option>
          {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>

        <select
          className="input-base"
          value={provinceCode}
          disabled={!regionCode || loadP}
          onChange={e => {
            setProvinceCode(e.target.value)
            setCityCode(''); setCities([])
            setBarangay(''); setBarangays([])
          }}
        >
          <option value="">{loadP ? 'Loading provinces…' : regionCode ? '— Province —' : '— Select Region first —'}</option>
          {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>

        <select
          className="input-base"
          value={cityCode}
          disabled={!provinceCode || loadC}
          onChange={e => {
            setCityCode(e.target.value)
            setBarangay(''); setBarangays([])
          }}
        >
          <option value="">{loadC ? 'Loading cities…' : provinceCode ? '— City / Municipality —' : '— Select Province first —'}</option>
          {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>

        <select
          className="input-base"
          value={barangay}
          disabled={!cityCode || loadB}
          onChange={e => setBarangay(e.target.value)}
        >
          <option value="">{loadB ? 'Loading barangays…' : cityCode ? '— Barangay —' : '— Select City first —'}</option>
          {barangays.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
        </select>
      </div>

      {/* Composed preview */}
      {preview && (
        <p style={{ fontSize: 11, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px 10px', lineHeight: 1.5 }}>
          📍 {preview}
        </p>
      )}
    </div>
  )
}

// ── Toggle Switch Row ─────────────────────────────────────────────────────────
function SectionToggle({ label, hint, enabled, onChange }: {
  label: string; hint?: string; enabled: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg cursor-pointer select-none"
      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
      onClick={() => onChange(!enabled)}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{hint}</p>}
      </div>
      {/* Visual toggle */}
      <div style={{
        width: 40, height: 22, borderRadius: 11,
        background: enabled ? '#4F46E5' : '#CBD5E1',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 2, left: enabled ? 20 : 2,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  )
}

// ── Main EmployeeForm Component ──────────────────────────────────────────────
export function EmployeeForm() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const [form,        setForm]       = useState<FormData>(BLANK)
  const [shifts,      setShifts]     = useState<WorkShift[]>([])
  const [departments, setDepts]      = useState<Department[]>([])
  const [positions,   setPositions]  = useState<Position[]>([])
  const [sectionIdx,  setSectionIdx] = useState(0)
  const [saving,      setSaving]     = useState(false)
  const [error,       setError]      = useState('')
  const [govEnabled,  setGovEnabled] = useState(false)
  const [bankEnabled, setBankEnabled]= useState(false)

  const section = SECTIONS[sectionIdx]

  useEffect(() => {
    Promise.all([apiGetShifts(), apiGetDepartments(), apiGetPositions()])
      .then(([sh, depts, pos]) => { setShifts(sh); setDepts(depts); setPositions(pos) })

    if (isEdit) {
      apiGetEmployee(id!).then(emp => {
        if (!emp) return
        setForm({
          ...emp,
          compensationType: emp.compensationType ?? 'monthly',
          compensationRate: emp.compensationRate ?? emp.basicSalary,
        })
        // Auto-enable sections if data already exists
        if (emp.sssNo || emp.philhealthNo || emp.pagibigNo || emp.tinNo) setGovEnabled(true)
        if (emp.bankName || emp.bankAccount) setBankEnabled(true)
      })
    }
  }, [id, isEdit])

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'firstName' || k === 'lastName' || k === 'middleName') {
        next.fullName = [next.firstName, next.middleName, next.lastName].filter(Boolean).join(' ')
      }
      if (k === 'compensationType' || k === 'compensationRate') {
        const type = k === 'compensationType' ? (v as CompensationType) : next.compensationType
        const rate = k === 'compensationRate' ? (v as number) : next.compensationRate
        if (type === 'monthly') {
          next.basicSalary = rate
          next.dailyRate   = Math.round((rate / 22) * 100) / 100
        } else if (type === 'daily') {
          next.dailyRate   = rate
          next.basicSalary = Math.round(rate * 22 * 100) / 100
        } else if (type === 'weekly') {
          next.basicSalary = Math.round(rate * 4.33 * 100) / 100
          next.dailyRate   = Math.round((rate / 5) * 100) / 100
        }
      }
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.firstName.trim() || !form.lastName.trim() || !form.position) {
      setError('Please fill in First Name, Last Name, and Position.')
      return
    }
    setSaving(true)
    try {
      const finalForm: FormData = {
        ...form,
        // Auto-generate employee number if not provided
        employeeNo: form.employeeNo.trim() || `EMP-${Date.now().toString().slice(-6)}`,
      }
      if (isEdit) await apiUpdateEmployee(id!, finalForm)
      else        await apiCreateEmployee(finalForm)
      navigate('/employees')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee.')
    } finally {
      setSaving(false)
    }
  }

  const isFirst = sectionIdx === 0
  const isLast  = sectionIdx === SECTIONS.length - 1

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Employees"
        title={isEdit ? 'Edit Employee' : 'Add New Employee'}
        subtitle={isEdit ? form.fullName : 'Fill in the employee details below'}
        actions={[{
          label: 'Cancel', icon: ArrowLeft, variant: 'secondary',
          onClick: () => navigate('/employees'),
        }]}
      />

      {error && (
        <div className="px-4 py-3 text-sm font-medium rounded-lg"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* ── Horizontal Stepper ── */}
      <div className="card px-6 py-4">
        <ProgressStepper steps={STEPPER_STEPS} currentStep={sectionIdx} orientation="horizontal" />
      </div>

      <form onSubmit={submit} className="space-y-4">

        {/* ── Form Card ── */}
        <div className="card p-5">

          {/* ── PERSONAL ── */}
          {section === 'Personal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="First Name" required>
                  <input className="input-base" value={form.firstName}
                    onChange={e => set('firstName', e.target.value)} />
                </Field>
                <Field label="Middle Name">
                  <input className="input-base" value={form.middleName}
                    onChange={e => set('middleName', e.target.value)} />
                </Field>
                <Field label="Last Name" required>
                  <input className="input-base" value={form.lastName}
                    onChange={e => set('lastName', e.target.value)} />
                </Field>
                <Field label="Email Address">
                  <input type="email" className="input-base" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="employee@company.com" />
                </Field>
                <Field label="Phone Number">
                  <input className="input-base" value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="09XX XXX XXXX" />
                </Field>
                <Field label="Date of Birth">
                  <input type="date" className="input-base" value={form.birthDate}
                    onChange={e => set('birthDate', e.target.value)} />
                </Field>
                <Field label="Gender">
                  <select className="input-base" value={form.gender}
                    onChange={e => set('gender', e.target.value as 'male'|'female')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
                <Field label="Civil Status">
                  <select className="input-base" value={form.civilStatus}
                    onChange={e => set('civilStatus', e.target.value as Employee['civilStatus'])}>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="widowed">Widowed</option>
                    <option value="separated">Separated</option>
                  </select>
                </Field>
              </div>

              {/* Address with PSGC API */}
              <AddressSection value={form.address} onChange={v => set('address', v)} />
            </div>
          )}

          {/* ── EMPLOYMENT ── */}
          {section === 'Employment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Employee No.</label>
                <input className="input-base" value={form.employeeNo}
                  onChange={e => set('employeeNo', e.target.value)}
                  placeholder="Auto-generated if left blank" />
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Leave blank to auto-assign on save.
                </p>
              </div>
              <div>
                <label className="form-label">
                  Kiosk PIN{' '}
                  <span style={{ color: '#64748B', fontSize: 10, fontWeight: 400 }}>(4–8 digits, must be unique)</span>
                </label>
                <input
                  className="input-base"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={form.pinCode ?? ''}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                    set('pinCode', v)
                  }}
                  placeholder="e.g. 1234"
                />
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Used by the kiosk for time-in/out. Leave blank to disable PIN login.
                </p>
              </div>
              <div>
                <label className="form-label">
                  RFID Card ID{' '}
                  <span style={{ color: '#64748B', fontSize: 10, fontWeight: 400 }}>(can be set later)</span>
                </label>
                <input className="input-base" value={form.rfidTag ?? ''}
                  onChange={e => set('rfidTag', e.target.value)}
                  placeholder="Scan or type card UID…" />
              </div>
              <Field label="Department" required>
                <select className="input-base" value={form.department}
                  onChange={e => set('department', e.target.value)}>
                  <option value="">— Select department —</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Position" required>
                <select className="input-base" value={form.position}
                  onChange={e => set('position', e.target.value)}>
                  <option value="">— Select position —</option>
                  {positions.map(p =>
                    <option key={p.id} value={p.title}>
                      {p.title}{p.level ? ` (${p.level})` : ''}
                    </option>
                  )}
                </select>
              </Field>
              <Field label="Employment Type">
                <select className="input-base" value={form.employmentType}
                  onChange={e => set('employmentType', e.target.value as Employee['employmentType'])}>
                  <option value="regular">Regular</option>
                  <option value="probationary">Probationary</option>
                  <option value="contractual">Contractual</option>
                  <option value="part-time">Part-time</option>
                </select>
              </Field>
              <Field label="Status">
                <select className="input-base" value={form.status}
                  onChange={e => set('status', e.target.value as Employee['status'])}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                  <option value="awol">AWOL</option>
                </select>
              </Field>
              <Field label="Hire Date">
                <input type="date" className="input-base" value={form.hireDate}
                  onChange={e => set('hireDate', e.target.value)} />
              </Field>
              <Field label="Work Shift">
                <select className="input-base" value={form.shiftId}
                  onChange={e => set('shiftId', e.target.value)}>
                  {shifts.map(s =>
                    <option key={s.id} value={s.id}>{s.name} ({s.timeIn}–{s.timeOut})</option>
                  )}
                </select>
              </Field>
              <Field label="Pay Frequency">
                <select className="input-base" value={form.payFrequency}
                  onChange={e => set('payFrequency', e.target.value as Employee['payFrequency'])}>
                  <option value="weekly">Weekly</option>
                  <option value="bi-monthly">Bi-Monthly (Semi-Monthly)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
            </div>
          )}

          {/* ── COMPENSATION ── */}
          {section === 'Compensation' && (
            <div className="space-y-5">
              {/* Type picker */}
              <div>
                <label className="form-label mb-2 block">Compensation Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['daily', 'weekly', 'monthly'] as CompensationType[]).map(type => {
                    const active = form.compensationType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set('compensationType', type)}
                        className="px-3 py-3 text-left transition-all rounded-lg"
                        style={{
                          border:     `1.5px solid ${active ? '#4F46E5' : '#E2E8F0'}`,
                          background: active ? '#EEF2FF' : '#fff',
                          boxShadow:  active ? '0 0 0 3px rgba(79,70,229,0.12)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#4F46E5' : '#0F172A', textTransform: 'capitalize' }}>
                          {type}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 2, color: active ? '#6366F1' : '#64748B' }}>
                          {type === 'daily' ? 'Pay per working day' : type === 'weekly' ? 'Pay per week' : 'Fixed monthly salary'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">{COMP_LABELS[form.compensationType].rate} *</label>
                  <input
                    type="number" className="input-base"
                    value={form.compensationRate || ''}
                    onChange={e => set('compensationRate', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    {COMP_LABELS[form.compensationType].hint}
                  </p>
                </div>
                <div>
                  <label className="form-label">Monthly Equivalent (₱)</label>
                  <input type="number" className="input-base" value={form.basicSalary || ''} readOnly
                    style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }} />
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Used for SSS, PhilHealth, Pag-IBIG</p>
                </div>
                <div>
                  <label className="form-label">Daily Rate Equivalent (₱)</label>
                  <input type="number" className="input-base" value={form.dailyRate || ''} readOnly
                    style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }} />
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Used for attendance-based pay</p>
                </div>
                <div>
                  <label className="form-label">Tax Status</label>
                  <select className="input-base" value={form.taxStatus}
                    onChange={e => set('taxStatus', e.target.value as Employee['taxStatus'])}>
                    {['S','S1','S2','S3','ME','ME1','ME2','ME3'].map(t =>
                      <option key={t} value={t}>{t}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Allowances */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Allowances
                  </h3>
                  <button
                    type="button"
                    onClick={() => set('allowances', [...form.allowances, { type:'', amount:0, taxable:false }])}
                    className="flex items-center gap-1 font-semibold hover:underline"
                    style={{ fontSize: 11, color: '#4F46E5' }}
                  >
                    <Plus style={{ width: 11, height: 11 }} />Add
                  </button>
                </div>
                {form.allowances.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#64748B' }}>No allowances added.</p>
                ) : (
                  <div className="space-y-2">
                    {form.allowances.map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          placeholder="Type (e.g. Transportation)"
                          className="input-base flex-1"
                          value={a.type}
                          onChange={e => {
                            const next = [...form.allowances]
                            next[i] = { ...next[i], type: e.target.value }
                            set('allowances', next)
                          }}
                        />
                        <input
                          type="number" placeholder="Amount" className="input-base"
                          style={{ width: 120 }}
                          value={a.amount || ''}
                          onChange={e => {
                            const next = [...form.allowances]
                            next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 }
                            set('allowances', next)
                          }}
                        />
                        <label className="flex items-center gap-1.5 whitespace-nowrap"
                          style={{ fontSize: 12, color: '#475569' }}>
                          <input
                            type="checkbox" checked={a.taxable}
                            onChange={e => {
                              const next = [...form.allowances]
                              next[i] = { ...next[i], taxable: e.target.checked }
                              set('allowances', next)
                            }}
                          />
                          Taxable
                        </label>
                        <button
                          type="button"
                          onClick={() => set('allowances', form.allowances.filter((_,j) => j !== i))}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors rounded-lg"
                        >
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── GOVERNMENT IDs ── */}
          {section === 'Government IDs' && (
            <div className="space-y-4">
              <SectionToggle
                label="Government IDs"
                hint="SSS, PhilHealth, Pag-IBIG, and TIN — can be added later"
                enabled={govEnabled}
                onChange={setGovEnabled}
              />
              {govEnabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="SSS Number">
                    <input className="input-base" value={form.sssNo}
                      onChange={e => set('sssNo', e.target.value)} placeholder="34-XXXXXXX-X" />
                  </Field>
                  <Field label="PhilHealth Number">
                    <input className="input-base" value={form.philhealthNo}
                      onChange={e => set('philhealthNo', e.target.value)} placeholder="12-XXXXXXXXX-X" />
                  </Field>
                  <Field label="Pag-IBIG Number">
                    <input className="input-base" value={form.pagibigNo}
                      onChange={e => set('pagibigNo', e.target.value)} placeholder="XXXX-XXXX-XXXX" />
                  </Field>
                  <Field label="TIN Number">
                    <input className="input-base" value={form.tinNo}
                      onChange={e => set('tinNo', e.target.value)} placeholder="XXX-XXX-XXX-XXX" />
                  </Field>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#64748B' }}>
                  Government IDs are optional. Enable the toggle above to add them, or edit the employee profile later.
                </p>
              )}
            </div>
          )}

          {/* ── EMERGENCY & BANK ── */}
          {section === 'Emergency & Bank' && (
            <div className="space-y-5">
              {/* Emergency Contact */}
              <div>
                <h3 style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contact Name">
                    <input className="input-base" value={form.emergencyContactName}
                      onChange={e => set('emergencyContactName', e.target.value)} />
                  </Field>
                  <Field label="Contact Phone">
                    <input className="input-base" value={form.emergencyContactPhone}
                      onChange={e => set('emergencyContactPhone', e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Bank */}
              <SectionToggle
                label="Bank / Payroll Account"
                hint="Bank name and account number for payroll disbursement — can be added later"
                enabled={bankEnabled}
                onChange={setBankEnabled}
              />
              {bankEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Bank Name">
                    <input className="input-base" value={form.bankName}
                      onChange={e => set('bankName', e.target.value)}
                      placeholder="BDO, BPI, Metrobank…" />
                  </Field>
                  <Field label="Bank Account Number">
                    <input className="input-base" value={form.bankAccount}
                      onChange={e => set('bankAccount', e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation Footer ── */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSectionIdx(i => i - 1)}
            disabled={isFirst}
            className="btn btn-secondary"
            style={isFirst ? { opacity: 0.4, pointerEvents: 'none' } : {}}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back
          </button>

          <div className="flex gap-2">
            {!isLast && (
              <button type="button" onClick={() => setSectionIdx(i => i + 1)} className="btn btn-primary">
                Next
                <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            )}
            {isLast && (
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save style={{ width: 14, height: 14 }} />
                    {isEdit ? 'Update Employee' : 'Create Employee'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
