import {
  phaseOfSector17, sector17Label,
  PERF_LABELS,
  type PerfKey, type PhaseStrength, type SectorPerfRow, type StockRow,
} from './sectorRotation'
import type { MarginWeekData } from './jpxMarginData'

/** 個別銘柄の信用残の出典（日経会社情報）。新形式コード（197A 等）もそのまま通る。 */
export function marginPageUrl(code: string): string {
  return `https://www.nikkei.com/nkd/company/history/trust/?scode=${encodeURIComponent(code)}`
}

/**
 * 市場全体の信用需給の要約。**ぽいロボが実データを持っている部分**。
 * 🔵 `margin.json` は新しい順（[0] が最新）。
 */
export type MarketMarginSummary = {
  date: string
  ratio: number
  longBal: number
  shortBal: number
  /** 52週の信用倍率レンジ */
  ratioLow: number
  ratioHigh: number
  /** 信用倍率が52週の中で下から何%の位置か（100に近いほど買い残が厚い） */
  ratioPct: number
  /** 買い残のピーク（52週）とその日付 */
  peakLong: number
  peakDate: string
  /** ピークからの解消率（%）。買い残がどれだけ整理されたか */
  clearedPct: number
  /** 直近8週の推移（新しい順） */
  recent: MarginWeekData[]
}

export function summarizeMarketMargin(rows: readonly MarginWeekData[]): MarketMarginSummary | null {
  if (!rows.length) return null
  const cur = rows[0]
  const ratios = rows.map(r => r.ratio).filter(v => v != null)
  const ratioLow = Math.min(...ratios)
  const ratioHigh = Math.max(...ratios)
  const below = ratios.filter(v => v < cur.ratio).length
  const peak = rows.reduce((a, b) => (b.longBal > a.longBal ? b : a), rows[0])
  return {
    date: cur.date,
    ratio: cur.ratio,
    longBal: cur.longBal,
    shortBal: cur.shortBal,
    ratioLow, ratioHigh,
    ratioPct: Math.round((below / ratios.length) * 100),
    peakLong: peak.longBal,
    peakDate: peak.date,
    // ピークから何%減ったか。マイナスなら「いまがピーク圏」
    clearedPct: Math.round(((peak.longBal - cur.longBal) / peak.longBal) * 1000) / 10,
    recent: rows.slice(0, 8),
  }
}

/**
 * 検索で選んだ銘柄を AI に分析させるためのプロンプトを組み立てる（純粋関数・テスト対象）。
 *
 * 🔴 **目的は「需給の分析」**（ユーザー・2026-08-08）。
 *    会社が何をしている会社か・業績・PER 等は TradingView でも見られるので、
 *    AI には**信用買い残／売り残／信用倍率**という、チャートに出ない部分をやらせる。
 *
 * 🔴 **数字は AI に自由に思い出させない**。信用残のような細かい数値は作り話が混じるため、
 *    出典URL（日経会社情報の信用残ページ）を**プロンプトに明示**して、そこを見るよう指示する。
 *
 * 🔵 **市場全体の信用需給はぽいロボが実データを持っている**ので、検証済みの比較材料として渡す。
 *    個別だけが無いので、そこをAIに埋めさせて突き合わせる形にする。
 *
 * 🔴 **出力は状態記述型**にさせる（「買う」「売る」等の推奨を書かせない）。
 *    アプリ全体の方針＝投資助言業の登録をしないため（CLAUDE.md の不変ルール）。
 */
export function buildStockAnalysisPrompt(
  stock: StockRow,
  perf: readonly SectorPerfRow[],
  _strengths: readonly PhaseStrength[],
  key: PerfKey,
  timestamp: string,
  market: MarketMarginSummary | null = null
): string {
  const sectorName = sector17Label(stock.sector17)
  const phase      = phaseOfSector17(stock.sector17)
  const own        = perf.find(p => p.sector17 === stock.sector17) ?? null
  const period     = PERF_LABELS[key]
  const rankKey    = `rank${key.slice(3)}` as 'rank1m' | 'rank3m' | 'rank6m'

  const ownLine = own && own[key] != null
    ? `- ${sectorName}の直近${period}騰落率：**${own[key]! > 0 ? '+' : ''}${own[key]}%**（17業種中 ${own[rankKey] ?? '—'}位）`
    : `- ${sectorName}の騰落率：データなし`

  const marketBlock = market
    ? [
        '## 市場全体の信用需給（ぽいロボの実測データ・検証済み）',
        '🔵 出所＝JPX 二市場信用取引残高（週次）。**この数字は確かなものとして扱ってください。**',
        `- 直近（${market.date}）：信用倍率 **${market.ratio}倍** ／ 買い残 ${market.longBal.toLocaleString()} ／ 売り残 ${market.shortBal.toLocaleString()}`,
        `- 過去52週の信用倍率レンジ：${market.ratioLow}倍 〜 ${market.ratioHigh}倍`,
        `- いまの位置：**下から${market.ratioPct}%**（100に近いほど買い残が厚く、戻り売りが出やすい）`,
        `- 買い残のピーク：${market.peakLong.toLocaleString()}（${market.peakDate}）→ **解消率 ${market.clearedPct}%**`,
        '',
        '直近8週の推移（新しい順）:',
        '| 週 | 買い残 | 売り残 | 信用倍率 |',
        '|---|---|---|---|',
        ...market.recent.map(r => `| ${r.date} | ${r.longBal.toLocaleString()} | ${r.shortBal.toLocaleString()} | ${r.ratio}倍 |`),
        '',
      ]
    : ['## 市場全体の信用需給', '- データを取得できませんでした。', '']

  return [
    '# 個別銘柄の需給分析（ぽいロボ セクター）',
    `作成時刻：${timestamp}`,
    '',
    '## 対象銘柄',
    `- 銘柄コード：${stock.code}`,
    `- 銘柄名：${stock.name}`,
    `- 業種（東証33業種）：${stock.sector33}`,
    `- 業種（TOPIX-17）：${sectorName}`,
    `- セクターローテーション上の分類：${phase ? `${phase.label}（${phase.economy}）で強くなりやすいとされるグループ` : '分類なし'}`,
    '',
    ...marketBlock,
    `## 参考：業種別の実測（直近${period}）`,
    '🔵 出所＝TOPIX-17 業種別ETF（1617〜1633）の調整後終値。業種別株価指数そのものではなく、その代用です。',
    ownLine,
    '',
    '## 🔴 調べてほしい一次情報（ここを必ず見てください）',
    `**${marginPageUrl(stock.code)}**`,
    '',
    '日経会社情報の「信用残」ページです。週次で 信用売残・信用買残・信用倍率 が並んでいます。',
    '**このページを参照して数字を取ってください。**参照できない場合は、株探・みんかぶなど'
      + '他の出所でもかまいませんが、**必ず出所と日付を明記**してください。'
      + '🔴 **どこも参照できない場合は「取得できず」と書き、数字を推測で埋めないでください。**',
    '',
    '## お願いしたいこと',
    'この銘柄の**信用需給**について、次の順で整理してください。',
    '',
    '1) **直近の数字**：信用売残・信用買残・信用倍率（日付つき）',
    '2) **推移**：直近3か月ほどの信用買い残と信用倍率が、増えているか減っているか。'
      + '**変化を%で**示してください（例：買い残は8週間で −18.4%）',
    '3) **解消率**：過去1年の信用買い残のピークはいつ・いくらで、'
      + 'そこから**いま何%解消されたか**（％で明示）',
    '4) **市場全体との比較**：上に載せた市場全体の数字（信用倍率・解消率）と比べて、'
      + 'この銘柄は**重いほうか・軽いほうか**',
    '5) **売り残の状況**：売り残が積み上がっているなら、踏み上げの材料になりうるか。'
      + '信用倍率が1倍を下回っているかどうかも書いてください',
    '6) 🔴 **出来高との関係**：信用買い残は**商いがないと解消されません**。'
      + '直近の平均出来高（1日）を調べ、**買い残が平均出来高の何日分にあたるか**を出してください。'
      + 'あわせて出来高が増えているか減っているか（解消が進みやすい環境かどうか）も書いてください。',
    '7) **需給以外で説明が要る点**：直近で増資・株式分割・株主優待の変更・'
      + '大株主の異動など、需給に直接効く出来事があったか',
    '',
    '## 最後に、需給の状態を一言で',
    '上をふまえて、いまの需給がどの状態に近いかを**次の3つから選び、理由を1〜2行**で書いてください。',
    '- **重しが消えつつある**（買い残が解消され、出来高も伴っている）',
    '- **まだ重い**（買い残が高水準、または商いが細くて解消が進んでいない）',
    '- **どちらとも言えない**（材料が揃わない・数字が取れない）',
    '🔴 これは**需給の状態の記述**であって、売買の判断ではありません。'
      + '「買い時」「仕込み場」のような表現は使わないでください。',
    '',
    '## 守ってほしいこと',
    '- 🔴 **売買の推奨・目標株価・「買い時」の判断を書かないでください。**'
      + '出すのは需給の状態の記述と、判断材料の整理までです。',
    '- 🔴 **数字は必ず出典と取得日を添えてください。**分からない数字は「不明」と書き、'
      + '推測で埋めないでください。**特に信用残の数値を記憶から書かないこと。**',
    '- 🔴 **ぽいロボは景気局面の判定を行っていません。**上の業種分類は'
      + '「教科書的にどの局面で強いとされるか」という一般的な対応表であり、'
      + '「いまが◯◯相場だ」という判断ではありません。**いまの局面を断定しないでください。**',
    '- 会社の事業内容・業績・PER などの基礎情報は**不要です**（別のツールで見ています）。'
      + '需給に絞ってください。ただし需給を動かした出来事（決算サプライズ等）があれば'
      + '**きっかけとして**触れてかまいません。',
    '- 最後に「この整理で確認できなかったこと」を箇条書きにしてください。',
  ].join('\n')
}
