// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: ロボ口座の状態管理（純粋な計算だけ。IO はしない）
//
// 🔴 約定履歴（trades）は追記のみ。過去行を書き換える関数はここに置かない。
// 🔴 建玉があるのに逆方向を建てようとしたら「決済 → 新規」の2約定に分解する
//    （ドテン。LLM に2ステップ書かせず、コード側で保証する）。
// ──────────────────────────────────────────────────────────────────────────

import { bySymbol, stopPrice, trailStop, clampQty } from '../src/utils/robotStrategy.mjs'

export const INITIAL_CASH = 1000000

export function emptyAccount({ logicVersion = 'robo-v1-llm', decider = null } = {}) {
  return {
    generated_at: null,
    logic_version: logicVersion,
    decider,
    universe: ['1321.T', '1570.T', '1571.T', '1357.T'],
    initial_cash: INITIAL_CASH,
    cash: INITIAL_CASH,
    trades: [],
    position: null,
    equity_curve: [],
    stats: { closed_trades: 0, win_rate: null, expectancy: null, max_drawdown_pct: null, stop_then_reversed: 0 },
    baseline: null,
    // 🔴 **翌営業日の寄り付きで約定させる注文**（2026-08-11 追加）。
    //    08:30 の判断は前営業日の**終値**を見て下すが、実際に買えるのは 09:00 の**寄値**。
    //    実測で 1570 の窓（前日終値→寄値）は平均 2.08%・上位10%で 4.82% あり、
    //    終値で約定したことにすると口座の成績が実物と別のものになる。
    //    → 判断した日はここに積むだけにして、**次の実行で実際の寄値を見て約定させる**。
    pending: null,
    // 🔴 実保有に合わせた同期の記録。同期しても差分は消さずここに残す
    divergences: [],
    last_synced_file_id: null,
  }
}

/** その日の評価額（現金＋建玉の時価） */
export function equityOf(account, priceOf) {
  const p = account.position
  if (!p || !p.qty) return account.cash
  const px = priceOf(p.symbol)
  return account.cash + (px != null ? p.qty * px : 0)
}

/**
 * 決済する。返り値は新しい account（非破壊）。
 * @param {object} p { account, price, date, execDate, reason }
 */
export function closePosition({ account, price, date, execDate, reason, cost = 0.0004 }) {
  const pos = account.position
  if (!pos || !pos.qty || price == null) return account

  const proceeds = pos.qty * price * (1 - cost)
  const pnl = (price - pos.avg_price) * pos.qty
  const trade = {
    id: `${date}-close`,
    decided_on: date,
    executed_on: execDate,
    side: 'sell',
    symbol: pos.symbol,
    qty: pos.qty,
    price,
    entry_price: pos.avg_price,
    pnl: Math.round(pnl),
    exit_reason: reason,
    stop_price: pos.stop_price ?? null,
  }
  return {
    ...account,
    cash: account.cash + proceeds,
    position: null,
    trades: [...account.trades, trade],
  }
}

/**
 * 新規建てする。返り値は新しい account（非破壊）。
 * 🔴 qty は資金でクリップする（LLM に上限を破らせない）。
 */
export function openPosition({ account, symbol, qty, price, atr20, vix, rows = null, eventNear = false, date, execDate, decision, cost = 0.0004 }) {
  if (!symbol || symbol === 'none' || price == null || price <= 0) return account
  const capped = clampQty({ qty, cash: account.cash * (1 - cost), price })
  if (capped <= 0) return account

  const s = stopPrice({ entry: price, atr20, vix, rows, eventNear })
  const spend = capped * price * (1 + cost)
  const trade = {
    id: `${date}-open`,
    decided_on: date,
    executed_on: execDate,
    side: 'buy',
    symbol,
    qty: capped,
    price,
    confidence_pct: decision?.confidence_pct ?? null,
    reason: decision?.reason ?? null,
    counter: decision?.counter ?? null,
    stop_price: s?.price ?? null,
    stop_rule: s?.rule ?? null,
  }
  return {
    ...account,
    cash: account.cash - spend,
    position: { symbol, qty: capped, avg_price: price, stop_price: s?.price ?? null, stop_rule: s?.rule ?? null, opened_on: execDate },
    trades: [...account.trades, trade],
  }
}

/**
 * 判断を口座に適用する。
 * 🔴 ここがドテンの分解を担う。逆方向の open は「決済 → 新規」になる。
 *
 * @returns {{ account, actions: string[] }}
 */
export function applyDecision({ account, decision, priceOf, atrOf, rowsOf = () => null, vix, eventNear = false, date, execDate }) {
  const actions = []
  let acc = account
  const d = decision ?? {}

  // ① 手仕舞い
  if (d.action === 'close' && acc.position) {
    const px = priceOf(acc.position.symbol)
    acc = closePosition({ account: acc, price: px, date, execDate, reason: 'signal' })
    actions.push('close')
    return { account: acc, actions }
  }

  // ② 新規建て
  if (d.action === 'open' && d.symbol && d.symbol !== 'none') {
    const wantSide = bySymbol(d.symbol)?.side ?? null
    const heldSide = acc.position ? bySymbol(acc.position.symbol)?.side ?? null : null

    // 同じ銘柄を既に持っているなら何もしない（増し玉はしない）
    if (acc.position && acc.position.symbol === d.symbol) {
      actions.push('already-held')
      return { account: acc, actions }
    }
    // 🔴 別銘柄を持っているなら、先に決済（方向が同じでも倍率が違えば入れ替える）
    if (acc.position) {
      const px = priceOf(acc.position.symbol)
      acc = closePosition({ account: acc, price: px, date, execDate, reason: heldSide !== wantSide ? 'reverse' : 'switch' })
      actions.push(heldSide !== wantSide ? 'close(reverse)' : 'close(switch)')
    }
    acc = openPosition({
      account: acc, symbol: d.symbol, qty: d.qty,
      price: priceOf(d.symbol), atr20: atrOf(d.symbol), rows: rowsOf(d.symbol),
      vix, eventNear, date, execDate, decision: d,
    })
    if (acc.position) actions.push('open')
    return { account: acc, actions }
  }

  actions.push('hold')
  return { account: acc, actions }
}

/**
 * 損切りに触れたか**判定するだけ**。決済はしない。
 * 🔴 2026-08-11 に「判定して即決済」から変えた。終値で触れても、実際に降りられるのは
 *    翌営業日の寄り付き。窓で飛べばもっと悪い値段になる。決済は保留注文にして、
 *    次の実行で実際の寄値を見て約定させる（`applyPending`）。
 */
export function detectStopHit({ account, priceOf }) {
  const pos = account.position
  if (!pos || !pos.stop_price) return false
  const close = priceOf(pos.symbol)
  return close != null && close <= pos.stop_price
}

/**
 * 判断を**保留注文**として積む。約定はしない。
 * @param {object} p
 * @param {object} p.decision   LLM の判断
 * @param {boolean} p.stopExit  損切りに触れているか（触れていれば寄りでまず手仕舞う）
 * @param {number|null} p.plannedStop 判断した時点の終値から引いた損切り値。窓ガードの基準に使う
 */
export function queueOrder({ account, decision, stopExit = false, plannedStop = null, decidedOn }) {
  return {
    ...account,
    pending: { decision: decision ?? null, stop_exit: !!stopExit, planned_stop: plannedStop, decided_on: decidedOn },
  }
}

/**
 * 保留注文を、**実際の寄値**で約定させる。
 *
 * 🔴 呼ぶのは「次の実行」。そのとき日足の最終行は判断の翌営業日になっていて、
 *    その行の **始値＝実際に買えた/売れた値段** が入っている。
 *
 * 🔴 **窓ガード**＝新規建ての注文で、寄値が既に「判断時点で引いた損切り値」の
 *    向こう側にあるなら**建てない**。判断の前提が寄り付きで壊れているので、
 *    入った瞬間に損切りという形になるだけ。見送って翌日また判断する。
 *    🔵 損切り値は「判断時点の終値」から引いた値を使う（寄値から引き直すと、
 *       どんなに飛んでいても必ず内側に収まってしまい、ガードが働かない）。
 */
export function applyPending({ account, openOf, atrOf, rowsOf = () => null, vix, eventNear = false, date }) {
  const p = account.pending
  if (!p) return { account, actions: [], gapSkipped: false }

  let acc = { ...account, pending: null }
  const actions = []

  // ① 損切りに触れていたら、まず寄りで手仕舞う
  if (p.stop_exit && acc.position) {
    const px = openOf(acc.position.symbol)
    if (px != null) {
      acc = closePosition({ account: acc, price: px, date, execDate: date, reason: 'stop' })
      actions.push('stop(open)')
    }
  }

  const d = p.decision ?? {}

  // ② 窓ガード
  if (d.action === 'open' && d.symbol && d.symbol !== 'none' && p.planned_stop != null) {
    const px = openOf(d.symbol)
    if (px != null && px <= p.planned_stop) {
      actions.push('gap-skip')
      return { account: acc, actions, gapSkipped: true }
    }
  }

  // ③ 判断を寄値で約定させる
  const r = applyDecision({
    account: acc, decision: d, priceOf: openOf, atrOf, rowsOf, vix, eventNear, date, execDate: date,
  })
  return { account: r.account, actions: [...actions, ...r.actions], gapSkipped: false }
}

/**
 * 損切りを**引き上げる**（トレーリング・2026-08-11 追加）。
 *
 * 🔴 **損切りの確認より後に呼ぶこと。** 今日の終値で持ち上げてから今日の終値と比べたら、
 *    損切りには永遠に触れない。今日引き上げた線が効くのは明日から。
 * 🔴 引き上げるだけで下げない（判断は trailStop 側）。ここは口座に書くだけ。
 */
export function applyTrail({ account, priceOf, atrOf, rowsOf = () => null, vix, eventNear = false }) {
  const pos = account.position
  if (!pos) return { account, raised: false, from: null, to: null }
  const t = trailStop({
    current: priceOf(pos.symbol),
    atr20: atrOf(pos.symbol),
    rows: rowsOf(pos.symbol),
    vix,
    eventNear,
    prevStop: pos.stop_price ?? null,
  })
  if (!t || !t.raised) return { account, raised: false, from: pos.stop_price ?? null, to: pos.stop_price ?? null }
  return {
    account: { ...account, position: { ...pos, stop_price: t.price, stop_rule: t.rule ?? pos.stop_rule ?? null } },
    raised: true,
    from: pos.stop_price ?? null,
    to: t.price,
  }
}

/**
 * 成績を再計算する（trades から導出。保存された値は信用しない）。
 *
 * 🔴 同期由来の約定（exit_reason: 'sync'）は成績に入れない。
 *    これは「AI の判断」ではなく「実保有に合わせた辻褄合わせ」なので、
 *    AI の実力を測る数字に混ぜてはいけない。
 *    副次的に、キャプチャの誤読が成績を汚すのも防げる（建玉は次の同期で直るが、
 *    履歴に残った偽の約定は消えないため）。
 */
export function recomputeStats(account) {
  const closed = account.trades.filter(t => t.side === 'sell' && t.exit_reason !== 'sync')
  const n = closed.length
  const wins = closed.filter(t => (t.pnl ?? 0) > 0).length
  const total = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)

  let peak = -Infinity, maxDD = 0
  for (const p of account.equity_curve) {
    peak = Math.max(peak, p.equity)
    if (peak > 0) maxDD = Math.min(maxDD, p.equity / peak - 1)
  }

  return {
    ...account,
    stats: {
      ...account.stats,
      closed_trades: n,
      win_rate: n ? Math.round((wins / n) * 100) / 100 : null,
      expectancy: n ? Math.round(total / n) : null,
      max_drawdown_pct: account.equity_curve.length ? Math.round(maxDD * 10000) / 100 : null,
    },
  }
}

// ── 実保有との同期（ユーザー決定・2026-08-09）──────────────────────────────
//
// 🔴 ユーザーは基本的に AI の判断どおりに動き、最終決定だけ自分で下す。
//    そのため実保有とロボ口座はほぼ一致し、ズレるのは判断で外したときだけ。
//    そのズレを実態に合わせる（ユーザー判断。設計書 §11.5 の懸念は了承済み）。
//
// 🔴 ただし**差分は必ず記録する**。同期して消してしまうと、
//    「AI の判断が良かったのか、人の介入が良かったのか」を後から一切追えなくなる。
//    divergences に残しておけば、部分的にでも切り分けられる。
//
// 🔴 キャプチャは「売買した日だけ」投稿される運用。
//    同じ画像で二度同期しないよう、呼び出し側が last_synced_file_id で弾く。

/**
 * 読み取った実保有が、実際の価格・資金と辻褄が合うかを機械的に見る。
 * 🔴 AI の自己申告（confidence）に依存しないチェック。桁誤りをここで弾く。
 * @returns {string[]} 問題の説明（空なら問題なし）
 */
export function validateRealPosition({ positions, priceOf, cash = INITIAL_CASH }) {
  const issues = []
  for (const p of positions ?? []) {
    const code = String(p.symbol)
    const u = bySymbol(code)
    if (!u) continue                                  // 対象外の銘柄は見ない

    const market = priceOf ? priceOf(code) : null
    // 単価が現在値から大きく離れていたら桁誤りを疑う（±60%を超えたら弾く）
    if (market != null && market > 0 && p.avg_price > 0) {
      const ratio = p.avg_price / market
      if (ratio > 1.6 || ratio < 0.4) {
        issues.push(`${code}: 平均取得単価 ${Math.round(p.avg_price).toLocaleString()}円 が現在値 ${Math.round(market).toLocaleString()}円 と離れすぎ（桁の読み違いの可能性）`)
      }
    }
    // 資金で買えない数量なら弾く
    if (market != null && market > 0 && p.qty > 0) {
      const cost = p.qty * market
      if (cost > cash * 3) {
        issues.push(`${code}: 数量 ${p.qty}口 は元本に対して大きすぎる（約${Math.round(cost).toLocaleString()}円分）`)
      }
    }
    if (!Number.isFinite(p.qty) || p.qty <= 0) issues.push(`${code}: 数量が読めていない`)
  }
  return issues
}

const SIDE_JA = {
  1321: 'ブル1倍', 1570: 'ブル2倍', 1571: 'ベア1倍', 1357: 'ベア2倍',
}
const label = (code) => `${SIDE_JA[String(code)] ?? ''}（${code}）`

/**
 * 前回の建玉と実保有を見比べて、「何がどう変わったか」を人が読める形にする。
 * 🔴 「前回からどれだけ減ったか／増えたか／新規で建てたか」が一目で分かることを狙う
 *    （ユーザー要望・2026-08-09）。
 */
export function describeChange(before, target) {
  const b = before ? { symbol: String(before.symbol), qty: before.qty } : null
  const t = target ? { symbol: String(target.symbol), qty: target.qty } : null

  if (!b && !t) return { matched: true, kind: 'none', note: '保有なし（変化なし）' }

  if (b && t && b.symbol === t.symbol) {
    if (b.qty === t.qty) {
      return { matched: true, kind: 'same', note: `${label(b.symbol)} ${b.qty}口のまま（変化なし）` }
    }
    const d = t.qty - b.qty
    return {
      matched: false,
      kind: d > 0 ? 'increased' : 'decreased',
      delta: d,
      note: d > 0
        ? `${label(b.symbol)} を ${b.qty}口 → ${t.qty}口 に買い増し（+${d}口）`
        : `${label(b.symbol)} を ${b.qty}口 → ${t.qty}口 に減らした（${d}口）`,
    }
  }

  if (b && !t) {
    return { matched: false, kind: 'closed', delta: -b.qty, note: `${label(b.symbol)} ${b.qty}口 を全部手仕舞い（保有なしに）` }
  }
  if (!b && t) {
    return { matched: false, kind: 'opened', delta: t.qty, note: `${label(t.symbol)} を新規で ${t.qty}口 建てた` }
  }
  return {
    matched: false,
    kind: 'switched',
    note: `${label(b.symbol)} ${b.qty}口 を手仕舞い、${label(t.symbol)} を ${t.qty}口 建てた（乗り換え）`,
  }
}

/**
 * 実保有をロボ口座に写し取る。差分は divergences に残す。
 *
 * 🔴 対象4銘柄を2つ以上持っていたら**同期しない**（どちらかを勝手に選ばない）。
 *    同時保有はしない前提だが、乗り換え途中や両建てした日には実際に起こりうる。
 */
export function syncWithReal({ account, realPosition, priceOf, date, sourceFileId }) {
  const all = (realPosition?.positions ?? []).filter(p => p && p.qty > 0)
  const inUniverse = all.filter(p => bySymbol(String(p.symbol)))

  if (inUniverse.length > 1) {
    const codes = inUniverse.map(p => p.symbol).join(', ')
    const diff = {
      date, source_file_id: sourceFileId ?? null,
      robo: account.position ? { symbol: account.position.symbol, qty: account.position.qty } : null,
      real: inUniverse.map(p => ({ symbol: String(p.symbol), qty: p.qty })),
      matched: false, skipped: true,
      note: `対象銘柄を${inUniverse.length}件保有（${codes}）→ どちらに合わせるか決められないため同期を見送り`,
    }
    return {
      account: { ...account, divergences: [...(account.divergences ?? []), diff], last_synced_file_id: sourceFileId ?? account.last_synced_file_id ?? null },
      diff,
    }
  }

  const target = inUniverse[0] ?? null
  const before = account.position ? { ...account.position } : null

  // 差分の記録（同期の前後で何が違ったか）
  // 🔴 equity を一緒に残す。「AIに従った期間」と「外した期間」の成績を
  //    あとから比較するための起点になる（これが無いと期間リターンを出せない）。
  const diff = {
    date,
    source_file_id: sourceFileId ?? null,
    equity: Math.round(equityOf(account, priceOf ?? (() => null))),
    robo: before ? { symbol: before.symbol, qty: before.qty, avg_price: before.avg_price } : null,
    real: target ? { symbol: String(target.symbol), qty: target.qty, avg_price: target.avg_price } : null,
    matched: false,
    ...describeChange(before, target),
  }

  const divergences = [...(account.divergences ?? []), diff]

  // 一致しているなら口座はそのまま（現金の再計算もしない）
  if (diff.matched) {
    return { account: { ...account, divergences, last_synced_file_id: sourceFileId ?? account.last_synced_file_id ?? null }, diff }
  }

  // 🔴 建玉を実態に置き換え、現金は「元本 − 建玉の簿価」で辻褄を合わせる。
  //    実口座の現金残高は分からないので、ロボ口座の元本を基準にする。
  const nextPosition = target
    ? {
        symbol: String(target.symbol),
        qty: target.qty,
        avg_price: target.avg_price,
        // 損切りは維持（同じ銘柄なら）。違う銘柄なら次の判断で引き直される
        stop_price: before && String(before.symbol) === String(target.symbol) ? before.stop_price : null,
        stop_rule: before && String(before.symbol) === String(target.symbol) ? before.stop_rule : null,
        opened_on: before && String(before.symbol) === String(target.symbol) ? before.opened_on : date,
        synced_from_real: true,
      }
    : null

  // 実現損益: ロボが持っていた建玉を、実際には手仕舞っていた場合に精算する
  let cash = account.cash
  const trades = [...account.trades]
  if (before && (!target || String(before.symbol) !== String(target.symbol))) {
    const px = priceOf ? priceOf(before.symbol) : null
    if (px != null) {
      cash += before.qty * px
      trades.push({
        id: `${date}-sync-close`,
        decided_on: date,
        executed_on: date,
        side: 'sell',
        symbol: before.symbol,
        qty: before.qty,
        price: px,
        entry_price: before.avg_price,
        pnl: Math.round((px - before.avg_price) * before.qty),
        exit_reason: 'sync',   // 🔴 実保有に合わせた結果の決済。AIの判断ではない
      })
    }
  }
  if (nextPosition && (!before || String(before.symbol) !== String(nextPosition.symbol))) {
    cash -= nextPosition.qty * nextPosition.avg_price
    trades.push({
      id: `${date}-sync-open`,
      decided_on: date,
      executed_on: date,
      side: 'buy',
      symbol: nextPosition.symbol,
      qty: nextPosition.qty,
      price: nextPosition.avg_price,
      reason: '実保有に合わせて同期',
      exit_reason: undefined,
      synced: true,           // 🔴 AIの判断による建玉ではない印
    })
  } else if (nextPosition && before && nextPosition.qty !== before.qty) {
    // 同じ銘柄で数量だけ違う → 差分を現金で調整
    cash -= (nextPosition.qty - before.qty) * nextPosition.avg_price
  }

  return {
    account: {
      ...account,
      cash,
      position: nextPosition,
      trades,
      divergences,
      last_synced_file_id: sourceFileId ?? account.last_synced_file_id ?? null,
    },
    diff,
  }
}

/** 日次の評価額を1点追加する（同じ日付は上書きせず、既にあれば追加しない） */
export function pushEquity(account, date, equity) {
  if (account.equity_curve.some(p => p.date === date)) return account
  return { ...account, equity_curve: [...account.equity_curve, { date, equity: Math.round(equity) }] }
}
