// NS倍率 = 日経平均 ÷ S&P500（日足・Yahoo Finance プロキシ経由）

export interface NtRatioPoint {
  time:   string        // YYYY-MM-DD
  nikkei: number        // 日経225終値
  sp500:  number        // S&P500終値
  ratio:  number        // NS倍率
  change: number | null // 前日比（倍率）
}

const NT_CACHE_KEY = 'poical-ns-ratio-data'
const NT_CACHE_TTL = 30 * 60 * 1000 // 30分

function readNtCache(): { data: NtRatioPoint[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(NT_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as { data: NtRatioPoint[]; fetchedAt: number }
    if (Date.now() - cache.fetchedAt > NT_CACHE_TTL) return null
    return cache
  } catch { return null }
}

function writeNtCache(data: NtRatioPoint[]) {
  try {
    localStorage.setItem(NT_CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController()
  setTimeout(() => ac.abort(), ms)
  return ac.signal
}

// Yahoo Finance v8 の JSON → date→close マップ
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

type ProxyDef = { url: (u: string) => string; parse: (res: Response) => Promise<unknown> }

const parseRaw = async (res: Response) => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`プロキシ応答エラー: ${text.slice(0, 80)}`)
  }
}
const parseAlloriginsGet = async (res: Response) => {
  const w = await res.json() as { contents?: string }
  if (!w.contents) throw new Error('empty contents')
  try {
    return JSON.parse(w.contents)
  } catch {
    throw new Error(`プロキシ応答エラー: ${w.contents.slice(0, 80)}`)
  }
}

const PROXY_DEFS: ProxyDef[] = [
  { url: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,            parse: parseAlloriginsGet },
  { url: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,            parse: parseRaw },
  { url: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,       parse: parseRaw },
]

async function tryFetch(target: string): Promise<Map<string, number>> {
  let lastErr = ''
  for (const def of PROXY_DEFS) {
    try {
      const res = await fetch(def.url(target), { signal: timeoutSignal(12000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseYahooClose(await def.parse(res))
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastErr)
}

async function fetchSymbol(sym: string): Promise<Map<string, number>> {
  const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`
  const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`
  try {
    return await tryFetch(q1)
  } catch {
    return await tryFetch(q2)
  }
}

export async function fetchNtRatioData(force = false): Promise<NtRatioPoint[]> {
  if (!force) {
    const cached = readNtCache()
    if (cached) return cached.data
  }

  // 日経225 と S&P500 を直列取得（同一プロキシへの同時リクエストによるレート制限を回避）
  const nikkeiMap = await fetchSymbol('^N225')
  await new Promise(r => setTimeout(r, 800))
  const sp500Map  = await fetchSymbol('^GSPC')

  // 共通日付のみ抽出・計算
  const dates = Array.from(nikkeiMap.keys())
    .filter(d => sp500Map.has(d))
    .sort()

  const pts: NtRatioPoint[] = dates.map((time, i) => {
    const nikkei = nikkeiMap.get(time)!
    const sp500  = sp500Map.get(time)!
    const ratio  = Math.round((nikkei / sp500) * 1000) / 1000
    const prev   = i > 0 ? Math.round((nikkeiMap.get(dates[i - 1])! / sp500Map.get(dates[i - 1])!) * 1000) / 1000 : null
    return {
      time,
      nikkei,
      sp500,
      ratio,
      change: prev != null ? Math.round((ratio - prev) * 1000) / 1000 : null,
    }
  })

  writeNtCache(pts)
  return pts
}
