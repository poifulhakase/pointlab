/**
 * 東証の取引時間帯をタイムグリッド上にハイライト表示するコンポーネント
 * 前場: 09:00 - 11:30
 * 後場: 12:30 - 15:30 (2024年11月〜延長後)
 */

const HOUR_HEIGHT = 56 // WeekView / DayView と同じ値

type Session = {
  label: string
  startH: number  // 開始時刻（時）
  startM: number  // 開始時刻（分）
  endH: number
  endM: number
  color: string
  labelColor: string
}

const SESSIONS: Session[] = [
  {
    label: '前場',
    startH: 9, startM: 0,
    endH: 11, endM: 30,
    color: 'rgba(96, 165, 250, 0.07)',
    labelColor: 'rgba(96, 165, 250, 0.6)',
  },
  {
    label: '後場',
    startH: 12, startM: 30,
    endH: 15, endM: 30,
    color: 'rgba(52, 211, 153, 0.07)',
    labelColor: 'rgba(52, 211, 153, 0.6)',
  },
]

function toMinutes(h: number, m: number) {
  return h * 60 + m
}

export function SessionBands() {
  const totalMinutes = 24 * 60

  return (
    <>
      {SESSIONS.map((s) => {
        const startMin = toMinutes(s.startH, s.startM)
        const endMin = toMinutes(s.endH, s.endM)
        const top = (startMin / totalMinutes) * (HOUR_HEIGHT * 24)
        const height = ((endMin - startMin) / totalMinutes) * (HOUR_HEIGHT * 24)

        return (
          <div
            key={s.label}
            style={{
              position: 'absolute',
              top,
              left: 0,
              right: 0,
              height,
              background: s.color,
              borderTop: `1px solid ${s.labelColor.replace('0.75', '0.25')}`,
              borderBottom: `1px solid ${s.labelColor.replace('0.75', '0.15')}`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              right: 6,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: s.labelColor,
            }}>
              {s.label}
            </span>
          </div>
        )
      })}
    </>
  )
}

/** 左の時間ラベル列に前場・後場の時刻マーカーを表示 */
export function SessionTimeMarkers() {
  const totalMinutes = 24 * 60

  return (
    <>
      {SESSIONS.map((s) => {
        const startMin = toMinutes(s.startH, s.startM)
        const endMin = toMinutes(s.endH, s.endM)
        const topStart = (startMin / totalMinutes) * (HOUR_HEIGHT * 24)
        const topEnd = (endMin / totalMinutes) * (HOUR_HEIGHT * 24)

        return (
          <div key={s.label}>
            <div style={{ position: 'absolute', top: topStart, right: 0, left: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: 6, pointerEvents: 'none', zIndex: 2 }}>
              <span style={{ fontSize: 9, color: s.labelColor, fontWeight: 700, lineHeight: 1, background: 'rgba(11,14,46,0.7)', borderRadius: 3, padding: '1px 3px' }}>
                {String(s.startH).padStart(2,'0')}:{String(s.startM).padStart(2,'0')}
              </span>
            </div>
            <div style={{ position: 'absolute', top: topEnd, right: 0, left: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: 6, pointerEvents: 'none', zIndex: 2 }}>
              <span style={{ fontSize: 9, color: s.labelColor, fontWeight: 700, lineHeight: 1, background: 'rgba(11,14,46,0.7)', borderRadius: 3, padding: '1px 3px' }}>
                {String(s.endH).padStart(2,'0')}:{String(s.endM).padStart(2,'0')}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}
