// ─── Enums / union types ──────────────────────────────────────────────────────
export type UserRole       = 'super-admin' | 'hr-admin' | 'payroll-officer' | 'dept-head' | 'employee'
export type EmploymentType = 'regular' | 'probationary' | 'contractual' | 'part-time'
export type EmployeeStatus = 'active' | 'inactive' | 'resigned' | 'terminated' | 'awol'
export type PayFrequency   = 'weekly' | 'bi-monthly' | 'monthly'
export type CompensationType = 'daily' | 'weekly' | 'monthly'
export type TaxStatus      = 'S' | 'S1' | 'S2' | 'S3' | 'ME' | 'ME1' | 'ME2' | 'ME3'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'rest-day' | 'holiday' | 'on-leave'
export type PayrollStatus  = 'draft' | 'reviewed' | 'approved' | 'paid'
export type LeaveType      = 'vacation' | 'sick' | 'emergency' | 'maternity' | 'paternity' | 'bereavement' | 'unpaid'
export type LeaveStatus    = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type OTStatus       = 'pending' | 'approved' | 'rejected'
export type HolidayType    = 'regular' | 'special-non-working' | 'special-working'
export type AuditAction    = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'generate'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface HRUser {
  id: string
  name: string
  email: string
  role: UserRole
  employeeId?: string
  department?: string
  avatarInitials: string
}

// ─── Department ───────────────────────────────────────────────────────────────
export interface Department {
  id: string
  name: string
  code?: string
  description?: string
  headName?: string
  createdAt: string
}

// ─── Position ─────────────────────────────────────────────────────────────────
export interface Position {
  id: string
  title: string
  department?: string   // optional: link to a department name
  level?: string        // e.g. 'Junior', 'Senior', 'Manager'
  description?: string
  createdAt: string
}

// ─── Work Shift ───────────────────────────────────────────────────────────────
export interface WorkShift {
  id: string
  name: string
  timeIn: string        // "08:00"
  timeOut: string       // "17:00"
  breakMinutes: number
  graceMinutes: number
  restDays: number[]    // 0=Sun, 6=Sat
  overtimeEnabled: boolean
  overtimeThresholdMinutes?: number  // minutes after timeOut before OT is counted
}

// ─── Allowance ────────────────────────────────────────────────────────────────
export interface Allowance {
  type: string
  amount: number
  taxable: boolean
}

// ─── Employee ─────────────────────────────────────────────────────────────────
export interface Employee {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  middleName: string
  fullName: string
  email: string
  phone: string
  address: string
  birthDate: string
  gender: 'male' | 'female'
  civilStatus: 'single' | 'married' | 'widowed' | 'separated'
  position: string
  department: string
  employmentType: EmploymentType
  status: EmployeeStatus
  hireDate: string
  resignDate?: string
  // ── Compensation ──────────────────────────────────────────────────────────
  compensationType: CompensationType  // 'daily' | 'weekly' | 'monthly'
  compensationRate: number            // the base rate matching compensationType
  basicSalary: number                 // monthly equivalent (for gov't deductions)
  dailyRate: number                   // computed or stored daily rate
  payFrequency: PayFrequency
  // ── Identification ────────────────────────────────────────────────────────
  pinCode?: string         // legacy PIN (no longer used by kiosk)
  rfidTag?: string         // RFID card UID for kiosk scan
  photoUrl?: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
  tinNo: string
  bankName: string
  bankAccount: string
  shiftId: string
  taxStatus: TaxStatus
  allowances: Allowance[]
  emergencyContactName: string
  emergencyContactPhone: string
  createdAt: string
  updatedAt: string
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  employeeNo: string
  department?: string     // joined from employee
  date: string
  timeIn?: string
  timeOut?: string
  status: AttendanceStatus
  minutesLate: number
  overtimeMinutes: number
  nightDiffMinutes: number
  undertimeMinutes: number
  source: 'kiosk' | 'manual'
  correctedBy?: string
  correctionReason?: string
  note?: string
}

// ─── Leave ────────────────────────────────────────────────────────────────────
export interface LeaveBalance {
  id: string
  employeeId: string
  employeeName?: string   // joined from employee
  employeeNo?: string     // joined from employee
  department?: string     // joined from employee
  year: number
  vacation:  { entitled: number; used: number; balance: number }
  sick:      { entitled: number; used: number; balance: number }
  emergency: { entitled: number; used: number; balance: number }
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  employeeNo?: string     // optional, not always stored
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  status: LeaveStatus
  reviewedBy?: string
  approvedBy?: string     // alias for reviewedBy
  reviewedAt?: string
  rejectionReason?: string
  createdAt: string
  filedAt?: string        // alias for createdAt
}

// ─── Overtime ─────────────────────────────────────────────────────────────────
export interface OvertimeRequest {
  id: string
  employeeId: string
  employeeName: string
  employeeNo: string
  department: string
  date: string
  hoursRequested: number
  overtimeType?: string   // e.g. 'regular', 'rest-day', 'holiday'
  multiplier?: number     // pay multiplier, default 1.25
  reason: string
  status: OTStatus
  reviewedBy?: string
  approvedBy?: string     // alias for reviewedBy
  reviewedAt?: string
  createdAt: string
  filedAt?: string        // alias for createdAt
}

// ─── Holiday ──────────────────────────────────────────────────────────────────
export interface Holiday {
  id: string
  name: string
  date: string
  type: HolidayType
  isNationwide: boolean
  description?: string
}

// ─── Payroll ──────────────────────────────────────────────────────────────────
export interface DeductionLine { type: string; amount: number }

export interface PayrollPeriod {
  id: string
  periodNo: string
  startDate: string
  endDate: string
  payDate: string
  frequency: PayFrequency
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
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  action: AuditAction
  module: string
  description: string
  before?: string
  after?: string
  // convenience aliases populated by some callers
  recordId?: string
}

// ─── Payroll Deduction Settings ───────────────────────────────────────────────
export interface PayrollDeductionSettings {
  // Late deduction
  lateDeductionEnabled: boolean
  lateDeductionMultiplier: number    // fraction of (hourly/60) per minute late; default 1.0
  // Absence deduction
  absenceDeductionEnabled: boolean
  absenceDeductionType: 'daily-rate' | 'zero'  // 'daily-rate' = full day deducted
  // Undertime deduction
  undertimeDeductionEnabled: boolean
  undertimeDeductionMultiplier: number  // fraction of hourly rate per minute undertime
  // Overtime
  overtimeEnabled: boolean
  overtimeMultiplierRegular: number   // default 1.25
  overtimeMultiplierRestDay: number   // default 1.30
  overtimeThresholdMinutes: number    // minutes after shift before OT counts; default 0
  // Night differential
  nightDiffEnabled: boolean
  nightDiffMultiplier: number         // default 0.10 (10% of hourly)
}

// ─── Company Settings ─────────────────────────────────────────────────────────
export interface CompanySettings {
  name: string
  tagline: string
  address: string
  contact: string
  email: string
  tin: string
  payPeriod: 'bi-monthly' | 'monthly' | 'weekly'
  // Additional fields
  sssNo?: string
  philhealthNo?: string
  pagibigNo?: string
  hrOfficer?: string
  hrEmail?: string
  payrollOfficer?: string
  defaultFrequency?: PayFrequency
  otMultiplierRegular?: number
  otMultiplierRestDay?: number
  vacationLeaveCredits?: number
  sickLeaveCredits?: number
  emergencyLeaveCredits?: number
}
