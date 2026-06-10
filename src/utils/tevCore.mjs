// TEV（トータル物理エネルギーベクトル）コア計算の単一情報源。
// backtest-tev.mjs（node/ESM）と engineExport.ts（Vite/TS）の両方から import し、
// 物理式の二重定義による乖離（=誤った勝率根拠）を構造的に防ぐ。
// logic_version: v2-symmetric-restoring。
//
// データ可用性による差は呼び出し側が引数で吸収する:
//   - 先物出来高3日連続減少の減衰 → futuresVolumeDecline（backtest は週次過去データなしで false）
//   - 底打ち反転ステータス        → is10dLow（backtest は10日安値圏データなしで false）
//   - compositeScore の項目集合    → compositeScore を算出済みで渡す（backtest は PCR/USDJPY を含まない7項目）
//
// 型は tevCore.d.mts を参照（moduleResolution: bundler で TS から型解決される）。

/** 小数2桁丸め（両環境共通） */
export const r2 = (n) => Math.round(n * 100) / 100

/**
 * パーセンタイル(0-100) → シグナル。
 * 閾値は 65/35（実エンジン基準に統一・★2026-06-08。旧 backtest は 60/40 で乖離していた）。
 */
export const sig = (pct) => (pct >= 65 ? 'BULL' : pct <= 35 ? 'BEAR' : 'NEUTRAL')

/**
 * TEV コア物理計算。tev_V/tev_A が null の場合は null を返す。
 * 戻り値の各フィールドは backtest / engineExport の双方で同一式で算出される。
 */
export function computeTevPhysics({
  tev_V,
  tev_A,
  foreign4wPct,
  cotLfPct,
  creditRatioPct,
  ssPct,
  compositeScore,
  futuresVolumeDecline = false,
  is10dLow = false,
}) {
  if (tev_V == null || tev_A == null) return null

  const tev_fBase = r2((0.3 * tev_V) + (0.7 * tev_A))
  const tev_fInertiaRaw = r2(tev_fBase * (foreign4wPct / 100))

  // 減衰（decay）。理由文字列は出力にそのまま載るため日本語で記述する（出力制約②対応）。
  let tev_decay = 1.0
  const tev_decayReasons = []
  if (tev_V > 0 && tev_A <= 0) {
    tev_decay *= 0.25
    tev_decayReasons.push('天井の失速（上昇速度はあるが加速度が頭打ち）→75%減衰')
  }
  if (sig(cotLfPct) === 'BEAR') {
    tev_decay *= 0.5
    tev_decayReasons.push('燃料漏れ（ヘッジファンドのネットが売り越し方向）→50%減衰')
  }
  if (futuresVolumeDecline) {
    tev_decay *= 0.5
    tev_decayReasons.push('燃料漏れ（先物の出来高が3日連続減少）→50%減衰')
  }
  const tev_fInertia = r2(tev_fInertiaRaw * tev_decay)

  // R_resistance（弾性・両側 / v2-symmetric-restoring）: 中立(信用%ile=50, 空売り%ile=50)を
  // ゼロに再センタリングし上下両方向に効かせる。
  //   信用厚い＋空売り薄い → signedLoad>0 → 戻り売りの重し（下押し）
  //   信用薄い＋空売り厚い → signedLoad<0 → 踏み上げバネ（上押し）
  const signedLoad = creditRatioPct - ssPct
  const tev_rResist = r2(-8 * Math.sign(signedLoad) * Math.sqrt(Math.abs(signedLoad)))
  const tev_value = Math.round(tev_fInertia + tev_rResist)

  // ステータス判定（優先順位: 底打ち反転 > 慣性航行中 > 真空落下 > 重力反転中 > 限界膨張）
  let tev_status
  if (tev_value >= -24 && tev_A >= 50 && is10dLow) tev_status = '底打ち反転'
  else if (tev_value >= 25 && tev_A > 0) tev_status = '慣性航行中'
  else if (tev_value <= -25 && tev_A < 0) tev_status = '真空落下'
  else if (tev_value <= -25 && tev_A >= 0) tev_status = '重力反転中'
  else if (tev_value >= 25) tev_status = '限界膨張（慣性失速）'
  else tev_status = '限界膨張'

  // 確信度: 限界膨張系は50%固定、他は合成スコアの絶対値ベース。
  // ★2026-06-10 再キャリブレーション: 52週バックテストで確信度が自信過剰（むしろ高確信度帯
  //   ほど実勝率が下がる「反転」傾向）と判明。傾き0.5→0.3・上限95→70に圧縮して過信を削った。
  //   小標本(n=27)のため観測値へのフィッティング（反転の打ち消し）はせず、原理的なシュリンクに留める。
  //   範囲は 50〜70%。70 を上限＝バンド境界（弱い〜59/明確60-69/強い共振70）と一致させる。
  //   enginePrompt の確信度バンド閾値も同時に再設定済み。⚠70%でも「当たる」保証ではない。
  const tev_confidence = tev_status.startsWith('限界膨張')
    ? 50
    : Math.min(70, Math.round(Math.abs(compositeScore) * 0.3 + 50))

  return { tev_fBase, tev_fInertia, tev_decay, tev_decayReasons, tev_rResist, tev_value, tev_status, tev_confidence }
}
