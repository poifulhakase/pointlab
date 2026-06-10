// アプリを確実に最新化する「逃げ道」。
// PWA(autoUpdate)は通常は自動更新するが、まれに Service Worker が古いまま固着し
// 「サイトデータ削除」が必要になる端末がある。一般ユーザーに DevTools 操作は酷なため、
// 同等の処理（SW登録解除＋全キャッシュ削除＋リロード）をワンタップで行う。
// 注意: ユーザーデータ（メモ等）は localStorage / Firestore にあり、ここでは消えない。
export async function forceAppUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch { /* noop */ }
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch { /* noop */ }
  // SW解除・キャッシュ削除後に素のネットワークから取り直す
  location.reload()
}
