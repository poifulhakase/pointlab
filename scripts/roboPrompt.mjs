// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: LLM に渡すプロンプトの組み立て
//
// 🔴 判断材料の優先順位（ユーザー方針・2026-08-09）
//    一次: 価格（今の値動き）      … まずここを見て方向を決める
//    二次: 需給                    … 価格判断の補強と、確信度＝倍率の調整に使う
//    背景: 過去データ・統計        … 参考。縛らない
//    別枠: 対照群の現在の判断      … 従うか超えるかを意識させる（命令ではない）
//
// 🔴 矛盾時の裁定は「価格を軸に、需給で倍率を調整」。ここを曖昧にすると LLM が迷う。
//
// 🔴 生の価格の羅列を渡しても LLM は流れを掴めない。移動平均との位置・高安・
//    トレンドの向き・ボラティリティに**加工してから**渡す（数値主軸・設計原則5）。
// ──────────────────────────────────────────────────────────────────────────

import { donchianStates } from '../src/utils/robotStrategy.mjs'

const r1 = v => (v == null ? null : Math.round(v * 10) / 10)
const r2 = v => (v == null ? null : Math.round(v * 100) / 100)
const pct = v => (v == null ? '不明' : `${v > 0 ? '+' : ''}${r2(v)}%`)
const yen = v => (v == null ? '不明' : Math.round(v).toLocaleString())

// ── 価格を「特徴」に加工する（一次情報）────────────────────────────────────

/**
 * 指標つき日次配列の i 番目について、LLM が読める価格の特徴を作る。
 * rows は robotStrategy.computeIndicators を通したもの。
 */
export function buildPriceFeatures(rows, i = rows.length - 1) {
  const cur = rows[i]
  if (!cur) return null
  const { long, bear } = donchianStates(rows)

  const ret = (n) => {
    const prev = rows[i - n]
    return prev ? ((cur.close - prev.close) / prev.close) * 100 : null
  }
  const hi = (n) => {
    let m = -Infinity
    for (let k = 0; k < n && i - k >= 0; k++) m = Math.max(m, rows[i - k].high ?? rows[i - k].close)
    return m === -Infinity ? null : m
  }
  const lo = (n) => {
    let m = Infinity
    for (let k = 0; k < n && i - k >= 0; k++) m = Math.min(m, rows[i - k].low ?? rows[i - k].close)
    return m === Infinity ? null : m
  }

  const hi20 = hi(20), lo20 = lo(20), hi60 = hi(60), lo60 = lo(60)
  // レンジ内の現在地（0%=安値, 100%=高値）。「どのあたりにいるか」を一言で伝える
  const posIn = (h, l) => (h != null && l != null && h > l ? ((cur.close - l) / (h - l)) * 100 : null)

  // 高値安値構造: 直近20日で高値/安値をいつ付けたかで判断
  let structure = 'レンジ継続'
  if (hi20 != null && (cur.high ?? cur.close) >= hi20 - 1e-9) structure = '高値更新中'
  else if (lo20 != null && (cur.low ?? cur.close) <= lo20 + 1e-9) structure = '安値更新中'

  const devFrom = (ma) => (ma == null ? null : ((cur.close - ma) / ma) * 100)

  return {
    date: cur.date,
    close: r1(cur.close),
    change1d: r2(ret(1)),
    change5d: r2(ret(5)),
    change20d: r2(ret(20)),
    ma25: r1(cur.sma25), devMa25: r2(cur.dev25),
    ma75: r1(cur.sma75), devMa75: r2(devFrom(cur.sma75)),
    ma200: r1(cur.sma200), devMa200: r2(devFrom(cur.sma200)),
    ma200Slope: cur.sma200slope == null ? null : (cur.sma200slope > 0 ? '上向き' : cur.sma200slope < 0 ? '下向き' : '横ばい'),
    high20: r1(hi20), low20: r1(lo20), posInRange20: r1(posIn(hi20, lo20)),
    high60: r1(hi60), low60: r1(lo60), posInRange60: r1(posIn(hi60, lo60)),
    structure,
    trend: bear[i] ? '確定下落（ドンチャン50安値割れ）' : long[i] ? '上昇（ドンチャン50高値超え）' : '中立',
    atr20: r1(cur.atr20),
    atr20Pct: r2(cur.atr20 == null ? null : (cur.atr20 / cur.close) * 100),
  }
}

/** 価格の特徴を、LLM が読む日本語ブロックにする */
export function formatPriceSection(f, label = '日経225') {
  if (!f) return `## ${label}\n取得できず`
  return `## 【一次情報】${label}の値動き（${f.date}）

現在値: ${yen(f.close)}円（前日比 ${pct(f.change1d)} / 5日 ${pct(f.change5d)} / 20日 ${pct(f.change20d)}）

移動平均との位置
  25日線 ${yen(f.ma25)}円 → 乖離 ${pct(f.devMa25)}
  75日線 ${yen(f.ma75)}円 → 乖離 ${pct(f.devMa75)}
  200日線 ${yen(f.ma200)}円 → 乖離 ${pct(f.devMa200)}（200日線は${f.ma200Slope ?? '不明'}）

高値・安値
  直近20日: 高値 ${yen(f.high20)}円 / 安値 ${yen(f.low20)}円 → いまレンジの${f.posInRange20 ?? '?'}%地点
  直近60日: 高値 ${yen(f.high60)}円 / 安値 ${yen(f.low60)}円 → いまレンジの${f.posInRange60 ?? '?'}%地点
  高安構造: ${f.structure}

トレンド: ${f.trend}
ボラティリティ: ATR20 ${yen(f.atr20)}円（値幅にして ${pct(f.atr20Pct)}／日）`
}

/** 各ETFの現値とボラ（建てる器としての情報。判断の軸ではない） */
export function formatEtfSection(etfFeatures) {
  const lines = Object.entries(etfFeatures).map(([code, f]) => {
    if (!f) return `  ${code}: 取得できず`
    return `  ${code} ${f.name}: ${yen(f.close)}円（前日比 ${pct(f.change1d)}・ATR20 ${yen(f.atr20)}円）`
  })
  return `## 建てる器（ETFの現値）\n${lines.join('\n')}`
}

// ── 需給（二次情報）────────────────────────────────────────────────────────

export function formatSupplySection(supply) {
  if (!supply) return '## 【二次情報】需給\n取得できず'
  const l = []
  if (supply.marginRatio != null) l.push(`信用倍率: ${r2(supply.marginRatio)}倍`)
  if (supply.marginLongPeakDrop != null) l.push(`買い残のピークからの解消率: ${pct(supply.marginLongPeakDrop)}`)
  if (supply.foreignNet != null) l.push(`外国人ネット: ${yen(supply.foreignNet)}億円`)
  if (supply.individualNet != null) l.push(`個人ネット: ${yen(supply.individualNet)}億円`)
  if (supply.cotNet != null) l.push(`海外投機筋(CFTC)ネット: ${yen(supply.cotNet)}枚`)
  if (supply.shortRatio != null) l.push(`空売り比率: ${r2(supply.shortRatio)}%`)
  if (supply.adRatio != null) l.push(`騰落レシオ: ${r2(supply.adRatio)}`)
  if (supply.arbitrageLong != null) l.push(`裁定買い残: ${yen(supply.arbitrageLong)}億円`)
  if (supply.pcr != null) l.push(`PCR: ${r2(supply.pcr)}`)
  if (supply.vix != null) l.push(`VIX: ${r2(supply.vix)}`)
  if (supply.ntRatio != null) l.push(`NT倍率: ${r2(supply.ntRatio)}`)

  return `## 【二次情報】需給
${l.length ? l.map(s => `  ${s}`).join('\n') : '  データなし'}

🔵 需給は**方向を決める材料ではなく、価格で決めた方向の確信度（＝倍率）を調整する材料**として使う。`
}

// ── 背景（過去データ・統計。縛らない）──────────────────────────────────────

/**
 * 🔴 過去の実測は「参考の背景」として渡す。命令にしない。
 *    ただし**当たっていない指標を伏せない**。伏せると負けている指標を根拠に自信を持たれる。
 */
export function formatBackgroundSection(bg = {}) {
  const tev = bg.tev ?? { overall: 0.44, bull: 0.63, bear: 0.39, gap: -11 }
  const base = bg.baseline ?? { trades: 57, winRate: 0.40, expectancy: 47347, cagr: 11.39, maxDD: -42.68 }
  return `## 【背景】過去に測って分かっていること（参考。従う必要はない）

TEV（需給エネルギー指標）の実績 — 52週の検証
  全体の勝率 ${Math.round(tev.overall * 100)}%（ブル ${Math.round(tev.bull * 100)}% / ベア ${Math.round(tev.bear * 100)}%）
  確信度は自信過剰（言った確率より実勝率が ${tev.gap} ポイント低い）
  🔴 **TEV はこの程度しか当たっていない**。根拠として重く扱わないこと。

決定論ルール（対照群）の過去成績 — ETF実データ 2014-07以降
  ${base.trades}件・勝率 ${Math.round(base.winRate * 100)}%・期待値 ${yen(base.expectancy)}円・CAGR ${base.cagr}%・最大DD ${base.maxDD}%
  🔴 同期間、日経2倍を持ちっぱなしのほうが CAGR は高かった（9.89% / DD −88%）。
     **このルールの価値はリターンではなく、ドローダウンを半分にしたこと。**

20年の検証から分かっていること
  ・トレンドに逆らう逆張りは負ける。逆張りは確定下落局面でのみ。
  ・CAGR と DD は両立に限界がある。現実解は CAGR 15〜20% × DD −40% 圏（2倍レバ前提）。
  ・勝率は 34〜40% しかないのが正常。**勝率を上げにいくと利を伸ばせず期待値が壊れる。**
  ・半分以上の日は何も持たない。持たないことは失敗ではない。`
}

// ── 対照群の現在の判断（別枠）──────────────────────────────────────────────

/**
 * 🔴 これは「過去の統計」ではなく「今この瞬間の、機械的なもう一つの判断」。
 *    背景に埋めず、価格・需給と並べて見せ、従うか超えるかを意識させる。
 *    🔴 ただし**命令にしない**。従わせると「決定論を超えられるか」が測れなくなる。
 */
export function formatBaselineSection(baseline) {
  const side = baseline?.side ?? null
  const label = side === 'bull' ? 'ブル（買い）' : side === 'bear' ? 'ベア（売り）' : 'ノーポジション'
  return `## 【別枠】決定論ルール（対照群）は今こう判断している

  判断: ${label}
  理由: ${baseline?.reason ?? '—'}

🔵 これは参考意見の一つであって、命令ではない。
🔴 **あなたの判断はこれに従っても、あえて外してもよい。**
　 ただし**外すなら、その理由を reason に必ず書くこと**。
　 （このシステムは「あなたが決定論ルールを超えられるか」を測っている。
　 　黙って従うだけならあなたを使う意味がなく、黙って外すと外した理由が検証できない）`
}

// ── 全体の組み立て ────────────────────────────────────────────────────────

export const ROBO_ROLE = `あなたは日経平均のブル／ベアETFを売買する疑似口座の運用者です。
この口座は運用者本人だけが見る自分用の記録で、他人への配信や助言ではありません。
毎営業日の引け後に、翌営業日の寄付きで執行する前提で判断します。`

export const ROBO_PRIORITY = `# 判断の優先順位（これが最も重要なルール）

1. **一次＝価格**。まず今の値動きを見て、方向（ブル / ベア / 持たない）を決める。
   数値（移動平均との位置・高安・トレンド・ボラティリティ）と、
   添付されたチャート画像があればその**形**（持ち合い・天井/底の形・節目）の両方を使う。
2. **二次＝需給**。価格で決めた方向を、需給が支持しているかを確認する。
3. **背景＝過去データ**。参考にとどめる。過去のルールに縛られない。
4. **別枠＝対照群の判断**。従うか超えるかを意識する（命令ではない）。

## 🔴 価格と需給が食い違ったときの裁き方

**方向は価格で決める。需給は確信度＝倍率の調整に使う。**

  価格が上向き × 需給も良い    → ブル。確信が高ければ2倍（1570）
  価格が上向き × 需給が重い    → ブル。ただし1倍（1321）に落とすか、様子見に寄せる
  価格が下向き × 需給も悪い    → ベア。確信が高ければ2倍（1357）
  価格が下向き × 需給は良い    → ベア。ただし1倍（1571）に落とすか、様子見に寄せる
  価格の方向がはっきりしない    → 持たない（hold）

🔵 **倍率の選択が、そのままあなたの確信度の表明**になる。強く確信するときだけ2倍を使う。`

export const ROBO_CONSTRAINTS = `# 守ること

・**同時に持てるのは1銘柄だけ**。ブルとベアを同時に持たない。
・建玉があるのに逆方向を選んだ場合は、決済してから新規建てとして機械的に処理される。
・**損切り値はあなたが決めない**（ATR とボラティリティから機械的に決まる）。
・数量は資金の上限で機械的に切り詰められる。上限を超えても構わないが、超えた分は無視される。
・**持たない（hold）ことは正しい選択**。半分以上の日は持たないのが普通。
・**勝率を上げようとしないこと**。この戦略は勝率34〜40%で期待値がプラスになる形をしている。
　負けを小さく、勝ちを伸ばす。細かく利確して勝率を上げにいくと期待値が壊れる。
・売買を推奨する文章は書かない。これはあなた自身の疑似口座の操作記録である。`

export const ROBO_OUTPUT_RULE = `# 出力

指定された JSON スキーマで返すこと。各項目の意味:

  action      … open（新規建て） / close（手仕舞い） / hold（何もしない）
  symbol      … 1321(ブル1倍) / 1570(ブル2倍) / 1571(ベア1倍) / 1357(ベア2倍) / none
  qty         … 口数
  confidence_pct … 確信度（0-100）
  reason      … 🔴 **なぜその判断をしたか。価格をどう読んだかを必ず先に書く。**
                 対照群と違う判断をしたなら、その理由も書く。日本語2〜3行。
  counter     … 🔴 **この判断が外れるとしたら、何が起きたときか。**
                 自分の負け筋を1〜2行で書く。
  user_note   … 運用者の実際の保有に対する所見（1〜2行）。
                 ロボ自身の売買判断とは別。乖離があれば指摘する。無ければ空文字。`

/** LLM に返させる JSON スキーマ（Structured Outputs） */
export const ROBO_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['open', 'close', 'hold'] },
    symbol: { type: 'string', enum: ['1321', '1570', '1571', '1357', 'none'] },
    qty: { type: 'integer' },
    confidence_pct: { type: 'integer' },
    reason: { type: 'string' },
    counter: { type: 'string' },
    user_note: { type: 'string' },
  },
  required: ['action', 'symbol', 'qty', 'confidence_pct', 'reason', 'counter', 'user_note'],
  additionalProperties: false,
}

/** ロボ口座の現状 */
export function formatAccountSection(account) {
  const p = account?.position
  const held = p && p.qty > 0
    ? `  保有中: ${p.symbol} を ${p.qty}口（平均取得 ${yen(p.avg_price)}円 / 損切り ${yen(p.stop_price)}円）`
    : '  保有なし'
  const s = account?.stats ?? {}
  return `## あなた（ロボ）の口座

${held}
  現金: ${yen(account?.cash)}円 / 評価額: ${yen(account?.equity)}円
  これまでの成績: ${s.closed_trades ?? 0}件・勝率 ${s.win_rate == null ? '—' : Math.round(s.win_rate * 100) + '%'}・最大DD ${s.max_drawdown_pct ?? '—'}%`
}

/**
 * 添付画像の説明。画像そのものは llmDecide 側で content に載せる。
 * 🔴 画像が無い日も判断は止めない（撮影はローカルPC依存で落ちうるため）。
 */
export function formatImagesSection({ hasChart, chartAgeDays, hasPosition }) {
  if (!hasChart && !hasPosition) {
    return `## 添付画像\n  なし。**数値だけで判断すること**（画像が無いのは異常ではない）。`
  }
  const l = []
  if (hasChart) {
    const age = chartAgeDays == null || chartAgeDays <= 0
      ? '本日'
      : `🔴 ${chartAgeDays}営業日前（古い。現在の値動きは数値のほうを信頼すること）`
    l.push(`  ・TradingView のチャート（${age}）— **形**を読むために使う。数値と食い違ったら数値を優先。`)
  }
  if (hasPosition) l.push('  ・運用者の保有画面 — 実際の建玉。あなた自身の口座とは別物。')
  return `## 添付画像\n${l.join('\n')}`
}

/** 運用者の実保有（キャプチャ由来） */
export function formatRealPositionSection(real) {
  if (!real || !real.positions?.length) {
    return `## 運用者の実際の保有\n  情報なし（キャプチャが届いていない）`
  }
  const age = real.age_days
  const stale = age == null ? '' : age <= 0 ? '（本日のキャプチャ）' : `（🔴 ${age}営業日前のキャプチャ。現在は変わっている可能性がある）`
  const lines = real.positions.map(p =>
    `  ${p.symbol} ${p.name ?? ''} ${p.qty}口 平均${yen(p.avg_price)}円 現在${yen(p.last_price)}円 損益${pct(p.pnl_pct)}`)
  const unread = real.unreadable_fields?.length
    ? `\n  🔴 読み取れなかった項目: ${real.unreadable_fields.join(', ')}（推測しないこと）`
    : ''
  return `## 運用者の実際の保有 ${stale}\n${lines.join('\n')}${unread}`
}

/**
 * 全体のプロンプトを組み立てる。
 * 🔴 並び順が優先順位を伝える。価格を先頭に置き、背景を後ろに置く。
 */
export function buildRoboPrompt({
  priceFeatures, etfFeatures, supply, baseline, account, realPosition, events, background, images,
}) {
  return [
    ROBO_ROLE,
    '',
    ROBO_PRIORITY,
    '',
    '━'.repeat(30),
    formatPriceSection(priceFeatures),
    '',
    formatImagesSection(images ?? {}),
    '',
    formatEtfSection(etfFeatures ?? {}),
    '',
    formatSupplySection(supply),
    '',
    events ? `## 今後5営業日のイベント\n${events}` : '',
    '',
    formatBaselineSection(baseline),
    '',
    formatBackgroundSection(background),
    '',
    '━'.repeat(30),
    formatAccountSection(account),
    '',
    formatRealPositionSection(realPosition),
    '',
    '━'.repeat(30),
    ROBO_CONSTRAINTS,
    '',
    ROBO_OUTPUT_RULE,
  ].filter(s => s !== '').join('\n')
}
