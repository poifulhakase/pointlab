// NS倍率 = 日経平均 ÷ S&P500（日足・Yahoo Finance プロキシ経由）

import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'

export interface NtRatioPoint {
  time:      string        // YYYY-MM-DD
  nikkei:    number        // 日経225終値
  benchmark: number        // 比較指数終値（NS倍率=S&P500、NT倍率=TOPIX）
  ratio:     number        // 倍率
  change:    number | null // 前日比（倍率）
}

const NT_CACHE_KEY        = 'poical-ns-ratio-v2'
const NT_CACHE_TTL_OPEN   = 30 * 60 * 1000
const NT_CACHE_TTL_CLOSED = 2 * 60 * 60 * 1000

function isJpMarketOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return false
  // 09:00–15:30 JST = 00:00–06:30 UTC
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes()
  return mins <= 6 * 60 + 30
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
  const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`
  const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`
  try {
    return parseYahooClose(await proxyFetch(q1))
  } catch {
    return parseYahooClose(await proxyFetch(q2))
  }
}

export async function fetchNtRatioData(force = false): Promise<NtRatioPoint[]> {
  return fetchWithCache({
    key: NT_CACHE_KEY,
    ttl: () => isJpMarketOpen() ? NT_CACHE_TTL_OPEN : NT_CACHE_TTL_CLOSED,
    force,
    fetcher: async () => {
      // 直列取得（同一プロキシへの同時リクエストによるレート制限を回避）
      const nikkeiMap = await fetchSymbol('^N225')
      await new Promise(r => setTimeout(r, 1500))
      const sp500Map  = await fetchSymbol('^GSPC')

      const dates = Array.from(nikkeiMap.keys())
        .filter(d => sp500Map.has(d))
        .sort()

      const data: NtRatioPoint[] = dates.map((time, i) => {
        const nikkei = nikkeiMap.get(time)!
        const sp500  = sp500Map.get(time)!
        const ratio  = Math.round((nikkei / sp500) * 1000) / 1000
        const prev   = i > 0
          ? Math.round((nikkeiMap.get(dates[i - 1])! / sp500Map.get(dates[i - 1])!) * 1000) / 1000
          : null
        return { time, nikkei, benchmark: sp500, ratio, change: prev != null ? Math.round((ratio - prev) * 1000) / 1000 : null }
      })

      return { data }
    },
  })
}
