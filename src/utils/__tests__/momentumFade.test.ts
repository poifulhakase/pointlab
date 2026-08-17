import { describe, it, expect } from 'vitest'
// @ts-expect-error 型定義のない .mjs（ロボ口座のプロンプト組み立て）
import { buildMomentumFade } from '../../../scripts/roboPrompt.mjs'

/**
 * 「上げの勢いが落ちているか」を数値にする（2026-08-17 追加）。
 *
 * きっかけ＝ユーザー指摘「上昇のローソク足が短くなっていっている＝売買圧が弱まっている」。
 * 🔴 それまで LLM に渡していたのは**下げてからの材料**（ATR・損切り・乖離）だけで、
 *    上げの最中に勢いが枯れる段階を数値で渡していなかった。
 */
describe('buildMomentumFade', () => {
  const bar = (date: string, open: number, close: number, volume = 1000, high?: number, low?: number) => ({
    date, open, close, volume,
    high: high ?? Math.max(open, close),
    low: low ?? Math.min(open, close),
  })

  it('上昇日の実体が縮んでいれば fading=true', () => {
    // 実データ（日経・2026年7〜8月）に近い形＝3.9% → 2.7% → 1.6% → 0.8% → 0.4%
    const rows = [
      bar('2026-07-30', 100, 101), bar('2026-07-31', 101, 105),
      bar('2026-08-03', 105, 104), bar('2026-08-04', 104, 104),
      bar('2026-08-05', 104, 107), bar('2026-08-06', 107, 106),
      bar('2026-08-07', 106, 106), bar('2026-08-10', 106, 107.7),
      bar('2026-08-12', 107.7, 108.5), bar('2026-08-13', 108.5, 108.9),
    ]
    const f = buildMomentumFade(rows)

    expect(f.fading).toBe(true)
    expect(f.upBodyLateAvg).toBeLessThan(f.upBodyEarlyAvg)
    expect(f.upBodyRecent.length).toBeGreaterThan(0)
  })

  it('上昇日の実体が広がっていれば fading=false', () => {
    const rows = [
      bar('2026-07-30', 100, 100.4), bar('2026-07-31', 100.4, 101.2),
      bar('2026-08-03', 101.2, 102.8), bar('2026-08-04', 102.8, 105.5),
      bar('2026-08-05', 105.5, 109.6), bar('2026-08-06', 109.6, 115),
    ]
    const f = buildMomentumFade(rows)

    expect(f.fading).toBe(false)
  })

  it('連続で縮んだ回数を数える', () => {
    const rows = [
      bar('2026-08-03', 100, 104), bar('2026-08-04', 104, 106),
      bar('2026-08-05', 106, 107), bar('2026-08-06', 107, 107.3),
      bar('2026-08-07', 107.3, 107.4), bar('2026-08-10', 107.4, 107.42),
    ]
    const f = buildMomentumFade(rows)

    expect(f.shrinkStreak).toBeGreaterThanOrEqual(3)
  })

  it('出来高と上ヒゲも出す（上値で押し返されているか）', () => {
    const rows = [
      bar('2026-08-03', 100, 102, 1000), bar('2026-08-04', 102, 103, 1000),
      bar('2026-08-05', 103, 104, 1000), bar('2026-08-06', 104, 104.5, 1000),
      bar('2026-08-07', 104.5, 105, 1000),
      // 上ヒゲの長い日（高値まで伸びて押し戻された）
      bar('2026-08-10', 105, 105.2, 500, 108, 104.8),
    ]
    const f = buildMomentumFade(rows)

    expect(f.volVsNormal).toBeCloseTo(0.5, 1)   // 平常の半分の出来高
    expect(f.upperWick3dAvg).toBeGreaterThan(0)
  })

  it('本数が足りなければ null（無いものを作らない）', () => {
    expect(buildMomentumFade([bar('2026-08-17', 100, 101)])).toBeNull()
  })
})
