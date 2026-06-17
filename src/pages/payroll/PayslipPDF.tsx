// ─── PDF Payslip Document — @react-pdf/renderer ───────────────────────────────
// Called via <PDFDownloadLink document={<PayslipDocument .../>} ...> in Payslip.tsx
import {
  Document, Page, View, Text, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { PayrollEntry, PayrollPeriod, Employee } from '../../types'

// ── Register fonts from the local @fontsource package (no CDN needed) ─────────
// Vite ?url imports copy the file into /assets and return a local URL — works
// offline and avoids the SSL / CORS issues with remote Google Fonts CDN.
import font400 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff?url'
import font700 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff?url'
import font800 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff?url'

Font.register({
  family: 'Jakarta',
  fonts: [
    { src: font400, fontWeight: 400 },
    { src: font700, fontWeight: 700 },
    { src: font800, fontWeight: 800 },
  ],
})

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  brand:   '#5B5FC7',
  text:    '#0F172A',
  muted:   '#64748B',
  border:  '#E2E8F0',
  success: '#16A34A',
  danger:  '#DC2626',
  surface: '#F8FAFC',
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Jakarta',
    fontSize: 9,
    color: C.text,
    padding: '28pt 32pt',
    backgroundColor: '#FFFFFF',
  },

  // ── header ──
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3pt solid ${C.brand}`, paddingBottom: 10, marginBottom: 10 },
  companyName: { fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: -0.5 },
  companyMeta: { fontSize: 8, color: C.muted, marginTop: 2 },
  badge: { backgroundColor: C.brand, color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, alignSelf: 'flex-end', marginBottom: 4 },
  periodNo: { fontSize: 11, fontWeight: 700, textAlign: 'right' },
  periodDate: { fontSize: 8, color: C.muted, textAlign: 'right', marginTop: 2 },

  // ── employee info ──
  infoBox: { backgroundColor: C.surface, borderRadius: 4, padding: '8pt 12pt', flexDirection: 'row', gap: 32, borderBottom: `1pt solid ${C.border}`, marginBottom: 10 },
  infoLabel: { color: C.muted, fontSize: 8, width: 88 },
  infoValue: { color: C.text, fontSize: 8.5, fontWeight: 700, flex: 1 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },

  // ── earnings / deductions two-col ──
  twoCol: { flexDirection: 'row', borderBottom: `1pt solid ${C.border}`, marginBottom: 10 },
  col: { flex: 1, padding: '8pt 10pt' },
  colRight: { flex: 1, padding: '8pt 10pt', borderLeft: `1pt solid ${C.border}` },
  sectionTitle: { fontSize: 7.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  amtRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  amtLabel: { color: C.muted, fontSize: 8, flex: 1, paddingRight: 4 },
  amtValue: { fontSize: 8, fontWeight: 700, color: C.text },
  amtValueDed: { fontSize: 8, fontWeight: 700, color: C.danger },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, marginTop: 2, borderTop: `1pt solid ${C.border}` },
  totalLabel: { fontSize: 8.5, fontWeight: 800, color: C.text },
  totalValue: { fontSize: 8.5, fontWeight: 800, color: C.text },
  totalValueDed: { fontSize: 8.5, fontWeight: 800, color: C.danger },

  // ── attendance ──
  attRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  attCell: { flex: 1, backgroundColor: C.surface, borderRadius: 4, border: `1pt solid ${C.border}`, padding: '5pt 4pt', alignItems: 'center' },
  attVal: { fontSize: 14, fontWeight: 800, color: C.text },
  attLbl: { fontSize: 7, color: C.muted, marginTop: 2 },

  // ── contrib table ──
  contribTable: { marginBottom: 10 },
  tHead: { flexDirection: 'row', backgroundColor: C.surface, borderBottom: `1pt solid ${C.border}`, padding: '3pt 6pt' },
  tRow:  { flexDirection: 'row', borderBottom: `0.5pt solid ${C.border}`, padding: '3pt 6pt' },
  tC1:   { flex: 1.4, fontSize: 8, fontWeight: 700 },
  tC2:   { flex: 1, fontSize: 8, textAlign: 'right', color: C.muted },
  tC3:   { flex: 1, fontSize: 8, textAlign: 'right', color: C.muted },
  tHead1:{ flex: 1.4, fontSize: 7.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase' },
  tHead2:{ flex: 1, fontSize: 7.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', textAlign: 'right' },

  // ── net pay banner ──
  netBanner: { backgroundColor: '#F0F1FB', borderRadius: 6, padding: '10pt 14pt', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  netLabel: { fontSize: 8, fontWeight: 800, color: C.brand, textTransform: 'uppercase', letterSpacing: 0.8 },
  netSub: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  netAmount: { fontSize: 22, fontWeight: 800, color: C.brand, letterSpacing: -0.5 },

  // ── signature ──
  sigRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  sigCell: { flex: 1, alignItems: 'center' },
  sigLine: { height: 0.5, width: '100%', backgroundColor: C.border, marginBottom: 3 },
  sigLabel: { fontSize: 7.5, color: C.muted },
  footer: { fontSize: 7.5, color: C.muted, textAlign: 'center', borderTop: `0.5pt solid ${C.border}`, paddingTop: 6, marginTop: 4 },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function peso(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)
}
function shortDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Document ──────────────────────────────────────────────────────────────────
export interface PayslipDocumentProps {
  entry:    PayrollEntry
  period:   PayrollPeriod
  employee: Employee
  company: {
    name:    string
    address?: string
    contact?: string
    email?:  string
    tin?:    string
  }
}

export function PayslipDocument({ entry, period, employee, company }: PayslipDocumentProps) {
  // ── Earnings ──────────────────────────────────────────────────────────────
  const dynComps  = entry.computedComponents ?? []
  const useDynamic = dynComps.length > 0

  const baseEarnings = [
    { label: 'Basic Pay',           value: entry.basicPay          },
    { label: 'Overtime Pay',        value: entry.overtimePay       },
    { label: 'Regular Holiday Pay', value: entry.regularHolidayPay },
    { label: 'Special Holiday Pay', value: entry.specialHolidayPay },
    { label: 'Night Differential',  value: entry.nightDifferential },
    ...entry.allowances.map(a => ({ label: a.type, value: a.amount })),
  ].filter(x => x.value > 0)

  const dynEarnings = useDynamic
    ? dynComps.filter(c => c.affectsGross).map(c => ({ label: c.name, value: c.employeeAmount }))
    : []

  const earnings = [...baseEarnings, ...dynEarnings]

  // ── Deductions ────────────────────────────────────────────────────────────
  const baseDeductions = [
    { label: 'Late Deductions',    value: entry.lateDeductions    },
    { label: 'Absence Deductions', value: entry.absenceDeductions },
    { label: 'Undertime',          value: entry.undertimeDeductions },
  ].filter(x => x.value > 0)

  const dynDeductions = useDynamic
    ? dynComps.filter(c => !c.affectsGross).map(c => ({ label: c.name, value: c.employeeAmount }))
    : [
        { label: 'SSS Contribution', value: entry.sssEmployee       },
        { label: 'PhilHealth',       value: entry.philhealthEmployee },
        { label: 'Pag-IBIG (HDMF)', value: entry.pagibigEmployee    },
        { label: 'Withholding Tax',  value: entry.withholdingTax     },
        ...entry.otherDeductions.map(d => ({ label: d.type, value: d.amount })),
      ].filter(x => x.value > 0)

  const deductions = [...baseDeductions, ...dynDeductions]

  // ── Gov contributions ─────────────────────────────────────────────────────
  const govContribs = useDynamic
    ? dynComps.filter(c => c.employerAmount > 0).map(c => ({ label: c.name, ee: c.employeeAmount, er: c.employerAmount }))
    : [
        { label: 'SSS',       ee: entry.sssEmployee,        er: entry.sssEmployer        },
        { label: 'PhilHealth',ee: entry.philhealthEmployee, er: entry.philhealthEmployer  },
        { label: 'Pag-IBIG', ee: entry.pagibigEmployee,     er: entry.pagibigEmployer     },
      ].filter(g => g.ee > 0 || g.er > 0)

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.companyName}>{company.name}</Text>
            {company.address && <Text style={S.companyMeta}>{company.address}</Text>}
            <Text style={S.companyMeta}>
              {[company.contact, company.email].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={S.badge}>PAYSLIP</Text>
            <Text style={S.periodNo}>{period.periodNo}</Text>
            <Text style={S.periodDate}>
              {shortDate(period.startDate)} – {shortDate(period.endDate)}
            </Text>
            <Text style={S.periodDate}>Pay Date: {shortDate(period.payDate)}</Text>
          </View>
        </View>

        {/* ── Employee Info ── */}
        <View style={S.infoBox}>
          <View style={{ flex: 1 }}>
            {[
              ['Employee Name', employee.fullName],
              ['Employee No.',  employee.employeeNo],
              ['Designation',   employee.position],
              ['Department',    employee.department ?? '—'],
            ].map(([l, v]) => (
              <View key={l} style={S.infoRow}>
                <Text style={S.infoLabel}>{l}</Text>
                <Text style={S.infoValue}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {[
              ['Employment Type', (employee.employmentType ?? 'regular').replace('-',' ')],
              ['Pay Frequency',   period.frequency],
              ['Tax Status',      employee.taxStatus ?? '—'],
              ['Bank',            `${employee.bankName ?? ''}${employee.bankAccount ? ` – ${employee.bankAccount}` : ''}`.trim() || '—'],
            ].map(([l, v]) => (
              <View key={l} style={S.infoRow}>
                <Text style={S.infoLabel}>{l}</Text>
                <Text style={S.infoValue}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Earnings / Deductions ── */}
        <View style={S.twoCol}>
          {/* Earnings */}
          <View style={S.col}>
            <Text style={S.sectionTitle}>Earnings</Text>
            {earnings.map((e, i) => (
              <View key={i} style={S.amtRow}>
                <Text style={S.amtLabel}>{e.label}</Text>
                <Text style={S.amtValue}>{peso(e.value)}</Text>
              </View>
            ))}
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Gross Pay</Text>
              <Text style={S.totalValue}>{peso(entry.grossPay)}</Text>
            </View>
          </View>

          {/* Deductions */}
          <View style={S.colRight}>
            <Text style={S.sectionTitle}>Deductions</Text>
            {deductions.map((d, i) => (
              <View key={i} style={S.amtRow}>
                <Text style={S.amtLabel}>{d.label}</Text>
                <Text style={S.amtValueDed}>−{peso(d.value)}</Text>
              </View>
            ))}
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Total Deductions</Text>
              <Text style={S.totalValueDed}>−{peso(entry.totalDeductions)}</Text>
            </View>
          </View>
        </View>

        {/* ── Attendance Summary ── */}
        <Text style={S.sectionTitle}>Attendance Summary</Text>
        <View style={S.attRow}>
          {[
            { label: 'Scheduled', value: String(entry.scheduledDays) },
            { label: 'Present',   value: String(entry.presentDays)   },
            { label: 'Absent',    value: String(entry.absentDays)    },
            { label: 'Late',      value: String(entry.lateDays)      },
            { label: 'OT Hours',  value: `${entry.overtimeHours ?? 0}h` },
            { label: 'Leave Days',value: String(entry.leaveDays)     },
          ].map(s => (
            <View key={s.label} style={S.attCell}>
              <Text style={S.attVal}>{s.value}</Text>
              <Text style={S.attLbl}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Government Contributions ── */}
        {govContribs.length > 0 && (
          <View style={S.contribTable}>
            <Text style={[S.sectionTitle, { marginBottom: 4 }]}>Government Contributions</Text>
            <View style={S.tHead}>
              <Text style={S.tHead1}>Fund</Text>
              <Text style={S.tHead2}>Employee Share</Text>
              <Text style={S.tHead2}>Employer Share</Text>
            </View>
            {govContribs.map((g, i) => (
              <View key={i} style={S.tRow}>
                <Text style={S.tC1}>{g.label}</Text>
                <Text style={S.tC2}>{peso(g.ee)}</Text>
                <Text style={S.tC3}>{g.er > 0 ? peso(g.er) : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Net Pay banner ── */}
        <View style={S.netBanner}>
          <View>
            <Text style={S.netLabel}>Net Pay</Text>
            <Text style={S.netSub}>
              {peso(entry.grossPay)} gross − {peso(entry.totalDeductions)} deductions
            </Text>
          </View>
          <Text style={S.netAmount}>{peso(entry.netPay)}</Text>
        </View>

        {/* ── Signature lines ── */}
        <View style={S.sigRow}>
          {['Prepared by', 'Verified by', 'Received by'].map(l => (
            <View key={l} style={S.sigCell}>
              <View style={{ height: 42 }} />
              <View style={S.sigLine} />
              <Text style={S.sigLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <Text style={S.footer}>
          Computer-generated payslip · TenPayroll · Generated {new Date().toLocaleDateString('en-PH')}
          {company.tin ? ` · TIN: ${company.tin}` : ''}
        </Text>

      </Page>
    </Document>
  )
}
