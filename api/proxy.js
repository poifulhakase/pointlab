/**
 * 取得先を固定した読み取り専用プロキシ（CORS 回避用）。
 *
 * 🔴 **1本にまとめてある理由＝Vercel の Hobby は「1デプロイに関数12個まで」**。
 *    もとは `youtube-rss.js` と `rainviewer-weather-maps.js` の2本だったが、
 *    枠が足りなくなったので1本に束ねた（2026-08-30）。中身は元のまま。
 *    昔のURLは `vercel.json` の rewrites でここへ回している＝**呼び出し側は変えなくてよい**。
 *
 *   /api/youtube-rss?url=...            → src=youtube
 *   /api/rainviewer-weather-maps        → src=rainviewer
 */

const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : 'null')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const src = String(req.query.src || '')
  if (src === 'youtube') return youtube(req, res)
  if (src === 'rainviewer') return rainviewer(req, res)
  if (src === 'yahoo') return yahoo(req, res)
  return res.status(400).json({ error: 'unknown source' })
}

/**
 * Yahoo Finance のチャートAPI（VIX・NT倍率・ドル円・NASDAQ100・日経先物の画面が使う）。
 * 🔴 2026-10-10 に無料の CORS プロキシ（allorigins・codetabs）が全部落ちてチャートが出なくなった
 *    → 自前で中継する。取得先は query1/query2.finance.yahoo.com の /v8/finance/chart/ だけ。
 */
async function yahoo(req, res) {
  let target
  try { target = new URL(String(req.query.url || '')) } catch { return res.status(400).json({ error: 'url parameter required' }) }
  if (target.protocol !== 'https:'
    || !['query1.finance.yahoo.com', 'query2.finance.yahoo.com'].includes(target.hostname)
    || !target.pathname.startsWith('/v8/finance/chart/')) {
    return res.status(403).json({ error: 'Only Yahoo Finance chart API is allowed' })
  }
  try {
    const r = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return res.status(502).json({ error: `Yahoo returned ${r.status}` })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    return res.status(200).json(await r.json())
  } catch (e) {
    console.error('[proxy/yahoo]', e)
    return res.status(502).json({ error: 'Yahoo Finance への接続に失敗しました' })
  }
}

/** YouTube RSS フィード（取得先は youtube.com のフィードだけ）。 */
async function youtube(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url parameter required' })

  const decoded = decodeURIComponent(url)
  if (!decoded.startsWith('https://www.youtube.com/feeds/')) {
    return res.status(403).json({ error: 'Only YouTube feeds are allowed' })
  }

  try {
    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        Accept: 'application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      return res.status(response.status).json({ error: `YouTube returned ${response.status}` })
    }
    const text = await response.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).send(text)
  } catch (err) {
    console.error('[proxy/youtube] fetch error:', err)
    return res.status(500).json({ error: 'Failed to fetch YouTube feed' })
  }
}

/** RainViewer の雨雲データ。 */
async function rainviewer(_req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300')
  try {
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    if (!r.ok) throw new Error(`RainViewer API: ${r.status}`)
    return res.status(200).json(await r.json())
  } catch (e) {
    // 内部エラー詳細はクライアントへ返さない（他APIの方針に統一・第13セッション）
    console.error('[proxy/rainviewer]', e)
    return res.status(502).json({ error: 'RainViewer API への接続に失敗しました' })
  }
}
