import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'

export interface Nas100DayData {
  time:      string        // YYYY-MM-DD
  close:     number
  changePct: number | null // 前日比（%）
}

const CACHE_KEY        = 'poical-nas100-data'
const CACHE_TTL_OPEN   = 30 * 60 * 1000
const CACHE_TTL_CLOSED = 2  * 60 * 60 * 1000

function isMarketOpen(): boolean {
  const day = new Date().getUTCDay()
  return day !== 0 && day !== 6
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
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`
  const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo`
  try {
    return parseYahooClose(await proxyFetch(url))
  } catch {
    return parseYahooClose(await proxyFetch(url2))
  }
}

export async function fetchNas100Data(force = false): Promise<Nas100DayData[]> {
  return fetchWithCache({
    key: CACHE_KEY,
    ttl: () => isMarketOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED,
    force,
    fetcher: async () => {
      const closeMap = await fetchSymbol('^NDX')
      const dates    = Array.from(closeMap.keys()).sort()
      const data: Nas100DayData[] = dates.map((time, i) => {
        const close    = closeMap.get(time)!
        const prev     = i > 0 ? closeMap.get(dates[i - 1])! : null
        const changePct = prev != null ? Math.round((close - prev) / prev * 10000) / 100 : null
        return { time, close, changePct }
      })
      return { data }
    },
  })
}
