#!/usr/bin/env node
// ②需給確認エントリーの検証（R&D・⚠約52週=1年・1局面のため“兆候”止まり）
// 問い: 価格(乖離)に需給(空売り比率/騰落レシオ/信用評価損益率/COT)を足すと、買い場の質(先1-2週)が上がるか。
// 価格は Yahoo ^N225 を取得し週次需給の各日付に合わせる。
// 使い方: node scripts/analyze-supply-demand-confirm.mjs

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const load = n => JSON.parse(readFileSync(join(DATA, n), 'utf-8')).data
const dk = s => String(s).replace(/\//g, '-')
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 2 * 365 * 24 * 3600
async function fetchPrice() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  for (let i = 0; i < rows.length; i++) { if (i >= 24) { let s = 0; for (let k = 0; k < 25; k++) s += rows[i - k].close; rows[i].dev = (rows[i].close - s / 25) / (s / 25) * 100 } }
  return rows
}

async function main() {
  console.log('[fetch] Yahoo ^N225 日次...')
  const px = await fetchPrice()
  const dates = px.map(r => r.date)
  const idxOnOrBefore = t => { let lo = 0, hi = dates.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= t) { a = m; lo = m + 1 } else hi = m - 1 } return a }
  const fwd = (i, n) => (i >= 0 && i + n < px.length) ? (px[i + n].close - px[i].close) / px[i].close * 100 : null

  // 需給シリーズ（週次・降順）。各行に price dev と先5/10営業日リターンを付与
  const attach = (rows, dateKey) => rows.map(d => {
    const i = idxOnOrBefore(dk(d.date))
    return { ...d, _i: i, dev: i >= 0 ? px[i].dev : null, f5: fwd(i, 5), f10: fwd(i, 10) }
  }).filter(d => d.dev != null && d.f10 != null)

  const margin = attach(load('margin.json'))
  const short  = attach(load('short_sell.json'))
  const ad     = attach(load('advance_decline.json'))
  const cot    = attach(load('cot_nikkei.json'))

  // 指標値で hi/lo 分割し、先10日リターン（ロング目線）を比較
  const split = (rows, valFn, lbl, supportiveIsLow) => {
    const vals = rows.map(valFn)
    const med = median(vals)
    const lo = rows.filter(r => valFn(r) <= med), hi = rows.filter(r => valFn(r) > med)
    const sup = supportiveIsLow ? lo : hi, opp = supportiveIsLow ? hi : lo
    const m = g => `平均${String(r2(mean(g.map(x => x.f10)))).padStart(5)}% 勝${Math.round(g.filter(x => x.f10 > 0).length / g.length * 100)}%(n${g.length})`
    console.log(`  ${lbl.padEnd(34)} 買い支持側→ ${m(sup)}   反対側→ ${m(opp)}`)
  }

  console.log(`\n期間: margin ${margin.length}週 / short ${short.length}週 / ad ${ad.length}週 / cot ${cot.length}週`)
  console.log('\n========== ① 需給“単独”の先10日リターン傾き（買い目線・支持側 vs 反対側）==========')
  console.log('  ※支持側＝「買いに有利」と仮説する側。これが反対側を上回ればその指標に前向きの兆候')
  split(short,  r => r.ratio,     '空売り比率 高=支持(踏み上げ)',   false)
  split(ad,     r => r.ratio25,   '騰落レシオ 低=支持(売られすぎ)', true)
  split(margin, r => r.evalRatio, '信用評価損益率 低=支持(投げ)',   true)
  split(margin, r => r.ratio,     '信用倍率 低=支持(重し軽い)',     true)
  split(cot,    r => r.nonCommNet,'COT投機筋ネット 低=支持(逆張り)', true)

  // ② 価格×需給の同時条件：価格“やや弱い”時に、需給支持が乗ると質が上がるか
  console.log('\n========== ② 価格×需給の同時条件（騰落レシオを需給確認に使用）==========')
  // 騰落レシオ系列に価格devが付いている。価格“やや弱い”=dev<=0（極限-10未満も含む緩い条件）で頻度を稼ぐ
  const weak = ad.filter(r => r.dev <= 0)
  const weakLowBreadth = weak.filter(r => r.ratio25 < 90)   // 売られすぎ気味
  const showG = (g, lbl) => console.log(`  ${lbl.padEnd(40)} n=${String(g.length).padStart(3)}  先10日 平均${r2(mean(g.map(x=>x.f10)))}% 勝${g.length?Math.round(g.filter(x=>x.f10>0).length/g.length*100):0}%`)
  showG(ad, '全週（ベースライン）')
  showG(weak, '価格やや弱い（dev<=0）だけ')
  showG(weakLowBreadth, '価格やや弱い＋騰落レシオ<90（需給確認）')

  console.log('\n⚠ n≈52週・1局面（強い上昇相場）。過学習確実＝“確定”でなく“兆候”。フォワード蓄積で再評価。')
}
main().catch(e => { console.error(e); process.exit(1) })
