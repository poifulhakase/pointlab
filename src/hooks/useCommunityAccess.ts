import { useState, useEffect, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { isAdminEmail } from '../utils/admin'
import { checkMembership } from '../utils/communityAccess'
import { LS } from '../utils/storageKeys'

/**
 * コミュニティアクセス状態。
 * 管理者は常にメンバー扱い。「非メンバーモード」ON時はロック画面確認用にメンバー扱いを外す。
 */
export function useCommunityAccess(user: User | null) {
  const isAdminUser = isAdminEmail(user?.email)
  const [isCommunityMember, setIsCommunityMember] = useState(false)
  const [memberLoading,     setMemberLoading]     = useState(false)
  // 現在の user に対して会員判定が確定済みかを表すメール（logout時は null）。
  // 非同期チェック完了後にだけ確定させ、初期表示のリダイレクト等で利用する。
  const [checkedEmail,      setCheckedEmail]      = useState<string | null>(null)
  const [previewAsNonMember, setPreviewAsNonMember] = useState<boolean>(() => {
    try { return localStorage.getItem(LS.previewNonMember) === 'true' } catch { return false }
  })

  const togglePreviewAsNonMember = useCallback(() => {
    setPreviewAsNonMember(prev => {
      const next = !prev
      try { localStorage.setItem(LS.previewNonMember, String(next)) } catch { /* noop */ }
      return next
    })
  }, [])

  const isMember = (isCommunityMember || isAdminUser) && !previewAsNonMember

  useEffect(() => {
    if (!user?.email) { setIsCommunityMember(false); setCheckedEmail(null); return }
    if (isAdminEmail(user.email)) { setIsCommunityMember(true); setCheckedEmail(user.email); return } // 管理者は自動メンバー
    setMemberLoading(true)
    checkMembership(user.email)
      .then(result => setIsCommunityMember(result))
      .catch(() => setIsCommunityMember(false))
      .finally(() => { setMemberLoading(false); setCheckedEmail(user.email) })
  }, [user])

  // 現在の user に対して会員判定が確定したか（描画中に同期計算するので
  // 兄弟 effect の setState 遅延によるレースを避けられる）。
  const membershipResolved = user?.email ? checkedEmail === user.email : true

  return { isAdminUser, isCommunityMember, memberLoading, membershipResolved, previewAsNonMember, togglePreviewAsNonMember, isMember }
}
