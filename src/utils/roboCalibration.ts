// 判断の答え合わせ（`public/data/robo_calibration.json`）の読み込み。
// 🔴 書き込みはしない。書くのは `scripts/robo-outcome.mjs`（GitHub Actions）だけ。
// 🔴 ここに出る数字は「判断が短期で当たったか」であって**建玉の損益ではない**
//    （実際は損切り・トレーリングで手仕舞うまで持つ）。ロボ口座の成績とは別物。
import { fetchWithCache } from './dataCache'
import { isPreviewMode } from './previewMode'

export type CalibrationBin = {
  range: string
  n: number
  wins: number
  avg_confidence: number | null   // 言った確率（平均確信度）%
  win_rate_pct: number | null     // 実勝率 %
  gap: number | null              // 実勝率 − 確信度（負＝自信過剰）
}

export type HorizonStat = {
  n: number
  wins: number
  win_rate_pct: number | null
  avg_confidence: number | null
  avg_edge_pct: number | null
  bull: { n: number; win_rate_pct: number | null }
  bear: { n: number; win_rate_pct: number | null }
}

export type CalibrationVariant = {
  label: string
  summary: {
    logs: number
    directional: number
    hold: number
    by_horizon: Record<string, HorizonStat>
  }
  calibration: Record<string, CalibrationBin[]>
}

export type RoboCalibration = {
  updatedAt: string
  basis: string
  caveat: string
  horizons: string[]
  variants: Record<string, CalibrationVariant>
  rows: {
    date: string
    side: 'bull' | 'bear' | null
    symbol: string | null
    confidence_pct: number | null
    complete: boolean
    [k: string]: unknown
  }[]
}

const CACHE_KEY = 'poical-robo-calibration-v1'
const TTL = 30 * 60 * 1000

/**
 * 🔴 これを下回るあいだは**暫定**。画面にもそう書く。
 *    小さい標本の勝率を毎日見ていると、偶然のブレを実力と読み違える
 *    （ぽいロボ本体では確信度の自信過剰を**52週貯めてから**見つけている）。
 */
export const PROVISIONAL_MIN = 30

/** 採点できた件数が判定に足りているか */
export function isProvisional(n: number | null | undefined): boolean {
  return (n ?? 0) < PROVISIONAL_MIN
}

/** 主に見る horizon（5営業日後）。ここを変えると画面の主表示が変わる */
export const MAIN_HORIZON = '5d'

/** 本番（影ではないほう）の horizon 成績。無ければ null */
export function mainStat(cal: RoboCalibration | null, horizon = MAIN_HORIZON): HorizonStat | null {
  return cal?.variants?.main?.summary?.by_horizon?.[horizon] ?? null
}

/** 影も含めた全 variant を表示順（本番が先）で返す */
export function variantList(cal: RoboCalibration | null): (CalibrationVariant & { key: string })[] {
  const v = cal?.variants ?? {}
  const keys = Object.keys(v).sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
  return keys.map(k => ({ key: k, ...v[k] }))
}

export async function fetchRoboCalibration(force = false): Promise<RoboCalibration | null> {
  // 🔵 プレビューは実データを見せない。答え合わせのダミーは作らない（意味のある数字を作れない）
  //    ＝パネルごと出さない。
  if (isPreviewMode()) return null
  try {
    return await fetchWithCache<RoboCalibration>({
      key: CACHE_KEY,
      ttl: TTL,
      force,
      fetcher: async () => {
        const res = await fetch(`${import.meta.env.BASE_URL}data/robo_calibration.json`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as RoboCalibration
        return { data, updatedAt: data.updatedAt }
      },
    })
  } catch {
    return null   // まだ生成されていない期間は静かに何も出さない
  }
}
