// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ銘柄（6954 ファナック / 6506 安川電機）の見どころを日足から出す。
//
// 🔴 **ここは観測だけ**。ロボ口座の判断には一切入れない（2026-08-16 ユーザー合意）。
//    いま30トレードで「AIは決定論ルールより上手いか」を測っている最中なので、
//    銘柄を足すのは分母が埋まってから決める。
// 🔵 主軸は日経平均のまま。この2銘柄は「日経の増幅器なのか、別の生き物なのか」を
//    毎日見るための窓＝だから**日経との連動（β・相関）を必ず並べて出す**。
// ──────────────────────────────────────────────────────────────────────────

const r2 = (v, d = 2) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d)

/** 直近 n 本の中央値（出来高の「平常」を見る。平均だと1日の急増に引きずられる） */
export function median(values) {
  const a = values.filter(v => Number.isFinite(v)).slice().sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/** 日次リターン（%）の配列。rows は古い順 */
export function dailyReturns(rows, lookback) {
  const out = []
  const from = Math.max(1, rows.length - lookback)
  for (let i = from; i < rows.length; i++) {
    const prev = rows[i - 1]?.close
    const cur = rows[i]?.close
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) continue
    out.push({ date: rows[i].date, ret: ((cur - prev) / prev) * 100 })
  }
  return out
}

/**
 * 日経との連動。
 * @returns {{n:number, beta:number|null, corr:number|null}}
 *   beta＝日経が1%動いたとき、この銘柄は何%動いたか（1.0で同じ・1.5なら1.5倍動く）
 *   corr＝方向がどれだけ揃っているか（1に近いほど同じ動き）
 * 🔴 **日付で突き合わせる**（片方が休みの日を無視して並べると全部ズレる）。
 */
export function linkToIndex(stockRows, indexRows, lookback = 60) {
  const idx = new Map(dailyReturns(indexRows, lookback * 3).map(r => [r.date, r.ret]))
  const pairs = []
  for (const s of dailyReturns(stockRows, lookback * 3)) {
    const i = idx.get(s.date)
    if (i != null) pairs.push([i, s.ret])
  }
  const use = pairs.slice(-lookback)
  const n = use.length
  if (n < 10) return { n, beta: null, corr: null }

  const mx = use.reduce((a, p) => a + p[0], 0) / n
  const my = use.reduce((a, p) => a + p[1], 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (const [x, y] of use) {
    sxy += (x - mx) * (y - my)
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
  }
  return {
    n,
    beta: sxx === 0 ? null : r2(sxy / sxx),
    corr: sxx === 0 || syy === 0 ? null : r2(sxy / Math.sqrt(sxx * syy)),
  }
}

/** n 営業日前からの騰落率（%）。足りなければ null */
export function retOver(rows, n) {
  if (!Array.isArray(rows) || rows.length <= n) return null
  const from = rows[rows.length - 1 - n]?.close
  const to = rows[rows.length - 1]?.close
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null
  return r2(((to - from) / from) * 100)
}

/**
 * モメンタムの物差し（中長期で持つ前提の見方）。
 *
 * 🔵 使うのは**教科書どおりの3点**＝①長い足でのトレンド（200日線とその向き）
 *    ②相対力（日経に対する超過リターン）③52週高値からの距離（新高値に近いほど強い）。
 * 🔴 「12-1モメンタム」（直近1ヶ月を除く12ヶ月）も出す＝**直近1ヶ月は反転しやすい**ことが
 *    知られているため、そこを除いた12ヶ月で強さを測る。判断には使わず、見るだけ。
 */
export function momentum(rows, index) {
  const W = { m1: 21, m3: 63, m6: 126, m12: 252 }
  const stock = { m1: retOver(rows, W.m1), m3: retOver(rows, W.m3), m6: retOver(rows, W.m6), m12: retOver(rows, W.m12) }
  const idx = { m1: retOver(index, W.m1), m3: retOver(index, W.m3), m6: retOver(index, W.m6), m12: retOver(index, W.m12) }
  const rel = {}
  for (const k of Object.keys(stock)) {
    rel[k] = stock[k] == null || idx[k] == null ? null : r2(stock[k] - idx[k])
  }

  // 12-1（直近1ヶ月を除いた12ヶ月）
  let m12_1 = null
  if (rows.length > W.m12) {
    const from = rows[rows.length - 1 - W.m12]?.close
    const to = rows[rows.length - 1 - W.m1]?.close
    if (Number.isFinite(from) && Number.isFinite(to) && from !== 0) m12_1 = r2(((to - from) / from) * 100)
  }

  const last = rows[rows.length - 1]
  const y52 = rows.slice(-250)
  const high52 = y52.length ? Math.max(...y52.map(r => r.high ?? r.close)) : null
  const fromHigh = high52 ? r2(((last.close - high52) / high52) * 100) : null

  return {
    ret: stock,
    ret_vs_index: rel,
    ret_12_1: m12_1,
    from_52w_high_pct: fromHigh,          // 0に近いほど新高値圏
    above_ma200: last.sma200 == null ? null : last.close > last.sma200,
    ma200_up: last.sma200slope == null ? null : last.sma200slope > 0,
  }
}

/**
 * 中長期の持ち方に対する「いまの姿勢」。🔴 売買の指示ではなく**状態の記述**。
 * （ぽいロボは投資助言を行わない方針なので、命令形にしない・2026-06-05 の方針）
 */
export function stance(m) {
  if (!m || m.above_ma200 == null) return { key: 'unknown', label: '判定できない' }
  const strong = m.above_ma200 && m.ma200_up
  const rel12 = m.ret_vs_index?.m12
  const near = m.from_52w_high_pct != null && m.from_52w_high_pct > -10
  if (strong && rel12 != null && rel12 > 0 && near) return { key: 'leading', label: '上昇トレンド・日経より強い・高値圏' }
  if (strong) return { key: 'trend', label: '上昇トレンド（200日線の上・向きも上）' }
  if (m.above_ma200) return { key: 'flat', label: '200日線の上だが、線の向きは上ではない' }
  return { key: 'below', label: '200日線の下（中長期のトレンドは出ていない）' }
}

/**
 * 1銘柄ぶんの要約。
 * @param rows  computeIndicators を通した日足（古い順・volume 付き）
 * @param index 日経225の日足（連動の計算用）
 */
export function summarizeStock(rows, index) {
  if (!Array.isArray(rows) || rows.length < 2) return null
  const last = rows[rows.length - 1]
  const prev = rows[rows.length - 2]
  const closes = rows.map(r => r.close)

  const win = (n) => rows.slice(-n)
  const hi = (list) => Math.max(...list.map(r => r.high ?? r.close))
  const lo = (list) => Math.min(...list.map(r => r.low ?? r.close))

  const d20 = win(20)
  const range20 = { high: hi(d20), low: lo(d20) }
  // レンジのどこにいるか（0=安値・100=高値）。「上限に近い＝上値の壁」を一目で見るため
  const posPct = range20.high === range20.low
    ? null
    : ((last.close - range20.low) / (range20.high - range20.low)) * 100

  const y52 = win(250)
  const volMedian20 = median(d20.slice(0, -1).map(r => r.volume))

  return {
    date: last.date,
    close: r2(last.close, 1),
    change_pct: prev?.close ? r2(((last.close - prev.close) / prev.close) * 100) : null,
    volume: last.volume ?? null,
    // 出来高が平常の何倍か（20日中央値との比）。材料が出た日を拾うため
    volume_x: volMedian20 ? r2(last.volume / volMedian20) : null,
    // 🆕 平常の出来高（20日中央値）。信用買残が「何日分の商いに相当するか」を出すのに使う。
    //    🔴 その日の出来高で割ると、材料が出た日だけ軽く見える（2026-08-17）。
    vol20: volMedian20 ? Math.round(volMedian20) : null,
    ma25: r2(last.sma25, 1),
    dev25_pct: r2(last.dev25),
    ma75: r2(last.sma75, 1),
    ma200: r2(last.sma200, 1),
    // 🔵 購入時に考えることの2つ目＝「200日線付近か」（2026-08-16 の相談で確定）
    dev200_pct: last.sma200 ? r2(((last.close - last.sma200) / last.sma200) * 100) : null,
    // 200日線が上向きか（20営業日前との差）
    trend_up: last.sma200slope == null ? null : last.sma200slope > 0,
    range20: { high: r2(range20.high, 1), low: r2(range20.low, 1), pos_pct: r2(posPct, 1) },
    range52w: { high: r2(hi(y52), 1), low: r2(lo(y52), 1) },
    link: linkToIndex(rows, index),
    momentum: momentum(rows, index),
    stance: stance(momentum(rows, index)),
    // 🔵 画面のチャート用（直近500本＝約2年）。終値・25日線・200日線を持たせて、
    //    UI 側で期間を切って描く（データを2種類持たない）。
    series: rows.slice(-500).map(r => ({
      d: r.date,
      c: r2(r.close, 1),
      m25: r2(r.sma25, 1),
      m200: r2(r.sma200, 1),
    })),
    // 直近60本の終値だけ欲しいとき用
    spark: closes.slice(-60).map(v => r2(v, 1)),
  }
}
