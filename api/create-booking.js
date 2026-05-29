const admin = require('firebase-admin')

const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'

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

  const { idToken, slotId, userDisplayName, userEmail } = body
  if (!idToken || !slotId) return res.status(400).json({ error: 'Missing fields' })

  // ID トークン検証
  let decoded
  try {
    decoded = await auth.verifyIdToken(idToken)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
  const userId = decoded.uid

  try {
    let bookingId
    await db.runTransaction(async (tx) => {
      // 既存アクティブ予約チェック
      const existingSnap = await db.collection('bookings')
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'confirmed'])
        .get()
      if (!existingSnap.empty) throw Object.assign(new Error('LIMIT_EXCEEDED'), { code: 'LIMIT_EXCEEDED' })

      // スロット空き確認
      const slotRef  = db.collection('slots').doc(slotId)
      const slotSnap = await tx.get(slotRef)
      if (!slotSnap.exists || slotSnap.data().isBooked) {
        throw Object.assign(new Error('SLOT_UNAVAILABLE'), { code: 'SLOT_UNAVAILABLE' })
      }
      const slot = slotSnap.data()

      // 予約作成
      const now    = new Date().toISOString()
      const bookRef = db.collection('bookings').doc()
      tx.set(bookRef, {
        userId,
        userDisplayName: userDisplayName || '',
        userEmail:       userEmail || '',
        slotId,
        date:        slot.date,
        startTime:   slot.startTime,
        status:      'pending',
        adminMessage: '',
        requestedAt: now,
        updatedAt:   now,
      })

      // スロットを予約済みにマーク
      tx.update(slotRef, { isBooked: true })

      bookingId = bookRef.id
    })

    return res.status(200).json({ ok: true, bookingId })
  } catch (e) {
    const code = e.code ?? ''
    if (code === 'LIMIT_EXCEEDED')   return res.status(409).json({ error: 'LIMIT_EXCEEDED' })
    if (code === 'SLOT_UNAVAILABLE') return res.status(409).json({ error: 'SLOT_UNAVAILABLE' })
    console.error('[create-booking]', e)
    return res.status(500).json({ error: '予約処理に失敗しました' })
  }
}
