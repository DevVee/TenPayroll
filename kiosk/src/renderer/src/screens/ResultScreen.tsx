import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, LogIn, LogOut, UserCircle, Building2 } from 'lucide-react'
import type { ResultData } from '../App'

interface ResultScreenProps {
  data: ResultData
}

export function ResultScreen({ data }: ResultScreenProps) {
  const isSuccess = data.success
  const isTimeIn  = data.type === 'time-in'

  const bgGradient = isSuccess
    ? isTimeIn
      ? 'radial-gradient(ellipse at 50% 40%, #052e16 0%, #0F172A 70%)'
      : 'radial-gradient(ellipse at 50% 40%, #1c1917 0%, #0F172A 70%)'
    : 'radial-gradient(ellipse at 50% 40%, #2d0a0a 0%, #0F172A 70%)'

  const iconBg = isSuccess
    ? isTimeIn ? 'bg-emerald-600/20 border-emerald-500/40' : 'bg-amber-600/20 border-amber-500/40'
    : 'bg-red-600/20 border-red-500/40'

  const iconColor = isSuccess
    ? isTimeIn ? 'text-emerald-300' : 'text-amber-300'
    : 'text-red-300'

  const accentColor = isSuccess
    ? isTimeIn ? '#10B981' : '#F59E0B'
    : '#EF4444'

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className="h-screen w-screen flex flex-col items-center justify-center gap-8"
      style={{ background: bgGradient }}
    >
      {/* Result icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
        className={`w-24 h-24 rounded-3xl ${iconBg} border-2 flex items-center justify-center`}
      >
        {isSuccess
          ? isTimeIn
            ? <LogIn    size={44} className={iconColor} strokeWidth={1.5} />
            : <LogOut   size={44} className={iconColor} strokeWidth={1.5} />
          : <XCircle  size={44} className={iconColor} strokeWidth={1.5} />
        }
      </motion.div>

      {/* Status label */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="flex flex-col items-center gap-2 text-center"
      >
        {isSuccess ? (
          <>
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: accentColor }}
            >
              {isTimeIn ? '✓ Time In Recorded' : '✓ Time Out Recorded'}
            </span>
            <h1 className="text-3xl font-black text-white">
              {data.employee?.fullName ?? 'Employee'}
            </h1>
            {data.employee?.department && (
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Building2 size={14} />
                {data.employee.department}
              </div>
            )}
            {data.employee?.position && (
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <UserCircle size={13} />
                {data.employee.position}
              </div>
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
            <p className="text-sm text-slate-400">Please contact HR or try again.</p>
          </>
        )}
      </motion.div>

      {/* Checkmark animation for success */}
      {isSuccess && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
        >
          <CheckCircle2 size={20} style={{ color: accentColor }} />
        </motion.div>
      )}

      {/* Auto-dismiss hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-slate-600 absolute bottom-8"
      >
        Returning to home screen…
      </motion.p>
    </motion.div>
  )
}
