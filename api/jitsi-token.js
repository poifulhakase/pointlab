import { SignJWT, importPKCS8 } from 'jose'
import { createPrivateKey } from 'crypto'

const ADMIN_EMAIL = 'sushi.ramen.unajyu@gmail.com'

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

    // createPrivateKey は PKCS1・PKCS8 両形式を受け付ける
    const nodeKey    = createPrivateKey({ key: pem, format: 'pem' })
    const privateKey = await importPKCS8(
      nodeKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      'RS256'
    )

    const token = await new SignJWT({
      aud: 'jitsi',
      iss: 'chat',
      sub: appId,
      room: String(room),
      context: {
        user: {
          moderator: email === ADMIN_EMAIL ? 'true' : 'false',
          name:  name  ?? 'ユーザー',
          email: email ?? '',
          id:    uid,
        },
        features: {
          livestreaming:     'false',
          recording:         'false',
          transcription:     'false',
          'outbound-call':   'false',
        },
      },
    })
      .setProtectedHeader({ alg: 'RS256', kid: String(keyId), typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .setNotBefore('-10s')
      .sign(privateKey)

    return res.json({ token })
  } catch (e) {
    console.error('[jitsi-token] error:', e)
    return res.status(500).json({ error: 'Token generation failed', detail: String(e) })
  }
}
