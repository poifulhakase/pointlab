// Believe（第4次産業革命）＝研究室 ＞ Believe。
//
// 🔴 **観測だけ**。ロボ口座（日経225ETFの疑似トレード）の判断・売買対象には入れない。
// 🔴 **選ぶ基準は独占があるか**。見立ての文章は `poiroboStockThesis.ts`（人が書く）。
// 🔴 **文章は少なく**（2026-08-16 ユーザー指示）＝数字と結論だけ。詳しい話は「詳しく」に畳む。
// 🔵 見た目はヴィジュアル特化。動きは `prefers-reduced-motion` で止まる。

import { useEffect, useMemo, useState } from 'react'
import { cy } from '../utils/cyberTheme'
import { useInView, useCountUp, reduceMotion } from '../hooks/useMotion'
import {
  fetchPoiroboStocks, sliceSeries, RANGES,
  type PoiroboStocksData, type PoiroboStock, type RangeKey, type StockSeriesPoint, type AiLayer,
} from '../utils/poiroboStocks'
import { thesisOf } from '../utils/poiroboStockThesis'
import { PoiroboLoader } from './PoiroboLoader'
import { PoiroboPixel } from './PoiroboPixel'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }
type C = ReturnType<typeof cy>

const UP = (dark: boolean) => (dark ? '#ff6b6b' : '#dc2626')
const DOWN = (dark: boolean) => (dark ? '#4dabf7' : '#2563eb')
const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)

/** 見立ての `**強調**` を太字に（データ側の * を画面に出さない） */
function rich(text: string, color: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <b key={i} style={{ color }}>{part.slice(2, -2)}</b>
      : <span key={i}>{part}</span>,
  )
}

export default function MomentumStocksView({ theme, isMobile, onClose }: Props) {
  const c = cy(theme)
  const dark = theme === 'dark'
  const [data, setData] = useState<PoiroboStocksData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchPoiroboStocks()
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const pad = isMobile ? 14 : 28

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
      background: c.BG, backgroundImage: c.SCAN, color: c.TXTCLR, fontFamily: c.FONT,
    }}>
      <Keyframes />

      <div style={{
        position: 'sticky', top: 0, zIndex: 6,
        background: dark ? 'rgba(5,14,26,0.82)' : 'rgba(240,247,255,0.86)',
        backdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.BORDER}`,
        padding: `${pad / 2}px ${pad}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span className="mom-pulse" style={{
            width: 8, height: 8, borderRadius: '50%', background: c.GREEN,
            boxShadow: `0 0 10px ${c.GREEN}`, flexShrink: 0,
          }} />
          <span style={{ fontSize: isMobile ? 10 : 11, letterSpacing: '0.2em', color: c.GREEN, whiteSpace: 'nowrap' }}>
            BELIEVE / 第4次産業革命
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる"
          style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, border: `1px solid ${c.BORDER}`, background: 'transparent', color: c.TXTCLR, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      {loading && <div style={{ padding: 40 }}><PoiroboLoader label="BELIEVE" /></div>}

      {!loading && !data && (
        <div style={{ padding: pad, maxWidth: 900, margin: '0 auto', fontSize: 13, color: c.DESC }}>
          まだデータがありません。
        </div>
      )}

      {data && (
        <>
          <Intro c={c} isMobile={isMobile} />
          {data.layers && data.layers.length > 0 && (
            <LayerGap c={c} dark={dark} isMobile={isMobile} layers={data.layers} />
          )}

          {/* 🔴 2列（PC）。銘柄が増えたので縦一列だと遠い（2026-08-16 ユーザー指示） */}
          <div style={{
            maxWidth: 1180, margin: '0 auto', padding: `${isMobile ? 16 : 22}px ${pad}px`,
            display: 'grid', gap: isMobile ? 14 : 18,
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          }}>
            {data.stocks.map(s => (
              <StockCard key={s.code} c={c} dark={dark} isMobile={isMobile} s={s} />
            ))}
          </div>

          <div style={{
            maxWidth: 1180, margin: '0 auto',
            padding: `0 ${pad}px ${isMobile ? 120 : 56}px`,
            fontSize: isMobile ? 10 : 10.5, color: c.DIM, lineHeight: 1.9,
          }}>
            {/* 🔴 免責は残す（個別銘柄を扱うページなので・投資助言を行わない方針） */}
            研究の記録であり、売買の推奨ではありません。<br />
            UPDATED: {new Date(data.updatedAt).toLocaleString('ja-JP')}
          </div>
        </>
      )}
    </div>
  )
}

/** 冒頭。🔵 3行だけ */
function Intro({ c, isMobile }: { c: C; isMobile: boolean }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2)
  return (
    <div ref={ref} style={{
      maxWidth: 1180, margin: '0 auto', padding: isMobile ? '26px 14px 4px' : '46px 28px 6px',
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.3em', color: c.DIM, marginBottom: 10 }}>BELIEVE IN THE FUTURE</div>
      <h1 className={seen ? 'mom-stamp' : undefined} style={{
        opacity: seen ? undefined : 0,
        margin: 0, fontSize: isMobile ? 23 : 38, fontWeight: 900, lineHeight: 1.28,
        color: c.GREEN, textShadow: `0 0 40px ${c.GREEN}44`,
      }}>
        フィジカルAIが、<br />第4次産業革命を起こす。
      </h1>
      <p style={{ margin: '14px 0 0', fontSize: isMobile ? 11.5 : 13, color: c.DESC, lineHeight: 1.9 }}>
        選ぶ基準はひとつ。<b style={{ color: c.GREEN }}>独占があるか</b>。
      </p>
    </div>
  )
}

/**
 * AIの4層と、そこに付いた値段。左にロボット、右に棒。
 * 🔵 ロボットの部位が層と対応する（頭＝考える／胸＝記憶／配線＝つなぐ／関節＝動く）。
 * 🔴 出しているのは12ヶ月の上がり方。層ごとに桁が違うことが分かればいい。
 */
function LayerGap({ c, dark, isMobile, layers }: {
  c: C; dark: boolean; isMobile: boolean; layers: AiLayer[]
}) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2)
  const max = Math.max(100, ...layers.map(l => Math.abs(l.ret12m ?? 0)))
  // 桁が違いすぎる（記憶は+2000%）ので対数で圧縮して形を見せる
  const width = (v: number) => Math.min(100, (Math.log10(Math.abs(v) + 1) / Math.log10(max + 1)) * 100)
  const dim = dark ? 'rgba(255,255,255,0.34)' : 'rgba(3,105,161,0.32)'

  return (
    <div ref={ref} style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '10px 14px 0' : '18px 28px 0' }}>
      <div style={{
        border: `1px solid ${c.BORDER}`, borderRadius: 14, background: c.TAREA,
        padding: isMobile ? 16 : 22,
        display: 'flex', gap: isMobile ? 12 : 26, alignItems: 'center',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <RobotFigure c={c} dark={dark} layers={layers} seen={seen} size={isMobile ? 130 : 200} />

        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: c.DIM, marginBottom: 12 }}>
            AIの4層と、付いた値段（12ヶ月）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 13 }}>
            {layers.map((l, i) => {
              const v = l.ret12m ?? 0
              const ours = !!l.ours
              return (
                <div key={l.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: isMobile ? 10.5 : 12, marginBottom: 4 }}>
                    <span style={{ color: ours ? c.GREEN : c.DESC, fontWeight: ours ? 800 : 600 }}>
                      {l.label}
                      <span style={{ fontSize: isMobile ? 9 : 10, color: c.DIM, marginLeft: 7 }}>{l.name}</span>
                    </span>
                    <span style={{ fontWeight: 800, color: ours ? c.GREEN : c.DESC, fontSize: isMobile ? 11.5 : 14 }}>
                      {pct(v)}
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: ours ? 12 : 8, background: c.LOGBG, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0,
                      width: seen ? `${width(v)}%` : 0,
                      background: ours ? c.GREEN : dim,
                      boxShadow: ours && dark ? `0 0 16px ${c.GREEN}` : 'none',
                      transition: 'width 1100ms cubic-bezier(0.2,0.8,0.2,1)',
                      transitionDelay: `${i * 110}ms`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14, fontSize: isMobile ? 12 : 14, fontWeight: 800, color: c.TXTCLR }}>
            AIは来ている。<span style={{ color: c.GREEN }}>ロボットだけが、まだ来ていない。</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ぽいロボの体で4層を示す。
 *
 * 🔴 ロボットは**ぽいロボ本人**（`PoiroboPixel`＝24×24のドット絵）を使う（2026-08-16 ユーザー指示）。
 *    別のロボットを描くと世界観が2つになるので、印だけを重ねる。
 * 🔵 印の位置はスプライトの升目に合わせてある＝アンテナ(つなぐ)／目(考える)／お腹のLED(記憶)／足(動く)。
 * 🔵 値段が付いた層は鈍く、まだ付いていない層（＝賭けている側）だけが光る。
 */
const ROBOT_MARKS = [
  { key: 'connect', label: 'つなぐ', x: 27, y: 8 },   // アンテナ
  { key: 'think', label: '考える', x: 50, y: 36 },    // 目
  { key: 'memory', label: '記憶', x: 50, y: 51 },     // お腹のLED
  { key: 'move', label: '動く', x: 37, y: 88 },       // 足
] as const

function RobotFigure({ c, dark, layers, seen, size }: {
  c: C; dark: boolean; layers: AiLayer[]; seen: boolean; size: number
}) {
  const on = (key: string) => !!layers.find(l => l.key === key)?.ours

  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
      opacity: seen ? 1 : 0, transition: 'opacity 700ms ease',
    }}>
      <PoiroboPixel size={size} alt="" />
      {ROBOT_MARKS.map(m => {
        const lit = on(m.key)
        const color = lit ? c.GREEN : (dark ? 'rgba(255,255,255,0.36)' : 'rgba(3,105,161,0.4)')
        return (
          <div key={m.key} style={{
            position: 'absolute', left: `${m.x}%`, top: `${m.y}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none',
          }}>
            <span className={lit ? 'mom-pulse' : undefined} style={{
              width: lit ? 9 : 6, height: lit ? 9 : 6, borderRadius: '50%',
              border: `2px solid ${color}`, background: lit ? color : 'transparent',
              boxShadow: lit && dark ? `0 0 10px ${c.GREEN}` : 'none',
            }} />
            <span style={{
              fontSize: 9, letterSpacing: '0.06em', color,
              fontWeight: lit ? 800 : 500, whiteSpace: 'nowrap',
              textShadow: dark ? '0 1px 3px rgba(0,0,0,0.9)' : '0 1px 3px rgba(255,255,255,0.9)',
            }}>{m.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 1銘柄ぶんのカード（2列に並ぶ） */
function StockCard({ c, dark, isMobile, s }: {
  c: C; dark: boolean; isMobile: boolean; s: PoiroboStock
}) {
  const [ref, seen] = useInView<HTMLDivElement>(0.1)
  const [open, setOpen] = useState(false)
  const price = useCountUp(s.close ?? 0, seen, 1100)
  const th = thesisOf(s.code)
  const accent = (s.change_pct ?? 0) >= 0 ? UP(dark) : DOWN(dark)

  return (
    <div ref={ref} className={seen ? 'mom-rise' : undefined} style={{
      opacity: seen ? undefined : 0,
      position: 'relative', overflow: 'hidden',
      border: `1px solid ${c.BORDER}`, borderRadius: 14, background: c.TAREA,
      padding: isMobile ? 14 : 18,
    }}>
      <div aria-hidden style={{
        position: 'absolute', right: -6, top: -8, fontSize: isMobile ? 38 : 54, fontWeight: 900,
        letterSpacing: '-0.05em', color: c.GREEN, opacity: 0.07, pointerEvents: 'none', userSelect: 'none',
      }}>{s.kana}</div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px', borderRadius: 999, border: `1px solid ${c.BORDBR}`,
            fontSize: 10, color: c.GREEN, letterSpacing: '0.08em',
          }}>{s.code}</span>
          <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 900 }}>{s.name}</span>
          {th && <span style={{ fontSize: 9.5, color: c.DIM, letterSpacing: '0.06em' }}>{th.laneLabel}</span>}
        </div>

        {th && (
          <div style={{ marginTop: 8, fontSize: isMobile ? 12 : 13.5, fontWeight: 800, color: c.GREEN, lineHeight: 1.6 }}>
            {th.headline}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: isMobile ? 26 : 32, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', color: accent,
            textShadow: dark ? `0 0 24px ${accent}44` : 'none',
          }}>{Math.round(price).toLocaleString()}</span>
          <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 800, color: accent, paddingBottom: 2 }}>
            {pct(s.change_pct, 2)}
          </span>
          <span style={{ fontSize: 9.5, color: c.DIM, paddingBottom: 4 }}>{s.stance?.label ?? ''}</span>
        </div>

        <PriceChart c={c} dark={dark} isMobile={isMobile} s={s} seen={seen} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <MiniStat c={c} label="12ヶ月" value={pct(s.momentum?.ret?.m12)} strong />
          <MiniStat c={c} label="3ヶ月" value={pct(s.momentum?.ret?.m3)} />
          <MiniStat c={c} label="52週高値から" value={pct(s.momentum?.from_52w_high_pct)} />
          <MiniStat c={c} label="25日線から" value={pct(s.dev25_pct)} />
        </div>

        {th && (
          <div style={{
            marginTop: 12, padding: isMobile ? '10px 12px' : '12px 14px',
            border: `1px solid ${c.BORDBR}`, borderLeft: `3px solid ${c.GREEN}`,
            borderRadius: 10, background: c.HDBG,
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: c.DIM, marginBottom: 5 }}>MOAT / 独占</div>
            <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: c.GREEN, lineHeight: 1.5 }}>
              {th.moat.label}
            </div>
          </div>
        )}

        {th && (
          <>
            <button type="button" onClick={() => setOpen(v => !v)}
              style={{
                marginTop: 10, cursor: 'pointer', background: 'none', border: `1px solid ${c.BORDER}`,
                borderRadius: 999, padding: '4px 12px', fontFamily: c.FONT,
                fontSize: 10, color: c.DIM, letterSpacing: '0.08em',
              }}>{open ? '閉じる' : '詳しく'}</button>

            {open && (
              <div style={{ marginTop: 12, fontSize: isMobile ? 11.5 : 12.5, color: c.DESC, lineHeight: 1.9 }}>
                <div style={{ marginBottom: 10 }}>{rich(th.moat.detail, c.TXTCLR)}</div>
                <Block c={c} title="WHY / なぜ見ているか" items={th.why} />
                <Block c={c} title="CONFIRM / 効いていれば出る数字" items={th.confirm} />
                <Block c={c} title="BREAK / 崩れる条件" items={th.breaks} />
                <div style={{ fontSize: 10, color: c.DIM, marginTop: 8 }}>
                  決算 {th.earnings} ／ 観測開始 {th.markedOn}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Block({ c, title, items }: { c: C; title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.18em', color: c.DIM, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
        {items.map(t => <li key={t} style={{ marginBottom: 3 }}>{rich(t, c.TXTCLR)}</li>)}
      </ul>
    </div>
  )
}

function MiniStat({ c, label, value, strong }: { c: C; label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ borderTop: `1px solid ${c.BORDER}`, paddingTop: 7 }}>
      <div style={{ fontSize: 9, color: c.DIM, letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: strong ? 16 : 14, fontWeight: 800, color: strong ? c.GREEN : c.TXTCLR }}>
        {value}
      </div>
    </div>
  )
}

/** 価格チャート。見えたときに線が描かれる */
function PriceChart({ c, dark, isMobile, s, seen }: {
  c: C; dark: boolean; isMobile: boolean; s: PoiroboStock; seen: boolean
}) {
  const [range, setRange] = useState<RangeKey>('1y')
  const rows = useMemo(() => sliceSeries(s.series ?? [], range).filter(p => p.c != null), [s.series, range])
  if (!rows.length) return null

  const W = 1000
  const H = isMobile ? 130 : 150
  const PADY = 10
  const closes = rows.map(p => p.c as number)
  const mas = rows.filter(p => p.m200 != null).map(p => p.m200 as number)
  const lo = Math.min(...closes, ...(mas.length ? mas : closes))
  const hi = Math.max(...closes, ...(mas.length ? mas : closes))
  const span = hi - lo || 1
  const x = (i: number) => (i / Math.max(1, rows.length - 1)) * W
  const y = (v: number) => PADY + (1 - (v - lo) / span) * (H - PADY * 2)

  const line = (get: (p: StockSeriesPoint) => number | null) => {
    let d = ''; let started = false
    rows.forEach((p, i) => {
      const v = get(p)
      if (v == null) { started = false; return }
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
      started = true
    })
    return d.trim()
  }
  const priceLine = line(p => p.c)
  const maLine = line(p => p.m200)
  const area = `${priceLine} L${W},${H} L0,${H} Z`
  const last = rows[rows.length - 1]
  const stroke = (last.c ?? 0) >= (rows[0].c ?? 0) ? UP(dark) : DOWN(dark)
  const id = `mom-${s.code}-${range}`

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginBottom: 5 }}>
        {RANGES.map(r => {
          const on = r.key === range
          return (
            <button key={r.key} type="button" onClick={() => setRange(r.key)}
              style={{
                cursor: on ? 'default' : 'pointer', border: `1px solid ${on ? c.BORDBR : c.BORDER}`,
                background: on ? c.HDBG : 'transparent', color: on ? c.GREEN : c.DIM,
                borderRadius: 999, padding: '2px 9px', fontFamily: c.FONT, fontSize: 9,
              }}>{r.label}</button>
          )
        })}
      </div>
      <div style={{ border: `1px solid ${c.BORDER}`, borderRadius: 10, overflow: 'hidden', background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={dark ? 0.4 : 0.26} />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* 200日線（破線） */}
          {maLine && <path d={maLine} fill="none" stroke={c.DIM} strokeWidth="1.2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
          <path d={area} fill={`url(#${id}-fill)`} />
          <path d={priceLine} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" className={seen && !reduceMotion() ? 'mom-draw' : undefined} />
          <circle cx={W} cy={y(last.c as number)} r="4" fill={stroke} className="mom-pulse" />
        </svg>
      </div>
    </div>
  )
}

function Keyframes() {
  return (
    <style>{`
      @keyframes mom-rise { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
      .mom-rise { animation: mom-rise 600ms cubic-bezier(0.2,0.8,0.2,1) both; }

      @keyframes mom-stamp {
        0%   { opacity:0; transform: translateY(16px) scale(1.03); filter: blur(5px); }
        100% { opacity:1; transform:none; filter:none; }
      }
      .mom-stamp { animation: mom-stamp 720ms cubic-bezier(0.2,0.9,0.2,1) both; }

      @keyframes mom-draw { from { stroke-dashoffset: 3000; } to { stroke-dashoffset: 0; } }
      .mom-draw { stroke-dasharray: 3000; animation: mom-draw 1500ms cubic-bezier(0.25,0.9,0.3,1) both; }

      @keyframes mom-pulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.3); opacity:0.55; } }
      .mom-pulse { animation: mom-pulse 2.4s ease-in-out infinite; transform-origin: center; }

      @media (prefers-reduced-motion: reduce) {
        .mom-rise, .mom-stamp, .mom-draw, .mom-pulse { animation: none !important; opacity:1 !important; transform:none !important; }
      }
    `}</style>
  )
}
