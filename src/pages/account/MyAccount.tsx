// ─── My Account page ──────────────────────────────────────────────────────────
// Full-page version of the account editor — same width/layout as every other
// page in the app (max-w-[1400px] container set by AppLayout).
// Routes: /account
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, Check, AlertCircle,
  Eye, EyeOff, User, Lock,
} from 'lucide-react'
import { PageHeader }       from '../../components/ui/PageHeader'
import { supabase }         from '../../lib/supabase'
import { useAuthStore }     from '../../store/authStore'
import { avatarColor }      from '../../lib/utils/format'
import { humanizeError }    from '../../lib/supabase'
import {
  apiUpdateProfile,
  apiUpdatePassword,
  apiUploadAvatar,
} from '../../lib/_db/auth'

type Tab = 'profile' | 'security'

export function MyAccount() {
  const navigate              = useNavigate()
  const { user, refreshUser } = useAuthStore()

  const [tab, setTab] = useState<Tab>('profile')

  // ── Profile state ──────────────────────────────────────────────────────────
  const [name,          setName]          = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileErr,    setProfileErr]    = useState('')
  const [profileOk,     setProfileOk]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Security state ─────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwErr,     setPwErr]     = useState('')
  const [pwOk,      setPwOk]      = useState('')

  // Sync name from store on mount
  useEffect(() => { if (user) setName(user.name) }, [user?.id])

  if (!user) return null

  const avBg      = avatarColor(user.id)
  const initials  = user.avatarInitials
  const avatarSrc = avatarPreview ?? user.avatarUrl ?? null

  // ── Profile handlers ───────────────────────────────────────────────────────

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setProfileErr('Image must be under 2 MB.'); return }
    setProfileErr('')
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) { setProfileErr('Display name is required.'); return }
    setProfileSaving(true); setProfileErr(''); setProfileOk('')
    try {
      let avatarUrl: string | undefined
      if (avatarFile) avatarUrl = await apiUploadAvatar(user.id, avatarFile)
      await apiUpdateProfile(user.id, {
        name: name.trim(),
        ...(avatarUrl ? { avatarUrl } : {}),
      })
      await refreshUser()
      setAvatarFile(null)
      setAvatarPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      setProfileOk('Profile updated successfully.')
    } catch (err) {
      setProfileErr(humanizeError(err))
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Security handlers ──────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!currentPw)          { setPwErr('Current password is required.'); return }
    if (newPw.length < 8)    { setPwErr('New password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return }
    if (newPw === currentPw) { setPwErr('New password must differ from the current one.'); return }

    setPwSaving(true); setPwErr(''); setPwOk('')
    try {
      // Re-authenticate first to confirm identity
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: currentPw,
      })
      if (reAuthErr) throw new Error('Current password is incorrect.')

      await apiUpdatePassword(newPw)
      setPwOk('Password changed successfully.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwErr(humanizeError(err))
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <PageHeader
        title="My Account"
        subtitle="Update your profile photo, display name, and password"
        actions={[
          { label: 'Back', icon: ArrowLeft, variant: 'secondary', onClick: () => navigate(-1) },
        ]}
      />

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        <button
          onClick={() => setTab('profile')}
          className={`tab-btn ${tab === 'profile' ? 'active' : ''}`}
        >
          <User style={{ width: 13, height: 13 }} />
          Profile
        </button>
        <button
          onClick={() => setTab('security')}
          className={`tab-btn ${tab === 'security' ? 'active' : ''}`}
        >
          <Lock style={{ width: 13, height: 13 }} />
          Security
        </button>
      </div>

      {/* ══ PROFILE TAB ════════════════════════════════════════════════════════ */}
      {tab === 'profile' && (
        <div className="card p-6 max-w-lg">
          <div className="space-y-5">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Profile photo"
                    style={{
                      width: 96, height: 96,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #fff',
                      boxShadow: '0 0 0 3px var(--color-primary), 0 6px 20px rgba(91,95,199,0.2)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 96, height: 96, borderRadius: '50%',
                      background: avBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 32, fontWeight: 700, color: '#fff',
                      border: '3px solid #fff',
                      boxShadow: '0 0 0 3px var(--color-primary), 0 6px 20px rgba(91,95,199,0.2)',
                    }}
                  >
                    {initials}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="Change photo"
                  style={{
                    position: 'absolute', bottom: 2, right: 2,
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-primary)',
                    border: '3px solid #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  }}
                >
                  <Camera style={{ width: 14, height: 14, color: '#fff' }} />
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                JPG, PNG or WebP · Max 2 MB
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarSelect}
              />
            </div>

            {/* Display name */}
            <div>
              <label className="form-label">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                className="input-base"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            {/* Email — read-only */}
            <div>
              <label className="form-label">Email Address</label>
              <input
                className="input-base"
                value={user.email}
                readOnly
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text-muted)',
                  cursor: 'not-allowed',
                }}
              />
              <p className="form-hint">
                Email cannot be changed here — contact a Super Admin if needed.
              </p>
            </div>

            {/* Feedback */}
            {profileOk && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ background: 'var(--color-success-bg)', border: '1px solid #BBF7D0', fontSize: 13, color: 'var(--color-success)' }}
              >
                <Check style={{ width: 13, height: 13, flexShrink: 0 }} />
                {profileOk}
              </div>
            )}
            {profileErr && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}
              >
                <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
                {profileErr}
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="btn btn-primary"
            >
              {profileSaving ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
              ) : (
                <><Check style={{ width: 13, height: 13 }} />Save Profile</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══ SECURITY TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'security' && (
        <div className="card p-6 max-w-lg">
          <div className="space-y-5">

            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>
                Change Password
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Enter your current password to confirm your identity, then set a new one.
              </p>
            </div>

            {/* Current password */}
            <div>
              <label className="form-label">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-base"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  {showPw
                    ? <EyeOff style={{ width: 15, height: 15 }} />
                    : <Eye    style={{ width: 15, height: 15 }} />
                  }
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="form-label">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                className="input-base"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm new password */}
            <div>
              <label className="form-label">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                className="input-base"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                style={{
                  borderColor: confirmPw && newPw !== confirmPw
                    ? 'var(--color-danger)'
                    : undefined,
                }}
              />
              {confirmPw && newPw !== confirmPw && (
                <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Feedback */}
            {pwOk && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ background: 'var(--color-success-bg)', border: '1px solid #BBF7D0', fontSize: 13, color: 'var(--color-success)' }}
              >
                <Check style={{ width: 13, height: 13, flexShrink: 0 }} />
                {pwOk}
              </div>
            )}
            {pwErr && (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}
              >
                <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
                {pwErr}
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={pwSaving}
              className="btn btn-primary"
            >
              {pwSaving ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Updating…</>
              ) : (
                <><Lock style={{ width: 13, height: 13 }} />Update Password</>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
