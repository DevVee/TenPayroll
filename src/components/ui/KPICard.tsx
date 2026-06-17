import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  label: string
  value: string | number
  sub?: string
  badge?: string
  iconColor?: string
  icon: LucideIcon
  onClick?: () => void
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
}

export function KPICard({ label, value, sub, badge, iconColor = '#4F46E5', icon: Icon, onClick, trend }: Props) {
  // Build a 10% opacity hex background from the icon color
  const iconBg = iconColor + '1A'

  const TrendIcon =
    trend?.direction === 'up' ? TrendingUp :
    trend?.direction === 'down' ? TrendingDown :
    Minus

  const trendColor =
    trend?.direction === 'up'   ? '#059669' :
    trend?.direction === 'down' ? '#DC2626' :
    '#94A3B8'

  return (
    <div
      className="card-stat p-5 flex items-start gap-4"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* Icon container */}
      <div
        className="icon-circle flex-shrink-0"
        style={{
          width: 44,
          height: 44,
          background: iconBg,
        }}
      >
        <Icon style={{ width: 20, height: 20, color: iconColor }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#94A3B8',
            marginBottom: 4,
          }}
        >
          {label}
        </p>

        <div className="flex items-end gap-2 flex-wrap">
          <p
            className="tabular-nums"
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: '#0F172A',
              lineHeight: 1,
            }}
          >
            {value}
          </p>
          {badge && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 18,
                padding: '0 7px',
                borderRadius: 9999,
                fontSize: 10.5,
                fontWeight: 600,
                background: '#EEF2FF',
                color: '#4F46E5',
                marginBottom: 2,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        {sub && (
          <p
            style={{
              fontSize: 12,
              color: '#94A3B8',
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {sub}
          </p>
        )}

        {trend && (
          <div
            className="flex items-center gap-1 mt-2"
            style={{ fontSize: 11, fontWeight: 500, color: trendColor }}
          >
            <TrendIcon style={{ width: 12, height: 12 }} />
            <span>{trend.value}</span>
          </div>
        )}
      </div>
    </div>
  )
}
