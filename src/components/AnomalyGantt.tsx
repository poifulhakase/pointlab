import { useMemo } from 'react'
import { type AnomalyEvent, type AnomalyType, ANOMALY_META, ANOMALY_COLOR, ANOMALY_COLOR_LIGHT } from '../utils/anomalyCalendar'

type Props = {
  days: Date[]
  getAnomalyEvents: (d: Date) => AnomalyEvent[]
  theme?: 'dark' | 'light'
}

type Segment = {
  type: AnomalyType
  row: number
  col1: number
  col2: number
  isFirst: boolean
  lane: number
}

const ROW_COUNT = 6
const COL_COUNT = 7
const BAR_H    = 13
const BAR_GAP  = 3

const TYPE_COLOR: Partial<Record<AnomalyType, string>> = {
  xmas_rally:       '#60a5fa',
  tax_loss_selling: '#f87171',
}

function typeColor(type: AnomalyType, isLight: boolean): string {
  return TYPE_COLOR[type] ?? (isLight ? ANOMALY_COLOR_LIGHT : ANOMALY_COLOR)
}

export function AnomalyGantt({ days, getAnomalyEvents, theme = 'dark' }: Props) {
  const isLight = theme === 'light'

  const segments = useMemo((): Segment[] => {
    const dayTypes: Set<AnomalyType>[] = days.map(d =>
      new Set(getAnomalyEvents(d).map(e => e.type))
    )

    const allTypes = new Set<AnomalyType>()
    dayTypes.forEach(s => s.forEach(t => allTypes.add(t)))

    const raw: Omit<Segment, 'lane'>[] = []

    for (const type of allTypes) {
      let seg: { row: number; col: number } | null = null
      let isFirst = true

      for (let i = 0; i <= days.length; i++) {
        const row = Math.floor(i / COL_COUNT)
        const col = i % COL_COUNT
        const hasType = i < days.length && dayTypes[i].has(type)
        const prevRow = i > 0 ? Math.floor((i - 1) / COL_COUNT) : -1
        const rowChanged = row !== prevRow

        if (seg !== null) {
          if (rowChanged || !hasType) {
            // end segment
            raw.push({ type, row: rowChanged ? prevRow : row, col1: seg.col, col2: rowChanged ? COL_COUNT - 1 : col - 1, isFirst })
            if (isFirst) isFirst = false
            seg = null
            if (rowChanged && hasType) seg = { row, col: 0 }
          }
        } else if (hasType) {
          seg = { row, col }
        }
      }
      if (seg !== null) raw.push({ type, row: seg.row, col1: seg.col, col2: COL_COUNT - 1, isFirst })
    }

    // Assign lanes to avoid vertical overlap within the same row
    const result: Segment[] = []
    for (const s of raw) {
      let lane = 0
      while (result.some(r =>
        r.lane === lane && r.row === s.row &&
        !(r.col2 < s.col1 || r.col1 > s.col2)
      )) lane++
      result.push({ ...s, lane })
    }

    return result
  }, [days, getAnomalyEvents])

  if (segments.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'grid',
      gridTemplateColumns: `repeat(${COL_COUNT}, 1fr)`,
      gridTemplateRows:    `repeat(${ROW_COUNT}, 1fr)`,
      gap: 4,
      zIndex: 5,
    }}>
      {segments.map(seg => {
        const color = typeColor(seg.type, isLight)
        return (
          <div
            key={`${seg.type}-${seg.row}-${seg.col1}`}
            style={{
              gridColumn: `${seg.col1 + 1} / ${seg.col2 + 2}`,
              gridRow:    `${seg.row + 1}`,
              alignSelf:  'end',
              height:      BAR_H,
              marginBottom: BAR_GAP + seg.lane * (BAR_H + BAR_GAP),
              background:  isLight ? `${color}22` : `${color}28`,
              border:      `1px solid ${color}${isLight ? 'aa' : '70'}`,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 4,
              overflow: 'hidden',
            }}
          >
            {seg.isFirst && (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.03em',
                lineHeight: 1,
                color: isLight ? color : `${color}ee`,
                whiteSpace: 'nowrap',
              }}>
                {ANOMALY_META[seg.type].label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
