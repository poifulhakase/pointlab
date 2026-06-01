import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'
import { parseYahooChart } from './yahooChart'

export interface NkFuturesDayData {
  date:       string        // YYYY-MM-DD
  open:       number        // 始値
  high:       number        // 高値
  low:        number        // 安値
  close:      number        // 終値
  volume:     number | null // 出来高
  prev_close: number | null // 前日終値
  change:     number | null // 前日比（円）
  change_pct: number | null // 前日比（%）
  ma25_dev:   number | null // 25日移動平均乖離率（%）。全系列から算出（直近24日未満はnull）
}

// 25日MA乖離率を日付→乖離率(%)のMapで返す。rows は昇順（古→新）前提。
// (close - 25日SMA) / 25日SMA * 100。直近24日分が揃わない行はMapに含めない（=null扱い）。
function buildMa25DevMap(rows: { date: string; close: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 24; i < rows.length; i++) {
    let sum = 0
    for (let j = i - 24; j <= i; j++) sum += rows[j].close
    const ma = sum / 25
    if (ma > 0) map.set(rows[i].date, Math.round((rows[i].close - ma) / ma * 10000) / 100)
  }
  return map
}

const CACHE_KEY        = 'poical-nk-futures-price-v4'
const CACHE_TTL_OPEN   = 30 * 60 * 1000
const CACHE_TTL_CLOSED = 2  * 60 * 60 * 1000
const NK_FUTURES_DAYS  = 10
const STATIC_JSON_URL  = `${import.meta.env.BASE_URL}data/nk_futures_price.json`
const STATIC_MAX_AGE   = 12 * 60 * 60 * 1000

function isMarketOpen(): boolean {
  const day = new Date().getUTCDay()
  return day !== 0 && day !== 6
}


type OhlcvRaw = { date: string; open: number; high: number; low: number; close: number; volume: number | null }

function parseYahooOhlcv(json: unknown): NkFuturesDayData[] {
  const parsed = parseYahooChart(json)
  if (!parsed) throw new Error('レスポンス形式が不正')
  const ts      = parsed.timestamps
  const opens   = parsed.open
  const highs   = parsed.high
  const lows    = parsed.low
  const closes  = parsed.close
  const volumes = parsed.volume

  const valid: OhlcvRaw[] = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (c == null) continue
    // open/high/low が null の場合（指数など）は close で代替
    valid.push({
      date:   new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open:   Math.round(opens[i]  ?? c),
      high:   Math.round(highs[i]  ?? c),
      low:    Math.round(lows[i]   ?? c),
      close:  Math.round(c),
      volume: volumes[i] != null ? Math.round(volumes[i]!) : null,
    })
  }

  valid.sort((a, b) => a.date.localeCompare(b.date))

  // 25日MA乖離率は切り詰め前の全系列（約3ヶ月）から算出して各行に付与する
  const devMap = buildMa25DevMap(valid)

  // +1 item buffer to compute prev_close for the oldest output row
  const buf      = valid.slice(-(NK_FUTURES_DAYS + 1))
  const startIdx = buf.length > NK_FUTURES_DAYS ? 1 : 0
  const result: NkFuturesDayData[] = []
  for (let i = startIdx; i < buf.length; i++) {
    const d         = buf[i]
    const prev      = i > 0 ? buf[i - 1] : null
    const change    = prev != null ? d.close - prev.close : null
    const changePct = prev != null && prev.close > 0
      ? Math.round((d.close - prev.close) / prev.close * 10000) / 100
      : null
    result.push({
      date:       d.date,
      open:       d.open,
      high:       d.high,
      low:        d.low,
      close:      d.close,
      volume:     d.volume,
      prev_close: prev?.close ?? null,
      change,
      change_pct: changePct,
      ma25_dev:   devMap.get(d.date) ?? null,
    })
  }
  result.sort((a, b) => b.date.localeCompare(a.date)) // 降順（最新が先頭）
  return result
}

async function fetchSymbolOhlcv(sym: string): Promise<NkFuturesDayData[]> {
  const q    = `interval=1d&range=3mo`
  // プロキシ(allorigins.win)側のキャッシュをバイパスするため10分単位のバスターを付与
  const bust = Math.floor(Date.now() / (10 * 60 * 1000))
  const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${q}&_=${bust}`
  const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${q}&_=${bust}`
  try {
    return parseYahooOhlcv(await proxyFetch(url1))
  } catch {
    return parseYahooOhlcv(await proxyFetch(url2))
  }
}

async function fetchFromYahoo(): Promise<NkFuturesDayData[]> {
  // ^N225 をプライマリ（JST当日データあり）、NK=F をフォールバック
  // NK=F は CME ベースで常に JST 約1日遅れのため
  try {
    const data = await fetchSymbolOhlcv('^N225')
    if (data.length > 0) return data
    throw new Error('^N225: empty result')
  } catch (e) {
    console.warn('[nkFutures] ^N225 failed, falling back to NK=F:', e)
    return fetchSymbolOhlcv('NK=F')
  }
}

export async function fetchNkFuturesPriceData(force = false): Promise<NkFuturesDayData[]> {
  return fetchWithCache({
    key: CACHE_KEY,
    ttl: () => isMarketOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED,
    force,
    fetcher: async () => {
      // 静的 JSON を優先（fetch-data スクリプトで毎日生成）
      try {
        const res = await fetch(STATIC_JSON_URL)
        if (res.ok) {
          const json = await res.json() as { updatedAt: string; data: NkFuturesDayData[] }
          const age = Date.now() - new Date(json.updatedAt).getTime()
          if (age < STATIC_MAX_AGE && json.data?.length > 0) {
            return { data: json.data }
          }
        }
      } catch { /* fall through */ }

      // フォールバック: Yahoo Finance プロキシ経由
      const data = await fetchFromYahoo()
      if (data.length === 0) throw new Error('データが取得できませんでした')
      return { data }
    },
  })
}
