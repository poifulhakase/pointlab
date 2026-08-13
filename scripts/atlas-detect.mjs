#!/usr/bin/env node
// 波動の書の型を、機械が26年から拾えるか（R&D・2026-08-13）
//
// 🔵 ねらいは2つ。
//    ① 図鑑の「見つけ方」を**数値条件**に落とせているかの確認（`atlasRules.mjs`）。
//    ② 将来「チャート画像をAIに読ませて型を当てさせる」ときの**答え合わせの土台**を作ること。
//       機械が拾った日付＝正解ラベルとして使える（人手でラベルを付けなくてよくなる）。
//
// 🔴 ここで出すのは「何回出たか」「窓は埋まったか」まで。
//    その型で勝てるかどうか（先のリターン）は地下室でやる。読み物と検証は分ける方針。
//
// 使い方: node scripts/atlas-detect.mjs [--json data/atlas/n225.json]

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { detectSingle, detectGap, barsToFill, TH } from './atlasRules.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

async function fetchDaily(symbol, years) {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - years * 365 * 24 * 3600
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=1d`,
    { headers: UA, signal: AbortSignal.timeout(30000) })
  const r = (await res.json())?.chart?.result?.[0]
  const q = r.indicators.quote[0]
  const out = []
  r.timestamp.forEach((t, i) => {
    if (!(q.close[i] > 0)) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: q.open[i] ?? q.close[i], high: q.high[i] ?? q.close[i],
      low: q.low[i] ?? q.close[i], close: q.close[i],
    })
  })
  return out
}

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  console.log(`\n日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）`)
  console.log(`しきい値: ${JSON.stringify(TH)}\n`)

  // ── 1本で読む型 ────────────────────────────────────────────────
  const found = {}
  for (let i = 0; i < rows.length; i++) {
    for (const name of detectSingle(rows, i)) (found[name] ||= []).push(rows[i].date)
  }
  console.log('■ 1本で読む型（機械が拾えた数）')
  for (const [name, dates] of Object.entries(found).sort((a, b) => b[1].length - a[1].length)) {
    const rate = ((dates.length / rows.length) * 100).toFixed(2)
    console.log(`  ${name.padEnd(18)} ${String(dates.length).padStart(4)}回 (${rate}%)  直近: ${dates.slice(-3).join(' ')}`)
  }

  // ── 窓 ────────────────────────────────────────────────────────
  const gaps = []
  for (let i = 20; i < rows.length; i++) {
    const g = detectGap(rows, i)
    if (!g) continue
    const fill = barsToFill(rows, i, g)
    // 走ったあとに開けて、5本以内に埋め戻された窓＝尽きの窓
    const name = (g.name === '中間の窓（ランナウェイ）' && fill != null && fill <= TH.fillBars)
      ? '尽きの窓（エグゾースチョン）' : g.name
    gaps.push({ date: rows[i].date, i, ...g, name, fill })
  }
  console.log('\n■ 窓（開いた場所で分けた）')
  const byName = {}
  for (const g of gaps) (byName[g.name] ||= []).push(g)
  for (const [name, list] of Object.entries(byName).sort((a, b) => b[1].length - a[1].length)) {
    const filled = list.filter(g => g.fill != null)
    const f5 = list.filter(g => g.fill != null && g.fill <= TH.fillBars).length
    console.log(`  ${name.padEnd(22)} ${String(list.length).padStart(4)}回` +
      `  埋まった ${((filled.length / list.length) * 100).toFixed(0)}%` +
      `  うち5本以内 ${((f5 / list.length) * 100).toFixed(0)}%` +
      `  埋まるまでの中央値 ${median(filled.map(g => g.fill)) ?? '—'}本`)
  }

  // 🔵「窓は必ず埋まる」の実際。図鑑の注記の裏取り。
  const filledAll = gaps.filter(g => g.fill != null)
  console.log(`\n  窓ぜんぶ ${gaps.length}回 … 120本以内に埋まったのは ${((filledAll.length / gaps.length) * 100).toFixed(0)}%` +
    `（中央値 ${median(filledAll.map(g => g.fill))}本）。埋まらなかったのは ${gaps.length - filledAll.length}回`)

  // ── 出力（答え合わせ用のラベル）────────────────────────────────
  const outPath = process.argv.includes('--json')
    ? process.argv[process.argv.indexOf('--json') + 1]
    : null
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify({
      symbol: '^N225', from: rows[0].date, to: rows[rows.length - 1].date, thresholds: TH,
      single: found,
      gaps: gaps.map(({ date, name, up, size, fill }) => ({ date, name, up, size: +size.toFixed(4), fill })),
    }, null, 2))
    console.log(`\n→ ${outPath} に書き出しました（AIの読み取りを採点するときの正解に使う）`)
  }
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
