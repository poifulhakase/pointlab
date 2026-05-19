import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  x: number
  y: number
  color: string
  label: string
  desc: string
  onClose: () => void
  theme?: 'dark' | 'light'
}

export function BadgePopup({ x, y, color, label, desc, onClose, theme = 'dark' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isLight = theme === 'light'

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const vpW  = window.innerWidth
  const vpH  = window.innerHeight
  const popW = 260
  const left = Math.min(x, vpW - popW - 12)
  const top  = y + 180 > vpH ? y - 190 : y

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed', top, left, width: popW, zIndex: 9999,
        background: isLight ? '#ffffff' : 'rgba(11,14,46,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${color}${isLight ? '30' : '40'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: isLight
          ? `0 4px 20px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)`
          : `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}18`,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: isLight ? '#374151' : 'rgba(255,255,255,0.72)', lineHeight: 1.65 }}>
        {desc}
      </div>
    </div>,
    document.body
  )
}
