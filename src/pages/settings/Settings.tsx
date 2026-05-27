import { useState, useEffect } from 'react'
import { Save, Building2, Shield, Bell, Users, Briefcase, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Modal } from '../../components/ui/Modal'
import {
  getCompanySettings, saveCompanySettings,
  apiGetDepartments, apiCreateDepartment, apiUpdateDepartment, apiDeleteDepartment,
  apiGetPositions, apiCreatePosition, apiUpdatePosition, apiDeletePosition,
  getDeductionSettings, saveDeductionSettings,
} from '../../lib/db'
import type { CompanySettings, Department, Position, PayrollDeductionSettings } from '../../types'

const TABS = [
  { id:'company',     label:'Company Info',     icon: Building2 },
  { id:'departments', label:'Departments',       icon: Users },
  { id:'positions',   label:'Positions',         icon: Briefcase },
  { id:'deductions',  label:'Deduction Rules',   icon: Shield },
  { id:'payroll',     label:'Payroll Settings',  icon: Bell },
]

// ─── Settings root ─────────────────────────────────────────────────────────────
export function Settings() {
  const [tab, setTab] = useState('company')

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Company profile, workforce structure, and payroll configuration" />

      {/* Tabs */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
          >
            <t.icon style={{ width: 13, height: 13 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company'     && <CompanyTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'positions'   && <PositionsTab />}
      {tab === 'deductions'  && <DeductionsTab />}
      {tab === 'payroll'     && <PayrollTab />}
    </div>
  )
}

// ─── Company Tab ───────────────────────────────────────────────────────────────
function CompanyTab() {
  const [settings, setSettings] = useState<CompanySettings>(getCompanySettings())
  const [saved, setSaved] = useState(false)

  const update = (patch: Partial<CompanySettings>) => setSettings(s => ({...s, ...patch}))
  const handleSave = () => {
    saveCompanySettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-3.5 h-3.5" />
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <SectionHeader>Company Information</SectionHeader>
          <Field label="Company Name" value={settings.name} onChange={v => update({ name:v })} />
          <Field label="Address" value={settings.address} onChange={v => update({ address:v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact No." value={settings.contact} onChange={v => update({ contact:v })} />
            <Field label="Email" value={settings.email} onChange={v => update({ email:v })} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TIN" value={settings.tin} onChange={v => update({ tin:v })} placeholder="000-000-000-000" />
            <Field label="SSS Employer No." value={settings.sssNo ?? ''} onChange={v => update({ sssNo:v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PhilHealth No." value={settings.philhealthNo ?? ''} onChange={v => update({ philhealthNo:v })} />
            <Field label="Pag-IBIG No." value={settings.pagibigNo ?? ''} onChange={v => update({ pagibigNo:v })} />
          </div>
        </div>
        <div className="card p-5 space-y-4">
          <SectionHeader>HR Contact</SectionHeader>
          <Field label="HR Officer Name" value={settings.hrOfficer ?? ''} onChange={v => update({ hrOfficer:v })} />
          <Field label="HR Email" value={settings.hrEmail ?? ''} onChange={v => update({ hrEmail:v })} type="email" />
          <Field label="Payroll Officer" value={settings.payrollOfficer ?? ''} onChange={v => update({ payrollOfficer:v })} />
        </div>
      </div>
    </div>
  )
}

// ─── Departments Tab ───────────────────────────────────────────────────────────
function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ name:'', code:'', description:'', headName:'' })
  const [deleteId, setDeleteId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => apiGetDepartments().then(d => { setDepartments(d); setLoading(false) })
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm({ name:'', code:'', description:'', headName:'' }); setModalOpen(true) }
  const openEdit = (d: Department) => { setEditing(d); setForm({ name:d.name, code:d.code??'', description:d.description??'', headName:d.headName??'' }); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (editing) await apiUpdateDepartment(editing.id, form)
    else await apiCreateDepartment(form)
    setModalOpen(false); load()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await apiDeleteDepartment(deleteId)
    setDeleteId(null); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Manage your company's departments. These are used when adding employees.</p>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-3.5 h-3.5" />Add Department</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="spinner" /></div>
        ) : departments.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No departments configured yet.</div>
        ) : (
          <table className="table-base w-full">
            <thead><tr>
              <th style={{ paddingLeft:16 }}>Department</th>
              <th>Code</th>
              <th className="hidden md:table-cell">Department Head</th>
              <th className="hidden lg:table-cell">Description</th>
              <th style={{ width:80 }}></th>
            </tr></thead>
            <tbody>
              {departments.map((d, i) => (
                <tr key={d.id} className={i % 2 === 1 ? 'row-alt' : ''}>
                  <td style={{ paddingLeft:16 }}>
                    <span className="text-sm font-semibold text-gray-800">{d.name}</span>
                  </td>
                  <td><span className="pill pill-blue">{d.code || '—'}</span></td>
                  <td className="hidden md:table-cell"><span className="text-sm text-gray-600">{d.headName || '—'}</span></td>
                  <td className="hidden lg:table-cell"><span className="text-xs text-gray-400 line-clamp-1">{d.description || '—'}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors rounded">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(d.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary"><Save className="w-3.5 h-3.5" />Save</button>
        </>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Department Name *</label>
              <input className="input-base" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="e.g. Finance" />
            </div>
            <div>
              <label className="form-label">Code</label>
              <input className="input-base" value={form.code} onChange={e => setForm(f => ({...f, code:e.target.value}))} placeholder="e.g. FIN" maxLength={10} />
            </div>
          </div>
          <div>
            <label className="form-label">Department Head</label>
            <input className="input-base" value={form.headName} onChange={e => setForm(f => ({...f, headName:e.target.value}))} placeholder="Name of head" />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input className="input-base" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="Brief description" />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Department"
        footer={<>
          <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-3.5 h-3.5" />Delete</button>
        </>}>
        <p className="text-sm text-gray-600">Are you sure you want to delete this department? This action cannot be undone. Employees assigned to this department will not be affected.</p>
      </Modal>
    </div>
  )
}

// ─── Positions Tab ─────────────────────────────────────────────────────────────
function PositionsTab() {
  const [positions, setPositions] = useState<Position[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Position | null>(null)
  const [form, setForm] = useState({ title:'', level:'', description:'' })
  const [deleteId, setDeleteId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => apiGetPositions().then(p => { setPositions(p); setLoading(false) })
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm({ title:'', level:'', description:'' }); setModalOpen(true) }
  const openEdit = (p: Position) => { setEditing(p); setForm({ title:p.title, level:p.level??'', description:p.description??'' }); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.title.trim()) return
    if (editing) await apiUpdatePosition(editing.id, form)
    else await apiCreatePosition(form)
    setModalOpen(false); load()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await apiDeletePosition(deleteId)
    setDeleteId(null); load()
  }

  const LEVELS = ['Staff', 'Senior', 'Specialist', 'Officer', 'Supervisor', 'Manager', 'Director', 'Executive']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Manage job positions. Employees can be assigned to these when added or edited.</p>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-3.5 h-3.5" />Add Position</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="spinner" /></div>
        ) : positions.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No positions configured yet.</div>
        ) : (
          <table className="table-base w-full">
            <thead><tr>
              <th style={{ paddingLeft:16 }}>Position Title</th>
              <th>Level</th>
              <th className="hidden lg:table-cell">Description</th>
              <th style={{ width:80 }}></th>
            </tr></thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={p.id} className={i % 2 === 1 ? 'row-alt' : ''}>
                  <td style={{ paddingLeft:16 }}>
                    <span className="text-sm font-semibold text-gray-800">{p.title}</span>
                  </td>
                  <td>
                    {p.level
                      ? <span className="pill pill-indigo">{p.level}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="hidden lg:table-cell"><span className="text-xs text-gray-400 line-clamp-1">{p.description || '—'}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors rounded">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Position' : 'Add Position'}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary"><Save className="w-3.5 h-3.5" />Save</button>
        </>}>
        <div className="space-y-3">
          <div>
            <label className="form-label">Position Title *</label>
            <input className="input-base" value={form.title} onChange={e => setForm(f => ({...f, title:e.target.value}))} placeholder="e.g. Payroll Officer" />
          </div>
          <div>
            <label className="form-label">Level</label>
            <select className="input-base" value={form.level} onChange={e => setForm(f => ({...f, level:e.target.value}))}>
              <option value="">— None —</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Description</label>
            <input className="input-base" value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} placeholder="Brief description" />
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Position"
        footer={<>
          <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-3.5 h-3.5" />Delete</button>
        </>}>
        <p className="text-sm text-gray-600">Are you sure you want to delete this position? Employees currently holding this position will not be affected.</p>
      </Modal>
    </div>
  )
}

// ─── Deductions Tab ────────────────────────────────────────────────────────────
function DeductionsTab() {
  const [ds, setDs] = useState<PayrollDeductionSettings>(getDeductionSettings())
  const [saved, setSaved] = useState(false)

  const up = (patch: Partial<PayrollDeductionSettings>) => setDs(s => ({...s, ...patch}))
  const handleSave = () => {
    saveDeductionSettings(ds)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Configure how deductions are calculated during payroll generation.</p>
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-3.5 h-3.5" />
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Late */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Late Deduction</SectionHeader>
          <Toggle
            label="Enable Late Deduction"
            checked={ds.lateDeductionEnabled}
            onChange={v => up({ lateDeductionEnabled: v })}
          />
          {ds.lateDeductionEnabled && (
            <NumField
              label="Deduction Multiplier"
              value={ds.lateDeductionMultiplier}
              onChange={v => up({ lateDeductionMultiplier: v })}
              step={0.1} min={0} max={3}
              hint="Applied per minute late × (hourly rate ÷ 60). Default: 1.0"
            />
          )}
        </div>

        {/* Absence */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Absence Deduction</SectionHeader>
          <Toggle
            label="Enable Absence Deduction"
            checked={ds.absenceDeductionEnabled}
            onChange={v => up({ absenceDeductionEnabled: v })}
          />
          {ds.absenceDeductionEnabled && (
            <div>
              <label className="form-label">Deduction Method</label>
              <select className="input-base" value={ds.absenceDeductionType}
                onChange={e => up({ absenceDeductionType: e.target.value as PayrollDeductionSettings['absenceDeductionType'] })}>
                <option value="daily-rate">Full Daily Rate per Absent Day</option>
                <option value="zero">No deduction (paid leave policy)</option>
              </select>
            </div>
          )}
        </div>

        {/* Overtime */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Overtime Pay</SectionHeader>
          <Toggle
            label="Enable Overtime Pay"
            checked={ds.overtimeEnabled}
            onChange={v => up({ overtimeEnabled: v })}
          />
          {ds.overtimeEnabled && (
            <>
              <NumField
                label="Regular OT Multiplier"
                value={ds.overtimeMultiplierRegular}
                onChange={v => up({ overtimeMultiplierRegular: v })}
                step={0.05} min={1} max={3}
                hint="Standard PH Labor Code: 1.25×"
              />
              <NumField
                label="Rest Day OT Multiplier"
                value={ds.overtimeMultiplierRestDay}
                onChange={v => up({ overtimeMultiplierRestDay: v })}
                step={0.05} min={1} max={3}
                hint="Standard PH Labor Code: 1.30×"
              />
              <NumField
                label="OT Threshold (minutes)"
                value={ds.overtimeThresholdMinutes}
                onChange={v => up({ overtimeThresholdMinutes: v })}
                step={5} min={0} max={120}
                hint="Minutes after shift end before OT counting starts"
              />
            </>
          )}
        </div>

        {/* Night Diff */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Night Differential</SectionHeader>
          <Toggle
            label="Enable Night Differential Pay"
            checked={ds.nightDiffEnabled}
            onChange={v => up({ nightDiffEnabled: v })}
          />
          {ds.nightDiffEnabled && (
            <NumField
              label="Night Diff Multiplier"
              value={ds.nightDiffMultiplier}
              onChange={v => up({ nightDiffMultiplier: v })}
              step={0.01} min={0} max={1}
              hint="Applied as % of hourly rate. Standard: 10% (0.10)"
            />
          )}
          <div className="p-3 text-xs rounded" style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', color:'#166534' }}>
            Government deductions (SSS, PhilHealth, Pag-IBIG, Withholding Tax) always follow official PH regulations and are not configurable.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Payroll Settings Tab ──────────────────────────────────────────────────────
function PayrollTab() {
  const [settings, setSettings] = useState<CompanySettings>(getCompanySettings())
  const [saved, setSaved] = useState(false)

  const update = (patch: Partial<CompanySettings>) => setSettings(s => ({...s, ...patch}))
  const handleSave = () => {
    saveCompanySettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-3.5 h-3.5" />
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <SectionHeader>Pay Frequency Default</SectionHeader>
          <div>
            <label className="form-label">Default Pay Frequency</label>
            <select className="input-base" value={settings.defaultFrequency ?? 'bi-monthly'}
              onChange={e => update({ defaultFrequency: e.target.value as CompanySettings['defaultFrequency'] })}>
              <option value="bi-monthly">Bi-Monthly (Semi-Monthly)</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">New employees will default to this frequency.</p>
          </div>
          <div className="p-3 text-xs rounded" style={{ background:'#FFF7ED', border:'1px solid #FED7AA', color:'#9A3412' }}>
            Note: Government deductions (SSS, PhilHealth, Pag-IBIG) are monthly amounts divided by pay frequency (÷4 for weekly, ÷2 for semi-monthly). OT multipliers are configured in Deduction Rules.
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <SectionHeader>Leave Credits (Annual)</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Vacation Leave (days)" value={settings.vacationLeaveCredits ?? 15} onChange={v => update({ vacationLeaveCredits: v })} />
            <NumField label="Sick Leave (days)" value={settings.sickLeaveCredits ?? 15} onChange={v => update({ sickLeaveCredits: v })} />
            <NumField label="Emergency Leave (days)" value={settings.emergencyLeaveCredits ?? 3} onChange={v => update({ emergencyLeaveCredits: v })} />
          </div>
          <div className="p-3 text-xs rounded" style={{ background:'#FFFBEB', border:'1px solid #FDE68A', color:'#92400E' }}>
            Minimum 5 days SIL required by PH Labor Code for employees with ≥1 year tenure.
          </div>
        </div>

        {/* Tax reference */}
        <div className="card p-5 space-y-3 lg:col-span-2">
          <SectionHeader>Withholding Tax Reference (BIR TRAIN Law 2023+)</SectionHeader>
          <p className="text-xs text-gray-400">These brackets are automatically applied per law and cannot be manually overridden.</p>
          <div className="overflow-x-auto">
            <table className="table-base w-full text-xs">
              <thead>
                <tr>
                  <th>Monthly Taxable Income</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['≤ ₱20,833','0%'],
                  ['₱20,833 – ₱33,332','20% of excess over ₱20,833'],
                  ['₱33,333 – ₱66,666','₱2,500 + 25% of excess over ₱33,333'],
                  ['₱66,667 – ₱166,666','₱10,833.33 + 30% of excess over ₱66,667'],
                  ['₱166,667 – ₱666,666','₱40,833.33 + 32% of excess over ₱166,667'],
                  ['> ₱666,667','₱200,833.33 + 35% of excess over ₱666,667'],
                ].map(([range, rate]) => (
                  <tr key={range}>
                    <td className="px-3 py-1.5 text-gray-700 tabular-nums">{range}</td>
                    <td className="px-3 py-1.5 text-gray-600">{rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared sub-components ─────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="section-title">
      {children}
    </h3>
  )
}

function Field({ label, value, onChange, type='text', placeholder }:
  { label:string; value:string; onChange:(v:string)=>void; type?:string; placeholder?:string }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input type={type} className="input-base" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function NumField({ label, value, onChange, step=1, min=0, max=9999, hint }:
  { label:string; value:number; onChange:(v:number)=>void; step?:number; min?:number; max?:number; hint?:string }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input type="number" step={step} min={min} max={max} className="input-base" value={value}
        onChange={e => onChange(Number(e.target.value))} />
      {hint && <p className="text-gray-400 mt-1" style={{ fontSize: 11 }}>{hint}</p>}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className="toggle-track"
        style={{ background: checked ? '#1a56db' : '#d1d5db' }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="toggle-thumb"
          style={{ left: checked ? '18px' : '2px' }}
        />
      </div>
      <span className="font-medium text-gray-700" style={{ fontSize: 13 }}>{label}</span>
      {checked
        ? <Check style={{ width: 13, height: 13, color: '#15803d', marginLeft: 'auto' }} />
        : <X style={{ width: 13, height: 13, color: '#d1d5db', marginLeft: 'auto' }} />}
    </label>
  )
}
