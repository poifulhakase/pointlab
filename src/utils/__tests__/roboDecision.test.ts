import { describe, it, expect } from 'vitest'
// @ts-expect-error — .mjs に型定義は無い
import { validateDecision, holdOnFailure, ROBO_MODEL, ROBO_EFFORT } from '../../../scripts/llmDecide.mjs'
// @ts-expect-error — .mjs に型定義は無い
import { ROBO_OUTPUT_SCHEMA, buildRoboPrompt, buildPriceFeatures, formatImagesSection } from '../../../scripts/roboPrompt.mjs'
// @ts-expect-error — .mjs に型定義は無い
import { computeIndicators } from '../robotStrategy.mjs'

const ok = {
  action: 'open', symbol: '1570', qty: 30, confidence_pct: 65,
  reason: '価格が25日線の上でトレンドは上昇。20日高値を更新中。',
  counter: '25日線を明確に割ったら読みが外れる。',
  user_note: '',
}

describe('ROBO_OUTPUT_SCHEMA', () => {
  it('必須項目に reason と counter が入っている（記録の中核）', () => {
    expect(ROBO_OUTPUT_SCHEMA.required).toContain('reason')
    expect(ROBO_OUTPUT_SCHEMA.required).toContain('counter')
  })

  it('銘柄の候補は4本＋none に限定されている', () => {
    expect(ROBO_OUTPUT_SCHEMA.properties.symbol.enum).toEqual(['1321', '1570', '1571', '1357', 'none'])
  })

  it('余計なキーを許さない（Structured Outputs の前提）', () => {
    expect(ROBO_OUTPUT_SCHEMA.additionalProperties).toBe(false)
  })
})

describe('判断器の指紋', () => {
  it('モデルと effort が固定値として公開されている（成績表を分ける基準）', () => {
    expect(ROBO_MODEL).toBe('claude-opus-5')
    expect(ROBO_EFFORT).toBe('high')
  })
})

describe('validateDecision', () => {
  it('整合が取れていれば valid', () => {
    const r = validateDecision(ok)
    expect(r.valid).toBe(true)
    expect(r.issues).toEqual([])
  })

  it('🔴 open なのに銘柄 none なら hold に落とす', () => {
    const r = validateDecision({ ...ok, symbol: 'none' })
    expect(r.normalized.action).toBe('hold')
    expect(r.normalized.qty).toBe(0)
    expect(r.valid).toBe(false)
  })

  it('🔴 open なのに qty が 0 以下なら hold に落とす', () => {
    const r = validateDecision({ ...ok, qty: 0 })
    expect(r.normalized.action).toBe('hold')
    expect(r.normalized.symbol).toBe('none')
  })

  it('hold なのに数量や銘柄が付いていたら落とす', () => {
    const r = validateDecision({ ...ok, action: 'hold', symbol: '1570', qty: 10 })
    expect(r.normalized.qty).toBe(0)
    expect(r.normalized.symbol).toBe('none')
  })

  it('close は銘柄を残したまま qty だけ 0 にする', () => {
    const r = validateDecision({ ...ok, action: 'close', symbol: '1570', qty: 30 })
    expect(r.normalized.action).toBe('close')
    expect(r.normalized.symbol).toBe('1570')
    expect(r.normalized.qty).toBe(0)
  })

  it('確信度が範囲外なら 50 に丸める', () => {
    expect(validateDecision({ ...ok, confidence_pct: 130 }).normalized.confidence_pct).toBe(50)
    expect(validateDecision({ ...ok, confidence_pct: -5 }).normalized.confidence_pct).toBe(50)
  })

  it('🔴 counter（反証）が空なら指摘する — 負け筋が記録されないため', () => {
    const r = validateDecision({ ...ok, counter: '' })
    expect(r.valid).toBe(false)
    expect(r.issues.join()).toContain('counter')
  })

  it('reason が短すぎたら指摘する', () => {
    const r = validateDecision({ ...ok, reason: 'ok' })
    expect(r.valid).toBe(false)
  })

  it('空の判断は valid でない', () => {
    expect(validateDecision(null).valid).toBe(false)
  })
})

describe('holdOnFailure', () => {
  it('🔴 判断が取れない日は hold。決定論の結果で埋めない', () => {
    const d = holdOnFailure('refusal')
    expect(d.action).toBe('hold')
    expect(d.symbol).toBe('none')
    expect(d.qty).toBe(0)
    expect(d.confidence_pct).toBe(0)
    expect(d.reason).toContain('取得できなかった')
  })
})

describe('buildRoboPrompt', () => {
  const rows = computeIndicators(
    Array.from({ length: 120 }, (_, i) => {
      const c = 100 + i * 0.5
      return { date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, open: c, high: c * 1.01, low: c * 0.99, close: c }
    }),
  )
  const f = buildPriceFeatures(rows)

  it('価格が需給より先に出る（優先順位を並び順で伝える）', () => {
    const p = buildRoboPrompt({
      priceFeatures: f, supply: { marginRatio: 8.5 },
      baseline: { side: 'bull', reason: 'テスト' },
      account: { cash: 1000000 },
    })
    expect(p.indexOf('【一次情報】')).toBeLessThan(p.indexOf('【二次情報】'))
  })

  it('過去データは背景として、需給より後に出る', () => {
    const p = buildRoboPrompt({
      priceFeatures: f, supply: { marginRatio: 8.5 },
      baseline: { side: 'bull', reason: 'テスト' }, account: {},
    })
    expect(p.indexOf('【二次情報】')).toBeLessThan(p.indexOf('【背景】'))
  })

  it('🔴 矛盾時の裁定ルール（価格を軸に倍率で調整）が入っている', () => {
    const p = buildRoboPrompt({ priceFeatures: f, account: {} })
    expect(p).toContain('方向は価格で決める')
    expect(p).toContain('確信度＝倍率の調整')
  })

  it('🔴 対照群は「命令ではない」と明記され、外すなら理由を書かせる', () => {
    const p = buildRoboPrompt({ priceFeatures: f, baseline: { side: 'bear', reason: 'x' }, account: {} })
    expect(p).toContain('命令ではない')
    expect(p).toContain('外すなら')
  })

  it('🔴 TEV が当たっていない事実を伏せずに渡す', () => {
    const p = buildRoboPrompt({ priceFeatures: f, account: {} })
    expect(p).toContain('TEV はこの程度しか当たっていない')
  })

  it('🔴 勝率を上げにいくなという指示が入っている', () => {
    const p = buildRoboPrompt({ priceFeatures: f, account: {} })
    expect(p).toContain('勝率を上げようとしないこと')
  })

  it('持たないことは正しい選択、と伝えている', () => {
    const p = buildRoboPrompt({ priceFeatures: f, account: {} })
    expect(p).toContain('持たない（hold）ことは正しい選択')
  })
})

describe('buildPriceFeatures', () => {
  const rows = computeIndicators(
    Array.from({ length: 120 }, (_, i) => {
      const c = 100 + i * 0.5
      return { date: '2026-01-01', open: c, high: c * 1.01, low: c * 0.99, close: c }
    }),
  )

  it('移動平均・高安・トレンド・ボラを特徴として出す', () => {
    const f = buildPriceFeatures(rows)
    expect(f.ma25).toBeGreaterThan(0)
    expect(f.high20).toBeGreaterThan(0)
    expect(f.atr20).toBeGreaterThan(0)
    expect(typeof f.trend).toBe('string')
  })

  it('上げ続けていれば高値更新中・レンジ上部と出る', () => {
    const f = buildPriceFeatures(rows)
    expect(f.structure).toBe('高値更新中')
    expect(f.posInRange20).toBeGreaterThan(80)
  })
})

describe('formatImagesSection', () => {
  it('🔴 画像が無くても判断を止めないと明示する', () => {
    const s = formatImagesSection({ hasChart: false, hasPosition: false })
    expect(s).toContain('数値だけで判断')
  })

  it('チャートが古ければ「数値のほうを信頼」と伝える', () => {
    const s = formatImagesSection({ hasChart: true, chartAgeDays: 3 })
    expect(s).toContain('3営業日前')
    expect(s).toContain('数値のほうを信頼')
  })
})
