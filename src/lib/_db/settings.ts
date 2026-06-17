// ─── App Settings (Company + Deductions + Govt Contributions) ────────────────
// Schema: app_settings(id TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ)
// Keys:   'company'      → CompanySettings
//         'deductions'   → PayrollDeductionSettings
//         'govt_config'  → GovtContribConfig
import { supabase } from '../supabase'
import { DEFAULT_DEDUCTION_SETTINGS } from '../payrollEngine'
import type { CompanySettings, PayrollDeductionSettings, GovtContribConfig } from '../../types'

// ── Default company settings ──────────────────────────────────────────────────
const DEFAULT_COMPANY: CompanySettings = {
  name:      'Ten Foundation Philippines Inc.',
  tagline:   '',
  address:   '',
  contact:   '',
  email:     '',
  tin:       '',
  payPeriod: 'bi-monthly',
}

// ── Synchronous fallbacks (for legacy callers) ────────────────────────────────
// These return sensible defaults immediately; call the async variants for real data.
let _companyCache:    CompanySettings          = DEFAULT_COMPANY
let _deductionCache:  PayrollDeductionSettings = DEFAULT_DEDUCTION_SETTINGS

export function getCompanySettings():   CompanySettings          { return _companyCache }
export function getDeductionSettings(): PayrollDeductionSettings { return _deductionCache }

/** Legacy sync save — fires-and-forgets to Supabase; use the async variant for await. */
export function saveCompanySettings(s: CompanySettings): void {
  _companyCache = s
  apiSaveCompanySettings(s).catch(() => {/* silently ignored */})
}

/** Legacy sync save — fires-and-forgets to Supabase; use the async variant for await. */
export function saveDeductionSettings(s: PayrollDeductionSettings): void {
  _deductionCache = s
  apiSaveDeductionSettings(s).catch(() => {/* silently ignored */})
}

// ── Async API ─────────────────────────────────────────────────────────────────
export async function loadCompanySettings(): Promise<CompanySettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'company')
    .single()
  const settings = (data?.value ?? DEFAULT_COMPANY) as CompanySettings
  _companyCache = settings
  return settings
}

export async function apiSaveCompanySettings(s: CompanySettings): Promise<void> {
  _companyCache = s
  const { error } = await supabase.from('app_settings').upsert(
    { id: 'company', value: s },
    { onConflict: 'id' }
  )
  if (error) throw new Error(error.message)
}

export async function loadDeductionSettings(): Promise<PayrollDeductionSettings> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'deductions')
    .single()
  const settings = (data?.value ?? DEFAULT_DEDUCTION_SETTINGS) as PayrollDeductionSettings
  _deductionCache = settings
  return settings
}

export async function apiSaveDeductionSettings(s: PayrollDeductionSettings): Promise<void> {
  _deductionCache = s
  const { error } = await supabase.from('app_settings').upsert(
    { id: 'deductions', value: s },
    { onConflict: 'id' }
  )
  if (error) throw new Error(error.message)
}

// ── Government Contributions Config ───────────────────────────────────────────

/** SSS 2024 contribution table — 50 brackets */
export const DEFAULT_SSS_BRACKETS = [
  { id:'s01', maxSalary:  4249.99, employeeAmount:  180.0, employerAmount:  380.0 },
  { id:'s02', maxSalary:  4749.99, employeeAmount:  202.5, employerAmount:  427.5 },
  { id:'s03', maxSalary:  5249.99, employeeAmount:  225.0, employerAmount:  475.0 },
  { id:'s04', maxSalary:  5749.99, employeeAmount:  247.5, employerAmount:  522.5 },
  { id:'s05', maxSalary:  6249.99, employeeAmount:  270.0, employerAmount:  570.0 },
  { id:'s06', maxSalary:  6749.99, employeeAmount:  292.5, employerAmount:  617.5 },
  { id:'s07', maxSalary:  7249.99, employeeAmount:  315.0, employerAmount:  665.0 },
  { id:'s08', maxSalary:  7749.99, employeeAmount:  337.5, employerAmount:  712.5 },
  { id:'s09', maxSalary:  8249.99, employeeAmount:  360.0, employerAmount:  760.0 },
  { id:'s10', maxSalary:  8749.99, employeeAmount:  382.5, employerAmount:  807.5 },
  { id:'s11', maxSalary:  9249.99, employeeAmount:  405.0, employerAmount:  855.0 },
  { id:'s12', maxSalary:  9749.99, employeeAmount:  427.5, employerAmount:  902.5 },
  { id:'s13', maxSalary: 10249.99, employeeAmount:  450.0, employerAmount:  950.0 },
  { id:'s14', maxSalary: 10749.99, employeeAmount:  472.5, employerAmount:  997.5 },
  { id:'s15', maxSalary: 11249.99, employeeAmount:  495.0, employerAmount: 1045.0 },
  { id:'s16', maxSalary: 11749.99, employeeAmount:  517.5, employerAmount: 1092.5 },
  { id:'s17', maxSalary: 12249.99, employeeAmount:  540.0, employerAmount: 1140.0 },
  { id:'s18', maxSalary: 12749.99, employeeAmount:  562.5, employerAmount: 1187.5 },
  { id:'s19', maxSalary: 13249.99, employeeAmount:  585.0, employerAmount: 1235.0 },
  { id:'s20', maxSalary: 13749.99, employeeAmount:  607.5, employerAmount: 1282.5 },
  { id:'s21', maxSalary: 14249.99, employeeAmount:  630.0, employerAmount: 1330.0 },
  { id:'s22', maxSalary: 14749.99, employeeAmount:  652.5, employerAmount: 1377.5 },
  { id:'s23', maxSalary: 15249.99, employeeAmount:  675.0, employerAmount: 1425.0 },
  { id:'s24', maxSalary: 15749.99, employeeAmount:  697.5, employerAmount: 1472.5 },
  { id:'s25', maxSalary: 16249.99, employeeAmount:  720.0, employerAmount: 1520.0 },
  { id:'s26', maxSalary: 16749.99, employeeAmount:  742.5, employerAmount: 1567.5 },
  { id:'s27', maxSalary: 17249.99, employeeAmount:  765.0, employerAmount: 1615.0 },
  { id:'s28', maxSalary: 17749.99, employeeAmount:  787.5, employerAmount: 1662.5 },
  { id:'s29', maxSalary: 18249.99, employeeAmount:  810.0, employerAmount: 1710.0 },
  { id:'s30', maxSalary: 18749.99, employeeAmount:  832.5, employerAmount: 1757.5 },
  { id:'s31', maxSalary: 19249.99, employeeAmount:  855.0, employerAmount: 1805.0 },
  { id:'s32', maxSalary: 19749.99, employeeAmount:  877.5, employerAmount: 1852.5 },
  { id:'s33', maxSalary: 20249.99, employeeAmount:  900.0, employerAmount: 1900.0 },
  { id:'s34', maxSalary: 20749.99, employeeAmount:  922.5, employerAmount: 1947.5 },
  { id:'s35', maxSalary: 21249.99, employeeAmount:  945.0, employerAmount: 1995.0 },
  { id:'s36', maxSalary: 21749.99, employeeAmount:  967.5, employerAmount: 2042.5 },
  { id:'s37', maxSalary: 22249.99, employeeAmount:  990.0, employerAmount: 2090.0 },
  { id:'s38', maxSalary: 22749.99, employeeAmount: 1012.5, employerAmount: 2137.5 },
  { id:'s39', maxSalary: 23249.99, employeeAmount: 1035.0, employerAmount: 2185.0 },
  { id:'s40', maxSalary: 23749.99, employeeAmount: 1057.5, employerAmount: 2232.5 },
  { id:'s41', maxSalary: 24249.99, employeeAmount: 1080.0, employerAmount: 2280.0 },
  { id:'s42', maxSalary: 24749.99, employeeAmount: 1102.5, employerAmount: 2327.5 },
  { id:'s43', maxSalary: 25249.99, employeeAmount: 1125.0, employerAmount: 2375.0 },
  { id:'s44', maxSalary: 25749.99, employeeAmount: 1147.5, employerAmount: 2422.5 },
  { id:'s45', maxSalary: 26249.99, employeeAmount: 1170.0, employerAmount: 2470.0 },
  { id:'s46', maxSalary: 26749.99, employeeAmount: 1192.5, employerAmount: 2517.5 },
  { id:'s47', maxSalary: 27249.99, employeeAmount: 1215.0, employerAmount: 2565.0 },
  { id:'s48', maxSalary: 27749.99, employeeAmount: 1237.5, employerAmount: 2612.5 },
  { id:'s49', maxSalary: 34749.99, employeeAmount: 1350.0, employerAmount: 2850.0 },
  { id:'s50', maxSalary: 9999999,  employeeAmount: 1620.0, employerAmount: 3420.0 },
]

/** BIR TRAIN Law — monthly withholding tax brackets */
export const DEFAULT_TAX_BRACKETS = [
  { id:'t1', maxIncome:    20833, baseTax:       0, rate: 0.00, excessOver:      0 },
  { id:'t2', maxIncome:    33332, baseTax:       0, rate: 0.20, excessOver:  20833 },
  { id:'t3', maxIncome:    66666, baseTax:    2500, rate: 0.25, excessOver:  33333 },
  { id:'t4', maxIncome:   166666, baseTax:   10833.33, rate: 0.30, excessOver: 66667 },
  { id:'t5', maxIncome:   666666, baseTax:   40833.33, rate: 0.32, excessOver: 166667 },
  { id:'t6', maxIncome:     null, baseTax:  200833.33, rate: 0.35, excessOver: 666667 },
]

/** Fresh default — all contributions OFF and no brackets. User configures everything. */
export const DEFAULT_GOVT_CONFIG: GovtContribConfig = {
  philhealthEnabled: false,
  philhealthRate:    0.05,
  philhealthFloor:   10000,
  philhealthCeiling: 100000,

  pagibigEnabled:       false,
  pagibigEmployeeRate:  0.02,
  pagibigEmployerRate:  0.02,
  pagibigMaxEmployee:   100,
  pagibigMaxEmployer:   100,
  pagibigLowSalaryMax:  1500,
  pagibigLowSalaryRate: 0.01,

  sssEnabled:  false,
  sssBrackets: [],   // start empty

  taxEnabled:  false,
  taxBrackets: [],   // start empty
}

let _govtCache: GovtContribConfig = DEFAULT_GOVT_CONFIG

export function getGovtConfig(): GovtContribConfig { return _govtCache }

export function saveGovtConfig(s: GovtContribConfig): void {
  _govtCache = s
  apiSaveGovtConfig(s).catch(() => {/* silently ignored */})
}

export async function loadGovtConfig(): Promise<GovtContribConfig> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', 'govt_config')
    .single()
  const cfg = (data?.value ?? DEFAULT_GOVT_CONFIG) as GovtContribConfig
  _govtCache = cfg
  return cfg
}

export async function apiSaveGovtConfig(s: GovtContribConfig): Promise<void> {
  _govtCache = s
  const { error } = await supabase.from('app_settings').upsert(
    { id: 'govt_config', value: s },
    { onConflict: 'id' }
  )
  if (error) throw new Error(error.message)
}

/** Call once on app start to warm the caches from Supabase. */
export async function loadAllSettings(): Promise<void> {
  const { loadPayrollComponents } = await import('./payrollComponents')
  await Promise.all([
    loadCompanySettings(),
    loadDeductionSettings(),
    loadGovtConfig(),
    loadPayrollComponents(),
  ])
}
