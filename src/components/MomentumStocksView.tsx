// 中長期モメンタム銘柄（研究室 ＞ MOMENTUM）。
//
// 🔴 **観測だけ**。ロボ口座（日経225ETFの疑似トレード）の判断・売買対象には入れない
//    （2026-08-16 ユーザー合意。30トレード貯まるまで分母を壊さない）。
// 🔴 見立ての文章は「売買の推奨」ではなく**仮説と確認点と崩れる条件**で書く
//    （投資助言を行わない方針・2026-06-05）。文章は `poiroboStockThesis.ts`。
// 🔵 主軸は日経平均のまま。だから**日経との連動（β・相関）と相対リターン**を必ず並べる。
// 🔵 見た目は「ヴィジュアル特化」（ユーザー指示）＝1銘柄1画面ぶんの大きな面を作り、
//    巨大な社名・特大の株価・全幅のチャート・伸びるバーで見せる。
//    🔴 ただし数字は盛らない。動きは `prefers-reduced-motion` で止まる。

import { useEffect, useMemo, useState } from 'react'
import { cy } from '../utils/cyberTheme'
import { useInView, useCountUp, reduceMotion } from '../hooks/useMotion'
import {
  fetchPoiroboStocks, sliceSeries, RANGES,
  type PoiroboStocksData, type PoiroboStock, type RangeKey, type StockSeriesPoint, type AiLayer,
} from '../utils/poiroboStocks'
import { thesisOf, DROPPED } from '../utils/poiroboStockThesis'
import { PoiroboLoader } from './PoiroboLoader'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }
type C = ReturnType<typeof cy>

const UP = (dark: boolean) => (dark ? '#ff6b6b' : '#dc2626')
const DOWN = (dark: boolean) => (dark ? '#4dabf7' : '#2563eb')
const pct = (v: number | null | undefined, d = 2) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)

/**
 * 見立ての本文の `**強調**` を太字にする。
 * 🔴 データ側に `**` を書いたまま出すと画面に * が残る（波動の書で踏んだのと同じ）。
 *    データから消すのではなく、ここで解釈する（どこが要点かは文章の一部なので）。
 */
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

      {/* ヘッダー */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 6,
        background: dark ? 'rgba(5,14,26,0.82)' : 'rgba(240,247,255,0.86)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${c.BORDER}`,
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
          {data?.index?.close != null && (
            <span style={{ fontSize: isMobile ? 9.5 : 10.5, color: c.DIM, letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ／ 日経 {data.index.close.toLocaleString()} {pct(data.index.change_pct)}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる"
          style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, border: `1px solid ${c.BORDER}`, background: 'transparent', color: c.TXTCLR, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      {loading && <div style={{ padding: 40 }}><PoiroboLoader label="BELIEVE" /></div>}

      {!loading && !data && (
        <div style={{ padding: pad, maxWidth: 900, margin: '0 auto', fontSize: 13, color: c.DESC, lineHeight: 1.9 }}>
          まだデータがありません。毎営業日の自動更新で入ります。
        </div>
      )}

      {data && (
        <>
          <Intro c={c} isMobile={isMobile} n={data.stocks.length} />
          {data.layers && data.layers.length > 0 && (
            <LayerGap c={c} dark={dark} isMobile={isMobile} layers={data.layers} />
          )}
          {data.stocks.map((s, i) => (
            <StockPanel key={s.code} c={c} dark={dark} isMobile={isMobile} s={s} order={i + 1} />
          ))}
          <div style={{
            maxWidth: 1080, margin: '0 auto', padding: `${pad}px ${pad}px ${isMobile ? 120 : 60}px`,
            fontSize: isMobile ? 10.5 : 11.5, color: c.DIM, lineHeight: 1.9,
          }}>
            {DROPPED.length > 0 && (
              <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${c.BORDER}` }}>
                <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: c.DIM, marginBottom: 6 }}>
                  DROPPED / 見送った枠
                </div>
                {DROPPED.map(d => (
                  <div key={d.code} style={{ lineHeight: 1.9 }}>
                    <b style={{ color: c.DESC }}>{d.code} {d.name}</b>（{d.date}）— {d.reason}
                  </div>
                ))}
              </div>
            )}
            {data.basis}。{data.caveat}<br />
            🔴 このページは研究の記録であり、売買の推奨ではありません。数値は過去データにもとづくもので、将来の成果を示すものではありません。<br />
            UPDATED: {new Date(data.updatedAt).toLocaleString('ja-JP')}
          </div>
        </>
      )}
    </div>
  )
}

/** 冒頭＝この画面が何なのかを1画面ぶんで言い切る */
function Intro({ c, isMobile, n }: { c: C; isMobile: boolean; n: number }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2)
  return (
    <div ref={ref} style={{
      position: 'relative', overflow: 'hidden',
      maxWidth: 1080, margin: '0 auto', padding: isMobile ? '30px 14px 6px' : '56px 28px 10px',
    }}>
      <div aria-hidden className={seen ? 'mom-ghost' : undefined} style={{
        position: 'absolute', right: isMobile ? -30 : 0, top: '46%', transform: 'translateY(-50%)',
        fontSize: isMobile ? 120 : 220, fontWeight: 900, lineHeight: 1,
        color: c.GREEN, opacity: 0, letterSpacing: '-0.04em', pointerEvents: 'none', userSelect: 'none',
      }}>{n}</div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.3em', color: c.DIM, marginBottom: 12 }}>BELIEVE IN THE FUTURE</div>
        <h1 className={seen ? 'mom-stamp' : undefined} style={{
          opacity: seen ? undefined : 0,
          margin: 0, fontSize: isMobile ? 24 : 40, fontWeight: 900, lineHeight: 1.28,
          color: c.GREEN, textShadow: `0 0 40px ${c.GREEN}44`,
        }}>
          フィジカルAIが、<br />第4次産業革命を起こす。
        </h1>
        <p className={seen ? 'mom-rise' : undefined} style={{
          opacity: seen ? undefined : 0, animationDelay: '220ms',
          margin: '16px 0 0', fontSize: isMobile ? 12 : 13.5, color: c.DESC, lineHeight: 2,
          maxWidth: 720,
        }}>
          AIは<b style={{ color: c.TXTCLR }}>考える側</b>から<b style={{ color: c.TXTCLR }}>動く側</b>へ移る。
          ここはその未来に賭けた銘柄を、<b style={{ color: c.TXTCLR }}>見立て・チャート・日経との強さ比べ</b>で並べる場所です。
          <br />🔴 選ぶ基準はひとつ。<b style={{ color: c.GREEN }}>独占があるか</b>——独占が無ければ、
          台数が増えても値下げ競争で終わるからです。
          <br />🔵 数ヶ月〜年単位で持つ前提。途中の上下は判定材料にしません。
        </p>
      </div>
    </div>
  )
}

/**
 * AIの4層と、そこに付いた値段。**この画面の主張を1枚で言う絵**。
 *
 * 🔴 出しているのは「対日経12ヶ月」＝**指数に対してどれだけ買われたか**。
 *    素のリターンだと日経自体の上昇（12ヶ月+67%）が混ざって、層の差が見えない。
 * 🔵 動く側だけ棒が反対向きに出る。ここが仮説の全部。
 */
function LayerGap({ c, dark, isMobile, layers }: {
  c: C; dark: boolean; isMobile: boolean; layers: AiLayer[]
}) {
  const [ref, seen] = useInView<HTMLDivElement>(0.2)
  const max = Math.max(100, ...layers.map(l => Math.abs(l.rel12m ?? 0)))
  // 🔵 桁が違いすぎる（記憶は+2000%）ので、棒は対数っぽく圧縮して形を見せる
  const width = (v: number) => Math.min(100, (Math.log10(Math.abs(v) + 1) / Math.log10(max + 1)) * 100)

  return (
    <div ref={ref} style={{
      maxWidth: 1080, margin: '0 auto', padding: isMobile ? '10px 14px 0' : '18px 28px 0',
    }}>
      <div style={{
        border: `1px solid ${c.BORDER}`, borderRadius: 14, background: c.TAREA,
        padding: isMobile ? 16 : 24,
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '0.24em', color: c.DIM, marginBottom: 4 }}>
          WHERE THE MONEY WENT / AIの4層と、付いた値段
        </div>
        <div style={{ fontSize: isMobile ? 11.5 : 13, color: c.DESC, lineHeight: 1.9, marginBottom: 16 }}>
          対日経225・12ヶ月（＝指数に対してどれだけ買われたか）
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 15 }}>
          {layers.map((l, i) => {
            const v = l.rel12m ?? 0
            const ours = !!l.ours
            const color = ours ? c.GREEN : (dark ? 'rgba(255,255,255,0.34)' : 'rgba(3,105,161,0.32)')
            return (
              <div key={l.key}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  fontSize: isMobile ? 11 : 12.5, marginBottom: 5,
                }}>
                  <span style={{ color: ours ? c.GREEN : c.DESC, fontWeight: ours ? 800 : 600 }}>
                    {l.label}
                    <span style={{ fontSize: isMobile ? 9.5 : 10.5, color: c.DIM, marginLeft: 8 }}>{l.sub} ／ {l.name}</span>
                  </span>
                  <span style={{
                    fontWeight: 800, color: v >= 0 ? (ours ? c.GREEN : c.DESC) : c.GREEN,
                    fontSize: isMobile ? 12 : 15,
                  }}>{pct(v, 1)}</span>
                </div>
                <div style={{ position: 'relative', height: ours ? 14 : 10, background: c.LOGBG, borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0,
                    width: seen ? `${width(v)}%` : 0,
                    background: color,
                    boxShadow: ours && dark ? `0 0 16px ${c.GREEN}` : 'none',
                    transition: 'width 1100ms cubic-bezier(0.2,0.8,0.2,1)',
                    transitionDelay: `${i * 110}ms`,
                  }} />
                </div>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: `1px solid ${c.BORDER}`,
          fontSize: isMobile ? 11.5 : 13, color: c.TXTCLR, lineHeight: 1.9, fontWeight: 700,
        }}>
          AIは来ている。<span style={{ color: c.GREEN }}>ロボットだけが、まだ来ていない。</span>
        </div>
        <div style={{ marginTop: 6, fontSize: isMobile ? 10 : 11, color: c.DIM, lineHeight: 1.9 }}>
          🔴 「まだ来ていない」は「これから来る」を意味しません。来ない理由（利益がまだ出ていない・中国勢の台頭）が
          正当である可能性も同じだけあります。だからこの画面は、来たかどうかを**数字で確かめ続ける**ために置いています。
        </div>
      </div>
    </div>
  )
}

/** 1銘柄ぶんの大きな面 */
function StockPanel({ c, dark, isMobile, s, order }: {
  c: C; dark: boolean; isMobile: boolean; s: PoiroboStock; order: number
}) {
  const [ref, seen] = useInView<HTMLDivElement>(0.12)
  const price = useCountUp(s.close ?? 0, seen, 1300)
  const th = thesisOf(s.code)
  const up = (s.change_pct ?? 0) >= 0
  const accent = up ? UP(dark) : DOWN(dark)
  const pad = isMobile ? 14 : 28

  return (
    <section ref={ref} style={{
      position: 'relative', overflow: 'hidden',
      borderTop: `1px solid ${c.BORDER}`,
      padding: `${isMobile ? 30 : 54}px 0 ${isMobile ? 24 : 44}px`,
      marginTop: isMobile ? 26 : 46,
    }}>
      {/* 背景の巨大な社名（英字） */}
      <div aria-hidden className={seen ? 'mom-ghost' : undefined} style={{
        position: 'absolute', left: isMobile ? -14 : 10, top: isMobile ? 4 : -14,
        fontSize: isMobile ? 74 : 168, fontWeight: 900, lineHeight: 1,
        letterSpacing: '-0.05em', color: c.GREEN, opacity: 0,
        pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
      }}>{s.kana}</div>

      <div style={{ position: 'relative', maxWidth: 1080, margin: '0 auto', padding: `0 ${pad}px` }}>
        {/* 見出し */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.28em', color: c.DIM }}>0{order}</span>
          <span style={{
            padding: '3px 10px', borderRadius: 999, border: `1px solid ${c.BORDBR}`,
            fontSize: isMobile ? 11 : 12, color: c.GREEN, letterSpacing: '0.1em',
          }}>{s.code}</span>
          <h2 style={{ margin: 0, fontSize: isMobile ? 26 : 44, fontWeight: 900, letterSpacing: '-0.01em' }}>
            {s.name}
          </h2>
        </div>
        {th && (
          <>
            {/* 🔴 どちらの仮説に賭けている枠か（後から答え合わせするための札） */}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                padding: '3px 10px', borderRadius: 999,
                border: `1px solid ${c.BORDBR}`, background: c.HDBG,
                fontSize: isMobile ? 10 : 11, color: c.GREEN, letterSpacing: '0.06em',
              }}>{th.laneLabel}</span>
              <span style={{ fontSize: isMobile ? 9.5 : 10.5, color: c.DIM, letterSpacing: '0.06em' }}>
                観測開始 {th.markedOn}
              </span>
            </div>
            <p className={seen ? 'mom-rise' : undefined} style={{
              opacity: seen ? undefined : 0, animationDelay: '120ms',
              margin: '12px 0 0', fontSize: isMobile ? 14 : 20, fontWeight: 800, lineHeight: 1.6,
              color: c.GREEN,
            }}>{th.headline}</p>
          </>
        )}

        {/* 株価と姿勢 */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: isMobile ? 14 : 26, flexWrap: 'wrap',
          margin: `${isMobile ? 18 : 26}px 0 ${isMobile ? 12 : 18}px`,
        }}>
          <div>
            <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: c.DIM, marginBottom: 4 }}>PRICE / {s.date}</div>
            <div style={{
              fontSize: isMobile ? 40 : 64, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em',
              color: accent, textShadow: dark ? `0 0 34px ${accent}44` : 'none',
            }}>
              {Math.round(price).toLocaleString()}
              <span style={{ fontSize: isMobile ? 14 : 18, marginLeft: 6, color: c.DIM }}>円</span>
            </div>
          </div>
          <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: accent, paddingBottom: 6 }}>
            {pct(s.change_pct)}
          </div>
          <div style={{ paddingBottom: 8 }}>
            <StanceChip c={c} label={s.stance?.label ?? '—'} keyName={s.stance?.key ?? 'unknown'} isMobile={isMobile} />
          </div>
          <div style={{ paddingBottom: 8, fontSize: isMobile ? 10 : 11, color: c.DIM, lineHeight: 1.8 }}>
            出来高 {s.volume ? (s.volume / 1000).toFixed(0) + 'k' : '—'}
            {s.volume_x != null && <>（平常の {s.volume_x.toFixed(2)} 倍）</>}
          </div>
        </div>

        {/* チャート */}
        <PriceChart c={c} dark={dark} isMobile={isMobile} s={s} seen={seen} />

        {/* 数字の帯 */}
        <div style={{
          display: 'grid', gap: 10, marginTop: isMobile ? 16 : 22,
          gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr',
        }}>
          <RelativeBars c={c} dark={dark} isMobile={isMobile} s={s} seen={seen} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RangeMeter c={c} isMobile={isMobile} s={s} seen={seen} />
            <LinkCard c={c} isMobile={isMobile} s={s} />
          </div>
        </div>

        {/* 見立て */}
        {th && <ThesisBlock c={c} isMobile={isMobile} th={th} />}
      </div>
    </section>
  )
}

function StanceChip({ c, label, keyName, isMobile }: { c: C; label: string; keyName: string; isMobile: boolean }) {
  const strong = keyName === 'leading' || keyName === 'trend'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: isMobile ? '5px 10px' : '7px 14px', borderRadius: 999,
      border: `1px solid ${strong ? c.BORDBR : c.BORDER}`,
      background: strong ? c.HDBG : 'transparent',
      fontSize: isMobile ? 10.5 : 11.5, color: strong ? c.GREEN : c.DIM, letterSpacing: '0.04em',
    }}>
      <span className={strong ? 'mom-pulse' : undefined} style={{
        width: 6, height: 6, borderRadius: '50%', background: strong ? c.GREEN : c.DIM,
      }} />
      {label}
    </span>
  )
}

/**
 * 価格チャート。
 * 🔵 見えたときに線が左から書かれる（`stroke-dashoffset`）。
 * 🔴 目盛りは出さない代わりに、**高値・安値・200日線**を線とラベルで置く。
 */
function PriceChart({ c, dark, isMobile, s, seen }: {
  c: C; dark: boolean; isMobile: boolean; s: PoiroboStock; seen: boolean
}) {
  const [range, setRange] = useState<RangeKey>('1y')
  const rows = useMemo(() => sliceSeries(s.series ?? [], range).filter(p => p.c != null), [s.series, range])
  if (!rows.length) return null

  const W = 1000
  const H = isMobile ? 200 : 300
  const PADX = 4
  const PADY = 16
  const closes = rows.map(p => p.c as number)
  const withMa = rows.filter(p => p.m200 != null).map(p => p.m200 as number)
  const lo = Math.min(...closes, ...(withMa.length ? withMa : closes))
  const hi = Math.max(...closes, ...(withMa.length ? withMa : closes))
  const span = hi - lo || 1
  const x = (i: number) => PADX + (i / Math.max(1, rows.length - 1)) * (W - PADX * 2)
  const y = (v: number) => PADY + (1 - (v - lo) / span) * (H - PADY * 2)

  const line = (get: (p: StockSeriesPoint) => number | null) => {
    let d = ''
    let started = false
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
  const area = `${priceLine} L${x(rows.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  const last = rows[rows.length - 1]
  const first = rows[0]
  const periodUp = (last.c ?? 0) >= (first.c ?? 0)
  const stroke = periodUp ? UP(dark) : DOWN(dark)
  const id = `mom-${s.code}-${range}`

  return (
    <div style={{ position: 'relative' }}>
      {/* 期間切替 */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
        {RANGES.map(r => {
          const on = r.key === range
          return (
            <button key={r.key} type="button" onClick={() => setRange(r.key)}
              style={{
                cursor: on ? 'default' : 'pointer', border: `1px solid ${on ? c.BORDBR : c.BORDER}`,
                background: on ? c.HDBG : 'transparent', color: on ? c.GREEN : c.DIM,
                borderRadius: 999, padding: isMobile ? '3px 9px' : '4px 12px',
                fontFamily: c.FONT, fontSize: isMobile ? 9.5 : 10.5, letterSpacing: '0.06em',
              }}>{r.label}</button>
          )
        })}
      </div>

      <div style={{
        position: 'relative', border: `1px solid ${c.BORDER}`, borderRadius: 12,
        background: dark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.6)', overflow: 'hidden',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={dark ? 0.42 : 0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
            <filter id={`${id}-glow`} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* 52週高値・安値の目安線 */}
          {s.range52w?.high != null && s.range52w.high <= hi && (
            <line x1="0" y1={y(s.range52w.high)} x2={W} y2={y(s.range52w.high)}
              stroke={c.FAINT} strokeWidth="1" strokeDasharray="3 6" />
          )}
          {/* 200日線 */}
          {maLine && <path d={maLine} fill="none" stroke={c.DIM} strokeWidth="1.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
          {/* 面 */}
          <path d={area} fill={`url(#${id}-fill)`} />
          {/* 価格 */}
          <path d={priceLine} fill="none" stroke={stroke} strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            filter={`url(#${id}-glow)`}
            className={seen && !reduceMotion() ? 'mom-draw' : undefined} />
          {/* 先端 */}
          <circle cx={x(rows.length - 1)} cy={y(last.c as number)} r="4.5" fill={stroke} className="mom-pulse" />
        </svg>

        {/* 目盛りの代わりのラベル */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          fontSize: isMobile ? 9 : 10, color: c.DIM, letterSpacing: '0.06em',
        }}>
          <span style={{ position: 'absolute', left: 10, top: 8 }}>高 {Math.round(hi).toLocaleString()}</span>
          <span style={{ position: 'absolute', left: 10, bottom: 8 }}>安 {Math.round(lo).toLocaleString()}</span>
          <span style={{ position: 'absolute', right: 10, top: 8 }}>— — 200日線</span>
          <span style={{ position: 'absolute', right: 10, bottom: 8 }}>{first.d} → {last.d}</span>
        </div>
      </div>
    </div>
  )
}

/** 日経とどちらが強いか（相対リターン）。中心から左右に伸びるバー */
function RelativeBars({ c, dark, isMobile, s, seen }: {
  c: C; dark: boolean; isMobile: boolean; s: PoiroboStock; seen: boolean
}) {
  const m = s.momentum
  const rows: { label: string; self: number | null; rel: number | null }[] = [
    { label: '1ヶ月', self: m?.ret?.m1 ?? null, rel: m?.ret_vs_index?.m1 ?? null },
    { label: '3ヶ月', self: m?.ret?.m3 ?? null, rel: m?.ret_vs_index?.m3 ?? null },
    { label: '6ヶ月', self: m?.ret?.m6 ?? null, rel: m?.ret_vs_index?.m6 ?? null },
    { label: '12ヶ月', self: m?.ret?.m12 ?? null, rel: m?.ret_vs_index?.m12 ?? null },
  ]
  const max = Math.max(20, ...rows.map(r => Math.abs(r.rel ?? 0)))

  return (
    <div style={{ border: `1px solid ${c.BORDER}`, borderRadius: 12, background: c.TAREA, padding: isMobile ? 14 : 18 }}>
      <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: c.DIM, marginBottom: 12 }}>
        VS 日経225 / 相対リターン
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 13 }}>
        {rows.map((r, i) => {
          const rel = r.rel ?? 0
          const w = Math.min(50, (Math.abs(rel) / max) * 50)
          const color = rel >= 0 ? UP(dark) : DOWN(dark)
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 10 : 11, color: c.DIM, marginBottom: 4 }}>
                <span>{r.label}</span>
                <span style={{ color: c.DESC }}>
                  本体 {pct(r.self, 1)} ／ <b style={{ color }}>差 {pct(r.rel, 1)}</b>
                </span>
              </div>
              <div style={{ position: 'relative', height: 8, background: c.LOGBG, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: c.BORDER }} />
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: rel >= 0 ? '50%' : `${50 - w}%`,
                  width: seen ? `${w}%` : 0,
                  background: color, opacity: 0.85,
                  boxShadow: dark ? `0 0 10px ${color}88` : 'none',
                  transition: 'width 900ms cubic-bezier(0.2,0.8,0.2,1)',
                  transitionDelay: `${i * 90}ms`,
                }} />
              </div>
            </div>
          )
        })}
      </div>
      {m?.ret_12_1 != null && (
        <div style={{ marginTop: 12, fontSize: isMobile ? 10 : 11, color: c.DIM, lineHeight: 1.8 }}>
          12-1モメンタム（直近1ヶ月を除く12ヶ月）<b style={{ color: c.DESC, marginLeft: 6 }}>{pct(m.ret_12_1, 1)}</b>
        </div>
      )}
    </div>
  )
}

/** 52週レンジのどこにいるか */
function RangeMeter({ c, isMobile, s, seen }: { c: C; isMobile: boolean; s: PoiroboStock; seen: boolean }) {
  const lo = s.range52w?.low
  const hi = s.range52w?.high
  const cur = s.close
  const posPct = lo != null && hi != null && cur != null && hi !== lo
    ? Math.max(0, Math.min(100, ((cur - lo) / (hi - lo)) * 100))
    : null

  return (
    <div style={{ border: `1px solid ${c.BORDER}`, borderRadius: 12, background: c.TAREA, padding: isMobile ? 14 : 18 }}>
      <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: c.DIM, marginBottom: 12 }}>52W RANGE / 年間の位置</div>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: c.LOGBG, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, ${c.FAINT}, ${c.GREEN})`, opacity: 0.35,
        }} />
        {posPct != null && (
          <div style={{
            position: 'absolute', top: -3, bottom: -3,
            left: seen ? `calc(${posPct}% - 2px)` : 0, width: 4, borderRadius: 2,
            background: c.GREEN, boxShadow: `0 0 12px ${c.GREEN}`,
            transition: 'left 1000ms cubic-bezier(0.2,0.8,0.2,1)',
          }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: isMobile ? 10 : 11, color: c.DIM }}>
        <span>安 {lo?.toLocaleString() ?? '—'}</span>
        <span style={{ color: c.DESC }}>
          高値から {s.momentum?.from_52w_high_pct != null ? pct(s.momentum.from_52w_high_pct, 1) : '—'}
        </span>
        <span>高 {hi?.toLocaleString() ?? '—'}</span>
      </div>
    </div>
  )
}

/** 日経との連動（β・相関）＝「増幅器なのか、別の生き物なのか」 */
function LinkCard({ c, isMobile, s }: { c: C; isMobile: boolean; s: PoiroboStock }) {
  const b = s.link?.beta
  const r = s.link?.corr
  return (
    <div style={{ border: `1px solid ${c.BORDER}`, borderRadius: 12, background: c.TAREA, padding: isMobile ? 14 : 18 }}>
      <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: c.DIM, marginBottom: 10 }}>LINK / 日経との連動（60営業日）</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: c.GREEN }}>{b?.toFixed(2) ?? '—'}</span>
          <span style={{ fontSize: 10, color: c.DIM, marginLeft: 6 }}>β</span>
        </div>
        <div>
          <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: c.DESC }}>{r?.toFixed(2) ?? '—'}</span>
          <span style={{ fontSize: 10, color: c.DIM, marginLeft: 6 }}>相関</span>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: isMobile ? 10 : 11, color: c.DIM, lineHeight: 1.8 }}>
        {b != null
          ? <>日経が1%動いた日に、平均 <b style={{ color: c.DESC }}>{b.toFixed(2)}%</b> 動いています。</>
          : '—'}
      </div>
    </div>
  )
}

/** 見立て（仮説・確認点・崩れる条件） */
function ThesisBlock({ c, isMobile, th }: { c: C; isMobile: boolean; th: NonNullable<ReturnType<typeof thesisOf>> }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15)
  const col = (title: string, items: string[], tone: 'ok' | 'ng') => (
    <div style={{ border: `1px solid ${c.BORDER}`, borderRadius: 12, padding: isMobile ? 14 : 18, background: c.TAREA }}>
      <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: tone === 'ok' ? c.GREEN : c.DIM, marginBottom: 10 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: '1.1em', fontSize: isMobile ? 11.5 : 12.5, color: c.DESC, lineHeight: 1.95 }}>
        {items.map(t => <li key={t} style={{ marginBottom: 5 }}>{rich(t, c.TXTCLR)}</li>)}
      </ul>
    </div>
  )

  return (
    <div ref={ref} style={{ marginTop: isMobile ? 18 : 26 }}>
      {/* 🔴 選定基準の中核。ここが無い銘柄は枠に入れない（2026-08-16 の相談で確定） */}
      <div style={{
        border: `1px solid ${c.BORDBR}`, borderLeft: `3px solid ${c.GREEN}`, borderRadius: 12,
        background: c.HDBG, padding: isMobile ? '14px 14px' : '18px 20px', marginBottom: 22,
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '0.24em', color: c.DIM, marginBottom: 8 }}>
          MOAT / 独占はあるか
        </div>
        <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 800, color: c.GREEN, lineHeight: 1.6 }}>
          {th.moat.label}
        </div>
        <div style={{ marginTop: 7, fontSize: isMobile ? 11.5 : 12.5, color: c.DESC, lineHeight: 1.95 }}>
          {rich(th.moat.detail, c.TXTCLR)}
        </div>
      </div>

      <div style={{ fontSize: 9.5, letterSpacing: '0.24em', color: c.DIM, marginBottom: 12 }}>WHY / なぜ見ているか</div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        {th.why.map((t, i) => (
          <div key={t} className={seen ? 'mom-rise' : undefined} style={{
            opacity: seen ? undefined : 0, animationDelay: `${i * 90}ms`,
            position: 'relative', border: `1px solid ${c.BORDER}`, borderLeft: `3px solid ${c.BORDBR}`,
            borderRadius: 12, padding: isMobile ? '14px 14px 14px 16px' : '18px 20px',
            background: c.TAREA,
          }}>
            <span aria-hidden style={{
              position: 'absolute', right: 10, top: 4, fontSize: isMobile ? 30 : 44, fontWeight: 900,
              color: c.GREEN, opacity: 0.10, lineHeight: 1,
            }}>{i + 1}</span>
            <span style={{ position: 'relative', fontSize: isMobile ? 12 : 13, color: c.DESC, lineHeight: 1.95 }}>{rich(t, c.TXTCLR)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', marginTop: 10 }}>
        {col('CONFIRM / 効いていれば出てくる数字', th.confirm, 'ok')}
        {col('BREAK / この見立てが崩れる条件', th.breaks, 'ng')}
      </div>

      <div style={{
        marginTop: 10, padding: isMobile ? '12px 14px' : '14px 18px',
        border: `1px dashed ${c.BORDER}`, borderRadius: 12,
        fontSize: isMobile ? 10.5 : 11.5, color: c.DIM, lineHeight: 1.9,
      }}>
        決算：{th.earnings}<br />
        観測開始：{th.markedOn} ／ 見立ての最終見直し：{th.reviewed}
      </div>
    </div>
  )
}

function Keyframes() {
  return (
    <style>{`
      @keyframes mom-rise { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform:none; } }
      .mom-rise { animation: mom-rise 640ms cubic-bezier(0.2,0.8,0.2,1) both; }

      @keyframes mom-stamp {
        0%   { opacity:0; transform: translateY(18px) scale(1.04); filter: blur(6px); }
        100% { opacity:1; transform:none; filter:none; }
      }
      .mom-stamp { animation: mom-stamp 760ms cubic-bezier(0.2,0.9,0.2,1) both; }

      @keyframes mom-ghost { from { opacity:0; transform: translateX(40px); } to { opacity:0.085; transform:none; } }
      .mom-ghost { animation: mom-ghost 1200ms cubic-bezier(0.2,0.8,0.2,1) both; }

      @keyframes mom-draw { from { stroke-dashoffset: 3000; } to { stroke-dashoffset: 0; } }
      .mom-draw { stroke-dasharray: 3000; animation: mom-draw 1800ms cubic-bezier(0.25,0.9,0.3,1) both; }

      @keyframes mom-pulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.35); opacity:0.55; } }
      .mom-pulse { animation: mom-pulse 2.4s ease-in-out infinite; transform-origin: center; }

      @media (prefers-reduced-motion: reduce) {
        .mom-rise, .mom-stamp, .mom-draw, .mom-pulse { animation: none !important; opacity:1 !important; transform:none !important; }
        .mom-ghost { animation: none !important; opacity: 0.085 !important; transform: none !important; }
      }
    `}</style>
  )
}
