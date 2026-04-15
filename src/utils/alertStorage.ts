// 発火済みアラートのキーを管理（重複通知防止）
// キー形式: "YYYY-MM-DD|HH:MM|alertMinutes"

const KEY = 'poical-alerts-fired'
const TTL_MS = 24 * 60 * 60 * 1000  // 24時間で自動削除

type AlertRecord = Record<string, number>  // key → fired timestamp

function load(): AlertRecord {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

function save(r: AlertRecord): void {
  localStorage.setItem(KEY, JSON.stringify(r))
}

export function hasAlertFired(key: string): boolean {
  return !!load()[key]
}

export function markAlertFired(key: string): void {
  const r = load()
  r[key] = Date.now()
  save(r)
}

/** 24時間以上前のレコードを削除 */
export function cleanOldAlerts(): void {
  const r = load()
  const cutoff = Date.now() - TTL_MS
  const cleaned = Object.fromEntries(Object.entries(r).filter(([, t]) => t > cutoff))
  save(cleaned)
}
