import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, ArrowRight, ChevronDown } from 'lucide-react'
import { apiLogin } from '../../lib/db'
import { useAuthStore } from '../../store/authStore'

/* Pre-filled with Super Admin so visitors can just hit Sign In */
const DEFAULT_EMAIL = 'admin@acme.ph'
const DEFAULT_PASS  = 'admin123'

const DEMO_ACCOUNTS = [
  { label: 'Super Admin',     email: 'admin@acme.ph',          pass: 'admin123',   tag: 'Full access',          color: '#7C3AED' },
  { label: 'HR Admin',        email: 'maria.santos@acme.ph',   pass: 'hr123',      tag: 'HR & employees',       color: '#2563EB' },
  { label: 'Payroll Officer', email: 'ana.mendoza@acme.ph',    pass: 'payroll123', tag: 'Payroll processing',   color: '#0891B2' },
  { label: 'Dept Head',       email: 'eduardo.torres@acme.ph', pass: 'dept123',    tag: 'Department oversight', color: '#059669' },
]

export function Login() {
  const navigate  = useNavigate()
  const login     = useAuthStore(s => s.login)
  const [form,     setForm]     = useState({ email: DEFAULT_EMAIL, password: DEFAULT_PASS })
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showDemo, setShowDemo] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const user = await apiLogin(form.email, form.password)
      login(user)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh', display: 'flex', background: '#0A0F1C' }}>

      <style>{`
        .login-input:focus { border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; outline: none; }
        .login-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .demo-btn:hover { border-color: var(--c) !important; background: var(--bg) !important; }
        @keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }
      `}</style>

      {/* ══ LEFT — Screenshot panel ══════════════════════════════════════ */}
      <div
        className="hidden lg:block"
        style={{
          width: '58%', flexShrink: 0, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Dashboard screenshot fills the whole panel */}
        <img
          src="/dashboard.png"
          alt="Veltrix Dashboard"
          style={{
            width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left',
            filter: 'brightness(0.45)',
          }}
        />

        {/* Gradient overlay — darkens toward right so form reads cleanly */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, rgba(10,15,28,0.1) 0%, rgba(10,15,28,0.55) 70%, rgba(10,15,28,0.95) 100%)',
        }} />

        {/* Blue glow from bottom left */}
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Content over screenshot */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '44px 48px' }}>

          {/* Logo + back link */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
              <img src="/Veltrix.png" alt="Veltrix" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.035em', color: '#F8FAFC' }}>Veltrix</span>
            </div>
            <button
              onClick={() => navigate('/kiosk')}
              style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)')}
            >
              ← Employee Kiosk
            </button>
          </div>

          {/* Center text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 480 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.35)',
              borderRadius: 999, padding: '5px 14px', marginBottom: 24, alignSelf: 'flex-start',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: 'shimmer 2s infinite' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#93C5FD' }}>Live demo — full data included</span>
            </div>

            <h1 style={{ fontSize: 'clamp(32px,3.5vw,50px)', fontWeight: 900, letterSpacing: '-0.045em', color: '#F8FAFC', lineHeight: 1.05, marginBottom: 18 }}>
              Philippine HR &amp; Payroll<br />
              <span style={{ color: '#60A5FA' }}>that just works.</span>
            </h1>
            <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 0 }}>
              Sign in and explore the full system — employees, attendance, payroll runs, payslips, leave management, and more.
            </p>
          </div>

          {/* Bottom feature chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['SSS 2024', 'PhilHealth 5%', 'Pag-IBIG 2%', 'BIR TRAIN Law', 'RFID Kiosk'].map(t => (
              <div key={t} style={{
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
              }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ RIGHT — Login form ═══════════════════════════════════════════ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(32px,5vw,56px) clamp(24px,5vw,56px)',
        background: '#fff',
        position: 'relative',
        overflowY: 'auto',
      }}>

        {/* Mobile logo */}
        <div
          className="lg:hidden"
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <img src="/Veltrix.png" alt="Veltrix" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em', color: '#0D1B2A' }}>Veltrix</span>
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.035em', color: '#0D1B2A', marginBottom: 6 }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.5 }}>
              Sign in to your Veltrix workspace
            </p>
          </div>

          {/* Demo banner — prominent */}
          <div style={{
            padding: '11px 14px', borderRadius: 9,
            background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
            border: '1.5px solid #BFDBFE',
            marginBottom: 22,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>✓</span>
            </div>
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: '#1D4ED8', marginBottom: 2 }}>
                Demo credentials pre-filled
              </p>
              <p style={{ fontSize: 11.5, color: '#4B5563', lineHeight: 1.4 }}>
                Super Admin access · Just hit <strong>Sign In</strong> to explore the full system
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 9,
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 8, padding: '10px 13px', marginBottom: 16,
            }}>
              <AlertCircle style={{ width: 14, height: 14, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: '#991B1B' }}>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                className="login-input"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={{
                  width: '100%', height: 42, padding: '0 13px',
                  border: '1.5px solid #D1D5DB', borderRadius: 8,
                  fontSize: 14, color: '#0D1B2A', background: '#FAFAFA',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="login-input"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                  style={{
                    width: '100%', height: 42, padding: '0 42px 0 13px',
                    border: '1.5px solid #D1D5DB', borderRadius: 8,
                    fontSize: 14, color: '#0D1B2A', background: '#FAFAFA',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 0,
                  }}
                >
                  {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                height: 44, borderRadius: 9, border: 'none',
                background: loading ? '#93C5FD' : '#2563EB',
                color: '#fff', fontWeight: 700, fontSize: 14.5,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#1A3A8F'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(37,99,235,0.35)' } }}
              onMouseLeave={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#2563EB'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' } }}
            >
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  Signing in…
                </>
              ) : (
                <>Sign In <ArrowRight style={{ width: 15, height: 15 }} /></>
              )}
            </button>
          </form>

          {/* Try different account */}
          <div style={{ marginTop: 18, borderRadius: 9, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowDemo(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', background: '#F9FAFB', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Try a different role</span>
              <ChevronDown style={{
                width: 14, height: 14, color: '#9CA3AF',
                transform: showDemo ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }} />
            </button>

            {showDemo && (
              <div style={{ padding: '6px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {DEMO_ACCOUNTS.map(a => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => { setForm({ email: a.email, password: a.pass }); setError(''); setShowDemo(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                      padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 7,
                      background: '#fff', cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = a.color; el.style.background = `${a.color}0C` }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#E5E7EB'; el.style.background = '#fff' }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A', marginBottom: 1 }}>{a.label}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>{a.tag}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: a.color, background: `${a.color}15`, padding: '2px 8px', borderRadius: 999 }}>Select</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
            <p style={{ fontSize: 11.5, color: '#D1D5DB', marginBottom: 8 }}>
              All data is stored locally in your browser — nothing is sent to a server.
            </p>
            <p style={{ fontSize: 11.5, color: '#D1D5DB' }}>
              © {new Date().getFullYear()} Veltrix · Built for Filipino businesses
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
