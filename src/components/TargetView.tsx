// TARGET（歴史的サポート狙い）＝研究室 ＞ TARGET。
//
// 「何度も反発した価格帯（＝歴史的サポート）まで落ちてきた銘柄」を、帯との距離で並べて見る画面。
//
// 🔴 **勝てると言っていない**。2026-09-02 の実測（490銘柄×15年・27,809件）では、
//    帯で買っても「同じ日に全銘柄を買った平均」に負けていた（20日 43.7% / 60日 41.9%）。
//    タッチ回数を増やしても良くならない。**安値圏の銘柄を探す道具**であって、上がる根拠ではない。
//    → データ側の `caveat` をそのまま出す。ここを消さないこと。
// 🔴 **観測だけ**。ロボ口座（日経225ETFの疑似トレード）の判断・売買対象には入れない。
// 🔴 状態記述型でそろえる（「買い」「狙い目」など命令・推奨の語を出さない）。
//
// mode='core' … 主力＝指名した銘柄（スキャンで消えない）
// mode='scan' … 候補＝スキャンで帯の近くにいた銘柄

import { useEffect, useMemo, useState } from 'react'
import { cy } from '../utils/cyberTheme'
import { PoiroboLoader } from './PoiroboLoader'
import { fetchStockMargin, type StockMarginData } from '../utils/stockMargin'
import { marginGauge } from '../utils/marginGauge'
import { MarginGaugeBar, MarginGaugeStyles } from './MarginGaugeBar'
import {
  fetchTargetSupport, gapText, STATE_LABEL, APPROACH_LABEL,
  type TargetSupportData, type TargetItem, type TargetState,
} from '../utils/targetSupport'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; mode: 'core' | 'scan'; onClose: () => void }
type C = ReturnType<typeof cy>

const UP = (dark: boolean) => (dark ? '#ff6b6b' : '#dc2626')
const DOWN = (dark: boolean) => (dark ? '#4dabf7' : '#2563eb')
const WARN = (dark: boolean) => (dark ? '#fbbf24' : '#b45309')

const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)
const yen = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('ja-JP', { maximumFractionDigits: 1 }))

/** 状態ごとの色。🔵 帯の中＝青（下）／帯の上＝シアン（まだ来ていない）／割れ＝黄（前提が崩れた） */
function stateColor(c: C, dark: boolean, s: TargetState) {
  if (s === 'inside') return DOWN(dark)
  if (s === 'broken') return WARN(dark)
  if (s === 'noband') return c.DIM
  return c.GREEN
}

export default function TargetView({ theme, isMobile, mode, onClose }: Props) {
  const c = cy(theme)
  const dark = theme === 'dark'
  const [data, setData] = useState<TargetSupportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | TargetState>('all')
  // 需給ゲージの材料（信用残・週次）。取れなくても他の表示は止めない
  const [margin, setMargin] = useState<StockMarginData | null>(null)

  useEffect(() => {
    let alive = true
    fetchTargetSupport()
      .then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    if (mode === 'core') {
      fetchStockMargin()
        .then(m => { if (alive) setMargin(m) })
        .catch(() => {})
    }
    return () => { alive = false }
  }, [mode])

  const pad = isMobile ? 20 : 28

  const rows = useMemo(() => {
    if (!data) return []
    const src = mode === 'core' ? data.core : data.items
    return filter === 'all' ? src : src.filter(i => i.state === filter)
  }, [data, mode, filter])

  const counts = useMemo(() => {
    const src = data ? (mode === 'core' ? data.core : data.items) : []
    return {
      all: src.length,
      inside: src.filter(i => i.state === 'inside').length,
      near: src.filter(i => i.state === 'near').length,
      broken: src.filter(i => i.state === 'broken').length,
    }
  }, [data, mode])

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
      background: c.BG, backgroundImage: c.SCAN, color: c.TXTCLR, fontFamily: c.FONT,
    }}>
      <Keyframes />
      <MarginGaugeStyles />

      <div style={{
        position: 'sticky', top: 0, zIndex: 6,
        background: dark ? 'rgba(5,14,26,0.82)' : 'rgba(240,247,255,0.86)',
        backdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.BORDER}`,
        padding: `${pad / 2}px ${pad}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span className="tgt-pulse" style={{
            width: 8, height: 8, borderRadius: '50%', background: c.GREEN,
            boxShadow: `0 0 10px ${c.GREEN}`, flexShrink: 0,
          }} />
          <span style={{ fontSize: isMobile ? 10 : 11, letterSpacing: '0.2em', color: c.GREEN, whiteSpace: 'nowrap' }}>
            TARGET / {mode === 'core' ? '主力' : '候補'}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる"
          style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, border: `1px solid ${c.BORDER}`, background: 'transparent', color: c.TXTCLR, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      {loading && <div style={{ padding: 40 }}><PoiroboLoader label="TARGET" /></div>}

      {!loading && !data && (
        <div style={{ padding: pad, maxWidth: 900, margin: '0 auto', fontSize: 13, color: c.DESC }}>
          まだデータがありません。
        </div>
      )}

      {data && (
        <>
          <Intro c={c} isMobile={isMobile} data={data} mode={mode} />

          {mode === 'scan' && (
            <div style={{
              maxWidth: 1180, margin: '0 auto', padding: `0 ${pad}px`,
              display: 'flex', gap: 8, flexWrap: 'wrap',
            }}>
              {([
                ['all', `すべて ${counts.all}`],
                ['inside', `帯の中 ${counts.inside}`],
                ['near', `帯の上 ${counts.near}`],
                ['broken', `帯を割った ${counts.broken}`],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFilter(key)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    fontFamily: c.FONT, fontSize: isMobile ? 10.5 : 11,
                    border: `1px solid ${filter === key ? c.BORDBR : c.BORDER}`,
                    background: filter === key ? c.HDBG : 'transparent',
                    color: filter === key ? c.NOTICE : c.DIM,
                  }}>{label}</button>
              ))}
            </div>
          )}

          {mode === 'core' ? (
            <div style={{
              maxWidth: 1180, margin: '0 auto', padding: `${isMobile ? 26 : 24}px ${pad}px`,
              display: 'grid', gap: isMobile ? 22 : 20,
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            }}>
              {rows.map(s => <CoreCard key={s.code} c={c} dark={dark} isMobile={isMobile} s={s} margin={margin} />)}
            </div>
          ) : (
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: `${isMobile ? 18 : 16}px ${pad}px` }}>
              {rows.length === 0 && (
                <div style={{ fontSize: 12, color: c.DIM, padding: '20px 0' }}>この状態の銘柄はありません。</div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {rows.map(s => <ScanRow key={s.code} c={c} dark={dark} isMobile={isMobile} s={s} />)}
              </div>
            </div>
          )}

          <div style={{
            maxWidth: 1180, margin: '0 auto',
            padding: `${isMobile ? 14 : 10}px ${pad}px ${isMobile ? 140 : 70}px`,
            fontSize: isMobile ? 10 : 10.5, color: c.DIM, lineHeight: 1.9,
          }}>
            {/* 🔴 免責は残す（個別銘柄を扱うページなので・投資助言を行わない方針） */}
            研究の記録であり、売買の推奨ではありません。<br />
            {data.basis}<br />
            UPDATED: {new Date(data.updatedAt).toLocaleString('ja-JP')}（終値 {data.asOf}）
          </div>
        </>
      )}
    </div>
  )
}

/** 冒頭。🔴 「効かなかった」を最初に出す（あとから小さく添えると読まれない） */
function Intro({ c, isMobile, data, mode }: { c: C; isMobile: boolean; data: TargetSupportData; mode: 'core' | 'scan' }) {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: `${isMobile ? 22 : 26}px ${isMobile ? 20 : 28}px 10px` }}>
      <div style={{ fontSize: isMobile ? 17 : 20, letterSpacing: '0.06em', color: c.NOTICE, marginBottom: 8 }}>
        {mode === 'core' ? '主力の現在地' : '帯の近くにいる銘柄'}
      </div>
      <div style={{ fontSize: isMobile ? 12 : 12.5, color: c.DESC, lineHeight: 1.95 }}>
        {mode === 'core'
          ? '指名した銘柄が、過去に何度も反発した価格帯（帯）からどれだけ離れているかを見る。'
          : `${data.universe.toLocaleString('ja-JP')}銘柄を調べて、帯の上下${data.filters.maxGapPct}%以内にいるものを並べた。`}
      </div>
      {/* 🔴 データに埋めた caveat をそのまま出す。画面側で言い換えない */}
      <div style={{
        marginTop: 14, padding: isMobile ? '11px 13px' : '12px 15px',
        border: `1px solid ${c.BORDER}`, borderLeft: `3px solid ${WARN(false)}`,
        background: c.TAREA, borderRadius: 6,
        fontSize: isMobile ? 11 : 11.5, color: c.DESC, lineHeight: 1.85,
      }}>
        {data.caveat}
      </div>
    </div>
  )
}

/** 主力カード。週足＋帯を重ねて「どこまで落ちてきたか」を1枚で見る。 */
function CoreCard({ c, dark, isMobile, s, margin }: { c: C; dark: boolean; isMobile: boolean; s: TargetItem; margin: StockMarginData | null }) {
  const col = stateColor(c, dark, s.state)
  // 🔵 信用残は週1回しか動かない。取れない週はゲージを出さないだけ（カードは出す）
  const gauge = marginGauge(margin?.stocks?.[s.code]?.history, s.vol20, s.close)
  return (
    <div style={{
      border: `1px solid ${c.BORDER}`, borderRadius: 10, background: c.LOGBG,
      padding: isMobile ? 16 : 18, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 16, color: c.NOTICE, letterSpacing: '0.04em' }}>{s.name}</div>
          <div style={{ fontSize: 10.5, color: c.DIM, marginTop: 3 }}>{s.code} · {s.sector33 ?? ''}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: isMobile ? 18 : 20, color: c.TXTCLR }}>{yen(s.close)}</div>
          <div style={{ fontSize: 10, color: c.DIM, marginTop: 2 }}>{s.date}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          padding: '3px 9px', borderRadius: 4, fontSize: 10.5,
          border: `1px solid ${col}`, color: col, letterSpacing: '0.08em',
        }}>{STATE_LABEL[s.state]}</span>
        {s.approach && APPROACH_LABEL[s.approach] && (
          <span style={{ fontSize: 10.5, color: c.DIM }}>{APPROACH_LABEL[s.approach]}来た</span>
        )}
        <span style={{ fontSize: 11.5, color: c.DESC }}>{gapText(s.gapPct)}</span>
        {s.band && (
          <span style={{ fontSize: 10.5, color: c.DIM }}>
            帯 {yen(s.band.bottom)}〜{yen(s.band.top)}・{s.band.touches}回・最終 {s.band.lastTouch ?? '—'}
          </span>
        )}
      </div>

      {s.series && s.series.length > 4 && <BandChart c={c} dark={dark} s={s} />}

      {s.band == null && (
        <div style={{ fontSize: 11, color: c.DIM, lineHeight: 1.8 }}>
          {/* 🔵 「帯が無い」も情報なので隠さない */}
          現在値の近くに、条件（別々の時期に{3}回以上触れた価格帯）を満たす帯がない。
          高値圏にいるか、過去の安値がばらけている状態。
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8,
        borderTop: `1px solid ${c.BORDER}`, paddingTop: 10,
      }}>
        <Stat c={c} dark={dark} label="20日" v={s.ret20} />
        <Stat c={c} dark={dark} label="60日" v={s.ret60} />
        <Stat c={c} dark={dark} label="52週高値から" v={s.fromHighPct} />
        <Stat c={c} label="売買代金" text={s.turnoverOku == null ? '—' : `${s.turnoverOku}億`} />
      </div>

      {gauge && (
        <div style={{ borderTop: `1px solid ${c.BORDER}`, paddingTop: 10 }}>
          <MarginGaugeBar gauge={gauge} theme={dark ? 'dark' : 'light'} />
        </div>
      )}

      {s.note && <div style={{ fontSize: 10.5, color: c.DIM, lineHeight: 1.8 }}>{s.note}</div>}
    </div>
  )
}

/** 週足の終値と、帯（横帯）を重ねた小さいチャート。 */
function BandChart({ c, dark, s }: { c: C; dark: boolean; s: TargetItem }) {
  const W = 320, H = 96, PADX = 2
  const pts = (s.series ?? []).filter(p => p.c != null) as { d: string; c: number; l: number | null; h: number | null }[]
  if (pts.length < 2) return null

  const lows = pts.map(p => p.l ?? p.c)
  const highs = pts.map(p => p.h ?? p.c)
  const band = s.band
  const lo = Math.min(...lows, band ? band.bottom : Infinity)
  const hi = Math.max(...highs, band ? band.top : -Infinity)
  const span = hi - lo || 1
  const x = (i: number) => PADX + (i / (pts.length - 1)) * (W - PADX * 2)
  const y = (v: number) => H - ((v - lo) / span) * H

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ')
  const col = stateColor(c, dark, s.state)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
      role="img" aria-label={`${s.name} の週足と歴史的サポート帯`}
      style={{ display: 'block', border: `1px solid ${c.BORDER}`, borderRadius: 6, background: dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)' }}>
      {band && (
        <>
          <rect x={0} y={y(band.top)} width={W} height={Math.max(1, y(band.bottom) - y(band.top))}
            fill={DOWN(dark)} opacity={0.16} />
          <line x1={0} x2={W} y1={y(band.price)} y2={y(band.price)}
            stroke={DOWN(dark)} strokeWidth={1} strokeDasharray="4 3" opacity={0.75} />
        </>
      )}
      <path d={path} fill="none" stroke={col} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].c)} r={2.6} fill={col} />
    </svg>
  )
}

/** 候補の1行。数字を横に並べるだけ（件数が多いのでカードにしない）。 */
function ScanRow({ c, dark, isMobile, s }: { c: C; dark: boolean; isMobile: boolean; s: TargetItem }) {
  const col = stateColor(c, dark, s.state)
  return (
    <div style={{
      border: `1px solid ${c.BORDER}`, borderRadius: 8, background: c.LOGBG,
      padding: isMobile ? '11px 12px' : '11px 14px',
      display: 'grid', gap: isMobile ? 6 : 10, alignItems: 'center',
      gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(0,2.1fr) 1fr 1fr 1fr 1fr',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: isMobile ? 12.5 : 13, color: c.NOTICE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.name}
        </div>
        <div style={{ fontSize: 10, color: c.DIM, marginTop: 2 }}>{s.code} · {s.sector33 ?? ''}</div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12.5, color: c.TXTCLR }}>{yen(s.close)}</div>
        <div style={{ fontSize: 10, color: col, marginTop: 2 }}>
          {STATE_LABEL[s.state]}
          {s.approach && APPROACH_LABEL[s.approach] ? `・${APPROACH_LABEL[s.approach]}` : ''}
        </div>
      </div>

      {!isMobile && (
        <>
          <div style={{ textAlign: 'right', fontSize: 11.5, color: c.DESC }}>
            {gapText(s.gapPct)}
            <div style={{ fontSize: 10, color: c.DIM, marginTop: 2 }}>帯 {yen(s.band?.price)}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: c.DIM }}>
            {s.band ? `${s.band.touches}回` : '—'}
            <div style={{ fontSize: 10, marginTop: 2 }}>{s.band?.lastTouch ?? '—'}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11 }}>
            <span style={{ color: (s.ret60 ?? 0) >= 0 ? UP(dark) : DOWN(dark) }}>{pct(s.ret60)}</span>
            <div style={{ fontSize: 10, color: c.DIM, marginTop: 2 }}>{s.turnoverOku == null ? '—' : `${s.turnoverOku}億`}</div>
          </div>
        </>
      )}

      {isMobile && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, fontSize: 10.5, color: c.DIM, flexWrap: 'wrap' }}>
          <span>{gapText(s.gapPct)}</span>
          <span>帯 {yen(s.band?.price)}（{s.band ? `${s.band.touches}回` : '—'}）</span>
          <span>60日 {pct(s.ret60)}</span>
          <span>{s.turnoverOku == null ? '—' : `${s.turnoverOku}億`}</span>
        </div>
      )}
    </div>
  )
}

function Stat({ c, dark, label, v, text }: { c: C; dark?: boolean; label: string; v?: number | null; text?: string }) {
  const body = text ?? pct(v)
  const col = text != null || v == null ? c.TXTCLR : (v >= 0 ? UP(!!dark) : DOWN(!!dark))
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: c.DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: col, marginTop: 3 }}>{body}</div>
    </div>
  )
}

function Keyframes() {
  return (
    <style>{`
      @keyframes tgtPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
      .tgt-pulse { animation: tgtPulse 2.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .tgt-pulse { animation: none } }
    `}</style>
  )
}
