import { useState, useEffect } from 'react'
import { getMacroEventsForDate, MACRO_META } from '../utils/macroCalendar'
import { getSqDates, getSqMarkersForDate } from '../utils/sqCalendar'
import { isMarketClosed as isMarketClosedDay, isNYSEWeekdayHoliday } from '../utils/marketHolidays'

// JST の各コンポーネントを取得（トリックを使わず UTC で正確に計算）
function getJST(date: Date) {
  const jst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  return {
    y: jst.getFullYear(), mo: jst.getMonth() + 1, d: jst.getDate(),
    h: jst.getHours(), mi: jst.getMinutes(), s: jst.getSeconds(),
    wd: jst.getDay(),
    dateObj: new Date(jst.getFullYear(), jst.getMonth(), jst.getDate()),
  }
}

// JST の日時 → UTC タイムスタンプ（ms）
function jstTs(y: number, mo: number, d: number, h: number, mi: number): number {
  return Date.UTC(y, mo - 1, d, h - 9, mi)
}

type Phase = 'before' | 'zenba' | 'lunch' | 'goba' | 'closed' | 'holiday'
type USPhase = 'open' | 'closed' | 'holiday'

const PHASE_META: Record<Phase, { label: string; color: string; dot: string; glow: boolean }> = {
  before:  { label: '開場前',   color: 'var(--text-sub)', dot: 'rgba(148,163,184,0.5)', glow: false },
  zenba:   { label: '前場',     color: 'rgba(96,200,140,0.95)', dot: 'rgba(96,200,140,0.9)', glow: true },
  lunch:   { label: '昼休み',   color: 'rgba(251,146,60,0.85)', dot: 'rgba(251,146,60,0.8)', glow: false },
  goba:    { label: '後場',     color: 'rgba(96,200,140,0.95)', dot: 'rgba(96,200,140,0.9)', glow: true },
  closed:  { label: '取引終了', color: 'var(--text-dim)', dot: 'rgba(148,163,184,0.35)', glow: false },
  holiday: { label: '休場',     color: 'var(--text-dim)', dot: 'rgba(148,163,184,0.35)', glow: false },
}

const US_PHASE_META: Record<USPhase, { label: string; color: string; dot: string; glow: boolean }> = {
  open:    { label: '取引中',   color: 'rgba(96,200,140,0.95)', dot: 'rgba(96,200,140,0.9)', glow: true },
  closed:  { label: '取引終了', color: 'var(--text-dim)', dot: 'rgba(148,163,184,0.35)', glow: false },
  holiday: { label: '休場',     color: 'var(--text-dim)',        dot: 'rgba(148,163,184,0.35)', glow: false },
}

function getPhase(h: number, mi: number, dateObj: Date): Phase {
  if (isMarketClosedDay(dateObj)) return 'holiday'
  const t = h * 60 + mi
  if (t < 540) return 'before'
  if (t < 690) return 'zenba'
  if (t < 750) return 'lunch'
  if (t < 930) return 'goba'
  return 'closed'
}

// NYSE: 9:30-16:00 ET ≒ UTC 13:30-20:00（EDT基準、冬時間は約1h後ろにずれる）
function getUSPhase(now: Date, jstDateObj: Date): USPhase {
  const utcDay = now.getUTCDay()
  if (utcDay === 0 || utcDay === 6) return 'holiday'
  if (isNYSEWeekdayHoliday(jstDateObj)) return 'holiday'
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  if (utcMins >= 13 * 60 + 30 && utcMins < 20 * 60) return 'open'
  return 'closed'
}

// 市場セッション切り替え時刻
const SESSIONS = [
  { label: '前場開始まで', h: 9,  mi: 0  },
  { label: '前場終了まで', h: 11, mi: 30 },
  { label: '後場開始まで', h: 12, mi: 30 },
  { label: '後場終了まで', h: 15, mi: 30 },
]

// マクロイベントの JST 発表おおよそ時刻
const MACRO_TIMES: Partial<Record<string, [number, number]>> = {
  fomc:   [3,  0],   // 3:00 JST（2 PM ET 翌朝）
  boj:    [12, 0],   // 正午ごろ
  nfp:    [22, 30],  // 22:30 JST（8:30 AM ET）
  adp:    [22, 15],  // 22:15 JST（8:15 AM ET）
  cpi:    [22, 30],
  pce:    [22, 30],
  ism:    [23, 0],   // 23:00 JST（10:00 AM ET）
  tankan: [8,  50],  // 8:50 JST
}

function fmtCd(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}`
    : `${m}分`
}

interface CdItem { label: string; sec: number }

function getCountdowns(now: Date): CdItem[] {
  const jst = getJST(now)
  const items: CdItem[] = []
  const MAX = 24 * 3600

  // 市場セッション（祝日・休場日は除外）
  if (!isMarketClosedDay(jst.dateObj)) {
    for (const sess of SESSIONS) {
      const remain = (jstTs(jst.y, jst.mo, jst.d, sess.h, sess.mi) - now.getTime()) / 1000
      if (remain > 0 && remain < MAX) items.push({ label: sess.label, sec: Math.floor(remain) })
    }
  }

  // マクロ・SQ イベント（今日・明日）
  const sqDates = [...getSqDates(jst.y), ...getSqDates(jst.y + 1)]
  const filter = { us: true, jp: true }

  for (let i = 0; i < 2; i++) {
    const cd = new Date(jst.dateObj)
    cd.setDate(cd.getDate() + i)
    const cy = cd.getFullYear(), cmo = cd.getMonth() + 1, cday = cd.getDate()

    getMacroEventsForDate(cd, filter).forEach(ev => {
      const [eh, emi] = MACRO_TIMES[ev.type] ?? [0, 0]
      const remain = (jstTs(cy, cmo, cday, eh, emi) - now.getTime()) / 1000
      if (remain > 0 && remain < MAX)
        items.push({ label: `${MACRO_META[ev.type].short}まで`, sec: Math.floor(remain) })
    })

    getSqMarkersForDate(cd, sqDates).forEach(marker => {
      const remain = (jstTs(cy, cmo, cday, 8, 0) - now.getTime()) / 1000
      if (remain > 0 && remain < MAX)
        items.push({ label: marker === 'sq-major' ? 'メジャーSQまで' : 'ミニSQまで', sec: Math.floor(remain) })
    })
  }

  return items.sort((a, b) => a.sec - b.sec).slice(0, 3)
}

export function ClockWidget({ isMobile = false, onGoToday }: { isMobile?: boolean; onGoToday?: () => void }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const jst      = getJST(now)
  const phase    = getPhase(jst.h, jst.mi, jst.dateObj)
  const meta     = PHASE_META[phase]
  const usPhase  = getUSPhase(now, jst.dateObj)
  const usMeta   = US_PHASE_META[usPhase]
  const countdowns = getCountdowns(now)
  const hhmm     = `${jst.h}:${String(jst.mi).padStart(2, '0')}:`
  const ss       = String(jst.s).padStart(2, '0')  // 秒（十の位はブランドカラー）

  const sz = isMobile
    ? { time: 34, status: 13, cdLabel: 12, cdVal: 13, pad: '14px 16px 12px', gap: 5, ptop: 9 }
    : { time: 42, status: 15, cdLabel: 14, cdVal: 15, pad: '18px 18px 14px', gap: 7, ptop: 12 }

  return (
    <div style={{ padding: sz.pad, borderBottom: '1px solid var(--border-dim)', cursor: onGoToday ? 'pointer' : undefined }} onClick={onGoToday}>

      {/* 現在時刻 */}
      <div style={{
        fontFamily: '"Cherry Bomb One", Consolas, monospace',
        fontVariantNumeric: 'tabular-nums',
        fontSize: sz.time, fontWeight: 400, letterSpacing: '0.02em',
        color: 'var(--clock-main)', lineHeight: 1, marginBottom: 16,
      }}>
        {hhmm}
        <span style={{ color: 'var(--clock-sec-tens)' }}>{ss[0]}</span>
        {ss[1]}
      </div>

      {/* 市場ステータス */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        marginBottom: countdowns.length > 0 ? sz.ptop : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: isMobile ? 7 : 8, height: isMobile ? 7 : 8, borderRadius: '50%', flexShrink: 0,
            background: meta.dot,
            boxShadow: meta.glow ? `0 0 6px ${meta.dot}` : 'none',
          }} />
          <span style={{ fontSize: sz.status, fontWeight: 600, color: meta.color, letterSpacing: '0.05em', display: 'flex', gap: '0.5em' }}>
            <span style={{ display: 'inline-block', width: '2em' }}>JP</span>{meta.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: isMobile ? 7 : 8, height: isMobile ? 7 : 8, borderRadius: '50%', flexShrink: 0,
            background: usMeta.dot,
            boxShadow: usMeta.glow ? `0 0 6px ${usMeta.dot}` : 'none',
          }} />
          <span style={{ fontSize: sz.status, fontWeight: 600, color: usMeta.color, letterSpacing: '0.05em', display: 'flex', gap: '0.5em' }}>
            <span style={{ display: 'inline-block', width: '2em' }}>US</span>{usMeta.label}
          </span>
        </div>
      </div>

      {/* カウントダウン（24h以内のみ） */}
      {countdowns.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: sz.gap,
          paddingTop: sz.ptop, borderTop: '1px solid var(--border-dim)',
        }}>
          {countdowns.map(item => (
            <div key={item.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span style={{ fontSize: sz.cdLabel, color: 'var(--text-dim)', letterSpacing: '0.02em' }}>
                {item.label}
              </span>
              <span style={{
                fontSize: sz.cdVal, fontWeight: 600, color: 'var(--text-sub)',
                letterSpacing: '0.02em',
              }}>
                {fmtCd(item.sec)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
