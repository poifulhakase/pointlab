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
    if (!user?.email) { setIsCommunityMember(false); return }
    if (isAdminEmail(user.email)) { setIsCommunityMember(true); return } // 管理者は自動メンバー
    setMemberLoading(true)
    checkMembership(user.email)
      .then(result => setIsCommunityMember(result))
      .catch(() => setIsCommunityMember(false))
      .finally(() => setMemberLoading(false))
  }, [user])

  return { isAdminUser, isCommunityMember, memberLoading, previewAsNonMember, togglePreviewAsNonMember, isMember }
}
