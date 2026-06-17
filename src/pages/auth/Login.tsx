import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, Users, Clock, Banknote, BarChart2 } from 'lucide-react'
import { apiLogin } from '../../lib/db'
import { useAuthStore } from '../../store/authStore'
import { brand } from '../../config/brand'

const FEATURES = [
  { icon: Users,    label: 'Employee Management',  desc: 'Full HR profiles & department management' },
  { icon: Clock,    label: 'Attendance Tracking',  desc: 'Kiosk, PIN & RFID check-in/check-out'    },
  { icon: Banknote, label: 'Automated Payroll',    desc: 'PH-compliant payslips in minutes'         },
  { icon: BarChart2,label: 'Reports & Analytics',  desc: 'Workforce insights & cost breakdowns'     },
]

export function Login() {
  const navigate            = useNavigate()
  const { login, user, isLoading } = useAuthStore()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!isLoading && user) navigate(user.role === 'employee' ? '/me' : '/dashboard', { replace: true })
  }, [isLoading, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    try {
      const u = await apiLogin(email.trim().toLowerCase(), password)
      login(u)
      navigate(u.role === 'employee' ? '/me' : '/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ════════════════════════════════════════════════════════
          LEFT — Dark brand panel
          ════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[48%] flex-col relative overflow-hidden"
        style={{ background: '#0D1130' }}
      >
        {/* Subtle dot-grid texture */}
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.35,
            backgroundImage: 'radial-gradient(rgba(165,168,240,0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Ambient glow blobs */}
        <div style={{
          position: 'absolute', top: -120, left: -80,
          width: 440, height: 440,
          borderRadius: '50%',
          background: 'rgba(91,95,199,0.18)',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, right: -60,
          width: 360, height: 360,
          borderRadius: '50%',
          background: 'rgba(139,143,240,0.12)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Logo */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div
              style={{
                width: 48, height: 48,
                borderRadius: 14,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(91,95,199,0.2)',
                flexShrink: 0,
              }}
            >
              <img
                src={brand.logoUrl}
                alt={brand.appName}
                style={{ width: 36, height: 36, objectFit: 'contain' }}
              />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {brand.appName}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(165,168,240,0.7)', fontWeight: 500, marginTop: 2 }}>
                HR & Payroll Platform
              </p>
            </div>
          </motion.div>

          {/* Hero headline */}
          <motion.div
            className="mt-auto mb-8"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.04em',
                lineHeight: 1.13,
                marginBottom: 16,
              }}
            >
              Smarter payroll<br />
              for growing{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #A5A8F0, #C7C9FA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                teams.
              </span>
            </h1>
            <p
              style={{
                fontSize: 15,
                color: 'rgba(165,168,240,0.65)',
                lineHeight: 1.65,
                maxWidth: 360,
              }}
            >
              Everything your HR team needs — attendance, payroll,
              leaves, and compliance — in one clean workspace.
            </p>
          </motion.div>

          {/* Feature list */}
          <motion.div
            className="flex flex-col gap-4 mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.22 }}
          >
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.28 + i * 0.06 }}
              >
                {/* Icon square */}
                <div
                  style={{
                    width: 38, height: 38,
                    borderRadius: 10,
                    background: 'rgba(91,95,199,0.18)',
                    border: '1px solid rgba(165,168,240,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <f.icon style={{ width: 16, height: 16, color: '#A5A8F0' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', letterSpacing: '-0.015em', lineHeight: 1 }}>
                    {f.label}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(165,168,240,0.55)', marginTop: 3 }}>
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Footer */}
          <p style={{ fontSize: 11, color: 'rgba(165,168,240,0.3)', letterSpacing: '-0.01em' }}>
            © {new Date().getFullYear()} {brand.appName} · Built for the Philippines
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          RIGHT — Login form
          ════════════════════════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12"
        style={{ background: 'var(--color-bg)' }}
      >
        <motion.div
          style={{ width: '100%', maxWidth: 420 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img
              src={brand.logoUrl}
              alt={brand.appName}
              style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }}
            />
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
              {brand.appName}
            </p>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.04em',
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', letterSpacing: '-0.01em' }}>
              Sign in to your {brand.appName} workspace
            </p>
          </div>

          {/* Form card */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 20,
              padding: '32px 28px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Email */}
              <div>
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-base"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-base"
                    style={{ paddingRight: 44 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position: 'absolute', right: 13, top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPw
                      ? <EyeOff style={{ width: 15, height: 15 }} />
                      : <Eye    style={{ width: 15, height: 15 }} />
                    }
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="alert alert-danger"
                    style={{ fontSize: 13 }}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
                style={{ height: 44, fontSize: 15, marginTop: 4, gap: 8 }}
              >
                {loading ? (
                  <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                ) : (
                  <>
                    Sign in
                    <ArrowRight style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Kiosk link */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={() => navigate('/kiosk')}
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'color 0.13s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-primary)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)')}
            >
              Go to Employee Kiosk →
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
