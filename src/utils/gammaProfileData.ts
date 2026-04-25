// ガンマプロファイル（GEX）データ取得・計算
// データソース: Yahoo Finance v7 options API for ^N225（期近限月）

export interface GexBar {
  strike: number     // 権利行使価格
  gex: number        // ガンマエクスポージャー（正=安定化 / 負=不安定化）
  callOI: number
  putOI: number
}

export interface GammaProfileResult {
  updatedAt: Date
  spot: number              // 日経225現在値
  expiryLabel: string       // 期近限月ラベル（例: "5月16日"）
  bars: GexBar[]            // スポット±15%範囲のストライク別GEX
  gammaFlip: number | null  // ガンマフリップ・ストライク（GEXゼロクロス）
  posGexTotal: number       // 正GEX合計
  negGexTotal: number       // 負GEX合計
  netGex: number            // ネットGEX
}

// ── Black-Scholes ガンマ計算 ─────────────────────────
function npdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

function bsGamma(S: number, K: number, T: number, sigma: number): number {
  if (T < 0.003 || sigma < 0.005 || S <= 0 || K <= 0) return 0
  const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T))
  return npdf(d1) / (S * sigma * Math.sqrt(T))
}

function timeToExpiryYears(expirationTs: number): number {
  return Math.max(0, (expirationTs * 1000 - Date.now()) / (365.25 * 24 * 3600 * 1000))
}

// ── 内部型定義 ────────────────────────────────────────
interface RawOption {
  strike: number
  openInterest?: number
  impliedVolatility?: number
  expiration?: number
}

interface RawOptionChain {
  quote?: { regularMarketPrice?: number }
  options?: Array<{
    expirationDate?: number
    calls?: RawOption[]
    puts?: RawOption[]
  }>
}

// ── GEX バー計算 ─────────────────────────────────────
function computeGexBars(
  spot: number,
  calls: RawOption[],
  puts: RawOption[],
  T: number,
): GexBar[] {
  const FALLBACK_IV = 0.20
  type Entry = { callOI: number; putOI: number; callIV: number; putIV: number }
  const map = new Map<number, Entry>()

  for (const c of calls) {
    if (!c.strike || !c.openInterest) continue
    const e = map.get(c.strike) ?? { callOI: 0, putOI: 0, callIV: FALLBACK_IV, putIV: FALLBACK_IV }
    e.callOI += c.openInterest
    if (c.impliedVolatility && c.impliedVolatility > 0.01) e.callIV = c.impliedVolatility
    map.set(c.strike, e)
  }
  for (const p of puts) {
    if (!p.strike || !p.openInterest) continue
    const e = map.get(p.strike) ?? { callOI: 0, putOI: 0, callIV: FALLBACK_IV, putIV: FALLBACK_IV }
    e.putOI += p.openInterest
    if (p.impliedVolatility && p.impliedVolatility > 0.01) e.putIV = p.impliedVolatility
    map.set(p.strike, e)
  }

  // スケール: spot^2 × 0.0001 で数値を適度な範囲に正規化
  const SCALE = spot * spot * 0.0001

  const bars: GexBar[] = []
  for (const [strike, e] of map) {
    // ディーラーGEX規約:
    // ディーラーがクライアントにオプションを売ると仮定（ショートオプション）
    // コール: クライアント買い → ディーラーはショートコール → ショートガンマ
    // プット: クライアント買い → ディーラーはショートプット → ショートガンマ
    // ディーラーGEX = -(callOI × callGamma + putOI × putGamma) × SCALE
    // ただし業界標準では (callOI - putOI) × gamma を使うことが多い
    // ここでは: callOI × callGamma - putOI × putGamma（プットはディーラー有利）
    const callG = bsGamma(spot, strike, T, e.callIV)
    const putG  = bsGamma(spot, strike, T, e.putIV)
    const gex   = (e.callOI * callG - e.putOI * putG) * SCALE
    bars.push({ strike, gex: Math.round(gex * 10) / 10, callOI: e.callOI, putOI: e.putOI })
  }

  return bars.sort((a, b) => a.strike - b.strike)
}

function findGammaFlip(bars: GexBar[]): number | null {
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]
    const curr = bars[i]
    if ((prev.gex >= 0 && curr.gex < 0) || (prev.gex < 0 && curr.gex >= 0)) {
      return Math.abs(prev.gex) <= Math.abs(curr.gex) ? prev.strike : curr.strike
    }
  }
  return null
}

// ── CORS プロキシ経由フェッチ ─────────────────────────
async function fetchViaProxy(url: string): Promise<unknown> {
  const proxies = [
    { mk: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrap: true  },
    { mk: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, wrap: false },
  ]
  let lastErr = '接続エラー'
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.mk(url), { signal: AbortSignal.timeout(14000) })
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue }
      const text = await res.text()
      if (proxy.wrap) {
        const w = JSON.parse(text) as { contents?: string }
        if (w.contents) return JSON.parse(w.contents)
      }
      return JSON.parse(text)
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastErr)
}

// ── キャッシュ ──────────────────────────────────────
const CACHE_KEY = 'poical-gamma-profile'
const CACHE_TTL = 30 * 60 * 1000  // 30分

// ── メインエクスポート ────────────────────────────────
export async function fetchGammaProfile(force = false): Promise<GammaProfileResult> {
  if (!force) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const c = JSON.parse(raw) as { data: GammaProfileResult & { updatedAt: string }; fetchedAt: number }
        if (Date.now() - c.fetchedAt < CACHE_TTL) {
          return { ...c.data, updatedAt: new Date(c.data.updatedAt) }
        }
      }
    } catch { /* ignore */ }
  }

  const TARGET = 'https://query1.finance.yahoo.com/v7/finance/options/%5EN225'
  const json = await fetchViaProxy(TARGET) as { optionChain?: { result?: RawOptionChain[] } }
  const chain = json?.optionChain?.result?.[0]
  if (!chain) throw new Error('オプションデータが取得できませんでした')

  const spot = chain.quote?.regularMarketPrice ?? 0
  if (!spot) throw new Error('日経225現在価格を取得できませんでした')

  const opts = chain.options?.[0]
  if (!opts) throw new Error('期近オプションデータがありません')

  const T = timeToExpiryYears(opts.expirationDate ?? 0)
  const expiryLabel = opts.expirationDate
    ? new Date(opts.expirationDate * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
    : '不明'

  // ±15%フィルタ
  const allBars = computeGexBars(spot, opts.calls ?? [], opts.puts ?? [], T)
  const bars    = allBars.filter(b => b.strike >= spot * 0.85 && b.strike <= spot * 1.15)

  const gammaFlip    = findGammaFlip(bars)
  const posGexTotal  = Math.round(bars.reduce((s, b) => s + Math.max(0, b.gex), 0))
  const negGexTotal  = Math.round(bars.reduce((s, b) => s + Math.min(0, b.gex), 0))
  const netGex       = posGexTotal + negGexTotal

  const result: GammaProfileResult = {
    updatedAt: new Date(),
    spot, expiryLabel, bars, gammaFlip,
    posGexTotal, negGexTotal, netGex,
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, fetchedAt: Date.now() }))
  } catch { /* ignore */ }

  return result
}
