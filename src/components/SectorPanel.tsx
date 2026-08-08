import { useEffect, useMemo, useState, useCallback } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { isAdminEmail } from '../utils/admin'
import { cy } from '../utils/cyberTheme'
import { AILaunchRow } from './CyberAiLaunch'
import { jstTimestamp } from '../utils/jstDate'
import { buildStockAnalysisPrompt } from '../utils/sectorStockPrompt'
import { loadSectorPerf, loadStockMaster } from '../utils/sectorData'
import {
  PHASES, PERF_LABELS,
  phaseById, nextPhase, phaseOfSector17, phaseMidAngle, sector17Label,
  phaseStrengths, phaseFits, bestFit, sectorRanking, searchStocks,
  type PerfKey, type PeriodKey, type PerfPeriods, type PhaseFit, type SectorPerfRow,
  type SectorPhaseId, type StockRow,
} from '../utils/sectorRotation'

/**
 * 🔴 画面に出す期間は **直近1か月だけ**（ユーザー指摘・2026-08-07）。
 *    3か月・6か月は直近1か月を含む重なった窓なので、その中で主役が交代していると
 *    **古い局面と今の局面を混ぜた数字**になり、型を測っても読めない。
 *    実際 2026-08-07 の一致度1位は 1か月=逆金融83.3 / 3か月=金融67.3 で食い違っていた
 *    ＝3か月の窓の中で交代が起きていた。
 * 🔵 「その前どうだったか」は `chgPrev2m`（重ならない区間）で見て、
 *    ランキングの「反発」印にだけ使う。数字は出さない（読む必要がないため）。
 */
const MAIN_KEY: PerfKey = 'chg1m'
const SHOWN_KEYS: PerfKey[] = [MAIN_KEY]

/** 「2026-08-07」→「8/7」 */
function md(date: string | null | undefined): string {
  if (!date) return '—'
  const m = date.match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${Number(m[1])}/${Number(m[2])}` : date
}

function periodText(periods: PerfPeriods, key: PeriodKey): string {
  const p = periods[key]
  return p ? `${md(p.from)}→${md(p.to)}` : ''
}

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
  /** 管理者判定に使う（TradingView を自分のチャートレイアウトで開くかの分岐） */
  user: User | null
}

// 🔵 SIZE は「次はこちら」の矢印を**円の外側**に描く余白ぶんだけ R_OUT より大きく取る
//    （内側に描くと中央のテキストと重なって読めない）。
const SIZE  = 344
const R_OUT = 138
const R_IN  = 88
/** 「次の局面はこちら」の矢印を回す半径（外周の目盛りリングのさらに外） */
const R_NEXT = R_OUT + 24

/**
 * 管理者の保存済みチャートレイアウトID。
 * 🔴 **管理者本人がログインしているときだけ**使う（ユーザー・2026-08-08）。
 *    個人のレイアウトなので、他の人がこれを開くと管理者のインジケーター構成が見えてしまう。
 *    そのため一般ユーザーには従来どおり銘柄ページを開く。
 */
const TV_ADMIN_LAYOUT_ID = 'ecEzo0V0'

/**
 * 銘柄コードから TradingView を別タブで開く。
 * 🔵 このアプリは個別銘柄の株価を持たない方針（チャートも指標も TradingView 側が持っている）ので、
 *    「探す」の出口は外部リンク1本にしている。
 * 🔵 どちらも月足で開く。インジケーターや配色は、管理者だけ自分のレイアウトのものが乗る。
 * 🔴 **パラメータ名が違う**ので取り違えないこと。
 *    チャート（`/chart/`）＝ `interval`（足）／銘柄ページ（`/symbols/`）＝ `timeframe`（表示範囲）。
 * 🔴 `noopener` は必須（開いた先から `window.opener` 経由でこちらを操作されないようにする）。
 */
function openInTradingView(code: string, isAdmin: boolean) {
  const url = isAdmin
    ? `https://jp.tradingview.com/chart/${TV_ADMIN_LAYOUT_ID}/?symbol=${encodeURIComponent(`TSE:${code}`)}&interval=1M`
    : `https://jp.tradingview.com/symbols/TSE-${code}/?timeframe=1M`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** 角度（0度＝真上・時計回り）を SVG 座標へ。 */
function pt(angle: number, r: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: SIZE / 2 + r * Math.cos(rad), y: SIZE / 2 + r * Math.sin(rad) }
}

/** 円弧のパス（時計回り）。半径 r で from→to 度。 */
function arcPath(from: number, to: number, r: number): string {
  const a = pt(from, r), b = pt(to, r)
  const large = ((to - from + 360) % 360) > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`
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

export function SectorPanel({ theme, isMobile, user }: Props) {
  const c    = cy(theme)
  const glow = theme === 'dark'
  // 🔵 管理者判定は `utils/admin.ts` に集約（firestore.rules の isAdmin() と齟齬が出ないようテストあり）
  const isAdmin = isAdminEmail(user?.email)
  const UP   = theme === 'light' ? '#15803d' : '#4ade80'
  const DOWN = theme === 'light' ? '#dc2626' : '#f87171'
  const pnl  = (v: number | null) => (v == null ? c.DIM : v > 0 ? UP : v < 0 ? DOWN : c.DESC)

  const [perf,    setPerf]    = useState<SectorPerfRow[] | null>(null)
  const [periods, setPeriods] = useState<PerfPeriods>({})
  const [perfErr, setPerfErr] = useState<string | null>(null)
  const [master,  setMaster]  = useState<StockRow[] | null>(null)
  const [masterErr, setMasterErr] = useState<string | null>(null)
  const [asOf,    setAsOf]    = useState<string | null>(null)

  // 🔵 円環と吹き出しは「いまの勢い（1か月）」で固定。期間の切替はやめた。
  const perfKey: PerfKey = MAIN_KEY
  const [selected, setSelected] = useState<SectorPhaseId>('financial')
  const [hovered,  setHovered]  = useState<SectorPhaseId | null>(null)
  const [query,    setQuery]    = useState('')
  const [picked,   setPicked]   = useState<StockRow | null>(null)
  const [copied,   setCopied]   = useState<'prompt' | null>(null)
  const [help,     setHelp]     = useState(false)
  // 🔵 選んだ局面の内訳はモーダルで出す（常時出すと円環から視線が外れる）
  const [detail,   setDetail]   = useState(false)
  // 🔵 「いま資金が向かっている業種」は既定で上位5つだけ（17件は多すぎる）
  const [allRanks, setAllRanks] = useState(false)

  useEffect(() => {
    let alive = true
    loadSectorPerf()
      .then(d => { if (alive) { setPerf(d.rows); setPeriods(d.periods) } })
      .catch(e => { if (alive) setPerfErr(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [])

  // Esc でモーダル・ヘルプを閉じる
  useEffect(() => {
    if (!detail && !help) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDetail(false); setHelp(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail, help])

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
    for (const k of SHOWN_KEYS) out[k] = perf ? phaseFits(perf, k) : []
    return out
  }, [perf])

  const ranking = useMemo(() => (perf ? sectorRanking(perf) : []), [perf])

  // 🔴 既定で出すのは**プラスの業種だけ・最大5つ**。
  //    17件全部出すとマイナスまで並び、「資金が向かっている」という見出しと矛盾する。
  const risingRows = useMemo(
    () => ranking.filter(r => (r.row[MAIN_KEY] ?? 0) > 0).slice(0, 5),
    [ranking]
  )

  const fits = fitsByKey[perfKey]
  const top  = useMemo(() => bestFit(fits), [fits])

  /**
   * 🔵 この画面の目的は「いま伸びている業種」ではなく
   *    **「次に来るとされる業種」から、これから動くかもしれない銘柄を探すこと**（ユーザー・2026-08-07）。
   *    いまの型（一致度1位）→ 循環の順番で次の局面 → その業種、を出す。
   * 🔴 **これは予測ではない**。「循環の順番ではこう」という理論の話と、
   *    「その業種はいま実測で何位か」という事実を並べるだけ。上がるとは書かない。
   */
  const nowFit   = top
  const nextPh   = nowFit ? nextPhase(nowFit.phase.id) : null
  const nextRows = useMemo(
    () => (nextPh ? ranking.filter(r => nextPh.sectors17.includes(r.row.sector17)) : []),
    [nextPh, ranking]
  )

  // 🔵 選んだ局面。モーダルは「◯◯相場とは？」＝説明だけなので、実測（一致度・平均・順位）は使わない。
  const shown = phaseById(selected)

  // 一致度がいちばん高い局面を指すマーカー。
  // 🔵 弧の中央（R_OUT と R_IN の中間）に置くと**局面名のラベルと重なって読めない**ので、
  //    外周の目盛りリング上に逃がしている。
  const marker = top ? pt(phaseMidAngle(top.phase.id), R_OUT + 12) : null

  const search = useMemo(
    () => (master ? searchStocks(query, master) : { hits: [], total: 0 }),
    [query, master]
  )

  /** クリップボードへコピー（APIが使えない環境の逃げ道つき） */
  const copyText = useCallback(async (text: string, mark: 'prompt') => {
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
    setCopied(mark)
    setTimeout(() => setCopied(null), 2500)
  }, [])

  const handleCopy = useCallback(() => {
    if (!picked || !perf) return
    copyText(buildStockAnalysisPrompt(picked, perf, strengths, perfKey, jstTimestamp()), 'prompt')
  }, [picked, perf, strengths, perfKey, copyText])


  const dataDate = perf?.[0]?.time ?? null

  /**
   * 「◯◯相場とは？」＝**局面そのものの説明**（モーダルの中身）。
   *
   * 🔴 ここには**実測の数字を入れない**（ユーザー指摘・2026-08-07）。
   *    「業績相場の説明なので理論が大事」＝順位・騰落率・一致度はここでは雑音になる。
   *    実測は 円環（一致度）と 中央列（順位・騰落率）に既にあるので、役割で場所を分ける。
   */
  const phaseCard = (
    <section className="sector-card" key={shown.id}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 16, fontWeight: 700, color: shown.color,
          textShadow: glow ? `0 0 10px ${shown.color}55` : undefined,
        }}>{shown.label}</span>
        <span style={{ fontSize: 11, color: c.DIM }}>景気の位置づけ：{shown.economy}</span>
      </div>

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.85, color: c.DESC }}>
        {shown.note}
      </p>

      <div style={{ marginTop: 12, fontSize: 10.5, color: c.DIM, letterSpacing: '0.06em' }}>
        この局面で強くなりやすいとされる業種
      </div>
      <ul style={{
        listStyle: 'none', margin: '6px 0 0', padding: 0,
        display: 'flex', flexWrap: 'wrap', gap: 6,
      }}>
        {shown.sectors17.map(code => (
          <li key={code} style={{
            fontSize: 11.5, color: shown.color,
            border: `1px solid ${shown.color}66`, borderRadius: 4, padding: '3px 9px',
          }}>{sector17Label(code)}</li>
        ))}
      </ul>

      <p style={{ margin: '12px 0 0', fontSize: 10, color: c.DIM, lineHeight: 1.7 }}>
        ⚠ 一般的な整理であって、この通りに動くとは限りません。
      </p>
    </section>
  )

  // ヘルプの吹き出しの背景（半透明にすると下の円環が透けて読みにくいので不透明）
  const bubbleBg = theme === 'light' ? '#ffffff' : '#071322'

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
        /* 破線を流して「次はこちら」を向きだけで伝える */
        @keyframes sector-flow  { from { stroke-dashoffset: 20 } to { stroke-dashoffset: 0 } }
        .sector-seg   { transition: opacity .25s ease, filter .25s ease; cursor: pointer; }
        .sector-seg:hover { filter: brightness(1.25); }
        .sector-card  { animation: sector-fade .28s ease both; }
        .sector-hit   { transition: transform .15s ease, border-color .15s ease, background .15s ease; }
        .sector-hit:hover { transform: translateX(3px); }
        /* 🔴 Chrome のオートフィルが背景を白(rgb(232,240,254))で !important 上書きしてしまい、
           ダークテーマでも入力欄だけ白く見える（ユーザー指摘・2026-08-07）。
           background では勝てないので、内側シャドウで塗り潰してテーマ色に戻す。 */
        #sector-search:-webkit-autofill,
        #sector-search:-webkit-autofill:hover,
        #sector-search:-webkit-autofill:focus,
        #sector-search:-webkit-autofill:active {
          -webkit-text-fill-color: ${c.TXTCLR};
          -webkit-box-shadow: 0 0 0 1000px ${bubbleBg} inset;
          box-shadow: 0 0 0 1000px ${bubbleBg} inset;
          caret-color: ${c.TXTCLR};
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

      {/* ── 左：円環 ── 🔵 上下中央に置く ───────────────── */}
      <div style={{
        flex: isMobile ? '0 0 auto' : 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', overflowY: isMobile ? 'visible' : 'auto',
      }}>
        <div style={{
          fontSize: 12, letterSpacing: '0.18em', color: c.GREEN, marginBottom: 2,
          textShadow: glow ? `0 0 10px ${c.GREEN}55` : undefined,
        }}>
          ▶ SECTOR ROTATION
        </div>
        {/* 🔵 説明は常時出さず「?」に畳む。円環に視線が行くようにするため。 */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: c.DIM, marginBottom: 8,
        }}>
          <span>景気の局面で物色対象が回るという見方 × 実測</span>
          <button
            onClick={() => setHelp(v => !v)}
            aria-label="一致度の説明"
            aria-expanded={help}
            style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `1px solid ${help ? c.GREEN : c.BORDBR}`,
              background: help ? `${c.GREEN}22` : 'transparent',
              color: help ? c.GREEN : c.DIM,
              fontFamily: c.FONT, fontSize: 10, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >?</button>

        </div>

        {/* 🔴 円環は 344px 固定。左右の padding(16px)を足すと 376px 必要なので、
            360px 以下の端末では viewBox のまま縮めないと横にはみ出す。
            `maxWidth:100%` + `height:auto` で幅に合わせて縮小する（比率は viewBox が保つ）。 */}
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
             aria-label="景気4局面と、業種別ETFで測った実測の相対強弱"
             style={{
               maxWidth: '100%', height: 'auto',
               filter: glow ? `drop-shadow(0 0 10px ${c.GREEN}22)` : undefined,
             }}>
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

          {/* 🔵 いまの型 → 次の局面 を、円の内側を回る矢印で見せる（文章での説明は削除）。
              時計回りに流れることで「次はここ」が言葉なしで伝わる。 */}
          {top && nextPh && (
            <g style={{ pointerEvents: 'none' }}>
              <path
                d={arcPath(phaseMidAngle(top.phase.id) + 10, phaseMidAngle(nextPh.id) - 16, R_NEXT)}
                fill="none" stroke={nextPh.color} strokeOpacity={0.8} strokeWidth={2}
                strokeLinecap="round" strokeDasharray="5 6"
                style={{ animation: 'sector-flow 1.3s linear infinite' }}
              />
              {/* 矢じり（次の局面の側を指す） */}
              {(() => {
                const tipA = phaseMidAngle(nextPh.id) - 14
                const tip  = pt(tipA, R_NEXT)
                return (
                  <polygon
                    points="0,-5 9,0 0,5"
                    fill={nextPh.color}
                    transform={`translate(${tip.x} ${tip.y}) rotate(${tipA})`}
                  />
                )
              })()}
            </g>
          )}

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

        {/* 🔵 一致度の一覧表は撤去した（期間が1つになったので、円環の各扇に出ている
            「一致 67.3」と同じ内容＝重複）。説明も箱で常時出すのをやめ、
            上の「?」の吹き出しに畳んだ。**視線を円環に集めるため**（ユーザー要望・2026-08-07）。 */}
        {/* 🔵 選んだ局面の中身はモーダルに逃がした（2026-08-07・ユーザー要望）。
            常時出すと情報量が多く、円環から視線が外れるため。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: shown.color }}>{shown.label}とは？</span>
          <button
            onClick={() => setDetail(true)}
            aria-label={`${shown.label}の内訳を開く`}
            style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              border: `1px solid ${shown.color}`, background: 'transparent',
              color: shown.color, fontFamily: c.FONT, fontSize: 10, lineHeight: 1,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >?</button>
        </div>

        <div style={{ marginTop: 8, fontSize: 9.5, color: c.DIM }}>
          {dataDate && <>データ日付：{dataDate}</>}
          {perfErr && <span style={{ color: DOWN }}> 🔴 取得エラー：{perfErr}</span>}
        </div>
      </div>

      <div style={isMobile
        ? { height: 1, background: 'var(--border-dim)', flexShrink: 0 }
        : { width: 1, background: 'var(--border-dim)', flexShrink: 0 }} />

      {/* ── 中：業種の話 ── 選んだ局面の内訳／次に来る業種／いま強い業種 ──── */}
      {/* 🔵 上下中央寄せ。カードに `minHeight` を入れて**高さが変わらないようにした**ので、
          局面を切り替えても中身は動かない（高さが可変のままだと中央位置がずれてガタつく）。
          🔴 スマホ（縦積み）では `flex: 1` にしないこと。左列が円環の高さ(344px)を先に取るため、
             残りを中列と右列で奪い合って **主役の「次に来る業種」が 63px の帯に潰れる**
             （2026-08-08 実測）。縦積みのときは中身の高さのまま並べて、
             スクロールは親（このコンポーネントのルート）に1本だけ持たせる。 */}
      <div style={{
        flex: isMobile ? '0 0 auto' : 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center',
        padding: '24px 16px', overflowY: isMobile ? 'visible' : 'auto',
      }}>
        <div style={{
          width: '100%', maxWidth: 460,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>

          {/* 🔵 この画面の主役。**次に来るとされる業種**を先頭に置く。
              目的が「いま伸びている業種を見る」ではなく
              「これから動くかもしれない銘柄を探す」ため（ユーザー・2026-08-07）。
              🔴 予測は書かない。循環の順番（理論）と、その業種のいまの実測（事実）を並べるだけ。 */}
          {nowFit && nextPh && (
            <section style={{
              border: `1px solid ${nextPh.color}`, borderRadius: 8, padding: '10px 12px',
              background: c.LOGBG,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: c.GREEN, letterSpacing: '0.08em' }}>
                  ▶ 次に来るとされる業種
                </span>
                <span style={{ fontSize: 10, color: c.DIM }}>
                  いまの型＝<span style={{ color: nowFit.phase.color }}>{nowFit.phase.label}</span>
                  （一致度 {nowFit.score}）→ 次は
                  <span style={{ color: nextPh.color, fontWeight: 700 }}> {nextPh.label}</span> とされる
                </span>
              </div>

              {/* 🔴 この列の数字は**過去（直近1か月）の実績**であって、未来の予想ではない。
                  見出しが「次に来る」なので、ラベルが無いと未来の数字に読める（ユーザー指摘・2026-08-07）。
                  役割は「まだ動いていないことの確認」なので、期間を必ず添える。 */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                fontSize: 9, color: c.DIM, margin: '2px 2px 4px',
              }}>
                ↓ここまでの実績（{periodText(periods, MAIN_KEY)}）
              </div>
              <ul style={{
                listStyle: 'none', margin: 0, padding: 0,
                display: 'flex', flexDirection: 'column', gap: 4,
                minHeight: 6 * 25 + 5 * 4,
              }}>
                {nextRows.map(r => (
                  <li key={r.row.sector17}>
                    <button
                      className="sector-hit"
                      onClick={() => {
                        setSelected(nextPh.id)
                        ensureMaster()
                        setQuery(r.row.label)
                        setPicked(null)
                      }}
                      title={`${r.row.label}の銘柄を検索`}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        // 🔴 border 一括と borderLeft を混ぜない（上の検索結果と同じ理由）
                        borderTop:    `1px solid ${nextPh.color}55`,
                        borderRight:  `1px solid ${nextPh.color}55`,
                        borderBottom: `1px solid ${nextPh.color}55`,
                        borderLeft:   `3px solid ${nextPh.color}`,
                        borderRadius: 5, padding: '6px 9px', background: c.TAREA,
                        color: c.TXTCLR, fontFamily: c.FONT, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        fontSize: 12, flex: 1, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.row.label}</span>
                      <span style={{ fontSize: 9.5, color: c.DIM, whiteSpace: 'nowrap' }}>
                        いま17業種中 {r.rank}位
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: pnl(r.row[MAIN_KEY]),
                        minWidth: 56, textAlign: 'right',
                      }}>{signed(r.row[MAIN_KEY])}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <p style={{ margin: '7px 0 0', fontSize: 9.5, color: c.DIM }}>
                順位が低い＝まだ動いていない ／ ⚠ 循環は経験則です
              </p>
            </section>
          )}

          {/* 🔵 参考：いま資金が向かっている業種（＝すでに動いた側）。
              「次」を判断する材料として、順番が実際に回っているかを見るために置く。 */}
          {ranking.length > 0 && (
            /* 🔵 上の「次に来るとされる業種」とは役割が違うので、間の余白を広めに取る */
            <section style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                {/* 🔴 全17業種を出すとマイナスの業種まで並ぶので、
                    「資金が向かっている」という見出しでは矛盾する（ユーザー指摘・2026-08-07）。
                    上位だけのときと、全部出したときで見出しを変える。 */}
                <span style={{ fontSize: 12, color: c.GREEN, letterSpacing: '0.08em' }}>
                  {allRanks ? '業種ランキング（全17業種）' : 'いま資金が向かっている業種'}
                </span>
                <span style={{ fontSize: 9.5, color: c.DIM }}>
                  直近{PERF_LABELS[MAIN_KEY]}（{periodText(periods, MAIN_KEY)}）の強い順
                </span>
                {/* 🔵 17業種を全部出すと多すぎる（ユーザー指摘・2026-08-07）。
                    既に動いた側は参考情報なので、既定は上位5つだけ。 */}
                <button
                  onClick={() => setAllRanks(v => !v)}
                  style={{
                    marginLeft: 'auto', cursor: 'pointer', fontFamily: c.FONT, fontSize: 9.5,
                    padding: '2px 8px', borderRadius: 4,
                    border: `1px solid ${c.BORDER}`, background: 'transparent', color: c.DIM,
                  }}
                >{allRanks ? '上位だけ' : `全${ranking.length}業種`}</button>
              </div>
              <ul style={{
                listStyle: 'none', margin: 0, padding: 0,
                display: 'flex', flexDirection: 'column', gap: 3,
                // 🔵 既定は5件なのでスクロールしない。「全17業種」に展開したときだけ効く枠
                maxHeight: 420, overflowY: 'auto', overflowX: 'hidden',
              }}>
                {(allRanks ? ranking : risingRows).map(r => {
                  const col = r.phase?.color ?? c.BORDBR
                  return (
                    <li key={r.row.sector17}>
                      <button
                        className="sector-hit"
                        onClick={() => {
                          if (r.phase) setSelected(r.phase.id)
                          ensureMaster()
                          setQuery(r.row.label)
                          setPicked(null)
                        }}
                        title={`${r.row.label}の銘柄を検索`}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          // 🔴 border 一括と borderLeft を混ぜない（上の検索結果と同じ理由）
                          borderTop:    `1px solid ${c.BORDER}`,
                          borderRight:  `1px solid ${c.BORDER}`,
                          borderBottom: `1px solid ${c.BORDER}`,
                          borderLeft:   `3px solid ${col}`,
                          borderRadius: 5, padding: '5px 9px', background: c.LOGBG,
                          color: c.TXTCLR, fontFamily: c.FONT, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 11, color: c.DIM, minWidth: 22 }}>{r.rank}位</span>
                        <span style={{
                          fontSize: 12, flex: 1, minWidth: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{r.row.label}</span>
                        {/* 🔵 警告ではなく事実の印。下げたあとに動き出した業種は、
                            「まだ上がりきっていないものを買う」目的ではむしろ探しているもの。 */}
                        {r.rebound && (
                          <span style={{
                            fontSize: 9, color: c.GREEN, border: `1px solid ${c.GREEN}`,
                            borderRadius: 3, padding: '0 4px', whiteSpace: 'nowrap',
                          }}>反発</span>
                        )}
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: pnl(r.row[MAIN_KEY]),
                          minWidth: 56, textAlign: 'right',
                        }}>{signed(r.row[MAIN_KEY])}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!allRanks && risingRows.length === 0 && (
                <p style={{ margin: 0, fontSize: 11, color: c.DIM }}>
                  直近1か月でプラスの業種はありません（全17業種がマイナス）。
                </p>
              )}

              <p style={{ margin: '6px 0 0', fontSize: 9.5, color: c.DIM }}>
                「反発」＝その前（{periodText(periods, 'prev2m')}）は下げていた業種
              </p>
            </section>
          )}
        </div>
      </div>

      <div style={isMobile
        ? { height: 1, background: 'var(--border-dim)', flexShrink: 0 }
        : { width: 1, background: 'var(--border-dim)', flexShrink: 0 }} />

      {/* ── 右：銘柄の話 ── 検索とAI分析だけ ─────────────────── */}
      {/* 🔴 この列だけ上揃え。検索結果とAIパネルで**高さが変わる**ため、
          中央寄せにすると入力欄が上下に動いてしまう（ユーザー指摘・2026-08-07）。
          上揃えなら中身は下へ伸びるだけで、入力欄の位置は固定される。
          🔴 中列と同じ理由でスマホでは `flex: 1` にしない（潰れる）。
          🔵 上の 44px は3列のときに左右の高さを揃えるためのもの。縦積みでは
             区切り線のすぐ下に無駄な余白が空くだけなので 24px に落とす。 */}
      <div style={{
        flex: isMobile ? '0 0 auto' : 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        // 🔵 スマホの下の余白（120px）は、浮いている「シールド／セクター」トグルと
        //    フッターに最後の項目が隠れないための逃げ。**スクロールの中身の末尾**に置くこと
        //    （親のコンテナに padding で持たせると、常時見える空白の帯になる・2026-08-08）。
        alignItems: 'center', padding: isMobile ? '24px 16px 120px' : '44px 16px 24px',
        overflowY: isMobile ? 'visible' : 'auto',
      }}>
        <div style={{
          width: '100%', maxWidth: 460,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* 銘柄検索 */}
          <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 7 }}>
            <label htmlFor="sector-search" style={{ fontSize: 11, color: c.GREEN, letterSpacing: '0.1em' }}>
              銘柄を探す
            </label>
            <input
              id="sector-search"
              value={query}
              // 🔵 銘柄名は住所や氏名ではないので、そもそもオートフィルの対象にしない
              autoComplete="off"
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
                <br />🔵 行をクリックすると<b>TradingView のチャートを別タブで開きます</b>。
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
                  // 🔵 列に高さの余裕があるので広めに取る（狭いと数件しか見えず絞り込みづらい）
                  maxHeight: 420, overflowY: 'auto', overflowX: 'hidden',
                }}>
                  {search.hits.map(st => {
                    const ph = phaseOfSector17(st.sector17)
                    const on = picked?.code === st.code
                    const col = ph?.color ?? c.BORDBR
                    return (
                      <li
                        key={st.code}
                        className="sector-hit"
                        // 🔵 行を押す＝その銘柄を選び、**TradingView のページを別タブで開く**
                        //    （ユーザー・2026-08-08）。以前はコードのクリップボードコピーだったが、
                        //    貼り先が TradingView と決まっている以上、貼る手間を省いて直接開く。
                        onClick={() => {
                          setPicked(st)
                          openInTradingView(st.code, isAdmin)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          // 🔴 `border`（一括指定）と `borderLeft` を混ぜないこと。
                          //    選択状態が変わると React は値の変わった `border` だけを再適用し、
                          //    値が同じ `borderLeft` は設定し直さないため、左の3pxが1pxに潰れる
                          //    （実際に選択中の行だけ borderLeftWidth が 1px になっていた・2026-08-07）。
                          borderTop:    `1px solid ${on ? col : c.BORDER}`,
                          borderRight:  `1px solid ${on ? col : c.BORDER}`,
                          borderBottom: `1px solid ${on ? col : c.BORDER}`,
                          borderLeft:   `3px solid ${col}`,
                          borderRadius: 5, padding: '7px 10px',
                          background: on ? `${col}1f` : c.LOGBG,
                          color: c.TXTCLR, cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          fontSize: 12.5, fontWeight: 700, minWidth: 46, color: c.GREEN,
                        }}>{st.code}</span>
                        <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                        <span style={{ fontSize: 10.5, color: c.DIM }}>{sector17Label(st.sector17)}</span>
                        {ph && <span style={{ fontSize: 10, color: col }}>{ph.label}</span>}
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
              {/* 🔵 コードのコピーは**リストの行クリック**で済むのでボタンは置かない
                  （同じことが2か所にあると迷う・2026-08-07）。ここはAIプロンプト専用。 */}
              <button
                onClick={handleCopy}
                disabled={!perf}
                style={{
                  alignSelf: 'flex-start',
                  cursor: perf ? 'pointer' : 'not-allowed',
                  opacity: perf ? 1 : 0.5,
                  background: copied === 'prompt' ? `${c.GREEN}22` : c.TAREA,
                  border: `2px solid ${copied === 'prompt' ? c.GREEN : c.BORDBR}`,
                  borderRadius: 6, padding: '8px 16px',
                  color: c.GREEN, fontFamily: c.FONT, fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.08em',
                  boxShadow: copied === 'prompt' && glow ? `0 0 14px ${c.GREEN}55` : undefined,
                  transition: 'all .2s ease',
                }}
              >
                {copied === 'prompt' ? '▶ コピー完了' : 'COPY  分析プロンプト'}
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

      {/* 🔵 「?」から開くものはすべてモーダルで統一する（片方が吹き出しだと挙動が揃わない）。 */}
      {(detail || help) && (() => {
        const isHelp = help
        const accent = isHelp ? c.BORDBR : shown.color
        const close  = () => { setDetail(false); setHelp(false) }
        return (
          <div
            onClick={close}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="sector-card"
              style={{
                position: 'relative', width: 460, maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto',
                background: bubbleBg, border: `1px solid ${accent}`,
                borderRadius: 12, padding: '18px 20px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.45)${glow ? `, 0 0 24px ${accent}33` : ''}`,
                fontFamily: c.FONT, color: c.TXTCLR,
              }}
            >
              <button
                onClick={close}
                aria-label="閉じる"
                style={{
                  position: 'absolute', top: 10, right: 12,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: c.DIM, fontFamily: c.FONT, fontSize: 16, lineHeight: 1, padding: 4,
                }}
              >×</button>

              {isHelp ? (
                <div style={{ fontSize: 11.5, lineHeight: 1.85, color: c.DESC }}>
                  <b style={{ color: c.GREEN }}>一致度とは</b>
                  <br />その局面で強いとされる業種が、実際に17業種中どのあたりに並んでいるかだけで決まります。
                  上位を独占なら100、下位を独占なら0。
                  <br /><br />
                  🔴 <b>確率ではありません。</b>局面に正解が無く、当たったかを検証できないためです。
                  <br />🔴 ぽいロボは<b>景気局面の判定をしていません</b>。円環の4分割は
                  「どの局面でどの業種が強いとされるか」という一般的な対応表です。
                  <br /><br />
                  🔴 <b>1位はよく入れ替わります。</b>15年ぶんで実測したところ、
                  1位が続いた期間は<b>中央値2営業日</b>、1か月以上続いたのは37回だけ（平均1.3か月）でした。
                  <b>その日の並びの特徴</b>であって、腰の据わった「いまの局面」ではありません。
                  <br /><br />
                  <b style={{ color: c.GREEN }}>数字の出どころ</b>
                  <br />TOPIX-17 業種別ETF（1617〜1633）の調整後終値。業種別株価指数そのものではなく、その代用です。
                  <br />期間＝直近1か月（{periodText(periods, 'chg1m')}）。
                </div>
              ) : phaseCard}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default SectorPanel as React.FC<Props>
