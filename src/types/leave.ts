// ─── Leave domain types ───────────────────────────────────────────────────────

export type LeaveType =
  | 'vacation' | 'sick' | 'emergency'
  | 'maternity' | 'paternity' | 'solo-parent'
  | 'sil' | 'bereavement' | 'unpaid'

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveBalance {
  id: string
  employeeId: string
  employeeName?: string   // joined from employee
  employeeNo?: string     // joined from employee
  department?: string     // joined from employee
  year: number
  vacation:  { entitled: number; used: number; balance: number }
  sick:      { entitled: number; used: number; balance: number }
  emergency: { entitled: number; used: number; balance: number }
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  employeeNo?: string     // optional, not always stored
  leaveType: LeaveType
  startDate: string
  endDate: string
  days: number
  reason: string
  status: LeaveStatus
  reviewedBy?: string
  approvedBy?: string     // alias for reviewedBy
  reviewedAt?: string
  rejectionReason?: string
  createdAt: string
  filedAt?: string        // alias for createdAt
}
