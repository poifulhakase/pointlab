import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useCalendar } from './hooks/useCalendar'
import { useBreakpoint } from './hooks/useBreakpoint'
import { CalendarHeader, GearIcon, SunIcon, MoonIcon, BellIcon, ChevronLeft, ChevronRight } from './components/CalendarHeader'
import { Sidebar } from './components/Sidebar'
import { MonthView } from './components/MonthView'
import { WeekView } from './components/WeekView'
import { DayView } from './components/DayView'
import { DayNotePanel } from './components/DayNotePanel'
import { ChartView } from './components/ChartView'
import { YoutubeView } from './components/YoutubeView'
import { QuantView } from './components/QuantView'
import { SettingsPanel } from './components/SettingsPanel'
import { useNotifications } from './hooks/useNotifications'
import { getDividendDates, getMarkersForDate, type DividendDateSet } from './utils/dividendCalendar'
import { isMarketClosed, getClosedReason } from './utils/marketHolidays'
import { getSqDates, getSqMarkersForDate, type SqDate } from './utils/sqCalendar'
import { getMacroEventsForDate, type MacroFilter } from './utils/macroCalendar'
import { getAllNoteData, dateKey, type NoteMapEntry } from './utils/noteStorage'
import { getSettings, saveSettings } from './utils/settingsStorage'

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

  return (
    <div style={styles.app}>
      <div style={styles.body}>
        {isMobile && sidebarOpen && (
          <div style={styles.overlay} onClick={handleOverlayClick} />
        )}

        {cal.view !== 'chart' && cal.view !== 'quant' && cal.view !== 'youtube' && (
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
            onCreateNote={() => { cal.goToDate(cal.today); openNote(cal.today) }}
          />
        )}

        <main style={styles.main}>
          {/* カレンダーサブタブバー（日/週/月 + 今日・ナビ・ラベル・歯車） */}
          {(cal.view === 'day' || cal.view === 'week' || cal.view === 'month') && (
            <div style={styles.calSubBar} className="glass">
              {/* 左：日/週/月タブ */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div style={styles.calTabGroup} className="glass">
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

              {/* 中央：今日・ナビ・ラベル（スマホ月ビューはナビを外に移動） */}
              <div style={styles.calSubCenter}>
                {!(isMobile && cal.view === 'month') && (
                  <>
                    <button style={styles.subTodayBtn} className="glass" onClick={cal.goToday}>今日</button>
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

          {/* スマホ月ビュー専用：ナビバー（決算シーズン帯の直上） */}
          {isMobile && cal.view === 'month' && (
            <div style={styles.mobileMonthNav}>
              <button style={styles.subTodayBtn} className="glass" onClick={cal.goToday}>今日</button>
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
              <YoutubeView theme={theme} isMobile={isMobile} />
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
        </div>
      )}

      <DayNotePanel
        date={noteDate}
        prefillTime={notePrefillTime}
        onClose={closeNote}
        onSave={refreshNoteMap}
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
  calTabGroup: { display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2 },
  calSubCenter: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 },
  mobileMonthNav: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: '6px 12px 4px', flexShrink: 0,
  },
  subTodayBtn: { padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, color: 'var(--text)', flexShrink: 0 },
  subNavBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, color: 'var(--text-sub)', flexShrink: 0 },
  subLabel: { fontWeight: 500, letterSpacing: '-0.3px', color: 'var(--text)', whiteSpace: 'nowrap' as const, margin: '0 2px', flexShrink: 0 },
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
