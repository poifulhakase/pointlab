// tevCore.mjs の型定義（moduleResolution: bundler で TS から型解決される）。

export function r2(n: number): number

export function sig(pct: number): 'BULL' | 'NEUTRAL' | 'BEAR'

export interface TevPhysicsInput {
  /** 速度（score_today * 100）。null なら計算不能。 */
  tev_V: number | null
  /** 加速度（(score_today - score_prev) * 100）。null なら計算不能。 */
  tev_A: number | null
  /** 外国人4週累計パーセンタイル（慣性の重み付け） */
  foreign4wPct: number
  /** HF純計(LF)パーセンタイル（COT BEAR 減衰判定に使用） */
  cotLfPct: number
  /** 信用倍率パーセンタイル */
  creditRatioPct: number
  /** 空売り比率パーセンタイル */
  ssPct: number
  /** 合成スコア（確信度算出。呼び出し側が項目集合に応じて算出済みで渡す） */
  compositeScore: number
  /** 先物出来高が3日連続減少（追加減衰）。データがなければ false。 */
  futuresVolumeDecline?: boolean
  /** 直近10日安値圏（底打ち反転判定）。データがなければ false。 */
  is10dLow?: boolean
}

export interface TevPhysicsResult {
  tev_fBase: number
  tev_fInertia: number
  tev_decay: number
  tev_decayReasons: string[]
  tev_rResist: number
  tev_value: number
  tev_status: string
  tev_confidence: number
}

export function computeTevPhysics(input: TevPhysicsInput): TevPhysicsResult | null
