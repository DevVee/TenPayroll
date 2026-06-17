import { motion } from 'framer-motion'
import { ArrowLeft, CreditCard } from 'lucide-react'

interface RFIDScreenProps {
  onCancel: () => void
}

export function RFIDScreen({ onCancel }: RFIDScreenProps) {
  return (
    <motion.div
      key="rfid"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35 }}
      className="h-screen w-screen flex flex-col items-center justify-center gap-8"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0c2340 0%, #0F172A 70%)',
      }}
    >
      {/* Back */}
      <button
        onClick={onCancel}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/8"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Animated card icon */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-28 h-28 rounded-3xl bg-sky-600/20 border-2 border-sky-500/40 flex items-center justify-center"
      >
        <CreditCard size={56} className="text-sky-300" strokeWidth={1.2} />
      </motion.div>

      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold text-white">Scan Your Card</h1>
        <p className="text-slate-400 text-sm max-w-xs">
          Hold your RFID card near the reader.<br />
          The check-in will be recorded automatically.
        </p>
      </div>

      {/* Pulse ring */}
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute w-32 h-32 rounded-full border-2 border-sky-500/30"
          animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-32 h-32 rounded-full border-2 border-sky-500/20"
          animate={{ scale: [1, 2.4], opacity: [0.4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
        />
        <div className="w-10 h-10 rounded-full bg-sky-500/40 border border-sky-400/60" />
      </div>

      <motion.p
        className="text-slate-500 text-xs"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        Waiting for card…
      </motion.p>
    </motion.div>
  )
}
