import { useRef, useEffect } from 'react'
import { SessionBands, SessionTimeMarkers } from './SessionBands'
import { DividendMarker } from './DividendMarker'
import { SqMarkerBadge } from './SqMarker'
import { MacroEventBadge } from './MacroEventBadge'
import { type MarkerType } from '../utils/dividendCalendar'
import { type SqMarker } from '../utils/sqCalendar'
import { type MacroEvent } from '../utils/macroCalendar'
import { getMonthBand } from '../utils/earningsSeason'
import { type ScheduleEntry } from '../utils/noteStorage'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 56
const TOTAL_MINUTES = 24 * 60

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTimeRangeJa(start: string, end?: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h < 12 ? '午前' : '午後'
    const hour = h === 0 || h === 12 ? 12 : h % 12
    const min = m > 0 ? `${m}分` : ''
    return { ampm, label: `${ampm}${hour}時${min}`, hour, min }
  }
  const s = fmt(start)
  if (!end) return s.label
  const e = fmt(end)
  if (s.ampm === e.ampm) return `${s.label}〜${e.hour}時${e.min}`
  return `${s.label}〜${e.label}`
}

type Props = {
  date: Date
  isToday: (d: Date) => boolean
  getMarkers: (d: Date) => MarkerType[]
  getSqMarkers: (d: Date) => SqMarker[]
  getMacroEvents: (d: Date) => MacroEvent[]
  isMarketClosed: (d: Date) => boolean
  getClosedReason: (d: Date) => string | null
  onOpenNote: (d: Date, time?: string) => void
  hasNote: (d: Date) => boolean
  getNoteTitle: (d: Date) => string
  getScheduledEvents: (d: Date) => ScheduleEntry[]
  theme?: 'dark' | 'light'
}

export function DayView({ date, isToday, getMarkers, getSqMarkers, getMacroEvents, isMarketClosed, getClosedReason, onOpenNote, hasNote, getNoteTitle, getScheduledEvents, theme = 'dark' }: Props) {
  const now = new Date()
  const td = isToday(date)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const minutes = td
      ? now.getHours() * 60 + now.getMinutes()
      : 9 * 60
    const timePx = (minutes / (24 * 60)) * HOUR_HEIGHT * 24
    el.scrollTop = timePx - el.clientHeight / 2
  }, [date])
  const nowMinutes = td ? now.getHours() * 60 + now.getMinutes() : -1
  const closed    = isMarketClosed(date)
  const reason    = getClosedReason(date)
  const markers   = getMarkers(date)
  const sqMarkers = getSqMarkers(date)
  const macroEvts = getMacroEvents(date)
  const band      = getMonthBand(date.getMonth() + 1)
  const noted     = hasNote(date)
  const noteTitle = noted ? getNoteTitle(date) : ''
  const evtBlocks = getScheduledEvents(date)
    .filter(evt => evt.startTime)
    .map(evt => {
      const startMin = timeToMinutes(evt.startTime)
      const endMin   = evt.endTime ? timeToMinutes(evt.endTime) : startMin + 60
      const topPx    = startMin / TOTAL_MINUTES * HOUR_HEIGHT * 24
      const heightPx = Math.max((endMin - startMin) / TOTAL_MINUTES * HOUR_HEIGHT * 24, 24)
      const timeLabel = formatTimeRangeJa(evt.startTime, evt.endTime || undefined)
      return { topPx, heightPx, title: evt.title, timeLabel, id: evt.id }
    })

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.timeGutter} />
        <div style={styles.dayHeader}>
          <span style={{
            ...styles.dowLabel,
            color: date.getDay() === 0 ? 'var(--color-sun)' : date.getDay() === 6 ? 'var(--color-sat)' : 'var(--text-sub)',
          }}>
            {date.toLocaleDateString('ja-JP', { weekday: 'long' })}
          </span>
          <span style={{
            ...styles.dateNum,
            background: td ? 'var(--accent-glass)' : 'transparent',
            color: td ? 'rgba(255,255,255,0.95)' : 'var(--text)',
            boxShadow: td ? '0 2px 10px rgba(96,165,250,0.4)' : 'none',
          }}>
            {date.getDate()}
          </span>
          {closed && reason && <span style={styles.closedBadge}>🏦 休場（{reason}）</span>}
          {/* 月次イベントバッジ — イベントがない月も同一高さを確保 */}
          <span style={{ visibility: band ? 'visible' : 'hidden', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
            {band ? band.items.map((item, i) => (
              item.url ? (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, fontWeight: 700, color: band.color, background: band.bg, border: `1px solid ${band.color}40`, borderRadius: 5, padding: '2px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {item.label}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              ) : (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: band.color, background: band.bg, border: `1px solid ${band.color}40`, borderRadius: 5, padding: '2px 8px' }}>
                  {item.label}
                </span>
              )
            )) : <span style={{ fontSize: 11, padding: '2px 8px' }}>&nbsp;</span>}
          </span>
          <DividendMarker markers={markers} size="md" />
          <SqMarkerBadge markers={sqMarkers} size="md" theme={theme} />
          <MacroEventBadge events={macroEvts} size="md" theme={theme} />

          {/* ノート開くボタン */}
          <button
            style={{ ...styles.noteBtn, background: noted ? 'rgba(96,165,250,0.15)' : 'var(--bg-subtle)', borderColor: noted ? 'rgba(96,165,250,0.35)' : 'var(--glass-border)' }}
            onClick={() => onOpenNote(date)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {noted && noteTitle ? noteTitle : noted ? 'メモを編集' : 'メモ・タスク'}
          </button>
        </div>
      </div>

      <div ref={scrollRef} style={styles.scrollArea}>
        <div style={{ display: 'flex', position: 'relative', height: HOUR_HEIGHT * 24 }}>
          <div style={{ ...styles.timeGutter, position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={styles.hourLabel}>
                {h > 0 && <span>{String(h).padStart(2, '0')}:00</span>}
              </div>
            ))}
            {!closed && <SessionTimeMarkers />}
          </div>
          <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid var(--grid-line)', background: closed ? 'var(--closed-cell-bg)' : undefined }}>
            {!closed && <SessionBands />}
            {HOURS.map(h => (
              <div
                key={h}
                style={styles.hourCell}
                onClick={() => onOpenNote(date, `${String(h).padStart(2, '0')}:00`)}
              />
            ))}
            {evtBlocks.map(evtBlock => (
              <div
                key={evtBlock.id}
                style={{ ...styles.eventBlock, top: evtBlock.topPx, height: evtBlock.heightPx }}
                onClick={() => onOpenNote(date)}
                title={evtBlock.title}
              >
                {evtBlock.heightPx < 36
                  ? <div style={styles.eventTitleInline}>{evtBlock.title || '（無題）'}<span style={styles.eventTimeInline}>{evtBlock.timeLabel}</span></div>
                  : <>
                      <div style={styles.eventTitle}>{evtBlock.title || '（無題）'}</div>
                      <div style={styles.eventTime}>{evtBlock.timeLabel}</div>
                    </>
                }
              </div>
            ))}
            {td && (
              <div style={{ ...styles.nowLine, top: `${(nowMinutes / (24 * 60)) * 100}%` }}>
                <div style={styles.nowDot} />
                <div style={styles.nowBar} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 8px 8px' },
  header: { display: 'flex', borderBottom: '1px solid var(--grid-line)', flexShrink: 0 },
  timeGutter: { width: 52, flexShrink: 0 },
  dayHeader: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 12px', gap: 4 },
  dowLabel: { fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' },
  dateNum: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 22, fontWeight: 500 },
  closedBadge: { fontSize: 11, fontWeight: 700, color: 'rgba(255,200,100,0.9)', background: 'rgba(255,180,50,0.15)', border: '1px solid rgba(255,180,50,0.3)', borderRadius: 6, padding: '3px 10px' },
  noteBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 20, marginTop: 4,
    fontSize: 12, fontWeight: 600,
    color: 'var(--text-sub)',
    border: '1px solid',
    transition: 'all 0.15s',
  },
  scrollArea: { flex: 1, overflowY: 'auto' },
  hourLabel: { height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, fontSize: 10, color: 'var(--text-sub)' },
  hourCell: { height: HOUR_HEIGHT, borderTop: '1px solid var(--grid-line)', position: 'relative', zIndex: 2 },
  eventBlock: {
    position: 'absolute', left: 6, right: 6,
    background: 'var(--accent-glass)',
    border: 'none',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 6,
    padding: '4px 8px',
    zIndex: 4, cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 1,
  },
  eventTitle: {
    fontSize: 12, fontWeight: 700,
    color: 'rgba(255,255,255,0.97)',
    overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis',
    lineHeight: '17px',
  },
  eventTime: {
    fontSize: 11, fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: '14px',
  },
  eventTitleInline: {
    fontSize: 11, fontWeight: 700,
    color: 'rgba(255,255,255,0.97)',
    overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis',
    lineHeight: '20px',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  eventTimeInline: {
    fontSize: 10, fontWeight: 400,
    color: 'rgba(255,255,255,0.80)',
    flexShrink: 0,
  },
  nowLine: { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 5 },
  nowDot: { width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0, boxShadow: '0 0 6px rgba(96,165,250,0.8)' },
  nowBar: { flex: 1, height: 2, background: 'rgba(96,165,250,0.8)', boxShadow: '0 0 6px rgba(96,165,250,0.5)' },
}
