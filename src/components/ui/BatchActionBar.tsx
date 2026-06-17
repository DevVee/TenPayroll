import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface BatchAction {
  label:     string
  onClick:   () => void
  disabled?: boolean
  variant?:  'primary' | 'danger' | 'warning' | 'success' | 'secondary'
  icon?:     React.ComponentType<{ style?: React.CSSProperties }>
}

interface BatchActionBarProps {
  count:    number
  noun?:    string          // e.g. "employee", "request" — pluralised automatically
  actions:  BatchAction[]
  onClear:  () => void
  children?: ReactNode     // optional extra slot
}

const VARIANT_STYLE: Record<string, React.CSSProperties> = {
  primary:   { background: 'var(--color-primary)',     color: '#fff' },
  danger:    { background: 'var(--color-danger)',       color: '#fff' },
  warning:   { background: 'var(--color-warning)',      color: '#fff' },
  success:   { background: 'var(--color-success)',      color: '#fff' },
  secondary: { background: 'var(--color-surface-2)',    color: 'var(--color-text)', border: '1px solid var(--color-border)' },
}

export function BatchActionBar({
  count,
  noun = 'item',
  actions,
  onClear,
  children,
}: BatchActionBarProps) {
  if (count === 0) return null
  const label = `${count} ${noun}${count !== 1 ? 's' : ''} selected`

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5"
      style={{
        background: 'var(--color-primary-light)',
        border:     '1px solid var(--color-primary-medium)',
        borderRadius: 10,
      }}
    >
      {/* Left: count */}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
        {label}
      </span>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {children}

        {actions.map(a => {
          const Icon = a.icon
          const v    = a.variant ?? 'primary'
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              className="inline-flex items-center gap-1.5 font-semibold transition-opacity"
              style={{
                ...VARIANT_STYLE[v],
                fontSize: 12,
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                border: VARIANT_STYLE[v].border ?? 'none',
                opacity: a.disabled ? 0.5 : 1,
                cursor: a.disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {Icon && <Icon style={{ width: 12, height: 12 }} />}
              {a.label}
            </button>
          )
        })}

        {/* Clear */}
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 font-medium"
          style={{
            fontSize: 12,
            height: 30,
            padding: '0 10px',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
        >
          <X style={{ width: 11, height: 11 }} />
          Clear
        </button>
      </div>
    </div>
  )
}
