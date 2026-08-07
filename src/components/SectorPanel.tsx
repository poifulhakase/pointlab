import { useEffect, useMemo, useState, useCallback } from 'react'
import type React from 'react'
import { cy } from '../utils/cyberTheme'
import { AILaunchRow } from './CyberAiLaunch'
import { jstTimestamp } from '../utils/jstDate'
import { buildStockAnalysisPrompt } from '../utils/sectorStockPrompt'
import { loadSectorPerf, loadStockMaster } from '../utils/sectorData'
import {
  PHASES, PERF_LABELS,
  phaseById, nextPhase, phaseOfSector17, phaseMidAngle, sector17Label,
  phaseStrengths, phaseFits, bestFit, searchStocks,
  type PerfKey, type PhaseFit, type SectorPerfRow, type SectorPhaseId, type StockRow,
} from '../utils/sectorRotation'

const PERF_KEYS: PerfKey[] = ['chg1m', 'chg3m', 'chg6m']

/**
 * セクターローテーション画面。
 *
 * 左＝円環。「教科書上どの局面でどの業種が強いとされるか」を4分割で置き、
 *        その上に**実測の騰落率**を重ねる。
 * 右＝業種の内訳と銘柄検索。選んだ銘柄はAIに投げるプロンプトを作れる。
 *
 * 🔴 **局面の判定はしていない**。円環で光っているのは「実測で平均が高いグループ」であって
 *    「いまがその局面だ」ではない。文言もそこを崩さないこと（CLAUDE.md の方針）。
 * 🔵 実測は業種別ETF（TOPIX-17連動）の代用値。指数そのものではない旨を画面に出す。
 */
type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
}

const SIZE  = 320
const R_OUT = 138
const R_IN  = 88

/** 角度（0度＝真上・時計回り）を SVG 座標へ。 */
function pt(angle: number, r: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: SIZE / 2 + r * Math.cos(rad), y: SIZE / 2 + r * Math.sin(rad) }
}

/** ドーナツの4分割セグメントのパス。grow で選択中だけ外へ広げる。 */
function segPath(from: number, to: number, grow = 0): string {
  const ro = R_OUT + grow
  const ri = R_IN + grow * 0.25
  const a = pt(from, ro), b = pt(to, ro)
  const c = pt(to, ri),   d = pt(from, ri)
  const large = to - from > 180 ? 1 : 0
  return [
    `M ${a.x} ${a.y}`,
    `A ${ro} ${ro} 0 ${large} 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${ri} ${ri} 0 ${large} 0 ${d.x} ${d.y}`,
    'Z',
  ].join(' ')
}

function signed(v: number | null): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v}%`
}

export function SectorPanel({ theme, isMobile }: Props) {
  const c    = cy(theme)
  const glow = theme === 'dark'
  const UP   = theme === 'light' ? '#15803d' : '#4ade80'
  const DOWN = theme === 'light' ? '#dc2626' : '#f87171'
  const pnl  = (v: number | null) => (v == null ? c.DIM : v > 0 ? UP : v < 0 ? DOWN : c.DESC)

  const [perf,    setPerf]    = useState<SectorPerfRow[] | null>(null)
  const [perfErr, setPerfErr] = useState<string | null>(null)
  const [master,  setMaster]  = useState<StockRow[] | null>(null)
  const [masterErr, setMasterErr] = useState<string | null>(null)
  const [asOf,    setAsOf]    = useState<string | null>(null)

  const [perfKey,  setPerfKey]  = useState<PerfKey>('chg3m')
  const [selected, setSelected] = useState<SectorPhaseId>('financial')
  const [hovered,  setHovered]  = useState<SectorPhaseId | null>(null)
  const [query,    setQuery]    = useState('')
  const [picked,   setPicked]   = useState<StockRow | null>(null)
  const [copied,   setCopied]   = useState(false)

  useEffect(() => {
    let alive = true
    loadSectorPerf()
      .then(d => { if (alive) setPerf(d.rows) })
      .catch(e => { if (alive) setPerfErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [])

  // 🔵 銘柄マスタは約3700件と大きいので、**検索を使い始めたときに初めて**取りにいく。
  const ensureMaster = useCallback(() => {
    if (master || masterErr) return
    loadStockMaster()
      .then(d => { setMaster(d.rows); setAsOf(d.asOf) })
      .catch(e => setMasterErr(e instanceof Error ? e.message : String(e)))
  }, [master, masterErr])

  const strengths = useMemo(
    () => (perf ? phaseStrengths(perf, perfKey) : []),
    [perf, perfKey]
  )

  // 🔵 一致度は**3期間すべて同時に**出す。切替だと「最近になって型が変わった」が見えない。
  const fitsByKey = useMemo(() => {
    const out = {} as Record<PerfKey, PhaseFit[]>
    for (const k of PERF_KEYS) out[k] = perf ? phaseFits(perf, k) : []
    return out
  }, [perf])

  const fits = fitsByKey[perfKey]
  const top  = useMemo(() => bestFit(fits), [fits])

  const shown = phaseById(selected)
  const shownStrength = strengths.find(s => s.phase.id === selected) ?? null
  const shownFit      = fits.find(f => f.phase.id === selected) ?? null

  // 一致度がいちばん高い局面を指すマーカー。
  // 🔵 弧の中央（R_OUT と R_IN の中間）に置くと**局面名のラベルと重なって読めない**ので、
  //    外周の目盛りリング上に逃がしている。
  const marker = top ? pt(phaseMidAngle(top.phase.id), R_OUT + 12) : null

  const search = useMemo(
    () => (master ? searchStocks(query, master) : { hits: [], total: 0 }),
    [query, master]
  )

  const handleCopy = useCallback(async () => {
    if (!picked || !perf) return
    const text = buildStockAnalysisPrompt(picked, perf, strengths, perfKey, jstTimestamp())
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // クリップボードAPIが使えない環境（権限・非セキュアコンテキスト）の逃げ道
      const el = Object.assign(document.createElement('textarea'), {
        value: text, style: 'position:fixed;opacity:0',
      })
      document.body.appendChild(el); el.select(); document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [picked, perf, strengths, perfKey])

  const dataDate = perf?.[0]?.time ?? null

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      overflowY: isMobile ? 'auto' : 'hidden',
      fontFamily: c.FONT, color: c.TXTCLR,
      backgroundImage: c.SCAN,
    }}>
      <style>{`
        @keyframes sector-sweep { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes sector-pulse { 0%,100% { opacity:.25; r:14 } 50% { opacity:.85; r:19 } }
        @keyframes sector-fade  { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform:none } }
        .sector-seg   { transition: opacity .25s ease, filter .25s ease; cursor: pointer; }
        .sector-seg:hover { filter: brightness(1.25); }
        .sector-card  { animation: sector-fade .28s ease both; }
        .sector-hit   { transition: transform .15s ease, border-color .15s ease, background .15s ease; }
        .sector-hit:hover { transform: translateX(3px); }
      `}</style>

      {/* ── 左：円環 ── 🔵 上下中央に置く ───────────────── */}
      <div style={{
        flex: isMobile ? '0 0 auto' : 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px', overflowY: isMobile ? 'visible' : 'auto',
      }}>
        <div style={{
          fontSize: 12, letterSpacing: '0.18em', color: c.GREEN, marginBottom: 2,
          textShadow: glow ? `0 0 10px ${c.GREEN}55` : undefined,
        }}>
          ▶ SECTOR ROTATION
        </div>
        <div style={{ fontSize: 11, color: c.DIM, marginBottom: 8 }}>
          景気の局面で物色対象が回るという見方 × 実測
        </div>

        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
             aria-label="景気4局面と、業種別ETFで測った実測の相対強弱"
             style={{ filter: glow ? `drop-shadow(0 0 10px ${c.GREEN}22)` : undefined }}>
          <defs>
            {PHASES.map(p => (
              <radialGradient key={p.id} id={`sg-${p.id}`} cx="50%" cy="50%" r="70%">
                <stop offset="55%" stopColor={p.color} stopOpacity="0.10" />
                <stop offset="100%" stopColor={p.color} stopOpacity="0.42" />
              </radialGradient>
            ))}
          </defs>

          <circle cx={SIZE / 2} cy={SIZE / 2} r={R_OUT + 12} fill="none"
                  stroke={c.FAINT} strokeWidth={1} strokeDasharray="2 7" />
          <g style={{ transformOrigin: `${SIZE / 2}px ${SIZE / 2}px`, animation: 'sector-sweep 16s linear infinite' }}>
            <line x1={SIZE / 2} y1={SIZE / 2} x2={SIZE / 2} y2={SIZE / 2 - (R_OUT + 12)}
                  stroke={c.GREEN} strokeOpacity={0.16} strokeWidth={1.5} />
          </g>

          {PHASES.map(p => {
            const active = p.id === shown.id
            const hot    = p.id === hovered
            const grow   = active ? 10 : hot ? 5 : 0
            const fit = fits.find(f => f.phase.id === p.id)
            // 🔵 一致度が高い局面ほど濃く塗る（0点=薄い / 100点=濃い）
            const byFit = fit?.score != null ? 0.25 + (fit.score / 100) * 0.75 : 0.55
            return (
              <path
                key={p.id}
                className="sector-seg"
                d={segPath(p.angle, p.angle + 90, grow)}
                fill={`url(#sg-${p.id})`}
                fillOpacity={active ? 1 : byFit}
                stroke={p.color}
                strokeOpacity={active ? 1 : 0.4}
                strokeWidth={active ? 2 : 1}
                onClick={() => setSelected(p.id)}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}

          {/* 局面名と、その一致度 */}
          {PHASES.map(p => {
            const active = p.id === shown.id
            const fit = fits.find(f => f.phase.id === p.id)
            const m   = pt(p.angle + 45, (R_OUT + R_IN) / 2 + (active ? 5 : 0))
            return (
              <g key={p.id} style={{ pointerEvents: 'none' }}>
                <text x={m.x} y={m.y - 1} textAnchor="middle"
                      fontSize={active ? 13.5 : 12.5} fontWeight={700} fill={p.color}
                      style={{ transition: 'font-size .2s ease' }}>
                  {p.label}
                </text>
                {fit?.score != null && (
                  <text x={m.x} y={m.y + 13} textAnchor="middle" fontSize={11} fontWeight={700}
                        fill={p.color} opacity={0.9}>
                    一致 {fit.score}
                  </text>
                )}
              </g>
            )
          })}

          {/* 🔴 実測でいちばん強いグループ。**局面の判定ではない** */}
          {marker && top && (
            <>
              <circle cx={marker.x} cy={marker.y} r={14} fill="none" stroke={top.phase.color} strokeWidth={1}
                      style={{ animation: 'sector-pulse 2.4s ease-in-out infinite' }} />
              <circle cx={marker.x} cy={marker.y} r={9} fill={c.BG} stroke={top.phase.color} strokeWidth={3} />
              <circle cx={marker.x} cy={marker.y} r={3.5} fill={top.phase.color} />
            </>
          )}

          <text x={SIZE / 2} y={SIZE / 2 - 20} textAnchor="middle" fontSize={9.5}
                fill={c.DIM} letterSpacing="0.1em">
            {PERF_LABELS[perfKey]}の並びが最も近い型
          </text>
          {top ? (
            <>
              <text x={SIZE / 2} y={SIZE / 2 + 2} textAnchor="middle" fontSize={16}
                    fontWeight={700} fill={top.phase.color}
                    style={{ filter: glow ? `drop-shadow(0 0 6px ${top.phase.color}77)` : undefined }}>
                {top.phase.label}
              </text>
              <text x={SIZE / 2} y={SIZE / 2 + 21} textAnchor="middle" fontSize={13}
                    fontWeight={700} fill={top.phase.color}>
                一致度 {top.score}
              </text>
              <text x={SIZE / 2} y={SIZE / 2 + 37} textAnchor="middle" fontSize={9} fill={c.DIM}>
                ／100（確率ではありません）
              </text>
            </>
          ) : (
            <text x={SIZE / 2} y={SIZE / 2 + 4} textAnchor="middle" fontSize={12} fill={c.DIM}>
              {perfErr ? '取得できません' : '読み込み中…'}
            </text>
          )}
        </svg>

        {/* 🔵 ハイライトが2種類あって紛らわしいので凡例を出す。
            「広がっている扇＝自分が選んで見ているもの」「丸＝データで決まるもの」。
            クリックしても局面は進まない（見る対象が変わるだけ）ことも書く。 */}
        <div style={{
          display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap',
          justifyContent: 'center', fontSize: 10, color: c.DIM,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 13, height: 9, borderRadius: 2,
              border: `2px solid ${shown.color}`, background: `${shown.color}33`,
            }} />
            選択中（クリックで切替）
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 11, height: 11, borderRadius: '50%',
              border: `3px solid ${top?.phase.color ?? c.BORDBR}`, background: c.BG,
            }} />
            一致度が最も高い型
          </span>
        </div>

        {/* 🔵 一致度は3期間まとめて出す。1つずつ切り替えると
            「最近になって型が変わった」という一番おいしい情報が見えない。 */}
        {perf && (
          <div style={{
            marginTop: 12, width: '100%', maxWidth: 380,
            border: `1px solid ${c.BORDER}`, borderRadius: 6, padding: '8px 10px',
            background: c.LOGBG,
          }}>
            <div style={{ fontSize: 10, color: c.DIM, marginBottom: 6, letterSpacing: '0.06em' }}>
              型との一致度（0〜100・確率ではありません）
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr style={{ color: c.DIM }}>
                  <th style={{ textAlign: 'left', fontWeight: 400, paddingBottom: 3 }} />
                  {PERF_KEYS.map(k => (
                    <th key={k} style={{ textAlign: 'right', fontWeight: 400, paddingBottom: 3, width: 68 }}>
                      {PERF_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PHASES.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    style={{
                      cursor: 'pointer',
                      background: p.id === shown.id ? `${p.color}1f` : 'transparent',
                    }}
                  >
                    <td style={{ color: p.color, padding: '3px 4px', whiteSpace: 'nowrap' }}>
                      {p.label}
                    </td>
                    {PERF_KEYS.map(k => {
                      const f   = fitsByKey[k].find(x => x.phase.id === p.id)
                      const isT = bestFit(fitsByKey[k])?.phase.id === p.id
                      return (
                        <td key={k} style={{ padding: '3px 4px' }}>
                          {/* 数字だけだと差が掴みにくいので細いバーを敷く */}
                          <div style={{
                            position: 'relative', height: 14, borderRadius: 3,
                            background: c.TAREA, overflow: 'hidden',
                          }}>
                            <div style={{
                              position: 'absolute', inset: 0,
                              width: `${f?.score ?? 0}%`, background: `${p.color}66`,
                            }} />
                            <span style={{
                              position: 'absolute', inset: 0, display: 'flex',
                              alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4,
                              fontWeight: isT ? 700 : 400,
                              color: isT ? p.color : c.DESC,
                            }}>
                              {f?.score ?? '—'}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 期間の切替（円環に反映する期間） */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {PERF_KEYS.map(k => (
            <button
              key={k}
              onClick={() => setPerfKey(k)}
              style={{
                cursor: 'pointer', fontFamily: c.FONT, fontSize: 11,
                padding: '4px 12px', borderRadius: 5,
                border: `1px solid ${perfKey === k ? c.GREEN : c.BORDER}`,
                background: perfKey === k ? `${c.GREEN}1f` : 'transparent',
                color: perfKey === k ? c.GREEN : c.DIM,
              }}
            >{PERF_LABELS[k]}</button>
          ))}
        </div>

        {/* 🔴 何を測っていて、何を測っていないかを画面で言い切る */}
        <div style={{
          marginTop: 12, maxWidth: 380, fontSize: 10.5, lineHeight: 1.75,
          color: c.DIM, background: c.LOGBG, border: `1px solid ${c.BORDER}`,
          borderRadius: 6, padding: '8px 11px',
        }}>
          ⚠ 円環の4分割は「どの局面でどの業種が強いとされるか」という<b>一般的な対応表</b>で、
          色の濃さと数字は<b>実際に測った騰落率</b>です。
          <b>ぽいロボは景気局面の判定をしていません。</b>
          <br />出所＝TOPIX-17 業種別ETF（1617〜1633）の調整後終値。業種別株価指数そのものではなく、その代用です。
          {dataDate && <><br />データ日付：{dataDate}</>}
          {perfErr && <><br />🔴 取得エラー：{perfErr}</>}
        </div>
      </div>

      <div style={isMobile
        ? { height: 1, background: 'var(--border-dim)', flexShrink: 0 }
        : { width: 1, background: 'var(--border-dim)', flexShrink: 0 }} />

      {/* ── 右：業種の内訳＋銘柄検索＋AI分析 ── 🔵 上下中央 ──── */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        justifyContent: isMobile ? 'flex-start' : 'center',
        alignItems: 'center',
        padding: '20px 18px', overflowY: 'auto',
      }}>
        {/* 🔵 幅の上限を付ける。付けないと横幅いっぱいに伸びて、
            検索欄だけが極端に横長になり読みづらい（ユーザー指摘・2026-08-07）。 */}
        <div style={{
          width: '100%', maxWidth: 520,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* 選んだ局面グループの内訳 */}
          <section className="sector-card" key={shown.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 16, fontWeight: 700, color: shown.color,
                textShadow: glow ? `0 0 10px ${shown.color}55` : undefined,
              }}>{shown.label}</span>
              <span style={{ fontSize: 10.5, color: c.DIM }}>{shown.economy}</span>
              {shownStrength?.avg != null && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: pnl(shownStrength.avg) }}>
                  平均 {signed(shownStrength.avg)}
                </span>
              )}
              {shownFit?.score != null && (
                <span style={{
                  fontSize: 9.5, color: c.BG, background: shown.color,
                  borderRadius: 3, padding: '1px 6px', fontWeight: 700,
                }}>一致度 {shownFit.score}/100</span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, color: c.DESC }}>{shown.note}</p>

            {/* 🔵 一致度の根拠を出す。どの業種が支えていて、どれが矛盾しているかまで見せないと
                点数がブラックボックスになる。 */}
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(shownFit?.members.length
                ? shownFit.members.map(m => ({
                    code: m.row.sector17, label: m.row.label, v: m.row[perfKey],
                    rank: m.rank as number | null, role: m.role,
                  }))
                : shown.sectors17.map(code => ({
                    code, label: sector17Label(code), v: null,
                    rank: null as number | null, role: 'neutral' as const,
                  }))
              ).map(m => {
                const mark = m.role === 'support'    ? { t: '支持', col: UP }
                           : m.role === 'contradict' ? { t: '矛盾', col: DOWN }
                           : null
                return (
                  <li key={m.code} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 11.5, padding: '3px 8px', borderRadius: 4,
                    border: `1px solid ${mark ? `${mark.col}55` : `${shown.color}33`}`,
                  }}>
                    {mark && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: mark.col,
                        border: `1px solid ${mark.col}`, borderRadius: 3, padding: '0 4px',
                      }}>{mark.t}</span>
                    )}
                    <span style={{ flex: 1, minWidth: 0, color: c.DESC }}>{m.label}</span>
                    {m.rank != null && (
                      <span style={{ fontSize: 10, color: c.DIM }}>17業種中 {m.rank}位</span>
                    )}
                    <span style={{ fontWeight: 700, color: pnl(m.v), minWidth: 58, textAlign: 'right' }}>
                      {signed(m.v)}
                    </span>
                  </li>
                )
              })}
            </ul>

            {shownFit?.score != null && (
              <p style={{ margin: '6px 0 0', fontSize: 10, color: c.DIM, lineHeight: 1.7 }}>
                一致度＝この{shownFit.members.length}業種が17業種中どのあたりに並んでいるかだけで決まります
                （上位を独占なら100・下位を独占なら0）。平均順位 {shownFit.meanRank}位。
                {shownStrength?.avg != null && <> グループの平均騰落率は {signed(shownStrength.avg)}。</>}
              </p>
            )}

            <div style={{ marginTop: 7, fontSize: 10.5, color: c.DIM }}>
              この見方での次の局面 → <span style={{ color: nextPhase(shown.id).color }}>{nextPhase(shown.id).label}</span>
              <span style={{ marginLeft: 6 }}>（循環の順番。いまの位置を示すものではありません）</span>
            </div>
          </section>

          {/* 銘柄検索 */}
          <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 7 }}>
            <label htmlFor="sector-search" style={{ fontSize: 11, color: c.GREEN, letterSpacing: '0.1em' }}>
              銘柄を探す
            </label>
            <input
              id="sector-search"
              value={query}
              onFocus={ensureMaster}
              onChange={e => { ensureMaster(); setQuery(e.target.value); setPicked(null) }}
              placeholder="銘柄コード（例 6758）・銘柄名・業種名"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: c.TAREA, border: `1px solid ${c.BORDBR}`, borderRadius: 6,
                color: c.TXTCLR, fontFamily: c.FONT, fontSize: 13, padding: '9px 11px',
                outline: 'none',
              }}
            />

            {masterErr ? (
              <p style={{ margin: 0, fontSize: 11.5, color: DOWN }}>
                🔴 銘柄マスタを取得できません（{masterErr}）
              </p>
            ) : query.trim() === '' ? (
              <p style={{ margin: 0, fontSize: 10.5, color: c.DIM, lineHeight: 1.7 }}>
                コードは前方一致、銘柄名・業種名は部分一致で探せます。
                {master && <><br />東証の内国株式 {master.length.toLocaleString()} 銘柄
                  {asOf && `（JPX 上場銘柄一覧 ${asOf} 時点）`}</>}
              </p>
            ) : !master ? (
              <p style={{ margin: 0, fontSize: 11.5, color: c.DIM }}>銘柄マスタを読み込み中…</p>
            ) : search.hits.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11.5, color: c.DIM }}>
                「{query}」に一致する銘柄はありません。
              </p>
            ) : (
              <>
                {search.total > search.hits.length && (
                  <p style={{ margin: 0, fontSize: 10, color: c.DIM }}>
                    {search.total.toLocaleString()}件ヒット・先頭{search.hits.length}件を表示（絞り込んでください）
                  </p>
                )}
                <ul style={{
                  listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5,
                  // 🔵 縦スクロールバーが出た分だけ横にはみ出して横スクロールが生えるので塞ぐ
                  maxHeight: 220, overflowY: 'auto', overflowX: 'hidden',
                }}>
                  {search.hits.map(st => {
                    const ph = phaseOfSector17(st.sector17)
                    const on = picked?.code === st.code
                    const col = ph?.color ?? c.BORDBR
                    return (
                      <li key={st.code}>
                        <button
                          className="sector-hit"
                          onClick={() => setPicked(on ? null : st)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            border: `1px solid ${on ? col : c.BORDER}`,
                            borderLeft: `3px solid ${col}`,
                            borderRadius: 5, padding: '7px 10px',
                            background: on ? `${col}1f` : c.LOGBG,
                            color: c.TXTCLR, fontFamily: c.FONT, cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: c.GREEN, minWidth: 46 }}>{st.code}</span>
                          <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                          <span style={{ fontSize: 10.5, color: c.DIM }}>{sector17Label(st.sector17)}</span>
                          {ph && <span style={{ fontSize: 10, color: col }}>{ph.label}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          {/* 選んだ銘柄をAIに分析させる（シールドと同じ「コピーして投げる」方式） */}
          {picked && (
            <section className="sector-card" key={picked.code} style={{
              border: `1px solid ${c.BORDBR}`, borderRadius: 8, padding: '11px 13px',
              background: c.LOGBG, display: 'flex', flexDirection: 'column', gap: 9,
            }}>
              <div style={{ fontSize: 11.5, color: c.GREEN, letterSpacing: '0.08em' }}>
                ▶ {picked.code} {picked.name} を AI で調べる
              </div>
              <button
                onClick={handleCopy}
                disabled={!perf}
                style={{
                  alignSelf: 'flex-start', cursor: perf ? 'pointer' : 'not-allowed',
                  opacity: perf ? 1 : 0.5,
                  background: copied ? `${c.GREEN}22` : c.TAREA,
                  border: `2px solid ${copied ? c.GREEN : c.BORDBR}`,
                  borderRadius: 6, padding: '8px 16px',
                  color: c.GREEN, fontFamily: c.FONT, fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.08em',
                  boxShadow: copied && glow ? `0 0 14px ${c.GREEN}55` : undefined,
                  transition: 'all .2s ease',
                }}
              >
                {copied ? '▶ コピー完了' : 'COPY  分析プロンプト'}
              </button>
              <p style={{ margin: 0, fontSize: 10, color: c.DIM, lineHeight: 1.7 }}>
                コピーしたら下のAIに貼ってください。業種の実測（{PERF_LABELS[perfKey]}）も一緒に渡します。
                🔴 ぽいロボは株価を持っていないので、株価はAI側に調べさせる形にしています
                （出典と取得日を書かせます）。売買の推奨と、いまの局面の断定は書かせません。
              </p>
              <AILaunchRow theme={theme} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export default SectorPanel as React.FC<Props>
