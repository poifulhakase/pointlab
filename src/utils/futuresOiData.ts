// 先物建玉残高（OI）データ
// データソース: /data/futures_oi.json (scripts/fetch-jpx.mjs で生成)
// 公表タイミング: JPX月次統計 翌月上旬公開（約1〜6週間遅延）

import { fetchWithCache } from './dataCache'

export interface FuturesOiWeekData {
  date:  string  // "2026/04/17"
  label: string  // "4月第3週"
  oi:    number  // 建玉残高（枚）
}

const CACHE_KEY = 'poical-futures-oi-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchFuturesOiData(force = false): Promise<FuturesOiWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force, checkUpdatedAt: true,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/futures_oi.json`, { signal: AbortSignal.timeout(10000), cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { updatedAt: string; data: FuturesOiWeekData[] }
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
