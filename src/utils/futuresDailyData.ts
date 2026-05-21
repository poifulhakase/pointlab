// 先物日次データ（OI・取引高）
// データソース: /data/futures_daily.json (scripts/fetch-jpx.mjs で生成)
// JPX日報PDF (sif_dyr_YYYYMMDD.pdf) から毎営業日 16:31 頃更新

import { fetchWithCache } from './dataCache'

export interface FuturesDayData {
  date:   string        // "2026/04/30"
  volume: number        // 取引高（枚）- 日経225先物 全限月合計
  oi:     number        // 建玉残高（枚）- 日経225先物 全限月合計
  pcr:    number | null // PCR（プット・コール・レシオ）- Nikkei225オプション
  close?: number | null // 近限月清算値（円）
}

const CACHE_KEY = 'poical-futures-daily-data-v2'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6時間

export async function fetchFuturesDailyData(force = false): Promise<FuturesDayData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force, checkUpdatedAt: true,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/futures_daily.json`, { signal: AbortSignal.timeout(10000), cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { updatedAt: string; data: FuturesDayData[] }
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}
