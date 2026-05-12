#!/usr/bin/env node
// 市場データ取得スクリプト
// 使い方: npm run fetch-data
// 出力:   public/data/investor.json, public/data/margin.json, public/data/cot_nikkei.json 他

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX    = require('../node_modules/xlsx/xlsx.js')
const AdmZip  = require('../node_modules/adm-zip')

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

function parseCSVLine(line) {
  const result = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuotes = !inQuotes }
    else if (c === ',' && !inQuotes) { result.push(field); field = '' }
    else { field += c }
  }
  result.push(field)
  return result
}

function serialToDateStr(serial) {
  const d = XLSX.SSF.parse_date_code(serial)
  if (!d) return ''
  return `${d.y}/${String(d.m).padStart(2,'0')}/${String(d.d).padStart(2,'0')}`
}

function dateToLabel(dateStr) {
  const raw = (typeof dateStr === 'string' ? dateStr : String(dateStr)).replace(/\//g, '-')
  const d = new Date(raw)
  if (isNaN(d.getTime())) return dateStr
  const m = d.getMonth() + 1
  const y = d.getFullYear()

  // この日付が属する週の月曜日を求める（ISO: 月曜=週頭）
  const dow = d.getDay()  // 0=日, 1=月, ..., 6=土
  const daysToMon = dow === 0 ? -6 : 1 - dow
  const monDate = new Date(d)
  monDate.setDate(d.getDate() + daysToMon)

  // 月曜が前月なら「第1週（前週またがり）」
  if (monDate.getMonth() + 1 !== m || monDate.getFullYear() !== y) {
    return `${m}月第1週`
  }

  // その月の1日が属する週の月曜日を基準に週番号を算出
  const firstDay  = new Date(y, m - 1, 1)
  const firstDow  = firstDay.getDay()
  const daysToFirstMon = firstDow === 0 ? -6 : 1 - firstDow
  const firstWeekMon = new Date(firstDay)
  firstWeekMon.setDate(1 + daysToFirstMon)

  const msPerWeek = 7 * 24 * 3600 * 1000
  const weekNum   = Math.round((monDate.getTime() - firstWeekMon.getTime()) / msPerWeek) + 1

  const KANJI = ['', '第1週', '第2週', '第3週', '第4週', '第5週', '第6週']
  return `${m}月${KANJI[weekNum] ?? '末'}`
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

// ── nikkei225jp.com 複合データ取得 ───────────────────
// dailyweek2.json の列構成（確認済み）:
//   col[0]: タイムスタンプ(ms)
//   col[2]: 値上がり銘柄数
//   col[3]: 値下がり銘柄数
//   col[4]: 騰落レシオ(25日) ← 範囲30〜300で自動検出
//   col[6]: 空売り比率(%)    ← 範囲20〜65で自動検出
//   col[7]: 信用評価損益率(%) ← 確定列

function tsToJSTDateStr(ts) {
  const d = new Date(ts + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}`
}

// 列インデックスを値の範囲から自動検出する
function detectColumn(rows, minVal, maxVal, startCol = 1, endCol = 12) {
  const sampleRows = rows.filter(r => typeof r[7] === 'number').slice(0, 20)
  if (sampleRows.length < 5) return -1
  for (let col = startCol; col <= endCol; col++) {
    const vals = sampleRows.map(r => r[col]).filter(v => typeof v === 'number')
    if (vals.length < 5) continue
    const allInRange = vals.every(v => v >= minVal && v <= maxVal)
    if (allInRange) return col
  }
  return -1
}

// モジュール内でメトリクスをキャッシュして重複リクエスト防止
let _metricsCache = null

/**
 * nikkei225jp.com dailyweek2.json から信用評価損益率を取得（1回のみリクエスト）
 * Returns: { evalRatioMap }
 */
async function fetchNikkeiJpMetrics() {
  if (_metricsCache) return _metricsCache
  console.log('[nikkei225jp] dailyweek2.json 取得...')
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
  console.log(`  → ${rows.length}行取得`)

  const evalRatioMap = new Map()
  for (const row of rows) {
    if (typeof row[0] !== 'number') continue
    const dateStr = tsToJSTDateStr(row[0])
    if (typeof row[7] === 'number')
      evalRatioMap.set(dateStr, Math.round(row[7] * 100) / 100)
  }

  console.log(`  信用評価損益率: ${evalRatioMap.size}件`)
  _metricsCache = { evalRatioMap }
  return _metricsCache
}

async function fetchEvalRatioMap() {
  const { evalRatioMap } = await fetchNikkeiJpMetrics()
  return evalRatioMap
}

// daily2year.json キャッシュ
let _daily2yearCache = null

/**
 * nikkei225jp.com daily2year.json から騰落レシオ・空売り比率・PCRを一括取得
 * 確認済み列構成:
 *   col[0]:  タイムスタンプ(ms)
 *   col[7]:  騰落レシオ(25日) - 範囲 76〜155
 *   col[11]: 空売り比率(%)    - 範囲 16〜71
 *   col[16]: PCR（プット/コールOI比） - 範囲 0.75〜2.52
 * Returns: { touhiMap, shortSellMap, pcrMap }
 */
async function fetchDaily2YearMetrics() {
  if (_daily2yearCache) return _daily2yearCache
  console.log('[nikkei225jp] daily2year.json 取得...')
  const res = await fetch('https://nikkei225jp.com/_data/_nfsWEB/DAY/daily2year.json', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)',
      'Referer':    'https://nikkei225jp.com/data/karauri.php',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()

  const m = text.match(/var DAILY\s*=\s*(\[[\s\S]*?\])\s*;/)
  if (!m) throw new Error('DAILYデータが見つかりません')

  const rows = JSON.parse(m[1])
  console.log(`  → ${rows.length}行取得`)

  if (rows.length > 0) {
    const first = rows[rows.length - 1]
    console.log('  [列確認] 最新行:', first.slice(0, 17).map((v, i) => `[${i}]=${v}`).join(', '))
  }

  const touhiMap    = new Map()  // col[7]: 騰落レシオ(25日)
  const shortSellMap = new Map() // col[11]: 空売り比率(%)
  const pcrMap       = new Map() // col[16]: PCR

  for (const row of rows) {
    if (typeof row[0] !== 'number') continue
    const dateStr = tsToJSTDateStr(row[0])
    if (typeof row[7] === 'number')
      touhiMap.set(dateStr, Math.round(row[7] * 100) / 100)
    if (typeof row[11] === 'number')
      shortSellMap.set(dateStr, Math.round(row[11] * 100) / 100)
    if (typeof row[16] === 'number' && row[16] > 0)
      pcrMap.set(dateStr, Math.round(row[16] * 1000) / 1000)
  }

  console.log(`  騰落レシオ: ${touhiMap.size}件, 空売り比率: ${shortSellMap.size}件, PCR: ${pcrMap.size}件`)
  _daily2yearCache = { touhiMap, shortSellMap, pcrMap }
  return _daily2yearCache
}

// 日次データマップ → 週次配列（各週の末営業日データを採用）
function dailyToWeekly(dateValMap, maxWeeks = 52) {
  const weekMap = new Map() // "YYYY-MM-DD"(月曜日) → { date, val }
  for (const [dateStr, val] of dateValMap) {
    const d = new Date(dateStr.replace(/\//g, '-'))
    if (isNaN(d.getTime())) continue
    const dow = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const weekKey = monday.toISOString().slice(0, 10)
    const existing = weekMap.get(weekKey)
    if (!existing || dateStr > existing.date) {
      weekMap.set(weekKey, { date: dateStr, val })
    }
  }
  return Array.from(weekMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, maxWeeks)
    .map(({ date, val }) => ({ date, label: dateToLabel(date), val }))
}

/**
 * nikkei225jp.com の特定ページ（touphi.php / karauri.php）から DAILY 配列を取得
 * 各ページは `var DAILY = [[timestamp, val1, val2, ...], ...]` 形式で埋め込まれている
 */
async function fetchNikkeiJpPageData(pageUrl, referer) {
  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)',
      'Referer':    referer,
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${pageUrl}`)
  const text = await res.text()

  // DAILY 配列を抽出（複数パターン）
  const patterns = [
    /var DAILY\s*=\s*(\[[\s\S]*?\])\s*;/,
    /DAILY\s*=\s*(\[[\s\S]*?\])\s*[;,]/,
  ]
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      try {
        return JSON.parse(m[1])
      } catch { /* continue */ }
    }
  }
  throw new Error(`DAILY データが見つかりません: ${pageUrl}`)
}

// ── 騰落レシオ ────────────────────────────────────
// daily2year.json col[7]: 騰落レシオ(25日) 確認済み

async function buildAdvanceDeclineData() {
  console.log('\n[advanceDecline] 騰落レシオ取得中...')
  const { touhiMap } = await fetchDaily2YearMetrics()
  if (touhiMap.size === 0) throw new Error('騰落レシオデータが空です')

  const weekly = dailyToWeekly(touhiMap)
  return weekly.map(({ date, label, val }) => ({
    date,
    label,
    ratio25:  val,
    advances: null,
    declines: null,
  }))
}

// ── 空売り比率 ─────────────────────────────────────
// daily2year.json col[11]: 空売り比率(%) 確認済み

async function buildShortSellData() {
  console.log('\n[shortSell] 空売り比率取得中...')
  const { shortSellMap } = await fetchDaily2YearMetrics()
  if (shortSellMap.size === 0) throw new Error('空売り比率データが空です')

  const weekly = dailyToWeekly(shortSellMap)
  return weekly.map(({ date, label, val }) => ({ date, label, ratio: val }))
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

// ── ドル円（Yahoo Finance） ────────────────────────

async function fetchUsdjpyData() {
  console.log('\n[usdjpy] Yahoo Finance から日次データ取得...')
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/USDJPY%3DX?interval=1d&range=3mo'
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
    const time = d.toISOString().slice(0, 10)  // YYYY-MM-DD
    rows.push({ time, close: Math.round(close * 100) / 100 })
  }

  // 昇順ソート（MA計算）
  rows.sort((a, b) => a.time.localeCompare(b.time))

  // 前日比・MA5・MA5乖離率を付与
  const enriched = rows.map((r, i) => {
    const prev     = i > 0 ? rows[i - 1].close : null
    const change   = prev != null ? Math.round((r.close - prev) * 100) / 100 : null
    const changePct = prev != null ? Math.round((r.close - prev) / prev * 10000) / 100 : null
    let ma5 = null
    if (i >= 4) {
      const sum = rows.slice(i - 4, i + 1).reduce((acc, d) => acc + d.close, 0)
      ma5 = Math.round(sum / 5 * 100) / 100
    }
    const ma5dev = ma5 != null ? Math.round((r.close - ma5) / ma5 * 10000) / 100 : null
    return { time: r.time, close: r.close, change, changePct, ma5, ma5dev }
  })

  // 降順ソート・最新90件
  enriched.sort((a, b) => b.time.localeCompare(a.time))
  return enriched.slice(0, 90)
}

// ── PCR（プット・コール・レシオ）─────────────────────
// データソース: nikkei225jp.com/_data/_nfsWEB/DAY/daily2year.json col[16]
// PCR = プットOI / コールOI  通常値域: 0.75〜2.52（日経225オプション）
// fetchDaily2YearMetrics() と同一ファイルをキャッシュ共有

async function fetchPcrDailyMap() {
  console.log('\n[pcr] daily2year.json col[16] から PCRデータ取得（キャッシュ共有）...')
  const { pcrMap } = await fetchDaily2YearMetrics()
  console.log(`  → ${pcrMap.size}件`)
  return pcrMap
}

// ── 裁定買い残 ────────────────────────────────────
// データソース: nikkei225jp.com/_data/_nfsWEB/HS_DATA_DAY/daily_saitei.json
// 確認済み列構成（2026-04-19 確認）:
//   col[0]:  タイムスタンプ(ms)
//   col[7]:  裁定買い残 株数（千株）
//   col[8]:  裁定買い残 金額（百万円） ← メインで使用
//   col[9]:  裁定売り残 株数（千株）
//   col[10]: 裁定売り残 金額（百万円）

async function buildArbitrageData() {
  console.log('\n[arbitrage] 裁定買い残取得中...')

  const res = await fetch('https://nikkei225jp.com/_data/_nfsWEB/HS_DATA_DAY/daily_saitei.json', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer':    'https://nikkei225jp.com/data/saitei.php',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()

  const m = text.match(/var DAILY\s*=\s*(\[[\s\S]*\])\s*;?\s*$/)
  if (!m) throw new Error('DAILY データが見つかりません')
  const rows = JSON.parse(m[1])
  console.log(`  → ${rows.length}行取得`)

  const longBalMap  = new Map()
  const shortBalMap = new Map()

  for (const row of rows) {
    if (typeof row[0] !== 'number') continue
    const dateStr = tsToJSTDateStr(row[0])
    if (typeof row[8] === 'number' && row[8] > 0)
      longBalMap.set(dateStr, row[8])
    if (typeof row[10] === 'number' && row[10] > 0)
      shortBalMap.set(dateStr, row[10])
  }

  if (longBalMap.size === 0) throw new Error('裁定買い残データが空です')
  console.log(`  裁定買い残: ${longBalMap.size}件, 裁定売り残(金額あり): ${shortBalMap.size}件`)

  // 週次（JPX毎週金曜公表）なのでそのまま最新52件を取る。
  // 昇順（古→新）でLOCF処理し、最後に降順（新→古）に戻す（他データソースと統一）。
  const sortedAsc = [...longBalMap.keys()].sort()
  const last52Asc = sortedAsc.slice(-52)

  // 売り残金額は毎週公表されず col[9](株数) と col[10](金額) が交互になる週がある。
  // LOCF（前値補完）: 欠損週は直前の既知値を引き継ぐ。
  let lastKnownShortBal = 0
  const weekly = last52Asc.map(date => {
    const short = shortBalMap.get(date)
    if (short != null && short > 0) lastKnownShortBal = short
    return {
      date,
      label:    dateToLabel(date),
      longBal:  longBalMap.get(date),
      shortBal: lastKnownShortBal,
    }
  }).reverse() // 降順（新→古）に統一

  // 日次: 最新30営業日 + 前日比デルタ
  const last31Asc = sortedAsc.slice(-31)
  const daily = last31Asc.slice(1).map((date, i) => {
    const prev = longBalMap.get(last31Asc[i])
    const cur  = longBalMap.get(date)
    return {
      date,
      longBal:      cur,
      longBalDelta: prev != null && cur != null ? cur - prev : null,
    }
  }).reverse() // 降順（新→古）

  return { weekly, daily }
}

// ── 先物建玉残高（OI） ────────────────────────────────
// データソース: JPX月間統計資料「指数先物取引取引状況（日別）」
// URL: /automation/markets/statistics-derivatives/monthly-statistics/files/{YYYY}/SIF_D_{YYYYMM}.xlsx
// 列構成: col[1]=商品名, col[0]=日, col[9]=OIマーカー(◎●), col[10]=建玉現在高(枚)
// 公表タイミング: 翌月上旬（約1ヶ月遅延）→ GitHub Actions が月次で自動取得

async function buildFuturesOIData() {
  console.log('\n[futuresOI] 先物建玉残高（OI）取得中...')

  const STATS_REFERER = `${BASE}/markets/statistics-derivatives/monthly-statistics/index.html`
  const STATS_BASE    = `${BASE}/automation/markets/statistics-derivatives/monthly-statistics`

  // 1. 年一覧 JSON を取得
  const yearListRes = await fetch(`${STATS_BASE}/json/monthly_statistics_report_yearlist.json`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Referer': STATS_REFERER },
    signal: AbortSignal.timeout(20000),
  })
  if (!yearListRes.ok) throw new Error(`yearList HTTP ${yearListRes.status}`)
  const yearList = await yearListRes.json()

  // 2. 各年の月別ファイルURLを収集
  const MONTH_KEYS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fileEntries = [] // { year, month, url }

  for (const { Year, Jsonfile } of yearList.TableDatas) {  // 全年取得
    const reportRes = await fetch(`${BASE}${Jsonfile}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Referer': STATS_REFERER },
      signal: AbortSignal.timeout(20000),
    })
    if (!reportRes.ok) continue
    const report = await reportRes.json()
    const row = report.TableDatas.find(r => r.Quotations === '指数先物取引取引状況（日別）')
    if (!row) continue
    for (let mi = 0; mi < MONTH_KEYS.length; mi++) {
      const urlPath = row[MONTH_KEYS[mi]]
      if (urlPath && urlPath !== '-') {
        fileEntries.push({ year: parseInt(Year), month: mi + 1, url: `${BASE}${urlPath}` })
      }
    }
  }

  // 全利用可能月（降順）
  fileEntries.sort((a, b) => b.year - a.year || b.month - a.month)
  const entriesToFetch = fileEntries  // 全期間取得（JPXは3年分公開）
  console.log(`  ${entriesToFetch.length}ヶ月分のファイルを取得`)

  // 3. 各月の Excel から col[10]=建玉現在高 を抽出
  const dailyOIMap = new Map() // "YYYY/MM/DD" → oi(枚)

  for (const { year, month, url } of entriesToFetch) {
    try {
      const buf  = await fetchBinary(url)
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
      let count = 0
      for (const row of rows) {
        if (row[1] !== '日経225先物') continue
        const day = parseInt(String(row[0]))
        if (!day || day < 1 || day > 31) continue
        const oi = typeof row[10] === 'number' ? row[10] : null
        if (oi && oi > 0) {
          const dateStr = `${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`
          dailyOIMap.set(dateStr, oi)
          count++
        }
      }
      console.log(`  ${year}/${String(month).padStart(2,'0')}: ${count}日分`)
    } catch (e) {
      console.warn(`  ✗ ${year}/${month}: ${e.message}`)
    }
  }

  if (dailyOIMap.size === 0) throw new Error('OIデータが取得できませんでした')

  // 4. 週次変換（各週の最終営業日を採用）
  const weekly = dailyToWeekly(dailyOIMap, 52)
  return weekly.map(({ date, label, val }) => ({ date, label, oi: val }))
}

// ── CFTC COT 日経225先物（TFF形式: Leveraged Funds / Asset Mgr+Dealer / Non-Reportable） ─
// データソース: CFTC Traders in Financial Futures; Futures-Only Report (週次・火曜基準・金曜公表)
// 最新週: https://www.cftc.gov/dea/newcot/FinFutWk.txt
// 年次ZIP: https://www.cftc.gov/files/dea/history/fut_fin_txt_YYYY.zip
// 列構成(0-indexed, TFF形式): [1]=YYMMDD, [7]=OI,
//   [8]=Dealer Long, [9]=Dealer Short, [11]=AM Long, [12]=AM Short,
//   [14]=LevFunds Long, [15]=LevFunds Short, [20]=NonRept Long, [21]=NonRept Short
// nonComm = Leveraged Funds, comm = Dealer + Asset Manager
async function buildCotNikkeiData() {
  console.log('\n[cotNikkei] CFTC COT Traders in Financial Futures取得中...')

  // 既存JSONを読み込んで履歴を維持
  const existingPath = join(OUT_DIR, 'cot_nikkei.json')
  const existingMap = new Map()
  try {
    const raw = readFileSync(existingPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.data)) parsed.data.forEach(e => existingMap.set(e.date, e))
  } catch { /* 初回は空 */ }

  // TFF形式テキストをパースしてexistingMapに追記
  function parseTffText(text) {
    let added = 0
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const fields = parseCSVLine(trimmed)
      if (!(fields[0] ?? '').toUpperCase().includes('NIKKEI')) continue
      const yymmdd = (fields[1] ?? '').trim()
      if (!/^\d{6}$/.test(yymmdd)) continue
      const oi = parseNum(fields[7])
      if (!oi) continue  // ヘッダー行スキップ

      const dateStr = `20${yymmdd.slice(0,2)}-${yymmdd.slice(2,4)}-${yymmdd.slice(4,6)}`
      const ncL = parseNum(fields[14])  // Leveraged Funds Long
      const ncS = parseNum(fields[15])  // Leveraged Funds Short
      const cL  = parseNum(fields[8]) + parseNum(fields[11])  // Dealer Long + AM Long
      const cS  = parseNum(fields[9]) + parseNum(fields[12])  // Dealer Short + AM Short
      const nrL = parseNum(fields[20])  // NonRept Long
      const nrS = parseNum(fields[21])  // NonRept Short

      existingMap.set(dateStr, {
        date:         dateStr,
        label:        dateToLabel(dateStr),
        openInterest: oi,
        nonCommLong:  ncL, nonCommShort: ncS, nonCommNet: ncL - ncS,
        commLong:     cL,  commShort:    cS,  commNet:    cL  - cS,
        nonReptLong:  nrL, nonReptShort: nrS, nonReptNet: nrL - nrS,
      })
      added++
    }
    return added
  }

  // 最新週ファイル取得
  const weeklyText = await fetchHtml('https://www.cftc.gov/dea/newcot/FinFutWk.txt')
  const weeklyAdded = parseTffText(weeklyText)
  console.log(`  → 週次ファイル: ${weeklyAdded}件`)

  // 履歴が少ない場合は年次ZIPから補完（初回起動時）
  if (existingMap.size < 8) {
    const currentYear = new Date().getFullYear()
    for (const year of [currentYear, currentYear - 1]) {
      try {
        const zipUrl = `https://www.cftc.gov/files/dea/history/fut_fin_txt_${year}.zip`
        console.log(`  GET ${zipUrl}`)
        const res = await fetch(zipUrl, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) { console.warn(`  ⚠ ${year} zip: HTTP ${res.status}`); continue }
        const buf = Buffer.from(await res.arrayBuffer())
        const zip = new AdmZip(buf)
        for (const entry of zip.getEntries()) {
          if (entry.entryName.toLowerCase().endsWith('.txt')) {
            const cnt = parseTffText(entry.getData().toString('utf-8'))
            console.log(`  → ${year} zip (${entry.entryName}): ${cnt}件`)
          }
        }
      } catch (e) {
        console.warn(`  ⚠ ${year} zip取得失敗: ${e.message}`)
      }
    }
  }

  if (existingMap.size === 0) throw new Error('NIKKEIデータが見つかりません')
  console.log(`  → 合計${existingMap.size}件`)

  return [...existingMap.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 52)
}

// ── TOPIX日次（NT倍率用） ──────────────────────────
// データソース: stooq.com ^tpx 日足CSV（サーバーサイドのみ直接アクセス可）

async function buildTopixData() {
  console.log('\n[topix] stooq から TOPIX日次データ取得...')
  const url = 'https://stooq.com/q/d/l/?s=%5Etpx&i=d'
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/csv,text/plain,*/*',
      'Referer': 'https://stooq.com/',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()

  // CSV: Date,Open,High,Low,Close,Volume
  const lines = text.trim().split('\n').slice(1)
  const points = []
  for (const line of lines) {
    const cols = line.split(',')
    const date  = cols[0]?.trim()
    const close = parseFloat(cols[4])
    if (!date || isNaN(close) || close <= 0) continue
    points.push({ time: date, close: Math.round(close * 100) / 100 })
  }

  if (points.length === 0) throw new Error('TOPIXデータが空です')
  points.sort((a, b) => a.time.localeCompare(b.time))
  console.log(`  → ${points.length}件取得`)
  return points.slice(-252) // 約1年分
}

// ── 先物日次OI・取引高（PDF抽出） ────────────────────────────────
// JPX日報ZIP: OseAll = /automation/markets/statistics-derivatives/daily/files/YYYYMM/Daily_Report_OSE_YYYYMMDD.zip
// ZIP内の sif_dyr_YYYYMMDD.pdf (Page 1 = 日経225先物) から全限月合計を抽出
// x座標によるカラム判定: yyyymm形式が先頭の行がデータ行
//   取引高 x≈800-875, 建玉残高 x≈1130-1210

async function parseSifDyrPdf(pdfBytes) {
  const pdfjsLib = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).href

  const data = new Uint8Array(pdfBytes)
  const pdf  = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise
  const page = await pdf.getPage(1)
  const content = await page.getTextContent()

  const byY = new Map()
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const y = Math.round(item.transform[5])
    if (!byY.has(y)) byY.set(y, [])
    byY.get(y).push({ x: Math.round(item.transform[4]), str: item.str.trim() })
  }
  for (const items of byY.values()) items.sort((a, b) => a.x - b.x)

  const now = new Date()
  const currentYYYYMM = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  let totalVolume  = 0
  let totalOI      = 0
  let nearClose    = null
  let nearContract = null

  for (const [y, items] of byY.entries()) {
    if (!items.length || !/^\d{6}$/.test(items[0].str)) continue
    const contractCode = items[0].str
    // 数値はヘッダー行と同じY, またはy-1に出現する場合がある
    const dataItems = [...items, ...(byY.get(y - 1) ?? [])]
    const volItem = dataItems.find(i => i.x >= 800 && i.x <= 875 && /^[\d,]+$/.test(i.str))
    const oiItem  = dataItems.find(i => i.x >= 1130 && i.x <= 1210 && /^[\d,]+$/.test(i.str))
    if (volItem) totalVolume += parseNum(volItem.str)
    if (oiItem)  totalOI    += parseNum(oiItem.str)
    // 近限月清算値: 最小YYYYMM >= currentYYYYMM
    if (contractCode >= currentYYYYMM && (nearContract === null || contractCode < nearContract)) {
      const closeItem = dataItems.find(i => i.x >= 520 && i.x <= 700 && /^[\d,]+$/.test(i.str))
      if (closeItem) {
        const price = parseNum(closeItem.str)
        if (price > 10000 && price < 80000) {
          nearContract = contractCode
          nearClose    = price
        }
      }
    }
  }

  return { volume: totalVolume, oi: totalOI, close: nearClose }
}

async function buildFuturesDailyData() {
  console.log('\n[futuresDaily] 先物日次OI・取引高取得中...')

  const DAILY_REFERER = `${BASE}/markets/statistics-derivatives/daily/index.html`
  const DAILY_BASE    = `${BASE}/automation/markets/statistics-derivatives/daily`
  const H = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Referer': DAILY_REFERER }

  // 既存データをロードして増分更新
  const existingPath = join(OUT_DIR, 'futures_daily.json')
  const existingMap = new Map()
  try {
    const raw = readFileSync(existingPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.data)) parsed.data.forEach(e => existingMap.set(e.date, e))
  } catch { /* 初回は空 */ }

  // 月次リスト取得
  const monthListRes = await fetch(`${DAILY_BASE}/json/daily_report_monthlylist.json`, {
    headers: H, signal: AbortSignal.timeout(20000),
  })
  if (!monthListRes.ok) throw new Error(`monthList HTTP ${monthListRes.status}`)
  const monthList = await monthListRes.json()

  const months = (monthList.TableDatas ?? []).map(r => r.Month).filter(Boolean)
  console.log(`  ${months.length}ヶ月分の月次リスト取得`)

  // 直近3ヶ月のみ処理（それ以前は既存JSONから維持）
  for (const ym of months.slice(0, 3)) {
    try {
      const dayListRes = await fetch(`${DAILY_BASE}/json/daily_report_${ym}.json`, {
        headers: H, signal: AbortSignal.timeout(20000),
      })
      if (!dayListRes.ok) { console.warn(`  ✗ daily_report_${ym}.json HTTP ${dayListRes.status}`); continue }
      const dayList = await dayListRes.json()

      for (const entry of (dayList.TableDatas ?? [])) {
        const td      = entry.TradeDate  // "YYYYMMDD"
        const zipPath = entry.OseAll     // "/automation/.../Daily_Report_OSE_YYYYMMDD.zip"
        if (!td || !zipPath) continue

        const dateStr = `${td.slice(0,4)}/${td.slice(4,6)}/${td.slice(6,8)}`
        if (existingMap.has(dateStr)) continue  // 既存データはスキップ

        try {
          const buf      = await fetchBinary(`${BASE}${zipPath}`)
          const zip      = new AdmZip(Buffer.from(buf))
          const zipEntry = zip.getEntry(`sif_dyr_${td}.pdf`)
          if (!zipEntry) { console.warn(`  ✗ ${dateStr}: sif_dyr_${td}.pdf が見つかりません`); continue }

          const { volume, oi, close } = await parseSifDyrPdf(zipEntry.getData())
          if (oi > 0) {
            existingMap.set(dateStr, { date: dateStr, volume, oi, close: close ?? null })
            console.log(`  ✓ ${dateStr}: volume=${volume.toLocaleString()}, oi=${oi.toLocaleString()}${close ? `, close=${close.toLocaleString()}` : ''}`)
          } else {
            console.warn(`  ✗ ${dateStr}: OI取得失敗 (volume=${volume})`)
          }
        } catch (e) {
          console.warn(`  ✗ ${dateStr}: ${e.message}`)
        }
      }
    } catch (e) {
      console.warn(`  ✗ ${ym}: ${e.message}`)
    }
  }

  if (existingMap.size === 0) throw new Error('先物日次データが取得できませんでした')

  // PCRを取得してマージ
  let pcrMap = new Map()
  try {
    pcrMap = await fetchPcrDailyMap()
  } catch (e) {
    console.warn('  ⚠ PCR取得失敗（スキップ）:', e.message)
  }

  // PCRをマージし、既存データのPCRが未設定のものも更新
  for (const [date, entry] of existingMap) {
    const pcr = pcrMap.get(date) ?? null
    if (pcr !== null || entry.pcr === undefined) {
      existingMap.set(date, { ...entry, pcr })
    }
  }

  const data = [...existingMap.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 252)
  console.log(`  → ${data.length}日分`)
  return data
}

// ── メイン ─────────────────────────────────────

async function main() {
  console.log('=== JPXデータ取得開始 ===')
  mkdirSync(OUT_DIR, { recursive: true })

  let investorOk            = false
  let marginOk              = false
  let vixOk                 = false
  let usdjpyOk              = false
  let advanceDeclineOk      = false
  let shortSellOk           = false
  let arbitrageOk           = false
  let futuresOIOk           = false
  let futuresDailyOk        = false
  let cotNikkeiOk           = false
  let topixOk               = false

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

  try {
    const data = await fetchUsdjpyData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'usdjpy.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ usdjpy.json 保存 (${data.length}件)`)
    usdjpyOk = true
  } catch (e) {
    console.error('\n✗ usdjpy:', e.message)
  }

  try {
    const data = await buildAdvanceDeclineData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'advance_decline.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ advance_decline.json 保存 (${data.length}件)`)
    advanceDeclineOk = true
  } catch (e) {
    console.error('\n✗ advance_decline:', e.message)
  }

  try {
    const data = await buildShortSellData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'short_sell.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ short_sell.json 保存 (${data.length}件)`)
    shortSellOk = true
  } catch (e) {
    console.error('\n✗ short_sell:', e.message)
  }

  try {
    const { weekly, daily } = await buildArbitrageData()
    const out  = { updatedAt: new Date().toISOString(), data: weekly }
    writeFileSync(join(OUT_DIR, 'arbitrage.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ arbitrage.json 保存 (${weekly.length}件)`)
    const dailyOut = { updatedAt: new Date().toISOString(), data: daily }
    writeFileSync(join(OUT_DIR, 'arbitrage_daily.json'), JSON.stringify(dailyOut, null, 2))
    console.log(`✓ arbitrage_daily.json 保存 (${daily.length}件)`)
    arbitrageOk = true
  } catch (e) {
    console.error('\n✗ arbitrage:', e.message)
  }

  try {
    const data = await buildFuturesOIData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'futures_oi.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ futures_oi.json 保存 (${data.length}件)`)
    futuresOIOk = true
  } catch (e) {
    console.error('\n✗ futuresOI:', e.message)
  }

  try {
    const data = await buildFuturesDailyData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'futures_daily.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ futures_daily.json 保存 (${data.length}件)`)
    futuresDailyOk = true
  } catch (e) {
    console.error('\n✗ futuresDaily:', e.message)
  }

  try {
    const data = await buildCotNikkeiData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'cot_nikkei.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ cot_nikkei.json 保存 (${data.length}件)`)
    cotNikkeiOk = true
  } catch (e) {
    console.warn('\n⚠ cotNikkei:', e.message)
  }

  try {
    const data = await buildTopixData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'topix.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ topix.json 保存 (${data.length}件)`)
    topixOk = true
  } catch (e) {
    console.warn('\n⚠ topix:', e.message)
  }

  console.log('\n=== 完了 ===')
  if (!investorOk || !marginOk) process.exit(1)
  if (!vixOk)                   console.warn('⚠ vix.json は更新されませんでした（既存ファイルを維持）')
  if (!usdjpyOk)                console.warn('⚠ usdjpy.json は更新されませんでした（Yahoo Finance 接続要確認）')
  if (!advanceDeclineOk)        console.warn('⚠ advance_decline.json は更新されませんでした（列検出要確認）')
  if (!shortSellOk)             console.warn('⚠ short_sell.json は更新されませんでした（列検出要確認）')
  if (!arbitrageOk)             console.warn('⚠ arbitrage.json は更新されませんでした（JPX列構造要確認）')
  if (!futuresOIOk)             console.warn('⚠ futures_oi.json は更新されませんでした（月次データ未公開の可能性）')
  if (!futuresDailyOk)          console.warn('⚠ futures_daily.json は更新されませんでした（JPX日次PDF取得要確認）')
  if (!cotNikkeiOk)             console.warn('⚠ cot_nikkei.json は更新されませんでした（CFTC URL・CSV形式要確認）')
  if (!topixOk)                 console.warn('⚠ topix.json は更新されませんでした（stooq 接続要確認）')
}

main().catch(e => { console.error(e); process.exit(1) })
