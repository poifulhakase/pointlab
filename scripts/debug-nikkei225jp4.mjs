const BASE = 'https://nikkei225jp.com'
const files = [
  '/_data/_nfsWEB/HS_DATA_DAY/R111.json',
  '/_data/_nfsWEB/HS_DATA_DAY/S511.json',
  '/_data/_nfsWEB/DAY/dailyweek2.json',
]

for (const path of files) {
  const url = BASE + path
  console.log('\n=== ' + path + ' ===')
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://nikkei225jp.com/data/sinyou.php' },
      signal: AbortSignal.timeout(10000),
    })
    console.log('HTTP:', res.status, 'Content-Type:', res.headers.get('content-type'))
    const text = await res.text()
    console.log('サイズ:', text.length, '文字')
    console.log('先頭300文字:', text.slice(0, 300))
    console.log('末尾200文字:', text.slice(-200))
  } catch(e) {
    console.log('エラー:', e.message)
  }
}
