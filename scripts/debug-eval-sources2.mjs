const candidates = [
  'https://www.jsf.co.jp/statistics/',
  'https://www.jsf.co.jp/statistics/usdt/',
  'https://www.jsf.co.jp/',
  'https://kabutan.jp/market/',
  'https://kabutan.jp/market/?tab=major',
  'https://www.nikkei.com/markets/kabu/japanidx/',
  'https://finance.yahoo.co.jp/markets/margin',
  'https://finance.yahoo.co.jp/markets/margin/margin',
]

for (const url of candidates) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(12000),
    })
    const html = await res.text()
    const hasRate = html.includes('評価損益率')
    const has    = html.includes('評価損益')
    let snippet = ''
    const idx = html.indexOf('評価損益')
    if (idx >= 0) snippet = html.slice(Math.max(0,idx-20), idx+80).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()
    console.log(res.status, hasRate ? '★評価損益率あり' : (has ? '△評価損益あり' : '×なし'), url)
    if (snippet) console.log('   snippet:', snippet.slice(0,120))
  } catch (e) {
    console.log('ERR', url, e.message)
  }
}
