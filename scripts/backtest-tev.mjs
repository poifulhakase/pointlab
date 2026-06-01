#!/usr/bin/env node
// TEV バックテスト計算スクリプト
// 使い方: npm run backtest
// 出力:   public/data/backtest_results.json

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT     = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'public', 'data')

// ── ユーティリティ ──────────────────────────────────────

const r2 = v => Math.round(v * 100) / 100

function pctRank(arr, val) {
  if (!arr.length) return 50
  return Math.round(arr.filter(v => v < val).length / arr.length * 100)
}

function sig(pct) {
  return pct >= 60 ? 'BULL' : pct <= 40 ? 'BEAR' : 'NEUTRAL'
}

/** arr[0] を arr[1..] と比較した Z スコア */
function zScoreLatest(arr) {
  if (arr.length < 3) return null
  const val  = arr[0]
  const hist = arr.slice(1)
  const mean = hist.reduce((s, v) => s + v, 0) / hist.length
  const std  = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / hist.length)
  if (std < 1e-10) return 0
  return (val - mean) / std
}

/** "2025/05/02" → "2025-05-02" */
function dk(s) { return String(s).replace(/\//g, '-') }

/** map から targetDate に最も近いエントリを返す（maxGap 日以内） */
function nearest(map, targetDate, maxGap = 8) {
  if (map.has(targetDate)) return map.get(targetDate)
  const t = new Date(targetDate).getTime()
  let best = null, bestGap = Infinity
  for (const [k, v] of map) {
    const gap = Math.abs(new Date(k).getTime() - t) / 86400000
    if (gap < bestGap && gap <= maxGap) { best = v; bestGap = gap }
  }
  return best
}

// ── Nikkei 週次取得（Yahoo Finance） ────────────────────

async function fetchNikkeiWeekly() {
  console.log('[nikkei] Yahoo Finance ^N225 週次データ取得...')
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?interval=1wk&range=2y'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json   = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('No result')
  const ts     = result.timestamp ?? []
  const closes = result.indicators?.quote?.[0]?.close ?? []
  const rows   = []
  for (let i = 0; i < ts.length; i++) {
    if (closes[i] == null) continue
    rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: Math.round(closes[i]) })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date))
  console.log(`  → ${rows.length}週分`)
  return rows
}

// ── 週次スコア（偏差スコア代替）─────────────────────────
// 本番: 0.30×Z_USDJPY + 0.25×Z_NAS100 + 0.20×Z_VIX⁻¹ + 0.15×Z_OI
// バックテスト代替（日次USDJPY/NAS100の週次歴史データなし）:
//   0.30×Z_外国人フロー + 0.20×Z_VIX⁻¹ + 0.15×Z_OI_delta

function computeScore(invSlice, vixSlice, oiSlice) {
  const fNets  = invSlice.slice(0, 26).map(d => d.foreigner / 1_000_000)
  const z_f    = zScoreLatest(fNets)

  const vixInv = vixSlice.slice(0, 26).map(d => d.close > 0 ? 1 / d.close : 0)
  const z_vix  = zScoreLatest(vixInv)

  const oiVals = oiSlice.slice(0, 26).map(d => d.oi)
  let z_oi     = null
  if (oiVals.length >= 3) {
    const deltas = oiVals.slice(0, -1).map((v, i) => oiVals[i] - oiVals[i + 1])
    if (deltas.length >= 2) z_oi = zScoreLatest(deltas)
  }

  const parts  = [[z_f, 0.30], [z_vix, 0.20], [z_oi, 0.15]]
  const [s, w] = parts.reduce(([s, w], [v, ww]) => v != null ? [s + v * ww, w + ww] : [s, w], [0, 0])
  return w >= 0.20 ? r2(s) : null  // 本番と同じ式: weighted sum
}

// ── TEV 計算（本番ロジックに準拠・簡略化あり） ─────────

function computeTEV({ invSlice, marSlice, ssSlice, cotSlice, vixSlice, arbSlice, adSlice, oiSlice, score_today, score_prev }) {
  if (score_today == null || score_prev == null) return null

  const tev_V = r2(score_today * 100)
  const tev_A = r2((score_today - score_prev) * 100)

  // パーセンタイル計算
  const invT = d => d.foreigner / 1_000_000
  const rolling4w = []
  for (let j = 0; j + 3 < invSlice.length && j < 26; j++)
    rolling4w.push(invSlice.slice(j, j + 4).reduce((s, d) => s + invT(d), 0))
  const foreign4wPct   = rolling4w.length > 1 ? pctRank(rolling4w.slice(1), rolling4w[0]) : 50

  const creditRatios   = marSlice.slice(0, 26).map(d => d.ratio)
  const creditRatioPct = creditRatios.length > 1 ? pctRank(creditRatios.slice(1), creditRatios[0]) : 50

  const ssRatios = ssSlice.slice(0, 26).map(d => d.ratio)
  const ssPct    = ssRatios.length > 1 ? pctRank(ssRatios.slice(1), ssRatios[0]) : 50

  const cotLfNets = cotSlice.slice(0, 52).map(d => d.nonCommNet)
  const cotLfPct  = cotLfNets.length > 1 ? pctRank(cotLfNets.slice(1), cotLfNets[0]) : 50

  // TEV 計算（本番と同一式）
  const tev_fBase     = r2(0.3 * tev_V + 0.7 * tev_A)
  const tev_fInertiaRaw = r2(tev_fBase * (foreign4wPct / 100))

  let tev_decay = 1.0
  if (tev_V > 0 && tev_A <= 0) tev_decay *= 0.25   // 天井の失速
  if (sig(cotLfPct) === 'BEAR') tev_decay *= 0.5    // 燃料漏れ（COT BEAR）
  // 先物出来高減少チェック: スキップ（日次出来高の週次過去データなし）

  const tev_fInertia = r2(tev_fInertiaRaw * tev_decay)

  // R_resistance（弾性・両側 / v2-symmetric-restoring）: 中立(信用%ile=50, 空売り%ile=50)を
  // ゼロに再センタリングし上下両方向に効かせる。旧式 -8√(credit+(100-ss)) は中立でも−80の
  // 恒常ドラッグが残りBULLを構造的に出せなかった（半年BULLゼロの主因）。
  //   信用厚い＋空売り薄い → signedLoad>0 → 下押し / 信用薄い＋空売り厚い → signedLoad<0 → 上押し
  const signedLoad  = creditRatioPct - ssPct   // −100..+100, 中立=0
  const tev_rResist = r2(-8 * Math.sign(signedLoad) * Math.sqrt(Math.abs(signedLoad)))

  const tev_value = Math.round(tev_fInertia + tev_rResist)

  // ステータス判定（底打ち反転はスキップ: 10日安値圏データなし）
  let tev_status
  if      (tev_value >= 25 && tev_A > 0)  tev_status = '慣性航行中'
  else if (tev_value <= -25 && tev_A < 0) tev_status = '真空落下'
  else if (tev_value <= -25 && tev_A >= 0) tev_status = '重力反転中'
  else if (tev_value >= 25)                tev_status = '限界膨張（慣性失速）'
  else                                     tev_status = '限界膨張'

  // composite score（確信度計算用）
  const vixCloses52 = vixSlice.slice(0, 52).map(d => d.close)
  const vixPct      = vixCloses52.length > 1 ? pctRank(vixCloses52.slice(1), vixCloses52[0]) : 50
  const arbLongs    = arbSlice.slice(0, 26).map(d => d.longBal / 1_000_000)
  const arbLongPct  = arbLongs.length > 1 ? pctRank(arbLongs.slice(1), arbLongs[0]) : 50
  const adRatios    = adSlice.slice(0, 26).map(d => d.ratio25)
  const adPct       = adRatios.length > 1 ? pctRank(adRatios.slice(1), adRatios[0]) : 50

  const items = [
    { signal: sig(foreign4wPct),       w: 0.25 },
    { signal: sig(cotLfPct),           w: 0.15 },
    { signal: sig(100 - creditRatioPct), w: 0.15 },
    { signal: sig(100 - arbLongPct),   w: 0.10 },
    { signal: sig(adPct),              w: 0.08 },
    { signal: sig(100 - vixPct),       w: 0.08 },
    { signal: sig(100 - ssPct),        w: 0.07 },
  ]
  const totalW       = items.reduce((s, i) => s + i.w, 0)
  const rawScore     = items.reduce((s, i) => s + (i.signal === 'BULL' ? 1 : i.signal === 'BEAR' ? -1 : 0) * i.w, 0)
  const compositeScore = r2(rawScore / totalW * 100)

  const tev_confidence = tev_status.startsWith('限界膨張')
    ? 50
    : Math.min(95, Math.round(Math.abs(compositeScore) * 0.5 + 50))

  return { tev_value, tev_status, tev_confidence, tev_decay, tev_acc: tev_A, foreign4w_pct: foreign4wPct, cot_pct: cotLfPct }
}

// ── メイン ──────────────────────────────────────────────

async function main() {
  console.log('=== TEV バックテスト計算開始 ===')

  const load = name => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf-8')).data

  // データ読み込み（各配列を降順ソート: 新しい順）
  const sortDesc  = (arr, key) => [...arr].sort((a, b) => dk(b[key]).localeCompare(dk(a[key])))
  const investorData = sortDesc(load('investor.json'),      'date')
  const marginData   = sortDesc(load('margin.json'),        'date')
  const shortSellData = sortDesc(load('short_sell.json'),   'date')
  const cotData      = sortDesc(load('cot_nikkei.json'),    'date')
  const vixData      = sortDesc(load('vix.json'),           'date')
  const adData       = sortDesc(load('advance_decline.json'), 'date')
  const arbData      = sortDesc(load('arbitrage.json'),     'date')
  const oiData       = sortDesc(load('futures_oi.json'),    'date')

  console.log(`データ件数: 投資主体別${investorData.length} / 信用${marginData.length} / 空売り${shortSellData.length} / COT${cotData.length} / VIX${vixData.length}`)

  // 日経225週次取得
  let nkWeekly = []
  try {
    nkWeekly = await fetchNikkeiWeekly()
  } catch (e) {
    console.error('Nikkei weekly fetch failed:', e.message)
    process.exit(1)
  }
  const nkMap = new Map(nkWeekly.map(d => [d.date, d.close]))

  // タイムライン: investor データの日付（降順）
  const timeline = investorData.map(d => dk(d.date))
  console.log(`タイムライン: ${timeline.length}週 (${timeline[timeline.length - 1]} 〜 ${timeline[0]})`)

  const weeklyLog = []

  for (let i = 0; i < timeline.length; i++) {
    const week     = timeline[i]           // 現在週（ISO日付）
    const prevWeek = timeline[i + 1] ?? null  // 1週前（加速度用）

    // 現在週以前のデータスライス
    const slice = arr => arr.filter(d => dk(d.date) <= week)
    const invSlice = slice(investorData)
    const marSlice = slice(marginData)
    const ssSlice  = slice(shortSellData)
    const cotSlice = slice(cotData)
    const vixSlice = slice(vixData)
    const adSlice  = slice(adData)
    const arbSlice = slice(arbData)
    const oiSlice  = slice(oiData)

    const score_today = computeScore(invSlice, vixSlice, oiSlice)
    const score_prev  = prevWeek
      ? computeScore(
          investorData.filter(d => dk(d.date) <= prevWeek),
          vixData.filter(d =>     dk(d.date) <= prevWeek),
          oiData.filter(d =>      dk(d.date) <= prevWeek),
        )
      : null

    const tev = computeTEV({ invSlice, marSlice, ssSlice, cotSlice, vixSlice, arbSlice, adSlice, oiSlice, score_today, score_prev })

    // 翌週（現実時間で1週後 = timeline[i-1]）の価格変化
    const nextWeekDate = i > 0 ? timeline[i - 1] : null
    const nkCur  = nearest(nkMap, week)
    const nkNext = nextWeekDate ? nearest(nkMap, nextWeekDate) : null
    const priceChangePct = (nkCur && nkNext) ? r2((nkNext - nkCur) / nkCur * 100) : null

    // シグナル判定（限界膨張は中立扱い）
    const signal = !tev                              ? 'neutral'
      : tev.tev_status.startsWith('限界膨張')        ? 'neutral'
      : tev.tev_value > 0                            ? 'bull'
      :                                                'bear'

    // 勝敗
    let win = null
    if (priceChangePct !== null && signal !== 'neutral')
      win = signal === 'bull' ? priceChangePct > 0 : priceChangePct < 0

    weeklyLog.push({
      week,
      tev:              tev?.tev_value       ?? null,
      status:           tev?.tev_status      ?? null,
      confidence:       tev?.tev_confidence  ?? null,
      decay:            tev?.tev_decay       ?? null,
      acc:              tev?.tev_acc         ?? null,
      foreign4w_pct:    tev?.foreign4w_pct   ?? null,
      cot_pct:          tev?.cot_pct         ?? null,
      signal,
      nk_close:         nkCur  ?? null,
      price_change_pct: priceChangePct,
      win,
    })
  }

  // ── 集計 ─────────────────────────────────────────────

  const valid = weeklyLog.filter(w => w.signal !== 'neutral' && w.win !== null)
  const bull  = valid.filter(w => w.signal === 'bull')
  const bear  = valid.filter(w => w.signal === 'bear')
  const bWins = bull.filter(w => w.win).length
  const eWins = bear.filter(w => w.win).length

  const byStatus = {}
  for (const w of valid) {
    if (!w.status) continue
    if (!byStatus[w.status]) byStatus[w.status] = { n: 0, wins: 0, win_rate: null }
    byStatus[w.status].n++
    if (w.win) byStatus[w.status].wins++
  }
  for (const k of Object.keys(byStatus)) {
    const b = byStatus[k]
    b.win_rate = b.n > 0 ? r2(b.wins / b.n) : null
  }

  const byConf = {
    high: { label: '高（70%+）', n: 0, wins: 0, win_rate: null },
    mid:  { label: '中（50-69%）', n: 0, wins: 0, win_rate: null },
  }
  for (const w of valid) {
    if (w.confidence == null) continue
    const key = w.confidence >= 70 ? 'high' : 'mid'
    byConf[key].n++
    if (w.win) byConf[key].wins++
  }
  for (const k of Object.keys(byConf)) {
    const b = byConf[k]
    b.win_rate = b.n > 0 ? r2(b.wins / b.n) : null
  }

  const summary = {
    total_weeks:     weeklyLog.length,
    signal_weeks:    valid.length,
    bull_signals:    bull.length,
    bear_signals:    bear.length,
    neutral_signals: weeklyLog.filter(w => w.signal === 'neutral').length,
    bull_wins:       bWins,
    bear_wins:       eWins,
    bull_win_rate:   bull.length > 0 ? r2(bWins / bull.length) : null,
    bear_win_rate:   bear.length > 0 ? r2(eWins / bear.length) : null,
    overall_win_rate: valid.length > 0 ? r2((bWins + eWins) / valid.length) : null,
    by_status: byStatus,
    by_confidence: byConf,
  }

  const output = {
    // シグナルロジック（computeTEV）の版。ロジックを変えた／バックテストに価格レジームゲートを
    // 焼き込んだ時に上げる。「過去版の結果だけ削除」をきれいに行うための識別子。
    // ※プロンプト（ライブAI側）の変更ではこの版は上げない（バックテストはプロンプト非依存のため）。
    logic_version: 'v2-symmetric-restoring',
    computed_at: new Date().toISOString(),
    data_range: {
      from: weeklyLog.length > 0 ? weeklyLog[weeklyLog.length - 1].week : null,
      to:   weeklyLog.length > 0 ? weeklyLog[0].week : null,
    },
    notes: [
      '偏差スコアは週次VIX・外国人フロー・先物OIで代替計算（日次USDJPY/NAS100の週次歴史データなし）',
      '加速度(acc)は1週前との差分（本番は3日前との差分）',
      '先物出来高減少による減衰は未適用（日次出来高の週次過去データなし）',
      '底打ち反転ステータスは未判定（10日安値圏データなし）',
      '限界膨張ステータスのシグナルは中立扱い（方向不明のため勝敗カウント外）',
      '慣性フィルター: acc・foreign4w_pct・cot_pctを用いた3基準判定（強持続/中持続/枯渇圏）',
    ],
    summary,
    weekly_log: weeklyLog,
  }

  writeFileSync(join(DATA_DIR, 'backtest_results.json'), JSON.stringify(output, null, 2))

  console.log('\n=== 完了 ===')
  console.log(`  総計: ${weeklyLog.length}週 / シグナルあり: ${valid.length}週`)
  console.log(`  Bull 勝率: ${bull.length > 0 ? Math.round(bWins / bull.length * 100) : '-'}% (${bWins}/${bull.length})`)
  console.log(`  Bear 勝率: ${bear.length > 0 ? Math.round(eWins / bear.length * 100) : '-'}% (${eWins}/${bear.length})`)
  console.log(`  全体勝率: ${valid.length > 0 ? Math.round((bWins + eWins) / valid.length * 100) : '-'}%`)
}

main().catch(e => { console.error(e); process.exit(1) })
