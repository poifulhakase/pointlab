#!/usr/bin/env node
// 一目均衡表は当たるのか（R&D・2026-08-13）
//
// 🔴 「波動の書 巻四」に一目を載せる前に測る。載せてから測るのは順序が逆で、
//    載せたものを正当化する数字を探すことになる（ぽいロボは研究が先・[[project_stock_calendar]]）。
//
// 🔵 一目は3つの部分に分かれていて、測れるかどうかが違う。
//    ① 型（雲抜け・転換/基準クロス・三役好転） … **完全に機械的**。そのまま測れる。
//    ② 時間論（基本数値 9・17・26） … 転換点の間隔を数えれば測れる。
//    ③ 水準論（V・N・E・NT計算値） … 値幅の予測式なので、実際の到達点と突き合わせれば測れる。
//    測れないのは波動論のカウント（I・V・N・P・Y のどれと数えるか）だけ。
//
// 🔴 パラメータをいじって当たりを作らないため、(9,26,52) 以外も振って全部出す。
//    1つだけ当たったら、それは効いたのではなく当たる設定を選んだだけ。
//
// 使い方: node scripts/analyze-ichimoku.mjs

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const tval = a => { if (a.length < 2) return null; const m = mean(a); return m / (sd(a) / Math.sqrt(a.length)) }
const pc = v => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }

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
    if (!(q.close[i] > 0)) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      high: q.high[i] ?? q.close[i], low: q.low[i] ?? q.close[i], close: q.close[i],
    })
  })
  return out
}

/** 一目の各線。🔴 先行スパンは26本先へずらすので、i 日目の雲は i-26 日目の材料でできている（先読みではない）。 */
function ichimoku(rows, [T, K, S]) {
  const hh = (i, n) => Math.max(...rows.slice(i - n + 1, i + 1).map(r => r.high))
  const ll = (i, n) => Math.min(...rows.slice(i - n + 1, i + 1).map(r => r.low))
  const conv = [], base = [], spanA = [], spanB = []
  for (let i = 0; i < rows.length; i++) {
    conv[i] = i >= T - 1 ? (hh(i, T) + ll(i, T)) / 2 : null
    base[i] = i >= K - 1 ? (hh(i, K) + ll(i, K)) / 2 : null
    const a = conv[i] != null && base[i] != null ? (conv[i] + base[i]) / 2 : null
    const b = i >= S - 1 ? (hh(i, S) + ll(i, S)) / 2 : null
    if (i + K < rows.length) { spanA[i + K] = a; spanB[i + K] = b }
  }
  return { conv, base, spanA, spanB }
}

/** 確定した山谷。🔴 k 本経たないと確定しないので、使えるのは i-k 日目まで。 */
function pivots(rows, k) {
  const out = []
  for (let i = k; i < rows.length - k; i++) {
    const w = rows.slice(i - k, i + k + 1)
    if (rows[i].high === Math.max(...w.map(r => r.high))) out.push({ i, kind: 'H', p: rows[i].high })
    else if (rows[i].low === Math.min(...w.map(r => r.low))) out.push({ i, kind: 'L', p: rows[i].low })
  }
  // 同じ向きが続いたら極値の方だけ残す（山→山→谷 のような並びを作らない）
  const clean = []
  for (const p of out) {
    const last = clean[clean.length - 1]
    if (!last || last.kind !== p.kind) { clean.push(p); continue }
    if ((p.kind === 'H' && p.p > last.p) || (p.kind === 'L' && p.p < last.p)) clean[clean.length - 1] = p
  }
  return clean
}

function fwd(rows, i, n) {
  if (i + n >= rows.length) return null
  return rows[i + n].close / rows[i].close - 1
}

function report(label, hits, rows, horizons, base) {
  const parts = horizons.map(n => {
    const a = hits.map(i => fwd(rows, i, n)).filter(v => v != null)
    if (!a.length) return `${n}日 —`
    const m = mean(a)
    const win = a.filter(v => v > 0).length / a.length
    const b = base && base[n] != null ? base[n] : 0
    // 🔴 t は**基準（全日の平均）との差**で見る。0 との差で測ると、
    //    ただ株が上がっただけの分まで「効いた」ことになってしまう。
    const t = tval(a.map(v => v - b))
    return `${n}日 ${pc(m)}(基準比 ${pc(m - b)}) 勝率${(win * 100).toFixed(0)}% t=${t.toFixed(2)}`
  })
  console.log(`  ${label.padEnd(26)} n=${String(hits.length).padStart(4)}  ${parts.join(' / ')}`)
}

const HZ = [5, 20, 60]

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  console.log(`\n日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）\n`)

  // 基準：全日の平均
  const base = {}
  for (const n of HZ) base[n] = mean(rows.map((_, i) => fwd(rows, i, n)).filter(v => v != null))
  console.log(`基準（全日）: ${HZ.map(n => `${n}日 ${pc(base[n])}`).join(' / ')}\n`)

  // ── ① 型（機械的に決まる）──────────────────────────────────────────────
  for (const P of [[9, 26, 52], [7, 22, 44], [12, 30, 60]]) {
    const { conv, base: bl, spanA, spanB } = ichimoku(rows, P)
    console.log(`■ パラメータ (${P.join(',')})`)

    const cloudTop = i => (spanA[i] != null && spanB[i] != null ? Math.max(spanA[i], spanB[i]) : null)
    const cloudBot = i => (spanA[i] != null && spanB[i] != null ? Math.min(spanA[i], spanB[i]) : null)

    const upBreak = [], downBreak = [], goldX = [], deadX = [], triple = [], tripleBad = []
    for (let i = 1; i < rows.length; i++) {
      const ct = cloudTop(i), cb = cloudBot(i), ct1 = cloudTop(i - 1), cb1 = cloudBot(i - 1)
      if (ct != null && ct1 != null) {
        if (rows[i].close > ct && rows[i - 1].close <= ct1) upBreak.push(i)
        if (rows[i].close < cb && rows[i - 1].close >= cb1) downBreak.push(i)
      }
      if (conv[i] != null && bl[i] != null && conv[i - 1] != null && bl[i - 1] != null) {
        if (conv[i] > bl[i] && conv[i - 1] <= bl[i - 1]) goldX.push(i)
        if (conv[i] < bl[i] && conv[i - 1] >= bl[i - 1]) deadX.push(i)
      }
      // 三役好転：転換>基準／終値>雲／遅行(終値)が26日前の終値を上回る。前日は不成立だった日だけ拾う
      const ok = j => {
        const t = cloudTop(j)
        return conv[j] != null && bl[j] != null && t != null && j >= P[1] &&
          conv[j] > bl[j] && rows[j].close > t && rows[j].close > rows[j - P[1]].close
      }
      const ng = j => {
        const b2 = cloudBot(j)
        return conv[j] != null && bl[j] != null && b2 != null && j >= P[1] &&
          conv[j] < bl[j] && rows[j].close < b2 && rows[j].close < rows[j - P[1]].close
      }
      if (ok(i) && !ok(i - 1)) triple.push(i)
      if (ng(i) && !ng(i - 1)) tripleBad.push(i)
    }
    report('雲を上抜け', upBreak, rows, HZ, base)
    report('雲を下抜け', downBreak, rows, HZ, base)
    report('転換線が基準線を上抜け', goldX, rows, HZ, base)
    report('転換線が基準線を下抜け', deadX, rows, HZ, base)
    report('三役好転', triple, rows, HZ, base)
    report('三役逆転', tripleBad, rows, HZ, base)
    console.log('')
  }

  // ── ② 時間論（基本数値 9・17・26）────────────────────────────────────
  console.log('■ 時間論：転換点どうしの間隔（営業日）')
  for (const k of [3, 5, 10]) {
    const pv = pivots(rows, k)
    const gaps = []
    for (let i = 1; i < pv.length; i++) gaps.push(pv[i].i - pv[i - 1].i)
    const inRange = gaps.filter(g => g >= 5 && g <= 30)
    const near = (t, w = 1) => inRange.filter(g => Math.abs(g - t) <= w).length
    // 5〜30日の範囲で一様なら、±1日の帯（3日ぶん）は 3/26 ≒ 11.5% に入るはず
    const exp = (3 / 26) * inRange.length
    console.log(`  山谷の確定 k=${k}: 転換点${pv.length}個 間隔中央値 ${median(gaps)}日 ／ 5-30日に入る${inRange.length}件のうち`)
    for (const t of [9, 17, 26]) {
      const c = near(t)
      console.log(`    ${t}日±1 … ${c}件 (${((c / inRange.length) * 100).toFixed(1)}%) 一様なら${exp.toFixed(0)}件 (11.5%)`)
    }
    // 🔴 「9が多い」は基本数値のせいではなく**短い波が多いだけ**かもしれない。
    //    隣の日数と並べて、9だけが飛び出しているのかを見る。
    const hist = []
    for (let g = 5; g <= 20; g++) hist.push(`${g}:${inRange.filter(x => x === g).length}`)
    console.log(`    間隔の分布 ${hist.join(' ')}`)
  }
  console.log('')

  // ── ③ 水準論（V・N・E・NT計算値）────────────────────────────────────
  // 上げの場合：A(谷) → B(山) → C(谷) と来たあとの次の山 D を4つの式で予想する
  //   V = B + (B - C) ／ N = C + (B - A) ／ E = B + (B - A) ／ NT = C + (C - A)
  console.log('■ 水準論：次の山をどれだけ当てるか（上げの場合）')
  for (const k of [3, 5, 10]) {
    const pv = pivots(rows, k)
    const rowsErr = { V: [], N: [], E: [], NT: [] }
    let best = { V: 0, N: 0, E: 0, NT: 0 }, n = 0
    for (let i = 3; i < pv.length; i++) {
      const [a, b, c, d] = [pv[i - 3], pv[i - 2], pv[i - 1], pv[i]]
      if (!(a.kind === 'L' && b.kind === 'H' && c.kind === 'L' && d.kind === 'H')) continue
      if (!(c.p > a.p)) continue // 押し目が切り上がっている上げの場面だけ
      const pred = {
        V: b.p + (b.p - c.p),
        N: c.p + (b.p - a.p),
        E: b.p + (b.p - a.p),
        NT: c.p + (c.p - a.p),
      }
      let bk = null, be = Infinity
      for (const key of Object.keys(pred)) {
        const err = Math.abs(pred[key] - d.p) / d.p
        rowsErr[key].push(err)
        if (err < be) { be = err; bk = key }
      }
      best[bk]++; n++
    }
    console.log(`  山谷の確定 k=${k}: 対象${n}回`)
    for (const key of ['V', 'N', 'E', 'NT']) {
      console.log(`    ${key.padEnd(2)}計算値 … 誤差中央値 ${(median(rowsErr[key]) * 100).toFixed(2)}%  いちばん近かった回数 ${best[key]} (${((best[key] / n) * 100).toFixed(0)}%)`)
    }
    // 比較：直前の山をそのまま次の山とする「何も考えない予想」
    const naive = []
    const pv2 = pivots(rows, k)
    for (let i = 3; i < pv2.length; i++) {
      const [a, b, c, d] = [pv2[i - 3], pv2[i - 2], pv2[i - 1], pv2[i]]
      if (!(a.kind === 'L' && b.kind === 'H' && c.kind === 'L' && d.kind === 'H')) continue
      if (!(c.p > a.p)) continue
      naive.push(Math.abs(b.p - d.p) / d.p)
    }
    console.log(`    （比較）前の山と同値 … 誤差中央値 ${(median(naive) * 100).toFixed(2)}%`)
  }
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
