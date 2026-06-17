import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { AppLayout } from './components/layout/AppLayout'
import { usePermission } from './lib/permissions'
import type { UserPermissions } from './types'

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  5 * 60 * 1000,   // 5 min
      gcTime:     10 * 60 * 1000,  // 10 min
      retry:      1,
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Landing        = lazy(() => import('./pages/landing/Landing').then(m => ({ default: m.Landing })))
const Login          = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const ResetPassword  = lazy(() => import('./pages/auth/ResetPassword').then(m => ({ default: m.ResetPassword })))
const Kiosk          = lazy(() => import('./pages/kiosk/Kiosk').then(m => ({ default: m.Kiosk })))
const Dashboard      = lazy(() => import('./pages/dashboard/Dashboard').then(m => ({ default: m.Dashboard })))
const EmployeeList   = lazy(() => import('./pages/employees/EmployeeList').then(m => ({ default: m.EmployeeList })))
const EmployeeProfile= lazy(() => import('./pages/employees/EmployeeProfile').then(m => ({ default: m.EmployeeProfile })))
const EmployeeForm   = lazy(() => import('./pages/employees/EmployeeForm').then(m => ({ default: m.EmployeeForm })))
const AttendanceToday= lazy(() => import('./pages/attendance/AttendanceToday').then(m => ({ default: m.AttendanceToday })))
const AttendanceLog  = lazy(() => import('./pages/attendance/AttendanceLog').then(m => ({ default: m.AttendanceLog })))
const PayrollList    = lazy(() => import('./pages/payroll/PayrollList').then(m => ({ default: m.PayrollList })))
const PayrollDetail  = lazy(() => import('./pages/payroll/PayrollDetail').then(m => ({ default: m.PayrollDetail })))
const Payslip        = lazy(() => import('./pages/payroll/Payslip').then(m => ({ default: m.Payslip })))
const LeaveList      = lazy(() => import('./pages/leaves/LeaveList').then(m => ({ default: m.LeaveList })))
const OvertimeList   = lazy(() => import('./pages/overtime/OvertimeList').then(m => ({ default: m.OvertimeList })))
const ShiftList      = lazy(() => import('./pages/schedules/ShiftList').then(m => ({ default: m.ShiftList })))
const HolidayList    = lazy(() => import('./pages/schedules/HolidayList').then(m => ({ default: m.HolidayList })))
const AdvanceList    = lazy(() => import('./pages/advances/AdvanceList').then(m => ({ default: m.AdvanceList })))
const Reports        = lazy(() => import('./pages/reports/Reports').then(m => ({ default: m.Reports })))
const Settings          = lazy(() => import('./pages/settings/Settings').then(m => ({ default: m.Settings })))
const UserManagement    = lazy(() => import('./pages/settings/UserManagement').then(m => ({ default: m.UserManagement })))
const AuditLog          = lazy(() => import('./pages/audit/AuditLog').then(m => ({ default: m.AuditLog })))
const MyAccount         = lazy(() => import('./pages/account/MyAccount').then(m => ({ default: m.MyAccount })))
const NotFound          = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })))

// ─── Auth guard ───────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user      = useAuthStore(s => s.user)
  const isLoading = useAuthStore(s => s.isLoading)

  // Wait for session restore before making a routing decision — prevents login flash
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2.5 }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ─── Permission gate — redirects to /dashboard when user lacks a permission ──
function PermissionGate({
  perm, children,
}: {
  perm: keyof UserPermissions
  children: React.ReactNode
}) {
  const ok = usePermission(perm)
  return ok ? <>{children}</> : <Navigate to="/dashboard" replace />
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="spinner" /></div>}>
          <Routes>
            {/* ── Public ── */}
            <Route path="/"                element={<Landing />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/kiosk"           element={<Kiosk />} />

            {/* ── Protected app — pathless layout route ── */}
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Employees */}
              <Route path="/employees"          element={<PermissionGate perm="emp_view"><EmployeeList /></PermissionGate>} />
              <Route path="/employees/new"      element={<PermissionGate perm="emp_create"><EmployeeForm /></PermissionGate>} />
              <Route path="/employees/:id"      element={<PermissionGate perm="emp_view"><EmployeeProfile /></PermissionGate>} />
              <Route path="/employees/:id/edit" element={<PermissionGate perm="emp_edit"><EmployeeForm /></PermissionGate>} />

              {/* Attendance */}
              <Route path="/attendance"     element={<PermissionGate perm="att_view"><AttendanceToday /></PermissionGate>} />
              <Route path="/attendance/log" element={<PermissionGate perm="att_view"><AttendanceLog /></PermissionGate>} />

              {/* Payroll */}
              <Route path="/payroll"                               element={<PermissionGate perm="pay_view"><PayrollList /></PermissionGate>} />
              <Route path="/payroll/:id"                           element={<PermissionGate perm="pay_view"><PayrollDetail /></PermissionGate>} />
              <Route path="/payroll/:periodId/payslip/:employeeId" element={<PermissionGate perm="pay_view"><Payslip /></PermissionGate>} />

              {/* Leaves & OT */}
              <Route path="/leaves"   element={<PermissionGate perm="leave_view"><LeaveList /></PermissionGate>} />
              <Route path="/overtime" element={<PermissionGate perm="ot_view"><OvertimeList /></PermissionGate>} />

              {/* Salary Advances */}
              <Route path="/advances" element={<PermissionGate perm="pay_view"><AdvanceList /></PermissionGate>} />

              {/* Schedules */}
              <Route path="/schedules/shifts"   element={<PermissionGate perm="settings_view"><ShiftList /></PermissionGate>} />
              <Route path="/schedules/holidays" element={<PermissionGate perm="settings_view"><HolidayList /></PermissionGate>} />

              {/* Reports / Settings / Users / Audit */}
              <Route path="/reports"   element={<PermissionGate perm="reports_view"><Reports /></PermissionGate>} />
              <Route path="/settings"  element={<PermissionGate perm="settings_view"><Settings /></PermissionGate>} />
              <Route path="/users"     element={<PermissionGate perm="users_view"><UserManagement /></PermissionGate>} />
              <Route path="/audit-log" element={<PermissionGate perm="settings_view"><AuditLog /></PermissionGate>} />

              {/* My Account — available to every authenticated user */}
              <Route path="/account" element={<MyAccount />} />
            </Route>

            {/* Catch-all → 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
