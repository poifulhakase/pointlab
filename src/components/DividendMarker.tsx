import { useState } from 'react'
import { type MarkerType, MARKER_META } from '../utils/dividendCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  markers: MarkerType[]
  size?: 'sm' | 'md'
  theme?: 'dark' | 'light'
}

type PopupState = { key: MarkerType; x: number; y: number }

export function DividendMarker({ markers, size = 'md', theme = 'dark' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'
  const isLight = theme === 'light'

  if (markers.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {markers.map(m => {
          const meta = MARKER_META[m]
          const color = isLight ? meta.colorLight : meta.color
          const bg    = isLight ? meta.bgLight    : meta.bg
          return (
            <span
              key={m}
              style={{
                display: 'inline-block',
                fontSize: isSm ? 10 : 12,
                fontWeight: 500,
                letterSpacing: '0.02em',
                color: isLight ? color : 'rgba(255,255,255,0.92)',
                background: bg,
                border: `1px solid ${color}${isLight ? '38' : '40'}`,
                borderRadius: 4,
                padding: isSm ? '1px 4px' : '3px 7px',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                backdropFilter: isLight ? undefined : 'blur(4px)',
                boxShadow: isLight ? 'none' : `0 1px 6px ${color}20`,
                cursor: 'pointer',
              }}
              onClick={ev => {
                ev.stopPropagation()
                const rect = ev.currentTarget.getBoundingClientRect()
                setPopup(prev => prev?.key === m ? null : { key: m, x: rect.left, y: rect.bottom + 6 })
              }}
            >
              {meta.label}
            </span>
          )
        })}
      </div>

      {popup && (() => {
        const meta = MARKER_META[popup.key]
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
