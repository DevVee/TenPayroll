// ─── Settings shared sub-components ──────────────────────────────────────────
// Used by CompanyTab, DeductionsTab, PayrollTab, etc.
import { Check, X } from 'lucide-react'

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="section-title">{children}</h3>
}

export function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type={type} className="input-base" value={value}
        placeholder={placeholder} onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

export function NumField({
  label, value, onChange, step = 1, min = 0, max = 9999, hint,
}: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; max?: number; hint?: string
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type="number" step={step} min={min} max={max}
        className="input-base" value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-gray-400 mt-1" style={{ fontSize: 11 }}>{hint}</p>}
    </div>
  )
}

export function Toggle({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className="toggle-track"
        style={{ background: checked ? 'var(--color-primary)' : 'var(--color-border-strong)' }}
        onClick={() => onChange(!checked)}
      >
        <div className="toggle-thumb" style={{ left: checked ? '18px' : '2px' }} />
      </div>
      <span className="font-medium text-gray-700" style={{ fontSize: 13 }}>{label}</span>
      {checked
        ? <Check style={{ width: 13, height: 13, color: 'var(--color-success)', marginLeft: 'auto' }} />
        : <X    style={{ width: 13, height: 13, color: 'var(--color-border-strong)', marginLeft: 'auto' }} />
      }
    </label>
  )
}
