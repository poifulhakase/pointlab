// NT倍率 = 日経平均 ÷ TOPIX（日足）
//  ・日経225: Yahoo Finance ^N225（ライブ・プロキシ経由）
//  ・TOPIX  : ①/api/stocks-daily?only=topix（Vercel Functions が stooq ^tpx をサーバー側取得）→ ②静的 /data/topix.json
//    指数 ^TPX は Yahoo で欠損し、stooq はブラウザCORS不可かつJSチャレンジを返すため、
//    TOPIX指数はサーバー側経由でしか取れない。ETF(1306.T等)は指数と水準がずれて倍率が
//    ぶれるため代用しない。①が落ちても②（fetch-jpx が生成）で表示を維持する。
//    （専用 /api/topix を作らないのは Hobby プランの 12 Functions 上限のため stocks-daily に相乗り）

import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'
import { parseYahooChart } from './yahooChart'

export interface NtRatioPoint {
  time:      string        // YYYY-MM-DD
  nikkei:    number        // 日経225終値
  benchmark: number        // 比較指数終値（NT倍率=TOPIX）
  ratio:     number        // 倍率（日経 ÷ TOPIX）
  change:    number | null // 前日比（倍率）
}

const NT_CACHE_KEY        = 'poical-nt-ratio-v1'
const NT_CACHE_TTL_OPEN   = 30 * 60 * 1000
const NT_CACHE_TTL_CLOSED = 2 * 60 * 60 * 1000
const API_TOPIX_URL       = '/api/stocks-daily?only=topix'
const STATIC_TOPIX_URL    = `${import.meta.env.BASE_URL}data/topix.json`

function isJpMarketOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay()
  if (day === 0 || day === 6) return false
  // 09:00–15:30 JST = 00:00–06:30 UTC
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes()
  return mins <= 6 * 60 + 30
}

function parseYahooClose(json: unknown): Map<string, number> {
  const parsed = parseYahooChart(json)
  if (!parsed) throw new Error('レスポンス形式が不正')
  const ts = parsed.timestamps
  const cl = parsed.close
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

// TOPIX 日足終値。形式 { updatedAt, data: [{ time, close }] }
function jsonToTopixMap(json: { data?: { time: string; close: number }[] }): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of json.data ?? []) {
    if (p && typeof p.close === 'number' && p.close > 0) {
      map.set(p.time, Math.round(p.close * 100) / 100)
    }
  }
  return map
}

// ①/api/topix（Vercel経由のstooq）→ ②静的 /data/topix.json の順にフォールバック
async function fetchTopixMap(): Promise<Map<string, number>> {
  try {
    const res = await fetch(API_TOPIX_URL, { cache: 'no-store' })
    if (res.ok) {
      const map = jsonToTopixMap(await res.json())
      if (map.size > 0) return map
    }
  } catch { /* 静的JSONへフォールバック */ }

  const res = await fetch(STATIC_TOPIX_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error('TOPIXデータを取得できませんでした')
  const map = jsonToTopixMap(await res.json())
  if (map.size === 0) throw new Error('TOPIXデータが空です')
  return map
}

export async function fetchNtRatioData(force = false): Promise<NtRatioPoint[]> {
  return fetchWithCache({
    key: NT_CACHE_KEY,
    ttl: () => isJpMarketOpen() ? NT_CACHE_TTL_OPEN : NT_CACHE_TTL_CLOSED,
    force,
    fetcher: async () => {
      // 日経はライブ（Yahoo）、TOPIXは静的JSON。直列取得でプロキシのレート制限を回避。
      const nikkeiMap = await fetchSymbol('^N225')
      const topixMap  = await fetchTopixMap()

      const dates = Array.from(nikkeiMap.keys())
        .filter(d => topixMap.has(d))
        .sort()
      if (dates.length === 0) throw new Error('日経とTOPIXの共通日付がありません')

      const data: NtRatioPoint[] = dates.map((time, i) => {
        const nikkei = nikkeiMap.get(time)!
        const topix  = topixMap.get(time)!
        const ratio  = Math.round((nikkei / topix) * 1000) / 1000
        const prev   = i > 0
          ? Math.round((nikkeiMap.get(dates[i - 1])! / topixMap.get(dates[i - 1])!) * 1000) / 1000
          : null
        return { time, nikkei, benchmark: topix, ratio, change: prev != null ? Math.round((ratio - prev) * 1000) / 1000 : null }
      })

      return { data }
    },
  })
}
