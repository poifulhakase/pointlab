import type { MarginWeekData } from './jpxMarginData'
import type { ArbitrageWeekData } from './arbitrageData'
import type { ShortSellWeekData } from './shortSellData'
import type { AdvanceDeclineWeekData } from './advanceDeclineData'
import type { NkFuturesDayData } from './nkFuturesPriceData'

/**
 * ブンセキの「結論」を組み立てる（純粋関数・2026-08-22 新設）。
 *
 * 🔴 **予測は書かない。** 2026-08-22 の全面検証で、価格・チャートの形・需給・米国市場の
 *    いずれも「翌日の方向」を当てられないことを確認した（材料5種・規則20以上・全部却下）。
 *    したがってここで出すのは**いまの位置**だけで、「上がる／下がる」は書かない。
 *
 * 🔴 **却下された読みは書かない。** 同日の検証で否定されたもの＝
 *    「下ヒゲが長い＝セリクラ＝買い」（期待値 −0.07%）／
 *    「買残が積み上がる＝上値が重い＝売り」（指数では符号が逆）／
 *    「200日線を割ったら逃げる」（DDが0.35ポイントしか減らない）。
 *    これらを示唆する文言は出さない。
 *
 * 🔵 言い方は**状態 ＋ 歴史的な位置（分位）**に統一する（運用者の指定・2026-08-22）。
 *    分位は「いまがどのへんか」の記述であって将来の主張ではないので、
 *    期間依存（測る期間で結論が反転する問題）の影響を受けにくい。
 */

export type StanceLine = {
  /** 「価格」「形」「需給」 */
  label: string
  /** 1行で言い切る本文 */
  text: string
}

export type MarketStance = {
  /** 結論（1行）。状態＋歴史的な位置 */
  headline: string
  /** 3本の柱 */
  lines: StanceLine[]
  /** 規律として気をつけること（予測ではない） */
  cautions: string[]
  /** いつ時点か（いちばん古い材料の日付＝ここまでしか分かっていない） */
  asOf: string | null
}

/** 配列の中で v が何%の位置にいるか（0=最小・100=最大）。 */
export function percentile(values: number[], v: number): number | null {
  const xs = values.filter(x => Number.isFinite(x))
  if (xs.length < 8) return null // 標本が少なすぎるときは黙る
  return Math.round((xs.filter(x => x <= v).length / xs.length) * 1000) / 10
}

/** 分位を日本語にする。🔵 「高い＝良い」とは言わない（良し悪しの判断を混ぜない）。 */
export function rankWord(p: number | null): string {
  if (p == null) return '判断できる材料がありません'
  if (p >= 90) return '過去1年で最も高い水準'
  if (p >= 70) return `高め（上位${Math.round(100 - p)}%）`
  if (p > 30) return '中くらい'
  if (p > 10) return `低め（下位${Math.round(p)}%）`
  return '過去1年で最も低い水準'
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export type StanceInput = {
  margin: MarginWeekData[]
  arbitrage: ArbitrageWeekData[]
  shortSell: ShortSellWeekData[]
  advanceDecline: AdvanceDeclineWeekData[]
  price: NkFuturesDayData[]
}

/**
 * 🔴 配列は**新しい順**で渡ってくる前提（画面の表と同じ並び）。
 */
export function buildMarketStance(input: StanceInput): MarketStance | null {
  const { margin, arbitrage, shortSell, advanceDecline, price } = input
  if (margin.length === 0 && price.length === 0) return null

  const lines: StanceLine[] = []
  const cautions: string[] = []
  const dates: string[] = []

  // ── 価格（いまどこにいるか）──────────────────────────────
  let pricePos: number | null = null
  if (price.length >= 25) {
    const closes = price.map(d => d.close).filter(num)
    const last = closes[0]
    const ma25 = closes.slice(0, 25).reduce((s, v) => s + v, 0) / 25
    const dev = ((last / ma25) - 1) * 100
    const win = price.slice(0, 20)
    const hi = Math.max(...win.map(d => d.high).filter(num))
    const lo = Math.min(...win.map(d => d.low).filter(num))
    pricePos = hi > lo ? ((last - lo) / (hi - lo)) * 100 : 50
    dates.push(price[0].date)
    lines.push({
      label: '価格',
      text: `25日線から ${dev >= 0 ? '+' : ''}${dev.toFixed(1)}% ／ 直近20日の値幅の ${Math.round(pricePos)}% の位置`,
    })
  }

  // ── 形（どういう経路で来たか）─────────────────────────────
  if (price.length >= 20) {
    const recent = price.slice(0, 10)
    const before = price.slice(10, 20)
    const hiUp = Math.max(...recent.map(d => d.high)) > Math.max(...before.map(d => d.high))
    const loUp = Math.min(...recent.map(d => d.low)) > Math.min(...before.map(d => d.low))
    const shape = hiUp && loUp ? '高値も安値も切り上げ' : (!hiUp && !loUp ? '高値も安値も切り下げ' : '高安が揃っていない（もみ合い）')
    const d0 = price[0]
    const range = d0.high - d0.low
    const wick = range > 0 ? ((Math.min(d0.open, d0.close) - d0.low) / range) * 100 : null
    lines.push({
      label: '形',
      // 🔵 下ヒゲは**事実として**出すだけ。「だから反発」とは書かない（2026-08-22 に否定済み）
      text: `直近10日は${shape}${wick != null ? ` ／ 当日の下ヒゲ ${Math.round(wick)}%` : ''}`,
    })
  }

  // ── 需給（価格に無い情報＝残高）───────────────────────────
  const mar = margin[0]
  const ratioPct = mar && num(mar.ratio) ? percentile(margin.map(m => m.ratio), mar.ratio) : null
  const arb = arbitrage[0]
  const arbPct = arb ? percentile(arbitrage.map(a => a.longBal), arb.longBal) : null
  const ss = shortSell[0]
  const ssPct = ss ? percentile(shortSell.map(x => x.ratio), ss.ratio) : null
  const ad = advanceDecline[0]

  if (mar) dates.push(mar.date)
  const supplyBits: string[] = []
  if (mar && num(mar.ratio)) supplyBits.push(`信用倍率 ${mar.ratio.toFixed(1)}倍（${rankWord(ratioPct)}）`)
  if (arb) supplyBits.push(`裁定買い残は${rankWord(arbPct)}`)
  if (ss) supplyBits.push(`空売り比率 ${ss.ratio.toFixed(1)}%（${rankWord(ssPct)}）`)
  if (supplyBits.length) lines.push({ label: '需給', text: supplyBits.join(' ／ ') })

  // ── 結論（状態 ＋ 歴史的な位置）───────────────────────────
  // 🔴 買い方／売り方のどちらに偏っているかは**信用倍率の分位**で言う。
  //    倍率が高い＝買い方が多い（売り方が少ない）。良し悪しの判断は付けない。
  let headline: string
  if (ratioPct == null) {
    headline = '需給の位置を出すだけの材料がまだありません'
  } else if (ratioPct >= 70) {
    headline = `買い方に偏っています（信用倍率は過去1年で${rankWord(ratioPct)}）`
    cautions.push('買い方に偏っている局面では、下げ始めたときに投げが重なりやすくなります')
  } else if (ratioPct <= 30) {
    headline = `売り方が多い状態です（信用倍率は過去1年で${rankWord(ratioPct)}）`
    cautions.push('売り方が多い局面では、上げ始めたときに買い戻しが重なりやすくなります')
  } else {
    headline = 'どちらにも偏っていません（信用倍率は過去1年で中くらい）'
  }

  // 評価損益率＝痛みの深さ。🔵 事実だけ。「深いから買い」とは書かない（2026-08-22 に否定済み）
  if (mar && num(mar.evalRatio)) {
    const evPct = percentile(margin.map(m => m.evalRatio).filter(num) as number[], mar.evalRatio)
    cautions.push(`信用評価損益率は ${mar.evalRatio.toFixed(1)}%（過去1年で${rankWord(evPct)}）＝買い方の含み損の深さです`)
  }
  if (ad && num(ad.ratio25)) {
    if (ad.ratio25 >= 120) cautions.push(`騰落レシオ ${Math.round(ad.ratio25)}（120以上＝買われた銘柄が広がっている状態）`)
    if (ad.ratio25 <= 70) cautions.push(`騰落レシオ ${Math.round(ad.ratio25)}（70以下＝売られた銘柄が広がっている状態）`)
  }

  // 🔴 予測ではないことを必ず添える（アプリ全体の方針・投資助言性の回避にも直結）
  cautions.push('これはいまの位置の記述で、この先どちらへ動くかは示していません')

  return {
    headline,
    lines,
    cautions,
    asOf: dates.length ? dates.slice().sort()[dates.length - 1] : null,
  }
}
