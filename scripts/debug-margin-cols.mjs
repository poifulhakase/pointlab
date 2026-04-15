#!/usr/bin/env node
// 信用倍率 Excel の列構造を確認するデバッグスクリプト
// 使い方: node scripts/debug-margin-cols.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('../node_modules/xlsx/xlsx.js')

const BASE = 'https://www.jpx.co.jp'

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

// ── 過去推移表（06.html）の列ダンプ ─────────────────
async function dumpHistoricalCols() {
  console.log('\n=== 過去推移表（06.html）===')
  const html = await fetchHtml(`${BASE}/markets/statistics-equities/margin/06.html`)
  const m = /href="(\/markets\/statistics-equities\/margin\/[^"]*\.xls[x]?)"/.exec(html)
  if (!m) { console.log('  リンクが見つかりません'); return }

  const url = BASE + m[1]
  const buf = await fetchBinary(url)
  const wb  = XLSX.read(buf, { type: 'array' })
  const wsName = wb.SheetNames.find(n => n.includes('信用')) ?? wb.SheetNames[0]
  console.log('  シート名:', wsName, '| 全シート:', wb.SheetNames)

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: '' })

  // ヘッダー行（最初の10行）を表示
  console.log('\n  ── ヘッダー行（先頭10行） ──')
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log(`  row[${i}]:`, rows[i].slice(0, 20).map((v, ci) => `[${ci}]${String(v).slice(0,20)}`).join('  '))
  }

  // データ行（最初の数値行）を表示
  console.log('\n  ── データ行（最初の3件）──')
  let count = 0
  for (const row of rows) {
    if (typeof row[0] !== 'number' || row[0] < 30000) continue
    console.log(`  row: `, row.slice(0, 20).map((v, ci) => `[${ci}]${String(v).slice(0,15)}`).join('  '))
    if (++count >= 3) break
  }
}

// ── 週次スナップショット（04.html）の列ダンプ ────────
async function dumpSnapshotCols() {
  console.log('\n=== 週次スナップショット（04.html）===')
  const html = await fetchHtml(`${BASE}/markets/statistics-equities/margin/04.html`)
  const urls = []
  const re = /href="(\/markets\/statistics-equities\/margin\/[^"]*mtseisan[^"]*\.xls[x]?)"/gi
  let m
  while ((m = re.exec(html)) !== null) urls.push(BASE + m[1])
  if (urls.length === 0) { console.log('  リンクが見つかりません'); return }

  const url = urls[0]
  const buf = await fetchBinary(url)
  const wb  = XLSX.read(buf, { type: 'array' })
  console.log('  シート名:', wb.SheetNames)

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })

  console.log('\n  ── 全行ダンプ（最大40行、各行先頭20列）──')
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const cells = rows[i].slice(0, 20).map((v, ci) => `[${ci}]${String(v).replace(/\n/g,'↵').slice(0,18)}`).join('  ')
    console.log(`  row[${i}]: ${cells}`)
  }
}

// ── 評価損益率ページ確認 ────────────────────────────
async function checkEvalPage() {
  console.log('\n=== 信用評価損益率ページ確認 ===')
  // JPX の評価損益率データが別ページにある場合を確認
  const candidates = [
    `${BASE}/markets/statistics-equities/margin/07.html`,
    `${BASE}/markets/statistics-equities/margin/08.html`,
    `${BASE}/markets/statistics-equities/margin/05.html`,
  ]
  for (const url of candidates) {
    try {
      const html = await fetchHtml(url)
      const hasEval = html.includes('評価損益') || html.includes('評価損益率')
      const xlsLinks = (html.match(/href="[^"]*\.xls[x]?"/gi) ?? []).length
      console.log(`  ${url}`)
      console.log(`    評価損益率ワード: ${hasEval ? 'あり' : 'なし'}  Excelリンク数: ${xlsLinks}`)
    } catch (e) {
      console.log(`  ${url} → ${e.message}`)
    }
  }
}

async function main() {
  try { await dumpHistoricalCols() } catch (e) { console.error('過去推移表エラー:', e.message) }
  try { await dumpSnapshotCols()   } catch (e) { console.error('スナップショットエラー:', e.message) }
  try { await checkEvalPage()      } catch (e) { console.error('評価損益率ページエラー:', e.message) }
}

main()
