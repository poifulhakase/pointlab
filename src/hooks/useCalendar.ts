import { useState, useCallback, useMemo } from 'react'

export type ViewMode = 'month' | 'week' | 'day' | 'chart' | 'quant' | 'shield' | 'spec' | 'legal' | 'manual' | 'support' | 'backtest' | 'evals' | 'original' | 'playbook'

const VIEW_SESSION_KEY = 'poical-view-session'
const VALID_VIEWS: ViewMode[] = ['month', 'week', 'day', 'chart', 'quant', 'shield', 'spec', 'legal', 'manual', 'support', 'backtest', 'evals', 'original', 'playbook']
const ADMIN_WELCOMED_KEY = 'poical-admin-welcomed'

/**
 * 現在日付をビュー単位で delta 分だけ進める/戻す純粋関数。
 * month は月初(1日)に固定してから月を加減算する。月末(31日等)に居る状態で
 * setMonth すると遷移先の月に同じ日が無い場合に翌月へ繰り上がるため
 * （例: 5/31 → setMonth(5)=6月だが6月は30日まで → 7/1）。
 */
export function stepDate(prev: Date, view: ViewMode, delta: number): Date {
  const d = new Date(prev)
  if (view === 'month') {
    d.setDate(1)
    d.setMonth(d.getMonth() + delta)
  } else if (view === 'week') {
    d.setDate(d.getDate() + delta * 7)
  } else {
    d.setDate(d.getDate() + delta)
  }
  return d
}

function loadView(): ViewMode {
  // 管理画面から ?from=admin で遷移してきた場合の初回ウェルカム処理
  const params = new URLSearchParams(window.location.search)
  if (params.get('from') === 'admin') {
    if (!localStorage.getItem(ADMIN_WELCOMED_KEY)) {
      localStorage.setItem(ADMIN_WELCOMED_KEY, '1')
      return 'support'
    }
    return 'month'
  }
  // sessionStorage に値があればセッション内の最後のビューを復元
  // なければ新規ブラウザ起動 → カレンダー（月ビュー）をデフォルト表示
  const v = sessionStorage.getItem(VIEW_SESSION_KEY)
  return VALID_VIEWS.includes(v as ViewMode) ? (v as ViewMode) : 'month'
}

export function useCalendar() {
  const [today] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [current, setCurrent] = useState(() => new Date(today))
  const [view, setViewState] = useState<ViewMode>(loadView)

  const setView = useCallback((v: ViewMode) => {
    setViewState(v)
    sessionStorage.setItem(VIEW_SESSION_KEY, v)
  }, [])

  const goToday   = useCallback(() => setCurrent(new Date(today)), [today])
  const goToDate  = useCallback((date: Date) => setCurrent(new Date(date)), [])

  const go = useCallback((delta: number) => {
    setCurrent(prev => stepDate(prev, view, delta))
  }, [view])

  /** 月ビュー用：その月のカレンダーグリッド（前後月を含む6週×7日） */
  const getMonthGrid = useCallback((): Date[] => {
    const year = current.getFullYear()
    const month = current.getMonth()
    const first = new Date(year, month, 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay()) // 日曜始まり
    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }, [current])

  /** 週ビュー用：その週の日曜〜土曜 */
  const getWeekDays = useCallback((): Date[] => {
    const d = new Date(current)
    d.setDate(d.getDate() - d.getDay()) // 日曜に戻す
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d)
      day.setDate(d.getDate() + i)
      return day
    })
  }, [current])

  const isSameDay = useCallback((a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  , [])

  const isToday        = useCallback((d: Date) => isSameDay(d, today), [isSameDay, today])
  const isCurrentMonth = useCallback((d: Date) => d.getMonth() === current.getMonth(), [current])

  const label = useMemo(() => {
    const y = current.getFullYear()
    const m = current.toLocaleDateString('ja-JP', { month: 'long' })
    if (view === 'chart')   return 'チャート'
    if (view === 'quant')   return '需給'
    if (view === 'spec')    return 'システム仕様'
    if (view === 'support') return '研究室'
    if (view === 'manual')   return '説明書'
    if (view === 'legal')    return '利用規約・免責・プライバシー'
    if (view === 'backtest') return 'TEVバックテスト'
if (view === 'month') return `${y}年 ${m}`
    if (view === 'week') {
      const week = getWeekDays()
      const s = week[0]
      const e = week[6]
      if (s.getMonth() === e.getMonth()) return `${y}年 ${m}`
      return `${s.getFullYear()}年 ${s.toLocaleDateString('ja-JP', { month: 'short' })} – ${e.toLocaleDateString('ja-JP', { month: 'short' })}`
    }
    return current.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  }, [view, current, getWeekDays])

  return { current, today, view, setView, go, goToday, goToDate, getMonthGrid, getWeekDays, isSameDay, isToday, isCurrentMonth, label } as const
}
