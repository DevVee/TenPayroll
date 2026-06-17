// ─── SearchSelect — searchable combobox ──────────────────────────────────────
// Drop-in replacement for <select>. Lets users type to filter options; still
// shows the full list on open so they can browse. Keyboard navigable.
// Falls back gracefully when the options list is empty.

import { useState, useRef, useEffect, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronDown, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  options:      SelectOption[]
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  emptyHint?:   string    // shown inside dropdown when options list is empty
  disabled?:    boolean
  required?:    boolean
}

export function SearchSelect({
  options, value, onChange,
  placeholder = 'Search or select…',
  emptyHint = 'No options — add them in Settings',
  disabled, required,
}: Props) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')      // text typed while dropdown is open
  const [cursor, setCursor] = useState(-1)      // keyboard-highlighted row index

  const wrapRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // What the input shows:
  // • closed → the selected value (or empty placeholder)
  // • open   → whatever the user is typing to filter
  const inputDisplay = open ? query : value

  // Options filtered by current query
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  // ── Actions ──────────────────────────────────────────────────────────────
  const openDropdown = () => {
    if (disabled) return
    setQuery('')
    setCursor(-1)
    setOpen(true)
    // Small tick so the input is mounted/focused after state update
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const closeDropdown = () => {
    setOpen(false)
    setQuery('')
    setCursor(-1)
  }

  const selectOption = useCallback((opt: SelectOption) => {
    onChange(opt.value)
    closeDropdown()
  }, [onChange]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    closeDropdown()
  }

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll highlighted row into view ─────────────────────────────────────
  useEffect(() => {
    if (cursor < 0 || !listRef.current) return
    const child = listRef.current.children[cursor] as HTMLElement | undefined
    child?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) { openDropdown(); return }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setCursor(c => Math.min(c + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setCursor(c => Math.max(c - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (cursor >= 0 && filtered[cursor]) selectOption(filtered[cursor])
        break
      case 'Escape':
        e.preventDefault()
        closeDropdown()
        break
      case 'Tab':
        closeDropdown()
        break
    }
  }

  // ── Highlight matched characters in label ─────────────────────────────────
  function highlight(label: string): React.ReactNode {
    const q = query.trim()
    if (!q) return label
    const idx = label.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return label
    return (
      <>
        {label.slice(0, idx)}
        <mark style={{
          background: 'rgba(99,102,241,0.15)',
          color:      'var(--color-primary, #4F46E5)',
          borderRadius: 2, padding: '0 1px',
          fontWeight: 700,
        }}>
          {label.slice(idx, idx + q.length)}
        </mark>
        {label.slice(idx + q.length)}
      </>
    )
  }

  const isSelected = (opt: SelectOption) => opt.value === value

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>

      {/* ── Trigger / input row ── */}
      <div
        onClick={openDropdown}
        style={{
          display:       'flex',
          alignItems:    'center',
          border:        `1px solid ${open ? 'var(--color-primary, #4F46E5)' : 'var(--color-border)'}`,
          borderRadius:  8,
          background:    disabled ? 'var(--color-surface-raised)' : 'var(--color-surface)',
          boxShadow:     open ? '0 0 0 3px rgba(99,102,241,0.10)' : 'none',
          cursor:        disabled ? 'not-allowed' : 'pointer',
          opacity:       disabled ? 0.6 : 1,
          minHeight:     38,
        }}
      >
        <input
          ref={inputRef}
          value={inputDisplay}
          onChange={e => { setQuery(e.target.value); setCursor(-1) }}
          onFocus={openDropdown}
          onKeyDown={onKeyDown}
          placeholder={value ? undefined : placeholder}
          readOnly={disabled}
          required={required && !value}
          autoComplete="off"
          style={{
            flex:        1,
            padding:     '0 10px',
            height:      36,
            background:  'transparent',
            border:      'none',
            outline:     'none',
            fontSize:    13,
            color:       open ? 'var(--color-text)' : (value ? 'var(--color-text)' : 'var(--color-text-muted)'),
            cursor:      disabled ? 'not-allowed' : 'text',
            minWidth:    0,
          }}
        />

        {/* Clear button — only when a value is selected */}
        {value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={clearValue}
            style={{
              padding:    '0 4px',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      'var(--color-text-muted)',
              flexShrink: 0,
              display:    'flex',
              alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        )}

        {/* Chevron */}
        <span style={{
          padding:     '0 8px',
          color:       'var(--color-text-muted)',
          pointerEvents: 'none',
          flexShrink:  0,
          display:     'flex',
          alignItems:  'center',
        }}>
          <ChevronDown
            size={14}
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </span>
      </div>

      {/* ── Dropdown list ── */}
      {open && !disabled && (
        <div
          ref={listRef}
          style={{
            position:   'absolute',
            zIndex:     200,
            top:        'calc(100% + 4px)',
            left:       0,
            right:      0,
            background: 'var(--color-surface)',
            border:     '1px solid var(--color-border)',
            borderRadius: 10,
            boxShadow:  '0 8px 28px rgba(0,0,0,0.14)',
            maxHeight:  232,
            overflowY:  'auto',
          }}
        >
          {filtered.length === 0 ? (
            <p style={{
              padding:   '14px 14px',
              fontSize:  12,
              color:     'var(--color-text-muted)',
              textAlign: 'center',
            }}>
              {query.trim() ? `No match for "${query.trim()}"` : emptyHint}
            </p>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.value}
                onMouseDown={e => { e.preventDefault(); selectOption(opt) }}
                onMouseEnter={() => setCursor(i)}
                style={{
                  padding:    '9px 14px',
                  fontSize:   13,
                  cursor:     'pointer',
                  userSelect: 'none',
                  background: i === cursor
                    ? 'var(--color-surface-raised)'
                    : isSelected(opt)
                      ? 'rgba(99,102,241,0.06)'
                      : 'transparent',
                  color:      'var(--color-text)',
                  fontWeight: isSelected(opt) ? 600 : 400,
                  borderBottom: i < filtered.length - 1
                    ? '1px solid var(--color-border)'
                    : 'none',
                  display:    'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{highlight(opt.label)}</span>
                {isSelected(opt) && (
                  <span style={{ color: 'var(--color-primary, #4F46E5)', fontSize: 11, fontWeight: 700 }}>✓</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
