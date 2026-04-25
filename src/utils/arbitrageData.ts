// 裁定買い残データ
// データソース: /data/arbitrage.json (scripts/fetch-jpx.mjs で生成)

export interface ArbitrageWeekData {
  date:     string  // "2026/04/03"
  label:    string  // "4月第1週"
  longBal:  number  // 裁定買い残（百万円）
  shortBal: number  // 裁定売り残（百万円）
}

interface CachedResponse {
  updatedAt: string
  data: ArbitrageWeekData[]
}

const CACHE_KEY = 'poical-arbitrage-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

interface LocalCache {
  updatedAt: string
  data: ArbitrageWeekData[]
  fetchedAt: number
}

function writeCache(updatedAt: string, data: ArbitrageWeekData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchArbitrageData(force = false): Promise<ArbitrageWeekData[]> {
  let stale: ArbitrageWeekData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LocalCache
      stale = c.data
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/arbitrage.json`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
    const json: CachedResponse = await res.json()
    if (!json.data || json.data.length === 0) throw new Error('データが空です')
    writeCache(json.updatedAt, json.data)
    return json.data
  } catch (e) {
    if (stale) return stale
    throw e
  }
}
