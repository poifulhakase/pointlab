#!/usr/bin/env node
// 個別銘柄の信用残（買残・売残・倍率）の週次推移を JPX 公式PDFから取得する。
//
// 使い方:
//   node scripts/fetch-stock-margin.mjs 3793          # ドリコム
//   node scripts/fetch-stock-margin.mjs 9843 7974     # 複数指定可
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

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' }
const BASE = 'https://www.jpx.co.jp'
const INDEX = '/markets/statistics-equities/margin/05.html'

const codes = process.argv.slice(2)
if (codes.length === 0) {
  console.error('使い方: node scripts/fetch-stock-margin.mjs <銘柄コード> [<銘柄コード>...]')
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

/**
 * 1つのPDFから対象銘柄の行を抜く。
 * @returns {{page:number, name:string, longBal:number, longChg:number, shortBal:number, shortChg:number}|null}
 */
async function extractFromPdf(pdfPath, secCode) {
  const lib = await loadPdfjs()
  const buf = await (await fetch(BASE + pdfPath, { headers: UA, signal: AbortSignal.timeout(60000) })).arrayBuffer()
  const pdf = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise

  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    const items = content.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }))

    const anchor = items.find(i => i.s === secCode)
    if (!anchor) continue

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
    if (systemLong + negotiableLong !== longBal || systemShort + negotiableShort !== shortBal) {
      console.warn(`  ⚠ ${pdfPath} p.${n}: 合計が内訳と一致しません（列構成が変わった可能性）`)
    }

    return { page: n, name, longBal, longChg, shortBal, shortChg }
  }
  return null
}

const pdfs = await listWeeklyPdfs()
console.log(`JPX 週次PDF ${pdfs.length}件（新しい順）\n`)

for (const code of codes) {
  const secCode = `${code}0` // 新証券コード＝4桁＋0
  console.log(`===== ${code} =====`)
  console.log('週末        買残        前週比       売残       前週比    倍率')

  for (const p of pdfs) {
    const d = p.match(/syumatsu(\d{4})(\d{2})(\d{2})/)
    const date = d ? `${d[1]}/${d[2]}/${d[3]}` : '?'
    try {
      const r = await extractFromPdf(p, secCode)
      if (!r) { console.log(`${date}  （データなし）`); continue }
      const ratio = r.shortBal > 0 ? (r.longBal / r.shortBal).toFixed(1) : '―'
      console.log(
        `${date}  ${r.longBal.toLocaleString().padStart(10)}  ${(r.longChg >= 0 ? '+' : '') + r.longChg.toLocaleString()}`.padEnd(46) +
        `${r.shortBal.toLocaleString().padStart(9)}  ${(r.shortChg >= 0 ? '+' : '') + r.shortChg.toLocaleString()}`.padEnd(20) +
        `${ratio}倍`
      )
    } catch (e) {
      console.log(`${date}  取得失敗: ${e.message}`)
    }
  }
  console.log('')
}
