// Shared proxy fetch utility — CORS bypass for Yahoo Finance and external APIs
// 順番: Yahoo のチャートAPIは自前 /api/proxy?src=yahoo → allorigins.win/get → allorigins.win/raw → codetabs（backoff つき）

type ProxyDef = { url: (u: string) => string; parse: (res: Response) => Promise<unknown> }

const parseRaw = async (res: Response): Promise<unknown> => {
  const text = await res.text()
  try { return JSON.parse(text) } catch { throw new Error(`プロキシ応答エラー: ${text.slice(0, 80)}`) }
}

const parseAlloriginsGet = async (res: Response): Promise<unknown> => {
  const w = await res.json() as { contents?: string }
  if (!w.contents) throw new Error('empty contents')
  try { return JSON.parse(w.contents) } catch { throw new Error(`プロキシ応答エラー: ${w.contents.slice(0, 80)}`) }
}

const PROXY_DEFS: ProxyDef[] = [
  { url: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,      parse: parseAlloriginsGet },
  { url: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,      parse: parseRaw },
  { url: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, parse: parseRaw },
]

// 🔴 Yahoo のチャートAPIは自前の /api/proxy?src=yahoo を先に使う（2026-10-10 に無料プロキシが全滅した）。
//    無料プロキシは自前が落ちたとき（ローカルの vite dev では /api が無い）の予備。
const OWN_YAHOO: ProxyDef = { url: u => `/api/proxy?src=yahoo&url=${encodeURIComponent(u)}`, parse: parseRaw }
const isYahooChart = (u: string) => /^https:\/\/query[12]\.finance\.yahoo\.com\/v8\/finance\/chart\//.test(u)

export async function proxyFetch(target: string, timeoutMs = 12000): Promise<unknown> {
  const defs = isYahooChart(target) ? [OWN_YAHOO, ...PROXY_DEFS] : PROXY_DEFS
  let lastErr = ''
  for (let i = 0; i < defs.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 500 * i))
    const def = defs[i]
    try {
      const res = await fetch(def.url(target), { signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await def.parse(res)
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastErr)
}
