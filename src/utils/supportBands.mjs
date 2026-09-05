// ──────────────────────────────────────────────────────────────────────────
// 歴史的サポート帯の判定 — 🔴 **ここが単一情報源**。
//   検証（scripts/analyze-support-bounce.mjs）と画面用データ（scripts/build-target-support.mjs）は
//   必ずこれを呼ぶ。片方だけ定義を変えると「検証した帯」と「画面に出す帯」が別物になる。
//
// 用語
//   局所安値（pivot low） … 前後 W 本で最安の安値。🔴 確定まで W 本かかる。
//   帯（band）            … 近い安値をまとめた価格帯。別々の時期に MIN_TOUCH 回以上触れたものだけ採る。
// ──────────────────────────────────────────────────────────────────────────

/** 帯の既定の定義（検証時の既定値と同じ）。 */
export const DEFAULT_DEF = {
  W: 20,          // 局所安値の窓（前後この本数で最安なら安値）
  BAND: 0.03,     // 帯の幅（±%）
  MIN_TOUCH: 3,   // 何回触れていたら「歴史的」か
  SEP: 60,        // タッチ同士を別物とみなす間隔（営業日）
  WARMUP: 750,    // 帯を組むのに最低限必要な本数（約3年）
}

/**
 * 局所安値の位置を返す（`i` は bars の添字）。
 * 🔴 前後 W 本ぶん必要なので、いちばん新しい安値でも W 本前までしか確定しない。
 */
export function pivotLows(bars, W) {
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
export function buildBands(bars, pivots, { BAND, MIN_TOUCH, SEP }) {
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
