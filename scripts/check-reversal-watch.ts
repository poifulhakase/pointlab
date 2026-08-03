// 反転臨界モニターを「いまのデータ」でコマンドから確認する（R&D・アプリ本体には影響しない）。
//
// 何のために：モニターは研究室（管理者専用・PC限定）にしか出ないため、
//   「いま何個点灯しているか」を見るのに毎回アプリを立ち上げてログインする必要があった。
//   相場が動いた日に手早く確認できるようにする。
//
// 🔴 アプリと1点だけ違う：`ntRatio` はアプリでは**実行時API**から取るため、
//    オフラインのJSONには無い。ここでは日経終値を Yahoo から取って同じ形に再構成する。
//    → 日足モメンタム（MACD）は再現できる。
//    → NT倍率は TOPIX が要るので `public/data/topix.json` を使う。**topix.json が古いとNTも古くなる**
//      （`npm run check-freshness` で鮮度を確認すること）。
//
// 使い方: npx tsx scripts/check-reversal-watch.ts

import fs from 'fs'
import { buildReversalWatch } from '../src/utils/reversalWatch'
import type { NkFuturesDayData } from '../src/utils/nkFuturesPriceData'
import type { MarginWeekData } from '../src/utils/jpxMarginData'
import type { ShortSellWeekData } from '../src/utils/shortSellData'
import type { VixDayData } from '../src/utils/vixData'
import type { InvestorWeekData } from '../src/utils/jpxInvestorData'
import type { AdvanceDeclineWeekData } from '../src/utils/advanceDeclineData'
import type { NtRatioPoint } from '../src/utils/ntRatioData'

type Row = Record<string, unknown>

function load(file: string): Row[] {
  const j: unknown = JSON.parse(fs.readFileSync(`public/data/${file}`, 'utf8'))
  if (Array.isArray(j)) return j as Row[]
  const o = j as { data?: Row[]; rows?: Row[] }
  return o.data ?? o.rows ?? []
}

// 🔴 取得元ごとに並び順が違う（新しい順／古い順が混在）。ここで必ず「新しい順」に揃える。
//    並び順を仮定すると、3月の値を「最新」として読むような取り違えが起きる（2026-07-28 に実際に発生）。
const norm = (d: unknown) => String(d).replace(/\//g, '-')
function desc(rows: Row[], key = 'date'): Row[] {
  return rows.slice().sort((a, b) => norm(b[key]).localeCompare(norm(a[key])))
}

/** 日経の日次終値（Yahoo）。MACD(12,26,9) には最低35本要るので余裕をもって取る。 */
async function nikkeiDailyCloses(): Promise<Record<string, number>> {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - 400 * 24 * 3600
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${p1}&period2=${p2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`日経の取得に失敗: HTTP ${res.status}`)
  const json = await res.json() as {
    chart?: { result?: [{ timestamp?: number[]; indicators?: { quote?: [{ close?: (number | null)[] }] } }] }
  }
  const r = json.chart?.result?.[0]
  const ts = r?.timestamp ?? []
  const close = r?.indicators?.quote?.[0]?.close ?? []
  const out: Record<string, number> = {}
  for (let i = 0; i < ts.length; i++) {
    const c = close[i]
    if (c != null) out[new Date(ts[i] * 1000).toISOString().slice(0, 10)] = c
  }
  return out
}

async function main() {
  const nikkei = await nikkeiDailyCloses()

  const topix: Record<string, number> = {}
  for (const r of load('topix.json')) {
    topix[String(r.time)] = Number(r.close)
  }

  // 古い順（ntRatio はアプリでも古い順）
  const nt: NtRatioPoint[] = Object.keys(nikkei).sort().map(d => ({
    date: d,
    nikkei: nikkei[d],
    topix: topix[d] ?? null,
    ratio: topix[d] != null ? nikkei[d] / topix[d] : null,
  })) as NtRatioPoint[]

  const withRatio = nt.filter(p => p.ratio != null)
  const latestNt = withRatio[withRatio.length - 1]
  const latestNk = nt[nt.length - 1]

  console.log(`日経: ${latestNk.date} ${Math.round(latestNk.nikkei).toLocaleString()}（${nt.length}本）`)
  console.log(latestNt
    ? `NT倍率: ${latestNt.date} ${latestNt.ratio!.toFixed(2)}（TOPIXのある日だけ算出）`
    : 'NT倍率: 算出できず（topix.json が読めません）')
  console.log('')

  const w = buildReversalWatch(
    desc(load('nk_futures_price.json')) as unknown as NkFuturesDayData[],
    desc(load('margin.json')) as unknown as MarginWeekData[],
    desc(load('short_sell.json')) as unknown as ShortSellWeekData[],
    desc(load('vix_daily.json')) as unknown as VixDayData[],
    desc(load('investor.json')) as unknown as InvestorWeekData[],
    nt,
    desc(load('advance_decline.json')) as unknown as AdvanceDeclineWeekData[],
  )

  console.log(`■ トレンド: ${w.trend === 'up' ? '上昇' : '下降'}（${w.trendNote}）`)
  console.log(`■ 点灯: ${w.lit} / ${w.total}   基準日: ${w.asOf}（${w.staleDays}日前）`)
  console.log('')
  for (const i of w.items) {
    console.log(`${i.lit ? '🔴 点灯' : '   消灯'}  ${i.label.padEnd(8)} ${String(i.value)}`)
    console.log(`          └ ${i.criteria}`)
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
