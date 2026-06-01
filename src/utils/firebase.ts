import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// firebase コア（firebase/app + 共有 util）は初回描画に不要なため、初期ロードの
// クリティカルパスから外す。auth / firestore / messaging はいずれも描画後・操作後にのみ
// 必要になるため、initializeApp 自体も初回必要時まで遅延する（promise シングルトン）。
let _appPromise: Promise<FirebaseApp> | null = null

function getApp(): Promise<FirebaseApp> {
  if (!_appPromise) {
    _appPromise = (async () => {
      const { initializeApp } = await import('firebase/app')
      return initializeApp(firebaseConfig)
    })()
  }
  return _appPromise
}

// Auth SDK（firebase/auth、gzip 約36KB）も初回描画には不要なため遅延ロードする。
//   - getAuth ではなく initializeAuth を resolver なしで使い、popup 用 iframe(≈90KB) の
//     ロードもサインイン実行時まで遅延する（resolver は signIn 側で明示注入）。
//   - persistence は getAuth 相当（IndexedDB → localStorage）に揃える。
let _authPromise: Promise<Auth> | null = null

export function getAuthInstance(): Promise<Auth> {
  if (!_authPromise) {
    _authPromise = (async () => {
      const [{ initializeAuth, browserLocalPersistence, indexedDBLocalPersistence }, app] =
        await Promise.all([import('firebase/auth'), getApp()])
      return initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      })
    })()
  }
  return _authPromise
}

// Firestore は認証後にのみ必要なため遅延初期化
let _db: Firestore | null = null

export async function getDb(): Promise<Firestore> {
  if (!_db) {
    const [{ initializeFirestore }, app] =
      await Promise.all([import('firebase/firestore'), getApp()])
    // getDb は onSnapshot 読み取り専用。書き込みは REST（firestoreRest）に一本化している。
    // ※2026-05-30 検証: forceLongPolling を試しても SDK の setDoc は依然ハング（書き込み経路は
    //   REST が正解と確認）。読み取りは実績のある autoDetectLongPolling に戻している。
    _db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  }
  return _db
}

// FCM（firebase/messaging）が getMessaging(app) に渡すための app 取得口。
export { getApp }
