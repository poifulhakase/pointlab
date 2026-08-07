import { describe, it, expect } from 'vitest'
// 🔵 実データは Vite の ?raw で文字列として読む（node:fs は app の型構成に無い）。
//    既存の freshness-threshold.test.ts と同じやり方。
import perfRaw   from '../../../public/data/sector_perf.json?raw'
import masterRaw from '../../../public/data/stock_master.json?raw'
import {
  PHASES, SECTOR17,
  phaseAt, nextPhase, phaseOfSector17, phaseMidAngle, sector17Label,
  phaseStrengths, strongestPhase, searchStocks,
  type SectorPerfRow, type StockRow,
} from '../sectorRotation'
import { buildStockAnalysisPrompt } from '../sectorStockPrompt'

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

// ── AI分析プロンプト ────────────────────────────────────
describe('銘柄のAI分析プロンプト', () => {
  const stock = STOCKS[2]  // 8306 三菱UFJ（銀行）
  const rows  = [perfRow(15, 20), perfRow(2, 10), perfRow(13, 0), perfRow(9, 1)]
  const st    = phaseStrengths(rows, 'chg3m')
  const p     = buildStockAnalysisPrompt(stock, rows, st, 'chg3m', '2026-08-07 20:00')

  it('銘柄の基本情報と業種が入る', () => {
    expect(p).toContain('8306')
    expect(p).toContain('三菱UFJ')
    expect(p).toContain('銀行業')   // 33業種
    expect(p).toContain('銀行')     // 17業種
  })

  it('実測の騰落率と順位が入る', () => {
    expect(p).toContain('+20%')
    expect(p).toContain('17業種の騰落率（強い順）')
  })

  it('🔴 売買の推奨を書かせない（アプリ全体の方針）', () => {
    expect(p).toContain('売買の推奨・目標株価')
    expect(p).toContain('書かないでください')
  })

  it('🔴 局面の判定をしていないことを伝え、断定を禁じる', () => {
    // 伝えないとAIが「いまは逆金融相場だから」と確定事実のように語ってしまう
    expect(p).toContain('景気局面の判定を行っていません')
    expect(p).toContain('断定しないでください')
  })

  it('🔴 株価を持っていないことを明示し、出典と取得日を求める', () => {
    expect(p).toContain('株価を持っていません')
    expect(p).toContain('取得日')
  })

  it('🔴 実測がETFによる代用値であることを伝える', () => {
    expect(p).toContain('代用')
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
