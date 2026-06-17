// ─── Settings → Departments tab ──────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Save, Plus, Pencil, Trash2 } from 'lucide-react'
import { SearchInput } from '../../../components/ui/SearchInput'
import { Modal } from '../../../components/ui/Modal'
import { ActionIconBtn } from '../../../components/ui/ActionIconBtn'
import {
  apiGetPositions, apiCreatePosition,
  apiUpdatePosition, apiDeletePosition,
} from '../../../lib/db'
import { useUIStore } from '../../../store/uiStore'
import type { Position } from '../../../types'

export function PositionsTab() {
  const addToast = useUIStore(s => s.addToast)
  const [departments, setDepartments] = useState<Position[]>([])
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editing,     setEditing]     = useState<Position | null>(null)
  const [form,        setForm]        = useState({ title: '', description: '' })
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')

  const load = () => {
    setLoading(true)
    apiGetPositions().then(p => { setDepartments(p); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', description: '' })
    setModalOpen(true)
  }
  const openEdit = (p: Position) => {
    setEditing(p)
    setForm({ title: p.title, description: p.description ?? '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    try {
      if (editing) await apiUpdatePosition(editing.id, { title: form.title, description: form.description })
      else         await apiCreatePosition({ title: form.title, description: form.description })
      setModalOpen(false)
      load()
      addToast({ type: 'success', title: editing ? 'Department Updated' : 'Department Created', message: `"${form.title}" has been saved.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to Save', message: err instanceof Error ? err.message : 'Something went wrong.' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await apiDeletePosition(deleteId)
      setDeleteId(null)
      load()
      addToast({ type: 'success', title: 'Department Deleted' })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Delete', message: err instanceof Error ? err.message : 'Something went wrong.' })
      setDeleteId(null)
    }
  }

  const filtered = departments.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search departments…" className="flex-1" />
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-3.5 h-3.5" />Add Department
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {search ? 'No departments match your search.' : 'No departments configured yet.'}
          </div>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr>
                <th>Department Name</th>
                <th className="hidden lg:table-cell">Description</th>
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span className="text-sm font-semibold text-gray-800">{p.title}</span></td>
                  <td className="hidden lg:table-cell"><span className="text-xs text-gray-400 line-clamp-1">{p.description || '—'}</span></td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <ActionIconBtn variant="edit"   icon={Pencil} onClick={() => openEdit(p)}        title="Edit" />
                      <ActionIconBtn variant="delete" icon={Trash2} onClick={() => setDeleteId(p.id)}  title="Delete" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary"><Save className="w-3.5 h-3.5" />Save</button>
        </>}
      >
        <div className="space-y-3">
          <div>
            <label className="form-label">Department Name *</label>
            <input className="input-base" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Bag Production" />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input className="input-base" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description" />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Department"
        footer={<>
          <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-3.5 h-3.5" />Delete</button>
        </>}
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this department? Employees currently assigned to this department will not be affected.
        </p>
      </Modal>
    </div>
  )
}
