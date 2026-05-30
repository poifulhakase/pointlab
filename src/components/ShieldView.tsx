import { useState, useEffect, useRef, useCallback } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { restGetDoc, restSetDoc } from '../utils/firestoreRest'
import { buildNewsPrompt, buildUpcomingEventsText } from '../utils/newsPrompt'
import { cy } from '../utils/cyberTheme'
import { useSystemLog, CyberSystemLog, type LogState } from './CyberSystemLog'
import { SHIELD_PROMPT_TEMPLATE } from '../utils/shieldPrompt'
import { buildShieldData, getRecentEngineReport } from '../utils/shieldData'
import { AILaunchRow } from './CyberAiLaunch'
import { jstTodayKey, jstTimestamp } from '../utils/jstDate'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
  shieldTab?: 'shield' | 'news'
  onShieldTabChange?: (tab: 'shield' | 'news') => void
}

// ── STATUS LINES ─────────────────────────────────────
const NEWS_STATUS_LINES = [
  'POI-ROBO NEWS v1.0  ▶ ONLINE',
  'マクロイベントカレンダー ...... スキャン中',
  '5営業日以内のイベント ......... 抽出中',
  'コンセンサス予想 .............. 取得準備中',
  '中央銀行スケジュール .......... ロード済み',
  'SQ日程チェック ................ 確認中',
  '需給物理統合モード ............ 待機中',
  '事前確率分類エンジン .......... スタンバイ',
  'イベント予測プロンプト ........ 生成完了',
  'ぽいロボ イベント予測 .......... オンライン',
]

const SHIELD_STATUS_LINES = [
  'POI-ROBO SHIELD v1.0  ▶ ONLINE',
  '日経225先物 OHLC ........... 取得中',
  'MA20 / MA60 / MA200 ....... 計算中',
  '直近高値・安値 ............. 算出中',
  '先物建玉残高・PCR .......... 取得中',
  'VIX 恐怖指数 ............... 取得中',
  'ポジション管理モード ....... 待機中',
  'イグジット判断支援 ......... スタンバイ',
  'リスク管理センサー ......... 作動中',
  'ポジションデータ受信待ち ... アイドル',
  'イグジットゾーン検知 ....... 監視中',
  'データパッケージ生成 ....... 待機中',
]

// ── ⑫ MemoPanel（レポート保存：シールド/イベント共通）──────────
type MemoConfig = {
  storageKey: string
  fsPath: (uid: string) => string
  title: string
  placeholder: string
  patterns: RegExp[]
  hlDark: string
  hlLight: string
}

const SHIELD_MEMO_CONFIG: MemoConfig = {
  storageKey: 'poical-shield-memo',
  fsPath: (uid) => `users/${uid}/data/shieldMemo`,
  title: 'ポジション分析レポート',
  placeholder: '▌ ポジション分析レポートを記録...',
  patterns: [
    /損切り価格：(?:(?!（(?:根拠|条件)：).)+/g,
    /利確目標：(?:(?!（(?:根拠|条件)：).)+/g,
    /指令：(?:(?!（(?:根拠|条件)：).)+/g,
    /確信度：[\d.]+%/g,
  ],
  hlDark:  'rgba(255,100,180,0.95)',
  hlLight: '#db2777',
}

const EVENT_MEMO_CONFIG: MemoConfig = {
  storageKey: 'poical-event-memo',
  fsPath: (uid) => `users/${uid}/data/eventMemo`,
  title: 'イベント分析レポート',
  placeholder: '▌ イベント分析レポートを記録...',
  patterns: [
    /事前確率分類：.+/g,
    /イベント前の姿勢：.+/g,
    /予想と需給の方向一致性：.+/g,
  ],
  hlDark:  'rgba(0,229,255,0.95)',
  hlLight: '#0369a1',
}

function renderMemoHL(text: string, patterns: RegExp[], hlColor: string): React.ReactNode {
  if (!text) return null
  const ranges: { start: number; end: number }[] = []
  for (const pat of patterns) {
    pat.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pat.exec(text)) !== null) ranges.push({ start: m.index, end: m.index + m[0].length })
  }
  if (ranges.length === 0) return <span>{text}</span>
  ranges.sort((a, b) => a.start - b.start)
  const nodes: React.ReactNode[] = []
  let pos = 0; let k = 0
  for (const { start, end } of ranges) {
    if (pos < start) nodes.push(<span key={k++}>{text.slice(pos, start)}</span>)
    nodes.push(<span key={k++} style={{ color: hlColor, fontWeight: 700 }}>{text.slice(start, end)}</span>)
    pos = end
  }
  if (pos < text.length) nodes.push(<span key={k++}>{text.slice(pos)}</span>)
  return <>{nodes}</>
}

function MemoPanel({ user, theme, isMobile, config }: { user: User | null; theme: 'dark' | 'light'; isMobile: boolean; config: MemoConfig }) {
  const c = cy(theme)
  const nd = theme === 'dark' ? {
    title:  'rgba(255,255,255,0.78)',
    border: 'rgba(255,255,255,0.10)',
    bordbr: 'rgba(255,255,255,0.20)',
    faint:  'rgba(255,255,255,0.06)',
    btnBg:  (on: boolean) => on ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
  } : null

  const [text,      setText]      = useState(() => {
    try { return localStorage.getItem(config.storageKey) ?? '' } catch { return '' }
  })
  const [saved,     setSaved]     = useState(false)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // 設定切替時に保存済みテキストを読み直す（シールド⇄イベント）
  useEffect(() => {
    try { setText(localStorage.getItem(config.storageKey) ?? '') } catch { setText('') }
  }, [config.storageKey])

  // Firestore 初回同期: ログイン時にリモートを取得、リモート優先でマージ
  useEffect(() => {
    if (!user) return
    restGetDoc(config.fsPath(user.uid)).then(snap => {
      if (!snap.exists()) {
        const local = localStorage.getItem(config.storageKey) ?? ''
        if (local) restSetDoc(config.fsPath(user.uid), { text: local, updatedAt: new Date().toISOString() }).catch(() => {})
        return
      }
      const remoteText = (snap.data().text as string) ?? ''
      const localText  = localStorage.getItem(config.storageKey) ?? ''
      if (remoteText && remoteText !== localText) {
        localStorage.setItem(config.storageKey, remoteText)
        setText(remoteText)
      }
    }).catch(() => {})
  }, [user, config.storageKey, config])

  const handleSave = useCallback(() => {
    const today  = jstTodayKey()
    const header = `## ${today}`
    const toSave = text.trimStart().startsWith(header) ? text : `${header}\n\n${text}`
    try { localStorage.setItem(config.storageKey, toSave) } catch { /* noop */ }
    if (toSave !== text) setText(toSave)
    if (user) {
      restSetDoc(config.fsPath(user.uid), { text: toSave, updatedAt: new Date().toISOString() }).catch(() => {})
    }
    setSaved(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSaved(false), 2000)
  }, [text, user, config])

  // ⑫ Ctrl+S で保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: theme === 'dark' ? '#111113' : 'rgba(255,255,255,0.96)' }}>
      {/* ヘッダー */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '5px 14px', minHeight: 36, flexShrink: 0,
        borderBottom: `1px solid ${nd ? nd.border : c.BORDER}`,
        background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : c.HDBG,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={nd ? nd.title : c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span style={{ fontFamily: c.FONT, fontSize: 11, fontWeight: 600, color: nd ? nd.title : c.GREEN, letterSpacing: '0.08em' }}>
            {config.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* 全選択 */}
          <button
            title="全選択"
            onClick={() => { setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.select() }, 0) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
              background: nd ? nd.btnBg(false) : `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.06)`,
              border: `1px solid ${nd ? nd.bordbr : c.BORDBR}`,
              color: nd ? nd.title : c.GREEN,
              transition: 'background 0.2s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2"/>
              <line x1="8" y1="9" x2="16" y2="9"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </button>
          {/* 保存 */}
          <button
            onClick={handleSave}
            style={{
              height: 26, padding: '0 14px', borderRadius: 6, cursor: 'pointer',
              fontFamily: c.FONT, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              background: nd ? nd.btnBg(saved) : `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},${saved ? '0.18' : '0.06'})`,
              border: `1px solid ${nd ? (saved ? nd.title : nd.bordbr) : (saved ? c.GREEN : c.BORDBR)}`,
              color: nd ? nd.title : c.GREEN,
              transition: 'background 0.2s, border-color 0.2s',
              boxShadow: saved ? `0 0 8px ${nd ? nd.faint : c.FAINT}` : 'none',
            }}
          >
            {saved ? '保存しました' : '保存'}
          </button>
        </div>
      </div>

      {/* テキストエリア（ハイライトオーバーレイ） */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden', padding: '14px 16px' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: isMobile ? 'max(320px, calc(100dvh - 116px))' : 280 }}>
          <div
            ref={backdropRef}
            aria-hidden
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              padding: '10px 12px', fontSize: 14, lineHeight: 1.7,
              fontFamily: c.FONT, borderRadius: 8,
              border: `1px solid ${nd ? nd.border : c.BORDER}`,
              background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : c.TAREA,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              overflow: 'hidden', color: c.TXTCLR,
            }}
          >
            {renderMemoHL(text, config.patterns, theme === 'dark' ? config.hlDark : config.hlLight)}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onScroll={() => { if (backdropRef.current && textareaRef.current) backdropRef.current.scrollTop = textareaRef.current.scrollTop }}
            placeholder={config.placeholder}
            style={{
              flex: 1, width: '100%', resize: 'none', borderRadius: 8,
              padding: '10px 12px', fontSize: 14, lineHeight: 1.7,
              fontFamily: c.FONT,
              background: 'transparent',
              border: '1px solid transparent',
              color: 'transparent', caretColor: c.TXTCLR, outline: 'none',
              position: 'relative',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ── ShieldPanel（左ペイン）────────────────────────────
function ShieldPanel({
  isMobile, theme, copyStatus, isBuilding, onPromptCopy, logState,
}: {
  isMobile: boolean
  theme: 'dark' | 'light'
  copyStatus: '' | 'shield'
  isBuilding: boolean
  onPromptCopy: () => void
  logState: LogState
}) {
  const c = cy(theme)

  return (
    <div style={isMobile
      ? { flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: c.BG, backgroundImage: c.SCAN }
      : { width: 500, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRight: `1px solid ${c.BORDBR}` }
    }>

      {theme === 'dark' && <style>{`
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
        flex: 1,
        position: 'relative', display: 'flex', flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
        ...(!isMobile && theme === 'dark' ? { background: c.BG, backgroundImage: c.SCAN } : {}),
        ...(!isMobile && theme === 'light' ? { background: c.BG } : {}),
      }}>
        {theme === 'dark' && !isMobile && <>
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

        {/* ヘッダー */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '5px 14px', minHeight: 36, flexShrink: 0,
          borderBottom: `1px solid ${c.BORDER}`,
          background: c.HDBG,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontFamily: c.FONT, fontSize: 11, fontWeight: 700, color: c.GREEN, letterSpacing: '0.08em' }}>
              ぽいロボ シールド
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.GREEN, boxShadow: `0 0 6px ${c.GREEN}` }} />
            <span style={{ fontFamily: c.FONT, fontSize: 10, color: c.DIM, letterSpacing: '0.12em' }}>ONLINE</span>
          </div>
        </div>

        {/* スクロール可能コンテンツ */}
        <div style={{
          position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto',
          padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 42,
        }}>

          {/* 説明 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{
              borderLeft: `3px solid ${c.GREEN}`,
              background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.05)`,
              borderRadius: '0 8px 8px 0',
              padding: '10px 14px',
              fontSize: 14, lineHeight: 1.75,
              color: c.DESC,
              fontFamily: c.FONT, letterSpacing: '0.04em',
            }}>
              {/* ⑩ テキスト修正 */}
              日経平均ブル/ベア専用のポジション分析機能。<br />
              下のボタンでコピーしてAI分析してください。
            </div>

            {/* COPYボタン（データ取得 + コピー） */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button
                  disabled={isBuilding}
                  style={{
                    width: 84, height: 84, borderRadius: '50%',
                    background: copyStatus === 'shield'
                      ? `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.18)`
                      : `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.07)`,
                    border: `2px solid ${copyStatus === 'shield' ? c.GREEN : c.BORDBR}`,
                    boxShadow: copyStatus === 'shield'
                      ? `0 0 24px ${c.FAINT}, inset 0 0 14px ${c.FAINT}`
                      : `0 0 16px ${c.FAINT}, inset 0 0 10px ${c.FAINT}`,
                    color: c.GREEN,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 7, cursor: isBuilding ? 'wait' : 'pointer',
                    opacity: isBuilding ? 0.65 : 1,
                    transition: 'background 0.2s, box-shadow 0.2s, border-color 0.2s',
                  }}
                  onClick={onPromptCopy}
                >
                  {isBuilding
                    ? <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2.5px solid ${c.FAINT}`, borderTopColor: c.GREEN, animation: 'spin 0.7s linear infinite' }} />
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                  }
                  <span style={{ fontFamily: c.FONT, fontSize: 10, letterSpacing: '0.07em', lineHeight: 1 }}>
                    {isBuilding ? '取得中' : copyStatus === 'shield' ? 'DONE' : 'COPY'}
                  </span>
                </button>
                {/* 吹き出し */}
                <div style={{
                  position: 'absolute', top: '50%', left: 88, transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none', width: 'max-content',
                }}>
                  <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `8px solid ${c.BORDBR}`, flexShrink: 0 }} />
                  <div style={{
                    background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.06)`,
                    border: `1px solid ${c.BORDBR}`, borderRadius: 8,
                    padding: '6px 10px', fontFamily: 'system-ui, sans-serif',
                    fontSize: 11, color: c.DIM, letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap',
                  }}>
                    {isBuilding ? <>データ取得中…<br />しばらくお待ちください</> : copyStatus === 'shield' ? '▶ コピー完了' : <>ポジション分析用<br />プロンプト＋市場データ</>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 4, fontFamily: c.FONT, fontSize: 10, letterSpacing: '0.04em', color: c.DIM }}>
              推奨: <span style={{ color: c.GREEN }}>Claude</span>
            </div>
          </div>

          {/* AI起動 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontFamily: c.FONT, fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: c.DIM }}>
              ▌ AI起動
            </div>

            <AILaunchRow theme={theme} />

            {/* ポジション画像必須の案内 */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.04)`,
              border: `1px dashed ${c.BORDER}`,
              borderRadius: 8, padding: '10px 14px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: 1 }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style={{ fontFamily: c.FONT, fontSize: 12, color: c.NOTICE, letterSpacing: '0.04em', lineHeight: 1.7 }}>
                AI起動後、保有ポジション画面のキャプチャを必ず添付すること<br />
                <span style={{ color: c.DIM, fontSize: 11 }}>（未添付の場合、AIがエラーを出力します）</span>
              </span>
            </div>
          </div>

        </div>
      </div>{/* /パーティクルラッパー */}

      {/* ② デスクトップ: SYSTEM LOG は左パネル最下部に表示 */}
      {!isMobile && (
        <CyberSystemLog {...logState} theme={theme} />
      )}
    </div>
  )
}

// ── NewsPanel（ニュースモード左ペイン）──────────────────
function NewsPanel({
  isMobile, theme, copyStatus, onNewsCopy, logState,
}: {
  isMobile: boolean
  theme: 'dark' | 'light'
  copyStatus: '' | 'news_shield'
  onNewsCopy: () => void
  logState: LogState
}) {
  const c = cy(theme)

  return (
    <div style={isMobile
      ? { flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: c.BG, backgroundImage: c.SCAN }
      : { width: 500, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRight: `1px solid ${c.BORDBR}` }
    }>
      {theme === 'dark' && <style>{`
        @keyframes news-dust {
          0%   { transform: translateY(0); opacity: 0; }
          20%  { opacity: 0.35; }
          100% { transform: translateY(-160px); opacity: 0; }
        }
        .news-dust {
          position: absolute; width: 2px; height: 2px;
          background: #00e5ff; border-radius: 50%; opacity: 0;
          animation: news-dust 10s linear infinite; pointer-events: none;
        }
        @keyframes news-scanline {
          0%   { top: -20px; }
          100% { top: 110%; }
        }
        .news-scanline {
          position: absolute; left: 0; width: 100%; height: 15px;
          background: linear-gradient(to bottom, transparent, rgba(0,229,255,0.04), transparent);
          pointer-events: none;
          animation: news-scanline 8s linear infinite;
        }
      `}</style>}

      <div style={{
        flex: 1,
        position: 'relative', display: 'flex', flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
        ...(!isMobile && theme === 'dark' ? { background: c.BG, backgroundImage: c.SCAN } : {}),
        ...(!isMobile && theme === 'light' ? { background: c.BG } : {}),
      }}>
        {theme === 'dark' && !isMobile && <>
          <div className="news-dust" style={{ top: '70%', left: '20%', animationDelay: '0s' }} />
          <div className="news-dust" style={{ top: '40%', left: '80%', animationDelay: '2s' }} />
          <div className="news-dust" style={{ top: '80%', left: '65%', animationDelay: '1s' }} />
          <div className="news-dust" style={{ top: '20%', left: '30%', animationDelay: '3s' }} />
          <div className="news-dust" style={{ top: '60%', left: '50%', animationDelay: '4.5s' }} />
          <div className="news-scanline" />
        </>}

        {/* ヘッダー */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '5px 14px', minHeight: 36, flexShrink: 0,
          borderBottom: `1px solid ${c.BORDER}`,
          background: c.HDBG,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 11 18-5v12L3 14v-3z"/>
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
            </svg>
            <span style={{ fontFamily: c.FONT, fontSize: 11, fontWeight: 700, color: c.GREEN, letterSpacing: '0.08em' }}>
              ぽいロボ イベント
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.GREEN, boxShadow: `0 0 6px ${c.GREEN}` }} />
            <span style={{ fontFamily: c.FONT, fontSize: 10, color: c.DIM, letterSpacing: '0.12em' }}>ONLINE</span>
          </div>
        </div>

        {/* コンテンツ */}
        <div style={{
          position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto',
          padding: '26px 22px', display: 'flex', flexDirection: 'column', gap: 42,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{
              borderLeft: `3px solid ${c.GREEN}`,
              background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.05)`,
              borderRadius: '0 8px 8px 0',
              padding: '10px 14px',
              fontSize: 14, lineHeight: 1.75,
              color: c.DESC,
              fontFamily: c.FONT, letterSpacing: '0.04em',
            }}>
              今後5営業日のマクロイベントを分析。<br />
              下のボタンでコピーしてAI分析してください。
            </div>

            {/* COPYボタン */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button
                  style={{
                    width: 84, height: 84, borderRadius: '50%',
                    background: copyStatus === 'news_shield'
                      ? `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.18)`
                      : `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.07)`,
                    border: `2px solid ${copyStatus === 'news_shield' ? c.GREEN : c.BORDBR}`,
                    boxShadow: copyStatus === 'news_shield'
                      ? `0 0 24px ${c.FAINT}, inset 0 0 14px ${c.FAINT}`
                      : `0 0 16px ${c.FAINT}, inset 0 0 10px ${c.FAINT}`,
                    color: c.GREEN,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 7, cursor: 'pointer',
                    transition: 'background 0.2s, box-shadow 0.2s, border-color 0.2s',
                  }}
                  onClick={onNewsCopy}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 11 18-5v12L3 14v-3z"/>
                    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                  </svg>
                  <span style={{ fontFamily: c.FONT, fontSize: 10, letterSpacing: '0.07em', lineHeight: 1 }}>
                    {copyStatus === 'news_shield' ? 'DONE' : 'COPY'}
                  </span>
                </button>
                {/* 吹き出し */}
                <div style={{
                  position: 'absolute', top: '50%', left: 88, transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none', width: 'max-content',
                }}>
                  <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `8px solid ${c.BORDBR}`, flexShrink: 0 }} />
                  <div style={{
                    background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.06)`,
                    border: `1px solid ${c.BORDBR}`, borderRadius: 8,
                    padding: '6px 10px', fontFamily: 'system-ui, sans-serif',
                    fontSize: 11, color: c.DIM, letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap',
                  }}>
                    {copyStatus === 'news_shield' ? '▶ コピー完了' : <>イベント予測<br />プロンプト＋需給状態</>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 4, fontFamily: c.FONT, fontSize: 10, letterSpacing: '0.04em', color: c.DIM }}>
              推奨: <span style={{ color: '#60a5fa' }}>Gemini</span>
            </div>
          </div>

          {/* AI起動 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontFamily: c.FONT, fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: c.DIM }}>
              ▌ AI起動
            </div>
            <AILaunchRow theme={theme} />
          </div>
        </div>
      </div>

      {!isMobile && <CyberSystemLog {...logState} theme={theme} />}
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────────
export function ShieldView({ theme, isMobile, user, shieldTab = 'shield' }: Props) {
  const tv = themeVars(theme)

  const mode = shieldTab
  const [copyStatus,  setCopyStatus]  = useState<'' | 'shield' | 'news_shield'>('')
  const [isBuilding,  setIsBuilding]  = useState(false)

  const handlePromptCopy = useCallback(async () => {
    if (isBuilding) return
    setIsBuilding(true)
    try {
      // 15秒でタイムアウト（プロキシが応答しない場合の保険）
      const mktData = await Promise.race([
        buildShieldData(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 15_000)
        ),
      ])
      const engineReport = getRecentEngineReport()
      const engineSection = engineReport
        ? `\n---\n# ぽいロボ エンジン 直近レポート（二次参考）\n`
          + `> ⚠️ このレポートはエントリー可否・相場方向の需給分析用です。\n`
          + `> シールドの判断は「ポジション画像」と「市場データJSON」を一次情報とし、このレポートは二次参考に留めてください。\n`
          + `> エンジンの相場観とポジション管理方針が食い違う場合は、ポジション画像の損益状況を優先してください。\n`
          + `> レポート日付: ${engineReport.date}\n\n`
          + engineReport.text + '\n'
        : ''
      const fullText = SHIELD_PROMPT_TEMPLATE
        + '\n---\n# 市場データ（自動取得）\n```json\n'
        + JSON.stringify(mktData, null, 2)
        + '\n```\n'
        + engineSection
      try {
        await navigator.clipboard.writeText(fullText)
      } catch {
        const el = Object.assign(document.createElement('textarea'), {
          value: fullText, style: 'position:fixed;opacity:0',
        })
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopyStatus('shield')
      setTimeout(() => setCopyStatus(''), 2500)
    } catch {
      // データ取得失敗時はプロンプトのみコピー
      try {
        await navigator.clipboard.writeText(SHIELD_PROMPT_TEMPLATE)
      } catch { /* noop */ }
      setCopyStatus('shield')
      setTimeout(() => setCopyStatus(''), 2500)
    } finally {
      setIsBuilding(false)
    }
  }, [isBuilding])

  const handleNewsCopy = useCallback(async () => {
    const ts = jstTimestamp()
    const report = getRecentEngineReport()
    const tevState = report
      ? `エンジンレポート日付：${report.date}\n${report.text}`
      : '（エンジンレポートなし。ぽいロボ エンジンで需給分析を行ってからコピーしてください）'
    const prompt = buildNewsPrompt(ts, buildUpcomingEventsText(5), tevState)
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      const el = Object.assign(document.createElement('textarea'), {
        value: prompt, style: 'position:fixed;opacity:0',
      })
      document.body.appendChild(el); el.select(); document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopyStatus('news_shield')
    setTimeout(() => setCopyStatus(''), 2500)
  }, [])

  const logState     = useSystemLog(SHIELD_STATUS_LINES)
  const newsLogState = useSystemLog(NEWS_STATUS_LINES)

  return (
    <div style={{ ...s.wrap, ...tv }}>
      {/* コンテンツ */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflowY: isMobile ? 'auto' : 'hidden',
        paddingBottom: isMobile ? 130 : 0,
      }}>
        {mode === 'shield' ? (
          <>
            <ShieldPanel
              isMobile={isMobile}
              theme={theme}
              copyStatus={copyStatus === 'shield' ? 'shield' : ''}
              isBuilding={isBuilding}
              onPromptCopy={handlePromptCopy}
              logState={logState}
            />
            <div style={isMobile ? s.dividerH : s.divider} />
            <div style={isMobile ? { flexShrink: 0, display: 'flex', flexDirection: 'column' } : s.panel}>
              <MemoPanel user={user} theme={theme} isMobile={isMobile} config={SHIELD_MEMO_CONFIG} />
            </div>
            {isMobile && <CyberSystemLog {...logState} theme={theme} />}
          </>
        ) : (
          <>
            <NewsPanel
              isMobile={isMobile}
              theme={theme}
              copyStatus={copyStatus === 'news_shield' ? 'news_shield' : ''}
              onNewsCopy={handleNewsCopy}
              logState={newsLogState}
            />
            <div style={isMobile ? s.dividerH : s.divider} />
            <div style={isMobile ? { flexShrink: 0, display: 'flex', flexDirection: 'column' } : s.panel}>
              <MemoPanel user={user} theme={theme} isMobile={isMobile} config={EVENT_MEMO_CONFIG} />
            </div>
            {isMobile && <CyberSystemLog {...newsLogState} theme={theme} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── スタイル ─────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrap:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  panel:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  divider:  { width: 1, background: 'var(--border-dim)', flexShrink: 0 },
  dividerH: { height: 1, background: 'var(--border-dim)', flexShrink: 0 },
}
