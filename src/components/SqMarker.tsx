import { useState } from 'react'
import { type SqMarker, SQ_META } from '../utils/sqCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  markers: SqMarker[]
  size?: 'sm' | 'md'
  theme?: 'dark' | 'light'
}

type PopupState = { key: SqMarker; x: number; y: number }

function darkenHex(hex: string): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.45)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.45)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.45)
  return `rgb(${r},${g},${b})`
}

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
          return (
            <span
              key={m}
              style={{
                display: 'inline-block',
                fontSize: isSm ? 11 : 12,
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: isLight ? darkenHex(meta.color) : 'rgba(255,255,255,0.95)',
                background: isLight ? meta.bg.replace(/[\d.]+\)$/, '0.15)') : meta.bg,
                border: `1px solid ${meta.color}${isLight ? 'cc' : '99'}`,
                borderRadius: 4,
                padding: isSm ? '1px 4px' : '3px 7px',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                boxShadow: `0 1px 4px ${meta.color}30`,
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
