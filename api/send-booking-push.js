const admin = require('firebase-admin')

const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
const db  = admin.firestore()
const fcm = admin.messaging()

const APP_URL  = 'https://pointlab.vercel.app/stock-calendar'
const ICON_URL = 'https://pointlab.vercel.app/calendar/icon-192.png'

/** pushSubscriptions/{uid} から有効な FCM トークンを取得。未登録/無効なら null */
async function getToken(uid) {
  if (!uid) return null
  const doc = await db.collection('pushSubscriptions').doc(uid).get()
  if (!doc.exists) return null
  const data = doc.data()
  if (!data.pushEnabled || !data.fcmToken) return null
  return data.fcmToken
}

async function sendPush(token, title, body) {
  await fcm.send({
    token,
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon:  ICON_URL,
        badge: ICON_URL,
      },
      fcmOptions: { link: APP_URL },
    },
  })
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || ''
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })
  if (origin !== ALLOWED_ORIGIN) return res.status(403).json({ error: 'Forbidden' })

  let body = req.body
  if (!body || typeof body !== 'object') {
    const raw = await new Promise((resolve, reject) => {
      let d = ''
      req.on('data', c => (d += c))
      req.on('end',  () => resolve(d))
      req.on('error', reject)
    })
    body = raw ? JSON.parse(raw) : {}
  }

  const { type, booking } = body
  if (!type || !booking) return res.status(400).json({ error: 'Missing fields' })

  const ADMIN_UID = process.env.ADMIN_UID
  const dateLabel = `${booking.date} ${booking.startTime}`

  try {
    if (type === 'request') {
      // ユーザー申請 → 管理者に通知
      const token = await getToken(ADMIN_UID)
      if (token) {
        await sendPush(token, 'ぽいロボ コネクト', `新規予約申請：${booking.userDisplayName} さん / ${dateLabel}`)
      }
    } else if (type === 'confirm') {
      // 管理者承認 → ユーザーに通知
      const token = await getToken(booking.userId)
      if (token) {
        await sendPush(token, 'ぽいロボ コネクト', `予約が確定しました：${dateLabel}`)
      }
    } else if (type === 'cancel_admin') {
      // 管理者キャンセル → ユーザーに通知
      const token = await getToken(booking.userId)
      if (token) {
        await sendPush(token, 'ぽいロボ コネクト', `予約がキャンセルされました：${dateLabel}`)
      }
    } else if (type === 'cancel_user') {
      // ユーザーキャンセル → 管理者に通知
      const token = await getToken(ADMIN_UID)
      if (token) {
        await sendPush(token, 'ぽいロボ コネクト', `予約キャンセル：${booking.userDisplayName} さん / ${dateLabel}`)
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[send-booking-push]', e)
    return res.status(500).json({ error: String(e) })
  }
}
