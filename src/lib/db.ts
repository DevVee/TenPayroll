// ─── Supabase facade — same public API surface as the old localStorage version ─
// Every page/component imports from here; swap the _db/* modules to change backends.

// ── No-op seed (data lives in Supabase now) ───────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function seedIfNeeded() {}

// ── Auth ──────────────────────────────────────────────────────────────────────
export { apiLogin, getCurrentUserAsync, getToken, getCurrentUser } from './_db/auth'
import { apiLogout as _apiLogout } from './_db/auth'

/**
 * Sign out. Accepts an optional user arg for backward-compat with callers that
 * pass the current user object — the argument is silently ignored.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiLogout(_user?: any): Promise<void> { return _apiLogout() }

// ── Employees / Departments / Positions / Leave Balances ──────────────────────
export {
  apiGetEmployees,
  apiGetEmployee,
  apiCreateEmployee,
  apiUpdateEmployee,
  apiDeleteEmployee,
  // Async department name list (was sync in localStorage version)
  getDepartments,
  getDepartmentsSync,
  apiGetDepartments,
  apiCreateDepartment,
  apiUpdateDepartment,
  apiDeleteDepartment,
  apiGetPositions,
  apiCreatePosition,
  apiUpdatePosition,
  apiDeletePosition,
  apiGetLeaveBalances,
  apiGetSalaryHistory,
  apiBatchUpdateEmployeeStatus,
  apiBatchUpdateEmployeeShift,
} from './_db/employees'

// ── Attendance ────────────────────────────────────────────────────────────────
export {
  apiGetAttendance,
  apiGetTodayAttendance,
  apiGetAttendanceHistory,
  apiUpsertAttendance,
  apiCorrectAttendance,
  apiAddManualAttendance,
  apiVoidAttendance,
  apiGetTodayHoliday,
  apiGetTodaySpecialWorkingHoliday,
  apiKioskPIN,
  apiKioskRFID,
  computeNightDiffMinutes,
  apiGetAttendanceExceptions,
} from './_db/attendance'

// ── Payroll ───────────────────────────────────────────────────────────────────
export {
  apiGetPayrollPeriods,
  apiGetPayrollPeriod,
  apiCreatePayrollPeriod,
  apiUpdatePayrollStatus,
  apiBatchUpdatePayrollStatus,
  apiReopenPayroll,
  apiDeletePayrollPeriod,
  apiGenerate13thMonth,
  apiGetPayrollEntries,
  apiGetPayrollEntry,
  apiMarkEntryPaid,
  apiUpdatePayrollEntryDeductions,
  apiPayrollSummaryByMonth,
} from './_db/payroll'

// ── Leaves ────────────────────────────────────────────────────────────────────
export {
  apiGetLeaves,
  apiCreateLeave,
  apiUpdateLeaveStatus,
  apiBatchUpdateLeaveStatus,
  apiAccrueSIL,
} from './_db/leaves'

// ── Overtime ──────────────────────────────────────────────────────────────────
export {
  apiGetOvertime,
  apiCreateOvertime,
  apiUpdateOvertimeStatus,
  apiBatchUpdateOvertimeStatus,
} from './_db/overtime'

// ── Schedules (shifts + holidays) ────────────────────────────────────────────
export {
  apiGetShifts,
  apiCreateShift,
  apiUpdateShift,
  apiDeleteShift,
  apiGetHolidays,
  apiCreateHoliday,
  apiUpdateHoliday,
  apiDeleteHoliday,
} from './_db/schedules'

// ── Settings ──────────────────────────────────────────────────────────────────
export {
  // Sync accessors (return cached defaults immediately)
  getCompanySettings,
  saveCompanySettings,
  getDeductionSettings,
  saveDeductionSettings,
  getGovtConfig,
  saveGovtConfig,
  // Async loaders (fetch from Supabase)
  loadCompanySettings,
  loadDeductionSettings,
  loadGovtConfig,
  loadAllSettings,
  apiSaveCompanySettings,
  apiSaveDeductionSettings,
  apiSaveGovtConfig,
  DEFAULT_GOVT_CONFIG,
  DEFAULT_SSS_BRACKETS,
  DEFAULT_TAX_BRACKETS,
} from './_db/settings'

// ── Salary Advances ───────────────────────────────────────────────────────────
export {
  apiGetAdvances,
  apiGetAdvance,
  apiCreateAdvance,
  apiUpdateAdvanceStatus,
  apiBatchUpdateAdvanceStatus,
  apiCancelAdvance,
  apiWriteOffAdvance,
  apiSuspendAdvance,
  apiResumeAdvance,
  apiUpdateAdvanceDeduction,
  apiAdjustAdvanceBalance,
  apiRecordRepayment,
  apiGetRepayments,
  getActiveAdvanceDeductions,
} from './_db/advances'

// ── Audit ─────────────────────────────────────────────────────────────────────
export { apiGetAuditLogs } from './_db/audit'

// ── Component Templates (global catalog — copied to employees on apply) ───────
// The Settings "Component Templates" tab writes here.
// EmployeeForm reads this catalog to offer "From Template" quick-fill.
// Employee copies are independent after apply — template changes don't propagate.
export {
  getPayrollComponents,
  loadPayrollComponents,
  apiCreatePayrollComponent,
  apiUpdatePayrollComponent,
  apiDeletePayrollComponent,
  apiTogglePayrollComponent,
  apiReorderPayrollComponents,
} from './_db/payrollComponents'
