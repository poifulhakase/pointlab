import { describe, it, expect } from 'vitest'
import {
  UNIVERSE, bySymbol,
  computeIndicators, donchianStates, inSeason,
  baselineTimeline, BASELINE_PARAMS,
  stopMultiplier, stopPrice, trailStop, isStopHit, swingLow,
  volumeRatio, obvChange, volumeConfirms, VOLUME_GATE, TRAIL_WIDEN, isMarchEnd, MARCH_END_DAYS,
  baselineTimeline as blTimeline,
  maxQty, clampQty,
  // @ts-expect-error — .mjs に型定義は無い（tevCore.mjs と同じ扱い）
} from '../robotStrategy.mjs'

// ── テスト用の日次データを組み立てるヘルパ ──
// close だけ渡すと high/low を ±0.5% で作る（ATR が計算できるように）
function makeRows(closes: number[], startDate = '2026-01-01') {
  const base = new Date(`${startDate}T00:00:00Z`)
  return closes.map((c, i) => {
    const d = new Date(base.getTime() + i * 86400000)
    return {
      date: d.toISOString().slice(0, 10),
      open: c,
      high: c * 1.005,
      low: c * 0.995,
      close: c,
    }
  })
}

describe('UNIVERSE', () => {
  it('ブル/ベアの1倍・2倍が4本そろっている', () => {
    const codes = (Object.values(UNIVERSE) as { code: string }[]).map(u => u.code)
    expect(codes.sort()).toEqual(['1321', '1357', '1570', '1571'])
  })

  it('方向と倍率の組み合わせが重複しない', () => {
    const keys = (Object.values(UNIVERSE) as { side: string; leverage: number }[]).map(u => `${u.side}${u.leverage}`)
    expect(new Set(keys).size).toBe(4)
  })

  it('bySymbol でコードから引ける / 未知のコードは null', () => {
    expect(bySymbol('1570').leverage).toBe(2)
    expect(bySymbol('1570').side).toBe('bull')
    expect(bySymbol('1357').side).toBe('bear')
    expect(bySymbol('9999')).toBe(null)
  })
})

describe('computeIndicators', () => {
  it('25日MA乖離は、25日ぶん貯まるまで null', () => {
    const rows = computeIndicators(makeRows(Array(30).fill(100)))
    expect(rows[23].dev25).toBe(null)
    expect(rows[24].dev25).not.toBe(null)
  })

  it('横ばいなら乖離は 0', () => {
    const rows = computeIndicators(makeRows(Array(30).fill(100)))
    expect(rows[29].dev25).toBeCloseTo(0, 6)
  })

  it('直近だけ上げれば乖離はプラスになる', () => {
    const closes = [...Array(29).fill(100), 120]
    const rows = computeIndicators(makeRows(closes))
    expect(rows[29].dev25).toBeGreaterThan(0)
  })

  it('ATR20 は20日ぶん貯まるまで null、その後は正の値', () => {
    const rows = computeIndicators(makeRows(Array(30).fill(100)))
    expect(rows[19].atr20).toBe(null)
    expect(rows[29].atr20).toBeGreaterThan(0)
  })

  it('元の配列を破壊しない', () => {
    const src = makeRows(Array(30).fill(100))
    computeIndicators(src)
    expect('dev25' in src[29]).toBe(false)
  })
})

describe('donchianStates', () => {
  it('50日高値を超えたらロングに入り、25日安値を割ったら抜ける', () => {
    // 100で60日 → 200へ急騰（高値超え）→ 50へ急落（安値割れ）
    const closes = [...Array(60).fill(100), ...Array(30).fill(200), ...Array(30).fill(50)]
    const rows = makeRows(closes)
    const { long } = donchianStates(rows)
    expect(long[70]).toBe(true)    // 急騰後はロング
    expect(long[110]).toBe(false)  // 急落後は解除
  })

  it('50日安値を割ったらベア（確定下落）に入る', () => {
    const closes = [...Array(60).fill(100), ...Array(30).fill(50)]
    const rows = makeRows(closes)
    const { bear } = donchianStates(rows)
    expect(bear[70]).toBe(true)
  })

  it('ロングとベアは同時に立たない（上げ相場・下げ相場それぞれで確認）', () => {
    const up = donchianStates(makeRows([...Array(60).fill(100), ...Array(30).fill(200)]))
    const down = donchianStates(makeRows([...Array(60).fill(100), ...Array(30).fill(50)]))
    expect(up.long[80] && up.bear[80]).toBe(false)
    expect(down.long[80] && down.bear[80]).toBe(false)
  })
})

describe('inSeason', () => {
  it('3月下旬・12月下旬の窓に入る', () => {
    expect(inSeason('2026-03-20')).toBe(true)
    expect(inSeason('2026-12-20')).toBe(true)
  })
  it('窓の外は false', () => {
    expect(inSeason('2026-03-14')).toBe(false)
    expect(inSeason('2026-03-28')).toBe(false)
    expect(inSeason('2026-07-01')).toBe(false)
  })
})

describe('baselineTimeline', () => {
  it('rows と同じ長さで、side は bull / bear / null のいずれか', () => {
    const rows = computeIndicators(makeRows(Array(120).fill(100)))
    const tl = baselineTimeline(rows)
    expect(tl.length).toBe(rows.length)
    for (const t of tl) expect([null, 'bull', 'bear']).toContain(t.side)
  })

  it('🔴 過熱（乖離 +9%以上）ではベアが立ち、ブルより優先される', () => {
    // 上昇トレンドを作ってから最後に急騰させ、ロング状態かつ過熱の日を作る
    const closes = [
      ...Array(60).fill(100),
      ...Array(40).fill(200),   // ドンチャンでロング入り
      230,                       // 25日MAから大きく上振れ＝過熱
    ]
    const rows = computeIndicators(makeRows(closes))
    const tl = baselineTimeline(rows)
    const last = tl[tl.length - 1]
    expect(rows[rows.length - 1].dev25).toBeGreaterThanOrEqual(BASELINE_PARAMS.heatDev)
    expect(last.side).toBe('bear')
  })

  it('🔴 確定下落の最中は押し目を撃たない（落ちるナイフに買い向かわない）', () => {
    // 一本調子の下落。乖離は -10% を割るが、ドンチャンはベア状態のまま
    const closes = [100]
    for (let i = 1; i < 120; i++) closes.push(closes[i - 1] * 0.97)
    const rows = computeIndicators(makeRows(closes))
    const { bear } = donchianStates(rows)
    const tl = baselineTimeline(rows)
    const i = rows.length - 1
    expect(bear[i]).toBe(true)                  // 確定下落中で
    expect(rows[i].dev25).toBeLessThan(BASELINE_PARAMS.dipDev)  // 乖離は押し目の条件を満たすのに
    expect(tl[i].side).not.toBe('bull')         // ブルは立たない
  })

  it('条件を満たさない日は side が null（毎日ポジションを持つわけではない）', () => {
    const rows = computeIndicators(makeRows(Array(120).fill(100)))
    const tl = baselineTimeline(rows)
    expect(tl.some((t: { side: string | null }) => t.side === null)).toBe(true)
  })
})

describe('stopMultiplier', () => {
  it('VIX が高いほど損切りを遠くに置く', () => {
    expect(stopMultiplier(15)).toBe(2.0)
    expect(stopMultiplier(25)).toBe(2.5)
    expect(stopMultiplier(35)).toBe(3.0)
  })

  it('🔴 VIX が取れないときは中間（2.5）。狭くしない', () => {
    expect(stopMultiplier(null)).toBe(2.5)
    expect(stopMultiplier(undefined)).toBe(2.5)
    expect(stopMultiplier(NaN)).toBe(2.5)
  })

  it('境界値は下側の帯に入る', () => {
    expect(stopMultiplier(20)).toBe(2.5)
    expect(stopMultiplier(30)).toBe(3.0)
  })
})

describe('stopPrice', () => {
  it('建値から ATR×倍率だけ下に置く', () => {
    const s = stopPrice({ entry: 1000, atr20: 20, vix: 15 })
    expect(s.price).toBe(960)          // 1000 - 20*2.0
    expect(s.rule).toBe('atr20x2.0')
  })

  it('VIX が高いほど損切りは深くなる', () => {
    const calm = stopPrice({ entry: 1000, atr20: 20, vix: 15 }).price
    const wild = stopPrice({ entry: 1000, atr20: 20, vix: 35 }).price
    expect(wild).toBeLessThan(calm)
  })

  it('🔴 ベアETFも建値より下に置く（現物を買うので、読みが外れると価格が下がる）', () => {
    const s = stopPrice({ entry: 500, atr20: 10, vix: 25 })
    expect(s.price).toBeLessThan(500)
  })

  it('マイナス価格にはならない', () => {
    const s = stopPrice({ entry: 10, atr20: 100, vix: 35 })
    expect(s.price).toBe(0)
  })

  it('材料が欠けたら null（推測で埋めない）', () => {
    expect(stopPrice({ entry: null, atr20: 20, vix: 15 })).toBe(null)
    expect(stopPrice({ entry: 1000, atr20: null, vix: 15 })).toBe(null)
  })
})

describe('isStopHit', () => {
  it('終値が損切り値以下なら成立', () => {
    expect(isStopHit({ close: 960, stopPrice: 960 })).toBe(true)
    expect(isStopHit({ close: 959, stopPrice: 960 })).toBe(true)
  })
  it('上回っていれば不成立', () => {
    expect(isStopHit({ close: 961, stopPrice: 960 })).toBe(false)
  })
  it('値が無ければ不成立（誤って損切りしない）', () => {
    expect(isStopHit({ close: null, stopPrice: 960 })).toBe(false)
    expect(isStopHit({ close: 960, stopPrice: null })).toBe(false)
  })
})

describe('maxQty / clampQty', () => {
  it('資金と価格から買える口数を出す（切り捨て）', () => {
    expect(maxQty({ cash: 1000000, price: 30000 })).toBe(33)
  })

  it('🔴 LLM が上限を超える qty を出してもクリップされる', () => {
    expect(clampQty({ qty: 9999, cash: 1000000, price: 30000 })).toBe(33)
  })

  it('上限以内ならそのまま通る', () => {
    expect(clampQty({ qty: 10, cash: 1000000, price: 30000 })).toBe(10)
  })

  it('負数や小数は 0以上の整数に丸める', () => {
    expect(clampQty({ qty: -5, cash: 1000000, price: 30000 })).toBe(0)
    expect(clampQty({ qty: 10.9, cash: 1000000, price: 30000 })).toBe(10)
  })

  it('価格や資金が無ければ 0（発注しない）', () => {
    expect(maxQty({ cash: 1000000, price: 0 })).toBe(0)
    expect(maxQty({ cash: 0, price: 30000 })).toBe(0)
  })
})

// ── トレーリングストップ（2026-08-11 追加）──
// 🔴 ここは「積極化」の中身そのもの。負けの大きさを変えずに勝ちを伸ばすための仕組みで、
//    引き上げるだけ・下げない、が壊れると期待値の前提ごと崩れる。
describe('trailStop', () => {
  it('利が乗ったら損切りを引き上げる', () => {
    const t = trailStop({ current: 1200, atr20: 20, vix: 15, prevStop: 1000 })
    expect(t.raised).toBe(true)
    // 1200 - 2.0(VIX15) x 20 x 2.0(TRAIL_WIDEN) = 1120
    expect(t.price).toBe(1120)
    expect(t.rule).toContain('trail')
  })

  // 🔴 建値と同じ幅で引き上げると、26年の検証で DDそろえ後 -0.93%・売買回数166→434 と
  //    明確に悪化した（刈られては入り直す）。幅を広げて -0.02%＝実質ノーコストにしてある。
  it('🔴 トレーリングの幅は建値のときより広い', () => {
    const entry = stopPrice({ entry: 1200, atr20: 20, vix: 15 })
    const t = trailStop({ current: 1200, atr20: 20, vix: 15, prevStop: 0 })
    expect(t.price).toBeLessThan(entry.price)   // より遠い＝広い
    expect(1200 - t.price).toBeCloseTo((1200 - entry.price) * TRAIL_WIDEN, 5)
  })

  it('🔴 値が下がっても損切りは下げない', () => {
    const t = trailStop({ current: 1010, atr20: 20, vix: 15, prevStop: 1000 })
    expect(t.raised).toBe(false)
    expect(t.price).toBe(1000)
  })

  it('🔴 ボラが膨らんでも損切りは下げない（倍率が上がって幅が広がるケース）', () => {
    // VIX 35 → 倍率3.0。1200 - 3.0 x 60 = 1020 で、直前の 1100 より下
    const t = trailStop({ current: 1200, atr20: 60, vix: 35, prevStop: 1100 })
    expect(t.raised).toBe(false)
    expect(t.price).toBe(1100)
  })

  it('何度上げても単調に上がっていく', () => {
    let stop: number | null = 1000
    for (const px of [1100, 1050, 1300, 1200, 1500]) {
      const t: { price: number } = trailStop({ current: px, atr20: 20, vix: 15, prevStop: stop })
      expect(t.price).toBeGreaterThanOrEqual(stop as number)
      stop = t.price
    }
    expect(stop).toBe(1420)   // 1500 - 2.0 x 20 x 2.0
  })

  it('値やATRが取れない日は何もしない', () => {
    expect(trailStop({ current: null, atr20: 20, vix: 15, prevStop: 1000 }).price).toBe(1000)
    expect(trailStop({ current: 1200, atr20: null, vix: 15, prevStop: 1000 }).raised).toBe(false)
    expect(trailStop({ current: null, atr20: null, vix: null, prevStop: null })).toBe(null)
  })
})

// ── 価格の構造を見る損切り（2026-08-11 追加）──
// 🔴 ATR は値幅しか見ない。誰が見ても支持されている水準のすぐ内側に置くと、
//    真っ先に試されて刈られ、そのあと元の方向へ戻られる形がいちばん痛い。
// 🔴 ただし「その場で決める」に戻してはいけない。構造を見るのは純関数の中だけで、
//    AI には触らせない（損切りが交渉可能になると、負けている場面ほど言い訳が通る）。
describe('構造を見る損切り', () => {
  // low を明示した日次配列。最後の25本の最安値が「スイング安値」になる
  const rowsWithLow = (lows: number[]) =>
    lows.map((lo, i) => ({ date: `d${i}`, open: lo, high: lo * 1.02, low: lo, close: lo * 1.01 }))

  it('スイング安値は直近25本の最安値', () => {
    expect(swingLow(rowsWithLow([900, 980, 1010, 1200]), 25)).toBe(900)
    expect(swingLow([], 25)).toBe(null)
    expect(swingLow(null, 25)).toBe(null)
  })

  it('rows を渡さなければ従来と同じ値', () => {
    const s = stopPrice({ entry: 30000, atr20: 300, vix: 15 })
    expect(s.price).toBe(29400)          // 30000 - 2.0 x 300
    expect(s.rule).toBe('atr20x2.0')
  })

  it('🔴 損切りが安値のすぐ内側なら、安値の下へ回す', () => {
    // ATR損切り = 1020 - 2.0x20 = 980。安値も 980 ＝ ちょうど内側
    const rows = rowsWithLow([...Array(24).fill(1100), 980])
    const s = stopPrice({ entry: 1020, atr20: 20, vix: 15, rows })
    expect(s.rule).toContain('swing25')
    expect(s.price).toBe(978)            // 980 - 20x0.1
  })

  it('🔴 安値がはるか下なら動かさない（引きずられて深くしない）', () => {
    // ATR損切り = 1740。安値 500 は遠すぎて「支持を試す位置」ではない
    const rows = rowsWithLow([500, ...Array(24).fill(1800)])
    const s = stopPrice({ entry: 1780, atr20: 20, vix: 15, rows })
    expect(s.rule).toBe('atr20x2.0')
    expect(s.price).toBe(1740)
  })

  it('安値が損切りより上（＝すでに支持の下）なら動かさない', () => {
    const rows = rowsWithLow(Array(25).fill(1500))
    const s = stopPrice({ entry: 1020, atr20: 20, vix: 15, rows })
    expect(s.rule).toBe('atr20x2.0')
  })

  // 🔵 既定値ではここに当たらない（構造で深くなるのは最大 0.6ATR・k は 2.0 以上）。
  //    上限を締めて、安全網そのものが効くことだけ確かめる。
  it('🔴 構造につられて青天井に深くならない（上限で止まる）', () => {
    const rows = rowsWithLow([...Array(24).fill(1100), 980])
    const s = stopPrice({ entry: 1020, atr20: 20, vix: 15, rows, maxWiden: 1.0 })
    expect(s.rule).toContain('cap1x')
    expect(s.price).toBe(980)            // 1020 - 2.0x20x1.0
  })

  it('既定値では構造が上限を突き破らない', () => {
    for (const sl of [930, 950, 960, 970, 980, 1000]) {
      const rows = rowsWithLow([...Array(24).fill(1200), sl])
      const s = stopPrice({ entry: 1020, atr20: 20, vix: 15, rows })
      expect(s.rule).not.toContain('cap')
    }
  })

  it('イベントが近い日は幅を広げる', () => {
    const plain = stopPrice({ entry: 30000, atr20: 300, vix: 15 })
    const near  = stopPrice({ entry: 30000, atr20: 300, vix: 15, eventNear: true })
    expect(near.price).toBeLessThan(plain.price)
    expect(near.rule).toContain('event')
  })

  it('🔴 トレーリングも同じ決め方（構造を見る）を通る', () => {
    // 幅が2倍になるぶん ATR 損切りは 1020 - 2.0x20x2.0 = 940 で、安値980より下。
    // 「安値のすぐ内側」ではないので構造は効かず、素の値になる。
    const rows = rowsWithLow([...Array(24).fill(1100), 980])
    const t = trailStop({ current: 1020, atr20: 20, vix: 15, prevStop: 900, rows })
    expect(t.rule).toContain('trail')
    expect(t.price).toBe(940)
  })
})

// ── 出来高フィルター（2026-08-11 追加）──
// 🔴 ドンチャンのブレイクに**入る瞬間だけ**、出来高が伴っているかを見る。
//    保有中は見ない。見ると建玉が細切れになり、この戦略の期待値の源泉
//    （87回中5回の大勝ち）が育たない。実際、価格帯別出来高を保有中も見る形で
//    試したら売買回数が 170→424 に爆発して悪化した。
describe('出来高フィルター', () => {
  const mk = (closes: number[], vols: number[]) =>
    closes.map((c, i) => ({ date: `d${i}`, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: vols[i] }))

  it('出来高比は「当日を含む直近n本の平均」に対する比', () => {
    const rows = mk(Array(25).fill(100), [...Array(20).fill(100), 200, 50, 100, 100, 100])
    const vr = volumeRatio(rows, 20)
    // 直近20本 = 100×19 + 200 → 平均105。200/105 ≒ 1.90
    expect(vr[20]).toBeCloseTo(200 / 105, 3)
    expect(vr[21]).toBeLessThan(1)
  })

  it('出来高が取れない日は null（推測で埋めない）', () => {
    const rows = mk(Array(25).fill(100), Array(25).fill(0))
    expect(volumeRatio(rows, 20)[24]).toBe(null)
  })

  it('OBVは上げた日に足し、下げた日に引く', () => {
    // 5日連続で上げた後の20日変化はプラス／下げ続けたらマイナス
    const up = mk([...Array(21).fill(0).map((_, i) => 100 + i), 130], Array(22).fill(10))
    expect(obvChange(up, 20)[21]).toBeGreaterThan(0)
    const down = mk([...Array(21).fill(0).map((_, i) => 130 - i), 100], Array(22).fill(10))
    expect(obvChange(down, 20)[21]).toBeLessThan(0)
  })

  it('🔴 出来高が足りないブレイクは通さない', () => {
    expect(volumeConfirms([1.0], [0.5], 0)).toBe(false)          // 比率が閾値未満
    expect(volumeConfirms([1.5], [-0.1], 0)).toBe(false)         // OBVがマイナス
    expect(volumeConfirms([1.5], [0.1], 0)).toBe(true)           // 両方満たす
  })

  it('🔵 データが無い日は通す（データが無いことを理由に見送らない）', () => {
    expect(volumeConfirms([null], [null], 0)).toBe(true)
  })

  it('閾値は 1.1（1.1〜1.3 は平らな場所を選んである）', () => {
    expect(VOLUME_GATE.ratio).toBe(1.1)
  })

  // 🔴 効果を測るための逃げ道。本番では必ず有効
  it('volumeGate: false で従来の判定に戻せる', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i)
    const rows = mk(closes, Array(120).fill(100))
    const on = blTimeline(computeIndicators(rows))
    const off = blTimeline(computeIndicators(rows), { volumeGate: false })
    expect(off.some((r: { side: string | null }) => r.side === 'bull')).toBe(true)
    // 出来高が平坦（比率1.0）なので、フィルターありでは見送りが出る
    expect(on.filter((r: { side: string | null }) => r.side === 'bull').length)
      .toBeLessThanOrEqual(off.filter((r: { side: string | null }) => r.side === 'bull').length)
  })
})

// ── 年度末ベア（2026-08-11 追加）──
// 🔴 3月の最終2営業日は **26年中18年が下げている**（69%・平均 −1.24%・中央 −0.77%）。
//    配当落ちの機械的な下落に、期末の益出し・ドレッシング解消が重なる。
//    実測 t=−3.10、前半 −0.623% / 後半 −0.707% と前後半でほぼ同じ大きさ。
// 🔴 9月末は効かない（t=−1.34）。権利付最終日・権利落ち日・決算期も全滅（t=0.4〜0.7）。
//    **年度末という日本特有の事情が3月だけに効いている。**
describe('年度末ベア', () => {
  const mk = (dates: string[]) =>
    dates.map(d => ({ date: d, open: 100, high: 101, low: 99, close: 100, volume: 100 }))

  it('3月の最終2営業日を拾う', () => {
    const rows = mk(['2026-03-26', '2026-03-27', '2026-03-30', '2026-03-31', '2026-04-01'])
    expect(isMarchEnd(rows, 0)).toBe(false)
    expect(isMarchEnd(rows, 1)).toBe(false)
    expect(isMarchEnd(rows, 2)).toBe(true)    // 最終2営業日
    expect(isMarchEnd(rows, 3)).toBe(true)    // 最終営業日
    expect(isMarchEnd(rows, 4)).toBe(false)   // 4月
  })

  it('🔴 3月以外の月末では発火しない（9月は実測で効かない）', () => {
    const rows = mk(['2026-09-29', '2026-09-30', '2026-10-01'])
    expect(isMarchEnd(rows, 0)).toBe(false)
    expect(isMarchEnd(rows, 1)).toBe(false)
  })

  it('日数は2（3日はCAGRが高いが前後半で偏る）', () => {
    expect(MARCH_END_DAYS).toBe(2)
  })

  // 🔴 出来高フィルターの**後**に上書きすること。前に入れると2日間の割り込みで
  //    フィルターの「入る瞬間か」の判定がリセットされ、DD が −37.5% → −41.9% に悪化した。
  it('🔴 年度末は出来高フィルターより後に効く（ブルを上書きする）', () => {
    const dates: string[] = []
    for (let d = 1; d <= 31; d++) dates.push(`2026-03-${String(d).padStart(2, '0')}`)
    const rows = dates.map((d, i) => ({ date: d, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 100 }))
    const tl = blTimeline(computeIndicators(rows))
    const last = tl[tl.length - 1] as { side: string | null; reason: string }
    expect(last.side).toBe('bear')
    expect(last.reason).toContain('年度末')
  })
})
