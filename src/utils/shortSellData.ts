// 空売り比率データ
// データソース: /data/short_sell.json (scripts/fetch-jpx.mjs で生成)

import { fetchWithCache } from './dataCache'

export interface ShortSellWeekData {
  date:  string  // "2026/04/03"
  label: string  // "4月第1週"
  ratio: number  // 空売り比率（%）
}

const CACHE_KEY = 'poical-short-sell-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchShortSellData(force = false): Promise<ShortSellWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/short_sell.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
      const json = await res.json() as { updatedAt: string; data: ShortSellWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
