const ALLOWED_ORIGIN = 'https://pointlab.vercel.app'

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(date, startTime) {
  const d = new Date(`${date}T${startTime}:00+09:00`)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAYS[d.getDay()]}）${startTime}`
}

function buildHtml(title, lines) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;background:#f4f4f4;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08)">
    <div style="background:#0369a1;padding:20px 24px">
      <h1 style="margin:0;font-size:18px;color:#fff;letter-spacing:.04em">ぽいロボ コネクト</h1>
    </div>
    <div style="padding:24px">
      ${lines.map(l => `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#1e293b">${l}</p>`).join('')}
    </div>
    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">このメールは自動送信です。返信はできません。</p>
    </div>
  </div>
</body>
</html>`
}

async function sendMail(to, subject, html) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not set')

  // RESEND_FROM_EMAIL または後方互換で RESEND_FROM_DOMAIN を使用
  // 値はメールアドレス形式（例: noreply@yourdomain.com）で設定すること
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM_DOMAIN || 'onboarding@resend.dev'
  if (!fromEmail.includes('@')) {
    throw new Error(`送信元メールアドレスが不正です。RESEND_FROM_EMAIL に "noreply@yourdomain.com" 形式で設定してください。現在の値: "${fromEmail}"`)
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `ぽいロボ <${fromEmail}>`, to: [to], subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
}

export default async function handler(req, res) {
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

  const { type, booking } = body
  if (!type || !booking) return res.status(400).json({ error: 'Missing fields' })

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL
  if (!ADMIN_EMAIL) return res.status(500).json({ error: 'ADMIN_EMAIL not configured' })

  const label       = formatDate(booking.date, booking.startTime)
  const safeName    = escapeHtml(booking.userDisplayName)
  const safeEmail   = escapeHtml(booking.userEmail)
  const safeMessage = escapeHtml(booking.adminMessage)

  try {
    if (type === 'request') {
      // Notify admin
      await sendMail(
        ADMIN_EMAIL,
        `【コネクト予約申請】${booking.userDisplayName} さん`,
        buildHtml('予約申請通知', [
          `<strong>${safeName}</strong>（${safeEmail}）さんから予約申請が届きました。`,
          `日時：<strong>${label}</strong>`,
          `管理パネルで承認・却下をお願いします。`,
        ]),
      )
      // Confirm to user
      await sendMail(
        booking.userEmail,
        '【ぽいロボ コネクト】予約申請を受け付けました',
        buildHtml('予約申請受付', [
          `${safeName} さん、ご予約申請ありがとうございます。`,
          `日時：<strong>${label}</strong>`,
          `ぽいふる博士が内容を確認し、承認メールをお送りします。今しばらくお待ちください。`,
        ]),
      )
    } else if (type === 'confirm') {
      await sendMail(
        booking.userEmail,
        '【ぽいロボ コネクト】予約が確定しました',
        buildHtml('予約確定', [
          `${safeName} さん、予約が確定しました！`,
          `日時：<strong>${label}</strong>`,
          booking.adminMessage ? `博士からのメッセージ：${safeMessage}` : '',
          `当日はぽいロボ コネクトボタンから接続してください。`,
        ].filter(Boolean)),
      )
    } else if (type === 'cancel_user') {
      await sendMail(
        ADMIN_EMAIL,
        `【コネクト予約キャンセル】${booking.userDisplayName} さん`,
        buildHtml('キャンセル通知', [
          `${safeName}（${safeEmail}）さんが予約をキャンセルしました。`,
          `日時：${label}`,
        ]),
      )
      await sendMail(
        booking.userEmail,
        '【ぽいロボ コネクト】予約をキャンセルしました',
        buildHtml('キャンセル完了', [
          `${safeName} さん、予約のキャンセルを受け付けました。`,
          `日時：${label}`,
          `またのご予約をお待ちしております。`,
        ]),
      )
    } else if (type === 'cancel_admin') {
      await sendMail(
        booking.userEmail,
        '【ぽいロボ コネクト】予約がキャンセルされました',
        buildHtml('予約キャンセル', [
          `${safeName} さん、大変申し訳ございません。`,
          `以下の予約がキャンセルされました。`,
          `日時：${label}`,
          booking.adminMessage ? `博士からのメッセージ：${safeMessage}` : '',
          `改めてご予約ください。`,
        ].filter(Boolean)),
      )
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[send-booking-email]', msg)
    return res.status(500).json({ error: `メール送信エラー: ${msg}` })
  }
}
