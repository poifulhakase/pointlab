// 裁定買い残データ
// データソース: /data/arbitrage.json, arbitrage_daily.json (scripts/fetch-jpx.mjs で生成)

import { fetchWithCache } from './dataCache'

export interface ArbitrageWeekData {
  date:     string  // "2026/04/03"
  label:    string  // "4月第1週"
  longBal:  number  // 裁定買い残（百万円）
  shortBal: number  // 裁定売り残（百万円）
}

export interface ArbitrageDayData {
  date:         string        // "2026-04-28"
  longBal:      number        // 裁定買い残（百万円）
  longBalDelta: number | null // 前日比（百万円）
}

const CACHE_KEY       = 'poical-arbitrage-data'
const DAILY_CACHE_KEY = 'poical-arbitrage-daily-data'
const CACHE_TTL       = 24 * 60 * 60 * 1000

export async function fetchArbitrageData(force = false): Promise<ArbitrageWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/arbitrage.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
      const json = await res.json() as { updatedAt: string; data: ArbitrageWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}

export async function fetchArbitrageDailyData(force = false): Promise<ArbitrageDayData[]> {
  return fetchWithCache({
    key: DAILY_CACHE_KEY, ttl: CACHE_TTL, force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/arbitrage_daily.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { updatedAt: string; data: ArbitrageDayData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
