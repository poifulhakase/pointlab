import { useState } from 'react'
import { type MacroEvent, type MacroEventType, MACRO_META } from '../utils/macroCalendar'
import { BadgePopup } from './BadgePopup'
import styles from '../styles/badge.module.css'

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
      <div className={styles.list}>
        {events.map((e, i) => {
          const meta = MACRO_META[e.type]
          return (
            <span
              key={i}
              className={`${styles.chip} ${isSm ? styles.sm : styles.md} ${styles.clamp}`}
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
          label={MACRO_META[popup.type].label}
          desc={MACRO_META[popup.type].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
