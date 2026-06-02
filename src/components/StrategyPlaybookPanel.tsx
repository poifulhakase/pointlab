type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const mono = "'Courier New', Courier, monospace" as const

type C = {
  L: boolean; BG: string; HDRBG: string; ACCENT: string; DIM: string
  TEXT: string; SUB: string; RULE: string; TAGBG: string; TAGBDR: string
  SCAN: string; WIN: string; LOSS: string; WARN: string
}
function makeC(theme: 'dark' | 'light'): C {
  const L = theme === 'light'
  return {
    L,
    BG:     L ? 'rgba(240,248,255,0.72)' : 'rgba(4,10,22,0.55)',
    HDRBG:  L ? 'rgba(248,252,255,0.90)' : 'rgba(4,10,22,0.80)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.42)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.18)'   : 'rgba(0,229,255,0.18)',
    TAGBG:  L ? 'rgba(3,105,161,0.08)'   : 'rgba(0,229,255,0.12)',
    TAGBDR: L ? 'rgba(3,105,161,0.28)'   : 'rgba(0,229,255,0.18)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'                : '#f87171',
    WARN:   L ? '#b45309'                : '#fbbf24',
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
  { label: '濾し無し（旧・全部乗せ）', cagr: 14.4, dd: 62, main: false },
  { label: '押し目だけ濾す（v4a）',   cagr: 13.0, dd: 53, main: false },
  { label: '押し目＋季節性を濾す（v5a）', cagr: 10.2, dd: 38, main: true },
]
const CAGR_MAX = 15, DD_MAX = 65

// ── 採用エッジ（検証済み・使う）──
type Edge = { name: string; grade: '◎' | '○' | '△'; gradeLabel: string; aim: string; trigger: string; hold: string; ev: string; dd: string }
const ADOPTED: Edge[] = [
  { name: 'トレンドフィルター', grade: '◎', gradeLabel: 'DD制御の要', aim: '暴落を回避してドローダウンを抑える', trigger: '50日高値を上抜けで買い／25日安値割れで撤退（ロングのみ）', hold: 'トレンドが続く限り', ev: 'CAGR 約10%（2倍）', dd: '−39%（常時ロング−88%の半分）' },
  { name: '売られすぎ買い（押し目）', grade: '△', gradeLabel: '玉は希少だがDDは下がる', aim: '売られすぎの反発を取る', trigger: '25日線 ≤ −10%。下落トレンド中は見送り（落ちるナイフ回避）', hold: '5営業日で機械的に降りる', ev: '−10%で +1.8%（勝率66%）', dd: '単体−57%（濾すと改善）' },
  { name: '季節性：権利確定ブル', grade: '○', gradeLabel: '最強の季節性', aim: '配当の権利確定に向けた買い需要', trigger: '3/15頃 → 3/27頃', hold: '約2週間（年1回）', ev: '+3.2%（勝率70%）', dd: '窓 −37%' },
  { name: '季節性：年末ラリー', grade: '○', gradeLabel: '高勝率・小さめ', aim: '年末の買い需要', trigger: '12/15頃 → 12/30頃', hold: '約2週間（年1回）', ev: '+0.95%（勝率75%）', dd: '低' },
]

export function StrategyPlaybookPanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)

  // セクション見出し（左アクセントバー）
  const sectionTitle = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      <span style={{ width: 3, height: 16, borderRadius: 2, background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 6px ${c.ACCENT}` }} />
      <span style={{ fontSize: isMobile ? 12.5 : 14, fontWeight: 800, color: c.ACCENT, letterSpacing: '0.1em', fontFamily: mono }}>{text}</span>
    </div>
  )

  // カード内のラベル:値 行
  const kv = (label: string, value: string, color?: string) => (
    <div style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
      <span style={{ flexShrink: 0, width: isMobile ? 46 : 52, fontSize: isMobile ? 9 : 10, color: c.DIM, fontWeight: 700, fontFamily: mono, letterSpacing: '0.03em', lineHeight: 1.6 }}>{label}</span>
      <span style={{ fontSize: isMobile ? 11 : 12.5, color: color || c.TEXT, lineHeight: 1.6, fontWeight: color ? 700 : 400 }}>{value}</span>
    </div>
  )

  // 現実解のバー（CAGR=緑 / DD=赤）
  const bar = (caption: string, value: string, widthPct: number, color: string) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: isMobile ? 9 : 10, marginBottom: 4, fontFamily: mono }}>
        <span style={{ color: c.DIM }}>{caption}</span>
        <span style={{ color, fontWeight: 800, fontSize: isMobile ? 11 : 12.5 }}>{value}</span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: c.L ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, widthPct)}%`, background: color, borderRadius: 5, transition: 'width .3s' }} />
      </div>
    </div>
  )

  const gradeColor = (g: Edge['grade']) => g === '◎' ? c.WIN : g === '△' ? c.WARN : c.ACCENT

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
        <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>管理者</span>
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

      {/* ── Body（全幅・スクロール）── */}
      <div style={{ flex: 1, overflowY: 'auto', zIndex: 1, width: '100%', maxWidth: 1080, margin: '0 auto', padding: isMobile ? '16px 14px 36px' : '24px 28px 48px' }}>

        {/* ════ ① やることは3つだけ ════ */}
        <div style={{ padding: isMobile ? '16px 16px' : '20px 24px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, marginBottom: 24 }}>
          <div style={{ color: c.WIN, fontWeight: 800, fontSize: isMobile ? 16 : 18, marginBottom: 8, letterSpacing: '0.02em' }}>やることは3つだけ</div>
          <div style={{ marginBottom: 16, fontSize: isMobile ? 11.5 : 13, color: c.TEXT, lineHeight: 1.8 }}>
            基本は<b>「買い」だけ・2倍まで</b>。目標は年+15〜20%だが、<b style={{ color: c.WIN }}>暴落で退場しないこと（DDを浅く）を最優先</b>＝本線は<b>年 約+10%・最大DD −38%</b>。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
            {ACTIONS.map(a => (
              <div key={a.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: isMobile ? '10px 12px' : '13px 16px', borderRadius: 10, border: `1px solid ${c.TAGBDR}`, background: c.L ? 'rgba(255,255,255,0.5)' : 'rgba(0,229,255,0.05)' }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: c.ACCENT, color: c.L ? '#fff' : '#04101a', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}55` }}>{a.n}</span>
                <span>
                  <b style={{ fontSize: isMobile ? 13 : 14.5 }}>{a.t}</b>
                  <span style={{ display: 'block', marginTop: 3, fontSize: isMobile ? 11 : 12, color: c.SUB, lineHeight: 1.55 }}>{a.s}</span>
                </span>
              </div>
            ))}
          </div>

          {/* やらないこと（ピル） */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <span style={{ fontSize: isMobile ? 10 : 11, color: c.DIM, fontWeight: 700, fontFamily: mono, marginRight: 2 }}>やらない：</span>
            {['売り（ショート）', '毎日売買', '損切りの連発'].map(x => (
              <span key={x} style={{ fontSize: isMobile ? 10.5 : 11.5, color: c.LOSS, border: `1px solid ${c.L ? 'rgba(220,38,38,0.3)' : 'rgba(248,113,113,0.3)'}`, background: c.L ? 'rgba(220,38,38,0.05)' : 'rgba(248,113,113,0.07)', borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>✕ {x}</span>
            ))}
          </div>

          {/* 用語（折りたたみ） */}
          <details>
            <summary style={{ cursor: 'pointer', listStyle: 'none', fontSize: isMobile ? 10.5 : 11.5, color: c.SUB, fontFamily: mono, userSelect: 'none' }}>
              ▸ 用語（CAGR / DD / 乖離 / 勝率）
            </summary>
            <div style={{ paddingLeft: 4, marginTop: 8, fontSize: isMobile ? 11 : 12, color: c.SUB, lineHeight: 1.85 }}>
              ・<b>CAGR</b>＝1年で平均何％増えたか（複利の年率）<br />
              ・<b>DD（ドローダウン）</b>＝一番高かった所から最大何％下がったか（痛みの大きさ）<br />
              ・<b>乖離（かいり）</b>＝価格が移動平均線からどれだけ離れたか<br />
              ・<b>勝率</b>＝勝ったトレードの割合 ／ <b>期待値</b>＝1回平均で何％取れるか
            </div>
          </details>
        </div>

        {/* ════ ② 目標と現実解（ビジュアル）════ */}
        {sectionTitle('目標と現実解（20年バックテスト・2倍）')}
        <div style={{ padding: isMobile ? '14px 14px' : '18px 22px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, marginBottom: 28 }}>
          <div style={{ fontSize: isMobile ? 11.5 : 13, color: c.TEXT, lineHeight: 1.75, marginBottom: 16 }}>
            目標 <b>年利50%</b> は <span style={{ color: c.WARN, fontWeight: 700 }}>生存可能なレバでは願望</span>。同じエッジでも“置き場所”でCAGRとDDは下のように動く。<b>CAGRを上げるとDDも深くなる＝両立しない。</b>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FRONTIER.map(f => (
              <div key={f.label} style={{
                padding: isMobile ? '11px 12px' : '13px 16px', borderRadius: 10,
                border: f.main ? `1.5px solid ${c.WIN}` : `1px solid ${c.RULE}`,
                background: f.main ? (c.L ? 'rgba(21,128,61,0.07)' : 'rgba(74,222,128,0.08)') : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: isMobile ? 11.5 : 13, color: f.main ? c.WIN : c.TEXT }}>{f.label}</span>
                  {f.main && <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 800, color: c.L ? '#fff' : '#04101a', background: c.WIN, borderRadius: 999, padding: '2px 9px', letterSpacing: '0.06em' }}>本線</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 12 : 20 }}>
                  {bar('CAGR（年利）', `${f.cagr}%`, f.cagr / CAGR_MAX * 100, c.WIN)}
                  {bar('最大DD（痛み）', `−${f.dd}%`, f.dd / DD_MAX * 100, c.LOSS)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: isMobile ? 10.5 : 11.5, color: c.SUB, lineHeight: 1.7 }}>
            🔴 <b style={{ color: c.WIN }}>本線＝v5a（生存最優先）</b>。DDを−40%圏に抑える代わりにCAGRは約10%（≒現物B&H並みだが、2倍常時ロングの−88%より遥かに浅い）。
          </div>
        </div>

        {/* ════ ③ 採用エッジ（カード）════ */}
        {sectionTitle('採用エッジ（検証済み・使う）')}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 26 }}>
          {ADOPTED.map(e => (
            <div key={e.name} style={{ padding: isMobile ? '14px 14px' : '16px 18px', borderRadius: 12, border: `1px solid ${c.TAGBDR}`, background: c.L ? 'rgba(255,255,255,0.4)' : 'rgba(0,229,255,0.035)', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ flexShrink: 0, fontSize: isMobile ? 12 : 13, fontWeight: 800, color: c.L ? '#fff' : '#04101a', background: gradeColor(e.grade), borderRadius: 7, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{e.grade}</span>
                <span style={{ fontWeight: 800, fontSize: isMobile ? 13 : 14, color: c.ACCENT }}>{e.name}</span>
              </div>
              <div style={{ fontSize: isMobile ? 10.5 : 11.5, color: gradeColor(e.grade), fontWeight: 700, marginTop: -4 }}>{e.gradeLabel}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, borderTop: `1px solid ${c.RULE}`, paddingTop: 11 }}>
                {kv('狙い', e.aim)}
                {kv('トリガー', e.trigger)}
                {kv('保有', e.hold)}
                {kv('期待値', e.ev, c.WIN)}
                {kv('DD', e.dd, c.LOSS)}
              </div>
            </div>
          ))}
        </div>

        {/* ════ 注意書き ════ */}
        <div style={{ padding: isMobile ? '11px 13px' : '13px 16px', borderRadius: 10, border: `1px solid ${c.RULE}`, fontSize: isMobile ? 9.5 : 10.5, color: c.SUB, fontFamily: mono, lineHeight: 1.85 }}>
          ⚠ 20年イン・サンプル（2013〜24の大相場を含む）・季節性はn=20。「ルール通りの過去」であり将来を保証しない。<br />
          押し目買いの保有日数は最良がサンプル依存＝最適化しない。「+EVが出るたび（年十数回）に生存サイズで張る」が正解で、毎週張る・無エッジ帯で張るは損失に収束。
        </div>
      </div>
    </div>
  )
}
