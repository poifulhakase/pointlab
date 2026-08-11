import { useMemo } from 'react'
import { SPRITE, PALETTE } from '../utils/poiroboSprite'

// ぽいロボのドット絵（24×24）。
//
// 🔴 2026-08-11 新規（ユーザー指示）。元絵 `public/poirobo.png` の特徴だけを残して升目に落とした：
//    丸い白い体／ミントの下半身／黄緑に光る目とお腹のLED／赤い玉のアンテナ2本／短い手足。
//
// 🔵 画像ではなくコードで持つ理由：
//    ① 拡大してもぼやけない（四角のまま）②配色をテーマに紐づけられる
//    ③ gitで**1ドット単位の差分が見える** ④画像ファイルを増やさない（読み込みが増えない）
// 🔵 直すときは `SPRITE` の文字を書き換えるだけ。1文字＝1ドット。
// 🔴 行の長さは全部そろえること（テストで固定してある）。ずれると絵が崩れる。
//
// 🔴🔴 **1ドット＝1つの四角で描いてはいけない**（2026-08-11 に2度踏んだ）。
//    端末の画素比（125%表示など）では、隣り合う四角の下端と上端が1画素ぶんずれ、
//    **体の途中に薄い横線が出る**。四角を少し重ねても、動かし方を変えても消えなかった。
//    → **同じ色のドットをまとめて1つの図形（path）にする**。1つの図形の内部に境目は無いので、
//      画素比がいくつでも線は出ない。これが根本的な直し方。

/** 目のドット（まばたきさせる位置）。SPRITE を変えたらここも見直す。 */
const EYE_ROWS = [8, 9]

type Props = {
  /**
   * 一辺の大きさ(px)。
   * 🔵 升目の数（24）の倍数にすると1ドットが整数になり、いちばんきれいに出る。
   */
  size?: number
  /** ふわふわ上下に動かす（読み込み中など「待っている」ときに使う）。 */
  animate?: boolean
  /** 読み上げ用。飾りとして置くときは空にする。 */
  alt?: string
}

/**
 * 同じ色のドットを1本の `d` にまとめる（純粋関数）。
 * 各ドットは「そこへ移動 → 右1 → 下1 → 左1 → 閉じる」の小さな正方形。
 * まとめて1つの図形にすることで、ドット同士の境目が消える。
 */
function buildPaths(): { color: string; d: string; eye: boolean }[] {
  const byKey = new Map<string, string[]>()
  SPRITE.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      const color = PALETTE[ch]
      if (!color) return
      // 🔵 まばたきする目だけ別の図形に分ける（お腹のLEDは点きっぱなしにする）
      const eye = ch === 'e' && EYE_ROWS.includes(y)
      const key = `${color}|${eye ? 'eye' : ''}`
      const list = byKey.get(key) ?? []
      list.push(`M${x} ${y}h1v1h-1z`)
      byKey.set(key, list)
    })
  })
  return [...byKey].map(([key, parts]) => ({
    color: key.split('|')[0],
    eye: key.endsWith('|eye'),
    d: parts.join(''),
  }))
}

export function PoiroboPixel({ size = 48, animate = false, alt = 'ぽいロボ' }: Props) {
  const n = SPRITE.length
  const paths = useMemo(() => buildPaths(), [])

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${n} ${n}`}
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={animate ? {
        // 🔴 **1ドットぶんずつカクッと動かす**。なめらかに動かすと小数ピクセルの位置に来て、
        //    せっかく図形をまとめても輪郭がにじむ。steps() なら升目に乗ったまま動く。
        ['--poirobo-dot' as string]: `${size / n}px`,
        animation: 'poiroboBob 1.2s steps(1, end) infinite',
      } : undefined}
    >
      {animate && (
        <style>{`
          @keyframes poiroboBob {
            0%, 100% { transform: translateY(0) }
            50%      { transform: translateY(calc(var(--poirobo-dot) * -1)) }
          }
          @keyframes poiroboBlink { 0%,92%,100% { opacity: 1 } 96% { opacity: 0.15 } }
        `}</style>
      )}
      {paths.map(p => (
        <path
          key={`${p.color}${p.eye ? '-eye' : ''}`}
          d={p.d}
          fill={p.color}
          style={animate && p.eye ? { animation: 'poiroboBlink 3.4s ease-in-out infinite' } : undefined}
        />
      ))}
    </svg>
  )
}
