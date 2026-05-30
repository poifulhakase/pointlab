import { useState, useEffect, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { fetchMaintenanceState, readMaintenanceCache, type MaintenanceState } from '../utils/maintenanceState'
import { restSetDoc } from '../utils/firestoreRest'
import { LS } from '../utils/storageKeys'

/**
 * アプリ全体のメンテナンスモード状態。
 * Firestore `config/maintenance` を読み（公開・キャッシュ）、管理者の切替で書き込む。
 */
export function useMaintenance(user: User | null) {
  const [maintenance, setMaintenance] = useState<MaintenanceState>(() => readMaintenanceCache())

  useEffect(() => {
    fetchMaintenanceState().then(setMaintenance).catch(() => {})
  }, [])

  const handleToggleMaintenance = useCallback((enabled: boolean) => {
    const next = { enabled, message: maintenance.message }
    setMaintenance(next)
    try { localStorage.setItem(LS.maintenance, JSON.stringify(next)) } catch { /* noop */ }
    if (user) {
      restSetDoc('config/maintenance', { enabled, message: next.message, updatedAt: new Date().toISOString() }).catch(() => {})
    }
  }, [maintenance.message, user])

  return { maintenance, handleToggleMaintenance }
}
