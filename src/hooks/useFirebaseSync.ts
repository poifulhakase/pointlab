import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { getAuthInstance, getDb } from '../utils/firebase'
import {
  initialSync, saveNoteToFirestore, subscribeToNotes,
  syncStickyNotesOnLogin, saveStickyNotesToFirestore, subscribeToStickyNotes,
} from '../utils/firestoreSync'
import { dateKey } from '../utils/noteStorage'
import type { DayNote } from '../utils/noteStorage'
import { loadStickyNotes, saveStickyNotes, type StickyNote } from '../utils/stickyNotes'
import { blockedInPreview } from '../utils/previewMode'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/**
 * ブラウザが暇になってから走らせる（無ければ短いタイマー）。
 * 🔴 起動直後は firestore SDK(約291KB)＋メモ本体＋購読チャンネルで **600KB超** を取りに行っていた。
 *    画面はローカル保存のメモで先に出せるので、同期は**描画とデータ取得が落ち着いてから**でよい
 *    （2026-08-16 計測。転送量の内訳＝firestore 291KB / notes 169KB / Listen 172KB）。
 */
function whenIdle(cb: () => void, timeout = 2500) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(cb, { timeout })
  else setTimeout(cb, timeout)
}

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
      // Firestore SDK が offline 状態になっている場合に強制再接続（遅延ロード）
      const [{ enableNetwork }, db] = await Promise.all([
        import('firebase/firestore'),
        getDb(),
      ])
      await enableNetwork(db).catch(() => {})

      const [, syncedSticky] = await Promise.all([
        initialSync(u.uid),
        syncStickyNotesOnLogin(u.uid),
      ])
      refreshNoteMap()
      setStickyNotes(syncedSticky)
      setSyncStatus('synced')
      if (newLoginRef.current) { newLoginRef.current = false; setLoginToast(true) }

      unsubNotesRef.current = await subscribeToNotes(u.uid, () => { refreshNoteMap() })
      unsubStickyRef.current = await subscribeToStickyNotes(u.uid, (notes) => { setStickyNotes(notes) })
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
      // firebase/auth（SDK 約57KB）はここで初めて動的ロードする。useEffect は初回描画後に
      // 走るため、認証 SDK が初期描画（LCP）をブロックしなくなる。
      const [{ onAuthStateChanged }, auth] = await Promise.all([
        import('firebase/auth'),
        getAuthInstance(),
      ])
      unsubAuth = onAuthStateChanged(auth, async (u) => {
        // Google ログイン済みフラグを localStorage に記録（再訪問時のスピナー回避用）
        if (u) {
          localStorage.setItem('poical-was-google-authed', '1')
        } else {
          localStorage.removeItem('poical-was-google-authed')
        }

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

        // 🔵 同期は暇になってから（初回描画と当日データの取得を邪魔しない）。
        //    🔴 隠れているタブでは走らせない＝復帰したときに同期する。
        whenIdle(() => {
          if (document.visibilityState === 'hidden') {
            const onShow = () => {
              document.removeEventListener('visibilitychange', onShow)
              const cur = currentUserRef.current
              if (cur) doSyncRef.current(cur)
            }
            document.addEventListener('visibilitychange', onShow)
            return
          }
          const cur = currentUserRef.current
          if (cur) doSyncRef.current(cur)
        })
      })
    }

    run()

    return () => {
      unsubAuth?.()
      unsubNotesRef.current?.()
      unsubStickyRef.current?.()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  /** エラー時に手動で再試行 */
  const retrySync = useCallback(() => {
    const u = currentUserRef.current
    if (u) doSync(u)
  }, [doSync])

  const signIn = async () => {
    // 🔴 プレビューは閲覧だけ。ログインすると本物のデータが同期されてしまう
    if (blockedInPreview('プレビューではログインできません')) return
    newLoginRef.current = true
    const [{ GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver }, auth] =
      await Promise.all([import('firebase/auth'), getAuthInstance()])
    const provider = new GoogleAuthProvider()
    // auth は initializeAuth(resolver なし)で生成しているため、ここで明示的に resolver を渡す。
    // これによりサインイン時に初めて gapi iframe がロードされる（初期ロードから除外）。
    await signInWithPopup(auth, provider, browserPopupRedirectResolver)
  }

  const signOut = async () => {
    const [{ signOut: firebaseSignOut }, auth] =
      await Promise.all([import('firebase/auth'), getAuthInstance()])
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
