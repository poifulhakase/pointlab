// ドル円日次データ（Yahoo Finance プロキシ経由）

import { proxyFetch } from './proxyFetch'

export interface UsdjpyDayData {
  time:      string        // YYYY-MM-DD
  close:     number        // 終値
  change:    number | null // 前日比（円）
  changePct: number | null // 前日比（%）
  ma5:       number | null // 5日移動平均
  ma5dev:    number | null // MA5乖離率（%）
}

const CACHE_KEY          = 'poical-usdjpy-data'
const CACHE_TTL_OPEN     = 30 * 60 * 1000
const CACHE_TTL_CLOSED   = 2  * 60 * 60 * 1000

function isForexOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay()
  return day !== 0 && day !== 6
}

function writeCache(data: UsdjpyDayData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

function parseYahooClose(json: unknown): Map<string, number> {
  const r = (json as any)?.chart?.result?.[0]
  if (!r) throw new Error('レスポンス形式が不正')
  const ts: number[]          = r.timestamp ?? []
  const cl: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const map = new Map<string, number>()
  for (let i = 0; i < ts.length; i++) {
    if (cl[i] == null) continue
    const time = new Date(ts[i] * 1000).toISOString().slice(0, 10)
    map.set(time, Math.round(cl[i]! * 100) / 100)
  }
  return map
}

async function fetchSymbol(sym: string): Promise<Map<string, number>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`
  const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`
  try {
    return parseYahooClose(await proxyFetch(url))
  } catch {
    return parseYahooClose(await proxyFetch(url2))
  }
}

export async function fetchUsdjpyData(force = false): Promise<UsdjpyDayData[]> {
  let stale: UsdjpyDayData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as { data: UsdjpyDayData[]; fetchedAt: number }
      stale = c.data
      if (!force) {
        const ttl = isForexOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED
        if (Date.now() - c.fetchedAt <= ttl) return c.data
      }
    }
  } catch { /* ignore */ }

  try {
    const closeMap = await fetchSymbol('USDJPY=X')
    const dates    = Array.from(closeMap.keys()).sort()

    const pts: UsdjpyDayData[] = dates.map((time, i) => {
      const close    = closeMap.get(time)!
      const prev     = i > 0 ? closeMap.get(dates[i - 1])! : null
      const change   = prev != null ? Math.round((close - prev) * 100) / 100 : null
      const changePct = prev != null ? Math.round((close - prev) / prev * 10000) / 100 : null

      let ma5: number | null = null
      if (i >= 4) {
        const sum = dates.slice(i - 4, i + 1).reduce((acc, d) => acc + closeMap.get(d)!, 0)
        ma5 = Math.round(sum / 5 * 100) / 100
      }
      const ma5dev = ma5 != null ? Math.round((close - ma5) / ma5 * 10000) / 100 : null

      return { time, close, change, changePct, ma5, ma5dev }
    })

    writeCache(pts)
    return pts
  } catch (e) {
    if (stale) return stale
    throw e
  }
}
