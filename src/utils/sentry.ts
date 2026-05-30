// Sentry はエラー監視のみで初回描画には不要なため、初期ロードのクリティカルパスから外す。
// @sentry/react を動的 import し、ブラウザがアイドルになってから（または数秒後に）初期化する。
// これにより Sentry チャンク（gzip 約46KB）が初回描画をブロックしなくなる。
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  const start = () => {
    import('@sentry/react')
      .then(Sentry => {
        Sentry.init({
          dsn,
          environment: import.meta.env.MODE,
          integrations: [Sentry.browserTracingIntegration()],
          tracesSampleRate: 0.1,
          // ノイズ除去: 拡張機能・古いブラウザ由来のエラーを除外
          ignoreErrors: [
            'ResizeObserver loop limit exceeded',
            'ResizeObserver loop completed with undelivered notifications',
            /^Cannot redefine property: ethereum/,
          ],
        })
      })
      .catch(() => { /* 初期化失敗時は黙って無視 */ })
  }

  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback
  if (typeof ric === 'function') ric(start, { timeout: 5000 })
  else setTimeout(start, 3000)
}
