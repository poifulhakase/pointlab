import { fetchWithCache } from './dataCache'

export interface StocksItem {
  code:         string
  name:         string
  contribution: number
  sector:       string | null
}

export interface SectorItem {
  name:      string
  changePct: number
}

export interface NkFuturesDayData {
  date:       string
  open:       number
  high:       number
  low:        number
  close:      number
  volume:     number | null
  prev_close: number | null
  change:     number | null
  change_pct: number | null
}

export interface StocksDailyData {
  contribution: { up: StocksItem[]; down: StocksItem[]; total: number }
  sector:       { up: SectorItem[]; down: SectorItem[]; advanceSectorCount?: number; declineSectorCount?: number }
  nkFutures:    NkFuturesDayData[]
  updatedAt:    string
}

export const STOCKS_CACHE_KEY = 'poical-stocks-daily-v3'
const CACHE_TTL = 30 * 60 * 1000

export async function fetchStocksDaily(force = false): Promise<StocksDailyData> {
  return fetchWithCache({
    key: STOCKS_CACHE_KEY,
    ttl: CACHE_TTL,
    force,
    fetcher: async () => {
      const res = await fetch('/api/stocks-daily')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as StocksDailyData
      return { data, updatedAt: data.updatedAt }
    },
  })
}
