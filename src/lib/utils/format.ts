// ─── Formatting utilities ──────────────────────────────────────────────────────

// ── Currency ──────────────────────────────────────────────────────────────────
export function formatPeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

// ── Dates ─────────────────────────────────────────────────────────────────────
export function formatDate(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-PH', opts)
}

export function formatShortDate(d: string | Date): string {
  return formatDate(d, { month: 'short', day: 'numeric' })
}

export function formatLongDate(d: string | Date): string {
  return formatDate(d, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return formatShortDate(iso)
}

// ── Duration ──────────────────────────────────────────────────────────────────
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Names ─────────────────────────────────────────────────────────────────────
export function initials(name: string, max = 2): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, max)
    .toUpperCase()
}

// ── Avatar color from ID ───────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  '#4F46E5','#7C3AED','#059669','#D97706',
  '#DC2626','#0891B2','#BE185D','#0D9488',
  '#2563EB','#B45309','#16A34A','#9333EA',
]
export function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

// ── Text ──────────────────────────────────────────────────────────────────────
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
}

export function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export function pluralize(n: number, word: string, plural?: string): string {
  return `${n} ${n === 1 ? word : (plural ?? word + 's')}`
}
