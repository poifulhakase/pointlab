// 先物建玉残高（OI）データ
// データソース: /data/futures_oi.json (scripts/fetch-jpx.mjs で生成)
// 元データ: JPX月間統計資料「指数先物取引取引状況（日別）」 col[10]=建玉現在高
// 更新: 翌月上旬公表（約1ヶ月遅延）

export interface FuturesOiWeekData {
  date:  string  // "2026/03/28"
  label: string  // "3月第4週"
  oi:    number  // 日経225先物 建玉残高（枚）
}

interface CachedResponse {
  updatedAt: string
  data: FuturesOiWeekData[]
}

const CACHE_KEY = 'poical-futures-oi-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

interface LocalCache {
  updatedAt: string
  data: FuturesOiWeekData[]
  fetchedAt: number
}

function readCache(): LocalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as LocalCache
    if (Date.now() - c.fetchedAt > CACHE_TTL) return null
    return c
  } catch { return null }
}

function writeCache(updatedAt: string, data: FuturesOiWeekData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchFuturesOiData(force = false): Promise<FuturesOiWeekData[]> {
  if (!force) {
    const cached = readCache()
    if (cached) return cached.data
  }
  const res = await fetch(`${import.meta.env.BASE_URL}data/futures_oi.json`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json: CachedResponse = await res.json()
  if (!json.data || json.data.length === 0) throw new Error('データが空です')
  writeCache(json.updatedAt, json.data)
  return json.data
}
