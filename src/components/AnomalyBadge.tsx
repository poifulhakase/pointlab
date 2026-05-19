import { useState } from 'react'
import { type AnomalyEvent, ANOMALY_META } from '../utils/anomalyCalendar'
import { BadgePopup } from './BadgePopup'
import styles from '../styles/badge.module.css'

type Props = {
  events: AnomalyEvent[]
  size?: 'sm' | 'md'
}

type PopupState = { key: string; x: number; y: number }

export function AnomalyBadge({ events, size = 'md' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'

  if (events.length === 0) return null

  return (
    <>
      <div className={styles.list}>
        {events.map((e, i) => {
          const meta = ANOMALY_META[e.type]
          return (
            <span
              key={i}
              className={`${styles.chip} ${isSm ? styles.sm : styles.md}`}
              onClick={ev => {
                ev.stopPropagation()
                const rect = ev.currentTarget.getBoundingClientRect()
                const key = e.type
                setPopup(prev => prev?.key === key ? null : { key, x: rect.left, y: rect.bottom + 6 })
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
          label={ANOMALY_META[popup.key as keyof typeof ANOMALY_META].label}
          desc={ANOMALY_META[popup.key as keyof typeof ANOMALY_META].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
