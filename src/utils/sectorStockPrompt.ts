import {
  phaseOfSector17, sector17Label, strongestPhase,
  PERF_LABELS,
  type PerfKey, type PhaseStrength, type SectorPerfRow, type StockRow,
} from './sectorRotation'

/**
 * 検索で選んだ銘柄を AI に分析させるためのプロンプトを組み立てる（純粋関数・テスト対象）。
 *
 * 🔴 **出力は状態記述型**にさせる（「買う」「売る」等の推奨を書かせない）。
 *    アプリ全体の方針＝投資助言業の登録をしないため（CLAUDE.md の不変ルール）。
 * 🔴 **株価データはアプリ側に無い**。数字を持っていないのに持っているふりをすると
 *    AIが作り話をするので、「株価は利用者が貼るか、AIが自分で調べる」と明記する。
 * 🔵 渡せる事実は「この銘柄の業種」と「その業種が実測でどのくらい動いたか」まで。
 *    局面の判定はしていないので、**局面を断定させない**よう釘を刺す。
 */
export function buildStockAnalysisPrompt(
  stock: StockRow,
  perf: readonly SectorPerfRow[],
  strengths: readonly PhaseStrength[],
  key: PerfKey,
  timestamp: string
): string {
  const sectorName = sector17Label(stock.sector17)
  const phase      = phaseOfSector17(stock.sector17)
  const own        = perf.find(p => p.sector17 === stock.sector17) ?? null
  const top        = strongestPhase(strengths)
  const period     = PERF_LABELS[key]

  const ownLine = own && own[key] != null
    ? `- ${sectorName}の直近${period}騰落率：**${own[key]! > 0 ? '+' : ''}${own[key]}%**（17業種中 ${own[`rank${key.slice(3)}` as 'rank1m' | 'rank3m' | 'rank6m'] ?? '—'}位）`
    : `- ${sectorName}の騰落率：データなし`

  const rankLines = [...perf]
    .filter(p => p[key] != null)
    .sort((a, b) => b[key]! - a[key]!)
    .map((p, i) => `  ${i + 1}. ${p.label} ${p[key]! > 0 ? '+' : ''}${p[key]}%`)

  return [
    '# 銘柄の状態整理（ぽいロボ セクター）',
    `作成時刻：${timestamp}`,
    '',
    '## 対象銘柄',
    `- 銘柄コード：${stock.code}`,
    `- 銘柄名：${stock.name}`,
    `- 業種（東証33業種）：${stock.sector33}`,
    `- 業種（TOPIX-17）：${sectorName}`,
    `- セクターローテーション上の分類：${phase ? `${phase.label}（${phase.economy}）で強くなりやすいとされるグループ` : '分類なし'}`,
    '',
    `## 参考：業種別の実測（直近${period}）`,
    '🔵 出所＝TOPIX-17 業種別ETF（1617〜1633）の調整後終値。業種別株価指数そのものではなく、その代用です。',
    ownLine,
    top?.avg != null
      ? `- 4グループの中で平均が最も高いのは「${top.phase.label}」グループ（平均 ${top.avg > 0 ? '+' : ''}${top.avg}%）`
      : '- グループ平均：データなし',
    '',
    '17業種の騰落率（強い順）:',
    ...rankLines,
    '',
    '## 🔴 前提として必ず守ること',
    '- **ぽいロボは景気局面の判定を行っていません。**上の分類は「教科書的にどの局面で強いとされるか」'
      + 'という一般的な対応表であり、「いまが◯◯相場だ」という判断ではありません。'
      + '**いまの局面を断定しないでください。**',
    '- 上の騰落率は**実際に測った値**ですが、ETFによる代用値です。指数そのものの数字として扱わないでください。',
    '- 🔴 **ぽいロボはこの銘柄の株価を持っていません。**'
      + 'あなたが最新の株価を参照できる場合はそれを使い、**取得日時と出典を明記**してください。'
      + '参照できない場合は「株価データなし」と明記し、株価に関する記述は行わないでください。',
    '',
    '## お願いしたいこと',
    'この銘柄について、次の順で**事実と状態の整理**をしてください。',
    '',
    '1) この会社が何で稼いでいるか（事業の柱と、売上・利益の構成）',
    '2) 業績と株価が、何に反応して動いてきたか（金利・為替・景気・素材価格など）',
    `3) いまの株価水準（参照できる最新の株価・PER・PBR・配当利回りを、**取得日と出典を明記して**）`,
    `4) 同じ業種（${sectorName}）の中での位置。上の業種騰落率と、この銘柄自身の値動きが`
      + '**揃っているか・ズレているか**。ズレているならその理由として考えられるもの',
    '5) 見方が分かれている論点（強気側の根拠／弱気側の根拠を、どちらも同じ分量で）',
    '',
    '## 守ってほしいこと',
    '- 🔴 **売買の推奨・目標株価・「買い時」の判断を書かないでください。**'
      + '出すのは状態の記述と、判断材料の整理までです。',
    '- 🔴 **数字は必ず出典と取得日を添えてください。**分からない数字は「不明」と書き、推測で埋めないでください。',
    '- 業種の分類は**一般的な整理**であって、この銘柄の値動きを説明する根拠ではありません。'
      + '実際の値動きと分類が食い違うなら、その食い違い自体を書いてください。',
    '- 最後に「この整理で確認できなかったこと」を箇条書きにしてください。',
  ].join('\n')
}
