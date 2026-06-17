import { useState } from 'react'
import { Shield, CalendarDays } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { useData } from '../../hooks/useData'
import { apiGetAuditLogs } from '../../lib/db'

const ACTION_PILL: Record<string, string> = {
  login:    'pill pill-blue',
  logout:   'pill pill-gray',
  create:   'pill pill-green',
  update:   'pill pill-yellow',
  delete:   'pill pill-red',
  approve:  'pill pill-green',
  reject:   'pill pill-red',
  generate: 'pill pill-indigo',
}

const MODULE_OPTIONS = ['all','Employee','Attendance','Payroll','Leaves','Overtime','Shift','Holiday','Settings','Auth']

function dateN(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

export function AuditLog() {
  const [search,       setSearch]       = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [startDate,    setStartDate]    = useState(dateN(-30))
  const [endDate,      setEndDate]      = useState(dateN(0))

  const { data: logs, loading } = useData(() => apiGetAuditLogs(500), [])

  const filtered = (logs ?? []).filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !search
      || l.userName.toLowerCase().includes(q)
      || l.description.toLowerCase().includes(q)
      || l.action.toLowerCase().includes(q)
    const matchModule = moduleFilter === 'all' || l.module.toLowerCase() === moduleFilter.toLowerCase()
    const dateStr = l.timestamp.slice(0, 10)
    const matchDate = dateStr >= startDate && dateStr <= endDate
    return matchSearch && matchModule && matchDate
  })

  // Action summary
  const actionSummary = ['login','create','update','delete','approve']
    .map(a => ({ action: a, count: (logs ?? []).filter(l => l.action === a).length }))
    .filter(x => x.count > 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Log"
        subtitle="Complete system activity trail — every action is recorded"
      />

      {/* Activity summary chips */}
      {actionSummary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actionSummary.map(({ action, count }) => (
            <button
              key={action}
              onClick={() => setSearch(search === action ? '' : action)}
              className={`${ACTION_PILL[action] ?? 'pill pill-gray'} cursor-pointer transition-opacity hover:opacity-80`}
              style={{ opacity: search && search !== action ? 0.5 : 1 }}
            >
              {action.charAt(0).toUpperCase() + action.slice(1)}: {count}
            </button>
          ))}
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search user, action, description…"
            className="flex-1"
          />
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="input-base"
            style={{ width: '140px' }}
          >
            {MODULE_OPTIONS.map(t => (
              <option key={t} value={t}>{t === 'all' ? 'All Modules' : t}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              className="input-base"
              style={{ width: '140px' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span className="text-[11px] text-gray-400">–</span>
            <input
              type="date"
              className="input-base"
              style={{ width: '140px' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="spinner" />
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Shield className="w-8 h-8" style={{ color: 'var(--color-border-strong)' }} />
            <p className="text-sm text-gray-400">No audit records match your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: '16px' }}>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th className="hidden md:table-cell">Module</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.id}>
                      <td style={{ paddingLeft: '16px' }}>
                        <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                          {new Date(l.timestamp).toLocaleString('en-PH', {
                            month:'short', day:'numeric',
                            hour:'2-digit', minute:'2-digit', hour12:true,
                          })}
                        </span>
                      </td>
                      <td>
                        <p className="text-sm font-semibold text-gray-800 whitespace-nowrap leading-none">{l.userName}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{l.userId?.slice(0,8)}</p>
                      </td>
                      <td>
                        <span className={ACTION_PILL[l.action] ?? 'pill pill-gray'}>
                          {l.action}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-[11px] text-gray-500 font-medium">{l.module}</span>
                      </td>
                      <td style={{ maxWidth: '320px' }}>
                        <span className="text-sm text-gray-600 line-clamp-2">{l.description}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="flex items-center gap-1.5 px-4 py-2"
              style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
            >
              <Shield className="w-3 h-3 text-gray-300" />
              <span className="text-[11px] text-gray-400">
                {filtered.length} of {(logs ?? []).length} records
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
