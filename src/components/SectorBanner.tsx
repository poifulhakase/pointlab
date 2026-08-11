import { useEffect, useState } from 'react'
import { loadSectorPerf } from '../utils/sectorData'
import { PHASES, macroPhase, type SectorPhaseId } from '../utils/sectorRotation'

// ──────────────────────────────────────────────────────────────────────────
// セクターローテーションの入口（サイドバー・メモの上）
//
// 🔴 2026-08-11: 周期をシールド画面のタブから外し、独立ページにした（ユーザー指示）。
//    理由＝**周期は日経平均の話ではない**。日経を見る道具と同居させない。
//
// 🔴 **ビジュアル特化**（2026-08-11 ユーザー指示）。文字は「SECTOR ROTATION」だけ。
//    局面名・移行期・次の局面といった説明は**すべてページ本体に任せる**。
//    ここは「いまどのあたりか」が絵で伝わればよく、読ませる場所にしない。
// 🔵 4分割の円環そのものを描き、現在地の象限だけを光らせる。
//    色は本体の図と同じ（金融=シアン／業績=グリーン／逆金融=オレンジ／逆業績=パープル）ので、
//    ページを開いたときに同じ色が同じ位置にあり、迷わない。
// 🔴 判定できない日は**どこも光らせない**（薄い輪だけ）。根拠の無い現在地を見せない。
// ──────────────────────────────────────────────────────────────────────────

type Props = {
  theme: 'dark' | 'light'
  onOpen: () => void
}

/** 円環の見た目（px）。サイドバーの幅に収まる範囲で、絵として成立する大きさにする。 */
const SIZE = 128
const R_OUT = 52
const R_IN = 33

export function SectorBanner({ theme, onOpen }: Props) {
  const [hereId, setHereId] = useState<SectorPhaseId | null>(null)
  const [hover, setHover] = useState(false)

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
        width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          display: 'block', margin: '0 auto',
          filter: here ? `drop-shadow(0 0 ${hover ? 14 : 8}px ${accent}55)` : 'none',
          transform: hover ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.25s ease, filter 0.25s ease',
        }}
      >
        {/* 4つの象限。現在地だけ濃く、ほかは沈める＝どこにいるかが一目で分かる */}
        {PHASES.map(p => {
          const on = p.id === hereId
          return (
            <path
              key={p.id}
              d={arc(p.angle, p.angle + 90)}
              fill={p.color}
              fillOpacity={on ? 0.92 : (dark ? 0.13 : 0.16)}
              style={{ transition: 'fill-opacity 0.3s ease' }}
            />
          )
        })}

        {/* 外周のリング（図としての輪郭） */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R_OUT + 5} fill="none" strokeWidth="1"
          stroke={dark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.12)'} />

        {/* 現在地の目印。外周の上を回るので、角度＝いまの位置がそのまま読める */}
        {here && (() => {
          const m = pointOn(here.angle + 45, R_OUT + 5)
          return (
            <>
              <circle cx={m.x} cy={m.y} r="9" fill={accent} fillOpacity="0.18" />
              <circle cx={m.x} cy={m.y} r="4" fill={accent} />
            </>
          )
        })()}

        {/* 中心。文字はここだけ＝「何の絵か」が分かれば十分 */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R_IN - 3}
          fill={dark ? 'rgba(12,16,24,0.92)' : 'rgba(255,255,255,0.94)'} />
        <text x={SIZE / 2} y={SIZE / 2 - 3} textAnchor="middle"
          style={{ fontSize: 8.5, letterSpacing: '0.1em', fontWeight: 700 }}
          fill={dark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.66)'}>SECTOR</text>
        <text x={SIZE / 2} y={SIZE / 2 + 8} textAnchor="middle"
          style={{ fontSize: 8.5, letterSpacing: '0.1em', fontWeight: 700 }}
          fill={dark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.66)'}>ROTATION</text>
      </svg>
    </button>
  )
}

/** 12時を起点に時計回りで角度→座標（本体の図と同じ向き）。 */
function pointOn(deg: number, r: number) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: SIZE / 2 + r * Math.cos(rad), y: SIZE / 2 + r * Math.sin(rad) }
}

/** ドーナツの一片（from〜to度）のパス。 */
function arc(from: number, to: number): string {
  const a = pointOn(from, R_OUT)
  const b = pointOn(to, R_OUT)
  const c = pointOn(to, R_IN)
  const d = pointOn(from, R_IN)
  return [
    `M ${a.x} ${a.y}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${d.x} ${d.y}`,
    'Z',
  ].join(' ')
}
