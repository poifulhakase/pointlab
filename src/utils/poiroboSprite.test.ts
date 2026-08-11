import { describe, it, expect } from 'vitest'
import { SPRITE, PALETTE } from '../utils/poiroboSprite'

/**
 * ドット絵は**升目がそろっていること**がすべて。
 * 1行でも長さが違うと、その行から下が横にずれて絵が崩れる。
 * 目で見て気づきにくいので機械的に固定する。
 */
describe('ぽいロボのドット絵', () => {
  it('正方形（全行が同じ長さ）', () => {
    const w = SPRITE[0].length
    for (const [i, row] of SPRITE.entries()) {
      expect(row.length, `${i}行目の長さが違う`).toBe(w)
    }
    expect(SPRITE.length, '行数と桁数が同じ＝正方形').toBe(w)
  })

  it('パレットにない文字を使っていない', () => {
    const allowed = new Set(['.', ...Object.keys(PALETTE)])
    for (const [i, row] of SPRITE.entries()) {
      for (const ch of row) {
        expect(allowed.has(ch), `${i}行目に未定義の文字「${ch}」`).toBe(true)
      }
    }
  })

  it('ぽいロボの特徴が残っている', () => {
    const all = SPRITE.join('')
    // 目とお腹のLED（光る黄緑）・アンテナの赤い玉・ミントの下半身
    expect(all).toContain('e')
    expect(all).toContain('r')
    expect(all).toContain('m')
    // 🔵 目は左右2つ。1行の中に 'ee' が2か所あることで担保する
    const eyeRow = SPRITE.find(r => r.includes('ee'))!
    expect(eyeRow.split('ee').length - 1).toBe(2)
  })

  it('体は左右対称に描かれている', () => {
    // 🔵 アンテナ（1〜4行目）は元絵どおり左右で長さが違うので、体の行だけ見る。
    // 🔴 小さく見せる絵なので、体が非対称だと歪んで見える。ここは崩さない。
    for (const row of SPRITE.slice(5, 23) as readonly string[]) {
      expect(row, `対称でない行: ${row}`).toBe([...row].reverse().join(''))
    }
  })
})
