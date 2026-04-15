import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Option<T extends string | number> = { value: T; label: string }

type Props<T extends string | number> = {
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
  icon?: React.ReactNode
  activeColor?: string
}

export function CustomSelect<T extends string | number>({
  value, onChange, options, icon, activeColor = 'rgba(96,165,250,0.90)',
}: Props<T>) {
  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const isActive = value !== 0 && value !== ''

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const menuH = options.length * 40 + 8
      const top = r.bottom + 4 + menuH > window.innerHeight ? r.top - menuH - 4 : r.bottom + 4
      setPos({ top, left: r.left, width: r.width })
    }
    setOpen(p => !p)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 10,
          background: isActive ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isActive ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.12)'}`,
          color: isActive ? activeColor : 'rgba(255,255,255,0.45)',
          fontSize: 13, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{selected?.label ?? '選択...'}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            minWidth: Math.max(pos.width, 160),
            zIndex: 9999,
            background: 'rgba(11,14,46,0.98)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '4px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {options.map(opt => {
            const isSel = opt.value === value
            return (
              <button
                key={String(opt.value)}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  background: isSel ? 'rgba(96,165,250,0.15)' : 'transparent',
                  color: isSel ? 'rgba(96,165,250,0.95)' : 'rgba(255,255,255,0.75)',
                  fontSize: 13, fontWeight: isSel ? 600 : 400,
                  cursor: 'pointer', transition: 'background 0.1s',
                  textAlign: 'left' as const,
                }}
              >
                {opt.label}
                {isSel && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
