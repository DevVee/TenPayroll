// ─── Nav Badge Store — live counts shown on sidebar items ─────────────────────
// Refreshed every 60 s while the app is open so badges stay current without
// a full page reload. Each count is kept at 0 when unavailable (not logged in,
// request failed, etc.) so badge rendering is always safe.
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface NavBadges {
  pendingLeaves:    number   // leave_requests WHERE status = 'pending'
  pendingOT:        number   // overtime_requests WHERE status = 'pending'
  pendingPayrolls:  number   // payroll_periods WHERE status IN ('draft','reviewed')
  notScannedToday:  number   // active employees with no attendance record today
  totalEmployees:   number   // employees WHERE status = 'active'
}

interface NavState extends NavBadges {
  loading:  boolean
  refresh:  () => Promise<void>
  startPolling: () => () => void   // returns stop function
}

export const useNavStore = create<NavState>((set, get) => ({
  pendingLeaves:   0,
  pendingOT:       0,
  pendingPayrolls: 0,
  notScannedToday: 0,
  totalEmployees:  0,
  loading:         false,

  refresh: async () => {
    set({ loading: true })
    try {
      const today = new Date().toISOString().split('T')[0]

      const [leaves, ot, payrolls, activeEmps, scannedToday] = await Promise.allSettled([
        supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('payroll_periods')
          .select('id', { count: 'exact', head: true })
          .in('status', ['draft', 'reviewed']),
        supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('attendance_records')
          .select('employee_id', { count: 'exact', head: true })
          .eq('date', today),
      ])

      const totalActive = leaves.status === 'fulfilled' && activeEmps.status === 'fulfilled'
        ? (activeEmps.value.count ?? 0)
        : get().totalEmployees

      const scannedCount = scannedToday.status === 'fulfilled'
        ? (scannedToday.value.count ?? 0)
        : 0

      set({
        pendingLeaves:   leaves.status   === 'fulfilled' ? (leaves.value.count   ?? 0) : get().pendingLeaves,
        pendingOT:       ot.status       === 'fulfilled' ? (ot.value.count       ?? 0) : get().pendingOT,
        pendingPayrolls: payrolls.status === 'fulfilled' ? (payrolls.value.count ?? 0) : get().pendingPayrolls,
        totalEmployees:  totalActive,
        notScannedToday: Math.max(0, totalActive - scannedCount),
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  startPolling: () => {
    // Initial fetch
    get().refresh()
    // Poll every 60 s
    const interval = setInterval(() => { get().refresh() }, 60_000)
    return () => clearInterval(interval)
  },
}))
