// TARGET（歴史的サポート狙い）のデータ。
//
// 🔴 書き込むのは `scripts/build-target-support.mjs` だけ（帯の判定は supportBands.mjs が単一情報源）。
// 🔴 **勝てると言っていない**。2026-09-02 の実測では、サポート帯で買っても
//    「同じ日に全銘柄を買った平均」に負けていた。`caveat` を画面から消さないこと。
// 🔵 価格は分割・配当調整済み。板に出ている値段とは少しずれる（帯と同じ物差しに乗せるため）。

import { fetchWithCache } from './dataCache'

export type TargetState = 'inside' | 'near' | 'broken' | 'noband'

/**
 * 帯へのたどり着き方。
 * 🔴 'from_below'（下から上げてきた）は、研究で数えた事象ではない＝支えではなく戻り売りの帯かもしれない。
 */
export type TargetApproach = 'above' | 'from_above' | 'from_below'

export type TargetBand = {
  /** 帯の中心（安値の平均） */
  price: number
  /** 帯の上限・下限（中心の ±3%） */
  top: number
  bottom: number
  /** 別々の時期に何回触れたか */
  touches: number
  /** 最後に触れた日 */
  lastTouch: string | null
}

export type TargetSeriesPoint = { d: string; c: number | null; l: number | null; h: number | null }

export type TargetItem = {
  code: string
  name: string
  sector33: string | null
  date: string
  close: number | null
  band: TargetBand | null
  /** 現在値が帯の上限から何%離れているか（＋＝まだ上・−＝帯の中） */
  gapPct: number | null
  state: TargetState
  approach: TargetApproach | null
  /** 帯に入ってから何営業日たったか */
  daysInside: number | null
  ret20: number | null
  ret60: number | null
  ret250: number | null
  fromHighPct: number | null
  fromLowPct: number | null
  /** 直近60日の売買代金の中央値（億円） */
  turnoverOku: number | null
  /** 20日平均出来高（需給ゲージの分母） */
  vol20: number | null
  /** 主力だけ: 一言メモと週足の系列 */
  note?: string
  series?: TargetSeriesPoint[]
}

export type TargetSupportData = {
  updatedAt: string
  asOf: string
  def: { pivot: number; bandPct: number; minTouch: number; sep: number; warmup: number }
  universe: number
  filters: { maxGapPct: number; minTurnoverOku: number }
  caveat: string
  basis: string
  /** 指名した銘柄（スキャンの結果ではない） */
  core: TargetItem[]
  /** スキャンで帯の近くにいた銘柄 */
  items: TargetItem[]
}

// 🔴 主力の顔ぶれを入れ替えたらキーを上げる（上げないと外した銘柄が最大30分残る）
const CACHE_KEY = 'poical-target-support-v1'
const TTL = 30 * 60 * 1000

export async function fetchTargetSupport(force = false): Promise<TargetSupportData | null> {
  try {
    return await fetchWithCache<TargetSupportData>({
      key: CACHE_KEY,
      ttl: TTL,
      force,
      checkUpdatedAt: true,
      fetcher: async () => {
        const res = await fetch(`${import.meta.env.BASE_URL}data/target_support.json`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as TargetSupportData
        return { data, updatedAt: data.updatedAt }
      },
    })
  } catch {
    return null   // まだ生成されていない期間は静かに何も出さない
  }
}

/** 帯へのたどり着き方のラベル。🔵 'above' はまだ帯の上なので出さない。 */
export const APPROACH_LABEL: Record<TargetApproach, string> = {
  above: '',
  from_above: '上から',
  from_below: '下から',
}

/** 状態のラベルと色の役割（画面で使い回す）。🔴 断定しない言い方でそろえる。 */
export const STATE_LABEL: Record<TargetState, string> = {
  inside: '帯の中',
  near: '帯の上',
  broken: '帯を割った',
  noband: '帯なし',
}

/** 帯までの距離を1行にする。null は「—」。 */
export function gapText(gapPct: number | null): string {
  if (gapPct == null) return '—'
  if (gapPct > 0) return `あと ${gapPct.toFixed(1)}%`
  return `帯の中 ${Math.abs(gapPct).toFixed(1)}%`
}
