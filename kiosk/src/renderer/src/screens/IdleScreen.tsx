import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, CreditCard, RefreshCw, CalendarX } from 'lucide-react'
import { Clock }          from '../components/Clock'
import { SyncStatus }     from '../components/SyncStatus'
import { RecentCheckins } from '../components/RecentCheckins'

interface IdleScreenProps {
  onPINMode:  () => void
  onRFIDMode: () => void
}

type Holiday = { id: string; name: string; date: string; type: string } | null

export function IdleScreen({ onPINMode, onRFIDMode }: IdleScreenProps) {
  const [holiday,     setHoliday]     = useState<Holiday>(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshMsg,  setRefreshMsg]  = useState<string | null>(null)

  // Poll for today's holiday every 5 minutes (covers midnight rollover)
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (cancelled) return
      try {
        const h = await window.kiosk.todayHoliday()
        if (!cancelled) setHoliday(h)
      } catch { /* ignore */ }
      if (!cancelled) setTimeout(check, 5 * 60_000)
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await window.kiosk.refreshEmployees()
      setRefreshMsg(res.success ? '✓ Data refreshed' : `Error: ${res.error}`)
    } catch (err) {
      setRefreshMsg(`Error: ${String(err)}`)
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 3000)
    }
  }

  const isHolidayBlocked = holiday !== null

  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="h-screen w-screen flex overflow-hidden"
      style={{
        background: isHolidayBlocked
          ? 'radial-gradient(ellipse at 20% 50%, #1a1a0a 0%, #0F172A 100%)'
          : 'radial-gradient(ellipse at 20% 50%, #450a0a 0%, #1a0505 60%, #0F172A 100%)',
      }}
    >
      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-12">

        {/* Logo + brand */}
        <div className="flex flex-col items-center gap-3">
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(220,38,38,0.4)',
          }}>
            <img
              src="/TenPayroll.png"
              alt="TenPayroll"
              style={{ width: 36, height: 36, objectFit: 'contain' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>TenPayroll</p>
          <p className="text-slate-400 text-sm tracking-widest uppercase font-medium">Attendance Kiosk</p>
        </div>

        {/* Clock */}
        <Clock />

        {/* ── Holiday banner ── */}
        <AnimatePresence>
          {isHolidayBlocked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl text-center max-w-sm"
              style={{
                background: 'rgba(234,179,8,0.12)',
                border: '1px solid rgba(234,179,8,0.3)',
              }}
            >
              <CalendarX size={24} style={{ color: '#EAB308' }} />
              <p className="text-sm font-bold" style={{ color: '#EAB308' }}>
                {holiday?.type === 'regular' ? 'Regular Holiday' : 'Special Non-Working Holiday'}
              </p>
              <p className="text-white font-semibold">{holiday?.name}</p>
              <p className="text-xs text-slate-400">Attendance kiosk is disabled today.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap prompt — only when not a holiday */}
        {!isHolidayBlocked && (
          <motion.p
            className="text-slate-400 text-base font-medium tracking-wide"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            Tap a button or scan your card to check in
          </motion.p>
        )}

        {/* Action buttons — disabled on holidays */}
        <div className="flex gap-4">
          <motion.button
            whileHover={!isHolidayBlocked ? { scale: 1.03 } : {}}
            whileTap={!isHolidayBlocked ? { scale: 0.97 } : {}}
            onClick={!isHolidayBlocked ? onPINMode : undefined}
            disabled={isHolidayBlocked}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl text-white font-semibold text-sm shadow-lg transition-opacity"
            style={{
              background: isHolidayBlocked
                ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, #DC2626, #B91C1C)',
              border: isHolidayBlocked
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(220,38,38,0.4)',
              boxShadow: isHolidayBlocked ? 'none' : '0 8px 24px rgba(220,38,38,0.35)',
              opacity: isHolidayBlocked ? 0.4 : 1,
              cursor:  isHolidayBlocked ? 'not-allowed' : 'pointer',
            }}
          >
            <Fingerprint size={32} strokeWidth={1.5} />
            Enter PIN
          </motion.button>

          <motion.button
            whileHover={!isHolidayBlocked ? { scale: 1.03 } : {}}
            whileTap={!isHolidayBlocked ? { scale: 0.97 } : {}}
            onClick={!isHolidayBlocked ? onRFIDMode : undefined}
            disabled={isHolidayBlocked}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl text-white font-semibold text-sm shadow-lg transition-opacity"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              opacity: isHolidayBlocked ? 0.4 : 1,
              cursor:  isHolidayBlocked ? 'not-allowed' : 'pointer',
            }}
          >
            <CreditCard size={32} strokeWidth={1.5} />
            Scan Card
          </motion.button>
        </div>

        {/* Sync status */}
        <SyncStatus />
      </div>

      {/* ── Right panel: recent check-ins ───────────────────────────────── */}
      <div className="w-80 flex flex-col" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Recent</h2>
          <div className="flex items-center gap-2">
            {refreshMsg && (
              <span className={`text-xs ${refreshMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                {refreshMsg}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
              style={{ background: 'transparent' }}
              title="Refresh employee list from server"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden px-3 py-3">
          <RecentCheckins />
        </div>
      </div>
    </motion.div>
  )
}
