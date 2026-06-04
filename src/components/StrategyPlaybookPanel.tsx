import { useState, useEffect, useCallback, useRef } from 'react'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const mono = "'Courier New', Courier, monospace" as const

type C = {
  L: boolean; BG: string; HDRBG: string; ACCENT: string; DIM: string
  TEXT: string; SUB: string; RULE: string; TAGBG: string; TAGBDR: string
  SCAN: string; WIN: string; LOSS: string; WARN: string; CARD: string
}
function makeC(theme: 'dark' | 'light'): C {
  const L = theme === 'light'
  return {
    L,
    BG:     L ? 'rgba(238,246,255,0.78)' : 'rgba(4,10,22,0.55)',
    HDRBG:  L ? 'rgba(248,252,255,0.90)' : 'rgba(4,10,22,0.80)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.42)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.16)'   : 'rgba(0,229,255,0.16)',
    TAGBG:  L ? 'rgba(3,105,161,0.07)'   : 'rgba(0,229,255,0.10)',
    TAGBDR: L ? 'rgba(3,105,161,0.22)'   : 'rgba(0,229,255,0.16)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'                : '#f87171',
    WARN:   L ? '#b45309'                : '#fbbf24',
    CARD:   L ? 'rgba(255,255,255,0.66)' : 'rgba(8,16,30,0.55)',
  }
}

// ── やること（初心者向け・3つだけ）──
const ACTIONS = [
  { n: '1', t: '大きく下げたら買う', s: 'ただし下落が続いている最中は手を出さない（落ちるナイフを避ける）' },
  { n: '2', t: '上げている間は乗る／下げ続けたら降りる', s: '暴落を避ける装置。トレンドが続く限り持つ' },
  { n: '3', t: '3月と12月は買う', s: '3月＝配当の権利確定前／12月＝年末。上がりやすい季節' },
]

// ── 現実解（CAGR×DDのトレードオフ・20年BT・2倍）──
const FRONTIER = [
  { label: '全部のせ（むかしのやり方）',       cagr: 14.4, dd: 62, main: false },
  { label: '暴落よけを少しだけ',             cagr: 13.0, dd: 53, main: false },
  { label: '本線：暴落よけを徹底（v5a）',     cagr: 10.2, dd: 38, main: true },
]
const CAGR_MAX = 15, DD_MAX = 65

// ── 採用エッジ（検証済み・使う）── plain=やさしい説明 / 以下は折りたたみ内の詳細
type Edge = { name: string; grade: '◎' | '○' | '△'; gradeLabel: string; plain: string; aim: string; trigger: string; hold: string; ev: string; dd: string }
const ADOPTED: Edge[] = [
  { name: 'トレンドフィルター', grade: '◎', gradeLabel: '暴落よけの“お守り”（一番だいじ）',
    plain: '上がっている相場のときだけ乗る仕組み。高値を更新したら買い、下がり始めたら降りる。これで大きな暴落をよけられます。',
    aim: '暴落を回避してドローダウンを抑える', trigger: '50日高値を上抜けで買い／25日安値割れで撤退（ロングのみ）', hold: 'トレンドが続く限り', ev: 'CAGR 約10%（2倍）', dd: '−39%（常時ロング−88%の半分）' },
  { name: '売られすぎ買い（押し目）', grade: '△', gradeLabel: 'チャンスは少なめ',
    plain: '大きく下げたところを買って、反発をねらいます。ただし下げ続けている最中は手を出しません（落ちるナイフを避ける）。',
    aim: '売られすぎの反発を取る', trigger: '25日線 ≤ −10%。下落トレンド中は見送り（落ちるナイフ回避）', hold: '5営業日で機械的に降りる', ev: '−10%で +1.8%（勝率66%）', dd: '単体−57%（濾すと改善）' },
  { name: '季節性：3月の権利確定', grade: '○', gradeLabel: '一番つよい季節',
    plain: '3月は配当をもらう権利を取りにいく買いが入りやすい時期。3月中旬から月末まで持ちます（年1回）。',
    aim: '配当の権利確定に向けた買い需要', trigger: '3/15頃 → 3/27頃', hold: '約2週間（年1回）', ev: '+3.2%（勝率70%）', dd: '窓 −37%' },
  { name: '季節性：年末ラリー', grade: '○', gradeLabel: '当たりやすい・小さめ',
    plain: '12月末は上がりやすい時期。12月中旬から年末まで持ちます（年1回）。',
    aim: '年末の買い需要', trigger: '12/15頃 → 12/30頃', hold: '約2週間（年1回）', ev: '+0.95%（勝率75%）', dd: '低' },
]

export function StrategyPlaybookPanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)
  const PAD = isMobile ? '26px 20px' : '42px 46px'

  // スライド枠
  const slide = (num: string, title: string, subtitle: string, body: React.ReactNode) => (
    <section style={{ borderRadius: 18, border: `1px solid ${c.TAGBDR}`, background: c.CARD, padding: PAD, boxShadow: c.L ? '0 2px 10px rgba(0,50,110,0.06)' : '0 2px 16px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: isMobile ? 22 : 30, paddingBottom: isMobile ? 16 : 22, borderBottom: `1px solid ${c.RULE}` }}>
        <span style={{ flexShrink: 0, width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, borderRadius: 11, background: c.ACCENT, color: c.L ? '#fff' : '#04101a', fontWeight: 800, fontSize: isMobile ? 15 : 19, fontFamily: mono, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: c.L ? 'none' : `0 0 12px ${c.ACCENT}55` }}>{num}</span>
        <div>
          <div style={{ fontSize: isMobile ? 17 : 23, fontWeight: 800, color: c.TEXT, letterSpacing: '0.01em', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: isMobile ? 9.5 : 11, color: c.DIM, marginTop: 5, fontFamily: mono, letterSpacing: '0.12em' }}>{subtitle}</div>}
        </div>
      </div>
      {body}
    </section>
  )

  // KPIスタット
  const stat = (label: string, value: string, color: string) => (
    <div style={{
      flex: 1, minWidth: isMobile ? 0 : 130, padding: isMobile ? '15px 16px' : '20px 22px',
      borderRadius: 14, border: `1px solid ${c.TAGBDR}`, borderTop: `2px solid ${color}`,
      background: `linear-gradient(165deg, ${color}0e, ${c.TAGBG} 60%)`,
      boxShadow: c.L ? '0 1px 6px rgba(0,50,110,0.05)' : 'none',
    }}>
      <div style={{ fontSize: isMobile ? 9 : 10.5, color: c.DIM, fontFamily: mono, letterSpacing: '0.08em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 20 : 27, fontWeight: 800, color, lineHeight: 1, letterSpacing: '0.01em', textShadow: c.L ? 'none' : `0 0 14px ${color}3a` }}>{value}</div>
    </div>
  )

  // カード内のラベル:値 行
  const kv = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', gap: 11, alignItems: 'baseline' }}>
      <span style={{ flexShrink: 0, width: isMobile ? 48 : 54, fontSize: isMobile ? 9 : 10, color: c.DIM, fontWeight: 700, fontFamily: mono, letterSpacing: '0.03em', lineHeight: 1.6 }}>{label}</span>
      <span style={{ fontSize: isMobile ? 11 : 12.5, color: color || c.TEXT, lineHeight: 1.65, fontWeight: color ? 700 : 400 }}>{value}</span>
    </div>
  )

  // 現実解のバー（CAGR=緑 / DD=赤）
  const bar = (caption: string, value: string, widthPct: number, color: string) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: isMobile ? 9 : 10.5, marginBottom: 5, fontFamily: mono }}>
        <span style={{ color: c.DIM }}>{caption}</span>
        <span style={{ color, fontWeight: 800, fontSize: isMobile ? 12 : 14 }}>{value}</span>
      </div>
      <div style={{ height: 9, borderRadius: 5, background: c.L ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, widthPct)}%`, background: color, borderRadius: 5, transition: 'width .3s' }} />
      </div>
    </div>
  )

  const gradeColor = (g: Edge['grade']) => g === '◎' ? c.WIN : g === '△' ? c.WARN : c.ACCENT

  // ── スライド本体（1枚ずつ切替）──
  const slides: { id: string; node: React.ReactNode }[] = [
    // ════ 表紙 ════
    { id: 'cover', node: (
      <div style={{ padding: isMobile ? '4px 2px' : '8px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ width: 24, height: 2, borderRadius: 2, background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}` }} />
          <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, letterSpacing: '0.28em', color: c.ACCENT, fontFamily: mono }}>POIROBO STRATEGY</span>
        </div>
        <div style={{
          fontSize: isMobile ? 27 : 42, fontWeight: 800, lineHeight: 1.15, letterSpacing: '0.01em', marginBottom: 14,
          background: c.L ? 'linear-gradient(92deg,#0c4a6e,#0369a1)' : 'linear-gradient(92deg,#ffffff 35%,#00e5ff)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: c.TEXT,
          filter: c.L ? 'none' : 'drop-shadow(0 0 18px rgba(0,229,255,0.22))', width: 'fit-content',
        }}>戦略プレイブック</div>
        <div style={{ fontSize: isMobile ? 12.5 : 15, color: c.SUB, lineHeight: 1.95, marginBottom: isMobile ? 22 : 32, maxWidth: 700 }}>
          このページは、ぽいロボの「どう売買するか」の作戦書です。<b style={{ color: c.TEXT }}>むずかしい信用取引や空売りは使いません</b>。買うのは、ふつうに買える日経225の<b style={{ color: c.TEXT }}>ETF（上場投資信託）</b>だけ。<br />
          やることはシンプルで、<b style={{ color: c.TEXT }}>下げたら買う・上げている間は持つ</b>をルールにします。大もうけより<b style={{ color: c.WIN }}>「大きく負けないこと」を最優先</b>にして、<b style={{ color: c.WIN }}>1年で +10%くらい</b>を、<b style={{ color: c.LOSS }}>負けても −38%まで</b>に抑えるのが目標です。
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
          {stat('目標リターン（1年）', '約+10%', c.WIN)}
          {stat('覚悟する最大の負け', '−38%', c.LOSS)}
          {stat('使うもの（信用なし）', '現物ETF', c.ACCENT)}
        </div>
        <div style={{ marginTop: isMobile ? 22 : 30, fontSize: isMobile ? 10 : 11, color: c.DIM, fontFamily: mono, letterSpacing: '0.06em' }}>
          ↓ 下の矢印で1枚ずつめくれます
        </div>
      </div>
    ) },

    // ════ スライド1：やることは3つだけ ════
    { id: 's1', node: slide('1', 'やることは3つだけ', 'WHAT TO DO', (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 11 : 14, marginBottom: isMobile ? 16 : 20 }}>
          {ACTIONS.map(a => (
            <div key={a.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: isMobile ? '13px 14px' : '18px 22px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG }}>
              <span style={{ flexShrink: 0, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%', background: c.ACCENT, color: c.L ? '#fff' : '#04101a', fontWeight: 800, fontSize: isMobile ? 15 : 17, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}55` }}>{a.n}</span>
              <span style={{ paddingTop: 2 }}>
                <b style={{ fontSize: isMobile ? 14 : 16 }}>{a.t}</b>
                <span style={{ display: 'block', marginTop: 5, fontSize: isMobile ? 11.5 : 13, color: c.SUB, lineHeight: 1.6 }}>{a.s}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: isMobile ? 10 : 11.5, color: c.DIM, fontWeight: 700, fontFamily: mono, marginRight: 2 }}>やらない：</span>
          {['信用・空売り', '毎日売買', '損切りの連発'].map(x => (
            <span key={x} style={{ fontSize: isMobile ? 10.5 : 12, color: c.LOSS, border: `1px solid ${c.L ? 'rgba(220,38,38,0.3)' : 'rgba(248,113,113,0.3)'}`, background: c.L ? 'rgba(220,38,38,0.05)' : 'rgba(248,113,113,0.07)', borderRadius: 999, padding: '4px 12px', fontWeight: 600 }}>✕ {x}</span>
          ))}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: isMobile ? 10.5 : 12, color: c.SUB, fontFamily: mono, userSelect: 'none' }}>
            ▸ 用語（CAGR / DD / 乖離 / 勝率）
          </summary>
          <div style={{ paddingLeft: 4, marginTop: 10, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.9 }}>
            ・<b>CAGR</b>＝1年で平均何％増えたか（複利の年率）<br />
            ・<b>DD（ドローダウン）</b>＝一番高かった所から最大何％下がったか（痛みの大きさ）<br />
            ・<b>乖離（かいり）</b>＝価格が移動平均線からどれだけ離れたか<br />
            ・<b>勝率</b>＝勝ったトレードの割合 ／ <b>期待値</b>＝1回平均で何％取れるか
          </div>
        </details>
      </>
    )) },

    // ════ スライド2：なぜ「年+10%」なの？ ════
    { id: 's2', node: slide('2', 'なぜ「年+10%」なの？', 'よくばらない理由・REALITY', (
      <>
        <div style={{ fontSize: isMobile ? 12 : 13.5, color: c.TEXT, lineHeight: 1.85, marginBottom: isMobile ? 18 : 22 }}>
          「年+10%」は少なく感じるかもしれません。でも、<b style={{ color: c.TEXT }}>もうけを大きく狙うほど、負けるときの痛み（最大の下げ）も深くなります</b>。両方をいっぺんに良くすることはできません。<br />
          下のグラフは、同じ作戦でも“どこまで暴落をよけるか”でどう変わるかを、過去20年で試したものです。<b style={{ color: c.WIN }}>だから欲ばらず、まず「生き残ること」を優先します。</b>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FRONTIER.map(f => (
            <div key={f.label} style={{
              padding: isMobile ? '13px 14px' : '16px 20px', borderRadius: 12,
              border: f.main ? `1.5px solid ${c.WIN}` : `1px solid ${c.RULE}`,
              background: f.main ? (c.L ? 'rgba(21,128,61,0.07)' : 'rgba(74,222,128,0.08)') : c.TAGBG,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: isMobile ? 12 : 13.5, color: f.main ? c.WIN : c.TEXT }}>{f.label}</span>
                {f.main && <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 800, color: c.L ? '#fff' : '#04101a', background: c.WIN, borderRadius: 999, padding: '2px 10px', letterSpacing: '0.06em' }}>本線</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 14 : 24 }}>
                {bar('もうけ（1年）', `+${f.cagr}%`, f.cagr / CAGR_MAX * 100, c.WIN)}
                {bar('最大の負け', `−${f.dd}%`, f.dd / DD_MAX * 100, c.LOSS)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 12, background: c.L ? 'rgba(21,128,61,0.06)' : 'rgba(74,222,128,0.06)', border: `1px solid ${c.L ? 'rgba(21,128,61,0.25)' : 'rgba(74,222,128,0.22)'}`, fontSize: isMobile ? 11 : 12.5, color: c.TEXT, lineHeight: 1.7 }}>
          🔴 <b style={{ color: c.WIN }}>採用するのは一番下（v5a）</b>。もうけは年+10%くらいに下がりますが、そのぶん<b>最大の負けを−38%に抑えられます</b>。ちなみに「2倍ETFをただ持ちっぱなし」だと最大−88%まで下がるので、それよりずっと浅い負けで済みます。
        </div>
      </>
    )) },

    // ════ スライド3：勝てる4つの理由 ════
    { id: 's3', node: slide('3', '勝てる4つの理由', '使う作戦・ADOPTED', (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 16 }}>
        {ADOPTED.map(e => (
          <div key={e.name} style={{ padding: isMobile ? '15px 15px' : '18px 20px', borderRadius: 14, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flexShrink: 0, fontSize: isMobile ? 13 : 14, fontWeight: 800, color: c.L ? '#fff' : '#04101a', background: gradeColor(e.grade), borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{e.grade}</span>
              <span style={{ fontWeight: 800, fontSize: isMobile ? 13.5 : 15, color: c.ACCENT }}>{e.name}</span>
            </div>
            <div style={{ fontSize: isMobile ? 10.5 : 11.5, color: gradeColor(e.grade), fontWeight: 700, marginTop: -4 }}>{e.gradeLabel}</div>
            <div style={{ fontSize: isMobile ? 12 : 13, color: c.TEXT, lineHeight: 1.7 }}>{e.plain}</div>
            <details>
              <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: isMobile ? 10 : 11, color: c.DIM, fontFamily: mono, userSelect: 'none', paddingTop: 2 }}>
                ▸ くわしい数字でみる
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${c.RULE}`, paddingTop: 12, marginTop: 8 }}>
                {kv('狙い', e.aim)}
                {kv('合図', e.trigger)}
                {kv('持つ期間', e.hold)}
                {kv('1回の見込み', e.ev, c.WIN)}
                {kv('最大の負け', e.dd, c.LOSS)}
              </div>
            </details>
          </div>
        ))}
      </div>
    )) },

    // ════ 注意書き ════
    { id: 'note', node: (
      <div style={{ padding: isMobile ? '16px 18px' : '22px 26px', borderRadius: 16, border: `1px solid ${c.RULE}`, background: c.CARD, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.95 }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: c.TEXT, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>最後に大事なこと
        </div>
        これは過去20年のデータで「ルール通りに売買したらこうなった」という結果です。<b style={{ color: c.TEXT }}>未来を約束するものではありません</b>。季節性は年1回なので、試せた回数（20回ぶん）も少なめです。<br /><br />
        基本は<b style={{ color: c.TEXT }}>「チャンス（+の見込み）が来たときだけ、無理のない金額で買う」</b>。毎回むやみに売り買いしたり、根拠がないのに張ると、かえって減りやすくなります。
      </div>
    ) },
  ]

  const total = slides.length
  const [idx, setIdx] = useState(0)
  const touchY = useRef<number | null>(null)

  const go = useCallback((n: number) => setIdx(Math.max(0, Math.min(total - 1, n))), [total])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx, go, onClose])

  const chevron = (down: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: down ? 'none' : 'rotate(180deg)' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )

  const pageStyle: React.CSSProperties = {
    height: `${100 / total}%`, overflowY: 'auto', display: 'flex', flexDirection: 'column',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      background: c.BG, backgroundImage: c.SCAN,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '11px 16px' : '12px 28px',
        background: c.HDRBG, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${c.RULE}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap' }}>
          ぽいロボ ▸ 戦略プレイブック
        </span>
        <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>{idx + 1} / {total}</span>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
          border: c.L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
          background: c.L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
          color: c.L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)', flexShrink: 0,
        }} aria-label="閉じる">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── 進捗バー ── */}
      <div style={{ flexShrink: 0, height: 2, background: c.RULE }}>
        <div style={{ height: '100%', width: `${((idx + 1) / total) * 100}%`, background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}`, transition: 'width .52s cubic-bezier(.22,1,.36,1)' }} />
      </div>

      {/* ── ステージ（1枚ずつ縦スライド）── */}
      <div
        style={{ position: 'relative', flex: 1, overflow: 'hidden', zIndex: 1, minHeight: 0 }}
        onTouchStart={e => { touchY.current = e.touches[0].clientY }}
        onTouchEnd={e => {
          if (touchY.current == null) return
          const d = touchY.current - e.changedTouches[0].clientY
          if (Math.abs(d) > 50) go(idx + (d > 0 ? 1 : -1))
          touchY.current = null
        }}
      >
        {/* 大きな番号（ダイナミックな背景） */}
        <div style={{ position: 'absolute', top: isMobile ? 4 : 10, right: isMobile ? 10 : 26, fontSize: isMobile ? 96 : 168, fontWeight: 800, fontFamily: mono, lineHeight: 1, color: c.ACCENT, opacity: c.L ? 0.05 : 0.06, pointerEvents: 'none', userSelect: 'none', zIndex: 0, transition: 'opacity .3s' }}>
          {String(idx + 1).padStart(2, '0')}
        </div>

        {/* スライドトラック */}
        <div style={{ position: 'relative', zIndex: 1, height: `${total * 100}%`, transform: `translateY(-${idx * (100 / total)}%)`, transition: 'transform .52s cubic-bezier(.22,1,.36,1)' }}>
          {slides.map(s => (
            <div key={s.id} style={pageStyle}>
              <div style={{ width: '100%', maxWidth: 1040, margin: 'auto', padding: isMobile ? '22px 16px' : '36px 40px' }}>
                {s.node}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── コントロール（前 / ドット / 次）── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 16 : 22, padding: isMobile ? '10px 12px 14px' : '14px 0 18px', zIndex: 6 }}>
        <button
          onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="前のスライド"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            border: `1px solid ${c.TAGBDR}`, background: 'transparent',
            color: c.DIM, cursor: idx === 0 ? 'default' : 'pointer',
            opacity: idx === 0 ? 0.3 : 1, transition: 'opacity .2s',
          }}
        >{chevron(false)}</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {slides.map((s, i) => (
            <button
              key={s.id} onClick={() => go(i)} aria-label={`${i + 1}枚目へ`}
              style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0,
                background: i === idx ? c.ACCENT : c.TAGBDR, cursor: 'pointer',
                boxShadow: i === idx && !c.L ? `0 0 8px ${c.ACCENT}` : 'none',
                transition: 'all .4s cubic-bezier(.22,1,.36,1)',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => go(idx + 1)} disabled={idx === total - 1} aria-label="次のスライド"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
            border: 'none', background: c.ACCENT, color: c.L ? '#fff' : '#04101a',
            cursor: idx === total - 1 ? 'default' : 'pointer',
            opacity: idx === total - 1 ? 0.3 : 1,
            boxShadow: c.L ? '0 2px 10px rgba(3,105,161,0.35)' : `0 0 16px ${c.ACCENT}66`,
            transition: 'opacity .2s, box-shadow .2s',
          }}
        >{chevron(true)}</button>
      </div>
    </div>
  )
}
