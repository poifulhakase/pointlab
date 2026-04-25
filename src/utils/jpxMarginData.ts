// 信用取引残高データ
// データソース: /data/margin.json (scripts/fetch-jpx.mjs で生成)

export interface MarginWeekData {
  date:      string          // "2026/04/03"
  label:     string          // "4月第1週"
  longBal:   number          // 買い残（百万円）
  shortBal:  number          // 売り残（百万円）
  ratio:     number          // 信用倍率
  evalRatio: number | null   // 信用評価損益率（%）
}

interface CachedResponse {
  updatedAt: string
  data: MarginWeekData[]
}

const CACHE_KEY = 'poical-margin-data'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24時間（週次データのため）

interface LocalCache {
  updatedAt: string
  data: MarginWeekData[]
  fetchedAt: number
}

/** キャッシュに記録されている updatedAt を返す（ネットワーク不要） */
export function getStoredMarginUpdatedAt(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as LocalCache).updatedAt ?? null
  } catch { return null }
}

function writeCache(updatedAt: string, data: MarginWeekData[]) {
  try {
    const cache: LocalCache = { updatedAt, data, fetchedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

export async function fetchMarginData(force = false): Promise<MarginWeekData[]> {
  let stale: MarginWeekData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LocalCache
      stale = c.data
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/margin.json`, {
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
