// 信用評価損益率 の取得候補ソースを調査
const sources = [
  // 株探 - 市場統計ページ
  'https://kabutan.jp/news/marketnews/?category=3',
  // Traders Web - 信用取引統計
  'https://www.traders.co.jp/domestic_stocks/invest_tool/credit/credit_top.asp',
  // みんかぶ - 信用残高
  'https://minkabu.jp/stock_plan/shinyo',
]

for (const url of sources) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(12000),
    })
    const html = await res.text()
    const has = html.includes('評価損益')
    const hasRate = html.includes('評価損益率')
    // 評価損益率の前後テキストを抽出
    let snippet = ''
    const idx = html.indexOf('評価損益率')
    if (idx >= 0) snippet = html.slice(Math.max(0, idx - 30), idx + 80).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    console.log('\n' + url)
    console.log('  HTTP:', res.status, '| 評価損益:', has, '| 評価損益率:', hasRate)
    if (snippet) console.log('  snippet:', snippet)
  } catch (e) {
    console.log('\n' + url)
    console.log('  エラー:', e.message)
  }
}
