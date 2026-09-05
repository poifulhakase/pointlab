import { describe, it, expect } from 'vitest'
// @ts-expect-error — .mjs に型定義は無い（roboOutcome.mjs と同じ扱い）
import { pivotLows, buildBands, DEFAULT_DEF } from '../supportBands.mjs'

/**
 * 歴史的サポート帯の判定（TARGET と検証スクリプトの共通土台）。
 *
 * 🔴 いちばん壊れやすいのは **「その日に確定していない安値」を使ってしまうこと**。
 *    局所安値は前後 W 本を見て決まるので、確定は W 本遅れる。ここが崩れると
 *    「未来を見て帯を引いた」検証になり、画面の数字も嘘になる。
 * 🔴 次に壊れやすいのが **同じ下落局面の連続タッチを1回に畳む** ところ。
 *    畳まないと、1回の暴落が「3回触れた歴史的サポート」に化ける。
 */

type Bar = { date: string; low: number; high: number; close: number; vol: number }

/** 安値だけ指定して日足を作る（高値・終値は安値から機械的に作る） */
function bars(lows: number[]): Bar[] {
  return lows.map((low, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    low,
    high: low * 1.05,
    close: low * 1.02,
    vol: 1000,
  }))
}

/**
 * 谷を植えた系列を作る。谷から離れるほど値が上がる（＝V字）ので、
 * **局所安値は植えた場所だけ**になる。
 * 🔵 平らな系列にすると全部の足が「局所安値」になってしまい、テストにならない。
 */
function valleys(length: number, planted: { at: number; low: number }[], slope = 0.8): number[] {
  return Array.from({ length }, (_, i) =>
    Math.min(...planted.map(p => p.low + Math.abs(i - p.at) * slope)))
}

/** 同じ深さの谷を並べる（よく使う形） */
function valleyAt(length: number, positions: number[], depth = 90): number[] {
  return valleys(length, positions.map(at => ({ at, low: depth })))
}

describe('pivotLows', () => {
  it('前後W本で最安の位置だけを拾う', () => {
    const b = bars(valleyAt(41, [20]))
    expect(pivotLows(b, 5)).toContain(20)
  })

  it('端は返さない（前後W本ぶんの材料が無いため）', () => {
    const b = bars(valleyAt(41, [2, 38]))
    const p = pivotLows(b, 5)
    expect(p).not.toContain(2)
    expect(p).not.toContain(38)
  })

  it('🔴 最後のW本は確定しない（未来の安値を先に知ることはできない）', () => {
    const b = bars(valleyAt(41, [37]))
    // 37 は末尾から4本目。W=5 では確定していない＝返ってこない
    expect(pivotLows(b, 5)).not.toContain(37)
  })
})

describe('buildBands', () => {
  const def = { ...DEFAULT_DEF, W: 5, SEP: 10, MIN_TOUCH: 3 }

  it('別々の時期に3回触れた価格帯を1本の帯にまとめる', () => {
    const lows = valleyAt(120, [20, 50, 80])
    const b = bars(lows)
    const bands = buildBands(b, pivotLows(b, 5), def)
    expect(bands).toHaveLength(1)
    expect(bands[0].touches).toBe(3)
    expect(bands[0].price).toBeCloseTo(90, 5)
  })

  it('🔴 近すぎる安値は同じ局面として1回に畳む（暴落1回を歴史的サポートにしない）', () => {
    // 20・23・26 は SEP=10 より近い＝1回ぶんにしか数えない
    const lows = valleyAt(120, [20, 23, 26])
    const b = bars(lows)
    expect(buildBands(b, pivotLows(b, 5), def)).toHaveLength(0)
  })

  it('タッチが足りない帯は返さない', () => {
    const lows = valleyAt(120, [20, 60])
    const b = bars(lows)
    expect(buildBands(b, pivotLows(b, 5), def)).toHaveLength(0)
  })

  it('離れた価格の安値は別の帯になる', () => {
    const lows = valleys(200, [
      { at: 20, low: 90 }, { at: 50, low: 90 }, { at: 80, low: 90 },        // 安い帯
      { at: 110, low: 150 }, { at: 140, low: 150 }, { at: 170, low: 150 },  // 高い帯（+66%＝別物）
    ], 5)   // 🔵 傾きを立てないと、安い谷の斜面が高い谷を飲み込んでしまう
    const b = bars(lows)
    const bands = buildBands(b, pivotLows(b, 5), def)
    expect(bands).toHaveLength(2)
    expect(bands.map((x: { price: number }) => Math.round(x.price)).sort((x: number, y: number) => x - y)).toEqual([90, 150])
  })

  it('帯の幅（±3%）に収まる安値は同じ帯として数える', () => {
    const lows = valleys(120, [{ at: 20, low: 90 }, { at: 50, low: 92 }, { at: 80, low: 91 }])
    const b = bars(lows)
    const bands = buildBands(b, pivotLows(b, 5), def)
    expect(bands).toHaveLength(1)
    expect(bands[0].touches).toBe(3)
  })
})
