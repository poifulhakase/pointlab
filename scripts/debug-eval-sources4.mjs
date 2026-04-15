const candidates = [
  // Yahoo Finance Japan
  'https://finance.yahoo.co.jp/markets/margin/margin',
  'https://finance.yahoo.co.jp/markets/stockjp/margin',
  'https://finance.yahoo.co.jp/markets/stockjp/',
  // JSDA 日本証券業協会
  'https://www.jsda.or.jp/shiryoshitsu/statistics/',
  'https://www.jsda.or.jp/shiryoshitsu/toukei/shinyou/',
  // 日証金 別パス
  'https://www.jsf.co.jp/service/margin/',
  'https://www.jsf.co.jp/info/statistics.html',
  // SBI証券 公開ページ
  'https://www.sbisec.co.jp/ETGate/WPLETmgR001Control?OutSide=on&getFlg=on&burl=search_market&cat1=market&cat2=none&dir=info&file=market_margin.html',
  // 東証 相場概況
  'https://www.jpx.co.jp/markets/statistics-equities/weekly/',
]

for (const url of candidates) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })
    const html = await res.text()
    const hasRate = html.includes('評価損益率')
    const has    = html.includes('評価損益')
    let snippet = ''
    const idx = html.indexOf('評価損益')
    if (idx >= 0) snippet = html.slice(Math.max(0,idx-30), idx+120).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,150)
    console.log(res.status, hasRate ? '★評価損益率あり' : (has ? '△評価損益あり' : '×なし'), url)
    if (snippet) console.log('   ->', snippet)
  } catch(e) {
    console.log('ERR', e.message.slice(0,60), url)
  }
}
