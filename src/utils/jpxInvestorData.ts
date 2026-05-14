// 投資主体別売買動向データ
// データソース: /data/investor.json (scripts/fetch-jpx.mjs で生成)

import { fetchWithCache } from './dataCache'

export interface InvestorWeekData {
  date:       string  // "2026/04/03"
  label:      string  // "4月第1週"
  foreigner:  number  // 海外投資家 差引（百万円）
  individual: number  // 個人 差引（百万円）
  trustBank:  number  // 信託銀行 差引（百万円）
  securities: number  // 証券自己 差引（百万円）
}

const CACHE_KEY = 'poical-investor-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchInvestorData(force = false): Promise<InvestorWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/investor.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
      const json = await res.json() as { updatedAt: string; data: InvestorWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
