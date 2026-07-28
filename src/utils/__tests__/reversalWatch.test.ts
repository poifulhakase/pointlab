import { describe, it, expect } from 'vitest'
import { buildReversalWatch, detectTrend, macdHistogram, ema } from '../reversalWatch'
import type { NkFuturesDayData } from '../nkFuturesPriceData'
import type { MarginWeekData }   from '../jpxMarginData'
import type { ShortSellWeekData } from '../shortSellData'
import type { VixDayData }        from '../vixData'
import type { InvestorWeekData }  from '../jpxInvestorData'
import type { NtRatioPoint }      from '../ntRatioData'
import type { AdvanceDeclineWeekData } from '../advanceDeclineData'

// ── フィクスチャ（すべて「新しい順」＝実データの並びに合わせる）──

const day = (date: string, close: number, extra: Partial<NkFuturesDayData> = {}): NkFuturesDayData => ({
  date, open: close, high: close + 100, low: close - 100, close,
  volume: null, prev_close: null, change: null, change_pct: null, ma25_dev: null,
  ...extra,
})

/** n日分の日足を新しい順で作る（closeFn は 0=最古） */
const days = (n: number, closeFn: (i: number) => number, latestExtra: Partial<NkFuturesDayData> = {}) => {
  const asc = Array.from({ length: n }, (_, i) => day(`2026-01-${String(i + 1).padStart(2, '0')}`, closeFn(i)))
  const desc = asc.reverse()
  desc[0] = { ...desc[0], ...latestExtra }
  return desc
}

const margin = (deltaOku: number): MarginWeekData[] => ([
  { date: '2026/07/17', label: '7月第3週', longBal: 6_700_000 + deltaOku * 100, shortBal: 681_412, ratio: 9.85, evalRatio: -10.45 },
  { date: '2026/07/10', label: '7月第2週', longBal: 6_700_000,                  shortBal: 795_524, ratio: 8.46, evalRatio: -4.95 },
])

const ss = (ratios: number[]): ShortSellWeekData[] =>
  ratios.map((ratio, i) => ({ date: `2026/07/${27 - i * 7}`, label: `w${i}`, ratio }))

/** 🔴 vix_daily は「古い順」で来る。テストも実データと同じ並びで渡す（引数は新しい順で書ける） */
const vixs = (newestFirst: number[]): VixDayData[] =>
  newestFirst
    .map((close, i) => ({ time: `2026-07-${27 - i}`, close, changePct: 0 } as unknown as VixDayData))
    .reverse()

/** NT倍率（古い順）。nikkei/topix から ratio を作る */
const nts = (nikkeiAsc: number[], topix = 4000): NtRatioPoint[] =>
  nikkeiAsc.map((nikkei, i) => ({
    time: `2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, '0')}`,
    nikkei, benchmark: topix, ratio: nikkei / topix, change: null,
  }))

const ads = (ratio25: number): AdvanceDeclineWeekData[] =>
  [{ date: '2026/07/27', label: '7月第5週', ratio25 } as AdvanceDeclineWeekData]

const inv = (foreigners: number[]): InvestorWeekData[] =>
  foreigners.map((foreigner, i) => ({
    date: `2026/07/${17 - i * 7}`, label: `w${i}`,
    foreigner, individual: 0, trustBank: 0, securities: 0,
  }))

describe('ema / macdHistogram', () => {
  it('EMAは初項が種で、期間が長いほど鈍る', () => {
    const v = [1, 2, 3, 4, 5]
    expect(ema(v, 2)[0]).toBe(1)
    const fast = ema(v, 2)
    const slow = ema(v, 10)
    expect(fast[4]).toBeGreaterThan(slow[4]) // 上昇局面では短期のほうが価格に近い
  })

  it('データが足りなければ空配列', () => {
    expect(macdHistogram([1, 2, 3])).toEqual([])
  })

  it('一貫した上昇ではヒストグラムがプラスになる', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 2)
    const hist = macdHistogram(closes)
    expect(hist.length).toBe(60)
    expect(hist[hist.length - 1]).toBeGreaterThan(0)
  })
})

describe('detectTrend', () => {
  it('25日線乖離がマイナスなら下降局面', () => {
    const d = days(30, i => 100 + i, { ma25_dev: -5.65 })
    expect(detectTrend(d).trend).toBe('down')
    expect(detectTrend(d).note).toContain('-5.65')
  })

  it('25日線乖離がプラスなら上昇局面', () => {
    const d = days(30, i => 100 + i, { ma25_dev: 3.2 })
    expect(detectTrend(d).trend).toBe('up')
  })

  it('乖離が無ければ25営業日前との比較で代替する', () => {
    const down = days(30, i => 200 - i) // 古いほど高い＝下降
    expect(detectTrend(down).trend).toBe('down')
    const up = days(30, i => 100 + i)
    expect(detectTrend(up).trend).toBe('up')
  })
})

describe('buildReversalWatch — 下降局面（上昇転換を待つ）', () => {
  const daily = days(60, i => 200 - i, { ma25_dev: -5.65 })

  it('条件を満たさなければ点灯しない', () => {
    const w = buildReversalWatch(daily, margin(-225), ss([32.41, 32.88, 36.86, 38.13]), vixs([18.99, 18.5, 18.2]), inv([-2863, 4930]))

    expect(w.trend).toBe('down')
    expect(w.total).toBe(8)
    expect(w.items.find(i => i.key === 'margin')!.lit).toBe(false)      // -225億は基準未達
    expect(w.items.find(i => i.key === 'short_sell')!.lit).toBe(false)  // 40超をつけていない
    expect(w.items.find(i => i.key === 'vix')!.lit).toBe(false)         // 25超をつけていない
    expect(w.items.find(i => i.key === 'foreigner')!.lit).toBe(false)   // 2週連続の買い越しでない
  })

  it('整理・投げ・買い越しが揃うと点灯する', () => {
    const w = buildReversalWatch(
      daily,
      margin(-1500),                       // 週-1,500億の減少
      ss([34, 42, 38, 33]),                // 直近5週に42をつけてから34へ低下
      vixs([22, 28, 24, 19]),              // 28をつけてから22へ低下
      inv([3000, 1200]),                   // 2週連続の買い越し
    )

    expect(w.items.find(i => i.key === 'margin')!.lit).toBe(true)
    expect(w.items.find(i => i.key === 'short_sell')!.lit).toBe(true)
    expect(w.items.find(i => i.key === 'vix')!.lit).toBe(true)
    expect(w.items.find(i => i.key === 'foreigner')!.lit).toBe(true)
    expect(w.lit).toBeGreaterThanOrEqual(4)
  })

  it('安値を切り上げたら価格構造が点灯する', () => {
    // 直近5日だけ切り返して安値を切り上げる
    const asc = Array.from({ length: 60 }, (_, i) => (i < 55 ? 200 - i : 200 - 55 + (i - 54) * 3))
    const d = asc.map((c, i) => day(`2026-03-${String(i + 1).padStart(2, '0')}`, c)).reverse()
    const w = buildReversalWatch(d, margin(-225), ss([32]), vixs([19]), inv([-100]))

    expect(w.trend).toBe('down')
    expect(w.items.find(i => i.key === 'price')!.lit).toBe(true)
  })
})

describe('buildReversalWatch — 上昇局面（下降転換を待つ・条件が反転する）', () => {
  const daily = days(60, i => 100 + i, { ma25_dev: 4.2 })

  it('条件文と判定が逆になる', () => {
    const w = buildReversalWatch(daily, margin(+3500), ss([28]), vixs([13, 12.5, 12]), inv([-500, -900]))

    expect(w.trend).toBe('up')
    // 買い残は「増加」で点灯
    expect(w.items.find(i => i.key === 'margin')!.lit).toBe(true)
    expect(w.items.find(i => i.key === 'margin')!.criteria).toContain('増加')
    // 空売り比率は30割れで点灯
    expect(w.items.find(i => i.key === 'short_sell')!.lit).toBe(true)
    // 海外投資家は「売り越し」で点灯
    expect(w.items.find(i => i.key === 'foreigner')!.lit).toBe(true)
    expect(w.items.find(i => i.key === 'foreigner')!.criteria).toContain('売り越し')
    // 価格構造は「高値切り下げ」を見る
    expect(w.items.find(i => i.key === 'price')!.criteria).toContain('高値')
  })

  it('下降局面の条件では点灯しない値が、上昇局面では点灯しない（取り違えの検出）', () => {
    const w = buildReversalWatch(daily, margin(-1500), ss([42, 45]), vixs([28, 30]), inv([3000, 1200]))

    // 下降局面なら全部点灯する値だが、上昇局面では条件が違うので点灯しない
    expect(w.items.find(i => i.key === 'margin')!.lit).toBe(false)
    expect(w.items.find(i => i.key === 'short_sell')!.lit).toBe(false)
    expect(w.items.find(i => i.key === 'foreigner')!.lit).toBe(false)
  })
})

describe('buildReversalWatch — 欠損に強いこと', () => {
  it('データが空でも落ちず、点灯0で返る', () => {
    const w = buildReversalWatch([], [], [], [], [])

    expect(w.total).toBe(8)
    expect(w.lit).toBe(0)
    expect(w.asOf).toBeNull()
    expect(w.staleDays).toBeNull()
    expect(w.items.every(i => typeof i.value === 'string')).toBe(true)
  })
})

describe('日足データの鮮度', () => {
  // days() は 2026-01-01 から連番で作るので、最新は 2026-01-30
  const daily = days(30, i => 200 - i, { ma25_dev: -5.65 })

  it('基準日からの経過日数を返す', () => {
    const w = buildReversalWatch(daily, [], [], [], [], [], [], new Date('2026-02-05T09:00:00Z'))

    expect(w.asOf).toBe('2026-01-30')
    expect(w.staleDays).toBe(6)
  })

  it('当日ぶんが入っていれば0日', () => {
    const w = buildReversalWatch(daily, [], [], [], [], [], [], new Date('2026-01-30T15:00:00Z'))

    expect(w.staleDays).toBe(0)
  })
})

// ── 実データで見つかった取り違えの再発防止 ──
describe('データの並び順と単位', () => {
  const daily = days(60, i => 200 - i, { ma25_dev: -5.65 })

  it('VIXは古い順で来るので末尾を最新として扱う', () => {
    // 新しい順で [19, 28, 24] ＝ 直近は19、20日以内に28をつけている
    const w = buildReversalWatch(daily, margin(-225), ss([32]), vixs([19, 28, 24]), inv([-100]))
    const vix = w.items.find(i => i.key === 'vix')!

    expect(vix.value).toContain('19.00')   // 先頭（古い方）の24ではない
    expect(vix.lit).toBe(true)             // 28をつけてから低下＝点灯
  })

  it('海外投資家は億円単位のまま表示する（1/100にしない）', () => {
    const w = buildReversalWatch(daily, margin(-225), ss([32]), vixs([19]), inv([-2863, 4930]))
    const f = w.items.find(i => i.key === 'foreigner')!

    expect(f.value).toContain('-2,863億')
    expect(f.value).not.toContain('-29億')
  })

  it('MACDは日経終値の長期系列（NT倍率データ）から計算する', () => {
    // 日足は10本しか無くてもよい。MACDは nt 側の60本から計算される
    const shortDaily = days(10, i => 200 - i, { ma25_dev: -5.65 })
    const ntAsc = nts(Array.from({ length: 60 }, (_, i) => 70000 - i * 100))

    const w = buildReversalWatch(shortDaily, margin(-225), ss([32]), vixs([19]), inv([-100]), ntAsc)
    const mom = w.items.find(i => i.key === 'momentum')!

    expect(mom.value).toContain('MACDヒスト')
    expect(mom.value).not.toContain('データ不足')
  })
})

describe('NT倍率と騰落レシオ', () => {
  const daily = days(60, i => 200 - i, { ma25_dev: -5.65 })

  it('下降局面ではNT倍率の5日平均が上向きに転じたら点灯', () => {
    // 前半は下降（NT低下）、直近5日で反転させる
    const falling = nts([...Array.from({ length: 20 }, (_, i) => 68000 - i * 200), ...Array.from({ length: 5 }, (_, i) => 64200 + i * 300)])
    const w = buildReversalWatch(daily, margin(-225), ss([32]), vixs([19]), inv([-100]), falling)
    expect(w.items.find(i => i.key === 'nt')!.lit).toBe(true)

    const stillFalling = nts(Array.from({ length: 25 }, (_, i) => 68000 - i * 200))
    const w2 = buildReversalWatch(daily, margin(-225), ss([32]), vixs([19]), inv([-100]), stillFalling)
    expect(w2.items.find(i => i.key === 'nt')!.lit).toBe(false)
  })

  it('騰落レシオは下降局面で70以下・上昇局面で120以上に点灯する', () => {
    const down = buildReversalWatch(daily, [], [], [], [], [], ads(68))
    expect(down.items.find(i => i.key === 'advance_decline')!.lit).toBe(true)

    const notYet = buildReversalWatch(daily, [], [], [], [], [], ads(123.49))
    expect(notYet.items.find(i => i.key === 'advance_decline')!.lit).toBe(false)

    const upTrend = days(60, i => 100 + i, { ma25_dev: 4.2 })
    const up = buildReversalWatch(upTrend, [], [], [], [], [], ads(123.49))
    expect(up.items.find(i => i.key === 'advance_decline')!.lit).toBe(true)
  })
})
