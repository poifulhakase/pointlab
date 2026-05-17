import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
}

// ── CYBER_MODE 定数 ─────────────────────────────────
const CYBER_MODE = true
const CY_BG     = '#050e1a'
const CY_GREEN  = '#00e5ff'
const CY_DIM    = 'rgba(0,229,255,0.55)'
const CY_FAINT  = 'rgba(0,229,255,0.22)'
const CY_BORDER = 'rgba(0,229,255,0.22)'
const CY_BORDBR = 'rgba(0,229,255,0.45)'
const CY_SCAN   = 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.022) 3px, rgba(0,229,255,0.022) 4px)'
const CY_FONT   = "'Courier New', Courier, monospace" as const

const SHIELD_STATUS_LINES = [
  'POI-ROBO SHIELD v1.0  ▶ ONLINE',
  '日経225チャート構造 ........ 解析中',
  '前回高値・安値 ............. 算出完了',
  'MA200 / MA60 / MA20 ....... 計算完了',
  'ポジション管理モード ....... 待機中',
  'イグジット判断支援 ......... スタンバイ',
  'リスク管理センサー ......... 作動中',
  'サポート・レジスタンス ..... 算出中',
  'シールドプロンプト生成 ..... 待機中',
  'ポジションデータ受信待ち ... アイドル',
  'イグジットゾーン検知 ....... 監視中',
  'チャート構造スキャン ....... 実行中',
]

// ── シールドメモパネル（1件のみ保存） ───────────────
const SHIELD_MEMO_KEY = 'poical-shield-memo'

function ShieldMemoPanel(_: { user: User | null }) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(SHIELD_MEMO_KEY) ?? '' } catch { return '' }
  })
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSave = () => {
    try { localStorage.setItem(SHIELD_MEMO_KEY, text) } catch {}
    setSaved(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={CYBER_MODE
      ? { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,5,15,0.7)' }
      : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    }>
      {/* ヘッダー */}
      <div style={{ position: 'relative', zIndex: 1, ...(CYBER_MODE ? {
        padding: '10px 14px 9px', flexShrink: 0,
        borderBottom: `1px solid ${CY_BORDER}`,
        background: 'rgba(0,229,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      } : { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)' }) }}>
        <div style={CYBER_MODE
          ? { display: 'flex', alignItems: 'center', gap: 8, flex: 1 }
          : { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }
        }>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={CYBER_MODE ? CY_GREEN : 'currentColor'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span style={CYBER_MODE
            ? { fontFamily: CY_FONT, fontSize: 11, fontWeight: 700, color: CY_GREEN, letterSpacing: '0.08em' }
            : {}
          }>ポジション分析レポート</span>
        </div>
        {/* 保存ボタン（右上） */}
        <button
          onClick={handleSave}
          style={CYBER_MODE ? {
            padding: '4px 14px', borderRadius: 6,
            fontFamily: CY_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            background: saved ? 'rgba(0,229,255,0.18)' : 'rgba(0,229,255,0.08)',
            border: `1px solid ${saved ? CY_GREEN : CY_BORDBR}`,
            color: CY_GREEN, cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
            boxShadow: saved ? `0 0 10px rgba(0,229,255,0.3)` : 'none',
            flexShrink: 0,
          } : {
            padding: '4px 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            background: 'var(--accent-glass)', border: '1px solid var(--accent)',
            color: '#fff', cursor: 'pointer', flexShrink: 0,
          }}
        >
          {saved ? '保存しました' : '保存'}
        </button>
      </div>

      {/* テキストエリア */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 16px' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={CYBER_MODE ? '▌ ポジション分析レポートを記録...' : 'ポジション分析レポートを記録...'}
          style={{
            flex: 1, width: '100%', resize: 'none', borderRadius: 8,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.7,
            fontFamily: CYBER_MODE ? CY_FONT : 'inherit',
            ...(CYBER_MODE ? {
              background: 'rgba(0,229,255,0.04)',
              border: `1px solid ${CY_BORDER}`,
              color: 'rgba(255,255,255,0.88)', outline: 'none',
            } : {
              background: 'var(--bg-subtle)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text)', outline: 'none',
            }),
          }}
        />
      </div>
    </div>
  )
}

// ── シールドパネル（左ペイン）──────────────────────
function ShieldPanel({ isMobile }: { isMobile: boolean }) {
  const logIdxRef = useRef(4)
  const [logLines, setLogLines] = useState<string[]>(() => SHIELD_STATUS_LINES.slice(0, 4))
  const [cursorVisible, setCursorVisible] = useState(true)
  const [typedText, setTypedText] = useState('')
  const typeStateRef = useRef({ line: '', idx: 0 })

  useEffect(() => {
    if (!CYBER_MODE) return
    const id = setInterval(() => {
      setLogLines(prev => {
        const next = [...prev.slice(1), SHIELD_STATUS_LINES[logIdxRef.current % SHIELD_STATUS_LINES.length]]
        logIdxRef.current++
        return next
      })
    }, 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!CYBER_MODE) return
    const id = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  const lastLine = logLines[logLines.length - 1]
  useEffect(() => {
    if (!CYBER_MODE) return
    typeStateRef.current = { line: lastLine, idx: 0 }
    setTypedText('')
    const id = setInterval(() => {
      const st = typeStateRef.current
      if (st.idx >= st.line.length) { clearInterval(id); return }
      st.idx++
      setTypedText(st.line.slice(0, st.idx))
    }, 38)
    return () => clearInterval(id)
  }, [lastLine])

  return (
    <div style={isMobile
      ? { flexShrink: 0, display: 'flex', flexDirection: 'column',
          ...(CYBER_MODE ? { background: CY_BG, backgroundImage: CY_SCAN } : {}) }
      : { width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          ...(CYBER_MODE
            ? { borderRight: `1px solid ${CY_BORDBR}` }
            : { borderRight: '1px solid var(--border-dim)' }) }
    }>

      {CYBER_MODE && <style>{`
        @keyframes shield-dust {
          0%   { transform: translateY(0); opacity: 0; }
          20%  { opacity: 0.35; }
          100% { transform: translateY(-160px); opacity: 0; }
        }
        .shield-dust {
          position: absolute; width: 2px; height: 2px;
          background: #00e5ff; border-radius: 50%; opacity: 0;
          animation: shield-dust 10s linear infinite; pointer-events: none;
        }
        @keyframes shield-scanline {
          0%   { top: -20px; }
          100% { top: 110%; }
        }
        .shield-scanline {
          position: absolute; left: 0; width: 100%; height: 15px;
          background: linear-gradient(to bottom, transparent, rgba(0,229,255,0.04), transparent);
          pointer-events: none;
          animation: shield-scanline 8s linear infinite;
        }
      `}</style>}

      {/* パーティクル＋スキャンライン領域 */}
      <div style={{
        ...(!isMobile ? { flex: 1 } : {}),
        position: 'relative', display: 'flex', flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
        ...(!isMobile && CYBER_MODE ? { background: CY_BG, backgroundImage: CY_SCAN } : {}),
      }}>
        {CYBER_MODE && !isMobile && <>
          <div className="shield-dust" style={{ top: '70%', left: '20%', animationDelay: '0s' }} />
          <div className="shield-dust" style={{ top: '40%', left: '80%', animationDelay: '2s' }} />
          <div className="shield-dust" style={{ top: '80%', left: '65%', animationDelay: '1s' }} />
          <div className="shield-dust" style={{ top: '20%', left: '30%', animationDelay: '3s' }} />
          <div className="shield-dust" style={{ top: '60%', left: '50%', animationDelay: '4.5s' }} />
          <div className="shield-dust" style={{ top: '35%', left: '10%', animationDelay: '6s' }} />
          <div className="shield-dust" style={{ top: '85%', left: '45%', animationDelay: '1.5s' }} />
          <div className="shield-dust" style={{ top: '15%', left: '70%', animationDelay: '5s' }} />
          <div className="shield-scanline" />
        </>}

        {/* ── ヘッダー ── */}
        <div style={{ position: 'relative', zIndex: 1, ...(CYBER_MODE ? {
          padding: '10px 14px 9px', flexShrink: 0,
          borderBottom: `1px solid ${CY_BORDER}`,
          background: 'rgba(0,229,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 8,
        } : sh.panelHead) }}>
          <div style={CYBER_MODE ? { display: 'flex', alignItems: 'center', gap: 8, flex: 1 } : sh.panelTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={CYBER_MODE ? CY_GREEN : 'currentColor'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={CYBER_MODE
              ? { fontFamily: CY_FONT, fontSize: 12, fontWeight: 700, color: CY_GREEN, letterSpacing: '0.08em' }
              : {}
            }>ぽいロボ シールド</span>
          </div>
          {CYBER_MODE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: CY_GREEN, boxShadow: `0 0 6px ${CY_GREEN}` }} />
              <span style={{ fontFamily: CY_FONT, fontSize: 9, color: CY_DIM, letterSpacing: '0.12em' }}>ONLINE</span>
            </div>
          )}
        </div>

        {/* ── スクロール可能コンテンツ ── */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 42 }}>

          {/* 説明 */}
          <div style={sh.section}>
            <div style={CYBER_MODE ? {
              borderLeft: `3px solid ${CY_GREEN}`,
              background: 'rgba(0,229,255,0.05)',
              borderRadius: '0 8px 8px 0',
              padding: '10px 14px',
              fontSize: 13, lineHeight: 1.75,
              color: 'rgba(0,229,255,0.75)',
              fontFamily: CY_FONT, letterSpacing: '0.04em',
            } : {
              borderLeft: '3px solid var(--accent)',
              background: 'var(--bg-subtle)',
              borderRadius: '0 8px 8px 0',
              padding: '10px 14px',
              fontSize: 13, lineHeight: 1.7,
              color: 'var(--text)', fontWeight: 500,
            }}>
              日経平均ブル/ベア専用のポジション分析機能。<br />価格構造を解析し、AIでの運用が可能。
            </div>

            {/* コピーボタン（未実装・押しても何もしない） */}
            {CYBER_MODE ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <button
                    style={{
                      width: 84, height: 84, borderRadius: '50%',
                      background: 'rgba(0,229,255,0.07)',
                      border: `2px solid ${CY_BORDBR}`,
                      boxShadow: `0 0 16px rgba(0,229,255,0.22), inset 0 0 10px rgba(0,229,255,0.06)`,
                      color: CY_GREEN,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 7, cursor: 'pointer',
                      transition: 'background 0.2s, box-shadow 0.2s, border-color 0.2s',
                    }}
                    onClick={() => {}}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span style={{ fontFamily: CY_FONT, fontSize: 9, letterSpacing: '0.07em', lineHeight: 1 }}>COPY</span>
                  </button>
                  {/* 吹き出し（右横フロート） */}
                  <div style={{ position: 'absolute', top: '50%', left: 88, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none', width: 'max-content' }}>
                    <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `8px solid ${CY_BORDBR}`, flexShrink: 0 }} />
                    <div style={{ background: 'rgba(0,229,255,0.06)', border: `1px solid ${CY_BORDBR}`, borderRadius: 8, padding: '6px 10px', fontFamily: 'system-ui, sans-serif', fontSize: 10, color: CY_DIM, letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap' }}>
                      分析用プロンプト<br />＋チャートデータ
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                style={{ ...sh.actionBtn, ...sh.actionBtnAccent, height: 58, flexShrink: 0 }}
                onClick={() => {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                ポジション分析用プロンプト<br />＋チャートデータをコピー
              </button>
            )}

          </div>

          {/* AIチャットリンク */}
          <div style={sh.section}>
            <div style={CYBER_MODE
              ? { ...sh.sectionTitle, color: CY_DIM, fontFamily: CY_FONT, fontSize: 13, letterSpacing: '0.08em' }
              : sh.sectionTitle
            }>{CYBER_MODE ? '▌ AI起動' : 'AI起動'}</div>

            {CYBER_MODE ? (
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
                {AI_LINKS.map(ai => (
                  <div key={ai.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <a
                      href={ai.url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(ai.url, '_blank', 'noopener,noreferrer') }}
                      style={{
                        width: 70, height: 70, borderRadius: '50%',
                        background: 'rgba(0,229,255,0.06)',
                        border: `2px solid ${CY_BORDER}`,
                        boxShadow: `0 0 16px rgba(0,229,255,0.22), inset 0 0 10px rgba(0,229,255,0.06)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', textDecoration: 'none',
                        transition: 'box-shadow 0.2s, background 0.2s',
                      }}
                    >
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: ai.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {ai.icon}
                      </div>
                    </a>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontFamily: CY_FONT, fontSize: 12, color: CY_GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>{ai.name}</span>
                      <span style={{ fontFamily: CY_FONT, fontSize: 10, color: CY_FAINT, letterSpacing: '0.02em' }}>{ai.hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {AI_LINKS.map(ai => (
                  <a key={ai.name} href={ai.url} target="_blank" rel="noopener noreferrer"
                    style={{ ...sh.aiCard, flex: 'none', width: '100%' }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(ai.url, '_blank', 'noopener,noreferrer') }}
                  >
                    <div style={{ ...sh.aiLogo, background: ai.bg, padding: 0, overflow: 'hidden' }}>
                      {ai.icon}
                    </div>
                    <div style={sh.aiInfo}>
                      <div style={sh.aiName}>{ai.name}</div>
                      <div style={sh.aiDesc}>{ai.hint}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                ))}
              </div>
            )}

            {/* 画像貼り付け案内 */}
            {CYBER_MODE ? (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'rgba(0,229,255,0.04)',
                border: `1px dashed ${CY_BORDER}`,
                borderRadius: 8, padding: '10px 14px',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CY_DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_DIM, letterSpacing: '0.04em', lineHeight: 1.7 }}>
                  AI起動後、ポジション状況のキャプチャも添付すること
                </span>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border-dim)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-sub)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7 }}>
                  AI起動後、ポジション状況のキャプチャも添付すること
                </span>
              </div>
            )}
          </div>

        </div>
      </div>{/* /パーティクルラッパー */}

      {/* SYSTEM LOG */}
      {CYBER_MODE && (
        <div style={{
          borderTop: `1px solid ${CY_BORDER}`,
          background: 'rgba(0,0,0,0.45)',
          padding: '14px 20px 16px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: CY_GREEN, boxShadow: `0 0 6px ${CY_GREEN}` }} />
            <span style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_DIM, letterSpacing: '0.12em' }}>SYSTEM LOG ▶ LIVE</span>
          </div>
          {logLines.map((line, i) => (
            <div key={i} style={{
              fontFamily: CY_FONT, fontSize: 13,
              color: i === logLines.length - 1 ? CY_GREEN : CY_FAINT,
              letterSpacing: '0.04em', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.8,
            }}>
              {i === logLines.length - 1 ? '> ' : '  '}{i === logLines.length - 1 ? typedText : line}
              {i === logLines.length - 1 && <span style={{ opacity: cursorVisible ? 1 : 0 }}>█</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── メインコンポーネント ─────────────────────────────
export function ShieldView({ theme, isMobile, user }: Props) {
  const tv = themeVars(theme)

  return (
    <div style={{ ...s.wrap, ...tv }}>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflowY: isMobile ? 'auto' : 'hidden',
        paddingBottom: isMobile ? 130 : 0,
      }}>
        <ShieldPanel isMobile={isMobile} />
        <div style={isMobile ? s.dividerH : s.divider} />
        <div style={isMobile ? { flexShrink: 0, display: 'flex', flexDirection: 'column' } : s.panel}>
          <ShieldMemoPanel user={user} />
        </div>
      </div>
    </div>
  )
}

// ── AI リンク定義 ────────────────────────────────────
const AI_LINKS = [
  {
    name: 'Gemini', url: 'https://gemini.google.com/?hl=ja', hint: '思考モード推奨',
    bg: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc04,#ea4335)',
    icon: (
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <path d="M14 2 C14 2 15.6 9.4 20 14 C15.6 18.6 14 26 14 26 C14 26 12.4 18.6 8 14 C12.4 9.4 14 2 14 2Z" fill="white"/>
        <path d="M2 14 C2 14 9.4 12.4 14 8 C18.6 12.4 26 14 26 14 C26 14 18.6 15.6 14 20 C9.4 15.6 2 14 2 14Z" fill="white" opacity="0.85"/>
      </svg>
    ),
  },
  {
    name: 'Claude', url: 'https://claude.ai/projects', hint: 'Projectsで管理',
    bg: '#d97757',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.2 14.7 8 16 L7 21 L12 18.5 L17 21 L16 16 C17.8 14.7 19 12.5 19 10 C19 6 16 3 12 3Z" fill="white" opacity="0.95"/>
      </svg>
    ),
  },
  {
    name: 'ChatGPT', url: 'https://chatgpt.com/', hint: 'o3推奨',
    bg: '#10a37f',
    icon: (
      <svg width="24" height="24" viewBox="0 0 41 41" fill="none">
        <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.996l-4.331 2.5-4.331-2.5V18z" fill="white"/>
      </svg>
    ),
  },
]

// ── スタイル ─────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrap:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  panel:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  divider:  { width: 1, background: 'var(--border-dim)', flexShrink: 0 },
  dividerH: { height: 1, background: 'var(--border-dim)', flexShrink: 0 },
}

const sh: Record<string, React.CSSProperties> = {
  section:         { display: 'flex', flexDirection: 'column', gap: 18 },
  sectionTitle:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-dim)' },
  actionBtn:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--bg-medium)', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.15s' },
  actionBtnAccent: { background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff' },
  panelHead:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', flexShrink: 0, gap: 8, borderBottom: '1px solid var(--border-dim)', userSelect: 'none' },
  panelTitle:      { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 },
  aiCard:          { flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)', textDecoration: 'none', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' },
  aiLogo:          { width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  aiInfo:          { flex: 1, minWidth: 0 },
  aiName:          { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  aiDesc:          { fontSize: 11, color: 'var(--text-sub)', marginTop: 2 },
}
