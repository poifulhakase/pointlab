// Believe ＞ その他の監視銘柄（別ページ）。
//
// 🔴 **枠（5銘柄）ではない**。フィジカルAI／AIの4層に関わる会社を、数字だけ並べて置く場所。
// 🔴 観測だけ。売買の推奨ではない。
// 🔵 **購入時に考えることのふたつ目＝200日線付近か**を、この一覧でも色で示す（±5%以内）。
// 🔵 チャートは持たない（配信を軽くするため。見たくなったら枠に入れる）。

import { useEffect, useMemo, useState } from 'react'
import { cy } from '../utils/cyberTheme'
import { fetchPoiroboStocks, fetchStockMargin, type WatchStock, type RangeStock, type StockMarginData } from '../utils/poiroboStocks'
import { marginGauge } from '../utils/marginGauge'
import { MarginGaugeBar, MarginGaugeStyles } from './MarginGaugeBar'
import { PoiroboLoader } from './PoiroboLoader'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }
type C = ReturnType<typeof cy>

const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)

/** 並べ方。🔵 既定は「200日線に近い順」＝購入時に考える2つ目の基準で並ぶ */
const SORTS = [
  { key: 'near', label: '200日線に近い順' },
  { key: 'ret12m', label: '12ヶ月が強い順' },
  { key: 'fromHigh', label: '高値から遠い順' },
] as const
type SortKey = typeof SORTS[number]['key']

/** 🔵 Believe と同じ「呼吸する枠」「脈打つ点」をこの画面でも使う */
function WatchKeyframes() {
  return (
    <style>{`
      @keyframes mom-alive {
        0%,100% { box-shadow: 0 0 0 0 rgba(0,229,255,0.00), 0 0 26px rgba(0,229,255,0.16); }
        50%     { box-shadow: 0 0 0 3px rgba(0,229,255,0.10), 0 0 44px rgba(0,229,255,0.30); }
      }
      .mom-alive { animation: mom-alive 3.2s ease-in-out infinite; }
      @keyframes mom-pulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.06); opacity:0.75; } }
      .mom-pulse { animation: mom-pulse 2.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .mom-alive, .mom-pulse { animation: none !important; }
      }
    `}</style>
  )
}

export default function WatchStocksView({ theme, isMobile, onClose }: Props) {
  const c = cy(theme)
  const dark = theme === 'dark'
  const [rows, setRows] = useState<WatchStock[] | null>(null)
  const [ranges, setRanges] = useState<RangeStock[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('near')
  // 🆕 2026-08-17：需給ゲージの材料（信用残・週次）。取れなくても一覧は出す
  const [margin, setMargin] = useState<StockMarginData | null>(null)

  useEffect(() => {
    let alive = true
    fetchPoiroboStocks()
      .then(d => { if (alive) { setRows(d?.watch ?? []); setRanges(d?.ranges ?? []); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    fetchStockMargin()
      .then(m => { if (alive) setMargin(m) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])]
    if (sort === 'near') list.sort((a, b) => Math.abs(a.dev200_pct ?? 999) - Math.abs(b.dev200_pct ?? 999))
    if (sort === 'ret12m') list.sort((a, b) => (b.ret12m ?? -999) - (a.ret12m ?? -999))
    if (sort === 'fromHigh') list.sort((a, b) => (a.from_52w_high_pct ?? 0) - (b.from_52w_high_pct ?? 0))
    return list
  }, [rows, sort])

  const pad = isMobile ? 20 : 28

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
      background: c.BG, backgroundImage: c.SCAN, color: c.TXTCLR, fontFamily: c.FONT,
    }}>
      <WatchKeyframes />
      <MarginGaugeStyles />
      <div style={{
        position: 'sticky', top: 0, zIndex: 6,
        background: dark ? 'rgba(5,14,26,0.82)' : 'rgba(240,247,255,0.86)',
        backdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.BORDER}`,
        padding: `${pad / 2}px ${pad}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: isMobile ? 10 : 11, letterSpacing: '0.2em', color: c.GREEN, whiteSpace: 'nowrap' }}>
          WATCH / 候補
        </span>
        <button type="button" onClick={onClose} aria-label="戻る"
          style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, border: `1px solid ${c.BORDER}`, background: 'transparent', color: c.TXTCLR, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      {loading && <div style={{ padding: 40 }}><PoiroboLoader label="WATCH" /></div>}

      {!loading && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: `${isMobile ? 26 : 34}px ${pad}px ${isMobile ? 140 : 70}px` }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 30, fontWeight: 900, color: c.GREEN, lineHeight: 1.4 }}>
            その他の監視銘柄
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: isMobile ? 12 : 13, color: c.DESC, lineHeight: 2 }}>
            枠には入れていないが、同じ物差しで見ている会社。
            <b style={{ color: c.GREEN }}>200日線付近</b>のものは色が変わります。
          </p>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: `${isMobile ? 22 : 24}px 0 16px` }}>
            {SORTS.map(o => {
              const on = o.key === sort
              return (
                <button key={o.key} type="button" onClick={() => setSort(o.key)}
                  style={{
                    cursor: on ? 'default' : 'pointer', border: `1px solid ${on ? c.BORDBR : c.BORDER}`,
                    background: on ? c.HDBG : 'transparent', color: on ? c.GREEN : c.DIM,
                    borderRadius: 999, padding: isMobile ? '6px 14px' : '5px 14px',
                    fontFamily: c.FONT, fontSize: isMobile ? 10.5 : 10,
                  }}>{o.label}</button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gap: isMobile ? 10 : 8 }}>
            {sorted.map(w => {
              const near = w.dev200_pct != null && Math.abs(w.dev200_pct) <= 5
              return (
                <div key={w.code} style={{
                  border: near ? `1px solid ${c.GREEN}` : `1px solid ${c.BORDER}`,
                  borderLeft: near ? `5px solid ${c.GREEN}` : `1px solid ${c.BORDER}`,
                  borderRadius: 12,
                  background: near ? c.HDBG : c.TAREA,
                  boxShadow: near && dark ? `0 0 26px ${c.GREEN}26` : 'none',
                  opacity: near ? 1 : 0.86,
                  padding: isMobile ? '16px 14px' : '14px 16px',
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 8 : 14, alignItems: isMobile ? 'flex-start' : 'center',
                }}>
                  <div style={{ flex: isMobile ? undefined : '0 0 230px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 999, border: `1px solid ${c.BORDER}`,
                      fontSize: 9.5, color: c.DIM,
                    }}>{w.code}</span>
                    <span style={{ fontSize: isMobile ? 14 : 14, fontWeight: 800 }}>{w.name}</span>
                    <span style={{ fontSize: 9.5, color: c.DIM }}>{w.layer}</span>
                  </div>

                  {/* 🔵 チャートしか見ない使い方なので、行にも線を出す（1年・200日線つき） */}
                  <div style={{ flex: isMobile ? undefined : '0 0 190px', width: isMobile ? '100%' : undefined }}>
                    <MiniChart c={c} dark={dark} rows={w.series ?? []} height={isMobile ? 78 : 56} />
                  </div>

                  <div style={{
                    flex: 1, display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                    gap: isMobile ? 10 : 8, width: '100%',
                  }}>
                    <Cell c={c} label="株価" value={w.close != null ? w.close.toLocaleString() : '—'} />
                    <Cell c={c} label="12ヶ月" value={pct(w.ret12m)} />
                    <Cell c={c} label="52週高値から" value={pct(w.from_52w_high_pct)} />
                    <Cell c={c} label="200日線から" value={pct(w.dev200_pct)} strong={near} />
                  </div>

                  {/* 🆕 需給ゲージ（信用残から見た上値の重さ・軽くなってきたか） */}
                  <div style={{ flexShrink: 0 }}>
                    <MarginGaugeBar
                      gauge={marginGauge(margin?.stocks?.[w.code]?.history, w.vol20)}
                      theme={dark ? 'dark' : 'light'}
                      compact
                    />
                  </div>

                  {near && (
                    <span style={{
                      flexShrink: 0, padding: '3px 10px', borderRadius: 999,
                      border: `1px solid ${c.GREEN}`, background: `${c.GREEN}22`,
                      fontSize: 9.5, fontWeight: 800, color: c.GREEN, whiteSpace: 'nowrap',
                    }}>200日線付近</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── レンジ（歴史的サポート狙い）── */}
          {ranges.length > 0 && (
            <div style={{ marginTop: isMobile ? 44 : 52 }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 900, color: c.GREEN }}>
                レンジ（歴史的サポート狙い）
              </h2>
              <div style={{ display: 'grid', gap: isMobile ? 18 : 16, marginTop: isMobile ? 22 : 20 }}>
                {ranges.map(r => <RangeCard key={r.code} c={c} dark={dark} isMobile={isMobile} r={r} />)}
              </div>
            </div>
          )}

          <div style={{ marginTop: 30, fontSize: isMobile ? 10 : 10.5, color: c.DIM, lineHeight: 1.9 }}>
            研究の記録であり、売買の推奨ではありません。
          </div>
        </div>
      )}
    </div>
  )
}

/** 一覧用の小さな線（終値＋200日線）。目盛りは出さない */
function MiniChart({ c, dark, rows, height }: {
  c: C; dark: boolean; rows: { d: string; c: number | null; m200: number | null }[]; height: number
}) {
  const pts = rows.filter(p => p.c != null)
  if (pts.length < 2) return null
  const W = 300
  const H = height
  const PADY = 6
  const closes = pts.map(p => p.c as number)
  const mas = pts.filter(p => p.m200 != null).map(p => p.m200 as number)
  const lo = Math.min(...closes, ...(mas.length ? mas : closes))
  const hi = Math.max(...closes, ...(mas.length ? mas : closes))
  const span = hi - lo || 1
  const x = (i: number) => (i / (pts.length - 1)) * W
  const y = (v: number) => PADY + (1 - (v - lo) / span) * (H - PADY * 2)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.c as number).toFixed(1)}`).join(' ')
  let ma = ''
  let started = false
  pts.forEach((p, i) => {
    if (p.m200 == null) { started = false; return }
    ma += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.m200).toFixed(1)} `
    started = true
  })
  const up = (pts[pts.length - 1].c as number) >= (pts[0].c as number)
  const stroke = up ? (dark ? '#ff6b6b' : '#dc2626') : (dark ? '#4dabf7' : '#2563eb')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
      {ma && <path d={ma.trim()} fill="none" stroke={c.DIM} strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * レンジ銘柄のカード（15年の週足）。
 * 🔵 出すのは**線・15年の安値と高値・いまの位置**だけ。指標は足さない（この枠の目的が位置だから）。
 */
function RangeCard({ c, dark, isMobile, r }: { c: C; dark: boolean; isMobile: boolean; r: RangeStock }) {
  const rows = r.series ?? []
  if (!rows.length) return null

  const W = 1000
  const H = isMobile ? 170 : 200
  const PADY = 12
  const lo = r.low15y
  const hi = r.high15y
  const span = hi - lo || 1
  const x = (i: number) => (i / Math.max(1, rows.length - 1)) * W
  const y = (v: number) => PADY + (1 - (v - lo) / span) * (H - PADY * 2)
  const line = rows.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const stroke = c.GREEN
  const id = `rng-${r.code}`
  // 🔴 サポートは**15年安値ではなくレンジ下限**（直近5年で何度も止まっている帯）で見る。
  //    何年も前に一度だけ付けた暴落安値は、実際のレンジ取引では機能しないため。
  const floor = r.floor
  const nearFloor = r.from_floor_pct != null && r.from_floor_pct <= 10
  // 🔵 15年高値から10%以内なら「天井圏」
  const nearHigh = r.from_high_pct >= -10

  return (
    <div className={nearFloor ? 'mom-alive' : undefined} style={{
      // 🔴 サポート圏はカードごと浮かせる（2026-08-16 ユーザー指示）
      border: nearFloor ? `2px solid ${c.GREEN}` : `1px solid ${c.BORDER}`,
      borderLeft: nearFloor ? `6px solid ${c.GREEN}` : `1px solid ${c.BORDER}`,
      borderRadius: 14,
      background: nearFloor ? c.HDBG : c.TAREA,
      opacity: nearFloor ? 1 : 0.9,
      padding: isMobile ? '18px 16px' : 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${c.BORDER}`, fontSize: 9.5, color: c.DIM }}>
          {r.code}
        </span>
        <span style={{ fontSize: isMobile ? 15 : 16, fontWeight: 900 }}>{r.name}</span>
        <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: c.TXTCLR }}>
          {r.close?.toLocaleString()}
        </span>
        {nearFloor && (
          <span className="mom-pulse" style={{
            padding: '4px 12px', borderRadius: 999, border: `1px solid ${c.GREEN}`,
            background: `${c.GREEN}2e`, fontSize: 11, fontWeight: 900, color: c.GREEN,
            boxShadow: `0 0 14px ${c.GREEN}66`,
          }}>サポート圏</span>
        )}
        {nearHigh && (
          <span style={{
            padding: '3px 10px', borderRadius: 999, border: `1px solid ${c.DIM}`,
            fontSize: 9.5, fontWeight: 800, color: c.DIM,
          }}>15年高値の近く</span>
        )}
      </div>

      <div style={{ marginTop: 12, border: `1px solid ${c.BORDER}`, borderRadius: 10, overflow: 'hidden', background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={dark ? 0.26 : 0.2} />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* 🔵 レンジ下限の帯（±5%）＝何度も止まっている場所 */}
          {floor != null && (
            <rect x="0" y={y(floor * 1.05)} width={W} height={Math.max(2, y(floor * 0.95) - y(floor * 1.05))}
              fill={c.GREEN} opacity={0.14} />
          )}
          {floor != null && (
            <line x1="0" y1={y(floor)} x2={W} y2={y(floor)} stroke={c.GREEN} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          )}
          {/* 15年の安値＝最終防衛ライン（参考） */}
          <line x1="0" y1={y(lo)} x2={W} y2={y(lo)} stroke={c.DIM} strokeWidth="1" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={y(hi)} x2={W} y2={y(hi)} stroke={c.DIM} strokeWidth="1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
          <path d={area} fill={`url(#${id}-fill)`} />
          <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={W} cy={y(rows[rows.length - 1].c)} r="3.5" fill={stroke} />
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 12 : 10, marginTop: 14 }}>
        <Cell c={c} label="レンジ下限" value={floor != null ? floor.toLocaleString() : '—'} />
        <Cell c={c} label="下限から" value={r.from_floor_pct != null ? `+${r.from_floor_pct.toFixed(1)}%` : '—'} strong={nearFloor} />
        <Cell c={c} label="下限で止まった回数" value={`${r.floor_touches} 回`} />
        <Cell c={c} label="15年高値から" value={`${r.from_high_pct.toFixed(1)}%`} />
      </div>
      <div style={{ marginTop: 8, fontSize: 9.5, color: c.DIM }}>
        {r.from} 〜 {r.to}（週足）／ 15年安値 {lo.toLocaleString()}・高値 {hi.toLocaleString()}
      </div>
    </div>
  )
}

function Cell({ c, label, value, strong }: { c: C; label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: c.DIM, letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: strong ? c.GREEN : c.TXTCLR }}>{value}</div>
    </div>
  )
}
