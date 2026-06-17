// ─── Dynamic Payroll Component Engine ────────────────────────────────────────
// Computes all active PayrollComponents for a single payroll entry.
// Zero hardcoded rules — everything is driven by the components array.

import type { PayrollComponent, ComputedComponent, ComponentCategory } from '../types'

const r2 = (n: number) => Math.round(n * 100) / 100

// ─── Category metadata ────────────────────────────────────────────────────────

/** True for categories that add to gross pay (earnings side). */
export const EARNING_CATEGORIES = new Set<ComponentCategory>([
  'earning', 'allowance', 'benefit',
])

/** True for categories that are deducted from employee net (deductions side). */
export const DEDUCTION_CATEGORIES = new Set<ComponentCategory>([
  'deduction', 'contribution', 'tax',
])

export function categoryLabel(cat: ComponentCategory): string {
  const map: Record<ComponentCategory, string> = {
    earning:      'Earning',
    allowance:    'Allowance',
    benefit:      'Benefit',
    deduction:    'Deduction',
    contribution: 'Contribution',
    tax:          'Tax',
    other:        'Other',
  }
  return map[cat] ?? cat
}

export const CATEGORY_COLORS: Record<ComponentCategory, { bg: string; text: string }> = {
  earning:      { bg: '#F0FDF4', text: '#16A34A' },
  allowance:    { bg: '#F0FDFA', text: '#0F766E' },
  benefit:      { bg: '#F5F3FF', text: '#7C3AED' },
  deduction:    { bg: '#FFF1F1', text: '#DC2626' },
  contribution: { bg: '#EFF6FF', text: '#2563EB' },
  tax:          { bg: '#FFF7ED', text: '#C2410C' },
  other:        { bg: '#F4F5FB', text: '#6B7194' },
}

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface ComponentComputeInput {
  /** Monthly basic salary (used as base for 'basic_pay' calculations). */
  basicPay: number
  /**
   * Gross already accumulated from attendance-based calculations
   * (basic pay prorated to period + OT + holiday pay + static allowances from employee profile).
   * This is the starting gross BEFORE dynamic components.
   */
  preComponentGross: number
  /** All payroll components (active ones will be used; sorted by priority internally). */
  components: PayrollComponent[]
  /**
   * Divisor to convert monthly amounts to the pay period.
   * 1 = monthly, 2 = bi-monthly, 4 = weekly.
   */
  periodDivisor?: number
}

export interface ComponentComputeResult {
  /** Each component's computed amounts for this entry. */
  components: ComputedComponent[]
  /** Total added to gross by earning-type components. */
  additionalEarnings: number
  /** Total deducted from net by deduction-type components (employee share). */
  componentDeductions: number
  /** Total employer contributions across all components. */
  employerContributions: number
  /** preComponentGross + additionalEarnings */
  finalGross: number
  /** finalGross - componentDeductions */
  finalNet: number
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function computePayrollComponents(input: ComponentComputeInput): ComponentComputeResult {
  const { basicPay, preComponentGross, periodDivisor = 1 } = input

  // Only active components, sorted by priority (lower = first)
  const sorted = [...input.components]
    .filter(c => {
      if (!c.isActive) return false
      if (c.effectiveDate) {
        const today = new Date().toISOString().split('T')[0]
        if (c.effectiveDate > today) return false
      }
      return true
    })
    .sort((a, b) => a.priority - b.priority)

  const results: ComputedComponent[] = []
  let runningGross = preComponentGross   // updated as earning components are applied

  for (const comp of sorted) {
    // ── Determine the monthly base amount ──────────────────────────────────
    let baseMonthly: number

    switch (comp.calcBasis) {
      case 'basic_pay':
        // Always the employee's monthly salary
        baseMonthly = basicPay * periodDivisor
        break

      case 'gross_earnings':
        // Running gross at this point in the calculation
        baseMonthly = runningGross * periodDivisor
        break

      case 'taxable_gross': {
        // Gross minus non-taxable earnings (allowances etc.) minus mandatory contributions
        const nonTaxableAdded = results
          .filter(r => r.affectsGross && !r.isTaxable)
          .reduce((s, r) => s + r.employeeAmount * periodDivisor, 0)

        const priorMandatory = results
          .filter(r => !r.affectsGross && r.category === 'contribution')
          .reduce((s, r) => s + r.employeeAmount * periodDivisor, 0)

        baseMonthly = Math.max(0, runningGross * periodDivisor - nonTaxableAdded - priorMandatory)
        break
      }

      default:
        baseMonthly = basicPay * periodDivisor
    }

    // ── Calculate monthly component amount ──────────────────────────────────
    let monthlyTotal: number

    switch (comp.calcType) {
      case 'fixed':
        monthlyTotal = comp.fixedAmount
        break
      case 'percentage':
        monthlyTotal = Math.max(0, baseMonthly) * comp.percentageRate
        break
      default:
        monthlyTotal = 0
    }

    // Apply caps (on monthly amount, before prorating)
    if (comp.maxAmount !== undefined && monthlyTotal > comp.maxAmount) {
      monthlyTotal = comp.maxAmount
    }
    if (comp.minAmount !== undefined && monthlyTotal < comp.minAmount) {
      monthlyTotal = comp.minAmount
    }
    monthlyTotal = Math.max(0, monthlyTotal)

    // ── Prorate to this pay period ──────────────────────────────────────────
    const periodTotal   = r2(monthlyTotal / periodDivisor)
    const employeeAmount = r2(periodTotal * comp.employeeShareRate)
    const employerAmount = r2(periodTotal * comp.employerShareRate)

    results.push({
      componentId:    comp.id,
      name:           comp.name,
      category:       comp.category,
      employeeAmount,
      employerAmount,
      affectsGross:   comp.affectsGross,
      isTaxable:      comp.isTaxable,
    })

    // ── Update running gross for subsequent calculations ────────────────────
    if (comp.affectsGross) {
      runningGross += employeeAmount
    }
  }

  // ── Summarize results ──────────────────────────────────────────────────────
  const additionalEarnings    = r2(results.filter(r => r.affectsGross).reduce((s, r) => s + r.employeeAmount, 0))
  const componentDeductions   = r2(results.filter(r => !r.affectsGross).reduce((s, r) => s + r.employeeAmount, 0))
  const employerContributions = r2(results.reduce((s, r) => s + r.employerAmount, 0))
  const finalGross            = r2(preComponentGross + additionalEarnings)
  const finalNet              = r2(finalGross - componentDeductions)

  return {
    components: results,
    additionalEarnings,
    componentDeductions,
    employerContributions,
    finalGross,
    finalNet,
  }
}

// ─── Convenience: group components by category for display ───────────────────

export function groupComponents(components: ComputedComponent[]): Map<ComponentCategory, ComputedComponent[]> {
  const map = new Map<ComponentCategory, ComputedComponent[]>()
  for (const c of components) {
    if (!map.has(c.category)) map.set(c.category, [])
    map.get(c.category)!.push(c)
  }
  return map
}

export function earningsTotal(components: ComputedComponent[]): number {
  return r2(components.filter(c => c.affectsGross).reduce((s, c) => s + c.employeeAmount, 0))
}

export function deductionsTotal(components: ComputedComponent[]): number {
  return r2(components.filter(c => !c.affectsGross).reduce((s, c) => s + c.employeeAmount, 0))
}
