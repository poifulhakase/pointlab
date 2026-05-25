// ドル円日次データ（静的JSON → Yahoo Finance プロキシ経由のフォールバック）

import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'

export interface UsdjpyDayData {
  time:      string        // YYYY-MM-DD
  close:     number        // 終値
  change:    number | null // 前日比（円）
  changePct: number | null // 前日比（%）
  ma5:       number | null // 5日移動平均
  ma5dev:    number | null // MA5乖離率（%）
}

const CACHE_KEY         = 'poical-usdjpy-data'
const CACHE_TTL_OPEN    = 30 * 60 * 1000
const CACHE_TTL_CLOSED  = 2  * 60 * 60 * 1000
const STATIC_JSON_URL   = `${import.meta.env.BASE_URL}data/usdjpy.json`
const STATIC_MAX_AGE_MS = 12 * 60 * 60 * 1000  // 12時間以内なら静的JSONを使用（日本市場時間帯は自動的にliveへ）

function isForexOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay()
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

function buildPoints(closeMap: Map<string, number>): UsdjpyDayData[] {
  const dates = Array.from(closeMap.keys()).sort()
  return dates.map((time, i) => {
    const close     = closeMap.get(time)!
    const prev      = i > 0 ? closeMap.get(dates[i - 1])! : null
    const change    = prev != null ? Math.round((close - prev) * 100) / 100 : null
    const changePct = prev != null ? Math.round((close - prev) / prev * 10000) / 100 : null
    let ma5: number | null = null
    if (i >= 4) {
      const sum = dates.slice(i - 4, i + 1).reduce((acc, d) => acc + closeMap.get(d)!, 0)
      ma5 = Math.round(sum / 5 * 100) / 100
    }
    const ma5dev = ma5 != null ? Math.round((close - ma5) / ma5 * 10000) / 100 : null
    return { time, close, change, changePct, ma5, ma5dev }
  })
}

export async function fetchUsdjpyData(force = false): Promise<UsdjpyDayData[]> {
  return fetchWithCache({
    key: CACHE_KEY,
    ttl: () => isForexOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED,
    force,
    fetcher: async () => {
      // 静的JSONを優先使用（fetch-data スクリプトで生成・常に新鮮）
      try {
        const res = await fetch(STATIC_JSON_URL)
        if (res.ok) {
          const json = await res.json() as { updatedAt: string; data: UsdjpyDayData[] }
          const age = Date.now() - new Date(json.updatedAt).getTime()
          if (age < STATIC_MAX_AGE_MS && json.data?.length > 0) {
            // 静的JSONは降順保存のため昇順に変換（buildPoints と同一順序に統一）
            const sorted = [...json.data].sort((a, b) => a.time.localeCompare(b.time))
            return { data: sorted }
          }
        }
      } catch { /* fall through to live fetch */ }

      // フォールバック: Yahoo Finance プロキシ経由でライブ取得
      const closeMap = await fetchSymbol('USDJPY=X')
      return { data: buildPoints(closeMap) }
    },
  })
}
