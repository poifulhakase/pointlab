import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { restGetDoc, restSetDoc } from '../utils/firestoreRest'
import type { CotNikkeiWeekData } from '../utils/cotNikkeiData'

type Props = {
  theme:           'dark' | 'light'
  isMobile:        boolean
  data:            CotNikkeiWeekData[]
  loading:         boolean
  error:           string
  onReload:        () => void
  onOpenNetDelta?: () => void
}

// ── ヘルパー ──────────────────────────────────────
function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v === 0)   return '0'
  return (v > 0 ? '+' : '') + v.toLocaleString()
}


function cellColor(v: number | null | undefined, theme: 'dark' | 'light'): string {
  if (!v) return 'var(--text-dim)'
  if (v > 0) return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.9)'
  return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.9)'
}

// ── タンク定義 ──────────────────────────────────────
type CotTank = {
  group:      string
  net:        number
  wow:        number
  maxAbsNet:  number
}

const GROUP_META: Record<string, { label: string; color: string; desc: string }> = {
  nonComm: { label: 'ヘッジファンド（投機筋）', color: '#60a5fa', desc: '' },
  comm:    { label: '機関投資家（実需）',       color: '#fb923c', desc: '' },
  nonRept: { label: '個人投資家（小口）',       color: '#a78bfa', desc: '' },
}

function buildCotTanks(data: CotNikkeiWeekData[]): CotTank[] {
  if (data.length === 0) return []
  const cur  = data[0]
  const prev = data[1] ?? null
  const maxAbs = (key: 'nonCommNet' | 'commNet' | 'nonReptNet') =>
    Math.max(...data.map(d => Math.abs(d[key])), 1000)
  return [
    { group: 'nonComm', net: cur.nonCommNet, wow: prev ? cur.nonCommNet - prev.nonCommNet : 0, maxAbsNet: maxAbs('nonCommNet') * 1.2 },
    { group: 'comm',    net: cur.commNet,    wow: prev ? cur.commNet    - prev.commNet    : 0, maxAbsNet: maxAbs('commNet')    * 1.2 },
    { group: 'nonRept', net: cur.nonReptNet, wow: prev ? cur.nonReptNet - prev.nonReptNet : 0, maxAbsNet: maxAbs('nonReptNet') * 1.2 },
  ]
}

const BUBBLES = [
  { size: 5, left: '22%', delay: '0s',   dur: '2.8s' },
  { size: 4, left: '58%', delay: '1.1s', dur: '3.2s' },
  { size: 3, left: '40%', delay: '2.0s', dur: '2.4s' },
]

// ── タンクカード ──────────────────────────────────────
function TankCard({ group, net, wow, maxAbsNet, theme }: CotTank & { theme: 'dark' | 'light' }) {
  const isLight    = theme === 'light'
  const waterLevel = Math.min(Math.abs(net) / maxAbsNet * 100, 105)
  const isShort    = net <= 0
  const groupColor = GROUP_META[group]?.color ?? '#888'
  const isOverflow = waterLevel >= 100

  const liquidTop    = isShort ? 'rgba(239,68,68,0.22)' : 'rgba(52,211,153,0.22)'
  const liquidBottom = isShort ? 'rgba(239,68,68,0.52)' : 'rgba(52,211,153,0.52)'
  const liquidBorder = isShort ? 'rgba(239,68,68,0.80)' : 'rgba(52,211,153,0.80)'

  const numColor = isShort
    ? (isLight ? 'rgba(200,50,30,0.9)' : 'rgba(255,120,100,0.95)')
    : (isLight ? 'rgba(22,130,80,0.9)' : 'rgba(96,200,140,0.95)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
      <div style={{
        width: '100%', maxWidth: 72, height: 120,
        position: 'relative',
        borderRadius: '10px 10px 26px 26px',
        border: `1.5px solid ${groupColor}50`,
        background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
        boxShadow: `0 4px 12px rgba(0,0,0,0.18), inset 0 0 0 1px ${groupColor}18`,
      }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${Math.min(waterLevel, 100)}%`,
          background: `linear-gradient(180deg, ${liquidTop} 0%, ${liquidBottom} 100%)`,
          borderTop: `2px solid ${liquidBorder}`,
          transition: 'height 0.9s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 4,
            background: `linear-gradient(90deg, transparent 0%, ${liquidBorder} 50%, transparent 100%)`,
            animation: 'tankShimmer 3s ease-in-out infinite',
          }} />
          {BUBBLES.map((b, i) => (
            <div key={i} style={{
              position: 'absolute', bottom: '8%', left: b.left,
              width: b.size, height: b.size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), ${liquidBorder}60)`,
              animation: `tankBubble ${b.dur} ${b.delay} ease-in infinite`,
            }} />
          ))}
        </div>
        <div style={{
          position: 'absolute', top: '6%', left: '9%',
          width: '16%', height: '32%',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.11)',
          pointerEvents: 'none',
        }} />
        {isOverflow && (
          <div style={{
            position: 'absolute', top: 3, left: 0, right: 0,
            textAlign: 'center', fontSize: 8, fontWeight: 900,
            color: liquidBorder, letterSpacing: 1,
          }}>MAX!</div>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, letterSpacing: '-0.5px',
          color: waterLevel > 52
            ? 'rgba(255,255,255,0.93)'
            : (isLight ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.60)'),
          textShadow: waterLevel > 52 ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
          pointerEvents: 'none',
        }}>
          {waterLevel.toFixed(1)}%
        </div>
        {[25, 50, 75].map(pct => (
          <div key={pct}>
            <div style={{ position: 'absolute', right: 0, bottom: `${pct}%`, width: 5, height: 1, background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
            <div style={{ position: 'absolute', left: 0,  bottom: `${pct}%`, width: 5, height: 1, background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: numColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {net > 0 ? '+' : ''}{net.toLocaleString()}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: -2 }}>枚</div>
      <div style={{
        fontSize: 10, fontVariantNumeric: 'tabular-nums',
        color: wow < 0 ? 'rgba(255,120,100,0.75)' : 'rgba(96,200,140,0.75)',
      }}>
        {wow > 0 ? '+' : ''}{wow.toLocaleString()}枚
      </div>
    </div>
  )
}

// ── クオンツ分析メモパネル ────────────────────────────
const QUANT_MEMO_KEY = 'poical-quant-memo'
const QUANT_MEMO_HISTORY_KEY = 'poical-quant-memo-history'
const QUANT_MEMO_MAX = 10
const QUANT_MEMO_FS_PATH = (uid: string) => `users/${uid}/data/quantMemo`

type MemoSnapshot = { date: string; text: string }

function loadHistoryLocal(): MemoSnapshot[] {
  try { return JSON.parse(localStorage.getItem(QUANT_MEMO_HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveHistoryLocal(h: MemoSnapshot[]): void {
  localStorage.setItem(QUANT_MEMO_HISTORY_KEY, JSON.stringify(h))
}
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HIGHLIGHT_PATTERNS = [
  /確信度：[\d.]+%/g,
  /判定：.+/g,
]

function renderHighlighted(text: string): React.ReactNode[] {
  return text.split('\n').map((line, lineIdx) => {
    const spans: { start: number; end: number }[] = []
    for (const pat of HIGHLIGHT_PATTERNS) {
      pat.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = pat.exec(line)) !== null) {
        spans.push({ start: m.index, end: m.index + m[0].length })
      }
    }
    if (spans.length === 0) {
      return <div key={lineIdx} style={{ minHeight: '1.8em', wordBreak: 'break-all' }}>{line || ' '}</div>
    }
    spans.sort((a, b) => a.start - b.start)
    const nodes: React.ReactNode[] = []
    let pos = 0
    for (const { start, end } of spans) {
      if (pos < start) nodes.push(line.slice(pos, start))
      nodes.push(
        <mark key={`h-${lineIdx}-${start}`} style={{
          background: 'none', color: 'rgba(0,230,255,0.95)',
        }}>
          {line.slice(start, end)}
        </mark>
      )
      pos = end
    }
    if (pos < line.length) nodes.push(line.slice(pos))
    return <div key={lineIdx} style={{ minHeight: '1.8em', wordBreak: 'break-all' }}>{nodes}</div>
  })
}

const CY_GREEN  = '#00e5ff'
const CY_DIM    = 'rgba(0,229,255,0.55)'
const CY_FAINT  = 'rgba(0,229,255,0.22)'
const CY_BORDER = 'rgba(0,229,255,0.22)'
const CY_BORDBR = 'rgba(0,229,255,0.45)'
const CY_FONT   = "'Courier New', Courier, monospace" as const
const CY_BG_SUB = 'rgba(0,5,15,0.7)'
const CY_BG_AREA = 'rgba(0,229,255,0.04)'
const CY_SCAN   = 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.022) 3px, rgba(0,229,255,0.022) 4px)'

const BTN_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.06em',
  color: CY_GREEN, background: CY_BG_AREA,
  border: `1px solid ${CY_BORDBR}`, cursor: 'pointer',
  fontFamily: CY_FONT,
}

export function QuantMemoPanel({ user, isMobile }: { theme: 'dark' | 'light'; user: User | null; isMobile?: boolean }) {
  const [quantMemo,     setQuantMemo]     = useState('')
  const [savedMemo,     setSavedMemo]     = useState('')
  const [memoSaveFlash, setMemoSaveFlash] = useState(false)
  const [isPreview,     setIsPreview]     = useState(false)
  const [history,       setHistory]       = useState<MemoSnapshot[]>([])
  const [selectedDate,  setSelectedDate]  = useState('')
  const memoIsDirty = quantMemo !== savedMemo
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isMobile) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      if (document.activeElement === textareaRef.current) {
        setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [isMobile])

  // ログイン状態・UID変化時の同期
  useEffect(() => {
    if (!user) {
      const local = localStorage.getItem(QUANT_MEMO_KEY) ?? ''
      setQuantMemo(local)
      setSavedMemo(local)
      setHistory([])
      setSelectedDate('')
      setIsPreview(!!local)
      return
    }

    // まずローカルキャッシュで即時表示
    const cachedHistory = loadHistoryLocal()
    if (cachedHistory.length > 0) {
      setHistory(cachedHistory)
      const latest = cachedHistory[0]
      setQuantMemo(latest.text)
      setSavedMemo(latest.text)
      setSelectedDate(latest.date)
      setIsPreview(true)
    } else {
      const legacy = localStorage.getItem(QUANT_MEMO_KEY) ?? ''
      if (legacy) { setQuantMemo(legacy); setSavedMemo(legacy); setIsPreview(true) }
    }

    // Firestoreから最新データを取得
    restGetDoc(QUANT_MEMO_FS_PATH(user.uid))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data()
          const snapshots = (d.snapshots as MemoSnapshot[] | undefined) ?? []
          if (snapshots.length > 0) {
            // 新フォーマット: { snapshots: [{date, text}], updatedAt }
            const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
            setHistory(sorted)
            saveHistoryLocal(sorted)
            const latest = sorted[0]
            setQuantMemo(latest.text)
            setSavedMemo(latest.text)
            setSelectedDate(latest.date)
            setIsPreview(true)
          } else if (typeof d.text === 'string' && d.text) {
            // 旧フォーマット移行: { text, updatedAt } → snapshots[]
            const today = todayStr()
            const migrated: MemoSnapshot[] = [{ date: today, text: d.text }]
            setHistory(migrated)
            saveHistoryLocal(migrated)
            setQuantMemo(d.text)
            setSavedMemo(d.text)
            setSelectedDate(today)
            setIsPreview(true)
            restSetDoc(QUANT_MEMO_FS_PATH(user.uid), { snapshots: migrated, updatedAt: new Date().toISOString() }).catch(() => {})
          }
        } else {
          // Firestoreにデータなし → ローカルをアップロード
          if (cachedHistory.length > 0) {
            restSetDoc(QUANT_MEMO_FS_PATH(user.uid), { snapshots: cachedHistory, updatedAt: new Date().toISOString() }).catch(() => {})
          } else {
            const legacy = localStorage.getItem(QUANT_MEMO_KEY) ?? ''
            if (legacy) {
              const today = todayStr()
              const migrated: MemoSnapshot[] = [{ date: today, text: legacy }]
              setHistory(migrated)
              saveHistoryLocal(migrated)
              setSelectedDate(today)
              setIsPreview(true)
              restSetDoc(QUANT_MEMO_FS_PATH(user.uid), { snapshots: migrated, updatedAt: new Date().toISOString() }).catch(() => {})
            }
          }
        }
      })
      .catch(() => { /* オフライン時はローカルキャッシュで対応済み */ })
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // スナップショット保存（ログイン時・今日の日付で保存・同日は上書き）
  const handleSnapSave = useCallback(() => {
    if (!user) return
    const today = todayStr()
    const newSnap: MemoSnapshot = { date: today, text: quantMemo }
    const filtered = history.filter(s => s.date !== today)
    const updated = [newSnap, ...filtered].slice(0, QUANT_MEMO_MAX)
    setHistory(updated)
    saveHistoryLocal(updated)
    restSetDoc(QUANT_MEMO_FS_PATH(user.uid), { snapshots: updated, updatedAt: new Date().toISOString() }).catch(() => {})
    setSavedMemo(quantMemo)
    setSelectedDate(today)
    localStorage.setItem(QUANT_MEMO_KEY, quantMemo)
    setMemoSaveFlash(true)
    setTimeout(() => setMemoSaveFlash(false), 2000)
    setIsPreview(true)
  }, [quantMemo, user, history])

  // 保存（ゲスト・1件上書き）
  const handleSave = useCallback(() => {
    localStorage.setItem(QUANT_MEMO_KEY, quantMemo)
    setSavedMemo(quantMemo)
    setMemoSaveFlash(true)
    setTimeout(() => setMemoSaveFlash(false), 2000)
    setIsPreview(true)
  }, [quantMemo])

  // 日付プルダウン選択
  const handleSelectSnapshot = useCallback((date: string) => {
    setSelectedDate(date)
    if (date === '') {
      setQuantMemo('')
      setSavedMemo('')
      setIsPreview(false)
    } else {
      const snap = history.find(s => s.date === date)
      if (snap) {
        setQuantMemo(snap.text)
        setSavedMemo(snap.text)
        setIsPreview(true)
        localStorage.setItem(QUANT_MEMO_KEY, snap.text)
      }
    }
  }, [history])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: CY_BG_SUB, backgroundImage: CY_SCAN }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px 9px', flexShrink: 0,
        borderBottom: `1px solid ${CY_BORDER}`,
        background: CY_BG_AREA,
        userSelect: 'none', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={CY_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span style={{ fontFamily: CY_FONT, fontSize: 11, fontWeight: 700, color: CY_GREEN, letterSpacing: '0.08em' }}>
            エントリー分析レポート
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {memoSaveFlash && <span style={{ fontFamily: CY_FONT, fontSize: 10, color: CY_GREEN, letterSpacing: '0.06em' }}>保存しました</span>}
          {user && (
            <select
              value={selectedDate}
              onChange={e => handleSelectSnapshot(e.target.value)}
              style={{
                fontFamily: CY_FONT, fontSize: 10, padding: '3px 6px', borderRadius: 5,
                background: '#050e1a', border: `1px solid ${CY_BORDER}`,
                color: CY_DIM, cursor: 'pointer', maxWidth: 112,
              }}
            >
              <option value=''>新規</option>
              {history.map(s => (
                <option key={s.date} value={s.date}>{s.date}</option>
              ))}
            </select>
          )}
          {isPreview ? (
            <button style={BTN_STYLE} onClick={() => setIsPreview(false)}>編集</button>
          ) : (
            <button
              style={{ ...BTN_STYLE, cursor: memoIsDirty ? 'pointer' : 'default', opacity: memoIsDirty ? 1 : 0.45 }}
              onClick={user ? handleSnapSave : handleSave}
              disabled={!memoIsDirty}
            >
              保存
            </button>
          )}
        </div>
      </div>

      {/* テキストエリア / プレビュー（外パディングで二重枠を表現） */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden', minHeight: 0, padding: '14px 16px' }}>
        {isPreview ? (
          <div
            onClick={() => setIsPreview(false)}
            style={{
              flex: 1, minHeight: isMobile ? 'max(320px, calc(100dvh - 116px))' : 280,
              padding: '12px 14px', fontSize: 13, lineHeight: 1.8,
              color: 'rgba(255,255,255,0.88)', overflowY: 'auto', cursor: 'text',
              whiteSpace: 'pre-wrap', fontFamily: CY_FONT,
              border: `1px solid ${CY_BORDER}`, borderRadius: 8,
              background: CY_BG_AREA,
            }}
          >
            {savedMemo ? renderHighlighted(savedMemo) : (
              <span style={{ color: CY_FAINT }}>▌ エントリー分析レポートを記録...</span>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={quantMemo}
            onChange={e => setQuantMemo(e.target.value)}
            placeholder="▌ エントリー分析レポートを記録..."
            style={{
              flex: 1, minHeight: isMobile ? 'max(320px, calc(100dvh - 116px))' : 280,
              resize: 'none', background: CY_BG_AREA,
              color: 'rgba(255,255,255,0.88)', border: `1px solid ${CY_BORDER}`, outline: 'none', borderRadius: 8,
              padding: '12px 14px', fontSize: 13, lineHeight: 1.8,
              fontFamily: CY_FONT, overflowY: 'auto',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────
const PARTICIPANTS_MOBILE_LIMIT = 10

// 合計列インデックス（太字・左ボーダー付き）
const TOTAL_IDX = new Set([1, 4])

export function MicroQuantView({ theme, isMobile, data, loading, error, onReload, onOpenNetDelta }: Props) {
  const tv = useMemo(() => themeVars(theme), [theme])
  const dateLabel = data.length > 0 ? `最終: ${data[0].date}` : ''
  const [expanded, setExpanded] = useState(false)

  const tanks = useMemo(() => buildCotTanks(data), [data])

  return (
    <div style={{ ...tv, flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'auto' : 'hidden' }}>
      <style>{`
        @keyframes tankShimmer {
          0%, 100% { opacity: 0.3; transform: translateX(-40%); }
          50%       { opacity: 1;   transform: translateX(40%);  }
        }
        @keyframes tankBubble {
          0%   { transform: translateY(0)    scale(1);   opacity: 0.7; }
          60%  { transform: translateY(-55px) scale(1.3); opacity: 0.3; }
          100% { transform: translateY(-80px) scale(0.6); opacity: 0;   }
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <div style={s.topBar} className="glass">
        <div style={s.titleArea}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          先物手口
          <span style={s.titleSub}>週次 · 日経225先物 · 米CFTC火曜基準</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dateLabel && <span style={s.dateLabel}>{dateLabel}</span>}
        </div>
      </div>

      {/* ── ボディ ── */}
      <div style={{
        flex: 1, overflow: isMobile ? 'visible' : 'hidden', minHeight: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={isMobile
          ? { flexShrink: 0, display: 'flex', flexDirection: 'column' }
          : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }
        }>
          <div style={{
            flex: 1, overflowY: isMobile ? 'visible' : 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column', gap: 14,
            padding: isMobile ? '12px' : '16px',
            minHeight: 0,
          }}>

            {loading && data.length === 0 ? (
              <div style={s.center}>
                <div style={s.spinner} />
                <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
              </div>
            ) : error ? (
              <div style={s.center}>
                <span style={{ color: 'var(--text-sub)', fontSize: 12, textAlign: 'center' }}>{error}</span>
                <button style={s.retryBtn} onClick={onReload}>再試行</button>
              </div>
            ) : (
              <>
                {/* ── 3連タンク（NC / Comm / NR） ── */}
                <div style={isMobile
                  ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
                  : { display: 'flex', flexDirection: 'row', gap: 8 }
                }>
                  {tanks.map(tank => {
                    const meta = GROUP_META[tank.group]
                    return (
                      <div key={tank.group} style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${meta.color}28`,
                        background: theme === 'dark' ? `${meta.color}07` : `${meta.color}04`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 1, background: `${meta.color}35` }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: 0.5 }}>
                            {meta.label}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{meta.desc}</span>
                          <div style={{ flex: 1, height: 1, background: `${meta.color}35` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <TankCard {...tank} theme={theme} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── 週次テーブル ── */}
                <div style={{ ...s.tableCard, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={s.tableHead}>
                    <span>週次ポジション</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>買越し=+ / 売越し=−（枚）</span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: isMobile ? 'visible' : 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th style={{ ...s.th, textAlign: 'left' }}>日付</th>
                          <th style={{ ...s.th, borderLeft: '2px solid var(--border-dim)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              {onOpenNetDelta && !isMobile && (
                                <button onClick={onOpenNetDelta} title="HF純計 週次Δ" style={s.deltaBtn}>Δ</button>
                              )}
                              HF純計
                            </div>
                          </th>
                          <th style={s.th}>HF買い</th>
                          <th style={s.th}>HF売り</th>
                          <th style={{ ...s.th, borderLeft: '2px solid var(--border-dim)' }}>機関純計</th>
                          <th style={s.th}>機関買い</th>
                          <th style={s.th}>機関売り</th>
                          <th style={s.th}>OI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isMobile && !expanded ? data.slice(0, PARTICIPANTS_MOBILE_LIMIT) : data).map((row, i) => {
                          const cells: (number | null)[] = [
                            row.nonCommNet, row.nonCommLong, row.nonCommShort,
                            row.commNet, row.commLong, row.commShort,
                            row.openInterest,
                          ]
                          // 行背景: HF純計の正負で統一（最新行は専用色）
                          const net = row.nonCommNet
                          const rowBg = i === 0
                            ? 'var(--latest-row-bg)'
                            : net > 0
                              ? (theme === 'dark' ? 'rgba(96,200,140,0.07)' : 'rgba(22,130,80,0.05)')
                              : net < 0
                                ? (theme === 'dark' ? 'rgba(255,120,100,0.07)' : 'rgba(200,50,30,0.05)')
                                : 'transparent'
                          return (
                            <tr key={row.date} style={{ background: rowBg, transition: 'background 0.1s' }}>
                              <td style={{ ...s.td, minWidth: 68 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{row.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{row.date}</div>
                              </td>
                              {cells.map((v, ci) => (
                                <td key={ci} style={{
                                  ...s.td, ...s.tdNum,
                                  fontWeight: TOTAL_IDX.has(ci) ? 700 : 500,
                                  borderLeft: TOTAL_IDX.has(ci) ? '2px solid var(--border-dim)' : undefined,
                                }}>
                                  <span style={{ color: ci < 6 ? cellColor(v, theme) : 'var(--text-sub)' }}>
                                    {ci < 6 ? fmt(v) : (v != null ? v.toLocaleString() : '—')}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {isMobile && data.length > PARTICIPANTS_MOBILE_LIMIT && (
                  <button style={s.expandBtn} onClick={() => setExpanded(v => !v)}>
                    {expanded ? `▲ 折りたたむ` : `▼ 全${data.length}週を表示`}
                  </button>
                )}

                <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6, padding: '0 2px 4px' }}>
                  ※ タンク水位 = |HF/機関/個人ネット枚数| ÷ 過去最大値×1.2。緑=買越し・赤=売越し。行背景はHF純計の方向を示す。データは米CFTC毎週金曜公表（火曜基準・約3〜4日遅延）。
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── スタイル ──────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', minHeight: 44, flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  titleArea: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' },
  titleSub:  { fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2 },
  dateLabel: { fontSize: 10, color: 'var(--text-dim)' },
  center:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:  { width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border-dim)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  retryBtn: { padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff', cursor: 'pointer' },
  tableCard: {
    borderRadius: 12, border: '1px solid var(--glass-border)',
    overflow: 'hidden',
  },
  tableHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px 7px', fontSize: 11, fontWeight: 700, color: 'var(--text-sub)',
    borderBottom: '1px solid var(--border-dim)',
  },
  th: {
    position: 'sticky', top: 0, zIndex: 2,
    padding: '8px 10px',
    background: 'var(--modal-bg)', backdropFilter: 'blur(16px)',
    borderBottom: '2px solid var(--border-dim)',
    whiteSpace: 'nowrap' as const,
    textAlign: 'right' as const,
    fontSize: 11, fontWeight: 700,
  },
  td:    { padding: '6px 10px', borderBottom: '1px solid var(--border-dim)', fontSize: 12 },
  tdNum: { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const },
  deltaBtn: {
    background: 'none', border: '1px solid var(--border-dim)', borderRadius: 3,
    cursor: 'pointer', color: 'var(--accent)', fontSize: 10, fontWeight: 700,
    padding: '0px 3px', lineHeight: 1.4, letterSpacing: '0.02em', flexShrink: 0,
  },
  expandBtn: {
    display: 'block', width: '100%',
    padding: '9px 14px', textAlign: 'center' as const,
    fontSize: 11, fontWeight: 600, color: 'var(--text-sub)',
    background: 'var(--glass-bg)', border: 'none',
    borderTop: '1px solid var(--border-dim)',
    cursor: 'pointer', letterSpacing: '0.03em',
  },
}
