import { useState } from 'react'
import { type MacroEvent, type MacroEventType, type MacroEventDetail, MACRO_META } from '../utils/macroCalendar'
import { BadgePopup } from './BadgePopup'
import styles from '../styles/badge.module.css'

type Props = {
  events: MacroEvent[]
  size?: 'sm' | 'md'
}

// 実績（結果つき）のイベントは、同じ type でも中身が違うので detail も持ち回る
type PopupState = { type: MacroEventType; detail?: MacroEventDetail; x: number; y: number }

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
                setPopup(prev => prev?.type === e.type ? null : { type: e.type, detail: e.detail, x: rect.left, y: rect.bottom + 6 })
              }}
            >
              {/* 結果が分かっている日は「日銀（据え置き）」のように併記する＝日付だけでは何が起きたか読めないため */}
              {isSm ? meta.short : meta.label}
              {e.detail && <span className={styles.result}>{e.detail.headline}</span>}
            </span>
          )
        })}
      </div>

      {popup && (
        <BadgePopup
          x={popup.x} y={popup.y}
          label={MACRO_META[popup.type].label}
          // 結果があるときは「その日に何が起きたか」を先に出す（説明文より知りたいのはそこ）
          desc={popup.detail ? `${popup.detail.note}\n\n${MACRO_META[popup.type].desc}` : MACRO_META[popup.type].desc}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  )
}
