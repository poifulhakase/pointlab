import { fetchWithCache } from './dataCache'
import { proxyFetch } from './proxyFetch'

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
}

const CACHE_KEY        = 'poical-nk-futures-price-v4'
const CACHE_TTL_OPEN   = 30 * 60 * 1000
const CACHE_TTL_CLOSED = 2  * 60 * 60 * 1000
const NK_FUTURES_DAYS  = 10

function isMarketOpen(): boolean {
  const day = new Date().getUTCDay()
  return day !== 0 && day !== 6
}


type OhlcvRaw = { date: string; open: number; high: number; low: number; close: number; volume: number | null }

function parseYahooOhlcv(json: unknown): NkFuturesDayData[] {
  const r = (json as any)?.chart?.result?.[0]
  if (!r) throw new Error('レスポンス形式が不正')
  const ts:      number[]          = r.timestamp ?? []
  const q                           = r.indicators?.quote?.[0] ?? {}
  const opens:   (number | null)[] = q.open   ?? []
  const highs:   (number | null)[] = q.high   ?? []
  const lows:    (number | null)[] = q.low    ?? []
  const closes:  (number | null)[] = q.close  ?? []
  const volumes: (number | null)[] = q.volume ?? []

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
    })
  }
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
      const data = await fetchFromYahoo()
      if (data.length === 0) throw new Error('データが取得できませんでした')
      return { data }
    },
  })
}
