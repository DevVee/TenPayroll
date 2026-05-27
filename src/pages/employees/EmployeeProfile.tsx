import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit2, ArrowLeft, Mail, Phone, Calendar, CreditCard, Clock } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useData } from '../../hooks/useData'
import { apiGetEmployee, apiGetAttendance, apiGetLeaves, apiGetPayrollPeriods, apiGetPayrollEntries } from '../../lib/db'
import { formatPeso } from '../../lib/payrollEngine'
import type { PayrollEntry } from '../../types'

const TABS = ['Overview', 'Attendance', 'Payroll History', 'Leaves'] as const
type Tab = typeof TABS[number]

const STATUS_STYLE: Record<string, string> = {
  present:'bg-green-50 text-green-700', late:'bg-yellow-50 text-yellow-700',
  absent:'bg-red-50 text-red-700', 'on-leave':'bg-blue-50 text-blue-700',
  'half-day':'bg-orange-50 text-orange-700', 'rest-day':'bg-gray-100 text-gray-500',
}

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('Overview')

  const { data: emp, loading } = useData(() => apiGetEmployee(id!), [id])
  const { data: attendance }   = useData(() => apiGetAttendance({ employeeId: id, startDate: new Date(Date.now()-30*864e5).toISOString().split('T')[0] }), [id])
  const { data: leaves }       = useData(() => apiGetLeaves({ employeeId: id }), [id])
  const { data: periods }      = useData(() => apiGetPayrollPeriods(), [])

  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)

  const loadEntries = async () => {
    if (entriesLoaded || !periods) return
    const all: PayrollEntry[] = []
    for (const p of periods.slice(0, 5)) {
      const entries = await apiGetPayrollEntries(p.id)
      const e = entries.find(e => e.employeeId === id)
      if (e) all.push(e)
    }
    setPayrollEntries(all)
    setEntriesLoaded(true)
  }

  if (tab === 'Payroll History' && !entriesLoaded) loadEntries()

  if (loading || !emp) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  const att = attendance ?? []
  const lv  = leaves ?? []
  const presentDays = att.filter(a => a.status === 'present' || a.status === 'late').length
  const lateDays    = att.filter(a => a.status === 'late').length
  const absentDays  = att.filter(a => a.status === 'absent').length

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Employees"
        title={emp.fullName}
        subtitle={`${emp.employeeNo} · ${emp.position}`}
        actions={[
          { label: 'Back', icon: ArrowLeft, variant: 'secondary', onClick: () => navigate('/employees') },
          { label: 'Edit', icon: Edit2, onClick: () => navigate(`/employees/${id}/edit`) },
        ]}
      />

      {/* Profile header card */}
      <div className="card p-5">
        <div className="flex items-start gap-5">
          <div
            className="avatar avatar-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1a56db, #1245b8)' }}
          >
            {emp.firstName[0]}{emp.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-gray-900">{emp.fullName}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold capitalize
                ${emp.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {emp.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{emp.position} · {emp.department}</p>
            <div className="flex flex-wrap gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Mail className="w-3.5 h-3.5" />{emp.email}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone className="w-3.5 h-3.5" />{emp.phone}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />Hired {new Date(emp.hireDate).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'})}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <CreditCard className="w-3.5 h-3.5" />₱{emp.basicSalary.toLocaleString()} / mo
              </span>
            </div>
          </div>
          {/* Quick stats */}
          <div className="hidden lg:flex gap-4">
            {[
              { label:'Present (30d)', value: presentDays, color:'text-green-600' },
              { label:'Late (30d)',    value: lateDays,    color:'text-yellow-600' },
              { label:'Absent (30d)', value: absentDays,  color:'text-red-600' },
            ].map(s => (
              <div key={s.label} className="text-center px-4 py-2" style={{ borderLeft:'1px solid #F3F4F6' }}>
                <p className={`text-2xl font-black ${s.color} tabular-nums`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoSection title="Personal Information">
            {[
              ['Full Name',      emp.fullName],
              ['Employee No.',   emp.employeeNo],
              ['Date of Birth',  new Date(emp.birthDate).toLocaleDateString('en-PH')],
              ['Gender',         emp.gender],
              ['Civil Status',   emp.civilStatus],
              ['Address',        emp.address],
              ['Phone',          emp.phone],
              ['Email',          emp.email],
            ]}
          </InfoSection>
          <InfoSection title="Employment Details">
            {[
              ['Department',      emp.department],
              ['Position',        emp.position],
              ['Employment Type', emp.employmentType],
              ['Hire Date',       new Date(emp.hireDate).toLocaleDateString('en-PH')],
              ['Pay Frequency',   emp.payFrequency],
              ['Tax Status',      emp.taxStatus],
              ['Basic Salary',    formatPeso(emp.basicSalary)],
              ['Daily Rate',      formatPeso(emp.dailyRate)],
            ]}
          </InfoSection>
          <InfoSection title="Government IDs">
            {[
              ['SSS No.',       emp.sssNo],
              ['PhilHealth No.',emp.philhealthNo],
              ['Pag-IBIG No.',  emp.pagibigNo],
              ['TIN No.',       emp.tinNo],
            ]}
          </InfoSection>
          <InfoSection title="Banking & Emergency Contact">
            {[
              ['Bank Name',      emp.bankName],
              ['Bank Account',   emp.bankAccount],
              ['Emergency Name', emp.emergencyContactName],
              ['Emergency Phone',emp.emergencyContactPhone],
            ]}
          </InfoSection>
          {emp.allowances.length > 0 && (
            <div className="card p-4 lg:col-span-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Allowances</h3>
              <div className="flex flex-wrap gap-2">
                {emp.allowances.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5"
                    style={{ background:'#F9FAFB', border:'1px solid #E5E7EB' }}>
                    <span className="text-sm text-gray-700">{a.type}</span>
                    <span className="text-sm font-bold text-gray-900">{formatPeso(a.amount)}</span>
                    {!a.taxable && <span className="text-[10px] text-green-600 font-semibold">NON-TAX</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attendance */}
      {tab === 'Attendance' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #F3F4F6' }}>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand" />Last 30 Days Attendance
            </h3>
          </div>
          {att.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No attendance records found</div>
          ) : (
            <table className="table-base w-full">
              <thead>
                <tr>
                  {['Date','Time In','Time Out','Hours','Late','Status'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {att.filter(a => a.status !== 'rest-day').map(a => {
                  const hours = a.timeIn && a.timeOut
                    ? ((new Date(a.timeOut).getTime() - new Date(a.timeIn).getTime()) / 3600000).toFixed(1)
                    : '—'
                  return (
                    <tr key={a.id}>
                      <td className="px-5 py-2.5 text-sm text-gray-700 font-medium tabular-nums">{a.date}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">
                        {a.timeIn ? new Date(a.timeIn).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',hour12:true}) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">
                        {a.timeOut ? new Date(a.timeOut).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',hour12:true}) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">{hours}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">
                        {a.minutesLate > 0 ? `${a.minutesLate}m` : '—'}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {a.status.replace('-',' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payroll History */}
      {tab === 'Payroll History' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #F3F4F6' }}>
            <h3 className="text-sm font-bold text-gray-800">Payroll History</h3>
          </div>
          {payrollEntries.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {entriesLoaded ? 'No payroll records found' : 'Loading…'}
            </div>
          ) : (
            <table className="table-base w-full">
              <thead>
                <tr>
                  {['Period','Gross Pay','Deductions','Net Pay',''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollEntries.map(pe => {
                  const period = periods?.find(p => p.id === pe.payrollPeriodId)
                  return (
                    <tr key={pe.id}>
                      <td className="px-5 py-2.5">
                        <p className="text-sm font-semibold text-gray-800">{period?.periodNo ?? '—'}</p>
                        <p className="text-xs text-gray-400">{period?.startDate} – {period?.endDate}</p>
                      </td>
                      <td className="px-5 py-2.5 text-sm font-semibold text-gray-800 tabular-nums">{formatPeso(pe.grossPay)}</td>
                      <td className="px-5 py-2.5 text-sm font-semibold text-red-600 tabular-nums">−{formatPeso(pe.totalDeductions)}</td>
                      <td className="px-5 py-2.5 text-sm font-black text-brand tabular-nums">{formatPeso(pe.netPay)}</td>
                      <td className="px-5 py-2.5">
                        <button onClick={() => navigate(`/payroll/${pe.payrollPeriodId}/payslip/${pe.employeeId}`)}
                          className="text-xs text-brand font-semibold hover:underline">Payslip →</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Leaves */}
      {tab === 'Leaves' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #F3F4F6' }}>
            <h3 className="text-sm font-bold text-gray-800">Leave Requests</h3>
          </div>
          {lv.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">No leave records found</div>
          ) : (
            <table className="table-base w-full">
              <thead>
                <tr>
                  {['Type','Start','End','Days','Reason','Status'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lv.map(l => (
                  <tr key={l.id}>
                    <td className="px-5 py-2.5 text-sm capitalize font-medium text-gray-700">{l.leaveType}</td>
                    <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">{l.startDate}</td>
                    <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">{l.endDate}</td>
                    <td className="px-5 py-2.5 text-sm text-gray-600 tabular-nums">{l.days}</td>
                    <td className="px-5 py-2.5 text-sm text-gray-600 max-w-xs truncate">{l.reason}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold capitalize
                        ${l.status==='approved'?'bg-green-50 text-green-700':l.status==='pending'?'bg-yellow-50 text-yellow-700':'bg-red-50 text-red-700'}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: [string, string][] }) {
  return (
    <div className="card p-4">
      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">{title}</h3>
      <div className="space-y-2">
        {children.map(([label, value]) => (
          <div key={label} className="flex items-start gap-3">
            <span className="text-xs text-gray-400 w-32 flex-shrink-0 mt-0.5">{label}</span>
            <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 break-words">{value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
