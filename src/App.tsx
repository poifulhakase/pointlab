import { lazy, Suspense, memo, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useCalendar } from './hooks/useCalendar'
import { useBreakpoint } from './hooks/useBreakpoint'
import { useFirebaseSync } from './hooks/useFirebaseSync'
import { CalendarHeader, GearIcon, MonitorIcon, SunIcon, MoonIcon, BellIcon, ChevronLeft, ChevronRight } from './components/CalendarHeader'
import { AuthModal } from './components/AuthModal'
import { Sidebar } from './components/Sidebar'
import { MonthView } from './components/MonthView'
import { PoiroboAlertModal } from './components/PoiroboAlertModal'
import { WeekView } from './components/WeekView'
import { DayView } from './components/DayView'
import { DayNotePanel } from './components/DayNotePanel'
import { useNotifications } from './hooks/useNotifications'
import { getDividendDates, getMarkersForDate, type DividendDateSet } from './utils/dividendCalendar'
import { isMarketClosed, getClosedReason } from './utils/marketHolidays'
import { getSqDates, getSqMarkersForDate, type SqDate } from './utils/sqCalendar'
import { getMacroEventsForDate, type MacroFilter } from './utils/macroCalendar'
import { getAllNoteData, dateKey, type NoteMapEntry, type ScheduleEntry } from './utils/noteStorage'
import { getSettings, saveSettings, type PoiroboAlertConfig } from './utils/settingsStorage'
import { isGuestAuthed } from './utils/guestAuth'
import { getAnomalyRanges, type AnomalyRange } from './utils/anomalyCalendar'

// ── コード分割: 重いビューは初回アクセス時にのみロード ─────────────────
const ChartView    = lazy(() => import('./components/ChartView').then(m => ({ default: m.ChartView })))
const QuantView    = lazy(() => import('./components/QuantView').then(m => ({ default: m.QuantView })))
const SpecView     = lazy(() => import('./components/SpecView').then(m => ({ default: m.SpecView })))
const NoteView     = lazy(() => import('./components/NoteView').then(m => ({ default: m.NoteView })))
const ManualView   = lazy(() => import('./components/ManualView').then(m => ({ default: m.ManualView })))
const SupportView  = lazy(() => import('./components/SupportView').then(m => ({ default: m.SupportView })))
const LegalModal   = lazy(() => import('./components/LegalModal').then(m => ({ default: m.LegalModal })))
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })))

// ── ローディングスピナー（Suspense フォールバック） ───────────────────
function ViewLoader() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={spinnerStyle} />
    </div>
  )
}

// ── トースト通知（メモ化） ─────────────────────────────────────────────
const Toast = memo(({ message }: { message: string }) => (
  <div style={styles.toast}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke="rgba(96,165,250,0.8)" />
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {message}
  </div>
))

// ── 歯車ドロップダウン（メモ化） ──────────────────────────────────────
interface GearDropdownProps {
  dropRef: React.RefObject<HTMLDivElement | null>
  pos: { bottom: number; right: number }
  theme: 'dark' | 'light'
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null
  syncStatus: string
  onToggleTheme: () => void
  onOpenNotifications: () => void
  onOpenAccount: () => void
  onOpenSpec: () => void
}
const GearDropdown = memo(({
  dropRef, pos, theme, user, syncStatus,
  onToggleTheme, onOpenNotifications, onOpenAccount,
  onOpenSpec,
}: GearDropdownProps) => (
  <div ref={dropRef} style={{ ...styles.gearDropdown, bottom: pos.bottom, right: pos.right }} className="glass">
    <GearItem icon={<BellIcon />} onClick={onOpenNotifications}>カレンダー通知</GearItem>
    <GearItem icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={onToggleTheme}>
      {theme === 'dark' ? 'ライトモード' : 'ダークモード'}
    </GearItem>
    {user?.email === 'sushi.ramen.unajyu@gmail.com' && (
      <GearItem icon={<DocIcon />} onClick={onOpenSpec}>システム仕様</GearItem>
    )}
    <GearItem
      icon={
        user?.photoURL
          ? <img src={user.photoURL} alt="" style={{ width: 15, height: 15, borderRadius: '50%' }} referrerPolicy="no-referrer" />
          : <UserIcon />
      }
      onClick={onOpenAccount}
      suffix={
        user && syncStatus === 'synced' ? <span style={{ fontSize: 10, color: 'rgba(96,200,140,0.9)' }}>✓</span>
        : user && syncStatus === 'syncing' ? <span style={{ fontSize: 10, color: 'var(--accent)' }}>...</span>
        : null
      }
    >
      {user ? (user.displayName ?? user.email ?? 'アカウント') : 'Googleでログイン'}
    </GearItem>
  </div>
))

function GearItem({ icon, children, onClick, suffix }: {
  icon: React.ReactNode; children: React.ReactNode
  onClick: () => void; suffix?: React.ReactNode
}) {
  return (
    <button style={styles.gearItem} onClick={onClick}>
      <span style={styles.gearItemIcon}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {suffix}
    </button>
  )
}
// ── 小さいアイコン群 ───────────────────────────────────────────────────
function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSettings().theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveSettings({ ...getSettings(), theme })
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])
  const cal = useCalendar()
  const { isMobile, isTablet, isDesktop } = useBreakpoint()

  // ── 歯車ドロップダウン ───────────────────────────────────────────────
  const [gearOpen, setGearOpen]     = useState(false)
  const [gearPos, setGearPos]       = useState({ bottom: 0, right: 0 })
  const gearBtnRef  = useRef<HTMLButtonElement>(null)
  const gearDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gearOpen) return
    const handler = (e: MouseEvent) => {
      if (!gearBtnRef.current?.contains(e.target as Node) &&
          !gearDropRef.current?.contains(e.target as Node)) {
        setGearOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [gearOpen])

  const openGear = useCallback(() => {
    if (gearBtnRef.current) {
      const r = gearBtnRef.current.getBoundingClientRect()
      setGearPos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right })
    }
    setGearOpen(o => !o)
  }, [])

  const closeGear = useCallback(() => setGearOpen(false), [])

  // ── 日/週/月 スワイプ ─────────────────────────────────────────────────
  const calTouchStartXRef  = useRef(0)
  const calTouchStartYRef  = useRef(0)
  const calIsDraggingRef   = useRef(false)
  const calDragOffsetRef   = useRef(0)
  const carouselRef        = useRef<HTMLDivElement>(null)

  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  useEffect(() => { setSidebarOpen(isDesktop) }, [isDesktop])

  // ── モーダル類 ────────────────────────────────────────────────────────
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // ── マクロフィルター ──────────────────────────────────────────────────
  const [macroFilter, setMacroFilter] = useState<MacroFilter>({ us: true, jp: true })

  // ── プライベートモード ────────────────────────────────────────────────
  const [showPrivate, setShowPrivate] = useState<boolean>(() => getSettings().showPrivate)
  const handleShowPrivateChange = useCallback((v: boolean) => {
    setShowPrivate(v)
    saveSettings({ ...getSettings(), showPrivate: v })
  }, [])

  // ── アノマリー表示 ────────────────────────────────────────────────────
  const [showAnomaly, setShowAnomaly] = useState<boolean>(() => getSettings().showAnomaly)
  const handleShowAnomalyChange = useCallback((v: boolean) => {
    setShowAnomaly(v)
    saveSettings({ ...getSettings(), showAnomaly: v })
  }, [])

  // ── ぽいロボアラート（SQ日ハイライト） ────────────────────────────────
  const [showPoiroboAlert,    setShowPoiroboAlert]    = useState<boolean>(() => getSettings().showPoiroboAlert)
  const [poiroboAlertConfig,  setPoiroboAlertConfig]  = useState(() => getSettings().poiroboAlertConfig)
  const [poiroboAlertModalOpen, setPoiroboAlertModalOpen] = useState(false)

  const handleShowPoiroboAlertChange = useCallback((v: boolean) => {
    setShowPoiroboAlert(v)
    saveSettings({ ...getSettings(), showPoiroboAlert: v })
  }, [])

  const handlePoiroboAlertOpen = useCallback(() => {
    setPoiroboAlertModalOpen(true)
  }, [])

  const handlePoiroboAlertSave = useCallback((config: PoiroboAlertConfig) => {
    setPoiroboAlertConfig(config)
    setShowPoiroboAlert(true)
    setPoiroboAlertModalOpen(false)
    saveSettings({ ...getSettings(), showPoiroboAlert: true, poiroboAlertConfig: config })
  }, [])

  // ── フローティングサブバー用 状態 ─────────────────────────────────────
  const [chartSymbol,       setChartSymbol]       = useState('INDEX:NKY')
  const [quantTab,          setQuantTab]          = useState<'kankyou' | 'genbutsu' | 'micro'>('kankyou')
  const [supportTab,        setSupportTab]        = useState<'session' | 'note'>('session')
  const [quantSettingsOpen, setQuantSettingsOpen] = useState(false)
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false)

  // ── ノートパネル ──────────────────────────────────────────────────────
  const [noteDate,       setNoteDate]       = useState<Date | null>(null)
  const [notePrefillTime, setNotePrefillTime] = useState<string | undefined>(undefined)
  const [noteMap, setNoteMap] = useState<Map<string, NoteMapEntry>>(() => getAllNoteData())
  const refreshNoteMap = useCallback(() => setNoteMap(getAllNoteData()), [])

  // ── Firebase 同期 ─────────────────────────────────────────────────────
  const {
    user, signIn, signOut, syncStatus, retrySync,
    handleAfterSave,
    authLoading, stickyNotes, handleStickyNotesSaved,
    loginToast, clearLoginToast,
  } = useFirebaseSync(refreshNoteMap)

  useNotifications()

  // ── トースト ──────────────────────────────────────────────────────────
  const [saveToast,  setSaveToast]  = useState(false)
  const showSaveToast = useCallback(() => setSaveToast(true), [])

  useEffect(() => {
    if (!loginToast) return
    const t = setTimeout(clearLoginToast, 3500)
    return () => clearTimeout(t)
  }, [loginToast, clearLoginToast])

  // 初回ログイン時は研究室へ遷移
  useEffect(() => {
    if (!loginToast) return
    const KEY = 'poical-first-login-done'
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, '1')
      cal.setView('support')
    }
  }, [loginToast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!saveToast) return
    const t = setTimeout(() => setSaveToast(false), 2500)
    return () => clearTimeout(t)
  }, [saveToast])

  // ── 認証ゲート ────────────────────────────────────────────────────────
  const [isUnlocked, setIsUnlocked] = useState(() => isGuestAuthed())
  useEffect(() => { if (user) setIsUnlocked(true) }, [user])
  const showLoading = authLoading && !isUnlocked

  // ── カレンダーイベント系 ──────────────────────────────────────────────
  const year = cal.current.getFullYear()

  const dividendSets: DividendDateSet[] = useMemo(() =>
    [...getDividendDates(year - 1), ...getDividendDates(year), ...getDividendDates(year + 1)],
    [year])

  const sqDates: SqDate[] = useMemo(() =>
    [...getSqDates(year - 1), ...getSqDates(year), ...getSqDates(year + 1)],
    [year])

  const getMarkers     = useCallback((d: Date) => macroFilter.jp ? getMarkersForDate(d, dividendSets) : [], [dividendSets, macroFilter.jp])
  const getSqMarkers   = useCallback((d: Date) => macroFilter.jp ? getSqMarkersForDate(d, sqDates) : [],    [sqDates, macroFilter.jp])
  const getMacroEvents = useCallback((d: Date) => getMacroEventsForDate(d, macroFilter), [macroFilter])

  const hasNote  = useCallback((d: Date) => showPrivate ? noteMap.has(dateKey(d)) : false, [noteMap, showPrivate])
  const getNoteTitle = useCallback((d: Date) => {
    if (!showPrivate) return ''
    const data = noteMap.get(dateKey(d))
    if (!data) return ''
    if (data.schedules.length > 0) {
      const first  = data.schedules[0]
      const suffix = data.schedules.length > 1 ? ` +${data.schedules.length - 1}` : ''
      return [first.startTime, first.title].filter(Boolean).join(' ') + suffix
    }
    return data.title
  }, [noteMap, showPrivate])
  const getScheduledEvents = useCallback((d: Date): ScheduleEntry[] =>
    showPrivate ? (noteMap.get(dateKey(d))?.schedules ?? []) : [], [noteMap, showPrivate])

  const openNote  = useCallback((d: Date, time?: string) => { if (!showPrivate) return; setNoteDate(d); setNotePrefillTime(time) }, [showPrivate])
  const closeNote = useCallback(() => { setNoteDate(null); setNotePrefillTime(undefined) }, [])

  // ── アノマリー ────────────────────────────────────────────────────────
  const anomalyRanges: AnomalyRange[] = useMemo(() =>
    [...getAnomalyRanges(year - 1), ...getAnomalyRanges(year), ...getAnomalyRanges(year + 1)],
    [year])

  const getAnomalyEvents = useCallback((d: Date) => {
    if (!showAnomaly || isMobile) return []
    const key = dateKey(d)
    return anomalyRanges
      .filter(r => r.start <= key && key <= r.end)
      .map(r => ({ type: r.type, isStart: r.start === key, isEnd: r.end === key }))
  }, [showAnomaly, isMobile, anomalyRanges])

  const handleMenuClick    = useCallback(() => setSidebarOpen(p => !p), [])
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), [])

  // ── フローティングタブ: ページを離れるタイミングでリセット（戻った瞬間に正しい状態で表示）
  const prevViewRef2 = useRef(cal.view)
  useEffect(() => {
    const prev = prevViewRef2.current
    prevViewRef2.current = cal.view
    if (prev === 'chart') setChartSymbol('INDEX:NKY')
    if (prev === 'quant') setQuantTab('kankyou')
    // support から legal/manual/spec 以外へ遷移した場合のみリセット（資料タブを保持）
    if (prev === 'support' && cal.view !== 'legal' && cal.view !== 'manual' && cal.view !== 'spec') {
      setSupportTab('session')
    }
  }, [cal.view])

  // ── Android 戻るボタン対応 ────────────────────────────────────────────
  const backStateRef = useRef({
    gearOpen: false, settingsOpen: false, authModalOpen: false,
    noteDate: null as Date | null, poiroboAlertModalOpen: false,
    quantSettingsOpen: false, chartSettingsOpen: false, view: 'month',
  })
  backStateRef.current = {
    gearOpen, settingsOpen, authModalOpen, noteDate,
    poiroboAlertModalOpen, quantSettingsOpen, chartSettingsOpen, view: cal.view,
  }
  const backActionsRef = useRef({
    closeGear: () => {}, closeNote: () => {}, setView: (_v: string) => {},
    setSettingsOpen: (_v: boolean) => {}, setAuthModalOpen: (_v: boolean) => {},
    setPoiroboAlertModalOpen: (_v: boolean) => {}, setQuantSettingsOpen: (_v: boolean) => {},
    setChartSettingsOpen: (_v: boolean) => {},
  })
  backActionsRef.current = {
    closeGear, closeNote, setView: cal.setView as (_v: string) => void,
    setSettingsOpen, setAuthModalOpen, setPoiroboAlertModalOpen,
    setQuantSettingsOpen, setChartSettingsOpen,
  }
  useEffect(() => {
    history.pushState(null, '')
    const handlePopState = () => {
      history.pushState(null, '')
      const s = backStateRef.current
      const a = backActionsRef.current
      if (s.gearOpen)              { a.closeGear();                           return }
      if (s.settingsOpen)          { a.setSettingsOpen(false);                return }
      if (s.authModalOpen)         { a.setAuthModalOpen(false);               return }
      if (s.noteDate)              { a.closeNote();                           return }
      if (s.poiroboAlertModalOpen) { a.setPoiroboAlertModalOpen(false);       return }
      if (s.quantSettingsOpen)     { a.setQuantSettingsOpen(false);           return }
      if (s.chartSettingsOpen)     { a.setChartSettingsOpen(false);           return }
      const v = s.view
      if (v === 'spec' || v === 'legal' || v === 'manual') { a.setView('support'); return }
      if (v === 'support') { a.setView('month'); return }
      if (v === 'day')     { a.setView('week');  return }
      if (v === 'week')    { a.setView('month'); return }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 日/週/月 スワイプ計算 ─────────────────────────────────────────────
  // Panel order: 0=月, 1=週, 2=日
  const calPanelIndex = useMemo(() => {
    if (cal.view === 'month') return 0
    if (cal.view === 'week')  return 1
    return 2
  }, [cal.view])

  const handleCalTouchStart = useCallback((e: React.TouchEvent) => {
    calTouchStartXRef.current = e.touches[0].clientX
    calTouchStartYRef.current = e.touches[0].clientY
    calIsDraggingRef.current = false
  }, [])

  const handleCalTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - calTouchStartXRef.current
    const dy = e.touches[0].clientY - calTouchStartYRef.current
    if (!calIsDraggingRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        calIsDraggingRef.current = true
      } else if (Math.abs(dy) > 8) {
        return
      }
    }
    if (calIsDraggingRef.current) {
      const clamped = calPanelIndex === 0 && dx > 0 ? Math.min(dx, 60)
        : calPanelIndex === 2 && dx < 0 ? Math.max(dx, -60)
        : dx
      calDragOffsetRef.current = clamped
      // setState を使わず DOM を直接更新 → リレンダリングゼロ
      if (carouselRef.current) {
        carouselRef.current.style.transition = 'none'
        carouselRef.current.style.transform  = `translateX(calc(-${calPanelIndex * 33.333}% + ${clamped}px))`
      }
    }
  }, [calPanelIndex])

  const handleCalTouchEnd = useCallback(() => {
    if (!calIsDraggingRef.current) return
    const dx = calDragOffsetRef.current
    calDragOffsetRef.current = 0
    calIsDraggingRef.current = false

    let newPanelIdx = calPanelIndex
    if (Math.abs(dx) >= 50) {
      if (dx < 0 && calPanelIndex < 2) newPanelIdx = calPanelIndex + 1
      else if (dx > 0 && calPanelIndex > 0) newPanelIdx = calPanelIndex - 1
    }

    // トランジション付きで最終位置へスナップ（setState なし）
    if (carouselRef.current) {
      carouselRef.current.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1)'
      carouselRef.current.style.transform  = `translateX(-${newPanelIdx * 33.333}%)`
    }
    if (newPanelIdx !== calPanelIndex) {
      const CAL_VIEWS = ['month', 'week', 'day'] as const
      cal.setView(CAL_VIEWS[newPanelIdx])
    }
  }, [calPanelIndex, cal])

  // ── 歯車アクション ────────────────────────────────────────────────────
  const gearActions = useMemo(() => ({
    onToggleTheme:       () => { toggleTheme(); closeGear() },
    onOpenNotifications: () => { setSettingsOpen(true); closeGear() },
    onOpenAccount:       () => { setAuthModalOpen(true); closeGear() },
    onOpenSpec:          () => { cal.setView('spec'); closeGear() },
  }), [toggleTheme, closeGear, cal])

  const isCalView = cal.view === 'day' || cal.view === 'week' || cal.view === 'month'

  if (showLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={spinnerStyle} />
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <PoiroboAlertModal
        isOpen={poiroboAlertModalOpen}
        config={poiroboAlertConfig}
        theme={theme}
        onSave={handlePoiroboAlertSave}
        onClose={() => setPoiroboAlertModalOpen(false)}
      />
      <div style={styles.body}>
        {isMobile && sidebarOpen && (
          <div style={styles.mobileOverlay} onClick={handleOverlayClick} />
        )}

        {isCalView && (
          <Sidebar
            isOpen={sidebarOpen}
            isMobile={isMobile}
            isTablet={isTablet}
            macroFilter={macroFilter}
            onMacroFilterChange={setMacroFilter}
            stickyNotes={stickyNotes}
            onStickyNotesSaved={handleStickyNotesSaved}
            showPrivate={showPrivate}
            onShowPrivateChange={handleShowPrivateChange}
            showAnomaly={showAnomaly}
            onShowAnomalyChange={handleShowAnomalyChange}
            showPoiroboAlert={showPoiroboAlert}
            onShowPoiroboAlertChange={handleShowPoiroboAlertChange}
            onPoiroboAlertOpen={handlePoiroboAlertOpen}
            onGoToday={() => cal.goToDate(cal.today)}
          />
        )}

        <main style={styles.main}>
          {/* spec / legal / manual はカルーセル外 */}
          {cal.view === 'spec' && (
            <Suspense fallback={<ViewLoader />}>
              <SpecView theme={theme} isMobile={isMobile} />
            </Suspense>
          )}
          {cal.view === 'manual' && (
            <Suspense fallback={<ViewLoader />}>
              <ManualView theme={theme} isMobile={isMobile} onClose={() => cal.setView('support')} />
            </Suspense>
          )}
          {cal.view === 'legal' && (
            <Suspense fallback={<ViewLoader />}>
              <LegalModal theme={theme} isMobile={isMobile} onClose={() => cal.setView('support')} />
            </Suspense>
          )}

          {/* 研究室 */}
          {cal.view === 'support' && (
            <Suspense fallback={<ViewLoader />}>
              <SupportView theme={theme} isMobile={isMobile} supportTab={supportTab} onOpenManual={() => cal.setView('manual')} onOpenLegal={() => cal.setView('legal')} onNavigate={(v) => cal.setView(v)} />
            </Suspense>
          )}

          {/* チャート */}
          {cal.view === 'chart' && (
            <Suspense fallback={<ViewLoader />}>
              <ChartView theme={theme} isMobile={isMobile} symbol={chartSymbol} onSymbolChange={setChartSymbol} settingsOpen={chartSettingsOpen} onCloseSettings={() => setChartSettingsOpen(false)} />
            </Suspense>
          )}

          {/* データ（需給） */}
          {cal.view === 'quant' && (
            <Suspense fallback={<ViewLoader />}>
              <QuantView theme={theme} isMobile={isMobile} user={user} quantTab={quantTab} onQuantTabChange={setQuantTab} settingsOpen={quantSettingsOpen} onCloseSettings={() => setQuantSettingsOpen(false)} />
            </Suspense>
          )}

          {/* ノート */}
          {cal.view === 'note' && (
            <Suspense fallback={<ViewLoader />}>
              <NoteView
                theme={theme}
                isMobile={isMobile}
                onOpenManual={() => cal.setView('manual')}
                onOpenLegal={() => cal.setView('legal')}
              />
            </Suspense>
          )}

          {/* ── カレンダー（日/週/月 スワイプ） ── */}
          {isCalView && (
            <div style={carouselOuterStyle}>
              {/* カレンダーサブバー */}
              <div style={styles.calSubBar}>
                <button style={styles.subNavBtn} onClick={() => cal.go(-1)} aria-label="前へ"><ChevronLeft /></button>
                <h1 style={styles.subLabel}>{cal.label}</h1>
                <button style={styles.subNavBtn} onClick={() => cal.go(1)} aria-label="次へ"><ChevronRight /></button>
              </div>

              {/* 日/週/月 スワイプカルーセル */}
              <div
                style={carouselWrapStyle}
                onTouchStart={handleCalTouchStart}
                onTouchMove={handleCalTouchMove}
                onTouchEnd={handleCalTouchEnd}
              >
                <div ref={carouselRef} style={{
                  ...carouselTrackStyle,
                  transform: `translateX(-${calPanelIndex * 33.333}%)`,
                }}>
                  {/* Panel 0: 月 */}
                  <div style={calPanelStyle}>
                    <MonthView
                      days={cal.getMonthGrid()} today={cal.today} current={cal.current}
                      isToday={cal.isToday} isCurrentMonth={cal.isCurrentMonth}
                      onClickDay={(d) => { cal.goToDate(d); if (isMobile) cal.setView('day') }}
                      onOpenNote={(d) => { cal.goToDate(d); openNote(d) }}
                      getMarkers={getMarkers} getSqMarkers={getSqMarkers} getMacroEvents={getMacroEvents}
                      getAnomalyEvents={getAnomalyEvents}
                      isMarketClosed={isMarketClosed} getClosedReason={getClosedReason}
                      hasNote={hasNote} getNoteTitle={getNoteTitle} isMobile={isMobile} theme={theme}
                      showPoiroboAlert={showPoiroboAlert}
                      poiroboAlertConfig={poiroboAlertConfig}
                    />
                  </div>

                  {/* Panel 1: 週 */}
                  <div style={calPanelStyle}>
                    <WeekView
                      days={cal.getWeekDays()} current={cal.current} isToday={cal.isToday}
                      getMarkers={getMarkers} getSqMarkers={getSqMarkers} getMacroEvents={getMacroEvents}
                      isMarketClosed={isMarketClosed} getClosedReason={getClosedReason}
                      onOpenNote={openNote} hasNote={hasNote} getNoteTitle={getNoteTitle}
                      getScheduledEvents={getScheduledEvents} isMobile={isMobile} theme={theme}
                    />
                  </div>

                  {/* Panel 2: 日 */}
                  <div style={calPanelStyle}>
                    <DayView
                      date={cal.current} isToday={cal.isToday}
                      getMarkers={getMarkers} getSqMarkers={getSqMarkers} getMacroEvents={getMacroEvents}
                      isMarketClosed={isMarketClosed} getClosedReason={getClosedReason}
                      onOpenNote={openNote} hasNote={hasNote} getNoteTitle={getNoteTitle}
                      getScheduledEvents={getScheduledEvents} theme={theme}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 歯車ドロップダウン */}
      {gearOpen && (
        <GearDropdown
          dropRef={gearDropRef}
          pos={gearPos}
          theme={theme}
          user={user}
          syncStatus={syncStatus}
          {...gearActions}
        />
      )}

      {/* モーダル類 */}
      <Suspense fallback={null}>
        <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Suspense>

      <AuthModal
        isOpen={!isUnlocked && !showLoading} isRequired
        onClose={() => {}} onUnlock={() => setIsUnlocked(true)}
        user={user} syncStatus={syncStatus} onSignIn={signIn} onSignOut={signOut} onRetry={retrySync}
      />
      <AuthModal
        isOpen={authModalOpen && isUnlocked}
        onClose={() => setAuthModalOpen(false)} onUnlock={() => {}}
        user={user} syncStatus={syncStatus} onSignIn={signIn} onSignOut={signOut} onRetry={retrySync}
      />

      <DayNotePanel
        date={noteDate} prefillTime={notePrefillTime}
        onClose={closeNote} onSave={refreshNoteMap}
        onAfterSave={handleAfterSave} onSaved={showSaveToast}
        isMobile={isMobile}
      />

      {/* ── フローティングサブバー（CalendarHeader右上に浮かぶ） ── */}
      {(isCalView || cal.view === 'chart' || cal.view === 'quant') && (
        <div style={styles.floatSubBarBase}>
          <div style={styles.floatSubBar} className="glass">
          <div style={styles.floatPill} className="glass">
            {isCalView && (
              <>
                {CAL_VIEW_TABS.map(([key, label]) => (
                  <button
                    key={key}
                    style={{ ...styles.floatTab, ...(cal.view === key ? styles.floatTabActive : {}) }}
                    onClick={() => cal.setView(key)}
                  >{label}</button>
                ))}
                <span style={styles.floatDivider} />
                <button ref={gearBtnRef} style={styles.floatIconBtn} onClick={openGear} aria-label="設定">
                  <GearIcon />
                </button>
              </>
            )}
            {cal.view === 'chart' && (
              <>
                {CHART_SYMBOLS.map(s => (
                  <button
                    key={s.symbol}
                    style={{ ...styles.floatTab, ...(chartSymbol === s.symbol ? styles.floatTabActive : {}) }}
                    onClick={() => setChartSymbol(s.symbol)}
                  >{s.label}</button>
                ))}
                {!isMobile && (
                  <>
                    <span style={styles.floatDivider} />
                    <button style={styles.floatIconBtn} onClick={() => setChartSettingsOpen(true)} aria-label="チャートレイアウト">
                      <MonitorIcon />
                    </button>
                  </>
                )}
              </>
            )}
            {cal.view === 'quant' && (
              <>
                {QUANT_TABS.map((tab, i) => (
                  <button
                    key={tab}
                    style={{ ...styles.floatTab, ...(quantTab === tab ? styles.floatTabActive : {}) }}
                    onClick={() => setQuantTab(tab)}
                  >{QUANT_LABELS[i]}</button>
                ))}
                <span style={styles.floatDivider} />
                <button style={styles.floatIconBtn} onClick={() => setQuantSettingsOpen(true)} aria-label="ぽいロボ エンジン">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      )}

      {cal.view !== 'support' && (
        <CalendarHeader
          view={cal.view} setView={cal.setView}
          isMobile={isMobile} isTablet={isTablet}
          sidebarOpen={sidebarOpen} onMenuClick={handleMenuClick}
        />
      )}

      {/* トースト */}
      {loginToast && <Toast message="ログインしました" />}
      {saveToast  && <Toast message="保存しました" />}
    </div>
  )
}

// ── 定数 ──────────────────────────────────────────────────────────────────
const CAL_VIEW_TABS = [['month','月'],['week','週'],['day','日']] as const

const QUANT_TABS    = ['kankyou', 'genbutsu', 'micro'] as const
const QUANT_LABELS  = ['環境', '現物', '先物'] as const
// カルーセル用スタイル定数（スワイプ中に直接 DOM を操作するため ref でも使用）
const carouselOuterStyle: React.CSSProperties = { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }
const carouselWrapStyle:  React.CSSProperties = { flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }
const carouselTrackStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, bottom: 0,
  width: '300%', display: 'flex',
  transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
  willChange: 'transform',
}
const calPanelStyle: React.CSSProperties = { width: '33.333%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

const CHART_SYMBOLS = [
  { label: '日経225', symbol: 'INDEX:NKY'  },
  { label: 'ドル円',  symbol: 'FX:USDJPY' },
  { label: '米国債',  symbol: 'NASDAQ:TLT' },
]

const spinnerStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  border: '3px solid var(--glass-border)',
  borderTopColor: 'var(--accent)',
  animation: 'spin 0.7s linear infinite',
  display: 'inline-block',
}

// ── スタイル ───────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  app:         { height: '100%', display: 'flex', flexDirection: 'column' },
  body:        { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' },
  main:        { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  mobileOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 199 },

  calSubBar:    { display: 'flex', alignItems: 'center', padding: '6px 12px', flexShrink: 0, background: 'transparent', border: 'none', userSelect: 'none' },
  calSubLeft:   { flex: 1, display: 'flex', alignItems: 'center', gap: 6 },
  calSubCenter: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 },
  calSubRight:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' },
  calTabGroup:  { display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2, flexShrink: 0 },
  calTodayTab:  { padding: '5px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' },
  calTabDivider:{ width: 1, height: 16, background: 'var(--border-dim)', alignSelf: 'center', flexShrink: 0 },
  calTab:       { padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500, color: 'var(--text-sub)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' },
  calTabActive: { background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)', boxShadow: '0 2px 8px rgba(100,120,200,0.15)' },

  mobileCalNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0, padding: '16px 12px 12px' },
  subNavBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, color: 'var(--text-sub)', flexShrink: 0 },
  subLabel:     { fontWeight: 500, fontSize: 16, letterSpacing: '-0.3px', color: 'var(--text)', whiteSpace: 'nowrap', margin: '0 2px', flexShrink: 0 },

  gearBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: 'var(--text-sub)', cursor: 'pointer' },
  gearDropdown: { position: 'fixed', minWidth: 184, borderRadius: 10, overflow: 'hidden', zIndex: 500, display: 'flex', flexDirection: 'column', background: 'var(--modal-bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
  gearItem:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', textAlign: 'left', background: 'transparent', transition: 'background 0.1s' },
  gearItemIcon: { display: 'flex', alignItems: 'center', color: 'var(--text-sub)', flexShrink: 0 },
  gearDivider:  { height: 1, background: 'var(--border-dim)', margin: '0 12px' },

  toast: { position: 'fixed', bottom: 130, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'var(--glass-bg-strong)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', fontSize: 13, fontWeight: 500, color: 'var(--text)', animation: 'toastIn 0.25s ease' },

  floatSubBarBase: { position: 'fixed', bottom: 'calc(var(--header-height) + env(safe-area-inset-bottom, 0px) + 10px)', right: 12, zIndex: 150, borderRadius: 14, userSelect: 'none', background: 'var(--body-bg)', backgroundAttachment: 'fixed', transform: 'translateZ(0)', willChange: 'transform' },
  floatSubBar:  { borderRadius: 14, padding: 4 },
  floatPill:    { display: 'flex', alignItems: 'center', borderRadius: 10, padding: 2, gap: 2 },
  floatDivider:    { width: 1, height: 16, background: 'var(--border-dim)', alignSelf: 'center', flexShrink: 0, margin: '0 1px' },
  floatTab:        { padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500, color: 'var(--text-sub)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' },
  floatTabActive:  { background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)', boxShadow: '0 2px 8px rgba(100,120,200,0.15)' },
  floatIconBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, color: 'var(--text-sub)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s', flexShrink: 0 },
}
