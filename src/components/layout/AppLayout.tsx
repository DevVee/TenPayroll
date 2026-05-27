import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Toaster } from '../ui/Toaster'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { PageSkeleton } from '../ui/Skeleton'
import { useUIStore } from '../../store/uiStore'
import { ErrorBoundary } from '../ErrorBoundary'

export function AppLayout() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar collapsed={sidebarCollapsed} />
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300
          ${sidebarCollapsed ? 'ml-[64px]' : 'ml-[240px]'}`}
      >
        <TopBar onToggle={toggleSidebar} collapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1440px] mx-auto page-enter">
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
