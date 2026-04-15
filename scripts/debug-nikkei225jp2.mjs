const url = 'https://nikkei225jp.com/data/sinyou.php'

const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  signal: AbortSignal.timeout(15000),
})
const html = await res.text()

// ── 評価損益率 周辺の生HTML を表示 ─────────────────
console.log('=== 評価損益率 周辺の生HTML ===')
const idx = html.indexOf('評価損益率')
console.log(html.slice(Math.max(0, idx - 200), idx + 500))

// ── table タグを全て抽出して中身を確認 ─────────────
console.log('\n\n=== テーブル内容（先頭5テーブル）===')
const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)]
console.log(`テーブル数: ${tableMatches.length}`)
for (let i = 0; i < Math.min(5, tableMatches.length); i++) {
  const text = tableMatches[i][0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)
  console.log(`\n--- table[${i}] ---`)
  console.log(text)
}

// ── td の数値を全抽出 ─────────────────────────────
console.log('\n\n=== td 要素の数値（-99〜+99の小数）===')
const tdMatches = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
const seen = new Set()
for (const m of tdMatches) {
  const val = m[1].replace(/<[^>]+>/g, '').trim()
  if (/^-?\d{1,2}\.\d{1,2}$/.test(val) && !seen.has(val)) {
    seen.add(val)
    // 前後のtdも取得
    const pos = m.index
    const ctx = html.slice(Math.max(0, pos - 200), pos + 100).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    console.log(`値: ${val}  | 文脈: ${ctx.slice(-120)}`)
  }
}
