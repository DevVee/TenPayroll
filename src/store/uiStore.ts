import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export interface ConfirmState {
  id: string
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  resolve: (value: boolean) => void
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void

  // Toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // Confirm dialog
  confirm: ConfirmState | null
  openConfirm: (state: Omit<ConfirmState, 'id'>) => void
  closeConfirm: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // ── Sidebar ──────────────────────────────────────────────────────────
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

      // ── Toasts ───────────────────────────────────────────────────────────
      toasts: [],
      addToast: (toast) => {
        const id = Math.random().toString(36).slice(2)
        set(s => ({ toasts: [...s.toasts, { ...toast, id }] }))
        const duration = toast.duration ?? 4000
        if (duration > 0) {
          setTimeout(() => get().removeToast(id), duration)
        }
      },
      removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

      // ── Confirm ──────────────────────────────────────────────────────────
      confirm: null,
      openConfirm: (state) => {
        const id = Math.random().toString(36).slice(2)
        set({ confirm: { ...state, id } })
      },
      closeConfirm: () => set({ confirm: null }),
    }),
    {
      name: 'veltrix-ui',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
