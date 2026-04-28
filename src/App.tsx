import { lazy, Suspense, memo, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useCalendar, type ViewMode } from './hooks/useCalendar'
import { useBreakpoint } from './hooks/useBreakpoint'
import { useFirebaseSync } from './hooks/useFirebaseSync'
import { CalendarHeader, GearIcon, SunIcon, MoonIcon, BellIcon, ChevronLeft, ChevronRight } from './components/CalendarHeader'
import { AuthModal } from './components/AuthModal'
import { Sidebar } from './components/Sidebar'
import { MonthView } from './components/MonthView'
import { WeekView } from './components/WeekView'
import { DayView } from './components/DayView'
import { DayNotePanel } from './components/DayNotePanel'
import { LegalModal } from './components/LegalModal'
import { SettingsPanel } from './components/SettingsPanel'
import { useNotifications } from './hooks/useNotifications'
import { getDividendDates, getMarkersForDate, type DividendDateSet } from './utils/dividendCalendar'
import { isMarketClosed, getClosedReason } from './utils/marketHolidays'
import { getSqDates, getSqMarkersForDate, type SqDate } from './utils/sqCalendar'
import { getMacroEventsForDate, type MacroFilter } from './utils/macroCalendar'
import { getAllNoteData, dateKey, type NoteMapEntry, type ScheduleEntry } from './utils/noteStorage'
import { getSettings, saveSettings } from './utils/settingsStorage'
import { isGuestAuthed } from './utils/guestAuth'

// ── コード分割: 重いビューは初回アクセス時にのみロード ─────────────────
const ChartView   = lazy(() => import('./components/ChartView').then(m => ({ default: m.ChartView })))
const QuantView   = lazy(() => import('./components/QuantView').then(m => ({ default: m.QuantView })))
const SpecView    = lazy(() => import('./components/SpecView').then(m => ({ default: m.SpecView })))
const NoteView    = lazy(() => import('./components/NoteView').then(m => ({ default: m.NoteView })))
const ManualView  = lazy(() => import('./components/ManualView').then(m => ({ default: m.ManualView })))

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
  pos: { top: number; right: number }
  theme: 'dark' | 'light'
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null
  syncStatus: string
  onToggleTheme: () => void
  onOpenNotifications: () => void
  onOpenManual: () => void
  onOpenAccount: () => void
}
const GearDropdown = memo(({
  dropRef, pos, theme, user, syncStatus,
  onToggleTheme, onOpenNotifications, onOpenManual, onOpenAccount,
}: GearDropdownProps) => (
  <div ref={dropRef} style={{ ...styles.gearDropdown, top: pos.top, right: pos.right }} className="glass">
    <GearItem icon={<BookIcon />} onClick={onOpenManual}>使い方</GearItem>
    <Divider />
    <GearItem icon={<BellIcon />} onClick={onOpenNotifications}>通知設定</GearItem>
    <Divider />
    <GearItem icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={onToggleTheme}>
      {theme === 'dark' ? 'ライトモード' : 'ダークモード'}
    </GearItem>
    <Divider />
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
const Divider = () => <div style={styles.gearDivider} />

// ── 小さいアイコン群 ───────────────────────────────────────────────────
function BookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
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
  const [gearPos, setGearPos]       = useState({ top: 0, right: 0 })
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
      setGearPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setGearOpen(o => !o)
  }, [])

  const closeGear = useCallback(() => setGearOpen(false), [])

  // ── スワイプナビゲーション ────────────────────────────────────────────
  const touchStartXRef  = useRef(0)
  const touchStartYRef  = useRef(0)
  const isDraggingRef   = useRef(false)
  const dragOffsetRef   = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)
  const lastCalViewRef = useRef<'month' | 'week' | 'day'>('month')

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

  const getMarkers     = useCallback((d: Date) => getMarkersForDate(d, dividendSets), [dividendSets])
  const getSqMarkers   = useCallback((d: Date) => getSqMarkersForDate(d, sqDates),    [sqDates])
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

  const openNote  = useCallback((d: Date, time?: string) => { setNoteDate(d); setNotePrefillTime(time) }, [])
  const closeNote = useCallback(() => { setNoteDate(null); setNotePrefillTime(undefined) }, [])

  const handleMenuClick    = useCallback(() => setSidebarOpen(p => !p), [])
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), [])

  // ── スワイプナビ計算 ──────────────────────────────────────────────────
  // メインパネルインデックス: -1 は carousel 外のビュー（spec/legal/manual）
  const mainPanelIndex = useMemo(() => {
    if (cal.view === 'month' || cal.view === 'week' || cal.view === 'day') return 0
    if (cal.view === 'chart') return 1
    if (cal.view === 'quant') return 2
    if (cal.view === 'note')  return 3
    return -1
  }, [cal.view])

  // カレンダーサブビューを記憶（スワイプで戻った時に復元）
  useEffect(() => {
    if (cal.view === 'month' || cal.view === 'week' || cal.view === 'day') {
      lastCalViewRef.current = cal.view
    }
  }, [cal.view])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (mainPanelIndex < 0) return
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
    isDraggingRef.current = false
  }, [mainPanelIndex])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (mainPanelIndex < 0) return
    const dx = e.touches[0].clientX - touchStartXRef.current
    const dy = e.touches[0].clientY - touchStartYRef.current
    if (!isDraggingRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        isDraggingRef.current = true
      } else if (Math.abs(dy) > 8) {
        return
      }
    }
    if (isDraggingRef.current) {
      const clamped = mainPanelIndex === 0 && dx > 0 ? Math.min(dx, 60)
        : mainPanelIndex === 3 && dx < 0 ? Math.max(dx, -60)
        : dx
      dragOffsetRef.current = clamped
      setDragOffset(clamped)
    }
  }, [mainPanelIndex])

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    const dx = dragOffsetRef.current
    dragOffsetRef.current = 0
    isDraggingRef.current = false
    setDragOffset(0)
    if (Math.abs(dx) < 50) return
    const VIEWS: ViewMode[] = ['month', 'chart', 'quant', 'note']
    if (dx < 0 && mainPanelIndex < 3) {
      cal.setView(VIEWS[mainPanelIndex + 1])
    } else if (dx > 0 && mainPanelIndex > 0) {
      cal.setView(mainPanelIndex === 1 ? lastCalViewRef.current : VIEWS[mainPanelIndex - 1])
    }
  }, [mainPanelIndex, cal])

  // ── 歯車アクション（closeGear を含む） ───────────────────────────────
  const gearActions = useMemo(() => ({
    onToggleTheme:       () => { toggleTheme(); closeGear() },
    onOpenNotifications: () => { setSettingsOpen(true); closeGear() },
    onOpenManual:        () => { cal.setView('manual'); closeGear() },
    onOpenAccount:       () => { setAuthModalOpen(true); closeGear() },
  }), [toggleTheme, closeGear, cal])

  // サイドバー表示条件（カレンダーパネルのみ）
  const showSidebar = mainPanelIndex === 0

  if (showLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={spinnerStyle} />
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <div style={styles.body}>
        {isMobile && sidebarOpen && (
          <div style={styles.mobileOverlay} onClick={handleOverlayClick} />
        )}

        {showSidebar && (
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
              <ManualView theme={theme} isMobile={isMobile} />
            </Suspense>
          )}
          {cal.view === 'legal' && (
            <LegalModal theme={theme} isMobile={isMobile} />
          )}

          {/* ── カルーセル（ホーム/チャート/データ/ノート） ── */}
          {mainPanelIndex >= 0 && (
            <div
              style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* カレンダーサブバー（カレンダーパネルのみ） */}
              {mainPanelIndex === 0 && (
                <>
                  <div style={styles.calSubBar} className="glass">
                    <div style={styles.calSubLeft}>
                      <div style={styles.calTabGroup} className="glass">
                        <button style={styles.calTodayTab} onClick={cal.goToday}>今日</button>
                        <span style={styles.calTabDivider} />
                        {CAL_VIEW_TABS.map(([key, label]) => (
                          <button
                            key={key}
                            style={{ ...styles.calTab, ...(cal.view === key ? styles.calTabActive : {}) }}
                            onClick={() => cal.setView(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={styles.calSubCenter}>
                      {!isMobile && (
                        <>
                          <button style={styles.subNavBtn} onClick={() => cal.go(-1)} aria-label="前へ"><ChevronLeft /></button>
                          <h1 style={styles.subLabel}>{cal.label()}</h1>
                          <button style={styles.subNavBtn} onClick={() => cal.go(1)} aria-label="次へ"><ChevronRight /></button>
                        </>
                      )}
                    </div>
                    <div style={styles.calSubRight}>
                      <button ref={gearBtnRef} style={styles.gearBtn} onClick={openGear} aria-label="設定">
                        <GearIcon />
                      </button>
                    </div>
                  </div>
                  {isMobile && (
                    <div style={styles.mobileCalNav}>
                      <button style={styles.subNavBtn} onClick={() => cal.go(-1)} aria-label="前へ"><ChevronLeft /></button>
                      <h1 style={{ ...styles.subLabel, fontSize: 15 }}>{cal.label()}</h1>
                      <button style={styles.subNavBtn} onClick={() => cal.go(1)} aria-label="次へ"><ChevronRight /></button>
                    </div>
                  )}
                </>
              )}

              {/* スライドトラック */}
              <div style={{
                flex: 1, display: 'flex', minHeight: 0,
                width: '400%',
                height: '100%',
                transform: `translateX(calc(-${mainPanelIndex * 25}% + ${dragOffset}px))`,
                transition: dragOffset !== 0 ? 'none' : 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                willChange: 'transform',
              }}>
                {/* Panel 0: カレンダー */}
                <div style={{ width: '25%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  {cal.view === 'month' && (
                    <MonthView
                      days={cal.getMonthGrid()} today={cal.today} current={cal.current}
                      isToday={cal.isToday} isCurrentMonth={cal.isCurrentMonth}
                      onClickDay={(d) => { cal.goToDate(d); if (isMobile) cal.setView('day') }}
                      onOpenNote={(d) => { cal.goToDate(d); openNote(d) }}
                      getMarkers={getMarkers} getSqMarkers={getSqMarkers} getMacroEvents={getMacroEvents}
                      isMarketClosed={isMarketClosed} getClosedReason={getClosedReason}
                      hasNote={hasNote} getNoteTitle={getNoteTitle} isMobile={isMobile} theme={theme}
                    />
                  )}
                  {cal.view === 'week' && (
                    <WeekView
                      days={cal.getWeekDays()} current={cal.current} isToday={cal.isToday}
                      getMarkers={getMarkers} getSqMarkers={getSqMarkers} getMacroEvents={getMacroEvents}
                      isMarketClosed={isMarketClosed} getClosedReason={getClosedReason}
                      onOpenNote={openNote} hasNote={hasNote} getNoteTitle={getNoteTitle}
                      getScheduledEvents={getScheduledEvents} isMobile={isMobile} theme={theme}
                    />
                  )}
                  {cal.view === 'day' && (
                    <DayView
                      date={cal.current} isToday={cal.isToday}
                      getMarkers={getMarkers} getSqMarkers={getSqMarkers} getMacroEvents={getMacroEvents}
                      isMarketClosed={isMarketClosed} getClosedReason={getClosedReason}
                      onOpenNote={openNote} hasNote={hasNote} getNoteTitle={getNoteTitle}
                      getScheduledEvents={getScheduledEvents} theme={theme}
                    />
                  )}
                </div>

                {/* Panel 1: チャート */}
                <div style={{ width: '25%', display: 'flex', minHeight: 0 }}>
                  <Suspense fallback={<ViewLoader />}>
                    <ChartView theme={theme} isMobile={isMobile} />
                  </Suspense>
                </div>

                {/* Panel 2: データ（需給） */}
                <div style={{ width: '25%', display: 'flex', minHeight: 0 }}>
                  <Suspense fallback={<ViewLoader />}>
                    <QuantView theme={theme} isMobile={isMobile} user={user} />
                  </Suspense>
                </div>

                {/* Panel 3: ノート */}
                <div style={{ width: '25%', display: 'flex', minHeight: 0 }}>
                  <Suspense fallback={<ViewLoader />}>
                    <NoteView theme={theme} isMobile={isMobile} onOpenSpec={() => cal.setView('spec')} onOpenLegal={() => cal.setView('legal')} />
                  </Suspense>
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
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

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

      <CalendarHeader
        view={cal.view} setView={cal.setView}
        isMobile={isMobile} isTablet={isTablet}
        sidebarOpen={sidebarOpen} onMenuClick={handleMenuClick}
      />

      {/* トースト */}
      {loginToast && <Toast message="ログインしました" />}
      {saveToast  && <Toast message="保存しました" />}
    </div>
  )
}

// ── 定数 ──────────────────────────────────────────────────────────────────
const CAL_VIEW_TABS = [['day','日'],['week','週'],['month','月']] as const

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

  calSubBar:    { display: 'flex', alignItems: 'center', padding: '6px 12px', flexShrink: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', userSelect: 'none' },
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

  toast: { position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'var(--glass-bg-strong)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', fontSize: 13, fontWeight: 500, color: 'var(--text)', animation: 'toastIn 0.25s ease' },
}
