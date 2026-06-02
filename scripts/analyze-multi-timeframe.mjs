#!/usr/bin/env node
// 短時間軸の乖離（5/10/25日MA）で「頻度を増やせるか」検証（R&D・コミット対象外想定）
// 問い: 短いMAの乖離は、エッジ（期待値+）を保ったまま“試行回数（独立エピソード）”を増やせるか。
// Yahoo ^N225 日次20年。各MAで売られすぎ(ロング)/買われすぎ(ショート)を percentile 閾値で定義し、
//   「エピソード数（=新規エントリー回数）」「年あたり回数」「先1/2/3日の期待値・勝率」を比較。
// 使い方: node scripts/analyze-multi-timeframe.mjs

const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - 21 * 365 * 24 * 3600

async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? [], cl = r.indicators?.quote?.[0]?.close ?? []
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
const pctl = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.max(0, Math.min(s.length - 1, Math.floor(p / 100 * s.length)))] }

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const yrs = rows.length / 245
  console.log(`  → ${rows.length}営業日 ≈ ${r2(yrs)}年`)

  for (const n of [5, 10, 25]) {
    for (let i = 0; i < rows.length; i++) {
      if (i < n - 1) continue
      let s = 0; for (let k = 0; k < n; k++) s += rows[i - k].close
      rows[i]['dev' + n] = (rows[i].close - s / n) / (s / n) * 100
    }
  }
  const fwd = (i, k) => (i + k < rows.length) ? (rows[i + k].close - rows[i].close) / rows[i].close * 100 : null

  // エピソード（条件が false→true になった立ち上がりを1エントリーと数える）を評価
  const evalEpisodes = (key, test, side, holds) => {
    const entries = []
    let prev = false
    for (let i = 0; i < rows.length; i++) {
      const d = rows[i][key]
      const on = d != null && test(d)
      if (on && !prev) entries.push(i)   // 立ち上がり＝新規エントリー
      prev = on
    }
    const out = { episodes: entries.length, perYear: r2(entries.length / yrs), byHold: {} }
    for (const h of holds) {
      const pnl = []
      for (const i of entries) { const f = fwd(i, h); if (f != null) pnl.push(side === 'short' ? -f : f) }
      out.byHold[h] = {
        n: pnl.length,
        win: pnl.length ? Math.round(pnl.filter(v => v > 0).length / pnl.length * 100) : null,
        exp: r2(mean(pnl)),
      }
    }
    return out
  }

  const holds = [1, 2, 3]
  console.log('\n各MAの乖離分布（%）と、売られすぎ/買われすぎ閾値（percentile）:')
  const cfg = []
  for (const n of [5, 10, 25]) {
    const devs = rows.filter(r => r['dev' + n] != null).map(r => r['dev' + n])
    const p2 = r2(pctl(devs, 2)), p5 = r2(pctl(devs, 5)), p95 = r2(pctl(devs, 95)), p98 = r2(pctl(devs, 98))
    console.log(`  MA${n}: p2=${p2}  p5=${p5}  ...  p95=${p95}  p98=${p98}`)
    cfg.push({ n, p2, p5, p95, p98 })
  }

  const showRow = (label, res) => {
    const h = res.byHold
    console.log(`  ${label.padEnd(26)} 回数${String(res.episodes).padStart(4)} (${String(res.perYear).padStart(5)}/年)  ` +
      `1日[${String(h[1].win).padStart(3)}%,${String(h[1].exp).padStart(5)}%] ` +
      `2日[${String(h[2].win).padStart(3)}%,${String(h[2].exp).padStart(5)}%] ` +
      `3日[${String(h[3].win).padStart(3)}%,${String(h[3].exp).padStart(5)}%]`)
  }

  console.log('\n========== ロング（売られすぎ・各MAの p5 / p2 閾値）==========')
  console.log('  ※[勝率, 期待値/回] ・期待値はレバ無しの素地')
  for (const c of cfg) {
    showRow(`MA${c.n} dev<=${c.p5}(p5)`,  evalEpisodes('dev' + c.n, d => d <= c.p5, 'long', holds))
    showRow(`MA${c.n} dev<=${c.p2}(p2)`,  evalEpisodes('dev' + c.n, d => d <= c.p2, 'long', holds))
  }

  console.log('\n========== ショート（買われすぎ・各MAの p95 / p98 閾値）==========')
  for (const c of cfg) {
    showRow(`MA${c.n} dev>=${c.p95}(p95)`, evalEpisodes('dev' + c.n, d => d >= c.p95, 'short', holds))
    showRow(`MA${c.n} dev>=${c.p98}(p98)`, evalEpisodes('dev' + c.n, d => d >= c.p98, 'short', holds))
  }

  console.log('\n※エピソード=条件への新規突入回数（=独立エントリー）。連続日は1回に集約。')
  console.log('※手数料未考慮。短MAほど高頻度だがコストが効く＝gross期待値で足切り判断。')
}
main().catch(e => { console.error(e); process.exit(1) })
