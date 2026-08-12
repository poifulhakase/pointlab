// ── プレビューモードの需給データ（ダミー）────────────────────────────────
// 🔴 プレビューでは**需給の実数値を出さない**（2026-08-12 ユーザー指示）。
//    信用倍率・投資主体別売買動向・裁定残・騰落レシオ・空売り比率・寄与度は
//    ここで作った「それらしい」数字に差し替える。
//
// 🔵 作り方の決め事:
//   ① **乱数を使わない**（`seeded` の疑似乱数）。同じ画面を開き直すたびに数字が変わると
//      「壊れている」ように見えるため、いつ・何度呼んでも同じ並びになるようにする。
//   ② 日付は**今日から遡って作る**＝いつ見せても「先週まで」のデータに見える。
//   ③ 数字の桁と符号は実物に寄せる（百万円・倍・%）。桁が違うと画面の幅が崩れる。
import type { InvestorWeekData } from './jpxInvestorData'
import type { MarginWeekData } from './jpxMarginData'
import type { ShortSellWeekData } from './shortSellData'
import type { AdvanceDeclineWeekData } from './advanceDeclineData'
import type { ArbitrageWeekData, ArbitrageDayData } from './arbitrageData'
import type { StocksDailyData } from './stocksDailyData'

/** 決まった並びの疑似乱数（0〜1）。seed が同じなら毎回同じ列になる。 */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** 週の金曜日を、新しい順に n 週ぶん。 */
function weekFridays(n: number): Date[] {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  // 直近の金曜まで戻す（週次データは金曜締め）
  base.setDate(base.getDate() - ((base.getDay() + 2) % 7))
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - i * 7)
    return d
  })
}

function slashDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 「7月第5週」。第n週は「その月の何回目の同じ曜日か」で数える（実データと同じ数え方）。 */
function weekLabel(d: Date): string {
  return `${d.getMonth() + 1}月第${Math.ceil(d.getDate() / 7)}週`
}

const WEEKS = 30

export function previewInvestor(): InvestorWeekData[] {
  const r = seeded(101)
  return weekFridays(WEEKS).map(d => {
    const foreigner = Math.round((r() - 0.5) * 24000)
    const individual = Math.round((r() - 0.5) * 16000)
    const trustBank = Math.round((r() - 0.5) * 9000)
    return {
      date: slashDate(d),
      label: weekLabel(d),
      foreigner,
      individual,
      trustBank,
      // 🔵 差引の合計がゼロに近づくよう、証券自己で受ける（実物もそういう性質）
      securities: -Math.round((foreigner + individual + trustBank) * 0.6),
    }
  })
}

export function previewMargin(): MarginWeekData[] {
  const r = seeded(202)
  return weekFridays(WEEKS).map(d => {
    const longBal = Math.round(6_000_000 + r() * 1_200_000)
    const shortBal = Math.round(650_000 + r() * 420_000)
    return {
      date: slashDate(d),
      label: weekLabel(d),
      longBal,
      shortBal,
      ratio: Math.round((longBal / shortBal) * 100) / 100,
      evalRatio: Math.round((-12 + r() * 14) * 100) / 100,
    }
  })
}

export function previewShortSell(): ShortSellWeekData[] {
  const r = seeded(303)
  return weekFridays(WEEKS).map(d => ({
    date: slashDate(d),
    label: weekLabel(d),
    ratio: Math.round((28 + (r() - 0.5) * 16) * 10) / 10,
  }))
}

export function previewAdvanceDecline(): AdvanceDeclineWeekData[] {
  const r = seeded(404)
  return weekFridays(WEEKS).map(d => {
    const advances = Math.round(700 + r() * 700)
    return {
      date: slashDate(d),
      label: weekLabel(d),
      ratio25: Math.round((90 + (r() - 0.4) * 60) * 10) / 10,
      advances,
      declines: 1650 - advances,
    }
  })
}

export function previewArbitrage(): ArbitrageWeekData[] {
  const r = seeded(505)
  return weekFridays(WEEKS).map(d => ({
    date: slashDate(d),
    label: weekLabel(d),
    longBal: Math.round(2_200_000 + r() * 700_000),
    shortBal: Math.round(20_000 + r() * 380_000),
  }))
}

export function previewArbitrageDaily(): ArbitrageDayData[] {
  const r = seeded(606)
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  let bal = 2_500_000
  const out: ArbitrageDayData[] = []
  for (let i = 0; i < 40; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue   // 休場日は作らない
    const delta = Math.round((r() - 0.5) * 90_000)
    out.push({ date: isoDate(d), longBal: bal, longBalDelta: delta })
    bal -= delta
  }
  return out
}

/** 日経平均の寄与度・業種別騰落率・先物日足（プレビュー用）。 */
export function previewStocksDaily(): StocksDailyData {
  const r = seeded(707)
  const up = [
    { code: '0001', name: 'サンプル電子', sector: '電気機器' },
    { code: '0002', name: 'サンプル商事', sector: '卸売業' },
    { code: '0003', name: 'サンプル精密', sector: '精密機器' },
    { code: '0004', name: 'サンプル化学', sector: '化学' },
    { code: '0005', name: 'サンプル機械', sector: '機械' },
  ].map((s, i) => ({ ...s, contribution: Math.round((420 - i * 80 + r() * 40) * 100) / 100 }))

  const down = [
    { code: '0006', name: 'サンプル通信', sector: '情報・通信業' },
    { code: '0007', name: 'サンプル小売', sector: '小売業' },
    { code: '0008', name: 'サンプル銀行', sector: '銀行業' },
    { code: '0009', name: 'サンプル食品', sector: '食料品' },
    { code: '0010', name: 'サンプル運輸', sector: '陸運業' },
  ].map((s, i) => ({ ...s, contribution: -Math.round((60 - i * 9 + r() * 12) * 100) / 100 }))

  const sectorUp = ['サービス業', '海運業', '精密機器', '非鉄金属', '鉱業']
    .map((name, i) => ({ name, changePct: Math.round((8.5 - i * 1.3 + r()) * 100) / 100 }))
  const sectorDown = ['石油・石炭製品', '保険業', '電気・ガス業', '陸運業', '医薬品']
    .map((name, i) => ({ name, changePct: -Math.round((3.6 - i * 0.5 + r() * 0.6) * 100) / 100 }))

  // 先物日足（60営業日ぶん・25日線乖離も付ける）
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const days: StocksDailyData['nkFutures'] = []
  let close = 41_800
  for (let i = 0; i < 90 && days.length < 60; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const prev = close
    close = Math.round(close * (1 + (r() - 0.5) * 0.018))
    days.push({
      date: isoDate(d),
      open: prev,
      high: Math.max(prev, close) + 120,
      low: Math.min(prev, close) - 140,
      close,
      volume: Math.round(30_000 + r() * 20_000),
      prev_close: prev,
      change: close - prev,
      change_pct: Math.round(((close - prev) / prev) * 10000) / 100,
    })
  }
  days.reverse()

  return {
    contribution: { up, down, total: Math.round(up.concat(down).reduce((s, x) => s + x.contribution, 0) * 100) / 100 },
    sector: { up: sectorUp, down: sectorDown, advanceSectorCount: 21, declineSectorCount: 12 },
    nkFutures: days,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * キャッシュキー → ダミー。ここに無いキーは実データのまま流す。
 * 🔵 キーは各 `fetch*Data()` が使っているものと同じ文字列（`dataCache.ts` の一覧が正）。
 */
export const PREVIEW_BY_CACHE_KEY: Record<string, () => unknown> = {
  'poical-investor-data':        previewInvestor,
  'poical-margin-data-v2':       previewMargin,
  'poical-short-sell-data':      previewShortSell,
  'poical-ad-ratio-data':        previewAdvanceDecline,
  'poical-arbitrage-data':       previewArbitrage,
  'poical-arbitrage-daily-data': previewArbitrageDaily,
  'poical-stocks-daily-v3':      previewStocksDaily,
}
