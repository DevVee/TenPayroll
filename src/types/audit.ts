// ─── Audit log types ──────────────────────────────────────────────────────────

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'approve' | 'reject'
  | 'login' | 'logout'
  | 'generate'

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
