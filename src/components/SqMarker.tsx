import { useState } from 'react'
import { type SqMarker, SQ_META } from '../utils/sqCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  markers: SqMarker[]
  size?: 'sm' | 'md'
}

type PopupState = { key: SqMarker; x: number; y: number }

export function SqMarkerBadge({ markers, size = 'md' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'

  if (markers.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {markers.map(m => {
          const meta = SQ_META[m]
          return (
            <span
              key={m}
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
                setPopup(prev => prev?.key === m ? null : { key: m, x: rect.left, y: rect.bottom + 6 })
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
          color={SQ_META[popup.key].color}
          label={SQ_META[popup.key].label}
          desc={SQ_META[popup.key].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
