import { useEffect } from 'react'
import { getAllNoteData } from '../utils/noteStorage'
import { getSettings } from '../utils/settingsStorage'
import { hasAlertFired, markAlertFired, cleanOldAlerts } from '../utils/alertStorage'

const CHECK_INTERVAL_MS = 30_000
const FIRE_WINDOW_MS    = 5 * 60 * 1000

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
    const schedules = note.schedules ?? []

    for (const sch of schedules) {
      if (!sch.startTime || !sch.alertMinutes) continue

      const [y, m, d] = dateKey.split('-').map(Number)
      const [h, min]  = sch.startTime.split(':').map(Number)
      const eventMs   = new Date(y, m - 1, d, h, min, 0).getTime()
      const alertMs   = eventMs - sch.alertMinutes * 60 * 1000

      if (nowMs < alertMs || nowMs > alertMs + FIRE_WINDOW_MS) continue

      const alertKey = `${dateKey}|${sch.id}|${sch.startTime}|${sch.alertMinutes}`
      if (hasAlertFired(alertKey)) continue

      markAlertFired(alertKey)

      const dateLabel = new Date(y, m - 1, d).toLocaleDateString('ja-JP', {
        month: 'long', day: 'numeric', weekday: 'short',
      })

      if (settings.browserNotifEnabled) {
        fireBrowserNotification(sch.title || note.title, dateLabel, sch.startTime, sch.alertMinutes)
      }
    }
  }
}

export function useNotifications() {
  useEffect(() => {
    checkAndFire()
    const id = setInterval(checkAndFire, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
