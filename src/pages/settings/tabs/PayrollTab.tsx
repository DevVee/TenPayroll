// ─── Settings → Payroll Settings tab ──────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { loadCompanySettings, apiSaveCompanySettings } from '../../../lib/db'
import type { CompanySettings } from '../../../types'
import { SectionHeader, NumField } from './_shared'

export function PayrollTab() {
  const { data: loaded, isLoading } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn:  loadCompanySettings,
    staleTime: 5 * 60 * 1000,
  })

  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [saved,    setSaved]    = useState(false)
  const [saveErr,  setSaveErr]  = useState('')
  const [saving,   setSaving]   = useState(false)

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
          <SectionHeader>Pay Frequency Default</SectionHeader>
          <div>
            <label className="form-label">Default Pay Frequency</label>
            <select
              className="input-base"
              value={settings.defaultFrequency ?? 'bi-monthly'}
              onChange={e => update({ defaultFrequency: e.target.value as CompanySettings['defaultFrequency'] })}
            >
              <option value="bi-monthly">Bi-Monthly (Semi-Monthly)</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              New employees will default to this frequency.
            </p>
          </div>
          <div className="p-3 text-xs rounded" style={{ background: 'var(--color-warning-bg)', border: '1px solid #FED7AA', color: 'var(--color-warning)' }}>
            Government deductions (SSS, PhilHealth, Pag-IBIG) are monthly amounts divided by pay frequency
            (÷4 weekly, ÷2 semi-monthly). OT multipliers are configured in Deduction Rules.
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <SectionHeader>Leave Credits (Annual)</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Vacation Leave (days)"
              value={settings.vacationLeaveCredits ?? 15}
              onChange={v => update({ vacationLeaveCredits: v })}
            />
            <NumField
              label="Sick Leave (days)"
              value={settings.sickLeaveCredits ?? 15}
              onChange={v => update({ sickLeaveCredits: v })}
            />
            <NumField
              label="Emergency Leave (days)"
              value={settings.emergencyLeaveCredits ?? 3}
              onChange={v => update({ emergencyLeaveCredits: v })}
            />
          </div>
          <div className="p-3 text-xs rounded" style={{ background: 'var(--color-warning-bg)', border: '1px solid #FDE68A', color: 'var(--color-warning)' }}>
            Minimum 5 days SIL (Service Incentive Leave) required by PH Labor Code for employees with ≥ 1 year tenure.
          </div>
        </div>
      </div>
    </div>
  )
}
