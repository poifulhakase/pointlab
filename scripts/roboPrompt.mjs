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
 * 上げ（下げ）の**勢いが落ちているか**を数値にする（2026-08-17 追加・ユーザー指摘）。
 *
 * きっかけ＝「上昇のローソク足が短くなっていっている＝売買圧が弱まっている」。
 * 実際に測ると 7/29 の安値から +12.1% 上げる過程で、上昇日の実体は
 * **3.88% → 2.69% → 1.62% → 0.79% → 0.40%** と一貫して縮んでいた。
 *
 * 🔴 それまで LLM に渡していたのは「下げてから」の材料だけ（ATR・損切り水準・乖離）で、
 *    **上げの最中に勢いが枯れていく段階**は数値として渡していなかった
 *    （チャート画像は見せているが、そこから言語化される保証はない）。
 * 🔵 出すのは事実だけ。「だから売り」とは書かない（判断は LLM と人がする）。
 *
 * @param {Array} rows computeIndicators を通した日足
 * @param {number} i   基準日
 */
export function buildMomentumFade(rows, i = rows.length - 1) {
  const back = 20
  const from = Math.max(0, i - back + 1)
  const win = rows.slice(from, i + 1)
  // 🔵 5本未満では「縮んでいる」と言えない（無いものを作らない）
  if (win.length < 5) return null

  const bodyPct = (r) => (r.open ? ((r.close - r.open) / r.open) * 100 : 0)
  const ups = win.filter((r) => r.close > r.open)
  const downs = win.filter((r) => r.close < r.open)

  // 直近の上昇日の実体（古い順）。縮んでいるかは「後半の平均 < 前半の平均」で見る
  const upBodies = ups.map((r) => ({ d: r.date, v: bodyPct(r) }))
  const half = Math.floor(upBodies.length / 2)
  const early = upBodies.slice(0, half).map((x) => x.v)
  const late = upBodies.slice(half).map((x) => x.v)
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const earlyAvg = avg(early), lateAvg = avg(late)

  // 何日連続で縮んでいるか（直近の上昇日をさかのぼる）
  let shrinking = 0
  for (let k = upBodies.length - 1; k > 0; k--) {
    if (upBodies[k].v < upBodies[k - 1].v) shrinking++
    else break
  }

  // 出来高が平常（20日中央値）に対してどうか
  const vols = win.map((r) => r.volume ?? 0).filter((v) => v > 0)
  const sorted = [...vols].sort((a, b) => a - b)
  const medVol = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  const lastVol = rows[i].volume ?? null
  const volRatio = medVol && lastVol ? lastVol / medVol : null

  // 上ヒゲ（上値で押し返されているか）
  const upperWick = (r) => {
    const top = Math.max(r.open, r.close)
    const range = (r.high ?? r.close) - (r.low ?? r.close)
    return range > 0 ? (((r.high ?? r.close) - top) / range) * 100 : null
  }
  const wick3 = rows.slice(Math.max(0, i - 2), i + 1).map(upperWick).filter((v) => v != null)

  return {
    upDays: ups.length,
    downDays: downs.length,
    upBodyRecent: upBodies.slice(-6).map((x) => ({ date: x.d, pct: r2(x.v) })),
    upBodyEarlyAvg: r2(earlyAvg),
    upBodyLateAvg: r2(lateAvg),
    // 🔵 「縮んでいる」＝後半の上昇日の実体が前半より小さい
    fading: earlyAvg != null && lateAvg != null ? lateAvg < earlyAvg : null,
    shrinkStreak: shrinking,
    downBodyAvg: r2(avg(downs.map((r) => Math.abs(bodyPct(r))))),
    volVsNormal: r2(volRatio),
    upperWick3dAvg: r2(avg(wick3)),
  }
}

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
    // 🆕 2026-08-17：上げ（下げ）の勢いが落ちているか
    fade: buildMomentumFade(rows, i),
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
ボラティリティ: ATR20 ${yen(f.atr20)}円（値幅にして ${pct(f.atr20Pct)}／日）
${formatFade(f.fade)}`
}

/**
 * 勢いの衰えを文章にする（2026-08-17 追加）。
 * 🔴 事実だけを書く。「だから売り」「だから買い」とは書かない。
 */
function formatFade(fade) {
  if (!fade) return ''
  const list = fade.upBodyRecent.map((x) => `${x.date.slice(5)} ${pct(x.pct)}`).join(' → ')
  const lines = [
    '',
    '勢い（直近20日のローソクの実体）',
    `  上昇${fade.upDays}日 / 下落${fade.downDays}日`,
    `  上昇日の実体（古い順）: ${list || 'なし'}`,
    `  上昇日の実体 前半平均 ${pct(fade.upBodyEarlyAvg)} → 後半平均 ${pct(fade.upBodyLateAvg)}`
      + `${fade.fading === true ? '（**縮んでいる**）' : fade.fading === false ? '（縮んでいない）' : ''}`,
  ]
  if (fade.shrinkStreak >= 2) lines.push(`  🔴 上昇日の実体が**${fade.shrinkStreak}回連続で縮小**している`)
  if (fade.downBodyAvg != null) lines.push(`  下落日の実体 平均 ${pct(fade.downBodyAvg)}（小さいほど売り圧力も無い＝保ち合い）`)
  if (fade.volVsNormal != null) lines.push(`  当日の出来高: 平常（20日中央値）の ${fade.volVsNormal}倍`)
  if (fade.upperWick3dAvg != null) lines.push(`  直近3日の上ヒゲ比率 平均 ${fade.upperWick3dAvg}%（高いほど上値で押し返されている）`)
  lines.push('  🔵 これは「勢いの記述」であって、売買の指示ではない。方向の判断は他の材料と合わせて行うこと。')
  return lines.join('\n')
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

/** その数字が何日前のものか（営業日ではなく暦日。ざっくりで十分） */
function ageDays(asOf, today) {
  if (!asOf || !today) return null
  const d = Math.round((new Date(today) - new Date(asOf)) / 86400000)
  return Number.isFinite(d) && d >= 0 ? d : null
}

/**
 * 需給。
 *
 * 🔴 2026-08-11 に**格下げ**した（ユーザー判断）。それまでは日付を伏せて数字だけ並べており、
 *    LLM が**10日前の数字を「いま」の話として読める**状態だった。
 *    実際 investor/margin/arbitrage は週次で、実測で10日遅れのことがある。
 *
 * 🔴 需給12項目を全部足しても、方向の的中率は 52.8%（何もしない 52.2% に対して +0.6pt）。
 *    **翌日の方向を当てる材料にはならない**ことが実測で分かっている。
 *    → 日次と週次を分けて並べ、週次には遅れ日数を明記し、「地合いの背景」と位置づける。
 */
export function formatSupplySection(supply, today = null) {
  if (!supply) return '## 【背景】需給\n取得できず'
  const asOf = supply._asOf ?? {}
  const tag = (key) => {
    const d = ageDays(asOf[key], today)
    return asOf[key] ? `（${asOf[key]}${d != null ? ` = ${d}日前` : ''}）` : ''
  }

  const daily = []
  if (supply.vix != null) daily.push(`VIX: ${r2(supply.vix)} ${tag('vix')}`)
  if (supply.pcr != null) daily.push(`PCR: ${r2(supply.pcr)} ${tag('futures')}`)
  if (supply.futuresOi != null) daily.push(`先物建玉: ${yen(supply.futuresOi)}枚 ${tag('futures')}`)
  if (supply.topixClose != null) daily.push(`TOPIX: ${r2(supply.topixClose)} ${tag('topix')}`)

  const weekly = []
  if (supply.marginRatio != null) weekly.push(`信用倍率: ${r2(supply.marginRatio)}倍 ${tag('margin')}`)
  if (supply.marginLongPeakDrop != null) weekly.push(`買い残のピークからの解消率: ${pct(supply.marginLongPeakDrop)} ${tag('margin')}`)
  if (supply.foreignNet != null) weekly.push(`外国人ネット: ${yen(supply.foreignNet)}億円 ${tag('investor')}`)
  if (supply.individualNet != null) weekly.push(`個人ネット: ${yen(supply.individualNet)}億円 ${tag('investor')}`)
  if (supply.cotNet != null) weekly.push(`海外投機筋(CFTC)ネット: ${yen(supply.cotNet)}枚 ${tag('cot')}`)
  if (supply.shortRatio != null) weekly.push(`空売り比率: ${r2(supply.shortRatio)}% ${tag('shortSell')}`)
  if (supply.adRatio != null) weekly.push(`騰落レシオ: ${r2(supply.adRatio)} ${tag('advanceDecline')}`)
  if (supply.arbitrageLong != null) weekly.push(`裁定買い残: ${yen(supply.arbitrageLong)}千株 ${tag('arbitrage')}`)

  return `## 【背景】需給（🔴 方向を決める材料ではない）

日次（新しい）
${daily.length ? daily.map(s => `  ${s}`).join('\n') : '  データなし'}

週次（🔴 **古い**。カッコ内が何日前の数字か）
${weekly.length ? weekly.map(s => `  ${s}`).join('\n') : '  データなし'}

🔴 **需給12項目を全部足しても、翌日の方向の的中率は 52.8% しかない**（何もしないと 52.2%）。
　 実測で +0.6ポイントしか足せていない。**方向の根拠にしないこと。**
🔴 週次の数字は最大10日前のものになる。「いまの需給」ではなく「先週こうだった」という記録として読む。
🔵 使い道は、価格で決めた方向に対する**地合いの背景**まで。確信度をわずかに上下させる程度に留める。`
}

/**
 * 前夜の海外市場（2026-08-11 追加）。
 *
 * 🔴 **08:30 の判断時点で確定していて遅れがゼロなのは、これだけ**。
 *    実測（21年・5,131営業日）で前夜S&P500 → 翌日の**寄り**は相関 0.650・方向一致 74.7%。
 *    需給12項目を全部足しても 52.8% だったのと比べて桁が違う。
 *
 * 🔴 ただし **寄り→引けの一致率は 49.8%＝コインの裏表**。米国の材料は寄り付きで
 *    織り込まれて終わる。**我々は寄りで執行するので、この 74.7% は取れない。**
 *    方向を当てる材料ではなく、「今日は大きく飛んで始まる」を事前に知るための材料として渡す。
 */
export function formatOvernightSection(ov) {
  if (!ov || !Object.keys(ov).length) return '## 【一次情報】前夜の海外市場\n取得できず'
  const l = []
  for (const k of ['spx', 'ndx', 'usdjpy']) {
    const v = ov[k]
    if (v) l.push(`${v.name}: ${r2(v.close)}（前日比 ${pct(v.changePct)}・${v.date}）`)
  }
  return `## 【一次情報】前夜の海外市場（遅れゼロ）
${l.map(s => `  ${s}`).join('\n')}

🔴 実測（21年）＝前夜S&P500 と翌日の**寄り**は相関 0.650・方向の一致 74.7%。
　 一方で**寄り→引けの一致は 49.8%（コインの裏表）**。米国の材料は**寄り付きで織り込まれて終わる**。
🔴 我々は**翌営業日の寄り付きで執行する**。つまりこの一致率は**取りに行けない**。
　 「前夜が強いから買う」は、既に上がった値段を買うことになる。
🔵 正しい使い道は**執行の見立て**：
　 ・前夜が大きく動いていれば、明日の寄りは大きく飛ぶ。建てるなら不利な値段から始まると考える。
　 ・飛んだ結果、建てる前提（損切りの位置）が壊れるなら、その日は見送ってよい。
　 ・ドル円の相関は 0.206 と弱い。補助として見る程度に留める。`
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

0. 🔴 **どの材料が新しいか**をまず確認する。08:30 の判断時点で確定していて遅れがゼロなのは
   **価格（前営業日の終値）と、前夜の海外市場**だけ。需給の大半は**週次で最大10日前**の数字。
   古い数字を「いま」の話として読まないこと。
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

🔵 **倍率の選択が、そのままあなたの確信度の表明**になる。強く確信するときだけ2倍を使う。

🔴 **ベアは「やらない」のではなく「少なめ」**（運用者の意向・2026-08-11）。
　日経は上げが長く下げが短いので、ベアは当たると速いが**外すと居座る時間が長い**。
　・ベアに入るのは、価格が明確に下向きで**かつ**需給も悪いときに絞る。
　　（価格が下向きでも需給が良いなら、ベア1倍ではなく hold を優先する）
　・2倍（1357）は例外。よほど揃っているときだけ。
　・ブルとベアで迷ったら、ブル寄り／持たない側に倒す。`

export const ROBO_CONSTRAINTS = `# 守ること

・**同時に持てるのは1銘柄だけ**。ブルとベアを同時に持たない。
・建玉があるのに逆方向を選んだ場合は、決済してから新規建てとして機械的に処理される。
・**損切り値はあなたが決めない**（ATR とボラティリティから機械的に決まる）。
・損切り値は**利が乗るほど機械的に引き上がる**（下がることはない）。
　つまり**利確はシステムが引き受けている**。伸びている建玉を、利益を確定したいという理由で
　close にしないこと。手仕舞うのは「上げの根拠が崩れたとき」だけでよい。
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
export function formatImagesSection({ hasChart, chartAgeDays, hasWeekly, weeklyAgeDays, hasPosition }) {
  if (!hasChart && !hasWeekly && !hasPosition) {
    return `## 添付画像\n  なし。**数値だけで判断すること**（画像が無いのは異常ではない）。`
  }
  const l = []
  if (hasChart) {
    const age = chartAgeDays == null || chartAgeDays <= 0
      ? '本日'
      : `🔴 ${chartAgeDays}営業日前（古い。現在の値動きは数値のほうを信頼すること）`
    l.push(`  ・TradingView のチャート【日足】（${age}）— 短期の**形**（直近の押し目・節目）を読むために使う。数値と食い違ったら数値を優先。`)
  }
  if (hasWeekly) {
    const age = weeklyAgeDays == null || weeklyAgeDays <= 0
      ? '本日'
      : `🔴 ${weeklyAgeDays}営業日前（古い）`
    // 🔵 週足は「いまがどの局面か」を見るために渡す。日足だけだと、押し目なのか
    //    上昇の終わりなのかが読めない（2026-08-13 に両方渡すようにした）。
    l.push(`  ・TradingView のチャート【週足】（${age}）— **大きな流れ**（上昇/下降の途中か、天井/底の形か）を読むために使う。`)
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
  priceFeatures, etfFeatures, supply, overnight, baseline, account, realPosition, events, background, images, today,
}) {
  return [
    ROBO_ROLE,
    '',
    ROBO_PRIORITY,
    '',
    '━'.repeat(30),
    formatPriceSection(priceFeatures),
    '',
    formatOvernightSection(overnight ?? {}),
    '',
    formatImagesSection(images ?? {}),
    '',
    formatEtfSection(etfFeatures ?? {}),
    '',
    formatSupplySection(supply, today),
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
