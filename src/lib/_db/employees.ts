// ─── Employees + Departments + Positions ──────────────────────────────────────
import { supabase } from '../supabase'
import { insertAudit } from './audit'
import { hashPin, hashRfid } from '../utils/hash'
import type { Employee, Department, Position, LeaveBalance, SalaryHistory } from '../../types'
import { getCurrentUserAsync } from './auth'

// ── Mappers ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEmployee(r: any): Employee {
  return {
    id:                     r.id,
    employeeNo:             r.employee_no,
    firstName:              r.first_name,
    lastName:               r.last_name,
    middleName:             r.middle_name     ?? '',
    fullName:               r.full_name,
    email:                  r.email,
    phone:                  r.phone           ?? '',
    address:                r.address         ?? '',
    birthDate:              r.birth_date      ?? '',
    gender:                 r.gender          ?? 'male',
    civilStatus:            r.civil_status    ?? 'single',
    position:               r.position        ?? '',
    department:             r.department      ?? '',
    employmentType:         r.employment_type ?? 'regular',
    status:                 r.status          ?? 'active',
    hireDate:               r.hire_date       ?? '',
    resignDate:             r.resign_date     ?? undefined,
    compensationType:       r.compensation_type ?? 'monthly',
    compensationRate:       Number(r.compensation_rate) ?? 0,
    basicSalary:            Number(r.basic_salary)      ?? 0,
    dailyRate:              Number(r.daily_rate)        ?? 0,
    payFrequency:           r.pay_frequency   ?? 'bi-monthly',
    pinCode:                r.pin_code        ?? undefined,
    rfidTag:                r.rfid_tag        ?? undefined,
    photoUrl:               r.photo_url       ?? undefined,
    sssNo:                  r.sss_no          ?? '',
    philhealthNo:           r.philhealth_no   ?? '',
    pagibigNo:              r.pagibig_no      ?? '',
    tinNo:                  r.tin_no          ?? '',
    bankName:               r.bank_name       ?? '',
    bankAccount:            r.bank_account    ?? '',
    shiftId:                r.shift_id        ?? '',
    taxStatus:              r.tax_status      ?? 'S',
    allowances:             r.allowances      ?? [],
    payrollComponents:      r.payroll_components ?? [],
    emergencyContactName:   r.emergency_contact_name  ?? '',
    emergencyContactPhone:  r.emergency_contact_phone ?? '',
    createdAt:              r.created_at,
    updatedAt:              r.updated_at,
  }
}

// fromEmployee is async because PIN/RFID hashing uses Web Crypto (Promise-based).
async function fromEmployee(data: Partial<Employee>): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {}
  if (data.employeeNo    !== undefined) row.employee_no    = data.employeeNo
  if (data.firstName     !== undefined) row.first_name     = data.firstName
  if (data.lastName      !== undefined) row.last_name      = data.lastName
  if (data.middleName    !== undefined) row.middle_name    = data.middleName
  if (data.fullName      !== undefined) row.full_name      = data.fullName
  if (data.email         !== undefined) row.email          = data.email
  if (data.phone         !== undefined) row.phone          = data.phone
  if (data.address       !== undefined) row.address        = data.address
  if (data.birthDate     !== undefined) row.birth_date     = data.birthDate || null
  if (data.gender        !== undefined) row.gender         = data.gender
  if (data.civilStatus   !== undefined) row.civil_status   = data.civilStatus
  if (data.position      !== undefined) row.position       = data.position
  if (data.department    !== undefined) row.department     = data.department
  if (data.employmentType !== undefined) row.employment_type = data.employmentType
  if (data.status        !== undefined) row.status         = data.status
  if (data.hireDate      !== undefined) row.hire_date      = data.hireDate || null
  if (data.resignDate    !== undefined) row.resign_date    = data.resignDate || null
  if (data.compensationType !== undefined) row.compensation_type = data.compensationType
  if (data.compensationRate !== undefined) row.compensation_rate = data.compensationRate
  if (data.basicSalary   !== undefined) row.basic_salary   = data.basicSalary
  if (data.dailyRate     !== undefined) row.daily_rate     = data.dailyRate
  if (data.payFrequency  !== undefined) row.pay_frequency  = data.payFrequency

  // PIN: hash only — pin_code column was dropped in migration 002.
  if (data.pinCode !== undefined) {
    row.pin_hash = data.pinCode ? await hashPin(data.pinCode) : null
  }

  // RFID: hash only — rfid_tag column was dropped in migration 002.
  // H4: Normalize before hashing — scanners can emit mixed case / leading spaces.
  // The same normalization is applied at verification time in apiKioskRFID.
  if (data.rfidTag !== undefined) {
    const normalizedRfid = data.rfidTag ? data.rfidTag.trim().toUpperCase() : ''
    row.rfid_hash = normalizedRfid ? await hashRfid(normalizedRfid) : null
  }

  if (data.photoUrl      !== undefined) row.photo_url      = data.photoUrl || null
  if (data.sssNo         !== undefined) row.sss_no         = data.sssNo
  if (data.philhealthNo  !== undefined) row.philhealth_no  = data.philhealthNo
  if (data.pagibigNo     !== undefined) row.pagibig_no     = data.pagibigNo
  if (data.tinNo         !== undefined) row.tin_no         = data.tinNo
  if (data.bankName      !== undefined) row.bank_name      = data.bankName
  if (data.bankAccount   !== undefined) row.bank_account   = data.bankAccount
  if (data.shiftId       !== undefined) row.shift_id       = data.shiftId || null
  if (data.taxStatus     !== undefined) row.tax_status     = data.taxStatus
  if (data.allowances          !== undefined) row.allowances          = data.allowances
  if (data.payrollComponents   !== undefined) row.payroll_components  = data.payrollComponents
  if (data.emergencyContactName  !== undefined) row.emergency_contact_name  = data.emergencyContactName
  if (data.emergencyContactPhone !== undefined) row.emergency_contact_phone = data.emergencyContactPhone

  // ── FK resolution: look up department_id / position_id by free-text name ──
  // Keeps free-text columns in sync while also populating the FK columns added
  // by migration 004. Errors are suppressed — a missing match leaves the FK NULL.
  if (data.department !== undefined && data.department) {
    try {
      const { data: dRow } = await supabase
        .from('departments').select('id').eq('name', data.department).maybeSingle()
      if (dRow?.id) row.department_id = dRow.id
    } catch { /* non-critical */ }
  }
  if (data.position !== undefined && data.position) {
    try {
      const { data: pRow } = await supabase
        .from('positions').select('id').eq('title', data.position).maybeSingle()
      if (pRow?.id) row.position_id = pRow.id
    } catch { /* non-critical */ }
  }

  return row
}

// ── Public API: Employees ─────────────────────────────────────────────────────
export async function apiGetEmployees(p?: {
  search?:     string
  department?: string
  status?:     string
}): Promise<Employee[]> {
  let query = supabase.from('employees').select('*').order('full_name')

  if (p?.status && p.status !== 'all') query = query.eq('status', p.status)
  if (p?.department && p.department !== 'all') query = query.eq('department', p.department)
  if (p?.search) {
    const q = `%${p.search}%`
    query = query.or(`full_name.ilike.${q},employee_no.ilike.${q},position.ilike.${q}`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toEmployee)
}

export async function apiGetEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
  if (error || !data) return null
  return toEmployee(data)
}

/** Converts a Postgres unique-violation (23505) on RFID/PIN columns into a
 *  human-readable message so HR sees "This RFID card is already assigned…"
 *  instead of a raw constraint name. */
function humanizeUniqueViolation(err: { code?: string; message?: string }): Error {
  if (err.code !== '23505') return new Error(err.message ?? 'Database error')
  const msg = (err.message ?? '').toLowerCase()
  if (msg.includes('rfid_hash') || msg.includes('rfid_tag'))
    return new Error('This RFID card is already assigned to another employee. Each card must be unique.')
  if (msg.includes('pin_hash') || msg.includes('pin_code'))
    return new Error('This PIN is already in use by another employee. Choose a different PIN.')
  if (msg.includes('email'))
    return new Error('An employee with this email already exists.')
  if (msg.includes('employee_no'))
    return new Error('This Employee No. is already taken. Use a different number.')
  return new Error('A duplicate value was detected. Please check your input and try again.')
}

export async function apiCreateEmployee(
  data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Employee> {
  const { data: row, error } = await supabase
    .from('employees')
    .insert(await fromEmployee(data))
    .select()
    .single()
  if (error) throw humanizeUniqueViolation(error)
  if (!row)  throw new Error('Failed to create employee')
  const emp = toEmployee(row)

  // Auto-create leave balance for current year.
  // Reads entitlements from leave_types table (migration 005); falls back to
  // the company settings cache; finally falls back to statutory minimums.
  const year = new Date().getFullYear()
  const { getCompanySettings } = await import('../_db/settings')
  const cs = getCompanySettings()

  // Fetch configured entitlements from leave_types (best-effort)
  type LeaveTypeCfg = { code: string; max_days_per_year: number | null }
  const { data: ltRows } = await supabase
    .from('leave_types')
    .select('code, max_days_per_year')
    .in('code', ['vacation', 'sick', 'emergency'])

  const ltMap: Record<string, number> = {}
  ;((ltRows ?? []) as LeaveTypeCfg[]).forEach(r => {
    if (r.max_days_per_year !== null) ltMap[r.code] = r.max_days_per_year
  })

  const vDays = ltMap['vacation']  ?? cs.vacationLeaveCredits  ?? 15
  const sDays = ltMap['sick']      ?? cs.sickLeaveCredits      ?? 15
  const eDays = ltMap['emergency'] ?? cs.emergencyLeaveCredits ?? 3

  await supabase.from('leave_balances').insert({
    employee_id: emp.id, year,
    vacation:  { entitled: vDays, used: 0, balance: vDays },
    sick:      { entitled: sDays, used: 0, balance: sDays },
    emergency: { entitled: eDays, used: 0, balance: eDays },
  })

  await insertAudit({ userId: 'sys', userName: 'System', action: 'create', module: 'Employee', description: `Created employee ${emp.fullName} (${emp.employeeNo})` })
  return emp
}

export async function apiUpdateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
  // ── Salary history: snapshot current salary BEFORE the update ─────────────
  let previousSalary: number | null = null
  const salaryChanging = data.basicSalary !== undefined
  if (salaryChanging) {
    const current = await apiGetEmployee(id)
    previousSalary = current?.basicSalary ?? null
  }

  const { data: row, error } = await supabase
    .from('employees')
    .update(await fromEmployee(data))
    .eq('id', id)
    .select()
    .single()
  if (error) throw humanizeUniqueViolation(error)
  if (!row)  throw new Error('Employee not found')
  const emp = toEmployee(row)

  // ── Salary history: persist change record if the value actually moved ──────
  if (salaryChanging && previousSalary !== data.basicSalary) {
    const actor = await getCurrentUserAsync()
    await supabase.from('salary_history').insert({
      employee_id:    id,
      old_salary:     previousSalary,
      new_salary:     data.basicSalary,
      effective_date: new Date().toISOString().slice(0, 10),
      changed_by:     actor?.name ?? 'System',
    })
  }

  await insertAudit({ userId: 'sys', userName: 'System', action: 'update', module: 'Employee', description: `Updated ${emp.fullName}` })
  return emp
}

/** Returns the salary change history for a given employee, newest first. */
export async function apiGetSalaryHistory(employeeId: string): Promise<SalaryHistory[]> {
  const { data, error } = await supabase
    .from('salary_history')
    .select('*')
    .eq('employee_id', employeeId)
    .order('effective_date', { ascending: false })
    .order('created_at',     { ascending: false })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any): SalaryHistory => ({
    id:            r.id,
    employeeId:    r.employee_id,
    oldSalary:     r.old_salary   !== null ? Number(r.old_salary)  : null,
    newSalary:     Number(r.new_salary),
    effectiveDate: r.effective_date,
    changedBy:     r.changed_by   ?? undefined,
    reason:        r.reason       ?? undefined,
    createdAt:     r.created_at,
  }))
}

export async function apiDeleteEmployee(id: string): Promise<void> {
  // Fetch first so we have the name for the audit log (before the row is gone)
  const emp = await apiGetEmployee(id)

  // Delete without .select() — avoids a false "not found" error caused by
  // Supabase RLS not being able to re-read a row it just deleted.
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw new Error(error.message ?? 'Failed to delete employee.')

  if (emp) {
    await insertAudit({
      userId:      'sys',
      userName:    'System',
      action:      'delete',
      module:      'Employee',
      description: `Deleted ${emp.fullName} (${emp.employeeNo})`,
    })
  }
}

// ── Batch employee field updates ──────────────────────────────────────────────
export async function apiBatchUpdateEmployeeStatus(
  ids:    string[],
  status: Employee['status'],
  by = 'System',
): Promise<{ ok: number; fail: number }> {
  if (!ids.length) return { ok: 0, fail: 0 }
  const { error } = await supabase
    .from('employees')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
  await insertAudit({
    userId: 'sys', userName: by,
    action: 'update', module: 'Employee',
    description: `Batch status → ${status} for ${ids.length} employee${ids.length !== 1 ? 's' : ''}`,
  })
  return { ok: ids.length, fail: 0 }
}

export async function apiBatchUpdateEmployeeShift(
  ids:     string[],
  shiftId: string,
  by = 'System',
): Promise<{ ok: number; fail: number }> {
  if (!ids.length) return { ok: 0, fail: 0 }
  const { error } = await supabase
    .from('employees')
    .update({ shift_id: shiftId || null, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
  await insertAudit({
    userId: 'sys', userName: by,
    action: 'update', module: 'Employee',
    description: `Batch shift assignment for ${ids.length} employee${ids.length !== 1 ? 's' : ''}`,
  })
  return { ok: ids.length, fail: 0 }
}

/** Returns a sorted list of department names from the departments table. */
export async function getDepartments(): Promise<string[]> {
  const { data } = await supabase.from('departments').select('name').order('name')
  return (data ?? []).map((d: { name: string }) => d.name)
}

/** Synchronous fallback (returns empty array — use getDepartments() for Supabase). */
export function getDepartmentsSync(): string[] { return [] }

// ── Public API: Departments ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDept = (r: any): Department => ({
  id: r.id, name: r.name, code: r.code ?? undefined,
  description: r.description ?? undefined, headName: r.head_name ?? undefined, createdAt: r.created_at,
})

export async function apiGetDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*').order('name')
  if (error) throw error
  return (data ?? []).map(toDept)
}
export async function apiCreateDepartment(data: Omit<Department, 'id' | 'createdAt'>): Promise<Department> {
  const { data: row, error } = await supabase.from('departments')
    .insert({ name: data.name, code: data.code, description: data.description, head_name: data.headName })
    .select().single()
  if (error || !row) throw error ?? new Error('Failed to create department')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'create', module: 'Settings', description: `Created department: ${data.name}` })
  return toDept(row)
}
export async function apiUpdateDepartment(id: string, data: Partial<Department>): Promise<Department> {
  const patch: Record<string, unknown> = {}
  if (data.name        !== undefined) patch.name      = data.name
  if (data.code        !== undefined) patch.code      = data.code
  if (data.description !== undefined) patch.description = data.description
  if (data.headName    !== undefined) patch.head_name = data.headName
  const { data: row, error } = await supabase.from('departments').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Department not found')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'update', module: 'Settings', description: `Updated department: ${row.name}` })
  return toDept(row)
}
export async function apiDeleteDepartment(id: string): Promise<void> {
  const { data: nameRow } = await supabase.from('departments').select('name').eq('id', id).single()
  const { data: deleted, error } = await supabase.from('departments').delete().eq('id', id).select('id')
  if (error) throw error
  if (!deleted?.length) throw new Error('Department not found or you do not have permission to delete it.')
  if (nameRow) await insertAudit({ userId: 'sys', userName: 'System', action: 'delete', module: 'Settings', description: `Deleted department: ${nameRow.name}` })
}

// ── Public API: Positions ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPosition = (r: any): Position => ({
  id: r.id, title: r.title, department: r.department ?? undefined,
  level: r.level ?? undefined, description: r.description ?? undefined, createdAt: r.created_at,
})

export async function apiGetPositions(): Promise<Position[]> {
  const { data, error } = await supabase.from('positions').select('*').order('title')
  if (error) throw error
  return (data ?? []).map(toPosition)
}
export async function apiCreatePosition(data: Omit<Position, 'id' | 'createdAt'>): Promise<Position> {
  const { data: row, error } = await supabase.from('positions')
    .insert({ title: data.title, department: data.department, level: data.level, description: data.description })
    .select().single()
  if (error || !row) throw error ?? new Error('Failed to create position')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'create', module: 'Settings', description: `Created position: ${data.title}` })
  return toPosition(row)
}
export async function apiUpdatePosition(id: string, data: Partial<Position>): Promise<Position> {
  const patch: Record<string, unknown> = {}
  if (data.title       !== undefined) patch.title      = data.title
  if (data.department  !== undefined) patch.department  = data.department
  if (data.level       !== undefined) patch.level       = data.level
  if (data.description !== undefined) patch.description = data.description
  const { data: row, error } = await supabase.from('positions').update(patch).eq('id', id).select().single()
  if (error || !row) throw error ?? new Error('Position not found')
  await insertAudit({ userId: 'sys', userName: 'System', action: 'update', module: 'Settings', description: `Updated position: ${row.title}` })
  return toPosition(row)
}
export async function apiDeletePosition(id: string): Promise<void> {
  const { data: nameRow } = await supabase.from('positions').select('title').eq('id', id).single()
  const { data: deleted, error } = await supabase.from('positions').delete().eq('id', id).select('id')
  if (error) throw error
  if (!deleted?.length) throw new Error('Position not found or you do not have permission to delete it.')
  if (nameRow) await insertAudit({ userId: 'sys', userName: 'System', action: 'delete', module: 'Settings', description: `Deleted position: ${nameRow.title}` })
}

// ── Leave Balances (used by employees) ────────────────────────────────────────
export async function apiGetLeaveBalances(employeeId?: string): Promise<LeaveBalance[]> {
  let query = supabase
    .from('leave_balances')
    .select('*, employees(full_name, employee_no, department)')
  if (employeeId) query = query.eq('employee_id', employeeId)
  const { data, error } = await query
  if (error) throw error
  type JoinedEmployee = { full_name: string; employee_no: string; department: string | null } | null
  return (data ?? []).map((r) => {
    const emp = r.employees as JoinedEmployee
    return {
      id:           r.id,
      employeeId:   r.employee_id,
      employeeName: emp?.full_name    ?? undefined,
      employeeNo:   emp?.employee_no  ?? undefined,
      department:   emp?.department   ?? undefined,
      year:         r.year,
      vacation:     r.vacation,
      sick:         r.sick,
      emergency:    r.emergency,
    }
  })
}
