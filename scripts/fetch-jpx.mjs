#!/usr/bin/env node
// 市場データ取得スクリプト
// 使い方: npm run fetch-data
// 出力:   public/data/investor.json, public/data/margin.json, public/data/cot_nikkei.json 他

import { shortSellFromRow } from './shortSell.mjs'
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

// nikkei225jp.com の `var DAILY = [...]` 配列は空要素(配列hole "[..,,..]")を含むことがある。
// JS リテラルとしては有効だが JSON では不正で、JSON.parse が配列全体で失敗し、
// PCR・騰落レシオ・空売り比率・信用残などが丸ごと取得できなくなる。
// hole を null に補完し末尾カンマを除去してから安全にパースする。
function parseDailyArray(arrayLiteral) {
  const normalized = arrayLiteral
    .replace(/,(?=\s*,)/g, ',null')  // 連続カンマ(空要素hole)を null で補完
    .replace(/,(\s*\])/g, '$1')      // 末尾カンマを除去
  return JSON.parse(normalized)
}

// Yahoo Finance は稀に単日の close を null で返す（直近営業日が一時的に欠けることがある）。
// 各 Yahoo 系列は「null日スキップ＋丸ごと上書き」で保存していたため、その日が欠落したまま
// 固着し（例: USD/JPY で 6/2 が抜ける）、Yahoo 自身が埋め戻すまで穴が残っていた。
// 既存JSONの良データ(raw)を土台に、今回取得分(fresh)を上書きマージすることで単日ホールを自己補完する。
//   - fresh に存在する日付 → fresh 優先（Yahoo の事後修正に追随）
//   - fresh に無い日付      → 既存値を保持（単日ホール補完）
// 既存JSONは enrich 済みだが、base フィールド(valueFields)のみ抽出して再 enrich するため整合は崩れない。
function mergeYahooRaw(filename, dateField, valueFields, freshRows) {
  const map = new Map()
  try {
    const json = JSON.parse(readFileSync(join(OUT_DIR, filename), 'utf8'))
    for (const row of json.data ?? []) {
      const d = row[dateField]
      if (d == null) continue
      const c = row.close
      if (c == null || isNaN(c)) continue  // 過去に欠落保存された行は土台にしない
      const raw = { [dateField]: d }
      for (const f of valueFields) raw[f] = row[f]
      map.set(d, raw)
    }
  } catch { /* 既存なし/壊れ → fresh のみで構築 */ }
  for (const r of freshRows) {
    if (r[dateField] == null) continue
    map.set(r[dateField], r)
  }
  return [...map.values()].sort((a, b) => String(a[dateField]).localeCompare(String(b[dateField])))
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
  console.log(`[investor] ${urls.length}件のファイルを発見（最大55件処理）`)

  const combined = []

  // 1ファイル≒1週。最大52週（最後に slice(0,52)）を満たすため余裕をみて55件処理する。
  // （旧26件は「1ファイル2週」想定の誤りで27週しか取れずバックテストの律速だった）
  for (const url of urls.slice(0, 55)) {
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

  const rows = parseDailyArray(m[1])
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
 * Returns: { touhiMap, shortSellMap, shortSellBreakdownMap, pcrMap }
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

  const rows = parseDailyArray(m[1])
  console.log(`  → ${rows.length}行取得`)

  if (rows.length > 0) {
    const first = rows[rows.length - 1]
    console.log('  [列確認] 最新行:', first.slice(0, 17).map((v, i) => `[${i}]=${v}`).join(', '))
  }

  const touhiMap    = new Map()  // col[7]: 騰落レシオ(25日)
  // 🔴 空売り比率は col[11] ではない（2026-08-12 修正・理由は scripts/shortSell.mjs）
  const shortSellMap = new Map()          // 合計(%) = col[22] + col[24]
  const shortSellBreakdownMap = new Map() // { total, unrestricted, restricted }
  const pcrMap       = new Map() // col[16]: PCR

  for (const row of rows) {
    if (typeof row[0] !== 'number') continue
    const dateStr = tsToJSTDateStr(row[0])
    if (typeof row[7] === 'number')
      touhiMap.set(dateStr, Math.round(row[7] * 100) / 100)
    const ss = shortSellFromRow(row)
    if (ss) {
      shortSellMap.set(dateStr, ss.total)
      shortSellBreakdownMap.set(dateStr, ss)
    }
    if (typeof row[16] === 'number' && row[16] > 0)
      pcrMap.set(dateStr, Math.round(row[16] * 1000) / 1000)
  }

  console.log(`  騰落レシオ: ${touhiMap.size}件, 空売り比率: ${shortSellMap.size}件, PCR: ${pcrMap.size}件`)
  _daily2yearCache = { touhiMap, shortSellMap, shortSellBreakdownMap, pcrMap }
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
        return parseDailyArray(m[1])
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
  const { shortSellMap, shortSellBreakdownMap } = await fetchDaily2YearMetrics()
  if (shortSellMap.size === 0) throw new Error('空売り比率データが空です')

  // 🔵 週次は**その週の最終営業日の値**（他の週次指標＝信用残・裁定残・投資主体別と揃える）。
  //    週の途中の山は日次（下）で見る。
  const weekly = dailyToWeekly(shortSellMap)

  // 🔴 **日次も残す**（2026-08-12 追加）。元データが日次なので、日次で持っておけば
  //    週次はいつでも作れるが、週次だけ保存すると元に戻せない。
  //    空売り比率は「1日で45%台へ跳ねる」ような動きを見る指標で、週末値だけだと山を見落とす。
  const daily = [...shortSellBreakdownMap.entries()]
    .map(([date, v]) => ({ date, ratio: v.total, unrestricted: v.unrestricted, restricted: v.restricted }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 500)   // 約2年ぶん

  console.log(`  → 週次 ${weekly.length}件 / 日次 ${daily.length}件（最新 ${daily[0]?.date} = ${daily[0]?.ratio}%）`)
  return {
    weekly: weekly.map(({ date, label, val }) => ({ date, label, ratio: val })),
    daily,
  }
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

// ── VIX 日次（Yahoo Finance） ─────────────────────────

async function fetchVixDailyData() {
  console.log('\n[vix_daily] Yahoo Finance から日次データ取得...')
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=3mo'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' },
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
    const time = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    rows.push({ time, close: Math.round(close * 100) / 100 })
  }
  const merged = mergeYahooRaw('vix_daily.json', 'time', ['close'], rows)
  return merged.map((r, i, arr) => {
    const prev = arr[i - 1]?.close ?? null
    const changePct = prev != null ? Math.round((r.close - prev) / prev * 10000) / 100 : null
    return { time: r.time, close: r.close, changePct }
  })
}

// ── NAS100 日次（Yahoo Finance） ────────────────────────

async function fetchNas100DailyData() {
  console.log('\n[nas100_daily] Yahoo Finance から日次データ取得...')
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?interval=1d&range=3mo'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' },
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
    const time = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
    rows.push({ time, close: Math.round(close * 100) / 100 })
  }
  const merged = mergeYahooRaw('nas100_daily.json', 'time', ['close'], rows)
  return merged.map((r, i, arr) => {
    const prev = arr[i - 1]?.close ?? null
    const changePct = prev != null ? Math.round((r.close - prev) / prev * 10000) / 100 : null
    return { time: r.time, close: r.close, changePct }
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

  // 既存JSONとマージ（単日ホール補完）→ 昇順（MA計算）
  const merged = mergeYahooRaw('usdjpy.json', 'time', ['close'], rows)

  // 前日比・MA5・MA5乖離率を付与
  const enriched = merged.map((r, i) => {
    const prev     = i > 0 ? merged[i - 1].close : null
    const change   = prev != null ? Math.round((r.close - prev) * 100) / 100 : null
    const changePct = prev != null ? Math.round((r.close - prev) / prev * 10000) / 100 : null
    let ma5 = null
    if (i >= 4) {
      const sum = merged.slice(i - 4, i + 1).reduce((acc, d) => acc + d.close, 0)
      ma5 = Math.round(sum / 5 * 100) / 100
    }
    const ma5dev = ma5 != null ? Math.round((r.close - ma5) / ma5 * 10000) / 100 : null
    return { time: r.time, close: r.close, change, changePct, ma5, ma5dev }
  })

  // 降順ソート・最新90件
  enriched.sort((a, b) => b.time.localeCompare(a.time))
  return enriched.slice(0, 90)
}

// ── 日経平均先物価格（Yahoo Finance ^N225） ────────────

async function fetchNkFuturePriceData() {
  console.log('\n[nkFuturesPrice] Yahoo Finance ^N225 から日次OHLCVデータ取得...')
  const NK_DAYS = 15
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?interval=1d&range=3mo'
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

  const ts      = result.timestamp ?? []
  const q       = result.indicators?.quote?.[0] ?? {}
  const opens   = q.open   ?? []
  const highs   = q.high   ?? []
  const lows    = q.low    ?? []
  const closes  = q.close  ?? []
  const volumes = q.volume ?? []

  const valid = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (c == null || isNaN(c)) continue
    valid.push({
      date:   new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open:   Math.round(opens[i] ?? c),
      high:   Math.round(highs[i] ?? c),
      low:    Math.round(lows[i]  ?? c),
      close:  Math.round(c),
      volume: volumes[i] != null ? Math.round(volumes[i]) : null,
    })
  }
  if (valid.length === 0) throw new Error('有効データなし')

  // 既存JSONとマージ（単日ホール補完）→ 昇順 → 前日比計算
  const merged = mergeYahooRaw('nk_futures_price.json', 'date',
    ['open', 'high', 'low', 'close', 'volume'], valid)

  // 25日MA乖離率は切り詰め前の全系列（約3ヶ月）から算出して各行に付与する。
  // (close - 25日SMA) / 25日SMA * 100。直近24日分が揃わない行は null。
  const devMap = new Map()
  for (let i = 24; i < merged.length; i++) {
    let sum = 0
    for (let j = i - 24; j <= i; j++) sum += merged[j].close
    const ma = sum / 25
    if (ma > 0) devMap.set(merged[i].date, Math.round((merged[i].close - ma) / ma * 10000) / 100)
  }

  const buf = merged.slice(-(NK_DAYS + 1))
  const startIdx = buf.length > NK_DAYS ? 1 : 0
  const rows = []
  for (let i = startIdx; i < buf.length; i++) {
    const d    = buf[i]
    const prev = i > 0 ? buf[i - 1] : null
    const change    = prev != null ? Math.round(d.close - prev.close) : null
    const changePct = prev != null && prev.close > 0
      ? Math.round((d.close - prev.close) / prev.close * 10000) / 100
      : null
    rows.push({
      date:       d.date,
      open:       d.open,
      high:       d.high,
      low:        d.low,
      close:      d.close,
      volume:     d.volume,
      prev_close: prev?.close ?? null,
      change,
      change_pct: changePct,
      ma25_dev:   devMap.get(d.date) ?? null,
    })
  }
  // 降順（最新が先頭）
  rows.sort((a, b) => b.date.localeCompare(a.date))
  console.log(`  → ${rows.length}件`)
  return rows
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
  const rows = parseDailyArray(m[1])
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

// ── TOPIX日次（NT倍率用・静的JSONフォールバック） ──────────────────────────
// 本番のフロントは /api/stocks-daily?only=topix（Vercel側でkabutanスクレイプ）が主。
// ここで生成する topix.json は①が落ちた時の静的フォールバック。
// TOPIX指数(^TPX)はYahoo欠損・stooqは全方面ブロックのため kabutan(code=0010)を主とする。
async function buildTopixData() {
  console.log('\n[topix] kabutan から TOPIX日次データ取得...')
  // 1ページ≒30営業日。10ページで全履歴（約300営業日＝~15ヶ月）。チャート期間を約1年確保。
  const map = new Map()
  for (const page of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    try {
      const res = await fetch(`https://kabutan.jp/stock/kabuka?code=0010&ashi=day&page=${page}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en;q=0.8',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const rowRe = /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"[^>]*>[\s\S]*?<\/time>([\s\S]*?)<\/tr>/g
      let m
      while ((m = rowRe.exec(html)) !== null) {
        const nums = [...m[2].matchAll(/<td[^>]*>([\d,]+\.\d+|[\d,]{4,})/g)]
          .map(x => parseFloat(x[1].replace(/,/g, '')))
        if (nums.length < 4 || !(nums[3] > 0)) continue
        map.set(m[1], Math.round(nums[3] * 100) / 100)
      }
    } catch (e) {
      console.warn(`  ⚠ page ${page}: ${e.message}`)
    }
  }

  // 🔴 kabutan は GitHub Actions の IP からは取れない（2026-07-13 以降、CI では
  //    topix.json が一度も更新できていなかった。ローカルからは200で取れるため気づきにくい）。
  //    自前の Vercel API は同じ kabutan を **Vercel の egress IP** で叩くので通る。
  //    ＝ CI から見れば「自分のサイトのAPIを読むだけ」になり、IP遮断を回避できる。
  if (map.size === 0) {
    console.warn('  ⚠ kabutan から直接取得できず（CIのIPが弾かれている可能性）。自前APIへフォールバックします')
    const fallback = await fetchTopixFromOwnApi()
    if (fallback.length) return fallback
    throw new Error('TOPIXデータが空です（kabutan直・自前APIとも失敗）')
  }

  const points = [...map.entries()]
    .map(([time, close]) => ({ time, close }))
    .sort((a, b) => a.time.localeCompare(b.time))
  console.log(`  → ${points.length}件取得`)
  return points.slice(-252) // 最大約1年分
}

/**
 * 自前の Vercel API（/api/stocks-daily?only=topix）から TOPIX を取る。
 * 中身は同じ kabutan スクレイプだが、実行されるのが Vercel 側なので取得元にブロックされない。
 * 返す形は buildTopixData と同じ [{time, close}]。
 */
async function fetchTopixFromOwnApi() {
  const url = 'https://pointlab.vercel.app/api/stocks-daily?only=topix'
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) {
      console.warn(`  ⚠ 自前API: HTTP ${res.status}`)
      return []
    }
    const j = await res.json()
    const arr = Array.isArray(j?.data) ? j.data : []
    const points = arr
      .filter(p => p && typeof p.time === 'string' && Number(p.close) > 0)
      .map(p => ({ time: p.time, close: Number(p.close) }))
      .sort((a, b) => a.time.localeCompare(b.time))
    console.log(`  → 自前APIから ${points.length}件取得`)
    return points.slice(-252)
  } catch (e) {
    console.warn(`  ⚠ 自前API: ${e.message}`)
    return []
  }
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

// ── 銘柄マスタ（JPX 東証上場銘柄一覧）────────────────────

/**
 * 上場銘柄一覧（data_j.xls）から**内国株式のみ**の銘柄マスタを作る。
 *
 * 🔵 JPX が月1回更新する無料の Excel。列は
 *    [日付, コード, 銘柄名, 市場・商品区分, 33業種コード, 33業種区分, 17業種コード, 17業種区分, 規模コード, 規模区分]。
 * 🔴 **ETF・REIT・外国株・PRO Market は落とす**（業種が "-" で、セクターの話に乗らないため）。
 * 🔴 17業種は**コード（1〜17）だけ**を持つ。名前はフロント側の表で引く（4000行に文字列を持たせない）。
 */
async function fetchStockMaster() {
  console.log('\n[stockMaster] JPX 上場銘柄一覧を取得...')

  // リンクはページから拾う（att配下のパスは将来変わりうる）。取れなければ既知のURLへ。
  const FALLBACK = `${BASE}/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls`
  let xlsUrl = FALLBACK
  try {
    const html = await fetchHtml(`${BASE}/markets/statistics-equities/misc/01.html`)
    const m = html.match(/href="([^"]*data_j\.xls[^"]*)"/)
    if (m) xlsUrl = m[1].startsWith('http') ? m[1] : BASE + m[1]
  } catch (e) {
    console.warn('  ⚠ 一覧ページを読めなかったので既知URLを使う:', e.message)
  }

  const wb   = XLSX.read(Buffer.from(await fetchBinary(xlsUrl)), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })

  // 先頭行の日付（20260731）＝この一覧の基準日
  const raw   = String(rows[1]?.[0] ?? '')
  const asOf  = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : null

  const DOMESTIC = /^(プライム|スタンダード|グロース)（内国株式）$/
  const data = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!DOMESTIC.test(String(r[3]))) continue
    const s17 = Number(r[6])
    if (!Number.isInteger(s17) || s17 < 1 || s17 > 17) continue
    data.push({
      code:     String(r[1]),
      name:     String(r[2]),
      sector33: String(r[5]),
      sector17: s17,
    })
  }
  if (data.length < 3000) throw new Error(`銘柄数が少なすぎる(${data.length}件) — 列構造の変更を疑う`)

  data.sort((a, b) => a.code.localeCompare(b.code))
  console.log(`  → ${data.length}銘柄（基準日 ${asOf ?? '不明'}）`)
  return { asOf, data }
}

// ── 業種別の相対強弱（TOPIX-17 業種別ETF）──────────────

/**
 * 東証33業種／TOPIX-17 の**業種別株価指数そのものは有料**なので、
 * それに連動する **NEXT FUNDS の TOPIX-17 業種別ETF（1617〜1633）**の値動きで代用する。
 *
 * 🔵 ETFコードと17業種コードは **1617 + (n - 1)** で一対一に対応している
 *    （data_j.xls のETF名で確認済み: 1617=食品 … 1633=不動産）。
 * 🔴 ETF価格なので**指数そのものではない**（信託報酬・売買の薄さ・乖離がのる）。
 *    順位を見るための代用だと分かるように、出力に `proxy: 'etf'` を残す。
 */
const SECTOR17_ETF_BASE = 1617
const SECTOR17_LABELS = [
  '食品', 'エネルギー資源', '建設・資材', '素材・化学', '医薬品',
  '自動車・輸送機', '鉄鋼・非鉄', '機械', '電機・精密', '情報通信・サービスその他',
  '電力・ガス', '運輸・物流', '商社・卸売', '小売', '銀行',
  '金融（除く銀行）', '不動産',
]

/** 直近終値と、N営業日前の終値との騰落率（%）。足りなければ null。 */
function pctChangeBack(closes, back) {
  const last = closes[closes.length - 1]
  const prev = closes[closes.length - 1 - back]
  if (last == null || prev == null || prev === 0) return null
  return Math.round((last - prev) / prev * 10000) / 100
}

/**
 * 「N営業日前 → M営業日前」の区間の騰落率（%）。直近を含まない期間を測るのに使う。
 *
 * 🔴 「その前はどうだったか」を見るのに **3か月（直近1か月を含む）を使ってはいけない**。
 *    窓の中で主役が交代していると、古い局面と今の局面を混ぜた数字になり、意味を持たない
 *    （実際 2026-08-07 時点で 型の一致度1位が 1か月=逆金融 / 3か月=金融 と食い違っていた）。
 *    なので**重ならない区間**で測る（ユーザー指摘・2026-08-07）。
 */
function pctChangeRange(closes, backFrom, backTo) {
  const from = closes[closes.length - 1 - backFrom]
  const to   = closes[closes.length - 1 - backTo]
  if (from == null || to == null || from === 0) return null
  return Math.round((to - from) / from * 10000) / 100
}

/** 騰落率の測定に使う「何営業日前と比べるか」。画面に出す日付もここから決まる。 */
const PERF_BACK = { chg1m: 21, chg3m: 62, chg6m: 123 }

/**
 * Yahoo の系列に混ざる「壊れた日」を落とす。
 *
 * 🔴 なぜ要るか（2026-08-08 実測）
 *   1629（商社・卸売）の系列は 15年のうち約970日ぶんが壊れている。
 *   例: 2026-03-27 に 288.60円だった株価が、03-30〜03-31 だけ 0.5676円/0.5498円
 *       （出来高2.5〜4億株＝明らかに別銘柄のデータ）になり、04-01 に 288.70円へ戻る。
 *       2014〜2015年には **調整後終値がマイナス**（-452,348 等）の期間もある。
 *   騰落率は期間の両端しか見ないので普段は表に出ないが、
 *   **壊れた日が端点に来ると、その業種が -99% や +52,410% として順位に入り、
 *   17業種のランキングが黙って崩れる**。検知する仕組みが無かったのでここで塞ぐ。
 *
 * 🔵 判定は「前後10営業日の中央値から35%以上外れているか」。
 *    連続する異常（2日以上の壊れた区間）は前日比では互いに近くすり抜けるため、
 *    窓の中央値を基準にする必要がある。
 *
 * @returns 落とした日数（呼び出し側で多すぎれば打ち切る）
 */
function dropAnomalies(times, closes, adjs) {
  const keep = []
  for (let i = 0; i < adjs.length; i++) {
    if (!(adjs[i] > 0) || !(closes[i] > 0)) continue      // 0・マイナス・NaN は問答無用で落とす
    const win = []
    for (let k = Math.max(0, i - 10); k <= Math.min(adjs.length - 1, i + 10); k++) {
      if (k !== i && adjs[k] > 0) win.push(adjs[k])
    }
    if (win.length >= 5) {
      win.sort((a, b) => a - b)
      const med = win[Math.floor(win.length / 2)]
      if (Math.abs(adjs[i] / med - 1) > 0.35) continue
    }
    keep.push(i)
  }
  const dropped = adjs.length - keep.length
  if (dropped) {
    const t = keep.map(i => times[i]), c = keep.map(i => closes[i]), a = keep.map(i => adjs[i])
    times.length = 0; times.push(...t)
    closes.length = 0; closes.push(...c)
    adjs.length = 0; adjs.push(...a)
  }
  return dropped
}

/**
 * 米10年債利回り（^TNX）の水準と3か月変化を取る。
 *
 * 🔴 なぜ要るか（2026-08-08）
 *   4局面理論はもともと「金利 × 業績」の2軸で定義されるのに、
 *   ぽいロボは**金利データを1本も持っていなかった**。そのため局面を業種の騰落から
 *   逆算するしかなく、「業種の騰落から局面を決めて、その局面で業種を語る」という
 *   循環になっていた（＝新しい情報が入らない）。金利は業種株価の外側にあるので、
 *   これを入れて初めて外部の情報が入る。
 *
 * 🔵 日本国債10年は無料で安定して取れるソースが無いため、米10年債で代用する。
 *    日米金利は連動が強く、円安/円高を通じて日本株の業種間格差に効く。
 *    ⚠ 代用であることは画面にも明示すること。
 */
async function fetchUs10yData() {
  console.log('\n[rate] 米10年債利回り（^TNX）を取得...')
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=1y'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const result = (await res.json())?.chart?.result?.[0]
  const ts = result?.timestamp ?? []
  const cl = result?.indicators?.quote?.[0]?.close ?? []

  const times = [], vals = []
  for (let i = 0; i < ts.length; i++) {
    // 🔵 利回りなので 0以下・異常値は捨てる（価格系と違い分割・分配金の調整は無い）
    if (cl[i] == null || isNaN(cl[i]) || cl[i] <= 0) continue
    times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10))
    vals.push(cl[i])
  }
  if (vals.length < 70) throw new Error(`データ不足(${vals.length}本)`)

  const last = vals[vals.length - 1]
  const back = PERF_BACK.chg3m
  const prev = vals[vals.length - 1 - back]
  // 🔴 利回りの差は「%ポイント」。騰落率(%)と混同しないこと。
  const chg3m = prev == null ? null : Math.round((last - prev) * 1000) / 1000
  console.log(`  ^TNX: ${last.toFixed(2)}% / 3か月 ${chg3m >= 0 ? '+' : ''}${chg3m}%ポイント`)
  return {
    info: {
      symbol: '^TNX',
      label: '米10年債利回り',
      time: times[times.length - 1],
      last: Math.round(last * 100) / 100,
      chg3m,
      from: times[times.length - 1 - back] ?? null,
      to: times[times.length - 1],
    },
    times, vals,
  }
}

/**
 * 期待インフレ率（10年ブレークイーブン・FRED T10YIE）の水準と3か月変化。
 *
 * 🔴 なぜ要るか（2026-08-08）
 *   金利だけでは4局面を2つまでしか絞れない（金融相場と逆業績相場はどちらも「金利↓」、
 *   業績相場と逆金融相場はどちらも「金利↑」で、原理的に区別できない）。
 *   インフレを2本目の軸に入れると4象限に分かれる＝ Merrill の Investment Clock と同じ並びで、
 *   金融→業績→逆金融→逆業績 の順に一周する。
 *
 * 🔵 FRED の CSV は **APIキー不要**。2003年から日次。欠損は "." で入る。
 *   CPI の発表を待たず、市場が織り込んでいる期待インフレをその日のうちに取れる。
 */
async function fetchBreakevenData() {
  console.log('\n[inflation] 期待インフレ率（FRED T10YIE）を取得...')
  const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10YIE', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const times = [], vals = []
  for (const line of (await res.text()).trim().split('\n').slice(1)) {
    const [d, v] = line.split(',')
    const n = Number(v)
    if (!v || v === '.' || isNaN(n) || n <= 0) continue
    times.push(d); vals.push(n)
  }
  if (vals.length < 70) throw new Error(`データ不足(${vals.length}本)`)

  const last = vals[vals.length - 1]
  const back = PERF_BACK.chg3m
  const prev = vals[vals.length - 1 - back]
  const chg3m = prev == null ? null : Math.round((last - prev) * 1000) / 1000
  console.log(`  T10YIE: ${last.toFixed(2)}% / 3か月 ${chg3m >= 0 ? '+' : ''}${chg3m}%ポイント`)
  return {
    info: {
      symbol: 'T10YIE',
      label: '期待インフレ率（10年BEI）',
      time: times[times.length - 1],
      last: Math.round(last * 100) / 100,
      chg3m,
      from: times[times.length - 1 - back] ?? null,
      to: times[times.length - 1],
    },
    times, vals,
  }
}

/**
 * 「直前に確定したアンカー」を履歴からたどって決める。
 *
 * 🔴 アンカー＝金利とインフレが**同じ方向**の日（金融相場＝どちらも↓／逆金融相場＝どちらも↑）。
 *    実測で業種の裏づけが取れたのはこの2つだけ（金融 +0.32／逆金融 +0.92）。
 *    方向が食い違う日は移行期で、**直前のアンカーと循環の順序から割り出す**（背理法）。
 *    ＝ 「逆金融相場ではない ＝ 逆業績相場」（ユーザー・2026-08-08）。
 *
 * 🔴 フロントは日次スナップショットしか持たないので、ここで確定させて JSON に載せる。
 *    当日の値だけから推定すると `scripts/analyze-sector-macro.mjs` の逐次更新と食い違う。
 *
 * 🔵 実測での効果（記憶なし→アンカー＋背理法）
 *    循環の順番どおりの遷移 41.7% → **73.6%**（定義上の当たり前ではない。アンカーは飛べる）
 *    逆業績相場の業種の裏づけ −0.83 → **+0.04**（間違ってはいない水準まで戻る）
 *    入れ替わり頻度は 4.1% のまま＝詰まらない（「前進のみ」は金融相場に52%居座る）
 */
function computeLastAnchor(rateSeries, inflSeries) {
  // 日付で突き合わせる（米国休場やFREDの欠損で日付がずれるため）
  const inflMap = new Map()
  for (let i = 0; i < inflSeries.times.length; i++) inflMap.set(inflSeries.times[i], inflSeries.vals[i])

  const days = []
  for (let i = 0; i < rateSeries.times.length; i++) {
    const d = rateSeries.times[i]
    if (inflMap.has(d)) days.push({ d, r: rateSeries.vals[i], f: inflMap.get(d) })
  }
  const back = PERF_BACK.chg3m
  let lastAnchor = null
  for (let i = back; i < days.length; i++) {
    const dr = days[i].r - days[i - back].r
    const di = days[i].f - days[i - back].f
    if (Math.abs(dr) < 0.10 || Math.abs(di) < 0.05) continue   // 横ばいは判定しない
    const rateUp = dr > 0, inflUp = di > 0
    if (rateUp === inflUp) lastAnchor = rateUp ? 'reverseFinancial' : 'financial'
  }
  console.log(`  直前のアンカー: ${lastAnchor ?? '（まだ無し）'}`)
  return lastAnchor
}

async function fetchSectorPerfData() {
  console.log('\n[sectorPerf] TOPIX-17 業種別ETF（1617〜1633）から相対強弱を計算...')

  const rows = []
  // 🔵 「1か月」が実際いつからいつまでなのかを画面に出すため、比較の基準日を持ち帰る。
  //    営業日で数えているので「◯か月前の同じ日」とは一致しない。推測させず実日付を渡す。
  let periods = null
  for (let n = 1; n <= 17; n++) {
    const etf = String(SECTOR17_ETF_BASE + n - 1)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf}.T?interval=1d&range=1y&events=div,split`
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      const ts    = result?.timestamp ?? []
      const rawCl = result?.indicators?.quote?.[0]?.close ?? []
      // 🔴 騰落率は **調整後終値（adjclose）**で計算する。
      //    素の終値だと分配金の権利落ち（このETF群は1回0.7〜2%）が下落として混ざり、
      //    権利落ち日が業種ごとにバラバラなので**順位が入れ替わってしまう**。
      const rawAdj = result?.indicators?.adjclose?.[0]?.adjclose ?? []

      // 🔴 Yahoo は休場日や配信漏れで null を混ぜる。
      //    そのまま数えると「N営業日前」がずれるので、null行は日付ごと落とす。
      const times = [], closes = [], adjs = []
      for (let i = 0; i < ts.length; i++) {
        if (rawCl[i] == null || isNaN(rawCl[i])) continue
        times.push(new Date(ts[i] * 1000).toISOString().slice(0, 10))
        closes.push(rawCl[i])
        adjs.push(rawAdj[i] == null || isNaN(rawAdj[i]) ? rawCl[i] : rawAdj[i])
      }
      // 🔴 壊れた日を落とす（詳細は dropAnomalies のコメント）。
      //    落とした日が多すぎる系列は信用できないので、その業種ごと捨てる
      //    （下の rows.length < 14 で、全体が崩れていれば処理自体が止まる）。
      const dropped = dropAnomalies(times, closes, adjs)
      if (dropped) {
        const pct = (dropped / (closes.length + dropped)) * 100
        console.warn(`  ⚠ ${etf} ${SECTOR17_LABELS[n - 1]}: 異常値 ${dropped}日を除外（${pct.toFixed(1)}%）`)
        if (pct > 5) throw new Error(`異常値が多すぎる(${dropped}日 / ${pct.toFixed(1)}%)`)
      }
      if (closes.length < 70) throw new Error(`データ不足(${closes.length}本)`)

      rows.push({
        sector17: n,
        label:    SECTOR17_LABELS[n - 1],
        etf,
        time:     times[times.length - 1],
        close:    Math.round(closes[closes.length - 1] * 10) / 10,
        chg1m:    pctChangeBack(adjs, PERF_BACK.chg1m),
        chg3m:    pctChangeBack(adjs, PERF_BACK.chg3m),
        chg6m:    pctChangeBack(adjs, PERF_BACK.chg6m),
        // 直近1か月の**手前**の2か月（重ならない）＝「その前の局面ではどうだったか」
        chgPrev2m: pctChangeRange(adjs, PERF_BACK.chg3m, PERF_BACK.chg1m),
      })

      // 最初に取れたETFの日付を代表に使う（東証の営業日カレンダーは全ETF共通）
      if (!periods) {
        const to = times[times.length - 1]
        periods = {}
        for (const [k, back] of Object.entries(PERF_BACK)) {
          periods[k] = { days: back, from: times[times.length - 1 - back] ?? null, to }
        }
        periods.prev2m = {
          days: PERF_BACK.chg3m - PERF_BACK.chg1m,
          from: times[times.length - 1 - PERF_BACK.chg3m] ?? null,
          to:   times[times.length - 1 - PERF_BACK.chg1m] ?? null,
        }
      }
      console.log(`  ${etf} ${SECTOR17_LABELS[n - 1]}: 1M ${rows[rows.length - 1].chg1m}% / 3M ${rows[rows.length - 1].chg3m}%`)
    } catch (e) {
      console.warn(`  ⚠ ${etf} ${SECTOR17_LABELS[n - 1]}: ${e.message}`)
    }
  }

  if (rows.length < 14) throw new Error(`取得できた業種が少なすぎる(${rows.length}/17)`)

  // 期間ごとの順位（1位＝いちばん強い）。取れなかった業種は順位なし。
  for (const key of ['chg1m', 'chg3m', 'chg6m']) {
    const rankKey = key.replace('chg', 'rank')
    const sorted = rows.filter(r => r[key] != null).sort((a, b) => b[key] - a[key])
    sorted.forEach((r, i) => { r[rankKey] = i + 1 })
    for (const r of rows) if (r[rankKey] == null) r[rankKey] = null
  }

  rows.sort((a, b) => a.sector17 - b.sector17)
  return { rows, periods }
}

// ── メイン ─────────────────────────────────────

async function main() {
  console.log('=== JPXデータ取得開始 ===')
  mkdirSync(OUT_DIR, { recursive: true })

  let investorOk            = false
  let marginOk              = false
  let vixOk                 = false
  let vixDailyOk            = false
  let nas100DailyOk         = false
  let usdjpyOk              = false
  let advanceDeclineOk      = false
  let shortSellOk           = false
  let arbitrageOk           = false
  let futuresOIOk           = false
  let futuresDailyOk        = false
  let cotNikkeiOk           = false
  let topixOk               = false
  let nkFuturesPriceOk      = false
  let stockMasterOk         = false
  let sectorPerfOk          = false

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
    const data = await fetchVixDailyData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'vix_daily.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ vix_daily.json 保存 (${data.length}件)`)
    vixDailyOk = true
  } catch (e) {
    console.warn('\n⚠ vix_daily:', e.message)
  }

  try {
    const data = await fetchNas100DailyData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'nas100_daily.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ nas100_daily.json 保存 (${data.length}件)`)
    nas100DailyOk = true
  } catch (e) {
    console.warn('\n⚠ nas100_daily:', e.message)
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
    const data = await fetchNkFuturePriceData()
    const out  = { updatedAt: new Date().toISOString(), data }
    writeFileSync(join(OUT_DIR, 'nk_futures_price.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ nk_futures_price.json 保存 (${data.length}件)`)
    nkFuturesPriceOk = true
  } catch (e) {
    console.error('\n✗ nkFuturesPrice:', e.message)
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
    const { weekly, daily } = await buildShortSellData()
    // 🔵 `data` は週次のまま（画面が読んでいる形を変えない）。日次は `daily` に足す。
    const out  = { updatedAt: new Date().toISOString(), data: weekly, daily }
    writeFileSync(join(OUT_DIR, 'short_sell.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ short_sell.json 保存 (週次 ${weekly.length}件 / 日次 ${daily.length}件)`)
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

  try {
    const { asOf, data } = await fetchStockMaster()
    const out = { updatedAt: new Date().toISOString(), asOf, data }
    // 🔵 3700行あるので pretty-print しない（整形すると3倍近くに膨らむ）。
    writeFileSync(join(OUT_DIR, 'stock_master.json'), JSON.stringify(out))
    console.log(`\n✓ stock_master.json 保存 (${data.length}件)`)
    stockMasterOk = true
  } catch (e) {
    console.warn('\n⚠ stockMaster:', e.message)
  }

  try {
    const { rows: data, periods } = await fetchSectorPerfData()
    // 🔵 金利は業種の話とセットでしか使わないので、専用ファイルを増やさず同居させる。
    //    取得に失敗しても業種の表示は続けたいので、ここで握りつぶして null にする。
    let rateS = null, inflS = null
    try { rateS = await fetchUs10yData() }    catch (e) { console.warn(`  ⚠ 金利(^TNX): ${e.message}`) }
    try { inflS = await fetchBreakevenData() } catch (e) { console.warn(`  ⚠ 期待インフレ(T10YIE): ${e.message}`) }
    // 🔵 アンカーは履歴をたどって確定させる（フロントは日次スナップショットしか持てないため）
    const macro = (rateS && inflS) ? { lastAnchor: computeLastAnchor(rateS, inflS) } : null
    const out  = {
      updatedAt: new Date().toISOString(), proxy: 'etf', periods,
      rate: rateS?.info ?? null, infl: inflS?.info ?? null, macro, data,
    }
    writeFileSync(join(OUT_DIR, 'sector_perf.json'), JSON.stringify(out, null, 2))
    console.log(`\n✓ sector_perf.json 保存 (${data.length}業種)`)
    sectorPerfOk = true
  } catch (e) {
    console.warn('\n⚠ sectorPerf:', e.message)
  }

  console.log('\n=== 完了 ===')
  if (!investorOk || !marginOk) process.exit(1)
  if (!vixOk)                   console.warn('⚠ vix.json は更新されませんでした（既存ファイルを維持）')
  if (!vixDailyOk)              console.warn('⚠ vix_daily.json は更新されませんでした（Yahoo Finance 接続要確認）')
  if (!nas100DailyOk)           console.warn('⚠ nas100_daily.json は更新されませんでした（Yahoo Finance 接続要確認）')
  if (!usdjpyOk)                console.warn('⚠ usdjpy.json は更新されませんでした（Yahoo Finance 接続要確認）')
  if (!nkFuturesPriceOk)       console.warn('⚠ nk_futures_price.json は更新されませんでした（Yahoo Finance 接続要確認）')
  if (!advanceDeclineOk)        console.warn('⚠ advance_decline.json は更新されませんでした（列検出要確認）')
  if (!shortSellOk)             console.warn('⚠ short_sell.json は更新されませんでした（列検出要確認）')
  if (!arbitrageOk)             console.warn('⚠ arbitrage.json は更新されませんでした（JPX列構造要確認）')
  if (!futuresOIOk)             console.warn('⚠ futures_oi.json は更新されませんでした（月次データ未公開の可能性）')
  if (!futuresDailyOk)          console.warn('⚠ futures_daily.json は更新されませんでした（JPX日次PDF取得要確認）')
  if (!cotNikkeiOk)             console.warn('⚠ cot_nikkei.json は更新されませんでした（CFTC URL・CSV形式要確認）')
  if (!topixOk)                 console.warn('⚠ topix.json は更新されませんでした（stooq 接続要確認）')
  if (!stockMasterOk)           console.warn('⚠ stock_master.json は更新されませんでした（JPX 一覧の列構造要確認・既存ファイルを維持）')
  if (!sectorPerfOk)            console.warn('⚠ sector_perf.json は更新されませんでした（Yahoo Finance 接続要確認）')
}

main().catch(e => { console.error(e); process.exit(1) })
