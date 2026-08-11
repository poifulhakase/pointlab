import { PoiroboPixel } from './PoiroboPixel'

// 読み込み中の表示。**アプリ全体でこれに揃える**（2026-08-11 ユーザー指示）。
//
// 🔵 待っている数百ミリ秒〜数秒はどうせ見る時間なので、そこに世界観を置く。
//    回転する輪はどのアプリでも同じで、ぽいロボである意味が無い。
// 🔵 画像ではなくコードで描いているので、**読み込みを増やさない**
//    （読み込み中の表示が読み込みを増やしたら本末転倒）。
// 🔴 サイズは升目の数（24）の倍数にすること。端数だと輪郭がにじむ。
//
// 🔵 **ボタンの中の小さなぐるぐるは置き換えない**（ログイン中・保存中など）。
//    あれは「押した操作が動いている」印で、場所も数十pxしかない。ここで扱うのは
//    **画面やパネルが中身を待っている**ときの表示。

type Props = {
  /** 下に出す短い文字（例「読み込み中」）。省略すると絵だけ。 */
  label?: string
  /** 一辺の大きさ(px)。24の倍数。パネル内なら48、画面全体なら72が目安。 */
  size?: number
}

export function PoiroboLoader({ label, size = 48 }: Props) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: 24,
    }}>
      <PoiroboPixel size={size} animate alt="" />
      {label && (
        <span style={{
          fontSize: 10, letterSpacing: '0.18em', color: 'var(--text-sub)',
          fontFamily: "'Courier New', Courier, monospace",
        }}>{label}</span>
      )}
    </div>
  )
}
