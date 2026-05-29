const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'

function pad(n) { return String(n).padStart(2, '0') }

// ICS フィールド値のエスケープ（RFC 5545: \ , ; CRLF を要エスケープ）
function escapeIcs(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n')
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const [, mo, d] = str.split('-').map(Number)
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31
}

function isValidTime(str) {
  if (!/^\d{2}:\d{2}$/.test(str)) return false
  const [h, m] = str.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function toIcsDate(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM (JST = UTC+9)
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi]    = timeStr.split(':').map(Number)
  const utcH = h - 9
  const date = new Date(Date.UTC(y, mo - 1, d, utcH, mi, 0))
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`
  )
}

module.exports = (req, res) => {
  const origin = req.headers.origin || ''
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return res.status(405).end()

  const { date, startTime, bookingId, name } = req.query ?? {}
  if (!date || !startTime) return res.status(400).end()
  if (!isValidDate(date) || !isValidTime(startTime)) return res.status(400).end()

  const dtStart  = toIcsDate(date, startTime)
  // end = start + 30 minutes
  const [ey, emo, ed] = date.split('-').map(Number)
  const [eh, emi]     = startTime.split(':').map(Number)
  const endDate = new Date(Date.UTC(ey, emo - 1, ed, eh - 9, emi + 30, 0))
  const dtEnd   = (
    `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}` +
    `T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}00Z`
  )

  const uid = `${bookingId || 'booking'}-${Date.now()}@pointlab.vercel.app`
  const safeName = name ? escapeIcs(String(name).slice(0, 100)) : ''
  const summary = `ぽいロボ コネクト${safeName ? ` (${safeName})` : ''}`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PointLab//PoiroboConnect//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    'DESCRIPTION:ぽいふる博士との音声通話セッション',
    `URL:https://pointlab.vercel.app`,
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(date, startTime)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="poirobo-connect.ics"`)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(ics)
}
