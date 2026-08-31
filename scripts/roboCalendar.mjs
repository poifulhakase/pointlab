// ──────────────────────────────────────────────────────────────────────────
// 疑似トレードが見るカレンダー。
//
// 役割は2つ。
//   1) 🔴 今日が東証の営業日かどうか（休場なら判断も通知もしない）
//   2) これから5営業日ぶんのイベント（FOMC・日銀・CPI…）をプロンプトへ渡す
//
// 休場判定は `src/utils/marketCalendar.mjs`（アプリと共通の単一情報源）。
// イベントは `src/utils/macroCalendar.ts` を Node の型ストリップで直接読む。
// 🔴 イベントは取れなくても判断は続ける（あれば効く、無くても止めない）。
// ──────────────────────────────────────────────────────────────────────────

import {
  isMarketClosed, closedLabel, toYmd, parseYmd, upcomingBusinessDays,
} from '../src/utils/marketCalendar.mjs'

/** 実行時点の「日本時間の今日」。Actions は UTC で走るので明示的に JST へ寄せる */
export function todayJst() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return parseYmd(parts)
}

/**
 * 東証が開いているか。
 * @returns {{ open: boolean, date: string, reason: string | null }}
 */
export function marketStatus(date = todayJst()) {
  const closed = isMarketClosed(date)
  return { open: !closed, date: toYmd(date), reason: closed ? (closedLabel(date) ?? '休場') : null }
}

/**
 * これから n 営業日ぶんのイベント一覧を1つの文字列にする。
 * 取得できなければ null（プロンプトからはイベント節ごと落ちる）。
 */
export async function upcomingEventsText(date = todayJst(), n = 5) {
  let mod
  try {
    mod = await import('../src/utils/macroCalendar.ts')
  } catch {
    return null   // 型ストリップが使えない環境 → イベント無しで進む
  }
  const { getMacroEventsForDate, MACRO_META } = mod
  if (typeof getMacroEventsForDate !== 'function') return null

  const days = [date, ...upcomingBusinessDays(date, n - 1)]
  const lines = []
  for (const d of days) {
    let events = []
    try {
      events = getMacroEventsForDate(d, { us: true, jp: true }) ?? []
    } catch { events = [] }
    if (!events.length) continue
    const labels = events.map(e => {
      const meta = MACRO_META?.[e.type]
      const name = meta?.label ?? e.type
      return e.detail?.headline ? `${name}（${e.detail.headline}）` : name
    })
    const when = toYmd(d) === toYmd(date) ? '本日' : toYmd(d)
    lines.push(`  ${when}: ${labels.join(' / ')}`)
  }
  if (!lines.length) return `  今後${n}営業日に主要イベントの予定はありません。`
  return lines.join('\n')
}

/**
 * 数営業日内に「値が飛ぶ」大きなイベントがあるか。損切りの幅を広げる判断に使う。
 *
 * 🔴 ATR は過去の値幅なので、イベント前は**まだ広がっていない**。
 *    その狭い幅のまま損切りを置くと、当日の窓であっさり飛び越される。
 * 🔴 対象は「その日に値が飛ぶ」ものだけに絞る（FOMC・日銀・米CPI・雇用統計・ジャクソンホール・SQ）。
 *    何でも拾うとほぼ毎日 true になり、ただ損切りが広いだけの設定になる。
 *
 * 🆕 2026-08-24：**ジャクソンホールを追加**。相場が動くのは2日目のFRB議長の基調講演で、
 *    それは**金曜の夜（日本時間22〜23時ごろ）＝東京の引け後**。反応が出るのは**週明けの寄り**になり、
 *    しかも週末をまたぐぶん窓が開きやすい。ATRの狭いままの損切りだと寄りで飛び越される。
 *    🔵 会議は木〜土の3日間だが、`getMacroEventsForDate` は3日とも `jacksonhole` を返すので、
 *       木曜の時点から広めに構えることになる（年1回・3日なので「毎日true」にはならない）。
 *
 * @returns {Promise<boolean>} 判定できないときは false（＝広げない・従来どおり）
 */
const WIDEN_EVENTS = ['fomc', 'boj', 'cpi', 'nfp', 'jacksonhole']

export async function eventNear(date = todayJst(), n = 2) {
  let macro, sq
  try {
    macro = await import('../src/utils/macroCalendar.ts')
    sq    = await import('../src/utils/sqCalendar.ts')
  } catch {
    return false   // 型ストリップが使えない環境 → 広げない（従来どおり）
  }
  const { getMacroEventsForDate } = macro
  const { getSqDates, getSqMarkersForDate } = sq
  if (typeof getMacroEventsForDate !== 'function') return false

  const days = [date, ...upcomingBusinessDays(date, n)]
  for (const d of days) {
    try {
      const events = getMacroEventsForDate(d, { us: true, jp: true }) ?? []
      if (events.some(e => WIDEN_EVENTS.includes(e.type))) return true
    } catch { /* 拾えない日は無視して続ける */ }
    // 🔴 SQ は macroCalendar には入っていない（別ファイル）。ここで拾わないと素通りする。
    try {
      if ((getSqMarkersForDate(d, getSqDates(d.getFullYear())) ?? []).length) return true
    } catch { /* 同上 */ }
  }
  return false
}
