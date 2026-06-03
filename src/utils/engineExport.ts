// QuantView.tsx から抽出した AI エクスポート用データ構築ロジック（純粋関数）
import type { InvestorWeekData } from './jpxInvestorData'
import type { MarginWeekData } from './jpxMarginData'
import type { VixWeekData, VixDayData } from './vixData'
import { getMacroEventsForDate, MACRO_META } from './macroCalendar'
import { getSqDates, getSqMarkersForDate, SQ_META } from './sqCalendar'
import type { AdvanceDeclineWeekData } from './advanceDeclineData'
import type { ShortSellWeekData } from './shortSellData'
import type { ArbitrageWeekData, ArbitrageDayData } from './arbitrageData'
import type { CotNikkeiWeekData } from './cotNikkeiData'
import type { FuturesDayData } from './futuresDailyData'
import type { UsdjpyDayData } from './usdjpyData'
import type { Nas100DayData } from './nas100Data'
import type { NkFuturesDayData } from './nkFuturesPriceData'
import type { StocksDailyData } from './stocksDailyData'
import type { NtRatioPoint } from './ntRatioData'

// ── エクスポート用データ構築 ──────────────────────
function toDate(s: string) { return (s ?? '').replace(/\//g, '-') }
const r2 = (n: number) => Math.round(n * 100) / 100

// 2つの日付(ms)間の営業日数(土日除外)を数える。
// 価格鮮度チェックでカレンダー日数を使うと、週末を挟む月曜は MA基準(米国市場ゲートで金曜) と
// 先物価格JST(月曜) が3カレンダー日=1営業日となり毎週月曜に誤発火するため、営業日数で測る。
// 日付文字列は UTC午前0時基準でパースされるため getUTCDay() で曜日判定する。祝日は未考慮
// （閾値2営業日に対し祝日1日の誤差は実害が小さい）。
export function businessDaysBetween(ms1: number, ms2: number): number {
  const start = Math.min(ms1, ms2)
  const end   = Math.max(ms1, ms2)
  let count = 0
  for (let t = start + 86400000; t <= end; t += 86400000) {
    const wd = new Date(t).getUTCDay()
    if (wd !== 0 && wd !== 6) count++
  }
  return count
}

function getUpcomingEvents(days = 28): { date: string; day: string; events: string[] }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
  const sqDates = [
    ...getSqDates(today.getFullYear()),
    ...getSqDates(today.getFullYear() + 1),
  ]
  const result: { date: string; day: string; events: string[] }[] = []
  for (let i = 0; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const events: string[] = []
    for (const e of getMacroEventsForDate(d, { us: true, jp: true })) {
      events.push(MACRO_META[e.type].label)
    }
    for (const sq of getSqMarkersForDate(d, sqDates)) {
      events.push(SQ_META[sq].label)
    }
    if (events.length > 0) {
      result.push({
        date: d.toISOString().slice(0, 10),
        day:  DAYS_JA[d.getDay()],
        events,
      })
    }
  }
  return result
}

const EXPORT_WEEKS = 13

// ── 偏差スコア計算ヘルパー ──────────────────────────
// 最低 MIN_Z 件あれば計算（データ欠損・プロキシ失敗でも動作）
const MIN_Z = 3

function zScore(values: number[]): number | null {
  if (values.length < MIN_Z) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  return r2((values[values.length - 1] - mean) / std)
}

function findNtForDate(ntMap: Map<string, NtRatioPoint>, weekDate: string): NtRatioPoint | undefined {
  if (ntMap.has(weekDate)) return ntMap.get(weekDate)
  const base = new Date(weekDate)
  for (let delta = 1; delta <= 3; delta++) {
    for (const sign of [1, -1]) {
      const d = new Date(base)
      d.setDate(base.getDate() + sign * delta)
      const key = d.toISOString().slice(0, 10)
      if (ntMap.has(key)) return ntMap.get(key)
    }
  }
  return undefined
}

function findVixForDate(vixMap: Map<string, VixWeekData>, date: string): VixWeekData | undefined {
  if (vixMap.has(date)) return vixMap.get(date)
  const base = new Date(date)
  for (let d = 1; d <= 5; d++) {
    for (const s of [1, -1]) {
      const t = new Date(base); t.setDate(base.getDate() + s * d)
      const k = t.toISOString().slice(0, 10)
      if (vixMap.has(k)) return vixMap.get(k)
    }
  }
  return undefined
}

export function buildExportJson(
  invData: InvestorWeekData[],
  marData: MarginWeekData[],
  vixData: VixWeekData[],
  ntData: NtRatioPoint[],
  adData: AdvanceDeclineWeekData[],
  ssData: ShortSellWeekData[],
  arbData: ArbitrageWeekData[],
  cotData: CotNikkeiWeekData[],
  arbDailyData: ArbitrageDayData[],
  usdjpyData: UsdjpyDayData[],
  futuresDailyData: FuturesDayData[],
  nas100Data: Nas100DayData[],
  vixDailyData: VixDayData[],
  nkFuturesPriceData: NkFuturesDayData[],
  stocksDailyData: StocksDailyData | null,
) {
  // ── ローカルヘルパー ──────────────────────────────
  function pctRank(series: number[], val: number): number {
    if (series.length === 0) return 50
    return Math.round(series.filter(v => v < val).length / series.length * 100)
  }
  function sig(bullPct: number): 'BULL' | 'NEUTRAL' | 'BEAR' {
    return bullPct >= 65 ? 'BULL' : bullPct <= 35 ? 'BEAR' : 'NEUTRAL'
  }
  function hvol(prices: number[], window: number): number | null {
    if (prices.length < window + 1) return null
    const sl   = prices.slice(-(window + 1))
    const rets = sl.slice(1).map((p, i) => Math.log(p / sl[i]))
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length
    return r2(Math.sqrt(variance * 252) * 100)
  }
  // weekly_history[0]=最新週(降順)での数値トレンド計算（SQ重力加速度用）
  function trendCalc(vals: number[], threshold: number) {
    if (vals.length < 2) return null
    const delta      = r2(vals[0] - vals[vals.length - 1])
    const weekDeltas = vals.slice(0, -1).map((v, i) => r2(v - vals[i + 1]))
    const up         = weekDeltas.filter(d => d > 0).length
    const down       = weekDeltas.filter(d => d < 0).length
    const phase      = delta > threshold ? '積み上げ中' : delta < -threshold ? '清算中' : '横ばい'
    // 直近2週の勢い（過去の大きな変動に引きずられない現在のモメンタム）
    const rec2       = weekDeltas.length >= 2
      ? r2(weekDeltas[0] + weekDeltas[1])
      : weekDeltas[0] ?? null
    const recPhase   = rec2 == null ? null
      : rec2 > threshold ? '積み上げ中' : rec2 < -threshold ? '清算中' : '横ばい'
    return { delta, week_deltas: weekDeltas, up_weeks: up, down_weeks: down, phase,
             recent_2w_delta: rec2, recent_phase: recPhase }
  }
  function maL(arr: number[], n: number): number | null {
    if (arr.length < n) return null
    return r2(arr.slice(-n).reduce((a, b) => a + b, 0) / n)
  }
  function nearKey<T>(map: Map<string, T>, date: string, maxDays = 7): T | undefined {
    if (map.has(date)) return map.get(date)
    const base = new Date(date)
    for (let delta = 1; delta <= maxDays; delta++) {
      for (const sign of [1, -1]) {
        const t = new Date(base); t.setDate(base.getDate() + sign * delta)
        const k = t.toISOString().slice(0, 10)
        if (map.has(k)) return map.get(k)
      }
    }
    return undefined
  }

  // ── データ整列とマップ ────────────────────────────
  const invS  = [...invData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const marS  = [...marData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const vixS  = [...vixData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const adS   = [...adData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const ssS   = [...ssData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const arbS  = [...arbData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const cotS  = [...cotData].sort((a, b) => b.date.localeCompare(a.date))

  const invMap  = new Map(invS.map(d => [toDate(d.date), d]))
  const marMap  = new Map(marS.map(d => [toDate(d.date), d]))
  const vixMapW = new Map(vixS.map(d => [toDate(d.date), d]))
  const adMap   = new Map(adS.map(d => [toDate(d.date), d]))
  const ssMap   = new Map(ssS.map(d => [toDate(d.date), d]))
  const arbMap  = new Map(arbS.map(d => [toDate(d.date), d]))
  const cotMap  = new Map(cotS.map(d => [d.date, d]))
  const ntMap   = new Map(ntData.map(d => [d.time, d]))

  // Daily refs (ascending → latest at tail; futuresDailyData is descending)
  const nk         = ntData.length > 0 ? ntData[ntData.length - 1] : null
  const fx         = usdjpyData.length > 0 ? usdjpyData[usdjpyData.length - 1] : null
  const nas        = nas100Data.length > 0 ? nas100Data[nas100Data.length - 1] : null
  const latestFut  = futuresDailyData[0] ?? null
  const latestVixD = vixDailyData.length > 0 ? vixDailyData[vixDailyData.length - 1] : null
  const nkCur      = nk ? nk.nikkei : null
  const nkPrices   = ntData.map(d => d.nikkei)

  // ── 外国人フロー累計 ─────────────────────────────
  const invT = (d: InvestorWeekData) => d.foreigner / 1_000_000
  const foreign4w  = r2(invS.slice(0, 4).reduce((s, d) => s + invT(d), 0))
  const foreign13w = r2(invS.slice(0, 13).reduce((s, d) => s + invT(d), 0))
  const foreign26w = r2(invS.slice(0, 26).reduce((s, d) => s + invT(d), 0))
  const rolling4w: number[] = []
  for (let i = 0; i + 3 < invS.length && i < 26; i++) {
    rolling4w.push(invS.slice(i, i + 4).reduce((s, d) => s + invT(d), 0))
  }
  const foreign4wPct = rolling4w.length > 1 ? pctRank(rolling4w.slice(1), rolling4w[0]) : 50

  // ── パーセンタイル ───────────────────────────────
  const creditRatios   = marS.slice(0, 26).map(d => d.ratio)
  const creditRatioPct = creditRatios.length > 1 ? pctRank(creditRatios.slice(1), creditRatios[0]) : 50

  const arbLongs   = arbS.slice(0, 26).map(d => d.longBal / 1_000_000)
  const arbLongPct = arbLongs.length > 1 ? pctRank(arbLongs.slice(1), arbLongs[0]) : 50

  const adRatios = adS.slice(0, 26).map(d => d.ratio25)
  const adPct    = adRatios.length > 1 ? pctRank(adRatios.slice(1), adRatios[0]) : 50

  const ssRatios = ssS.slice(0, 26).map(d => d.ratio)
  const ssPct    = ssRatios.length > 1 ? pctRank(ssRatios.slice(1), ssRatios[0]) : 50

  // 「死せる質量」= 高信用倍率 × 低騰落レシオ → やれやれ売りが上昇エネルギーを打ち消す
  const deadMassScore = Math.round((creditRatioPct + (100 - adPct)) / 2)
  const dead_mass_risk = {
    score: deadMassScore,
    credit_ratio_pct: creditRatioPct,
    ad_25d_pct: adPct,
    phase: creditRatioPct >= 80 && adPct <= 40 ? '高危険（塩漬け解消売り優位）'
         : creditRatioPct >= 70 && adPct <= 50 ? '中危険（戻り売り圧力あり）'
         : '正常範囲',
  }

  const cotLfNets = cotS.slice(0, 52).map(d => d.nonCommNet)
  const cotLfPct  = cotLfNets.length > 1 ? pctRank(cotLfNets.slice(1), cotLfNets[0]) : 50
  const cotAmNets = cotS.slice(0, 52).map(d => d.commNet)
  const cotAmPct  = cotAmNets.length > 1 ? pctRank(cotAmNets.slice(1), cotAmNets[0]) : 50

  const vixCloses52 = vixS.slice(0, 52).map(d => d.close)
  const vixPct52w   = vixCloses52.length > 1 ? pctRank(vixCloses52.slice(1), vixCloses52[0]) : 50

  const oiVals20  = futuresDailyData.slice(0, 20).map(d => d.oi)
  const oiPct20   = oiVals20.length > 1 ? pctRank(oiVals20.slice(1), oiVals20[0]) : 50
  const volVals20 = futuresDailyData.slice(0, 20).map(d => d.volume)
  const volPct20  = volVals20.length > 1 ? pctRank(volVals20.slice(1), volVals20[0]) : 50

  const latestPcrEntry = futuresDailyData.find(d => d.pcr != null)
  const latestPcr      = latestPcrEntry?.pcr ?? null
  const pcrVals20      = futuresDailyData.slice(0, 20).filter(d => d.pcr != null).map(d => d.pcr!)
  const pcrPct20       = pcrVals20.length > 1 ? pctRank(pcrVals20.slice(1), pcrVals20[0]) : 50
  const pcrSignal: 'BULL' | 'NEUTRAL' | 'BEAR' = latestPcr != null
    ? latestPcr > 0.90 ? 'BULL' : latestPcr < 0.65 ? 'BEAR' : 'NEUTRAL'
    : 'NEUTRAL'

  // ── 偏差スコア ───────────────────────────────────
  const W = 30
  const fxSeries     = usdjpyData.slice(-W).map(d => d.changePct ?? 0)
  let nasSeries: number[]
  if (nas100Data.length >= MIN_Z) {
    nasSeries = nas100Data.slice(-W).map(d => d.changePct ?? 0)
  } else if (ntData.length >= MIN_Z + 1) {
    const sl = ntData.slice(-Math.min(W + 1, ntData.length))
    nasSeries = sl.slice(1).map((d, i) =>
      sl[i].nikkei > 0 ? r2((d.nikkei - sl[i].nikkei) / sl[i].nikkei * 100) : 0
    )
  } else {
    nasSeries = []
  }
  const vixInvSeries = vixDailyData.slice(-W).map(d => d.close > 0 ? 1 / d.close : 0)
  const oiDeltas: number[] = []
  for (let i = 0; i < Math.min(W, futuresDailyData.length - 1); i++) {
    const cur = futuresDailyData[i], prev = futuresDailyData[i + 1]
    if (prev.oi > 0) oiDeltas.push((cur.oi - prev.oi) / prev.oi * 100)
  }
  const z_usdjpy  = zScore(fxSeries)
  const z_nas100  = zScore(nasSeries)
  const z_vix_inv = zScore(vixInvSeries)
  const z_oi      = zScore(oiDeltas)

  function scoreAtOffset(offsetDays: number): number | null {
    function zAt(series: number[], offset: number): number | null {
      const end = series.length - offset
      if (end < MIN_Z) return null
      return zScore(series.slice(0, end))
    }
    const zFx  = zAt(fxSeries,     offsetDays)
    const zNas = zAt(nasSeries,    offsetDays)
    const zVi  = zAt(vixInvSeries, offsetDays)
    const zOi  = zAt(oiDeltas,     offsetDays)
    const components: [number | null, number][] = [
      [zFx, 0.30], [zNas, 0.25], [zVi, 0.20], [zOi, 0.15],
    ]
    const [sum, wt] = components.reduce<[number, number]>(([s, w], [v, ww]) =>
      v != null ? [s + v * ww, w + ww] : [s, w], [0, 0])
    return wt >= 0.30 ? r2(sum / wt * wt) : null
  }
  const score_today = scoreAtOffset(0)
  const score_3d    = scoreAtOffset(3)

  // ── HV・MA・価格帯 ───────────────────────────────
  const hv20          = hvol(nkPrices, 20)
  const hv60          = hvol(nkPrices, 60)
  const vixCurClose   = vixS[0]?.close ?? latestVixD?.close ?? null
  const vixHv20Spread = vixCurClose != null && hv20 != null ? r2(vixCurClose - hv20) : null

  const nkMa5        = maL(nkPrices, 5)
  const nkMa20       = maL(nkPrices, 20)
  const nkMa60       = maL(nkPrices, 60)
  const nkMa200      = maL(nkPrices, 200)
  const nkPrices260  = nkPrices.slice(-260)
  const nkHigh52w    = nkPrices260.length > 0 ? Math.round(Math.max(...nkPrices260)) : null
  const nkLow52w     = nkPrices260.length > 0 ? Math.round(Math.min(...nkPrices260)) : null
  const nkPos52w     = nkCur != null && nkHigh52w != null && nkLow52w != null && nkHigh52w > nkLow52w
    ? r2((nkCur - nkLow52w) / (nkHigh52w - nkLow52w) * 100) : null

  // ── 価格レジーム判定（★2026-05-30 追加：需給逆張りのトレンド/レンジ ゲート用）──
  // MA60 の傾き（20営業日前との比較）＋ 価格・MA20・MA60 の並びで分類。
  // 需給シグナルがトレンドに逆らう場合の「待機」判断に使う（レンジ型エンジンの弱点対策）。
  const nkMa60Prev   = nkPrices.length > 80 ? maL(nkPrices.slice(0, nkPrices.length - 20), 60) : null
  const nkMa60Slope  = (nkMa60 != null && nkMa60Prev != null)
    ? (nkMa60 > nkMa60Prev ? 'rising' : nkMa60 < nkMa60Prev ? 'falling' : 'flat')
    : null
  let nkRegime: 'uptrend' | 'downtrend' | 'range' = 'range'
  if (nkCur != null && nkMa20 != null && nkMa60 != null) {
    if (nkCur > nkMa20 && nkMa20 > nkMa60 && nkMa60Slope === 'rising')        nkRegime = 'uptrend'
    else if (nkCur < nkMa20 && nkMa20 < nkMa60 && nkMa60Slope === 'falling')  nkRegime = 'downtrend'
    else                                                                      nkRegime = 'range'
  }

  const fxPrices = usdjpyData.map(d => d.close)
  const fxMa20   = maL(fxPrices, 20)

  // ── 先物ベーシス ─────────────────────────────────
  const futClose = latestFut?.close ?? null
  const basis    = futClose != null && nkCur != null ? r2(futClose - nkCur) : null
  const basisPct = basis != null && nkCur != null && nkCur > 0 ? r2(basis / nkCur * 100) : null

  // ── シグナルスコアボード ─────────────────────────
  type SigItem = {
    id: string; name: string; category: string; weight: number
    value: number | null; unit: string
    signal: 'BULL' | 'NEUTRAL' | 'BEAR'
    percentile?: number; note?: string
  }
  const usdjpySig: 'BULL' | 'NEUTRAL' | 'BEAR' = z_usdjpy != null
    ? (z_usdjpy > 0.8 ? 'BULL' : z_usdjpy < -0.8 ? 'BEAR' : 'NEUTRAL') : 'NEUTRAL'
  const nasSig: 'BULL' | 'NEUTRAL' | 'BEAR' = z_nas100 != null
    ? (z_nas100 > 0.8 ? 'BULL' : z_nas100 < -0.8 ? 'BEAR' : 'NEUTRAL') : 'NEUTRAL'

  const sigItems: SigItem[] = [
    { id: 'foreign_4w',   name: '外国人4週累計',   category: 'フロー',         weight: 0.25, value: foreign4w,                                         unit: '兆円', signal: sig(foreign4wPct),       percentile: foreign4wPct },
    { id: 'cot_lf_net',   name: 'HF純計(LF)',     category: 'ポジション',     weight: 0.15, value: cotS[0]?.nonCommNet ?? null,                       unit: '枚',   signal: sig(cotLfPct),            percentile: cotLfPct },
    { id: 'credit_ratio', name: '信用倍率',         category: 'ポジション',     weight: 0.15, value: marS[0]?.ratio ?? null,                           unit: '倍',   signal: sig(100 - creditRatioPct), percentile: creditRatioPct, note: '高倍率=BEAR' },
    { id: 'arb_long',     name: '裁定買い残',       category: 'ポジション',     weight: 0.10, value: arbS[0] ? r2(arbS[0].longBal / 1_000_000) : null, unit: '兆円', signal: sig(100 - arbLongPct),    percentile: arbLongPct,   note: '高残高=BEAR' },
    { id: 'ad_25d',       name: '騰落レシオ25日',   category: '市場強度',       weight: 0.08, value: adS[0]?.ratio25 ?? null,                          unit: '',     signal: sig(adPct),               percentile: adPct },
    { id: 'vix',          name: 'VIX',             category: 'ボラティリティ', weight: 0.08, value: vixCurClose,                                       unit: '',     signal: sig(100 - vixPct52w),     percentile: vixPct52w,    note: '高VIX=BEAR' },
    { id: 'short_sell',   name: '空売り比率',       category: '市場強度',       weight: 0.07, value: ssS[0]?.ratio ?? null,                            unit: '%',    signal: sig(100 - ssPct),         percentile: ssPct,        note: '高比率=BEAR' },
    { id: 'pcr',          name: 'PCR',             category: 'オプション',     weight: 0.07, value: latestPcr,                                         unit: '',     signal: pcrSignal,                percentile: pcrPct20 },
    { id: 'usdjpy_z',     name: 'USD/JPY Zスコア', category: 'マクロ',         weight: 0.05, value: z_usdjpy,                                          unit: '',     signal: usdjpySig },
  ]
  const totalW = sigItems.reduce((s, i) => s + i.weight, 0)
  let rawScore = 0
  for (const item of sigItems) rawScore += (item.signal === 'BULL' ? 1 : item.signal === 'BEAR' ? -1 : 0) * item.weight
  const compositeScore  = r2(rawScore / totalW * 100)
  const netSignal: 'BULL' | 'NEUTRAL' | 'BEAR' = compositeScore >= 20 ? 'BULL' : compositeScore <= -20 ? 'BEAR' : 'NEUTRAL'
  const bullIds    = sigItems.filter(i => i.signal === 'BULL').map(i => i.id)
  const bearIds    = sigItems.filter(i => i.signal === 'BEAR').map(i => i.id)
  const neutralIds = sigItems.filter(i => i.signal === 'NEUTRAL').map(i => i.id)

  // ── マーケットレジーム ───────────────────────────
  const vixCur = vixCurClose ?? 0
  const market_regime =
    vixCur > 30          ? '高ボラティリティ（VIX>30）' :
    vixCur > 20          ? '警戒モード（VIX 20-30）' :
    compositeScore >= 20  ? '強気相場' :
    compositeScore <= -20 ? '弱気相場' : '中立・膠着'

  // ── SQ ──────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const allSq = [...getSqDates(today.getFullYear()), ...getSqDates(today.getFullYear() + 1)]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const nextSq         = allSq.find(sq => sq.date > today)
  const days_to_sq     = nextSq ? Math.ceil((nextSq.date.getTime() - today.getTime()) / 86400000) : null
  const vix_iv_proxy   = vixDailyData.length > 0 ? vixDailyData[vixDailyData.length - 1].changePct : null
  const tpi            = days_to_sq && days_to_sq > 0 && vix_iv_proxy != null
    ? r2((1 / days_to_sq) * Math.abs(vix_iv_proxy)) : null
  const sq_rule_current =
    days_to_sq == null ? '通常運用' :
    days_to_sq === 0   ? '原則ノートレ' :
    days_to_sq <= 2    ? 'ポジション縮小' : '通常運用'

  // ── データ品質 ───────────────────────────────────
  const now_ms = Date.now()
  const freshDays = (d: string | null | undefined, maxD: number) =>
    d ? (now_ms - new Date(d).getTime()) / 86400000 < maxD : false
  const tier1 = [
    { name: '日経225',  date: nk?.time ?? null },
    { name: 'USD/JPY', date: fx?.time ?? null },
    { name: 'VIX日次', date: latestVixD?.time ?? null },
    { name: '先物OI',  date: latestFut?.date?.replace(/\//g, '-') ?? null },
    { name: 'NAS100',  date: nas?.time ?? null },
  ]
  const tier2 = [
    { name: 'PCR',       date: latestPcrEntry?.date?.replace(/\//g, '-') ?? null },
    { name: '騰落レシオ', date: adS[0] ? toDate(adS[0].date) : null },
  ]
  const tier3 = [
    { name: '投資主体別', date: invS[0] ? toDate(invS[0].date) : null },
    { name: '信用残高',   date: marS[0] ? toDate(marS[0].date) : null },
    { name: '裁定残高',   date: arbS[0] ? toDate(arbS[0].date) : null },
  ]
  const t1ok = tier1.filter(t => freshDays(t.date, 5)).length
  const t2ok = tier2.filter(t => freshDays(t.date, 10)).length
  const t3ok = tier3.filter(t => freshDays(t.date, 14)).length
  const dqScore = r2((t1ok / tier1.length) * 0.5 + (t2ok / tier2.length) * 0.3 + (t3ok / tier3.length) * 0.2)
  const staleFields = [
    ...tier1.filter(t => !freshDays(t.date, 5)).map(t => t.name),
    ...tier2.filter(t => !freshDays(t.date, 10)).map(t => t.name),
  ]

  // ── OI集積上位3日 ───────────────────────────────
  const oiHeavy3d = futuresDailyData.slice(0, 20)
    .map((d, i) => ({ date: d.date, oi: d.oi, oi_delta: futuresDailyData[i + 1] ? d.oi - futuresDailyData[i + 1].oi : 0 }))
    .sort((a, b) => Math.abs(b.oi_delta) - Math.abs(a.oi_delta))
    .slice(0, 3)

  // ── 週次ヒストリー（26週） ───────────────────────
  const allWeeklyDates = new Set([
    ...invS.map(d => toDate(d.date)),
    ...marS.map(d => toDate(d.date)),
    ...adS.map(d => toDate(d.date)),
    ...ssS.map(d => toDate(d.date)),
    ...arbS.map(d => toDate(d.date)),
  ])
  const weeklyDates = Array.from(allWeeklyDates).sort((a, b) => b.localeCompare(a)).slice(0, EXPORT_WEEKS)
  const weekly_history = weeklyDates.map(date => {
    const inv  = nearKey(invMap, date)
    const mar  = nearKey(marMap, date)
    const ad   = nearKey(adMap,  date)
    const ss   = nearKey(ssMap,  date)
    const arb  = nearKey(arbMap, date)
    const vixW = findVixForDate(vixMapW, date)
    const cot  = nearKey(cotMap, date, 7)
    const nt   = findNtForDate(ntMap, date)
    return {
      date,
      nk_close:        nt   ? Math.round(nt.nikkei)        : null,
      vix:             vixW ? vixW.close                    : null,
      foreign_net_t:   inv  ? r2(inv.foreigner / 1_000_000) : null,
      credit_ratio:    mar  ? mar.ratio                     : null,
      credit_eval_pct: mar  ? mar.evalRatio                 : null,
      credit_long_t:   mar  ? r2(mar.longBal  / 1_000_000) : null,
      credit_data_as_of: mar ? toDate(mar.date)             : null,
      arb_long_t:      arb  ? r2(arb.longBal  / 1_000_000) : null,
      cot_lf_net:      cot  ? cot.nonCommNet                : null,
      cot_am_net:      cot  ? cot.commNet                   : null,
      cot_oi:          cot  ? cot.openInterest              : null,
      ad_25d:          ad   ? ad.ratio25                    : null,
      ss_ratio:        ss   ? ss.ratio                      : null,
    }
  })

  // ── SQ重力加速度（信用買い残のSQ向け方向性）─────────────
  // SQサイクル≒4週。直近4週の信用倍率・買い残トレンドで清算/積み上げ圧力を数値化
  const SQ_GRAVITY_WEEKS = 4
  const gravWin = weekly_history.slice(0, Math.min(SQ_GRAVITY_WEEKS + 1, weekly_history.length))
  const gravRatioVals = gravWin.map(w => w.credit_ratio).filter((v): v is number => v !== null)
  const gravLongVals  = gravWin.map(w => w.credit_long_t).filter((v): v is number => v !== null)
  const gravRatio = trendCalc(gravRatioVals, 0.1)
  const gravLong  = trendCalc(gravLongVals,  0.05)
  // pressure_phase は直近2週（recent_phase）を優先し、過去の大変動バイアスを排除
  const gravScoreR = gravRatio ? (gravRatio.recent_phase === '積み上げ中' ? 1 : gravRatio.recent_phase === '清算中' ? -1 : 0) : 0
  const gravScoreL = gravLong  ? (gravLong.recent_phase  === '積み上げ中' ? 1 : gravLong.recent_phase  === '清算中' ? -1 : 0) : 0
  const gravScore  = gravScoreR + gravScoreL
  const sq_gravity = {
    window_weeks:    gravWin.length - 1,
    credit_ratio:    gravRatio,
    credit_long_t:   gravLong,
    pressure_phase:
      gravScore >=  1 ? '積み上げ優勢（SQ後にエネルギー放出リスク）' :
      gravScore <= -1 ? '清算優勢（SQ前にエネルギー放出中）'         :
                        '混合・横ばい（方向性不明確）',
  }

  // ── TEV（トータル物理エネルギーベクトル）計算 ───────────
  const tev_V       = score_today != null ? r2(score_today * 100) : null
  const tev_A       = score_today != null && score_3d != null ? r2((score_today - score_3d) * 100) : null
  const tev_pCredit = creditRatioPct
  const tev_pShort  = 100 - ssPct

  let tev_fBase:        number | null = null
  let tev_fInertia:     number | null = null
  let tev_decay                       = 1.0
  const tev_decayReasons: string[]    = []
  let tev_rResist:      number | null = null
  let tev_value:        number | null = null
  let tev_status:       string | null = null
  let tev_confidence:   number | null = null

  if (tev_V != null && tev_A != null) {
    tev_fBase              = r2((0.3 * tev_V) + (0.7 * tev_A))
    const tev_fInertiaRaw  = r2(tev_fBase * (foreign4wPct / 100))

    // 天井の失速: V > 0 かつ A ≤ 0 → ×0.25
    // ※減衰理由は出力にそのまま載るため、英語変数名・数式記号を使わず日本語で記述する（出力制約②対応）
    if (tev_V > 0 && tev_A <= 0) {
      tev_decay *= 0.25
      tev_decayReasons.push('天井の失速（上昇速度はあるが加速度が頭打ち）→75%減衰')
    }
    // 燃料漏れ: COT BEAR → ×0.5
    if (sig(cotLfPct) === 'BEAR') {
      tev_decay *= 0.5
      tev_decayReasons.push('燃料漏れ（ヘッジファンドのネットが売り越し方向）→50%減衰')
    }
    // 燃料漏れ: 先物volume 直近3日連続減少 → ×0.5
    if (futuresDailyData.length >= 3) {
      const [fv0, fv1, fv2] = [futuresDailyData[0].volume, futuresDailyData[1].volume, futuresDailyData[2].volume]
      if (fv0 < fv1 && fv1 < fv2) {
        tev_decay *= 0.5
        tev_decayReasons.push('燃料漏れ（先物の出来高が3日連続減少）→50%減衰')
      }
    }

    tev_fInertia = r2(tev_fInertiaRaw * tev_decay)

    // R_resistance（弾性・両側）: 中立点(P_credit=50, P_short=50 → 和=100)をゼロに
    // 再センタリングし、上下両方向に効く本物の復元力にする（v2-symmetric-restoring）。
    //   信用買い残厚い＋空売り薄い → signedLoad>0 → 戻り売りの重し（下押し）
    //   信用買い残薄い＋空売り厚い → signedLoad<0 → 踏み上げバネ（上押し）
    // 旧式 -8×√(P_credit+P_short) は中立でも−80の恒常ドラッグが残りBULLを構造的に出せなかった。
    const signedLoad = (tev_pCredit + tev_pShort) - 100   // −100..+100, 中立=0
    tev_rResist = r2(-8 * Math.sign(signedLoad) * Math.sqrt(Math.abs(signedLoad)))

    if (tev_rResist != null) {
      tev_value = Math.round(tev_fInertia + tev_rResist)

      // 底打ち反転: 直近10日安値圏（安値の1.02倍以内）かつ A ≥ +50
      const lows10d  = nkFuturesPriceData.slice(0, 10).map(d => d.low).filter(v => v > 0)
      const low10d   = lows10d.length > 0 ? Math.min(...lows10d) : null
      const is10dLow = low10d != null && nkCur != null && nkCur <= low10d * 1.02

      // ステータス判定（優先順位: 底打ち反転 > 慣性航行中 > 真空落下 > 重力反転中 > 限界膨張）
      if (tev_value >= -24 && tev_A >= 50 && is10dLow) {
        tev_status = '底打ち反転'
      } else if (tev_value >= 25 && tev_A > 0) {
        tev_status = '慣性航行中'
      } else if (tev_value <= -25 && tev_A < 0) {
        tev_status = '真空落下'
      } else if (tev_value <= -25 && tev_A >= 0) {
        tev_status = '重力反転中'
      } else if (tev_value >= 25) {
        tev_status = '限界膨張（慣性失速）'
      } else {
        tev_status = '限界膨張'
      }

      // 確信度: 限界膨張系は50%固定
      tev_confidence = tev_status.startsWith('限界膨張')
        ? 50
        : Math.min(95, Math.round(Math.abs(compositeScore) * 0.5 + 50))
    }
  }

  // ── TEV 整合性検証 ───────────────────────────────
  const tev_sanityWarnings: string[] = []

  // 価格基準日チェック: 1営業日差は構造的制限（市場時間中は当日終値が未確定／MA基準は米国市場ゲートで
  // 先物JSTより1営業日遅れる）→ 2営業日以上の乖離のみ警告。
  // カレンダー日数だと週末を挟む月曜(金曜 vs 月曜=3カレンダー日)で毎週誤発火するため営業日数で測る。
  const ntBaseDate  = nk?.time ?? null
  // 出来高0の未確定バー（当日ザラ場）は確定値でないため、最新の「確定済み」バー（volume>0）を採用する。
  // これにより price_as_of と MA乖離の基準日が一致し、「6/02終値ベース」表示なのに ma25_dev が
  // 6/03ザラ場値（8.18）になる不整合を防ぐ（Yahoo の当日未確定バー対策）。
  const nkFutConfirmed = nkFuturesPriceData.find(d => d.volume != null && d.volume > 0) ?? nkFuturesPriceData[0] ?? null
  const futLatDate  = nkFutConfirmed?.date  ?? null
  const futLatClose = nkFutConfirmed?.close ?? null
  const daysDiff    = ntBaseDate && futLatDate
    ? businessDaysBetween(new Date(ntBaseDate).getTime(), new Date(futLatDate).getTime())
    : 0
  if (daysDiff >= 2) {
    tev_sanityWarnings.push(
      `価格データ陳腐化: MA計算基準=${ntBaseDate} 先物JSON最新=${futLatDate}（${daysDiff}営業日乖離）。静的JSONの更新失敗の可能性あり`
    )
  }
  // 価格急変動チェック: ≥3%のみ（1-2%の日中変動は構造的なため除外）
  if (nkCur && futLatClose) {
    const priceDiffPct = (futLatClose - nkCur) / nkCur * 100
    if (Math.abs(priceDiffPct) >= 3.0) {
      const sign = priceDiffPct > 0 ? '+' : ''
      tev_sanityWarnings.push(
        `価格急変動: 前日終値=${futLatClose} 現在値≈${Math.round(nkCur)}（${sign}${r2(priceDiffPct)}%）。急変動のためMA乖離率を参考値として扱うこと`
      )
    }
  }

  // USD/JPY 鮮度チェック
  const fxLatDate = usdjpyData.length > 0 ? usdjpyData[usdjpyData.length - 1].time : null
  if (fxLatDate && ntBaseDate && fxLatDate < ntBaseDate) {
    tev_sanityWarnings.push(
      `USD/JPY 鮮度注意: 最新データ=${fxLatDate}（基準日${ntBaseDate}より古い）。z_usdjpy（偏差スコアの30%重み）が古い終値ベースの可能性あり`
    )
  }

  if (tev_value !== null && tev_rResist !== null && tev_status !== null && tev_confidence !== null) {
    // R_resistance は両側に効く（signedLoad<0=踏み上げバネで正値もとる）→ 符号チェックは廃止（v2）
    // decay_factor は 0〜1.0 の範囲
    if (tev_decay < 0 || tev_decay > 1.0)
      tev_sanityWarnings.push(`decay_factor範囲外（${r2(tev_decay)}）`)
    // 限界膨張系は confidence 50% 固定
    if (tev_status.startsWith('限界膨張') && tev_confidence !== 50)
      tev_sanityWarnings.push(`限界膨張だがconfidence≠50（実値: ${tev_confidence}）`)
    // ステータスと tev/A の値域整合
    if (tev_status === '慣性航行中' && !(tev_value >= 25 && tev_A != null && tev_A > 0))
      tev_sanityWarnings.push(`慣性航行中だがTEV/A条件不一致（tev=${tev_value} A=${tev_A}）`)
    if (tev_status === '真空落下'   && !(tev_value <= -25 && tev_A != null && tev_A < 0))
      tev_sanityWarnings.push(`真空落下だがTEV/A条件不一致（tev=${tev_value} A=${tev_A}）`)
    if (tev_status === '重力反転中' && !(tev_value <= -25 && tev_A != null && tev_A >= 0))
      tev_sanityWarnings.push(`重力反転中だがTEV/A条件不一致（tev=${tev_value} A=${tev_A}）`)
  }
  const tev_sanityOk: boolean | null = tev_value === null ? null : tev_sanityWarnings.length === 0
  const confidence_pct_is_fixed      = tev_status !== null && tev_status.startsWith('限界膨張')

  // ── 需給×価格の2軸セル（computeTEV非依存の導出層）──
  // 価格(regime)と需給(TEV符号)を1つに潰さず「交点」で読む＝「束ねるな、地図にしろ」。
  // 「真空落下」なのに価格は高値圏…という名前と値の食い違いを、セル名で一目で解消する。
  let supply_price_cell: { label: string; price_axis: string; demand_axis: string; note: string } | null = null
  if (tev_value != null) {
    const demandUp = tev_value > 5, demandDown = tev_value < -5
    const pAxis = nkRegime === 'uptrend' ? '上昇' : nkRegime === 'downtrend' ? '下落' : 'レンジ'
    const dAxis = demandUp ? '需給は買い' : demandDown ? '需給は脆弱/売り' : '需給は中立'
    let label: string, note: string
    if (nkRegime === 'uptrend' && demandDown)        { label = 'メルトアップ（脆弱な上昇）';       note = '価格は上げるが需給が伴わない。追わず守り、反転に備える（本命ベアは価格がトレンドを割ってから）' }
    else if (nkRegime === 'uptrend' && demandUp)     { label = '順行ブル（追随）';               note = '価格・需給が一致。トレンド追随の本領' }
    else if (nkRegime === 'downtrend' && demandUp)   { label = '売られすぎ（落ちるナイフ注意）';   note = '需給は買いだが価格は下落トレンド。落ちるナイフを避け、反転確認まで待つ' }
    else if (nkRegime === 'downtrend' && demandDown) { label = '順行ベア（追随）';               note = '価格・需給が一致。下落追随の対象' }
    else                                             { label = 'レンジ（需給逆張りの本領）';     note = '明確なトレンドなし。需給逆張りが最も効く局面' }
    supply_price_cell = { label, price_axis: pAxis, demand_axis: dAxis, note }
  }

  // ── 組立 ─────────────────────────────────────────
  const generated_at = new Date().toISOString().slice(0, 19).replace('T', ' ')

  return {
    generated_at,

    instant_briefing: {
      date:            nk?.time ?? generated_at.slice(0, 10),
      nikkei225:       nkCur ? Math.round(nkCur) : null,
      usdjpy:          fx?.close ?? null,
      vix:             vixCurClose,
      nas100:          nas ? { close: nas.close, change_pct: nas.changePct, signal: nasSig } : null,
      market_regime,
      bull_signals:    bullIds,
      bear_signals:    bearIds,
      neutral_signals: neutralIds,
      net_signal:      netSignal,
      composite_score: compositeScore,
      data_quality:    dqScore,
      sq_rule:         sq_rule_current,
      days_to_sq,
    },

    flows: {
      foreign: {
        latest_week_t:       invS[0] ? r2(invT(invS[0]))    : null,
        cumulative_trillion: { w4: foreign4w, w13: foreign13w, w26: foreign26w },
        percentile_4w_vs26w: foreign4wPct,
        signal:              sig(foreign4wPct),
        as_of:               invS[0] ? toDate(invS[0].date) : null,
      },
      cot: {
        as_of:          cotS[0]?.date ?? null,
        open_interest:  cotS[0]?.openInterest ?? null,
        leveraged_funds: {
          net:   cotS[0]?.nonCommNet   ?? null,
          long:  cotS[0]?.nonCommLong  ?? null,
          short: cotS[0]?.nonCommShort ?? null,
          percentile_52w: cotLfPct,
          signal: sig(cotLfPct),
        },
        asset_manager: {
          net:   cotS[0]?.commNet   ?? null,
          long:  cotS[0]?.commLong  ?? null,
          short: cotS[0]?.commShort ?? null,
          percentile_52w: cotAmPct,
          signal: sig(cotAmPct),
        },
      },
    },

    positioning: {
      credit_margin: {
        ratio:               marS[0]?.ratio     ?? null,
        eval_ratio_pct:      marS[0]?.evalRatio ?? null,
        long_bal_t:          marS[0] ? r2(marS[0].longBal  / 1_000_000) : null,
        short_bal_t:         marS[0] ? r2(marS[0].shortBal / 1_000_000) : null,
        ratio_percentile_26w: creditRatioPct,
        signal:              sig(100 - creditRatioPct),
        as_of:               marS[0] ? toDate(marS[0].date) : null,
        dead_mass_risk,
      },
      arbitrage: {
        long_bal_t:     arbS[0] ? r2(arbS[0].longBal  / 1_000_000) : null,
        short_bal_t:    arbS[0] ? r2(arbS[0].shortBal / 1_000_000) : null,
        percentile_26w: arbLongPct,
        signal:         sig(100 - arbLongPct),
        as_of:          arbS[0] ? toDate(arbS[0].date) : null,
        daily_recent:   arbDailyData.slice(0, 5).map(d => ({
          date:       d.date,
          long_bal_t: r2(d.longBal / 1_000_000),
          delta_100m: d.longBalDelta != null ? Math.round(d.longBalDelta / 100) : null,
        })),
      },
    },

    futures: {
      oi:                    latestFut?.oi     ?? null,
      oi_percentile_20d:     oiPct20,
      volume:                latestFut?.volume ?? null,
      volume_percentile_20d: volPct20,
      pcr:                   latestPcr,
      pcr_percentile_20d:    pcrPct20,
      pcr_signal:            pcrSignal,
      close:                 futClose,
      basis,
      basis_pct:             basisPct,
      as_of:                 latestFut?.date ?? null,
      oi_heavy_3d:           oiHeavy3d,
      recent_10d:            futuresDailyData.slice(0, 10).map((d, i) => {
        const prev = futuresDailyData[i + 1]
        return {
          date:     d.date,
          oi:       d.oi,
          oi_delta: prev ? d.oi - prev.oi : null,
          volume:   d.volume,
          pcr:      d.pcr ?? null,
          close:    d.close ?? null,
        }
      }),
      // NK=F (CME 日経225先物・円建て連続限月) 直近10取引日 OHLCV
      nk_futures_ohlcv_10d:  [...nkFuturesPriceData].reverse(),
    },

    breadth: {
      advance_decline_25d: {
        value:          adS[0]?.ratio25 ?? null,
        percentile_26w: adPct,
        signal:         sig(adPct),
        as_of:          adS[0] ? toDate(adS[0].date) : null,
      },
      short_sell: {
        value:          ssS[0]?.ratio ?? null,
        percentile_26w: ssPct,
        signal:         sig(100 - ssPct),
        as_of:          ssS[0] ? toDate(ssS[0].date) : null,
      },
      nt_ratio: {
        value:      nk ? r2(nk.ratio) : null,
        wow_change: nk?.change ?? null,
        as_of:      nk?.time  ?? null,
      },
    },

    volatility: {
      vix: {
        daily:  latestVixD ? { date: latestVixD.time, close: latestVixD.close, change_pct: latestVixD.changePct } : null,
        weekly: vixS[0] ? {
          date:           toDate(vixS[0].date),
          close:          vixS[0].close,
          change_pct:     vixS[0].changePct,
          percentile_52w: vixPct52w,
          signal:         sig(100 - vixPct52w),
          regime:         vixCur > 30 ? '恐慌' : vixCur > 20 ? '警戒' : '平常',
        } : null,
      },
      hv: {
        hv20_annualized_pct: hv20,
        hv60_annualized_pct: hv60,
        vix_hv20_spread:     vixHv20Spread,
        interpretation:      vixHv20Spread != null
          ? vixHv20Spread > 5  ? 'VIXプレミアム高・オプション割高'
          : vixHv20Spread < -2 ? 'リアライズドVol高・市場不安定'
          : '適正レンジ'
          : null,
      },
    },

    price_structure: {
      price_as_of:   ntBaseDate ?? futLatDate,
      price_basis:   '前営業日終値基準（市場時間中は当日終値未確定）',
      nikkei225: {
        ma5:           nkMa5,
        ma20:          nkMa20,
        ma60:          nkMa60,
        ma200:         nkMa200,
        ma5_dev_pct:   nkMa5  && nkCur ? r2((nkCur - nkMa5)  / nkMa5  * 100) : null,
        ma20_dev_pct:  nkMa20 && nkCur ? r2((nkCur - nkMa20) / nkMa20 * 100) : null,
        // 25日線乖離率（日本株の定番過熱指標）。先物日足の最新終値基準で全系列から算出済みの値を引用。
        // 目安: ±5%=注意 / ±7%以上=過熱(+)・過冷(-)。±5%未満は中立。
        ma25_dev_pct:  nkFutConfirmed?.ma25_dev ?? null,
        ma60_dev_pct:  nkMa60 && nkCur ? r2((nkCur - nkMa60) / nkMa60 * 100) : null,
        high_52w:      nkHigh52w,
        low_52w:       nkLow52w,
        pos_in_52w_pct: nkPos52w,
        ma60_slope:    nkMa60Slope,
        regime:        nkRegime,
        regime_note:   'uptrend/downtrend=明確なトレンド（需給逆張りの本命エントリーは見送り推奨）/ range=レンジ（需給逆張りの本領）',
      },
      usdjpy: {
        ma20_dev_pct:  fxMa20 && fx ? r2((fx.close - fxMa20) / fxMa20 * 100) : null,
        z_score_30d:   z_usdjpy,
        signal:        usdjpySig,
      },
      nas100: {
        z_score_30d:   z_nas100,
        signal:        nasSig,
      },
    },

    deviation_score: {
      z_usdjpy,
      z_nas100,
      z_vix_inv,
      z_oi,
      score:       score_today,
      acc:         score_today != null && score_3d != null ? r2(score_today - score_3d) : null,
      window_days: W,
    },

    tev_analysis: {
      note:                  'tev_for_execution=nullなら定性バックアップモード。sanity_ok=true時のみtev値を執行根拠に使用可',
      tev:                   tev_value,
      tev_for_execution:     tev_sanityOk === true ? tev_value : null,
      status:                tev_status,
      confidence_pct:        tev_confidence,
      confidence_pct_is_fixed: confidence_pct_is_fixed,
      decay_factor:          r2(tev_decay),
      decay_reasons:         tev_decayReasons,
      sanity_ok:             tev_sanityOk,
      sanity_warnings:       tev_sanityWarnings,
    },

    supply_price_cell,

    events: {
      sq: {
        next_date:      nextSq ? nextSq.date.toISOString().slice(0, 10) : null,
        next_type:      nextSq?.type ?? null,
        days_remaining: days_to_sq,
        rule:           sq_rule_current,
        tpi,
        iv_proxy:       vix_iv_proxy,
        gravity:        sq_gravity,
      },
      scheduled_28d: getUpcomingEvents(28),
    },

    data_quality: {
      score:        dqScore,
      tier1_daily:  { ok: t1ok, total: tier1.length },
      tier2_semi:   { ok: t2ok, total: tier2.length },
      tier3_weekly: { ok: t3ok, total: tier3.length },
      stale_fields: staleFields,
    },

    weekly_history,

    internal_structure: (() => {
      if (!stocksDailyData) return null
      const absTotal  = Math.abs(stocksDailyData.contribution.total)
      const up5       = stocksDailyData.contribution.up
      const down5     = stocksDailyData.contribution.down
      const netTop10  = Math.round([...up5, ...down5].reduce((s, x) => s + x.contribution, 0) * 100) / 100
      const advCount  = stocksDailyData.sector.advanceSectorCount ?? null
      const dnCount   = stocksDailyData.sector.declineSectorCount ?? null
      const totalSec  = (advCount ?? 0) + (dnCount ?? 0)
      const breadth   = totalSec > 0 ? Math.round((advCount! - dnCount!) / totalSec * 100) / 100 : null
      const mkWeight  = (c: number) => absTotal > 0 ? Math.round(Math.abs(c) / absTotal * 1000) / 10 : null
      return {
        as_of: stocksDailyData.updatedAt.slice(0, 10),
        top_contributors: {
          bullish: up5.map(x => ({ code: x.code, name: x.name, contribution: x.contribution, weight_pct: mkWeight(x.contribution) })),
          bearish: down5.map(x => ({ code: x.code, name: x.name, contribution: x.contribution, weight_pct: mkWeight(x.contribution) })),
          net_contribution_top10: netTop10,
          concentration_ratio: absTotal > 0 ? Math.round(Math.abs(netTop10) / absTotal * 100) / 100 : null,
        },
        sector_performance: {
          top_gainers: stocksDailyData.sector.up.map(x => ({ sector: x.name, change_pct: x.changePct })),
          top_losers:  stocksDailyData.sector.down.map(x => ({ sector: x.name, change_pct: x.changePct })),
          advance_sector_count: advCount,
          decline_sector_count: dnCount,
          breadth_score: breadth,
        },
      }
    })(),
  }
}

export type EngineExport = ReturnType<typeof buildExportJson>
