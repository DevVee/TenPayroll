import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { NavRail, SIDEBAR_W, SIDEBAR_CW } from './NavRail'
import { CommandBar } from './CommandBar'
import { Toaster } from '../ui/Toaster'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { PageSkeleton } from '../ui/Skeleton'
import { useUIStore } from '../../store/uiStore'
import { ErrorBoundary } from '../ErrorBoundary'

export function AppLayout() {
  const { sidebarCollapsed } = useUIStore()
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_CW : SIDEBAR_W

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* Fixed sidebar */}
      <NavRail />

      {/* Content column — shifts right to clear the sidebar */}
      <div
        className="flex flex-col flex-1 min-w-0 content-column"
        style={{
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <CommandBar />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1400px] mx-auto page-enter page-content">
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <Toaster />
      <ConfirmDialog />
    </div>
  )
}
