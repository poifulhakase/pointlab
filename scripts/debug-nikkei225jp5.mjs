// dailyweek2.json の列構造を解析して信用評価損益率の列を特定する
const BASE = 'https://nikkei225jp.com'

const res = await fetch(BASE + '/_data/_nfsWEB/DAY/dailyweek2.json', {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://nikkei225jp.com/data/sinyou.php' },
  signal: AbortSignal.timeout(15000),
})
const text = await res.text()

// "var DAILY = [...]" をパース
const match = text.match(/var DAILY\s*=\s*(\[[\s\S]*\])/)
if (!match) { console.log('DAILYが見つかりません'); process.exit(1) }

const data = JSON.parse(match[1])
console.log(`全行数: ${data.length}`)
console.log(`列数: ${data[0]?.length}`)

// 各列の統計（最新200行で集計）
const recent = data.slice(-200)
const colCount = data[0].length
console.log('\n=== 各列の値サンプル（最新5行、空でない列のみ）===')
for (let col = 0; col < colCount; col++) {
  const vals = recent.map(r => r[col]).filter(v => v !== '' && v != null)
  if (vals.length === 0) continue
  const nums = vals.filter(v => typeof v === 'number')
  if (nums.length === 0) continue
  const min = Math.min(...nums).toFixed(2)
  const max = Math.max(...nums).toFixed(2)
  const latest5 = recent.slice(-5).map(r => r[col]).filter(v => v !== '').join(', ')
  console.log(`col[${col}]: 件数=${nums.length} min=${min} max=${max} | 直近: ${latest5}`)
}

// 信用評価損益率の特定：-20〜+5 の小数値が集まる列を探す
console.log('\n=== 信用評価損益率候補（-20〜+5 の範囲）===')
for (let col = 0; col < colCount; col++) {
  const vals = recent.map(r => r[col]).filter(v => typeof v === 'number')
  if (vals.length < 10) continue
  const allInRange = vals.every(v => v >= -25 && v <= 5)
  const hasDec = vals.some(v => !Number.isInteger(v))
  if (allInRange && hasDec) {
    const latest10 = data.slice(-10).map(r => {
      const d = new Date(r[0])
      return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} → ${r[col]}`
    })
    console.log(`\n★ col[${col}] が候補:`)
    latest10.forEach(l => console.log('  ', l))
  }
}
