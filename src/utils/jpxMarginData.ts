// 信用取引残高データ
// データソース: /data/margin.json (scripts/fetch-jpx.mjs で生成)

import { fetchWithCache, getCachedUpdatedAt } from './dataCache'

export interface MarginWeekData {
  date:      string          // "2026/04/03"
  label:     string          // "4月第1週"
  longBal:   number          // 買い残（百万円）
  shortBal:  number          // 売り残（百万円）
  ratio:     number          // 信用倍率
  evalRatio: number | null   // 信用評価損益率（%）
}

const CACHE_KEY = 'poical-margin-data-v2'
const CACHE_TTL = 24 * 60 * 60 * 1000

/** キャッシュに記録されている updatedAt を返す（ネットワーク不要） */
export function getStoredMarginUpdatedAt(): string | null {
  return getCachedUpdatedAt(CACHE_KEY)
}

export async function fetchMarginData(force = false): Promise<MarginWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force, checkUpdatedAt: true,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/margin.json`, { signal: AbortSignal.timeout(10000), cache: 'no-cache' })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
      const json = await res.json() as { updatedAt: string; data: MarginWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
