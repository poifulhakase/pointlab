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
    '## 🔴 出力はこの形だけ（前置き・解説・まとめは書かない）',
    '',
    '```',
    '| 項目 | 値 |',
    '|---|---|',
    '| 信用買残 |  株（日付） |',
    '| 信用買残の金額 | 株数 × 株価 ＝ ◯円 |',
    '| 信用売残 |  株 |',
    '| 信用倍率 | ◯倍（1倍割れなら明記） |',
    '| 買残の3か月変化 | ±◯% |',
    '| 1年のピーク | ◯（日付） |',
    '| 解消率 | ◯% |',
    '| 市場全体との比較 | 重い / 軽い / 同程度 |',
    '| 平均出来高（直近1か月・1日） |  株 |',
    '| 平均出来高（過去1年・1日） |  株 |',
    '| 直近 ÷ 1年（商いの厚み） | ◯倍 |',
    '| 平均売買代金（直近1か月・1日） | 平均出来高 × 株価 ＝ ◯円 |',
    '| 買残 ÷ 平均出来高（解消に要する日数） | ◯日分 |',
    '| 出来高の傾向 | 増 / 減 / 横ばい |',
    '| 直近の出来高急増日 | 日付・平常比◯倍・きっかけ（無ければ「無」） |',
    '| 需給イベント | 増資・分割・優待変更・大株主異動など。無ければ「無」 |',
    '| 出典 | URL と取得日 |',
    '',
    '総括：重しが消えつつある / まだ重い / どちらとも言えない',
    '理由：1行',
    '不明：（取れなかった項目名だけ列挙）',
    '```',
    '',
    '## 🔴 総括の判定基準',
    '**判定の軸は「残っている買残の厚み」です。倍率ではありません。**',
    '',
    '重みづけ（上ほど強い）:',
    '1. **買残 ÷ 平均出来高（解消日数）** — 最優先。'
      + '**5日分未満なら「重い」と判定しない**（数日の商いで消える量は重しになりません）',
    '2. **買残の絶対額**（株数 × 株価）— 金額として小さければ、倍率が高くても重しにならない',
    '3. **解消率**（ピークから）— 市場全体より高ければ整理は進んでいる側',
    '4. **買残の変化率**（3か月）— 減っているか',
    '5. **出来高の増減 / 直近÷1年の厚み** — 商いが細って解消日数が伸びているなら「まだ重い」へ寄せる',
    '6. **信用倍率** — 🔴 **単独で判定しない。参考値**。'
      + '売残が極端に少ないだけで倍率は跳ね上がります。'
      + '倍率が高くても、解消日数が短く金額が小さければ**重くありません**。',
    '',
    '🔴 **倍率が高い ＝ 重い、と書かないでください。**'
      + '倍率だけを根拠に「まだ重い」と結論するのは誤りです。',
    '🔵 理由の1行には、**解消日数と解消率を必ず入れて**ください。',
    '',
    '## 記入のしかた',
    '- **変化を%で**書く（例：買い残は8週間で −18.4%）',
    '- 解消率＝1年のピークから**いま何%解消されたか**',
    '- 🔴 信用買い残は**商いがないと解消されません**。'
      + '**買い残が平均出来高の何日分**かを必ず埋めてください',
    '- 出来高は「直近1か月」と「過去1年」の両方を出し、**倍率で厚みが分かる**ようにしてください',
    '- 🔴 **金額は掛け算で必ず埋めてください**（買残の金額＝株数×株価／'
      + '平均売買代金＝平均出来高×株価）。元データが無くても計算できるので「不明」にしないこと',
    '- 🔴 **出来高が急増している場合は、その要因が一過性か**を書いてください。'
      + '決算やニュースによる一時的な増加なら、解消の進みは元の水準に戻ります',
    '- 取れない項目は「不明」。**推測で埋めないでください**（特に信用残の数値を記憶から書かない）',
    '',
    '## 禁止',
    '- 🔴 **売買の推奨・目標株価・「買い時」の判断を書かないでください。**'
      + '総括は需給の状態の記述であって、売買の判断ではありません。',
    '- 会社の事業内容・業績・PER などの基礎情報は**不要です**（別のツールで見ています）。',
    '- 🔴 **ぽいロボは景気局面の判定を行っていません。いまの局面を断定しないでください。**',
    '- 表と総括以外の文章（前置き・要約・補足説明・免責）は書かないでください。',
  ].join('\n')
}
