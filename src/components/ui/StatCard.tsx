interface Props {
  label: string
  value: string | number
  sub?: string
  onClick?: () => void
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'purple'
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
}

const ACCENT = {
  blue:   { bar: '#1565C0', label: '#1565C0', bg: 'rgba(21,101,192,0.06)' },
  green:  { bar: '#15803D', label: '#15803D', bg: 'rgba(21,128,61,0.06)' },
  amber:  { bar: '#B45309', label: '#B45309', bg: 'rgba(180,83,9,0.06)' },
  red:    { bar: '#DC2626', label: '#DC2626', bg: 'rgba(220,38,38,0.06)' },
  purple: { bar: '#7C3AED', label: '#7C3AED', bg: 'rgba(124,58,237,0.06)' },
}

export function StatCard({ label, value, sub, onClick, accent = 'blue', trend }: Props) {
  const a = ACCENT[accent]

  return (
    <div
      className={`bg-white relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        border: '1px solid #E2E5EB',
        borderRadius: '6px',
        transition: onClick ? 'border-color 0.15s, box-shadow 0.15s' : undefined,
      }}
      onClick={onClick}
      onMouseEnter={onClick ? e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = '#CBD3DE'
        el.style.boxShadow = '0 2px 8px 0 rgba(0,0,0,0.06)'
      } : undefined}
      onMouseLeave={onClick ? e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = '#E2E5EB'
        el.style.boxShadow = 'none'
      } : undefined}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: a.bar, borderRadius: '6px 0 0 6px' }}
      />

      <div className="px-4 py-3 pl-5">
        <p className="data-label mb-1.5" style={{ color: '#9CA3AF' }}>{label}</p>
        <p
          className="tabular-nums leading-none font-bold"
          style={{ fontSize: '22px', color: '#111827' }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-gray-400 mt-1.5 leading-none">{sub}</p>
        )}
        {trend && (
          <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-semibold
            ${trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
            <span>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}</span>
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  )
}
