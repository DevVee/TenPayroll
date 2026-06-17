import { Building2, CheckCircle2, LogIn, LogOut, UserCircle, XCircle } from 'lucide-react'
import type { ResultData } from '../App'

// ─── Result overlay ───────────────────────────────────────────────────────────
// Renders as an absolute full-screen layer over MainScreen.
// No enter/exit animation — appears and disappears instantly.
// Parent (App) unmounts it after RESULT_HOLD_MS.

interface Props { data: ResultData }

export function ResultOverlay({ data }: Props) {
  const isSuccess = data.success
  const isTimeIn  = data.type === 'time-in'

  // Background fill — solid dark tint based on outcome
  const bg = isSuccess
    ? isTimeIn ? '#071a10' : '#120f05'
    : '#150404'

  const accent: string = isSuccess
    ? isTimeIn ? '#10B981' : '#F59E0B'
    : '#EF4444'

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-7 z-50"
      style={{ background: bg }}
    >
      {/* ── Icon badge ── */}
      <div
        className="w-28 h-28 rounded-3xl flex items-center justify-center"
        style={{
          background: `${accent}18`,
          border:     `2px solid ${accent}30`,
        }}
      >
        {isSuccess
          ? isTimeIn
            ? <LogIn   size={52} style={{ color: accent }} strokeWidth={1.4} />
            : <LogOut  size={52} style={{ color: accent }} strokeWidth={1.4} />
          : <XCircle size={52} style={{ color: accent }} strokeWidth={1.4} />
        }
      </div>

      {/* ── Text block ── */}
      <div className="flex flex-col items-center gap-2.5 text-center px-8">
        {isSuccess ? (
          <>
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: accent }}
            >
              {isTimeIn ? '✓  Time In Recorded' : '✓  Time Out Recorded'}
            </span>
            <h1 className="text-5xl font-black text-white leading-tight">
              {data.employee?.fullName ?? 'Employee'}
            </h1>
            {data.employee?.department && (
              <p className="flex items-center gap-1.5 text-slate-400 text-sm font-medium">
                <Building2 size={14} />
                {data.employee.department}
              </p>
            )}
            {data.employee?.position && (
              <p className="flex items-center gap-1.5 text-slate-500 text-xs">
                <UserCircle size={13} />
                {data.employee.position}
              </p>
            )}
          </>
        ) : (
          <>
            <span className="text-xs font-bold tracking-widest uppercase text-red-400">
              Check-in Failed
            </span>
            <h1 className="text-2xl font-bold text-white">
              {data.error ?? 'An error occurred'}
            </h1>
            <p className="text-sm text-slate-500">Please contact HR or try again.</p>
          </>
        )}
      </div>

      {/* ── Success checkmark ── */}
      {isSuccess && (
        <CheckCircle2 size={22} style={{ color: accent }} strokeWidth={2} />
      )}

      {/* ── Auto-dismiss hint ── */}
      <p className="text-xs text-slate-700 absolute bottom-8 select-none">
        Returning to home screen…
      </p>
    </div>
  )
}
