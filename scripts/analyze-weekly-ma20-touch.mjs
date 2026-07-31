#!/usr/bin/env node
// 週足20週線タッチからの反発の実測（R&D・コミット対象外想定）
//
// 問い: 上昇トレンド中に**週足の20週線（BB中心線）まで下げて、下ヒゲで支えられた**とき、その後どうなったか。
//   日足だけ見ると「下降チャネル内の反発」に見える局面でも、
//   週足では「長期の支持線での反発」になっていることがある。どちらが効くのかを実測する。
//
// 条件（2026-07-31 の週の形をそのまま使う）:
//   ・20週線が上向き（＝上昇トレンド）
//   ・その週の**安値が20週線以下**まで突っ込んだ
//   ・しかし**終値は20週線より上**で返した（＝下ヒゲで支えられた）
//
// 使い方: node scripts/analyze-weekly-ma20-touch.mjs

const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - 21 * 365 * 24 * 3600

async function fetchWeekly(symbol = '%5EN225') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${P1}&period2=${P2}&interval=1wk`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? [], q = r.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.low?.[i] == null) continue
    rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: q.close[i], low: q.low[i], high: q.high[i] })
  }
  return rows
}

const HORIZON = 12 // 先12週（約3ヶ月）
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)] * 10) / 10 }
const rate = a => a.length ? Math.round(a.filter(Boolean).length / a.length * 100) : 0

function analyze(rows, label) {
  for (let i = 19; i < rows.length; i++) {
    let s = 0
    for (let k = i - 19; k <= i; k++) s += rows[k].close
    rows[i].ma20 = s / 20
  }

  const hits = []
  for (let i = 25; i < rows.length - HORIZON; i++) {
    const r = rows[i], prev = rows[i - 1]
    if (!r.ma20 || !prev.ma20) continue
    if (r.ma20 <= prev.ma20) continue          // 20週線が上向き＝上昇トレンド中のみ
    if (!(r.low <= r.ma20)) continue           // 20週線まで突っ込んだ
    if (!(r.close > r.ma20)) continue          // 終値は上に返した＝下ヒゲで支えられた
    if (hits.length && i - hits[hits.length - 1].i < 4) continue // 同じ局面を重複計上しない

    const fut = rows.slice(i + 1, i + 1 + HORIZON)
    const brokeLow = fut.some(x => x.low < r.low)
    const at = w => (rows[i + w].close / r.close - 1) * 100
    hits.push({
      i, date: r.date,
      dipPct: +((r.low / r.ma20 - 1) * 100).toFixed(1),   // 20週線をどれだけ割り込んだか
      w4: +at(4).toFixed(1), w8: +at(8).toFixed(1), w12: +at(12).toFixed(1),
      brokeLow,
      worst: +Math.min(...fut.map(x => (x.low / r.close - 1) * 100)).toFixed(1),
      best: +Math.max(...fut.map(x => (x.high / r.close - 1) * 100)).toFixed(1),
    })
  }

  console.log(`\n===== ${label} =====`)
  console.log(`対象: ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}週）`)
  console.log(`条件: 20週線が上向き＋週安値が20週線以下＋週終値は20週線より上（下ヒゲで支持）`)
  console.log(`該当: ${hits.length}件（判定は先${HORIZON}週）\n`)
  if (!hits.length) return

  console.log(`  4週後 中央値 ${med(hits.map(h => h.w4))}%（プラス率 ${rate(hits.map(h => h.w4 > 0))}%）`)
  console.log(`  8週後 中央値 ${med(hits.map(h => h.w8))}%（プラス率 ${rate(hits.map(h => h.w8 > 0))}%）`)
  console.log(` 12週後 中央値 ${med(hits.map(h => h.w12))}%（プラス率 ${rate(hits.map(h => h.w12 > 0))}%）`)
  console.log(`  その週の安値を割った割合: ${rate(hits.map(h => h.brokeLow))}%`)
  console.log(`  期間中の値動き（中央値）: 最大下落 ${med(hits.map(h => h.worst))}% ／ 最大上昇 +${med(hits.map(h => h.best))}%`)

  // 🔴 「軽く触った」と「大きく突っ込んだ」を混ぜない。今回は -3.6% と深い。
  console.log('\n  --- 20週線をどれだけ割り込んだかで分ける ---')
  for (const [name, lo, hi] of [['浅い（0〜-2%）', -2, 0.01], ['深い（-2%以下）', -99, -2]]) {
    const g = hits.filter(h => h.dipPct > lo && h.dipPct <= hi)
    if (!g.length) { console.log(`  ${name}: 該当なし`); continue }
    console.log(`  ${name}: ${g.length}件 → 4週 ${med(g.map(h => h.w4))}%（プラス率${rate(g.map(h => h.w4 > 0))}%）`
      + ` / 8週 ${med(g.map(h => h.w8))}% / 12週 ${med(g.map(h => h.w12))}%（プラス率${rate(g.map(h => h.w12 > 0))}%）`
      + ` / 安値割れ ${rate(g.map(h => h.brokeLow))}%`)
  }

  console.log('\n  --- 個別（新しい順・直近12件） ---')
  for (const h of hits.slice(-12).reverse()) {
    const f = v => `${v >= 0 ? '+' : ''}${v}%`
    console.log(`  ${h.date}  20週線割込 ${h.dipPct}%  → 4週 ${f(h.w4)} / 8週 ${f(h.w8)} / 12週 ${f(h.w12)}  ${h.brokeLow ? '（安値割れあり）' : ''}`)
  }
}

analyze(await fetchWeekly('%5EN225'), '日経平均（週足・21年）')
try { analyze(await fetchWeekly('%5ESOX'), 'フィラデルフィア半導体（週足・21年）') } catch (e) { console.warn('⚠ SOX:', e.message) }
