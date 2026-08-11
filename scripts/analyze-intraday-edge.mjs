#!/usr/bin/env node
// 日中（1時間足）の形が、翌日の「寄り」と「寄り→引け」に効くかを測る（R&D）
//
// 🔴 なぜ測るか＝2026-08-11 に約定を**実際の寄値**で記録するようにした。
//    ロボ口座は前営業日の終値を見て 08:30 に判断し、09:00 の寄りで買う。
//    ということは「前日の日中の形」が翌日の寄りを説明するなら、それは
//    **窓ガードにも建てる判断にも直接効く**。
//
// 🔴 測ってから入れる。日足で検証した資産（ドンチャン50/25・ATR20・20年BT・対照群）に
//    未検証の材料を足すと、AI の自信だけが増える。この repo の実測では確信度は
//    すでに自信過剰かつ反転している（70%台で実勝率25%）。効かなければ入れない。
//
// 🔵 東証のザラ場は1日5時間（前場 9:00-11:30 / 後場 12:30-15:30）。
//    4時間足は1日1.25本にしかならず日をまたいで繋がるので使わない。1時間足で7本/日。
//
// 使い方: node scripts/analyze-intraday-edge.mjs

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const SYMBOL = process.argv[2] ?? '%5EN225'

const r2 = v => (v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2))
const pct = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(3)}%`)
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = a => {
  if (a.length < 2) return null
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}
/** 平均の標準誤差。🔴 これを出さないと「差がある」と言えない差を差だと読んでしまう */
const se = a => (a.length < 2 ? null : sd(a) / Math.sqrt(a.length))

async function fetchHourly() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?interval=1h&range=730d`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  if (!r) throw new Error('データなし')
  const q = r.indicators.quote[0]
  const rows = []
  r.timestamp.forEach((t, i) => {
    if (q.close[i] == null || q.open[i] == null) return
    const d = new Date((t + 9 * 3600) * 1000)   // JST
    rows.push({
      date: d.toISOString().slice(0, 10),
      hour: d.toISOString().slice(11, 13),
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
    })
  })
  return rows
}

/** 1時間足を「1日」にまとめ、日中の形を特徴に変える */
function toDays(bars) {
  const byDay = new Map()
  for (const b of bars) {
    if (!byDay.has(b.date)) byDay.set(b.date, [])
    byDay.get(b.date).push(b)
  }
  const days = []
  for (const [date, bs] of [...byDay.entries()].sort()) {
    if (bs.length < 5) continue                 // 半日立会いや欠測は捨てる
    const open = bs[0].open
    const close = bs[bs.length - 1].close
    const high = Math.max(...bs.map(b => b.high))
    const low = Math.min(...bs.map(b => b.low))
    if (!(high > low)) continue

    const at = h => bs.find(b => b.hour === h)
    const b14 = at('14') ?? bs[bs.length - 2]
    const b11 = at('11')
    const b12 = at('12') ?? at('13')

    days.push({
      date, open, close, high, low,
      // 引けにかけての方向（最後2時間ぶん）
      late: b14 ? close / b14.open - 1 : null,
      // 日中レンジの中で終値がどこか（0=安値引け, 1=高値引け）
      loc: (close - low) / (high - low),
      // 前場 / 後場のどちらで動いたか
      am: b11 ? b11.close / open - 1 : null,
      pm: b12 ? close / b12.open - 1 : null,
      // その日の値幅（比較用）
      range: (high - low) / open,
    })
  }
  return days
}

/** 特徴を3つの帯に割って、翌日の結果を比べる */
function bucketReport(label, pairs, targetName) {
  const valid = pairs.filter(p => p.x != null && p.y != null)
  if (valid.length < 30) { console.log(`  ${label}: 件数不足 (${valid.length})`); return }
  const sorted = [...valid].sort((a, b) => a.x - b.x)
  const n = sorted.length
  const cut = Math.floor(n / 3)
  const groups = [
    ['下位1/3', sorted.slice(0, cut)],
    ['中位1/3', sorted.slice(cut, n - cut)],
    ['上位1/3', sorted.slice(n - cut)],
  ]
  const all = valid.map(p => p.y)
  console.log(`  ${label} → ${targetName}    [全体 平均 ${pct(mean(all))} ±${pct(se(all))} / 勝率 ${r2(valid.filter(p => p.y > 0).length / n * 100)}% / n=${n}]`)
  for (const [name, g] of groups) {
    const ys = g.map(p => p.y)
    const win = g.filter(p => p.y > 0).length / g.length * 100
    console.log(`      ${name}  平均 ${pct(mean(ys))} ±${pct(se(ys))}   勝率 ${r2(win)}%   n=${g.length}`)
  }
  // 上位と下位の差が誤差より大きいか（ざっくり）
  const lo = groups[0][1].map(p => p.y), hi = groups[2][1].map(p => p.y)
  const diff = mean(hi) - mean(lo)
  const err = Math.sqrt(se(lo) ** 2 + se(hi) ** 2)
  const t = err ? diff / err : 0
  console.log(`      上位−下位 ${pct(diff)}（誤差 ±${pct(err)} / t=${r2(t)}）${Math.abs(t) >= 2 ? '  🔵 差あり' : '  ← 誤差の範囲'}`)
}

async function main() {
  console.log('[fetch] Yahoo 1時間足 730日分...')
  const bars = await fetchHourly()
  const days = toDays(bars)
  console.log(`  → ${bars.length}本 / ${days.length}営業日（${days[0]?.date} 〜 ${days[days.length - 1]?.date}）\n`)

  // 翌日とペアにする
  const pairs = []
  for (let i = 0; i < days.length - 1; i++) {
    const d = days[i], nx = days[i + 1]
    pairs.push({
      d,
      gap: nx.open / d.close - 1,              // 前日終値 → 翌日の寄り
      o2c: nx.close / nx.open - 1,             // 翌日の寄り → 引け
      c2c: nx.close / d.close - 1,             // 前日終値 → 翌日の引け
    })
  }

  const FEATURES = [
    ['引けにかけての方向（最後2h）', p => p.d.late],
    ['終値の日中位置（0=安値引け 1=高値引け）', p => p.d.loc],
    ['前場の方向', p => p.d.am],
    ['後場の方向', p => p.d.pm],
    ['その日の値幅', p => p.d.range],
  ]
  const TARGETS = [
    ['翌日の寄り（窓）', p => p.gap],
    ['翌日の寄り→引け', p => p.o2c],
    ['翌日の終値まで', p => p.c2c],
  ]

  for (const [tname, tf] of TARGETS) {
    console.log(`── 対象: ${tname} ──`)
    for (const [fname, ff] of FEATURES) {
      bucketReport(fname, pairs.map(p => ({ x: ff(p), y: tf(p) })), tname)
    }
    console.log('')
  }

  console.log('🔴 t が 2 未満のものは誤差の範囲。プロンプトに入れない。')
  console.log('🔴 3年・約490営業日は小標本。ここで差が出ても、そのまま信じず縮めて扱うこと。')
}

main().catch(e => { console.error(e); process.exit(1) })
