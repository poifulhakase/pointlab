import { lazy, Suspense, memo, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useCalendar } from './hooks/useCalendar'
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
  onOpenLegal: () => void
  onOpenSpec: () => void
  onOpenAccount: () => void
}
const GearDropdown = memo(({
  dropRef, pos, theme, user, syncStatus,
  onToggleTheme, onOpenNotifications, onOpenLegal, onOpenSpec, onOpenAccount,
}: GearDropdownProps) => (
  <div ref={dropRef} style={{ ...styles.gearDropdown, top: pos.top, right: pos.right }} className="glass">
    <GearItem icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={onToggleTheme}>
      {theme === 'dark' ? 'ライトモード' : 'ダークモード'}
    </GearItem>
    <Divider />
    <GearItem icon={<BellIcon />} onClick={onOpenNotifications}>通知設定</GearItem>
    <Divider />
    <GearItem icon={<DocIcon />} onClick={onOpenSpec}>説明書</GearItem>
    <Divider />
    <GearItem icon={<ShieldIcon />} onClick={onOpenLegal}>プライバシー・免責事項</GearItem>
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
function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
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

  // ── 遅延マウント（状態保持 + コード分割の組み合わせ） ───────────────
  const [chartMounted, setChartMounted] = useState(() => cal.view === 'chart')
  const [quantMounted, setQuantMounted] = useState(() => cal.view === 'quant')

  useEffect(() => {
    if (cal.view === 'chart') setChartMounted(true)
    if (cal.view === 'quant') setQuantMounted(true)
  }, [cal.view])

  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  useEffect(() => { setSidebarOpen(isDesktop) }, [isDesktop])

  // ── モーダル類 ────────────────────────────────────────────────────────
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // ── マクロフィルター ──────────────────────────────────────────────────
  const [macroFilter, setMacroFilter] = useState<MacroFilter>({ us: true, jp: true })

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

  const hasNote  = useCallback((d: Date) => noteMap.has(dateKey(d)), [noteMap])
  const getNoteTitle = useCallback((d: Date) => {
    const data = noteMap.get(dateKey(d))
    if (!data) return ''
    if (data.schedules.length > 0) {
      const first  = data.schedules[0]
      const suffix = data.schedules.length > 1 ? ` +${data.schedules.length - 1}` : ''
      return [first.startTime, first.title].filter(Boolean).join(' ') + suffix
    }
    return data.title
  }, [noteMap])
  const getScheduledEvents = useCallback((d: Date): ScheduleEntry[] =>
    noteMap.get(dateKey(d))?.schedules ?? [], [noteMap])

  const openNote  = useCallback((d: Date, time?: string) => { setNoteDate(d); setNotePrefillTime(time) }, [])
  const closeNote = useCallback(() => { setNoteDate(null); setNotePrefillTime(undefined) }, [])

  const handleMenuClick    = useCallback(() => setSidebarOpen(p => !p), [])
  const handleOverlayClick = useCallback(() => setSidebarOpen(false), [])

  // ── 歯車アクション（closeGear を含む） ───────────────────────────────
  const gearActions = useMemo(() => ({
    onToggleTheme:       () => { toggleTheme(); closeGear() },
    onOpenNotifications: () => { setSettingsOpen(true); closeGear() },
    onOpenLegal:         () => { cal.setView('legal'); closeGear() },
    onOpenSpec:          () => { cal.setView('spec'); closeGear() },
    onOpenAccount:       () => { setAuthModalOpen(true); closeGear() },
  }), [toggleTheme, closeGear, cal])

  // サイドバー表示条件
  const showSidebar = cal.view !== 'chart' && cal.view !== 'quant' &&
    cal.view !== 'note' && cal.view !== 'spec' && cal.view !== 'legal'

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
          />
        )}

        <main style={styles.main}>
          {/* カレンダーサブバー */}
          {(cal.view === 'day' || cal.view === 'week' || cal.view === 'month') && (
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
          )}

          {/* スマホ共通ナビ */}
          {isMobile && (cal.view === 'month' || cal.view === 'week' || cal.view === 'day') && (
            <div style={styles.mobileCalNav}>
              <button style={styles.subNavBtn} onClick={() => cal.go(-1)} aria-label="前へ"><ChevronLeft /></button>
              <h1 style={{ ...styles.subLabel, fontSize: 15 }}>{cal.label()}</h1>
              <button style={styles.subNavBtn} onClick={() => cal.go(1)} aria-label="次へ"><ChevronRight /></button>
            </div>
          )}

          {/* カレンダービュー */}
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

          {/* Suspense ラップ: 初回アクセス時にチャンク非同期ロード */}
          {cal.view === 'note' && (
            <Suspense fallback={<ViewLoader />}>
              <NoteView theme={theme} isMobile={isMobile} />
            </Suspense>
          )}
          {cal.view === 'spec' && (
            <Suspense fallback={<ViewLoader />}>
              <SpecView theme={theme} isMobile={isMobile} />
            </Suspense>
          )}
          {cal.view === 'legal' && (
            <LegalModal theme={theme} isMobile={isMobile} />
          )}

          {/* 重いビュー: 初回訪問後は display で切替（状態保持） */}
          {chartMounted && (
            <div style={{ display: cal.view === 'chart' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
              <Suspense fallback={<ViewLoader />}>
                <ChartView theme={theme} isMobile={isMobile} />
              </Suspense>
            </div>
          )}
          {quantMounted && (
            <div style={{ display: cal.view === 'quant' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
              <Suspense fallback={<ViewLoader />}>
                <QuantView theme={theme} isMobile={isMobile} />
              </Suspense>
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
