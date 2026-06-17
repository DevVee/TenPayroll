// ─── Overtime domain types ────────────────────────────────────────────────────

export type OTStatus = 'pending' | 'approved' | 'rejected'

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
