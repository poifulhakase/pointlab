import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Firestore は認証後にのみ必要なため遅延初期化
let _db: Firestore | null = null

export async function getDb(): Promise<Firestore> {
  if (!_db) {
    const { initializeFirestore } = await import('firebase/firestore')
    _db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  }
  return _db
}
