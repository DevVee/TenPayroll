// ─── Dynamic Payroll Components — CRUD ───────────────────────────────────────
// Storage: app_settings table, id = 'payroll_components', value = JSONB array
// No extra table needed; same pattern as company/deduction settings.

import { supabase } from '../supabase'
import type { PayrollComponent } from '../../types'

const SETTINGS_KEY = 'payroll_components'

/* ── In-memory cache ── */
let _cache: PayrollComponent[] = []

export function getPayrollComponents(): PayrollComponent[] { return _cache }

/* ── Load from Supabase ── */
export async function loadPayrollComponents(): Promise<PayrollComponent[]> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('id', SETTINGS_KEY)
    .single()
  _cache = (data?.value ?? []) as PayrollComponent[]
  return _cache
}

/* ── Internal persist helper ── */
async function persist(components: PayrollComponent[]): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert(
    { id: SETTINGS_KEY, value: components },
    { onConflict: 'id' }
  )
  if (error) throw new Error(error.message ?? 'Failed to save payroll components.')
  _cache = components
}

/* ── Public CRUD ─────────────────────────────────────────────────────────────── */

export async function apiCreatePayrollComponent(
  data: Omit<PayrollComponent, 'id'>
): Promise<PayrollComponent> {
  const comp: PayrollComponent = {
    ...data,
    id: crypto.randomUUID(),
  }
  await persist([..._cache, comp])
  return comp
}

export async function apiUpdatePayrollComponent(
  id: string,
  patch: Partial<Omit<PayrollComponent, 'id'>>
): Promise<PayrollComponent> {
  const next = _cache.map(c => c.id === id ? { ...c, ...patch } : c)
  const found = next.find(c => c.id === id)
  if (!found) throw new Error('Payroll component not found.')
  await persist(next)
  return found
}

export async function apiDeletePayrollComponent(id: string): Promise<void> {
  await persist(_cache.filter(c => c.id !== id))
}

export async function apiTogglePayrollComponent(id: string): Promise<void> {
  await persist(_cache.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c))
}

/** Reorder components by writing new priorities.
 *  Pass an ordered array of ids; priorities are assigned 10, 20, 30 … */
export async function apiReorderPayrollComponents(orderedIds: string[]): Promise<void> {
  const priorityMap = new Map(orderedIds.map((id, i) => [id, (i + 1) * 10]))
  await persist(_cache.map(c => ({
    ...c,
    priority: priorityMap.get(c.id) ?? c.priority,
  })))
}
