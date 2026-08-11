#!/usr/bin/env node
// チャートパターン（ダブルトップ／トリプルトップ／三尊）は効くか（R&D・2026-08-11）
//
// 🔴 これは repo の宿題の回収。2026-08-07 に「ダブルトップ確定しそう」という読みが出たとき、
//    handover.md S1 に「**このアプリで一度も測っていない**ので賛成も反対もできなかった」と記録した。
//
// 🔴 パターン認識は**いくらでも当たりを作れてしまう**のがいちばんの危険。
//    「効かなかったら山の許容幅を緩める」ができるので、定義をいじれば必ず何か当たる。
//    → **許容幅と山の探し方を先に振って、全部並べて出す**。1つだけ当たったら不採用。
//    （今日、200日線が7通り中1つだけプラスでカーブフィッティングと判定したのと同じ扱い）
//
// 🔴 先読みに注意。山（ピボット）は**その後 k 本経たないと確定しない**。
//    i 日目に使えるのは「i-k 日目までに確定した山」だけ。ここを間違えると全部が嘘になる。
//
// 🔴 判定は「ネックライン割れ」で成立とし、**成立した日の終値から**先を測る。
//    「そのうち下がった」ではなく「成立を見てから入れたか」を測るため。
//
// 使い方: node scripts/analyze-chart-patterns.mjs

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const se = a => (a.length < 2 ? null : sd(a) / Math.sqrt(a.length))
const pc = v => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)

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
    if (q.close[i] == null) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      high: q.high[i] ?? q.close[i], low: q.low[i] ?? q.close[i], close: q.close[i],
    })
  })
  return out
}

/**
 * 山と谷（ピボット）を拾う。
 * 🔴 index j の山は **j+k 日目にならないと確定しない**（後ろ k 本を見ないと山か分からない）。
 *    返り値に confirmedAt を持たせて、使う側が先読みしないようにする。
 */
function pivots(rows, k) {
  const out = []
  for (let j = k; j < rows.length - k; j++) {
    let isHigh = true, isLow = true
    for (let m = 1; m <= k; m++) {
      if (rows[j].high < rows[j - m].high || rows[j].high < rows[j + m].high) isHigh = false
      if (rows[j].low > rows[j - m].low || rows[j].low > rows[j + m].low) isLow = false
    }
    if (isHigh) out.push({ i: j, kind: 'H', price: rows[j].high, confirmedAt: j + k })
    if (isLow) out.push({ i: j, kind: 'L', price: rows[j].low, confirmedAt: j + k })
  }
  return out.sort((a, b) => a.i - b.i)
}

/**
 * パターンの成立日を集める。
 * @returns {{type:string, at:number}[]} at = ネックラインを割った（抜けた）日
 */
function findPatterns(rows, k, tol, maxSpan) {
  const pv = pivots(rows, k)
  const events = []
  const seen = new Set()

  for (let i = k + 1; i < rows.length; i++) {
    // 🔴 i 日目に使えるのは confirmedAt <= i のピボットだけ
    const known = pv.filter(p => p.confirmedAt <= i && i - p.i <= maxSpan)
    const highs = known.filter(p => p.kind === 'H')
    const lows = known.filter(p => p.kind === 'L')
    if (highs.length < 2 || lows.length < 1) continue

    const c = rows[i].close
    const near = (a, b) => Math.abs(a - b) / ((a + b) / 2) <= tol

    // ── ダブルトップ: 直近2つの山が近い → 間の谷を割ったら成立
    const h2 = highs.slice(-2)
    if (h2.length === 2 && near(h2[0].price, h2[1].price)) {
      const neck = lows.filter(l => l.i > h2[0].i && l.i < h2[1].i).sort((a, b) => a.price - b.price)[0]
      if (neck && c < neck.price && rows[i - 1].close >= neck.price) {
        const key = `DT:${h2[0].i}:${h2[1].i}`
        if (!seen.has(key)) { seen.add(key); events.push({ type: 'ダブルトップ', at: i }) }
      }
    }

    // ── トリプルトップ: 直近3つの山が近い
    const h3 = highs.slice(-3)
    if (h3.length === 3 && near(h3[0].price, h3[1].price) && near(h3[1].price, h3[2].price)) {
      const neck = lows.filter(l => l.i > h3[0].i && l.i < h3[2].i).sort((a, b) => a.price - b.price)[0]
      if (neck && c < neck.price && rows[i - 1].close >= neck.price) {
        const key = `TT:${h3[0].i}:${h3[2].i}`
        if (!seen.has(key)) { seen.add(key); events.push({ type: 'トリプルトップ', at: i }) }
      }
    }

    // ── 三尊（ヘッドアンドショルダー）: 中央が最も高く、両肩が近い
    if (h3.length === 3 && h3[1].price > h3[0].price && h3[1].price > h3[2].price && near(h3[0].price, h3[2].price)) {
      const necks = lows.filter(l => l.i > h3[0].i && l.i < h3[2].i)
      if (necks.length >= 1) {
        const neck = Math.min(...necks.map(l => l.price))
        // 🔵 右肩上がり＝ネックラインが上向き（谷が2つ以上あるときだけ判定できる）
        const rising = necks.length >= 2 && necks[necks.length - 1].price > necks[0].price
        if (c < neck && rows[i - 1].close >= neck) {
          const key = `HS:${h3[0].i}:${h3[2].i}`
          if (!seen.has(key)) {
            seen.add(key)
            events.push({ type: '三尊', at: i })
            if (rising) events.push({ type: '三尊(右肩上がり)', at: i })
          }
        }
      }
    }

    // ── 逆三尊: 谷3つで中央が最も低い → ネックライン超えで成立
    const l3 = lows.slice(-3)
    if (l3.length === 3 && l3[1].price < l3[0].price && l3[1].price < l3[2].price && near(l3[0].price, l3[2].price)) {
      const necks = highs.filter(h => h.i > l3[0].i && h.i < l3[2].i)
      if (necks.length >= 1) {
        const neck = Math.max(...necks.map(h => h.price))
        if (c > neck && rows[i - 1].close <= neck) {
          const key = `IHS:${l3[0].i}:${l3[2].i}`
          if (!seen.has(key)) { seen.add(key); events.push({ type: '逆三尊', at: i }) }
        }
      }
    }

    // ── ダブルボトム
    const l2 = lows.slice(-2)
    if (l2.length === 2 && near(l2[0].price, l2[1].price)) {
      const neck = highs.filter(h => h.i > l2[0].i && h.i < l2[1].i).sort((a, b) => b.price - a.price)[0]
      if (neck && c > neck.price && rows[i - 1].close <= neck.price) {
        const key = `DB:${l2[0].i}:${l2[1].i}`
        if (!seen.has(key)) { seen.add(key); events.push({ type: 'ダブルボトム', at: i }) }
      }
    }
  }
  return events
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）\n`)

  const fwd = (i, h) => (i + h < rows.length ? rows[i + h].close / rows[i].close - 1 : null)
  const baseline = {}
  for (const h of [5, 20]) {
    const all = rows.map((_, i) => fwd(i, h)).filter(v => v != null)
    baseline[h] = { m: mean(all), win: all.filter(v => v > 0).length / all.length }
  }
  console.log(`基準（何もしないとき）  5日後 ${pc(baseline[5].m)}・上昇率 ${(baseline[5].win * 100).toFixed(1)}%   20日後 ${pc(baseline[20].m)}・上昇率 ${(baseline[20].win * 100).toFixed(1)}%\n`)

  const TYPES = ['ダブルトップ', 'トリプルトップ', '三尊', '三尊(右肩上がり)', '逆三尊', 'ダブルボトム']
  // 🔴 定義を先に振っておく。1つの組み合わせだけ当たったら採らない。
  const GRID = []
  for (const k of [3, 5, 10]) for (const tol of [0.005, 0.01, 0.02]) GRID.push({ k, tol })

  for (const h of [5, 20]) {
    console.log(`── この先${h}日 ──`)
    console.log('  パターン              山の探し方  許容幅    件数    平均     基準との差      t')
    for (const type of TYPES) {
      let anyHit = 0
      for (const { k, tol } of GRID) {
        const ev = findPatterns(rows, k, tol, 250).filter(e => e.type === type)
        const ys = ev.map(e => fwd(e.at, h)).filter(v => v != null)
        if (ys.length < 8) continue
        const diff = mean(ys) - baseline[h].m
        const t = se(ys) ? diff / se(ys) : 0
        const hit = Math.abs(t) >= 2
        if (hit) anyHit++
        console.log(`  ${(type + ' '.repeat(20)).slice(0, 20)}${String(k).padStart(6)}本 ${(tol * 100).toFixed(1).padStart(6)}%  ${String(ys.length).padStart(5)}  ${pc(mean(ys)).padStart(8)}  ${pc(diff).padStart(10)}  ${t.toFixed(2).padStart(7)}${hit ? '  🔵' : ''}`)
      }
      if (anyHit) console.log(`     → ${type}: 9通り中 ${anyHit}通りで |t|>=2`)
    }
    console.log('')
  }
  console.log('🔴 9通りのうち1〜2通りだけ当たったなら、それは定義をいじって当てただけ。')
  console.log('🔴 弱気パターン（トップ系・三尊）は**マイナス**が出て初めて「効いた」。符号を確認すること。')
}

main().catch(e => { console.error(e); process.exit(1) })
