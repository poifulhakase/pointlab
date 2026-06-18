// TOPIX 日足終値プロキシ（NT倍率用）
// 取得元: stooq.com ^tpx 日足CSV。stooq は CORS 不可かつ近時ブラウザ向けに
// JSチャレンジを返すため、サーバー側（Vercel Functions の egress IP）から取得して
// 同一オリジンの JSON として返す。フロントは /api/topix → 失敗時 /data/topix.json の順に読む。
//
// 返却: { updatedAt: ISO, data: [{ time: 'YYYY-MM-DD', close: number }] }（直近約1年）

const STOOQ_URLS = [
  'https://stooq.com/q/d/l/?s=%5Etpx&i=d',
  'https://stooq.pl/q/d/l/?s=%5Etpx&i=d',
]

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Referer': 'https://stooq.com/',
}

function parseCsv(text) {
  // CSV: Date,Open,High,Low,Close,Volume
  const lines = text.trim().split('\n')
  if (!/^Date,/i.test(lines[0] || '')) return [] // チャレンジHTML等はヘッダ不一致で弾く
  const points = []
  for (const line of lines.slice(1)) {
    const cols = line.split(',')
    const date  = cols[0]?.trim()
    const close = parseFloat(cols[4])
    if (!date || isNaN(close) || close <= 0) continue
    points.push({ time: date, close: Math.round(close * 100) / 100 })
  }
  points.sort((a, b) => a.time.localeCompare(b.time))
  return points.slice(-252)
}

async function fetchTopix() {
  for (const url of STOOQ_URLS) {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS })
      if (!res.ok) continue
      const data = parseCsv(await res.text())
      if (data.length > 0) return data
    } catch { /* 次のミラーへ */ }
  }
  return []
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const data = await fetchTopix()
    if (data.length === 0) {
      return res.status(502).json({ error: 'TOPIXデータを取得できませんでした' })
    }
    return res.status(200).json({ updatedAt: new Date().toISOString(), data })
  } catch (e) {
    console.error('[topix]', e)
    return res.status(500).json({ error: 'TOPIXデータの取得に失敗しました' })
  }
}
