import { restGetDoc, restListDocs, restSetDoc, restDeleteDoc } from './firestoreRest'

export interface CommunityMember {
  email:       string
  displayName: string
  addedAt:     string
}

function docId(email: string): string {
  // @ は Firestore ドキュメントIDに使用可能。REST URL では %40 にエンコードが必要
  return encodeURIComponent(email.toLowerCase().trim())
}

/** 指定メールアドレスがコミュニティメンバーか確認 */
export async function checkMembership(email: string): Promise<boolean> {
  try {
    const doc = await restGetDoc(`community_members/${docId(email)}`)
    return doc.exists()
  } catch {
    return false
  }
}

/** メンバー一覧取得（管理者用） */
export async function listMembers(): Promise<CommunityMember[]> {
  const docs = await restListDocs('community_members')
  return docs
    .map(d => d.data() as unknown as CommunityMember)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

/** メンバー追加（管理者用） */
export async function addMember(email: string, displayName = ''): Promise<void> {
  const key = email.toLowerCase().trim()
  await restSetDoc(`community_members/${docId(key)}`, {
    email:       key,
    displayName: displayName.trim(),
    addedAt:     new Date().toISOString(),
  })
}

/** メンバー削除（管理者用） */
export async function removeMember(email: string): Promise<void> {
  await restDeleteDoc(`community_members/${docId(email)}`)
}
