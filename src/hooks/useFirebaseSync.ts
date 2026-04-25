import { useState, useEffect, useRef, useCallback } from 'react'
import {
  onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, db } from '../utils/firebase'
import { enableNetwork } from 'firebase/firestore'
import {
  initialSync, saveNoteToFirestore, subscribeToNotes,
  syncStickyNotesOnLogin, saveStickyNotesToFirestore, subscribeToStickyNotes,
} from '../utils/firestoreSync'
import { dateKey } from '../utils/noteStorage'
import type { DayNote } from '../utils/noteStorage'
import { loadStickyNotes, saveStickyNotes, type StickyNote } from '../utils/stickyNotes'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export function useFirebaseSync(refreshNoteMap: () => void) {
  const [user, setUser]               = useState<User | null>(null)
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle')
  const [authLoading, setAuthLoading] = useState(true)
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(() => loadStickyNotes())
  const unsubNotesRef  = useRef<(() => void) | null>(null)
  const unsubStickyRef = useRef<(() => void) | null>(null)
  const currentUserRef = useRef<User | null>(null)
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // doSync の最新版を保持するref（自己参照 setTimeout から呼ぶため）
  const doSyncRef = useRef<(u: User, isAutoRetry?: boolean) => Promise<void>>(async () => {})
  const newLoginRef = useRef(false)
  const [loginToast, setLoginToast] = useState(false)

  const doSync = useCallback(async (u: User, isAutoRetry = false) => {
    // 保留中の自動リトライをキャンセル
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }

    // 既存のリアルタイムリスナーを解除してから再設定
    unsubNotesRef.current?.(); unsubNotesRef.current = null
    unsubStickyRef.current?.(); unsubStickyRef.current = null

    setSyncStatus('syncing')
    try {
      // Firestore SDK が offline 状態になっている場合に強制再接続
      await enableNetwork(db).catch(() => {})
      const [, syncedSticky] = await Promise.all([
        initialSync(u.uid),
        syncStickyNotesOnLogin(u.uid),
      ])
      refreshNoteMap()
      setStickyNotes(syncedSticky)
      setSyncStatus('synced')
      if (newLoginRef.current) { newLoginRef.current = false; setLoginToast(true) }

      unsubNotesRef.current = subscribeToNotes(u.uid, () => { refreshNoteMap() })
      unsubStickyRef.current = subscribeToStickyNotes(u.uid, (notes) => { setStickyNotes(notes) })
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      const isOffline = code === 'unavailable' || (err instanceof Error && err.message.includes('offline'))

      console.error(`[Firebase] sync error code=${code} retry=${isAutoRetry}`, err)
      if (isOffline && !isAutoRetry) {
        // オフライン系エラーは8秒後に1回だけ自動リトライ
        console.warn('[Firebase] offline, auto-retry in 8s')
        retryTimerRef.current = setTimeout(() => {
          const cur = currentUserRef.current
          if (cur) doSyncRef.current(cur, true)
        }, 8000)
      }
      setSyncStatus('error')
    }
  }, [refreshNoteMap])

  // doSync が更新されたら ref も更新（自己参照 setTimeout 用）
  useEffect(() => { doSyncRef.current = doSync }, [doSync])

  useEffect(() => {
    let unsubAuth: (() => void) | null = null

    const run = async () => {
      unsubAuth = onAuthStateChanged(auth, async (u) => {
        setAuthLoading(false)
        currentUserRef.current = u

        // 認証状態が変わったら保留リトライ・リスナーをクリア
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null }
        unsubNotesRef.current?.(); unsubNotesRef.current = null
        unsubStickyRef.current?.(); unsubStickyRef.current = null

        setUser(u)

        if (!u) {
          setSyncStatus('idle')
          return
        }

        await doSync(u)
      })
    }

    run()

    return () => {
      unsubAuth?.()
      unsubNotesRef.current?.()
      unsubStickyRef.current?.()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** エラー時に手動で再試行 */
  const retrySync = useCallback(() => {
    const u = currentUserRef.current
    if (u) doSync(u)
  }, [doSync])

  const signIn = async () => {
    newLoginRef.current = true
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const handleAfterSave = (date: Date, note: DayNote) => {
    if (!user) return
    saveNoteToFirestore(user.uid, dateKey(date), note).catch(err =>
      console.error('[Firebase] save error:', err)
    )
  }

  const handleStickyNotesSaved = (notes: StickyNote[]) => {
    saveStickyNotes(notes)
    setStickyNotes(notes)
    if (!user) return
    saveStickyNotesToFirestore(user.uid, notes).catch(err =>
      console.error('[Firebase] sticky notes save error:', err)
    )
  }

  return {
    user, signIn, signOut, syncStatus, retrySync, authLoading,
    handleAfterSave,
    stickyNotes, handleStickyNotesSaved,
    loginToast, clearLoginToast: () => setLoginToast(false),
  }
}
