const CONTRIB_URL = 'https://nikkeiyosoku.com/nikkei225_kiyodo/'
const SECTOR_URL  = 'https://nikkeiyosoku.com/stock/sector/ranking_rateup/'
const NK_DAYS     = 10

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.5',
  'Cache-Control': 'no-cache',
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  const buf = await res.arrayBuffer()
  // Detect charset from Content-Type; fallback to UTF-8
  const ct = res.headers.get('content-type') || ''
  const csMatch = ct.match(/charset=([^\s;]+)/i)
  const charset = csMatch ? csMatch[1] : 'utf-8'
  return new TextDecoder(charset).decode(buf)
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseContribution(html) {
  const items = []
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trM
  while ((trM = trRe.exec(html)) !== null) {
    const rowHtml = trM[1]
    const cells = []
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdM
    while ((tdM = tdRe.exec(rowHtml)) !== null) {
      cells.push(stripTags(tdM[1]))
    }
    if (cells.length < 3) continue

    // First cell must be a 4–5 digit stock code
    const code = cells[0].replace(/\D/g, '')
    if (!/^\d{4,5}$/.test(code)) continue

    const name = cells[1] || ''
    if (!name) continue
    // Skip test/garbage entries (e.g. "あああああ" — repeated single character)
    if (/^(.)\1{2,}$/u.test(name)) continue

    // Third cell: contribution value (±float, eg "+12.34" or "−5.23")
    const raw = cells[2].replace(/[^\d.+\-−]/g, '').replace('−', '-')
    const contribution = parseFloat(raw)
    if (isNaN(contribution)) continue

    items.push({ code, name, contribution })
  }
  // Sort descending by contribution (largest positive first)
  return items.sort((a, b) => b.contribution - a.contribution)
}

function parseSector(html) {
  // Actual structure:
  //   <ul class="list-inline list-unstyled sector-rank">
  //     <li><a href="/stock/sector/9/">石油・石炭製品</a></li>
  //     <li><span class="rise">+3.72%</span></li>
  //   </ul>
  const items = []
  const ulRe = /<ul[^>]*class="[^"]*sector-rank[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi
  let ulM
  while ((ulM = ulRe.exec(html)) !== null) {
    const ulHtml = ulM[1]

    // Sector name from <a href="/stock/sector/N/">
    const aM = ulHtml.match(/<a\s[^>]*href="\/stock\/sector\/\d+\/?[^"]*"[^>]*>([^<]+)<\/a>/)
    if (!aM) continue
    const name = aM[1].trim()
    if (!name || name.length < 2) continue

    // Rate from <span class="rise"> or <span class="fall">
    const spanM = ulHtml.match(/<span\s+class="(?:rise|fall)">([^<]+)<\/span>/)
    if (!spanM) continue
    const changePct = parseFloat(spanM[1].replace('−', '-').replace(/[^\d.+\-]/g, ''))
    if (isNaN(changePct) || Math.abs(changePct) > 30) continue

    items.push({ name, changePct })
  }
  return items.sort((a, b) => b.changePct - a.changePct)
}

async function fetchStockSector(code) {
  try {
    const html = await fetchHtml(`https://nikkeiyosoku.com/stock/${code}/`)
    // <li><span class="listed-cate listed"><a href="/stock/sector/17/">輸送用機器</a></span></li>
    const m = html.match(/class="listed-cate[^"]*"[^>]*>[\s\S]{0,80}?<a[^>]*href="\/stock\/sector\/\d+\/?[^"]*"[^>]*>([^<]+)<\/a>/)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

// ── 日経先物（Yahoo Finance NK=F） ────────────────────────────

function parseYahooOhlcv(json) {
  const r = json?.chart?.result?.[0]
  if (!r) return []
  const ts      = r.timestamp ?? []
  const q       = r.indicators?.quote?.[0] ?? {}
  const opens   = q.open   ?? []
  const highs   = q.high   ?? []
  const lows    = q.low    ?? []
  const closes  = q.close  ?? []
  const volumes = q.volume ?? []

  const valid = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (c == null) continue
    valid.push({
      date:   new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open:   Math.round(opens[i]  ?? c),
      high:   Math.round(highs[i]  ?? c),
      low:    Math.round(lows[i]   ?? c),
      close:  Math.round(c),
      volume: volumes[i] != null ? Math.round(volumes[i]) : null,
    })
  }

  valid.sort((a, b) => a.date.localeCompare(b.date))

  // +1 item buffer to compute prev_close for the oldest output row
  const buf      = valid.slice(-(NK_DAYS + 1))
  const startIdx = buf.length > NK_DAYS ? 1 : 0
  const result   = []
  for (let i = startIdx; i < buf.length; i++) {
    const d    = buf[i]
    const prev = i > 0 ? buf[i - 1] : null
    result.push({
      date:       d.date,
      open:       d.open,
      high:       d.high,
      low:        d.low,
      close:      d.close,
      volume:     d.volume,
      prev_close: prev?.close ?? null,
      change:     prev != null ? d.close - prev.close : null,
      change_pct: prev != null && prev.close > 0
        ? Math.round((d.close - prev.close) / prev.close * 10000) / 100
        : null,
    })
  }
  return result
}

async function fetchNkFutures() {
  const symbols = ['NK%3DF', '%5EN225']
  for (const sym of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=3mo`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
      })
      if (!res.ok) continue
      const json = await res.json()
      const data = parseYahooOhlcv(json)
      if (data.length > 0) return data
    } catch { continue }
  }
  return []
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const [contribHtml, sectorHtml, nkFutures] = await Promise.all([
      fetchHtml(CONTRIB_URL),
      fetchHtml(SECTOR_URL),
      fetchNkFutures(),
    ])

    const allContrib   = parseContribution(contribHtml)
    const allSector    = parseSector(sectorHtml)
    const contribTotal = Math.round(allContrib.reduce((s, x) => s + x.contribution, 0) * 100) / 100

    let up5   = allContrib.filter(x => x.contribution > 0).slice(0, 5)
    let down5 = [...allContrib.filter(x => x.contribution < 0)].reverse().slice(0, 5)
    const sec5u = allSector.filter(x => x.changePct > 0).slice(0, 5)
    const sec5d = [...allSector.filter(x => x.changePct < 0)].reverse().slice(0, 5)

    // Fetch sector for each displayed stock in parallel
    const displayed = [...up5, ...down5]
    const sectors   = await Promise.all(displayed.map(x => fetchStockSector(x.code)))
    const sectorMap = Object.fromEntries(displayed.map((x, i) => [x.code, sectors[i] ?? null]))
    const addSector = item => ({ ...item, sector: sectorMap[item.code] ?? null })
    up5   = up5.map(addSector)
    down5 = down5.map(addSector)

    return res.status(200).json({
      contribution: { up: up5, down: down5, total: contribTotal },
      sector:       { up: sec5u, down: sec5d },
      nkFutures,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[stocks-daily]', e)
    return res.status(500).json({ error: String(e) })
  }
}
