// VIX（恐怖指数）週次データ
// データソース: /data/vix.json (scripts/fetch-jpx.mjs で生成) → 失敗時は Yahoo Finance ^VIX にフォールバック

import { proxyFetch } from './proxyFetch'

export interface VixWeekData {
  date:       string   // "2026/04/11"
  close:      number   // 終値
  change:     number | null  // 前週比（ポイント）
  changePct:  number | null  // 前週比（%）
}

interface CachedResponse {
  updatedAt: string
  data: VixWeekData[]
}

const CACHE_KEY = 'poical-vix-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

async function fetchVixFromYahoo(): Promise<VixWeekData[]> {
  const sym = '%5EVIX'
  let lastErr = ''
  for (const base of ['query1', 'query2']) {
    const target = `https://${base}.finance.yahoo.com/v8/finance/chart/${sym}?interval=1wk&range=1y`
    try {
      const json = await proxyFetch(target)
      const r = (json as any)?.chart?.result?.[0]
      if (!r) throw new Error('no result')
      const ts: number[]           = r.timestamp ?? []
      const cl: (number | null)[]  = r.indicators?.quote?.[0]?.close ?? []
      const pts: VixWeekData[] = []
      for (let j = 0; j < ts.length; j++) {
        if (cl[j] == null) continue
        const date  = new Date(ts[j] * 1000).toISOString().slice(0, 10).replace(/-/g, '/')
        const close = Math.round(cl[j]! * 100) / 100
        const prev  = pts[pts.length - 1]
        pts.push({
          date,
          close,
          change:    prev ? Math.round((close - prev.close) * 100) / 100 : null,
          changePct: prev ? Math.round((close - prev.close) / prev.close * 10000) / 100 : null,
        })
      }
      if (pts.length > 0) return pts.reverse()
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(`VIX Yahoo Finance fetch failed: ${lastErr}`)
}

export async function fetchVixData(): Promise<VixWeekData[]> {
  let stale: VixWeekData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as { data: VixWeekData[]; fetchedAt: number }
      stale = c.data
      if (Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  // vix.json を試みる
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/vix.json`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json: CachedResponse = await res.json()
    if (!json.data || json.data.length === 0) throw new Error('データが空です')
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json.data, fetchedAt: Date.now() })) } catch { /* ignore */ }
    return json.data
  } catch { /* vix.json 失敗 → Yahoo Finance へフォールバック */ }

  // Yahoo Finance ^VIX を試みる
  try {
    const data = await fetchVixFromYahoo()
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() })) } catch { /* ignore */ }
    return data
  } catch (e) {
    if (stale) return stale
    throw e
  }
}
