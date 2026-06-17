import { useState, useEffect } from 'react'

function pad(n: number) { return String(n).padStart(2, '0') }

export function Clock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months   = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December']

  const h   = now.getHours()
  const m   = pad(now.getMinutes())
  const s   = pad(now.getSeconds())
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12

  const dateStr = `${weekdays[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`

  return (
    <div className="text-center select-none">
      <div className="flex items-end justify-center gap-1">
        <span className="text-8xl font-black tracking-tighter text-white leading-none tabular-nums">
          {h12}:{m}
        </span>
        <div className="flex flex-col items-start mb-2 gap-1">
          <span className="text-3xl font-bold text-indigo-300 tabular-nums leading-none">{s}</span>
          <span className="text-xl font-semibold text-indigo-400 leading-none">{ampm}</span>
        </div>
      </div>
      <p className="mt-2 text-lg font-medium text-slate-400">{dateStr}</p>
    </div>
  )
}
