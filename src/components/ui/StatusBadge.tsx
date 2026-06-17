type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'rest-day' | 'holiday' | 'on-leave'
type PayrollStatus    = 'draft' | 'reviewed' | 'approved' | 'paid'
type LeaveStatus      = 'pending' | 'approved' | 'rejected' | 'cancelled'
type OTStatus         = 'pending' | 'approved' | 'rejected'
type EmployeeStatus   = 'active' | 'inactive' | 'resigned' | 'terminated' | 'awol'

type StatusType = 'attendance' | 'payroll' | 'leave' | 'overtime' | 'employee'

const ATTENDANCE_MAP: Record<AttendanceStatus, string> = {
  present:  'pill pill-green',
  late:     'pill pill-yellow',
  absent:   'pill pill-red',
  'half-day': 'pill pill-orange',
  'rest-day': 'pill pill-gray',
  holiday:  'pill pill-blue',
  'on-leave': 'pill pill-purple',
}

const PAYROLL_MAP: Record<PayrollStatus, string> = {
  draft:    'pill pill-gray',
  reviewed: 'pill pill-blue',
  approved: 'pill pill-indigo',
  paid:     'pill pill-green',
}

const LEAVE_MAP: Record<LeaveStatus, string> = {
  pending:   'pill pill-yellow',
  approved:  'pill pill-green',
  rejected:  'pill pill-red',
  cancelled: 'pill pill-gray',
}

const OT_MAP: Record<OTStatus, string> = {
  pending:  'pill pill-yellow',
  approved: 'pill pill-green',
  rejected: 'pill pill-red',
}

const EMPLOYEE_MAP: Record<EmployeeStatus, string> = {
  active:     'pill pill-green',
  inactive:   'pill pill-gray',
  resigned:   'pill pill-yellow',
  terminated: 'pill pill-red',
  awol:       'pill pill-orange',
}

const MAP: Record<StatusType, Record<string, string>> = {
  attendance: ATTENDANCE_MAP,
  payroll:    PAYROLL_MAP,
  leave:      LEAVE_MAP,
  overtime:   OT_MAP,
  employee:   EMPLOYEE_MAP,
}

interface Props {
  type: StatusType
  status: string
  children?: React.ReactNode
}

export function StatusBadge({ type, status, children }: Props) {
  const cls = MAP[type]?.[status] ?? 'pill pill-gray'
  return (
    <span className={cls}>
      {children ?? status}
    </span>
  )
}
