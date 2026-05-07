// VIX（恐怖指数）データ
// 週次: /data/vix.json → Yahoo Finance ^VIX 週次フォールバック
// 日次: Yahoo Finance ^VIX 日次（偏差スコア計算用）

import { proxyFetch } from './proxyFetch'

export interface VixDayData {
  time:      string        // YYYY-MM-DD
  close:     number
  changePct: number | null // 前日比（%）
}

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

const CACHE_KEY          = 'poical-vix-data'
const CACHE_TTL          = 24 * 60 * 60 * 1000
const CACHE_KEY_DAILY    = 'poical-vix-daily-data'
const CACHE_TTL_OPEN     = 30 * 60 * 1000
const CACHE_TTL_CLOSED   = 2  * 60 * 60 * 1000

function isMarketOpen(): boolean {
  const day = new Date().getUTCDay()
  return day !== 0 && day !== 6
}

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

// ── VIX 日次データ（偏差スコア計算用） ──────────────────────────────────────
export async function fetchVixDailyData(force = false): Promise<VixDayData[]> {
  let stale: VixDayData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY_DAILY)
    if (raw) {
      const c = JSON.parse(raw) as { data: VixDayData[]; fetchedAt: number }
      stale = c.data
      if (!force) {
        const ttl = isMarketOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED
        if (Date.now() - c.fetchedAt <= ttl) return c.data
      }
    }
  } catch { /* ignore */ }

  for (const base of ['query1', 'query2']) {
    try {
      const target = `https://${base}.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=3mo`
      const json   = await proxyFetch(target)
      const r      = (json as any)?.chart?.result?.[0]
      if (!r) throw new Error('no result')
      const ts: number[]          = r.timestamp ?? []
      const cl: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
      const pts: VixDayData[]     = []
      for (let i = 0; i < ts.length; i++) {
        if (cl[i] == null) continue
        const time     = new Date(ts[i] * 1000).toISOString().slice(0, 10)
        const close    = Math.round(cl[i]! * 100) / 100
        const prev     = pts[pts.length - 1]
        const changePct = prev
          ? Math.round((close - prev.close) / prev.close * 10000) / 100
          : null
        pts.push({ time, close, changePct })
      }
      if (pts.length === 0) throw new Error('データが空')
      try { localStorage.setItem(CACHE_KEY_DAILY, JSON.stringify({ data: pts, fetchedAt: Date.now() })) } catch { /* ignore */ }
      return pts
    } catch { /* 次のベースURLを試みる */ }
  }

  if (stale) return stale
  throw new Error('VIX日次データの取得に失敗しました')
}
