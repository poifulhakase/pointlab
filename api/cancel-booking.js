// 予約キャンセル（サーバー側）。
// 以前はクライアントが直接 slots/{id}.isBooked を書き換えていたため、
// 任意ユーザーが任意スロットの予約状態を改ざんできる穴があった。
// 本 API（Admin SDK）に集約し、本人 or 管理者のみがキャンセル＋スロット解放できるようにする。
const admin = require('firebase-admin')
const rateLimit = require('./_ratelimit')

const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
const db   = admin.firestore()
const auth = admin.auth()

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

  const { idToken, bookingId } = body
  if (!idToken || !bookingId) return res.status(400).json({ error: 'Missing fields' })

  let decoded
  try {
    decoded = await auth.verifyIdToken(idToken)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
  const userId  = decoded.uid
  const isAdmin = !!ADMIN_EMAIL && decoded.email === ADMIN_EMAIL

  // レート制限（uid あたり 60秒で最大10回）
  const ok = await rateLimit(db, userId, 'cancel-booking', 10, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  try {
    await db.runTransaction(async (tx) => {
      const bookRef  = db.collection('bookings').doc(bookingId)
      const bookSnap = await tx.get(bookRef)
      if (!bookSnap.exists) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' })
      const booking = bookSnap.data()

      // 本人 or 管理者のみ
      if (!isAdmin && booking.userId !== userId) {
        throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' })
      }

      const now = new Date().toISOString()
      tx.update(bookRef, {
        status:    isAdmin ? 'cancelled_admin' : 'cancelled_user',
        updatedAt: now,
      })

      // スロット解放
      if (booking.slotId) {
        const slotRef = db.collection('slots').doc(booking.slotId)
        const slotSnap = await tx.get(slotRef)
        if (slotSnap.exists) tx.update(slotRef, { isBooked: false })
      }
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    if (e && e.code === 'NOT_FOUND')  return res.status(404).json({ error: '予約が見つかりません' })
    if (e && e.code === 'FORBIDDEN')  return res.status(403).json({ error: '権限がありません' })
    return res.status(500).json({ error: 'キャンセルに失敗しました' })
  }
}
