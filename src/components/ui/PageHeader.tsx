interface Action {
  label: string
  icon?: React.ElementType
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

interface Props {
  title: string
  subtitle?: string
  actions?: Action[]
  breadcrumb?: string
  meta?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions, breadcrumb, meta }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        {breadcrumb && (
          <p
            style={{
              fontSize: 11,
              color: 'var(--color-indigo)',
              fontWeight: 600,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {breadcrumb}
          </p>
        )}
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#0F172A',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              marginTop: 4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {meta}
        {actions?.map(a => {
          const Icon = a.icon
          const cls  = a.variant === 'secondary' ? 'btn btn-secondary'
                     : a.variant === 'danger'    ? 'btn btn-danger'
                     : 'btn btn-primary'
          return (
            <button key={a.label} onClick={a.onClick} className={cls}>
              {Icon && <Icon style={{ width: 15, height: 15 }} />}
              {a.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
