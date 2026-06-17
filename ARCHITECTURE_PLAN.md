# TenPayroll → Veltrix SaaS
# Full Architectural Review & Modernization Plan
**Date:** 2026-05-27 | **Author:** DevVee + Claude Sonnet 4.6  
**Branch snapshot:** `dcea033` (pre-overhaul backup)

---

## TABLE OF CONTENTS

1. [Current State Audit](#1-current-state-audit)
2. [Architecture Findings & Gaps](#2-architecture-findings--gaps)
3. [Target Architecture Overview](#3-target-architecture-overview)
4. [White-Label / Config-Driven System](#4-white-label--config-driven-system)
5. [Frontend Architecture Plan](#5-frontend-architecture-plan)
6. [Component Library Plan](#6-component-library-plan)
7. [State Management Plan](#7-state-management-plan)
8. [Routing & Auth Plan](#8-routing--auth-plan)
9. [UI/UX Redesign Plan](#9-uiux-redesign-plan)
10. [Kiosk System Architecture](#10-kiosk-system-architecture)
11. [Backend Architecture (Supabase + Vercel)](#11-backend-architecture-supabase--vercel)
12. [Database Schema](#12-database-schema)
13. [RBAC Permission System](#13-rbac-permission-system)
14. [Implementation Roadmap](#14-implementation-roadmap)

---

## 1. CURRENT STATE AUDIT

### 1.1 Tech Stack
| Layer | Current | Rating |
|---|---|---|
| Framework | React 19 + Vite 6 | ✅ Good |
| Language | TypeScript 5.6 | ✅ Good |
| Routing | React Router v7 | ✅ Good |
| State | Zustand 5 | ✅ Good |
| Styling | Tailwind CSS 3.4 | ✅ Good |
| Animation | Framer Motion 12 | ✅ Good |
| Charts | Recharts 2.13 | ✅ Good |
| Data | localStorage (demo) | ⚠️ Prototype only |
| Backend | None (all client-side) | ❌ Not production-ready |
| Auth | Demo tokens in localStorage | ❌ Not secure |
| Database | None (seed data only) | ❌ No persistence |

### 1.2 Folder Structure (Current)
```
src/
  App.tsx                    ← monolithic routing
  main.tsx
  index.css
  types/index.ts             ← all types in one file
  lib/
    db.ts                    ← 870-line monolith (seed + CRUD + auth + business logic)
    payrollEngine.ts
  store/
    authStore.ts             ← only one store
  hooks/
    useData.ts
  components/
    layout/
      AppLayout.tsx
      Sidebar.tsx            ← hardcoded branding, colors, NAV items
      TopBar.tsx
      AuthLayout.tsx
    ui/                      ← growing but inconsistent
      Badge.tsx, Modal.tsx, EmptyState.tsx, PageHeader.tsx,
      StatCard.tsx, KPICard.tsx, SearchInput.tsx, StatusBadge.tsx,
      ActionIconBtn.tsx, ProgressStepper.tsx
  pages/
    auth/, dashboard/, employees/, attendance/,
    payroll/, leaves/, overtime/, schedules/,
    reports/, settings/, audit/, kiosk/, landing/
```

### 1.3 What's Good
- TypeScript types are comprehensive and well-structured
- Zustand chosen correctly for state management
- React Router v7 usage is clean
- Payroll engine is a separate module (good separation)
- Framer Motion is already integrated
- Component UI primitives are starting to emerge
- Seed data is realistic (Philippine context)

### 1.4 Critical Problems Found

#### DATA LAYER
- **`db.ts` is 870 lines** — mixes seed, auth, CRUD, business logic, and helpers
- **localStorage only** — no real database, no sync, no persistence across devices
- **No optimistic updates**, no loading state management
- **No query invalidation** — stale data everywhere
- **Hardcoded passwords** in plain text: `DEMO_PW` object

#### BRANDING / WHITE-LABEL
- `"TenPayroll"` hardcoded in `Sidebar.tsx` line 178
- `"/Veltrix.png"` logo path hardcoded in Sidebar
- `SB` color palette object hardcoded directly in Sidebar
- `ACME Corporation Philippines` hardcoded in seed data
- `acme.ph` domain hardcoded in emails, TINs
- Role colors hardcoded as hex strings
- Active nav color `#4F46E5` hardcoded in 5+ places
- Font sizes, spacing, border radius all inline styles, no design tokens

#### STATE MANAGEMENT
- Only 1 Zustand store (`authStore`) — all other data fetched imperatively
- No global data stores for employees, attendance, payroll etc.
- No caching layer — every page re-fetches on mount
- No error boundary / global error state
- No loading skeleton system

#### COMPONENT ISSUES
- Sidebar uses `onMouseEnter/onMouseLeave` for hover states instead of Tailwind/CSS
- Massive inline style objects repeated throughout (violates DRY)
- No shared table component — every page builds its own table from scratch
- No shared form component — every form duplicated
- No toast/notification system
- No confirmation dialog system
- No loading skeleton components
- `Modal.tsx` exists but not consistently used

#### AUTHENTICATION
- Token is literally the string `"demo-token"` in localStorage
- No JWT, no expiry, no refresh
- No RBAC enforcement at route level (only filtered nav)
- Kiosk has no auth at all

#### ROUTING
- No lazy loading (all pages eagerly imported in App.tsx)
- No route-level code splitting
- No 404 page
- No unauthorized access page
- Deep links don't work after refresh (SPA issue)

#### PERFORMANCE
- All 870 lines of db.ts loaded on every page
- No memoization strategy
- No virtual scrolling for large lists
- No pagination (loads all records)
- Chart data computed on every render

#### KIOSK
- Kiosk is just a web page route `/kiosk` inside the main app
- No offline support
- No sync mechanism
- No queue/retry
- Not separated from the main app

---

## 2. ARCHITECTURE FINDINGS & GAPS

### Gap 1: Monolithic Data Layer
`db.ts` does too much. It needs to be split into:
- `lib/storage/` — raw localStorage adapters
- `services/` — one file per module (employees, attendance, payroll, etc.)
- `lib/payroll/` — payroll engine (already separate, just needs better structure)

### Gap 2: No Theme System
Colors are hardcoded everywhere. Need:
- CSS custom properties (design tokens)
- A `brandConfig.ts` that maps semantic tokens to actual values
- Tailwind config that reads from those tokens

### Gap 3: No Shared Component System
Every page builds its own table, its own filter bar, its own form sections. Need:
- `DataTable` component (sortable, filterable, paginated)
- `FormField` + `FormSection` components
- `FilterBar` component
- `PageShell` component (consistent page wrapper)

### Gap 4: No Backend
For enterprise/white-label SaaS, need real backend. Plan: **Supabase + Vercel**.

### Gap 5: Kiosk Not Separate
Kiosk must be a completely separate Electron app with its own:
- Offline queue (IndexedDB)
- Sync engine
- Device registration
- Auth token management

---

## 3. TARGET ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        VELTRIX PLATFORM                         │
├───────────────┬─────────────────────────┬───────────────────────┤
│   Web App     │    Kiosk App (Electron)  │   Admin/Config Portal  │
│  (Vercel)     │    (Windows/Linux)       │   (future)            │
├───────────────┴─────────────────────────┴───────────────────────┤
│                     API LAYER (Vercel Edge Functions)            │
│          /api/v1/employees  /api/v1/attendance  etc.            │
├─────────────────────────────────────────────────────────────────┤
│                     SUPABASE BACKEND                            │
│   Auth │ PostgreSQL │ Storage │ Realtime │ Edge Functions        │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Tenant / White-Label Strategy
```
Client A (Acme Corp)     →  veltrix.app/acme or acme.veltrix.app
Client B (XYZ Holdings)  →  veltrix.app/xyz  or xyz.veltrix.app
Client C (Custom)        →  payroll.client-c.com  (CNAME)

Each tenant has:
- Own brand config (name, logo, colors, modules enabled)
- Isolated data (Row Level Security in Supabase)
- Shared codebase (white-label architecture)
- Independent settings/customization
```

---

## 4. WHITE-LABEL / CONFIG-DRIVEN SYSTEM

### 4.1 Brand Config File
Create `src/config/brand.ts`:
```typescript
export interface BrandConfig {
  // Identity
  appName: string            // "TenPayroll" or "Veltrix" or "ACME HRis"
  appTagline: string
  logoUrl: string
  faviconUrl: string

  // Company (pre-filled defaults, override in settings)
  defaultCompanyName: string

  // Theme
  theme: ThemeConfig

  // Modules
  modules: ModuleConfig

  // Locale / region
  country: 'PH' | 'US' | 'SG' | string
  currency: string
  dateFormat: string
  timezone: string

  // Features
  features: FeatureFlags
}

export interface ThemeConfig {
  mode: 'dark' | 'light' | 'system'
  primary: string        // #4F46E5
  primaryLight: string   // #A5B4FC
  sidebar: {
    bg: string
    border: string
    text: string
    activeAccent: string
  }
  surface: string
  background: string
  border: string
  text: {
    primary: string
    secondary: string
    muted: string
  }
  radius: {
    sm: string   // 6px
    md: string   // 8px
    lg: string   // 12px
    xl: string   // 16px
  }
  font: {
    sans: string
    mono: string
  }
}

export interface ModuleConfig {
  employees: boolean
  attendance: boolean
  payroll: boolean
  leaves: boolean
  overtime: boolean
  schedules: boolean
  reports: boolean
  audit: boolean
  kiosk: boolean
}

export interface FeatureFlags {
  rfidKiosk: boolean
  pinKiosk: boolean
  faceRecognition: boolean
  multiCurrency: boolean
  advancedReports: boolean
  apiAccess: boolean
}
```

### 4.2 CSS Design Token System
Create `src/styles/tokens.css`:
```css
:root {
  /* Brand */
  --color-primary: 79 70 229;        /* indigo-600 */
  --color-primary-light: 165 180 252; /* indigo-300 */

  /* Sidebar */
  --sidebar-bg: 13 14 20;
  --sidebar-border: rgba(255,255,255,0.06);
  --sidebar-text: 148 163 184;       /* slate-400 */
  --sidebar-text-active: 226 232 240;/* slate-200 */
  --sidebar-accent: 79 70 229;       /* indigo-600 */

  /* Surface */
  --color-bg: 248 250 252;           /* slate-50 */
  --color-surface: 255 255 255;
  --color-border: 226 232 240;       /* slate-200 */

  /* Text */
  --text-primary: 15 23 42;         /* slate-900 */
  --text-secondary: 71 85 105;      /* slate-600 */
  --text-muted: 148 163 184;        /* slate-400 */

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.10);
}

[data-theme="dark"] {
  --color-bg: 10 10 15;
  --color-surface: 17 24 39;
  --color-border: 31 41 55;
  --text-primary: 248 250 252;
  --text-secondary: 203 213 225;
  --text-muted: 100 116 139;
}
```

### 4.3 Tailwind Design Token Integration
Update `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      primary: 'rgb(var(--color-primary) / <alpha-value>)',
      'primary-light': 'rgb(var(--color-primary-light) / <alpha-value>)',
      surface: 'rgb(var(--color-surface) / <alpha-value>)',
      border: 'rgb(var(--color-border) / <alpha-value>)',
    }
  }
}
```

---

## 5. FRONTEND ARCHITECTURE PLAN

### 5.1 New Folder Structure
```
src/
  ├── config/
  │   ├── brand.ts          ← BrandConfig singleton
  │   ├── modules.ts        ← ModuleConfig
  │   ├── routes.ts         ← Route definitions (config-driven)
  │   └── nav.ts            ← Nav items (config-driven, role-aware)
  │
  ├── styles/
  │   ├── tokens.css        ← CSS custom properties
  │   ├── globals.css       ← base styles
  │   └── animations.css    ← reusable keyframes
  │
  ├── types/
  │   ├── index.ts          ← re-export barrel
  │   ├── employee.ts
  │   ├── attendance.ts
  │   ├── payroll.ts
  │   ├── leaves.ts
  │   ├── overtime.ts
  │   ├── auth.ts
  │   ├── settings.ts
  │   └── common.ts
  │
  ├── lib/
  │   ├── api/              ← API client (fetch wrappers)
  │   │   ├── client.ts     ← base axios/fetch config
  │   │   ├── employees.ts
  │   │   ├── attendance.ts
  │   │   ├── payroll.ts
  │   │   ├── leaves.ts
  │   │   ├── overtime.ts
  │   │   ├── auth.ts
  │   │   └── settings.ts
  │   ├── storage/          ← localStorage adapters (offline fallback)
  │   │   └── adapter.ts
  │   ├── payroll/
  │   │   ├── engine.ts
  │   │   ├── deductions.ts
  │   │   └── computations.ts
  │   ├── utils/
  │   │   ├── date.ts
  │   │   ├── format.ts
  │   │   ├── validation.ts
  │   │   └── helpers.ts
  │   └── hooks/            ← shared hooks
  │       ├── useDebounce.ts
  │       ├── usePagination.ts
  │       ├── useConfirm.ts
  │       ├── useToast.ts
  │       └── useTheme.ts
  │
  ├── store/
  │   ├── authStore.ts
  │   ├── employeeStore.ts
  │   ├── attendanceStore.ts
  │   ├── payrollStore.ts
  │   ├── uiStore.ts        ← sidebar collapsed, theme, modals
  │   └── syncStore.ts      ← kiosk sync state
  │
  ├── components/
  │   ├── layout/
  │   │   ├── AppLayout.tsx
  │   │   ├── Sidebar/
  │   │   │   ├── Sidebar.tsx
  │   │   │   ├── NavItem.tsx
  │   │   │   ├── NavSection.tsx
  │   │   │   └── UserPanel.tsx
  │   │   ├── TopBar/
  │   │   │   ├── TopBar.tsx
  │   │   │   ├── NotificationBell.tsx
  │   │   │   └── UserMenu.tsx
  │   │   └── AuthLayout.tsx
  │   │
  │   ├── ui/               ← Pure presentational primitives
  │   │   ├── Button.tsx
  │   │   ├── Input.tsx
  │   │   ├── Select.tsx
  │   │   ├── Textarea.tsx
  │   │   ├── Checkbox.tsx
  │   │   ├── Badge.tsx
  │   │   ├── StatusBadge.tsx
  │   │   ├── Avatar.tsx
  │   │   ├── Modal.tsx
  │   │   ├── ConfirmDialog.tsx
  │   │   ├── Toast.tsx / Toaster.tsx
  │   │   ├── Tooltip.tsx
  │   │   ├── Dropdown.tsx
  │   │   ├── Tabs.tsx
  │   │   ├── Skeleton.tsx
  │   │   ├── Spinner.tsx
  │   │   ├── EmptyState.tsx
  │   │   ├── ErrorState.tsx
  │   │   ├── PageHeader.tsx
  │   │   ├── Card.tsx
  │   │   ├── Divider.tsx
  │   │   └── index.ts      ← barrel export
  │   │
  │   ├── data/             ← Data display components
  │   │   ├── DataTable/
  │   │   │   ├── DataTable.tsx    ← Universal table
  │   │   │   ├── TableHeader.tsx
  │   │   │   ├── TableRow.tsx
  │   │   │   ├── TablePagination.tsx
  │   │   │   └── types.ts
  │   │   ├── FilterBar.tsx
  │   │   ├── SearchInput.tsx
  │   │   ├── SortButton.tsx
  │   │   └── ExportButton.tsx
  │   │
  │   ├── form/             ← Form system
  │   │   ├── Form.tsx
  │   │   ├── FormField.tsx
  │   │   ├── FormSection.tsx
  │   │   ├── FormActions.tsx
  │   │   └── validators.ts
  │   │
  │   ├── dashboard/        ← Dashboard-specific widgets
  │   │   ├── KPICard.tsx
  │   │   ├── KPIGrid.tsx
  │   │   ├── ActivityFeed.tsx
  │   │   ├── QuickActions.tsx
  │   │   └── ChartCard.tsx
  │   │
  │   └── shared/           ← Domain-specific shared components
  │       ├── EmployeePicker.tsx
  │       ├── DepartmentPicker.tsx
  │       ├── StatusFlow.tsx
  │       ├── PayPeriodBadge.tsx
  │       └── AuditEntry.tsx
  │
  ├── pages/
  │   ├── auth/
  │   │   ├── Login.tsx
  │   │   └── ForgotPassword.tsx
  │   ├── landing/
  │   │   └── Landing.tsx
  │   ├── dashboard/
  │   │   └── Dashboard.tsx
  │   ├── employees/
  │   │   ├── EmployeeList.tsx
  │   │   ├── EmployeeProfile.tsx
  │   │   └── EmployeeForm.tsx
  │   ├── attendance/
  │   ├── payroll/
  │   ├── leaves/
  │   ├── overtime/
  │   ├── schedules/
  │   ├── reports/
  │   ├── settings/
  │   └── audit/
  │
  └── App.tsx               ← lazy-loaded routes, providers
```

### 5.2 Code Splitting Strategy
```typescript
// App.tsx — all pages lazy loaded
const Dashboard     = lazy(() => import('./pages/dashboard/Dashboard'))
const EmployeeList  = lazy(() => import('./pages/employees/EmployeeList'))
// ... etc.

// Wrap with Suspense + Skeleton
<Suspense fallback={<PageSkeleton />}>
  <Routes>...</Routes>
</Suspense>
```

---

## 6. COMPONENT LIBRARY PLAN

### 6.1 DataTable (Universal Table Component)
```typescript
interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  empty?: { title: string; description: string; action?: React.ReactNode }
  pagination?: { page: number; pageSize: number; total: number; onChange: (page: number) => void }
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  actions?: (row: T) => React.ReactNode
  zebra?: boolean
  stickyHeader?: boolean
}
```

### 6.2 Form System
```typescript
// FormField wraps any input with label, error, hint
<FormField
  label="Employee Name"
  required
  error={errors.fullName}
  hint="Enter the employee's full legal name"
>
  <Input {...register('fullName')} />
</FormField>

// FormSection groups related fields
<FormSection title="Personal Information" icon={User}>
  <FormGrid cols={2}>
    <FormField label="First Name">...</FormField>
    <FormField label="Last Name">...</FormField>
  </FormGrid>
</FormSection>
```

### 6.3 Toast System
```typescript
// Usage anywhere in the app
const { toast } = useToast()
toast.success('Employee created successfully')
toast.error('Failed to save changes')
toast.warning('Duplicate PIN detected')
toast.info('Syncing attendance records...')
```

### 6.4 Confirm Dialog
```typescript
const { confirm } = useConfirm()
const proceed = await confirm({
  title: 'Delete Employee',
  description: 'This action cannot be undone.',
  confirmLabel: 'Delete',
  variant: 'destructive',
})
if (proceed) { await deleteEmployee(id) }
```

### 6.5 Skeleton System
```typescript
// Every data-heavy page has a skeleton version
<Suspense fallback={<EmployeeListSkeleton />}>
  <EmployeeList />
</Suspense>

// Skeleton primitives
<Skeleton className="h-4 w-48" />          // text line
<Skeleton className="h-10 w-full" />       // input
<Skeleton className="h-40 w-full" />       // card
<SkeletonTable rows={5} cols={6} />        // table
```

---

## 7. STATE MANAGEMENT PLAN

### 7.1 Store Architecture

**authStore** — user session, login/logout, role
```typescript
interface AuthState {
  user: HRUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  permissions: Permission[]  // derived from role
}
```

**uiStore** — UI state (sidebar, theme, modals)
```typescript
interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark' | 'system'
  activeModal: string | null
  toasts: Toast[]
  confirmDialog: ConfirmDialogState | null
}
```

**employeeStore** — employee data with cache
```typescript
interface EmployeeState {
  employees: Employee[]
  isLoading: boolean
  error: string | null
  filters: EmployeeFilters
  pagination: PaginationState
  fetch: () => Promise<void>
  invalidate: () => void
}
```

**payrollStore** — payroll periods and entries
**attendanceStore** — today's attendance + filters
**notificationStore** — real-time notifications (Supabase Realtime)

### 7.2 Data Fetching Strategy
Use **TanStack Query (React Query)** for server state management:
```typescript
// Each entity has its own query hooks
export function useEmployees(filters?: EmployeeFilters) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: () => employeeService.list(filters),
    staleTime: 5 * 60 * 1000,  // 5 min cache
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: employeeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee created successfully')
    },
  })
}
```

**Recommendation:** Add `@tanstack/react-query` to the stack.

---

## 8. ROUTING & AUTH PLAN

### 8.1 Route Configuration (Config-Driven)
```typescript
// src/config/routes.ts
export const ROUTES: RouteConfig[] = [
  {
    path: '/dashboard',
    component: 'Dashboard',
    module: 'dashboard',
    roles: ['super-admin', 'hr-admin', 'payroll-officer', 'dept-head'],
    icon: 'LayoutDashboard',
    navSection: 'OVERVIEW',
    navLabel: 'Dashboard',
  },
  // ... all routes defined as data, not JSX
]
```

### 8.2 Protected Route System
```typescript
// Proper RBAC at route level
function ProtectedRoute({ module, roles, children }) {
  const { user, permissions } = useAuthStore()

  if (!user) return <Navigate to="/login" />
  if (!permissions.canAccess(module)) return <Forbidden />
  if (roles && !roles.includes(user.role)) return <Forbidden />

  return children
}
```

### 8.3 Auth Flow (With Supabase)
```
1. User visits /login
2. Supabase email+password auth
3. JWT returned → stored in memory (NOT localStorage)
4. Refresh token in httpOnly cookie
5. On refresh: cookie → new JWT → continue session
6. Token auto-refreshes every 55 min
7. On logout: revoke refresh token
```

---

## 9. UI/UX REDESIGN PLAN

### 9.1 Design System
**Typography:**
- Font: `Inter` (body) + `JetBrains Mono` (code/numbers)
- Scale: 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36px

**Color System (Light Mode):**
- Background: `#F8FAFC` (slate-50)
- Surface: `#FFFFFF`
- Border: `#E2E8F0` (slate-200)
- Primary: `#4F46E5` (indigo-600)
- Success: `#059669` (emerald-600)
- Warning: `#D97706` (amber-600)
- Danger: `#DC2626` (red-600)
- Info: `#0891B2` (cyan-600)

**Sidebar (Dark):**
- BG: `#0D0E14`
- Accent: `#4F46E5`
- Border: `rgba(255,255,255,0.06)`

### 9.2 Key Page Redesigns

**Login Page:**
- Split layout: left = brand hero, right = form
- Animated gradient background (left side)
- Clean card with logo, welcome text
- Role selector for demo mode
- "Remember me" option

**Dashboard:**
- 4 KPI cards row (employees, present today, pending leaves, pending payroll)
- Attendance trend chart (area chart, last 30 days)
- Recent activity feed (right column)
- Quick action buttons (generate payroll, add employee, etc.)
- Department distribution (pie/donut chart)
- Pending approvals widget

**Employee List:**
- Toolbar: search + department filter + status filter + add button
- Grid/List toggle view
- Card view: avatar, name, position, department, status badge
- List view: DataTable with all columns
- Bulk actions: export, change status

**Payroll:**
- Progress stepper at top (Draft → Reviewed → Approved → Paid)
- Summary cards per period
- Searchable employee list within period
- Per-employee payslip modal (print-ready)

**Attendance Today:**
- Real-time clock at top
- Status summary cards (present/absent/late/on-leave)
- Employee grid with status indicators
- Live update via Supabase Realtime (future)
- Manual log modal

**Kiosk (Web Demo):**
- Full-screen dark mode
- Large clock display
- PIN pad / RFID scan area
- Success/error feedback with animation
- Recent check-ins list

### 9.3 Microinteractions & Animations
- Page transitions: fade + slight upward slide (100ms)
- Sidebar collapse: smooth width transition
- Table rows: hover highlight
- Modal: scale in from center
- Toast: slide in from top-right, auto-dismiss
- KPI cards: count-up animation on mount
- Status badges: subtle pulse on "syncing"
- Loading states: skeleton shimmer
- Form validation: shake on error, checkmark on success

### 9.4 Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation for modals and dropdowns
- Focus trap in modals
- Color contrast ≥ 4.5:1 for all text
- `role="alert"` for toast notifications
- Screen reader announcements for status changes

---

## 10. KIOSK SYSTEM ARCHITECTURE

### 10.1 Overview
The kiosk is a **separate Electron application**, NOT a web page inside the main app.

```
┌────────────────────────────────────────────────────┐
│            VELTRIX KIOSK (Electron App)            │
├────────────────────────────────────────────────────┤
│  Renderer Process (React + Tailwind)               │
│  ├── Clock Display                                 │
│  ├── Auth Mode Selector (PIN / RFID / Face)        │
│  ├── PIN Pad Component                             │
│  ├── RFID Scanner (USB HID listener)               │
│  ├── Success / Error Feedback Screen               │
│  ├── Recent Check-ins Feed                         │
│  └── Sync Status Indicator                         │
├────────────────────────────────────────────────────┤
│  Main Process (Node.js)                            │
│  ├── Device Registration                           │
│  ├── USB HID / Serial Port (RFID)                  │
│  ├── SQLite (offline queue via better-sqlite3)     │
│  ├── Sync Engine                                   │
│  │   ├── Online check (interval ping)              │
│  │   ├── Queue flusher                             │
│  │   ├── Retry logic (exponential backoff)         │
│  │   └── Conflict resolver                         │
│  └── Auto-updater (Squirrel/NSIS)                  │
├────────────────────────────────────────────────────┤
│  IPC Bridge (contextBridge / ipcMain/ipcRenderer)  │
└────────────────────────────────────────────────────┘
```

### 10.2 Kiosk Folder Structure
```
kiosk/
  ├── package.json          ← Electron + React + SQLite deps
  ├── electron.config.ts    ← Electron builder config
  ├── src/
  │   ├── main/
  │   │   ├── index.ts      ← Electron main process entry
  │   │   ├── device.ts     ← Device registration + ID
  │   │   ├── rfid.ts       ← USB HID reader
  │   │   ├── db.ts         ← SQLite setup (better-sqlite3)
  │   │   ├── sync/
  │   │   │   ├── engine.ts       ← Sync orchestrator
  │   │   │   ├── queue.ts        ← Offline queue
  │   │   │   ├── flusher.ts      ← Batch flush to server
  │   │   │   ├── retry.ts        ← Exponential backoff
  │   │   │   └── conflict.ts     ← Conflict resolution
  │   │   └── ipc/
  │   │       ├── handlers.ts     ← ipcMain handlers
  │   │       └── types.ts        ← IPC message types
  │   │
  │   └── renderer/
  │       ├── App.tsx
  │       ├── screens/
  │       │   ├── IdleScreen.tsx
  │       │   ├── PINScreen.tsx
  │       │   ├── RFIDScreen.tsx
  │       │   ├── SuccessScreen.tsx
  │       │   └── ErrorScreen.tsx
  │       ├── components/
  │       │   ├── Clock.tsx
  │       │   ├── PinPad.tsx
  │       │   ├── SyncStatus.tsx
  │       │   ├── RecentCheckins.tsx
  │       │   └── EmployeeCard.tsx
  │       └── hooks/
  │           ├── useSync.ts
  │           ├── useKiosk.ts
  │           └── useOnlineStatus.ts
```

### 10.3 Offline Queue (SQLite Schema)
```sql
-- Kiosk local SQLite database

CREATE TABLE attendance_queue (
  id          TEXT PRIMARY KEY,         -- local UUID
  employee_id TEXT NOT NULL,
  date        TEXT NOT NULL,            -- YYYY-MM-DD
  time_in     TEXT,                     -- ISO string
  time_out    TEXT,                     -- ISO string
  status      TEXT NOT NULL,
  source      TEXT DEFAULT 'kiosk',
  device_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  synced      INTEGER DEFAULT 0,        -- 0=pending, 1=synced
  sync_attempts INTEGER DEFAULT 0,
  last_sync_at TEXT,
  sync_error  TEXT
);

CREATE TABLE device_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- Stores: device_id, device_name, api_token, sync_endpoint, last_sync_time

CREATE TABLE employee_cache (
  id           TEXT PRIMARY KEY,
  employee_no  TEXT,
  full_name    TEXT,
  pin_code     TEXT,
  rfid_tag     TEXT,
  shift_id     TEXT,
  department   TEXT,
  cached_at    TEXT
);
-- Local copy of active employees (refreshed every 5 min when online)
```

### 10.4 Sync Engine Logic
```typescript
class SyncEngine {
  private intervalId: NodeJS.Timeout

  start() {
    this.checkOnlineStatus()
    this.intervalId = setInterval(() => this.sync(), 30_000) // every 30s
  }

  async sync() {
    if (!await this.isOnline()) return

    const pending = db.getPendingRecords()
    if (pending.length === 0) return

    emit('sync:status', 'syncing')

    for (const batch of chunk(pending, 50)) {
      try {
        const result = await api.post('/kiosk/sync', { records: batch, device_id: this.deviceId })
        db.markSynced(result.accepted_ids)
        db.markFailed(result.rejected_ids, result.errors)
        emit('sync:status', 'synced')
      } catch (err) {
        emit('sync:status', 'failed')
        // exponential backoff: retry after 1m, 2m, 4m, 8m, max 15m
        scheduleRetry(batch)
      }
    }
  }

  async refreshEmployeeCache() {
    if (!await this.isOnline()) return
    const employees = await api.get('/kiosk/employees')
    db.refreshEmployeeCache(employees)
  }
}
```

### 10.5 Sync Status States
```
Online    → green dot, "Online" label
Offline   → yellow dot, "Offline - X records queued"
Syncing   → animated spinner, "Syncing X records..."
Synced    → green checkmark, "All records synced"
Failed    → red dot, "Sync failed - will retry"
```

### 10.6 Duplicate Prevention
```typescript
// Server-side: UPSERT with unique constraint on (employee_id, date, source='kiosk')
// Conflict: server wins for time-out, client wins for time-in if server has no record
// Dedup key: device_id + local_id (prevents double-posting same record)
```

### 10.7 Device Registration Flow
```
1. First launch: kiosk shows "Device Registration" screen
2. Admin enters registration token (generated in web dashboard)
3. Kiosk POSTs to /api/kiosk/register with token
4. Server validates token, issues device_id + permanent device_token
5. Device ID stored in SQLite device_config
6. All future sync requests include device_id + device_token header
7. Admin can revoke device from dashboard
```

---

## 11. BACKEND ARCHITECTURE (SUPABASE + VERCEL)

### 11.1 Architecture Diagram
```
Browser/Kiosk
    │
    │ HTTPS
    ▼
Vercel Edge Functions (/api/v1/*)
    │
    ├── Validates JWT (Supabase auth)
    ├── Enforces RBAC
    ├── Rate limits (Vercel + Upstash)
    ├── Input validation (Zod)
    │
    ▼
Supabase
    ├── PostgreSQL (RLS enforced)
    ├── Auth (JWT, email/password, MFA)
    ├── Storage (logos, documents)
    └── Realtime (attendance live updates)
```

### 11.2 Vercel API Structure
```
/api/
  v1/
    auth/
      login.ts
      logout.ts
      refresh.ts
      me.ts
    employees/
      index.ts        (GET list, POST create)
      [id].ts         (GET one, PUT update, DELETE)
      [id]/payslips/
    attendance/
      index.ts
      today.ts
      [id].ts
    payroll/
      periods/
        index.ts
        [id].ts
        [id]/entries.ts
        [id]/approve.ts
    leaves/
      index.ts
      [id]/review.ts
    overtime/
      index.ts
      [id]/review.ts
    kiosk/
      register.ts
      sync.ts
      employees.ts    (employee cache for kiosk)
    reports/
      payroll-summary.ts
      attendance-summary.ts
    settings/
      company.ts
      deductions.ts
    audit/
      index.ts
```

### 11.3 API Security
```typescript
// Every API route runs through middleware chain:
1. authenticateRequest(req)    → validates Supabase JWT
2. extractTenant(req)          → determines which company/tenant
3. enforceRBAC(req, resource)  → checks role permissions
4. validateInput(req, schema)  → Zod validation
5. rateLimit(req)              → per-user rate limiting
6. handler(req, res)           → business logic
```

### 11.4 Multi-Tenant Strategy
```sql
-- Every table has tenant_id (company_id)
-- Row Level Security (RLS) policies:

CREATE POLICY "tenant_isolation" ON employees
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Users table maps user → tenant
CREATE TABLE tenant_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id),
  tenant_id  UUID REFERENCES tenants(id),
  role       TEXT NOT NULL,    -- 'super-admin' | 'hr-admin' | ...
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 12. DATABASE SCHEMA

### 12.1 Core Tables
```sql
-- TENANTS (for multi-company white-label)
CREATE TABLE tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,    -- 'acme', 'xyz-corp'
  name           TEXT NOT NULL,
  plan           TEXT DEFAULT 'starter',  -- 'starter' | 'pro' | 'enterprise'
  brand_config   JSONB,                   -- BrandConfig JSON
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- EMPLOYEES
CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) NOT NULL,
  employee_no       TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  middle_name       TEXT,
  full_name         TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email             TEXT,
  phone             TEXT,
  position          TEXT,
  department_id     UUID REFERENCES departments(id),
  employment_type   TEXT,
  status            TEXT DEFAULT 'active',
  hire_date         DATE,
  -- Compensation
  compensation_type TEXT,
  compensation_rate NUMERIC(12,2),
  basic_salary      NUMERIC(12,2),
  daily_rate        NUMERIC(12,2),
  pay_frequency     TEXT,
  -- IDs
  pin_code          TEXT,
  rfid_tag          TEXT,
  -- Gov't IDs
  sss_no            TEXT,
  philhealth_no     TEXT,
  pagibig_no        TEXT,
  tin_no            TEXT,
  -- Banking
  bank_name         TEXT,
  bank_account      TEXT,
  shift_id          UUID REFERENCES work_shifts(id),
  tax_status        TEXT,
  allowances        JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, employee_no)
);

-- ATTENDANCE
CREATE TABLE attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) NOT NULL,
  employee_id       UUID REFERENCES employees(id) NOT NULL,
  date              DATE NOT NULL,
  time_in           TIMESTAMPTZ,
  time_out          TIMESTAMPTZ,
  status            TEXT NOT NULL,
  minutes_late      INTEGER DEFAULT 0,
  overtime_minutes  INTEGER DEFAULT 0,
  night_diff_minutes INTEGER DEFAULT 0,
  source            TEXT DEFAULT 'kiosk',  -- 'kiosk' | 'manual'
  device_id         TEXT,
  corrected_by      TEXT,
  correction_reason TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, employee_id, date)
);

-- PAYROLL PERIODS
CREATE TABLE payroll_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) NOT NULL,
  period_no       TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  pay_date        DATE NOT NULL,
  frequency       TEXT NOT NULL,
  status          TEXT DEFAULT 'draft',
  total_employees INTEGER DEFAULT 0,
  total_gross     NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  total_net       NUMERIC(14,2) DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  reviewed_by     UUID REFERENCES auth.users(id),
  approved_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- KIOSK DEVICES
CREATE TABLE kiosk_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) NOT NULL,
  device_name   TEXT NOT NULL,
  device_token  TEXT UNIQUE NOT NULL,    -- bcrypt hashed
  location      TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  last_seen_at  TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) NOT NULL,
  user_id     UUID,
  user_name   TEXT,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  description TEXT,
  before_data JSONB,
  after_data  JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 12.2 Row Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
-- ... all tables

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON employees
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
```

---

## 13. RBAC PERMISSION SYSTEM

### 13.1 Permission Matrix
```typescript
type Permission =
  | 'employees:read'   | 'employees:write'   | 'employees:delete'
  | 'attendance:read'  | 'attendance:write'  | 'attendance:correct'
  | 'payroll:read'     | 'payroll:generate'  | 'payroll:approve' | 'payroll:mark-paid'
  | 'leaves:read'      | 'leaves:approve'
  | 'overtime:read'    | 'overtime:approve'
  | 'reports:read'     | 'reports:export'
  | 'settings:read'    | 'settings:write'
  | 'audit:read'
  | 'kiosk:manage'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'super-admin': ['*'],  // all permissions
  'hr-admin': [
    'employees:read', 'employees:write',
    'attendance:read', 'attendance:write', 'attendance:correct',
    'payroll:read', 'payroll:generate',
    'leaves:read', 'leaves:approve',
    'overtime:read', 'overtime:approve',
    'reports:read', 'reports:export',
    'settings:read',
    'kiosk:manage',
  ],
  'payroll-officer': [
    'employees:read',
    'attendance:read',
    'payroll:read', 'payroll:generate', 'payroll:approve',
    'reports:read', 'reports:export',
  ],
  'dept-head': [
    'employees:read',
    'attendance:read',
    'leaves:read', 'leaves:approve',
    'overtime:read', 'overtime:approve',
    'reports:read',
  ],
  'employee': [
    'attendance:read',  // own records only
  ],
}
```

---

## 14. IMPLEMENTATION ROADMAP

### Phase 0 — Foundation (Week 1) ✅ CURRENT
- [x] Backup current state to GitHub
- [ ] Create brand config system
- [ ] Extract CSS design tokens
- [ ] Update Tailwind config
- [ ] Split `db.ts` into service modules
- [ ] Create barrel exports

### Phase 1 — Component Library (Week 2)
- [ ] DataTable universal component
- [ ] Form system (FormField, FormSection, FormGrid)
- [ ] Toast/Notification system
- [ ] ConfirmDialog system
- [ ] Skeleton components
- [ ] Button, Input, Select standardized
- [ ] Badge, StatusBadge finalized
- [ ] Modal finalized
- [ ] PageShell / PageHeader finalized

### Phase 2 — UI/UX Redesign (Week 3-4)
- [ ] Login page redesign (split layout)
- [ ] Sidebar redesign (config-driven, token-based)
- [ ] TopBar redesign
- [ ] Dashboard redesign (KPIs + charts)
- [ ] Employee pages redesign
- [ ] Attendance pages redesign
- [ ] Payroll pages redesign
- [ ] Leave/OT pages redesign
- [ ] Settings page redesign
- [ ] Responsive improvements

### Phase 3 — Architecture Improvements (Week 5)
- [ ] Add React Query
- [ ] Add Zustand stores per domain
- [ ] Add lazy loading for all routes
- [ ] Add error boundaries
- [ ] Add proper loading states everywhere
- [ ] Config-driven nav/routing
- [ ] RBAC enforcement at route level
- [ ] Add 404 / Forbidden pages

### Phase 4 — Kiosk App (Week 6-7)
- [ ] Create `kiosk/` package (Electron + Vite + React)
- [ ] SQLite offline queue
- [ ] Sync engine
- [ ] PIN pad screen
- [ ] RFID screen
- [ ] Device registration
- [ ] Build/package for Windows

### Phase 5 — Backend (Week 8-10)
- [ ] Supabase project setup
- [ ] Database schema migration
- [ ] RLS policies
- [ ] Auth setup (email/password)
- [ ] Vercel API routes
- [ ] Multi-tenant structure
- [ ] Kiosk sync API
- [ ] Realtime attendance feed

### Phase 6 — Enterprise Features (Week 11-12)
- [ ] White-label admin portal
- [ ] Theme switcher (light/dark)
- [ ] Module enable/disable
- [ ] Custom branding upload
- [ ] Export (PDF payslips, Excel reports)
- [ ] Notifications
- [ ] Audit trail improvements
- [ ] Monitoring / logging

---

## DECISION LOG

| Decision | Choice | Reason |
|---|---|---|
| Data fetching | TanStack Query | Best-in-class caching, invalidation, optimistic updates |
| Backend | Supabase + Vercel | Zero-infra, scalable, built-in auth + realtime |
| Offline (Kiosk) | Electron + SQLite | True offline, native USB HID support |
| Styling | Tailwind + CSS tokens | Utility-first + themeable without JS overhead |
| State | Zustand (global) + React Query (server) | Clear separation of concerns |
| Forms | Native + custom FormField | Avoids heavy form library, sufficient for this domain |
| Auth | Supabase JWT + httpOnly cookies | Secure, standard, auto-refresh |
| Multi-tenant | Row Level Security | Database-level isolation, no application bugs possible |
| White-label | Config file + CSS tokens | Zero-code rebrand per client |

---

*This document is a living plan. Update it as decisions are made and phases complete.*
