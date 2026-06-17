import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '../ui/Skeleton'

export interface Column<T> {
  key: string
  header: string
  width?: string
  minWidth?: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
  render?: (row: T, index: number) => React.ReactNode
  getValue?: (row: T) => string | number | boolean | null | undefined
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  skeletonRows?: number
  empty?: {
    title: string
    description?: string
    action?: React.ReactNode
    icon?: React.ElementType
  }
  onRowClick?: (row: T) => void
  pageSize?: number
  showPagination?: boolean
  className?: string
  compact?: boolean
  zebra?: boolean
  stickyHeader?: boolean
  maxHeight?: number | string
}

type SortDir = 'asc' | 'desc' | null

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  skeletonRows = 8,
  empty,
  onRowClick,
  pageSize = 20,
  showPagination = true,
  className = '',
  compact = false,
  zebra = false,
  stickyHeader = true,
  maxHeight,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page,    setPage]    = useState(1)

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data
    const col = columns.find(c => c.key === sortKey)
    if (!col) return data
    return [...data].sort((a, b) => {
      const av = col.getValue ? col.getValue(a) : (a as Record<string, unknown>)[sortKey]
      const bv = col.getValue ? col.getValue(b) : (b as Record<string, unknown>)[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? 1 : -1
      if (bv == null) return sortDir === 'asc' ? -1 : 1
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc'
          ? av.localeCompare(bv)
          : bv.localeCompare(av)
      }
      const an = Number(av), bn = Number(bv)
      return sortDir === 'asc' ? an - bn : bn - an
    })
  }, [data, sortKey, sortDir, columns])

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = showPagination
    ? sorted.slice((page - 1) * pageSize, page * pageSize)
    : sorted

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
    if (sortDir === 'asc')  { setSortDir('desc'); return }
    setSortKey(null); setSortDir(null)
  }

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null
    if (sortKey !== col.key) return <ChevronsUpDown style={{ width: 11, height: 11, opacity: 0.4 }} />
    if (sortDir === 'asc')  return <ChevronUp   style={{ width: 11, height: 11, color: '#4F46E5' }} />
    return <ChevronDown style={{ width: 11, height: 11, color: '#4F46E5' }} />
  }

  const tdPad  = compact ? '8px 12px'    : '11px 16px'
  const thPad  = compact ? '8px 12px'    : '10px 16px'
  const tdSize = compact ? '12.5px'      : '13.5px'
  const thSize = compact ? '10px'        : '11px'

  return (
    <div className={className}>
      <div style={{ overflowX: 'auto', ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}) }}>
        <table className="table-base w-full">

          {/* ── Header ── */}
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={col.key}
                  style={{
                    padding: thPad,
                    fontSize: thSize,
                    width: col.width,
                    minWidth: col.minWidth,
                    textAlign: col.align ?? 'left',
                    paddingLeft: ci === 0 ? 20 : undefined,
                    paddingRight: ci === columns.length - 1 ? 20 : undefined,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: col.sortable ? 'none' : undefined,
                    position: stickyHeader ? 'sticky' : undefined,
                    top: stickyHeader ? 0 : undefined,
                    zIndex: stickyHeader ? 1 : undefined,
                    background: '#F8FAFC',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, ri) => (
                  <tr key={`sk-${ri}`}>
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        style={{
                          padding: tdPad,
                          paddingLeft: ci === 0 ? 20 : undefined,
                          paddingRight: ci === columns.length - 1 ? 20 : undefined,
                        }}
                      >
                        <Skeleton style={{ height: 16, width: ci === 0 ? '80%' : '60%', borderRadius: 4 }} />
                      </td>
                    ))}
                  </tr>
                ))
              : paged.map((row, ri) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    style={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      background: zebra && ri % 2 === 1 ? '#FAFAFA' : undefined,
                    }}
                  >
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={col.className}
                        style={{
                          padding: tdPad,
                          fontSize: tdSize,
                          textAlign: col.align ?? 'left',
                          paddingLeft: ci === 0 ? 20 : undefined,
                          paddingRight: ci === columns.length - 1 ? 20 : undefined,
                        }}
                      >
                        {col.render
                          ? col.render(row, ri)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')
                        }
                      </td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>

        {/* ── Empty state ── */}
        {!loading && paged.length === 0 && empty && (
          <div className="flex flex-col items-center py-16 text-center">
            {empty.icon && <empty.icon style={{ width: 40, height: 40, color: '#E2E8F0', marginBottom: 12 }} />}
            <p style={{ fontSize: 14, fontWeight: 600, color: '#64748B', marginBottom: 4, letterSpacing: '-0.01em' }}>
              {empty.title}
            </p>
            {empty.description && (
              <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}>{empty.description}</p>
            )}
            {empty.action}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {showPagination && !loading && sorted.length > pageSize && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}
        >
          <span style={{ fontSize: 12.5, color: '#64748B' }}>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length} records
          </span>
          <div className="flex items-center gap-1">
            <button
              className="action-icon-btn aib-gray"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft style={{ width: 14, height: 14 }} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 28, height: 28,
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: p === page ? 700 : 400,
                    background: p === page ? '#4F46E5' : 'transparent',
                    color: p === page ? '#fff' : '#475569',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {p}
                </button>
              )
            })}
            <button
              className="action-icon-btn aib-gray"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ opacity: page >= totalPages ? 0.4 : 1 }}
            >
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
