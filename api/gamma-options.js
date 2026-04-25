/**
 * Yahoo Finance v7 オプションAPI プロキシ
 * サーバーサイドで取得するので CORS の制約なし
 * ^N225（日経225）のオプションチェーンデータを返す
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const URLS = [
    'https://query1.finance.yahoo.com/v7/finance/options/%5EN225',
    'https://query2.finance.yahoo.com/v7/finance/options/%5EN225',
  ]

  let lastErr = '取得エラー'
  for (const url of URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
          'Origin': 'https://finance.yahoo.com',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) { lastErr = `HTTP ${response.status}`; continue }

      const data = await response.json()
      if (!data?.optionChain?.result?.[0]) { lastErr = 'optionChain 未取得'; continue }

      // Vercel Edge CDN で5分キャッシュ
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
      return res.status(200).json(data)
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }

  return res.status(502).json({ error: lastErr })
}
