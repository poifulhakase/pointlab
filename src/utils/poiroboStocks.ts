// 中長期モメンタム銘柄（`public/data/poirobo_stocks.json`）の読み込み。
//
// 🔴 書き込むのは GitHub Actions（`scripts/fetch-poirobo-stocks.mjs`）だけ。
// 🔴 **観測用**。ロボ口座の判断・売買対象には入っていない（2026-08-16 ユーザー合意）。
import { fetchWithCache } from './dataCache'

export type StockSeriesPoint = { d: string; c: number | null; m25: number | null; m200: number | null }

export type StockMomentum = {
  ret: { m1: number | null; m3: number | null; m6: number | null; m12: number | null }
  ret_vs_index: { m1: number | null; m3: number | null; m6: number | null; m12: number | null }
  ret_12_1: number | null
  from_52w_high_pct: number | null
  above_ma200: boolean | null
  ma200_up: boolean | null
}

export type PoiroboStock = {
  code: string
  symbol: string
  name: string
  kana: string
  note: string
  date: string
  close: number | null
  change_pct: number | null
  volume: number | null
  volume_x: number | null
  ma25: number | null
  dev25_pct: number | null
  ma75: number | null
  ma200: number | null
  /** 200日線からの乖離率（%）。購入時の2つ目の基準 */
  dev200_pct: number | null
  trend_up: boolean | null
  range20: { high: number | null; low: number | null; pos_pct: number | null }
  range52w: { high: number | null; low: number | null }
  link: { n: number; beta: number | null; corr: number | null }
  momentum: StockMomentum
  stance: { key: string; label: string }
  series: StockSeriesPoint[]
  spark: (number | null)[]
}

/**
 * ものさし（AIの4層）。
 * 🔵 この画面の主張＝「考える・記憶・つなぐには値段が付いた。**動く側だけまだ**」を
 *    毎営業日そのまま確かめるための比較用。枠（採用銘柄）ではない。
 */
export type AiLayer = {
  key: string
  label: string
  sub: string
  code: string
  name: string
  ours?: boolean
  close: number | null
  rel12m: number | null
  rel3m: number | null
  ret12m: number | null
  from_52w_high_pct: number | null
}

export type PoiroboStocksData = {
  updatedAt: string
  basis: string
  caveat: string
  index: { code: string; name: string; date: string | null; close: number | null; change_pct: number | null; dev25_pct: number | null }
  stocks: PoiroboStock[]
  layers?: AiLayer[]
}

// 🔴 枠を入れ替えたらキーを上げる（2026-08-16 v2＝安川電機を外して3枠にした）。
//    上げないと、すでに開いた人のブラウザに**外した銘柄が最大30分残る**。
const CACHE_KEY = 'poical-poirobo-stocks-v2'
const TTL = 30 * 60 * 1000

export async function fetchPoiroboStocks(force = false): Promise<PoiroboStocksData | null> {
  try {
    return await fetchWithCache<PoiroboStocksData>({
      key: CACHE_KEY,
      ttl: TTL,
      force,
      // 🔴 枠を入れ替えたら**すぐ反映**する（2026-08-16）。
      //    ここは相談で銘柄が入れ替わるデータなので、30分待たされると「まだ古いのが出る」になる。
      //    checkUpdatedAt=true なら、60秒を超えたアクセスでサーバーの updatedAt を見て差分だけ取り直す。
      checkUpdatedAt: true,
      fetcher: async () => {
        const res = await fetch(`${import.meta.env.BASE_URL}data/poirobo_stocks.json`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as PoiroboStocksData
        return { data, updatedAt: data.updatedAt }
      },
    })
  } catch {
    return null   // まだ生成されていない期間は静かに何も出さない
  }
}

/** 期間の切り出し（画面のトグル用）。営業日ベースの本数で切る */
export const RANGES = [
  { key: '6m', label: '6ヶ月', bars: 126 },
  { key: '1y', label: '1年', bars: 252 },
  { key: '2y', label: '2年', bars: 500 },
] as const

export type RangeKey = typeof RANGES[number]['key']

export function sliceSeries(series: StockSeriesPoint[], range: RangeKey): StockSeriesPoint[] {
  const def = RANGES.find(r => r.key === range) ?? RANGES[1]
  return series.slice(-def.bars)
}
