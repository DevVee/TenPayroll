import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useUIStore()

  return (
    <AnimatePresence>
      {confirm && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9000]"
            style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={() => { confirm.resolve(false); closeConfirm() }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="fixed z-[9001] top-1/2 left-1/2"
            style={{ transform: 'translate(-50%,-50%)', width: 'min(420px, 90vw)' }}
          >
            <div
              className="bg-white"
              style={{
                borderRadius: 16,
                boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
                padding: 24,
              }}
            >
              {/* Icon */}
              {confirm.variant === 'destructive' && (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 44, height: 44,
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: 12,
                    marginBottom: 16,
                  }}
                >
                  <AlertTriangle style={{ width: 22, height: 22, color: '#DC2626' }} />
                </div>
              )}

              {/* Title */}
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 8 }}>
                {confirm.title}
              </p>

              {/* Description */}
              {confirm.description && (
                <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, marginBottom: 20 }}>
                  {confirm.description}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2" style={{ marginTop: confirm.description ? 0 : 20 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { confirm.resolve(false); closeConfirm() }}
                >
                  {confirm.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  className={confirm.variant === 'destructive' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
                  onClick={() => { confirm.resolve(true); closeConfirm() }}
                >
                  {confirm.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
