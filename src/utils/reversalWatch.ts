// 反転臨界モニター（管理者専用・研究室で表示）
//
// 「いまのトレンドと逆方向への転換」がどれだけ近づいているかを、
// 需給・ボラティリティ・モメンタムの6条件で観測する。
//
// 🔴 設計上の約束（第19セッションの方針を踏襲）
//   ・**売買の指示は出さない**。「◯◯を満たした／満たしていない」という観測事実だけを返す
//   ・条件はトレンドの向きで**対称に反転**する（下降局面なら上昇転換の条件、上昇局面なら下降転換の条件）
//   ・数値の判定はすべてこのモジュール（純粋関数）に置き、表示側は結果を並べるだけ
//
// データはすべて既存の取得ユーティリティ経由（新しい取得口は作らない）。

import type { MarginWeekData }   from './jpxMarginData'
import type { InvestorWeekData } from './jpxInvestorData'
import type { ShortSellWeekData } from './shortSellData'
import type { VixDayData }        from './vixData'
import type { NkFuturesDayData }  from './nkFuturesPriceData'
import type { NtRatioPoint }      from './ntRatioData'
import type { AdvanceDeclineWeekData } from './advanceDeclineData'

// 🔴 データの並び順は取得元ごとに違う（2026-07-28 実データで確認済み）。ここで吸収する。
//   新しい順（降順）… nkFuturesPrice / margin / investor / shortSell / advanceDecline
//   古い順（昇順）  … vixDaily（静的JSONをそのまま返すため） / ntRatio
//
// 🔴 単位も混在している。
//   margin.longBal / shortBal … 百万円
//   investor.foreigner …………… 億円（fetch-jpx.mjs の senToOku で変換済み）

/** 監視するトレンドの向き。'up'=上昇局面（下降転換を待つ）／'down'=下降局面（上昇転換を待つ） */
export type WatchTrend = 'up' | 'down'

export interface WatchItem {
  key:     string
  label:   string
  /** 現在の観測値（表示用の短い文字列） */
  value:   string
  /** 点灯（条件を満たした）か */
  lit:     boolean
  /** 点灯の条件（人が読む説明） */
  criteria: string
}

export interface ReversalWatch {
  trend:    WatchTrend
  /** トレンド判定の根拠（表示用） */
  trendNote: string
  items:    WatchItem[]
  lit:      number
  total:    number
  /** 日足データの基準日（価格・トレンド判定・価格構造はこの日付基準） */
  asOf:     string | null
  /**
   * 日足データが基準日から何日経っているか。
   * 🔴 このプロジェクトは「データが静かに古くなる」事故を繰り返しているため（topix.json が2週間停止、
   *    localStorageキャッシュで日足だけ数日前に固着）、鮮度を数値で持って表示側で警告できるようにする。
   */
  staleDays: number | null
}

// ── 小さなヘルパー ──────────────────────────────────────────────

/** 百万円 → 億円（margin 用。investor は既に億円なので通さないこと） */
const toOku = (millionYen: number): number => millionYen / 100

const fmtOku = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString()}億`

/** 古い順の系列から最新n件を「新しい順」で取り出す */
const latestFromAsc = <T>(asc: T[], n: number): T[] => asc.slice(-n).reverse()

/** 指数平滑移動平均（先頭が最も古い系列を受け取る） */
export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k))
  return out
}

/**
 * MACD(12,26,9) のヒストグラム系列を返す（先頭が最も古い）。
 * データが足りない場合は空配列。
 */
export function macdHistogram(closesAsc: number[], fast = 12, slow = 26, signal = 9): number[] {
  if (closesAsc.length < slow + signal) return []
  const emaFast = ema(closesAsc, fast)
  const emaSlow = ema(closesAsc, slow)
  const macd    = closesAsc.map((_, i) => emaFast[i] - emaSlow[i])
  const sig     = ema(macd, signal)
  return macd.map((m, i) => m - sig[i])
}

/** 日足データ（新しい順で渡される）を古い順の終値配列にする */
const closesAscFrom = (daily: NkFuturesDayData[]): number[] =>
  [...daily].reverse().map(d => d.close).filter(v => typeof v === 'number')

// ── トレンド判定 ────────────────────────────────────────────────

/**
 * 監視の向きを決める。25日移動平均乖離率を第一の根拠にし、
 * 取れない場合は「直近終値 vs 25営業日前の終値」で代替する。
 *
 * 🔴 ここは「どちらの転換を待つか」を決めるだけで、売買の方向を示すものではない。
 */
export function detectTrend(daily: NkFuturesDayData[]): { trend: WatchTrend; note: string } {
  const latest = daily[0]
  const dev = latest?.ma25_dev

  if (typeof dev === 'number') {
    return dev < 0
      ? { trend: 'down', note: `25日線乖離 ${dev.toFixed(2)}%（下降局面）` }
      : { trend: 'up',   note: `25日線乖離 +${dev.toFixed(2)}%（上昇局面）` }
  }

  const closes = closesAscFrom(daily)
  if (closes.length >= 26) {
    const now = closes[closes.length - 1]
    const ref = closes[closes.length - 26]
    return now < ref
      ? { trend: 'down', note: '25営業日前を下回る（下降局面）' }
      : { trend: 'up',   note: '25営業日前を上回る（上昇局面）' }
  }

  return { trend: 'down', note: 'データ不足のため下降局面として扱う' }
}

// ── 各条件 ──────────────────────────────────────────────────────

/**
 * ① 信用買い残
 *   下降局面 → 整理が進んだか（週 -1,000億以下の減少）
 *   上昇局面 → 過熱していないか（週 +3,000億以上の増加）
 */
function marginItem(margin: MarginWeekData[], trend: WatchTrend): WatchItem {
  const [latest, prev] = margin
  const delta = latest && prev ? toOku(latest.longBal - prev.longBal) : null

  return {
    key: 'margin',
    label: '信用買い残',
    value: delta === null ? 'データなし' : `${fmtOku(delta)}／週`,
    lit: delta === null ? false : (trend === 'down' ? delta <= -1000 : delta >= 3000),
    criteria: trend === 'down' ? '週 -1,000億以下の減少で点灯（整理の進行）' : '週 +3,000億以上の増加で点灯（過熱）',
  }
}

/**
 * ② 空売り比率
 *   下降局面 → 40超をつけてから低下（投げが出て踏み上げ燃料が再装填された）
 *   上昇局面 → 30割れ（売り方が枯れ、下げの燃料が無くなった）
 */
function shortSellItem(ss: ShortSellWeekData[], trend: WatchTrend): WatchItem {
  const latest = ss[0]?.ratio ?? null
  const recent = ss.slice(0, 5).map(d => d.ratio)
  const peak   = recent.length ? Math.max(...recent) : null

  const lit = latest === null || peak === null
    ? false
    : trend === 'down'
      ? peak >= 40 && latest < peak
      : latest < 30

  return {
    key: 'short_sell',
    label: '空売り比率',
    value: latest === null ? 'データなし' : `${latest.toFixed(2)}%（直近5週の最大 ${peak?.toFixed(2)}%）`,
    lit,
    criteria: trend === 'down' ? '40%超をつけてから低下で点灯（投げの発生）' : '30%割れで点灯（売り方の枯渇）',
  }
}

/**
 * ③ VIX
 *   下降局面 → 25超をつけてから低下（恐怖のピークアウト）
 *   上昇局面 → 15割れの低位から上昇（警戒の立ち上がり）
 */
function vixItem(vixAsc: VixDayData[], trend: WatchTrend): WatchItem {
  // 🔴 vix_daily は「古い順」で来る。最新は末尾。
  const vix = latestFromAsc(vixAsc, 20)
  const latest = vix[0]?.close ?? null
  const recent = vix.map(d => d.close).filter(v => typeof v === 'number')
  const peak   = recent.length ? Math.max(...recent) : null
  const low    = recent.length ? Math.min(...recent) : null

  const lit = latest === null
    ? false
    : trend === 'down'
      ? (peak !== null && peak >= 25 && latest < peak)
      : (low !== null && low < 15 && latest > low * 1.2)

  return {
    key: 'vix',
    label: 'VIX',
    value: latest === null ? 'データなし' : `${latest.toFixed(2)}（直近20日 ${low?.toFixed(1)}〜${peak?.toFixed(1)}）`,
    lit,
    criteria: trend === 'down' ? '25超をつけてから低下で点灯（恐怖のピークアウト）' : '15割れから2割超の上昇で点灯（警戒の立ち上がり）',
  }
}

/**
 * ④ 海外投資家フロー（週次）
 *   下降局面 → 2週連続の買い越し
 *   上昇局面 → 2週連続の売り越し
 */
function foreignerItem(inv: InvestorWeekData[], trend: WatchTrend): WatchItem {
  const two = inv.slice(0, 2)
  const ok = two.length === 2 && (trend === 'down'
    ? two.every(w => w.foreigner > 0)
    : two.every(w => w.foreigner < 0))

  // 🔴 investor は既に億円単位（百万円ではない）。ここで割らないこと。
  const value = two.length
    ? two.map(w => `${w.date.slice(5)} ${fmtOku(w.foreigner)}`).join(' / ')
    : 'データなし'

  return {
    key: 'foreigner',
    label: '海外投資家',
    value,
    lit: ok,
    criteria: trend === 'down' ? '2週連続の買い越しで点灯' : '2週連続の売り越しで点灯',
  }
}

/**
 * ⑤ 日足モメンタム（MACDヒストグラム）
 *   向きに関わらず「**絶対値が2日連続で縮小**」＝勢いの鈍化で点灯。
 *   下降局面ではマイナス幅の縮小、上昇局面ではプラス幅の縮小を見ることになる。
 */
function momentumItem(ntAsc: NtRatioPoint[], trend: WatchTrend): WatchItem {
  // 🔴 MACD(12,26,9) には最低35本要る。nk_futures_price.json は十数本しか無いため、
  //    日経終値の長期系列を持つ ntRatio（古い順）を使う。
  const hist = macdHistogram(ntAsc.map(p => p.nikkei).filter(v => typeof v === 'number'))
  const last3 = hist.slice(-3)

  const shrinking = last3.length === 3
    && Math.abs(last3[1]) < Math.abs(last3[0])
    && Math.abs(last3[2]) < Math.abs(last3[1])

  // 方向が逆（下降局面なのにヒストがプラス等）なら、そもそも勢い鈍化の判定対象にしない
  const latest = last3[last3.length - 1]
  const aligned = latest === undefined ? false : (trend === 'down' ? latest < 0 : latest > 0)

  return {
    key: 'momentum',
    label: '日足モメンタム',
    value: latest === undefined ? 'データ不足' : `MACDヒスト ${Math.round(latest).toLocaleString()}`,
    lit: aligned && shrinking,
    criteria: '絶対値が2日連続で縮小したら点灯（勢いの鈍化）',
  }
}

/**
 * ⑥ 価格構造
 *   下降局面 → 直近5日の安値が、その前5日の安値を上回る（安値切り上げ）
 *   上昇局面 → 直近5日の高値が、その前5日の高値を下回る（高値切り下げ）
 */
function priceStructureItem(daily: NkFuturesDayData[], trend: WatchTrend): WatchItem {
  const d = daily.slice(0, 10) // 新しい順
  if (d.length < 10) {
    return { key: 'price', label: '価格構造', value: 'データ不足', lit: false, criteria: '―' }
  }
  const recent = d.slice(0, 5)
  const before = d.slice(5, 10)

  if (trend === 'down') {
    const lowNow = Math.min(...recent.map(x => x.low))
    const lowPre = Math.min(...before.map(x => x.low))
    return {
      key: 'price',
      label: '価格構造',
      value: `直近5日安値 ${Math.round(lowNow).toLocaleString()}（前5日 ${Math.round(lowPre).toLocaleString()}）`,
      lit: lowNow > lowPre,
      criteria: '安値を切り上げたら点灯',
    }
  }

  const highNow = Math.max(...recent.map(x => x.high))
  const highPre = Math.max(...before.map(x => x.high))
  return {
    key: 'price',
    label: '価格構造',
    value: `直近5日高値 ${Math.round(highNow).toLocaleString()}（前5日 ${Math.round(highPre).toLocaleString()}）`,
    lit: highNow < highPre,
    criteria: '高値を切り下げたら点灯',
  }
}

/**
 * ⑦ NT倍率（日経平均 ÷ TOPIX）
 *   日経固有の弱さ／強さを測る。2026-07 の局面では 16.99 → 15.71 と急低下し、
 *   「日経（AI・半導体）だけが売られている」ことを示していた。
 *
 *   下降局面 → 5日平均が**上向き**に転じたら点灯（日経の相対的な弱さが止まる＝ローテーション一服）
 *   上昇局面 → 5日平均が**下向き**に転じたら点灯（日経主導が終わる）
 */
function ntRatioItem(ntAsc: NtRatioPoint[], trend: WatchTrend): WatchItem {
  const ratios = ntAsc.map(p => p.ratio).filter(v => typeof v === 'number')
  if (ratios.length < 10) {
    return { key: 'nt', label: 'NT倍率', value: 'データ不足', lit: false, criteria: '―' }
  }
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const now  = avg(ratios.slice(-5))
  const prev = avg(ratios.slice(-10, -5))
  const rising = now > prev

  return {
    key: 'nt',
    label: 'NT倍率',
    value: `${ratios[ratios.length - 1].toFixed(2)}（5日平均 ${now.toFixed(2)} ← ${prev.toFixed(2)}）`,
    lit: trend === 'down' ? rising : !rising,
    criteria: trend === 'down'
      ? '5日平均が上向きに転じたら点灯（日経の相対的な弱さが止まる）'
      : '5日平均が下向きに転じたら点灯（日経主導の終わり）',
  }
}

/**
 * ⑧ 騰落レシオ（25日）
 *   市場全体の過熱・冷え込み。100が中立、120超で買われすぎ、70以下で売られすぎ。
 *
 *   下降局面 → 70以下（売られすぎ＝底の目安）で点灯
 *   上昇局面 → 120以上（買われすぎ）で点灯
 */
function advanceDeclineItem(ad: AdvanceDeclineWeekData[], trend: WatchTrend): WatchItem {
  const latest = ad[0]?.ratio25 ?? null

  return {
    key: 'advance_decline',
    label: '騰落レシオ',
    value: latest === null ? 'データなし' : `${latest.toFixed(2)}（100が中立）`,
    lit: latest === null ? false : (trend === 'down' ? latest <= 70 : latest >= 120),
    criteria: trend === 'down' ? '70以下で点灯（市場全体が売られすぎ）' : '120以上で点灯（市場全体が買われすぎ）',
  }
}

// ── 組み立て ────────────────────────────────────────────────────

/**
 * 反転臨界モニターを組み立てる（純粋関数）。
 * 各データは「新しい順」で渡すこと（既存の fetch* の戻り値がすべて新しい順）。
 */
export function buildReversalWatch(
  daily:  NkFuturesDayData[],
  margin: MarginWeekData[],
  ss:     ShortSellWeekData[],
  vix:    VixDayData[],
  inv:    InvestorWeekData[],
  nt:     NtRatioPoint[] = [],
  ad:     AdvanceDeclineWeekData[] = [],
  today:  Date = new Date(),
): ReversalWatch {
  const { trend, note } = detectTrend(daily)

  const items: WatchItem[] = [
    marginItem(margin, trend),
    shortSellItem(ss, trend),
    vixItem(vix, trend),
    foreignerItem(inv, trend),
    momentumItem(nt, trend),
    priceStructureItem(daily, trend),
    ntRatioItem(nt, trend),
    advanceDeclineItem(ad, trend),
  ]

  const asOf = daily[0]?.date ?? null
  const staleDays = asOf
    ? Math.floor((Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86400000)
    : null

  return {
    trend,
    trendNote: note,
    items,
    lit:   items.filter(i => i.lit).length,
    total: items.length,
    asOf,
    staleDays,
  }
}
