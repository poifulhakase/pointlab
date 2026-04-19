import { useState, useEffect, useRef } from 'react'
import {
  onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../utils/firebase'
import {
  initialSync, saveNoteToFirestore, subscribeToNotes,
  syncChannelsOnLogin, saveChannelsToFirestore,
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

  useEffect(() => {
    let unsubAuth: (() => void) | null = null

    const run = async () => {
      unsubAuth = onAuthStateChanged(auth, async (u) => {
        setAuthLoading(false)
        unsubNotesRef.current?.()
        unsubNotesRef.current = null
        unsubStickyRef.current?.()
        unsubStickyRef.current = null

        setUser(u)

        if (!u) {
          setSyncStatus('idle')
          return
        }

        setSyncStatus('syncing')
        try {
          const [, , syncedSticky] = await Promise.all([
            initialSync(u.uid),
            syncChannelsOnLogin(u.uid),
            syncStickyNotesOnLogin(u.uid),
          ])
          refreshNoteMap()
          setStickyNotes(syncedSticky)
          setSyncStatus('synced')

          unsubNotesRef.current = subscribeToNotes(u.uid, () => {
            refreshNoteMap()
          })

          unsubStickyRef.current = subscribeToStickyNotes(u.uid, (notes) => {
            setStickyNotes(notes)
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
      unsubStickyRef.current?.()
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

  /** スティッキーメモ保存（localStorage + Firestore） */
  const handleStickyNotesSaved = (notes: StickyNote[]) => {
    saveStickyNotes(notes)
    setStickyNotes(notes)
    if (!user) return
    saveStickyNotesToFirestore(user.uid, notes).catch(err =>
      console.error('[Firebase] sticky notes save error:', err)
    )
  }

  return {
    user, signIn, signOut, syncStatus, authLoading,
    handleAfterSave, handleChannelsSaved,
    stickyNotes, handleStickyNotesSaved,
  }
}
