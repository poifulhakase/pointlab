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
 * nikkei225jp.com daily2year.json から騰落レシオ・空売り比率を一括取得
 * 確認済み列構成:
 *   col[0]:  タイムスタンプ(ms)
 *   col[7]:  騰落レシオ(25日) - 範囲 76〜155
 *   col[11]: 空売り比率(%)    - 範囲 16〜71
 * Returns: { touhiMap, shortSellMap }
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
    console.log('  [列確認] 最新行:', first.slice(0, 14).map((v, i) => `[${i}]=${v}`).join(', '))
  }

  const touhiMap    = new Map()  // col[7]: 騰落レシオ(25日)
  const shortSellMap = new Map() // col[11]: 空売り比率(%)

  for (const row of rows) {
    if (typeof row[0] !== 'number') continue
    const dateStr = tsToJSTDateStr(row[0])
    if (typeof row[7] === 'number')
      touhiMap.set(dateStr, Math.round(row[7] * 100) / 100)
    if (typeof row[11] === 'number')
      shortSellMap.set(dateStr, Math.round(row[11] * 100) / 100)
  }

  console.log(`  騰落レシオ: ${touhiMap.size}件, 空売り比率: ${shortSellMap.size}件`)
  _daily2yearCache = { touhiMap, shortSellMap }
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

// ── 投資主体別先物手口（ミクロ需給エンジン用） ────────────────────
// JPX公表「投資部門別売買高」日経225先物（product=301）週次 CSV
// ソース: https://www.jpx.co.jp/markets/statistics-derivatives/sector/
// 新形式(p[1]='1'): コード 60=外国人 / 23=信託銀行 / 11=生命保険 / 31=投資信託 / 51=個人 / 41=証券会社
//                   net = p[9]-p[7]  (unit=1行のみ)
// 旧形式(p[1]='0'): コード 60=外国人 / 23=信託銀行 / 31=投資信託 / 41=証券会社 (11/51は非対応)
//                   net = p[14]-p[8] (vol・yen混在の1行)
async function buildFuturesParticipantsData() {
  const SECTOR_PAGE = `${BASE}/markets/statistics-derivatives/sector/index.html`
  const html = await fetchHtml(SECTOR_PAGE)

  // 週次CSVリンクを収集
  const csvLinks = [...html.matchAll(/href="(\/[^"]*Tousi_DV_W[^"]*\.csv)"/gi)]
    .map(m => m[1])

  if (csvLinks.length === 0) throw new Error('週次CSVリンクが見つかりません')

  // 対象コード → フィールド名マッピング
  const CODE_MAP = { '60': 'foreign', '23': 'trustBank', '11': 'lifeIns', '31': 'invTrust', '51': 'individual', '41': 'securities' }
  // 旧形式では 11(生命保険)/51(個人) の詳細区分が存在しないため部分的にのみ取得可

  // 既存JSONを読み込んで履歴を維持
  const existingPath = join(OUT_DIR, 'futures_participants.json')
  const existingMap = new Map()
  try {
    const raw = readFileSync(existingPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.data)) {
      parsed.data.forEach(e => {
        // 旧スキーマ（GS/JPM等）のエントリは無視
        if ('foreign' in e || 'trustBank' in e) existingMap.set(e.date, e)
      })
    }
  } catch { /* 初回は空 */ }

  const newMap = new Map()

  for (const link of csvLinks) {
    try {
      const buf  = await fetchBinary(BASE + link)
      const text = new TextDecoder('shift_jis').decode(buf)
      const lines = text.split('\n').filter(l => l.trim())

      for (const line of lines.slice(1)) {
        const p = line.split(',').map(v => v.replace(/"/g, '').trim())
        if (p[0] !== '301') continue

        let field, dateStr, net

        if (p[1] === '1' && p[6] === '1') {
          // ── 新形式: "301","1",yww,startYMD,endYMD,code,"1",sell,...,buy,net,total
          field = CODE_MAP[p[5]]
          if (!field) continue
          dateStr = `${p[4].slice(0,4)}-${p[4].slice(4,6)}-${p[4].slice(6,8)}`
          net = parseInt(p[9]) - parseInt(p[7])
        } else if (p[1] === '0') {
          // ── 旧形式: 301,0,3,cycle,yww,startYMD,endYMD,code,sell_vol,sell_ratio,...,buy_vol,...
          field = CODE_MAP[p[7]]
          if (!field) continue
          // 集計行（70=委託合計/80=総合計/50=国内委託/20=国内機関投資家合計/30=自己等）は除外
          if (['70','80','50','20','30'].includes(p[7])) continue
          dateStr = `${p[6].slice(0,4)}-${p[6].slice(4,6)}-${p[6].slice(6,8)}`
          net = parseInt(p[14]) - parseInt(p[8])  // 買vol - 売vol
        } else {
          continue
        }

        if (!newMap.has(dateStr)) {
          newMap.set(dateStr, { date: dateStr, label: dateToLabel(dateStr.replace(/-/g, '/')) })
        }
        const entry = newMap.get(dateStr)
        // 商品取引所CSVが全ゼロで上書きするケース対策: ゼロ以外が既にある場合は上書きしない
        if (entry[field] === undefined || entry[field] === null || (entry[field] === 0 && net !== 0)) {
          entry[field] = net
        }
      }
    } catch (e) {
      console.warn(`  ✗ ${link}: ${e.message}`)
    }
  }

  if (newMap.size === 0) throw new Error('パース結果が0件（CSVフォーマット変更の可能性）')

  // 新データで既存を上書きマージし、最大52週保持
  newMap.forEach((v, k) => existingMap.set(k, v))
  return [...existingMap.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 52)
}

// ── メイン ─────────────────────────────────────

async function main() {
  console.log('=== JPXデータ取得開始 ===')
  mkdirSync(OUT_DIR, { recursive: true })

  let investorOk           = false
  let marginOk             = false
  let vixOk                = false
  let advanceDeclineOk     = false
  let shortSellOk          = false
  let arbitrageOk          = false
  let futuresOIOk          = false
  let futuresParticipantsOk = false

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
    const data = await buildFuturesParticipantsData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'futures_participants.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ futures_participants.json 保存 (${data.length}件)`)
    futuresParticipantsOk = true
  } catch (e) {
    console.warn('\n⚠ futures_participants:', e.message)
  }

  console.log('\n=== 完了 ===')
  if (!investorOk || !marginOk) process.exit(1)
  if (!vixOk)                   console.warn('⚠ vix.json は更新されませんでした（既存ファイルを維持）')
  if (!advanceDeclineOk)        console.warn('⚠ advance_decline.json は更新されませんでした（列検出要確認）')
  if (!shortSellOk)             console.warn('⚠ short_sell.json は更新されませんでした（列検出要確認）')
  if (!arbitrageOk)             console.warn('⚠ arbitrage.json は更新されませんでした（JPX列構造要確認）')
  if (!futuresOIOk)             console.warn('⚠ futures_oi.json は更新されませんでした（月次データ未公開の可能性）')
  if (!futuresParticipantsOk)   console.warn('⚠ futures_participants.json は更新されませんでした（JPX URL設定要確認）')
}

main().catch(e => { console.error(e); process.exit(1) })
