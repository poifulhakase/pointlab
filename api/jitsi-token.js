/**
 * JaaS (Jitsi as a Service) JWT トークン発行エンドポイント
 * 環境変数: JAAS_APP_ID / JAAS_KEY_ID / JAAS_PRIVATE_KEY
 */

const ADMIN_EMAIL = 'sushi.ramen.unajyu@gmail.com'

module.exports = async (req, res) => {
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
    // Vercel 環境変数の \n リテラルを実際の改行に復元
    const privateKeyPem = rawKey.replace(/\\n/g, '\n')

    const { SignJWT, importPKCS8 } = await import('jose')
    const privateKey = await importPKCS8(privateKeyPem, 'RS256')

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
      .setProtectedHeader({ alg: 'RS256', kid: String(keyId) })
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
