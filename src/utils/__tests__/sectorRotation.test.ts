import { describe, it, expect } from 'vitest'
// 🔵 実データは Vite の ?raw で文字列として読む（node:fs は app の型構成に無い）。
//    既存の freshness-threshold.test.ts と同じやり方。
import perfRaw   from '../../../public/data/sector_perf.json?raw'
import masterRaw from '../../../public/data/stock_master.json?raw'
import {
  PHASES, SECTOR17,
  phaseAt, nextPhase, phaseOfSector17, phaseMidAngle, sector17Label,
  phaseStrengths, strongestPhase, phaseFits, bestFit, sectorRanking, searchStocks,
  RATE_SENSITIVITY, RATE_MOVE_THRESHOLD, rateAlignments,
  macroPhase, MACRO_RATE_THRESHOLD, MACRO_INFL_THRESHOLD,
  type MacroInfo, type SectorPerfRow, type StockRow,
} from '../sectorRotation'
import { buildStockAnalysisPrompt, summarizeMarketMargin } from '../sectorStockPrompt'
import type { MarginWeekData } from '../jpxMarginData'

/**
 * セクター画面の純粋関数。
 *
 * 🔴 ここで固定したいのは
 *    ①「円環の角度と局面の対応」②「17業種が過不足なく4局面に割り振られていること」
 *    ③「検索の当たり方と件数の打ち切り」④「プロンプトが断定と推奨を書かせないこと」。
 *    実データを繋いだあとも壊れてはいけない部分だけを見る。
 */
describe('セクターローテーションの円環', () => {
  it('4局面が金融→業績→逆金融→逆業績の順で並ぶ', () => {
    // 🔵 順番は景気循環の見立てそのもの。入れ替えると円環の意味が変わる
    expect(PHASES.map(p => p.id)).toEqual([
      'financial', 'performance', 'reverseFinancial', 'reversePerformance',
    ])
    expect(PHASES.map(p => p.angle)).toEqual([0, 90, 180, 270])
  })

  it('角度から局面が引ける（真上が金融相場・時計回り）', () => {
    expect(phaseAt(0).id).toBe('financial')
    expect(phaseAt(89).id).toBe('financial')
    expect(phaseAt(90).id).toBe('performance')     // 境界は次の局面に入る
    expect(phaseAt(180).id).toBe('reverseFinancial')
    expect(phaseAt(270).id).toBe('reversePerformance')
  })

  it('1周しても同じ局面に戻る（負の角度も扱える）', () => {
    expect(phaseAt(360).id).toBe('financial')
    expect(phaseAt(-90).id).toBe('reversePerformance')
  })

  it('次の局面は時計回りで、最後は先頭へ戻る', () => {
    expect(nextPhase('financial').id).toBe('performance')
    expect(nextPhase('reversePerformance').id).toBe('financial')
  })

  it('局面の中央角度はその局面の中に入る', () => {
    for (const p of PHASES) expect(phaseAt(phaseMidAngle(p.id)).id).toBe(p.id)
  })
})

describe('17業種と局面の割り当て', () => {
  it('TOPIX-17 は 1〜17 が過不足なく揃っている', () => {
    expect(SECTOR17.map(s => s.code)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1))
  })

  it('🔴 17業種すべてがちょうど1つの局面に属する（重複も取りこぼしもない）', () => {
    // 取りこぼすと、その業種の銘柄を検索したときに行き場が無くなる
    const all = PHASES.flatMap(p => [...p.sectors17])
    expect(all.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1))
    expect(new Set(all).size).toBe(17)
  })

  it('業種コードから局面が引ける', () => {
    expect(phaseOfSector17(15)!.id).toBe('reverseFinancial')  // 銀行
    expect(phaseOfSector17(9)!.id).toBe('financial')          // 電機・精密
    expect(phaseOfSector17(999)).toBeNull()
  })

  it('業種名が引ける（未知のコードでも落ちない）', () => {
    expect(sector17Label(15)).toBe('銀行')
    expect(sector17Label(99)).toBe('業種99')
  })
})

// ── 実測（業種別ETF）の集計 ────────────────────────────
function perfRow(sector17: number, chg3m: number | null): SectorPerfRow {
  return {
    sector17, label: sector17Label(sector17), etf: String(1617 + sector17 - 1),
    time: '2026-08-07', close: 10000,
    chg1m: null, chg3m, chg6m: null,
    rank1m: null, rank3m: null, rank6m: null,
  }
}

describe('局面グループの実測平均', () => {
  it('属する業種の単純平均を出し、強い順に順位を振る', () => {
    const rows = [
      perfRow(15, 20), perfRow(2, 10), perfRow(13, 0),   // 逆金融 → 平均10
      perfRow(9, 4), perfRow(10, 2), perfRow(16, 0), perfRow(17, -2), // 金融 → 平均1
    ]
    const st = phaseStrengths(rows, 'chg3m')
    const rev = st.find(s => s.phase.id === 'reverseFinancial')!
    const fin = st.find(s => s.phase.id === 'financial')!
    expect(rev.avg).toBe(10)
    expect(fin.avg).toBe(1)
    expect(rev.rank).toBe(1)
    expect(fin.rank).toBe(2)
    expect(strongestPhase(st)!.phase.id).toBe('reverseFinancial')
  })

  it('メンバーは強い順に並ぶ', () => {
    const st = phaseStrengths([perfRow(2, -5), perfRow(15, 8), perfRow(13, 1)], 'chg3m')
    const rev = st.find(s => s.phase.id === 'reverseFinancial')!
    expect(rev.members.map(m => m.sector17)).toEqual([15, 13, 2])
  })

  it('データが無い局面は avg も rank も null（0%扱いにしない）', () => {
    // 🔴 欠損を0にすると「平均0%のグループ」として順位に混ざり、実測を歪める
    const st = phaseStrengths([perfRow(15, 5)], 'chg3m')
    const perf2 = st.find(s => s.phase.id === 'performance')!
    expect(perf2.avg).toBeNull()
    expect(perf2.rank).toBeNull()
    expect(strongestPhase(st)!.phase.id).toBe('reverseFinancial')
  })

  it('騰落率が null の業種は平均から除く', () => {
    const st = phaseStrengths([perfRow(15, 10), perfRow(2, null), perfRow(13, 20)], 'chg3m')
    expect(st.find(s => s.phase.id === 'reverseFinancial')!.avg).toBe(15)
  })

  it('全部 null なら最強グループも無い', () => {
    expect(strongestPhase(phaseStrengths([], 'chg3m'))).toBeNull()
  })
})

describe('局面の「型」との一致度', () => {
  /** 17業種すべてに騰落率を与える（rankIn の順に強い） */
  function allRows(order: number[]): SectorPerfRow[] {
    return order.map((code, i) => perfRow(code, 100 - i))
  }
  const ALL = Array.from({ length: 17 }, (_, i) => i + 1)

  it('その局面の業種が上位を独占すると100点、下位を独占すると0点', () => {
    const rev = PHASES.find(p => p.id === 'reverseFinancial')!  // 3業種
    const others = ALL.filter(c => !rev.sectors17.includes(c))

    const best = phaseFits(allRows([...rev.sectors17, ...others]), 'chg3m')
    expect(best.find(f => f.phase.id === 'reverseFinancial')!.score).toBe(100)

    const worst = phaseFits(allRows([...others, ...rev.sectors17]), 'chg3m')
    expect(worst.find(f => f.phase.id === 'reverseFinancial')!.score).toBe(0)
  })

  it('業種数が違っても点数は比べられる（3業種と6業種で同じ満点）', () => {
    // 🔴 正規化していないと、業種数の多い局面ほど不利になって比較にならない
    const rev = PHASES.find(p => p.id === 'reverseFinancial')!    // 3業種
    const per = PHASES.find(p => p.id === 'performance')!         // 6業種
    const fitsRev = phaseFits(allRows([...rev.sectors17, ...ALL.filter(c => !rev.sectors17.includes(c))]), 'chg3m')
    const fitsPer = phaseFits(allRows([...per.sectors17, ...ALL.filter(c => !per.sectors17.includes(c))]), 'chg3m')
    expect(fitsRev.find(f => f.phase.id === 'reverseFinancial')!.score).toBe(100)
    expect(fitsPer.find(f => f.phase.id === 'performance')!.score).toBe(100)
  })

  it('上位1/3は支持・下位1/3は矛盾に分類される', () => {
    // 逆金融＝銀行(15)/エネ(2)/商社(13)。銀行だけ1位、他2つを最下位付近に置く
    const order = [15, ...ALL.filter(c => c !== 15 && c !== 2 && c !== 13), 13, 2]
    const fit = phaseFits(allRows(order), 'chg3m').find(f => f.phase.id === 'reverseFinancial')!
    const roleOf = (code: number) => fit.members.find(m => m.row.sector17 === code)!.role
    expect(roleOf(15)).toBe('support')
    expect(roleOf(13)).toBe('contradict')
    expect(roleOf(2)).toBe('contradict')
  })

  it('4局面すべてに点が付き、いちばん高いものが取れる', () => {
    const fits = phaseFits(allRows(ALL), 'chg3m')
    expect(fits).toHaveLength(4)
    for (const f of fits) expect(f.score).not.toBeNull()
    expect(bestFit(fits)!.score).toBe(Math.max(...fits.map(f => f.score!)))
  })

  it('🔴 突出した1業種にグループ全体を持っていかれない（順位で見るため）', () => {
    // 銀行だけ +999%、逆金融の他2業種は最下位 → 平均騰落率なら1位だが、一致度は高くならない
    const rows: SectorPerfRow[] = [
      perfRow(15, 999), perfRow(2, -50), perfRow(13, -49),
      ...ALL.filter(c => ![15, 2, 13].includes(c)).map((c, i) => perfRow(c, 10 - i)),
    ]
    const byAvg = phaseStrengths(rows, 'chg3m').find(s => s.phase.id === 'reverseFinancial')!
    const byFit = phaseFits(rows, 'chg3m').find(f => f.phase.id === 'reverseFinancial')!
    expect(byAvg.rank).toBe(1)              // 平均だと1位に見えてしまう
    expect(byFit.score!).toBeLessThan(50)   // 一致度はそうならない
  })

  it('データが足りないときは点を出さない（0点にしない）', () => {
    // 🔴 0点にすると「型に全く合わない」と読めてしまい、欠測と区別が付かない
    const fits = phaseFits([perfRow(15, 10), perfRow(2, 5)], 'chg3m')
    for (const f of fits) expect(f.score).toBeNull()
    expect(bestFit(fits)).toBeNull()
  })

  it('点数は0〜100に収まる', () => {
    for (const key of ['chg1m', 'chg3m', 'chg6m'] as const) {
      for (const f of phaseFits(allRows(ALL), key)) {
        if (f.score == null) continue
        expect(f.score).toBeGreaterThanOrEqual(0)
        expect(f.score).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('いま強い業種の並び', () => {
  /** 直近1か月と、その前の2か月（重ならない区間）を指定して1行作る */
  function row(sector17: number, m1: number | null, prev2: number | null): SectorPerfRow {
    // 🔵 chg3m には**あえて逆向きの値**を入れておく。
    //    判定が誤って3か月を見ていたら落ちるようにするため。
    return { ...perfRow(sector17, 999), chg1m: m1, chgPrev2m: prev2 }
  }

  it('直近1か月の強い順に並ぶ', () => {
    const r = sectorRanking([row(1, 3, 0), row(15, 9, 0), row(8, -2, 0)])
    expect(r.map(x => x.row.sector17)).toEqual([15, 1, 8])
    expect(r.map(x => x.rank)).toEqual([1, 2, 3])
  })

  it('所属する局面が付く', () => {
    expect(sectorRanking([row(15, 1, 1)])[0].phase!.id).toBe('reverseFinancial')
  })

  it('🔴 直近1か月プラス×その前2か月マイナスに「反発」の印を付ける', () => {
    // 「その前は下げていたのに直近で動き出した」＝変化が起きた業種を拾うための印
    // （実例 2026-08-07: 鉄鋼・非鉄 直近1か月 +6.0% / その前2か月 -23.7%）
    const r = sectorRanking([
      row(7, 6, -23),   // 反発
      row(15, 5, 18),   // ずっと強い
      row(3, -2, -10),  // 直近もマイナス → 反発ではない
    ])
    const by = (code: number) => r.find(x => x.row.sector17 === code)!
    expect(by(7).rebound).toBe(true)
    expect(by(15).rebound).toBe(false)
    expect(by(3).rebound).toBe(false)
  })

  it('🔴 判定に3か月（直近を含む重なった窓）を使わない', () => {
    // 3か月は直近1か月を含むので、窓の中で主役が交代していると古い局面と混ざる。
    // ここでは chgPrev2m がマイナスなのに chg3m がプラス＝反発が前の下げを上回った形。
    // 3か月で判定していると取りこぼす。
    const r = sectorRanking([{ ...perfRow(7, 2.6), chg1m: 8, chgPrev2m: -5 }])
    expect(r[0].rebound).toBe(true)
  })

  it('その前の2か月が取れないものは印を付けない（欠測を判定に使わない）', () => {
    expect(sectorRanking([row(7, 6, null)])[0].rebound).toBe(false)
  })

  it('1か月が取れない業種は並びから外す', () => {
    expect(sectorRanking([row(7, null, 5), row(15, 1, 1)]).map(x => x.row.sector17)).toEqual([15])
  })
})

// ── 銘柄検索 ───────────────────────────────────────────
const STOCKS: StockRow[] = [
  { code: '6758', name: 'ソニーグループ', sector33: '電気機器', sector17: 9 },
  { code: '6752', name: 'パナソニックHD', sector33: '電気機器', sector17: 9 },
  { code: '8306', name: '三菱UFJ',        sector33: '銀行業',   sector17: 15 },
  { code: '8316', name: '三井住友',       sector33: '銀行業',   sector17: 15 },
  { code: '2802', name: '味の素',         sector33: '食料品',   sector17: 1 },
]

describe('銘柄検索', () => {
  it('空文字では何も返さない（全件を出さない）', () => {
    expect(searchStocks('', STOCKS).hits).toEqual([])
    expect(searchStocks('   ', STOCKS).hits).toEqual([])
  })

  it('数字は前方一致（コードの途中まで打って絞れる）', () => {
    const r = searchStocks('675', STOCKS)
    expect(r.hits.map(s => s.code)).toEqual(['6758', '6752'])
    // 🔴 部分一致にすると「67」が含まれる無関係な銘柄まで出る
    expect(searchStocks('6758', STOCKS).hits.map(s => s.code)).toEqual(['6758'])
  })

  it('銘柄名は部分一致', () => {
    expect(searchStocks('ソニー', STOCKS).hits.map(s => s.code)).toEqual(['6758'])
  })

  it('33業種名でも17業種名でも引ける', () => {
    expect(searchStocks('銀行業', STOCKS).hits.map(s => s.code)).toEqual(['8306', '8316'])
    expect(searchStocks('食品', STOCKS).hits.map(s => s.code)).toEqual(['2802'])  // 17業種名
  })

  it('🔴 「銀行」で銀行株が先に出る（「金融（除く銀行）」に埋もれない）', () => {
    // 単純な部分一致だと 17業種名「金融（除く銀行）」が何百件も先に出て、
    // 銀行株にたどり着けなくなる（2026-08-07 に実際に起きた）
    const withSecurities: StockRow[] = [
      { code: '8601', name: '大和証券G',  sector33: '証券、商品先物取引業', sector17: 16 },
      { code: '8604', name: '野村HD',     sector33: '証券、商品先物取引業', sector17: 16 },
      ...STOCKS,
    ]
    const hits = searchStocks('銀行', withSecurities).hits
    expect(hits.slice(0, 2).map(s => s.code)).toEqual(['8306', '8316'])
    // 「金融（除く銀行）」側も落とさずに、後ろへ回す
    expect(hits.map(s => s.code)).toContain('8601')
  })

  it('銘柄名の前方一致は部分一致より前に出る', () => {
    const rows: StockRow[] = [
      { code: '1111', name: '日本テスト', sector33: 'その他', sector17: 10 },
      { code: '2222', name: 'テスト工業', sector33: 'その他', sector17: 10 },
    ]
    expect(searchStocks('テスト', rows).hits.map(s => s.code)).toEqual(['2222', '1111'])
  })

  it('🔴 件数を打ち切り、総ヒット数は別に返す', () => {
    // 打ち切らないと「銀」1文字で数百件描画して画面が固まる
    const many: StockRow[] = Array.from({ length: 100 }, (_, i) => ({
      code: `1${String(i).padStart(3, '0')}`, name: `テスト${i}`, sector33: '銀行業', sector17: 15,
    }))
    const r = searchStocks('銀行業', many, 40)
    expect(r.hits.length).toBe(40)
    expect(r.total).toBe(100)
  })

  it('見つからないときは空', () => {
    expect(searchStocks('存在しない銘柄', STOCKS).hits).toEqual([])
  })
})

// ── AI分析プロンプト（★2026-08-08 需給分析に用途変更）──────────
describe('銘柄のAI分析プロンプト', () => {
  const stock = STOCKS[2]  // 8306 三菱UFJ（銀行）
  const rows  = [perfRow(15, 20), perfRow(2, 10), perfRow(13, 0), perfRow(9, 1)]
  const st    = phaseStrengths(rows, 'chg3m')
  const margin: MarginWeekData[] = [
    { date: '2026/07/31', label: '7月第5週', longBal: 6202268, shortBal: 728711, ratio: 8.51, evalRatio: -8.44 },
    { date: '2026/07/24', label: '7月第4週', longBal: 6476938, shortBal: 725262, ratio: 8.93, evalRatio: -9.0 },
    { date: '2026/06/26', label: '6月第4週', longBal: 7016733, shortBal: 1053736, ratio: 6.66, evalRatio: -7.0 },
  ]
  const p = buildStockAnalysisPrompt(stock, rows, st, 'chg3m', '2026-08-07 20:00', summarizeMarketMargin(margin))

  it('銘柄の基本情報と業種が入る', () => {
    expect(p).toContain('8306')
    expect(p).toContain('三菱UFJ')
    expect(p).toContain('銀行業')   // 33業種
    expect(p).toContain('銀行')     // 17業種
  })

  it('🔴 需給の分析であることが分かる（会社の基礎情報ではない）', () => {
    expect(p).toContain('需給分析')
    expect(p).toContain('信用倍率')
    // 会社概要・業績・PERは他で見るので要らない、と明示している
    expect(p).toContain('基礎情報は**不要です**')
  })

  it('🔴 個別の信用残の出典URLを明示する（数字を記憶から書かせない）', () => {
    expect(p).toContain('nikkei.com/nkd/company/history/trust/?scode=8306')
    expect(p).toContain('推測で埋めないでください')
  })

  it('🔴 市場全体の信用需給を検証済みデータとして渡す', () => {
    expect(p).toContain('8.51倍')          // 直近の信用倍率
    expect(p).toContain('解消率')           // ピークからの解消率
    expect(p).toContain('ぽいロボの実測データ')
  })

  it('🔴 出来高との関係を出させる（商いがないと解消されない）', () => {
    expect(p).toContain('商いがないと解消されません')
    expect(p).toContain('平均出来高の何日分')
  })

  it('推移と解消率を%で求める', () => {
    expect(p).toContain('変化を%で')
    expect(p).toContain('いま何%解消されたか')
  })

  it('需給の状態を3択で総括させる', () => {
    expect(p).toContain('重しが消えつつある')
    expect(p).toContain('まだ重い')
    expect(p).toContain('どちらとも言えない')
  })

  it('🔴 総括の決め方を手順で縛る（基準を外れたら「まだ重い」）', () => {
    // 🔴 実例（LIFULL 2026-08-08）＝解消日数6.7日分で5日基準を超えているのに
    //    「5日基準を上回るものの…消えつつある」と結論した。基準を書くだけでは足りず、
    //    手順と例外条件まで明示しないと踏み越える。
    expect(p).toContain('総括の決め方')
    expect(p).toContain('直近3か月で買残が20%以上減っている')
    expect(p).toContain('直近が止まっていれば重い')
    expect(p).toContain('基準を満たさないのに「消えつつある」と書かないでください')
  })

  it('🔴 総括は「厚み」で判定させ、信用倍率だけで結論させない', () => {
    // 🔴 実例（グリムス 2026-08-08）＝倍率20.15倍だけを見て「まだ重い」と誤判定した。
    //    実際は買残82,600株＝1.78日分・2億円で、解消率44%と市場(11.6%)より速かった。
    expect(p).toContain('倍率ではありません')
    expect(p).toContain('5日分未満なら「重い」と判定しない')
    expect(p).toContain('倍率が高い ＝ 重い、と書かないでください')
    expect(p).toContain('信用買残の金額')
  })

  it('🔴 売買の推奨を書かせない（アプリ全体の方針）', () => {
    expect(p).toContain('売買の推奨・目標株価')
    expect(p).toContain('書かないでください')
    // 総括を出させるが、あくまで需給の状態記述にとどめさせる
    expect(p).toContain('売買の判断ではありません')
  })

  it('🔴 局面の判定をしていないことを伝え、断定を禁じる', () => {
    expect(p).toContain('景気局面の判定を行っていません')
    expect(p).toContain('断定しないでください')
  })

  it('🔴 実測がETFによる代用値であることを伝える', () => {
    expect(p).toContain('代用')
  })

  it('市場の信用データが無くてもプロンプトは作れる', () => {
    const q = buildStockAnalysisPrompt(stock, rows, st, 'chg3m', '2026-08-07 20:00', null)
    expect(q).toContain('8306')
    expect(q).toContain('データを取得できませんでした')
  })
})

describe('市場全体の信用需給の要約', () => {
  const rows: MarginWeekData[] = [
    { date: '2026/07/31', label: 'w1', longBal: 800, shortBal: 100, ratio: 8.0, evalRatio: null },
    { date: '2026/07/24', label: 'w2', longBal: 1000, shortBal: 200, ratio: 5.0, evalRatio: null },
    { date: '2026/07/17', label: 'w3', longBal: 900, shortBal: 300, ratio: 3.0, evalRatio: null },
  ]

  it('ピークからの解消率を出す', () => {
    const s = summarizeMarketMargin(rows)!
    expect(s.peakLong).toBe(1000)
    expect(s.peakDate).toBe('2026/07/24')
    // 1000 → 800 なので 20% 解消
    expect(s.clearedPct).toBe(20)
  })

  it('信用倍率の52週内の位置を出す（100に近いほど買い残が厚い）', () => {
    const s = summarizeMarketMargin(rows)!
    expect(s.ratio).toBe(8.0)
    expect(s.ratioLow).toBe(3.0)
    expect(s.ratioHigh).toBe(8.0)
    expect(s.ratioPct).toBe(67)   // 3件中2件が自分より下
  })

  it('空なら null（呼び出し側で分岐できる）', () => {
    expect(summarizeMarketMargin([])).toBeNull()
  })
})

// ── 実データファイルの形（取得スクリプトとの契約）───────────
describe('public/data の実ファイル', () => {
  it('sector_perf.json は17業種そろい、局面の割り当てと噛み合う', () => {
    const rows: SectorPerfRow[] = JSON.parse(perfRaw).data
    expect(rows.length).toBe(17)
    // 🔴 ETFコードと17業種コードは 1617 + (n-1) の対応。ズレると全業種の色が入れ替わる
    for (const r of rows) {
      expect(Number(r.etf)).toBe(1617 + r.sector17 - 1)
      expect(r.label).toBe(sector17Label(r.sector17))
      expect(phaseOfSector17(r.sector17)).not.toBeNull()
    }
    // 4局面すべてに実測が付く
    for (const s of phaseStrengths(rows, 'chg3m')) expect(s.avg).not.toBeNull()
    // 🔴 「その前の2か月」（重ならない区間）が全業種に入っている＝反発の判定に必要
    for (const r of rows) expect(r.chgPrev2m).not.toBeUndefined()
  })

  it('🔴 periods の prev2m が「直近1か月の手前」で、重なっていない', () => {
    const json = JSON.parse(perfRaw)
    const p1 = json.periods?.chg1m
    const pv = json.periods?.prev2m
    expect(p1).toBeTruthy()
    expect(pv).toBeTruthy()
    // 前区間の終わり＝直近1か月の始まり（重複ゼロ）
    expect(pv.to).toBe(p1.from)
  })

  it('🔴 金利感応度は17業種すべてに実測値があり、-1〜+1 に収まる', () => {
    // 🔵 これは理論の当てはめではなく実測の相関係数。欠けると突き合わせが片肺になる
    for (const s of SECTOR17) {
      const v = RATE_SENSITIVITY[s.code]
      expect(v, `${s.label} の感応度が無い`).toBeTypeOf('number')
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
    }
    // 実測どおり、金利に最も強く反応するのは銀行（コード15）
    const top = SECTOR17.map(s => s.code).sort((a, b) => RATE_SENSITIVITY[b] - RATE_SENSITIVITY[a])[0]
    expect(top).toBe(15)
  })

  const mkMacro = (chg3m: number | null): MacroInfo =>
    ({ symbol: 'x', label: 'x', time: '2026-08-07', last: 1, chg3m, from: null, to: null })

  it('🔴 アンカー（金利とインフレが同方向）は直接判定される', () => {
    // 実測で業種の裏づけが取れたのはこの2つだけ。ここは背理法を挟まない
    const fin = macroPhase(mkMacro(-1), mkMacro(-1))!
    const rev = macroPhase(mkMacro(+1), mkMacro(+1))!
    expect(fin.id).toBe('financial')
    expect(rev.id).toBe('reverseFinancial')
    expect(fin.derived).toBe(false)
    expect(rev.derived).toBe(false)
    // アンカーは直前のアンカーに左右されない
    expect(macroPhase(mkMacro(+1), mkMacro(+1), 'financial')!.id).toBe('reverseFinancial')
  })

  it('🔴 移行期は直前のアンカーと循環の順序から割り出す（背理法）', () => {
    // 🔵 ユーザーの言う「逆金融相場ではない ＝ 逆業績相場」がこれ
    const afterRev = macroPhase(mkMacro(+1), mkMacro(-1), 'reverseFinancial')!
    expect(afterRev.id).toBe('reversePerformance')
    expect(afterRev.derived).toBe(true)
    // 金融相場のあとの移行期は業績相場
    const afterFin = macroPhase(mkMacro(-1), mkMacro(+1), 'financial')!
    expect(afterFin.id).toBe('performance')
    expect(afterFin.derived).toBe(true)
    // 🔴 同じ象限でも、直前のアンカーが違えば答えが変わる（記憶なしとの決定的な違い）
    expect(macroPhase(mkMacro(+1), mkMacro(-1), 'financial')!.id).toBe('performance')
    expect(macroPhase(mkMacro(+1), mkMacro(-1), 'reverseFinancial')!.id).toBe('reversePerformance')
  })

  it('🔵 アンカーがまだ無ければ象限をそのまま使う', () => {
    expect(macroPhase(mkMacro(+1), mkMacro(-1), null)!.id).toBe('performance')
    expect(macroPhase(mkMacro(-1), mkMacro(+1), null)!.id).toBe('reversePerformance')
  })

  it('🔵 4局面が PHASES の循環の順番と一致している', () => {
    expect(PHASES.map(p => p.id)).toEqual([
      'financial', 'performance', 'reverseFinancial', 'reversePerformance',
    ])
  })

  it('🔴 金利かインフレが横ばいなら現在地を判定しない', () => {
    expect(macroPhase(mkMacro(MACRO_RATE_THRESHOLD / 2), mkMacro(1))).toBeNull()   // 金利が横ばい
    expect(macroPhase(mkMacro(1), mkMacro(MACRO_INFL_THRESHOLD / 2))).toBeNull()   // インフレが横ばい
    expect(macroPhase(null, mkMacro(1))).toBeNull()                                 // 取得できていない
    expect(macroPhase(mkMacro(1), null)).toBeNull()
    expect(macroPhase(mkMacro(null), mkMacro(1))).toBeNull()
  })

  it('🔴 金利がほとんど動いていない期間は、突き合わせを出さない', () => {
    const rows: SectorPerfRow[] = JSON.parse(perfRaw).data
    const still: MacroInfo = {
      symbol: '^TNX', label: '米10年債利回り', time: '2026-08-07',
      chg3m: RATE_MOVE_THRESHOLD / 2, last: 4.5, from: null, to: null,
    }
    // 🔵 動いていない金利で「教科書ではこうなるはず」と言うのは根拠がない
    expect(rateAlignments(rows, still)).toEqual([])
    expect(rateAlignments(rows, null)).toEqual([])
  })

  it('🔴 金利の向きで「上位にいるはず」の業種が反転する', () => {
    const rows: SectorPerfRow[] = JSON.parse(perfRaw).data
    const base = { symbol: '^TNX', label: '米10年債利回り', time: '2026-08-07', last: 4.5, from: null, to: null }
    const up   = rateAlignments(rows, { ...base, chg3m:  1.0 })
    const down = rateAlignments(rows, { ...base, chg3m: -1.0 })
    expect(up.length).toBeGreaterThan(0)
    expect(up.length).toBe(down.length)
    // 銀行（感応度プラス）は、金利上昇なら「上位のはず」・低下なら「下位のはず」
    const bankUp   = up.find(a => a.row.sector17 === 15)!
    const bankDown = down.find(a => a.row.sector17 === 15)!
    expect(bankUp.expectStrong).toBe(true)
    expect(bankDown.expectStrong).toBe(false)
    // 食品（感応度マイナス）はその逆
    expect(up.find(a => a.row.sector17 === 1)!.expectStrong).toBe(false)
  })

  it('stock_master.json は内国株式のみで、17業種コードが正しい範囲に入る', () => {
    const rows: StockRow[] = JSON.parse(masterRaw).data
    expect(rows.length).toBeGreaterThan(3000)
    for (const r of rows) {
      expect(r.sector17).toBeGreaterThanOrEqual(1)
      expect(r.sector17).toBeLessThanOrEqual(17)
    }
    // 代表的な銘柄が引ける
    expect(searchStocks('8306', rows).hits[0]?.name).toContain('三菱')
  })
})
