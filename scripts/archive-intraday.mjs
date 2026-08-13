#!/usr/bin/env node
// 5分足を毎日保存して「将来の検証資産」にする（2026-08-13）
//
// 🔴 なぜ要るか＝**5分足は60日しか遡れない**（Yahoo の制限）。過去に戻って買うこともできない。
//    いま貯め始めないと、1年後に「日中の形を検証したい」と思っても材料が無い。
//    2026-08-13 の調査では、日足・1時間足の範囲では日計りの根拠が見つからなかった。
//    細かい足で見えるかは**貯めてからでないと分からない**ので、選択肢だけ残しておく。
//
// 🔵 5分足を1本だけ貯める。15分・30分・1時間は**後から合成できる**（逆はできない）。
//    1分足（7日しか遡れない）は、ジョブが1週間止まると永久に失われるので採らない。
//    5分足なら60日の猶予があり、止まっても後から埋め直せる。
//
// 🔴 保存先は `data/intraday/`。**`public/` には置かない**
//    ＝そこに置くとサイトから誰でも落とせてしまい、取得元データの再配布になる。
// 🔴 **日別ファイル**にする。月別に追記すると同じファイルが毎日書き換わり、Git の履歴が肥大する。
//
// 使い方:
//   node scripts/archive-intraday.mjs          … 足りない日を埋める（既にある日は触らない）
//   node scripts/archive-intraday.mjs --dry    … 何を書くかだけ表示する

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve(process.cwd(), 'data/intraday')
const SYMBOLS = ['^N225', '1321.T', '1571.T']
const UA = { 'User-Agent': 'Mozilla/5.0 (poirobo archive)' }
const DRY = process.argv.includes('--dry')

/** JST の日付と時刻（HHMM）に直す */
function jstParts(unixSec) {
  const d = new Date((unixSec + 9 * 3600) * 1000)
  const iso = d.toISOString()
  return { day: iso.slice(0, 10), hm: iso.slice(11, 13) + iso.slice(14, 16) }
}

async function fetch5m(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=60d`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  if (!r) throw new Error('no result')
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}

  /** @type {Map<string, Array>} 日付 → [[HHMM, o, h, l, c, v], ...] */
  const byDay = new Map()
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
    // 🔴 Yahoo は薄い時間帯に null や 0 を返す。0 のまま貯めると、後で割り算が壊れる。
    if (!(o > 0) || !(h > 0) || !(l > 0) || !(c > 0)) continue
    const { day, hm } = jstParts(ts[i])
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push([hm, r2(o), r2(h), r2(l), r2(c), q.volume?.[i] ?? 0])
  }
  return byDay
}

const r2 = (n) => Math.round(n * 100) / 100

/** その日がもう終わっているか（引け後まで足がある日だけ保存する） */
function isComplete(bars) {
  const last = bars[bars.length - 1]?.[0] ?? '0000'
  return last >= '1500' && bars.length >= 40
}

const main = async () => {
  console.log('=== 5分足アーカイブ ===')
  await mkdir(OUT_DIR, { recursive: true })
  const existing = new Set((existsSync(OUT_DIR) ? await readdir(OUT_DIR) : []).map((f) => f.replace('.json', '')))
  console.log(`保存済み: ${existing.size}日分`)

  /** @type {Map<string, Record<string, Array>>} 日付 → { シンボル: bars } */
  const merged = new Map()
  for (const sym of SYMBOLS) {
    try {
      const byDay = await fetch5m(sym)
      console.log(`  ${sym.padEnd(8)} ${byDay.size}日分を取得`)
      for (const [day, bars] of byDay) {
        if (!merged.has(day)) merged.set(day, {})
        merged.get(day)[sym] = bars
      }
    } catch (e) {
      // 🔴 1銘柄が取れなくても他は保存する（全部止めない）
      console.log(`  ${sym.padEnd(8)} ⚠ 取得に失敗: ${e.message}`)
    }
  }

  let wrote = 0, skipped = 0, incomplete = 0
  for (const [day, bars] of [...merged.entries()].sort()) {
    if (existing.has(day)) { skipped++; continue }
    // 🔵 場中に走らせても、途中までの日は保存しない（翌日に完全な形で拾う）
    const main = bars['^N225'] ?? Object.values(bars)[0] ?? []
    if (!isComplete(main)) { incomplete++; continue }

    const file = path.join(OUT_DIR, `${day}.json`)
    const body = JSON.stringify({ date: day, interval: '5m', source: 'yahoo', bars })
    if (DRY) console.log(`  [dry] ${day} … ${Object.keys(bars).join(',')} ${(body.length / 1024).toFixed(1)}KB`)
    else await writeFile(file, body + '\n', 'utf8')
    wrote++
  }

  console.log(`\n新規 ${wrote}日 / 既存 ${skipped}日 / 未完了 ${incomplete}日${DRY ? '（--dry のため書いていない）' : ''}`)
  console.log('🔵 15分・30分・1時間足は、この5分足から後で合成できる。')
}

main().catch((e) => { console.error(e); process.exit(1) })
