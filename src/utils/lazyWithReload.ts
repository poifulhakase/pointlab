import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

// 一度だけ自動リロードしたことを記録するキー（リロードループ防止用）
const RELOAD_KEY = 'poical-chunk-reload-once'

/**
 * React.lazy のラッパー。
 *
 * デプロイすると Vite が出力するチャンク名のハッシュが変わるため、古いタブを開いたまま
 * 遅延コンポーネントを開こうとすると「もう存在しない旧ファイル名」を取りに行って 404 になり、
 * "Failed to fetch dynamically imported module" で画面が壊れる。
 *
 * このラッパーは動的 import が失敗したとき、まだ自動リロードしていなければ一度だけ
 * `location.reload()` して最新の index.html とチャンクを取り直す。既にリロード済みなら
 * 本物のエラーとして throw し、ErrorBoundary に委ねる（無限リロードを防ぐ）。
 */
// React 本体の lazy と同じく ComponentType<any> 制約でないと、map された default の
// props 型（反変位置）が never に潰れてしまう。any はここでの型保持に必須のため局所許可する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory()
      // 読み込みに成功したらフラグをクリア（次のデプロイ後に再び1回だけ効くように）
      sessionStorage.removeItem(RELOAD_KEY)
      return mod
    } catch (err) {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        // 旧チャンク 404 の可能性 → 一度だけ自動リロードして取り直す
        sessionStorage.setItem(RELOAD_KEY, '1')
        window.location.reload()
        // リロード中はこの Promise を解決させない（一瞬のエラー表示のチラつきを防ぐ）
        return new Promise<never>(() => {})
      }
      // 既にリロード済みでも失敗 = 本物のエラー → ErrorBoundary に委ねる
      throw err
    }
  })
}
