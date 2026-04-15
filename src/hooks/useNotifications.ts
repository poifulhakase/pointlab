import { useEffect } from 'react'
import { getAllNoteData } from '../utils/noteStorage'
import { getSettings } from '../utils/settingsStorage'
import { hasAlertFired, markAlertFired, cleanOldAlerts } from '../utils/alertStorage'

const CHECK_INTERVAL_MS = 30_000  // 30秒ごとにチェック
const FIRE_WINDOW_MS    = 5 * 60 * 1000  // アラート時刻から5分以内なら発火

async function sendEmailViaEmailJS(
  title: string,
  dateLabel: string,
  startTime: string,
  settings: ReturnType<typeof getSettings>
) {
  if (!settings.emailjsServiceId || !settings.emailjsTemplateId || !settings.emailjsPublicKey || !settings.email) return
  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  settings.emailjsServiceId,
        template_id: settings.emailjsTemplateId,
        user_id:     settings.emailjsPublicKey,
        template_params: {
          to_email:    settings.email,
          event_title: title || '（無題）',
          event_date:  dateLabel,
          event_time:  startTime,
        },
      }),
    })
  } catch {
    // ネットワークエラーは無視
  }
}

function fireBrowserNotification(title: string, dateLabel: string, startTime: string, alertMinutes: number) {
  if (Notification.permission !== 'granted') return
  const body = `${dateLabel} ${startTime} のスケジュール（${alertMinutes}分前）`
  new Notification(`🔔 ${title || '（無題）'}`, { body, icon: '/favicon.svg' })
}

function checkAndFire() {
  cleanOldAlerts()
  const settings = getSettings()
  const notes    = getAllNoteData()
  const nowMs    = Date.now()

  for (const [dateKey, note] of notes) {
    if (!note.scheduled || !note.startTime || !note.alertMinutes) continue

    const [y, m, d] = dateKey.split('-').map(Number)
    const [h, min]  = note.startTime.split(':').map(Number)
    const eventMs   = new Date(y, m - 1, d, h, min, 0).getTime()
    const alertMs   = eventMs - note.alertMinutes * 60 * 1000

    if (nowMs < alertMs || nowMs > alertMs + FIRE_WINDOW_MS) continue

    const alertKey = `${dateKey}|${note.startTime}|${note.alertMinutes}`
    if (hasAlertFired(alertKey)) continue

    markAlertFired(alertKey)

    const dateLabel = new Date(y, m - 1, d).toLocaleDateString('ja-JP', {
      month: 'long', day: 'numeric', weekday: 'short',
    })

    if (settings.browserNotifEnabled) {
      fireBrowserNotification(note.title, dateLabel, note.startTime, note.alertMinutes)
    }
    if (settings.emailEnabled) {
      sendEmailViaEmailJS(note.title, dateLabel, note.startTime, settings)
    }
  }
}

export function useNotifications() {
  useEffect(() => {
    // ブラウザ通知の許可状態を確認（未決定なら後でユーザーが設定パネルから許可）
    checkAndFire()
    const id = setInterval(checkAndFire, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
