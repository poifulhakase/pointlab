// 地下室 ＞ スイングトレード（2026-08-13）
//
// 🔴 ぽいロボ本体が扱っているのがこの時間軸。デイトレードと違い、**材料も検証も既にある**。
//    ここは「何が分かっていて、何がまだ分かっていないか」を1枚で見る場所。
// 🔴 **結果だけ置く。説明の文章は書かない**（2026-08-16 ユーザー指示）。
//    数字を足すときも表に1行足すだけにして、地の文で解説しないこと。
// 🔵 数字の出どころ＝`scripts/backtest-robo.mjs`（対照群）／`scripts/backtest-tev.mjs`（需給シグナル）／
//    20年R&D（`analyze-*.mjs`）。測り直したらここも書き換える。

import { basementColors, BASEMENT_MONO, concreteStyle, BULB_GLOW } from './basementTheme'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }

/** 分かっていること（数字が出ているもの） */
const KNOWN = [
  { label: '対照群（決定論ルール）／ETF実データ・約11年', result: '72トレード 勝率46% CAGR 13.09% 最大DD −46.15%', tone: 'ok' as const },
  { label: '需給シグナル（TEV）52週・五分五分ゲート後', result: 'シグナル24週 勝率63%（🔴 in-sample）', tone: 'warn' as const },
  { label: '確信度の較正', result: '相関 +0.35（反転は解消）／52%以下は出さない', tone: 'ok' as const },
  { label: 'リターンが出る時間帯', result: 'オーバーナイトに集中。日中(寄→引)はほぼゼロ', tone: 'ok' as const },
  { label: 'レバレッジと成績の関係', result: 'CAGR15〜20%とDD−40%は両立しない（20年R&D）', tone: 'warn' as const },
]

/** まだ分かっていないこと */
const UNKNOWN = [
  'AIの判断が対照群を上回るか … 実トレード2件（判定は30件・約7ヶ月先）',
  '確信度63%が実運用でも出るか … in-sample',
  'チャート画像が判断に効いているか … 未検証',
  '運用者の保有を読ませる意味があるか … 2026-08-13 から',
]

/** 数字（説明はしない。値だけ置く） */
const NUMBERS = [
  { name: '最大ドローダウン', value: '−46%（100万円 → 一時54万円）' },
  { name: 'オーバーナイト ／ 日中（26年・1倍）', value: '+11.07% ／ −4.90%（買い持ち +5.62%）' },
  { name: '引成で建てる（vs 翌朝の寄り）', value: 'CAGR +8.00% → +10.33%' },
  { name: '需給シグナル（TEV）52週', value: '全体47% → 五分五分ゲート後 63%（in-sample）' },
]

// 🔵 見出しは**毎レンダーで作り直さない**（コンポーネントの中で定義すると
//    描き直しのたびに別物になり、React が中身を捨てて作り直す）。
type TextProps = { c: { accent: string; sub: string }; isMobile: boolean; children: React.ReactNode }

const Head = ({ c, isMobile, children }: TextProps) => (
  <h3 style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: c.accent, letterSpacing: '0.06em', margin: '28px 0 10px' }}>{children}</h3>
)

export default function SwingResearchView({ theme, isMobile, onClose }: Props) {
  const c = basementColors(theme)
  const pad = isMobile ? 14 : 24
  const mono = BASEMENT_MONO

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.bg, color: c.text, position: 'relative' }}>
      <div aria-hidden style={concreteStyle(c.dark)} />
      <div aria-hidden className="bsmt-glow" style={BULB_GLOW} />

      <div style={{ position: 'sticky', top: 0, zIndex: 3, background: c.bg, borderBottom: `1px solid ${c.border}`, padding: `${pad / 2}px ${pad}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: isMobile ? 10 : 11, letterSpacing: '0.14em', color: c.accent }}>
          <span aria-hidden className="bsmt-glow" style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffd79a', boxShadow: '0 0 8px 3px rgba(255,205,130,0.5)', display: 'inline-block' }} />
          地下室 / スイングトレード
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる"
          style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: pad, position: 'relative' }}>
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, margin: '4px 0 6px' }}>スイングは成立するか</h1>
        <div style={{ fontFamily: mono, fontSize: 11, color: c.sub, marginBottom: 12 }}>2026-08-13 時点 ／ 対照群は約11年・需給シグナルは52週</div>

        <div style={{ padding: pad, border: `1px solid ${c.border}`, borderRadius: 10, background: c.card, marginBottom: 8 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, lineHeight: 1.8 }}>
            結論：<span style={{ color: c.ok }}>ルールとしては成立している。</span>
            <span style={{ color: c.trap }}>ただしAIがそれを上回るかは、まだ誰にも分からない。</span>
          </div>
        </div>

        <Head c={c} isMobile={isMobile}>分かっていること</Head>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {KNOWN.map((k, i) => (
            <div key={k.label} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 12, padding: '10px 12px', background: i % 2 ? 'transparent' : c.card, borderTop: i ? `1px solid ${c.border}` : 'none' }}>
              <div style={{ flex: isMobile ? undefined : '1 1 auto', fontSize: isMobile ? 12 : 13, fontWeight: 600 }}>
                <span style={{ color: k.tone === 'ok' ? c.ok : c.trap, marginRight: 6 }}>{k.tone === 'ok' ? '●' : '▲'}</span>
                {k.label}
              </div>
              <div style={{ flex: isMobile ? undefined : '0 0 300px', fontFamily: mono, fontSize: 11, color: c.sub }}>{k.result}</div>
            </div>
          ))}
        </div>

        <Head c={c} isMobile={isMobile}>まだ分かっていないこと</Head>
        <ul style={{ margin: 0, paddingLeft: '1.2em', fontSize: isMobile ? 12 : 13, lineHeight: 1.95, color: c.sub }}>
          {UNKNOWN.map((u) => <li key={u} style={{ marginBottom: 6 }}>{u.replace(/\*\*/g, '')}</li>)}
        </ul>

        <Head c={c} isMobile={isMobile}>数字</Head>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {NUMBERS.map((d, i) => (
            <div key={d.name} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? 2 : 12, padding: '9px 12px', background: i % 2 ? 'transparent' : c.card, borderTop: i ? `1px solid ${c.border}` : 'none', fontSize: isMobile ? 12 : 13 }}>
              <span>{d.name}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: c.sub }}>{d.value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: isMobile ? 12 : 13, fontWeight: 700, color: c.accent }}>
          30トレード貯まるまで、設計は動かさない。
        </div>

        <div style={{ marginTop: 24, padding: pad, border: `1px dashed ${c.border}`, borderRadius: 10, fontSize: isMobile ? 11 : 12, lineHeight: 1.9, color: c.sub }}>
          🔴 このページは研究の記録であり、売買の推奨ではありません。数値は特定期間の過去データにもとづくもので、将来の成果を示すものではありません。
        </div>
      </div>
    </div>
  )
}
