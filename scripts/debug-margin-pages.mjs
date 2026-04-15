const BASE = 'https://www.jpx.co.jp'
for (const n of ['01','02','03']) {
  fetch(BASE + '/markets/statistics-equities/margin/' + n + '.html', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  })
    .then(r => r.text())
    .then(h => {
      const xlsLinks = (h.match(/href="[^"]*\.xls/gi) || []).length
      console.log(n + '.html  評価損益率:', h.includes('評価損益'), ' Excelリンク:', xlsLinks)
    })
    .catch(e => console.log(n + '.html  エラー:', e.message))
}
