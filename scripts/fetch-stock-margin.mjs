#!/usr/bin/env node
// 個別銘柄の信用残（買残・売残・倍率）の週次推移を JPX 公式PDFから取得する。
//
// 使い方:
//   node scripts/fetch-stock-margin.mjs 3793          # ドリコム（画面に出すだけ）
//   node scripts/fetch-stock-margin.mjs 9843 7974     # 複数指定可
//   node scripts/fetch-stock-margin.mjs --json        # 🆕 主力＋候補を public/data/stock_margin.json へ書き出す
//
// 出どころ: JPX「銘柄別信用取引週末残高」（全上場銘柄・毎週公表・PDF）
//   https://www.jpx.co.jp/markets/statistics-equities/margin/05.html
//
// 🔴 なぜ他ソースではなくJPXなのか（2026-07-28 に全部当たった結果）
//   ・kabutan … 個別銘柄の信用残ページが**存在しない**（信用倍率の数値のみ）
//   ・Yahoo!ファイナンス /quote/{code}.T/margin … HTTP 200 だが**クライアント描画**でHTMLにデータ無し
//   ・みんかぶ /margin_balance, 日経 /nkd/.../shinyo … いずれも404
//   ・JPXの日次Excel（個別銘柄信用取引残高表）… **日々公表銘柄103社のみ**で一般銘柄は載らない
//   → 全銘柄をカバーする無料の公式データは、この週次PDFだけ。
//
// 🔴 PDFの構造（罠）
//   表が**90度回転**して描画されている。つまり
//     ・同じ Y 座標 ＝ 表の「列」（同一項目が銘柄ぶん並ぶ）
//     ・同じ X 座標 ＝ 表の「行」（1銘柄のデータ）
//   そのため行を取るには X でまとめる。1pt丸めだと同一行が2つに割れるので ±3pt の許容幅を持たせる。
//
//   1行のセル並び（Y降順＝表の左から右）:
//     前週比,制度買残 / 前週比,一般買残 / 前週比,制度売残 / 前週比,一般売残 /
//     前週比,買残合計 / 前週比,売残合計 / ISIN / 新証券コード(4桁+0) / 株式種別 / 銘柄名
//   （買残合計 = 制度買残 + 一般買残 で検算できる）
//
// 🔴 PDFは1つ40MB近くあり、**1銘柄ごとに開き直すと現実的な時間で終わらない**（2026-08-17）。
//    1つのPDFを1回だけ開き、その中で対象銘柄を全部拾う（24銘柄でも所要時間は1銘柄と変わらない）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' }
const BASE = 'https://www.jpx.co.jp'
const INDEX = '/markets/statistics-equities/margin/05.html'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STOCKS_PATH = path.join(ROOT, 'public/data/poirobo_stocks.json')
const OUT_PATH = path.join(ROOT, 'public/data/stock_margin.json')

/** 何週ぶん取るか（JPXの公開ページに並ぶPDFの数が上限）。 */
const WEEKS = 5

const args = process.argv.slice(2)
const JSON_MODE = args.includes('--json')
const codes = args.filter((a) => !a.startsWith('--'))

/** 主力＋候補の銘柄コード（--json のとき）。 */
function targetCodesFromStocks() {
  const d = JSON.parse(fs.readFileSync(STOCKS_PATH, 'utf8'))
  const list = [...(d.stocks ?? []), ...(d.watch ?? [])]
  // 🔵 新形式のコード（285A 等）は信用取引の対象外のことがあるが、除外はしない
  //    （PDFに無ければ「データなし」として素直に落ちる）。
  return list.map((s) => ({ code: String(s.code), name: String(s.name ?? '') }))
}

if (!JSON_MODE && codes.length === 0) {
  console.error('使い方: node scripts/fetch-stock-margin.mjs <銘柄コード> [<銘柄コード>...]  /  --json')
  process.exit(1)
}

/** 公開ページから週次PDFのパスを新しい順で返す */
async function listWeeklyPdfs() {
  const res = await fetch(BASE + INDEX, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`JPXの一覧ページ取得に失敗: HTTP ${res.status}`)
  const html = await res.text()
  return [...html.matchAll(/href="([^"]*syumatsu[^"]*\.pdf)"/g)]
    .map(m => m[1])
    .sort()
    .reverse()
}

let pdfjsLib
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href
  return pdfjsLib
}

const num = (s) => {
  if (s == null) return null
  const neg = s.includes('▲')                     // JPXの負数は「▲ 1,234」
  const v = parseFloat(s.replace(/[▲,\s]/g, ''))
  return Number.isFinite(v) ? (neg ? -v : v) : null
}

/** 1ページ・1銘柄ぶんの行を組み立てる（アンカー＝新証券コードのセル）。 */
function rowFromAnchor(items, anchor, secCode) {
  // 🔴 行は X でまとまる（表が回転しているため）。丸め誤差を吸収するため ±3pt。
  const cells = items
    .filter(i => Math.abs(i.x - anchor.x) <= 3)
    .sort((a, b) => b.y - a.y)
    .map(i => i.s)

  // 数値セルは先頭12個（前週比・残高の6ペア）。5番目のペアが買残合計、6番目が売残合計。
  const nums = cells.slice(0, 12).map(num)
  const name = cells.find(c => !/^[\d,▲\s]+$/.test(c) && !/^JP/.test(c) && !/株式$/.test(c) && c !== secCode) ?? ''

  if (nums.length < 12 || nums.some(v => v === null)) return null

  const [, systemLong, , negotiableLong, , systemShort, , negotiableShort,
         longChg, longBal, shortChg, shortBal] = nums

  // 検算：合計 = 制度 + 一般
  const consistent = systemLong + negotiableLong === longBal && systemShort + negotiableShort === shortBal

  return { name, longBal, longChg, shortBal, shortChg, consistent }
}

/**
 * 1つのPDFから**複数銘柄**の行をまとめて抜く（PDFは1回しか開かない）。
 * @param {string[]} secCodes 新証券コード（4桁+0）の配列
 * @returns {Promise<Record<string, {name,longBal,longChg,shortBal,shortChg,consistent}>>}
 */
async function extractManyFromPdf(pdfPath, secCodes) {
  const lib = await loadPdfjs()
  const buf = await (await fetch(BASE + pdfPath, { headers: UA, signal: AbortSignal.timeout(120000) })).arrayBuffer()
  const pdf = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise

  const want = new Set(secCodes)
  const out = {}

  for (let n = 1; n <= pdf.numPages && want.size > 0; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    const items = content.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }))

    for (const item of items) {
      if (!want.has(item.s)) continue
      const row = rowFromAnchor(items, item, item.s)
      if (row) {
        out[item.s] = { ...row, page: n }
        want.delete(item.s)
      }
    }
  }

  return out
}

/** PDFのパスから週末日（YYYY-MM-DD）を取り出す。 */
function weekOf(pdfPath) {
  const d = pdfPath.match(/syumatsu(\d{4})(\d{2})(\d{2})/)
  return d ? `${d[1]}-${d[2]}-${d[3]}` : null
}

// ─────────────────────────────────────────────────────────────
const pdfs = (await listWeeklyPdfs()).slice(0, WEEKS)
console.log(`JPX 週次PDF ${pdfs.length}件（新しい順）\n`)

const targets = JSON_MODE ? targetCodesFromStocks() : codes.map((code) => ({ code, name: '' }))
const secOf = (code) => `${code}0`                 // 新証券コード＝4桁＋0
const byCode = Object.fromEntries(targets.map((t) => [secOf(t.code), t]))

/** 週末日 → { 新証券コード: 行 } */
const perWeek = {}
for (const p of pdfs) {
  const w = weekOf(p) ?? p
  process.stdout.write(`  ${w} を読み取り中…`)
  try {
    perWeek[w] = await extractManyFromPdf(p, Object.keys(byCode))
    console.log(` ${Object.keys(perWeek[w]).length}/${targets.length}件`)
  } catch (e) {
    perWeek[w] = {}
    console.log(` 取得失敗: ${e.message}`)
  }
}

const weeks = Object.keys(perWeek).sort()          // 古い順

if (!JSON_MODE) {
  for (const t of targets) {
    console.log(`\n===== ${t.code} =====`)
    console.log('週末        買残        前週比       売残       前週比    倍率')
    for (const w of [...weeks].reverse()) {
      const r = perWeek[w][secOf(t.code)]
      if (!r) { console.log(`${w}  （データなし）`); continue }
      const ratio = r.shortBal > 0 ? (r.longBal / r.shortBal).toFixed(1) : '―'
      console.log(
        `${w}  ${r.longBal.toLocaleString().padStart(10)}  ${(r.longChg >= 0 ? '+' : '') + r.longChg.toLocaleString()}`.padEnd(46) +
        `${r.shortBal.toLocaleString().padStart(9)}  ${(r.shortChg >= 0 ? '+' : '') + r.shortChg.toLocaleString()}`.padEnd(20) +
        `${ratio}倍`,
      )
    }
  }
  process.exit(0)
}

// ── JSON 出力（画面のゲージ用） ──
const stocks = {}
for (const t of targets) {
  const history = weeks
    .map((w) => {
      const r = perWeek[w][secOf(t.code)]
      if (!r) return null
      return { w, long: r.longBal, longChg: r.longChg, short: r.shortBal, shortChg: r.shortChg }
    })
    .filter(Boolean)

  if (history.length === 0) continue
  const last = history[history.length - 1]
  stocks[t.code] = {
    name: perWeek[weeks[weeks.length - 1]]?.[secOf(t.code)]?.name || t.name,
    history,
    latest: {
      w: last.w,
      long: last.long,
      short: last.short,
      ratio: last.short > 0 ? Math.round((last.long / last.short) * 10) / 10 : null,
      longChg: last.longChg,
      longChgPct: last.long - last.longChg > 0
        ? Math.round((last.longChg / (last.long - last.longChg)) * 1000) / 10
        : null,
    },
  }
}

const missing = targets.filter((t) => !stocks[t.code]).map((t) => t.code)
const out = {
  updatedAt: new Date().toISOString(),
  source: 'JPX「銘柄別信用取引週末残高」（週次・全上場銘柄）',
  note: '🔴 週末時点の残高。日々の増減は分からない。信用取引の対象外銘柄はここに載らない。',
  weeks,
  missing,
  stocks,
}

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n')
console.log(`\n✅ ${Object.keys(stocks).length}銘柄 / ${weeks.length}週 → public/data/stock_margin.json`)
if (missing.length) console.log(`　（データ無し: ${missing.join(', ')}）`)
