#!/usr/bin/env node
// データ鮮度チェック — 「静かに古くなる」を検知する。
//
// 🔴 なぜ要るか（2026-07-31 に作った理由）
//   `fetch-jpx.mjs` は取得失敗を catch して警告だけ出し、既存ファイルを残して次へ進む。
//   そのため **CI は success のまま、データだけが古くなる**。実際 `topix.json` は
//   2026-07-13 を最後に CI で一度も更新されず、2週間気づかれなかった。
//   それまでの鮮度チェックは futures_daily と investor の**2ファイルしか見ていなかった**
//   ため、topix が止まっても誰にも通知されなかった。
//
// 🔴 並び順に依存しない
//   ファイルによって新しい順（margin/investor 等）と古い順（topix/vix_daily/usdjpy 等）が
//   混在している（過去に「VIXが3月の値を最新として表示」という取り違えの原因になった）。
//   ここでは全行を走査して**最大の日付**を採るので、並び順が変わっても壊れない。
//
// 使い方:
//   node scripts/check-freshness.mjs          … 古いものがあれば exit 1
//   node scripts/check-freshness.mjs --warn   … 表示するだけ（常に exit 0）

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

/**
 * 許容遅れ（暦日）。祝日・連休・公表の遅れを見込んで営業日より余裕を持たせる。
 * 🔴 ここに載っていないファイルは「チェック対象外」＝新しいデータを足したらここにも足すこと。
 *
 * 🔴 週次データの決め方（2026-08-06 に全面見直し）
 *   当初は「週次だから 12 日」で置いていたが、これは**公表ラグを足し忘れていた**。
 *   週次データの鮮度は次の2つが**積み上がる**：
 *     ① 行間隔      … 週末（金）→ 次の週末（金）＝ 7 日
 *     ② 公表ラグ    … その週末 → 公表 → CI が取り込むまで
 *   したがって「次の週が入る直前」の鮮度は **①+② まで正常に伸びる**。
 *   ②を git 履歴（`public/data/*.json` の最新行が更新されたコミット日 − その行の日付）で実測した：
 *     investor 7〜8日 ／ margin 5〜7日 ／ arbitrage 5〜6日 ／ cot 4日
 *   実際 2026-08-06 に investor が「13日前・許容12日」で誤警報を出した（JPX は 7/27〜7/31 週を
 *   まだ公表していない＝取得は壊れていない）。**オオカミ少年にしないことがこの仕組みの生命線**なので、
 *   maxAgeDays = ②の実測最大 + ①7日 で置き直す。
 */
const EXPECT = [
  // ── 日次で更新されるもの ──
  { file: 'futures_daily.json',   maxAgeDays: 5,  label: '先物 建玉/取引高/PCR' },
  { file: 'nk_futures_price.json', maxAgeDays: 5, label: '日経先物 価格' },
  { file: 'usdjpy.json',          maxAgeDays: 5,  label: 'ドル円' },
  { file: 'vix_daily.json',       maxAgeDays: 5,  label: 'VIX（日次）' },
  { file: 'nas100_daily.json',    maxAgeDays: 5,  label: 'NASDAQ100（日次）' },
  { file: 'topix.json',           maxAgeDays: 5,  label: 'TOPIX（NT倍率の分母）' },
  // 🔴 ファイル名は daily だが、中身の行間隔は**週次**（7/24, 7/17, 7/10 …）。日次扱いすると誤検知する。
  { file: 'arbitrage_daily.json', maxAgeDays: 14, label: '裁定残（日次ファイル・実際は週次）' }, // 公表ラグ6 + 行間隔7

  // ── 週次で公表されるもの（JPX/日経は翌週にずれ込むため広めに） ──
  { file: 'margin.json',          maxAgeDays: 15, label: '信用残・評価損益率' },   // 公表ラグ7 + 行間隔7
  // 🔴 JPX 投資部門別売買状況。週末（金）の分が載るのは**翌週**で、実測の公表ラグは 7〜8 日。
  //    12日にすると「次の週が公表される前」に必ず鳴る（2026-08-06 に実際に誤警報）。
  { file: 'investor.json',        maxAgeDays: 15, label: '投資主体別売買' },       // 公表ラグ8 + 行間隔7
  { file: 'advance_decline.json', maxAgeDays: 10, label: '騰落レシオ' },
  { file: 'short_sell.json',      maxAgeDays: 10, label: '空売り比率' },
  { file: 'arbitrage.json',       maxAgeDays: 14, label: '裁定残（週次）' },      // 公表ラグ6 + 行間隔7
  // 🔴 これだけ出どころが JPX の**月次統計**（SIF_D_YYYYMM.xlsx・翌月上旬公表）。
  //    行そのものは週次だが、7月分が載るのは8月上旬なので、月末は1ヶ月遅れが正常。
  //    12日などにすると毎月「古い」と鳴り続ける（＝オオカミ少年になる）。
  { file: 'futures_oi.json',      maxAgeDays: 45, label: '先物 建玉（月次公表・1ヶ月遅れが正常）' },
  { file: 'vix.json',             maxAgeDays: 12, label: 'VIX（週次）' },
  { file: 'cot_nikkei.json',      maxAgeDays: 14, label: 'COT（CFTC・金曜公表）' },

  // futures_participants.json は手動更新（add-participants.mjs）なので対象外。
]

/** 日付らしき値を Date に変換（"2026/07/30" と "2026-07-30" の両方が来る）。 */
function toDate(v) {
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
}

/**
 * ファイル内の最大日付を返す（並び順に依存しない）。
 * @returns {{latest: string|null, rows: number}}
 */
export function latestDateIn(json) {
  const rows = Array.isArray(json) ? json : (json?.data ?? [])
  if (!Array.isArray(rows) || rows.length === 0) return { latest: null, rows: 0 }

  let best = null
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    for (const [k, v] of Object.entries(r)) {
      if (!/date|time|week/i.test(k)) continue
      const d = toDate(v)
      if (d && (!best || d > best.d)) best = { d, s: String(v).slice(0, 10) }
    }
  }
  return { latest: best?.s ?? null, rows: rows.length }
}

/**
 * 年末年始スラック（暦日）。
 * 🔴 12/31〜1/3 は東証が閉まるため、**全ファイルの行間隔が構造的に伸びる**。
 *    実測（52週分）: margin 14日 ／ investor・裁定残・騰落レシオ・空売り比率 10日（いずれも 2026-01-09 の行）。
 *    通年で閾値を広げると検知力を捨てることになるので、**この期間だけ +7 日**に緩める。
 *    月次公表もの（futures_oi・許容45日）は元から広いので対象外。
 */
export function holidaySlack(maxAgeDays, now = new Date()) {
  if (maxAgeDays >= 30) return 0
  const m = now.getMonth() + 1
  const d = now.getDate()
  const inYearEnd = (m === 12 && d >= 26) || (m === 1 && d <= 20)
  return inYearEnd ? 7 : 0
}

/** 日数差（暦日）。 */
export function ageInDays(latest, now = new Date()) {
  const d = toDate(latest)
  if (!d) return Infinity
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - d.getTime()) / 86400000)
}

// 🔴 このファイルは import もされる（閾値のテスト）。直接実行のときだけ走らせる。
//    そうしないと import した側で process.exit(0) が呼ばれてテストが落ちる。
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()

function main() {
const warnOnly = process.argv.includes('--warn')
const stale = []
const ok = []

for (const spec of EXPECT) {
  const path = join(DATA_DIR, spec.file)
  if (!existsSync(path)) {
    stale.push({ ...spec, reason: 'ファイルが無い', latest: '-', age: '-' })
    continue
  }
  let json
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    stale.push({ ...spec, reason: '読めない: ' + e.message, latest: '-', age: '-' })
    continue
  }

  const { latest, rows } = latestDateIn(json)
  if (!latest) {
    stale.push({ ...spec, reason: '日付が取れない（0件かもしれない）', latest: '-', age: '-', rows })
    continue
  }
  const age   = ageInDays(latest)
  const slack = holidaySlack(spec.maxAgeDays)
  const limit = spec.maxAgeDays + slack
  if (age > limit) {
    const note = slack ? `許容${spec.maxAgeDays}日+年末年始${slack}日` : `許容${spec.maxAgeDays}日`
    stale.push({ ...spec, reason: `${age}日前で止まっている（${note}）`, latest, age, rows })
  } else {
    ok.push({ ...spec, latest, age, rows })
  }
}

console.log('=== データ鮮度チェック ===')
for (const o of ok) {
  console.log(`  ✓ ${o.label.padEnd(24)} 最新 ${o.latest}（${o.age}日前・${o.rows}件）`)
}
for (const s of stale) {
  console.log(`  ⚠ ${s.label.padEnd(24)} ${s.reason}${s.latest !== '-' ? `／最新 ${s.latest}` : ''}`)
}

if (stale.length === 0) {
  console.log(`\n全 ${ok.length} ファイルが最新です。`)
  process.exit(0)
}

console.log(`\n🔴 ${stale.length} ファイルが古い、または取得できていません。`)
console.log('   取得元がブロックされていないか、パーサが壊れていないかを確認してください。')
process.exit(warnOnly ? 0 : 1)
}
