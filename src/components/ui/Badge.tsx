type Variant = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple' | 'indigo' | 'orange' | 'teal' | 'pink' | 'amber'

const PILL_CLASS: Record<Variant, string> = {
  blue:   'pill pill-blue',
  green:  'pill pill-green',
  yellow: 'pill pill-yellow',
  red:    'pill pill-red',
  gray:   'pill pill-gray',
  purple: 'pill pill-purple',
  indigo: 'pill pill-indigo',
  orange: 'pill pill-orange',
  teal:   'pill pill-teal',
  pink:   'pill pill-pink',
  amber:  'pill pill-amber',
}

export function Badge({ variant = 'gray', children }: { variant?: Variant; children: React.ReactNode }) {
  return (
    <span className={PILL_CLASS[variant]}>
      {children}
    </span>
  )
}
