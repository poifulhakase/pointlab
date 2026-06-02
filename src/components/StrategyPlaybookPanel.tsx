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

// ── 採用エッジ（検証済み・使う）──────────────────────────────
type Edge = { name: string; aim: string; trigger: string; hold: string; ev: string; dd: string; verdict: string }
const ADOPTED: Edge[] = [
  {
    name: 'トレンドフィルター（DD制御）',
    aim: '確定下落で降りて暴落を回避する',
    trigger: '過去50日の高値を上抜けたら買い／過去25日の安値を割れたら撤退（ロングのみ・ドンチャン）',
    hold: 'トレンドが続く限り',
    ev: 'CAGR 約10%（2倍）',
    dd: '−39%（常時ロング−88%を半減）',
    verdict: '◎ DD制御の要',
  },
  {
    name: '売られすぎ買い（押し目）',
    aim: '売られすぎの反発を取る',
    trigger: '25日線乖離 ≤ −10%。🔴確定下落トレンド中（ドンチャン50/25ベア）は発火させない＝落ちるナイフを避ける（v4採用の濾し）',
    hold: '5営業日で機械的に降りる（v4採用・最適日数は決め打たない＝過学習回避）',
    ev: '−10%で +1.8%（3日先・勝率66%）',
    dd: '単体−57%（濾すとDDは下がる・v4）',
    verdict: '△ 玉は希少だがDDは下がる',
  },
  {
    name: '季節性：権利確定ブル',
    aim: '配当の権利確定に向けた買い需要',
    trigger: '3/15頃エントリー → 3/27頃エグジット（🔴確定下落トレンド中は見送り＝v5a）',
    hold: '約2週間（年1回）',
    ev: '+3.2%（勝率70%／2倍で約+6.4%）',
    dd: '窓 −37%',
    verdict: '○ 最強の季節性',
  },
  {
    name: '季節性：年末ラリー',
    aim: '年末の買い需要',
    trigger: '12/15頃エントリー → 12/30頃エグジット（🔴確定下落トレンド中は見送り＝v5a）',
    hold: '約2週間（年1回）',
    ev: '+0.95%（勝率75%）',
    dd: '低',
    verdict: '○ 高勝率・小さめ',
  },
]

export function StrategyPlaybookPanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)
  const th: React.CSSProperties = { padding: isMobile ? '7px 8px' : '8px 12px', textAlign: 'left', fontSize: isMobile ? 9 : 10, fontWeight: 800, letterSpacing: '0.08em', color: c.ACCENT, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap', fontFamily: mono }
  const td: React.CSSProperties = { padding: isMobile ? '8px 8px' : '10px 12px', fontSize: isMobile ? 10 : 12, color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, lineHeight: 1.6, verticalAlign: 'top' }

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
      <div style={{ flex: 1, overflowY: 'auto', zIndex: 1, width: '100%', padding: isMobile ? '14px 14px 32px' : '20px 28px 40px' }}>

        {/* ── やさしいまとめ（初心者向け・上層）── */}
        <div style={{ padding: isMobile ? '14px 16px' : '18px 22px', borderRadius: 10, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, marginBottom: 18, lineHeight: 1.95, color: c.TEXT, fontSize: isMobile ? 12 : 13.5 }}>
          <div style={{ color: c.WIN, fontWeight: 800, fontSize: isMobile ? 14 : 16, marginBottom: 10 }}>▸ ひとことで言うと（初心者向け）</div>
          <div style={{ marginBottom: 14 }}>基本は<b>「買い」だけ</b>。大きく下げたところを買って、上げが続く間は持ち、下げが続いたら降りる。<b>売り（ショート）は原則しない</b>。目標は年+15〜20%だが、<b style={{ color: c.WIN }}>暴落で退場しないこと（DDを浅く）を最優先</b>＝本線は<b>年 約+10%・最大の落ち込み−38%</b>に落ち着いた。</div>

          <div style={{ color: c.WIN, fontWeight: 800, fontSize: isMobile ? 13 : 15, marginBottom: 10 }}>▸ 実際にやることは3つだけ</div>
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { n: '1', t: '大きく下げたら買う', s: 'ただし下落が続いている最中は手を出さない（落ちるナイフを避ける）' },
              { n: '2', t: '上げている間は乗る／下げ続けたら降りる', s: '暴落を避ける装置。トレンドが続く限り持つ' },
              { n: '3', t: '3月と12月は買う', s: '3月＝配当の権利確定前／12月＝年末。上がりやすい季節' },
            ].map(a => (
              <div key={a.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: isMobile ? '9px 11px' : '11px 14px', borderRadius: 9, border: `1px solid ${c.TAGBDR}`, background: c.L ? 'rgba(255,255,255,0.45)' : 'rgba(0,229,255,0.05)' }}>
                <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: c.ACCENT, color: c.L ? '#fff' : '#04101a', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.n}</span>
                <span>
                  <b style={{ fontSize: isMobile ? 12.5 : 14 }}>{a.t}</b>
                  <span style={{ display: 'block', marginTop: 2, fontSize: isMobile ? 11 : 12, color: c.SUB }}>{a.s}</span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14, fontSize: isMobile ? 11 : 12.5, color: c.SUB }}>これを<b>「買い」だけ・2倍まで</b>で回す。普段は何も持たない時間（フラット）があってよい。</div>

          <div style={{ color: c.ACCENT, fontWeight: 700, marginBottom: 5 }}>やらないこと</div>
          <div style={{ marginBottom: 14, paddingLeft: 2 }}>
            ・売り（ショート）＝日経は下げても戻るので負けやすい<br />
            ・毎日売買＝エッジの無い日に張ると、手数料負けする<br />
            ・機械的な損切りの連発＝押し目買いと相性が悪い（底で投げる）
          </div>

          <div style={{ color: c.ACCENT, fontWeight: 700, marginBottom: 5 }}>用語（この下の表で使う言葉）</div>
          <div style={{ paddingLeft: 2, fontSize: isMobile ? 11 : 12.5, color: c.SUB, lineHeight: 1.85 }}>
            ・<b>CAGR</b>＝1年で平均何％増えたか（複利の年率）<br />
            ・<b>DD（ドローダウン）</b>＝一番高かった時から最大何％下がったか（＝痛みの大きさ。深いほど危険）<br />
            ・<b>乖離（かいり）</b>＝価格が移動平均線からどれだけ離れたか（離れすぎ＝行きすぎ）<br />
            ・<b>勝率</b>＝勝ったトレードの割合 ／ <b>期待値</b>＝1回あたり平均で何％取れるか
          </div>
        </div>

        {/* 目標と現実解（詳細層の入口）*/}
        <div style={{ padding: isMobile ? '10px 12px' : '12px 16px', borderRadius: 8, border: `1px solid ${c.TAGBDR}`, background: c.TAGBG, marginBottom: 20, fontFamily: mono, fontSize: isMobile ? 10 : 11.5, lineHeight: 1.9, color: c.TEXT }}>
          <div style={{ color: c.ACCENT, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 6 }}>目標と現実解（20年バックテスト）</div>
          <div>目標：<b>年利50%（税引前）</b> → 検証の結論：<span style={{ color: c.WARN }}>生存可能なレバでは“願望”</span>（全部乗せ3倍でもCAGR22%・最大DD−80%＝退場）</div>
          <div style={{ marginTop: 6 }}>v4精査の発見：<b>CAGR15〜20% と DD−40%圏は両立しない</b>（トレードオフ）。同じエッジでも置き場所で↓のように動く（2倍）：</div>
          <div style={{ paddingLeft: 2, marginTop: 2 }}>・濾し無し（旧・全部乗せ）：CAGR <b>14.4%</b> ／ DD <span style={{ color: c.LOSS }}>−62%</span></div>
          <div style={{ paddingLeft: 2 }}>・押し目だけ濾す（v4a）：CAGR <b>13.0%</b> ／ DD <span style={{ color: c.LOSS }}>−53%</span></div>
          <div style={{ paddingLeft: 2 }}>・押し目＋季節性を濾す（<b>v5a＝本線</b>）：CAGR <b style={{ color: c.WIN }}>10.2%</b> ／ DD <b style={{ color: c.WIN }}>−38%</b></div>
          <div style={{ marginTop: 6 }}>🔴 <b>本線＝v5a（生存最優先）</b>：DDを−40%圏に抑える代わりにCAGRは約10%（≒現物B&H並みだが、2倍常時ロングの−88%より遥かに浅い）。CAGRを15%級にしたければDDは−55〜62%を受け入れる、という地図。</div>
          <div style={{ marginTop: 6 }}>システムの形：<b>トレンドフィルター（DD制御）＋ 売られすぎ買い＋ 季節性 ／ 全部を“確定下落トレンドでない時だけ”発火 ／ ショートなし ／ 2倍</b></div>
        </div>

        {/* 採用エッジ */}
        <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 800, color: c.ACCENT, letterSpacing: '0.08em', marginBottom: 8, fontFamily: mono }}>■ 採用エッジ（検証済み・使う）</div>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', minWidth: isMobile ? 720 : 980, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: isMobile ? 100 : 130 }} />
              <col style={{ width: isMobile ? 90 : 120 }} />
              <col style={{ width: isMobile ? 150 : 230 }} />
              <col style={{ width: isMobile ? 90 : 130 }} />
              <col style={{ width: isMobile ? 90 : 120 }} />
              <col style={{ width: isMobile ? 90 : 130 }} />
              <col style={{ width: isMobile ? 70 : 100 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>エッジ</th><th style={th}>狙い</th><th style={th}>トリガー（どこで）</th><th style={th}>保有</th><th style={th}>期待値</th><th style={th}>DD</th><th style={th}>判定</th>
              </tr>
            </thead>
            <tbody>
              {ADOPTED.map(e => (
                <tr key={e.name}>
                  <td style={{ ...td, fontWeight: 700, color: c.ACCENT }}>{e.name}</td>
                  <td style={td}>{e.aim}</td>
                  <td style={td}>{e.trigger}</td>
                  <td style={td}>{e.hold}</td>
                  <td style={{ ...td, color: c.WIN, fontWeight: 700 }}>{e.ev}</td>
                  <td style={{ ...td, color: c.LOSS }}>{e.dd}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{e.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20, fontSize: isMobile ? 9 : 10, color: c.SUB, fontFamily: mono, lineHeight: 1.8 }}>
          ⚠ 20年イン・サンプル（2013〜24の大相場を含む）・季節性はn=20。「ルール通りの過去」であり将来を保証しない。
          押し目買いの保有日数は結果に効き、最良日数はサンプル依存（−10%は短期/−7%は長期が有利と真逆）＝特定日数を最適化しない。
          大数の法則の正しい適用＝「+EVが現れるたび（年十数回）に、生存できるサイズで張る」。毎週張る・無エッジ帯で張るは損失に収束。
        </div>
      </div>
    </div>
  )
}
