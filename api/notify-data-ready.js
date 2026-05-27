// POST /api/notify-data-ready
// GitHub Actions fetch-data.yml の土曜ジョブ成功後に呼び出す
// x-notify-secret ヘッダーで認証

import admin from 'firebase-admin'

if (!admin.apps.length) {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
const db  = admin.firestore()
const fcm = admin.messaging()

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const secret = process.env.NOTIFY_SECRET
  if (!secret || req.headers['x-notify-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
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
