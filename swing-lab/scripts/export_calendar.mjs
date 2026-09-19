// ─────────────────────────────────────────────────────────────────────────
// ぽいロボのカレンダーを JSON に書き出す（swing-lab の Python から読むため）。
//
// 🔴 なぜ移植しないか：`src/utils/marketCalendar.mjs` は CLAUDE.md で
//    「休場判定を二箇所に書くと、片方だけ直して祝日に発注する事故になる」と
//    単一情報源に指定されている。Python に書き写すとまさにそれをやることになる。
//    だから **JS 側を正のまま実行して結果だけ受け取る**。
//
// 使い方（stock-calendar 直下で）:
//   npx tsx swing-lab/scripts/export_calendar.mjs [開始年] [終了年]
//   → swing-lab/data_cache/calendar.json
// ─────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isMarketClosed, getClosedReason, toYmd } from '../../src/utils/marketCalendar.mjs'
import { getMacroEventsForDate, MACRO_META } from '../../src/utils/macroCalendar.ts'
import { getSqDates } from '../../src/utils/sqCalendar.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '..', 'data_cache', 'calendar.json')

const startYear = Number(process.argv[2] ?? new Date().getFullYear() - 1)
const endYear = Number(process.argv[3] ?? new Date().getFullYear() + 1)

const closed = {}
const macro = {}
const sq = {}

for (let year = startYear; year <= endYear; year += 1) {
  for (const s of getSqDates(year)) {
    sq[toYmd(s.date)] = s.type
  }
}

const cursor = new Date(startYear, 0, 1)
const end = new Date(endYear, 11, 31)
while (cursor <= end) {
  const ymd = toYmd(cursor)

  if (isMarketClosed(cursor)) {
    closed[ymd] = getClosedReason(cursor) ?? '休場'
  }

  const events = getMacroEventsForDate(cursor, { us: true, jp: true })
  if (events.length > 0) {
    macro[ymd] = events.map((e) => ({
      type: e.type,
      short: MACRO_META[e.type]?.short ?? e.type,
      label: MACRO_META[e.type]?.label ?? e.type,
      category: MACRO_META[e.type]?.category ?? 'us',
      // 実績としての補足（確定した過去にだけ付く）
      headline: e.detail?.headline ?? null,
    }))
  }

  cursor.setDate(cursor.getDate() + 1)
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'stock-calendar: src/utils/{marketCalendar.mjs,macroCalendar.ts,sqCalendar.ts}',
  from: `${startYear}-01-01`,
  to: `${endYear}-12-31`,
  closed,
  macro,
  sq,
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(payload, null, 1), 'utf-8')

console.log(
  `calendar.json: 休場${Object.keys(closed).length}日 / マクロ${Object.keys(macro).length}日 / SQ${Object.keys(sq).length}日` +
    ` (${startYear}-${endYear}) -> ${outPath}`,
)
