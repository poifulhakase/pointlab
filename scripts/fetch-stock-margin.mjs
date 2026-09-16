#!/usr/bin/env node
// 個別銘柄の信用残（買残・売残・倍率）の週次推移を JPX 公式PDFから取得する。
//
// 使い方:
//   node scripts/fetch-stock-margin.mjs 3793          # ドリコム（画面に出すだけ）
//   node scripts/fetch-stock-margin.mjs 9843 7974     # 複数指定可
//   node scripts/fetch-stock-margin.mjs 7013 --raw    # 🆕 指定銘柄を週ごとのJSONで標準出力へ（制度買残つき・期日の見立て用）
//   node scripts/fetch-stock-margin.mjs --json        # 🆕 主力＋候補を public/data/stock_margin.json へ書き出す
//
// 出どころ: JPX「銘柄別信用取引週末残高」（全上場銘柄・毎週公表・PDF）
//   https://www.jpx.co.jp/markets/statistics-equities/margin/05.html
//
// 🔴 なぜ他ソースではなくJPXなのか（2026-07-28 に全部当たった結果）
//   ・kabutan … 週次信用残の時系列ページはあるが**株探プレミアム（有料）限定**（2026-09-16 確認・使わない）
//   ・Yahoo!ファイナンス /quote/{code}.T/margin … HTTP 200 だが**クライアント描画**でHTMLにデータ無し
//   ・みんかぶ /margin_balance, 日経 /nkd/.../shinyo … いずれも404
//   ・JPXの日次Excel（個別銘柄信用取引残高表）… **日々公表銘柄103社のみ**で一般銘柄は載らない
//   → 全銘柄をカバーする無料の公式データは、この週次PDFだけ。
//
// 🔵 PDFの構造と読み方は scripts/jpxMarginPdf.mjs に書いてある。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { listWeeklyPdfs, weekOf, extractFromPdf } from './jpxMarginPdf.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 🔵 2026-09-05: ロボット銘柄（Future）を畳んだので、取る銘柄は TARGET の主力に付いていく。
const STOCKS_PATH = path.join(ROOT, 'public/data/target_support.json')
const OUT_PATH = path.join(ROOT, 'public/data/stock_margin.json')

/** 何週ぶん取るか（JPXの公開ページに並ぶPDFの数が上限）。 */
const WEEKS = 5

const args = process.argv.slice(2)
const JSON_MODE = args.includes('--json')
const RAW_MODE = args.includes('--raw')
const codes = args.filter((a) => !a.startsWith('--'))

/** TARGET の主力の銘柄コード（--json のとき）。 */
function targetCodesFromStocks() {
  const d = JSON.parse(fs.readFileSync(STOCKS_PATH, 'utf8'))
  // 🔴 候補（スキャン結果）は日ごとに100件前後で入れ替わる。信用残まで取ると PDF の突き合わせが
  //    重くなるうえ、翌日には居ない銘柄の残高が残る。**指名した主力だけ**にする。
  const list = d.core ?? []
  return list.map((s) => ({ code: String(s.code), name: String(s.name ?? '') }))
}

if (!JSON_MODE && codes.length === 0) {
  console.error('使い方: node scripts/fetch-stock-margin.mjs <銘柄コード> [<銘柄コード>...]  /  --json')
  process.exit(1)
}

// 🔵 PDFの読み取りは scripts/jpxMarginPdf.mjs（信用残の蓄積と共通・2026-09-16）

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
    perWeek[w] = await extractFromPdf(p, Object.keys(byCode))
    console.log(` ${Object.keys(perWeek[w]).length}/${targets.length}件`)
  } catch (e) {
    perWeek[w] = {}
    console.log(` 取得失敗: ${e.message}`)
  }
}

const weeks = Object.keys(perWeek).sort()          // 古い順

if (RAW_MODE) {
  const raw = {}
  for (const t of targets) {
    raw[t.code] = weeks.map((w) => ({ w, ...perWeek[w][secOf(t.code)] })).filter((r) => r.longBal != null)
  }
  console.log('@@RAW@@' + JSON.stringify(raw))
  process.exit(0)
}

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
