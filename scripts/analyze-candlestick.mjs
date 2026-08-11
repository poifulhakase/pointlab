#!/usr/bin/env node
// ローソク足（酒田五法・単発の足）は効くか（R&D・2026-08-11）
//
// 🔵 フォーメーション（三尊・ダブルトップ等）より有望と見ている理由:
//    ① **定義に恣意性が入らない**。フォーメーションは山谷の拾い方（何本前後を見るか、
//       高さの許容幅）で結果が変わるが、ローソク足は当日と前日の OHLC だけで機械的に決まる。
//    ② **件数が多い**。フォーメーションは26年で n=8〜97 しか出ないが、足の形なら数百〜数千。
//       今日フォーメーションが全滅したのは「効かない」より「測れなかった」に近い部分がある。
//
// 🔴 それでも期待しすぎないこと。今日26年で測った20案のうち、予測系で生き残ったのは
//    年度末ベア1件だけ。ローソク足も「価格から作った変数」である点はMACDやRSIと同じで、
//    それらは前半・後半で符号が反転して全滅した。
//
// 🔴 採否の基準（測る前に決める。数字を見てから動かさない）:
//      ① 全期間で |t| >= 2  ② 前半・後半で符号が一致
//    両方を満たしたものだけ、実際のバックテストへ進める。
//
// 🔴 結果（26年）＝日次では4つ候補が出たが、**バックテストは全滅**。
//    候補（すべて教科書と**逆**）:
//      大陰線 → 翌日 +0.227%(t=2.40)   陰の包み → 翌日 +0.236%(t=2.12)
//      黒三兵 → 5日後 +0.411%(t=2.08)  明けの明星 → 5日後 -0.605%(t=-3.25)
//    弱気の形の後は上がり、強気の形の後は下がる＝**逆張りが効いている**。
//    大陰線は頑健性も合格（閾値1.5/2.0/2.5/3.0倍の4通りすべて |t|>=2・前後半とも同符号、
//    しかも閾値を上げるほど効果が大きい +0.172% → +0.431%）。
//
// 🔴 だがバックテストは「大陰線の翌日はブル」で **DDそろえ後 -10.61%**、売買回数 236→1094。
//    1日で降りるので**保有が寸断され、87回中5回の大勝ちが育たない**。
//    日次の反発は実在するが、1日だけ取りに行くとコストと寸断で消える。
//
// 使い方: node scripts/analyze-candlestick.mjs

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const se = a => (a.length < 2 ? null : sd(a) / Math.sqrt(a.length))
const pc = v => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(3)}%`)

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
    if (q.close[i] == null || q.open[i] == null) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      o: q.open[i], h: q.high[i] ?? q.close[i], l: q.low[i] ?? q.close[i], c: q.close[i],
    })
  })
  return out
}

// ── 足の形（すべて当日と前日の OHLC だけで決まる。恣意性なし）────────────────
const body = r => Math.abs(r.c - r.o)
const range = r => Math.max(1e-9, r.h - r.l)
const upper = r => r.h - Math.max(r.o, r.c)
const lower = r => Math.min(r.o, r.c) - r.l
const isUp = r => r.c > r.o
const isDown = r => r.c < r.o

/** 直近20本の平均実体（大きい・小さいの基準を相対で決める） */
function avgBody(rows, i, n = 20) {
  let s = 0, k = 0
  for (let j = Math.max(0, i - n); j < i; j++) { s += body(rows[j]) / rows[j].c; k++ }
  return k ? s / k : null
}

const PATTERNS = [
  // ── 単発 ──
  ['大陽線', (r, p, rows, i) => { const a = avgBody(rows, i); return a != null && isUp(r) && body(r) / r.c > a * 2 }],
  ['大陰線', (r, p, rows, i) => { const a = avgBody(rows, i); return a != null && isDown(r) && body(r) / r.c > a * 2 }],
  ['十字線（同時線）', (r) => body(r) / range(r) < 0.05],
  ['カラカサ（下ヒゲ長）', (r) => lower(r) > body(r) * 2 && upper(r) < body(r) * 0.5],
  ['トンカチ（上ヒゲ長）', (r) => upper(r) > body(r) * 2 && lower(r) < body(r) * 0.5],
  ['コマ（実体小・両ヒゲ）', (r) => body(r) / range(r) < 0.3 && upper(r) > body(r) && lower(r) > body(r)],
  // ── 2本 ──
  ['包み足（陽の包み）', (r, p) => p && isDown(p) && isUp(r) && r.o <= p.c && r.c >= p.o],
  ['包み足（陰の包み）', (r, p) => p && isUp(p) && isDown(r) && r.o >= p.c && r.c <= p.o],
  ['はらみ足（陽のはらみ）', (r, p) => p && isDown(p) && isUp(r) && r.o >= p.c && r.c <= p.o],
  ['はらみ足（陰のはらみ）', (r, p) => p && isUp(p) && isDown(r) && r.o <= p.c && r.c >= p.o],
  ['かぶせ線', (r, p) => p && isUp(p) && isDown(r) && r.o > p.h && r.c < (p.o + p.c) / 2 && r.c > p.o],
  ['切り込み線', (r, p) => p && isDown(p) && isUp(r) && r.o < p.l && r.c > (p.o + p.c) / 2 && r.c < p.o],
  ['窓を開けて上げた', (r, p) => p && r.l > p.h],
  ['窓を開けて下げた', (r, p) => p && r.h < p.l],
  // ── 3本（酒田）──
  ['赤三兵（陽線3本続伸）', (r, p, rows, i) => i >= 2 && isUp(rows[i]) && isUp(rows[i - 1]) && isUp(rows[i - 2]) && rows[i].c > rows[i - 1].c && rows[i - 1].c > rows[i - 2].c],
  ['黒三兵（陰線3本続落）', (r, p, rows, i) => i >= 2 && isDown(rows[i]) && isDown(rows[i - 1]) && isDown(rows[i - 2]) && rows[i].c < rows[i - 1].c && rows[i - 1].c < rows[i - 2].c],
  ['明けの明星', (r, p, rows, i) => i >= 2 && isDown(rows[i - 2]) && body(rows[i - 1]) / range(rows[i - 1]) < 0.3 && isUp(rows[i]) && rows[i].c > (rows[i - 2].o + rows[i - 2].c) / 2],
  ['宵の明星', (r, p, rows, i) => i >= 2 && isUp(rows[i - 2]) && body(rows[i - 1]) / range(rows[i - 1]) < 0.3 && isDown(rows[i]) && rows[i].c < (rows[i - 2].o + rows[i - 2].c) / 2],
]

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const N = rows.length
  const half = Math.floor(N / 2)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[N - 1].date}（${N}営業日）\n`)

  const fwd = (i, h) => (i + h < N ? rows[i + h].c / rows[i].c - 1 : null)
  const base = {}
  for (const h of [1, 5, 20]) {
    const all = []
    for (let i = 21; i + h < N; i++) all.push(fwd(i, h))
    base[h] = mean(all)
  }
  console.log(`基準（何もしないとき）  翌日 ${pc(base[1])}   5日後 ${pc(base[5])}   20日後 ${pc(base[20])}\n`)

  console.log('  形                        n     翌日      t      5日後     t      20日後    t     判定')
  for (const [name, fn] of PATTERNS) {
    const hits = []
    for (let i = 21; i < N; i++) {
      try { if (fn(rows[i], rows[i - 1], rows, i)) hits.push(i) } catch { /* 判定できない日は飛ばす */ }
    }
    if (hits.length < 20) { console.log(`  ${(name + ' '.repeat(24)).slice(0, 24)}${String(hits.length).padStart(5)}   件数不足`); continue }

    const cells = []
    let pass = false
    for (const h of [1, 5, 20]) {
      const ys = hits.map(i => fwd(i, h)).filter(v => v != null)
      const y1 = hits.filter(i => i < half).map(i => fwd(i, h)).filter(v => v != null)
      const y2 = hits.filter(i => i >= half).map(i => fwd(i, h)).filter(v => v != null)
      const diff = mean(ys) - base[h]
      const t = se(ys) ? diff / se(ys) : 0
      const same = y1.length > 5 && y2.length > 5 && Math.sign(mean(y1) - base[h]) === Math.sign(mean(y2) - base[h])
      if (Math.abs(t) >= 2 && same) pass = true
      cells.push(`${pc(diff).padStart(9)}${t.toFixed(2).padStart(7)}`)
    }
    console.log(`  ${(name + ' '.repeat(24)).slice(0, 24)}${String(hits.length).padStart(5)}${cells.join('')}   ${pass ? '🔵 候補' : '←'}`)
  }

  console.log('\n🔴 判定は「全期間 |t|>=2 かつ 前後半で符号が一致」。基準は測る前に決めてある。')
  console.log('🔴 候補が出ても、次は必ず実際のバックテストで確かめること。')
  console.log('   今日、日次で t=-3.5 や t=6.5 が出たのにバックテストでは悪化した例が4件ある。')
}

main().catch(e => { console.error(e); process.exit(1) })
