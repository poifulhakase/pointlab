// 毎日 12:30 JST (03:30 UTC) に実行
// ぽいロボレーダーで翌日のイベントをプッシュ通知で送信

import admin from 'firebase-admin'

// ── Firebase Admin 初期化（遅延・env 不備でモジュール読み込み時にクラッシュさせない）──
let _admin = null
function getAdmin() {
  if (!_admin) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
    const sa = JSON.parse(raw)
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    }
    _admin = { db: admin.firestore(), fcm: admin.messaging() }
  }
  return _admin
}

// ── イベントラベル ─────────────────────────────────────────────────────
const EVENT_LABELS = {
  majorSq:         'メジャーSQ',
  miniSq:          'ミニSQ',
  fomc:            'FOMC（声明発表）',
  boj:             '日銀政策決定会合',
  nfp:             '米雇用統計',
  cpi:             '米CPI',
  pce:             '米PCE',
  gdp:             '米GDP速報値',
  tankan:          '日銀短観',
  saishu:          '権利付最終日',
  ochi:            '権利落ち日',
  kakutei:         '権利確定日',
  january_effect:  '1月効果',
  setsubun_top:    '節分天井',
  nisa_day:        'NISAの日',
  higan_bottom:    '彼岸底',
  new_fiscal_year: '新年度入り',
  sell_in_may:     'セルインメイ',
  investment_day:  '投資の日',
  xmas_rally:      'クリスマスラリー',
  tax_loss_selling:'タックスロスセリング',
}

// ── 祝日計算 ──────────────────────────────────────────────────────────
function nthMonday(year, month, n) {
  const d = new Date(year, month, 1)
  const offset = (1 - d.getDay() + 7) % 7
  d.setDate(1 + offset + (n - 1) * 7)
  return d
}

function isBaseHoliday(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  const fixed = [[1,1],[2,11],[2,23],[4,29],[5,3],[5,4],[5,5],[8,11],[11,3],[11,23]]
  if (fixed.some(([fm,fd]) => m === fm && d === fd)) return true
  if (m === 1  && sameDay(date, nthMonday(y, 0, 2))) return true
  if (m === 7  && sameDay(date, nthMonday(y, 6, 3))) return true
  if (m === 9  && sameDay(date, nthMonday(y, 8, 3))) return true
  if (m === 10 && sameDay(date, nthMonday(y, 9, 2))) return true
  const shunbun = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  const shubun  = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  if (m === 3 && d === shunbun) return true
  if (m === 9 && d === shubun)  return true
  return false
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isSubstituteHoliday(date) {
  const wd = date.getDay()
  if (wd === 0 || wd === 6) return false
  if (isBaseHoliday(date)) return false
  let sundayHolidayCount = 0
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  while (true) {
    const w = d.getDay()
    if (w === 6) break
    if (w === 0) {
      if (isBaseHoliday(d)) { sundayHolidayCount++; d.setDate(d.getDate() - 1) }
      else break
    } else {
      const prevD = new Date(d); prevD.setDate(d.getDate() - 1)
      const nextD = new Date(d); nextD.setDate(d.getDate() + 1)
      if (isBaseHoliday(d) || (isBaseHoliday(prevD) && isBaseHoliday(nextD))) d.setDate(d.getDate() - 1)
      else break
    }
  }
  return sundayHolidayCount >= 1
}

function isNationalHoliday(date) {
  if (isBaseHoliday(date)) return true
  if (isSubstituteHoliday(date)) return true
  const day = date.getDay()
  if (day !== 0 && day !== 6) {
    const prev = new Date(date); prev.setDate(date.getDate() - 1)
    const next = new Date(date); next.setDate(date.getDate() + 1)
    if (isBaseHoliday(prev) && isBaseHoliday(next)) return true
  }
  return false
}

function isMarketClosed(date) {
  const day = date.getDay()
  if (day === 0 || day === 6) return true
  if (isNationalHoliday(date)) return true
  const m = date.getMonth() + 1, d = date.getDate()
  if ((m === 12 && d === 31) || (m === 1 && (d === 2 || d === 3))) return true
  return false
}

function isTradingDay(d) { return !isMarketClosed(d) }

function addTradingDays(from, n) {
  const d = new Date(from)
  const step = n > 0 ? 1 : -1
  let rem = Math.abs(n)
  while (rem > 0) { d.setDate(d.getDate() + step); if (isTradingDay(d)) rem-- }
  return d
}

function nthTradingDay(year, month, n) {
  const d = new Date(year, month, 1)
  let count = 0
  while (count < n) { if (isTradingDay(d)) count++; if (count < n) d.setDate(d.getDate() + 1) }
  return new Date(d)
}

function nthWeekday(year, month, wd, n) {
  const d = new Date(year, month, 1)
  let count = 0
  while (true) { if (d.getDay() === wd) { count++; if (count === n) return new Date(d) } d.setDate(d.getDate() + 1) }
}

function lastBusinessDay(year, month) {
  const d = new Date(year, month + 1, 0) // 月末
  while (isMarketClosed(d)) d.setDate(d.getDate() - 1)
  return new Date(d)
}

// ── SQ日計算 ──────────────────────────────────────────────────────────
function secondFriday(year, month) {
  const d = new Date(year, month, 1)
  const offset = (5 - d.getDay() + 7) % 7
  d.setDate(1 + offset + 7)
  return d
}

const MAJOR_SQ_MONTHS = [2, 5, 8, 11]

function isSqDate(date, type) {
  const y = date.getFullYear()
  for (let m = 0; m < 12; m++) {
    const sq = secondFriday(y, m)
    if (sameDay(sq, date)) {
      if (type === 'majorSq' && MAJOR_SQ_MONTHS.includes(m)) return true
      if (type === 'miniSq'  && !MAJOR_SQ_MONTHS.includes(m)) return true
    }
  }
  return false
}

// ── マクロイベント日付 ─────────────────────────────────────────────────
const MACRO_DATES = {
  fomc: [
    [2026,0,28],[2026,2,18],[2026,4,6],[2026,5,17],[2026,6,29],[2026,8,16],[2026,9,28],[2026,11,9],
    [2027,0,27],[2027,2,17],[2027,4,5],[2027,5,16],[2027,6,28],[2027,8,15],[2027,9,27],[2027,11,8],
  ],
  boj: [
    [2026,0,23],[2026,2,19],[2026,3,28],[2026,5,16],[2026,6,31],[2026,8,18],[2026,9,30],[2026,11,18],
    [2027,0,22],[2027,2,18],[2027,3,27],[2027,5,15],[2027,6,30],[2027,8,17],[2027,9,29],[2027,11,17],
  ],
  nfp: [
    [2026,0,9],[2026,1,6],[2026,2,6],[2026,3,3],[2026,4,8],[2026,5,5],[2026,6,3],
    [2026,7,7],[2026,8,4],[2026,9,2],[2026,10,6],[2026,11,4],
  ],
  cpi: [
    [2026,0,14],[2026,1,11],[2026,2,11],[2026,3,10],[2026,4,12],[2026,5,10],[2026,6,14],
    [2026,7,12],[2026,8,9],[2026,9,13],[2026,10,12],[2026,11,9],
  ],
  pce: [
    [2026,0,30],[2026,1,27],[2026,2,27],[2026,3,30],[2026,4,29],[2026,5,26],[2026,6,31],
    [2026,7,28],[2026,8,25],[2026,9,30],[2026,10,25],[2026,11,18],
  ],
  gdp: [
    [2026,0,29],[2026,3,29],[2026,6,29],[2026,9,29],
  ],
  tankan: [
    [2026,3,1],[2026,6,1],[2026,9,1],[2026,11,11],
    [2027,3,1],[2027,6,1],[2027,9,1],[2027,11,10],
  ],
}

function isMacroDate(date, type) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate()
  return (MACRO_DATES[type] ?? []).some(([ly,lm,ld]) => ly===y && lm===m && ld===d)
}

// ── 権利日計算 ────────────────────────────────────────────────────────
const DIVIDEND_MONTHS = [2, 5, 8, 11]

function getDividendDates(year) {
  return DIVIDEND_MONTHS.map(mi => {
    const kakutei = lastBusinessDay(year, mi)
    const saishu  = addTradingDays(kakutei, -2)
    const ochi    = addTradingDays(kakutei, -1)
    return { kakutei, saishu, ochi }
  })
}

function isDividendDate(date, type) {
  const y = date.getFullYear()
  for (const set of getDividendDates(y)) {
    if (sameDay(set[type], date)) return true
  }
  return false
}

// ── アノマリー範囲 ─────────────────────────────────────────────────────
const SPRING_EQUINOX = { 2024:20,2025:20,2026:20,2027:21,2028:20,2029:20,2030:20 }

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getAnomalyRanges(year) {
  const ranges = []
  ranges.push({ type:'january_effect',  start:dateStr(nthTradingDay(year,0,1)), end:dateStr(nthTradingDay(year,0,5)) })
  const setsubun = new Date(year,1,3)
  ranges.push({ type:'setsubun_top',     start:dateStr(addTradingDays(setsubun,-2)), end:dateStr(addTradingDays(setsubun,2)) })
  const nisaDay = new Date(year,1,13)
  ranges.push({ type:'nisa_day',         start:dateStr(addTradingDays(nisaDay,-1)), end:dateStr(addTradingDays(nisaDay,1)) })
  const equinoxDay = SPRING_EQUINOX[year] ?? 20
  const equinox = new Date(year,2,equinoxDay)
  ranges.push({ type:'higan_bottom',     start:dateStr(addTradingDays(equinox,-5)), end:dateStr(equinox) })
  ranges.push({ type:'new_fiscal_year',  start:dateStr(nthTradingDay(year,3,1)), end:dateStr(nthTradingDay(year,3,3)) })
  ranges.push({ type:'sell_in_may',      start:dateStr(nthWeekday(year,4,5,1)), end:dateStr(nthWeekday(year,4,5,2)) })
  const investDay = new Date(year,9,4)
  ranges.push({ type:'investment_day',   start:dateStr(addTradingDays(investDay,-1)), end:dateStr(addTradingDays(investDay,1)) })
  const xmasStart = `${year}-12-25`
  // 年内受渡最終日（簡易: 12/28 から逆算）
  let last = new Date(year,11,28)
  while (isMarketClosed(last)) last.setDate(last.getDate()-1)
  const yearEnd = dateStr(addTradingDays(last,-2))
  ranges.push({ type:'xmas_rally',       start:xmasStart, end:yearEnd })
  ranges.push({ type:'tax_loss_selling', start:xmasStart, end:yearEnd })
  return ranges
}

function isAnomalyDate(date, type) {
  const key = dateStr(date)
  const y   = date.getFullYear()
  const ranges = [...getAnomalyRanges(y-1), ...getAnomalyRanges(y), ...getAnomalyRanges(y+1)]
  return ranges.filter(r => r.type === type).some(r => r.start <= key && key <= r.end)
}

// ── 翌日のイベント一覧を取得 ───────────────────────────────────────────
function getTomorrowJST() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  jst.setDate(jst.getDate() + 1)
  return new Date(jst.getFullYear(), jst.getMonth(), jst.getDate())
}

function getTomorrowEvents(tomorrow) {
  const hit = {}
  // SQ
  hit.majorSq = isSqDate(tomorrow, 'majorSq')
  hit.miniSq  = isSqDate(tomorrow, 'miniSq')
  // マクロ
  for (const type of ['fomc','boj','nfp','cpi','pce','gdp','tankan']) {
    hit[type] = isMacroDate(tomorrow, type)
  }
  // 権利日
  hit.saishu  = isDividendDate(tomorrow, 'saishu')
  hit.ochi    = isDividendDate(tomorrow, 'ochi')
  hit.kakutei = isDividendDate(tomorrow, 'kakutei')
  // アノマリー
  for (const type of ['january_effect','setsubun_top','nisa_day','higan_bottom',
                       'new_fiscal_year','sell_in_may','investment_day',
                       'xmas_rally','tax_loss_selling']) {
    hit[type] = isAnomalyDate(tomorrow, type)
  }
  return hit
}

// ── メインハンドラ ────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel Cron または CRON_SECRET による認証
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers['authorization'] ?? ''
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const tomorrow     = getTomorrowJST()
  const tomorrowStr  = dateStr(tomorrow)
  const tomorrowHit  = getTomorrowEvents(tomorrow)

  // 明日イベントなし → スキップ
  if (!Object.values(tomorrowHit).some(Boolean)) {
    return res.status(200).json({ sent: 0, reason: 'no events tomorrow' })
  }

  // Firebase Admin の遅延初期化。env 不備でもクラッシュさせず 503 を返す。
  let db, fcm
  try {
    ({ db, fcm } = getAdmin())
  } catch (e) {
    console.error('[cron-push] admin init failed:', e)
    return res.status(503).json({ error: 'Push service unavailable (server misconfiguration)' })
  }

  // pushEnabled のユーザーを取得（notifyRadar / 旧 poiroboAlertEnabled の絞り込みはループ内で行う）
  const snap = await db.collection('pushSubscriptions')
    .where('pushEnabled', '==', true)
    .get()

  let sent = 0
  const errors = []

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const { fcmToken, poiroboAlertConfig } = data
    if (!fcmToken) continue
    // notifyRadar が未設定の場合は旧フィールド poiroboAlertEnabled で後方互換
    const radarEnabled = data.notifyRadar ?? data.poiroboAlertEnabled ?? false
    if (!radarEnabled) continue

    // ユーザー設定と明日のイベントを照合
    const matched = Object.entries(tomorrowHit)
      .filter(([key, isHit]) => isHit && poiroboAlertConfig?.[key])
      .map(([key]) => EVENT_LABELS[key] ?? key)

    if (matched.length === 0) continue

    const body = `明日は${matched.join('・')}です`

    try {
      await fcm.send({
        token:        fcmToken,
        notification: { title: 'ぽいロボ レーダー', body },
        webpush: {
          notification: {
            title: 'ぽいロボ レーダー',
            body,
            icon:  'https://pointlab.vercel.app/calendar/icon-192.png',
            badge: 'https://pointlab.vercel.app/calendar/icon-192.png',
          },
          fcmOptions: { link: 'https://pointlab.vercel.app/stock-calendar' },
        },
      })
      sent++
    } catch (e) {
      errors.push({ uid: docSnap.id, error: String(e) })
    }
  }

  console.log(`[cron-push] ${tomorrowStr} sent=${sent} errors=${errors.length}`)
  return res.status(200).json({ sent, errors, tomorrowStr, events: tomorrowHit })
}
