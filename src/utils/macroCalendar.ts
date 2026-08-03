export type MacroEventType = 'fomc' | 'boj' | 'nfp' | 'adp' | 'cpi' | 'pce' | 'ism' | 'tankan' | 'intervention'

export type MacroFilter = { us: boolean; jp: boolean }

/**
 * 実績としての補足（この日に**何が起きたか**）。
 *
 * 🔴 なぜ要るか：この表はもともと「予定日」しか持っていなかった。
 *    しかし後から「この形は過去どうなったか」を測るとき、効くのは**結果**の方
 *    （日銀が動いたのか据え置いたのか／介入が単独か協調か）。
 *    日付だけ貯めても、あとで一件ずつ調べ直す羽目になる。
 *
 * 🔵 予定しか無いイベント（将来のFOMC等）には付かない。**確定した過去にだけ付く**。
 */
export type MacroEventDetail = {
  /** バッジの脇に出す1行（例「据え置き」「日米協調」） */
  headline: string
  /** ポップアップに出す説明。**出典が言えることだけ書く**（推測を混ぜない） */
  note: string
}

export type MacroEvent = { type: MacroEventType; detail?: MacroEventDetail }

export const MACRO_META: Record<MacroEventType, { short: string; label: string; category: 'us' | 'jp'; desc: string }> = {
  fomc:   { short: 'FOMC',    label: 'FOMC（声明発表）',         category: 'us',
    desc: 'FRB（連邦準備制度理事会）が年8回開催する金融政策会合。政策金利の変更・維持を決定し声明文を発表。株・債券・為替すべてに大きな影響を与える。' },
  boj:    { short: '日銀',    label: '日銀政策決定会合',         category: 'jp',
    desc: '日本銀行が年8回開催する金融政策決定会合。政策金利や資産買い入れ方針を決定。円相場・日本株に直接影響する。' },
  nfp:    { short: '雇用統計（NFP）', label: '米雇用統計（NFP）',  category: 'us',
    desc: '米労働省が毎月第1金曜日に発表する非農業部門雇用者数（NFP）。米国経済の健全性を示す最重要指標のひとつ。予想との乖離で相場が急変動しやすい。' },
  adp:    { short: 'ADP',     label: 'ADP雇用統計',              category: 'us',
    desc: 'ADP社が公表する米民間部門の雇用者数。政府の雇用統計（NFP）の2営業日前（水曜）に発表され、NFPの先行指標として注目される。' },
  cpi:    { short: 'CPI',     label: '米CPI（消費者物価指数）',  category: 'us',
    desc: '米労働省が発表する消費者物価指数。インフレの代表的指標でFRBの金融政策判断に直結。コアCPI（食品・エネルギー除く）も注目される。' },
  pce:    { short: 'PCE',     label: '米PCE（個人消費支出）',    category: 'us',
    desc: 'FRBが最重視するインフレ指標。個人消費支出に含まれる物価変動を測定し、CPIより幅広い品目をカバー。FRBの目標インフレ率2%の基準となる。' },
  ism:    { short: 'ISM製造', label: 'ISM製造業景気指数',        category: 'us',
    desc: 'ISM（全米供給管理協会）が毎月第1営業日に発表する製造業の景況感指数。50が好不況の分かれ目で、米景気の先行指標として重視される。' },
  tankan: { short: '短観',    label: '日銀短観',                 category: 'jp',
    desc: '日本銀行が四半期ごとに発表する企業短期経済観測調査。大企業・中小企業の景況感（DI）を数値化。日本経済の体温計として機関投資家が注目する。' },
  intervention: { short: '為替介入', label: '為替介入（実施実績）', category: 'jp',
    desc: '財務省が円相場の過度な変動に対処するため実施した外国為替平衡操作。'
      + '🔴 介入は事前に日程が公表されない。ここに載るのは**実施後に確認された実績**だけで、予定ではない。'
      + '介入は水準を作れるが金利差そのものは動かさないため、日銀・FOMCの結果と並べて見ると効き方の違いが分かる。' },
}

// FOMC声明発表日（会合2日目）
const FOMC_DATES: [number, number, number][] = [
  // 2024
  [2024, 0, 31], [2024, 2, 20], [2024, 4,  1], [2024, 5, 12],
  [2024, 6, 31], [2024, 8, 18], [2024, 10,  7], [2024, 11, 18],
  // 2025
  [2025, 0, 29], [2025, 2, 19], [2025, 4,  7], [2025, 5, 18],
  [2025, 6, 30], [2025, 8, 17], [2025, 9, 29], [2025, 11, 10],
  // 2026（一部推定）
  [2026, 0, 28], [2026, 2, 18], [2026, 4,  6], [2026, 5, 17],
  [2026, 6, 29], [2026, 8, 16], [2026, 9, 28], [2026, 11,  9],
]

// 日銀金融政策決定会合（会合最終日）
const BOJ_DATES: [number, number, number][] = [
  // 2024
  [2024, 0, 23], [2024, 2, 19], [2024, 3, 26], [2024, 5, 14],
  [2024, 6, 31], [2024, 8, 20], [2024, 9, 31], [2024, 11, 19],
  // 2025
  [2025, 0, 24], [2025, 2, 19], [2025, 4,  1], [2025, 5, 17],
  [2025, 6, 31], [2025, 8, 19], [2025, 9, 29], [2025, 11, 19],
  // 2026（BOJ公式スケジュール）
  [2026, 0, 23], [2026, 2, 19], [2026, 3, 28], [2026, 5, 16],
  [2026, 6, 31], [2026, 8, 18], [2026, 9, 30], [2026, 11, 18],
]

// 米CPI発表日
const CPI_DATES: [number, number, number][] = [
  // 2024
  [2024, 0, 11], [2024, 1, 13], [2024, 2, 12], [2024, 3, 10],
  [2024, 4, 15], [2024, 5, 12], [2024, 6, 11], [2024, 7, 14],
  [2024, 8, 11], [2024, 9, 10], [2024, 10, 13], [2024, 11, 11],
  // 2025
  [2025, 0, 15], [2025, 1, 12], [2025, 2, 12], [2025, 3, 10],
  [2025, 4, 12], [2025, 5, 11], [2025, 6, 15], [2025, 7, 12],
  [2025, 8, 10], [2025, 9, 15], [2025, 10, 12], [2025, 11, 10],
  // 2026
  [2026, 0, 14], [2026, 1, 11], [2026, 2, 11], [2026, 3, 10],
  [2026, 4, 12], [2026, 5, 10], [2026, 6, 14], [2026, 7, 12],
  [2026, 8,  9], [2026, 9, 13], [2026, 10, 12], [2026, 11,  9],
]

// 日銀短観発表日（四半期）
const TANKAN_DATES: [number, number, number][] = [
  // 2024
  [2024, 3,  1], [2024, 6,  1], [2024, 9,  1], [2024, 11, 13],
  // 2025
  [2025, 3,  1], [2025, 6,  1], [2025, 9,  1], [2025, 11, 12],
  // 2026（推定）
  [2026, 3,  1], [2026, 6,  1], [2026, 9,  1], [2026, 11, 11],
]

// 米PCE発表日
const PCE_DATES: [number, number, number][] = [
  // 2024
  [2024, 0, 26], [2024, 1, 29], [2024, 2, 29], [2024, 3, 26],
  [2024, 4, 31], [2024, 5, 28], [2024, 6, 26], [2024, 7, 30],
  [2024, 8, 27], [2024, 9, 31], [2024, 10, 27], [2024, 11, 20],
  // 2025
  [2025, 0, 31], [2025, 1, 28], [2025, 2, 28], [2025, 3, 30],
  [2025, 4, 30], [2025, 5, 27], [2025, 6, 25], [2025, 7, 29],
  [2025, 8, 26], [2025, 9, 31], [2025, 10, 26], [2025, 11, 19],
  // 2026（推定）
  [2026, 0, 30], [2026, 1, 27], [2026, 2, 27], [2026, 3, 30],
  [2026, 4, 29], [2026, 5, 26], [2026, 6, 31], [2026, 7, 28],
  [2026, 8, 25], [2026, 9, 30], [2026, 10, 25], [2026, 11, 18],
]

// 米国雇用統計発表日（原則：毎月第1金曜日）
const NFP_DATES: [number, number, number][] = [
  // 2024
  [2024, 0,  5], [2024, 1,  2], [2024, 2,  8], [2024, 3,  5],
  [2024, 4,  3], [2024, 5,  7], [2024, 6,  5], [2024, 7,  2],
  [2024, 8,  6], [2024, 9,  4], [2024, 10,  1], [2024, 11,  6],
  // 2025
  [2025, 0, 10], [2025, 1,  7], [2025, 2,  7], [2025, 3,  4],
  [2025, 4,  2], [2025, 5,  6], [2025, 6,  3], [2025, 7,  1],
  [2025, 8,  5], [2025, 9,  3], [2025, 10,  7], [2025, 11,  5],
  // 2026
  [2026, 0,  9], [2026, 1,  6], [2026, 2,  6], [2026, 3,  3],
  [2026, 4,  8], [2026, 5,  5], [2026, 6,  2], [2026, 7,  7], // 7/4=Sat → 7/2 (Thu moved? No, 7/3 is Fri)
  [2026, 8,  4], [2026, 9,  2], [2026, 10,  6], [2026, 11,  4],
]
// 補正: 2026/7 → Jul1=Wed, first Fri = Jul3
const _fixNFP2026Jul = NFP_DATES.find(d => d[0] === 2026 && d[1] === 6)
if (_fixNFP2026Jul) _fixNFP2026Jul[2] = 3

// ADP雇用統計発表日: 雇用統計（NFP）の2営業日前（＝NFPが金曜のため水曜）。NFP_DATES から自動導出。
// 月跨ぎ（NFPが月初の場合）も Date 演算で正しく前月日付になる。
const ADP_DATES: [number, number, number][] = NFP_DATES.map(([y, m, d]) => {
  const dt = new Date(Date.UTC(y, m, d))
  dt.setUTCDate(dt.getUTCDate() - 2)
  return [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()]
})

// ISM製造業景気指数発表日: 毎月第1営業日（土日・元日を除く）。
// ※第1営業日が原則だが、米国の祝日事情で稀に1日ずれる月がある。年次更新（docs/maintenance/
//   calendar-dates-check.md）で実日程を確認・補正すること。
function firstBusinessDay(year: number, month: number): [number, number, number] {
  const dt = new Date(Date.UTC(year, month, 1))
  for (;;) {
    const wd = dt.getUTCDay()
    const isWeekend = wd === 0 || wd === 6
    const isNewYear = dt.getUTCMonth() === 0 && dt.getUTCDate() === 1
    if (!isWeekend && !isNewYear) break
    dt.setUTCDate(dt.getUTCDate() + 1)
  }
  return [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()]
}
const ISM_DATES: [number, number, number][] = []
for (let yr = 2024; yr <= 2026; yr++) {
  for (let mo = 0; mo < 12; mo++) ISM_DATES.push(firstBusinessDay(yr, mo))
}


// ── 実績として貯めるデータ ────────────────────────────────
//
// 🔴 ここは「予定」ではなく**起きたことの記録**。事前に日程が決まらない介入と、
//    日付だけでは意味が取れない日銀の結果を残す。後から
//    「介入だけの時／金利差が動いた時で、その後どうなったか」を測れるようにするのが目的。
//
// 🔴 **確認できた出典があるものだけ入れる**。推測で埋めない（埋めると検証の土台が壊れる）。
//    追加するときは実施額・単独/協調まで分かる資料（財務省の公表、日経・時事等）を確認する。

/** キーは 'YYYY-MM-DD'（ローカル日付）。 */
const INTERVENTION_RESULTS: Record<string, MacroEventDetail> = {
  // 2022年（24年ぶりの円買い介入。合計 約9兆1,880億円・いずれも単独）
  '2022-09-22': { headline: '単独・約2.8兆円', note: '24年ぶりの円買い介入（単独）。約2兆8,382億円。当日は5円以上下げたが、翌月には150円台に戻り効果が疑問視された。' },
  '2022-10-21': { headline: '単独・約5.6兆円', note: '覆面介入（単独）。約5兆6,202億円。151円台での実施。この後ドル円は下落に転じ、一定の成果を上げたとされる。' },
  '2022-10-24': { headline: '単独・約0.7兆円', note: '覆面介入（単独）。約7,296億円。' },

  // 2024年（4-5月で約9.8兆円、7月で約5.5兆円。いずれも単独）
  '2024-04-29': { headline: '単独', note: '円買い介入（単独）。4/29と5/2で合計 約9.8兆円。' },
  '2024-05-02': { headline: '単独', note: '円買い介入（単独）。4/29と5/2で合計 約9.8兆円。' },
  '2024-07-11': { headline: '単独', note: '円買い介入（単独）。7/11と7/12で合計 約5.5兆円。この後、日銀利上げと米利下げ観測が重なりトレンドが転換した。' },
  '2024-07-12': { headline: '単独', note: '円買い介入（単独）。7/11と7/12で合計 約5.5兆円。' },

  // 2026年
  '2026-07-30': { headline: '単独', note: '約3ヶ月ぶりの円買い介入（単独）。米当局はレートチェックを実施。162円台後半から157円台へ約5円上昇したが、その後160円超へ戻された。' },
  '2026-07-31': { headline: '🔴 日米協調', note: '日米協調の円買い介入。日本はドル売り・円買い、米当局はユーロ売り・円買いで共同歩調。協調介入は2011年の東日本大震災直後以来15年ぶり、円買いでは1998年以来28年ぶり。2025年9月の日米財務大臣共同声明に基づく。米国が加わったのは、日本の通貨安・債券安が米長期金利の上昇に波及するのを懸念したため。8/3に片山財務相が談話で公表し「更なる協調介入も躊躇しない」と表明した。' },
}

/**
 * 日銀会合の結果。**日付だけでは「動いたのか」が分からない**ので結果を残す。
 * 🔴 分かっている回だけ入れる。空欄＝未記録であって「据え置き」ではない。
 */
const BOJ_RESULTS: Record<string, MacroEventDetail> = {
  '2026-07-31': { headline: '据え置き', note: '政策金利を据え置き。利上げ継続の姿勢は維持し、利上げ加速は9月以降に「しっかり議論」するとした。🔴 同じ日に日米協調介入が行われており、**介入はあったが金利差は動いていない**局面。次回会合は2026-09-18。' },
}

/** ローカル日付を 'YYYY-MM-DD' にする（UTC変換を挟むと日付がずれるため自前で組む）。 */
function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function getMacroEventsForDate(date: Date, filter: MacroFilter): MacroEvent[] {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const events: MacroEvent[] = []

  const key = dateKey(y, m, d)

  const check = (list: [number, number, number][], type: MacroEventType, results?: Record<string, MacroEventDetail>) => {
    if (list.some(([ly, lm, ld]) => ly === y && lm === m && ld === d)) {
      // 結果が記録されている日だけ detail を付ける（予定日には付かない）
      events.push(results?.[key] ? { type, detail: results[key] } : { type })
    }
  }

  if (filter.us) {
    check(FOMC_DATES, 'fomc')
    check(NFP_DATES, 'nfp')
    check(ADP_DATES, 'adp')
    check(CPI_DATES, 'cpi')
    check(PCE_DATES, 'pce')
    check(ISM_DATES, 'ism')
  }
  if (filter.jp) {
    check(BOJ_DATES, 'boj', BOJ_RESULTS)
    check(TANKAN_DATES, 'tankan')
    // 介入は予定日リストを持たない＝実績があった日にだけ出る
    if (INTERVENTION_RESULTS[key]) {
      events.push({ type: 'intervention', detail: INTERVENTION_RESULTS[key] })
    }
  }

  return events
}

/**
 * 記録済みの為替介入日（古い順）。R&Dスクリプトから「介入の翌日以降どうなったか」を測るのに使う。
 * 🔴 アプリの表示には使わない（表示は getMacroEventsForDate 経由）。
 */
export function getInterventionDates(): string[] {
  return Object.keys(INTERVENTION_RESULTS).sort()
}
