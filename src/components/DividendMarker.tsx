import { useState } from 'react'
import { type MarkerType, MARKER_META } from '../utils/dividendCalendar'
import { BadgePopup } from './BadgePopup'
import styles from '../styles/badge.module.css'

type Props = {
  markers: MarkerType[]
  size?: 'sm' | 'md'
}

type PopupState = { key: MarkerType; x: number; y: number }

export function DividendMarker({ markers, size = 'md' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'

  if (markers.length === 0) return null

  return (
    <>
      <div className={styles.list}>
        {markers.map(m => {
          const meta = MARKER_META[m]
          return (
            <span
              key={m}
              className={`${styles.chip} ${isSm ? styles.sm : styles.md}`}
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

      {popup && (
        <BadgePopup
          x={popup.x} y={popup.y}
          label={MARKER_META[popup.key].label}
          desc={MARKER_META[popup.key].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
