#!/usr/bin/env node
// JPXデータ取得スクリプト
// 使い方: npm run fetch-data
// 出力:   public/data/investor.json
//         public/data/margin.json

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('../node_modules/xlsx/xlsx.js')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = join(__dirname, '..')
const OUT_DIR   = join(ROOT, 'public', 'data')

const BASE = 'https://www.jpx.co.jp'

// ── ユーティリティ ─────────────────────────────

async function fetchBinary(url) {
  console.log('  GET', url)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.arrayBuffer()
}

async function fetchHtml(url) {
  const buf = await fetchBinary(url)
  return new TextDecoder('utf-8').decode(buf)
}

function parseNum(s) {
  if (typeof s === 'number') return s
  const n = parseFloat(String(s).replace(/[,\s\r\n，]/g, ''))
  return isNaN(n) ? 0 : n
}

function serialToDateStr(serial) {
  const d = XLSX.SSF.parse_date_code(serial)
  if (!d) return ''
  return `${d.y}/${String(d.m).padStart(2,'0')}/${String(d.d).padStart(2,'0')}`
}

function dateToLabel(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const m = d.getMonth() + 1
  const w = Math.ceil(d.getDate() / 7)
  const KANJI = ['', '第1週', '第2週', '第3週', '第4週', '第5週']
  return `${m}月${KANJI[w] ?? '末'}`
}

function senToOku(senYen) {
  return Math.round(senYen / 100) / 1000
}

// ── 投資主体別売買動向 ────────────────────────

async function fetchInvestorData() {
  // 今年・昨年のアーカイブページから stock_val_ リンクを収集
  const archivePages = [
    `${BASE}/markets/statistics-equities/investor-type/00-00-archives-00.html`, // 今年
    `${BASE}/markets/statistics-equities/investor-type/00-00-archives-01.html`, // 昨年
  ]

  const urls = []
  for (const pageUrl of archivePages) {
    try {
      console.log(`\n[investor] アーカイブ取得: ${pageUrl}`)
      const html = await fetchHtml(pageUrl)
      const re = /href="(\/[^"]*stock_val_[^"]*\.xls[x]?)"/gi
      let m
      while ((m = re.exec(html)) !== null) urls.push(BASE + m[1])
    } catch (e) {
      console.warn(`  ✗ ${pageUrl}: ${e.message}`)
    }
  }

  if (urls.length === 0) throw new Error('stock_val_ リンクが見つかりません')
  console.log(`[investor] ${urls.length}件のファイルを発見（最大26件処理）`)

  const combined = []

  for (const url of urls.slice(0, 26)) {  // 26ファイル × 2週 = 最大52週
    try {
      const buf  = await fetchBinary(url)
      const wb   = XLSX.read(buf, { type: 'array' })
      const wsName = wb.SheetNames.find(n => n.includes('Tokyo & Nagoya')) ?? wb.SheetNames[0]
      const ws   = wb.Sheets[wsName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
      const parsed = parseInvestorSheet(rows)
      combined.push(...parsed)
      console.log(`  → ${parsed.length}週`)
    } catch (e) {
      console.warn(`  ✗ ${url}: ${e.message}`)
    }
  }

  // 降順ソート・重複除去・最大52週
  combined.sort((a, b) => b.date.localeCompare(a.date))
  const seen = new Set()
  return combined.filter(r => {
    if (seen.has(r.date)) return false
    seen.add(r.date); return true
  }).slice(0, 52)
}

function parseInvestorSheet(rows) {
  // 年を取得
  let fileYear = new Date().getFullYear()
  for (let ri = 0; ri < Math.min(8, rows.length); ri++) {
    const ym = String(rows[ri][0] ?? '').match(/(\d{4})年/)
    if (ym) { fileYear = parseInt(ym[1]); break }
  }

  // 週列を検出
  const weekCols = []
  for (let ri = 0; ri < Math.min(20, rows.length); ri++) {
    const row = rows[ri]
    const found = []
    for (let ci = 0; ci < row.length; ci++) {
      const cell = String(row[ci] ?? '').trim()
      if (/\d{1,2}\/\d{1,2}～\d{1,2}\/\d{1,2}/.test(cell)) {
        found.push({ label: cell, dateCol: ci, balCol: ci + 3 })
      }
    }
    if (found.length > 0) { weekCols.push(...found); break }
  }
  if (weekCols.length === 0) return []

  // 同一ファイル内に早い月（1〜3月）と遅い月（10〜12月）が混在する場合、
  // 遅い月は年をまたいで前年のデータとして扱う（例: 2026年ファイルの12月→2025年）
  const allLabels = weekCols.map(wc => wc.label)
  const hasEarlyMonth = allLabels.some(l => {
    const mm = l.match(/(\d{1,2})\/\d{1,2}$/)
    return mm && parseInt(mm[1]) <= 3
  })

  function weekEndDate(label) {
    const m = label.match(/(\d{1,2})\/(\d{1,2})$/)
    if (!m) return ''
    const endMon = parseInt(m[1])
    const endDay = parseInt(m[2])
    let year = (endMon >= 10 && hasEarlyMonth) ? fileYear - 1 : fileYear
    // 上記ロジックで漏れた場合のフォールバック:
    // 生成日付が今日から2ヶ月以上先なら前年データと判断して -1
    const candidate = new Date(`${year}-${String(endMon).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`)
    const twoMonthsAhead = new Date()
    twoMonthsAhead.setMonth(twoMonthsAhead.getMonth() + 2)
    if (candidate > twoMonthsAhead) year -= 1
    return `${year}/${String(endMon).padStart(2,'0')}/${String(endDay).padStart(2,'0')}`
  }

  const catKeywords = [
    { keywords: ['海外投資家'], key: 'foreigner' },
    { keywords: ['個　人', '個人'],  key: 'individual' },
    { keywords: ['信託銀行'],        key: 'trustBank' },
    { keywords: ['自己計'],          key: 'securities' },
  ]

  const weekMap = new Map()
  for (const wc of weekCols) {
    const dt = weekEndDate(wc.label)
    if (dt) weekMap.set(dt, { foreigner: 0, individual: 0, trustBank: 0, securities: 0 })
  }

  let activeCat = null
  let sellRow   = null

  for (const row of rows) {
    const c0 = String(row[0] ?? '').trim()
    const c1 = String(row[1] ?? '').trim()

    for (const def of catKeywords) {
      if (def.keywords.some(kw => c0.replace(/　/g, '') === kw.replace(/　/g, ''))) {
        activeCat = def.key; sellRow = null; break
      }
    }
    if (!activeCat) continue

    if (c1 === '売り') {
      sellRow = row
    } else if (c1 === '買い' && sellRow) {
      for (const wc of weekCols) {
        const dt = weekEndDate(wc.label)
        if (!dt || !weekMap.has(dt)) continue
        const sVal = parseNum(sellRow[wc.balCol])
        const bVal = parseNum(row[wc.balCol])
        weekMap.get(dt)[activeCat] = sVal !== 0 ? sVal : bVal
      }
      sellRow = null; activeCat = null
    }
  }

  const result = []
  for (const [dt, entry] of weekMap) {
    result.push({
      date:       dt,
      label:      dateToLabel(dt),
      foreigner:  senToOku(entry.foreigner),
      individual: senToOku(entry.individual),
      trustBank:  senToOku(entry.trustBank),
      securities: senToOku(entry.securities),
    })
  }
  return result
}

// ── 信用評価損益率（nikkei225jp.com） ────────────────

function tsToJSTDateStr(ts) {
  // UNIXタイムスタンプ(ms) → JST日付文字列 YYYY/MM/DD
  const d = new Date(ts + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}`
}

async function fetchEvalRatioMap() {
  console.log('[evalRatio] nikkei225jp.com から信用評価損益率取得...')
  const res = await fetch('https://nikkei225jp.com/_data/_nfsWEB/DAY/dailyweek2.json', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)',
      'Referer':    'https://nikkei225jp.com/data/sinyou.php',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()

  const m = text.match(/var DAILY\s*=\s*(\[[\s\S]*?\])\s*;/)
  if (!m) throw new Error('DAILYデータが見つかりません')

  const rows = JSON.parse(m[1])
  const map  = new Map()
  for (const row of rows) {
    if (typeof row[7] !== 'number') continue
    map.set(tsToJSTDateStr(row[0]), Math.round(row[7] * 100) / 100)
  }
  console.log(`  → ${map.size}件`)
  return map
}

// ── 信用倍率 ──────────────────────────────────

async function fetchMarginData() {
  console.log('\n[margin] 過去推移表取得...')
  const combined = []

  // 過去推移表
  try {
    const html = await fetchHtml(`${BASE}/markets/statistics-equities/margin/06.html`)
    const m = /href="(\/markets\/statistics-equities\/margin\/[^"]*\.xls[x]?)"/.exec(html)
    if (!m) throw new Error('過去推移表リンクが見つかりません')
    const url = BASE + m[1]
    const buf = await fetchBinary(url)
    const wb  = XLSX.read(buf, { type: 'array' })
    const wsName = wb.SheetNames.find(n => n.includes('信用')) ?? wb.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: '' })
    for (const row of rows) {
      if (typeof row[0] !== 'number' || row[0] < 30000) continue
      const dateStr  = serialToDateStr(row[0])
      if (!dateStr) continue
      const shortBal = typeof row[2] === 'number' ? row[2] : 0   // 合計売残 金額
      const longBal  = typeof row[4] === 'number' ? row[4] : 0   // 合計買残 金額
      if (shortBal <= 0 && longBal <= 0) continue
      const ratio = shortBal > 0 ? Math.round((longBal / shortBal) * 100) / 100 : 0
      combined.push({ date: dateStr, label: dateToLabel(dateStr), longBal, shortBal, ratio })
    }
    console.log(`  → ${combined.length}週`)
  } catch (e) {
    console.warn(`  ✗ 過去推移表: ${e.message}`)
  }

  // 週次スナップショット（最新補完）
  console.log('[margin] 週次スナップショット取得...')
  try {
    const html = await fetchHtml(`${BASE}/markets/statistics-equities/margin/04.html`)
    const urls = []
    const re = /href="(\/markets\/statistics-equities\/margin\/[^"]*mtseisan[^"]*\.xls[x]?)"/gi
    let m
    while ((m = re.exec(html)) !== null) urls.push(BASE + m[1])

    for (const url of urls.slice(0, 5)) {
      try {
        const buf = await fetchBinary(url)
        const wb  = XLSX.read(buf, { type: 'array' })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
        const header = String(rows[0]?.[0] ?? '')
        const dm = header.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
        if (!dm) continue
        const dateStr = `${dm[1]}/${dm[2].padStart(2,'0')}/${dm[3].padStart(2,'0')}`
        // 二市場計 行を探す: 株数行の次の行が金額行（Excelセル結合のため c1 が空になる）
        let sawNiShijyo = false
        for (const row of rows) {
          const c1 = String(row[1] ?? '').replace(/\n.*/, '')
          const c2 = String(row[2] ?? '').replace(/\n.*/, '')
          if (c1.includes('二市場')) { sawNiShijyo = true; continue }
          if (sawNiShijyo && c2.includes('金額')) {
            const shortBal = typeof row[11] === 'number' ? row[11] : 0
            const longBal  = typeof row[13] === 'number' ? row[13] : 0
            if (shortBal > 0 || longBal > 0) {
              const ratio = shortBal > 0 ? Math.round((longBal / shortBal) * 100) / 100 : 0
              combined.push({ date: dateStr, label: dateToLabel(dateStr), longBal, shortBal, ratio })
            }
            break
          }
          sawNiShijyo = false
        }
      } catch (e) {
        console.warn(`  ✗ ${url}: ${e.message}`)
      }
    }
  } catch (e) {
    console.warn(`  ✗ 週次スナップショット: ${e.message}`)
  }

  // 信用評価損益率をマージ
  try {
    const evalMap = await fetchEvalRatioMap()
    for (const r of combined) {
      r.evalRatio = evalMap.get(r.date) ?? null
    }
  } catch (e) {
    console.warn(`  ✗ 信用評価損益率: ${e.message}`)
    for (const r of combined) r.evalRatio = null
  }

  // 降順ソート・重複除去・最大52週
  combined.sort((a, b) => b.date.localeCompare(a.date))
  const seen = new Set()
  return combined.filter(r => {
    if (seen.has(r.date)) return false
    seen.add(r.date); return true
  }).slice(0, 52)
}

// ── VIX（Yahoo Finance） ──────────────────────────

async function fetchVixData() {
  console.log('\n[vix] Yahoo Finance から週次データ取得...')
  // 2年分の週次 VIX を取得
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1wk&range=5y'
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('レスポンス形式が不正')

  const timestamps = result.timestamp ?? []
  const closes     = result.indicators?.quote?.[0]?.close ?? []

  const rows = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (close == null || isNaN(close)) continue
    const d = new Date(timestamps[i] * 1000)
    const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
    rows.push({ date: dateStr, close: Math.round(close * 100) / 100 })
  }

  // 降順ソート・最大104週
  rows.sort((a, b) => b.date.localeCompare(a.date))
  // 前週比を付与
  return rows.slice(0, 104).map((r, i, arr) => {
    const prev = arr[i + 1]?.close ?? null
    const change = prev != null ? Math.round((r.close - prev) * 100) / 100 : null
    const changePct = prev != null ? Math.round(((r.close - prev) / prev) * 10000) / 100 : null
    return { ...r, change, changePct }
  })
}

// ── メイン ─────────────────────────────────────

async function main() {
  console.log('=== JPXデータ取得開始 ===')
  mkdirSync(OUT_DIR, { recursive: true })

  let investorOk = false
  let marginOk   = false
  let vixOk      = false

  try {
    const data = await fetchInvestorData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'investor.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ investor.json 保存 (${data.length}件)`)
    investorOk = true
  } catch (e) {
    console.error('\n✗ investor:', e.message)
  }

  try {
    const data = await fetchMarginData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'margin.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ margin.json 保存 (${data.length}件)`)
    marginOk = true
  } catch (e) {
    console.error('\n✗ margin:', e.message)
  }

  try {
    const data = await fetchVixData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'vix.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ vix.json 保存 (${data.length}件)`)
    vixOk = true
  } catch (e) {
    console.error('\n✗ vix:', e.message)
  }

  console.log('\n=== 完了 ===')
  // VIXはYahoo Finance のIP制限で失敗することがあるため警告のみ
  if (!investorOk || !marginOk) process.exit(1)
  if (!vixOk) console.warn('⚠ vix.json は更新されませんでした（既存ファイルを維持）')
}

main().catch(e => { console.error(e); process.exit(1) })
