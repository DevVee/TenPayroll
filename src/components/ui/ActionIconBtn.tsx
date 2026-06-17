import type { LucideIcon } from 'lucide-react'

type Variant = 'view' | 'edit' | 'delete' | 'green' | 'gray' | 'purple' | 'orange'

const VARIANT_CLASS: Record<Variant, string> = {
  view:   'aib-view',
  edit:   'aib-edit',
  delete: 'aib-delete',
  green:  'aib-green',
  gray:   'aib-gray',
  purple: 'aib-purple',
  orange: 'aib-orange',
}

interface ActionIconBtnProps {
  variant:   Variant
  icon:      LucideIcon
  onClick:   (e: React.MouseEvent) => void
  title?:    string
  label?:    string       // optional visible text label beside icon
  disabled?: boolean
  size?:     number
}

export function ActionIconBtn({
  variant, icon: Icon, onClick, title, label, disabled, size = 15,
}: ActionIconBtnProps) {
  /* When a label is passed we render a wider pill-style button */
  if (label) {
    return (
      <button
        type="button"
        className={`action-icon-btn ${VARIANT_CLASS[variant]}`}
        onClick={onClick}
        title={title}
        disabled={disabled}
        style={{
          width: 'auto',
          padding: '0 12px',
          gap: 6,
          borderRadius: 9999,   // pill
          height: 34,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        <Icon style={{ width: size, height: size, flexShrink: 0 }} />
        {label}
      </button>
    )
  }

  /* Default — square icon button */
  return (
    <button
      type="button"
      className={`action-icon-btn ${VARIANT_CLASS[variant]}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <Icon style={{ width: size, height: size, flexShrink: 0 }} />
    </button>
  )
}
