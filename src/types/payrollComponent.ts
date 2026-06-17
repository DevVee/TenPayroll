// ─── Dynamic Payroll Component types ──────────────────────────────────────────

/** What kind of payroll component this is — drives grouping and sign conventions. */
export type ComponentCategory =
  | 'earning'       // adds to gross pay (base wage bonuses, etc.)
  | 'allowance'     // adds to gross pay, usually non-taxable (rice, transport, etc.)
  | 'benefit'       // adds to gross pay, often taxable (13th month, bonus)
  | 'deduction'     // subtracted from net (loan, advance, voluntary)
  | 'contribution'  // subtracted from net, may have employer share (SSS, PhilHealth, etc.)
  | 'tax'           // income tax withheld from net
  | 'other'         // tracked separately, user-defined sign

/** How the component amount is calculated. */
export type CalcType = 'fixed' | 'percentage'

/** What amount the percentage rate is applied against. */
export type CalcBasis = 'basic_pay' | 'gross_earnings' | 'taxable_gross'

/**
 * How often a deduction / contribution / tax component is applied.
 * 'every_payroll' = default — follows the employee's own pay frequency.
 * Others override: deduct only on the specified cadence regardless of pay schedule.
 */
export type DeductionFrequency = 'every_payroll' | 'weekly' | 'semi_monthly' | 'monthly'

/**
 * A user-defined payroll component.
 * Stored as JSONB array in app_settings (key = 'payroll_components').
 * The payroll engine reads active components and applies them dynamically.
 */
export interface PayrollComponent {
  id:                string
  name:              string
  code:              string          // short slug, e.g. 'philhealth', 'rice_allow'
  description?:      string
  category:          ComponentCategory
  calcType:          CalcType
  fixedAmount:       number          // used when calcType = 'fixed'; monthly amount
  percentageRate:    number          // decimal (0.05 = 5%); used when calcType = 'percentage'
  calcBasis:         CalcBasis       // what to apply the rate against
  employeeShareRate: number          // fraction (0–1) paid by employee; default 1.0
  employerShareRate: number          // fraction (0–1) paid by employer; default 0.0
  maxAmount?:        number          // monthly cap on total component amount
  minAmount?:        number          // monthly floor on total component amount
  isTaxable:           boolean           // true = this earning counts toward taxable income
  affectsGross:        boolean           // true = adds to gross (earning); false = deducted
  isActive:            boolean
  priority:            number            // calculation order; lower = earlier
  effectiveDate?:      string            // ISO date; undefined = always active
  deductionFrequency?: DeductionFrequency // when to apply; default = 'every_payroll'
}

/**
 * Result of applying one PayrollComponent to a specific payroll entry.
 * Stored in payroll_entries.computed_components (JSONB).
 */
export interface ComputedComponent {
  componentId:    string
  name:           string
  category:       ComponentCategory
  employeeAmount: number
  employerAmount: number
  affectsGross:   boolean
  isTaxable:      boolean
}
