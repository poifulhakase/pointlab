import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  value: string        // 'HH:MM' or ''
  onChange: (v: string) => void
  placeholder?: string
}

// 30分刻みスロット生成（00:00〜23:30）
const SLOTS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

function parseInput(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // HH:MM or H:MM
  const a = s.match(/^(\d{1,2}):(\d{2})$/)
  if (a) {
    const h = Math.min(23, parseInt(a[1]))
    const m = Math.min(59, parseInt(a[2]))
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  // HHMM（4桁）
  const b = s.match(/^(\d{2})(\d{2})$/)
  if (b) {
    const h = Math.min(23, parseInt(b[1]))
    const m = Math.min(59, parseInt(b[2]))
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  // H or HH（時だけ）
  const c = s.match(/^(\d{1,2})$/)
  if (c) {
    const h = Math.min(23, parseInt(c[1]))
    return `${String(h).padStart(2, '0')}:00`
  }
  return null
}

export function TimeField({ value, onChange, placeholder = '時刻を設定' }: Props) {
  const [inputVal, setInputVal]   = useState(value)
  const [open, setOpen]           = useState(false)
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0, width: 0 })
  const wrapRef    = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)
  const mouseInDrop = useRef(false)

  // 外部 value 変更に追従
  useEffect(() => { setInputVal(value) }, [value])

  // ドロップダウンを開く
  const openDropdown = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropPos({
      top:   rect.bottom + 4,
      left:  rect.left,
      width: Math.max(rect.width, 110),
    })
    setOpen(true)
  }, [])

  // 選択中スロットへスクロール
  useEffect(() => {
    if (!open || !listRef.current) return
    const idx = value ? SLOTS.indexOf(value) : -1
    const target = idx >= 0 ? idx : Math.max(0, SLOTS.findIndex(s => s >= (value || '08:00')))
    const item = listRef.current.children[target] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'center' })
  }, [open, value])

  // 外クリックで閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (mouseInDrop.current) return
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const commit = useCallback((raw: string) => {
    if (mouseInDrop.current) return
    const parsed = parseInput(raw)
    if (parsed) {
      onChange(parsed)
      setInputVal(parsed)
    } else if (!raw.trim()) {
      onChange('')
      setInputVal('')
    } else {
      setInputVal(value) // 不正入力はリバート
    }
    setOpen(false)
  }, [onChange, value])

  const handleSelect = (slot: string) => {
    onChange(slot)
    setInputVal(slot)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={s.wrap}>
      <input
        ref={inputRef}
        type="text"
        value={inputVal}
        placeholder={placeholder}
        style={{ ...s.input, ...(open ? s.inputOpen : {}) }}
        onChange={e => setInputVal(e.target.value)}
        onFocus={() => { inputRef.current?.select(); openDropdown() }}
        onBlur={e => { setTimeout(() => commit(e.target.value), 160) }}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); commit(inputVal); inputRef.current?.blur() }
          if (e.key === 'Escape') { setOpen(false); setInputVal(value); inputRef.current?.blur() }
        }}
      />
      {value && (
        <button
          style={s.clearBtn}
          onMouseDown={e => { e.preventDefault(); onChange(''); setInputVal(''); setOpen(false) }}
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}

      {open && createPortal(
        <div
          ref={listRef}
          style={{ ...s.dropdown, top: dropPos.top, left: dropPos.left, minWidth: dropPos.width }}
          onMouseEnter={() => { mouseInDrop.current = true }}
          onMouseLeave={() => { mouseInDrop.current = false }}
        >
          {SLOTS.map(slot => {
            const active = slot === value
            return (
              <div
                key={slot}
                style={{ ...s.slot, ...(active ? s.slotActive : {}) }}
                onMouseDown={e => { e.preventDefault(); handleSelect(slot) }}
              >
                <span style={s.slotCheck}>{active ? '✓' : ''}</span>
                {slot}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative' as const,
    display: 'inline-flex', alignItems: 'center',
  },
  input: {
    width: 100,
    padding: '5px 28px 5px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 13, fontWeight: 500,
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  inputOpen: {
    borderColor: 'rgba(96,165,250,0.55)',
    background: 'rgba(96,165,250,0.08)',
  },
  clearBtn: {
    position: 'absolute' as const, right: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 16, height: 16, borderRadius: 4,
    color: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  dropdown: {
    position: 'fixed' as const,
    zIndex: 9999,
    background: 'var(--modal-bg, #1e2030)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
    backdropFilter: 'blur(24px)',
    overflowY: 'auto' as const,
    maxHeight: 260,
    padding: '4px 0',
  },
  slot: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    fontSize: 13, fontWeight: 500,
    color: 'rgba(255,255,255,0.80)',
    cursor: 'pointer',
    transition: 'background 0.1s',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  slotActive: {
    background: 'rgba(96,165,250,0.15)',
    color: 'rgba(96,165,250,1)',
    fontWeight: 700,
  },
  slotCheck: {
    width: 14, fontSize: 11,
    color: 'rgba(96,165,250,0.9)',
    flexShrink: 0,
  },
}
