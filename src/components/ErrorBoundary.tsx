import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional slot rendered instead of the default error card. Receives `reset`. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time errors in the subtree and shows a friendly recovery UI
 * instead of a blank white page.  Wrap around <Suspense> in AppLayout and around
 * individual heavy pages.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console so devtools surface it; in production swap for Sentry.captureException.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '60vh',
          gap:            16,
          padding:        24,
          textAlign:      'center',
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle style={{ width: 24, height: 24, color: '#DC2626' }} />
        </div>

        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 420 }}>
            {error.message || 'An unexpected error occurred. Please try refreshing.'}
          </p>
        </div>

        <button
          onClick={this.reset}
          className="btn btn-primary"
          style={{ fontSize: 13, height: 36, gap: 6 }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
          Try again
        </button>
      </div>
    )
  }
}
