// ─── User Management ─────────────────────────────────────────────────────────
// Create, view, and manage HR staff accounts — with per-user permission matrix.
//
// HOW USER CREATION WORKS (no Supabase Dashboard needed):
//   1. Admin fills in name, email, password, role, and optional permission tweaks.
//   2. A "ephemeral" Supabase client (persistSession: false) creates the auth user
//      so the current admin session is completely unaffected.
//   3. A profile row is upserted with role + permissions JSONB.
//   4. The new user can log in immediately.
//
// PREREQUISITE: Disable "Enable email confirmations" in Supabase Dashboard
//   → Authentication → Configuration → Email Auth → Confirm email → OFF.
//
// SCHEMA: Run supabase/migrations/008_add_email_to_profiles.sql before use.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Users, Pencil, Shield, Eye, EyeOff,
  Check, AlertCircle, X, UserPlus, RefreshCw,
  Trash2, Search, Plus,
} from 'lucide-react'
import { PageHeader }     from '../../components/ui/PageHeader'
import { Modal }          from '../../components/ui/Modal'
import { ActionIconBtn }  from '../../components/ui/ActionIconBtn'
import { supabase }       from '../../lib/supabase'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/config/backend'
import { useAuthStore }   from '../../store/authStore'
import { ROLE_LABELS, ROLE_PILL_COLORS } from '../../config/nav'
import { avatarColor }    from '../../lib/utils/format'
import { humanizeError }  from '../../lib/supabase'
import type { UserRole, UserPermissions } from '../../types'
import { ROLE_PERMISSION_PRESETS } from '../../types'

// ── Ephemeral client — used ONLY for signUp so the admin session is untouched ─
const _ephemeral = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

interface Profile {
  id:           string
  name:         string
  email?:       string
  role:         UserRole
  role_label?:  string     // custom role display name (from role_templates)
  department?:  string
  employee_id?: string
  permissions?: UserPermissions
  created_at?:  string
}

interface RoleTemplate {
  id:          string
  slug:        string
  label:       string
  description: string | null
  permissions: UserPermissions
  sort_order:  number
  created_at:  string
}

const ROLE_DESC: Record<string, string> = {
  'super-admin':     'Full access — all modules, settings, user management',
  'hr-admin':        'Employee CRUD, attendance, leaves, overtime, reports',
  'payroll-officer': 'Payroll generation, review, approval, reports',
  'dept-head':       'View team attendance, leaves, OT; approve leave & OT; read payroll',
  'employee':        'Self-service: own payslips, file leave requests',
}

/* ─── Role module access list — used by RolesSection + profile view ─────────── */
const ROLE_MODULE_LIST: {
  module:    string
  iconColor: string
  permKeys:  { label: string; key: keyof UserPermissions }[]
}[] = [
  { module: 'Employees', iconColor: '#059669', permKeys: [
      { label: 'view', key: 'emp_view'    }, { label: 'add',      key: 'emp_create'     },
      { label: 'edit', key: 'emp_edit'    }, { label: 'delete',   key: 'emp_delete'     },
    ]},
  { module: 'Attendance', iconColor: '#7C3AED', permKeys: [
      { label: 'view', key: 'att_view'    }, { label: 'mark',     key: 'att_mark'       },
      { label: 'edit', key: 'att_edit'    },
    ]},
  { module: 'Leaves', iconColor: '#EA580C', permKeys: [
      { label: 'view', key: 'leave_view'  }, { label: 'approve',  key: 'leave_approve'  },
    ]},
  { module: 'Overtime', iconColor: '#0284C7', permKeys: [
      { label: 'view', key: 'ot_view'     }, { label: 'approve',  key: 'ot_approve'     },
    ]},
  { module: 'Payroll', iconColor: '#16A34A', permKeys: [
      { label: 'view', key: 'pay_view'    }, { label: 'generate', key: 'pay_generate'   },
      { label: 'approve', key: 'pay_approve' }, { label: 'delete', key: 'pay_delete'    },
    ]},
  { module: 'Reports', iconColor: '#9333EA', permKeys: [
      { label: 'view', key: 'reports_view' },
    ]},
  { module: 'Settings', iconColor: '#475569', permKeys: [
      { label: 'view', key: 'settings_view' }, { label: 'edit', key: 'settings_edit'   },
    ]},
  { module: 'Users', iconColor: '#334155', permKeys: [
      { label: 'view', key: 'users_view'  }, { label: 'add',      key: 'users_create'   },
      { label: 'edit', key: 'users_edit'  },
    ]},
]

/* ─── Shared permission-matrix form — used by Create + Edit role modals ──────── */
function TemplateForm({
  value,
  onChange,
}: {
  value: { label: string; description: string; permissions: UserPermissions }
  onChange: (v: typeof value) => void
}) {
  const patch = (p: Partial<typeof value>) => onChange({ ...value, ...p })
  const clearAll = () => patch({
    permissions: Object.fromEntries(
      Object.keys(value.permissions).map(k => [k, false])
    ) as unknown as UserPermissions,
  })

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="form-label">Role Name <span className="text-red-500">*</span></label>
        <input
          className="input-base"
          value={value.label}
          onChange={e => patch({ label: e.target.value })}
          placeholder="e.g. Factory Supervisor, Finance Clerk, HR Clerk"
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="form-label">
          Description
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
        </label>
        <input
          className="input-base"
          value={value.description}
          onChange={e => patch({ description: e.target.value })}
          placeholder="What does this role do?"
        />
      </div>

      {/* Permission matrix */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
            Module Access
          </p>
          <button type="button" onClick={clearAll}
            style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            Clear all
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROLE_MODULE_LIST.map(m => (
            <div key={m.module}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: m.iconColor }}>
                  {m.module}
                </p>
                <button type="button"
                  onClick={() => {
                    const allOn = m.permKeys.every(pk => value.permissions[pk.key])
                    const update = { ...value.permissions }
                    m.permKeys.forEach(pk => { update[pk.key] = !allOn })
                    patch({ permissions: update })
                  }}
                  style={{ fontSize: 10, color: m.iconColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, opacity: 0.7 }}>
                  {m.permKeys.every(pk => value.permissions[pk.key]) ? 'none' : 'all'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {m.permKeys.map(pk => {
                  const on = !!value.permissions[pk.key]
                  return (
                    <label key={pk.key} style={{
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                      padding: '4px 10px', borderRadius: 7,
                      background: on ? m.iconColor + '18' : 'var(--color-surface-2)',
                      border: `1px solid ${on ? m.iconColor + '40' : 'var(--color-border)'}`,
                      fontSize: 11.5, fontWeight: 600,
                      color: on ? m.iconColor : 'var(--color-text-muted)',
                      transition: 'all 0.12s', userSelect: 'none',
                    }}>
                      <input type="checkbox" checked={on}
                        onChange={e => patch({ permissions: { ...value.permissions, [pk.key]: e.target.checked } })}
                        style={{ display: 'none' }} />
                      {on && <Check style={{ width: 10, height: 10, flexShrink: 0 }} />}
                      {pk.label}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export function UserManagement() {
  const { user } = useAuthStore()
  const [profiles,  setProfiles]  = useState<Profile[]>([])
  const [loading,   setLoading]   = useState(true)

  // Filter state
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    role: 'hr-admin' as string, department: '',
  })
  const [showPw,    setShowPw]    = useState(false)
  const [creating,  setCreating]  = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [createOk,  setCreateOk]  = useState('')

  // Edit modal
  const [editModal,  setEditModal]  = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [editRole,   setEditRole]   = useState<string>('employee')
  const [editPerms,  setEditPerms]  = useState<UserPermissions>({ ...ROLE_PERMISSION_PRESETS.employee })
  const [saving,     setSaving]     = useState(false)
  const [saveErr,    setSaveErr]    = useState('')

  // Tab: users list vs roles overview
  const [mainTab, setMainTab] = useState<'users'|'roles'>('users')

  // Custom role templates (DB-driven — the source of truth for all roles except super-admin)
  const [templates,        setTemplates]        = useState<RoleTemplate[]>([])
  const [tmplCreateOpen,   setTmplCreateOpen]   = useState(false)
  const [tmplForm,         setTmplForm]         = useState({
    label: '', description: '',
    permissions: { ...ROLE_PERMISSION_PRESETS.employee } as UserPermissions,
  })
  const [tmplSaving,       setTmplSaving]       = useState(false)
  const [tmplErr,          setTmplErr]          = useState('')
  const [tmplEditTarget,   setTmplEditTarget]   = useState<RoleTemplate | null>(null)
  const [tmplEditForm,     setTmplEditForm]     = useState({
    label: '', description: '',
    permissions: { ...ROLE_PERMISSION_PRESETS.employee } as UserPermissions,
  })
  const [tmplEditSaving,   setTmplEditSaving]   = useState(false)
  const [tmplEditErr,      setTmplEditErr]      = useState('')
  const [tmplDeleteTarget, setTmplDeleteTarget] = useState<RoleTemplate | null>(null)
  const [tmplDeleting,     setTmplDeleting]     = useState(false)
  const [tmplDeleteErr,    setTmplDeleteErr]    = useState('')

  // Delete modal
  const [deleteTarget,   setDeleteTarget]   = useState<Profile | null>(null)
  const [deleting,       setDeleting]       = useState(false)
  const [deleteErr,      setDeleteErr]      = useState('')

  // Profile view modal
  const [viewTarget, setViewTarget] = useState<Profile | null>(null)

  // Load error (surfaced so the user can diagnose missing columns / RLS issues)
  const [loadErr, setLoadErr] = useState('')

  const isSuper = user?.role === 'super-admin'

  const load = async () => {
    setLoading(true)
    setLoadErr('')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, role_label, department, employee_id, permissions')
      .order('name')
    if (error) {
      console.error('[UserManagement] Failed to load profiles:', error)
      setLoadErr(error.message)
    } else {
      setProfiles((data ?? []) as Profile[])
    }
    setLoading(false)
  }

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('role_templates')
      .select('*')
      .order('label')
    if (data) setTemplates(data as RoleTemplate[])
  }

  useEffect(() => { load(); loadTemplates() }, [])

  // Filtered profiles
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return profiles.filter(p => {
      const matchSearch = !search
        || p.name.toLowerCase().includes(q)
        || (p.email ?? '').toLowerCase().includes(q)
        || (p.department ?? '').toLowerCase().includes(q)
      const matchRole = roleFilter === 'all' || p.role === roleFilter
      return matchSearch && matchRole
    })
  }, [profiles, search, roleFilter])

  const setCreateRole = (r: string) => setForm(f => ({ ...f, role: r }))

  /* ── Create user ──────────────────────────────────────────────────────── */
  const handleCreate = async () => {
    setCreateErr(''); setCreateOk('')
    if (!form.name.trim())  { setCreateErr('Full name is required.'); return }
    if (!form.email.trim()) { setCreateErr('Email is required.'); return }
    if (!form.email.includes('@')) { setCreateErr('Enter a valid email address.'); return }
    if (form.password.length < 8)  { setCreateErr('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirmPassword) { setCreateErr('Passwords do not match.'); return }

    setCreating(true)
    try {
      const { data: signUpData, error: signUpErr } = await _ephemeral.auth.signUp({
        email:   form.email.trim().toLowerCase(),
        password: form.password,
        options: { data: { name: form.name.trim() } },
      })

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes('already registered') ||
            signUpErr.message.toLowerCase().includes('already been registered')) {
          throw new Error('An account with this email address already exists.')
        }
        throw new Error(signUpErr.message)
      }

      const newUserId = signUpData.user?.id
      if (!newUserId) throw new Error('Account created but user ID was not returned. Try refreshing.')

      // Look up selected template for permissions + label
      const selectedTmpl  = templates.find(t => t.slug === form.role)
      const rolePerms      = selectedTmpl?.permissions ?? ROLE_PERMISSION_PRESETS[form.role as UserRole] ?? {}
      const roleLabelVal   = selectedTmpl?.label ?? null

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id:              newUserId,
        name:            form.name.trim(),
        email:           form.email.trim().toLowerCase(),
        role:            form.role,
        role_label:      roleLabelVal,
        department:      form.department.trim() || null,
        permissions:     rolePerms,
        avatar_initials: form.name.trim().split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      }, { onConflict: 'id' })

      if (profileErr) throw new Error(`Account created but profile setup failed: ${profileErr.message}`)

      setCreateOk(`✓ Account created for ${form.name.trim()}. They can now log in.`)
      setForm({ name: '', email: '', password: '', confirmPassword: '', role: templates[0]?.slug ?? 'hr-admin', department: '' })
      await load()
    } catch (err) {
      setCreateErr(humanizeError(err))
    } finally {
      setCreating(false)
    }
  }

  const handleCloseCreate = () => {
    setCreateOpen(false)
    setCreateErr(''); setCreateOk('')
    setShowPw(false)
    setForm({ name: '', email: '', password: '', confirmPassword: '', role: templates[0]?.slug ?? 'hr-admin', department: '' })
  }

  /* ── Edit role + permissions ──────────────────────────────────────────── */
  const openEdit = (p: Profile) => {
    setEditTarget(p)
    setEditRole(p.role)
    // Merge template permissions with any per-user overrides already saved
    const tmplPerms = templates.find(t => t.slug === p.role)?.permissions ?? ROLE_PERMISSION_PRESETS[p.role as UserRole] ?? {}
    setEditPerms({ ...tmplPerms, ...(p.permissions ?? {}) })
    setSaveErr('')
    setEditModal(true)
  }

  const handleSaveRole = async () => {
    if (!editTarget) return
    setSaving(true); setSaveErr('')
    try {
      // Find the matching template to store its label (for display)
      const tmpl = templates.find(t => t.slug === editRole)
      const { error } = await supabase
        .from('profiles')
        .update({
          role:        editRole,
          permissions: editPerms,
          role_label:  tmpl ? tmpl.label : null,   // null = built-in / super-admin
        })
        .eq('id', editTarget.id)
      if (error) throw new Error(error.message)
      setEditModal(false)
      await load()
    } catch (err) {
      setSaveErr(humanizeError(err))
    } finally {
      setSaving(false)
    }
  }

  /* ── Custom role template CRUD ───────────────────────────────────────── */
  const handleCreateTemplate = async () => {
    setTmplErr('')
    if (!tmplForm.label.trim()) { setTmplErr('Role name is required.'); return }
    setTmplSaving(true)
    try {
      const slug = tmplForm.label.trim()
        .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60)
      const { error } = await supabase.from('role_templates').insert({
        slug,
        label:       tmplForm.label.trim(),
        description: tmplForm.description.trim() || null,
        permissions: tmplForm.permissions,
        created_by:  user?.name ?? 'admin',
      })
      if (error) throw new Error(error.message)
      setTmplCreateOpen(false)
      setTmplForm({ label: '', description: '', permissions: { ...ROLE_PERMISSION_PRESETS.employee } })
      await loadTemplates()
    } catch (err) { setTmplErr(humanizeError(err)) }
    finally { setTmplSaving(false) }
  }

  const openTmplEdit = (t: RoleTemplate) => {
    setTmplEditTarget(t)
    setTmplEditForm({ label: t.label, description: t.description ?? '', permissions: { ...t.permissions } })
    setTmplEditErr('')
  }

  const handleUpdateTemplate = async () => {
    if (!tmplEditTarget) return
    setTmplEditErr('')
    if (!tmplEditForm.label.trim()) { setTmplEditErr('Role name is required.'); return }
    setTmplEditSaving(true)
    try {
      const { error } = await supabase.from('role_templates').update({
        label:       tmplEditForm.label.trim(),
        description: tmplEditForm.description.trim() || null,
        permissions: tmplEditForm.permissions,
      }).eq('id', tmplEditTarget.id)
      if (error) throw new Error(error.message)
      setTmplEditTarget(null)
      await loadTemplates()
    } catch (err) { setTmplEditErr(humanizeError(err)) }
    finally { setTmplEditSaving(false) }
  }

  const handleDeleteTemplate = async () => {
    if (!tmplDeleteTarget) return
    setTmplDeleting(true); setTmplDeleteErr('')
    try {
      const { error } = await supabase.from('role_templates').delete().eq('id', tmplDeleteTarget.id)
      if (error) throw new Error(error.message)
      setTmplDeleteTarget(null)
      await loadTemplates()
    } catch (err) { setTmplDeleteErr(humanizeError(err)) }
    finally { setTmplDeleting(false) }
  }

  /* ── Delete user ──────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true); setDeleteErr('')
    try {
      // Delete profile (auth user cascade deletes via RLS/trigger)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteTarget.id)
      if (error) throw new Error(error.message)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setDeleteErr(humanizeError(err))
    } finally {
      setDeleting(false)
    }
  }

  const roleColor = (role: string) => ROLE_PILL_COLORS[role] ?? { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)' }

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        subtitle="Manage staff accounts and define what each role can access"
        actions={isSuper ? [
          ...(mainTab === 'users'  ? [{ label: 'Add User', icon: UserPlus, onClick: () => setCreateOpen(true) }] : []),
          ...(mainTab === 'roles'  ? [{ label: 'Add Role', icon: Plus,     onClick: () => { setTmplCreateOpen(true); setTmplErr('') } }] : []),
        ] : []}
      />

      {/* ── Tabs: Users | Roles & Permissions ── */}
      <div className="tab-bar">
        <button onClick={() => setMainTab('users')} className={`tab-btn ${mainTab === 'users' ? 'active' : ''}`}>
          <Users style={{ width: 13, height: 13 }} />
          Users
        </button>
        <button onClick={() => setMainTab('roles')} className={`tab-btn ${mainTab === 'roles' ? 'active' : ''}`}>
          <Shield style={{ width: 13, height: 13 }} />
          Roles &amp; Permissions
        </button>
      </div>

      {mainTab === 'roles' ? (<>

        {/* ── Unified roles grid: hardcoded super-admin + all DB templates ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>

          {/* Super Admin — always hardcoded, always first */}
          {(() => {
            const rc = ROLE_PILL_COLORS['super-admin'] ?? { bg: '#F5F3FF', text: '#7C3AED' }
            const count = profiles.filter(p => p.role === 'super-admin').length
            return (
              <div style={{
                background: rc.bg, border: `2px solid ${rc.text}30`,
                borderRadius: 14, padding: '20px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: rc.text + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Shield style={{ width: 20, height: 20, color: rc.text }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: rc.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        Super Admin
                      </p>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: rc.text + '20', color: rc.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        System
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: rc.text, marginTop: 3, opacity: 0.75 }}>
                      {count} user{count !== 1 ? 's' : ''} · All permissions · Cannot be modified
                    </p>
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  background: rc.text + '15', border: `1px solid ${rc.text}25`,
                }}>
                  <Check style={{ width: 13, height: 13, color: rc.text, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: rc.text, fontWeight: 600 }}>
                    Full access — all modules &amp; actions
                  </span>
                </div>
              </div>
            )
          })()}

          {/* All DB-backed roles (templates) */}
          {templates.map(t => {
            const rc = ROLE_PILL_COLORS[t.slug] ?? { bg: '#F1F5F9', text: '#475569' }
            const permCount = Object.values(t.permissions).filter(Boolean).length
            const activeModules = ROLE_MODULE_LIST.filter(m => m.permKeys.some(pk => t.permissions[pk.key]))
            const userCount = profiles.filter(p => p.role === t.slug).length
            return (
              <div key={t.id} style={{
                background: '#fff', border: '1px solid var(--color-border)',
                borderRadius: 14, padding: '20px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Shield style={{ width: 20, height: 20, color: rc.text }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {t.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                      {userCount} user{userCount !== 1 ? 's' : ''} · {permCount} permission{permCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isSuper && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => openTmplEdit(t)} title="Edit role"
                        style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)' }}>
                        <Pencil style={{ width: 11, height: 11 }} />
                      </button>
                      <button onClick={() => { setTmplDeleteTarget(t); setTmplDeleteErr('') }} title="Delete role"
                        style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', fontSize: 11, color: 'var(--color-danger)' }}>
                        <Trash2 style={{ width: 11, height: 11 }} />
                      </button>
                    </div>
                  )}
                </div>

                {t.description && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{t.description}</p>
                )}

                <div style={{ flex: 1 }}>
                  {activeModules.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No permissions assigned</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeModules.map(m => {
                        const enabledPerms = m.permKeys.filter(pk => t.permissions[pk.key])
                        return (
                          <div key={m.module}>
                            <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 5 }}>
                              {m.module}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {enabledPerms.map(pk => (
                                <span key={pk.key} style={{
                                  fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                                  background: m.iconColor + '18', color: m.iconColor, border: `1px solid ${m.iconColor}35`,
                                }}>
                                  {pk.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Empty state — only when no templates at all */}
          {templates.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              border: '2px dashed var(--color-border)', borderRadius: 14,
              padding: '32px 24px', textAlign: 'center', color: 'var(--color-text-muted)',
            }}>
              <Shield style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 13, fontWeight: 600 }}>No roles yet</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>
                Click <strong>Add Role</strong> at the top to create your first role.
              </p>
            </div>
          )}
        </div>

      </>) : (<>

      {/* ── Filter bar — Clinovia style ── */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search name, email, department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base"
              style={{ paddingLeft: 32, width: '100%' }}
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="input-base"
            style={{ width: 160 }}
          >
            <option value="all">All Roles</option>
            <option value="super-admin">Super Admin</option>
            {templates.map(t => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>

          {/* Clear */}
          {(search || roleFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setRoleFilter('all') }}
              className="btn btn-secondary"
              style={{ height: 36, padding: '0 12px' }}
            >
              <X style={{ width: 13, height: 13 }} />
              Clear
            </button>
          )}

          {/* Result count + refresh */}
          <div className="ml-auto flex items-center gap-2">
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {profiles.length} user{profiles.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={load}
              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}
              title="Refresh"
            >
              <RefreshCw style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Users table — Clinovia style ── */}
      <div className="card overflow-hidden">
        {loadErr ? (
          <div className="flex flex-col items-center py-10 gap-3 px-6">
            <AlertCircle style={{ width: 28, height: 28, color: 'var(--color-danger)', opacity: 0.7 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>Failed to load users</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
              {loadErr}
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
              If the error mentions an unknown column, make sure all Supabase migrations have been applied
              (especially <code style={{ fontFamily: 'monospace', background: 'var(--color-surface-2)', padding: '1px 4px', borderRadius: 4 }}>008_add_email_to_profiles.sql</code> and <code style={{ fontFamily: 'monospace', background: 'var(--color-surface-2)', padding: '1px 4px', borderRadius: 4 }}>011_custom_roles.sql</code>).
            </p>
            <button onClick={load} className="btn btn-secondary" style={{ marginTop: 4 }}>
              <RefreshCw style={{ width: 13, height: 13 }} />
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2" style={{ color: 'var(--color-border)' }}>
            <Users style={{ width: 28, height: 28 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {search || roleFilter !== 'all' ? 'No users match your filters.' : 'No user profiles found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base w-full">
              <thead>
                <tr>
                  <th style={{ width: 42, paddingLeft: 16 }}></th>
                  <th>Name</th>
                  <th style={{ width: 130 }}>Role</th>
                  <th className="hidden md:table-cell" style={{ width: 160 }}>Department</th>
                  <th className="hidden lg:table-cell" style={{ width: 140 }}>Permissions</th>
                  {isSuper && <th style={{ width: 80, textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const rc      = roleColor(p.role)
                  const isSelf  = p.id === user?.id
                  const avBg    = avatarColor(p.id)
                  const initials = p.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                  const preset  = ROLE_PERMISSION_PRESETS[p.role]
                  const perms   = { ...preset, ...(p.permissions ?? {}) }
                  const enabledCount = Object.values(perms).filter(Boolean).length

                  return (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setViewTarget(p)}
                    >
                      {/* Avatar */}
                      <td style={{ paddingLeft: 16 }}>
                        <div
                          style={{
                            width: 36, height: 36,
                            borderRadius: '50%',
                            background: avBg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff',
                            letterSpacing: '-0.02em',
                            flexShrink: 0,
                            boxShadow: '0 0 0 2px #fff, 0 0 0 3px rgba(91,95,199,0.2)',
                          }}
                        >
                          {initials}
                        </div>
                      </td>

                      {/* Name + email/dept */}
                      <td>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                          {p.name}
                          {isSelf && (
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 6, fontWeight: 400 }}>(you)</span>
                          )}
                        </p>
                        {(p.email || p.department) && (
                          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                            {p.email ?? p.department}
                          </p>
                        )}
                      </td>

                      {/* Role badge */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11, fontWeight: 700,
                          padding: '3px 10px', borderRadius: 99,
                          background: rc.bg, color: rc.text,
                          whiteSpace: 'nowrap',
                        }}>
                          {p.role_label ?? ROLE_LABELS[p.role] ?? p.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="hidden md:table-cell" style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {p.department ?? <span style={{ color: 'var(--color-border-strong)', opacity: 0.6 }}>—</span>}
                      </td>

                      {/* Permissions summary */}
                      <td className="hidden lg:table-cell">
                        {p.role === 'super-admin'
                          ? <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>All permissions</span>
                          : <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{enabledCount} of {Object.keys(perms).length} enabled</span>
                        }
                      </td>

                      {/* Actions */}
                      {isSuper && (
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {!isSelf && (
                              <>
                                <ActionIconBtn
                                  variant="edit"
                                  icon={Pencil}
                                  onClick={() => openEdit(p)}
                                  title="Edit role & permissions"
                                />
                                <ActionIconBtn
                                  variant="delete"
                                  icon={Trash2}
                                  onClick={() => { setDeleteTarget(p); setDeleteErr('') }}
                                  title="Delete user"
                                />
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && profiles.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-4 py-2"
            style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
          >
            <Users style={{ width: 12, height: 12, color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {profiles.length} total account{profiles.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      </>)}

      {/* ══ CREATE USER MODAL ════════════════════════════════════════════════ */}
      <Modal
        open={createOpen}
        onClose={handleCloseCreate}
        title="Create New User Account"
        footer={
          <>
            <button onClick={handleCloseCreate} className="btn btn-secondary">
              <X style={{ width: 13, height: 13 }} />Cancel
            </button>
            <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
              {creating
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                : <><UserPlus style={{ width: 13, height: 13 }} />Create Account</>
              }
            </button>
          </>
        }
      >
        <div className="space-y-4">

          {createOk && (
            <div className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'var(--color-success-bg)', border: '1px solid #BBF7D0', fontSize: 13, color: 'var(--color-success)' }}>
              <Check style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
              <span>{createOk}</span>
            </div>
          )}
          {createErr && (
            <div className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
              <span>{createErr}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="form-label">Full Name <span className="text-red-500">*</span></label>
            <input className="input-base" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Maria Santos" autoComplete="off" />
          </div>

          {/* Email */}
          <div>
            <label className="form-label">Email Address <span className="text-red-500">*</span></label>
            <input type="email" className="input-base" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@company.com" autoComplete="off" />
          </div>

          {/* Password */}
          <div>
            <label className="form-label">Temporary Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} className="input-base"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min. 8 characters" autoComplete="new-password"
                style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
            <p className="form-hint">Share this password with them. They can change it via Forgot Password.</p>
          </div>

          {/* Confirm password */}
          <div>
            <label className="form-label">Confirm Password <span className="text-red-500">*</span></label>
            <input type={showPw ? 'text' : 'password'} className="input-base"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Re-enter password" autoComplete="new-password"
              style={{ borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'var(--color-danger)' : undefined }} />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>Passwords do not match</p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="form-label">Department <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input className="input-base" value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              placeholder="e.g. Human Resources" />
          </div>

          {/* Role — dropdown + info panel */}
          <div>
            <label className="form-label">Role <span className="text-red-500">*</span></label>
            <select
              value={form.role}
              onChange={e => setCreateRole(e.target.value)}
              className="input-base"
            >
              <option value="super-admin">Super Admin</option>
              {templates.map(t => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
            {/* Dynamic role info panel */}
            {(() => {
              const rc = roleColor(form.role)
              const selectedTmpl = templates.find(t => t.slug === form.role)
              const descText = selectedTmpl?.description ?? ROLE_DESC[form.role] ?? ''
              const labelText = form.role === 'super-admin' ? 'Super Admin' : (selectedTmpl?.label ?? form.role)
              return (
                <div style={{
                  marginTop: 8, padding: '10px 14px', borderRadius: 10,
                  background: rc.bg, display: 'flex', alignItems: 'flex-start', gap: 10,
                  border: `1.5px solid ${rc.text}22`,
                }}>
                  <Shield style={{ width: 14, height: 14, color: rc.text, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: rc.text, marginBottom: 2 }}>{labelText}</p>
                    {descText && (
                      <p style={{ fontSize: 11.5, color: rc.text, opacity: 0.8, lineHeight: 1.5 }}>{descText}</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

        </div>
      </Modal>

      {/* ══ EDIT ROLE + PERMISSIONS MODAL ════════════════════════════════════ */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit Role & Permissions — ${editTarget?.name}`}
        footer={
          <>
            <button onClick={() => setEditModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSaveRole} disabled={saving} className="btn btn-primary">
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                : <><Shield style={{ width: 13, height: 13 }} />Save Changes</>
              }
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {saveErr && (
            <div className="flex items-center gap-2 p-3 rounded-lg"
              style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
              {saveErr}
            </div>
          )}

          {/* Role — DB-driven dropdown (all templates + super-admin) */}
          <div>
            <label className="form-label">Role</label>
            <select
              value={editRole}
              onChange={e => {
                const slug = e.target.value
                setEditRole(slug)
                // Load the template's permissions as default; super-admin gets none (always full)
                const tmpl = templates.find(t => t.slug === slug)
                if (tmpl) setEditPerms({ ...tmpl.permissions })
              }}
              className="input-base"
            >
              <option value="super-admin">Super Admin</option>
              {templates.map(t => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
            {/* Role info panel */}
            {(() => {
              const rc = roleColor(editRole)
              const selectedTmpl = templates.find(t => t.slug === editRole)
              const descText = selectedTmpl?.description ?? ROLE_DESC[editRole] ?? ''
              const labelText = editRole === 'super-admin' ? 'Super Admin' : (selectedTmpl?.label ?? editRole)
              return (
                <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: rc.bg, display: 'flex', alignItems: 'flex-start', gap: 10, border: `1.5px solid ${rc.text}22` }}>
                  <Shield style={{ width: 14, height: 14, color: rc.text, flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: rc.text, marginBottom: 2 }}>{labelText}</p>
                    {descText && <p style={{ fontSize: 11.5, color: rc.text, opacity: 0.8, lineHeight: 1.5 }}>{descText}</p>}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── Permission Matrix ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                Permissions
              </p>
              {editRole !== 'super-admin' && (
                <button
                  type="button"
                  onClick={() => {
                    const tmpl = templates.find(t => t.slug === editRole)
                    if (tmpl) setEditPerms({ ...tmpl.permissions })
                  }}
                  style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Reset to role defaults
                </button>
              )}
            </div>

            {editRole === 'super-admin' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--color-success-bg)', border: '1px solid #BBF7D0' }}>
                <Check style={{ width: 13, height: 13, color: 'var(--color-success)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>
                  Super Admin has all permissions — no overrides needed
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ROLE_MODULE_LIST.map(m => (
                  <div key={m.module}>
                    <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: m.iconColor, marginBottom: 6 }}>
                      {m.module}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {m.permKeys.map(pk => {
                        const on = !!editPerms[pk.key]
                        return (
                          <label key={pk.key} style={{
                            display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                            padding: '4px 10px', borderRadius: 7,
                            background: on ? m.iconColor + '18' : 'var(--color-surface-2)',
                            border: `1px solid ${on ? m.iconColor + '40' : 'var(--color-border)'}`,
                            fontSize: 11.5, fontWeight: 600,
                            color: on ? m.iconColor : 'var(--color-text-muted)',
                            transition: 'all 0.12s', userSelect: 'none',
                          }}>
                            <input type="checkbox" checked={on}
                              onChange={e => setEditPerms(prev => ({ ...prev, [pk.key]: e.target.checked }))}
                              style={{ display: 'none' }} />
                            {on && <Check style={{ width: 10, height: 10, flexShrink: 0 }} />}
                            {pk.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </Modal>

      {/* ══ USER PROFILE VIEW MODAL — Clinovia style ════════════════════════ */}
      <Modal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title="User Profile"
        footer={
          <div className="flex items-center justify-between w-full">
            <button onClick={() => setViewTarget(null)} className="btn btn-secondary">
              Close
            </button>
            {isSuper && viewTarget && viewTarget.id !== user?.id && (
              <button
                onClick={() => { openEdit(viewTarget); setViewTarget(null) }}
                className="btn btn-primary"
              >
                <Pencil style={{ width: 13, height: 13 }} />
                Edit Role
              </button>
            )}
          </div>
        }
      >
        {viewTarget && (() => {
          const avBg    = avatarColor(viewTarget.id)
          const initials = viewTarget.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          const rc      = roleColor(viewTarget.role)
          const preset  = ROLE_PERMISSION_PRESETS[viewTarget.role]
          const activeModules = ROLE_MODULE_LIST.filter(m => m.permKeys.some(pk => preset[pk.key]))

          return (
            <div className="space-y-4">
              {/* ── Top: Profile card (avatar centered + name + role) ── */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(91,95,199,0.06) 0%, rgba(91,95,199,0.02) 100%)',
                  borderRadius: 16,
                  padding: '28px 24px 20px',
                  textAlign: 'center',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Large avatar */}
                <div
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: avBg, margin: '0 auto 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, color: '#fff',
                    boxShadow: '0 0 0 3px #fff, 0 0 0 5px rgba(91,95,199,0.25), 0 6px 20px rgba(91,95,199,0.20)',
                  }}
                >
                  {initials}
                </div>

                {/* Name */}
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em', marginBottom: 4 }}>
                  {viewTarget.name}
                </p>

                {/* Email */}
                {viewTarget.email && (
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                    {viewTarget.email}
                  </p>
                )}

                {/* Role badge */}
                <span style={{
                  display: 'inline-block',
                  fontSize: 12, fontWeight: 700,
                  padding: '4px 14px', borderRadius: 999,
                  background: rc.bg, color: rc.text,
                }}>
                  {ROLE_LABELS[viewTarget.role] ?? viewTarget.role}
                </span>

                {/* Department */}
                {viewTarget.department && (
                  <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 10, fontWeight: 500 }}>
                    {viewTarget.department}
                  </p>
                )}
              </div>

              {/* ── Bottom: Role permissions — same style as Roles tab cards ── */}
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  What this role can access
                </p>

                {viewTarget.role === 'super-admin' ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 10,
                    background: rc.bg, border: `1px solid ${rc.text}30`,
                  }}>
                    <Check style={{ width: 14, height: 14, color: rc.text, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: rc.text }}>
                      Full access — all modules &amp; actions
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeModules.map(m => {
                      const enabled = m.permKeys.filter(pk => preset[pk.key])
                      return (
                        <div key={m.module}>
                          <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 5 }}>
                            {m.module}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enabled.map(pk => (
                              <span key={pk.key} style={{
                                fontSize: 10.5, fontWeight: 600,
                                padding: '2px 8px', borderRadius: 5,
                                background: m.iconColor + '18',
                                color: m.iconColor,
                                border: `1px solid ${m.iconColor}35`,
                              }}>
                                {pk.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ══ DELETE CONFIRM MODAL — Clinovia style ═══════════════════════════ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteErr('') }}
        title="Delete User Account"
        footer={
          <>
            <button onClick={() => { setDeleteTarget(null); setDeleteErr('') }} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger">
              {deleting
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</>
                : <><Trash2 style={{ width: 13, height: 13 }} />Delete User</>
              }
            </button>
          </>
        }
      >
        <div className="text-center py-2 space-y-3">
          {deleteTarget && (() => {
            const avBg    = avatarColor(deleteTarget.id)
            const initials = deleteTarget.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            return (
              <>
                <div
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: avBg, margin: '0 auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, color: '#fff',
                  }}
                >
                  {initials}
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                    {deleteTarget.name}
                  </p>
                  {deleteTarget.email && (
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {deleteTarget.email}
                    </p>
                  )}
                </div>
              </>
            )
          })()}

          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Are you sure you want to delete this user? This will remove their profile and they will no longer be able to sign in. <strong style={{ color: 'var(--color-danger)' }}>This cannot be undone.</strong>
          </p>

          {deleteErr && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-left"
              style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
              {deleteErr}
            </div>
          )}
        </div>
      </Modal>

      {/* ══ CREATE CUSTOM ROLE TEMPLATE MODAL ═══════════════════════════════ */}
      <Modal
        open={tmplCreateOpen}
        onClose={() => { setTmplCreateOpen(false); setTmplErr('') }}
        title="Create Custom Role"
        footer={
          <>
            <button onClick={() => { setTmplCreateOpen(false); setTmplErr('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={handleCreateTemplate} disabled={tmplSaving} className="btn btn-primary">
              {tmplSaving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                : <><Shield style={{ width: 13, height: 13 }} />Create Role</>
              }
            </button>
          </>
        }
      >
        {tmplErr && (
          <div className="flex items-center gap-2 p-3 mb-3 rounded-lg"
            style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
            <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />{tmplErr}
          </div>
        )}
        <TemplateForm value={tmplForm} onChange={setTmplForm} />
      </Modal>

      {/* ══ EDIT CUSTOM ROLE TEMPLATE MODAL ═════════════════════════════════ */}
      {tmplEditTarget && (
        <Modal
          open={!!tmplEditTarget}
          onClose={() => setTmplEditTarget(null)}
          title={`Edit Role — ${tmplEditTarget.label}`}
          footer={
            <>
              <button onClick={() => setTmplEditTarget(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleUpdateTemplate} disabled={tmplEditSaving} className="btn btn-primary">
                {tmplEditSaving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                  : <><Shield style={{ width: 13, height: 13 }} />Save Changes</>
                }
              </button>
            </>
          }
        >
          {tmplEditErr && (
            <div className="flex items-center gap-2 p-3 mb-3 rounded-lg"
              style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />{tmplEditErr}
            </div>
          )}
          <TemplateForm value={tmplEditForm} onChange={setTmplEditForm} />
        </Modal>
      )}

      {/* ══ DELETE CUSTOM ROLE TEMPLATE MODAL ═══════════════════════════════ */}
      <Modal
        open={!!tmplDeleteTarget}
        onClose={() => { setTmplDeleteTarget(null); setTmplDeleteErr('') }}
        title="Delete Custom Role"
        footer={
          <>
            <button onClick={() => { setTmplDeleteTarget(null); setTmplDeleteErr('') }} className="btn btn-secondary">Cancel</button>
            <button onClick={handleDeleteTemplate} disabled={tmplDeleting} className="btn btn-danger">
              {tmplDeleting
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</>
                : <><Trash2 style={{ width: 13, height: 13 }} />Delete Role</>
              }
            </button>
          </>
        }
      >
        <div className="text-center py-2 space-y-3">
          <Shield style={{ width: 40, height: 40, margin: '0 auto', color: 'var(--color-text-muted)', opacity: 0.5 }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{tmplDeleteTarget?.label}</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Deleting this role template will not affect users already assigned to it — their permissions will remain unchanged. The template will no longer appear in the role picker.
            <strong style={{ color: 'var(--color-danger)', display: 'block', marginTop: 6 }}>This cannot be undone.</strong>
          </p>
          {tmplDeleteErr && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-left"
              style={{ background: 'var(--color-danger-bg)', border: '1px solid #FECACA', fontSize: 13, color: 'var(--color-danger)' }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />{tmplDeleteErr}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
