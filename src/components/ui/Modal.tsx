import { useEffect } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

const WIDTHS = {
  sm: '440px',
  md: '520px',
  lg: '640px',
  xl: '800px',
}

export function Modal({ open, onClose, title, children, size = 'md', footer }: Props) {
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(15,23,42,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative bg-white w-full flex flex-col"
            style={{
              maxWidth: WIDTHS[size],
              maxHeight: '90vh',
              zIndex: 10,
              border: '1px solid #E2E8F0',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#0F172A',
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center transition-all"
                style={{
                  width: 28, height: 28,
                  borderRadius: 8,
                  color: '#94A3B8',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = '#F1F5F9'
                  ;(e.currentTarget as HTMLElement).style.color = '#475569'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#94A3B8'
                }}
                aria-label="Close"
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>

            {/* Footer */}
            {footer && (
              <div
                className="px-6 py-4 flex-shrink-0 flex items-center justify-end gap-2"
                style={{ borderTop: '1px solid #F1F5F9' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
