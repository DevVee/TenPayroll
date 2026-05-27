import { useState } from 'react'
import { Plus, Clock, Edit2, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { ActionIconBtn } from '../../components/ui/ActionIconBtn'
import { useData } from '../../hooks/useData'
import { apiGetShifts, apiCreateShift, apiUpdateShift, apiDeleteShift } from '../../lib/db'
import type { WorkShift } from '../../types'

const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const DEFAULT_FORM: Omit<WorkShift,'id'> = {
  name: '',
  timeIn: '08:00',
  timeOut: '17:00',
  breakMinutes: 60,
  restDays: [0, 6],
  graceMinutes: 15,
  overtimeEnabled: true,
  overtimeThresholdMinutes: 30,
}

export function ShiftList() {
  const { data: shifts, loading, refetch } = useData(() => apiGetShifts(), [])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<WorkShift | null>(null)
  const [form, setForm] = useState<Omit<WorkShift,'id'>>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<WorkShift | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setModal(true)
  }

  const openEdit = (s: WorkShift) => {
    setEditing(s)
    setForm({ name: s.name, timeIn: s.timeIn, timeOut: s.timeOut, breakMinutes: s.breakMinutes, restDays: s.restDays, graceMinutes: s.graceMinutes, overtimeEnabled: s.overtimeEnabled, overtimeThresholdMinutes: s.overtimeThresholdMinutes })
    setModal(true)
  }

  const toggleRestDay = (day: number) => {
    setForm(f => ({
      ...f,
      restDays: f.restDays.includes(day) ? f.restDays.filter(d => d !== day) : [...f.restDays, day].sort()
    }))
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await apiUpdateShift(editing.id, form)
      } else {
        await apiCreateShift(form)
      }
      setModal(false); refetch()
    } finally { setSaving(false) }
  }

  const handleDelete = async (s: WorkShift) => {
    await apiDeleteShift(s.id)
    setDeleteConfirm(null); refetch()
  }

  const calcHours = (tIn: string, tOut: string, breakMin: number) => {
    const [h1,m1] = tIn.split(':').map(Number)
    const [h2,m2] = tOut.split(':').map(Number)
    const total = (h2 * 60 + m2) - (h1 * 60 + m1) - breakMin
    return (total / 60).toFixed(1)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work Shifts"
        subtitle="Define and manage employee work schedules"
        actions={[{ label:'New Shift', icon:Plus, onClick: openCreate }]}
      />

      {/* Search */}
      {(shifts?.length ?? 0) > 0 && (
        <div className="card px-3 py-2.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search shifts…"
            className="w-full"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !shifts?.length ? (
        <div className="card">
          <EmptyState icon={Clock} title="No shifts defined" description="Create your first work shift to assign to employees."
            action={{ label:'New Shift', onClick: openCreate }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {(shifts ?? []).filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())).map(s => (
            <div key={s.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900">{s.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {calcHours(s.timeIn, s.timeOut, s.breakMinutes)} work hours/day
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <ActionIconBtn variant="edit"   icon={Edit2}  onClick={() => openEdit(s)}        title="Edit shift" />
                  <ActionIconBtn variant="delete" icon={Trash2} onClick={() => setDeleteConfirm(s)} title="Delete shift" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius: 6 }}>
                  <p className="text-gray-400 mb-0.5">Time In</p>
                  <p className="font-bold text-gray-800">{formatTime12(s.timeIn)}</p>
                </div>
                <div className="p-2" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius: 6 }}>
                  <p className="text-gray-400 mb-0.5">Time Out</p>
                  <p className="font-bold text-gray-800">{formatTime12(s.timeOut)}</p>
                </div>
                <div className="p-2" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius: 6 }}>
                  <p className="text-gray-400 mb-0.5">Break</p>
                  <p className="font-bold text-gray-800">{s.breakMinutes} min</p>
                </div>
                <div className="p-2" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius: 6 }}>
                  <p className="text-gray-400 mb-0.5">Grace Period</p>
                  <p className="font-bold text-gray-800">{s.graceMinutes} min</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1.5">Rest Days</p>
                <div className="flex gap-1">
                  {DAY_ABBR.map((d,i) => (
                    <span key={d} className="inline-flex items-center justify-center w-7 h-7 text-[10px] font-bold"
                      style={{
                        background: s.restDays.includes(i) ? '#FEF2F2' : '#F8FAFC',
                        color: s.restDays.includes(i) ? '#DC2626' : '#94A3B8',
                        border: `1px solid ${s.restDays.includes(i) ? '#FECACA' : '#E2E8F0'}`,
                      }}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-400 pt-2" style={{ borderTop:'1px solid #F3F4F6' }}>
                {s.overtimeThresholdMinutes != null
                  ? `OT threshold: ${s.overtimeThresholdMinutes} min after ${formatTime12(s.timeOut)}`
                  : s.overtimeEnabled ? 'Overtime: Enabled' : 'Overtime: Disabled'
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? 'Edit Shift' : 'New Work Shift'}
        footer={
          <>
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Update Shift' : 'Create Shift'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Shift Name</label>
            <input className="input-base" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Morning Shift" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Time In</label>
              <input type="time" className="input-base" value={form.timeIn} onChange={e => setForm(f => ({...f, timeIn: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Time Out</label>
              <input type="time" className="input-base" value={form.timeOut} onChange={e => setForm(f => ({...f, timeOut: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Break (min)</label>
              <input type="number" className="input-base" value={form.breakMinutes} min={0} max={120}
                onChange={e => setForm(f => ({...f, breakMinutes: Number(e.target.value)}))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Grace (min)</label>
              <input type="number" className="input-base" value={form.graceMinutes} min={0} max={60}
                onChange={e => setForm(f => ({...f, graceMinutes: Number(e.target.value)}))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">OT After (min)</label>
              <input type="number" className="input-base" value={form.overtimeThresholdMinutes} min={0}
                onChange={e => setForm(f => ({...f, overtimeThresholdMinutes: Number(e.target.value)}))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Rest Days</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_ABBR.map((d,i) => (
                <button key={d} type="button" onClick={() => toggleRestDay(i)}
                  className="flex items-center justify-center w-10 h-10 text-xs font-bold transition-colors"
                  style={{
                    background: form.restDays.includes(i) ? '#DC2626' : '#F8FAFC',
                    color: form.restDays.includes(i) ? '#FFFFFF' : '#64748B',
                    border: `1px solid ${form.restDays.includes(i) ? '#DC2626' : '#E2E8F0'}`,
                    borderRadius: 8,
                  }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {form.name && (
            <div className="p-3 text-xs" style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius: 8, color: '#991B1B' }}>
              Total work: {calcHours(form.timeIn, form.timeOut, form.breakMinutes)} hrs/day ·
              Work days: {7 - form.restDays.length}/week
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Shift"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">
              Delete
            </button>
          </>
        }>
        <p className="text-sm text-gray-700">
          Delete shift <strong>{deleteConfirm?.name}</strong>? Employees assigned to this shift will be unaffected but future assignments must be updated.
        </p>
      </Modal>
    </div>
  )
}

function formatTime12(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2,'0')} ${ampm}`
}

