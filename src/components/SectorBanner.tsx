import { useEffect, useState } from 'react'
import { loadSectorPerf } from '../utils/sectorData'
import { macroPhase, phaseById, nextPhase, type SectorPhase } from '../utils/sectorRotation'

// ──────────────────────────────────────────────────────────────────────────
// セクターローテーションの入口バナー（サイドバー・メモの上）
//
// 🔴 2026-08-11: 周期タブをシールド画面から外し、独立ページにした（ユーザー指示）。
//    理由＝**周期は日経平均の話ではない**。日経を見る道具（シールド画面）と同居させない。
//
// 🔵 ただの入口にはしない。**開かなくても現在地が分かる**ようにする。
//    毎日ここを通るので、1行でも「いまどの局面か」が目に入るほうが価値がある。
// 🔴 判定できない日（金利かインフレが横ばい）は**判定しない**。
//    無理に埋めると、根拠の無い現在地を毎日見せることになる。
// 🔵 データ取得に失敗しても入口としては使える（局面の行だけ落ちる）。
// ──────────────────────────────────────────────────────────────────────────

type Props = {
  theme: 'dark' | 'light'
  onOpen: () => void
}

export function SectorBanner({ theme, onOpen }: Props) {
  const [here, setHere] = useState<SectorPhase | null>(null)
  const [next, setNext] = useState<SectorPhase | null>(null)
  /** 移行期＝金利とインフレが食い違っている日。行き先が確定していないことを示す。 */
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    let alive = true
    loadSectorPerf()
      .then(d => {
        if (!alive) return
        // 🔴 lastAnchor は取得側（fetch-jpx.mjs）が履歴をたどって確定させたものを使う。
        //    フロントで推定すると、本体の図と現在地が食い違う。
        const m = macroPhase(d.rate, d.infl, d.macro?.lastAnchor ?? null)
        if (!m) return // 判定できない日は何も出さない

        // 🔴 **移行期の現在地は `m.id` ではない**（2026-08-11 に食い違って気づいた）。
        //    金利とインフレが食い違う日、`macroPhase` が返す id は**行き先**であって現在地ではない。
        //    現在地は直前に確定したアンカー（`lastAnchor`）。本体の図の「いまここ」と同じ扱いにする。
        //    ここを間違えると、サイドバーとページで違う局面を表示することになる。
        const anchor = d.macro?.lastAnchor ?? null
        const hereId = m.derived ? anchor : m.id
        if (!hereId) return

        setHere(phaseById(hereId))
        // 🔵 移行期の行き先は2つ（ハードなら経由する局面／ソフトならその次）。
        //    バナーは幅が狭いので、最初の候補だけ出して「か」の関係はページに任せる。
        setNext(m.derived ? phaseById(m.id) : nextPhase(hereId))
        setMoving(!!m.derived)
      })
      .catch(() => { /* 入口としては使えるので握りつぶす */ })
    return () => { alive = false }
  }, [])

  const dark = theme === 'dark'
  const accent = here?.color ?? (dark ? '#38bdf8' : '#0284c7')

  return (
    <button
      type="button"
      onClick={onOpen}
      title="セクターローテーション（景気の循環と業種）を開く"
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '9px 10px 10px',
        borderRadius: 8,
        border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        // 現在地の色をうっすら敷く＝開く前に「いまの局面」が色でも伝わる
        background: dark
          ? `linear-gradient(135deg, ${hexA(accent, 0.16)} 0%, rgba(255,255,255,0.02) 60%)`
          : `linear-gradient(135deg, ${hexA(accent, 0.14)} 0%, rgba(0,0,0,0.02) 60%)`,
        color: 'var(--text)',
        font: 'inherit',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ring accent={accent} angle={here?.angle ?? null} dark={dark} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'block',
            fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700,
            color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)',
          }}>SECTOR ROTATION</span>
          <span style={{
            display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 1,
            color: here ? accent : 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {here ? here.label : 'セクターローテーション'}
          </span>
        </span>
        <span aria-hidden style={{ fontSize: 12, opacity: 0.45, flexShrink: 0 }}>›</span>
      </span>

      {/* 🔵 「次に来るとされる」は理論の話。**上がるとは書かない**（画面本体と同じ約束） */}
      <span style={{
        display: 'block', marginTop: 6, paddingTop: 6,
        borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        fontSize: 10.5, lineHeight: 1.5,
        color: dark ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.58)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {here && next
          ? <>{moving ? '移行期' : here.economy}<span style={{ opacity: 0.6, margin: '0 6px' }}>→</span>{moving ? '行き先は' : '次は'} {next.label}{moving ? ' ほか' : ''}</>
          : '景気の循環と業種の関係を見る'}
      </span>
    </button>
  )
}

/** 円環の小さな絵。現在地の角度に点を置く（本体の図と同じ向き）。 */
function Ring({ accent, angle, dark }: { accent: string; angle: number | null; dark: boolean }) {
  const r = 9
  // 本体と同じ「12時から時計回り」で置く
  const rad = ((angle ?? 0) - 90) * Math.PI / 180
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="1.5"
        stroke={dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'} />
      {angle != null && (
        <>
          <circle cx={12 + r * Math.cos(rad)} cy={12 + r * Math.sin(rad)} r="3" fill={accent} />
          <circle cx={12 + r * Math.cos(rad)} cy={12 + r * Math.sin(rad)} r="5.5" fill="none"
            stroke={accent} strokeOpacity="0.35" strokeWidth="1" />
        </>
      )}
    </svg>
  )
}

/** #rrggbb → rgba()。局面の色をそのまま薄く敷くために使う。 */
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return `rgba(56,189,248,${a})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
