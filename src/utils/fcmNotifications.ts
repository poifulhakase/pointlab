import { app } from './firebase'
import type { PoiroboAlertConfig } from './settingsStorage'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string

export type PushSettings = {
  fcmToken: string
  pushEnabled: boolean
  poiroboAlertEnabled: boolean
  poiroboAlertConfig: PoiroboAlertConfig
}

async function getMessagingModule() {
  const [{ getMessaging, getToken, deleteToken }, { app: firebaseApp }] = await Promise.all([
    import('firebase/messaging'),
    import('./firebase'),
  ])
  return { getMessaging, getToken, deleteToken, firebaseApp }
}

async function getFirestoreModule() {
  return import('firebase/firestore')
}

/** 通知許可を取得して FCM トークンを登録 */
export async function enablePush(
  uid: string,
  poiroboAlertEnabled: boolean,
  poiroboAlertConfig: PoiroboAlertConfig
): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const { getMessaging, getToken } = await getMessagingModule()
    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (!token) return false

    const { getFirestore, doc, setDoc, serverTimestamp } = await getFirestoreModule()
    const db = getFirestore(app)
    await setDoc(doc(db, 'pushSubscriptions', uid), {
      fcmToken: token,
      pushEnabled: true,
      poiroboAlertEnabled,
      poiroboAlertConfig,
      updatedAt: serverTimestamp(),
    })

    return true
  } catch (e) {
    console.error('[FCM] enablePush failed:', e)
    return false
  }
}

/** 通知を無効化 */
export async function disablePush(uid: string): Promise<void> {
  try {
    const { getMessaging, deleteToken } = await getMessagingModule()
    await deleteToken(getMessaging(app))
  } catch { /* token削除失敗は無視 */ }

  try {
    const { getFirestore, doc, updateDoc } = await getFirestoreModule()
    const db = getFirestore(app)
    await updateDoc(doc(db, 'pushSubscriptions', uid), {
      pushEnabled: false,
      fcmToken: '',
    })
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
    const { getFirestore, doc, updateDoc } = await getFirestoreModule()
    const db = getFirestore(app)
    await updateDoc(doc(db, 'pushSubscriptions', uid), {
      poiroboAlertEnabled,
      poiroboAlertConfig,
    })
  } catch { /* ドキュメント未作成時は無視 */ }
}
