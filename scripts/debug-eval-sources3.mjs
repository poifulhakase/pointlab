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

// ── 03.html の mtgaisan ファイルの全列を確認 ─────────
console.log('=== 03.html mtgaisan 全列チェック ===')
try {
  const html = await get(BASE + '/markets/statistics-equities/margin/03.html')
  const links = [...html.matchAll(/href="(\/[^"]*mtgaisan[^"]*\.xls[x]?)"/gi)].map(m => BASE + m[1])
  const url = links[0]
  console.log('ファイル:', url)
  const buf = await get(url, true)
  const wb  = XLSX.read(buf, { type: 'array' })
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  // 全列表示（スライスなし）
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const cells = rows[i].map((v, c) => `[${c}]${String(v).replace(/\n/g,'↵').slice(0,15)}`).filter(x => !x.endsWith(']'))
    if (cells.length > 0) console.log(`row[${i}]:`, cells.join('  '))
  }
  // -7.67 付近の値を持つセルを探す
  console.log('\n小数値（-20〜+20）を含む行を検索:')
  for (let i = 0; i < rows.length; i++) {
    const hits = rows[i].map((v,c) => ({c,v})).filter(({v}) => typeof v === 'number' && v > -20 && v < 20 && v !== 0 && Math.abs(v) < 15 && String(v).includes('.'))
    if (hits.length > 0) console.log(`row[${i}]:`, hits.map(({c,v}) => `[${c}]=${v}`).join('  '))
  }
} catch(e) { console.log('エラー:', e.message) }

// ── 日証金 ────────────────────────────────────────
console.log('\n=== 日証金（jsf.co.jp）===')
const jsfUrls = [
  'https://www.jsf.co.jp/statistics/',
  'https://www.jsf.co.jp/statistics/usdt/index.html',
  'https://www.jsf.co.jp/statistics/credit/',
  'https://www.jsf.co.jp/',
]
for (const url of jsfUrls) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    const hasRate = html.includes('評価損益率')
    const has     = html.includes('評価損益')
    let snippet = ''
    const idx = html.indexOf('評価損益')
    if (idx >= 0) snippet = html.slice(Math.max(0,idx-30), idx+100).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()
    console.log(res.status, hasRate ? '★評価損益率あり' : (has ? '△評価損益あり' : '×'), url)
    if (snippet) console.log('  snippet:', snippet.slice(0,150))
  } catch(e) { console.log('ERR', url, e.message) }
}
