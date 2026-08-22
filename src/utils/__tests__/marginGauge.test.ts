import { describe, it, expect } from 'vitest'
import { marginGauge, heaviness, type MarginWeek } from '../marginGauge'

/**
 * 需給ゲージ（信用残から「重い／軽い」を出す）。
 *
 * 🔴 いちばん大事なのは「信用倍率だけで決めない」こと。倍率が高くても、商いが厚ければ流せる。
 *    実データ（2026-08-07）＝ファナックは倍率19.8倍だが買残は平常の商いの0.56日分しかない。
 */
describe('marginGauge', () => {
  const week = (w: string, long: number, longChg: number, short = 200000): MarginWeek =>
    ({ w, long, longChg, short, shortChg: 0 })

  it('倍率が高くても商いが厚ければ「詰まっている」とは言わない', () => {
    // ファナックの実データ：買残430万株・売残21.7万株（19.8倍）・平常の出来高765万株
    const g = marginGauge([week('2026-08-07', 4_301_100, 724_000, 217_400)], 7_640_400)!

    expect(g.ratio).toBe(19.8)
    expect(g.days).toBeCloseTo(0.56, 2)
    expect(g.level).not.toBe('very_heavy')       // 倍率だけなら「かなり重い」になってしまう
  })

  it('商いが薄くて買残が積み上がっていれば「かなり重い」', () => {
    const g = marginGauge([week('2026-08-07', 3_000_000, 100_000, 150_000)], 800_000)!

    expect(g.days).toBeCloseTo(3.75, 2)
    expect(g.level).toBe('very_heavy')
    expect(g.label).toBe('かなり重い')
  })

  it('買残が減っていれば「軽くなってきた」', () => {
    const g = marginGauge([week('2026-07-31', 3_577_100, -354_500)], 5_000_000)!

    expect(g.chgPct).toBeCloseTo(-9.0, 1)
    expect(g.trend).toBe('lighter')
    expect(g.trendLabel).toBe('軽くなってきた')
  })

  it('買残が増えていれば「重くなってきた」', () => {
    const g = marginGauge([week('2026-08-07', 4_301_100, 724_000)], 5_000_000)!

    expect(g.chgPct).toBeCloseTo(20.2, 1)
    expect(g.trend).toBe('heavier')
  })

  it('4週前と比べた増減も出す（1週だけだと週替わりでぶれるため）', () => {
    const history: MarginWeek[] = [
      week('2026-07-10', 3_890_400, 149_600),
      week('2026-07-17', 3_984_000, 93_600),
      week('2026-07-24', 3_931_600, -52_400),
      week('2026-07-31', 3_577_100, -354_500),
      week('2026-08-07', 4_301_100, 724_000),
    ]
    const g = marginGauge(history, 7_640_400)!

    expect(g.chg4wPct).toBeCloseTo(10.6, 1)
    expect(g.note).toContain('2026-08-07 時点')
  })

  it('出来高が分からない銘柄は倍率だけで決める（推測で補わない）', () => {
    const g = marginGauge([week('2026-08-07', 1_000_000, 0, 100_000)], null)!

    expect(g.days).toBeNull()
    expect(g.score).toBe(heaviness(10, null))
  })

  it('売残が0なら倍率は出さない（0で割らない）', () => {
    const g = marginGauge([week('2026-08-07', 1_000_000, 0, 0)], 1_000_000)!

    expect(g.ratio).toBeNull()
    expect(g.days).toBe(1)
  })

  /**
   * 🔴 2026-08-17 ユーザー指摘：「ハーモニックとアドバンテストは株価が上がっている」。
   *    軽い＝上がりやすい、で矛盾はしないが、**なぜ軽いのか**を言えていなかった。
   *    この2銘柄は上昇の最中に売り方が大量に残っている＝踏み上げの燃料がある側。
   */
  it('売り方が残っている「軽さ」は踏み上げ余地として区別する', () => {
    // ハーモニックの実データ：買残678,000／売残508,400（1.3倍）・平常の商い1,650,000株
    const harmonic = marginGauge([week('2026-08-07', 678_000, -74_500, 508_400)], 1_650_000)!
    expect(harmonic.level).toBe('light')
    expect(harmonic.squeeze).toBe('strong')
    expect(harmonic.squeezeLabel).toContain('踏み上げ')

    // フジクラの実データ：買残23,466,400／売残1,423,600（16.5倍）・平常の商い47,900,000株
    // 🔴 同じく株価は強いが、こちらは買い方一辺倒＝踏み上げ余地ではない
    const fujikura = marginGauge([week('2026-08-07', 23_466_400, -950_000, 1_423_600)], 47_900_000)!
    expect(fujikura.squeeze).toBe('none')
    expect(fujikura.shortDays).toBeCloseTo(0.03, 2)
  })

  it('履歴が無ければ null（データが無いのに「ふつう」と言わない）', () => {
    expect(marginGauge([], 1000)).toBeNull()
    expect(marginGauge(null, 1000)).toBeNull()
  })

  /**
   * 🔴 2026-08-22 運用者の指摘＝画面に「14 軽い ▸ 重くなってきた（踏み上げ余地）」と
   *    判定が3つ並び、軽いのか重いのか読めなかった。1行で言い切る `summary` を足した。
   *    専門語（軽い／重い／踏み上げ）を使わず、**買残＝これから出てくる売り物**で書く。
   */
  describe('1行の要約', () => {
    it('専門語を使わない', () => {
      const g = marginGauge([week('2026-08-07', 3_000_000, 100_000, 150_000)], 800_000)!
      expect(g.summary).not.toMatch(/軽い|重い|踏み上げ|信用倍率/)
      expect(g.summary).toContain('売り物')
    })

    it('積み上がっていれば「多い」側で言う', () => {
      const g = marginGauge([week('2026-08-07', 3_000_000, 100_000, 150_000)], 800_000)!
      expect(g.summary).toContain('かなり多い')
    })

    // 🔵 向きは事実だけ（良し悪しを付けない）。買残の積み上がりが弱気材料かは指数では否定済み
    it('向きは「増加／減少」で書き、良し悪しを付けない', () => {
      const up = marginGauge([
        week('2026-07-10', 1_000_000, 0), week('2026-07-17', 1_000_000, 0),
        week('2026-07-24', 1_000_000, 0), week('2026-07-31', 1_000_000, 0),
        week('2026-08-07', 1_400_000, 400_000),
      ], 5_000_000)!
      expect(up.summary).toContain('増加')
      expect(up.summary).not.toMatch(/良|悪|危険|買い時|売り時/)
    })
  })

  /**
   * 🔴 2026-08-22 運用者の指摘＝**倍率だけでは銘柄を比べられない**。
   *    ファナック（倍率20.8倍・差引284億円）とハーモニック（倍率1.6倍・差引17億円）は、
   *    倍率で見ると印象が逆になる。差引の買い越しと、その推移を出せることを固定する。
   */
  describe('差引の買い越しと推移', () => {
    const hist = [
      week('2026-07-31', 900_000, 0, 400_000),
      week('2026-08-07', 800_000, -100_000, 500_000),
      week('2026-08-14', 824_700, 24_700, 523_000),
    ]

    it('差引（買残−売残）と、平常の商いの何日分かを出す', () => {
      const g = marginGauge(hist, 1_660_300)!
      expect(g.netShares).toBe(824_700 - 523_000)
      expect(g.netDays).toBeCloseTo(0.18, 2)
    })

    it('株価を渡すと金額（億円）も出す', () => {
      const g = marginGauge(hist, 1_660_300, 5700)!
      expect(g.netOku).toBeCloseTo(17.2, 1)
      expect(g.longOku).toBeCloseTo(47.0, 1)
      expect(g.note).toContain('これから出てくる売り物')
    })

    it('株価が無ければ金額は出さない（推測で埋めない）', () => {
      const g = marginGauge(hist, 1_660_300)!
      expect(g.netOku).toBeNull()
    })

    it('週ごとの推移を古い順で返す', () => {
      const g = marginGauge(hist, 1_660_300, 5700)!
      expect(g.series.map(x => x.w)).toEqual(['2026-07-31', '2026-08-07', '2026-08-14'])
      expect(g.series[0].net).toBe(500_000)
    })
  })
})
