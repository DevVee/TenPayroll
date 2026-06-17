import { useState, useEffect } from 'react'
import { LogIn, LogOut, Users } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Checkin = {
  id:          string
  employee_id: string
  full_name:   string
  department:  string | null
  type:        'time-in' | 'time-out'
  timestamp:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}

const AVATAR_PALETTE = ['#6366F1','#8B5CF6','#0EA5E9','#10B981','#F59E0B','#F43F5E']

function avatarColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RecentCheckins() {
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (cancelled) return
      try {
        const data = await window.kiosk.recentCheckins() as Checkin[]
        if (!cancelled) setCheckins(data)
      } catch { /* offline — keep stale list */ }
      if (!cancelled) setTimeout(load, 8_000)
    }

    load()
    // Re-render every 30 s so "time ago" labels stay current
    const tick = setInterval(() => setTick(t => t + 1), 30_000)
    return () => { cancelled = true; clearInterval(tick) }
  }, [])

  if (!checkins.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-700">
        <Users size={24} strokeWidth={1.5} />
        <p className="text-xs">No check-ins today</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {checkins.map(c => (
        <div
          key={c.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border:     '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: avatarColor(c.employee_id) }}
          >
            {initials(c.full_name)}
          </div>

          {/* Name + dept */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{c.full_name}</p>
            <p className="text-xs text-slate-600 truncate">{c.department ?? '—'}</p>
          </div>

          {/* Badge + timestamp */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={c.type === 'time-in'
                ? { background: 'rgba(16,185,129,0.14)', color: '#6EE7B7' }
                : { background: 'rgba(245,158,11,0.14)', color: '#FCD34D' }}
            >
              {c.type === 'time-in' ? <LogIn size={9} /> : <LogOut size={9} />}
              {c.type === 'time-in' ? 'In' : 'Out'}
            </span>
            <span className="text-xs text-slate-700">{timeAgo(c.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
