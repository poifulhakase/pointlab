// 信用期日（ぽいロボ画面＝旧ロボ口座・2026-09-16 新設）
//
// 考え方（ユーザーの見立て）＝**株価が下げる中で信用買いが積み上がった期間は、その半年後に
// 制度信用の期日が来て売りが出尽くし、需給が良くなる**。次の買い場を見極めるための目安。
//
// 判定：制度買残が前週より増え、同じ週に株価（週足の終値）が下がった週＝「悪化」。
//       それが **MIN_WEEKS 週以上続いた期間**を「悪化期間」として出す（1〜2週はノイズとして捨てる）。
// 期日：悪化期間の初日・最終日のそれぞれ6か月後。休場日なら前の営業日へ寄せる。
//
// 🔴 **制度信用の買残で判定する**（一般信用は期日が長いか無期限で、6か月では決済されない）。
//    IHI で合計（制度＋一般）を使ったときと結果が変わりうる。
// 🔴 データは `scripts/archive-margin-weekly.mjs` が **2026-08-14 の週から**貯めたものだけ。
//    それより前の悪化期間は判定できない（JPX は直近5週しか公開していない）。
// 🔵 ここは読むだけ。貯めるのは GitHub Actions（fetch-data.yml）。

import { isMarketClosed } from './marketHolidays'

export const MIN_WEEKS = 3

/** 週の信用残（JPX）。 */
export type MarginWeek = { w: string; sysLong: number; genLong: number; sysShort: number; genShort: number }
/** 週足（Yahoo）。date はその週の最初の日（JST）。 */
export type WeeklyBar = { date: string; open: number; high: number; low: number; close: number }

export type MarginRun = {
  /** 悪化期間の初日（最初の悪化週の月曜）と最終日（最後の悪化週の週末日） */
  from: string
  to: string
  weeks: number
  sysLongFrom: number
  sysLongTo: number
  closeFrom: number
  closeTo: number
  /** 期日の目安（営業日に寄せたもの） */
  kijitsuFrom: string
  kijitsuTo: string
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** n か月後の同じ日（無ければ月末）。 */
export function addMonths(s: string, n: number): string {
  const d = parse(s)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  return ymd(target)
}

/** 休場日なら前の営業日へ。 */
export function toBusinessDayBack(s: string, closed: (d: Date) => boolean = isMarketClosed): string {
  const d = parse(s)
  while (closed(d)) d.setDate(d.getDate() - 1)
  return ymd(d)
}

/** 週末日（金曜など）→ その週の終値。週足の date（週の初日）〜+6日に入る足を使う。 */
export function closeOfWeek(w: string, bars: WeeklyBar[]): number | null {
  for (const b of bars) {
    if (b.date <= w && w <= addDays(b.date, 6)) return b.close
  }
  return null
}

/** その日を含む週の月曜。 */
const mondayOf = (s: string) => {
  const d = parse(s)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return ymd(d)
}

/**
 * 悪化期間を探す（純粋関数）。
 * 🔴 週が2週より空いたら（データの欠け）連続とはみなさない。
 */
export function findRuns(
  margin: MarginWeek[],
  bars: WeeklyBar[],
  opts: { minWeeks?: number; closed?: (d: Date) => boolean } = {},
): MarginRun[] {
  const minWeeks = opts.minWeeks ?? MIN_WEEKS
  const rows = [...margin]
    .sort((a, b) => a.w.localeCompare(b.w))
    .map((m) => ({ ...m, close: closeOfWeek(m.w, bars) }))

  const runs: MarginRun[] = []
  let cur: Omit<MarginRun, 'kijitsuFrom' | 'kijitsuTo'> | null = null
  const flush = () => {
    if (cur && cur.weeks >= minWeeks) {
      runs.push({
        ...cur,
        kijitsuFrom: toBusinessDayBack(addMonths(cur.from, 6), opts.closed),
        kijitsuTo: toBusinessDayBack(addMonths(cur.to, 6), opts.closed),
      })
    }
    cur = null
  }

  for (let i = 1; i < rows.length; i++) {
    const p = rows[i - 1]
    const x = rows[i]
    const gap = (parse(x.w).getTime() - parse(p.w).getTime()) / 86400000
    if (gap > 14) flush()
    const bad = gap <= 14 && p.close != null && x.close != null && x.sysLong > p.sysLong && x.close < p.close
    if (!bad) { flush(); continue }
    if (!cur) {
      cur = {
        from: mondayOf(x.w), to: x.w, weeks: 0,
        sysLongFrom: p.sysLong, sysLongTo: x.sysLong,
        closeFrom: p.close as number, closeTo: x.close as number,
      }
    }
    cur.to = x.w
    cur.weeks++
    cur.sysLongTo = x.sysLong
    cur.closeTo = x.close as number
  }
  flush()
  return runs
}

// ── 読み込み ─────────────────────────────────────────

type MarginIndex = { updatedAt: string; weeks: string[] }
type MarginWeekFile = { w: string; rows: Record<string, [number, number, number, number]> }

const base = () => `${import.meta.env.BASE_URL}data/margin_weekly/`
const weekCache = new Map<string, Promise<MarginWeekFile | null>>()
let indexCache: Promise<MarginIndex> | null = null
let namesCache: Promise<Record<string, string>> | null = null

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** 貯めた週の一覧。force で取り直す（週が増えたかを見る）。 */
export function loadMarginIndex(force = false): Promise<MarginIndex> {
  if (force || !indexCache) {
    indexCache = getJson<MarginIndex>(`${base()}index.json`, { cache: 'no-store' })
    indexCache.catch(() => { indexCache = null })
    if (force) namesCache = null
  }
  return indexCache
}

export function loadMarginNames(): Promise<Record<string, string>> {
  if (!namesCache) {
    namesCache = getJson<Record<string, string>>(`${base()}names.json`, { cache: 'no-store' })
    namesCache.catch(() => { namesCache = null })
  }
  return namesCache
}

/** 週のファイルは一度書いたら変わらないので、画面を開いている間は使い回す。 */
function loadWeek(w: string): Promise<MarginWeekFile | null> {
  let p = weekCache.get(w)
  if (!p) {
    p = getJson<MarginWeekFile>(`${base()}${w}.json`).catch(() => null)
    weekCache.set(w, p)
  }
  return p
}

/** 1銘柄の信用残の推移（古い順）。 */
export async function loadMarginSeries(code: string, force = false): Promise<{ weeks: number; series: MarginWeek[] }> {
  const idx = await loadMarginIndex(force)
  const files = await Promise.all(idx.weeks.map(loadWeek))
  const series: MarginWeek[] = []
  for (const f of files) {
    const r = f?.rows[code]
    if (r) series.push({ w: f!.w, sysLong: r[0], genLong: r[1], sysShort: r[2], genShort: r[3] })
  }
  return { weeks: idx.weeks.length, series }
}

/** 週足（約2年）。force で CDN のキャッシュを避ける。 */
export async function loadWeeklyBars(code: string, force = false): Promise<WeeklyBar[]> {
  const bust = force ? `&t=${Date.now()}` : ''
  const res = await fetch(`/api/stocks-daily?only=weekly&code=${encodeURIComponent(code)}${bust}`)
  const json = (await res.json().catch(() => ({}))) as { data?: WeeklyBar[]; error?: string }
  if (!res.ok || !json.data) throw new Error(json.error ?? `株価を取得できませんでした（${res.status}）`)
  return json.data
}

/** 入力を銘柄コード（4桁・英字は大文字）に整える。全角も受ける。 */
export function normalizeCode(input: string): string | null {
  const s = input
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim()
    .toUpperCase()
  return /^[0-9][0-9A-Z]{3}$/.test(s) ? s : null
}

// ── 一覧の印 ─────────────────────────────────────────

export type MarginBadge = 'kijitsu' | 'bad' | null

/** 期日の目安の前後に何日広げて「期日」の印を付けるか。 */
export const BADGE_MARGIN_DAYS = 14

/**
 * 一覧に付ける印（純粋関数）。
 * - 'kijitsu'＝期日の目安の期間中、またはその前後2週間（BADGE_MARGIN_DAYS）
 * - 'bad'＝悪化期間が**最新の週まで続いている**（まだ積み上がっている最中）
 * 両方に当たるときは期日を優先する（近い将来の出来事のほうが見落とせないため）。
 */
export function badgeOf(runs: MarginRun[], latestWeek: string | null, today: string): MarginBadge {
  const inKijitsu = runs.some((r) =>
    addDays(r.kijitsuFrom, -BADGE_MARGIN_DAYS) <= today && today <= addDays(r.kijitsuTo, BADGE_MARGIN_DAYS))
  if (inKijitsu) return 'kijitsu'
  if (latestWeek && runs.some((r) => r.to === latestWeek)) return 'bad'
  return null
}
