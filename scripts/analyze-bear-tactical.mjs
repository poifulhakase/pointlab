#!/usr/bin/env node
// 短期戦術ベア（過熱極限から数日で抜く）のエッジを測る（R&D・コミット対象外想定）
// 問い: ベアは「0（保険のみ）」か「ブルより低頻度だが期待値プラスの利益源」か。
// Yahoo ^N225 日次20年。過熱(+7/+9/+11%)からのショートを 1/2/3/5日保有で期待値評価。
// 比較に売られすぎ(-7/-10%)からのロングも同じ枠で。さらに出現頻度（ブル:ベア比）も。
// 使い方: node scripts/analyze-bear-tactical.mjs

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

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  console.log(`  → ${rows.length}営業日`)
  for (let i = 0; i < rows.length; i++) { if (i >= 24) { let s = 0; for (let k = 0; k < 25; k++) s += rows[i - k].close; rows[i].dev = (rows[i].close - s / 25) / (s / 25) * 100 } }
  const fwd = (i, n) => (i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null
  // 先n日のうちの最大下落（ショートの含み益ピーク）/最大上昇（ロングの含み益ピーク）
  const minFwd = (i, n) => { let m = 0; for (let k = 1; k <= n && i + k < rows.length; k++) m = Math.min(m, (rows[i + k].close - rows[i].close) / rows[i].close * 100); return m }
  const maxFwd = (i, n) => { let m = 0; for (let k = 1; k <= n && i + k < rows.length; k++) m = Math.max(m, (rows[i + k].close - rows[i].close) / rows[i].close * 100); return m }

  // side='short': P&L = -fwd / 'long': P&L = +fwd
  const evalSetup = (test, side, holds) => {
    const idx = []
    for (let i = 0; i < rows.length; i++) if (rows[i].dev != null && test(rows[i].dev)) idx.push(i)
    const out = { n: idx.length, byHold: {} }
    for (const h of holds) {
      const pnl = []
      let hit3 = 0, hit3D = 0   // 保有h日中に3%順行したか
      for (const i of idx) {
        const f = fwd(i, h); if (f == null) continue
        pnl.push(side === 'short' ? -f : f)
        const fav = side === 'short' ? -minFwd(i, h) : maxFwd(i, h)
        hit3D++; if (fav >= 3) hit3++
      }
      const wins = pnl.filter(v => v > 0), losses = pnl.filter(v => v <= 0)
      out.byHold[h] = {
        n: pnl.length,
        win: pnl.length ? Math.round(wins.length / pnl.length * 100) : null,
        avgWin: r2(mean(wins)), avgLoss: r2(mean(losses)),
        exp: r2(mean(pnl)),                                  // 期待値（1トレード平均P&L%）
        hit3pct: hit3D ? Math.round(hit3 / hit3D * 100) : null, // h日中に3%順行した割合
      }
    }
    return out
  }

  const holds = [1, 2, 3, 5]
  const show = (label, res) => {
    console.log(`\n【${label}】 出現 ${res.n}日`)
    console.log('  保有  n     勝率   平均利  平均損   期待値/回   3%順行率')
    for (const h of holds) {
      const b = res.byHold[h]
      console.log(`  ${h}日  ${String(b.n).padStart(4)}  ${String(b.win).padStart(4)}%  ${String(b.avgWin).padStart(6)}  ${String(b.avgLoss).padStart(6)}  ${String(b.exp).padStart(8)}%  ${String(b.hit3pct).padStart(7)}%`)
    }
  }

  console.log('\n========== 短期ベア（過熱からのショート） ==========')
  show('ショート: dev>=+7%',  evalSetup(d => d >= 7, 'short', holds))
  show('ショート: dev>=+9%',  evalSetup(d => d >= 9, 'short', holds))
  show('ショート: dev>=+11%', evalSetup(d => d >= 11, 'short', holds))

  console.log('\n========== 比較: 短期ブル（売られすぎからのロング） ==========')
  show('ロング: dev<=-7%',  evalSetup(d => d <= -7, 'long', holds))
  show('ロング: dev<=-10%', evalSetup(d => d <= -10, 'long', holds))

  console.log('\n========== 出現頻度（ブル:ベア 比） ==========')
  const cnt = test => rows.filter(r => r.dev != null && test(r.dev)).length
  console.log(`  買い場 dev<=-7%  : ${cnt(d => d <= -7)}日   売り場 dev>=+7%  : ${cnt(d => d >= 7)}日   比 ${r2(cnt(d=>d<=-7)/Math.max(1,cnt(d=>d>=7)))}:1`)
  console.log(`  買い場 dev<=-10% : ${cnt(d => d <= -10)}日   売り場 dev>=+11% : ${cnt(d => d >= 11)}日   比 ${r2(cnt(d=>d<=-10)/Math.max(1,cnt(d=>d>=11)))}:1`)
  console.log('\n※連続日の重複あり（自己相関）＝nは独立試行数ではない。期待値は方向の目安。')
}
main().catch(e => { console.error(e); process.exit(1) })
