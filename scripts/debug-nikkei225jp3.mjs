const url = 'https://nikkei225jp.com/data/sinyou.php'

const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  signal: AbortSignal.timeout(15000),
})
const html = await res.text()

// ── script タグ内の fetch / ajax / url / .php / .json を探す ──
console.log('=== script タグ内のAPI候補 ===')
const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/gi)]
for (const s of scripts) {
  const src = s[0]
  // fetch, XMLHttpRequest, url=, .php, .json, .csv などを含む行を抽出
  const lines = src.split('\n').filter(l =>
    /fetch|XMLHttp|\.php|\.json|\.csv|ajax|url\s*[:=]|getJSON|axios/i.test(l)
  )
  if (lines.length > 0) {
    console.log('\n--- script ---')
    lines.forEach(l => console.log(' ', l.trim().slice(0, 200)))
  }
}

// ── src 属性付き script タグ（外部JS）───────────────
console.log('\n=== 外部JSファイル ===')
const extScripts = [...html.matchAll(/<script[^>]+src=["']?([^"'\s>]+)/gi)]
extScripts.forEach(m => console.log(' ', m[1]))

// ── nikkei225jp.com ドメインのリンクを全抽出 ──────────
console.log('\n=== 同ドメインの .php / .json / .csv リンク ===')
const links = [...html.matchAll(/(?:href|src|url)\s*=\s*["']?([^"'\s>]*(?:\.php|\.json|\.csv)[^"'\s>]*)/gi)]
const unique = [...new Set(links.map(m => m[1]))]
unique.forEach(l => console.log(' ', l))

// ── data- 属性を探す ────────────────────────────────
console.log('\n=== data-* 属性（データ埋め込みの可能性）===')
const dataAttrs = [...html.matchAll(/data-[\w-]+="([^"]{10,100})"/g)]
dataAttrs.slice(0, 10).forEach(m => console.log(' ', m[0].slice(0, 150)))
