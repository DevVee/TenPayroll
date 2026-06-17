// ─── Settings & configuration types ──────────────────────────────────────────
import type { PayFrequency } from './employee'

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
  // Holiday pay rates
  specialHolidayRate: number          // default 0.30 (30%) for special non-working holidays
  // Working days divisor for daily rate computation
  workingDaysDivisor: number          // default 22; some companies use 26
}

// ─── Government Contributions Config ─────────────────────────────────────────

/** One row in the SSS contribution table */
export interface SSSBracket {
  id:             string
  maxSalary:      number   // upper salary ceiling; use 9999999 for the last (∞) bracket
  employeeAmount: number   // fixed employee contribution amount
  employerAmount: number   // fixed employer contribution amount
}

/** One bracket in the BIR withholding tax table */
export interface TaxBracket {
  id:          string
  maxIncome:   number | null  // null = no upper limit (last bracket)
  baseTax:     number         // fixed base tax amount
  rate:        number         // marginal rate on excess (decimal, e.g. 0.20)
  excessOver:  number         // income threshold from which the rate applies
}

export interface GovtContribConfig {
  // PhilHealth
  philhealthEnabled: boolean
  philhealthRate:    number
  philhealthFloor:   number
  philhealthCeiling: number

  // Pag-IBIG (HDMF)
  pagibigEnabled:       boolean
  pagibigEmployeeRate:  number
  pagibigEmployerRate:  number
  pagibigMaxEmployee:   number
  pagibigMaxEmployer:   number
  pagibigLowSalaryMax:  number
  pagibigLowSalaryRate: number

  // SSS
  sssEnabled:  boolean
  sssBrackets: SSSBracket[]   // empty = not configured

  // Withholding Tax
  taxEnabled:  boolean
  taxBrackets: TaxBracket[]   // empty = not configured
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
