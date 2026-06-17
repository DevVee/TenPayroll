import { useState, useEffect } from "react"
import { Clock, Search, RefreshCw, Pencil, Trash2, Download } from "lucide-react"
import { DataTable } from "../../components/data/DataTable"
import { Modal } from "../../components/ui/Modal"
import {
  apiGetAttendance, apiGetEmployees,
  apiCorrectAttendance, apiVoidAttendance,
} from "../../lib/db"
import { exportAttendanceReport } from "../../lib/exportService"
import { formatTime, formatMinutes } from "../../lib/utils/format"
import { useAuthStore } from "../../store/authStore"
import type { AttendanceRecord, AttendanceStatus, Employee } from "../../types"

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  present:   "pill pill-green",  late:      "pill pill-yellow",
  absent:    "pill pill-red",    "on-leave": "pill pill-purple",
  "half-day":"pill pill-orange", holiday:   "pill pill-blue",
}
const STATUS_LABEL: Record<string, string> = {
  present:   "Present",  late:      "Late",    absent:    "Absent",
  "on-leave":"On Leave", "half-day":"Half Day","rest-day":"Rest Day", holiday: "Holiday",
}
const EDITABLE_STATUSES: AttendanceStatus[] = [
  "present", "late", "absent", "half-day", "on-leave", "holiday",
]
const NEEDS_TIME = new Set(["present", "late", "half-day"])

const BLANK_EDIT = { timeIn: "", timeOut: "", status: "present" as AttendanceStatus, reason: "" }

// ─── Component ────────────────────────────────────────────────────────────────
export function AttendanceLog() {
  const { user } = useAuthStore()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [records,   setRecords]   = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState("")
  const [status,    setStatus]    = useState("all")
  const today      = new Date().toISOString().split("T")[0]
  const thirtyAgo  = new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0]
  const [startDate, setStartDate] = useState(thirtyAgo)
  const [endDate,   setEndDate]   = useState(today)

  // ── Edit modal ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null)
  const [editForm,   setEditForm]   = useState(BLANK_EDIT)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState("")

  // ── Void state ────────────────────────────────────────────────────────────
  const [voidTarget,  setVoidTarget]  = useState<AttendanceRecord | null>(null)
  const [voidReason,  setVoidReason]  = useState("")
  const [voiding,     setVoiding]     = useState(false)
  const [voidError,   setVoidError]   = useState("")

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    try {
      const [recs, emps] = await Promise.all([
        apiGetAttendance({ startDate, endDate }),
        apiGetEmployees(),
      ])
      setRecords(recs)
      setEmployees(emps)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [startDate, endDate])

  // ── Derived ───────────────────────────────────────────────────────────────
  const empMap  = new Map(employees.map(e => [e.id, e]))
  const filtered = records.filter(r => {
    if (r.status === "rest-day") return false
    const q = search.toLowerCase()
    const matchSearch = !q
      || (r.employeeName ?? "").toLowerCase().includes(q)
      || (r.employeeNo   ?? "").toLowerCase().includes(q)
    const matchStatus = status === "all" || r.status === status
    return matchSearch && matchStatus
  })

  const present = records.filter(r => r.status === "present" || r.status === "late").length
  const absent  = records.filter(r => r.status === "absent").length
  const late    = records.filter(r => r.status === "late").length
  const onLeave = records.filter(r => r.status === "on-leave").length

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const openEdit = (r: AttendanceRecord) => {
    setEditTarget(r)
    setSaveError("")
    const toHHMM = (iso?: string) =>
      iso ? new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""
    setEditForm({
      timeIn:  toHHMM(r.timeIn),
      timeOut: toHHMM(r.timeOut),
      status:  r.status,
      reason:  "",
    })
  }

  const saveEdit = async () => {
    if (!editTarget) return
    if (!editForm.reason.trim()) { setSaveError("Reason is required."); return }
    setSaving(true); setSaveError("")
    try {
      const d = editTarget.date
      await apiCorrectAttendance(
        editTarget.id,
        {
          status:  editForm.status,
          timeIn:  NEEDS_TIME.has(editForm.status) && editForm.timeIn
            ? `${d}T${editForm.timeIn}:00`  : undefined,
          timeOut: NEEDS_TIME.has(editForm.status) && editForm.timeOut
            ? `${d}T${editForm.timeOut}:00` : undefined,
        },
        user?.name ?? "HR",
        editForm.reason.trim(),
      )
      setEditTarget(null)
      load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  // ── Void handlers ─────────────────────────────────────────────────────────
  const openVoid = (r: AttendanceRecord) => {
    setVoidTarget(r)
    setVoidReason("")
    setVoidError("")
  }

  const confirmVoid = async () => {
    if (!voidTarget) return
    if (!voidReason.trim()) { setVoidError("Reason is required."); return }
    setVoiding(true); setVoidError("")
    try {
      await apiVoidAttendance(voidTarget.id, user?.name ?? "HR", voidReason.trim())
      setVoidTarget(null)
      load()
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Void failed.")
    } finally {
      setVoiding(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em" }}>
            Attendance Log
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 3 }}>
            {startDate} → {endDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => exportAttendanceReport(filtered, startDate, endDate, "excel")}
            title="Export to Excel"
          >
            <Download style={{ width: 14, height: 14 }} /> Export
          </button>
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Present",  value: present,  color: "var(--color-success)" },
          { label: "Absent",   value: absent,   color: "var(--color-danger)"  },
          { label: "Late",     value: late,     color: "var(--color-warning)" },
          { label: "On Leave", value: onLeave,  color: "var(--color-primary)" },
        ].map(s => (
          <div key={s.label} className="card-sm" style={{ padding: "14px 18px" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1 }} className="tabular-nums">
              {s.value}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="relative" style={{ minWidth: 200, flex: 1 }}>
            <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--color-text-muted)", pointerEvents: "none" }} />
            <input
              type="text" placeholder="Search employee…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="input-base search-input" style={{ paddingLeft: 34 }}
            />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-base" style={{ width: "auto", minWidth: 130 }}>
            <option value="all">All Status</option>
            {["present","late","absent","on-leave","half-day","holiday"].map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base" style={{ width: 150 }} />
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>to</span>
          <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="input-base" style={{ width: 150 }} />
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginLeft: "auto" }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <DataTable
          data={filtered}
          rowKey={r => r.id}
          loading={loading}
          pageSize={20}
          empty={{ title: "No attendance records", description: "No records match your filters.", icon: Clock }}
          columns={[
            {
              key: "date", header: "Date", sortable: true,
              render: r => (
                <span className="tabular-nums" style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>
                  {r.date}
                </span>
              ),
            },
            {
              key: "employeeName", header: "Employee", sortable: true,
              render: r => (
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text)" }}>{r.employeeName}</p>
                  <p style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>{r.employeeNo}</p>
                </div>
              ),
            },
            {
              key: "department", header: "Department",
              render: r => (
                <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {empMap.get(r.employeeId)?.department ?? r.department ?? "—"}
                </span>
              ),
            },
            {
              key: "timeIn", header: "Time In",
              render: r => <span className="tabular-nums" style={{ fontSize: 13 }}>{formatTime(r.timeIn)}</span>,
            },
            {
              key: "timeOut", header: "Time Out",
              render: r => <span className="tabular-nums" style={{ fontSize: 13 }}>{formatTime(r.timeOut)}</span>,
            },
            {
              key: "minutesLate", header: "Late",
              render: r => (
                <span className="tabular-nums" style={{ fontSize: 13, color: r.minutesLate > 0 ? "var(--color-warning)" : "var(--color-text-muted)" }}>
                  {r.minutesLate > 0 ? formatMinutes(r.minutesLate) : "—"}
                </span>
              ),
            },
            {
              key: "status", header: "Status", sortable: true,
              render: r => <span className={STATUS_PILL[r.status] ?? "pill pill-gray"}>{STATUS_LABEL[r.status] ?? r.status}</span>,
            },
            {
              key: "source", header: "Source",
              render: r => (
                <span style={{ fontSize: 12, color: r.source === "manual" ? "var(--color-warning)" : "var(--color-text-muted)", fontWeight: 500 }}>
                  {r.source === "manual" ? "Manual" : "Kiosk"}
                </span>
              ),
            },
            {
              key: "actions", header: "",
              render: r => (
                <div className="flex items-center gap-1" style={{ justifyContent: "flex-end" }}>
                  <button
                    onClick={() => openEdit(r)}
                    title="Edit record"
                    style={{
                      padding: "4px 6px", borderRadius: 6, border: "none", background: "transparent",
                      cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
                  >
                    <Pencil style={{ width: 14, height: 14 }} />
                  </button>
                  <button
                    onClick={() => openVoid(r)}
                    title="Void record"
                    style={{
                      padding: "4px 6px", borderRadius: 6, border: "none", background: "transparent",
                      cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--color-danger)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Edit Modal
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!editTarget}
        onClose={() => !saving && setEditTarget(null)}
        title="Edit Attendance Record"
        size="md"
      >
        {editTarget && (
          <div className="space-y-4">
            {/* Record identity (read-only) */}
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
              fontSize: 13, color: "var(--color-text-muted)",
            }}>
              <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{editTarget.employeeName}</span>
              {" · "}
              {editTarget.date}
              {editTarget.source === "kiosk" && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-warning)", fontWeight: 600 }}>
                  Kiosk record — changes will be marked as manual correction
                </span>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="label-sm">Status</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value as AttendanceStatus }))}
                className="input-base" style={{ width: "100%" }}
              >
                {EDITABLE_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
                ))}
              </select>
            </div>

            {/* Time In / Out — only for time-based statuses */}
            {NEEDS_TIME.has(editForm.status) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">Time In</label>
                  <input
                    type="time"
                    value={editForm.timeIn}
                    onChange={e => setEditForm(f => ({ ...f, timeIn: e.target.value }))}
                    className="input-base" style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label-sm">Time Out</label>
                  <input
                    type="time"
                    value={editForm.timeOut}
                    onChange={e => setEditForm(f => ({ ...f, timeOut: e.target.value }))}
                    className="input-base" style={{ width: "100%" }}
                  />
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="label-sm">Reason for correction <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <textarea
                value={editForm.reason}
                onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Employee forgot to clock out, correcting per DTR"
                className="input-base"
                style={{ width: "100%", minHeight: 72, resize: "vertical" }}
              />
            </div>

            {saveError && (
              <p style={{ fontSize: 12.5, color: "var(--color-danger)" }}>{saveError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save Correction"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          Void Confirm Modal
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!voidTarget}
        onClose={() => !voiding && setVoidTarget(null)}
        title="Void Attendance Record"
        size="sm"
      >
        {voidTarget && (
          <div className="space-y-4">
            <p style={{ fontSize: 13.5, color: "var(--color-text)" }}>
              You are about to void{" "}
              <strong>{voidTarget.employeeName}</strong>'s record for{" "}
              <strong>{voidTarget.date}</strong>.
            </p>
            <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              The record will be hidden from all views and excluded from payroll,
              but preserved in the audit log. This cannot be undone from the UI.
            </p>

            <div>
              <label className="label-sm">Reason <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate entry created by kiosk error"
                className="input-base"
                style={{ width: "100%", minHeight: 64, resize: "vertical" }}
                autoFocus
              />
            </div>

            {voidError && (
              <p style={{ fontSize: 12.5, color: "var(--color-danger)" }}>{voidError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-secondary" onClick={() => setVoidTarget(null)} disabled={voiding}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: "var(--color-danger)", color: "#fff", border: "none" }}
                onClick={confirmVoid}
                disabled={voiding}
              >
                {voiding ? "Voiding…" : "Void Record"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
