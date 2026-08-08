#!/usr/bin/env node
// RRG（相対力の4象限）に予測力があるかを検証する。
//
// 使い方: node scripts/analyze-sector-rrg.mjs
//
// 🔴 なぜ書いたか（2026-08-08）
//   円環の「型との一致度」は、局面に正解ラベルが無いため**当たったかを永久に検証できない**。
//   そこで「いまは何相場か」ではなく「この業種は市場平均に対して強いか/加速しているか」に
//   置き換えれば、**次の1〜3か月の超過リターンという正解**ができるので検証できる、
//   という考えで RRG（RS比率 × RSモメンタムの4象限）を試した。
//
// 🔴 結論＝**予測力は無かった。実装は見送り**（2026-08-08）
//   2015-07〜2026-08 の2,720営業日・延べ44,489件。その後1か月の対TOPIX超過リターン:
//     Improving（弱いが加速） 平均 -0.15% / 中央値 -0.17% / 勝率 47.8%  ← 期待していた象限
//     Leading  （強く加速）   平均 -0.23% / 中央値 -0.37% / 勝率 45.4%
//     Weakening（強いが減速） 平均 +0.02% / 中央値 -0.07% / 勝率 49.3%
//     Lagging  （弱く減速）   平均 +0.19% / 中央値 +0.09% / 勝率 51.4%
//     （全体）                平均 -0.03% / 中央値 -0.12% / 勝率 48.5%
//   探したかった Improving は平均以下。わずかに勝つのは Lagging＝ただの平均回帰で、
//   差は勝率3ポイント弱。しかも窓が重なった観測を延べで数えているので実質サンプルは
//   もっと小さく、**有意性は主張できない**。
//   象限は反時計回りに49.6%で回る（でたらめなら33.3%）が、回転しても先の超過には結びつかない。
//
// 🔵 再実行するときは、指標を変えたら必ず測り直すこと。

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' }
const ETF_BASE = 1617
const BENCH = '1306'          // NEXT FUNDS TOPIX連動型上場投信＝ベンチマーク
const L_RATIO = 63            // 強さを見る窓（約3か月）
const L_MOM   = 21            // 加速を見る窓（約1か月）
const HORIZONS = [21, 63]     // 先行きを測る期間（約1か月 / 約3か月）

const SECTOR17 = ['食品','エネルギー資源','建設・資材','素材・化学','医薬品','自動車・輸送機',
  '鉄鋼・非鉄','機械','電機・精密','情報通信・サービスその他','電力・ガス','運輸・物流',
  '商社・卸売','小売','銀行','金融（除く銀行）','不動産']

async function fetchSeries(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.T?interval=1d&range=15y&events=div,split`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  const json = await res.json()
  const r = json?.chart?.result?.[0]
  if (!r) throw new Error(`${sym}: レスポンスが不正`)
  const ts = r.timestamp ?? []
  const cl = r.indicators.quote[0].close
  const adj = r.indicators.adjclose?.[0]?.adjclose
  // 🔴 Yahoo の壊れたデータを落とす（1629 には adjclose がマイナスの日や、
  //    株価0.56円・出来高2.5億株という別銘柄らしき日が混入している）。
  //    🔵 落とすのは「前日とも翌日とも大きく乖離する日」＝**1日だけ飛んで戻るスパイク**のみ。
  //       単純に「前日比20%超」で切ると、正当なレベルシフトの後が全部消える。
  const raw = []
  for (let i = 0; i < ts.length; i++) {
    const v = adj?.[i] ?? cl[i]
    raw.push({ d: new Date(ts[i] * 1000).toISOString().slice(0, 10), v: (v == null || isNaN(v) || v <= 0) ? null : v })
  }
  //    🔵 判定は「前後10営業日の中央値からの乖離」。連続する異常（2日以上の壊れた区間）は
  //       前後比較ではすり抜けるため、窓の中央値を基準にする。
  const m = new Map()
  let dropped = 0
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].v == null) { dropped++; continue }
    const win = []
    for (let k = Math.max(0, i - 10); k <= Math.min(raw.length - 1, i + 10); k++) {
      if (k !== i && raw[k].v != null) win.push(raw[k].v)
    }
    if (win.length >= 5) {
      win.sort((a, b) => a - b)
      const md = win[Math.floor(win.length / 2)]
      if (Math.abs(raw[i].v / md - 1) > 0.35) { dropped++; continue }
    }
    m.set(raw[i].d, raw[i].v)
  }
  if (dropped) console.log(`  ⚠ ${sym}: ${dropped}日を異常値として除外`)
  return m
}

/** 単純移動平均（直前 n 本）。足りなければ null */
const sma = (arr, i, n) => {
  if (i + 1 < n) return null
  let s = 0
  for (let k = i - n + 1; k <= i; k++) { if (arr[k] == null) return null; s += arr[k] }
  return s / n
}

const mean = a => a.reduce((s, v) => s + v, 0) / a.length
const med  = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }

// ── 取得 ───────────────────────────────────────────────
const bench = await fetchSeries(BENCH)
const sectors = {}
for (let n = 1; n <= 17; n++) sectors[n] = await fetchSeries(ETF_BASE + n - 1)

const dates = [...bench.keys()]
  .filter(d => Object.values(sectors).every(m => m.has(d)))
  .sort()
console.log(`共通営業日 ${dates.length}日（${dates[0]} → ${dates.at(-1)}）`)
console.log(`ベンチマーク=${BENCH} / 強さ窓=${L_RATIO}日 / 加速窓=${L_MOM}日\n`)

// ── 各業種の象限を毎日決める ───────────────────────────
const QUAD = ['Improving', 'Leading', 'Weakening', 'Lagging']
const buckets = {}   // quadrant -> horizon -> 超過リターン配列
for (const q of QUAD) { buckets[q] = {}; for (const h of HORIZONS) buckets[q][h] = [] }
const quadByDay = []  // [{d, q:{sector:quad}}] 遷移分析用

for (let n = 1; n <= 17; n++) {
  const px = dates.map(d => sectors[n].get(d))
  const bx = dates.map(d => bench.get(d))
  const rs = px.map((v, i) => v / bx[i])

  // rsRatio: 3か月平均に対する位置（>1 = 強い）
  const rsRatio = rs.map((_, i) => { const m = sma(rs, i, L_RATIO); return m == null ? null : rs[i] / m })
  // rsMom: rsRatio の1か月平均に対する位置（>1 = 加速）
  const rsMom = rsRatio.map((_, i) => {
    const m = sma(rsRatio, i, L_MOM); return m == null || rsRatio[i] == null ? null : rsRatio[i] / m
  })

  for (let i = 0; i < dates.length; i++) {
    if (rsRatio[i] == null || rsMom[i] == null) continue
    const strong = rsRatio[i] >= 1, accel = rsMom[i] >= 1
    const q = strong ? (accel ? 'Leading' : 'Weakening') : (accel ? 'Improving' : 'Lagging')
    if (!quadByDay[i]) quadByDay[i] = { d: dates[i], q: {} }
    quadByDay[i].q[n] = q
    for (const h of HORIZONS) {
      if (i + h >= dates.length) continue
      const sec = px[i + h] / px[i] - 1
      const ben = bx[i + h] / bx[i] - 1
      buckets[q][h].push((sec - ben) * 100)   // %ポイント
    }
  }
}

// ── 結果 ──────────────────────────────────────────────
for (const h of HORIZONS) {
  console.log(`=== その後 ${h}営業日（約${Math.round(h / 21)}か月）の対TOPIX超過リターン ===`)
  console.log('象限        件数     平均      中央値   勝率(超過>0)')
  const all = []
  for (const q of QUAD) {
    const a = buckets[q][h]; all.push(...a)
    const win = a.filter(v => v > 0).length / a.length * 100
    console.log(`${q.padEnd(11)}${String(a.length).padStart(6)}  ${mean(a).toFixed(2).padStart(7)}%  ${med(a).toFixed(2).padStart(7)}%  ${win.toFixed(1).padStart(6)}%`)
  }
  const win = all.filter(v => v > 0).length / all.length * 100
  console.log(`${'（全体）'.padEnd(9)}${String(all.length).padStart(6)}  ${mean(all).toFixed(2).padStart(7)}%  ${med(all).toFixed(2).padStart(7)}%  ${win.toFixed(1).padStart(6)}%\n`)
}

// ── 象限は反時計回りに回るのか（Lagging→Improving→Leading→Weakening） ──
const NEXT = { Lagging: 'Improving', Improving: 'Leading', Leading: 'Weakening', Weakening: 'Lagging' }
let fwd = 0, back = 0, jump = 0, stay = 0
for (let i = 1; i < quadByDay.length; i++) {
  const a = quadByDay[i - 1], b = quadByDay[i]
  if (!a || !b) continue
  for (let n = 1; n <= 17; n++) {
    if (!a.q[n] || !b.q[n]) continue
    if (a.q[n] === b.q[n]) { stay++; continue }
    if (NEXT[a.q[n]] === b.q[n]) fwd++
    else if (NEXT[b.q[n]] === a.q[n]) back++
    else jump++
  }
}
const moved = fwd + back + jump
console.log('=== 象限の移り方（1営業日ごと・全業種合計） ===')
console.log(`同じ象限にとどまった: ${stay}回`)
console.log(`順方向(反時計回り): ${fwd}回 = 移動のうち${(fwd / moved * 100).toFixed(1)}%`)
console.log(`逆方向:             ${back}回 = ${(back / moved * 100).toFixed(1)}%`)
console.log(`対角へ飛んだ:       ${jump}回 = ${(jump / moved * 100).toFixed(1)}%`)
console.log(`※ 行き先がでたらめなら順方向は33.3%になる`)
