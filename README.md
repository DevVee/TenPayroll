# TenPayroll

> **Enterprise HR & Payroll Platform** for the Philippines — built on Vite 6, React 19, TypeScript, Supabase, and Tailwind CSS.

---

## Features

| Module | Highlights |
|---|---|
| **Employee Management** | Profiles, departments, positions, PSGC cascading address |
| **Attendance** | Web kiosk (PIN + RFID), manual override, late/overtime/undertime |
| **Leave Management** | Vacation, sick, emergency — approval workflow |
| **Overtime** | Request, approve, auto-multiplier |
| **Payroll** | Philippines-compliant: SSS 2024, PhilHealth 5%, Pag-IBIG, BIR TRAIN Law withholding |
| **Reports** | Workforce, payroll cost, attendance analytics |
| **Settings** | Company info, deduction rules, departments, positions, shifts |
| **Audit Log** | Immutable trail of every create/update/delete |
| **Kiosk** | Public touchscreen mode — admin exit requires password |

---

## Tech Stack

- **Frontend**: Vite 6 + React 19 + TypeScript (strict)
- **Styling**: Tailwind CSS 3.4 + CSS custom properties (design tokens)
- **Animations**: Framer Motion
- **State**: Zustand 5 + TanStack React Query
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Routing**: React Router 7 (lazy-loaded pages)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Deploy**: Vercel (SPA rewrites + security headers)

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- A [Supabase](https://supabase.com) project

### 1 — Clone & install

```bash
git clone https://github.com/your-org/tenpayroll.git
cd tenpayroll
npm install
```

### 2 — Environment variables

Create `.env` (never commit this):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3 — Initialize the database

Run `supabase/schema.sql` in the **Supabase SQL Editor** on a fresh project.
This creates all 14 tables, indexes, RLS policies, and helper functions.

> **Existing project migration**: if you are adding `undertime_minutes` to an existing DB, also run:
> ```sql
> ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS undertime_minutes INT NOT NULL DEFAULT 0;
> ```

### 4 — Seed data (optional)

Run `supabase/seed.sql` to create demo departments, positions, shifts, holidays, and a test admin account.

### 5 — Run locally

```bash
npm run dev
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run type-check` | TypeScript type-check only (no emit) |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build locally |

---

## Deployment (Vercel)

1. Connect this repo to Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel **Environment Variables**.
3. Deploy — `vercel.json` handles SPA routing rewrites and security headers (CSP, HSTS, etc.).

---

## Security

- **RLS**: All 14 tables have row-level security. Role-aware policies enforce:
  - `super-admin` / `hr-admin` — full access
  - `payroll-officer` — payroll CRUD + read employees
  - `dept-head` — read employees, approve leaves/OT
  - `employee` — own records only
  - `anon` (kiosk machine) — PIN/RFID lookup + today's attendance only
- **No `.env` in git** — verified via `.gitignore`
- **Security headers** on every response via `vercel.json`
- **Kiosk exit** requires admin email + password (3-attempt lockout, 30 s cooldown)
- **Token storage**: Supabase default (localStorage) — acceptable for internal tools

---

## Project Structure

```
src/
├── components/      # Reusable UI + layout (ErrorBoundary, AppLayout, Sidebar…)
├── config/          # Brand tokens, backend config
├── hooks/           # useData (generic async fetch with toast on error)
├── lib/
│   ├── _db/         # Domain-layer Supabase adapters (auth, employees, payroll…)
│   ├── api/         # Re-export barrel files
│   ├── payrollEngine.ts  # Philippines payroll computation engine
│   └── supabase.ts  # Supabase client singleton
├── pages/           # Route-level lazy pages
├── store/           # Zustand stores (authStore, uiStore)
└── types/           # TypeScript interfaces
supabase/
├── schema.sql       # Complete DB schema — run once on fresh project
└── seed.sql         # Demo data
```

---

## License

Private — Ten Foundation Philippines Inc. All rights reserved.
