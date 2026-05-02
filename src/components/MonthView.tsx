import { type MarkerType } from '../utils/dividendCalendar'
import { type SqMarker } from '../utils/sqCalendar'
import { type MacroEvent } from '../utils/macroCalendar'
import { type AnomalyEvent } from '../utils/anomalyCalendar'
import { getMonthBand } from '../utils/earningsSeason'
import { DividendMarker } from './DividendMarker'
import { SqMarkerBadge } from './SqMarker'
import { MacroEventBadge } from './MacroEventBadge'
import { AnomalyGantt } from './AnomalyGantt'

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
  getAnomalyEvents?: (d: Date) => AnomalyEvent[]
  isMarketClosed: (d: Date) => boolean
  getClosedReason: (d: Date) => string | null
  hasNote: (d: Date) => boolean
  getNoteTitle: (d: Date) => string
  isMobile: boolean
  theme?: 'dark' | 'light'
}

export function MonthView({ days, current, isToday, isCurrentMonth, onClickDay, onOpenNote, getMarkers, getSqMarkers, getMacroEvents, getAnomalyEvents, isMarketClosed, getClosedReason, hasNote, getNoteTitle, isMobile, theme = 'dark' }: Props) {
  const isLight = theme === 'light'
  const band = getMonthBand(current.getMonth() + 1)
  const bandColor = band ? (isLight ? '#92400e' : band.color) : 'transparent'
  const bandBg    = band ? (isLight ? 'rgba(180,83,9,0.18)' : band.bg) : 'transparent'

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
      <div style={{ ...styles.grid, position: 'relative' }}>
        {days.map((d, i) => {
          const isS       = i % 7 === 0
          const isSat     = i % 7 === 6
          const dim       = !isCurrentMonth(d)
          const td        = isToday(d)
          const markers       = getMarkers(d)
          const sqMarkers     = getSqMarkers(d)
          const macroEvts     = getMacroEvents(d)
          const closed        = isMarketClosed(d)
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
                background: td && !dim ? 'rgba(255,210,80,0.18)' : closed && !dim ? 'var(--closed-cell-bg)' : undefined,
                borderTop: td && !dim ? '3px solid rgba(255,200,60,0.85)' : undefined,
                cursor: 'pointer',
                position: 'relative',
                isolation: 'isolate',
              }}
              className={`glass${td && !dim ? ' today-pulse' : ''}`}
            >
              <div style={styles.dateNumWrap}>
                {/* 日付数字：クリックでナビゲート */}
                <span
                  style={{
                    ...styles.dateNum,
                    width: isMobile ? 22 : 26, height: isMobile ? 22 : 26,
                    fontSize: isMobile ? 11 : 13,
                    color: td ? 'rgba(255,200,60,0.95)' : isS ? 'var(--color-sun)' : isSat ? 'var(--color-sat)' : 'var(--text)',
                    background: 'transparent',
                    boxShadow: 'none',
                    fontWeight: td ? 700 : undefined,
                  }}
                  onClick={e => { e.stopPropagation(); onClickDay(d) }}
                >
                  {d.getDate()}
                </span>
                {showBadge && reason && (
                  <span style={{
                    ...styles.closedBadge,
                    color: isLight ? '#92400e' : 'rgba(255,220,130,0.95)',
                    background: isLight ? 'rgba(255,180,50,0.18)' : 'rgba(255,180,50,0.22)',
                    border: isLight ? '1px solid rgba(180,100,0,0.45)' : '1px solid rgba(255,180,50,0.50)',
                  }}>{reason}</span>
                )}
              </div>

              {/* ノート帯 */}
              {noted && (
                <div style={{
                  ...styles.noteBand,
                  background: isLight ? 'rgba(26,115,232,0.12)' : 'rgba(96,165,250,0.30)',
                  color: isLight ? '#1a56db' : 'rgba(255,255,255,0.95)',
                }}>
                  {noteTitle || '　'}
                </div>
              )}

              <DividendMarker markers={markers} size="sm" theme={theme} />
              <SqMarkerBadge markers={sqMarkers} size="sm" theme={theme} />
              <MacroEventBadge events={macroEvts} size="sm" theme={theme} />
            </div>
          )
        })}

        {/* アノマリーガント（PC限定・グリッドオーバーレイ） */}
        {!isMobile && getAnomalyEvents && (
          <AnomalyGantt days={days} getAnomalyEvents={getAnomalyEvents} theme={theme} />
        )}
      </div>

      {/* 月次イベントバナー（カレンダー下部）— イベントがない月も同一高さを確保 */}
      <div style={{
        ...styles.seasonBanner,
        fontSize: isMobile ? 10 : 12,
        padding: isMobile ? '4px 8px' : '5px 12px',
        borderColor: bandColor,
        background: bandBg,
        visibility: band ? 'visible' : 'hidden',
      }}>
        <span style={{ ...styles.seasonDot, background: bandColor, flexShrink: 0 }} />
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 6px', minWidth: 0 }}>
          {band && band.items.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--text-dim)', fontSize: isMobile ? 9 : 10 }}>／</span>}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: bandColor, fontWeight: 400, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  onClick={e => e.stopPropagation()}
                >
                  {item.label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              ) : (
                <span style={{ color: bandColor, fontWeight: 400, whiteSpace: 'nowrap' }}>{item.label}</span>
              )}
            </span>
          ))}
          {!band && <span>&nbsp;</span>}
        </span>
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
  seasonDot: { width: 8, height: 8, borderRadius: '50%' },
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
    fontSize: 10, fontWeight: 500,
    borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  },
  noteBand: {
    width: '100%',
    background: 'rgba(96,165,250,0.30)',
    borderRadius: 3,
    padding: '2px 5px',
    marginTop: 3,
    fontSize: 11, fontWeight: 500,
    letterSpacing: '0.02em',
    color: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical' as const,
    WebkitLineClamp: 2,
    whiteSpace: 'normal' as const,
    lineHeight: '14px',
    minHeight: 17,
  },
}
