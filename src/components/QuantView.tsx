import { useState, useEffect, useCallback, useRef } from 'react'
import { themeVars } from '../utils/themeVars'
import { fetchInvestorData, type InvestorWeekData } from '../utils/jpxInvestorData'
import { fetchMarginData, type MarginWeekData } from '../utils/jpxMarginData'
import { fetchVixData, type VixWeekData } from '../utils/vixData'
import { fetchNhkNews, type NhkNewsItem } from '../utils/nhkNews'
import { getMacroEventsForDate, MACRO_META } from '../utils/macroCalendar'
import { getSqDates, getSqMarkersForDate, SQ_META } from '../utils/sqCalendar'
import { VixPanel } from './VixPanel'

// ── ヒートマップ マーケット定義 ───────────────────
// ── TradingView ヒートマップ（S&P500固定） ──────────
function TradingViewHeatmap({ theme }: { theme: 'dark' | 'light' }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.cssText = 'height:100%;width:100%'
    el.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js'
    script.async = true
    script.text = JSON.stringify({
      exchanges: [],
      dataSource: 'SPX500',
      grouping: 'sector',
      blockSize: 'market_cap_basic',
      blockColor: 'change',
      locale: 'ja',
      colorTheme: theme,
      hasTopBar: false,
      isDataSetEnabled: false,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: '100%',
      height: '100%',
    })
    el.appendChild(script)

    return () => { el.innerHTML = '' }
  }, [theme])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}
    />
  )
}

type Props = { theme: 'dark' | 'light'; isMobile: boolean }

// ── 投資主体別 列定義 ──────────────────────────────
const INVESTOR_COLS: { key: keyof InvestorWeekData; label: string; sub: string }[] = [
  { key: 'foreigner',  label: '外国人',   sub: '海外勢' },
  { key: 'individual', label: '個人',     sub: '国内個人' },
  { key: 'trustBank',  label: '信託銀行', sub: '年金等' },
  { key: 'securities', label: '証券自己',   sub: '自己売買' },
]

// ── フォーマット ───────────────────────────────────
function fmtOku(val: number): string {
  const rounded = Math.round(val)
  if (rounded === 0) return '0'
  const sign = val > 0 ? '+' : '−'
  return `${sign}${Math.abs(rounded).toLocaleString()}`
}

function fmtHyakuman(val: number): string {
  if (val === 0) return '—'
  return Math.round(Math.abs(val)).toLocaleString()
}

function fmtRatio(val: number): string {
  if (val === 0) return '—'
  return val.toFixed(2)
}

function valueBg(val: number, theme: 'dark' | 'light'): string {
  if (Math.round(val) === 0) return 'transparent'
  if (val > 0) return theme === 'dark' ? 'rgba(96,200,140,0.18)' : 'rgba(22,130,80,0.12)'
  return theme === 'dark' ? 'rgba(255,120,100,0.18)' : 'rgba(200,50,30,0.12)'
}

function valueTextColor(val: number, theme: 'dark' | 'light'): string {
  if (Math.round(val) === 0) return 'var(--text-dim)'
  if (val > 0) return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
  return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
}

// 信用倍率：高倍率=赤（買い過熱・危険）/ 低倍率=緑（売り過熱・底値圏）
function ratioBg(val: number, theme: 'dark' | 'light'): string {
  if (val === 0) return 'transparent'
  if (val >= 6)   return theme === 'dark' ? 'rgba(255,120,100,0.22)' : 'rgba(200,50,30,0.15)'
  if (val >= 4)   return theme === 'dark' ? 'rgba(255,120,100,0.11)' : 'rgba(200,50,30,0.08)'
  if (val <= 1.5) return theme === 'dark' ? 'rgba(96,200,140,0.22)'  : 'rgba(22,130,80,0.15)'
  if (val <= 2.5) return theme === 'dark' ? 'rgba(96,200,140,0.11)'  : 'rgba(22,130,80,0.08)'
  return 'transparent'
}

function ratioTextColor(val: number, theme: 'dark' | 'light'): string {
  if (val === 0) return 'var(--text-dim)'
  if (val >= 6)   return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val >= 4)   return theme === 'dark' ? 'rgba(255,120,100,0.80)' : 'rgba(200,50,30,0.80)'
  if (val <= 1.5) return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val <= 2.5) return theme === 'dark' ? 'rgba(96,200,140,0.80)'  : 'rgba(22,130,80,0.80)'
  return 'var(--text)'
}

// 信用評価損益率の色：損失が大きいほど赤 / 小さいほど緑
function evalRatioColor(val: number, theme: 'dark' | 'light'): string {
  if (val > -3)  return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val < -15) return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val < -10) return theme === 'dark' ? 'rgba(255,160,120,0.85)' : 'rgba(200,80,50,0.85)'
  return 'var(--text)'
}
function evalRatioBg(val: number, theme: 'dark' | 'light'): string {
  if (val > -3)  return theme === 'dark' ? 'rgba(96,200,140,0.20)'  : 'rgba(22,130,80,0.13)'
  if (val < -15) return theme === 'dark' ? 'rgba(255,120,100,0.20)' : 'rgba(200,50,30,0.13)'
  if (val < -10) return theme === 'dark' ? 'rgba(255,120,100,0.10)' : 'rgba(200,50,30,0.07)'
  return 'transparent'
}

// 買い残/売り残：四分位数ベースの背景色
// inverse=true → 多いほど赤（売り残用）
function quartiles(vals: number[]): [number, number] {
  const sorted = [...vals].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length < 4) return [0, Infinity]
  return [sorted[Math.floor(sorted.length * 0.25)], sorted[Math.floor(sorted.length * 0.75)]]
}
function balBg(val: number, q1: number, q3: number, inverse: boolean, theme: 'dark' | 'light'): string {
  const greenBg = theme === 'dark' ? 'rgba(96,200,140,0.18)' : 'rgba(22,130,80,0.12)'
  const redBg   = theme === 'dark' ? 'rgba(255,120,100,0.18)' : 'rgba(200,50,30,0.12)'
  if (val >= q3) return inverse ? redBg : greenBg
  if (val <= q1) return inverse ? greenBg : redBg
  return 'transparent'
}
function balTextColor(val: number, q1: number, q3: number, inverse: boolean, theme: 'dark' | 'light'): string {
  const greenTxt = theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
  const redTxt   = theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val >= q3) return inverse ? redTxt : greenTxt
  if (val <= q1) return inverse ? greenTxt : redTxt
  return 'var(--text)'
}


// ── エクスポート用データ構築 ──────────────────────
function toDate(s: string) { return s.replace(/\//g, '-') }
const r2 = (n: number) => Math.round(n * 100) / 100

/** 今日から指定日数分の市場イベントを収集 */
function getUpcomingEvents(days = 28): { date: string; day: string; events: string[] }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
  const sqDates = [
    ...getSqDates(today.getFullYear()),
    ...getSqDates(today.getFullYear() + 1),
  ]
  const result: { date: string; day: string; events: string[] }[] = []
  for (let i = 0; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const events: string[] = []
    for (const e of getMacroEventsForDate(d, { us: true, jp: true })) {
      events.push(MACRO_META[e.type].label)
    }
    for (const sq of getSqMarkersForDate(d, sqDates)) {
      events.push(SQ_META[sq].label)
    }
    if (events.length > 0) {
      result.push({
        date: d.toISOString().slice(0, 10),
        day:  DAYS_JA[d.getDay()],
        events,
      })
    }
  }
  return result
}

const EXPORT_WEEKS = 12 // AI に渡す週数（直近N週）

function buildExportJson(
  invData: InvestorWeekData[],
  marData: MarginWeekData[],
  vixData: VixWeekData[],
  newsData: NhkNewsItem[],
) {
  const invMap = new Map(invData.map(d => [toDate(d.date), d]))
  const marMap = new Map(marData.map(d => [toDate(d.date), d]))
  const vixMap = new Map(vixData.map(d => [toDate(d.date), d]))

  const allDates = new Set([...invMap.keys(), ...marMap.keys(), ...vixMap.keys()])

  const rows = Array.from(allDates)
    .sort((a, b) => b.localeCompare(a)) // 新しい順
    .slice(0, EXPORT_WEEKS)
    .map(date => {
      const inv = invMap.get(date)
      const mar = marMap.get(date)
      const vix = vixMap.get(date)
      return {
        date,
        vix: {
          value:  vix?.close  ?? 0,
          change: vix?.change ?? 0,
        },
        flows: {
          foreign:     r2(inv?.foreigner  ?? 0),
          institution: r2((inv?.trustBank ?? 0) + (inv?.securities ?? 0)),
          retail:      r2(inv?.individual ?? 0),
        },
        credit_ratio: mar?.ratio ?? 0,
      }
    })
    .filter(r =>
      r.vix.value !== 0 || r.flows.foreign !== 0 || r.credit_ratio !== 0
    )

  return {
    meta: { market: 'JP', index: 'Nikkei225', type: 'swing' },
    upcoming_events: getUpcomingEvents(28),
    recent_news: newsData.map(n => ({
      title: n.title,
      pubDate: n.pubDate,
      description: n.description,
    })),
    data: rows,
  }
}

// ── AI 分析プロンプトテンプレート ─────────────────
const AI_PROMPT_TEMPLATE = `【役割定義】
あなたは、機関投資家向けのレポートを作成するシニア・クオンツ・ストラテジストです。
市場の表面的な値動きや情緒的なニュースに左右されず、最新の「需給データ（投資部門別売買動向、信用残、VIXの変化率）」を基に、市場の構造的な脆さや強さを論理的に分析・予測してください。

【分析アルゴリズム（優先順位）】
需給構造の歪み（最優先）:
海外投資家を「トレンドセッター（主導役）」、個人投資家を「逆指標（反対売買の燃料）」として定義。
信用買い残の多さを「将来の売り圧力」の質量として計算し、需給の臨界点を測定する。

ボラティリティの質的変化:
VIX指数の「水準」ではなく「変化（上昇・下降のモメンタム）」を重視し、潜在的なリスクまたは安心感を数値化する。

テクニカルと需給の乖離検証:
移動平均線やMACDなどのテクニカル指標が良好であっても、需給データ（買い残過多など）が物理的に持続不可能であれば、「一時的な騙し」と判定する。

イベント・流動性リスク:
近日中に予定されている重要イベント（upcoming_events）による流動性の枯渇や、反対売買の集中リスクを考慮する。

【入力データ】
市場データ（JSON）: 以下に添付（需給データ・直近ニュース含む）

市場の特筆事項: （必要に応じて追記してください）
※ 注記: 添付JSONの「recent_news」はNHKニュース直近5件です。ファンダメンタルズ要因として需給分析の補完材料に使用してください。需給データの論理を優先した上で、ニュースが需給の変化を後押し・または否定する場合はその影響を言及してください。

【出力形式（厳守）】
市場展望（結論）:（強気 / 弱気 / 警戒）

確信度:（0〜100%）

需給分析の詳細: 買い残の滞留状況と、そこから推測される強制決済（投げ売り）の発生価格帯について。

予測タイムライン: 今後の寄り付きから数日間の、需給バランスに基づいた値動き予測。

リスクシナリオ: この予測を覆す可能性のある、唯一のデータ的な変化（例：海外勢の買い越し継続など）。

【市場データ（JSON）】
`

// ── ポジション管理プロンプト ──────────────────────
const POSITION_PROMPT = `## 🛡️ SDS-7.7 専用：リスク管理＆ディシプリン・エンジン

### 【役割定義】
あなたは、ヘッジファンドのバックオフィスでリスク管理を担当する「リスク・コントローラー」です。
トレーダー（ユーザー）が感情に流されて「損切を遅らせる」「過剰なポジションを取る」「イベント前にギャンブル的な持ち越しをする」といった規律違反を犯さないよう、提供されたデータを基に「執行すべき具体的な注文指示」のみを提示してください。

### 【入力データの処理】
1. 松井証券のスクリーンショット分析:
   - 画像から「評価損益」「余力（買付余力）」「保有銘柄」「平均取得単価」を抽出してください。
2. SDS-7.7（Pine Script）ロジックの適用:
   - ユーザーから提示される「本体損切ライン」「ETF損切ライン」を絶対的な防衛線として定義します。
3. Gemini（クオンツ分析）の相場観の考慮:
   - Geminiが「警戒」と判定している場合、新規ポジションのサイズを通常時の50%に制限してください。

### 【思考プロセス（アルゴリズム）】
1. 生存優先（Stop-Loss Check）:
   保有銘柄の現在値が、SDS-7.7で算出された「損切ライン」に到達、または下回っている場合、言い訳を許さず「直ちに全決済（成り行き）」を命じてください。
2. 資金管理（Position Sizing）:
   1トレードあたりの許容損失額（リスク許容度）を総資産の2%以内に収めるための、最適な発注数量（枚数）を計算してください。
3. レバレッジ・リスク管理:
   日経平均ブル・ベア2倍銘柄（1579/1360等）はボラティリティによる減価リスクがあるため、保有期間が5営業日を超えた場合は「時間による強制決済」を検討し、警告を出してください。

### 【出力形式（厳守）】
以下の「執行命令書」のフォーマットのみを出力してください。情緒的な励まし、投資の一般論、ユーザーへの過度な配慮は不要です。

---
#### ⚔️ SDS-7.7 執行命令書
**【1. 現在の資産状況】**
* 総資産: 〇〇円 / 買付余力: 〇〇円
* 保有ポジション: [銘柄名] [数量] (平均取得価額: 〇〇円 / 評価損益: 〇〇円)

**【2. 規律チェック】**
* 設定損切ライン: [〇〇円]
* 現在値との乖離: あと [〇〇円 / 〇％]
* 判定: [継続保持 / 警戒（指値変更） / 直ちに決済]

**【3. 次の執行アクション】**
* **新規発注命令**: [銘柄] を [価格] で [数量] 株発注せよ。
* **逆指値（損切）更新**: [銘柄] の逆指値注文を [〇〇円] に再設定せよ。

**【4. リスク警告】**
* 重要イベント（米雇用統計・日銀会合等）までの残り時間と、ポジション圧縮の必要性について。
---

### 【禁止事項】
* 「様子を見ましょう」という曖昧な助言。
* 損切ラインを価格が割り込んでいるにもかかわらず、保持を許可すること。
* テクニカル指標の好転を理由にした、損切ラインの独断的な引き下げ。`

// ── クリップボードコピー ──────────────────────────
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = Object.assign(document.createElement('textarea'), {
        value: text, style: 'position:fixed;opacity:0',
      })
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch { return false }
  }
}

// ── 設定モーダル ──────────────────────────────────
function QuantSettingsModal({
  isOpen, onClose,
  onPromptCopy, onPositionCopy,
  copyStatus,
}: {
  isOpen: boolean
  onClose: () => void
  onPromptCopy: () => void
  onPositionCopy: () => void
  copyStatus: '' | 'json' | 'prompt' | 'position'
}) {
  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 399,
        background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.18s',
      }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 400,
        transform: isOpen ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.96)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.18s, transform 0.18s cubic-bezier(0.4,0,0.2,1)',
        width: 'min(440px, calc(100vw - 32px))',
        background: 'var(--modal-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
        borderRadius: 18, border: '1px solid var(--glass-border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.40)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div style={ms.header}>
          <div style={ms.headerTitle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            需給 設定
          </div>
          <button style={ms.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ボディ */}
        <div style={ms.body}>

          {/* AI 分析プロンプト */}
          <div style={ms.section}>
            <div style={ms.sectionTitle}>AI 分析用プロンプト</div>
            <p style={ms.desc}>
              スイングトレード向けの分析プロンプト＋データをまとめてコピーします。
              Google Gemini にそのまま貼り付けて使用できます。
            </p>
            <div style={ms.promptPreview}>
              <span style={{ color: 'var(--text-sub)' }}>あなたはプロのクオンツアナリストです。</span>
              <br />
              <span style={{ color: 'var(--text-dim)' }}>直近データ重視 / 海外投資家最重視 / VIX変化重視…</span>
            </div>
            <button style={{ ...ms.actionBtn, ...ms.actionBtnAccent }} onClick={onPromptCopy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {copyStatus === 'prompt' ? 'コピーしました！' : 'プロンプト＋データをコピー'}
            </button>
          </div>

          <div style={ms.divider} />

          {/* ポジション管理プロンプト */}
          <div style={ms.section}>
            <div style={ms.sectionTitle}>ポジション管理用プロンプト</div>
            <p style={ms.desc}>
              SDS-7.7 専用のリスク管理＆ディシプリン・エンジン。
              松井証券のスクリーンショットと一緒に Gemini に貼り付けて使用します。
            </p>
            <div style={ms.promptPreview}>
              <span style={{ color: 'var(--text-sub)' }}>🛡️ SDS-7.7 専用：リスク管理＆ディシプリン・エンジン</span>
              <br />
              <span style={{ color: 'var(--text-dim)' }}>損切チェック / 資金管理 / レバレッジ警告 / 執行命令書…</span>
            </div>
            <button style={{ ...ms.actionBtn }} onClick={onPositionCopy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {copyStatus === 'position' ? 'コピーしました！' : 'ポジション管理プロンプトをコピー'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

const ms: Record<string, React.CSSProperties> = {
  header:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-dim)' },
  headerTitle:     { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  closeBtn:        { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-sub)', cursor: 'pointer' },
  body:            { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 },
  section:         { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-dim)' },
  desc:            { fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 },
  promptPreview:   { fontSize: 11, lineHeight: 1.7, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)' },
  actionBtn:       {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    color: 'var(--text)', background: 'var(--bg-medium)',
    border: '1px solid var(--glass-border)', cursor: 'pointer',
    transition: 'background 0.15s',
  },
  actionBtnAccent: {
    background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff',
  },
  divider:         { height: 1, background: 'var(--border-dim)' },
}

// ── パネル共通コンポーネント ───────────────────────
function PanelHeader({
  icon, title, sub, dateRange, loading, onReload,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  dateRange?: string
  loading: boolean
  onReload: () => void
}) {
  return (
    <div style={s.panelHead}>
      <div style={s.panelTitle}>
        {icon}
        {title}
        <span style={s.panelSub}>{sub}</span>
      </div>
      <div style={s.panelRight}>
        {dateRange && <span style={s.dataRange}>{dateRange}</span>}
        <button style={s.reloadBtn} onClick={onReload} disabled={loading} title="再取得">
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            style={{ transform: loading ? 'rotate(360deg)' : undefined, transition: loading ? 'transform 1s linear infinite' : undefined }}
          >
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {loading ? '取得中…' : '更新'}
        </button>
      </div>
    </div>
  )
}

function PanelCenter({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
      <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
    </div>
  )
  if (error) return (
    <div style={s.center}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,80,0.7)" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ color: 'var(--text-sub)', fontSize: 12, maxWidth: 280, textAlign: 'center' }}>{error}</span>
      <button style={s.retryBtn} onClick={onRetry}>再試行</button>
    </div>
  )
  return null
}

// ── メインコンポーネント ───────────────────────────
export function QuantView({ theme, isMobile }: Props) {
  // 投資主体別
  const [invData, setInvData]       = useState<InvestorWeekData[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [invError, setInvError]     = useState('')
  const [invLoaded, setInvLoaded]   = useState(false)

  // 信用倍率
  const [marData, setMarData]       = useState<MarginWeekData[]>([])
  const [marLoading, setMarLoading] = useState(false)
  const [marError, setMarError]     = useState('')
  const [marLoaded, setMarLoaded]   = useState(false)

  // VIX 週次（エクスポート用）
  const [vixWeekData, setVixWeekData] = useState<VixWeekData[]>([])
  const [vixWeekLoaded, setVixWeekLoaded] = useState(false)

  // NHK ニュース（エクスポート用）
  const [nhkNews, setNhkNews] = useState<NhkNewsItem[]>([])

  // 設定モーダル
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copyStatus,   setCopyStatus]   = useState<'' | 'json' | 'prompt' | 'position'>('')

  const loadInvestor = useCallback(async () => {
    setInvLoading(true); setInvError('')
    try {
      setInvData(await fetchInvestorData())
      setInvLoaded(true)
    } catch (e) {
      setInvError(e instanceof Error ? e.message : 'データ取得エラー')
    } finally { setInvLoading(false) }
  }, [])

  const loadMargin = useCallback(async () => {
    setMarLoading(true); setMarError('')
    try {
      setMarData(await fetchMarginData())
      setMarLoaded(true)
    } catch (e) {
      setMarError(e instanceof Error ? e.message : 'データ取得エラー')
    } finally { setMarLoading(false) }
  }, [])

  const loadVixWeek = useCallback(async () => {
    try {
      setVixWeekData(await fetchVixData())
      setVixWeekLoaded(true)
    } catch { /* silent: エクスポートにのみ使用 */ }
  }, [])

  useEffect(() => { if (!invLoaded)     loadInvestor() }, [invLoaded,     loadInvestor])
  useEffect(() => { if (!marLoaded)     loadMargin()   }, [marLoaded,     loadMargin])
  useEffect(() => { if (!vixWeekLoaded) loadVixWeek()  }, [vixWeekLoaded, loadVixWeek])

  // NHK ニュース取得（マウント時・エラーは無視）
  useEffect(() => {
    fetchNhkNews().then(setNhkNews).catch(() => {})
  }, [])

  // ── エクスポート ──────────────────────────────────
  const handlePromptCopy = useCallback(async () => {
    const json = JSON.stringify(buildExportJson(invData, marData, vixWeekData, nhkNews), null, 2)
    await copyText(AI_PROMPT_TEMPLATE + json)
    setCopyStatus('prompt')
    setTimeout(() => setCopyStatus(''), 2000)
  }, [invData, marData, vixWeekData, nhkNews])

  const handlePositionCopy = useCallback(async () => {
    await copyText(POSITION_PROMPT)
    setCopyStatus('position')
    setTimeout(() => setCopyStatus(''), 2000)
  }, [])

  const tv = themeVars(theme)

  return (
    <div style={{ ...s.wrap, ...tv }}>
      {/* ── 上部タイトルバー ── */}
      <div style={s.topBar} className="glass">
        <div style={s.topTitle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          需給
          <span style={s.topSub}>東証プライム（週次）</span>
        </div>
        <button style={s.gearBtn} onClick={() => setSettingsOpen(true)} aria-label="設定">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* ── ボディ ── */}
      <div style={{ ...s.body, flexDirection: isMobile ? 'column' : 'row', overflowY: isMobile ? 'auto' : 'hidden' }}>

        {/* ── 左パネル：VIX + ヒートマップ ── */}
        <div style={isMobile ? s.panelMobile : s.panel}>

          {/* VIX */}
          <div style={{ flex: isMobile ? 'none' : '0 0 240px', height: isMobile ? 260 : undefined, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid var(--border-dim)' }}>
            <div style={s.panelHead}>
              <div style={s.panelTitle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                VIX
                <span style={s.panelSub}>恐怖指数（CBOE・日足・約15分遅延）</span>
              </div>
            </div>
            <VixPanel theme={theme} />
          </div>

          {/* TradingView ヒートマップ */}
          <div style={{ flex: isMobile ? 'none' : 1, height: isMobile ? 300 : undefined, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={s.panelHead}>
              <div style={s.panelTitle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
                ヒートマップ
                <span style={s.panelSub}>S&amp;P500・セクター別（TradingView）</span>
              </div>
            </div>
            <TradingViewHeatmap theme={theme} />
          </div>

        </div>

        {/* ── 仕切り ── */}
        <div style={isMobile ? s.dividerH : s.divider} />

        {/* ── 中パネル：信用倍率 ── */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <PanelHeader
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            }
            title="信用倍率"
            sub="2市場計（週次）"
            dateRange={
              marData.length > 0
                ? `${marData[marData.length - 1]?.date} 〜 ${marData[0]?.date}`
                : undefined
            }
            loading={marLoading}
            onReload={loadMargin}
          />
          <div style={{ ...s.tableWrap, ...(isMobile ? { overflowY: 'visible', flex: 'none' } : {}) }}>
            {(marLoading && marData.length === 0) || marError
              ? <PanelCenter loading={marLoading && marData.length === 0} error={marError} onRetry={loadMargin} />
              : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, ...s.thDate }}>週</th>
                      <th style={s.th}>
                        <div style={s.thLabel}>買い残</div>
                        <div style={s.thSub}>百万円</div>
                      </th>
                      <th style={s.th}>
                        <div style={s.thLabel}>売り残</div>
                        <div style={s.thSub}>百万円</div>
                      </th>

                      <th style={s.th}>
                        <div style={s.thLabel}>信用倍率</div>
                        <div style={s.thSub}>買残÷売残</div>
                      </th>
                      <th style={s.th}>
                        <div style={s.thLabel}>評価損益率</div>
                        <div style={s.thSub}>%</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const [longQ1, longQ3]   = quartiles(marData.map(r => r.longBal))
                      const [shortQ1, shortQ3] = quartiles(marData.map(r => r.shortBal))
                      return marData.map((row, i) => (
                        <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                          <td style={{ ...s.td, ...s.tdDate }}>
                            <div style={s.dateMain}>{row.label}</div>
                            <div style={s.dateSub}>{row.date}</div>
                          </td>
                          <td style={{ ...s.td, ...s.tdNum, background: balBg(row.longBal, longQ1, longQ3, true, theme) }}>
                            <span style={{ color: balTextColor(row.longBal, longQ1, longQ3, true, theme), fontWeight: 500 }}>
                              {fmtHyakuman(row.longBal)}
                            </span>
                          </td>
                          <td style={{ ...s.td, ...s.tdNum, background: balBg(row.shortBal, shortQ1, shortQ3, false, theme) }}>
                            <span style={{ color: balTextColor(row.shortBal, shortQ1, shortQ3, false, theme), fontWeight: 500 }}>
                              {fmtHyakuman(row.shortBal)}
                            </span>
                          </td>
                          <td style={{ ...s.td, ...s.tdNum, background: ratioBg(row.ratio, theme) }}>
                            <span style={{ color: ratioTextColor(row.ratio, theme), fontWeight: 700, fontSize: 14 }}>
                              {fmtRatio(row.ratio)}
                            </span>
                            <span style={s.unit}>倍</span>
                          </td>
                          <td style={{ ...s.td, ...s.tdNum, background: row.evalRatio != null ? evalRatioBg(row.evalRatio, theme) : 'transparent' }}>
                            {row.evalRatio != null ? (
                              <span style={{ color: evalRatioColor(row.evalRatio, theme), fontWeight: 700, fontSize: 14 }}>
                                {row.evalRatio > 0 ? '+' : ''}{row.evalRatio.toFixed(2)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              )
            }
          </div>
        </div>

        {/* ── 仕切り ── */}
        <div style={isMobile ? s.dividerH : s.divider} />

        {/* ── 右パネル：投資主体別売買動向 ── */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <PanelHeader
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="17" cy="8" r="3"/><circle cx="7" cy="16" r="3"/>
                <path d="M14 8H7M17 11v5"/>
              </svg>
            }
            title="投資主体別売買動向"
            sub="差引金額（百万円）"
            dateRange={
              invData.length > 0
                ? `${invData[invData.length - 1]?.date} 〜 ${invData[0]?.date}`
                : undefined
            }
            loading={invLoading}
            onReload={loadInvestor}
          />
          <div style={{ ...s.tableWrap, ...(isMobile ? { overflowY: 'visible', flex: 'none' } : {}) }}>
            {(invLoading && invData.length === 0) || invError
              ? <PanelCenter loading={invLoading && invData.length === 0} error={invError} onRetry={loadInvestor} />
              : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, ...s.thDate }}>週</th>
                      {INVESTOR_COLS.map(col => (
                        <th key={col.key} style={s.th}>
                          <div style={s.thLabel}>{col.label}</div>
                          <div style={s.thSub}>{col.sub}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invData.map((row, i) => (
                      <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                        <td style={{ ...s.td, ...s.tdDate }}>
                          <div style={s.dateMain}>{row.label}</div>
                          <div style={s.dateSub}>{row.date}</div>
                        </td>
                        {INVESTOR_COLS.map(col => {
                          const val = row[col.key] as number
                          return (
                            <td key={col.key} style={{ ...s.td, ...s.tdNum, background: valueBg(val, theme) }}>
                              <span style={{ color: valueTextColor(val, theme), fontWeight: val !== 0 ? 600 : 400 }}>
                                {fmtOku(val)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </div>

      </div>

      <QuantSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPromptCopy={handlePromptCopy}
        onPositionCopy={handlePositionCopy}
        copyStatus={copyStatus}
      />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  topBar:    {
    display: 'flex', alignItems: 'center',
    padding: '6px 12px', minHeight: 50, flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  topTitle:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 },
  topSub:    { fontSize: 11, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 4 },
  gearBtn:   { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: 'var(--text-sub)', cursor: 'pointer', flexShrink: 0 },
  body:      { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },

  // パネル
  panel:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  panelMobile: { flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'visible' },
  divider:     { width: 1, background: 'var(--border-dim)', flexShrink: 0 },
  dividerH:    { height: 1, background: 'var(--border-dim)', flexShrink: 0 },
  panelHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px', flexShrink: 0, gap: 8,
    borderBottom: '1px solid var(--border-dim)',
    userSelect: 'none',
  },
  panelTitle:{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' },
  panelSub:  { fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2 },
  panelRight:{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  dataRange: { fontSize: 10, color: 'var(--text-dim)' },
  reloadBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
    color: 'var(--text-sub)', background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)', cursor: 'pointer',
  },

  // 中央ローディング・エラー
  center:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:  {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid var(--glass-border)',
    borderTopColor: 'var(--accent)',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: 'var(--accent-glass)', border: '1px solid var(--accent)',
    color: '#fff', cursor: 'pointer',
  },

  // テーブル
  tableWrap: { flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 0 16px' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 300 },
  th:        {
    position: 'sticky', top: 0, zIndex: 2,
    padding: '9px 14px', textAlign: 'right',
    background: 'var(--modal-bg)', backdropFilter: 'blur(16px)',
    borderBottom: '2px solid var(--border-dim)',
    fontSize: 11, fontWeight: 700, color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  thDate:    { textAlign: 'left', minWidth: 90 },
  thLabel:   { fontSize: 11, fontWeight: 700 },
  thSub:     { fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', marginTop: 1 },
  tr:        { transition: 'background 0.1s' },
  td:        { padding: '8px 14px', borderBottom: '1px solid var(--border-dim)', fontSize: 12 },
  tdDate:    { minWidth: 90 },
  tdNum:     { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  dateMain:  { fontSize: 11, fontWeight: 600, color: 'var(--text)' },
  dateSub:   { fontSize: 10, color: 'var(--text-dim)', marginTop: 2 },
  unit:      { fontSize: 10, color: 'var(--text-dim)', marginLeft: 3 },
}
