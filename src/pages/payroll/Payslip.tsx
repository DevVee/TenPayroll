import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, CheckCircle, Lock, FileDown } from 'lucide-react'
import { useData } from '../../hooks/useData'
import { apiGetPayrollEntry, apiGetPayrollPeriod, apiGetEmployee, getCompanySettings, apiMarkEntryPaid } from '../../lib/db'
import { useAuthStore } from '../../store/authStore'
import { usePermission } from '../../lib/permissions'
import { formatPeso } from '../../lib/payrollEngine'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { PayslipDocument } from './PayslipPDF'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Payslip() {
  const { periodId, employeeId } = useParams<{ periodId: string; employeeId: string }>()
  const navigate  = useNavigate()
  const company   = getCompanySettings()
  const { user }  = useAuthStore()
  const canApprove = usePermission('pay_approve')
  const [marking, setMarking] = useState(false)

  // Access-control: employees may only view their OWN payslip
  const isEmployee = user?.role === 'employee'
  const isOwnPayslip = user?.employeeId === employeeId
  if (isEmployee && !isOwnPayslip) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color: 'var(--color-text-muted)' }}>
        <Lock style={{ width: 36, height: 36, opacity: 0.3 }} />
        <p style={{ fontWeight: 600, fontSize: 15 }}>Access Denied</p>
        <p style={{ fontSize: 13 }}>You can only view your own payslips.</p>
        <button className="btn btn-secondary btn-sm mt-2" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    )
  }

  const { data: entry, refetch: refetchEntry } = useData(() => apiGetPayrollEntry(periodId!, employeeId!), [periodId, employeeId])
  const { data: period }   = useData(() => apiGetPayrollPeriod(periodId!), [periodId])
  const { data: employee } = useData(() => apiGetEmployee(employeeId!), [employeeId])

  const handleMarkPaid = async () => {
    if (!periodId || !employeeId || marking || !canApprove) return
    setMarking(true)
    try {
      await apiMarkEntryPaid(periodId, employeeId, user?.name)
      refetchEntry()
    } finally {
      setMarking(false)
    }
  }

  if (!entry || !period || !employee) return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  const pdfFilename = `Payslip_${period.periodNo}_${employee.employeeNo}.pdf`

  // ── Dynamic vs Legacy display logic ──────────────────────────────────────
  const dynComps = entry.computedComponents ?? []
  const useDynamic = dynComps.length > 0

  // ── Earnings (always include base attendance items) ────────────────────
  const baseEarnings: { label: string; value: number }[] = [
    { label: 'Basic Pay',           value: entry.basicPay            },
    { label: 'Overtime Pay',        value: entry.overtimePay         },
    { label: 'Regular Holiday Pay', value: entry.regularHolidayPay   },
    { label: 'Special Holiday Pay', value: entry.specialHolidayPay   },
    { label: 'Night Differential',  value: entry.nightDifferential   },
    ...entry.allowances.map(a => ({ label: a.type, value: a.amount })),
  ].filter(e => e.value > 0)

  // Dynamic component earnings (adds to gross)
  const dynEarnings: { label: string; value: number }[] = useDynamic
    ? dynComps.filter(c => c.affectsGross).map(c => ({ label: c.name, value: c.employeeAmount }))
    : []

  const earnings = [...baseEarnings, ...dynEarnings]

  // ── Deductions ─────────────────────────────────────────────────────────
  const baseDeductions: { label: string; value: number }[] = [
    { label: 'Late Deductions',    value: entry.lateDeductions    },
    { label: 'Absence Deductions', value: entry.absenceDeductions },
    { label: 'Undertime',          value: entry.undertimeDeductions },
  ].filter(d => d.value > 0)

  const dynDeductions: { label: string; value: number }[] = useDynamic
    ? dynComps.filter(c => !c.affectsGross).map(c => ({ label: c.name, value: c.employeeAmount }))
    : [
        { label: 'SSS Contribution', value: entry.sssEmployee        },
        { label: 'PhilHealth',       value: entry.philhealthEmployee  },
        { label: 'Pag-IBIG (HDMF)', value: entry.pagibigEmployee     },
        { label: 'Withholding Tax',  value: entry.withholdingTax      },
        ...entry.otherDeductions.map(d => ({ label: d.type, value: d.amount })),
      ].filter(d => d.value > 0)

  const deductions = [...baseDeductions, ...dynDeductions]

  // ── Employer contributions (shown in summary table) ───────────────────
  const govContribs: { label: string; ee: number; er: number }[] = useDynamic
    ? dynComps
        .filter(c => c.employerAmount > 0)
        .map(c => ({ label: c.name, ee: c.employeeAmount, er: c.employerAmount }))
    : [
        { label: 'SSS',       ee: entry.sssEmployee,        er: entry.sssEmployer        },
        { label: 'PhilHealth',ee: entry.philhealthEmployee, er: entry.philhealthEmployer  },
        { label: 'Pag-IBIG', ee: entry.pagibigEmployee,     er: entry.pagibigEmployer     },
      ].filter(g => g.ee > 0 || g.er > 0)

  return (
    <div>
      {/* Screen-only actions */}
      <div className="no-print flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate(`/payroll/${periodId}`)}
          className="btn btn-secondary"
        >
          <ArrowLeft style={{ width: 13, height: 13 }} />
          Back to Payroll
        </button>
        <button
          onClick={() => window.print()}
          className="btn btn-secondary"
        >
          <Printer style={{ width: 13, height: 13 }} />
          Print
        </button>

        {/* PDF download via @react-pdf/renderer */}
        <PDFDownloadLink
          document={
            <PayslipDocument
              entry={entry}
              period={period}
              employee={employee}
              company={{
                name:    company.name,
                address: company.address,
                contact: company.contact,
                email:   company.email,
                tin:     company.tin,
              }}
            />
          }
          fileName={pdfFilename}
          style={{ textDecoration: 'none' }}
        >
          {({ loading, error }) => (
            <button
              className={`btn ${error ? 'btn-danger' : 'btn-primary'}`}
              disabled={loading}
              type="button"
              title={error ? String(error) : undefined}
            >
              <FileDown style={{ width: 13, height: 13 }} />
              {loading ? 'Generating…' : error ? 'PDF Error' : 'Download PDF'}
            </button>
          )}
        </PDFDownloadLink>

        {/* Mark as Paid toggle */}
        {entry?.markedPaid ? (
          <button
            onClick={handleMarkPaid}
            disabled={marking}
            className="btn"
            style={{
              background: 'var(--color-success-bg)', border: '1px solid #6EE7B7',
              color: 'var(--color-success)', gap: 6,
            }}
            title="Click to unmark as paid"
          >
            <CheckCircle style={{ width: 13, height: 13, color: 'var(--color-success)' }} />
            Paid
            {entry.markedPaidAt && (
              <span style={{ fontSize: 10, opacity: 0.65, fontWeight: 500 }}>
                · {new Date(entry.markedPaidAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            <span style={{ fontSize: 10, opacity: 0.45, fontWeight: 400, marginLeft: 2 }}>(undo)</span>
          </button>
        ) : (
          <button
            onClick={handleMarkPaid}
            disabled={marking}
            className="btn btn-success"
          >
            <CheckCircle style={{ width: 13, height: 13 }} />
            {marking ? 'Saving…' : 'Mark as Paid'}
          </button>
        )}
      </div>

      {/* ── Payslip document ── */}
      <div
        className="bg-white max-w-[700px] mx-auto payslip-print"
        style={{
          border: '1px solid var(--color-border)',
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        {/* ── Document Header ── */}
        <div
          style={{
            borderBottom: '4px solid var(--color-primary)',
            padding: '20px 24px 16px',
          }}
        >
          <div className="flex items-start justify-between">
            {/* Company */}
            <div className="flex items-start gap-3">
              <img
                src="/Logo.png"
                alt={company.name}
                style={{ height: 40, objectFit: 'contain', flexShrink: 0 }}
              />
              <div>
                <h1
                  className="font-extrabold text-gray-900 leading-tight"
                  style={{ fontSize: 16, letterSpacing: '-0.02em' }}
                >
                  {company.name}
                </h1>
                {company.address && (
                  <p className="text-gray-500 mt-0.5" style={{ fontSize: 11 }}>
                    {company.address}
                  </p>
                )}
                <p className="text-gray-500" style={{ fontSize: 11 }}>
                  {[company.contact, company.email].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            {/* Payslip label */}
            <div className="text-right">
              <div
                className="inline-block px-3 py-1 font-black text-white mb-1.5"
                style={{
                  background: 'var(--color-primary)',
                  borderRadius: 3,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                }}
              >
                PAYSLIP
              </div>
              <p className="font-bold text-gray-700" style={{ fontSize: 13 }}>{period.periodNo}</p>
              <p className="text-gray-500" style={{ fontSize: 11 }}>
                {fmtDateShort(period.startDate)} – {fmtDateShort(period.endDate)}
              </p>
              <p className="text-gray-500" style={{ fontSize: 11 }}>
                Pay Date: <strong className="text-gray-700">{fmtDate(period.payDate)}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── Employee Info ── */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <InfoRow label="Employee Name" value={employee.fullName} bold />
              <InfoRow label="Employee No."  value={employee.employeeNo} />
              <InfoRow label="Designation"   value={employee.position} />
              <InfoRow label="Department"    value={employee.department ?? '—'} />
            </div>
            <div>
              <InfoRow label="Employment Type" value={(employee.employmentType ?? 'regular').replace('-', ' ')} />
              <InfoRow label="Pay Frequency"   value={period.frequency.replace('-', '-')} />
              <InfoRow label="Tax Status"      value={employee.taxStatus ?? '—'} />
              <InfoRow label="Bank"
                value={`${employee.bankName ?? ''}${employee.bankAccount ? ` – ${employee.bankAccount}` : ''}`.trim() || '—'} />
            </div>
          </div>
        </div>

        {/* ── Earnings & Deductions ── */}
        <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {/* Earnings column */}
          <div
            style={{
              padding: '14px 20px',
              borderRight: '1px solid var(--color-border)',
            }}
          >
            <SectionTitle>Earnings</SectionTitle>
            <div className="space-y-1.5 mb-3">
              {earnings.map((e, i) => (
                <AmountRow key={`${e.label}-${i}`} label={e.label} value={e.value} />
              ))}
            </div>
            <TotalRow label="Gross Pay" value={entry.grossPay} />
          </div>

          {/* Deductions column */}
          <div style={{ padding: '14px 20px' }}>
            <SectionTitle>Deductions</SectionTitle>
            <div className="space-y-1.5 mb-3">
              {deductions.map((d, i) => (
                <AmountRow key={`${d.label}-${i}`} label={d.label} value={d.value} deduction />
              ))}
            </div>
            <TotalRow label="Total Deductions" value={entry.totalDeductions} deduction />
          </div>
        </div>

        {/* ── Attendance Summary ── */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          <SectionTitle>Attendance Summary</SectionTitle>
          <div className="grid grid-cols-6 gap-2 text-center mt-2">
            {[
              { label: 'Scheduled', value: entry.scheduledDays },
              { label: 'Present',   value: entry.presentDays   },
              { label: 'Absent',    value: entry.absentDays    },
              { label: 'Leave',     value: entry.leaveDays     },
              { label: 'Late',      value: entry.lateDays      },
              { label: 'OT Hours',  value: `${entry.overtimeHours ?? 0}h` },
            ].map(s => (
              <div
                key={s.label}
                style={{
                  padding: '8px 4px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 3,
                }}
              >
                <p
                  className="font-black tabular-nums text-gray-900 leading-none"
                  style={{ fontSize: 17 }}
                >
                  {s.value}
                </p>
                <p className="text-gray-500 mt-1" style={{ fontSize: 9.5 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contributions with employer share ── */}
        {govContribs.length > 0 && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <SectionTitle>{useDynamic ? 'Contributions & Employer Share' : 'Government Contributions'}</SectionTitle>
          <table className="table-base w-full" style={{ fontSize: 11, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Component</th>
                <th style={{ textAlign: 'right' }}>Employee Share</th>
                <th style={{ textAlign: 'right' }}>Employer Share</th>
              </tr>
            </thead>
            <tbody>
              {govContribs.map((g, i) => (
                <tr key={`${g.label}-${i}`}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>{g.label}</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatPeso(g.ee)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {g.er > 0 ? formatPeso(g.er) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* ── Net Pay banner ── */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--color-primary-light)',
            borderBottom: '1px solid var(--color-primary-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p
              className="font-black uppercase tracking-wider text-brand"
              style={{ fontSize: 10, letterSpacing: '0.1em' }}
            >
              Net Pay
            </p>
            <p className="text-gray-500 mt-0.5" style={{ fontSize: 11 }}>
              {formatPeso(entry.grossPay)} gross − {formatPeso(entry.totalDeductions)} deductions
            </p>
          </div>
          <p
            className="font-black tabular-nums text-brand"
            style={{ fontSize: 28, letterSpacing: '-0.03em' }}
          >
            {formatPeso(entry.netPay)}
          </p>
        </div>

        {/* ── Signature lines ── */}
        <div style={{ padding: '16px 24px 20px' }}>
          <div className="grid grid-cols-3 gap-6 text-center">
            {['Prepared by', 'Verified by', 'Received by'].map(label => (
              <div key={label}>
                <div style={{ height: 48, borderBottom: '1px solid var(--color-border-strong)', marginBottom: 4 }} />
                <p className="text-gray-500" style={{ fontSize: 10 }}>{label}</p>
              </div>
            ))}
          </div>

          <p
            className="text-gray-400 text-center mt-4"
            style={{ fontSize: 9, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}
          >
            This is a computer-generated payslip and does not require a signature unless signed above.{' '}
            Generated by TenPayroll · {new Date().toLocaleDateString('en-PH')}
            {company.tin && ` · TIN: ${company.tin}`}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2 mb-1" style={{ fontSize: 11 }}>
      <span className="text-gray-500 flex-shrink-0" style={{ width: 110 }}>{label}:</span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-black uppercase tracking-wider text-gray-400"
      style={{ fontSize: 9.5, letterSpacing: '0.09em', marginBottom: 10 }}
    >
      {children}
    </p>
  )
}

function AmountRow({ label, value, deduction }: { label: string; value: number; deduction?: boolean }) {
  return (
    <div className="flex justify-between" style={{ fontSize: 11 }}>
      <span className="text-gray-600">{label}</span>
      <span
        className="tabular-nums font-medium"
        style={{ color: deduction ? 'var(--color-danger)' : 'var(--color-text)' }}
      >
        {deduction ? '−' : ''}{formatPeso(value)}
      </span>
    </div>
  )
}

function TotalRow({ label, value, deduction }: { label: string; value: number; deduction?: boolean }) {
  return (
    <div
      className="flex justify-between font-black"
      style={{
        fontSize: 12,
        borderTop: '1px solid var(--color-border)',
        paddingTop: 6,
        marginTop: 4,
        color: deduction ? 'var(--color-danger)' : 'var(--color-text)',
      }}
    >
      <span>{label}</span>
      <span className="tabular-nums">
        {deduction ? '−' : ''}{formatPeso(value)}
      </span>
    </div>
  )
}
