import { useState, useCallback, useEffect } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { restGetDoc, restSetDoc } from '../utils/firestoreRest'
import type { FuturesParticipantDayData } from '../utils/futuresParticipantsData'

type Props = {
  theme:    'dark' | 'light'
  isMobile: boolean
  data:     FuturesParticipantDayData[]
  loading:  boolean
  error:    string
  onReload: () => void
  user:     User | null
}

// ── ヘルパー ──────────────────────────────────────
function fmt(v: number | null): string {
  if (v === null) return '—'
  if (v === 0)   return '0'
  return (v > 0 ? '+' : '') + v.toLocaleString()
}

function cellBg(v: number | null, theme: 'dark' | 'light'): string {
  if (!v) return 'transparent'
  if (v > 0) return theme === 'dark' ? 'rgba(96,200,140,0.10)' : 'rgba(22,130,80,0.07)'
  return theme === 'dark' ? 'rgba(255,120,100,0.10)' : 'rgba(200,50,30,0.07)'
}

function cellColor(v: number | null, theme: 'dark' | 'light'): string {
  if (!v) return 'var(--text-dim)'
  if (v > 0) return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.9)'
  return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.9)'
}

// ── タンク定義 ──────────────────────────────────────
type TankGroup = 'trend' | 'gravity' | 'noise'

type TankFirm = {
  firmDisplay:    string    // 表示名（\n で改行可）
  group:          TankGroup
  cumulativeLots: number    // 限月累積ネット建玉（枚）
  delta:          number    // 前日比
  maxCapacity:    number    // 過去1年最大 × 1.2
}

const GROUP_META: Record<TankGroup, { label: string; color: string; desc: string }> = {
  trend:   { label: 'Trend',   color: '#60a5fa', desc: '海外大口' },
  gravity: { label: 'Gravity', color: '#fb923c', desc: '裁定解消' },
  noise:   { label: 'Noise',   color: '#a78bfa', desc: '個人逆張り' },
}

// ダミーデータ（実データ取得実装まで）
const TANK_DUMMIES: TankFirm[] = [
  { firmDisplay: 'ゴールドマン\n・サックス', group: 'trend',   cumulativeLots: -5000, delta:  -700, maxCapacity: 12000 },
  { firmDisplay: 'JP\nモルガン',            group: 'trend',   cumulativeLots: -2800, delta:  -350, maxCapacity:  8000 },
  { firmDisplay: 'ソシエテ\n・ジェネラル',  group: 'gravity', cumulativeLots: -3700, delta:  -500, maxCapacity: 10000 },
  { firmDisplay: 'バークレイズ',            group: 'gravity', cumulativeLots: -1800, delta:  -200, maxCapacity:  6000 },
  { firmDisplay: 'ABN\nアムロ',             group: 'noise',   cumulativeLots:  1400, delta:   290, maxCapacity:  5000 },
  { firmDisplay: '野村証券',               group: 'noise',   cumulativeLots:   900, delta:   150, maxCapacity:  4000 },
]

const BUBBLES = [
  { size: 5, left: '22%', delay: '0s',    dur: '2.8s' },
  { size: 4, left: '58%', delay: '1.1s',  dur: '3.2s' },
  { size: 3, left: '40%', delay: '2.0s',  dur: '2.4s' },
]

// ── タンクカード ──────────────────────────────────────
function TankCard({ firmDisplay, group, cumulativeLots, delta, maxCapacity, theme }: TankFirm & { theme: 'dark' | 'light' }) {
  const isLight    = theme === 'light'
  const waterLevel = Math.min(Math.abs(cumulativeLots) / maxCapacity * 100, 105)
  const isShort    = cumulativeLots <= 0
  const groupColor = GROUP_META[group].color
  const isOverflow = waterLevel >= 100

  const liquidTop    = isShort ? 'rgba(239,68,68,0.22)' : 'rgba(52,211,153,0.22)'
  const liquidBottom = isShort ? 'rgba(239,68,68,0.52)' : 'rgba(52,211,153,0.52)'
  const liquidBorder = isShort ? 'rgba(239,68,68,0.80)' : 'rgba(52,211,153,0.80)'

  const numColor = isShort
    ? (isLight ? 'rgba(200,50,30,0.9)' : 'rgba(255,120,100,0.95)')
    : (isLight ? 'rgba(22,130,80,0.9)' : 'rgba(96,200,140,0.95)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>

      {/* 社名 */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: groupColor,
        textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.35,
        minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {firmDisplay}
      </div>

      {/* タンク本体 */}
      <div style={{
        width: '100%', maxWidth: 72, height: 120,
        position: 'relative',
        borderRadius: '10px 10px 26px 26px',
        border: `1.5px solid ${groupColor}50`,
        background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
        boxShadow: `0 4px 12px rgba(0,0,0,0.18), inset 0 0 0 1px ${groupColor}18`,
      }}>
        {/* 液体（グラデーション） */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${Math.min(waterLevel, 100)}%`,
          background: `linear-gradient(180deg, ${liquidTop} 0%, ${liquidBottom} 100%)`,
          borderTop: `2px solid ${liquidBorder}`,
          transition: 'height 0.9s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* 水面シマー */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 4,
            background: `linear-gradient(90deg, transparent 0%, ${liquidBorder} 50%, transparent 100%)`,
            animation: 'tankShimmer 3s ease-in-out infinite',
          }} />
          {/* 気泡 */}
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

        {/* ガラスハイライト */}
        <div style={{
          position: 'absolute', top: '6%', left: '9%',
          width: '16%', height: '32%',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.11)',
          pointerEvents: 'none',
        }} />

        {/* オーバーフロー警告 */}
        {isOverflow && (
          <div style={{
            position: 'absolute', top: 3, left: 0, right: 0,
            textAlign: 'center', fontSize: 8, fontWeight: 900,
            color: liquidBorder, letterSpacing: 1,
          }}>MAX!</div>
        )}

        {/* % ラベル */}
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

        {/* 目盛り（両側） */}
        {[25, 50, 75].map(pct => (
          <div key={pct}>
            <div style={{ position: 'absolute', right: 0, bottom: `${pct}%`, width: 5, height: 1, background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
            <div style={{ position: 'absolute', left: 0,  bottom: `${pct}%`, width: 5, height: 1, background: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)' }} />
          </div>
        ))}
      </div>

      {/* 累積枚数 */}
      <div style={{ fontSize: 13, fontWeight: 800, color: numColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {cumulativeLots > 0 ? '+' : ''}{cumulativeLots.toLocaleString()}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: -2 }}>枚</div>

      {/* 前日比 */}
      <div style={{
        fontSize: 10, fontVariantNumeric: 'tabular-nums',
        color: delta < 0 ? 'rgba(255,120,100,0.75)' : 'rgba(96,200,140,0.75)',
      }}>
        {delta > 0 ? '+' : ''}{delta.toLocaleString()}枚
      </div>
    </div>
  )
}

// ── テーブル列定義 ────────────────────────────────────
const TABLE_COLS: { label: string; sub?: string; isTotal?: boolean }[] = [
  { label: '日付' },
  { label: 'ゴールドマン・サックス' },
  { label: 'JPモルガン' },
  { label: '海外大口', sub: '合計', isTotal: true },
  { label: 'ABNアムロ' },
  { label: '野村証券' },
  { label: '個人逆張り', sub: '合計', isTotal: true },
  { label: 'ソシエテ・ジェネラル' },
  { label: 'バークレイズ' },
  { label: '裁定売り', sub: '合計', isTotal: true },
]

// ── クオンツ分析メモパネル ────────────────────────────
const QUANT_MEMO_KEY = 'poical-quant-memo'
const QUANT_MEMO_FS_PATH = (uid: string) => `users/${uid}/data/quantMemo`

function QuantMemoPanel({ user }: { theme: 'dark' | 'light'; user: User | null }) {
  const [quantMemo,     setQuantMemo]     = useState(() => localStorage.getItem(QUANT_MEMO_KEY) ?? '')
  const [savedMemo,     setSavedMemo]     = useState(() => localStorage.getItem(QUANT_MEMO_KEY) ?? '')
  const [memoSaveFlash, setMemoSaveFlash] = useState(false)
  const memoIsDirty = quantMemo !== savedMemo

  useEffect(() => {
    if (!user) {
      const local = localStorage.getItem(QUANT_MEMO_KEY) ?? ''
      setQuantMemo(local)
      setSavedMemo(local)
      return
    }
    restGetDoc(QUANT_MEMO_FS_PATH(user.uid))
      .then(snap => {
        if (snap.exists()) {
          const text = (snap.data().text as string) ?? ''
          setQuantMemo(text)
          setSavedMemo(text)
          localStorage.setItem(QUANT_MEMO_KEY, text)
        } else {
          const local = localStorage.getItem(QUANT_MEMO_KEY) ?? ''
          setQuantMemo(local)
          setSavedMemo(local)
          if (local) {
            restSetDoc(QUANT_MEMO_FS_PATH(user.uid), { text: local, updatedAt: new Date().toISOString() }).catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    localStorage.setItem(QUANT_MEMO_KEY, quantMemo)
    setSavedMemo(quantMemo)
    setMemoSaveFlash(true)
    setTimeout(() => setMemoSaveFlash(false), 2000)
    if (user) {
      restSetDoc(QUANT_MEMO_FS_PATH(user.uid), { text: quantMemo, updatedAt: new Date().toISOString() }).catch(() => {})
    }
  }, [quantMemo, user])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          クオンツ分析レポート
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {memoSaveFlash && <span style={{ fontSize: 11, color: '#34d399' }}>保存しました</span>}
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              color: 'var(--text-sub)', background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)', cursor: memoIsDirty ? 'pointer' : 'default',
              opacity: memoIsDirty ? 1 : 0.45,
            }}
            onClick={handleSave}
            disabled={!memoIsDirty}
          >
            保存
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <textarea
          value={quantMemo}
          onChange={e => setQuantMemo(e.target.value)}
          placeholder="AI分析レポート・トレードメモを入力…"
          style={{
            flex: 1, resize: 'none', background: 'transparent',
            color: 'var(--text)', border: 'none', outline: 'none',
            padding: '12px 14px', fontSize: 13, lineHeight: 1.8,
            fontFamily: 'inherit', overflowY: 'auto',
          }}
        />
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────
export function MicroQuantView({ theme, isMobile, data, loading, error, onReload, user }: Props) {
  const tv = themeVars(theme)
  const dateLabel = data.length > 0 ? `最終: ${data[0].date}` : ''

  return (
    <div style={{ ...tv, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          証券会社別先物手口
          <span style={s.titleSub}>日次</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dateLabel && <span style={s.dateLabel}>{dateLabel}</span>}
          <button style={s.reloadBtn} onClick={onReload} disabled={loading}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={loading ? { animation: 'spin 0.8s linear infinite' } : {}}>
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.65"/>
            </svg>
            更新
          </button>
        </div>
      </div>

      {/* ── ボディ ── */}
      <div style={{
        flex: 1, overflow: isMobile ? 'auto' : 'hidden', minHeight: 0,
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
      }}>

        {/* ━━ 左カラム（2/3）━━ */}
        <div style={{
          ...(isMobile
            ? { flexShrink: 0, display: 'flex', flexDirection: 'column' }
            : { flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }),
          borderRight: isMobile ? 'none' : '1px solid var(--border-dim)',
          borderBottom: isMobile ? '1px solid var(--border-dim)' : 'none',
        }}>
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
                {/* ── 6連タンク ── */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 8,
                }}>
                  {(['trend', 'gravity', 'noise'] as const).map(group => {
                    const firms = TANK_DUMMIES.filter(t => t.group === group)
                    const meta  = GROUP_META[group]
                    return (
                      <div key={group} style={{
                        flex: 1,
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${meta.color}28`,
                        background: theme === 'dark' ? `${meta.color}07` : `${meta.color}04`,
                      }}>
                        {/* グループヘッダー */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 1, background: `${meta.color}35` }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: 0.5 }}>
                            {meta.label}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{meta.desc}</span>
                          <div style={{ flex: 1, height: 1, background: `${meta.color}35` }} />
                        </div>
                        {/* タンク2本 */}
                        <div style={{ display: 'flex', gap: 10 }}>
                          {firms.map(f => <TankCard key={f.firmDisplay} {...f} theme={theme} />)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── 日次手口テーブル ── */}
                <div style={{ ...s.tableCard, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={s.tableHead}>
                    <span>日次手口テーブル</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>ネット枚数（買越し=+）</span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                      <thead>
                        <tr>
                          {TABLE_COLS.map((col, i) => (
                            <th key={i} style={{
                              ...s.th,
                              textAlign: i === 0 ? 'left' : 'right',
                              borderLeft: col.isTotal ? '2px solid var(--border-dim)' : undefined,
                              background: col.isTotal ? (theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'var(--modal-bg)',
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 700 }}>{col.label}</div>
                              {col.sub && <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-dim)', marginTop: 1 }}>{col.sub}</div>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, i) => {
                          const trendT   = (row.GS      ?? 0) + (row.JPM      ?? 0)
                          const noiseT   = (row.AMRO    ?? 0) + (row.Nomura   ?? 0)
                          const gravityT = (row.SG      ?? 0) + (row.Barclays ?? 0) + (row.BNP ?? 0)
                          const cells: (number | null)[] = [
                            row.GS, row.JPM, trendT,
                            row.AMRO, row.Nomura, noiseT,
                            row.SG, row.Barclays, gravityT,
                          ]
                          const isTotalIdx = new Set([2, 5, 8])
                          return (
                            <tr key={row.date} style={{ background: i === 0 ? 'var(--latest-row-bg)' : 'transparent', transition: 'background 0.1s' }}>
                              <td style={{ ...s.td, minWidth: 68 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{row.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{row.date}</div>
                              </td>
                              {cells.map((v, ci) => (
                                <td key={ci} style={{
                                  ...s.td, ...s.tdNum,
                                  background: cellBg(v, theme),
                                  fontWeight: isTotalIdx.has(ci) ? 700 : 500,
                                  borderLeft: isTotalIdx.has(ci) ? '2px solid var(--border-dim)' : undefined,
                                }}>
                                  <span style={{ color: cellColor(v, theme) }}>{fmt(v)}</span>
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 注記 */}
                <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6, padding: '0 2px 4px' }}>
                  ※ タンク水位 = |累積ネット建玉| ÷ 過去1年最大値×1.2。SQ日に限月リセット。赤=売り越し・緑=買い越し。
                </div>
              </>
            )}
          </div>
        </div>

        {/* ━━ 右カラム（1/3）: クオンツ分析レポート ━━ */}
        <div style={
          isMobile
            ? { flexShrink: 0, display: 'flex', flexDirection: 'column', height: 360, borderTop: '1px solid var(--border-dim)' }
            : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }
        }>
          <QuantMemoPanel theme={theme} user={user} />
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
  reloadBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
    color: 'var(--text-sub)', background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)', cursor: 'pointer',
  },
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
    whiteSpace: 'nowrap',
  },
  td:    { padding: '6px 10px', borderBottom: '1px solid var(--border-dim)', fontSize: 12 },
  tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
}
