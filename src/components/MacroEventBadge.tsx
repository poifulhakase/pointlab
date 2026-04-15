import { useState } from 'react'
import { type MacroEvent, type MacroEventType, MACRO_META } from '../utils/macroCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  events: MacroEvent[]
  size?: 'sm' | 'md'
}

type PopupState = { type: MacroEventType; x: number; y: number }

export function MacroEventBadge({ events, size = 'md' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'

  if (events.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {events.map((e, i) => {
          const meta = MACRO_META[e.type]
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontSize: isSm ? 10 : 12,
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: meta.color,
                background: meta.bg,
                border: `1px solid ${meta.color}40`,
                borderRadius: 4,
                padding: isSm ? '1px 4px' : '3px 7px',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(4px)',
                boxShadow: `0 1px 6px ${meta.color}20`,
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

      {popup && (
        <BadgePopup
          x={popup.x} y={popup.y}
          color={MACRO_META[popup.type].color}
          label={MACRO_META[popup.type].label}
          desc={MACRO_META[popup.type].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
