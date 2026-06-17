// ─── Settings → Company Info tab ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { loadCompanySettings, apiSaveCompanySettings } from '../../../lib/db'
import type { CompanySettings } from '../../../types'
import { SectionHeader, Field } from './_shared'

export function CompanyTab() {
  // ── Fetch from Supabase on mount (fixes sync-getter race condition) ──────────
  const { data: loaded, isLoading } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn:  loadCompanySettings,
    staleTime: 5 * 60 * 1000,
  })

  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [saved,    setSaved]    = useState(false)
  const [saveErr,  setSaveErr]  = useState('')
  const [saving,   setSaving]   = useState(false)

  // Populate form once data arrives (or when invalidation causes a refetch)
  useEffect(() => { if (loaded) setSettings(loaded) }, [loaded])

  const update = (patch: Partial<CompanySettings>) =>
    setSettings(s => s ? { ...s, ...patch } : s)

  const handleSave = async () => {
    if (!settings) return
    setSaving(true); setSaveErr('')
    try {
      await apiSaveCompanySettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !settings)
    return <div className="flex justify-center py-10"><div className="spinner" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        {saveErr && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{saveErr}</p>}
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <SectionHeader>Company Information</SectionHeader>
          <Field label="Company Name"  value={settings.name}    onChange={v => update({ name: v })} />
          <Field label="Address"       value={settings.address} onChange={v => update({ address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact No." value={settings.contact} onChange={v => update({ contact: v })} />
            <Field label="Email"       value={settings.email}   onChange={v => update({ email: v })} type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TIN"              value={settings.tin}            onChange={v => update({ tin: v })}           placeholder="000-000-000-000" />
            <Field label="SSS Employer No." value={settings.sssNo ?? ''}    onChange={v => update({ sssNo: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PhilHealth No." value={settings.philhealthNo ?? ''} onChange={v => update({ philhealthNo: v })} />
            <Field label="Pag-IBIG No."   value={settings.pagibigNo ?? ''}   onChange={v => update({ pagibigNo: v })} />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <SectionHeader>HR Contact</SectionHeader>
          <Field label="HR Officer Name" value={settings.hrOfficer ?? ''}     onChange={v => update({ hrOfficer: v })} />
          <Field label="HR Email"        value={settings.hrEmail ?? ''}        onChange={v => update({ hrEmail: v })} type="email" />
          <Field label="Payroll Officer" value={settings.payrollOfficer ?? ''} onChange={v => update({ payrollOfficer: v })} />
        </div>
      </div>
    </div>
  )
}
