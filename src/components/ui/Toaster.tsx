import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

const ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES = {
  success: { icon: '#059669', border: '#A7F3D0', bg: '#F0FDF4' },
  error:   { icon: '#DC2626', border: '#FECACA', bg: '#FEF2F2' },
  warning: { icon: '#D97706', border: '#FDE68A', bg: '#FFFBEB' },
  info:    { icon: '#0284C7', border: '#BAE6FD', bg: '#F0F9FF' },
}

export function Toaster() {
  const { toasts, removeToast } = useUIStore()

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 380, width: '100%' }}
    >
      <AnimatePresence>
        {toasts.map(t => {
          const Icon  = ICONS[t.type]
          const style = STYLES[t.type]
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 60, scale: 0.92 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                borderRadius: 12,
                padding: '12px 14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                pointerEvents: 'all',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <Icon style={{ width: 17, height: 17, color: style.icon, flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A', letterSpacing: '-0.01em' }}>
                  {t.title}
                </p>
                {t.message && (
                  <p style={{ fontSize: 12.5, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  color: '#94A3B8', background: 'transparent',
                  border: 'none', cursor: 'pointer', flexShrink: 0,
                  padding: 2, borderRadius: 4,
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#475569')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#94A3B8')}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
