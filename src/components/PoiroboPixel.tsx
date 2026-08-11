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

/** 目のドット（まばたきさせる位置）。SPRITE を変えたらここも見直す。 */
const EYE_ROWS = [8, 9]

/**
 * ドットをほんの少しだけ重ねて描く倍率。
 *
 * 🔴 これが無いと**体の途中に薄い横線が出る**（2026-08-11 にユーザーが指摘）。
 *    原因は端末の画素比（1.25倍など）。`crispEdges` は1つ1つの四角を独立して丸めるので、
 *    行によって「下端」と次の行の「上端」が1画素ぶんずれ、そこが背景として透ける。
 * 🔵 重なるのは同じ色どうしがほとんどなので見た目は変わらない。
 *    色の境目でも 5% ＝ 1ドット9pxなら 0.45px なので、目では分からない。
 */
const OVERLAP = 1.05

type Props = {
  /**
   * 一辺の大きさ(px)。
   * 🔴 **必ず升目の数（24）の倍数にすること。**端数だと1ドットが割り切れず、
   *    行ごとに継ぎ目（薄い横線）が出る。220pxで実際に出た（2026-08-11）。
   */
  size?: number
  /** ふわふわ上下に動かす（読み込み中など「待っている」ときに使う）。 */
  animate?: boolean
  /** 読み上げ用。飾りとして置くときは空にする。 */
  alt?: string
}

export function PoiroboPixel({ size = 48, animate = false, alt = 'ぽいロボ' }: Props) {
  const n = SPRITE.length
  const cell = 1 // viewBox は 24×24。実サイズは width/height 側で決める

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={animate ? {
        // 🔴 **1ドットぶんずつカクッと動かす**（2026-08-11）。
        //    なめらかに動かすと小数ピクセルの位置に来て、crispEdges の四角が行ごとに
        //    丸め直され、**体の途中に薄い横線が出る**（ユーザーが気づいて発覚）。
        //    steps() で升目に乗ったまま動かせば線は出ず、ドット絵らしい動きにもなる。
        ['--poirobo-dot' as string]: `${size / SPRITE.length}px`,
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
      {SPRITE.map((row, y) =>
        row.split('').map((ch, x) => {
          const fill = PALETTE[ch]
          if (!fill) return null
          const isEye = ch === 'e' && EYE_ROWS.includes(y)
          return (
            <rect
              key={`${x}-${y}`}
              x={x * cell} y={y * cell} width={cell * OVERLAP} height={cell * OVERLAP}
              fill={fill}
              // 🔵 まばたきは目のドットだけ。お腹のLEDは点きっぱなしにする（動きが増えすぎるため）
              style={animate && isEye ? { animation: 'poiroboBlink 3.4s ease-in-out infinite' } : undefined}
            />
          )
        })
      )}
    </svg>
  )
}
