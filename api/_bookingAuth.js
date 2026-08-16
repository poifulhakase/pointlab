// 予約通知（メール／プッシュ）の共通ガード。
//
// 🔴 なぜ要るか（2026-08-16）：send-booking-email / send-booking-push は
//    Origin ヘッダしか見ておらず、Origin はブラウザ外から自由に詐称できた。
//    本文の userEmail を宛先にしていたため、**任意のアドレスへ「ぽいロボ」名義の
//    メールを送れる状態**だった（プッシュも同様に任意 uid へ任意文面を送れた）。
//
// 🔴 直し方の要点：
//    ① Authorization: Bearer <idToken> を Admin SDK で検証する
//    ② 宛先・日時・氏名は**本文を信じず Firestore の予約ドキュメントから取る**
//    ③ 誰がどの種類を送れるかを決める（本人＝request / cancel_user、
//       管理者＝confirm / cancel_admin）
//    ④ uid あたりのレート制限をかける
//
// 🔵 `_` プレフィックスなので Vercel のルートとしては公開されない（共有モジュール）。

import rateLimit from './_ratelimit.js'

/** 本人が送れる種類 ／ 管理者だけが送れる種類 */
const OWNER_TYPES = new Set(['request', 'cancel_user'])
const ADMIN_TYPES = new Set(['confirm', 'cancel_admin'])

/** Authorization: Bearer <idToken>（後方互換で body.idToken も見る） */
function readIdToken(req, body) {
  const h = req.headers.authorization || req.headers.Authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(String(h))
  if (m) return m[1].trim()
  return typeof body?.idToken === 'string' ? body.idToken : ''
}

/**
 * 通知リクエストを検証して、**サーバー側の予約データ**を返す。
 *
 * @returns {{ error: string, status: number } | { booking: object, uid: string, isAdmin: boolean }}
 */
export async function authorizeBookingNotify({ req, db, auth, body, action }) {
  const { type, booking } = body || {}
  if (!type || !booking) return { error: 'Missing fields', status: 400 }
  if (!OWNER_TYPES.has(type) && !ADMIN_TYPES.has(type)) {
    return { error: 'Unknown type', status: 400 }
  }

  const idToken = readIdToken(req, body)
  if (!idToken) return { error: 'Unauthorized', status: 401 }

  let decoded
  try {
    decoded = await auth.verifyIdToken(idToken)
  } catch {
    return { error: 'Invalid token', status: 401 }
  }
  const uid = decoded.uid

  // レート制限（uid あたり 60秒で最大10通）。1操作で最大2通送るので少し余裕を持たせる。
  const ok = await rateLimit(db, uid, action, 10, 60_000)
  if (!ok) return { error: 'Too many requests', status: 429 }

  const adminUid   = process.env.ADMIN_UID ?? ''
  const adminEmail = process.env.ADMIN_EMAIL ?? ''
  const isAdmin = (!!adminUid && uid === adminUid) || (!!adminEmail && decoded.email === adminEmail)

  if (ADMIN_TYPES.has(type) && !isAdmin) return { error: 'Forbidden', status: 403 }

  // 🔴 宛先は本文ではなく予約ドキュメントから取る（なりすまし・踏み台の封じ込め）
  const bookingId = typeof booking.id === 'string' ? booking.id : ''
  if (!bookingId) return { error: 'Missing booking id', status: 400 }

  const snap = await db.collection('bookings').doc(bookingId).get()
  if (!snap.exists) return { error: 'Booking not found', status: 404 }
  const server = snap.data() || {}

  if (!isAdmin && server.userId !== uid) return { error: 'Forbidden', status: 403 }

  return {
    uid,
    isAdmin,
    booking: {
      id:              bookingId,
      userId:          server.userId || '',
      userDisplayName: server.userDisplayName || '',
      userEmail:       server.userEmail || '',
      date:            server.date || '',
      startTime:       server.startTime || '',
      status:          server.status || '',
      // 🔵 管理者からの一言だけは本文を採用する。キャンセルは API がドキュメントに
      //    書かないため、ここで拾わないと文面から消えてしまう。送れるのは管理者だけ。
      adminMessage: isAdmin && typeof booking.adminMessage === 'string'
        ? booking.adminMessage
        : (server.adminMessage || ''),
    },
  }
}
