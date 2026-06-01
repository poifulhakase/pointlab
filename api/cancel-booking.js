// 予約キャンセル（サーバー側）。
// 以前はクライアントが直接 slots/{id}.isBooked を書き換えていたため、
// 任意ユーザーが任意スロットの予約状態を改ざんできる穴があった。
// 本 API（Admin SDK）に集約し、本人 or 管理者のみがキャンセル＋スロット解放できるようにする。
import admin from 'firebase-admin'
import rateLimit from './_ratelimit.js'

const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

// Firebase Admin は遅延初期化（env 不備でモジュール読み込み時にクラッシュさせない）。
let _admin = null
function getAdmin() {
  if (!_admin) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
    const sa = JSON.parse(raw)
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    }
    _admin = { db: admin.firestore(), auth: admin.auth() }
  }
  return _admin
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })
  if (origin !== ALLOWED_ORIGIN) return res.status(403).json({ error: 'Forbidden' })

  let db, auth
  try {
    ({ db, auth } = getAdmin())
  } catch (e) {
    console.error('[cancel-booking] admin init failed:', e)
    return res.status(503).json({ error: 'Booking service unavailable (server misconfiguration)' })
  }

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

      // ── 読み取りは全て書き込みより前に行う（Firestore トランザクション制約）──
      // スロット解放のための読み取りをここで先に済ませる。以前は booking 更新（write）の
      // 後に slot を tx.get（read）していたため "reads before writes" 違反で
      // トランザクションが失敗し、キャンセルが常に 500 になっていた。
      let slotRef = null
      if (booking.slotId) {
        slotRef = db.collection('slots').doc(booking.slotId)
        const slotSnap = await tx.get(slotRef)
        if (!slotSnap.exists) slotRef = null // スロットが既に無ければ解放不要
      }

      // ── 書き込み ──
      const now = new Date().toISOString()
      tx.update(bookRef, {
        status:    isAdmin ? 'cancelled_admin' : 'cancelled_user',
        updatedAt: now,
      })
      if (slotRef) tx.update(slotRef, { isBooked: false })
    })
    return res.status(200).json({ ok: true })
  } catch (e) {
    if (e && e.code === 'NOT_FOUND')  return res.status(404).json({ error: '予約が見つかりません' })
    if (e && e.code === 'FORBIDDEN')  return res.status(403).json({ error: '権限がありません' })
    return res.status(500).json({ error: 'キャンセルに失敗しました' })
  }
}
