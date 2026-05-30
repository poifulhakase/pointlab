import { useState, useEffect, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { enablePush, disablePush, syncPushSettings } from '../utils/fcmNotifications'
import { getSettings, type PoiroboAlertConfig } from '../utils/settingsStorage'
import { LS } from '../utils/storageKeys'

/**
 * プッシュ通知（FCM）の ON/OFF・種別設定の管理。
 * 書き込みは fcmNotifications 経由（FCMトークン取得 + Firestore 保存）。
 */
export function usePushNotifications(user: User | null, poiroboAlertConfig: PoiroboAlertConfig) {
  const [pushEnabled,     setPushEnabled]     = useState<boolean>(() => localStorage.getItem(LS.pushEnabled) === 'true')
  const [notifyRadar,     setNotifyRadar]     = useState<boolean>(() => localStorage.getItem(LS.notifyRadar) !== 'false')
  const [notifyDataReady, setNotifyDataReady] = useState<boolean>(() => localStorage.getItem(LS.notifyDataReady) === 'true')
  const [pushToast,       setPushToast]       = useState<string | null>(null)
  const [pushBusy,        setPushBusy]        = useState(false)

  useEffect(() => {
    if (!pushToast) return
    const t = setTimeout(() => setPushToast(null), 4000)
    return () => clearTimeout(t)
  }, [pushToast])

  const handleTogglePush = useCallback(async () => {
    if (!user || pushBusy) return
    setPushBusy(true)
    try {
      if (pushEnabled) {
        await disablePush(user.uid)
        setPushEnabled(false)
        localStorage.setItem(LS.pushEnabled, 'false')
      } else {
        const result = await enablePush(user.uid, notifyRadar, notifyDataReady, getSettings().poiroboAlertConfig)
        if (result === 'ok') {
          setPushEnabled(true)
          localStorage.setItem(LS.pushEnabled, 'true')
        } else if (result === 'permission-denied') {
          setPushToast('ブラウザの通知をブロックしています。アドレスバー左の🔒から「通知」を許可してください。')
        } else if (result === 'no-token') {
          setPushToast('FCMトークンの取得に失敗しました。しばらくしてから再試行してください。')
        } else {
          setPushToast('通知の登録に失敗しました。コンソールを確認してください。')
        }
      }
    } finally {
      setPushBusy(false)
    }
  }, [user, pushEnabled, pushBusy, notifyRadar, notifyDataReady])

  const handleToggleNotifyRadar = useCallback(() => {
    if (!user || !pushEnabled) return
    const next = !notifyRadar
    setNotifyRadar(next)
    localStorage.setItem(LS.notifyRadar, String(next))
    syncPushSettings(user.uid, next, notifyDataReady, poiroboAlertConfig).catch(() => {})
  }, [user, pushEnabled, notifyRadar, notifyDataReady, poiroboAlertConfig])

  const handleToggleNotifyDataReady = useCallback(() => {
    if (!user || !pushEnabled) return
    const next = !notifyDataReady
    setNotifyDataReady(next)
    localStorage.setItem(LS.notifyDataReady, String(next))
    syncPushSettings(user.uid, notifyRadar, next, poiroboAlertConfig).catch(() => {})
  }, [user, pushEnabled, notifyRadar, notifyDataReady, poiroboAlertConfig])

  useEffect(() => {
    if (pushEnabled && user) {
      syncPushSettings(user.uid, notifyRadar, notifyDataReady, poiroboAlertConfig).catch(() => {})
    }
  }, [pushEnabled, user, notifyRadar, notifyDataReady, poiroboAlertConfig])

  return {
    pushEnabled, pushBusy, pushToast, notifyRadar, notifyDataReady,
    handleTogglePush, handleToggleNotifyRadar, handleToggleNotifyDataReady,
  }
}
