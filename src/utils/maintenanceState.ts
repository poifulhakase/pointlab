// アプリ全体のメンテナンスモード状態。
// Firestore `config/maintenance` を「未ログインでも読める」公開 REST で取得する
// （rules: config/maintenance allow read: if true）。書き込みは管理者のみ（restSetDoc）。
import { LS } from './storageKeys'
import { asBoolean, asString, field } from './validate'

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID
const API_KEY    = import.meta.env.VITE_FIREBASE_API_KEY
const DOC_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/config/maintenance?key=${API_KEY}`

const LS_KEY = LS.maintenance

export interface MaintenanceState {
  enabled: boolean
  message: string
}

const DEFAULT_STATE: MaintenanceState = { enabled: false, message: '' }

/** 直近に取得した状態（同期初期値用）。読めなければ通常表示（フェイルオープン）。 */
export function readMaintenanceCache(): MaintenanceState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch { /* noop */ }
  return DEFAULT_STATE
}

function writeCache(state: MaintenanceState): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* noop */ }
}

/**
 * Firestore からメンテナンス状態を取得。
 * 取得失敗・ドキュメント無しの場合は「メンテナンスOFF」を返す（フェイルオープン）。
 * 全ユーザーをロックアウトしないため、読めない時に enabled=true にはしない。
 */
export async function fetchMaintenanceState(): Promise<MaintenanceState> {
  try {
    const res = await fetch(DOC_URL)
    if (!res.ok) return readMaintenanceCache()
    const json: unknown = await res.json()
    const fields = field(json, 'fields')
    const state: MaintenanceState = {
      enabled: asBoolean(field(field(fields, 'enabled'), 'booleanValue')),
      message: asString(field(field(fields, 'message'), 'stringValue')),
    }
    writeCache(state)
    return state
  } catch {
    return readMaintenanceCache()
  }
}
