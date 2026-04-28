import { useState } from 'react'
import { type MacroEvent, type MacroEventType, MACRO_META } from '../utils/macroCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  events: MacroEvent[]
  size?: 'sm' | 'md'
  theme?: 'dark' | 'light'
}

type PopupState = { type: MacroEventType; x: number; y: number }

export function MacroEventBadge({ events, size = 'md', theme = 'dark' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'
  const isLight = theme === 'light'

  if (events.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {events.map((e, i) => {
          const meta = MACRO_META[e.type]
          const color = isLight ? meta.colorLight : meta.color
          const bg    = isLight ? meta.bgLight    : meta.bg
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontSize: isSm ? 11 : 12,
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: isLight ? color : 'rgba(255,255,255,0.95)',
                background: bg,
                border: `1px solid ${color}${isLight ? 'cc' : '99'}`,
                borderRadius: 4,
                padding: isSm ? '1px 4px' : '3px 7px',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                boxShadow: `0 1px 4px ${color}28`,
                cursor: 'pointer',
              }}
              onClick={ev => {
                ev.stopPropagation()
                const rect = ev.currentTarget.getBoundingClientRect()
                setPopup(prev => prev?.type === e.type ? null : { type: e.type, x: rect.left, y: rect.bottom + 6 })
              }}
            >
              {isSm ? meta.short : meta.label}
            </span>
          )
        })}
      </div>

      {popup && (() => {
        const meta = MACRO_META[popup.type]
        const color = isLight ? meta.colorLight : meta.color
        return (
          <BadgePopup
            x={popup.x} y={popup.y}
            color={color}
            label={meta.label}
            desc={meta.desc}
            onClose={() => setPopup(null)}
          />
        )
      })()}
    </>
  )
}
