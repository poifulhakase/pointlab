#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 価格だけのベースライン（2026-08-22 追加）
//
// きっかけ（運用者との相談・2026-08-22）＝「上下を予想する優先順位に戻って考えたい」。
//   材料（需給・チャート・イベント・為替）の順位を議論で決めようとすると終わらない。
//   🔴 **先に「価格だけ」の成績を出して基準にする**。以後どの材料も
//      「この数字を超えたか」だけで判定でき、議論が「どう思うか」から「超えたか」に変わる。
//
// 測るもの:
//   - 判断時点 … **当日の終値**（ロボ口座の15:00判断＝引成の執行に合わせる）
//   - 対象     … **翌営業日の終値**が上か下か（robo_calibration.json と同じ基準）
//   - 物差し   … 方向を出した回数／勝率／平均リターン／期待値／最大DD／p値
//
// 🔴 **「常にロング」を必ず並べる**。日経には上昇バイアスがあるので、勝率50%超は
//    それだけでは何の意味も無い。超えるべき相手は50%ではなく**常にロング**。
// 🔴 使う指標は**当日終値まで**で計算する（翌日の値を混ぜない＝先読みの禁止）。
// 🔵 売買コスト・スリッページは入れていない。実運用はこれより悪くなる。
//    ここで見たいのは「材料に方向を当てる力があるか」だけなので、素の数字を出す。
//
// 使い方:
//   node scripts/analyze-price-baseline.mjs            … 20年
//   node scripts/analyze-price-baseline.mjs --years=10 … 期間を変える
//   node scripts/analyze-price-baseline.mjs --json     … 機械可読で出す
// ──────────────────────────────────────────────────────────────────────────

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const args = process.argv.slice(2)
const YEARS = Number((args.find(a => a.startsWith('--years=')) ?? '--years=20').split('=')[1])
const AS_JSON = args.includes('--json')

const log = (s = '') => { if (!AS_JSON) console.log(s) }
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
const pct = (v) => (v == null ? '—' : v.toFixed(2) + '%')

// ── データ取得 ───────────────────────────────────────────────
// 🔴 **`range=max` を使わない**（2026-08-22 に踏んだ罠）。
//    Yahoo は range=max のとき interval=1d の指定を黙って無視し、**3ヶ月足**を返す
//    （20年で168本しか無いのに日足のような顔をしている）。200日線が全部 null になって気づいた。
//    期間を長く取りたいときは **period1 / period2（UNIX秒）** を使う。
async function fetchDaily(symbol, years) {
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - Math.round(years * 366 * 86400) - 400 * 86400 // 指標の助走ぶん余分に取る
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`)
  const r = (await res.json())?.chart?.result?.[0]
  if (!r) throw new Error(`no result for ${symbol}`)
  // 日足で返ってきたかを必ず確かめる（黙って粗い足になっていたら止める）
  const gran = r.meta?.dataGranularity
  if (gran && gran !== '1d') throw new Error(`日足ではなく ${gran} が返ってきました（取得条件を見直すこと）`)
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? q.close[i],
      high: q.high?.[i] ?? q.close[i],
      low:  q.low?.[i]  ?? q.close[i],
      close: q.close[i],
    })
  }
  return rows
}

// ── 指標（すべて当日終値まで） ───────────────────────────────
function withIndicators(rows) {
  const c = rows.map(r => r.close)
  const sma = (n, i) => (i + 1 < n ? null : c.slice(i + 1 - n, i + 1).reduce((s, v) => s + v, 0) / n)

  return rows.map((r, i) => {
    const ma25  = sma(25, i)
    const ma75  = sma(75, i)
    const ma200 = sma(200, i)
    const prev  = i > 0 ? c[i - 1] : null

    // 20日レンジ内の位置（0=安値・100=高値）
    let range20 = null
    if (i >= 19) {
      const w = rows.slice(i - 19, i + 1)
      const hi = Math.max(...w.map(x => x.high))
      const lo = Math.min(...w.map(x => x.low))
      range20 = hi > lo ? ((r.close - lo) / (hi - lo)) * 100 : 50
    }

    // 高安の切り上げ／切り下げ（直近10日 vs その前の10日）
    let structure = null
    if (i >= 19) {
      const a = rows.slice(i - 19, i - 9)
      const b = rows.slice(i - 9, i + 1)
      const hiUp = Math.max(...b.map(x => x.high)) > Math.max(...a.map(x => x.high))
      const loUp = Math.min(...b.map(x => x.low))  > Math.min(...a.map(x => x.low))
      structure = hiUp && loUp ? 1 : (!hiUp && !loUp ? -1 : 0)
    }

    return {
      ...r,
      ma25, ma75, ma200,
      dev25: ma25 ? ((r.close / ma25) - 1) * 100 : null,
      slope25: (i >= 25 && ma25 && sma(25, i - 5)) ? ma25 - sma(25, i - 5) : null,
      ret1: prev ? ((r.close / prev) - 1) * 100 : null,
      ret5: i >= 5 ? ((r.close / c[i - 5]) - 1) * 100 : null,
      range20, structure,
      // ローソクの形（当日）
      lowerWick: (r.high > r.low) ? ((Math.min(r.open, r.close) - r.low) / (r.high - r.low)) * 100 : null,
    }
  })
}

// ── 規則（価格だけ・当日終値で判断し、翌日の終値で答え合わせ） ──
// 返り値 +1=ロング / -1=ショート / 0=見送り
const RULES = [
  {
    key: 'always_long', label: '常にロング（★これが超えるべき相手）',
    why: '日経の上昇バイアスそのもの。勝率50%超はこれだけで達成できるので、比較の基準はここ',
    f: () => 1,
  },
  {
    key: 'ma25', label: '25日線の上ならロング／下ならショート',
    why: 'いちばん素朴なトレンド追随',
    f: (d) => (d.ma25 == null ? 0 : (d.close > d.ma25 ? 1 : -1)),
  },
  {
    key: 'ma200', label: '200日線の上ならロング／下ならショート',
    why: '中長期のトレンド追随',
    f: (d) => (d.ma200 == null ? 0 : (d.close > d.ma200 ? 1 : -1)),
  },
  {
    key: 'slope25', label: '25日線が上向きならロング／下向きならショート',
    why: '水準ではなく傾きで見る',
    f: (d) => (d.slope25 == null ? 0 : (d.slope25 > 0 ? 1 : -1)),
  },
  {
    key: 'mom1', label: '前日と同じ方向（1日モメンタム）',
    why: '上がった翌日は上がるか',
    f: (d) => (d.ret1 == null ? 0 : (d.ret1 > 0 ? 1 : -1)),
  },
  {
    key: 'rev1', label: '前日と逆（1日リバーサル）',
    why: '上がった翌日は下がるか。mom1 の裏返しなので、片方が勝てば片方は負ける',
    f: (d) => (d.ret1 == null ? 0 : (d.ret1 > 0 ? -1 : 1)),
  },
  {
    key: 'rev5', label: '5日で下げていたらロング／上げていたらショート',
    why: '短期の行き過ぎの揺り戻し',
    f: (d) => (d.ret5 == null ? 0 : (d.ret5 < 0 ? 1 : -1)),
  },
  {
    key: 'dev25_3', label: '25日線から−3%以下でロング／+3%以上でショート（他は見送り）',
    why: '押し目買い・戻り売り。見送りを許すので回数は減る',
    f: (d) => (d.dev25 == null ? 0 : (d.dev25 <= -3 ? 1 : (d.dev25 >= 3 ? -1 : 0))),
  },
  {
    key: 'range20', label: '20日レンジの下20%でロング／上20%でショート（他は見送り）',
    why: 'レンジ内の位置だけで逆張り',
    f: (d) => (d.range20 == null ? 0 : (d.range20 <= 20 ? 1 : (d.range20 >= 80 ? -1 : 0))),
  },
  {
    key: 'structure', label: '高安の切り上げでロング／切り下げでショート（他は見送り）',
    why: 'チャートの「高値・安値の並び」を数値にしたもの',
    f: (d) => (d.structure == null ? 0 : d.structure),
  },
  {
    key: 'lowerwick', label: '下ヒゲ50%以上でロング（他は見送り）',
    why: '🔴 2026-08-22 の相談で出た「下ヒゲが長い＝セリクラ」の読みを数値にしたもの',
    f: (d) => (d.lowerWick == null ? 0 : (d.lowerWick >= 50 ? 1 : 0)),
  },
  {
    key: 'trend_dip', label: '200日線の上、かつ25日線から−3%以下でロング（他は見送り）',
    why: '「上昇トレンドの押し目だけ買う」＝ぽいロボが本線に選んだ形（v5a）と同じ考え方',
    f: (d) => (d.ma200 == null || d.dev25 == null ? 0 : (d.close > d.ma200 && d.dev25 <= -3 ? 1 : 0)),
  },
]

// ── 採点 ─────────────────────────────────────────────────
function evaluate(rows, rule) {
  let n = 0, wins = 0, sum = 0
  let equity = 1, peak = 1, maxDD = 0
  const nextRet = (i) => ((rows[i + 1].close / rows[i].close) - 1) * 100

  for (let i = 0; i < rows.length - 1; i++) {
    const pos = rule.f(rows[i])
    if (pos === 0) continue
    const ret = nextRet(i) * pos
    n++
    if (ret > 0) wins++
    sum += ret
    equity *= 1 + ret / 100
    peak = Math.max(peak, equity)
    maxDD = Math.min(maxDD, equity / peak - 1)
  }

  const winRate = n ? (wins / n) * 100 : null
  const avg = n ? sum / n : null
  // 二項検定（正規近似）：勝率が50%と偶然の範囲で違うだけか
  const z = n ? ((wins - n / 2) / Math.sqrt(n / 4)) : 0
  const p = n ? 2 * (1 - normCdf(Math.abs(z))) : null

  return {
    key: rule.key, label: rule.label, why: rule.why,
    trades: n, coverage: r2((n / (rows.length - 1)) * 100),
    winRate: r2(winRate), avgRet: r2(avg),
    total: r2((equity - 1) * 100), maxDD: r2(maxDD * 100),
    z: r2(z), p: p == null ? null : Math.round(p * 1000) / 1000,
  }
}

function normCdf(x) {
  // Abramowitz-Stegun の近似
  const t = 1 / (1 + 0.2316419 * x)
  const d = 0.3989422804014327 * Math.exp(-x * x / 2)
  return 1 - d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
}

// ── 実行 ─────────────────────────────────────────────────
;(async () => {
  const all = await fetchDaily('^N225', YEARS)
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - YEARS)
  const key = cutoff.toISOString().slice(0, 10)
  // 指標に200日分の助走が要るので、切り出す前に全期間で計算する
  const rowsAll = withIndicators(all)
  const rows = rowsAll.filter(r => r.date >= key)

  log('════════════════════════════════════════════════════════════')
  log(' 価格だけのベースライン（日経225・翌営業日の終値方向）')
  log('════════════════════════════════════════════════════════════')
  log(` 期間 : ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）`)
  log(' 判断 : その日の終値／答え合わせ : 翌営業日の終値')
  log(' 🔵 売買コスト・スリッページは入れていない')
  log('')

  const results = RULES.map(r => evaluate(rows, r))
  const base = results.find(r => r.key === 'always_long')

  log('規則                                                 回数   出番   勝率   平均   累計    最大DD   p値')
  log('─────────────────────────────────────────────────────────────────────────────────────────────')
  for (const r of results) {
    const mark = r.key === 'always_long' ? '★' : (r.winRate > base.winRate ? '＋' : '  ')
    log(
      mark + r.label.slice(0, 44).padEnd(46, '　').slice(0, 46) +
      String(r.trades).padStart(6) +
      (r.coverage + '%').padStart(7) +
      (r.winRate + '%').padStart(8) +
      (r.avgRet + '%').padStart(8) +
      (r.total > 9999 ? '+' + Math.round(r.total / 100) + '倍' : r.total + '%').padStart(9) +
      (r.maxDD + '%').padStart(9) +
      String(r.p).padStart(7)
    )
  }
  log('')
  log('★＝比較の基準（常にロング）／＋＝基準より勝率が高い')
  log('🔴 p値は「勝率が50%と偶然の範囲で違うだけか」の目安。0.05未満なら偶然では説明しにくい。')
  log('   ただし12個も並べれば、そのうち1つくらいは偶然0.05を切る（多重比較）。')
  log('   🔴 **超えるべき相手は50%ではなく「常にロング」**。')

  if (AS_JSON) {
    console.log(JSON.stringify({
      generated_for: '価格だけのベースライン',
      period: { from: rows[0].date, to: rows[rows.length - 1].date, days: rows.length },
      basis: '当日の終値で判断し、翌営業日の終値で答え合わせ（コスト無し）',
      baseline_key: 'always_long',
      results,
    }, null, 2))
  }
})().catch(e => { console.error('失敗:', e.message); process.exit(1) })
