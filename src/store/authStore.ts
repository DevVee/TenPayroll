import { create } from 'zustand'
import type { HRUser } from '../types'
import { apiLogout } from '../lib/db'
import { getCurrentUserAsync } from '../lib/_db/auth'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: HRUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: HRUser) => void
  logout: () => void
  restoreSession: () => void
  /** Re-fetch the current user's profile from Supabase and update the store. */
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (user) => set({ user, isAuthenticated: true }),

  logout: () => {
    void apiLogout()
    set({ user: null, isAuthenticated: false })
  },

  refreshUser: async () => {
    const updated = await getCurrentUserAsync()
    if (updated) set({ user: updated })
  },

  restoreSession: () => {
    // Immediately check for an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        set({ isLoading: false })
        return
      }
      getCurrentUserAsync().then((user) => {
        if (user) set({ user, isAuthenticated: true, isLoading: false })
        else      set({ isLoading: false })
      })
    })

    // Listen for future auth state changes (sign-out from another tab, token refresh, etc.)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    })
  },
}))
