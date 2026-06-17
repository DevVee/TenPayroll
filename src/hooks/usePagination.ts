import { useState, useMemo } from 'react'

export function usePagination<T>(data: T[], pageSize = 20) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const safePageSize = Math.max(1, pageSize)

  const paged = useMemo(() => {
    const start = (page - 1) * safePageSize
    return data.slice(start, start + safePageSize)
  }, [data, page, safePageSize])

  const goTo    = (p: number) => setPage(Math.min(Math.max(1, p), totalPages))
  const next    = () => goTo(page + 1)
  const prev    = () => goTo(page - 1)
  const reset   = () => setPage(1)

  return {
    page,
    pageSize,
    totalPages,
    total: data.length,
    paged,
    goTo,
    next,
    prev,
    reset,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}
