import { useState, useEffect, useRef } from 'react'
import {
  onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../utils/firebase'
import { initialSync, saveNoteToFirestore, subscribeToNotes, syncChannelsOnLogin, saveChannelsToFirestore } from '../utils/firestoreSync'
import { dateKey } from '../utils/noteStorage'
import type { DayNote } from '../utils/noteStorage'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export function useFirebaseSync(refreshNoteMap: () => void) {
  const [user, setUser]             = useState<User | null>(null)
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>('idle')
  const [authLoading, setAuthLoading] = useState(true)
  const unsubNotesRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let unsubAuth: (() => void) | null = null

    const run = async () => {
      unsubAuth = onAuthStateChanged(auth, async (u) => {
        setAuthLoading(false)
        unsubNotesRef.current?.()
        unsubNotesRef.current = null

        setUser(u)

        if (!u) {
          setSyncStatus('idle')
          return
        }

        setSyncStatus('syncing')
        try {
          await Promise.all([initialSync(u.uid), syncChannelsOnLogin(u.uid)])
          refreshNoteMap()
          setSyncStatus('synced')

          unsubNotesRef.current = subscribeToNotes(u.uid, () => {
            refreshNoteMap()
          })
        } catch (err) {
          console.error('[Firebase] sync error:', err)
          setSyncStatus('error')
        }
      })
    }

    run()

    return () => {
      unsubAuth?.()
      unsubNotesRef.current?.()
    }
  }, []) // refreshNoteMap は useCallback([]) で安定

  const signIn = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  /** ノート保存後に Firestore へ非同期書き込み（ログイン時のみ） */
  const handleAfterSave = (date: Date, note: DayNote) => {
    if (!user) return
    saveNoteToFirestore(user.uid, dateKey(date), note).catch(err =>
      console.error('[Firebase] save error:', err)
    )
  }

  /** チャンネルリスト変更後に Firestore へ非同期書き込み（ログイン時のみ） */
  const handleChannelsSaved = (channels: { id: string; name: string }[]) => {
    if (!user) return
    saveChannelsToFirestore(user.uid, channels).catch(err =>
      console.error('[Firebase] channels save error:', err)
    )
  }

  return { user, signIn, signOut, syncStatus, handleAfterSave, handleChannelsSaved, authLoading }
}
