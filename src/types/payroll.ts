// ─── Core Payroll domain types ────────────────────────────────────────────────
import type { Allowance, EmploymentType } from './employee'
import type { ComputedComponent }         from './payrollComponent'

export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid'

export interface DeductionLine { type: string; amount: number }

export interface PayrollPeriod {
  id: string
  periodNo: string
  startDate: string
  endDate: string
  payDate: string
  frequency: import('./employee').PayFrequency
  status: PayrollStatus
  totalEmployees: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  createdBy: string
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  approvedBy?: string
  approvedAt?: string
  paidAt?: string
  notes?: string
}

export interface PayrollEntry {
  id: string
  payrollPeriodId: string
  employeeId: string
  employeeName: string
  employeeNo: string
  position: string
  department: string
  employmentType: EmploymentType
  scheduledDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  halfDays: number
  leaveDays: number
  overtimeHours: number
  nightDiffHours: number
  regularHolidayDays: number
  specialHolidayDays: number
  basicPay: number
  overtimePay: number
  regularHolidayPay: number
  specialHolidayPay: number
  nightDifferential: number
  allowances: Allowance[]
  grossPay: number
  lateDeductions: number
  absenceDeductions: number
  undertimeDeductions: number
  sssEmployee: number
  philhealthEmployee: number
  pagibigEmployee: number
  withholdingTax: number
  otherDeductions: DeductionLine[]
  totalDeductions: number
  sssEmployer: number
  philhealthEmployer: number
  pagibigEmployer: number
  netPay: number
  remarks?: string
  markedPaid?: boolean
  markedPaidAt?: string
  markedPaidBy?: string
  /** Populated by the dynamic component engine (new runs). Absent in legacy entries. */
  computedComponents?: ComputedComponent[]
}

// ─── Salary Advance ───────────────────────────────────────────────────────────
export type AdvanceStatus =
  | 'pending'
  | 'approved'
  | 'released'
  | 'fully_paid'
  | 'rejected'
  | 'cancelled'
  | 'written_off'

/**
 * Controls how `monthlyDeduction` is interpreted by the payroll generator.
 *
 * 'monthly'      The stored amount is a monthly budget.  Payroll divides it by
 *                the actual period count (4–5 for weekly, 2 for bi-monthly, 1
 *                for monthly) so the full budget is recovered within the month.
 *
 * 'per_period'   The stored amount is deducted exactly as-is every payroll run.
 *                No division.  Useful when HR wants a flat ₱2,500 each payday.
 *
 * 'installments' The advance is spread across a fixed number of payroll runs.
 *                monthlyDeduction = amount / installmentCount (computed on save).
 *                No division — each run deducts that exact per-run slice.
 */
export type DeductionType = 'monthly' | 'per_period' | 'installments'

export interface SalaryAdvance {
  id:               string
  employeeId:       string
  employeeName?:    string   // joined
  employeeNo?:      string   // joined
  department?:      string   // joined
  amount:           number
  purpose?:         string
  status:           AdvanceStatus
  requestedAt:      string
  approvedBy?:      string
  approvedAt?:      string
  releasedAt?:      string
  releaseNotes?:    string
  rejectionReason?: string
  repaymentStart?:   string
  monthlyDeduction?: number
  /** How monthlyDeduction is interpreted at payroll time. Default: 'monthly'. */
  deductionType?:    DeductionType
  /** Number of payroll runs the advance is split across. Only set when deductionType='installments'. */
  installmentCount?: number
  totalRepaid:       number
  outstanding:       number
  notes?:            string
  createdBy?:       string
  createdAt:        string
  updatedAt:        string
  // ── Suspension ──────────────────────────────────────────────────────────────
  isSuspended?:       boolean
  suspensionReason?:  string
  suspendedBy?:       string
  suspendedAt?:       string
  // ── Cancellation ────────────────────────────────────────────────────────────
  cancelledBy?:        string
  cancelledAt?:        string
  cancellationReason?: string
}

/** Type of repayment entry — drives the label shown in repayment history. */
export type RepaymentType = 'payroll' | 'manual' | 'adjustment' | 'reversal'

export interface AdvanceRepayment {
  id:              string
  advanceId:       string
  payrollPeriodId?: string
  amount:          number   // negative for downward balance corrections
  type:            RepaymentType
  notes?:          string
  recordedBy?:     string
  paidAt:          string
}
