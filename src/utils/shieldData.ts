import { proxyFetch } from './proxyFetch'
import { fetchVixData } from './vixData'
import { fetchFuturesDailyData } from './futuresDailyData'
import { fetchWithCache } from './dataCache'
import { parseYahooChart, type YahooChart } from './yahooChart'

const SHIELD_CACHE_KEY        = 'poical-shield-mkt-data-v2'
const SHIELD_CACHE_TTL_OPEN   = 30 * 60 * 1000   // 市場時間中: 30分
const SHIELD_CACHE_TTL_CLOSED = 2  * 60 * 60 * 1000  // 閉場後: 2時間

export function isJpMarketOpen(): boolean {
  const now  = new Date()
  const day  = now.getUTCDay()
  if (day === 0 || day === 6) return false
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes()
  // 前場 09:00–11:30 JST = UTC 00:00–02:30 / 後場 12:30–15:30 JST = UTC 03:30–06:30
  return (mins < 150) || (mins >= 210 && mins < 390)
}

// ── 市場データ構造 ───────────────────────────────────
export interface ShieldMktData {
  built_at:   string
  nk225: {
    latest_date:   string
    latest_close:  number
    change_1d:     number | null
    change_1d_pct: number | null
    ma20:          number | null
    ma60:          number | null
    ma200:         number | null
    ma20_weekly:   number | null  // 週足MA20（週足中央線）
    high_20d:      number | null
    low_20d:       number | null
    high_5d:       number | null  // 直近5日高値（緊急撤退モードのタイトトレール用）
    low_5d:        number | null  // 直近5日安値（同上）
    macd:          number | null  // 日足MACD(12,26)
    macd_signal:   number | null  // 日足MACDシグナル(9)
    macd_hist:     number | null  // MACDヒストグラム
    macd_gc:       boolean        // ゴールデンクロス（直近1日）
    ohlcv_recent:  Array<{ date: string; open: number; high: number; low: number; close: number; change_pct: number | null }>
  }
  futures: {
    oi_latest:     number | null
    oi_delta:      number | null
    pcr_latest:    number | null
    volume_latest: number | null
    data_as_of:    string | null
  }
  vix: {
    latest:     number | null
    change_pct: number | null
  }
}

export function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return Math.round(slice.reduce((a, b) => a + b, 0) / period)
}

export function calcEMA(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const result = [values[0]]
  for (let i = 1; i < values.length; i++)
    result.push(values[i] * k + result[result.length - 1] * (1 - k))
  return result
}

export function weeklyMA20(days: Array<{ date: string; close: number }>): number | null {
  const weekMap = new Map<string, number>()
  for (const d of days) {
    const dt  = new Date(d.date + 'T00:00:00Z')
    const soy = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
    const wn  = Math.ceil(((dt.getTime() - soy.getTime()) / 86400000 + soy.getUTCDay() + 1) / 7)
    weekMap.set(`${dt.getUTCFullYear()}-${wn}`, d.close)
  }
  return calcMA(Array.from(weekMap.values()), 20)
}

export function calcMACD(closes: number[]): { macd: number | null; signal: number | null; hist: number | null; gc: boolean } {
  if (closes.length < 35) return { macd: null, signal: null, hist: null, gc: false }
  const ema12  = calcEMA(closes, 12)
  const ema26  = calcEMA(closes, 26)
  const line   = ema12.map((v, i) => v - ema26[i])
  const sig    = calcEMA(line, 9)
  const n      = line.length - 1
  const macd   = Math.round(line[n])
  const signal = Math.round(sig[n])
  return { macd, signal, hist: macd - signal, gc: line[n - 1] < sig[n - 1] && line[n] >= sig[n] }
}

async function fetchNk225Ohlcv(): Promise<YahooChart | null> {
  const sym = encodeURIComponent('^N225')
  const q   = 'interval=1d&range=1y'
  for (const base of ['query1', 'query2'] as const) {
    try {
      const fetched = await proxyFetch(`https://${base}.finance.yahoo.com/v8/finance/chart/${sym}?${q}`, 5000)
      const parsed = parseYahooChart(fetched)
      if (parsed && parsed.timestamps.length) return parsed
    } catch { /* 次のベースURLを試みる */ }
  }
  return null
}

export async function buildShieldData(): Promise<ShieldMktData> {
  return fetchWithCache({
    key: SHIELD_CACHE_KEY,
    ttl: () => isJpMarketOpen() ? SHIELD_CACHE_TTL_OPEN : SHIELD_CACHE_TTL_CLOSED,
    fetcher: async () => {
      const builtAt = new Date().toISOString().slice(0, 10)

      // 3ソース並列取得（^N225 OHLCV・先物日次・VIX）
      const [ohlcvRes, futuresRes, vixRes] = await Promise.allSettled([
        fetchNk225Ohlcv(),
        fetchFuturesDailyData(),
        fetchVixData(),
      ])

      // 1. ^N225 OHLCV 解析（parseYahooChart で検証済みの配列を使う）
      const days: Array<{ date: string; open: number; high: number; low: number; close: number }> = []
      if (ohlcvRes.status === 'fulfilled' && ohlcvRes.value) {
        try {
          const chart = ohlcvRes.value
          const ts = chart.timestamps
          for (let i = 0; i < ts.length; i++) {
            const c = chart.close[i]
            if (c == null) continue
            days.push({
              date:  new Date(ts[i] * 1000).toISOString().slice(0, 10),
              open:  Math.round(chart.open[i]  ?? c),
              high:  Math.round(chart.high[i]  ?? c),
              low:   Math.round(chart.low[i]   ?? c),
              close: Math.round(c),
            })
          }
          days.sort((a, b) => a.date.localeCompare(b.date))
        } catch { /* 解析失敗時は空 */ }
      }

      const closes      = days.map(d => d.close)
      const latest      = days[days.length - 1]
      const prev        = days[days.length - 2]
      const recent5     = days.slice(-5)
      const recent10    = days.slice(-10)
      const recent20    = days.slice(-20)
      const high20d     = recent20.length > 0 ? Math.max(...recent20.map(d => d.high)) : null
      const low20d      = recent20.length > 0 ? Math.min(...recent20.map(d => d.low))  : null
      const high5d      = recent5.length  > 0 ? Math.max(...recent5.map(d => d.high))  : null
      const low5d       = recent5.length  > 0 ? Math.min(...recent5.map(d => d.low))   : null
      const ohlcvRecent = recent10.map((d, i) => {
        const p = recent10[i - 1]
        return { ...d, change_pct: p ? Math.round((d.close - p.close) / p.close * 10000) / 100 : null }
      })
      const macdRes  = calcMACD(closes)
      const ma20w    = weeklyMA20(days)

      // 2. 先物日次（建玉残高・PCR）
      let futures: ShieldMktData['futures'] = { oi_latest: null, oi_delta: null, pcr_latest: null, volume_latest: null, data_as_of: null }
      if (futuresRes.status === 'fulfilled') {
        const fd = futuresRes.value
        const f0 = fd[0], f1 = fd[1]
        if (f0) futures = {
          oi_latest:     f0.oi,
          oi_delta:      f1 != null ? f0.oi - f1.oi : null,
          pcr_latest:    f0.pcr ?? null,
          volume_latest: f0.volume,
          data_as_of:    f0.date,
        }
      }

      // 3. VIX（週次）
      let vix: ShieldMktData['vix'] = { latest: null, change_pct: null }
      if (vixRes.status === 'fulfilled') {
        const vl = vixRes.value[0]  // newest-first
        if (vl) vix = { latest: vl.close, change_pct: vl.changePct ?? null }
      }

      const data: ShieldMktData = {
        built_at: builtAt,
        nk225: {
          latest_date:   latest?.date        ?? builtAt,
          latest_close:  latest?.close       ?? 0,
          change_1d:     latest && prev ? latest.close - prev.close : null,
          change_1d_pct: latest && prev ? Math.round((latest.close - prev.close) / prev.close * 10000) / 100 : null,
          ma20:          calcMA(closes, 20),
          ma60:          calcMA(closes, 60),
          ma200:         calcMA(closes, 200),
          ma20_weekly:   ma20w,
          high_20d:      high20d,
          low_20d:       low20d,
          high_5d:       high5d,
          low_5d:        low5d,
          macd:          macdRes.macd,
          macd_signal:   macdRes.signal,
          macd_hist:     macdRes.hist,
          macd_gc:       macdRes.gc,
          ohlcv_recent:  ohlcvRecent,
        },
        futures,
        vix,
      }
      return { data }
    },
  })
}

// ── ぽいロボ エンジン 直近レポート取得 ─────────────────
export function getRecentEngineReport(): { date: string; text: string } | null {
  try {
    const raw = localStorage.getItem('poical-quant-memo-history')
    if (raw) {
      const history: { date: string; text: string }[] = JSON.parse(raw)
      if (Array.isArray(history) && history.length > 0) {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        // history は新→古順。直近2週間以内で最初に見つかったもの（= 最新）を返す
        const recent = history.find(s => s.date >= twoWeeksAgo && s.text.trim() !== '')
        if (recent) return recent
      }
    }
  } catch { /* noop */ }
  return null
}
