import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { brand } from '../../config/brand'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [done,        setDone]        = useState(false)
  const [validSession,setValidSession]= useState(false)
  const [checking,    setChecking]    = useState(true)

  // Supabase sends the token in the URL hash — getSession() picks it up automatically.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 3000)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2.5 }} />
      </div>
    )
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
        <div className="text-center" style={{ maxWidth: 380 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Link expired or invalid</p>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>
            This reset link has already been used or has expired. Request a new one.
          </p>
          <button onClick={() => navigate('/forgot-password')} className="btn btn-primary">
            Request new link
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: '100%', maxWidth: 400 }}
      >
        <div className="flex items-center gap-2.5 mb-8">
          <img src={brand.logoUrl} alt={brand.appName} style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>{brand.appName}</p>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div style={{
                width: 56, height: 56, borderRadius: 16, background: '#FEF2F2',
                margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: '#DC2626' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 8, letterSpacing: '-0.03em' }}>
                Password updated
              </h2>
              <p style={{ fontSize: 14, color: '#64748B' }}>Redirecting you to sign in…</p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-8">
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.04em', marginBottom: 6 }}>
                  Set new password
                </h2>
                <p style={{ fontSize: 14, color: '#64748B' }}>Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="input-base"
                      style={{ paddingRight: 44 }}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    className="input-base"
                    autoComplete="new-password"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="alert-danger" style={{ fontSize: 13 }}>
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={loading} className="btn btn-primary w-full"
                  style={{ height: 42, fontSize: 14.5, fontWeight: 600 }}>
                  {loading
                    ? <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                    : 'Update Password'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
