import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('../node_modules/xlsx/xlsx.js')

const BASE = 'https://www.jpx.co.jp'

async function get(url, binary = false) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return binary ? res.arrayBuffer() : res.text()
}

const html = await get(BASE + '/markets/statistics-equities/margin/03.html')
const links = [...html.matchAll(/href="(\/[^"]*\.xls[x]?)"/gi)].map(m => BASE + m[1])
console.log('03.html Excel links:', links)

// 最初の1ファイルだけ列ダンプ
if (links.length > 0) {
  const buf = await get(links[0], true)
  const wb  = XLSX.read(buf, { type: 'array' })
  console.log('\nシート名:', wb.SheetNames)
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  console.log('\n先頭15行:')
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    console.log('row[' + i + ']:', rows[i].slice(0, 15).map((v, c) => '[' + c + ']' + String(v).replace(/\n/g,'↵').slice(0, 20)).join('  '))
  }
  // 評価損益 を含む行を検索
  console.log('\n評価損益 を含む行:')
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(v => String(v).includes('評価損益'))) {
      console.log('row[' + i + ']:', rows[i].map((v, c) => '[' + c + ']' + String(v).replace(/\n/g,'↵').slice(0, 25)).join('  '))
    }
  }
}
