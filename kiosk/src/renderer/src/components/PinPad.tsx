import { useState, useEffect, useCallback } from 'react'
import { Delete, CornerDownLeft } from 'lucide-react'
import { motion } from 'framer-motion'

interface PinPadProps {
  maxLength?: number
  onComplete: (pin: string) => void
  onClear?: () => void
  loading?: boolean
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinPad({ maxLength = 6, onComplete, loading = false }: PinPadProps) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  const handleKey = useCallback((key: string) => {
    if (loading) return

    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }

    if (pin.length >= maxLength) {
      // Visual shake
      setShake(true)
      setTimeout(() => setShake(false), 400)
      return
    }

    const next = pin + key
    setPin(next)

    if (next.length === maxLength) {
      setTimeout(() => {
        onComplete(next)
        setPin('')
      }, 120)
    }
  }, [pin, maxLength, loading, onComplete])

  // Physical keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      if (e.key === 'Backspace')         handleKey('⌫')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleKey])

  const dots = Array.from({ length: maxLength }, (_, i) => i)

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* PIN dots */}
      <motion.div
        className="flex gap-3"
        animate={shake ? { x: [-6, 6, -4, 4, -2, 2, 0] } : {}}
        transition={{ duration: 0.35 }}
      >
        {dots.map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
              i < pin.length
                ? 'bg-indigo-400 scale-110'
                : 'bg-white/20 border border-white/20'
            }`}
          />
        ))}
      </motion.div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, idx) => {
          if (key === '') return <div key={idx} />

          const isDelete = key === '⌫'

          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleKey(key)}
              disabled={loading}
              className={`
                pin-key w-20 h-20 rounded-2xl flex items-center justify-center
                font-semibold text-2xl transition-colors duration-100
                ${isDelete
                  ? 'bg-white/8 text-slate-400 hover:bg-white/12 active:bg-white/18'
                  : 'bg-white/10 text-white hover:bg-white/18 active:bg-white/25'
                }
                disabled:opacity-40 disabled:cursor-not-allowed
                border border-white/10
              `}
            >
              {isDelete ? <Delete size={22} /> : key}
            </motion.button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-indigo-300 animate-pulse">
          <CornerDownLeft size={14} />
          Verifying…
        </div>
      )}
    </div>
  )
}
