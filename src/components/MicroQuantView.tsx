import { useMemo, useState, useCallback, useEffect } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { restGetDoc, restSetDoc } from '../utils/firestoreRest'
import {
  computeMicroVectors,
  type FuturesParticipantDayData,
  type MicroVector,
} from '../utils/futuresParticipantsData'

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

function dirIcon(dir: MicroVector['direction']): string {
  return dir === 'bear' ? '▼' : dir === 'bull' ? '▲' : '—'
}

function dirColor(dir: MicroVector['direction'], theme: 'dark' | 'light'): string {
  if (dir === 'bear') return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.9)'
  if (dir === 'bull') return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.9)'
  return 'var(--text-dim)'
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

const ALERT = {
  green:  { bg: 'rgba(96,200,140,0.13)',  text: 'rgba(96,200,140,0.95)',  label: '低' },
  yellow: { bg: 'rgba(250,190,80,0.13)',  text: 'rgba(250,190,80,0.95)',  label: '注意' },
  orange: { bg: 'rgba(255,150,60,0.15)',  text: 'rgba(255,150,60,0.95)',  label: '警戒' },
  red:    { bg: 'rgba(255,80,80,0.15)',   text: 'rgba(255,80,80,0.95)',   label: '危険' },
}

const VECTORS = [
  {
    key:   'trend'   as const,
    label: '海外大口',
    sub:   '海外勢コンセンサス',
    firms: 'ゴールドマン・サックス + JPモルガン',
    icon:  (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>
      </svg>
    ),
  },
  {
    key:   'gravity' as const,
    label: '裁定売り',
    sub:   '裁定解消圧力',
    firms: 'ソシエテ・ジェネラル + バークレイズ',
    icon:  (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
  {
    key:   'noise'   as const,
    label: '個人逆張り',
    sub:   '攪乱・逆張り要因',
    firms: 'ABNアムロ + 野村証券',
    icon:  (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
]

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

// ── クオンツ分析レポート（左カラム上段） ─────────────
const QUANT_MEMO_KEY = 'poical-quant-memo'
const QUANT_MEMO_FS_PATH = (uid: string) => `users/${uid}/data/quantMemo`

function QuantMemoPanel({ user }: { theme: 'dark' | 'light'; user: User | null }) {
  const [quantMemo,     setQuantMemo]     = useState(() => localStorage.getItem(QUANT_MEMO_KEY) ?? '')
  const [savedMemo,     setSavedMemo]     = useState(() => localStorage.getItem(QUANT_MEMO_KEY) ?? '')
  const [memoSaveFlash, setMemoSaveFlash] = useState(false)
  const memoIsDirty = quantMemo !== savedMemo

  // ログイン/ログアウト時に Firestore からロード
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
      {/* ヘッダー */}
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
      {/* テキストエリア */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <textarea
          value={quantMemo}
          onChange={e => setQuantMemo(e.target.value)}
          placeholder="AI分析レポート・トレードメモを入力…"
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            color: 'var(--text)',
            border: 'none',
            outline: 'none',
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.8,
            fontFamily: 'inherit',
            overflowY: 'auto',
          }}
        />
      </div>
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────
export function MicroQuantView({ theme, isMobile, data, loading, error, onReload, user }: Props) {
  const tv = themeVars(theme)
  const vectors = useMemo(() => computeMicroVectors(data), [data])
  const dateLabel = data.length > 0 ? `最終: ${data[0].date}` : ''

  return (
    <div style={{ ...tv, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── ヘッダー ── */}
      <div style={s.topBar} className="glass">
        <div style={s.titleArea}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          ミクロ需給解析エンジン
          <span style={s.titleSub}>証券会社別先物手口 日次</span>
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
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
      }}>

        {/* ━━ 左カラム（2/3）: 証券会社別先物手口 ━━ */}
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
                {/* ── ベクター3枚カード ── */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                  {VECTORS.map(def => {
                    const v   = vectors?.[def.key]
                    const dir = v?.direction ?? 'neutral'
                    const ac  = dirColor(dir, theme)
                    const cardBg = dir === 'bear'
                      ? (theme === 'dark' ? 'rgba(255,80,60,0.06)'  : 'rgba(200,50,30,0.04)')
                      : dir === 'bull'
                        ? (theme === 'dark' ? 'rgba(60,200,140,0.06)' : 'rgba(22,130,80,0.04)')
                        : 'transparent'

                    return (
                      <div key={def.key} style={{ ...s.vCard, background: cardBg, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: 'var(--accent)', display: 'flex' }}>{def.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{def.label}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-sub)' }}>{def.firms}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>{def.sub}</div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: ac, lineHeight: 1 }}>{dirIcon(dir)}</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: ac, fontVariantNumeric: 'tabular-nums' }}>
                            {v ? v.netLots.toLocaleString() : '—'}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>枚</span>
                        </div>

                        {v?.dayOverDay != null && (
                          <div style={{ fontSize: 10, marginTop: 3, color: v.dayOverDay < 0 ? 'rgba(255,120,100,0.8)' : 'rgba(96,200,140,0.8)' }}>
                            前日比 {v.dayOverDay > 0 ? '+' : ''}{v.dayOverDay.toLocaleString()}枚
                          </div>
                        )}

                        <div style={{ marginTop: 10, height: 3, background: 'var(--border-dim)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2, background: ac,
                            width: `${Math.min(Math.abs(v?.netLots ?? 0) / 80, 100)}%`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* ── 需給圧力スコア ── */}
                {vectors && (
                  <div style={s.scoreCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>需給圧力スコア</span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 8 }}>
                          直近{vectors.historyDays}日比較
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                          background: ALERT[vectors.alertLevel].bg,
                          color:      ALERT[vectors.alertLevel].text,
                        }}>
                          {ALERT[vectors.alertLevel].label}
                        </span>
                        <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: ALERT[vectors.alertLevel].text, lineHeight: 1 }}>
                          {vectors.sellPressureScore}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>/ 100</span>
                      </div>
                    </div>

                    {/* パーセンタイルバッジ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 8,
                        background: ALERT[vectors.alertLevel].bg, color: ALERT[vectors.alertLevel].text,
                      }}>
                        上位 {100 - vectors.scorePercentile}%
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        中央値 {vectors.scoreMedian}
                      </span>
                    </div>

                    {/* スコアバー（中央値マーカー付き） */}
                    <div style={{ height: 8, borderRadius: 4, position: 'relative', background: 'var(--border-dim)', overflow: 'visible' }}>
                      <div style={{ position: 'absolute', inset: 0, borderRadius: 4, overflow: 'hidden', background: 'linear-gradient(90deg, rgba(96,200,140,0.55) 0%, rgba(250,190,80,0.55) 50%, rgba(255,150,60,0.55) 75%, rgba(255,80,80,0.55) 100%)' }} />
                      {/* 今日の位置 */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${vectors.sellPressureScore}%`,
                        borderRight: `3px solid ${ALERT[vectors.alertLevel].text}`,
                        transition: 'width 0.6s ease',
                      }} />
                      {/* 中央値マーカー */}
                      <div style={{
                        position: 'absolute', top: -3, left: `${vectors.scoreMedian}%`,
                        width: 2, height: 14, background: 'var(--text-dim)', borderRadius: 1,
                        transform: 'translateX(-50%)',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9, color: 'var(--text-dim)' }}>
                      <span>低</span>
                      <span>中央値 ▲{vectors.scoreMedian}</span>
                      <span>100</span>
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                      <span>海外大口 <strong style={{ color: dirColor(vectors.trend.direction, theme) }}>{vectors.trend.netLots.toLocaleString()}</strong>枚</span>
                      <span>裁定売り <strong style={{ color: dirColor(vectors.gravity.direction, theme) }}>{vectors.gravity.netLots.toLocaleString()}</strong>枚</span>
                      <span>個人逆張り <strong style={{ color: dirColor(vectors.noise.direction, theme) }}>{vectors.noise.netLots.toLocaleString()}</strong>枚 (緩衝)</span>
                    </div>
                  </div>
                )}

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
                          const trendT   = (row.GS   ?? 0) + (row.JPM   ?? 0)
                          const noiseT   = (row.AMRO  ?? 0) + (row.Nomura ?? 0)
                          const gravityT = (row.SG    ?? 0) + (row.Barclays ?? 0) + (row.BNP ?? 0)
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
                  ※ データは日次。ネット枚数 = 買建 − 売建。裁定売り は裁定買い残の解消（物理的売り圧力）の進捗を示す。スコアは 海外大口・裁定売り の売り越し強度から算出し 個人逆張り で補正。
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

  vCard: {
    padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  },
  scoreCard: {
    padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  },
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
