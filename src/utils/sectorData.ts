// セクター画面のデータ読み込み。
//   ・業種別の相対強弱 : /data/sector_perf.json  （日次更新・小さい）
//   ・銘柄マスタ       : /data/stock_master.json （月次更新・約3700件）
//
// 🔴 **銘柄マスタは localStorage に入れない**。3700件で数百KBあり、
//    他のキャッシュ（信用残・投資主体別など）を QuotaExceeded で追い出しかねない。
//    月1更新でほぼ変わらないので、ブラウザのHTTPキャッシュに任せ、
//    同一セッション内はモジュール変数で使い回す。

import { fetchWithCache } from './dataCache'
import type { PerfPeriods, RateInfo, SectorPerfRow, StockRow } from './sectorRotation'

const PERF_URL   = `${import.meta.env.BASE_URL}data/sector_perf.json`
const MASTER_URL = `${import.meta.env.BASE_URL}data/stock_master.json`

const PERF_CACHE_KEY = 'poical-sector-perf-v1'
const PERF_TTL       = 6 * 60 * 60 * 1000

export type SectorPerf = {
  rows:      SectorPerfRow[]
  updatedAt: string | null
  /** 代用データである旨（'etf' 固定）。将来 指数そのものを引けたら null にする。 */
  proxy:     string | null
  /** 各期間が実際いつからいつまでか。「1か月」だけでは伝わらないので画面に出す。 */
  periods:   PerfPeriods
  /** 金利（米10年債利回り）。取得に失敗した日は null になりうる。 */
  rate:      RateInfo | null
}

export async function loadSectorPerf(): Promise<SectorPerf> {
  return fetchWithCache<SectorPerf>({
    key: PERF_CACHE_KEY,
    ttl: PERF_TTL,
    checkUpdatedAt: true,
    fetcher: async () => {
      const res = await fetch(PERF_URL, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rows = Array.isArray(json?.data) ? (json.data as SectorPerfRow[]) : []
      if (rows.length === 0) throw new Error('sector_perf.json が空')
      return {
        data: {
          rows,
          updatedAt: json?.updatedAt ?? null,
          proxy:     json?.proxy ?? null,
          periods:   json?.periods ?? {},
          // 🔵 金利は後から足した項目。古いキャッシュには入っていないので null 許容。
          rate:      (json?.rate as RateInfo | undefined) ?? null,
        },
        updatedAt: json?.updatedAt,
      }
    },
  })
}

export type StockMaster = {
  rows: StockRow[]
  /** 一覧の基準日（JPXの月次更新日） */
  asOf: string | null
}

let masterMemo: StockMaster | null = null
let masterInflight: Promise<StockMaster> | null = null

export async function loadStockMaster(): Promise<StockMaster> {
  if (masterMemo) return masterMemo
  // 🔵 検索欄を叩くたびに走らないよう、進行中の1本に相乗りさせる
  if (masterInflight) return masterInflight

  masterInflight = (async () => {
    try {
      const res = await fetch(MASTER_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rows = Array.isArray(json?.data) ? (json.data as StockRow[]) : []
      if (rows.length === 0) throw new Error('stock_master.json が空')
      masterMemo = { rows, asOf: json?.asOf ?? null }
      return masterMemo
    } finally {
      masterInflight = null
    }
  })()

  return masterInflight
}
