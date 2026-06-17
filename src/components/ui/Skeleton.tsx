import { cn } from '../../lib/utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: number | string
  height?: number | string
}

export function Skeleton({ className, style, width, height, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card p-5 space-y-4', className)}>
      <Skeleton height={20} width="40%" />
      <SkeletonText lines={3} />
    </div>
  )
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      {/* Header */}
      <div className="flex gap-4 px-5 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} width={i === 0 ? 100 : 80} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className="flex gap-4 px-5 py-3.5"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} height={14} width={ci === 0 ? '60%' : '40%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton height={22} width={200} />
          <Skeleton height={14} width={140} />
        </div>
        <Skeleton height={36} width={140} style={{ borderRadius: 8 }} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="card">
        <SkeletonTable />
      </div>
    </div>
  )
}
