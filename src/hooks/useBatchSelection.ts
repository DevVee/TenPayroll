import { useState, useCallback } from 'react'

export function useBatchSelection<T extends string = string>(initialIds: T[] = []) {
  const [selected, setSelected] = useState<Set<T>>(new Set())

  const toggle = useCallback((id: T) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }, [])

  const toggleAll = useCallback((subset: T[], checked: boolean) => {
    setSelected(prev => {
      const s = new Set(prev)
      subset.forEach(id => (checked ? s.add(id) : s.delete(id)))
      return s
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isAllSelected = useCallback(
    (subset: T[]) => subset.length > 0 && subset.every(id => selected.has(id)),
    [selected],
  )

  const isIndeterminate = useCallback(
    (subset: T[]) =>
      subset.some(id => selected.has(id)) && !subset.every(id => selected.has(id)),
    [selected],
  )

  // Replace the full set (e.g. from external state restore)
  const setIds = useCallback((ids: T[]) => setSelected(new Set(ids)), [])

  // Unused initialIds param: accept it so callers can pass it for docs clarity
  void initialIds

  return { selected, toggle, toggleAll, clear, isAllSelected, isIndeterminate, setIds }
}
