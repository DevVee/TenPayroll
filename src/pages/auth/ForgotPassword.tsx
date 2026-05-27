import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { brand } from '../../config/brand'

export function ForgotPassword() {
  const navigate  = useNavigate()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [sent,    setSent]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/reset-password` },
      )
      if (err) throw err
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#F8FAFC' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: '100%', maxWidth: 400 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <img src={brand.logoUrl} alt={brand.appName} style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>{brand.appName}</p>
        </div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: '#FEF2F2', margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: '#DC2626' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 8, letterSpacing: '-0.03em' }}>
                Check your email
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, marginBottom: 24 }}>
                We've sent a password reset link to <strong>{email}</strong>.
                It may take a minute to arrive — also check your spam folder.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="btn btn-primary w-full"
                style={{ height: 42, fontSize: 14.5, fontWeight: 600 }}
              >
                Back to Sign In
              </button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-8">
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.04em', marginBottom: 6 }}>
                  Reset your password
                </h2>
                <p style={{ fontSize: 14, color: '#64748B' }}>
                  Enter your email and we'll send you a link to get back in.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Email address</label>
                  <div className="relative">
                    <Mail style={{
                      position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                      width: 15, height: 15, color: '#94A3B8', pointerEvents: 'none',
                    }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="input-base"
                      style={{ paddingLeft: 36 }}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="alert-danger"
                      style={{ fontSize: 13 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full"
                  style={{ height: 42, fontSize: 14.5, fontWeight: 600 }}
                >
                  {loading
                    ? <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                    : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-1.5 transition-colors"
                  style={{ fontSize: 13, color: '#64748B', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#64748B')}
                >
                  <ArrowLeft style={{ width: 14, height: 14 }} />
                  Back to Sign In
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
