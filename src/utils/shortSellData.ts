// 空売り比率データ
// データソース: /data/short_sell.json (scripts/fetch-jpx.mjs で生成)

export interface ShortSellWeekData {
  date:        string  // "2026/04/03"
  label:       string  // "4月第1週"
  ratio:       number  // 空売り比率（%）
}

interface CachedResponse {
  updatedAt: string
  data: ShortSellWeekData[]
}

const CACHE_KEY = 'poical-short-sell-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

interface LocalCache {
  updatedAt: string
  data: ShortSellWeekData[]
  fetchedAt: number
}

function writeCache(updatedAt: string, data: ShortSellWeekData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchShortSellData(force = false): Promise<ShortSellWeekData[]> {
  let stale: ShortSellWeekData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LocalCache
      stale = c.data
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/short_sell.json`, {
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
