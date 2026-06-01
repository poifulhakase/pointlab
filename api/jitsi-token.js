import { SignJWT, importPKCS8 } from 'jose'
import { createPrivateKey } from 'crypto'
import admin from 'firebase-admin'

// Firebase Admin は遅延初期化する。以前はモジュール読み込み時に初期化していたため、
// FIREBASE_SERVICE_ACCOUNT 未設定/不正だと cert() が throw → 関数全体が
// FUNCTION_INVOCATION_FAILED でクラッシュし、原因の見えない 500 になっていた。
// handler 内で getAdmin() を try/catch し、不備時は 503 を返して原因を明示する。
let _admin = null
function getAdmin() {
  if (!_admin) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
    const sa = JSON.parse(raw) // 不正 JSON はここで throw → handler が 503 を返す
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(sa) })
    }
    _admin = { db: admin.firestore(), auth: admin.auth() }
  }
  return _admin
}

// Firestore ベースの簡易レート制限（per uid + action）。
// api/_ratelimit.js と同一ロジックだが、当ファイルは jose のため ESM 固定で、
// CJS(_ratelimit.js)を "type":"module" 下で default import できないためインラインで持つ。
async function rateLimit(db, uid, action, maxPerWindow, windowMs) {
  if (!uid) return true
  const ref = db.collection('rateLimits').doc(`${uid}__${action}`)
  const now = Date.now()
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      let count = 0
      let windowStart = now
      if (snap.exists) {
        const d = snap.data() || {}
        count = typeof d.count === 'number' ? d.count : 0
        windowStart = typeof d.windowStart === 'number' ? d.windowStart : now
      }
      if (now - windowStart > windowMs) { count = 0; windowStart = now }
      count++
      tx.set(ref, { count, windowStart, updatedAt: now })
      return count <= maxPerWindow
    })
  } catch {
    return true // 判定失敗時はフェイルオープン（正規利用を阻害しない）
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' })

  // Firebase Admin の遅延初期化。env 不備でもクラッシュさせず 503 を返す。
  let db, auth
  try {
    ({ db, auth } = getAdmin())
  } catch (e) {
    console.error('[jitsi-token] admin init failed:', e)
    return res.status(503).json({ error: 'Auth service unavailable (server misconfiguration)' })
  }

  // 認証: idToken は Authorization ヘッダーで受け取る（URL ログへの漏洩を避ける）。
  const authHeader = req.headers.authorization || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return res.status(401).json({ error: 'Unauthorized' })

  let decoded
  try {
    decoded = await auth.verifyIdToken(idToken)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
  // uid / email はクエリではなく検証済みトークンから採用（なりすまし防止）。
  const uid   = decoded.uid
  const email = decoded.email ?? ''

  const { room, name } = req.query ?? {}
  if (!room) return res.status(400).json({ error: 'Missing parameters' })

  // レート制限（uid あたり 60秒で最大20回。入退室・再接続を考慮した上限）。
  const ok = await rateLimit(db, uid, 'jitsi-token', 20, 60_000)
  if (!ok) return res.status(429).json({ error: 'Too many requests' })

  const appId  = process.env.JAAS_APP_ID
  const keyId  = process.env.JAAS_KEY_ID
  const rawKey = process.env.JAAS_PRIVATE_KEY

  if (!appId || !keyId || !rawKey) {
    return res.status(500).json({ error: 'JaaS not configured' })
  }

  try {
    const pem = rawKey.replace(/\\n/g, '\n')

    const nodeKey    = createPrivateKey({ key: pem, format: 'pem' })
    const privateKey = await importPKCS8(
      nodeKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      'RS256'
    )

    // kid は JaaS ダッシュボードの Key ID と完全一致が必要
    // 形式: "vpaas-magic-cookie-xxx/uuid" — appId プレフィックスがなければ補完
    const kid = keyId.includes('/') ? keyId : `${appId}/${keyId}`

    // 管理者判定は検証済み uid（ADMIN_UID）または検証済み email（ADMIN_EMAIL）で行う。
    const adminUid   = process.env.ADMIN_UID ?? ''
    const adminEmail = process.env.ADMIN_EMAIL ?? ''
    const isModerator =
      (adminUid !== '' && uid === adminUid) ||
      (adminEmail !== '' && email === adminEmail)

    const token = await new SignJWT({
      aud: 'jitsi',
      iss: 'chat',
      sub: appId,
      room: '*',
      context: {
        user: {
          moderator: isModerator,
          name:  name  ?? 'ユーザー',
          email,
          id:    uid,
        },
        features: {
          livestreaming:   false,
          recording:       false,
          transcription:   false,
          'outbound-call': false,
        },
      },
    })
      .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .setNotBefore('-10s')
      .sign(privateKey)

    return res.json({ token })
  } catch (e) {
    console.error('[jitsi-token] error:', e)
    return res.status(500).json({ error: 'Token generation failed' })
  }
}
