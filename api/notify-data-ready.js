// POST /api/notify-data-ready
// GitHub Actions fetch-data.yml の土曜ジョブ成功後に呼び出す
// x-notify-secret ヘッダーで認証

import admin from 'firebase-admin'

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
    _admin = { db: admin.firestore(), fcm: admin.messaging() }
  }
  return _admin
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const secret = process.env.NOTIFY_SECRET
  if (!secret || req.headers['x-notify-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let db, fcm
  try {
    ({ db, fcm } = getAdmin())
  } catch (e) {
    console.error('[notify-data-ready] admin init failed:', e)
    return res.status(503).json({ error: 'Notify service unavailable (server misconfiguration)' })
  }

  const snap = await db.collection('pushSubscriptions')
    .where('pushEnabled', '==', true)
    .where('notifyDataReady', '==', true)
    .get()

  let sent = 0
  const errors = []
  const tokensToDelete = []

  for (const docSnap of snap.docs) {
    const { fcmToken } = docSnap.data()
    if (!fcmToken) continue

    try {
      await fcm.send({
        token: fcmToken,
        notification: {
          title: 'ぽいロボ データ更新',
          body:  '今週の需給データが更新されました',
        },
        webpush: {
          notification: {
            title: 'ぽいロボ データ更新',
            body:  '今週の需給データが更新されました',
            icon:  'https://pointlab.vercel.app/calendar/icon-192.png',
            badge: 'https://pointlab.vercel.app/calendar/icon-192.png',
          },
          fcmOptions: { link: 'https://pointlab.vercel.app/stock-calendar' },
        },
      })
      sent++
    } catch (e) {
      const msg = String(e)
      // トークン切れ（登録解除済み）は削除キューに追加
      if (msg.includes('registration-token-not-registered') || msg.includes('invalid-registration-token')) {
        tokensToDelete.push(docSnap.ref)
      } else {
        errors.push({ uid: docSnap.id, error: msg })
      }
    }
  }

  // 期限切れトークンをクリーンアップ
  await Promise.allSettled(tokensToDelete.map(ref => ref.update({ fcmToken: '', pushEnabled: false })))

  console.log(`[notify-data-ready] sent=${sent} errors=${errors.length} deleted=${tokensToDelete.length}`)
  return res.status(200).json({ sent, errors, deleted: tokensToDelete.length })
}
