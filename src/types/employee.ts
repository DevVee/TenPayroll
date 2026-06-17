// ─── Employee domain types ────────────────────────────────────────────────────
import type { PayrollComponent } from './payrollComponent'
export type { PayrollComponent }

export type EmploymentType  = 'regular' | 'probationary' | 'contractual' | 'part-time'
export type EmployeeStatus  = 'active' | 'inactive' | 'resigned' | 'terminated' | 'awol'
export type PayFrequency    = 'weekly' | 'bi-monthly' | 'monthly'
export type CompensationType = 'daily' | 'weekly' | 'monthly'
export type TaxStatus       = 'S' | 'S1' | 'S2' | 'S3' | 'ME' | 'ME1' | 'ME2' | 'ME3'

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

// ─── Salary History ───────────────────────────────────────────────────────────
export interface SalaryHistory {
  id: string
  employeeId: string
  oldSalary: number | null     // null on first-ever record
  newSalary: number
  effectiveDate: string        // ISO date "YYYY-MM-DD"
  changedBy?: string           // display name of the user who made the change
  reason?: string              // optional rationale (e.g. "Annual review")
  createdAt: string
}

// ─── Employee ─────────────────────────────────────────────────────────────────
export interface Employee {
  id: string
  // ── Required core ─────────────────────────────────────────────────────────
  employeeNo: string
  firstName: string
  lastName: string
  middleName?: string
  fullName: string
  position: string          // designation / job title
  status: EmployeeStatus
  basicSalary: number       // monthly equivalent (for govt deductions)
  // ── Optional contact ──────────────────────────────────────────────────────
  email?: string
  phone?: string
  address?: string
  birthDate?: string
  gender?: 'male' | 'female'
  civilStatus?: 'single' | 'married' | 'widowed' | 'separated'
  // ── Optional employment ───────────────────────────────────────────────────
  department?: string
  employmentType?: EmploymentType
  hireDate?: string
  resignDate?: string
  shiftId?: string
  payFrequency?: PayFrequency
  // ── Compensation ──────────────────────────────────────────────────────────
  compensationType?: CompensationType  // 'daily' | 'weekly' | 'monthly'
  compensationRate?: number            // the base rate matching compensationType
  dailyRate?: number                   // computed or stored daily rate
  allowances?: Allowance[]
  // ── Identification ────────────────────────────────────────────────────────
  pinCode?: string
  rfidTag?: string
  photoUrl?: string
  sssNo?: string
  philhealthNo?: string
  pagibigNo?: string
  tinNo?: string
  taxStatus?: TaxStatus
  // ── Bank / Emergency ──────────────────────────────────────────────────────
  bankName?: string
  bankAccount?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  // ── Per-employee payroll components ────────────────────────────────────────
  payrollComponents?: PayrollComponent[]
  createdAt?: string
  updatedAt?: string
}
