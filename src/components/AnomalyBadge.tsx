import { useState } from 'react'
import { type AnomalyEvent, ANOMALY_META, ANOMALY_COLOR, ANOMALY_BG, ANOMALY_COLOR_LIGHT, ANOMALY_BG_LIGHT } from '../utils/anomalyCalendar'
import { BadgePopup } from './BadgePopup'

type Props = {
  events: AnomalyEvent[]
  size?: 'sm' | 'md'
  theme?: 'dark' | 'light'
}

type PopupState = { key: string; x: number; y: number }

export function AnomalyBadge({ events, size = 'md', theme = 'dark' }: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const isSm = size === 'sm'
  const isLight = theme === 'light'
  const badgeColor = isLight ? ANOMALY_COLOR_LIGHT : ANOMALY_COLOR
  const badgeBg    = isLight ? ANOMALY_BG_LIGHT    : ANOMALY_BG

  if (events.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {events.map((e, i) => {
          const meta = ANOMALY_META[e.type]
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                fontSize: isSm ? 10 : 11,
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: isLight ? badgeColor : 'rgba(255,255,255,0.92)',
                background: badgeBg,
                border: `1px solid ${badgeColor}${isLight ? 'cc' : '88'}`,
                borderRadius: 4,
                padding: isSm ? '1px 4px' : '2px 6px',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                boxShadow: `0 1px 4px ${badgeColor}28`,
                cursor: 'pointer',
              }}
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
          color={badgeColor}
          label={ANOMALY_META[popup.key as keyof typeof ANOMALY_META].label}
          desc={ANOMALY_META[popup.key as keyof typeof ANOMALY_META].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
