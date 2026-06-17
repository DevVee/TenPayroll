// ─── Settings → Designations (Departments) tab ────────────────────────────────
import { useState, useEffect } from 'react'
import { Save, Plus, Pencil, Trash2 } from 'lucide-react'
import { SearchInput } from '../../../components/ui/SearchInput'
import { Modal } from '../../../components/ui/Modal'
import { ActionIconBtn } from '../../../components/ui/ActionIconBtn'
import {
  apiGetDepartments, apiCreateDepartment,
  apiUpdateDepartment, apiDeleteDepartment,
} from '../../../lib/db'
import { useUIStore } from '../../../store/uiStore'
import type { Department } from '../../../types'

export function DepartmentsTab() {
  const addToast = useUIStore(s => s.addToast)
  const [departments, setDepartments] = useState<Department[]>([])
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editing,     setEditing]     = useState<Department | null>(null)
  const [form,        setForm]        = useState({ name: '', code: '', description: '', headName: '' })
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')

  const load = () => {
    setLoading(true)
    apiGetDepartments().then(d => { setDepartments(d); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', code: '', description: '', headName: '' })
    setModalOpen(true)
  }
  const openEdit = (d: Department) => {
    setEditing(d)
    setForm({ name: d.name, code: d.code ?? '', description: d.description ?? '', headName: d.headName ?? '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    try {
      if (editing) await apiUpdateDepartment(editing.id, form)
      else         await apiCreateDepartment(form)
      setModalOpen(false)
      load()
      addToast({ type: 'success', title: editing ? 'Designation Updated' : 'Designation Created', message: `"${form.name}" has been saved.` })
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to Save', message: err instanceof Error ? err.message : 'Something went wrong.' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await apiDeleteDepartment(deleteId)
      setDeleteId(null)
      load()
      addToast({ type: 'success', title: 'Designation Deleted' })
    } catch (err) {
      addToast({ type: 'error', title: 'Cannot Delete', message: err instanceof Error ? err.message : 'Something went wrong.' })
      setDeleteId(null)
    }
  }

  const filtered = departments.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search designations…" className="flex-1" />
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-3.5 h-3.5" />Add Designation
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {search ? 'No designations match your search.' : 'No designations configured yet.'}
          </div>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr>
                <th>Designation</th>
                <th>Code</th>
                <th className="hidden md:table-cell">Head / Supervisor</th>
                <th className="hidden lg:table-cell">Description</th>
                <th style={{ width: 72 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><span className="text-sm font-semibold text-gray-800">{d.name}</span></td>
                  <td><span className="pill pill-blue">{d.code || '—'}</span></td>
                  <td className="hidden md:table-cell"><span className="text-sm text-gray-600">{d.headName || '—'}</span></td>
                  <td className="hidden lg:table-cell"><span className="text-xs text-gray-400 line-clamp-1">{d.description || '—'}</span></td>
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <ActionIconBtn variant="edit"   icon={Pencil} onClick={() => openEdit(d)}        title="Edit" />
                      <ActionIconBtn variant="delete" icon={Trash2} onClick={() => setDeleteId(d.id)}  title="Delete" />
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
        title={editing ? 'Edit Designation' : 'Add Designation'}
        footer={<>
          <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary"><Save className="w-3.5 h-3.5" />Save</button>
        </>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Designation Name *</label>
              <input className="input-base" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bag Production-Sewer" />
            </div>
            <div>
              <label className="form-label">Code</label>
              <input className="input-base" value={form.code} maxLength={10}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="e.g. SEW" />
            </div>
          </div>
          <div>
            <label className="form-label">Head / Supervisor</label>
            <input className="input-base" value={form.headName}
              onChange={e => setForm(f => ({ ...f, headName: e.target.value }))}
              placeholder="Name of supervisor" />
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
        title="Delete Designation"
        footer={<>
          <button onClick={() => setDeleteId(null)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="btn btn-danger"><Trash2 className="w-3.5 h-3.5" />Delete</button>
        </>}
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this designation? This action cannot be undone.
          Employees assigned to this designation will not be affected.
        </p>
      </Modal>
    </div>
  )
}
