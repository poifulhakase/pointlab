import { type MarkerType } from '../utils/dividendCalendar'
import { type SqMarker } from '../utils/sqCalendar'
import { type MacroEvent } from '../utils/macroCalendar'
import { getEarningsSeason } from '../utils/earningsSeason'
import { DividendMarker } from './DividendMarker'
import { SqMarkerBadge } from './SqMarker'
import { MacroEventBadge } from './MacroEventBadge'

const DOW = ['日', '月', '火', '水', '木', '金', '土']

type Props = {
  days: Date[]
  today: Date
  current: Date
  isToday: (d: Date) => boolean
  isCurrentMonth: (d: Date) => boolean
  onClickDay: (d: Date) => void   // 日付数字クリック → ナビゲート
  onOpenNote: (d: Date, time?: string) => void   // セルクリック → ノートパネル
  getMarkers: (d: Date) => MarkerType[]
  getSqMarkers: (d: Date) => SqMarker[]
  getMacroEvents: (d: Date) => MacroEvent[]
  isMarketClosed: (d: Date) => boolean
  getClosedReason: (d: Date) => string | null
  hasNote: (d: Date) => boolean
  getNoteTitle: (d: Date) => string
  isMobile: boolean
}

export function MonthView({ days, current, isToday, isCurrentMonth, onClickDay, onOpenNote, getMarkers, getSqMarkers, getMacroEvents, isMarketClosed, getClosedReason, hasNote, getNoteTitle, isMobile }: Props) {
  const season = getEarningsSeason(current.getMonth() + 1)

  return (
    <div style={styles.wrap}>
      {/* 曜日ヘッダー */}
      <div style={styles.dowRow}>
        {DOW.map((d, i) => (
          <div key={d} style={{
            ...styles.dowCell,
            fontSize: isMobile ? 10 : 11,
            color: i === 0 ? 'var(--color-sun)' : i === 6 ? 'var(--color-sat)' : 'var(--text-sub)',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={styles.grid}>
        {days.map((d, i) => {
          const isS       = i % 7 === 0
          const isSat     = i % 7 === 6
          const dim       = !isCurrentMonth(d)
          const td        = isToday(d)
          const markers   = getMarkers(d)
          const sqMarkers = getSqMarkers(d)
          const macroEvts = getMacroEvents(d)
          const closed    = isMarketClosed(d)
          const reason    = getClosedReason(d)
          const showBadge  = closed && !isS && !isSat
          const noted      = hasNote(d)
          const noteTitle  = noted ? getNoteTitle(d) : ''

          return (
            <div
              key={i}
              onClick={() => onOpenNote(d)}
              style={{
                ...styles.cell,
                padding: isMobile ? '3px' : '6px',
                opacity: dim ? 0.35 : 1,
                background: closed && !dim ? 'var(--closed-cell-bg)' : undefined,
                cursor: 'pointer',
              }}
              className="glass"
            >
              <div style={styles.dateNumWrap}>
                {/* 日付数字：クリックでナビゲート */}
                <span
                  style={{
                    ...styles.dateNum,
                    width: isMobile ? 22 : 26, height: isMobile ? 22 : 26,
                    fontSize: isMobile ? 11 : 13,
                    color: td ? 'rgba(255,255,255,0.95)' : isS ? 'var(--color-sun)' : isSat ? 'var(--color-sat)' : 'var(--text)',
                    background: td ? 'var(--accent-glass)' : 'transparent',
                    boxShadow: td ? '0 2px 10px rgba(96,165,250,0.4)' : 'none',
                  }}
                  onClick={e => { e.stopPropagation(); onClickDay(d) }}
                >
                  {d.getDate()}
                </span>
                {showBadge && reason && !isMobile && (
                  <span style={styles.closedBadge}>{reason}</span>
                )}
              </div>

              {/* ノート帯（デスクトップ） */}
              {noted && !isMobile && (
                <div style={styles.noteBand}>
                  {noteTitle || '　'}
                </div>
              )}

              {isMobile
                ? <div style={styles.dotRow}>
                    {markers.length > 0    && <span style={styles.dotDiv} />}
                    {sqMarkers.length > 0  && <span style={styles.dotSq} />}
                    {macroEvts.length > 0  && <span style={styles.dotMacro} />}
                    {noted                 && <span style={styles.dotNote} />}
                  </div>
                : <>
                    <DividendMarker markers={markers} size="sm" />
                    <SqMarkerBadge markers={sqMarkers} size="sm" />
                    <MacroEventBadge events={macroEvts} size="sm" />
                  </>
              }
            </div>
          )
        })}
      </div>

      {/* 決算シーズンバナー（カレンダー下部） */}
      <div style={{
        ...styles.seasonBanner,
        fontSize: isMobile ? 10 : 12,
        padding: isMobile ? '4px 8px' : '6px 12px',
        borderColor: season ? season.color : 'transparent',
        background: season ? season.bg : 'transparent',
        visibility: season ? 'visible' : 'hidden',
      }}>
        <span style={{ ...styles.seasonDot, background: season?.color ?? 'transparent' }} />
        <span style={{ color: season?.color, fontWeight: 700 }}>決算シーズン</span>
        <span style={styles.seasonQuarter}>— {season?.quarter}（3月決算メイン）</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 8px 8px' },
  seasonBanner: {
    display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 0',
    padding: '6px 12px', borderRadius: 8, border: '1px solid',
    fontSize: 12, backdropFilter: 'blur(8px)',
  },
  seasonDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  seasonQuarter: { fontSize: 11, color: 'var(--text-sub)' },
  dowRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginTop: 6, marginBottom: 4 },
  dowCell: { textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', padding: '6px 0' },
  grid: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gridTemplateRows: 'repeat(6, 1fr)',
    gap: 4,
  },
  cell: {
    borderRadius: 10, padding: '6px',
    transition: 'background 0.12s',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    minHeight: 0,
  },
  dateNumWrap: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const },
  dateNum: {
    width: 26, height: 26, display: 'flex', flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
  },
  closedBadge: {
    fontSize: 9, fontWeight: 700,
    color: 'rgba(255,200,100,0.8)', background: 'rgba(255,180,50,0.12)',
    border: '1px solid rgba(255,180,50,0.25)',
    borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap',
  },
  dotRow: { display: 'flex', gap: 3, marginTop: 2, justifyContent: 'center' },
  dotDiv:   { width: 5, height: 5, borderRadius: '50%', background: 'rgba(251,146,60,0.8)',  flexShrink: 0 },
  dotSq:    { width: 5, height: 5, borderRadius: '50%', background: 'rgba(167,139,250,0.8)', flexShrink: 0 },
  dotMacro: { width: 5, height: 5, borderRadius: '50%', background: 'rgba(245,158,11,0.8)',  flexShrink: 0 },
  dotNote:  { width: 5, height: 5, borderRadius: '50%', background: 'rgba(96,165,250,0.90)', flexShrink: 0 },
  noteBand: {
    width: '100%',
    background: 'rgba(96,165,250,0.18)',
    borderLeft: '3px solid rgba(96,165,250,0.70)',
    borderRadius: '0 3px 3px 0',
    padding: '2px 5px',
    marginTop: 3,
    fontSize: 11, fontWeight: 600,
    color: 'rgba(96,165,250,0.92)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    minHeight: 17, lineHeight: '13px',
  },
}
