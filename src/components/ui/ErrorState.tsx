import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  title?: string
  message?: string
  onRetry?: () => void
}

/**
 * Consistent error state for data-loading failures.
 * Shows a red warning icon, optional error message, and an optional "Try Again" button.
 */
export function ErrorState({
  title   = 'Something went wrong',
  message = 'Failed to load data. Please check your connection and try again.',
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'var(--color-danger-bg)', flexShrink: 0,
        }}
      >
        <AlertTriangle style={{ width: 24, height: 24, color: 'var(--color-danger)', opacity: 0.8 }} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', letterSpacing: '-0.01em', marginBottom: 4 }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, maxWidth: 300 }}>
        {message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary mt-5 flex items-center gap-2">
          <RefreshCw style={{ width: 13, height: 13 }} />
          Try Again
        </button>
      )}
    </div>
  )
}
