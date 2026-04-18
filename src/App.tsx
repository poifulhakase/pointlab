import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
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
import { ChartView } from './components/ChartView'
import { YoutubeView } from './components/YoutubeView'
import { QuantView } from './components/QuantView'
import { SpecView } from './components/SpecView'
import { SettingsPanel } from './components/SettingsPanel'
import { useNotifications } from './hooks/useNotifications'
import { getDividendDates, getMarkersForDate, type DividendDateSet } from './utils/dividendCalendar'
import { isMarketClosed, getClosedReason } from './utils/marketHolidays'
import { getSqDates, getSqMarkersForDate, type SqDate } from './utils/sqCalendar'
import { getMacroEventsForDate, type MacroFilter } from './utils/macroCalendar'
import { getAllNoteData, dateKey, type NoteMapEntry } from './utils/noteStorage'
import { getSettings, saveSettings } from './utils/settingsStorage'
import { isGuestAuthed } from './utils/guestAuth'

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getSettings().theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const s = getSettings()
    saveSettings({ ...s, theme })
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])
  const cal = useCalendar()
  const { isMobile, isTablet, isDesktop } = useBreakpoint()
  useNotifications()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [gearOpen, setGearOpen] = useState(false)
  const [gearDropPos, setGearDropPos] = useState({ top: 0, right: 0 })
  const gearBtnRef = useRef<HTMLButtonElement>(null)
  const gearDropRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!gearOpen) return
    const handler = (e: MouseEvent) => {
      const inBtn  = gearBtnRef.current?.contains(e.target as Node)
      const inDrop = gearDropRef.current?.contains(e.target as Node)
      if (!inBtn && !inDrop) setGearOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [gearOpen])
  const openGear = () => {
    if (gearBtnRef.current) {
      const r = gearBtnRef.current.getBoundingClientRect()
      setGearDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setGearOpen(o => !o)
  }

  // 遅延マウント: 初回訪問後は常時マウントして状態を保持
  const [chartMounted, setChartMounted]     = useState(() => cal.view === 'chart')
  const [quantMounted, setQuantMounted]     = useState(() => cal.view === 'quant')
  const [youtubeMounted, setYoutubeMounted] = useState(() => cal.view === 'youtube')
  useEffect(() => {
    if (cal.view === 'chart')   setChartMounted(true)
    if (cal.view === 'quant')   setQuantMounted(true)
    if (cal.view === 'youtube') setYoutubeMounted(true)
  }, [cal.view])

  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  useEffect(() => { setSidebarOpen(isDesktop) }, [isDesktop])

  // マクロイベントフィルター
  const [macroFilter, setMacroFilter] = useState<MacroFilter>({ us: true, jp: true })

  // ノートパネル
  const [noteDate, setNoteDate]           = useState<Date | null>(null)
  const [notePrefillTime, setNotePrefillTime] = useState<string | undefined>(undefined)
  const [noteMap, setNoteMap] = useState<Map<string, NoteMapEntry>>(() => getAllNoteData())
  const refreshNoteMap  = useCallback(() => setNoteMap(getAllNoteData()), [])

  const { user, signIn, signOut, syncStatus, handleAfterSave, handleChannelsSaved, authLoading } = useFirebaseSync(refreshNoteMap)

  // ゲスト or Google ログイン済みかどうか
  const [isUnlocked, setIsUnlocked] = useState(() => isGuestAuthed())
  useEffect(() => { if (user) setIsUnlocked(true) }, [user])

  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Firebase 認証確定まで（Googleセッション復元待ち）はローディング表示
  const showLoading = authLoading && !isUnlocked
  const hasNote         = useCallback((d: Date) => noteMap.has(dateKey(d)), [noteMap])
  const getNoteTitle    = useCallback((d: Date) => {
    const data = noteMap.get(dateKey(d))
    if (!data) return ''
    // scheduled のときのみ時刻をタイトルに含める（未スケジュールは時刻を表示しない）
    const timeStr = (data.scheduled && data.startTime) ? data.startTime : ''
    return [timeStr, data.title].filter(Boolean).join(' ')
  }, [noteMap])
  const getScheduledEvent = useCallback((d: Date) => {
    const data = noteMap.get(dateKey(d))
    if (!data || !data.scheduled) return null
    return data
  }, [noteMap])
  const openNote  = useCallback((d: Date, time?: string) => { setNoteDate(d); setNotePrefillTime(time) }, [])
  const closeNote = useCallback(() => { setNoteDate(null); setNotePrefillTime(undefined) }, [])

  const year = cal.current.getFullYear()

  const dividendSets: DividendDateSet[] = useMemo(() =>
    [...getDividendDates(year - 1), ...getDividendDates(year), ...getDividendDates(year + 1)],
    [year])

  const sqDates: SqDate[] = useMemo(() =>
    [...getSqDates(year - 1), ...getSqDates(year), ...getSqDates(year + 1)],
    [year])

  const getMarkers   = useCallback((date: Date) => getMarkersForDate(date, dividendSets), [dividendSets])
  const getSqMarkers = useCallback((date: Date) => getSqMarkersForDate(date, sqDates), [sqDates])
  const getMacroEvents = useCallback(
    (date: Date) => getMacroEventsForDate(date, macroFilter),
    [macroFilter]
  )

  const handleMenuClick    = () => setSidebarOpen(prev => !prev)
  const handleOverlayClick = () => setSidebarOpen(false)

  if (showLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <div style={styles.body}>
        {isMobile && sidebarOpen && (
          <div style={styles.overlay} onClick={handleOverlayClick} />
        )}

        {cal.view !== 'chart' && cal.view !== 'quant' && cal.view !== 'youtube' && cal.view !== 'spec' && (
          <Sidebar
            current={cal.current}
            today={cal.today}
            onSelect={(d) => { cal.goToDate(d); if (isMobile) setSidebarOpen(false) }}
            onNavigate={cal.go}
            isOpen={sidebarOpen}
            isMobile={isMobile}
            isTablet={isTablet}
            macroFilter={macroFilter}
            onMacroFilterChange={setMacroFilter}
          />
        )}

        <main style={styles.main}>
          {/* カレンダーサブタブバー（日/週/月 + 今日・ナビ・ラベル・歯車） */}
          {(cal.view === 'day' || cal.view === 'week' || cal.view === 'month') && (
            <div style={styles.calSubBar} className="glass">
              {/* 左：日/週/月タブ＋今日ボタン（スマホは今日をタブ右隣に配置） */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={styles.calTabGroup} className="glass">
                  <button style={styles.calTodayTab} onClick={cal.goToday}>今日</button>
                  <span style={styles.calTabDivider} />
                  {([['day','日'],['week','週'],['month','月']] as const).map(([key, label]) => (
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

              {/* 中央：ナビ・ラベル（スマホは全ビュー非表示→下のmobileCalNavで共通表示） */}
              <div style={styles.calSubCenter}>
                {!isMobile && (
                  <>
                    <button style={styles.subNavBtn} onClick={() => cal.go(-1)} aria-label="前へ">
                      <ChevronLeft />
                    </button>
                    <h1 style={{ ...styles.subLabel, fontSize: 16 }}>{cal.label()}</h1>
                    <button style={styles.subNavBtn} onClick={() => cal.go(1)} aria-label="次へ">
                      <ChevronRight />
                    </button>
                  </>
                )}
              </div>

              {/* 右：歯車 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <button ref={gearBtnRef} style={styles.gearBtn} onClick={openGear} aria-label="設定">
                  <GearIcon />
                </button>
              </div>
            </div>
          )}

          {/* スマホ共通ナビ（月/週/日）：subBar の直下に今日＋前後ナビ */}
          {isMobile && (cal.view === 'month' || cal.view === 'week' || cal.view === 'day') && (
            <div style={styles.mobileCalNav}>
              <button style={styles.subNavBtn} onClick={() => cal.go(-1)} aria-label="前へ">
                <ChevronLeft />
              </button>
              <h1 style={{ ...styles.subLabel, fontSize: 15 }}>{cal.label()}</h1>
              <button style={styles.subNavBtn} onClick={() => cal.go(1)} aria-label="次へ">
                <ChevronRight />
              </button>
            </div>
          )}

          {cal.view === 'month' && (
            <MonthView
              days={cal.getMonthGrid()}
              today={cal.today}
              current={cal.current}
              isToday={cal.isToday}
              isCurrentMonth={cal.isCurrentMonth}
              onClickDay={(d) => { cal.goToDate(d); if (isMobile) cal.setView('day') }}
              onOpenNote={(d) => { cal.goToDate(d); openNote(d) }}
              getMarkers={getMarkers}
              getSqMarkers={getSqMarkers}
              getMacroEvents={getMacroEvents}
              isMarketClosed={isMarketClosed}
              getClosedReason={getClosedReason}
              hasNote={hasNote}
              getNoteTitle={getNoteTitle}
              isMobile={isMobile}
            />
          )}
          {cal.view === 'week' && (
            <WeekView
              days={cal.getWeekDays()}
              current={cal.current}
              isToday={cal.isToday}
              getMarkers={getMarkers}
              getSqMarkers={getSqMarkers}
              getMacroEvents={getMacroEvents}
              isMarketClosed={isMarketClosed}
              getClosedReason={getClosedReason}
              onOpenNote={openNote}
              hasNote={hasNote}
              getNoteTitle={getNoteTitle}
              getScheduledEvent={getScheduledEvent}
              isMobile={isMobile}
            />
          )}
          {cal.view === 'day' && (
            <DayView
              date={cal.current}
              isToday={cal.isToday}
              getMarkers={getMarkers}
              getSqMarkers={getSqMarkers}
              getMacroEvents={getMacroEvents}
              isMarketClosed={isMarketClosed}
              getClosedReason={getClosedReason}
              onOpenNote={openNote}
              hasNote={hasNote}
              getNoteTitle={getNoteTitle}
              getScheduledEvent={getScheduledEvent}
            />
          )}
          {/* 仕様書ビュー */}
          {cal.view === 'spec' && (
            <SpecView theme={theme} isMobile={isMobile} />
          )}

          {/* チャート・クオンツ・YouTube: 初回訪問時にマウント、以降は display で切替（状態保持のため） */}
          {chartMounted && (
            <div style={{ display: cal.view === 'chart' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
              <ChartView theme={theme} isMobile={isMobile} />
            </div>
          )}
          {quantMounted && (
            <div style={{ display: cal.view === 'quant' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
              <QuantView theme={theme} isMobile={isMobile} />
            </div>
          )}
          {youtubeMounted && (
            <div style={{ display: cal.view === 'youtube' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
              <YoutubeView theme={theme} isMobile={isMobile} onChannelsSaved={handleChannelsSaved} />
            </div>
          )}
        </main>
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* 歯車ドロップダウン（fixed: overflow:hidden の影響を受けない） */}
      {gearOpen && (
        <div
          ref={gearDropRef}
          style={{ ...styles.gearDropdown, top: gearDropPos.top, right: gearDropPos.right }}
          className="glass"
        >
          <button style={styles.gearDropdownItem} onClick={() => { toggleTheme(); setGearOpen(false) }}>
            <span style={styles.gearDropdownIcon}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
            <span>{theme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>
          </button>
          <div style={styles.gearDropdownDivider} />
          <button style={styles.gearDropdownItem} onClick={() => { setSettingsOpen(true); setGearOpen(false) }}>
            <span style={styles.gearDropdownIcon}><BellIcon /></span>
            <span>通知設定</span>
          </button>
          <div style={styles.gearDropdownDivider} />
          <button style={styles.gearDropdownItem} onClick={() => { cal.setView('spec'); setGearOpen(false) }}>
            <span style={styles.gearDropdownIcon}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </span>
            <span>説明書</span>
          </button>
          <div style={styles.gearDropdownDivider} />
          <button
            style={styles.gearDropdownItem}
            onClick={() => { setAuthModalOpen(true); setGearOpen(false) }}
          >
            <span style={styles.gearDropdownIcon}>
              {user ? (
                user.photoURL
                  ? <img src={user.photoURL} alt="" style={{ width: 15, height: 15, borderRadius: '50%' }} referrerPolicy="no-referrer" />
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              )}
            </span>
            <span style={{ flex: 1 }}>{user ? (user.displayName ?? user.email ?? 'アカウント') : 'Googleでログイン'}</span>
            {user && syncStatus === 'synced' && (
              <span style={{ fontSize: 10, color: 'rgba(96,200,140,0.9)', marginLeft: 4 }}>✓</span>
            )}
            {user && syncStatus === 'syncing' && (
              <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4 }}>...</span>
            )}
          </button>
        </div>
      )}

      {/* 未認証: 閉じられないログインモーダル */}
      <AuthModal
        isOpen={!isUnlocked && !showLoading}
        isRequired
        onClose={() => {}}
        onUnlock={() => setIsUnlocked(true)}
        user={user}
        syncStatus={syncStatus}
        onSignIn={signIn}
        onSignOut={signOut}
      />

      {/* 認証済み: 歯車から開くアカウントモーダル */}
      <AuthModal
        isOpen={authModalOpen && isUnlocked}
        onClose={() => setAuthModalOpen(false)}
        onUnlock={() => {}}
        user={user}
        syncStatus={syncStatus}
        onSignIn={signIn}
        onSignOut={signOut}
      />

      <DayNotePanel
        date={noteDate}
        prefillTime={notePrefillTime}
        onClose={closeNote}
        onSave={refreshNoteMap}
        onAfterSave={handleAfterSave}
        isMobile={isMobile}
      />

      {/* グローバルナビ：最下部 */}
      <CalendarHeader
        view={cal.view}
        setView={cal.setView}
        isMobile={isMobile}
        isTablet={isTablet}
        sidebarOpen={sidebarOpen}
        onMenuClick={handleMenuClick}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app:  { height: '100%', display: 'flex', flexDirection: 'column' },
  body: { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(2px)',
    zIndex: 199,
  },
  calSubBar: {
    display: 'flex', alignItems: 'center',
    padding: '6px 12px', flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  calTabGroup: { display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2, flexShrink: 0 },
  calSubCenter: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 },
  mobileCalNav: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, flexShrink: 0,
    padding: '6px 12px 2px',
  },
  subTodayBtn: { padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: 'var(--text)', flexShrink: 0 },
  subNavBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, color: 'var(--text-sub)', flexShrink: 0 },
  subLabel: { fontWeight: 500, letterSpacing: '-0.3px', color: 'var(--text)', whiteSpace: 'nowrap' as const, margin: '0 2px', flexShrink: 0 },
  calTodayTab: {
    padding: '5px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600,
    color: 'var(--text)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  },
  calTabDivider: {
    width: 1, height: 16, background: 'var(--border-dim)', alignSelf: 'center', flexShrink: 0,
  },
  calTab: {
    padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
    color: 'var(--text-sub)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  },
  calTabActive: {
    background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)',
    boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
  },
  gearBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    color: 'var(--text-sub)', cursor: 'pointer',
  },
  gearDropdown: {
    position: 'fixed',
    minWidth: 160, borderRadius: 10, overflow: 'hidden',
    zIndex: 500, display: 'flex', flexDirection: 'column',
    background: 'var(--modal-bg)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
  gearDropdownItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', fontSize: 13, fontWeight: 500,
    color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const,
    background: 'transparent',
    transition: 'background 0.1s',
  },
  gearDropdownIcon: { display: 'flex', alignItems: 'center', color: 'var(--text-sub)' },
  gearDropdownDivider: { height: 1, background: 'var(--border-dim)', margin: '0 12px' },
}
