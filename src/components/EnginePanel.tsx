/* eslint-disable react-refresh/only-export-components --
   定数(STATUS_LINES)・フック(useEngineSystemLog)・コンポーネント(EngineSystemLog/EnginePanel)を
   凝集モジュールとして同居。HMR(Fast Refresh)専用の警告で実行時影響なし。分割は断片化するため許容 */
import { useState, useEffect, useRef } from 'react'
import type React from 'react'

// ── サイバーデザイン設定 ──────────────────────────────────────────
// false に変更するとサイバーデザインをリセット
const CYBER_MODE = true

export const STATUS_LINES = [
  'POI-ROBO OS v3.1  ▶ ONLINE',
  'クオンツ演算回路 ........... 起動完了',
  '日経225データ .............. 受信完了',
  'VIX指数モニター ............ 作動中',
  'COT先物ポジション .......... 解析中',
  '外国人売買動向 ............. 監視中',
  '信用倍率チェック ........... 完了',
  'ファクター分析 ............. スタンバイ',
  'リスクセンサー ............. アイドル',
  'プロンプト生成 ............. 待機中',
  '相場地合いスキャン ......... 実行中',
  'アービトラージ残 ........... 解析完了',
]

// ── useSystemLog（EnginePanel・ShieldView 共通）──────
export type EngineLogState = { logLines: string[]; cursorVisible: boolean; typedText: string }

export function useEngineSystemLog(statusLines: string[]): EngineLogState {
  const logIdxRef   = useRef(4)
  const [logLines,      setLogLines]      = useState<string[]>(() => statusLines.slice(0, 4))
  const [cursorVisible, setCursorVisible] = useState(true)
  const [typedText,     setTypedText]     = useState('')
  const typeStateRef = useRef({ line: '', idx: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      setLogLines(prev => {
        const next = [...prev.slice(1), statusLines[logIdxRef.current % statusLines.length]]
        logIdxRef.current++
        return next
      })
    }, 5000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  const lastLine = logLines[logLines.length - 1]
  useEffect(() => {
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

  return { logLines, cursorVisible, typedText }
}

// ── EngineSystemLog コンポーネント ───────────────────
export function EngineSystemLog({ logLines, cursorVisible, typedText, theme }: EngineLogState & { theme: 'dark' | 'light' }) {
  const L = theme === 'light'
  const CY_GREEN  = L ? '#0369a1' : '#00e5ff'
  const CY_DIM    = L ? 'rgba(3,105,161,0.75)'  : 'rgba(0,229,255,0.55)'
  const CY_FAINT  = L ? 'rgba(3,105,161,0.38)'  : 'rgba(0,229,255,0.22)'
  const CY_BORDER = L ? 'rgba(3,105,161,0.28)'  : 'rgba(0,229,255,0.22)'
  const CY_FONT   = "'Courier New', Courier, monospace" as const
  return (
    <div style={{
      borderTop: `1px solid ${CY_BORDER}`,
      background: L ? 'rgba(3,105,161,0.06)' : 'rgba(0,0,0,0.45)',
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
  )
}

// !CYBER_MODE dead-branch stubs（TypeScript 型チェック用）
const s: Record<string, React.CSSProperties> = {
  panelHead:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', flexShrink: 0, gap: 8, borderBottom: '1px solid var(--border-dim)', userSelect: 'none' },
  panelTitle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 },
}

const ms: Record<string, React.CSSProperties> = {
  section:         { display: 'flex', flexDirection: 'column', gap: 18 },
  sectionTitle:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-dim)' },
  actionBtn:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--bg-medium)', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.15s' },
  actionBtnAccent: { background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff' },
  aiCard: {
    flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10,
    background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  aiLogo: {
    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  aiInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  aiName:  { fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' as const },
  aiDesc:  { fontSize: 10, color: 'var(--text)', whiteSpace: 'nowrap' as const },
}

// ── エンジンパネル（インライン）────────────────────
export function EnginePanel({
  onPromptCopy, copyStatus, isMobile, theme, logState,
}: {
  onPromptCopy: () => void
  copyStatus: '' | 'prompt'
  isMobile: boolean
  theme: 'dark' | 'light'
  logState: EngineLogState
}) {
  const L         = theme === 'light'
  const CY_BG     = L ? '#f0f7ff' : '#050e1a'
  const CY_GREEN  = L ? '#0369a1' : '#00e5ff'
  const CY_DIM    = L ? 'rgba(3,105,161,0.75)'  : 'rgba(0,229,255,0.55)'
  const CY_FAINT  = L ? 'rgba(3,105,161,0.38)'  : 'rgba(0,229,255,0.22)'
  const CY_BORDER = L ? 'rgba(3,105,161,0.28)'  : 'rgba(0,229,255,0.22)'
  const CY_BORDBR = L ? 'rgba(3,105,161,0.55)'  : 'rgba(0,229,255,0.45)'
  const CY_SCAN   = L ? 'none' : 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.022) 3px, rgba(0,229,255,0.022) 4px)'
  const CY_FONT   = "'Courier New', Courier, monospace" as const
  const CY_RGB    = L ? '3,105,161' : '0,229,255'

  return (
    <div style={isMobile
      ? { flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: CY_BG, backgroundImage: CY_SCAN }
      : { width: 500, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRight: `1px solid ${CY_BORDBR}` }
    }>

      {theme === 'dark' && <style>{`
        @keyframes engine-dust {
          0%   { transform: translateY(0); opacity: 0; }
          20%  { opacity: 0.35; }
          100% { transform: translateY(-160px); opacity: 0; }
        }
        .engine-dust {
          position: absolute;
          width: 2px; height: 2px;
          background: #00e5ff;
          border-radius: 50%;
          opacity: 0;
          animation: engine-dust 10s linear infinite;
          pointer-events: none;
        }
        @keyframes engine-scanline {
          0%   { top: -20px; }
          100% { top: 110%; }
        }
        .engine-scanline {
          position: absolute; left: 0; width: 100%; height: 15px;
          background: linear-gradient(to bottom, transparent, rgba(0,229,255,0.04), transparent);
          pointer-events: none;
          animation: engine-scanline 8s linear infinite;
        }
      `}</style>}

      {/* ── ヘッダー＋コンテンツ ラッパー（パーティクル領域）── */}
      <div style={{
        ...(!isMobile ? { flex: 1 } : {}),
        position: 'relative', display: 'flex', flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
        ...(!isMobile ? { background: CY_BG, backgroundImage: CY_SCAN } : {}),
      }}>

        {theme === 'dark' && !isMobile && <>
          <div className="engine-dust" style={{ top: '70%', left: '20%', animationDelay: '0s' }} />
          <div className="engine-dust" style={{ top: '40%', left: '80%', animationDelay: '2s' }} />
          <div className="engine-dust" style={{ top: '80%', left: '65%', animationDelay: '1s' }} />
          <div className="engine-dust" style={{ top: '20%', left: '30%', animationDelay: '3s' }} />
          <div className="engine-dust" style={{ top: '60%', left: '50%', animationDelay: '4.5s' }} />
          <div className="engine-dust" style={{ top: '35%', left: '10%', animationDelay: '6s' }} />
          <div className="engine-dust" style={{ top: '85%', left: '45%', animationDelay: '1.5s' }} />
          <div className="engine-dust" style={{ top: '15%', left: '70%', animationDelay: '5s' }} />
          <div className="engine-scanline" />
        </>}

      {/* ── ヘッダー ── */}
      <div style={{ position: 'relative', zIndex: 1, ...(CYBER_MODE ? {
        padding: '5px 14px', minHeight: 36, flexShrink: 0,
        borderBottom: `1px solid ${CY_BORDER}`,
        background: `rgba(${CY_RGB},0.06)`,
        display: 'flex', alignItems: 'center', gap: 8,
      } : s.panelHead) }}>
        <div style={CYBER_MODE ? { display: 'flex', alignItems: 'center', gap: 8, flex: 1 } : s.panelTitle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={CYBER_MODE ? CY_GREEN : 'currentColor'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8"/>
            <rect width="16" height="12" x="4" y="8" rx="2"/>
            <path d="M2 14h2"/>
            <path d="M20 14h2"/>
            <path d="M15 13v2"/>
            <path d="M9 13v2"/>
          </svg>
          <span style={CYBER_MODE
            ? { fontFamily: CY_FONT, fontSize: 11, fontWeight: 700, color: CY_GREEN, letterSpacing: '0.08em' }
            : {}
          }>ぽいロボ エンジン</span>
        </div>
        {CYBER_MODE && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: CY_GREEN, boxShadow: `0 0 6px ${CY_GREEN}` }} />
            <span style={{ fontFamily: CY_FONT, fontSize: 10, color: CY_DIM, letterSpacing: '0.12em' }}>ONLINE</span>
          </div>
        )}
      </div>

      {/* ── スクロール可能コンテンツ ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 42 }}>

        <div style={ms.section}>
          <div style={CYBER_MODE ? {
            borderLeft: `3px solid ${CY_GREEN}`,
            background: `rgba(${CY_RGB},0.05)`,
            borderRadius: '0 8px 8px 0',
            padding: '10px 14px',
            fontSize: 14, lineHeight: 1.75,
            color: L ? 'rgba(3,105,161,0.90)' : 'rgba(200,240,255,0.88)',
            fontFamily: CY_FONT,
            letterSpacing: '0.04em',
          } : {
            borderLeft: '3px solid var(--accent)',
            background: 'var(--bg-subtle)',
            borderRadius: '0 8px 8px 0',
            padding: '10px 14px',
            fontSize: 14, lineHeight: 1.7,
            color: 'var(--text)',
            fontWeight: 500,
          }}>
            日経平均ブル/ベア専用の需給分析機能。<br />下のボタンでコピーしてAI分析してください。
          </div>
          {CYBER_MODE ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button
                  style={{
                    width: 84, height: 84, borderRadius: '50%',
                    background: copyStatus === 'prompt' ? `rgba(${CY_RGB},0.18)` : `rgba(${CY_RGB},0.07)`,
                    border: `2px solid ${copyStatus === 'prompt' ? CY_GREEN : CY_BORDBR}`,
                    boxShadow: copyStatus === 'prompt'
                      ? `0 0 24px ${CY_FAINT}, inset 0 0 14px ${CY_FAINT}`
                      : `0 0 16px ${CY_FAINT}, inset 0 0 10px ${CY_FAINT}`,
                    color: CY_GREEN,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 7, cursor: 'pointer',
                    transition: 'background 0.2s, box-shadow 0.2s, border-color 0.2s',
                  }}
                  onClick={onPromptCopy}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8V4H8"/>
                    <rect width="16" height="12" x="4" y="8" rx="2"/>
                    <path d="M2 14h2"/>
                    <path d="M20 14h2"/>
                    <path d="M15 13v2"/>
                    <path d="M9 13v2"/>
                  </svg>
                  <span style={{ fontFamily: CY_FONT, fontSize: 10, letterSpacing: '0.07em', lineHeight: 1 }}>
                    {copyStatus === 'prompt' ? 'DONE' : 'COPY'}
                  </span>
                </button>
                {/* 吹き出し（右横フロート） */}
                <div style={{ position: 'absolute', top: '50%', left: 88, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none', width: 'max-content' }}>
                  <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `8px solid ${CY_BORDBR}`, flexShrink: 0 }} />
                  <div style={{ background: `rgba(${CY_RGB},0.06)`, border: `1px solid ${CY_BORDBR}`, borderRadius: 8, padding: '6px 10px', fontFamily: 'system-ui, sans-serif', fontSize: 11, color: CY_DIM, letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap' }}>
                    {copyStatus === 'prompt' ? '▶ コピー完了' : <>エントリー分析用<br />プロンプト＋需給データ</>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                style={{ ...ms.actionBtn, ...ms.actionBtnAccent, height: 58, flexShrink: 0 }}
                onClick={onPromptCopy}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {copyStatus === 'prompt' ? 'コピーしました！' : <>エントリー分析用<br />プロンプト＋需給データ</>}
              </button>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, letterSpacing: '0.04em', fontFamily: CYBER_MODE ? CY_FONT : undefined, color: CYBER_MODE ? CY_DIM : 'var(--text-dim)' }}>
            推奨: <span style={{ color: CYBER_MODE ? CY_GREEN : 'var(--accent)' }}>Claude</span>
          </div>
        </div>

        {/* AI チャットへのリンク */}
        <div style={ms.section}>
          <div style={CYBER_MODE
            ? { ...ms.sectionTitle, color: CY_DIM, fontFamily: CY_FONT, fontSize: 14, letterSpacing: '0.08em' }
            : ms.sectionTitle
          }>{CYBER_MODE ? '▌ AI起動' : 'AI起動'}</div>
          {CYBER_MODE ? (
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly' }}>

              {/* ChatGPT */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 86 }}>
                <a
                  href="https://chatgpt.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://chatgpt.com/', '_blank') }}
                  style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: `rgba(${CY_RGB},0.06)`,
                    border: `2px solid ${CY_BORDER}`,
                    boxShadow: `0 0 16px ${CY_FAINT}, inset 0 0 10px ${CY_FAINT}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', textDecoration: 'none',
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#10a37f', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <svg width="24" height="24" viewBox="0 0 41 41" fill="none">
                      <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.996l-4.331 2.5-4.331-2.5V18z" fill="white"/>
                    </svg>
                  </div>
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontFamily: CY_FONT, fontSize: 13, color: CY_GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>ChatGPT</span>
                  <span style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_DIM, letterSpacing: '0.02em' }}>o3以上推奨</span>
                </div>
              </div>

              {/* Gemini */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 86 }}>
                <a
                  href="https://gemini.google.com/?hl=ja"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://gemini.google.com/?hl=ja', '_blank', 'noopener,noreferrer') }}
                  style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: `rgba(${CY_RGB},0.06)`,
                    border: `2px solid ${CY_BORDER}`,
                    boxShadow: `0 0 16px ${CY_FAINT}, inset 0 0 10px ${CY_FAINT}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', textDecoration: 'none',
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc04,#ea4335)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                      <path d="M14 2 C14 2 15.6 9.4 20 14 C15.6 18.6 14 26 14 26 C14 26 12.4 18.6 8 14 C12.4 9.4 14 2 14 2Z" fill="white"/>
                      <path d="M2 14 C2 14 9.4 12.4 14 8 C18.6 12.4 26 14 26 14 C26 14 18.6 15.6 14 20 C9.4 15.6 2 14 2 14Z" fill="white" opacity="0.85"/>
                    </svg>
                  </div>
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontFamily: CY_FONT, fontSize: 13, color: CY_GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>Gemini</span>
                  <span style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_DIM, letterSpacing: '0.02em' }}>思考モード推奨</span>
                </div>
              </div>

              {/* Claude */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 86 }}>
                <a
                  href="https://claude.ai/projects"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://claude.ai/new', '_blank') }}
                  style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: `rgba(${L ? '3,105,161' : '0,229,255'},0.06)`,
                    border: `2px solid ${CY_BORDER}`,
                    boxShadow: `0 0 16px ${CY_FAINT}, inset 0 0 10px ${CY_FAINT}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', textDecoration: 'none',
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#d97757', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.2 14.7 8 16 L7 21 L12 18.5 L17 21 L16 16 C17.8 14.7 19 12.5 19 10 C19 6 16 3 12 3Z" fill="white" opacity="0.95"/>
                    </svg>
                  </div>
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontFamily: CY_FONT, fontSize: 13, color: CY_GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>Claude</span>
                  <span style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_DIM, letterSpacing: '0.02em' }}>ぽいロボ推奨</span>
                </div>
              </div>

              {/* DeepSeek */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 86 }}>
                <a
                  href="https://chat.deepseek.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://chat.deepseek.com/', '_blank') }}
                  style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: `rgba(${CY_RGB},0.06)`,
                    border: `2px solid ${CY_BORDER}`,
                    boxShadow: `0 0 16px ${CY_FAINT}, inset 0 0 10px ${CY_FAINT}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', textDecoration: 'none',
                    transition: 'box-shadow 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#4B6EF5,#1AC4C4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                      <path d="M6 4h6c5 0 8 3 8 8s-3 8-8 8H6V4zm4 4v8h2c3 0 5-1.8 5-4s-2-4-5-4h-2z"/>
                    </svg>
                  </div>
                </a>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <span style={{ fontFamily: CY_FONT, fontSize: 13, color: CY_GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>DeepSeek</span>
                  <span style={{ fontFamily: CY_FONT, fontSize: 11, color: CY_DIM, letterSpacing: '0.02em' }}>R1モデル推奨</span>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ChatGPT */}
              <a
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://chatgpt.com/', '_blank') }}
              >
                <div style={{ ...ms.aiLogo, background: '#10a37f' }}>
                  <svg width="24" height="24" viewBox="0 0 41 41" fill="none">
                    <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.996l-4.331 2.5-4.331-2.5V18z" fill="white"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>ChatGPT</div>
                  <div style={ms.aiDesc}>o3以上推奨</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* Gemini */}
              <a
                href="https://gemini.google.com/?hl=ja"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://gemini.google.com/?hl=ja', '_blank', 'noopener,noreferrer') }}
              >
                <div style={{ ...ms.aiLogo, background: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc04,#ea4335)', padding: 0, overflow: 'hidden' }}>
                  <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                    <path d="M14 2 C14 2 15.6 9.4 20 14 C15.6 18.6 14 26 14 26 C14 26 12.4 18.6 8 14 C12.4 9.4 14 2 14 2Z" fill="white"/>
                    <path d="M2 14 C2 14 9.4 12.4 14 8 C18.6 12.4 26 14 26 14 C26 14 18.6 15.6 14 20 C9.4 15.6 2 14 2 14Z" fill="white" opacity="0.85"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>Gemini</div>
                  <div style={ms.aiDesc}>思考モード推奨</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* Claude */}
              <a
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://claude.ai/new', '_blank') }}
              >
                <div style={{ ...ms.aiLogo, background: '#d97757' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.2 14.7 8 16 L7 21 L12 18.5 L17 21 L16 16 C17.8 14.7 19 12.5 19 10 C19 6 16 3 12 3Z" fill="white" opacity="0.95"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>Claude</div>
                  <div style={ms.aiDesc}>ぽいロボ推奨</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* DeepSeek */}
              <a
                href="https://chat.deepseek.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('https://chat.deepseek.com/', '_blank') }}
              >
                <div style={{ ...ms.aiLogo, background: 'linear-gradient(135deg,#4B6EF5,#1AC4C4)', padding: 0, overflow: 'hidden' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M6 4h6c5 0 8 3 8 8s-3 8-8 8H6V4zm4 4v8h2c3 0 5-1.8 5-4s-2-4-5-4h-2z"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>DeepSeek</div>
                  <div style={ms.aiDesc}>R1モデル推奨</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

            </div>
          )}
        </div>
      </div>

      </div>{/* /パーティクルラッパー */}

      {/* ② デスクトップ: SYSTEM LOG は左パネル最下部に表示。スマホは QuantView が後ろに描画 */}
      {!isMobile && (
        <EngineSystemLog {...logState} theme={theme} />
      )}
    </div>
  )
}
