// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード（ロボ口座）: 決定論ロジックの単一情報源
//
// 🔴 このファイルは `tevCore.mjs` と同格の「式の単一情報源」として扱う。
//    ここでしか定義しない:
//      ① 対照群（ベースライン）のシグナル  … LLM 判断の良し悪しを測る物差し
//      ② 損切り値                          … LLM には決めさせない（設計原則3）
//    バックテスト（scripts/backtest-robo.mjs）と本番（scripts/robo-trade.mjs）は
//    必ずここを呼ぶ。式を二重定義しない。
//
// 由来（勝手に変えないこと）:
//   ブル側 = 20年R&Dの本線 v5a（scripts/backtest-system-v4.mjs の v5a）
//            ＝ ドンチャン50/25ロング ‖ −極限の押し目 ‖ 季節性
//              押し目と季節性は「確定下落トレンドでない」ゲートを通す（落ちるナイフを撃たない）
//   ベア側 = 短期戦術ベア（scripts/analyze-bear-tactical.mjs）
//            ＝ 25日MA乖離が +9% 以上の過熱から3日
//
// 🔴 レバレッジETFは日次リバランスで横ばい相場では減価する。日経指数×倍率での
//    近似は成績が良く出るので、バックテストは指数近似とETF実データの両方で測ること。
// ──────────────────────────────────────────────────────────────────────────

/** 対象ユニバース（設計書 §0.1）。同時に保有できるのは1銘柄だけ。 */
export const UNIVERSE = {
  bull1: { code: '1321', name: '日経225連動型',        side: 'bull', leverage: 1 },
  bull2: { code: '1570', name: '日経レバレッジ',        side: 'bull', leverage: 2 },
  bear1: { code: '1571', name: '日経インバース',        side: 'bear', leverage: 1 },
  bear2: { code: '1357', name: '日経ダブルインバース',  side: 'bear', leverage: 2 },
}

/** code → ユニバースの要素を引く */
export function bySymbol(code) {
  return Object.values(UNIVERSE).find(u => u.code === String(code)) ?? null
}

// ── 指標の計算 ────────────────────────────────────────────────────────────

/**
 * 日次 OHLC 配列に指標を書き込んで返す（非破壊）。
 * rows: [{ date, open, high, low, close }, ...] 古い順。
 */
export function computeIndicators(rows) {
  const out = rows.map(r => ({ ...r }))
  const n = out.length
  const sma = (i, w) => {
    if (i < w - 1) return null
    let s = 0
    for (let k = 0; k < w; k++) s += out[i - k].close
    return s / w
  }

  for (let i = 0; i < n; i++) {
    const m25 = sma(i, 25)
    out[i].sma25 = m25
    out[i].dev25 = m25 == null ? null : ((out[i].close - m25) / m25) * 100
    out[i].sma75 = sma(i, 75)
    out[i].sma200 = sma(i, 200)
  }
  // 200日MAの傾き（20営業日前との差）
  for (let i = 0; i < n; i++) {
    out[i].sma200slope =
      out[i].sma200 != null && i >= 20 && out[i - 20].sma200 != null
        ? out[i].sma200 - out[i - 20].sma200
        : null
  }
  // ATR20（True Range の20日単純平均）。損切り幅の基準。
  for (let i = 0; i < n; i++) {
    if (i === 0 || out[i].high == null || out[i].low == null) { out[i].tr = null; continue }
    const prevClose = out[i - 1].close
    out[i].tr = Math.max(
      out[i].high - out[i].low,
      Math.abs(out[i].high - prevClose),
      Math.abs(out[i].low - prevClose),
    )
  }
  for (let i = 0; i < n; i++) {
    if (i < 20) { out[i].atr20 = null; continue }
    let s = 0, ok = true
    for (let k = 0; k < 20; k++) {
      const tr = out[i - k].tr
      if (tr == null) { ok = false; break }
      s += tr
    }
    out[i].atr20 = ok ? s / 20 : null
  }
  return out
}

/**
 * ドンチャンのトレンド状態を求める。
 * long: 50日高値超えで入り、25日安値割れで抜ける
 * bear: 50日安値割れで入り、25日高値超えで抜ける（＝「確定下落」の機械的定義）
 * 返り値: { long: boolean[], bear: boolean[] }
 */
export function donchianStates(rows, entryWindow = 50, exitWindow = 25) {
  const n = rows.length
  const long = new Array(n).fill(false)
  const bear = new Array(n).fill(false)

  let sL = 0, sB = 0
  for (let i = entryWindow; i < n; i++) {
    let hi = -Infinity, lo = Infinity, exLo = Infinity, exHi = -Infinity
    for (let k = 1; k <= entryWindow; k++) {
      hi = Math.max(hi, rows[i - k].close)
      lo = Math.min(lo, rows[i - k].close)
    }
    for (let k = 1; k <= exitWindow; k++) {
      exLo = Math.min(exLo, rows[i - k].close)
      exHi = Math.max(exHi, rows[i - k].close)
    }
    const c = rows[i].close
    if (sL === 0 && c > hi) sL = 1
    else if (sL === 1 && c < exLo) sL = 0
    if (sB === 0 && c < lo) sB = 1
    else if (sB === 1 && c > exHi) sB = 0
    long[i] = sL === 1
    bear[i] = sB === 1
  }
  return { long, bear }
}

/** 季節性の窓（3月下旬・12月下旬）。v4/v5 と同じ定義。 */
export function inSeason(dateStr) {
  const mmdd = String(dateStr).slice(5)
  return (mmdd >= '03-15' && mmdd <= '03-27') || (mmdd >= '12-15' && mmdd <= '12-30')
}

// ── 対照群（ベースライン）のシグナル ──────────────────────────────────────

/** 押し目の閾値・保有日数・過熱の閾値。ここを動かすと別のロジックになる。 */
export const BASELINE_PARAMS = Object.freeze({
  dipDev: -10,      // −極限買いのトリガー（25日MA乖離%）
  dipHold: 5,       // 押し目の保有営業日数
  heatDev: 9,       // ベアのトリガー（25日MA乖離%）
  bearHold: 3,      // ベアの保有営業日数
})

/**
 * 決定論ベースラインの建玉フラグを日次で組み立てる。
 * 返り値: [{ date, side: 'bull'|'bear'|null, reason }, ...]（rows と同じ長さ）
 *
 * 🔴 ベアが立つ日はベアを優先する。過熱（+9%）はブルの利確地点でもあり、
 *    ブルとベアを同時に持てない以上どちらかに寄せる必要があるため。
 */
export function baselineTimeline(rowsWithIndicators) {
  const rows = rowsWithIndicators
  const n = rows.length
  const { long, bear } = donchianStates(rows)
  const P = BASELINE_PARAMS

  // 押し目（確定下落中は撃たない）
  const dip = new Array(n).fill(false)
  {
    let until = -1
    for (let i = 25; i < n; i++) {
      if (rows[i].dev25 != null && rows[i].dev25 <= P.dipDev && !bear[i]) {
        until = Math.max(until, i + P.dipHold)
      }
      if (i <= until) dip[i] = true
    }
  }
  // 季節性（同じゲート）
  const season = new Array(n).fill(false)
  for (let i = 0; i < n; i++) season[i] = inSeason(rows[i].date) && !bear[i]

  // ベア（過熱から3日）
  const bearPos = new Array(n).fill(false)
  {
    let until = -1
    for (let i = 25; i < n; i++) {
      if (rows[i].dev25 != null && rows[i].dev25 >= P.heatDev) {
        until = Math.max(until, i + P.bearHold)
      }
      if (i <= until) bearPos[i] = true
    }
  }

  return rows.map((r, i) => {
    if (bearPos[i]) return { date: r.date, side: 'bear', reason: `25日MA乖離 +${P.heatDev}%以上の過熱` }
    if (long[i]) return { date: r.date, side: 'bull', reason: 'ドンチャン50/25 上昇トレンド' }
    if (dip[i]) return { date: r.date, side: 'bull', reason: `25日MA乖離 ${P.dipDev}%以下の押し目（確定下落でない）` }
    if (season[i]) return { date: r.date, side: 'bull', reason: '季節性の窓（確定下落でない）' }
    return { date: r.date, side: null, reason: '条件を満たさない' }
  })
}

// ── 損切り（🔴 LLM には決めさせない部分・設計原則3）────────────────────────

/** VIX 水準に応じた ATR 倍率。ボラの外側に置いて「損切り貧乏」を避ける。 */
export function stopMultiplier(vix) {
  if (vix == null || Number.isNaN(vix)) return 2.5   // 不明なら中間を採る（狭くしない）
  if (vix < 20) return 2.0
  if (vix < 30) return 2.5
  return 3.0
}

/**
 * 損切り価格を決める。建てた瞬間に確定させ、あとから動かさない。
 * 🔴 side は「建玉の銘柄がブル系かベア系か」。ベアETFも現物を買うので、
 *    価格が下がったら損切り＝どちらも entry より下に置く。
 *    （ベアETFは日経が上がると下がる。つまり読みが外れると価格が下がる）
 */
export function stopPrice({ entry, atr20, vix }) {
  if (entry == null || atr20 == null) return null
  const k = stopMultiplier(vix)
  const stop = entry - k * atr20
  return {
    price: Math.max(0, Math.round(stop * 10) / 10),
    rule: `atr20x${k.toFixed(1)}`,
    multiplier: k,
  }
}

/**
 * 損切りを**引き上げる**（トレーリングストップ・2026-08-11 追加）。
 *
 * 🔴 なぜ入れるか＝この戦略は**勝率34〜40%が正常**なトレンドフォロー型で、
 *    期待値は「たまに来る大きな勝ちを取り切れるか」だけで決まる。
 *    それまでの作りは「建てた瞬間の損切りを動かさない」＋「手仕舞いはAIが毎日判断」で、
 *    **AIが早めに利確してしまう余地が構造的に残っていた**（プロンプトで戒めてはいたが、
 *    文章でお願いしていただけで仕組みで止めていなかった）。
 *
 * 🔴 **上げるだけ。下げない。** ボラが膨らんだ日に損切りを下へずらすと、
 *    「負けを小さく」が崩れて期待値が壊れる。max() で必ず片方向にする。
 * 🔴 **利確はしない。** ここでやるのは「利が乗ったぶんだけ損切りを持ち上げる」ことだけ。
 *    上限を決めて降りると、いちばん大きな勝ちを取り逃す。
 * 🔵 幅は建てたときと同じ考え方（VIXに応じた ATR 倍率）。基準を現値に移すだけ。
 *
 * @param {{current:number|null, atr20:number|null, vix:number|null, prevStop:number|null}} p
 * @returns {{price:number, rule:string, raised:boolean}|null} 動かす必要が無ければ prevStop のまま返す
 */
export function trailStop({ current, atr20, vix, prevStop }) {
  if (current == null || atr20 == null) return prevStop == null ? null : { price: prevStop, rule: null, raised: false }
  const k = stopMultiplier(vix)
  const candidate = Math.max(0, Math.round((current - k * atr20) * 10) / 10)
  if (prevStop == null) return { price: candidate, rule: `atr20x${k.toFixed(1)} (trail)`, raised: true }
  if (candidate <= prevStop) return { price: prevStop, rule: null, raised: false }
  return { price: candidate, rule: `atr20x${k.toFixed(1)} (trail)`, raised: true }
}

/** 損切りに触れたか。終値ベースで判定する（v1 はザラ場を見ない）。 */
export function isStopHit({ close, stopPrice: stop }) {
  if (close == null || stop == null) return false
  return close <= stop
}

// ── 資金管理 ──────────────────────────────────────────────────────────────

/**
 * 発注可能な口数の上限。LLM が出した qty はこれでクリップする。
 * 🔴 LLM に上限を破らせないための機械的なガード。
 */
export function maxQty({ cash, price, maxRatio = 1.0 }) {
  if (!price || price <= 0 || !cash || cash <= 0) return 0
  return Math.floor((cash * maxRatio) / price)
}

/** LLM の qty をユニバースと資金でクリップする。 */
export function clampQty({ qty, cash, price, maxRatio = 1.0 }) {
  const cap = maxQty({ cash, price, maxRatio })
  const q = Math.max(0, Math.floor(Number(qty) || 0))
  return Math.min(q, cap)
}
