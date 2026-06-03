import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './utils/sentry'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA(autoUpdate)のSW更新チェックを強化。
// 既定では再読み込み時しか新SWを検知せず、スマホPWAはバックグラウンド復帰で再読み込みされないため
// 古いSWが居座り「更新がかからない」原因になる。前面復帰時＋1時間ごとに registration.update() を呼び、
// 新SWを検知させる（autoUpdate が skipWaiting/clientsClaim で即時適用→自動リロード）。
if ('serviceWorker' in navigator) {
  const checkForUpdate = () =>
    navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {})
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
  window.addEventListener('focus', checkForUpdate)
  setInterval(checkForUpdate, 60 * 60 * 1000)
}
