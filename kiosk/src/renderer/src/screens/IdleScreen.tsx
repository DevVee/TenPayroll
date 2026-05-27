import { motion } from 'framer-motion'
import { Fingerprint, CreditCard, RefreshCw } from 'lucide-react'
import { Clock }          from '../components/Clock'
import { SyncStatus }     from '../components/SyncStatus'
import { RecentCheckins } from '../components/RecentCheckins'

interface IdleScreenProps {
  onPINMode:  () => void
  onRFIDMode: () => void
}

export function IdleScreen({ onPINMode, onRFIDMode }: IdleScreenProps) {
  const handleRefresh = async () => {
    try { await window.kiosk.refreshEmployees() } catch { /* ignore */ }
  }

  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="h-screen w-screen flex overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 20% 50%, #450a0a 0%, #1a0505 60%, #0F172A 100%)',
      }}
    >
      {/* ── Left panel: clock + CTA ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 px-12">

        {/* Logo + brand */}
        <div className="flex flex-col items-center gap-3">
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(220,38,38,0.4)',
          }}>
            {/* Fallback if logo image not present */}
            <img
              src="/TenPayroll.png"
              alt="TenPayroll"
              style={{ width: 36, height: 36, objectFit: 'contain' }}
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>TenPayroll</p>
          <p className="text-slate-400 text-sm tracking-widest uppercase font-medium">Attendance Kiosk</p>
        </div>

        {/* Clock */}
        <Clock />

        {/* Tap prompt */}
        <motion.p
          className="text-slate-400 text-base font-medium tracking-wide"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          Tap a button or scan your card to check in
        </motion.p>

        {/* Action buttons */}
        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPINMode}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl text-white font-semibold text-sm transition-colors shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
              border: '1px solid rgba(220,38,38,0.4)',
              boxShadow: '0 8px 24px rgba(220,38,38,0.35)',
            }}
          >
            <Fingerprint size={32} strokeWidth={1.5} />
            Enter PIN
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onRFIDMode}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl text-white font-semibold text-sm transition-colors shadow-lg"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
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
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: 'transparent' }}
            title="Refresh employee list from server"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden px-3 py-3">
          <RecentCheckins />
        </div>
      </div>
    </motion.div>
  )
}
