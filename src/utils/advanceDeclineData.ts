// 騰落レシオデータ
// データソース: /data/advance_decline.json (scripts/fetch-jpx.mjs で生成)

import { fetchWithCache } from './dataCache'

export interface AdvanceDeclineWeekData {
  date:     string         // "2026/04/03"
  label:    string         // "4月第1週"
  ratio25:  number         // 騰落レシオ（25日）
  advances: number | null  // 値上がり銘柄数
  declines: number | null  // 値下がり銘柄数
}

const CACHE_KEY = 'poical-ad-ratio-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchAdvanceDeclineData(force = false): Promise<AdvanceDeclineWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/advance_decline.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
      const json = await res.json() as { updatedAt: string; data: AdvanceDeclineWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
