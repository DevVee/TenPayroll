// ─── Attendance domain types ──────────────────────────────────────────────────

export type AttendanceStatus =
  | 'present' | 'absent' | 'late' | 'half-day'
  | 'rest-day' | 'holiday' | 'on-leave'

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  employeeNo: string
  department?: string     // joined from employee
  date: string
  timeIn?: string
  timeOut?: string
  status: AttendanceStatus
  minutesLate: number
  overtimeMinutes: number
  nightDiffMinutes: number
  undertimeMinutes: number
  source: 'kiosk' | 'manual'
  correctedBy?: string
  correctionReason?: string
  note?: string
  isVoided?: boolean
}

// ─── Attendance exception ─────────────────────────────────────────────────────
export interface AttendanceException {
  id:            string
  employeeId:    string
  employeeName:  string
  employeeNo:    string
  department?:   string
  date:          string
  timeIn:        string
  exceptionType: 'missing_timeout'
}

// ─── Holiday ──────────────────────────────────────────────────────────────────
export type HolidayType = 'regular' | 'special-non-working' | 'special-working'

export interface Holiday {
  id: string
  name: string
  date: string
  type: HolidayType
  isNationwide: boolean
  description?: string
}
