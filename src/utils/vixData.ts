// VIX（恐怖指数）データ
// 週次: /data/vix.json → Yahoo Finance ^VIX 週次フォールバック
// 日次: Yahoo Finance ^VIX 日次（偏差スコア計算用）

import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'
import { parseYahooChart } from './yahooChart'

export interface VixDayData {
  time:      string        // YYYY-MM-DD
  close:     number
  changePct: number | null // 前日比（%）
}

export interface VixWeekData {
  date:      string        // "2026/04/11"
  close:     number
  change:    number | null // 前週比（ポイント）
  changePct: number | null // 前週比（%）
}

const CACHE_KEY        = 'poical-vix-data'
const CACHE_TTL        = 24 * 60 * 60 * 1000
const CACHE_KEY_DAILY  = 'poical-vix-daily-data'
const CACHE_TTL_OPEN   = 30 * 60 * 1000
const CACHE_TTL_CLOSED = 2  * 60 * 60 * 1000

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
      const parsed = parseYahooChart(json)
      if (!parsed) throw new Error('no result')
      const ts = parsed.timestamps
      const cl = parsed.close
      const pts: VixWeekData[]    = []
      for (let j = 0; j < ts.length; j++) {
        if (cl[j] == null) continue
        const date  = new Date(ts[j] * 1000).toISOString().slice(0, 10).replace(/-/g, '/')
        const close = Math.round(cl[j]! * 100) / 100
        const prev  = pts[pts.length - 1]
        pts.push({
          date, close,
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
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL,
    fetcher: async () => {
      // vix.json を優先使用
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/vix.json`, { signal: AbortSignal.timeout(10000) })
        if (res.ok) {
          const json = await res.json() as { updatedAt: string; data: VixWeekData[] }
          if (json.data?.length) return { data: json.data, updatedAt: json.updatedAt }
        }
      } catch { /* vix.json 失敗 → Yahoo Finance へフォールバック */ }

      const data = await fetchVixFromYahoo()
      return { data }
    },
  })
}

const STATIC_DAILY_URL   = `${import.meta.env.BASE_URL}data/vix_daily.json`
const STATIC_DAILY_MAX_AGE = 12 * 60 * 60 * 1000

export async function fetchVixDailyData(force = false): Promise<VixDayData[]> {
  return fetchWithCache({
    key: CACHE_KEY_DAILY,
    ttl: () => isMarketOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED,
    force,
    fetcher: async () => {
      // 静的JSONを優先使用
      try {
        const res = await fetch(STATIC_DAILY_URL, { signal: AbortSignal.timeout(10000) })
        if (res.ok) {
          const json = await res.json() as { updatedAt: string; data: VixDayData[] }
          const age = Date.now() - new Date(json.updatedAt).getTime()
          if (age < STATIC_DAILY_MAX_AGE && json.data?.length > 0)
            return { data: json.data }
        }
      } catch { /* fall through */ }

      for (const base of ['query1', 'query2']) {
        try {
          const target = `https://${base}.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=3mo`
          const json   = await proxyFetch(target)
          const parsed = parseYahooChart(json)
          if (!parsed) throw new Error('no result')
          const ts = parsed.timestamps
          const cl = parsed.close
          const pts: VixDayData[]     = []
          for (let i = 0; i < ts.length; i++) {
            if (cl[i] == null) continue
            const time      = new Date(ts[i] * 1000).toISOString().slice(0, 10)
            const close     = Math.round(cl[i]! * 100) / 100
            const prev      = pts[pts.length - 1]
            const changePct = prev ? Math.round((close - prev.close) / prev.close * 10000) / 100 : null
            pts.push({ time, close, changePct })
          }
          if (pts.length > 0) return { data: pts }
        } catch { /* 次のベースURLを試みる */ }
      }
      throw new Error('VIX日次データの取得に失敗しました')
    },
  })
}
