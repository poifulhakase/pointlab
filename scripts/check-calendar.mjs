// ─────────────────────────────────────────────────────────────────────────
// カレンダーの点検（`npm run check-calendar`）。
//
// 見るのは2つ:
//   ① **祝日の判定が正しいか** … 内閣府が公表している「国民の祝日」CSV（一次情報）と突き合わせる。
//      🔴 `marketCalendar.mjs` の春分・秋分は**近似計算**で、振替休日・国民の休日も自前の実装。
//         ここがズレると「祝日なのに営業日扱い」＝休場日に発注する事故になる（CLAUDE.md の不変ルール）。
//   ② **日程がいつ尽きるか** … FOMC・日銀・CPI・NYSE休場日などは**手で足した配列**。
//      🔴 尽きても**エラーにはならず、ただ静かに何も出なくなる**。
//         「イベントが無い週」と見分けがつかないので、切れる前に知らせる。
//
// 失敗（exit 1）すると、`fetch-data.yml` の通知が #エラー・異常 に流す。
//
//   node scripts/check-calendar.mjs [--days 90]
//     --days … 日程の残りがこの日数を切ったら失敗にする（既定 90）
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isNationalHoliday, toYmd } from '../src/utils/marketCalendar.mjs'

const HOLIDAY_CSV = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv'
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')

const argDays = process.argv.indexOf('--days')
const WARN_DAYS = argDays > 0 ? Number(process.argv[argDays + 1]) : 90

let failed = false
const fail = (msg) => { failed = true; console.error(`🔴 ${msg}`) }

// ── ① 祝日の判定を内閣府CSVと突き合わせる ────────────────────────────

/** 内閣府CSV（Shift_JIS）→ { 'YYYY-MM-DD': '名称' } */
async function fetchOfficialHolidays() {
  const res = await fetch(HOLIDAY_CSV)
  if (!res.ok) throw new Error(`内閣府CSVが取れない: HTTP ${res.status}`)
  // 🔴 このCSVは Shift_JIS。UTF-8 として読むと名称が化ける（日付だけ使うなら影響ないが、
  //    差分の説明に名称を出すので正しく読む）。
  const text = new TextDecoder('shift_jis').decode(await res.arrayBuffer())

  const out = {}
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [ymd, name] = line.split(',')
    if (!ymd) continue
    const [y, m, d] = ymd.split('/').map(Number)
    if (!y || !m || !d) continue
    out[`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = (name || '').trim()
  }
  return out
}

function checkHolidays(official) {
  const days = Object.keys(official).sort()
  if (days.length === 0) {
    fail('内閣府CSVから祝日を1件も読めなかった（様式変更を疑う）')
    return
  }
  // 🔵 過去まで全部見ても意味が薄いので、去年の頭から CSV の末尾まで。
  const from = new Date(new Date().getFullYear() - 1, 0, 1)
  const to = new Date(days[days.length - 1])

  const missing = []   // CSVにあるのに、こちらが祝日と判定しない＝**発注事故の側**
  const extra = []     // こちらが祝日と判定するのに、CSVに無い＝取引機会を落とす側

  for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    const ymd = toYmd(cursor)
    const isOfficial = ymd in official
    const isOurs = isNationalHoliday(new Date(cursor))
    if (isOfficial && !isOurs) missing.push(`${ymd} ${official[ymd]}`)
    if (!isOfficial && isOurs) extra.push(ymd)
  }

  console.log(`祝日の突合: 内閣府 ${days.length}件 / 照合期間 ${toYmd(from)}〜${toYmd(to)}`)
  if (missing.length) {
    fail(`祝日を見落としている ${missing.length}件（休場日に発注する側の事故）:`)
    missing.forEach((m) => console.error(`   ・${m}`))
  }
  if (extra.length) {
    fail(`祝日でない日を休場と判定している ${extra.length}件:`)
    extra.forEach((m) => console.error(`   ・${m}`))
  }
  if (!missing.length && !extra.length) console.log('  ✅ 内閣府の公表と一致')
}

// ── ② 手で足した日程が、いつ尽きるか ─────────────────────────────────

/** `[2026, 11, 9]`（月は0始まり）の並びを拾って、最後の日付を返す。 */
function lastDateOf(source, name) {
  const block = source.match(
    new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\]`),
  )
  if (!block) return null
  const dates = [...block[1].matchAll(/\[\s*(\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\s*\]/g)]
    .map(([, y, m, d]) => new Date(Number(y), Number(m), Number(d)))
    .sort((a, b) => a - b)
  return dates.length ? dates[dates.length - 1] : null
}

function checkCoverage() {
  const macro = readFileSync(resolve(repo, 'src/utils/macroCalendar.ts'), 'utf-8')
  const market = readFileSync(resolve(repo, 'src/utils/marketCalendar.mjs'), 'utf-8')

  // 🔵 自動導出のもの（ADP・ISM・FOMC議事要旨）は元の配列が伸びれば一緒に伸びるので見ない。
  //
  // 🔴 `recheckFrom` ＝「この日以降は取得元が翌年分を公表しているはず」の目安。
  //    出どころによって公表時期が違う（FOMC・NYSEは何年も先まで出るが、
  //    BLS/BEAは前年の秋、日銀短観は12か月先までを6月末・12月末に出す）。
  //    **公表前は失敗にしない**。3か月赤を出し続けると狼少年になって本当の
  //    足し忘れに気づけなくなる（DISCORD.md 4章）。
  //    その日を過ぎても入っていなければ失敗＝人が見にいく合図になる。
  const targets = [
    ['FOMC_DATES', macro, 'FOMC', null],
    ['BOJ_DATES', macro, '日銀 金融政策決定会合', null],
    ['NYSE_HOLIDAYS', market, 'NYSE休場日', null],
    // 2026-09-20 に確認：BLS・BEA とも 2027年分は未公表だった
    ['CPI_DATES', macro, '米CPI', '2026-10-15'],
    ['NFP_DATES', macro, '米雇用統計', '2026-10-15'],
    ['PCE_DATES', macro, '米PCE', '2026-11-15'],
    // 短観は12か月先までしか出ない（6月末・12月末に更新）
    ['TANKAN_DATES', macro, '日銀短観', '2027-01-15'],
  ]

  const today = new Date()
  console.log(`\n日程のカバレッジ（残り${WARN_DAYS}日を切ったら失敗）:`)
  for (const [name, source, label, recheckFrom] of targets) {
    const last = lastDateOf(source, name)
    if (!last) {
      fail(`${label}（${name}）の配列が読めない（書き方が変わった？）`)
      continue
    }
    const left = Math.floor((last - today) / 86400000)
    // 🔵 全角と半角が混ざるので桁揃えはしない（環境によってズレて逆に読みにくい）
    const line = `  ${label}: 〜${toYmd(last)}（あと${left}日）`
    if (left >= WARN_DAYS) {
      console.log(line)
    } else if (recheckFrom && today < new Date(recheckFrom)) {
      // 🔵 取得元がまだ翌年分を出していない時期。待ちであって、足し忘れではない
      console.log(`${line}  ← 取得元の公表待ち（${recheckFrom} から再確認）`)
    } else {
      fail(`${line}  ← 切れる前に足す（docs/maintenance/calendar-dates-check.md）`)
    }
  }
}

// ── 実行 ──────────────────────────────────────────────────────────────

try {
  checkHolidays(await fetchOfficialHolidays())
} catch (e) {
  // 🔴 取れなかったことを「問題なし」にしない。取得できない＝点検できていない。
  fail(`祝日の突合ができなかった: ${e.message}`)
}
checkCoverage()

if (failed) {
  console.error('\n🔴 カレンダーの点検で問題を検出した。')
  // 🔴 `process.exit()` を使わない。fetch の後始末が終わる前に落とすと Windows の Node が
  //    `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` を吐いて**終了コードが 127** になり、
  //    本当の失敗理由がログで埋もれる（2026-09-20 に踏んだ）。
  process.exitCode = 1
} else {
  console.log('\n✅ カレンダーの点検: 問題なし')
}
