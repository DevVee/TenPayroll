import { useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import { useData } from '../../hooks/useData'
import { apiGetHolidays, apiCreateHoliday, apiDeleteHoliday } from '../../lib/db'
import { useUIStore } from '../../store/uiStore'
import type { Holiday, HolidayType } from '../../types'

const TYPE_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  regular:              { label:'Regular',            bg:'var(--color-warning-bg)',  color:'var(--color-warning)',  border:'#FDE68A' },
  'special-non-working':{ label:'Special Non-Working',bg:'var(--color-primary-light)', color:'var(--color-primary)', border:'var(--color-primary-medium)' },
  'special-working':    { label:'Special Working',    bg:'var(--color-success-bg)', color:'var(--color-success)', border:'#A7F3D0' },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const DEFAULT_FORM = { name:'', date:'', type:'regular' as HolidayType, description:'' }

export function HolidayList() {
  const addToast = useUIStore(s => s.addToast)
  const { data: holidays, loading, refetch } = useData(() => apiGetHolidays(), [])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [search, setSearch] = useState('')

  const filtered = (holidays ?? []).filter(h =>
    h.date.startsWith(yearFilter) &&
    (!search || h.name.toLowerCase().includes(search.toLowerCase()))
  )
  const years = [...new Set((holidays ?? []).map(h => h.date.slice(0,4)))].sort().reverse()

  // Group by month
  const byMonth: Record<number, Holiday[]> = {}
  filtered.forEach(h => {
    const m = new Date(h.date).getMonth()
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(h)
  })

  const save = async () => {
    if (!form.name.trim() || !form.date) return
    setSaving(true)
    try {
      await apiCreateHoliday({
        name:         form.name,
        date:         form.date,
        type:         form.type,
        isNationwide: true,
        description:  form.description || undefined,
      })
      setModal(false)
      setForm(DEFAULT_FORM)
      refetch()
      addToast({ type: 'success', title: 'Holiday Added', message: `${form.name} (${form.date}) has been added to the calendar.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to Add Holiday', message: err instanceof Error ? err.message : 'Something went wrong.' })
    } finally { setSaving(false) }
  }

  const deleteHoliday = async (h: Holiday) => {
    setDeleting(true)
    try {
      await apiDeleteHoliday(h.id)
      setDeleteTarget(null)
      refetch()
      addToast({ type: 'success', title: 'Holiday Removed', message: `${h.name} has been removed from the calendar.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to Remove', message: err instanceof Error ? err.message : 'Something went wrong.' })
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Philippine Holidays"
        subtitle="Official holiday calendar for payroll computation"
        actions={[{ label:'Add Holiday', icon:Plus, onClick:() => setModal(true) }]}
      />

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(TYPE_CFG).map(([k,v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1"
            style={{ background: v.bg, color: v.color, border:`1px solid ${v.border}`, borderRadius: 9999 }}>
            <span className="w-1.5 h-1.5 inline-block rounded-full" style={{ background: v.color }} />
            {v.label}
          </span>
        ))}
      </div>

      {/* Year filter + search */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Year:</span>
        <div className="flex gap-1">
          {(years.length ? years : [new Date().getFullYear().toString()]).map(y => (
            <button key={y} onClick={() => setYearFilter(y)}
              className="px-3 py-1 text-xs font-bold transition-colors"
              style={{
                background: yearFilter === y ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: yearFilter === y ? '#FFFFFF' : 'var(--color-text-muted)',
                border: `1px solid ${yearFilter === y ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 8,
              }}>
              {y}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search holiday name…"
          className="ml-2"
        />
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} holidays</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !filtered.length ? (
        <div className="card">
          <EmptyState icon={Star} title="No holidays for this year" description="Add public holidays to include them in payroll computation."
            action={{ label:'Add Holiday', onClick:() => setModal(true) }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(byMonth)
            .sort(([a],[b]) => Number(a) - Number(b))
            .map(([m, hs]) => (
              <div key={m} className="card overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between"
                  style={{ background:'var(--color-surface-2)', borderBottom:'1px solid var(--color-border)' }}>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{MONTHS[Number(m)]}</h3>
                  <span className="text-[10px] text-gray-400">{hs.length} holiday{hs.length > 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {hs.map(h => {
                    const cfg = TYPE_CFG[h.type] ?? TYPE_CFG.regular
                    const d = new Date(h.date + 'T00:00:00')
                    return (
                      <div key={h.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
                        <div className="flex-shrink-0 w-10 text-center">
                          <p className="text-lg font-black text-gray-800 tabular-nums leading-none">{d.getDate()}</p>
                          <p className="text-[10px] text-gray-400">
                            {d.toLocaleDateString('en-PH',{weekday:'short'})}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{h.name}</p>
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold mt-0.5"
                            style={{ background: cfg.bg, color: cfg.color, border:`1px solid ${cfg.border}`, borderRadius: 9999 }}>
                            {cfg.label}
                          </span>
                        </div>
                        <ActionIconBtn variant="delete" icon={Trash2} onClick={() => setDeleteTarget(h)} title="Remove holiday" label="Remove" />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Holiday"
        footer={
          <>
            <button onClick={() => setModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim() || !form.date} className="btn btn-primary">
              {saving ? 'Saving…' : 'Add Holiday'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Holiday Name</label>
            <input className="input-base" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Araw ng Kagitingan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Date</label>
              <input type="date" className="input-base" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Type</label>
              <select className="input-base" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value as HolidayType}))}>
                <option value="regular">Regular Holiday</option>
                <option value="special-non-working">Special Non-Working</option>
                <option value="special-working">Special Working</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input className="input-base" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description…" />
          </div>
          <div className="p-3 text-xs" style={{ background:'var(--color-warning-bg)', border:'1px solid #FDE68A', color:'var(--color-warning)' }}>
            <strong>Note:</strong> Regular holidays are paid at 200% rate. Special non-working days at 130%. Special working days are treated as ordinary working days for payroll purposes.
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Remove Holiday"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn btn-secondary">Cancel</button>
            <button
              onClick={() => deleteTarget && deleteHoliday(deleteTarget)}
              disabled={deleting}
              className="btn btn-danger"
            >
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          </>
        }>
        <p className="text-sm text-gray-700">Remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.date}) from the holiday calendar? This will affect future payroll computations.</p>
      </Modal>
    </div>
  )
}
