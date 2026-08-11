import { useEffect, useMemo, useState } from 'react'
import { PHASES, macroPhase, type SectorPhaseId } from '../utils/sectorRotation'
import { loadSectorPerf } from '../utils/sectorData'

// ──────────────────────────────────────────────────────────────────────────
// セクターローテーションの入口（サイドバー・メモの上）＝**ドット絵の円環**
//
// 🔴 2026-08-11: 周期をシールド画面のタブから外し、独立ページにした（ユーザー指示）。
//    理由＝**周期は日経平均の話ではない**。日経を見る道具と同居させない。
// 🔴 **ビジュアル特化**（同日ユーザー指示）。文字は中心の「SECTOR / ROTATION」だけで、
//    局面名や次の局面といった説明は**すべてページ本体に任せる**。読ませる場所にしない。
// 🔴 **ドット絵で描く**（同日ユーザー指示）。ぽいロボのサイバー調に合わせる。
//
// 🔵 なぜ SVG の円弧ではなくドットか：
//    ① 拡大してもぼやけない（四角のまま）②色をテーマに紐づけられる
//    ③ gitで1ドット単位の差分が見える ④画像ファイルを増やさない
// 🔵 ドットは**升目に沿って置く**（極座標で計算した位置に丸を打つのではない）。
//    格子に乗っていないと「ドット絵」に見えず、ただの点描になる。
// 🔴 判定できない日は**どこも光らせない**（薄い輪だけ）。根拠の無い現在地を見せない。
// ──────────────────────────────────────────────────────────────────────────

type Props = {
  theme: 'dark' | 'light'
  onOpen: () => void
}

/** 升目の数（奇数にすると中心が1マスに定まる）。 */
const N = 23
/** 1ドットの大きさ(px)と隙間。隙間があるほど「ドット」に見える。 */
const CELL = 5
const GAP = 1
/** 環の内外の半径（マス単位）。 */
const R_OUT = 10.6
const R_IN = 7.0

type Dot = { x: number; y: number; phase: SectorPhaseId }

/**
 * 升目を走査して、環の帯に入るマスだけを拾う（純粋関数・テスト対象）。
 * 角度は**12時起点・時計回り**＝ページ本体の図と同じ向き。
 */
function buildDots(): Dot[] {
  const c = N / 2
  const out: Dot[] = []
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const dx = gx + 0.5 - c
      const dy = gy + 0.5 - c
      const r = Math.hypot(dx, dy)
      if (r < R_IN || r > R_OUT) continue
      // atan2(dx, -dy)＝12時から時計回りに増える角度
      const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
      const phase = PHASES.find(p => deg >= p.angle && deg < p.angle + 90) ?? PHASES[0]
      out.push({ x: gx, y: gy, phase: phase.id })
    }
  }
  return out
}

export function SectorBanner({ theme, onOpen }: Props) {
  const [hereId, setHereId] = useState<SectorPhaseId | null>(null)
  const [hover, setHover] = useState(false)
  const dots = useMemo(() => buildDots(), [])

  useEffect(() => {
    let alive = true
    loadSectorPerf()
      .then(d => {
        if (!alive) return
        const m = macroPhase(d.rate, d.infl, d.macro?.lastAnchor ?? null)
        if (!m) return // 判定できない日は光らせない
        // 🔴 移行期の現在地は `m.id` ではない（あれは行き先）。直前に確定したアンカーが現在地。
        //    本体の図の「いまここ」と同じ扱いにしないと、開いた瞬間に位置が変わって見える。
        const id = m.derived ? (d.macro?.lastAnchor ?? null) : m.id
        if (id) setHereId(id)
      })
      .catch(() => { /* 入口としては使えるので握りつぶす */ })
    return () => { alive = false }
  }, [])

  const dark = theme === 'dark'
  const here = hereId ? PHASES.find(p => p.id === hereId) ?? null : null
  const accent = here?.color ?? (dark ? '#7c8794' : '#94a3b8')
  const px = N * CELL

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="セクターローテーションを開く"
      title="セクターローテーション"
      style={{
        display: 'block', width: '100%', cursor: 'pointer',
        padding: '10px 0 12px',
        border: 'none', background: 'transparent', color: 'var(--text)', font: 'inherit',
      }}
    >
      <svg
        width={px} height={px} viewBox={`0 0 ${px} ${px}`}
        shapeRendering="crispEdges"
        style={{
          display: 'block', margin: '0 auto',
          filter: here ? `drop-shadow(0 0 ${hover ? 12 : 7}px ${accent}66)` : 'none',
          transition: 'filter 0.25s ease',
        }}
      >
        {dots.map(d => {
          const on = d.phase === hereId
          const color = PHASES.find(p => p.id === d.phase)!.color
          return (
            <rect
              key={`${d.x}-${d.y}`}
              x={d.x * CELL} y={d.y * CELL}
              width={CELL - GAP} height={CELL - GAP}
              fill={color}
              fillOpacity={on ? 0.95 : (dark ? 0.16 : 0.20)}
              style={{ transition: 'fill-opacity 0.3s ease' }}
            />
          )
        })}

        {/* 中心。文字はここだけ＝「何の絵か」が分かれば十分 */}
        <text x={px / 2} y={px / 2 - 3} textAnchor="middle"
          style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700 }}
          fill={dark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.66)'}>SECTOR</text>
        <text x={px / 2} y={px / 2 + 7} textAnchor="middle"
          style={{ fontSize: 8, letterSpacing: '0.12em', fontWeight: 700 }}
          fill={dark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.66)'}>ROTATION</text>
      </svg>
    </button>
  )
}
