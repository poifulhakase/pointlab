// 投資主体別売買動向データ
// データソース: /data/investor.json (scripts/fetch-jpx.mjs で生成)

export interface InvestorWeekData {
  date:       string  // "2026/04/03"
  label:      string  // "4月第1週"
  foreigner:  number  // 海外投資家 差引（百万円）
  individual: number  // 個人 差引（百万円）
  trustBank:  number  // 信託銀行 差引（百万円）
  securities: number  // 証券自己 差引（百万円）
}

interface CachedResponse {
  updatedAt: string
  data: InvestorWeekData[]
}

const CACHE_KEY = 'poical-investor-data'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24時間（週次データのため）

interface LocalCache {
  updatedAt: string
  data: InvestorWeekData[]
  fetchedAt: number
}

function readCache(): LocalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as LocalCache
    if (Date.now() - cache.fetchedAt > CACHE_TTL) return null
    return cache
  } catch { return null }
}

function writeCache(updatedAt: string, data: InvestorWeekData[]) {
  try {
    const cache: LocalCache = { updatedAt, data, fetchedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

export async function fetchInvestorData(force = false): Promise<InvestorWeekData[]> {
  if (!force) {
    const cached = readCache()
    if (cached) return cached.data
  }

  const res = await fetch(`${import.meta.env.BASE_URL}data/investor.json`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
  const json: CachedResponse = await res.json()
  if (!json.data || json.data.length === 0) throw new Error('データが空です')

  writeCache(json.updatedAt, json.data)
  return json.data
}
