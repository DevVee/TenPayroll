// ─── Audit Logs ───────────────────────────────────────────────────────────────
import { supabase } from '../supabase'
import { loadProfile } from './auth'
import type { AuditLog } from '../../types'

// ── Row mapper ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAuditLog(r: any): AuditLog {
  return {
    id:          r.id,
    timestamp:   r.timestamp,
    userId:      r.user_id   ?? '',
    userName:    r.user_name ?? '',
    action:      r.action,
    module:      r.module,
    description: r.description,
    before:      r.before_data ?? undefined,
    after:       r.after_data  ?? undefined,
    recordId:    r.record_id   ?? undefined,
  }
}

// ── Internal helper called by other modules ───────────────────────────────────
// Automatically resolves the real Supabase auth user ID from the active session,
// so every audit record contains the genuine actor — not a hardcoded 'sys' string.
export async function insertAudit(entry: {
  userId:      string       // display fallback (will be overridden by auth.uid when available)
  userName:    string
  action:      AuditLog['action']
  module:      string
  description: string
  before?:     string
  after?:      string
  recordId?:   string
}): Promise<void> {
  // Resolve the real Supabase auth user from the active session so every audit
  // record carries the genuine actor — not the 'sys'/'System' placeholder that
  // call sites pass when they don't have the user object at hand.
  let resolvedId   = entry.userId
  let resolvedName = entry.userName
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser?.id) {
      resolvedId = authUser.id
      // Only hit the DB for the profile name when the caller passed a placeholder.
      // Real names passed explicitly (e.g. from a login audit) are kept as-is.
      if (!resolvedName || resolvedName === 'sys' || resolvedName === 'System') {
        const profile = await loadProfile(authUser.id)
        if (profile?.name) resolvedName = profile.name
      }
    }
  } catch {
    // Silent — audit resolution must never block the main user flow
  }

  await supabase.from('audit_logs').insert({
    user_id:     resolvedId,
    user_name:   resolvedName,
    action:      entry.action,
    module:      entry.module,
    description: entry.description,
    before_data: entry.before ?? null,
    after_data:  entry.after  ?? null,
    record_id:   entry.recordId ?? null,
  })
  // Errors are intentionally ignored — audit failures must not break user flow
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function apiGetAuditLogs(limit = 200): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(toAuditLog)
}
