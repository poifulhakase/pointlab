import { useRef, useEffect } from 'react'
import { SessionBands, SessionTimeMarkers } from './SessionBands'
import { DividendMarker } from './DividendMarker'
import { SqMarkerBadge } from './SqMarker'
import { MacroEventBadge } from './MacroEventBadge'
import { type MarkerType } from '../utils/dividendCalendar'
import { type SqMarker } from '../utils/sqCalendar'
import { type MacroEvent } from '../utils/macroCalendar'
import { getMonthBand } from '../utils/earningsSeason'
import { type NoteMapEntry } from '../utils/noteStorage'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 56

type Props = {
  days: Date[]
  current: Date
  isToday: (d: Date) => boolean
  getMarkers: (d: Date) => MarkerType[]
  getSqMarkers: (d: Date) => SqMarker[]
  getMacroEvents: (d: Date) => MacroEvent[]
  isMarketClosed: (d: Date) => boolean
  getClosedReason: (d: Date) => string | null
  onOpenNote: (d: Date, time?: string) => void
  hasNote: (d: Date) => boolean
  getNoteTitle: (d: Date) => string
  getScheduledEvent: (d: Date) => NoteMapEntry | null
  isMobile: boolean
}

const TOTAL_MINUTES = 24 * 60

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function WeekView({ days, current, isToday, getMarkers, getSqMarkers, getMacroEvents, isMarketClosed, getClosedReason, onOpenNote, hasNote, getNoteTitle, getScheduledEvent, isMobile }: Props) {
  const now = new Date()

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const todayInWeek = days.some(d => isToday(d))
    const minutes = todayInWeek
      ? now.getHours() * 60 + now.getMinutes()
      : 9 * 60
    const timePx = (minutes / (24 * 60)) * HOUR_HEIGHT * 24
    el.scrollTop = timePx - el.clientHeight / 2
  }, [current])

  const visibleDays = isMobile
    ? (() => {
        const idx = days.findIndex(d =>
          d.getFullYear() === current.getFullYear() &&
          d.getMonth() === current.getMonth() &&
          d.getDate() === current.getDate()
        )
        const center = idx >= 0 ? idx : Math.floor(days.length / 2)
        const start = Math.max(0, Math.min(center - 1, days.length - 3))
        return days.slice(start, start + 3)
      })()
    : days

  const band = getMonthBand(visibleDays[0].getMonth() + 1)

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.timeGutter} />
        {visibleDays.map((d, i) => {
          const dow       = d.getDay()
          const td        = isToday(d)
          const isS       = dow === 0
          const isSat     = dow === 6
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
              style={{
                ...styles.dayHeader,
                cursor: 'pointer',
                background: td ? 'rgba(96,165,250,0.18)' : undefined,
                borderTop: td ? '3px solid rgba(96,165,250,0.85)' : undefined,
              }}
              onClick={() => onOpenNote(d)}
              title="クリックでメモ・タスクを開く"
            >
              <span style={{ ...styles.dowLabel, color: isS ? 'var(--color-sun)' : isSat ? 'var(--color-sat)' : 'var(--text-sub)' }}>
                {d.toLocaleDateString('ja-JP', { weekday: 'short' })}
              </span>
              <span style={{
                ...styles.dateNum,
                background: 'transparent',
                color: td ? 'rgba(96,165,250,0.95)' : isS ? 'var(--color-sun)' : isSat ? 'var(--color-sat)' : 'var(--text)',
                boxShadow: 'none',
                fontWeight: td ? 700 : undefined,
              }}>
                {d.getDate()}
              </span>
              {showBadge && reason && <span style={styles.closedBadge}>{reason}</span>}
              {noted && (
                <div style={styles.noteBand}>
                  {noteTitle || '　'}
                </div>
              )}
              <DividendMarker markers={markers} size="md" />
              <SqMarkerBadge markers={sqMarkers} size="md" />
              <MacroEventBadge events={macroEvts} size="md" />
            </div>
          )
        })}
      </div>

      <div ref={scrollRef} style={styles.scrollArea}>
        <div style={styles.grid}>
          <div style={{ ...styles.timeGutter, position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={styles.hourLabel}>
                {h > 0 && <span>{String(h).padStart(2, '0')}:00</span>}
              </div>
            ))}
            <SessionTimeMarkers />
          </div>

          {visibleDays.map((d, di) => {
            const td     = isToday(d)
            const closed = isMarketClosed(d)
            const nowMinutes = td ? now.getHours() * 60 + now.getMinutes() : -1
            const evt    = getScheduledEvent(d)
            const evtBlock = evt?.startTime ? (() => {
              const startMin = timeToMinutes(evt.startTime)
              const endMin   = evt.endTime ? timeToMinutes(evt.endTime) : startMin + 60
              const topPx    = startMin / TOTAL_MINUTES * HOUR_HEIGHT * 24
              const heightPx = Math.max((endMin - startMin) / TOTAL_MINUTES * HOUR_HEIGHT * 24, 22)
              return { topPx, heightPx, title: evt.title }
            })() : null
            return (
              <div key={di} style={{ ...styles.dayCol, position: 'relative', background: closed ? 'var(--closed-cell-bg)' : undefined }}>
                {!closed && <SessionBands />}
                {HOURS.map(h => (
                  <div
                    key={h}
                    style={styles.hourCell}
                    onClick={() => onOpenNote(d, `${String(h).padStart(2, '0')}:00`)}
                  />
                ))}
                {evtBlock && (
                  <div
                    style={{ ...styles.eventBlock, top: evtBlock.topPx, height: evtBlock.heightPx }}
                    onClick={() => onOpenNote(d)}
                    title={evtBlock.title}
                  >
                    {evtBlock.title || '（無題）'}
                  </div>
                )}
                {td && (
                  <div style={{ ...styles.nowLine, top: `${(nowMinutes / (24 * 60)) * 100}%` }}>
                    <div style={styles.nowDot} />
                    <div style={styles.nowBar} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 月次イベントバナー（カレンダー下部）— イベントがない月も同一高さを確保 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px', margin: '8px 0 0', padding: '5px 12px', borderRadius: 8, border: `1px solid ${band ? band.color : 'transparent'}`, background: band ? band.bg : 'transparent', fontSize: 12, backdropFilter: 'blur(8px)', visibility: band ? 'visible' : 'hidden' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: band?.color ?? 'transparent', flexShrink: 0 }} />
        {band ? band.items.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>／</span>}
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ color: band.color, fontWeight: 700, textDecoration: 'none' }}>
                {item.label}
              </a>
            ) : (
              <span style={{ color: band.color, fontWeight: 700 }}>{item.label}</span>
            )}
          </span>
        )) : <span>&nbsp;</span>}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 8px 8px' },
  header: { display: 'flex', borderBottom: '1px solid var(--grid-line)', flexShrink: 0 },
  timeGutter: { width: 52, flexShrink: 0 },
  dayHeader: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0 8px', gap: 3, borderRadius: 6, transition: 'background 0.12s' },
  dowLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' },
  dateNum: { width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 16, fontWeight: 500 },
  closedBadge: { fontSize: 9, fontWeight: 700, color: 'rgba(255,200,100,0.8)', background: 'rgba(255,180,50,0.12)', border: '1px solid rgba(255,180,50,0.25)', borderRadius: 3, padding: '1px 5px' },
  noteBand: {
    alignSelf: 'stretch',
    background: 'var(--accent-glass)',
    borderLeft: '3px solid var(--accent)',
    borderRadius: '0 3px 3px 0',
    padding: '2px 6px',
    fontSize: 10, fontWeight: 600,
    color: 'rgba(255,255,255,0.95)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    minHeight: 16, lineHeight: '12px',
  },
  scrollArea: { flex: 1, overflowY: 'auto' },
  grid: { display: 'flex', height: HOUR_HEIGHT * 24 },
  hourLabel: { height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, fontSize: 10, color: 'var(--text-sub)' },
  dayCol: { flex: 1, borderLeft: '1px solid var(--grid-line)' },
  hourCell: { height: HOUR_HEIGHT, borderTop: '1px solid var(--grid-line)', position: 'relative', zIndex: 2 },
  eventBlock: {
    position: 'absolute', left: 3, right: 3,
    background: 'var(--accent-glass)',
    border: 'none',
    borderLeft: '3px solid var(--accent)',
    borderRadius: 4,
    padding: '2px 5px',
    fontSize: 10, fontWeight: 600,
    color: 'rgba(255,255,255,0.95)',
    overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis',
    zIndex: 4, cursor: 'pointer',
    lineHeight: '14px',
  },
  nowLine: { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 5 },
  nowDot: { width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0, boxShadow: '0 0 6px rgba(96,165,250,0.8)' },
  nowBar: { flex: 1, height: 2, background: 'rgba(96,165,250,0.8)', boxShadow: '0 0 6px rgba(96,165,250,0.5)' },
}
