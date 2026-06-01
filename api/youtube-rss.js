/**
 * YouTube RSS フィードプロキシ
 * サーバーサイドで取得するのでCORSの制約なし
 * Vercel Edge Cache: 1時間
 */
const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : 'null')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { url } = req.query
  if (!url) {
    return res.status(400).json({ error: 'url parameter required' })
  }

  // YouTube フィードのみ許可
  const decoded = decodeURIComponent(url)
  if (!decoded.startsWith('https://www.youtube.com/feeds/')) {
    return res.status(403).json({ error: 'Only YouTube feeds are allowed' })
  }

  try {
    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'application/xml, text/xml, */*',
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
    console.error('[youtube-rss] fetch error:', err)
    return res.status(500).json({ error: 'Failed to fetch YouTube feed' })
  }
}
