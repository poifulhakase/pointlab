import { useState } from 'react'
import { type SqMarker, SQ_META } from '../utils/sqCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  markers: SqMarker[]
  size?: 'sm' | 'md'
  theme?: 'dark' | 'light'
}

type PopupState = { key: SqMarker; x: number; y: number }

export function SqMarkerBadge({ markers, size = 'md', theme = 'dark' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'
  const isLight = theme === 'light'

  if (markers.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {markers.map(m => {
          const meta = SQ_META[m]
          const color = isLight ? meta.colorLight : meta.color
          const bg    = isLight ? meta.bgLight    : meta.bg
          return (
            <span
              key={m}
              style={{
                display: 'inline-block',
                fontSize: isSm ? 11 : 12,
                fontWeight: 500,
                letterSpacing: '0.03em',
                color: isLight ? color : 'rgba(255,255,255,0.95)',
                background: bg,
                border: `1px solid ${color}${isLight ? '38' : '99'}`,
                borderRadius: 4,
                padding: isSm ? '1px 4px' : '3px 7px',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                boxShadow: isLight ? 'none' : `0 1px 4px ${color}28`,
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

      {popup && (() => {
        const meta = SQ_META[popup.key]
        const color = isLight ? meta.colorLight : meta.color
        return (
          <BadgePopup
            x={popup.x} y={popup.y}
            color={color}
            label={meta.label}
            desc={meta.desc}
            theme={theme}
            onClose={() => setPopup(null)}
          />
        )
      })()}
    </>
  )
}
