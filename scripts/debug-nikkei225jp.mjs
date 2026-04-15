const url = 'https://nikkei225jp.com/data/sinyou.php'

const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  signal: AbortSignal.timeout(15000),
})
console.log('HTTP:', res.status)

const html = await res.text()
console.log('評価損益率:', html.includes('評価損益率'))
console.log('評価損益:',  html.includes('評価損益'))
console.log('サイズ:', html.length, '文字')

// 評価損益 前後のスニペット
const idx = html.indexOf('評価損益')
if (idx >= 0) {
  console.log('\n--- snippet ---')
  console.log(html.slice(Math.max(0, idx - 100), idx + 300).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

// テーブルデータっぽい数値行を抽出（-20〜+20 の小数を含む行）
console.log('\n--- 数値データ行（タグ除去後）---')
const lines = html.replace(/<[^>]+>/g, '\t').split(/[\r\n]+/)
for (const line of lines) {
  const cells = line.split('\t').map(s => s.trim()).filter(Boolean)
  const hasSmallDecimal = cells.some(c => /^-?\d{1,2}\.\d+$/.test(c))
  if (hasSmallDecimal && cells.length >= 3) {
    console.log(cells.join(' | '))
  }
}
