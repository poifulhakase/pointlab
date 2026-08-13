// 地下室 ＞ スイングトレード（2026-08-13）
//
// 🔴 ぽいロボ本体が扱っているのがこの時間軸。デイトレードと違い、**材料も検証も既にある**。
//    ここは「何が分かっていて、何がまだ分かっていないか」を1枚で見る場所。
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
  'AIの判断が対照群を上回るか … 実トレード2件。**30トレード（約7ヶ月）貯まるまで何も言えない**',
  '確信度63%が実運用でも出るか … 閾値を同じデータで決めたので、**実際はこれより低く出る**',
  'チャート画像が判断に効いているか … 日足・週足を渡しているが、**効果は未検証**',
  '運用者の保有を読ませる意味があるか … 2026-08-13 に読めるようにしたばかり',
]

export default function SwingResearchView({ theme, isMobile, onClose }: Props) {
  const c = basementColors(theme)
  const pad = isMobile ? 14 : 24
  const mono = BASEMENT_MONO

  const Head = ({ children }: { children: React.ReactNode }) => (
    <h3 style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: c.accent, letterSpacing: '0.06em', margin: '28px 0 10px' }}>{children}</h3>
  )
  const P = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: isMobile ? 12 : 13, lineHeight: 1.9, color: c.sub, margin: '0 0 10px' }}>{children}</p>
  )

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
        <div style={{ fontFamily: mono, fontSize: 11, color: c.sub, marginBottom: 6 }}>2026-08-13 時点 ／ 対照群は約11年・需給シグナルは52週</div>
        <div style={{ fontSize: isMobile ? 11 : 12, color: c.sub, marginBottom: 16, lineHeight: 1.8 }}>
          ぽいロボ本体が扱っているのがこの時間軸。デイトレードと違い、**材料も検証もある**。
          ここは<strong style={{ color: c.accent }}>何が分かっていて、何がまだ分からないか</strong>を1枚で見る場所。
        </div>

        <div style={{ padding: pad, border: `1px solid ${c.border}`, borderRadius: 10, background: c.card, marginBottom: 8 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, lineHeight: 1.8 }}>
            結論：<span style={{ color: c.ok }}>ルールとしては成立している。</span>
            <span style={{ color: c.trap }}>ただしAIがそれを上回るかは、まだ誰にも分からない。</span>
          </div>
          <P>対照群（決定論ルール）は11年で CAGR 13% を出している。AIの判断がその上を行くかは、実トレード30件が貯まるまで判定できない。</P>
        </div>

        <Head>分かっていること</Head>
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

        <Head>まだ分かっていないこと</Head>
        <ul style={{ margin: 0, paddingLeft: '1.2em', fontSize: isMobile ? 12 : 13, lineHeight: 1.95, color: c.sub }}>
          {UNKNOWN.map((u) => <li key={u} style={{ marginBottom: 6 }}>{u.replace(/\*\*/g, '')}</li>)}
        </ul>

        <Head>いちばん大事な数字</Head>
        <P>
          <strong>最大ドローダウン −46%</strong>。対照群は11年で CAGR 13% を出しているが、
          途中で<strong>資金が半分近くまで減る局面を通る</strong>。
          100万円なら一時的に54万円まで沈む計算で、そこで降りると成績は残らない。
          スイングで一番効くのは判断の精度ではなく、<strong>この谷を通り抜けられる金額で張ること</strong>。
        </P>

        <Head>なぜ引けで建てるのか</Head>
        <P>
          日本株のリターンは<strong>オーバーナイト（引け→翌日の寄り）に集中</strong>していて、
          日中（寄り→引け）はほぼゼロ。26年の実測で 1倍あたり
          オーバーナイト <strong>+11.07%</strong>／日中 <strong>−4.90%</strong>／買い持ち +5.62%。
          翌朝の寄りで建てると<strong>初日のオーバーナイトを丸ごと逃す</strong>ので、
          15:00に判断して<strong>引成で建てる</strong>形にしている（同じルールで実測 CAGR +8.00% → +10.33%）。
        </P>

        <Head>需給シグナル（TEV）の現在地</Head>
        <P>
          52週で全体47% → <strong>五分五分（確信度52%以下）を出さないようにして63%</strong>。
          🔴 ただし閾値を同じデータで決めているので、実運用ではこれより低く出る。
          見送った週も方向は記録し続けているので、標本が増えたら測り直せる。
        </P>

        <Head>これから</Head>
        <P>
          <strong>30トレード貯まるまで、設計は動かさない。</strong>
          途中でルールを変えると、それまでの記録が比較に使えなくなる。
          時間軸を変える（デイトレ化する）のも同じ理由で保留している。
        </P>

        <div style={{ marginTop: 24, padding: pad, border: `1px dashed ${c.border}`, borderRadius: 10, fontSize: isMobile ? 11 : 12, lineHeight: 1.9, color: c.sub }}>
          🔴 このページは研究の記録であり、売買の推奨ではありません。数値は特定期間の過去データにもとづくもので、将来の成果を示すものではありません。
        </div>
      </div>
    </div>
  )
}
