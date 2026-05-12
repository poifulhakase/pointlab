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

const CACHE_KEY        = 'poical-nk-futures-price'
const CACHE_TTL_OPEN   = 30 * 60 * 1000
const CACHE_TTL_CLOSED = 2  * 60 * 60 * 1000
const NK_FUTURES_DAYS  = 10

function isMarketOpen(): boolean {
  const day = new Date().getUTCDay()
  return day !== 0 && day !== 6
}

function writeCache(data: NkFuturesDayData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
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
    if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null) continue
    valid.push({
      date:   new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open:   Math.round(opens[i]!),
      high:   Math.round(highs[i]!),
      low:    Math.round(lows[i]!),
      close:  Math.round(closes[i]!),
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
  const q    = `interval=1d&range=1mo`
  const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${q}`
  const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?${q}`
  try {
    return parseYahooOhlcv(await proxyFetch(url1))
  } catch {
    return parseYahooOhlcv(await proxyFetch(url2))
  }
}

async function fetchFromYahoo(): Promise<NkFuturesDayData[]> {
  // NK=F: CME 日経225先物（円建て連続限月）→ 取得失敗時は ^N225（日経225指数）で代替
  try {
    return await fetchSymbolOhlcv('NK=F')
  } catch {
    return fetchSymbolOhlcv('^N225')
  }
}

export async function fetchNkFuturesPriceData(force = false): Promise<NkFuturesDayData[]> {
  let stale: NkFuturesDayData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as { data: NkFuturesDayData[]; fetchedAt: number }
      stale = c.data
      if (!force) {
        const ttl = isMarketOpen() ? CACHE_TTL_OPEN : CACHE_TTL_CLOSED
        if (Date.now() - c.fetchedAt <= ttl) return c.data
      }
    }
  } catch { /* ignore */ }

  try {
    const data = await fetchFromYahoo()
    writeCache(data)
    return data
  } catch (e) {
    if (stale) return stale
    throw e
  }
}
