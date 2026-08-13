// 波動の書「巻一・灯」の型を、機械が判定できる条件に落としたもの（2026-08-13）
//
// 🔴 図鑑の「見つけ方」は日本語の散文なので、そのままでは機械が使えない。
//    ここを**唯一の定義**にして、検出器も、将来のAI読み取りの答え合わせも、同じ条件を使う。
//    画面（ChartPatternPanel）の文章を書き換えたら、ここも合わせること。
//
// 🔵 しきい値は「直近20本の中央値」との比で決める。日経の値幅は年代で桁が違うので、
//    絶対値（何円動いたか）で書くと2000年と2026年で別物になる。
//
// 🔴 ここに書いた数字は**先に決めたもの**。当たるように後から動かさないこと。
//    条件をいじって当たりを作れてしまうのが、この手の検証でいちばん危ない
//    （巻二の実測でも、9通り振って1つだけ当たったものは不採用にしている）。

/** 中央値 */
const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const h = s.length >> 1
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
}

/** 1本の足の各部。すべて価格の差（円）で返す。 */
export function anatomy(b) {
  const body = Math.abs(b.close - b.open)
  const range = b.high - b.low
  const upper = b.high - Math.max(b.open, b.close)
  const lower = Math.min(b.open, b.close) - b.low
  return { body, range, upper, lower, up: b.close > b.open }
}

/** 直近 n 本（当日を含まない）の物差し。🔴 当日を混ぜると自分自身で基準が動く。 */
export function scale(rows, i, n = 20) {
  if (i < n) return null
  const past = rows.slice(i - n, i)
  return {
    medBody: median(past.map(r => Math.abs(r.close - r.open))),
    medRange: median(past.map(r => r.high - r.low)),
    hh: Math.max(...past.map(r => r.high)),
    ll: Math.min(...past.map(r => r.low)),
    sma: past.reduce((s, r) => s + r.close, 0) / n,
  }
}

/** しきい値。🔵 1か所にまとめて、散らばらないようにする。 */
export const TH = {
  longBodyRatio: 0.7,   // 実体が値幅に占める割合（大陽線・大陰線）
  longBodyVsMed: 1.5,   // 実体が直近20本の中央値の何倍か
  dojiBodyRatio: 0.1,   // 実体がこれ以下なら十字線
  wickRatio: 2.0,       // ヒゲが実体の何倍でカラカサ／トンカチか
  smallWick: 0.15,      // 反対側のヒゲは値幅のこれ以下
  spinBodyRatio: 0.3,   // コマの実体
  spinRangeVsMed: 0.8,  // コマは値幅も小さい
  gapMin: 0.001,        // 窓とみなす最小の空き（前日終値比 0.1%）
  gapCommonMax: 0.005,  // 普通の窓の上限（0.5%）
  trendRun: 0.08,       // 「走ったあと」＝20本で8%以上動いた
  fillBars: 5,          // 尽きの窓は5本以内に埋め戻す
}

/** 1本で読む型。当てはまった型の名前を配列で返す（複数当てはまることもある）。 */
export function detectSingle(rows, i) {
  const s = scale(rows, i)
  if (!s) return []
  const b = rows[i]
  const a = anatomy(b)
  if (!(a.range > 0)) return []
  const hit = []

  if (a.up && a.body >= TH.longBodyRatio * a.range && a.body >= TH.longBodyVsMed * s.medBody) hit.push('大陽線')
  if (!a.up && a.body >= TH.longBodyRatio * a.range && a.body >= TH.longBodyVsMed * s.medBody) hit.push('大陰線')
  if (a.body <= TH.dojiBodyRatio * a.range && a.range >= 0.5 * s.medRange) hit.push('十字線（同時線）')
  if (a.body > 0 && a.lower >= TH.wickRatio * a.body && a.upper <= TH.smallWick * a.range) hit.push('カラカサ（ハンマー）')
  if (a.body > 0 && a.upper >= TH.wickRatio * a.body && a.lower <= TH.smallWick * a.range) hit.push('トンカチ（流れ星）')
  if (a.body <= TH.spinBodyRatio * a.range && a.range <= TH.spinRangeVsMed * s.medRange
    && a.upper >= 0.2 * a.range && a.lower >= 0.2 * a.range) hit.push('コマ')

  return hit
}

/** 窓。開いた場所で名前が変わるので、文脈（直近20本）も見る。 */
export function detectGap(rows, i) {
  const s = scale(rows, i)
  if (!s || i < 1) return null
  const prev = rows[i - 1], cur = rows[i]

  const up = cur.low > prev.high
  const down = cur.high < prev.low
  if (!up && !down) return null

  const size = (up ? cur.low - prev.high : prev.low - cur.high) / prev.close
  if (size < TH.gapMin) return null

  // 直近20本でどれだけ走ったか（走った先の窓か、動いていない中の窓か）
  const run = (rows[i - 1].close - rows[i - 20].close) / rows[i - 20].close
  const breakout = up ? cur.close > s.hh : cur.close < s.ll

  // 🔴 どれにも当てはまらないものを既存の型に押し込めない。
  //    「その他」を作らないと、放れの窓の数が実際より多く見える（最初そうなっていた）。
  let name
  if (size <= TH.gapCommonMax && Math.abs(run) < 0.02) name = '普通の窓（コモン）'
  else if (breakout && Math.abs(run) < TH.trendRun) name = '放れの窓（ブレイクアウェイ）'
  else if (Math.abs(run) >= TH.trendRun && Math.sign(run) === (up ? 1 : -1)) name = '中間の窓（ランナウェイ）'
  else name = 'その他の窓'

  // 🔵 尽きの窓は「走ったあとに開けて、すぐ埋め戻される」もの。
  //    埋まったかどうかは先を見ないと分からないので、判定は呼ぶ側（barsToFill のあと）で行う。
  return { name, up, size, level: up ? prev.high : prev.low, run }
}

/** 窓が埋まるまでの本数。埋まらなければ null。 */
export function barsToFill(rows, i, gap, limit = 120) {
  for (let j = i + 1; j < Math.min(rows.length, i + 1 + limit); j++) {
    if (gap.up ? rows[j].low <= gap.level : rows[j].high >= gap.level) return j - i
  }
  return null
}
