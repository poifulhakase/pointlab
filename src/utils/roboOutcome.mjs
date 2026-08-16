// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: 判断の「その後」を測る（⑤b-A / ⑤b-B）
//
// 🔴 **判断のしかたには一切触らない**。出た判断を後から採点するだけの後付け処理。
//    いま30トレードで「AIは決定論より上手いか」を測っている最中なので、
//    判断器を変えると分母が壊れる（2026-08-11 ユーザー合意）。
//
// 測り方の前提:
//   ・起点＝**判断した日の終値**。執行は引成（MOC）なので、実際に約定する値段と同じ。
//     🔵 引継ぎの当初案は「翌営業日の寄付き」だったが、2026-08-12 に執行が
//        「翌朝の寄り」→「当日の引成」に変わったため、実際の約定基準に合わせた。
//        寄り基準で見直したくなったときのために `next_open` も一緒に残す。
//   ・測る対象＝**日経225の終値**。1321/1570/1571/1357 はどれも日経225に連動し、
//     倍率が違うだけで**方向は変わらない**ので、方向の当否は指数で測れば足りる。
//   ・horizon＝1営業日後・5営業日後（引継ぎ⑤b-A の定義）。
//     🔴 これは「その日の判断が短期で当たったか」であって、**建玉の損益ではない**
//        （実際は損切り・トレーリングで手仕舞うまで持つ）。混同しないこと。
// ──────────────────────────────────────────────────────────────────────────

import { bySymbol } from './robotStrategy.mjs'

/** 測る先の営業日数。増やすときはここだけ足す（集計・保存は自動で追従する） */
export const HORIZONS = [1, 5]

const r2 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 100) / 100)

/**
 * 判断の向き。'bull' / 'bear' / null（null＝方向を持たない＝採点しない）。
 * 🔴 hold と close は方向を持たない。「当たった/外れた」を付けると
 *    何もしなかった日が勝ち負けに混ざり、勝率が意味を失う。
 */
export function sideOfDecision(decision) {
  if (!decision || decision.action !== 'open') return null
  if (!decision.symbol || decision.symbol === 'none') return null
  return bySymbol(decision.symbol)?.side ?? null
}

/** 日付→位置。同じ日付が複数あっても最初の1本を正とする */
function indexByDate(bars) {
  const m = new Map()
  for (let i = 0; i < bars.length; i++) if (!m.has(bars[i].date)) m.set(bars[i].date, i)
  return m
}

/**
 * 1件ぶんの採点。
 *
 * @param decision 判断（`output` または `shadows.*`）
 * @param date     判断した日（ログのファイル名と同じ）
 * @param bars     日経225の日足 [{date, open, close, ...}]（古い順）
 * @returns 採点結果。起点の足が無ければ null（＝まだ測れない）
 *
 * 🔵 先の足がまだ無いぶんは `null` のまま `complete:false` で返す。
 *    次に走らせたときに埋まる＝毎日実行すれば勝手に完成する。
 */
export function computeOutcome({ decision, date, bars }) {
  if (!date || !Array.isArray(bars) || !bars.length) return null
  const rows = [...bars].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const i = indexByDate(rows).get(date)
  if (i == null) return null

  const entry = rows[i].close
  if (!Number.isFinite(entry) || entry === 0) return null

  const side = sideOfDecision(decision)
  const horizons = {}
  let complete = true
  for (const h of HORIZONS) {
    const bar = rows[i + h]
    if (!bar || !Number.isFinite(bar.close)) {
      horizons[`${h}d`] = { date: null, close: null, ret_pct: null, edge_pct: null, hit: null }
      complete = false
      continue
    }
    const ret = ((bar.close - entry) / entry) * 100
    // 🔵 edge＝判断の向きから見た損益率。ベアは下げが利益なので符号を反転する。
    const edge = side === 'bear' ? -ret : side === 'bull' ? ret : null
    horizons[`${h}d`] = {
      date: bar.date,
      close: bar.close,
      ret_pct: r2(ret),
      edge_pct: r2(edge),
      // 🔴 引き分け（変化なし）は勝ちにしない
      hit: side == null ? null : edge > 0,
    }
  }

  return {
    side,
    action: decision?.action ?? null,
    symbol: decision?.symbol ?? null,
    confidence_pct: decision?.confidence_pct ?? null,
    entry_date: date,
    entry_close: entry,
    // 🔵 「寄り基準で測り直したい」と言われたとき用に、翌営業日の寄値だけ残しておく
    next_open: rows[i + 1]?.open ?? null,
    horizons,
    complete,
  }
}

/**
 * 確信度の答え合わせ（⑤b-B）。
 * 🔵 帯の切り方と項目名は `scripts/backtest-tev.mjs` の calibration と同じにしてある
 *    ＝ぽいロボ本体の検算と並べて読める。
 */
export function calibrationBins(outcomes, { horizon = 5 } = {}) {
  const defs = [
    { range: '<50%', lo: 0, hi: 50 },
    { range: '50-59%', lo: 50, hi: 60 },
    { range: '60-69%', lo: 60, hi: 70 },
    { range: '70-79%', lo: 70, hi: 80 },
    { range: '80-89%', lo: 80, hi: 90 },
    { range: '90%+', lo: 90, hi: 101 },
  ].map(b => ({ ...b, n: 0, wins: 0, confSum: 0 }))

  for (const o of scorable(outcomes, horizon)) {
    const c = o.confidence_pct
    if (c == null) continue
    const b = defs.find(d => c >= d.lo && c < d.hi)
    if (!b) continue
    b.n++
    b.confSum += c
    if (o.horizons[`${horizon}d`].hit) b.wins++
  }

  return defs.filter(b => b.n > 0).map(b => ({
    range: b.range,
    n: b.n,
    wins: b.wins,
    avg_confidence: r2(b.confSum / b.n),          // 言った確率（平均確信度）%
    win_rate_pct: r2((b.wins / b.n) * 100),        // 実勝率 %
    gap: r2((b.wins / b.n) * 100 - b.confSum / b.n), // 実勝率 − 確信度（負＝自信過剰）
  }))
}

/** 採点できる（方向がある・その horizon が埋まっている）ぶんだけ取り出す */
function scorable(outcomes, horizon) {
  return (outcomes ?? []).filter(o => o && o.side && o.horizons?.[`${horizon}d`]?.hit != null)
}

/** 全体の成績（horizon ごと） */
export function summarize(outcomes) {
  const all = (outcomes ?? []).filter(Boolean)
  const out = {
    logs: all.length,
    directional: all.filter(o => o.side).length,   // 方向を持った日（＝採点対象）
    hold: all.filter(o => !o.side).length,
    by_horizon: {},
  }
  for (const h of HORIZONS) {
    const rows = scorable(all, h)
    const wins = rows.filter(o => o.horizons[`${h}d`].hit).length
    const edges = rows.map(o => o.horizons[`${h}d`].edge_pct).filter(v => v != null)
    const confs = rows.map(o => o.confidence_pct).filter(v => v != null)
    const bull = rows.filter(o => o.side === 'bull')
    const bear = rows.filter(o => o.side === 'bear')
    const rate = (list) => (list.length ? r2((list.filter(o => o.horizons[`${h}d`].hit).length / list.length) * 100) : null)
    out.by_horizon[`${h}d`] = {
      n: rows.length,
      wins,
      win_rate_pct: rows.length ? r2((wins / rows.length) * 100) : null,
      avg_confidence: confs.length ? r2(confs.reduce((a, b) => a + b, 0) / confs.length) : null,
      // 🔵 平均 edge＝方向から見た損益率の平均。勝率が5割でも、勝ちが大きければ正になる
      avg_edge_pct: edges.length ? r2(edges.reduce((a, b) => a + b, 0) / edges.length) : null,
      bull: { n: bull.length, win_rate_pct: rate(bull) },
      bear: { n: bear.length, win_rate_pct: rate(bear) },
    }
  }
  return out
}
