// 騰落レシオデータ
// データソース: /data/advance_decline.json (scripts/fetch-jpx.mjs で生成)

export interface AdvanceDeclineWeekData {
  date:     string         // "2026/04/03"
  label:    string         // "4月第1週"
  ratio25:  number         // 騰落レシオ（25日）
  advances: number | null  // 値上がり銘柄数
  declines: number | null  // 値下がり銘柄数
}

interface CachedResponse {
  updatedAt: string
  data: AdvanceDeclineWeekData[]
}

const CACHE_KEY = 'poical-ad-ratio-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

interface LocalCache {
  updatedAt: string
  data: AdvanceDeclineWeekData[]
  fetchedAt: number
}

function writeCache(updatedAt: string, data: AdvanceDeclineWeekData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchAdvanceDeclineData(force = false): Promise<AdvanceDeclineWeekData[]> {
  let stale: AdvanceDeclineWeekData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LocalCache
      stale = c.data
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/advance_decline.json`, {
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
