import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Fingerprint } from 'lucide-react'
import { PinPad } from '../components/PinPad'

interface PINScreenProps {
  onComplete: (pin: string) => Promise<void>
  onCancel:   () => void
}

export function PINScreen({ onComplete, onCancel }: PINScreenProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleComplete = async (pin: string) => {
    setLoading(true)
    setError(null)
    try {
      await onComplete(pin)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      key="pin"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35 }}
      className="h-screen w-screen flex flex-col items-center justify-center gap-8"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #1e1b4b 0%, #0F172A 70%)',
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

      {/* Icon + heading */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
          <Fingerprint size={32} className="text-indigo-300" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-white">Enter your PIN</h1>
        <p className="text-sm text-slate-400">Type your 6-digit PIN to check in or out</p>
      </div>

      {/* PIN pad */}
      <PinPad
        maxLength={6}
        onComplete={handleComplete}
        loading={loading}
      />

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-sm font-medium max-w-xs text-center"
        >
          {error}
        </motion.div>
      )}
    </motion.div>
  )
}
