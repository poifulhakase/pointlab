#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 歴史的サポートは効くのか（2026-09-02 追加・TARGET の土台）
//
// きっかけ（運用者との相談・2026-09-02）＝アプリの目的を「安く買って高く売る」だけにする。
//   手口は**歴史的サポート狙い**＝過去に何度も反発してきた価格帯まで落ちてきた銘柄を拾う。
//   🔴 **UIを作る前に測る**。このリポジトリでは直感で「効くはず」と思ったもの
//      （下ヒゲ＝セリクラ買い／買残積み上がりで売り／200日線で逃げる／下降トレンドでベア）が
//      4件とも外れ、うち1件は**符号が逆**だった。同じ轍を踏まない。
//   🔵 今回は条件が良い＝日経1本では n=4,890 必要だったが、**銘柄横断なら事例が桁違いに集まる**。
//
// 測るもの:
//   - サポート帯 … 局所安値（前後 W 日で最安）を ±BAND% でまとめ、**別々の時期に MIN_TOUCH 回以上**
//                   触れているものだけを「歴史的サポート」とする（各タッチは SEP 営業日以上離す）
//   - 事象      … 上から降りてきて、その帯に**初めて入った日**。エントリーはその日の終値
//   - 成績      … 20日後／60日後のリターン・勝率・期待値・中央値・最悪値
//
// 🔴 **先読みの禁止**。サポート帯はその日より**前のバーだけ**で組み直す（歩かせる）。
//    局所安値は確定に W 日かかるので、判定日 t で使えるのは i <= t-1-W の安値だけ。
//    ここを緩めると「あとから見れば3回反発していた」帯を使うことになり、成績が嘘になる。
// 🔴 **比較の相手は0%ではない**。同じ日に**サンプル全銘柄を買った場合の平均**を並べる。
//    株には上昇バイアスがあるので、勝率50%超・平均プラスはそれだけでは何の意味も無い。
// 🔵 売買コスト・スリッページ・板の薄さは入れていない。実運用はこれより悪くなる。
//    ここで見たいのは「この形に意味があるか」だけなので素の数字を出す。
//
// 使い方:
//   node scripts/analyze-support-bounce.mjs                    … 既定400銘柄・15年
//   node scripts/analyze-support-bounce.mjs --limit=800
//   node scripts/analyze-support-bounce.mjs --all              … 全上場（3,700超・時間がかかる）
//   node scripts/analyze-support-bounce.mjs --band=2 --touch=4 … 定義を振る
//   node scripts/analyze-support-bounce.mjs --sweep            … 定義を総当たりで振って崩れないか見る
//   node scripts/analyze-support-bounce.mjs --json
//
// 🔵 取得した日足は .cache/support/ に置く（再取得しない）。定義を振るときに効く。
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const args = process.argv.slice(2)
const numArg = (k, d) => {
  const a = args.find(x => x.startsWith(`--${k}=`))
  return a ? Number(a.split('=')[1]) : d
}
const AS_JSON = args.includes('--json')
const SWEEP = args.includes('--sweep')
const ALL = args.includes('--all')
const LIMIT = ALL ? Infinity : numArg('limit', 400)
const YEARS = numArg('years', 15)
const CONCURRENCY = numArg('concurrency', 6)

// ── 定義（既定値。--sweep で振る）────────────────────────────
const DEF = {
  W: numArg('pivot', 20),        // 局所安値の窓（前後この本数で最安なら安値）
  BAND: numArg('band', 3) / 100, // 帯の幅（±%）
  MIN_TOUCH: numArg('touch', 3), // 何回触れていたら「歴史的」か
  SEP: numArg('sep', 60),        // タッチ同士を別物とみなす間隔（営業日）
  WARMUP: numArg('warmup', 750), // 帯を組むのに最低限必要な本数（約3年）
}
const HORIZONS = [20, 60]
const COOLDOWN = 60              // 同じ帯で連続して事象を数えない期間（営業日）

const log = (s = '') => { if (!AS_JSON) console.log(s) }
// 🔴 v2＝**分割調整（adjclose）を入れた版**。v1 は素の close を使っていて、
//    分割日が −90%・株式併合日が +900% のリターンとして混ざり、ベースライン平均が
//    +17,711% になっていた（2026-09-02 に実測して発覚）。日本株は分割・併合が多い。
const CACHE = path.resolve(process.cwd(), '.cache/support-v2')

// ── 取得 ────────────────────────────────────────────────
async function fetchDaily(code) {
  const file = path.join(CACHE, `${code}.json`)
  if (fs.existsSync(file)) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(j) && j.length) return j
    } catch { /* 壊れていたら取り直す */ }
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?interval=1d&range=${YEARS}y`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error('no result')
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const adj = r.indicators?.adjclose?.[0]?.adjclose ?? null
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.low?.[i] == null) continue
    // 🔴 **分割調整**。素の close で計算すると分割日が −90%・併合日が +900% になる。
    //    adjclose/close の比を OHLC 全部に掛けて、価格帯（サポート）も同じ物差しに乗せる。
    //    🔵 adjclose が無い銘柄は比を1として素の値を使う（新規上場直後など）。
    const f = (adj?.[i] != null && q.close[i]) ? adj[i] / q.close[i] : 1
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      low: q.low[i] * f, high: (q.high?.[i] ?? q.close[i]) * f, close: q.close[i] * f,
      vol: q.volume?.[i] ?? 0,
    })
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(rows))
  return rows
}

/** 同時に何本か走らせる（Yahoo を叩きすぎない） */
async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++
      try { out[k] = await fn(items[k], k) } catch (e) { out[k] = { error: String(e.message ?? e) } }
    }
  }))
  return out
}

// ── サポート帯 ──────────────────────────────────────────
/**
 * 局所安値の位置を返す（`i` は bars の添字）。
 * 🔴 前後 W 本ぶん必要なので、いちばん新しい安値でも W 本前までしか確定しない。
 */
function pivotLows(bars, W) {
  const out = []
  for (let i = W; i < bars.length - W; i++) {
    const v = bars[i].low
    let ok = true
    for (let k = i - W; k <= i + W; k++) {
      if (bars[k].low < v) { ok = false; break }
    }
    if (ok) out.push(i)
  }
  return out
}

/**
 * 安値を帯にまとめ、条件を満たす帯だけ返す。
 * @param pivots 使ってよい安値の添字（呼び出し側で「その日より前」に絞る）
 */
function buildBands(bars, pivots, { BAND, MIN_TOUCH, SEP }) {
  const sorted = [...pivots].sort((a, b) => bars[a].low - bars[b].low)
  const bands = []
  let cur = []
  for (const idx of sorted) {
    if (cur.length === 0) { cur = [idx]; continue }
    const base = bars[cur[0]].low
    if (bars[idx].low <= base * (1 + BAND * 2)) cur.push(idx)
    else { bands.push(cur); cur = [idx] }
  }
  if (cur.length) bands.push(cur)

  const out = []
  for (const group of bands) {
    // 🔴 同じ下落局面での連続タッチを1回に畳む（近すぎる安値は別物として数えない）
    const byTime = [...group].sort((a, b) => a - b)
    const kept = []
    for (const idx of byTime) {
      if (kept.length === 0 || idx - kept[kept.length - 1] >= SEP) kept.push(idx)
    }
    if (kept.length < MIN_TOUCH) continue
    const price = kept.reduce((s, i) => s + bars[i].low, 0) / kept.length
    out.push({ price, touches: kept.length, lastIdx: kept[kept.length - 1] })
  }
  return out
}

// ── 1銘柄ぶんの事象を集める ──────────────────────────────
function eventsFor(bars, def) {
  const { W, BAND, WARMUP } = def
  if (bars.length < WARMUP + Math.max(...HORIZONS) + W + 10) return []

  const pivots = pivotLows(bars, W)
  const events = []
  const cooldown = new Map() // 帯の価格(丸め) => 次に数えてよい添字

  let pIdx = 0
  const usable = [] // その日までに確定している安値
  for (let t = WARMUP; t < bars.length - Math.max(...HORIZONS); t++) {
    // 🔴 t の時点で確定しているのは i <= t-1-W の安値だけ（前後W本を見て決まるため）
    const limit = t - 1 - W
    while (pIdx < pivots.length && pivots[pIdx] <= limit) usable.push(pivots[pIdx++])
    if (usable.length < def.MIN_TOUCH) continue

    const bands = buildBands(bars, usable, def)
    if (!bands.length) continue

    const prev = bars[t - 1]
    for (const b of bands) {
      const top = b.price * (1 + BAND)
      const bottom = b.price * (1 - BAND)
      // 上から降りてきて、その日はじめて帯に入った
      if (!(prev.close > top && bars[t].low <= top && bars[t].low >= bottom * 0.9)) continue
      const key = Math.round(b.price * 100)
      if ((cooldown.get(key) ?? -1) >= t) continue
      cooldown.set(key, t + COOLDOWN)

      const entry = bars[t].close
      const fwd = {}
      for (const h of HORIZONS) fwd[h] = bars[t + h].close / entry - 1
      // 帯を大きく割ったか（−10%）
      let broke = false
      for (let k = t + 1; k <= t + HORIZONS[HORIZONS.length - 1]; k++) {
        if (bars[k].close < b.price * 0.90) { broke = true; break }
      }
      events.push({ t, date: bars[t].date, entry, touches: b.touches, band: b.price, fwd, broke })
    }
  }
  return events
}

// ── 統計 ────────────────────────────────────────────────
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const pctf = v => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)

/** 二項検定のざっくり近似（勝率が baseline と偶然の差かどうか） */
function zTest(wins, n, p0) {
  if (!n) return null
  const p = wins / n
  const se = Math.sqrt(p0 * (1 - p0) / n)
  if (!se) return null
  const z = (p - p0) / se
  // 正規分布の両側 p 値（Abramowitz-Stegun 近似）
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const prob = d * t * (1.330274 * t ** 4 - 1.821256 * t ** 3 + 1.781478 * t * t - 0.356538 * t + 0.319382)
  return { z, p: 2 * prob }
}

function summarize(events, baselineByDate, h) {
  const rows = events.filter(e => e.fwd[h] != null)
  const rets = rows.map(e => e.fwd[h])
  // 同じ日に「サンプル全銘柄を買った場合」を相手にする
  const paired = rows.map(e => ({ r: e.fwd[h], b: baselineByDate.get(`${e.date}|${h}`) ?? null }))
    .filter(x => x.b != null)
  const beat = paired.filter(x => x.r > x.b).length
  const baseRets = paired.map(x => x.b)
  return {
    n: rows.length,
    win: rows.length ? rows.filter(e => e.fwd[h] > 0).length / rows.length : null,
    mean: mean(rets), median: median(rets),
    worst: rets.length ? Math.min(...rets) : null,
    broke: rows.length ? rows.filter(e => e.broke).length / rows.length : null,
    baseMean: mean(baseRets),
    beatRate: paired.length ? beat / paired.length : null,
    beatN: paired.length,
    test: zTest(beat, paired.length, 0.5),
  }
}

// ── 本体 ────────────────────────────────────────────────
async function main() {
  const masterPath = path.resolve(process.cwd(), 'public/data/stock_master.json')
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'))
  let codes = master.data.map(d => d.code).filter(c => /^[0-9]{4}$/.test(c))

  // 🔵 偏らないように等間隔で間引く（先頭から取ると業種が水産・食品に寄る）
  if (codes.length > LIMIT) {
    const step = codes.length / LIMIT
    codes = Array.from({ length: LIMIT }, (_, i) => codes[Math.floor(i * step)])
  }

  log(`=== 歴史的サポートは効くのか ===`)
  log(`対象 ${codes.length}銘柄 / ${YEARS}年 / 定義 W=${DEF.W} 帯±${DEF.BAND * 100}% タッチ${DEF.MIN_TOUCH}回以上 間隔${DEF.SEP}日`)
  log(`取得中…（.cache/support に貯めるので2回目からは速い）`)

  let done = 0
  const series = await pool(codes, CONCURRENCY, async code => {
    const bars = await fetchDaily(code)
    done++
    if (!AS_JSON && done % 50 === 0) process.stdout.write(`  ${done}/${codes.length}\r`)
    return { code, bars }
  })
  // 🔴 調整しても壊れている系列は落とす（1日で ±60% を超える動きが複数回あるもの）。
  //    ベースラインは平均なので、1銘柄の異常値が全体をひっくり返す。
  const sane = bars => {
    let bad = 0
    for (let i = 1; i < bars.length; i++) {
      const r = bars[i].close / bars[i - 1].close - 1
      if (!Number.isFinite(r) || Math.abs(r) > 0.6) bad++
      if (bad > 1) return false
    }
    return true
  }
  const ok = series.filter(s => s && s.bars && s.bars.length > DEF.WARMUP && sane(s.bars))
  log(`\n取得できたのは ${ok.length}銘柄（${codes.length - ok.length}件は履歴が短いか取得失敗）`)

  const defs = SWEEP
    ? [2, 3, 4].flatMap(band => [3, 4, 5].map(touch => ({ ...DEF, BAND: band / 100, MIN_TOUCH: touch })))
    : [DEF]

  const results = []
  for (const def of defs) {
    // ベースライン＝その日にサンプル全銘柄を買ったときの平均（日付ごと・期間ごと）
    const baseSum = new Map()
    for (const { bars } of ok) {
      const idx = new Map(bars.map((b, i) => [b.date, i]))
      for (const h of HORIZONS) {
        for (const [date, i] of idx) {
          if (i + h >= bars.length) continue
          const key = `${date}|${h}`
          const cur = baseSum.get(key) ?? { s: 0, n: 0 }
          cur.s += bars[i + h].close / bars[i].close - 1
          cur.n++
          baseSum.set(key, cur)
        }
      }
    }
    const baselineByDate = new Map()
    for (const [k, v] of baseSum) if (v.n >= 30) baselineByDate.set(k, v.s / v.n)

    const events = []
    for (const { code, bars } of ok) {
      for (const e of eventsFor(bars, def)) events.push({ ...e, code })
    }

    const r = { def: { band: def.BAND, touch: def.MIN_TOUCH }, events: events.length, byH: {} }
    for (const h of HORIZONS) r.byH[h] = summarize(events, baselineByDate, h)
    results.push(r)

    log('')
    log(`── 帯±${(def.BAND * 100).toFixed(0)}% / タッチ${def.MIN_TOUCH}回以上 → 事例 ${events.length}件 ──`)
    for (const h of HORIZONS) {
      const s = r.byH[h]
      if (!s.n) { log(`  ${h}日後: 事例なし`); continue }
      log(`  ${h}日後 n=${s.n}  勝率 ${(s.win * 100).toFixed(1)}%  平均 ${pctf(s.mean)}  中央 ${pctf(s.median)}  最悪 ${pctf(s.worst)}  −10%割れ ${(s.broke * 100).toFixed(1)}%`)
      log(`         ベースライン（同じ日に全銘柄）平均 ${pctf(s.baseMean)}  → 上回った割合 ${(s.beatRate * 100).toFixed(1)}%（n=${s.beatN}${s.test ? `・p=${s.test.p.toFixed(3)}` : ''}）`)
    }

    // 🔴 **本命の検証**＝「歴史は繰り返す」なら**触れた回数が多い帯ほど成績が良い**はず。
    //    ここが単調に伸びていなければ、回数を数えること自体に意味が無い
    //    （＝「安値圏まで落ちた」以上の情報を持っていない）。
    //    🔵 --touch=1 で走らせると1回だけの帯も入るので、対照群込みで比べられる。
    const buckets = new Map()
    for (const e of events) {
      const k = e.touches >= 5 ? '5+' : String(e.touches)
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k).push(e)
    }
    if (buckets.size > 1) {
      log('')
      log('  ── タッチ回数べつ（歴史は繰り返すのか）──')
      for (const k of [...buckets.keys()].sort()) {
        const rows = buckets.get(k)
        const line = HORIZONS.map(h => {
          const s = summarize(rows, baselineByDate, h)
          return `${h}日 平均${pctf(s.mean)}／ベース超え${s.beatRate == null ? '—' : (s.beatRate * 100).toFixed(1) + '%'}`
        }).join('  ')
        log(`  ${k}回 (n=${rows.length})  ${line}`)
      }
      r.byTouches = Object.fromEntries([...buckets].map(([k, rows]) => [
        k, { n: rows.length, ...Object.fromEntries(HORIZONS.map(h => [h, summarize(rows, baselineByDate, h)])) },
      ]))
    }
  }

  if (AS_JSON) console.log(JSON.stringify({ codes: ok.length, years: YEARS, results }, null, 2))
  else {
    log('')
    log('🔴 読み方＝見るのは「平均がプラスか」ではなく **ベースラインを上回ったか**。')
    log('   株には上昇バイアスがあるので、平均プラス・勝率50%超はそれだけでは何の意味も無い。')
    log('🔴 売買コスト・スリッページ・板の薄さは入れていない。実運用はこれより悪くなる。')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
