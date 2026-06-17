interface Props {
  icon: React.ElementType
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'var(--color-indigo-light)',
          flexShrink: 0,
        }}
      >
        <Icon
          style={{
            width: 24,
            height: 24,
            color: 'var(--color-indigo)',
            opacity: 0.7,
          }}
        />
      </div>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#0F172A',
          letterSpacing: '-0.01em',
          marginBottom: 4,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 13,
            color: '#94A3B8',
            lineHeight: 1.6,
            maxWidth: 280,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary mt-5">
          {action.label}
        </button>
      )}
    </div>
  )
}
