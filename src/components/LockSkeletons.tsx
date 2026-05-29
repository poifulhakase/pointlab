/**
 * ロック画面の背景に表示する各ビューのスケルトン（静的版）
 * 処理を持たない見た目だけのモック。ぼかしで使うため細部は再現しない。
 */

const CY_ACCENT = 'rgba(0,229,255,0.9)'
const CY_DIM    = 'rgba(0,229,255,0.5)'
const CY_FAINT  = 'rgba(0,229,255,0.22)'
const CY_PANEL  = 'rgba(0,229,255,0.05)'
const CY_BORDER = 'rgba(0,229,255,0.18)'
const RED       = 'rgba(255,120,100,0.5)'
const GREEN     = 'rgba(96,200,140,0.5)'
const MONO      = "'Courier New', Courier, monospace" as const

// ── 共通パーツ ─────────────────────────────────────────

function Panel({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CY_PANEL, border: `1px solid ${CY_BORDER}`,
      borderRadius: 8, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 6,
      overflow: 'hidden', minHeight: 0,
      ...style,
    }}>{children}</div>
  )
}

function PanelHeader({ label, dim = false }: { label: string; dim?: boolean }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em',
      color: dim ? CY_DIM : CY_ACCENT, fontWeight: 700,
      borderBottom: `1px solid ${CY_BORDER}`, paddingBottom: 4,
    }}>{label}</div>
  )
}

function Bar({ pct, color = CY_ACCENT, height = 8 }: { pct: number; color?: string; height?: number }) {
  return (
    <div style={{
      height, background: 'rgba(0,229,255,0.07)', borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color }} />
    </div>
  )
}

function FakeRow({ cols = [40, 25, 20, 15], variant = 'cyan' }: { cols?: number[]; variant?: 'cyan' | 'mixed' }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 12 }}>
      {cols.map((w, i) => (
        <div key={i} style={{
          width: `${w}%`, height: 8, borderRadius: 2,
          background: variant === 'mixed'
            ? (i === cols.length - 1 ? (i % 2 ? RED : GREEN) : CY_FAINT)
            : (i === 0 ? CY_DIM : CY_FAINT),
        }} />
      ))}
    </div>
  )
}

function FakeChart({ down = false, height = 60 }: { down?: boolean; height?: number }) {
  // 適当なポイント列をSVGの曲線に
  const pts = [10, 35, 25, 50, 40, 65, 55, 70, 60, 80, 65, 75, 80, 85, 75, 90]
  const d = pts.map((y, i) => {
    const x = (i / (pts.length - 1)) * 100
    const fy = down ? 100 - y : y
    return `${i === 0 ? 'M' : 'L'}${x},${100 - fy}`
  }).join(' ')
  const color = down ? RED : GREEN
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" opacity="0.9" />
      <path d={d + ' L100,100 L0,100 Z'} fill={color} opacity="0.15" />
    </svg>
  )
}

// ── エンジン（QuantView）スケルトン ────────────────────

export function QuantSkeleton() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
      padding: 14, height: '100%', boxSizing: 'border-box',
    }}>
      {/* VIX */}
      <Panel>
        <PanelHeader label="VIX TERM" />
        <div style={{ fontFamily: MONO, fontSize: 11, color: CY_ACCENT, fontWeight: 700 }}>14.82 ▲ +0.42</div>
        <FakeChart down height={70} />
        <FakeRow cols={[30, 20, 20, 30]} variant="mixed" />
        <FakeRow cols={[30, 20, 20, 30]} variant="mixed" />
      </Panel>

      {/* NS倍率 */}
      <Panel>
        <PanelHeader label="N/SP RATIO" />
        <div style={{ fontFamily: MONO, fontSize: 11, color: CY_ACCENT, fontWeight: 700 }}>7.85 ▼ -0.03</div>
        <FakeChart height={70} />
        <FakeRow cols={[30, 20, 20, 30]} variant="mixed" />
        <FakeRow cols={[30, 20, 20, 30]} variant="mixed" />
      </Panel>

      {/* USD/JPY */}
      <Panel>
        <PanelHeader label="USD / JPY" />
        <div style={{ fontFamily: MONO, fontSize: 11, color: CY_ACCENT, fontWeight: 700 }}>159.37 ▲ +0.13</div>
        {[5, 4, 3, 2, 1, 0].map(i => (
          <FakeRow key={i} cols={[28, 20, 22, 30]} variant="mixed" />
        ))}
      </Panel>

      {/* 信用倍率 */}
      <Panel>
        <PanelHeader label="CREDIT RATIO" dim />
        {[6, 5, 4, 3, 2, 1, 0].map(i => (
          <FakeRow key={i} cols={[22, 18, 18, 18, 24]} variant="mixed" />
        ))}
      </Panel>

      {/* 投資主体別 */}
      <Panel>
        <PanelHeader label="INVESTOR FLOWS" dim />
        {[6, 5, 4, 3, 2, 1, 0].map(i => (
          <FakeRow key={i} cols={[22, 18, 18, 18, 24]} variant="mixed" />
        ))}
      </Panel>

      {/* PCR + 先物 */}
      <Panel>
        <PanelHeader label="FUTURES OI / PCR" dim />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Bar pct={70} color={CY_ACCENT} />
          <Bar pct={45} color={RED} />
          <Bar pct={60} color={CY_DIM} />
          <Bar pct={80} color={GREEN} />
        </div>
        <FakeChart height={50} />
        <FakeRow cols={[33, 33, 34]} variant="mixed" />
      </Panel>
    </div>
  )
}

// ── チャート（ChartView）スケルトン ────────────────────

export function ChartSkeleton() {
  return (
    <div style={{ padding: 14, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* タブバー風 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['NIKKEI 225', 'USD/JPY', 'TLT'].map((label, i) => (
          <div key={label} style={{
            padding: '5px 12px', borderRadius: 6,
            background: i === 0 ? 'rgba(0,229,255,0.15)' : CY_PANEL,
            border: `1px solid ${i === 0 ? CY_ACCENT : CY_BORDER}`,
            color: i === 0 ? CY_ACCENT : CY_DIM,
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
          }}>{label}</div>
        ))}
      </div>

      {/* メインチャート */}
      <Panel style={{ flex: 1, padding: 14 }}>
        {/* OHLC 風表示 */}
        <div style={{ display: 'flex', gap: 12, fontFamily: MONO, fontSize: 10, color: CY_DIM }}>
          <span>O 38420</span>
          <span>H 38580</span>
          <span>L 38310</span>
          <span style={{ color: CY_ACCENT, fontWeight: 700 }}>C 38510 ▲ +0.42%</span>
        </div>

        {/* チャート本体 */}
        <div style={{ flex: 1, position: 'relative', marginTop: 8 }}>
          {/* グリッド */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(to right, ${CY_FAINT} 1px, transparent 1px),
              linear-gradient(to bottom, ${CY_FAINT} 1px, transparent 1px)
            `,
            backgroundSize: '60px 40px',
            opacity: 0.25,
          }} />
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {/* ローソク足風 */}
            {[...Array(28)].map((_, i) => {
              const x = i * 22 + 8
              const center = 100 + Math.sin(i * 0.5) * 30 + (Math.random() - 0.5) * 10
              const open = center + (Math.random() - 0.5) * 18
              const close = center + (Math.random() - 0.5) * 18
              const high = Math.min(open, close) - 8 - Math.random() * 10
              const low = Math.max(open, close) + 8 + Math.random() * 10
              const isUp = close < open
              const col = isUp ? GREEN : RED
              return (
                <g key={i}>
                  <line x1={x} y1={high} x2={x} y2={low} stroke={col} strokeWidth="1.5" />
                  <rect x={x - 5} y={Math.min(open, close)} width={10} height={Math.abs(close - open) || 1} fill={col} stroke={col} />
                </g>
              )
            })}
            {/* MA曲線 */}
            <path
              d="M0,140 Q60,120 120,125 T240,110 T360,90 T480,70 T600,80"
              fill="none" stroke={CY_ACCENT} strokeWidth="1.5" opacity="0.8"
            />
          </svg>
        </div>
      </Panel>
    </div>
  )
}

// ── シールド（ShieldView）スケルトン ───────────────────

export function ShieldSkeleton() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '500px 1fr', gap: 14,
      padding: 14, height: '100%', boxSizing: 'border-box',
    }}>
      {/* 左：シールドパネル */}
      <Panel>
        <PanelHeader label="POIROBO ▸ SHIELD" />
        {/* AI起動セクション */}
        <div style={{ fontFamily: MONO, fontSize: 9, color: CY_DIM, letterSpacing: '0.1em', marginTop: 8 }}>
          ▌ AI起動
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-evenly', marginTop: 6 }}>
          {['CG', 'GE', 'CL', 'DS'].map(label => (
            <div key={label} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,229,255,0.1)', border: `1px solid ${CY_BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO, fontSize: 10, color: CY_DIM,
            }}>{label}</div>
          ))}
        </div>
        {/* プロンプトボタン */}
        <div style={{
          marginTop: 8, padding: '8px 0', borderRadius: 6,
          background: 'rgba(0,229,255,0.12)', border: `1px solid ${CY_BORDER}`,
          color: CY_ACCENT, fontFamily: MONO, fontSize: 10, fontWeight: 700,
          textAlign: 'center', letterSpacing: '0.1em',
        }}>
          [ AIプロンプトをコピー ]
        </div>
        {/* SYSTEM LOG */}
        <div style={{ fontFamily: MONO, fontSize: 9, color: CY_DIM, letterSpacing: '0.1em', marginTop: 8 }}>
          ▸ SYSTEM LOG
        </div>
        {[...Array(6)].map((_, i) => (
          <FakeRow key={i} cols={[8, 50, 30]} />
        ))}
      </Panel>

      {/* 右：ポジション分析レポート */}
      <Panel>
        <PanelHeader label="POSITION REPORT" dim />
        {[...Array(14)].map((_, i) => (
          <FakeRow key={i} cols={i === 3 || i === 7 ? [30, 20, 50] : [45, 25, 30]} variant={i % 4 === 0 ? 'mixed' : 'cyan'} />
        ))}
      </Panel>
    </div>
  )
}

// ── カレンダー（MonthView）スケルトン ──────────────────

export function CalendarSkeleton() {
  const weekDays = ['日', '月', '火', '水', '木', '金', '土']
  return (
    <div style={{
      padding: 14, height: '100%', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* 月ナビ風 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: CY_ACCENT }}>2026年 5月</div>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: CY_PANEL, border: `1px solid ${CY_BORDER}` }} />
        <div style={{ width: 28, height: 28, borderRadius: 6, background: CY_PANEL, border: `1px solid ${CY_BORDER}` }} />
      </div>

      {/* 曜日ヘッダー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {weekDays.map((d, i) => (
          <div key={d} style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700,
            color: i === 0 ? RED : i === 6 ? CY_ACCENT : CY_DIM,
            textAlign: 'center', padding: '4px 0',
            borderBottom: `1px solid ${CY_BORDER}`,
          }}>{d}</div>
        ))}
      </div>

      {/* 日付グリッド 6週分 */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gap: 4 }}>
        {[...Array(42)].map((_, i) => {
          const day = ((i - 4 + 30) % 30) + 1
          const hasEvent = [3, 7, 10, 14, 18, 22, 25, 29].includes(day)
          const isToday = day === 15
          return (
            <div key={i} style={{
              background: isToday ? 'rgba(0,229,255,0.12)' : CY_PANEL,
              border: `1px solid ${isToday ? CY_ACCENT : CY_BORDER}`,
              borderRadius: 6, padding: '4px 6px',
              display: 'flex', flexDirection: 'column', gap: 3,
              fontFamily: MONO, fontSize: 10,
            }}>
              <div style={{ color: isToday ? CY_ACCENT : CY_DIM, fontWeight: isToday ? 700 : 400 }}>{day}</div>
              {hasEvent && <Bar pct={70} color={CY_DIM} height={4} />}
              {hasEvent && day % 2 === 0 && <Bar pct={50} color={GREEN} height={4} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
