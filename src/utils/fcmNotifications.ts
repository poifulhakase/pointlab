import { app } from './firebase'
import { restSetDoc } from './firestoreRest'
import type { PoiroboAlertConfig } from './settingsStorage'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string

export type PushSettings = {
  fcmToken: string
  pushEnabled: boolean
  poiroboAlertEnabled: boolean
  poiroboAlertConfig: PoiroboAlertConfig
}

async function getMessagingModule() {
  const { getMessaging, getToken, deleteToken } = await import('firebase/messaging')
  return { getMessaging, getToken, deleteToken }
}

export type EnablePushResult = 'ok' | 'permission-denied' | 'no-token' | 'error'

/** 通知許可を取得して FCM トークンを登録 */
export async function enablePush(
  uid: string,
  poiroboAlertEnabled: boolean,
  poiroboAlertConfig: PoiroboAlertConfig
): Promise<EnablePushResult> {
  try {
    if (!('Notification' in window)) {
      console.warn('[FCM] Notification API not supported')
      return 'error'
    }
    console.log('[FCM] current permission:', Notification.permission)
    const permission = await Notification.requestPermission()
    console.log('[FCM] requestPermission result:', permission)
    if (permission !== 'granted') return 'permission-denied'

    const { getMessaging, getToken } = await getMessagingModule()
    const messaging = getMessaging(app)
    console.log('[FCM] vapidKey present:', !!VAPID_KEY)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    console.log('[FCM] token:', token ? token.slice(0, 20) + '…' : 'null')
    if (!token) return 'no-token'

    console.log('[FCM] writing to Firestore via REST, uid:', uid)
    await restSetDoc(`pushSubscriptions/${uid}`, {
      fcmToken: token,
      pushEnabled: true,
      poiroboAlertEnabled,
      poiroboAlertConfig: poiroboAlertConfig as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    })
    console.log('[FCM] Firestore write ok')

    return 'ok'
  } catch (e) {
    console.error('[FCM] enablePush failed:', e)
    return 'error'
  }
}

/** 通知を無効化 */
export async function disablePush(uid: string): Promise<void> {
  try {
    const { getMessaging, deleteToken } = await getMessagingModule()
    await deleteToken(getMessaging(app))
  } catch { /* token削除失敗は無視 */ }

  try {
    await restSetDoc(`pushSubscriptions/${uid}`, { pushEnabled: false, fcmToken: '' })
  } catch (e) {
    console.error('[FCM] disablePush failed:', e)
  }
}

/** ぽいロボアラート設定を Firestore に同期 */
export async function syncPushAlertConfig(
  uid: string,
  poiroboAlertEnabled: boolean,
  poiroboAlertConfig: PoiroboAlertConfig
): Promise<void> {
  try {
    await restSetDoc(`pushSubscriptions/${uid}`, {
      poiroboAlertEnabled,
      poiroboAlertConfig: poiroboAlertConfig as unknown as Record<string, unknown>,
    })
  } catch { /* ドキュメント未作成時は無視 */ }
}
