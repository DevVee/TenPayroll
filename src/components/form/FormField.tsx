import { cn } from '../../lib/utils/cn'

interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <p style={{ fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
          {error}
        </p>
      )}
      {hint && !error && (
        <p style={{ fontSize: 12, color: '#94A3B8' }}>{hint}</p>
      )}
    </div>
  )
}

interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  collapsible?: boolean
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 4 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
          {title}
        </p>
        {description && (
          <p style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 2 }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

interface FormGridProps {
  cols?: 1 | 2 | 3 | 4
  children: React.ReactNode
  className?: string
}

export function FormGrid({ cols = 2, children, className }: FormGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }
  return (
    <div className={cn('grid gap-4', gridCols[cols], className)}>
      {children}
    </div>
  )
}
