import { Search } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: Props) {
  return (
    <div className={`relative ${className}`} style={{ display: 'flex', alignItems: 'center' }}>
      <Search
        style={{
          position: 'absolute',
          left: 11,
          width: 15,
          height: 15,
          color: '#94A3B8',
          pointerEvents: 'none',
          flexShrink: 0,
          zIndex: 1,
        }}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base search-input"
        style={{ paddingLeft: 36 }}
      />
    </div>
  )
}
