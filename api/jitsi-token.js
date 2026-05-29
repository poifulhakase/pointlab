import { SignJWT, importPKCS8 } from 'jose'
import { createPrivateKey } from 'crypto'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' })

  const { room, name, email, uid } = req.query ?? {}
  if (!room || !uid) return res.status(400).json({ error: 'Missing parameters' })

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

    // uid で管理者判定（email クエリパラメータは信頼しない）
    const adminUid = process.env.ADMIN_UID ?? ''
    const isModerator = adminUid !== '' && uid === adminUid

    const token = await new SignJWT({
      aud: 'jitsi',
      iss: 'chat',
      sub: appId,
      room: '*',
      context: {
        user: {
          moderator: isModerator,
          name:  name  ?? 'ユーザー',
          email: email ?? '',
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
