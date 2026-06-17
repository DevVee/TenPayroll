// ─── Export Service ───────────────────────────────────────────────────────────
// Handles Excel (xlsx via ExcelJS with full styling), CSV, and payslip PDF exports.
// ExcelJS (MIT) is used instead of SheetJS because it supports cell fill, font,
// borders, frozen rows, and auto-filter — needed for a professional template.
import ExcelJS from 'exceljs'
import type { PayrollPeriod, PayrollEntry, AttendanceRecord, Employee, SalaryAdvance } from '../types'

// ── Design tokens (must match brand colours in index.css / PayslipPDF) ────────
const BRAND  = '5B5FC7'  // indigo primary
const SLATE  = '334155'  // summary sheet tab
const GREEN  = '16A34A'  // government sheets tab
const DANGER = 'DC2626'  // deductions accent

const HEADER_TEXT  = 'FFFFFF'
const CELL_TEXT    = '0F172A'
const MUTED_TEXT   = '64748B'
const ROW_ALT_FILL = 'F8FAFC'
const BORDER_COLOR = 'CBD5E1'
const BORDER_LIGHT = 'E2E8F0'

// ── Helpers ───────────────────────────────────────────────────────────────────
function peso(n: number) {
  return Number(n.toFixed(2))
}

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvToBlob(csv: string): Blob {
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function buildCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(',')),
  ].join('\n')
}

// ── Thin border helper ─────────────────────────────────────────────────────────
function thinBorder(color = BORDER_LIGHT): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${color}` } }
  return { top: s, left: s, bottom: s, right: s }
}

// ── Style the header row ───────────────────────────────────────────────────────
// Call after all header values are set. `row` is the ExcelJS Row object.
function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 22
  row.eachCell({ includeEmpty: true }, (_cell, colNo) => {
    if (colNo > colCount) return
    const cell = row.getCell(colNo)
    cell.font  = { bold: true, color: { argb: `FF${HEADER_TEXT}` }, size: 10, name: 'Calibri' }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } }
    cell.border = thinBorder(BORDER_COLOR)
    cell.alignment = { vertical: 'middle', horizontal: colNo === 1 ? 'left' : 'right', wrapText: false }
  })
  // Left-align text-only first column and keep header labels left-aligned regardless
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
}

// ── Style a data row ──────────────────────────────────────────────────────────
function styleDataRow(
  row: ExcelJS.Row,
  colCount: number,
  rowIndex: number,          // 1-based data row index (0 = header)
  pesoColumns: number[] = [] // 1-based column numbers that hold peso values
) {
  const isEven = rowIndex % 2 === 0
  row.height = 16
  row.eachCell({ includeEmpty: true }, (_cell, colNo) => {
    if (colNo > colCount) return
    const cell  = row.getCell(colNo)
    const isPeso = pesoColumns.includes(colNo)

    cell.font    = { size: 9, name: 'Calibri', color: { argb: `FF${CELL_TEXT}` } }
    cell.border  = thinBorder(BORDER_LIGHT)
    cell.fill    = isEven
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ROW_ALT_FILL}` } }
      : { type: 'pattern', pattern: 'none' }
    cell.alignment = {
      vertical: 'middle',
      horizontal: isPeso ? 'right' : colNo === 1 ? 'left' : 'right',
    }
    if (isPeso) {
      cell.numFmt = '₱#,##0.00'
    }
  })
}

// ── Create a new styled workbook ───────────────────────────────────────────────
function newWorkbook(creator = 'TenPayroll'): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator  = creator
  wb.created  = new Date()
  wb.modified = new Date()
  return wb
}

// ── Add a styled data sheet ────────────────────────────────────────────────────
// Returns the worksheet after writing headers + data rows with full styling.
function addDataSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  tabColor: string,
  headers: string[],
  rows: (string | number | boolean)[][][],   // array of row-value arrays
  colWidths: number[],
  pesoColumns: number[] = []
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: `FF${tabColor}` } },
  })

  // Column definitions
  ws.columns = headers.map((h, i) => ({
    header: h,
    key:    h,
    width:  colWidths[i] ?? 14,
  }))

  // Style header
  styleHeaderRow(ws.getRow(1), headers.length)

  // Auto-filter on header row
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: headers.length },
  }

  // Data rows
  rows.forEach((rowValues, idx) => {
    const row = ws.addRow(rowValues.flat())
    styleDataRow(row, headers.length, idx + 1, pesoColumns)
  })

  return ws
}

// ── Add a summary/info sheet ──────────────────────────────────────────────────
// Rows are [label, value] pairs. A banner title spans cols A:B in row 1.
function addSummarySheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  tabColor: string,
  title: string,
  pairs: [string, string | number][]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName, {
    properties: { tabColor: { argb: `FF${tabColor}` } },
  })
  ws.columns = [{ width: 22 }, { width: 26 }]

  // Banner title row
  ws.mergeCells('A1:B1')
  const titleCell = ws.getCell('A1')
  titleCell.value = title
  titleCell.font  = { bold: true, size: 11, name: 'Calibri', color: { argb: `FF${HEADER_TEXT}` } }
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${tabColor}` } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(1).height = 24

  // Blank separator
  ws.addRow([])

  // Data pairs
  pairs.forEach(([label, value]) => {
    const row = ws.addRow([label, value])
    const labelCell = row.getCell(1)
    const valCell   = row.getCell(2)
    labelCell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: `FF${MUTED_TEXT}` } }
    valCell.font   = { size: 9, name: 'Calibri', color: { argb: `FF${CELL_TEXT}` } }
    if (typeof value === 'number') valCell.numFmt = '₱#,##0.00'
    row.height = 16
  })

  return ws
}

// ── Workbook → Blob ───────────────────────────────────────────────────────────
async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Payroll Run Export ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPayrollRun(
  period: PayrollPeriod,
  entries: PayrollEntry[],
  format: 'excel' | 'csv' = 'excel'
) {
  const rows = entries.map(e => ({
    'Employee No':             e.employeeNo,
    'Employee Name':           e.employeeName,
    'Department':              e.department,
    'Position':                e.position,
    'Employment Type':         e.employmentType,
    'Scheduled Days':          e.scheduledDays,
    'Present Days':            e.presentDays,
    'Absent Days':             e.absentDays,
    'Late Days':               e.lateDays,
    'Half Days':               e.halfDays,
    'Leave Days':              e.leaveDays,
    'OT Hours':                e.overtimeHours,
    'Night Diff Hours':        e.nightDiffHours,
    'Reg. Holiday Days':       e.regularHolidayDays,
    'Sp. Holiday Days':        e.specialHolidayDays,
    'Basic Pay':               peso(e.basicPay),
    'OT Pay':                  peso(e.overtimePay),
    'Reg. Holiday Pay':        peso(e.regularHolidayPay),
    'Sp. Holiday Pay':         peso(e.specialHolidayPay),
    'Night Differential':      peso(e.nightDifferential),
    'Allowances':              peso(e.allowances.reduce((s, a) => s + a.amount, 0)),
    'Gross Pay':               peso(e.grossPay),
    'Late Deductions':         peso(e.lateDeductions),
    'Absence Deductions':      peso(e.absenceDeductions),
    'Undertime Deductions':    peso(e.undertimeDeductions),
    'SSS (Employee)':          peso(e.sssEmployee),
    'PhilHealth (Emp.)':       peso(e.philhealthEmployee),
    'Pag-IBIG (Emp.)':         peso(e.pagibigEmployee),
    'Withholding Tax':         peso(e.withholdingTax),
    'Other Deductions':        peso(e.otherDeductions.reduce((s, d) => s + d.amount, 0)),
    'Total Deductions':        peso(e.totalDeductions),
    'Net Pay':                 peso(e.netPay),
    'SSS (Employer)':          peso(e.sssEmployer),
    'PhilHealth (Employer)':   peso(e.philhealthEmployer),
    'Pag-IBIG (Employer)':     peso(e.pagibigEmployer),
    'Paid':                    e.markedPaid ? 'Yes' : 'No',
  }))

  const filename = `Payroll_${period.periodNo}_${period.startDate}_${period.endDate}`

  if (format === 'csv') {
    saveFile(csvToBlob(buildCsv(rows)), `${filename}.csv`)
    return
  }

  const headers = Object.keys(rows[0] ?? {})
  // Peso columns: Basic Pay is col 16 (index 15), through to Pag-IBIG (Employer) col 35 (index 34)
  // Columns 1-5 = text/numbers, 6-15 = numeric days/hours, 16-35 = peso
  const pesoColumns = Array.from({ length: 20 }, (_, i) => i + 16)

  const colWidths = [
    12, 26, 18, 22, 14,   // Employee info
    11, 11, 11, 9, 9, 9, 9, 11, 11, 11, // Attendance
    13, 13, 15, 15, 16, 13, 13, // Earnings
    14, 16, 17, 13, 14, 11, 14, 14, 15, 13, // Deductions
    15, 16, 15, 7, // Employer + Paid
  ]

  const wb = newWorkbook()
  const ws = wb.addWorksheet('Payroll', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: `FF${BRAND}` } },
  })
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 14 }))
  styleHeaderRow(ws.getRow(1), headers.length)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  rows.forEach((row, idx) => {
    const values = Object.values(row)
    const wsRow = ws.addRow(values)
    styleDataRow(wsRow, headers.length, idx + 1, pesoColumns)
    // Colour net pay column (col 32) in primary
    const netCell = wsRow.getCell(32)
    netCell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: `FF${BRAND}` } }
    // Colour deductions red (cols 23-31)
    for (let c = 23; c <= 31; c++) {
      wsRow.getCell(c).font = { size: 9, name: 'Calibri', color: { argb: `FF${DANGER}` } }
    }
  })

  addSummarySheet(wb, 'Summary', SLATE, `Payroll — ${period.periodNo}`, [
    ['Period No',         period.periodNo],
    ['Start Date',        period.startDate],
    ['End Date',          period.endDate],
    ['Pay Date',          period.payDate],
    ['Frequency',         period.frequency],
    ['Status',            period.status],
    ['Total Employees',   period.totalEmployees],
    ['Total Gross',       peso(period.totalGross)],
    ['Total Deductions',  peso(period.totalDeductions)],
    ['Total Net Pay',     peso(period.totalNet)],
    ['Approved By',       period.approvedBy ?? ''],
    ['Approved At',       period.approvedAt ?? ''],
  ])

  saveFile(await workbookToBlob(wb), `${filename}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Government Contributions Export ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function exportGovtContributions(
  period: PayrollPeriod,
  entries: PayrollEntry[],
  format: 'excel' | 'csv' = 'excel'
) {
  const sssRows = entries.map(e => ({
    'Employee No':    e.employeeNo,
    'Employee Name':  e.employeeName,
    'Department':     e.department,
    'Monthly Salary': peso(e.basicPay),
    'SSS Employee':   peso(e.sssEmployee),
    'SSS Employer':   peso(e.sssEmployer),
    'SSS Total':      peso(e.sssEmployee + e.sssEmployer),
  }))

  const phRows = entries.map(e => ({
    'Employee No':       e.employeeNo,
    'Employee Name':     e.employeeName,
    'Department':        e.department,
    'Monthly Salary':    peso(e.basicPay),
    'PhilHealth Emp.':   peso(e.philhealthEmployee),
    'PhilHealth Empl.':  peso(e.philhealthEmployer),
    'PhilHealth Total':  peso(e.philhealthEmployee + e.philhealthEmployer),
  }))

  const piRows = entries.map(e => ({
    'Employee No':    e.employeeNo,
    'Employee Name':  e.employeeName,
    'Department':     e.department,
    'Monthly Salary': peso(e.basicPay),
    'Pag-IBIG Emp.':  peso(e.pagibigEmployee),
    'Pag-IBIG Empl.': peso(e.pagibigEmployer),
    'Pag-IBIG Total': peso(e.pagibigEmployee + e.pagibigEmployer),
  }))

  const taxRows = entries.map(e => ({
    'Employee No':     e.employeeNo,
    'Employee Name':   e.employeeName,
    'Department':      e.department,
    'Gross Pay':       peso(e.grossPay),
    // Taxable income = gross pay minus mandatory pre-tax deductions (TRAIN Law).
    // SSS, PhilHealth, and Pag-IBIG employee shares are non-taxable.
    'Taxable Income':  peso(e.grossPay - e.sssEmployee - e.philhealthEmployee - e.pagibigEmployee - e.lateDeductions - e.absenceDeductions),
    'Withholding Tax': peso(e.withholdingTax),
  }))

  const filename = `GovtContributions_${period.periodNo}_${period.startDate}`

  if (format === 'csv') {
    saveFile(csvToBlob(buildCsv(sssRows)), `${filename}_SSS.csv`)
    return
  }

  // Shared column config: [No, Name, Dept, Salary, Emp, Empl, Total]
  const govCols = [10, 26, 18, 14, 14, 14, 14]
  const pesoGov = [4, 5, 6, 7]

  const wb = newWorkbook()

  ;[
    { name: 'SSS',             rows: sssRows },
    { name: 'PhilHealth',      rows: phRows  },
    { name: 'Pag-IBIG',        rows: piRows  },
    { name: 'Withholding Tax', rows: taxRows },
  ].forEach(({ name, rows }) => {
    const headers = Object.keys(rows[0] ?? {})
    const ws = wb.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: `FF${GREEN}` } },
    })
    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: govCols[i] ?? 14 }))
    styleHeaderRow(ws.getRow(1), headers.length)
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
    rows.forEach((row, idx) => {
      const wsRow = ws.addRow(Object.values(row))
      styleDataRow(wsRow, headers.length, idx + 1, pesoGov)
    })
  })

  // Summary totals sheet
  const totalSSS  = entries.reduce((s, e) => s + e.sssEmployee + e.sssEmployer, 0)
  const totalPH   = entries.reduce((s, e) => s + e.philhealthEmployee + e.philhealthEmployer, 0)
  const totalPI   = entries.reduce((s, e) => s + e.pagibigEmployee + e.pagibigEmployer, 0)
  const totalTax  = entries.reduce((s, e) => s + e.withholdingTax, 0)

  addSummarySheet(wb, 'Totals', SLATE, `Contributions — ${period.periodNo}`, [
    ['Period No',          period.periodNo],
    ['Pay Date',           period.payDate],
    ['Employees',          entries.length],
    ['SSS Total',          peso(totalSSS)],
    ['PhilHealth Total',   peso(totalPH)],
    ['Pag-IBIG Total',     peso(totalPI)],
    ['Withholding Tax',    peso(totalTax)],
    ['Grand Total',        peso(totalSSS + totalPH + totalPI + totalTax)],
  ])

  saveFile(await workbookToBlob(wb), `${filename}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Attendance Report Export ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAttendanceReport(
  records: AttendanceRecord[],
  startDate: string,
  endDate: string,
  format: 'excel' | 'csv' = 'excel'
) {
  const rows = records.map(r => ({
    'Date':            r.date,
    'Employee No':     r.employeeNo,
    'Employee Name':   r.employeeName,
    'Department':      r.department ?? '',
    'Status':          r.status,
    'Time In':         r.timeIn  ? new Date(r.timeIn).toLocaleTimeString('en-PH',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    'Time Out':        r.timeOut ? new Date(r.timeOut).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    'Minutes Late':    r.minutesLate,
    'OT Minutes':      r.overtimeMinutes,
    'Night Diff Mins': r.nightDiffMinutes,
    'Undertime Mins':  r.undertimeMinutes,
    'Source':          r.source,
    'Notes':           r.note ?? r.correctionReason ?? '',
  }))

  const filename = `AttendanceReport_${startDate}_to_${endDate}`

  if (format === 'csv') {
    saveFile(csvToBlob(buildCsv(rows)), `${filename}.csv`)
    return
  }

  const headers = Object.keys(rows[0] ?? {})
  const colWidths = [12, 12, 26, 18, 12, 10, 10, 12, 10, 14, 14, 10, 32]

  const wb = newWorkbook()
  const ws = wb.addWorksheet('Attendance', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: `FF${BRAND}` } },
  })
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 14 }))
  styleHeaderRow(ws.getRow(1), headers.length)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  rows.forEach((row, idx) => {
    const wsRow = ws.addRow(Object.values(row))
    styleDataRow(wsRow, headers.length, idx + 1, []) // no peso columns
    // Right-align minute columns (8-11)
    for (let c = 8; c <= 11; c++) {
      wsRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'right' }
    }
  })

  saveFile(await workbookToBlob(wb), `${filename}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Employee Masterlist Export ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function exportEmployeeMasterlist(
  employees: Employee[],
  format: 'excel' | 'csv' = 'excel'
) {
  const rows = employees.map(e => ({
    'Employee No':       e.employeeNo,
    'Full Name':         e.fullName,
    'First Name':        e.firstName,
    'Last Name':         e.lastName,
    'Middle Name':       e.middleName ?? '',
    'Position':          e.position,
    'Department':        e.department ?? '',
    'Employment Type':   e.employmentType ?? '',
    'Status':            e.status,
    'Hire Date':         e.hireDate ?? '',
    'Email':             e.email ?? '',
    'Phone':             e.phone ?? '',
    'Gender':            e.gender ?? '',
    'Civil Status':      e.civilStatus ?? '',
    'Tax Status':        e.taxStatus ?? '',
    'Compensation Type': e.compensationType ?? '',
    'Basic Salary':      peso(e.basicSalary),
    'Daily Rate':        e.dailyRate ? peso(e.dailyRate) : '',
    'Pay Frequency':     e.payFrequency ?? '',
    'SSS No':            e.sssNo ?? '',
    'PhilHealth No':     e.philhealthNo ?? '',
    'Pag-IBIG No':       e.pagibigNo ?? '',
    'TIN':               e.tinNo ?? '',
    'Bank Name':         e.bankName ?? '',
    'Bank Account':      e.bankAccount ?? '',
    'Emergency Contact': e.emergencyContactName ?? '',
    'Emergency Phone':   e.emergencyContactPhone ?? '',
  }))

  const filename = `EmployeeMasterlist_${new Date().toISOString().split('T')[0]}`

  if (format === 'csv') {
    saveFile(csvToBlob(buildCsv(rows)), `${filename}.csv`)
    return
  }

  const headers = Object.keys(rows[0] ?? {})
  const colWidths = [
    12, 26, 16, 16, 14,  // ID / name
    20, 18, 14, 10, 12,  // position / employment
    24, 14, 10, 12, 10,  // contact / personal
    14, 14, 12, 12,      // compensation
    16, 16, 14, 14,      // gov IDs
    16, 18, 22, 16,      // bank / emergency
  ]
  // Peso columns: Basic Salary = col 17, Daily Rate = col 18
  const pesoColumns = [17, 18]

  const wb = newWorkbook()
  const ws = wb.addWorksheet('Employees', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: `FF${BRAND}` } },
  })
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 16 }))
  styleHeaderRow(ws.getRow(1), headers.length)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  rows.forEach((row, idx) => {
    const wsRow = ws.addRow(Object.values(row))
    styleDataRow(wsRow, headers.length, idx + 1, pesoColumns)
  })

  saveFile(await workbookToBlob(wb), `${filename}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Bank Disbursement Export ──────────────────────────────────────────────────
// Generates a file for bulk upload to Philippine bank portals.
// ─────────────────────────────────────────────────────────────────────────────
export async function exportBankDisbursement(
  period: PayrollPeriod,
  entries: PayrollEntry[],
  employees: Employee[],
  format: 'excel' | 'csv' = 'csv'
) {
  const empMap = new Map(employees.map(e => [e.id, e]))
  const rows = entries
    .filter(e => e.netPay > 0)
    .map(e => {
      const emp = empMap.get(e.employeeId)
      return {
        'Employee No':   e.employeeNo,
        'Employee Name': e.employeeName,
        'Department':    e.department,
        'Bank Name':     emp?.bankName ?? '',
        'Account No':    emp?.bankAccount ?? '',
        'Net Pay':       peso(e.netPay),
        'Paid':          e.markedPaid ? 'Yes' : 'No',
      }
    })

  const filename = `BankDisbursement_${period.periodNo}_${period.payDate}`

  if (format === 'csv') {
    saveFile(csvToBlob(buildCsv(rows)), `${filename}.csv`)
    return
  }

  const headers = Object.keys(rows[0] ?? {})
  const colWidths = [12, 28, 18, 20, 20, 14, 7]

  const wb = newWorkbook()
  const ws = wb.addWorksheet('Disbursement', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: `FF${BRAND}` } },
  })
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 14 }))
  styleHeaderRow(ws.getRow(1), headers.length)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  rows.forEach((row, idx) => {
    const wsRow = ws.addRow(Object.values(row))
    styleDataRow(wsRow, headers.length, idx + 1, [6]) // col 6 = Net Pay
  })

  const totalNet = rows.reduce((s, r) => s + (r['Net Pay'] as number), 0)
  addSummarySheet(wb, 'Summary', SLATE, `Disbursement — ${period.periodNo}`, [
    ['Period No',  period.periodNo],
    ['Pay Date',   period.payDate],
    ['Frequency',  period.frequency],
    ['Employees',  rows.length],
    ['Total Net',  peso(totalNet)],
  ])

  saveFile(await workbookToBlob(wb), `${filename}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Salary Advance Report ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export async function exportAdvanceReport(
  advances: SalaryAdvance[],
  format: 'excel' | 'csv' = 'excel'
) {
  const rows = advances.map(a => ({
    'Employee No':        a.employeeNo ?? '',
    'Employee Name':      a.employeeName ?? '',
    'Department':         a.department ?? '',
    'Amount':             peso(a.amount),
    'Status':             a.status,
    'Purpose':            a.purpose ?? '',
    'Requested Date':     new Date(a.requestedAt).toLocaleDateString('en-PH'),
    'Approved By':        a.approvedBy ?? '',
    'Approved Date':      a.approvedAt ? new Date(a.approvedAt).toLocaleDateString('en-PH') : '',
    'Released Date':      a.releasedAt ? new Date(a.releasedAt).toLocaleDateString('en-PH') : '',
    'Monthly Deduction':  a.monthlyDeduction ? peso(a.monthlyDeduction) : '',
    'Total Repaid':       peso(a.totalRepaid),
    'Outstanding':        peso(a.outstanding),
    'Notes':              a.notes ?? '',
  }))

  const filename = `SalaryAdvances_${new Date().toISOString().split('T')[0]}`

  if (format === 'csv') {
    saveFile(csvToBlob(buildCsv(rows)), `${filename}.csv`)
    return
  }

  const headers = Object.keys(rows[0] ?? {})
  const colWidths = [12, 26, 18, 14, 12, 22, 14, 16, 14, 14, 16, 14, 14, 28]
  const pesoColumns = [4, 11, 12, 13]

  const wb = newWorkbook()
  const ws = wb.addWorksheet('Advances', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: `FF${BRAND}` } },
  })
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 16 }))
  styleHeaderRow(ws.getRow(1), headers.length)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  rows.forEach((row, idx) => {
    const wsRow = ws.addRow(Object.values(row))
    styleDataRow(wsRow, headers.length, idx + 1, pesoColumns)
    // Colour outstanding red if > 0
    if ((advances[idx]?.outstanding ?? 0) > 0) {
      wsRow.getCell(13).font = { bold: true, size: 9, name: 'Calibri', color: { argb: `FF${DANGER}` } }
    }
  })

  saveFile(await workbookToBlob(wb), `${filename}.xlsx`)
}
