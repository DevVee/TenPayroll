import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="h-screen flex flex-col items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center max-w-md px-6">
        <div
          style={{
            fontSize: 80, fontWeight: 900, letterSpacing: '-0.05em',
            color: 'var(--color-border)', lineHeight: 1, marginBottom: 8, userSelect: 'none',
          }}
        >
          404
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', marginBottom: 8 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft style={{ width: 15, height: 15 }} />
            Go Back
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            <Home style={{ width: 15, height: 15 }} />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
