// Firestore ベースの簡易レート制限（per uid + action）。
// Vercel Function はステートレスなため、共有ストアとして Firestore を使う。
// `_` プレフィックスのため Vercel のルートとしては公開されない（共有モジュール）。
// 書き込みは Admin SDK 経由のためセキュリティルールをバイパスする。
//
// 返り値: true=許可 / false=上限超過（呼び出し側で 429 を返す）

module.exports = async function rateLimit(db, uid, action, maxPerWindow, windowMs) {
  if (!uid) return true // uid 不明時はこのガードでは弾かない（別途認証で弾く）
  const ref = db.collection('rateLimits').doc(`${uid}__${action}`)
  const now = Date.now()
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      let count = 0
      let windowStart = now
      if (snap.exists) {
        const d = snap.data() || {}
        count = typeof d.count === 'number' ? d.count : 0
        windowStart = typeof d.windowStart === 'number' ? d.windowStart : now
      }
      if (now - windowStart > windowMs) { count = 0; windowStart = now }
      count++
      tx.set(ref, { count, windowStart, updatedAt: now })
      return count <= maxPerWindow
    })
  } catch {
    // レート制限の判定自体が失敗した場合はフェイルオープン（正規利用を阻害しない）
    return true
  }
}
