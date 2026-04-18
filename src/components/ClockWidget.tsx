import { useState, useEffect } from 'react'
import { getMacroEventsForDate, MACRO_META } from '../utils/macroCalendar'
import { getSqDates, getSqMarkersForDate } from '../utils/sqCalendar'

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

const PHASE_META: Record<Phase, { label: string; color: string; dot: string; glow: boolean }> = {
  before:  { label: '開場前',   color: 'var(--text-sub)', dot: 'rgba(148,163,184,0.5)', glow: false },
  zenba:   { label: '前場',     color: 'rgba(96,200,140,0.95)', dot: 'rgba(96,200,140,0.9)', glow: true },
  lunch:   { label: '昼休み',   color: 'rgba(251,146,60,0.85)', dot: 'rgba(251,146,60,0.8)', glow: false },
  goba:    { label: '後場',     color: 'rgba(96,200,140,0.95)', dot: 'rgba(96,200,140,0.9)', glow: true },
  closed:  { label: '取引終了', color: 'var(--text-dim)', dot: 'rgba(148,163,184,0.35)', glow: false },
  holiday: { label: '休場',     color: 'var(--text-dim)', dot: 'rgba(148,163,184,0.35)', glow: false },
}

function getPhase(h: number, mi: number, wd: number): Phase {
  if (wd === 0 || wd === 6) return 'holiday'
  const t = h * 60 + mi
  if (t < 540) return 'before'
  if (t < 690) return 'zenba'
  if (t < 750) return 'lunch'
  if (t < 930) return 'goba'
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
  cpi:    [22, 30],
  pce:    [22, 30],
  gdp:    [22, 30],
  tankan: [8,  50],  // 8:50 JST
}

function fmtCd(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface CdItem { label: string; sec: number }

function getCountdowns(now: Date): CdItem[] {
  const jst = getJST(now)
  const items: CdItem[] = []
  const MAX = 24 * 3600

  // 市場セッション
  if (jst.wd !== 0 && jst.wd !== 6) {
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

export function ClockWidget({ isMobile = false }: { isMobile?: boolean }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const jst  = getJST(now)
  const phase = getPhase(jst.h, jst.mi, jst.wd)
  const meta  = PHASE_META[phase]
  const countdowns = getCountdowns(now)
  const timeStr = `${String(jst.h).padStart(2, '0')}:${String(jst.mi).padStart(2, '0')}:${String(jst.s).padStart(2, '0')}`

  const sz = isMobile
    ? { time: 28, status: 11, cdLabel: 10, cdVal: 11, pad: '14px 16px 12px', gap: 4, ptop: 8 }
    : { time: 34, status: 13, cdLabel: 12, cdVal: 13, pad: '18px 18px 14px', gap: 6, ptop: 10 }

  return (
    <div style={{ padding: sz.pad, borderBottom: '1px solid var(--border-dim)' }}>

      {/* 現在時刻 */}
      <div style={{
        fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
        fontSize: sz.time, fontWeight: 700, letterSpacing: '0.02em',
        color: 'var(--text)', lineHeight: 1, marginBottom: 8,
      }}>
        {timeStr}
      </div>

      {/* 市場ステータス */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: countdowns.length > 0 ? sz.ptop : 0,
      }}>
        <span style={{
          width: isMobile ? 7 : 8, height: isMobile ? 7 : 8, borderRadius: '50%', flexShrink: 0,
          background: meta.dot,
          boxShadow: meta.glow ? `0 0 6px ${meta.dot}` : 'none',
        }} />
        <span style={{ fontSize: sz.status, fontWeight: 600, color: meta.color, letterSpacing: '0.05em' }}>
          JP　{meta.label}
        </span>
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
                fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
                fontSize: sz.cdVal, fontWeight: 600, color: 'var(--text-sub)',
                letterSpacing: '0.03em',
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
