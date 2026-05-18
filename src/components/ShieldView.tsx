import { useState, useEffect, useRef, useCallback } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { proxyFetch } from '../utils/proxyFetch'
import { fetchVixData } from '../utils/vixData'
import { fetchFuturesDailyData } from '../utils/futuresDailyData'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
}

// ── CYBER カラー（テーマ対応） ──────────────────────
function cy(theme: 'dark' | 'light') {
  const L = theme === 'light'
  return {
    BG:     L ? '#f0f7ff' : '#050e1a',
    GREEN:  L ? '#0369a1' : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.75)' : 'rgba(0,229,255,0.55)',
    FAINT:  L ? 'rgba(3,105,161,0.38)' : 'rgba(0,229,255,0.22)',
    BORDER: L ? 'rgba(3,105,161,0.28)' : 'rgba(0,229,255,0.22)',
    BORDBR: L ? 'rgba(3,105,161,0.55)' : 'rgba(0,229,255,0.45)',
    NOTICE: L ? 'rgba(3,105,161,0.95)' : 'rgba(0,229,255,0.92)',
    SCAN:   L ? 'none' : 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,229,255,0.022) 3px, rgba(0,229,255,0.022) 4px)',
    LOGBG:  L ? 'rgba(3,105,161,0.06)' : 'rgba(0,0,0,0.45)',
    HDBG:   L ? 'rgba(3,105,161,0.06)' : 'rgba(0,229,255,0.06)',
    TAREA:  L ? 'rgba(3,105,161,0.07)' : 'rgba(0,229,255,0.04)',
    TXTCLR: L ? 'var(--text)' : 'rgba(255,255,255,0.88)',
    FONT:   "'Courier New', Courier, monospace" as const,
  } as const
}

// ── STATUS LINES ─────────────────────────────────────
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

// ── 市場データ構造 ───────────────────────────────────
interface ShieldMktData {
  built_at:   string
  nk225: {
    latest_date:   string
    latest_close:  number
    change_1d:     number | null
    change_1d_pct: number | null
    ma20:          number | null
    ma60:          number | null
    ma200:         number | null
    high_20d:      number | null
    low_20d:       number | null
    ohlcv_recent:  Array<{ date: string; open: number; high: number; low: number; close: number; change_pct: number | null }>
  }
  futures: {
    oi_latest:     number | null
    oi_delta:      number | null
    pcr_latest:    number | null
    volume_latest: number | null
    data_as_of:    string | null
  }
  vix: {
    latest:     number | null
    change_pct: number | null
  }
}

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return Math.round(slice.reduce((a, b) => a + b, 0) / period)
}

async function buildShieldData(): Promise<ShieldMktData> {
  const builtAt = new Date().toISOString().slice(0, 10)

  // 1. 日経225 1年分OHLCV (MA200計算用)
  let days: Array<{ date: string; open: number; high: number; low: number; close: number }> = []
  try {
    const q    = 'interval=1d&range=1y'
    const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/NK%3DF?${q}`
    const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/%5EN225?${q}`
    let raw: unknown
    try   { raw = await proxyFetch(url1) }
    catch { raw = await proxyFetch(url2) }

    const r  = (raw as any)?.chart?.result?.[0]
    const ts: number[]          = r?.timestamp ?? []
    const q_ = r?.indicators?.quote?.[0] ?? {}
    for (let i = 0; i < ts.length; i++) {
      const c = q_.close?.[i]
      if (c == null) continue
      days.push({
        date:  new Date(ts[i] * 1000).toISOString().slice(0, 10),
        open:  Math.round(q_.open?.[i]  ?? c),
        high:  Math.round(q_.high?.[i]  ?? c),
        low:   Math.round(q_.low?.[i]   ?? c),
        close: Math.round(c),
      })
    }
    days.sort((a, b) => a.date.localeCompare(b.date))
  } catch { /* データ取得失敗時は空 */ }

  const closes    = days.map(d => d.close)
  const latest    = days[days.length - 1]
  const prev      = days[days.length - 2]
  const recent10  = days.slice(-10)
  const recent20  = days.slice(-20)
  const high20d   = recent20.length > 0 ? Math.max(...recent20.map(d => d.high)) : null
  const low20d    = recent20.length > 0 ? Math.min(...recent20.map(d => d.low))  : null
  const ohlcvRecent = recent10.map((d, i) => {
    const p = recent10[i - 1]
    return { ...d, change_pct: p ? Math.round((d.close - p.close) / p.close * 10000) / 100 : null }
  })

  // 2. 先物日次（建玉残高・PCR）
  let futures: ShieldMktData['futures'] = { oi_latest: null, oi_delta: null, pcr_latest: null, volume_latest: null, data_as_of: null }
  try {
    const fd  = await fetchFuturesDailyData()
    const f0  = fd[0]
    const f1  = fd[1]
    if (f0) {
      futures = {
        oi_latest:     f0.oi,
        oi_delta:      f1 != null ? f0.oi - f1.oi : null,
        pcr_latest:    f0.pcr ?? null,
        volume_latest: f0.volume,
        data_as_of:    f0.date,
      }
    }
  } catch { /* noop */ }

  // 3. VIX（週次）
  let vix: ShieldMktData['vix'] = { latest: null, change_pct: null }
  try {
    const vd = await fetchVixData()
    const vl = vd[vd.length - 1]
    if (vl) vix = { latest: vl.close, change_pct: vl.changePct ?? null }
  } catch { /* noop */ }

  return {
    built_at: builtAt,
    nk225: {
      latest_date:   latest?.date        ?? builtAt,
      latest_close:  latest?.close       ?? 0,
      change_1d:     latest && prev ? latest.close - prev.close          : null,
      change_1d_pct: latest && prev ? Math.round((latest.close - prev.close) / prev.close * 10000) / 100 : null,
      ma20:   calcMA(closes, 20),
      ma60:   calcMA(closes, 60),
      ma200:  calcMA(closes, 200),
      high_20d: high20d,
      low_20d:  low20d,
      ohlcv_recent: ohlcvRecent,
    },
    futures,
    vix,
  }
}

// ── ポジション分析プロンプト ─────────────────────────
const SHIELD_PROMPT_TEMPLATE = `# Role
あなたは保有中ポジション専門アドバイザー「ぽいロボ シールド」です。
エントリーの可否ではなく、**保有中ポジションの管理・出口戦略のみ**を担当します。
末尾の市場データ（JSON）と添付のポジション画像を組み合わせて診断・即答してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ⚠️ 最初に必ず確認：ポジション画像チェック
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
このプロンプトには2種類の情報が含まれます。
1. **末尾の JSON** — 日経225先物 OHLC・移動平均線・建玉残高・PCR・VIX 等の市場データ
2. **添付画像（必須）** — 保有中ポジションのスクリーンショット（証券会社の保有画面）

**添付画像が確認できない場合は、分析を一切行わず以下のエラーのみを出力してください：**

\`\`\`
⚠️ SHIELD ERROR: ポジション画像が未添付です

保有中のポジション状況（証券会社の保有・残高画面）のスクリーンショットを
添付してから再送信してください。

必要な情報:
  - 保有銘柄名（ブル/ベア・1倍/2倍）
  - 平均取得価格・現在価格
  - 保有口数・損益金額・損益率

画像なしでは正確な分析ができません。
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# シールドの3原則
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **防衛（盾）**: 損切りラインを MA・高安値・需給崩壊点から算出する
2. **最大化（槍）**: 利益が乗っている場合、どの条件まで保持すべきかを判定する
3. **管理（鎧）**: 現在のポジションサイズが市場リスクに見合っているか評価する

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ポジション画像の読み取り指示
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
添付されたポジション画像から以下を読み取ること：
- 保有銘柄（ブル1倍／ブル2倍／ベア1倍／ベア2倍）
- 平均取得価格・現在価格・損益金額・損益率
- 保有口数（単位: 口）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 市場データ（JSON）の活用指示
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
末尾の JSON から以下を分析すること：

[価格構造]
- 現在値と MA20 / MA60 / MA200 の位置関係（上 or 下 or 交差中）
- MA200 からの乖離率（過熱 / 適正 / 割安）

[サポート・レジスタンス]
- nk225.high_20d（直近20日高値）→ レジスタンスとして参照
- nk225.low_20d（直近20日安値）→ サポートとして参照

[需給]
- futures.oi_delta（建玉前日比）: 正=ポジション積み増し / 負=手仕舞い
- futures.pcr_latest: ≥1.2=ベア優勢 / ≤0.8=ブル優勢

[市場環境]
- vix.latest: ≥25=リスクオフ局面 / ≤15=安定局面

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 出力形式（コードブロック内に全て出力）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`
## シールドログ：[YYYY-MM-DD]

### 【0. ポジション確認（画像より）】
- 銘柄：(ブル1倍/ブル2倍/ベア1倍/ベア2倍)
- 取得価格：XX,XXX円  現在価格：XX,XXX円
- 損益：±XX,XXX円（±XX.X%）
- 保有口数：XXX口

### 【1. チャート構造診断（JSONデータより）】
- 日経225現在値：XX,XXX円（前日比 ±X.X%）
- MA20：XX,XXX円 → 現在値は MA20の (上/下)
- MA60：XX,XXX円 → 現在値は MA60の (上/下)
- MA200：XX,XXX円 → 現在値は MA200の (上/下) · 乖離率 ±X.X%
- 直近20日高値：XX,XXX円（レジスタンス）
- 直近20日安値：XX,XXX円（サポート）
- 高安値構造：(高値更新中/安値更新中/レンジ継続)

### 【2. 需給診断（JSONデータより）】
- OI前日比：±X,XXX枚 → (積み増し/手仕舞い)
- PCR：X.XX → (ベア優勢/ニュートラル/ブル優勢)
- VIX：XX.X（前週比 ±X.X%） → (リスクオフ/中立/リスクオン)

### 【3. 撤退ライン】
- 損切り価格：XX,XXX円
- 根拠：(MA割れ/高安値割れ/需給崩壊点)
- 撤退トリガー：(条件を具体的に記述)

### 【4. 出口戦略】
- 指令：[ ホールド継続 / 一部利確 / 全量利確 / 即時撤退 ]
- 確信度：XX%（根拠：○○）
- 利確目標：XX,XXX円（条件：○○）

### 【5. リスク評価】
- ポジションサイズ：(適正/過大/要縮小)
- 追加エントリー：(可/不可) — 根拠：○○
\`\`\`
`

// ── useSystemLog ─────────────────────────────────────
type LogState = { logLines: string[]; cursorVisible: boolean; typedText: string }

function useSystemLog(statusLines: string[]): LogState {
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

// ── CyberSystemLog ────────────────────────────────────
function CyberSystemLog({ logLines, cursorVisible, typedText, theme }: LogState & { theme: 'dark' | 'light' }) {
  const c = cy(theme)
  return (
    <div style={{ borderTop: `1px solid ${c.BORDER}`, background: c.LOGBG, padding: '14px 20px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.GREEN, boxShadow: `0 0 6px ${c.GREEN}` }} />
        <span style={{ fontFamily: c.FONT, fontSize: 11, color: c.DIM, letterSpacing: '0.12em' }}>SYSTEM LOG ▶ LIVE</span>
      </div>
      {logLines.map((line, i) => (
        <div key={i} style={{
          fontFamily: c.FONT, fontSize: 13,
          color: i === logLines.length - 1 ? c.GREEN : c.FAINT,
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

// ── ⑫ ShieldMemoPanel ────────────────────────────────
const SHIELD_MEMO_KEY = 'poical-shield-memo'

function ShieldMemoPanel({ user: _user, theme, isMobile }: { user: User | null; theme: 'dark' | 'light'; isMobile: boolean }) {
  const c = cy(theme)
  const [text,  setText]  = useState(() => {
    try { return localStorage.getItem(SHIELD_MEMO_KEY) ?? '' } catch { return '' }
  })
  const [saved, setSaved] = useState(false)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = useCallback(() => {
    try { localStorage.setItem(SHIELD_MEMO_KEY, text) } catch {}
    setSaved(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSaved(false), 2000)
  }, [text])

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
      background: theme === 'dark' ? 'rgba(0,5,15,0.7)' : 'var(--glass-bg)' }}>
      {/* ヘッダー */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '10px 14px 9px', flexShrink: 0,
        borderBottom: `1px solid ${c.BORDER}`,
        background: c.HDBG,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          {/* ③ 鉛筆アイコン（エンジンと統一） */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span style={{ fontFamily: c.FONT, fontSize: 11, fontWeight: 700, color: c.GREEN, letterSpacing: '0.08em' }}>
            ポジション分析レポート
          </span>
        </div>
        <button
          onClick={handleSave}
          style={{
            padding: '4px 14px', borderRadius: 6,
            fontFamily: c.FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            background: saved ? `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.18)` : `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.08)`,
            border: `1px solid ${saved ? c.GREEN : c.BORDBR}`,
            color: c.GREEN, cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
            boxShadow: saved ? `0 0 10px ${c.FAINT}` : 'none',
            flexShrink: 0,
          }}
        >
          {saved ? '保存しました' : '保存'}
        </button>
      </div>

      {/* テキストエリア */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden', padding: '14px 16px' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="▌ ポジション分析レポートを記録..."
          style={{
            flex: 1, width: '100%', resize: 'none', borderRadius: 8,
            minHeight: isMobile ? 'max(320px, calc(100dvh - 116px))' : 280,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.7,
            fontFamily: c.FONT,
            background: c.TAREA,
            border: `1px solid ${c.BORDER}`,
            color: c.TXTCLR, outline: 'none',
          }}
        />
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
      : { width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
          padding: '10px 14px 9px', flexShrink: 0,
          borderBottom: `1px solid ${c.BORDER}`,
          background: c.HDBG,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontFamily: c.FONT, fontSize: 12, fontWeight: 700, color: c.GREEN, letterSpacing: '0.08em' }}>
              ぽいロボ シールド
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.GREEN, boxShadow: `0 0 6px ${c.GREEN}` }} />
            <span style={{ fontFamily: c.FONT, fontSize: 9, color: c.DIM, letterSpacing: '0.12em' }}>ONLINE</span>
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
              fontSize: 13, lineHeight: 1.75,
              color: c.DIM,
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
                  <span style={{ fontFamily: c.FONT, fontSize: 9, letterSpacing: '0.07em', lineHeight: 1 }}>
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
                    fontSize: 10, color: c.DIM, letterSpacing: '0.04em', lineHeight: 1.6, whiteSpace: 'nowrap',
                  }}>
                    {isBuilding ? <>データ取得中…<br />しばらくお待ちください</> : copyStatus === 'shield' ? '▶ コピー完了' : <>ポジション分析用<br />プロンプト＋市場データ</>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI起動 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontFamily: c.FONT, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: c.DIM }}>
              ▌ AI起動
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 28 }}>
              {SHIELD_AI_LINKS.map(ai => (
                <div key={ai.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <a
                    href={ai.url} target="_blank" rel="noopener noreferrer"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(ai.url, '_blank', 'noopener,noreferrer') }}
                    style={{
                      width: 70, height: 70, borderRadius: '50%',
                      background: `rgba(${theme === 'dark' ? '0,229,255' : '3,105,161'},0.06)`,
                      border: `2px solid ${c.BORDER}`,
                      boxShadow: `0 0 16px ${c.FAINT}, inset 0 0 10px ${c.FAINT}`,
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
                    <span style={{ fontFamily: c.FONT, fontSize: 12, color: c.GREEN, letterSpacing: '0.04em', fontWeight: 700 }}>{ai.name}</span>
                    <span style={{ fontFamily: c.FONT, fontSize: 10, color: c.FAINT, letterSpacing: '0.02em' }}>{ai.hint}</span>
                  </div>
                </div>
              ))}
            </div>

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
              <span style={{ fontFamily: c.FONT, fontSize: 11, color: c.NOTICE, letterSpacing: '0.04em', lineHeight: 1.7 }}>
                AI起動後、保有ポジション画面のキャプチャを必ず添付すること<br />
                <span style={{ color: c.DIM, fontSize: 10 }}>（未添付の場合、AIがエラーを出力します）</span>
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

// ── メインコンポーネント ──────────────────────────────
export function ShieldView({ theme, isMobile, user }: Props) {
  const tv = themeVars(theme)

  const [copyStatus,  setCopyStatus]  = useState<'' | 'shield'>('')
  const [isBuilding,  setIsBuilding]  = useState(false)

  const handlePromptCopy = useCallback(async () => {
    if (isBuilding) return
    setIsBuilding(true)
    try {
      // 市場データを取得してプロンプトに付加（エンジンと同じパターン）
      const mktData = await buildShieldData()
      const fullText = SHIELD_PROMPT_TEMPLATE
        + '\n---\n# 市場データ（自動取得）\n```json\n'
        + JSON.stringify(mktData, null, 2)
        + '\n```\n'
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

  // ② SYSTEM LOG state（親で管理してモバイル時に下部へ移動）
  const logState = useSystemLog(SHIELD_STATUS_LINES)

  return (
    <div style={{ ...s.wrap, ...tv }}>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflowY: isMobile ? 'auto' : 'hidden',
        paddingBottom: isMobile ? 130 : 0,
      }}>
        <ShieldPanel
          isMobile={isMobile}
          theme={theme}
          copyStatus={copyStatus}
          isBuilding={isBuilding}
          onPromptCopy={handlePromptCopy}
          logState={logState}
        />
        <div style={isMobile ? s.dividerH : s.divider} />
        <div style={isMobile ? { flexShrink: 0, display: 'flex', flexDirection: 'column' } : s.panel}>
          <ShieldMemoPanel user={user} theme={theme} isMobile={isMobile} />
        </div>

        {/* ② スマホ: ポジション分析レポートより下に SYSTEM LOG */}
        {isMobile && (
          <CyberSystemLog {...logState} theme={theme} />
        )}
      </div>
    </div>
  )
}

// ── AI リンク定義 ─────────────────────────────────────
const SHIELD_AI_LINKS = [
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
    // ⑤ URL変更 + hint変更
    name: 'Claude', url: 'https://claude.ai/new', hint: '新規チャット推奨',
    bg: '#d97757',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.2 14.7 8 16 L7 21 L12 18.5 L17 21 L16 16 C17.8 14.7 19 12.5 19 10 C19 6 16 3 12 3Z" fill="white" opacity="0.95"/>
      </svg>
    ),
  },
  {
    // ④ o3以上推奨
    name: 'ChatGPT', url: 'https://chatgpt.com/', hint: 'o3以上推奨',
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
