// ─── App Settings (Company + Deductions) ─────────────────────────────────────
// Schema: app_settings(id TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ)
// Keys:   'company'   → CompanySettings
//         'deductions' → PayrollDeductionSettings
import { supabase } from '../supabase'
import { DEFAULT_DEDUCTION_SETTINGS } from '../payrollEngine'
import type { CompanySettings, PayrollDeductionSettings } from '../../types'

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

/** Call once on app start to warm the caches from Supabase. */
export async function loadAllSettings(): Promise<void> {
  await Promise.all([loadCompanySettings(), loadDeductionSettings()])
}
