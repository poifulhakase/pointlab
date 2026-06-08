import { describe, it, expect } from 'vitest'
import { sig, r2, computeTevPhysics } from '../tevCore.mjs'

describe('sig（正準シグナル閾値 65/35）', () => {
  it('65以上=BULL / 35以下=BEAR / その間=NEUTRAL', () => {
    expect(sig(65)).toBe('BULL')
    expect(sig(64)).toBe('NEUTRAL')
    expect(sig(36)).toBe('NEUTRAL')
    expect(sig(35)).toBe('BEAR')
  })
  it('旧 backtest 閾値 60/40 との差分域（35<pct<65）は NEUTRAL', () => {
    // 旧 backtest では 60/40 のため [60,65) は BULL、(35,40] は BEAR だった。
    // 統一後は NEUTRAL になる（この域が乖離の実体）。
    expect(sig(62)).toBe('NEUTRAL')
    expect(sig(38)).toBe('NEUTRAL')
  })
})

describe('computeTevPhysics', () => {
  it('tev_V/tev_A が null なら null を返す', () => {
    expect(computeTevPhysics({ tev_V: null, tev_A: 10, foreign4wPct: 50, cotLfPct: 50, creditRatioPct: 50, ssPct: 50, compositeScore: 0 })).toBeNull()
  })

  it('中立入力（信用%ile=空売り%ile）では rResist=0', () => {
    const r = computeTevPhysics({ tev_V: 10, tev_A: 5, foreign4wPct: 50, cotLfPct: 50, creditRatioPct: 50, ssPct: 50, compositeScore: 0 })
    expect(r).not.toBeNull()
    expect(r!.tev_rResist).toBeCloseTo(0, 10)  // signedLoad=0 → -0 になりうるが値は0
  })

  it('既知入力でゴールデン値（式が変わったら検知）', () => {
    const r = computeTevPhysics({
      tev_V: 30, tev_A: 20, foreign4wPct: 80, cotLfPct: 50,
      creditRatioPct: 70, ssPct: 30, compositeScore: 40,
    })!
    // tev_fBase = 0.3*30 + 0.7*20 = 23
    expect(r.tev_fBase).toBe(23)
    // fInertiaRaw = 23 * 0.8 = 18.4 ; decay=1（V>0,A>0で天井失速なし・COT50でBEARなし）→ fInertia=18.4
    expect(r.tev_fInertia).toBe(18.4)
    // signedLoad = 70-30 = 40 ; rResist = -8*sign(40)*sqrt(40) = -8*6.3245... = -50.6（r2）
    expect(r.tev_rResist).toBe(r2(-8 * Math.sqrt(40)))
    // tev_value = round(18.4 + (-50.6)) = round(-32.2) = -32
    expect(r.tev_value).toBe(Math.round(18.4 + r2(-8 * Math.sqrt(40))))
    // confidence = min(95, round(|40|*0.5+50)) = 70
    expect(r.tev_confidence).toBe(70)
  })

  it('天井の失速（V>0,A<=0）で 75%減衰＋理由が付く', () => {
    const r = computeTevPhysics({ tev_V: 20, tev_A: 0, foreign4wPct: 60, cotLfPct: 50, creditRatioPct: 50, ssPct: 50, compositeScore: 10 })!
    expect(r.tev_decay).toBeCloseTo(0.25, 10)
    expect(r.tev_decayReasons.some(s => s.includes('天井の失速'))).toBe(true)
  })

  it('COT BEAR（cotLfPct<=35）で50%減衰', () => {
    const bear = computeTevPhysics({ tev_V: 20, tev_A: 10, foreign4wPct: 60, cotLfPct: 35, creditRatioPct: 50, ssPct: 50, compositeScore: 10 })!
    expect(bear.tev_decay).toBeCloseTo(0.5, 10)
    // 旧60/40なら cotLfPct=38 でも BEAR だったが、統一後は減衰しない
    const neutral = computeTevPhysics({ tev_V: 20, tev_A: 10, foreign4wPct: 60, cotLfPct: 38, creditRatioPct: 50, ssPct: 50, compositeScore: 10 })!
    expect(neutral.tev_decay).toBe(1.0)
  })

  it('is10dLow=false なら底打ち反転にならない（backtest 相当）', () => {
    const r = computeTevPhysics({ tev_V: -10, tev_A: 60, foreign4wPct: 50, cotLfPct: 50, creditRatioPct: 50, ssPct: 50, compositeScore: 0, is10dLow: false })!
    expect(r.tev_status).not.toBe('底打ち反転')
  })
})
