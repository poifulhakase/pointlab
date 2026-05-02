import { useState, useCallback } from 'react'

export type ViewMode = 'month' | 'week' | 'day' | 'chart' | 'quant' | 'note' | 'spec' | 'legal' | 'manual' | 'support'

const VIEW_STORAGE_KEY = 'poical-view'
const VALID_VIEWS: ViewMode[] = ['month', 'week', 'day', 'chart', 'quant', 'note', 'spec', 'legal', 'manual', 'support']

function loadView(): ViewMode {
  const v = localStorage.getItem(VIEW_STORAGE_KEY)
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
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }, [])

  const goToday = () => setCurrent(new Date(today))

  const go = (delta: number) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + delta)
      else if (view === 'week') d.setDate(d.getDate() + delta * 7)
      else d.setDate(d.getDate() + delta)
      return d
    })
  }

  const goToDate = (date: Date) => setCurrent(new Date(date))

  /** 月ビュー用：その月のカレンダーグリッド（前後月を含む6週×7日） */
  const getMonthGrid = (): Date[] => {
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
  }

  /** 週ビュー用：その週の日曜〜土曜 */
  const getWeekDays = (): Date[] => {
    const d = new Date(current)
    d.setDate(d.getDate() - d.getDay()) // 日曜に戻す
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d)
      day.setDate(d.getDate() + i)
      return day
    })
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const isToday = (d: Date) => isSameDay(d, today)
  const isCurrentMonth = (d: Date) => d.getMonth() === current.getMonth()

  const label = () => {
    const y = current.getFullYear()
    const m = current.toLocaleDateString('ja-JP', { month: 'long' })
    if (view === 'chart')   return 'チャート'
    if (view === 'quant')   return '需給'
    if (view === 'note')    return 'ノート'
    if (view === 'spec')    return 'システム仕様'
    if (view === 'manual')  return '使い方'
    if (view === 'legal')   return 'プライバシー・免責事項'
    if (view === 'month') return `${y}年 ${m}`
    if (view === 'week') {
      const week = getWeekDays()
      const s = week[0]
      const e = week[6]
      if (s.getMonth() === e.getMonth()) return `${y}年 ${m}`
      return `${s.getFullYear()}年 ${s.toLocaleDateString('ja-JP', { month: 'short' })} – ${e.toLocaleDateString('ja-JP', { month: 'short' })}`
    }
    return current.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return { current, today, view, setView, go, goToday, goToDate, getMonthGrid, getWeekDays, isSameDay, isToday, isCurrentMonth, label }
}
