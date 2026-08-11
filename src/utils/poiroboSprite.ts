// ぽいロボのドット絵のデータ（24×24）。
//
// 🔴 描画は `PoiroboPixel.tsx`。ここは**データだけ**を持つ（テストから読めるように分けてある）。
// 🔵 直すときはこの文字を書き換えるだけ。1文字＝1ドット。行の長さは全部そろえること。
//
// 🔴 2026-08-11: 一度 32×32 で「元絵に似せる」方向を試したが**戻した**（ユーザー判断）。
//    皿アンテナ・リング・腕の関節まで描き込んだ結果、
//    **細部が増えたぶん読みにくくなった**（腕が体から離れて見える／頭身が広がる）。
//    小さく見せる絵は、線を足すより減らしたほうが伝わる。
//    🔵 元絵に寄せたいときは解像度を上げるしかないが、**表示サイズが小さいうちは効かない**。

export const SPRITE = [
  '........................',
  '......r..........r......',
  '.......o........o.......',
  '........o......o........',
  '.........o....o.........',
  '.......oooooooooo.......',
  '.....oowwwwwwwwwwoo.....',
  '....owwwwwwwwwwwwwwo....',
  '...owwweewwwwwweewwwo...',
  '...owwweewwwwwweewwwo...',
  '...owwwwwwwwwwwwwwwwo...',
  '..owwwwooeeeeeeoowwwwo..',
  '..owwwwooeeeeeeoowwwwo..',
  '..owwwwwoooooooowwwwwo..',
  '.oowwwwwwwwwwwwwwwwwwoo.',
  '.owowwwwwmmmmmmwwwwwowo.',
  '.owowwwwwmmmmmmwwwwwowo.',
  '.ooowwwwwmmmmmmwwwwwooo.',
  '...oowwwwwwwwwwwwwwoo...',
  '.....oooowwwwwwoooo.....',
  '.......owwo..owwo.......',
  '.......owwo..owwo.......',
  '.......oooo..oooo.......',
  '........................',
] as const

/** 文字→色。`.` は透明（描かない）。 */
export const PALETTE: Record<string, string> = {
  o: '#2a3340', // 輪郭
  w: '#eef2f4', // 白い体
  m: '#9ed8bf', // ミント（下半身）
  e: '#c3e14a', // 目とお腹のLED（光る黄緑）
  r: '#e2543c', // アンテナの赤い玉
}
