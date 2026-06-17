// ─── Settings → Deduction Rules tab ───────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { loadDeductionSettings, apiSaveDeductionSettings } from '../../../lib/db'
import type { PayrollDeductionSettings } from '../../../types'
import { SectionHeader, NumField, Toggle } from './_shared'

export function DeductionsTab() {
  const { data: loaded, isLoading } = useQuery({
    queryKey: ['settings', 'deductions'],
    queryFn:  loadDeductionSettings,
    staleTime: 5 * 60 * 1000,
  })

  const [ds,      setDs]      = useState<PayrollDeductionSettings | null>(null)
  const [saved,   setSaved]   = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { if (loaded) setDs(loaded) }, [loaded])

  const up = (patch: Partial<PayrollDeductionSettings>) =>
    setDs(s => s ? { ...s, ...patch } : s)

  const handleSave = async () => {
    if (!ds) return
    setSaving(true); setSaveErr('')
    try {
      await apiSaveDeductionSettings(ds)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !ds)
    return <div className="flex justify-center py-10"><div className="spinner" /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Configure how deductions are calculated during payroll generation.
        </p>
        <div className="flex items-center gap-3">
          {saveErr && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{saveErr}</p>}
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Late */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Late Deduction</SectionHeader>
          <Toggle
            label="Enable Late Deduction"
            checked={ds.lateDeductionEnabled}
            onChange={v => up({ lateDeductionEnabled: v })}
          />
          {ds.lateDeductionEnabled && (
            <NumField
              label="Deduction Multiplier"
              value={ds.lateDeductionMultiplier}
              onChange={v => up({ lateDeductionMultiplier: v })}
              step={0.1} min={0} max={3}
              hint="Applied per minute late × (hourly rate ÷ 60). Default: 1.0"
            />
          )}
        </div>

        {/* Absence */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Absence Deduction</SectionHeader>
          <Toggle
            label="Enable Absence Deduction"
            checked={ds.absenceDeductionEnabled}
            onChange={v => up({ absenceDeductionEnabled: v })}
          />
          {ds.absenceDeductionEnabled && (
            <div>
              <label className="form-label">Deduction Method</label>
              <select
                className="input-base"
                value={ds.absenceDeductionType}
                onChange={e => up({ absenceDeductionType: e.target.value as PayrollDeductionSettings['absenceDeductionType'] })}
              >
                <option value="daily-rate">Full Daily Rate per Absent Day (no-work-no-pay)</option>
                <option value="zero">No deduction — paid leave policy</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {ds.absenceDeductionType === 'zero'
                  ? 'Absent days are counted as paid — employees receive full pay regardless of absences.'
                  : 'Absent days are excluded from pay — employee earns only for days worked + leave + holidays.'}
              </p>
            </div>
          )}
        </div>

        {/* Overtime */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Overtime Pay</SectionHeader>
          <Toggle
            label="Enable Overtime Pay"
            checked={ds.overtimeEnabled}
            onChange={v => up({ overtimeEnabled: v })}
          />
          {ds.overtimeEnabled && (
            <>
              <NumField
                label="Regular OT Multiplier"
                value={ds.overtimeMultiplierRegular}
                onChange={v => up({ overtimeMultiplierRegular: v })}
                step={0.05} min={1} max={3}
                hint="Standard PH Labor Code: 1.25×"
              />
              <NumField
                label="Rest Day OT Multiplier"
                value={ds.overtimeMultiplierRestDay}
                onChange={v => up({ overtimeMultiplierRestDay: v })}
                step={0.05} min={1} max={3}
                hint="Standard PH Labor Code: 1.30×"
              />
              <NumField
                label="OT Threshold (minutes)"
                value={ds.overtimeThresholdMinutes}
                onChange={v => up({ overtimeThresholdMinutes: v })}
                step={5} min={0} max={120}
                hint="Minutes after shift end before OT counting starts"
              />
            </>
          )}
        </div>

        {/* Night Differential */}
        <div className="card p-5 space-y-4">
          <SectionHeader>Night Differential</SectionHeader>
          <Toggle
            label="Enable Night Differential Pay"
            checked={ds.nightDiffEnabled}
            onChange={v => up({ nightDiffEnabled: v })}
          />
          {ds.nightDiffEnabled && (
            <NumField
              label="Night Diff Multiplier"
              value={ds.nightDiffMultiplier}
              onChange={v => up({ nightDiffMultiplier: v })}
              step={0.01} min={0} max={1}
              hint="Applied as % of hourly rate. PH Labor Code standard: 10% (0.10)"
            />
          )}

          <div className="card p-5 space-y-4">
            <SectionHeader>Working Days Divisor</SectionHeader>
            <NumField
              label="Working Days per Month"
              value={ds.workingDaysDivisor}
              onChange={v => up({ workingDaysDivisor: v })}
              step={1} min={20} max={31}
              hint="Used to convert monthly salary to daily rate. Common values: 22 (5-day week) or 26 (6-day week)."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
