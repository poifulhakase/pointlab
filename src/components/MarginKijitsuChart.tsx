// 信用期日のチャート（SVG）。週足＋制度/一般の買残＋悪化期間（赤）＋期日の目安（青）。
// 🔵 画像ファイルは作らない。登録してあるのは銘柄コードだけで、開くたびに最新のデータで描く。
import type { MarginRun, MarginWeek, WeeklyBar } from '../utils/marginKijitsu'
import type { CyColors } from '../utils/cyberTheme'

type Props = {
  bars: WeeklyBar[]
  margin: MarginWeek[]
  runs: MarginRun[]
  c: CyColors
  theme: 'dark' | 'light'
  today?: string
}

const W = 960
const PAD = { l: 8, r: 56, b: 22 }
const PRICE_H = 230
const GAP = 14
const MARGIN_H = 82
/** 上の注記帯（悪化期間 → 期日）1段の高さ。ローソク足に重ねないため、図の外に段を取る。 */
const NOTE_ROW = 22
const DAY = 86400000

const t = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}
/** 11px の文字の幅の見積もり（半角≒0.6em・全角≒1em）。注記の重なりを避けるのに使う。 */
const textW = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) < 256 ? 6.8 : 11), 0)
const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`

export function MarginKijitsuChart({ bars, margin, runs, c, theme, today }: Props) {
  const L = theme === 'light'
  const TOP = 10 + runs.length * NOTE_ROW
  const H = TOP + PRICE_H + GAP + MARGIN_H + PAD.b
  const PAD_T = TOP
  const UP = L ? '#0f9d8a' : '#26a69a'
  const DN = L ? '#d93b3b' : '#ef5350'
  const BAD = L ? '#d93b3b' : '#ef5350'
  const KIJ = L ? '#1d4ed8' : '#2962ff'
  const KIJ_TXT = L ? '#1d4ed8' : '#82b1ff'
  const GEN = L ? 'rgba(180,120,0,0.35)' : 'rgba(247,166,0,0.28)'
  const SYS = L ? '#b45309' : '#f7a600'
  const todayStr = today ?? new Date().toISOString().slice(0, 10)

  // 横軸＝直近1年の株価 〜 期日の目安の先（無ければ今日から2か月先）まで
  const lastKij = runs.reduce((m, r) => (r.kijitsuTo > m ? r.kijitsuTo : m), todayStr)
  const x0 = t(todayStr) - 365 * DAY
  const x1 = Math.max(t(lastKij), t(todayStr)) + 60 * DAY
  const vis = bars.filter((b) => t(b.date) >= x0 - 7 * DAY)
  const innerW = W - PAD.l - PAD.r
  const X = (ms: number) => PAD.l + ((ms - x0) / (x1 - x0)) * innerW
  const bw = Math.max(2, (7 * DAY / (x1 - x0)) * innerW * 0.6)

  const lo = Math.min(...vis.map((b) => b.low)) * 0.94
  const hi = Math.max(...vis.map((b) => b.high)) * 1.04
  const Y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * PRICE_H
  const mTop = PAD_T + PRICE_H + GAP
  const mMax = Math.max(1, ...margin.map((m) => m.sysLong + m.genLong)) * 1.15
  const MY = (v: number) => mTop + MARGIN_H - (v / mMax) * MARGIN_H

  const ticks = niceTicks(lo, hi, 5)
  const months: number[] = []
  {
    const d = new Date(x0)
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    while (d.getTime() < x1) { months.push(d.getTime()); d.setMonth(d.getMonth() + 1) }
  }
  const last = bars[bars.length - 1]
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1))

  const band = (from: string, to: string, color: string, key: string) => {
    const a = X(t(from)); const b = X(t(to) + DAY)
    return (
      <g key={key}>
        <rect x={a} y={PAD_T} width={Math.max(1, b - a)} height={PRICE_H + GAP + MARGIN_H} fill={color} opacity={0.16} />
        <line x1={a} x2={a} y1={PAD_T} y2={mTop + MARGIN_H} stroke={color} strokeWidth={1.4} />
        <line x1={b} x2={b} y1={PAD_T} y2={mTop + MARGIN_H} stroke={color} strokeWidth={1.4} />
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="信用期日のチャート" style={{ display: 'block', fontFamily: c.FONT }}>
      {/* 格子 */}
      {ticks.map((v) => (
        <g key={`y${v}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} stroke={c.BORDER} strokeWidth={0.6} />
          <text x={W - PAD.r + 6} y={Y(v) + 3} fontSize={10} fill={c.DIM}>{fmt(v)}</text>
        </g>
      ))}
      {months.map((m) => {
        const d = new Date(m)
        return (
          <g key={`m${m}`}>
            <line x1={X(m)} x2={X(m)} y1={PAD_T} y2={mTop + MARGIN_H} stroke={c.BORDER} strokeWidth={0.5} />
            <text x={X(m) + 3} y={H - 6} fontSize={10} fill={c.DIM}>
              {d.getMonth() === 0 ? `${String(d.getFullYear()).slice(2)}/1` : `${d.getMonth() + 1}月`}
            </text>
          </g>
        )
      })}

      {/* 悪化期間（赤）と期日の目安（青） */}
      {runs.map((r, i) => band(r.from, r.to, BAD, `bad${i}`))}
      {runs.map((r, i) => band(r.kijitsuFrom, r.kijitsuTo, KIJ, `kij${i}`))}

      {/* ローソク足 */}
      {vis.map((b) => {
        const x = X(t(b.date) + 2 * DAY)
        const col = b.close >= b.open ? UP : DN
        const top = Y(Math.max(b.open, b.close))
        const h = Math.max(1, Math.abs(Y(b.open) - Y(b.close)))
        return (
          <g key={b.date}>
            <line x1={x} x2={x} y1={Y(b.high)} y2={Y(b.low)} stroke={col} strokeWidth={1} />
            <rect x={x - bw / 2} y={top} width={bw} height={h} fill={col} />
          </g>
        )
      })}

      {/* 今日 */}
      <line x1={X(t(todayStr))} x2={X(t(todayStr))} y1={PAD_T} y2={mTop + MARGIN_H} stroke={c.DIM} strokeDasharray="2 3" />
      <text x={X(t(todayStr)) + 3} y={PAD_T + PRICE_H - 4} fontSize={10} fill={c.DIM}>今日</text>

      {/* 最新値 */}
      {last && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(last.close)} y2={Y(last.close)} stroke={UP} strokeWidth={0.6} strokeDasharray="1 3" />
          <rect x={W - PAD.r + 2} y={Y(last.close) - 8} width={PAD.r - 4} height={16} rx={2} fill={UP} />
          <text x={W - PAD.r + 5} y={Y(last.close) + 4} fontSize={10} fill={L ? '#fff' : '#050e1a'} fontWeight={700}>{fmt(last.close)}</text>
        </g>
      )}

      {/* 期日の注記（悪化期間 → 期日）＝上の帯に1段ずつ */}
      {runs.map((r, i) => {
        const y = 6 + i * NOTE_ROW + 12
        const a = X(t(r.from))
        const endBad = X(t(r.to) + DAY)
        const kf = X(t(r.kijitsuFrom))
        const kt = X(t(r.kijitsuTo) + DAY)
        const kijText = `期日の目安 ${r.kijitsuFrom.slice(0, 4)}/${md(r.kijitsuFrom)}〜${md(r.kijitsuTo)}`
        // 右端からはみ出すなら、青い帯の右端にそろえて左へ伸ばす
        const badText = `悪化 ${md(r.from)}〜${md(r.to)}（${r.weeks}週）`
        const kijRight = kf + textW(kijText) > W - PAD.r
        const kijStart = kijRight ? kt - textW(kijText) : kf
        return (
          <g key={`note${i}`} fontSize={11} fontWeight={700}>
            <text x={a} y={y} fill={BAD}>{badText}</text>
            <line x1={Math.max(endBad, a + textW(badText)) + 6} x2={kijStart - 6} y1={y - 4} y2={y - 4} stroke={c.DIM} strokeDasharray="4 3" />
            <text x={kijRight ? kt : kf} y={y} textAnchor={kijRight ? 'end' : 'start'} fill={KIJ_TXT}>{kijText}</text>
          </g>
        )
      })}

      {/* 下段：買残（制度＝濃い・一般＝薄い） */}
      <line x1={PAD.l} x2={W - PAD.r} y1={mTop + MARGIN_H} y2={mTop + MARGIN_H} stroke={c.BORDER} />
      {margin.map((m) => {
        const x = X(t(m.w) - 2 * DAY)
        return (
          <g key={m.w}>
            <rect x={x - bw / 2} y={MY(m.sysLong + m.genLong)} width={bw} height={MY(m.sysLong) - MY(m.sysLong + m.genLong)} fill={GEN} />
            <rect x={x - bw / 2} y={MY(m.sysLong)} width={bw} height={mTop + MARGIN_H - MY(m.sysLong)} fill={SYS} />
          </g>
        )
      })}
      <text x={PAD.l + 2} y={mTop + 10} fontSize={10} fill={SYS}>買残（濃＝制度・薄＝一般）</text>
      <text x={W - PAD.r + 6} y={mTop + 10} fontSize={10} fill={c.DIM}>{(mMax / 1.15 / 1e6).toFixed(1)}M</text>
    </svg>
  )
}

function niceTicks(lo: number, hi: number, n: number): number[] {
  const raw = (hi - lo) / n
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
