// 地下室 ＞ 研究記録〜デイトレード（2026-08-13）
//
// 🔴 このページは「デイトレのやり方」ではなく**測った結果の記録**。
//    ぽいロボの思想＝まず研究する。効かなかったことも、効かなかったと書いて残す。
//    都合の良い結果だけ残すと、半年後の自分が同じ道を2度歩く。
//
// 🔵 数字はすべて `scripts/analyze-intraday-bias.mjs` の実行結果。
//    条件を変えて測り直したら、ここも書き換える（測っていないことは書かない）。

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }

type Row = { label: string; n: string; result: string; verdict: 'no' | 'yes' | 'trap' }

const FINDINGS: Row[] = [
  { label: '上位足が上の日に買う（対照群がブルの日）', n: 'n=2,352', result: '平均 +0.010%／勝率 49.0%／t=0.57', verdict: 'no' },
  { label: '25日線の上／下で分ける', n: 'n=1,693 / 1,101', result: 'どちらも t<1', verdict: 'no' },
  { label: '前日が大きく動いた翌日', n: 'n=1,044 / 918', result: 'どちらも t<1', verdict: 'no' },
  { label: '寄りギャップの順張り（日経平均で計測）', n: 'n=1,446', result: '平均 +0.257%／勝率 57.3%／t=8.12', verdict: 'trap' },
  { label: '同じ条件を 1321（実物ETF）で計測', n: 'n=1,179', result: '平均 −0.010%／勝率 47.7%／t=−0.35', verdict: 'no' },
  { label: '寄り1時間の動き → その後（1時間足3年）', n: 'n=728', result: '平均 +0.007%／t=0.25', verdict: 'no' },
]

const DAY_TYPES = [
  { name: 'もみ合い（寄り＝引け付近）', share: '23.2%', mean: '±0.00%' },
  { name: '寄り底（寄って上げる）', share: '22.8%', mean: '+1.15%' },
  { name: '寄り天（寄って下げる）', share: '20.7%', mean: '−1.22%' },
  { name: '一本調子の上げ（高値引け）', share: '7.0%', mean: '+0.58%' },
  { name: '一本調子の下げ（安値引け）', share: '5.7%', mean: '−0.59%' },
]

export default function DaytradeResearchView({ theme, isMobile, onClose }: Props) {
  const dark = theme === 'dark'
  // 🔵 地下室の配色＝コンクリートの壁に裸電球ひとつ。青い研究室ではなく、
  //    「まだ形になっていないものが置いてある場所」の暖色＋薄暗さで統一する。
  const c = {
    bg: dark ? '#0b0c0e' : '#efece7',
    card: dark ? 'rgba(255,255,255,0.035)' : '#fff',
    border: dark ? 'rgba(255,205,130,0.16)' : '#ddd6c9',
    text: dark ? '#e6e0d5' : '#26221c',
    sub: dark ? '#9c9488' : '#5f584e',
    accent: dark ? '#ffd79a' : '#8a5a12',
    no: dark ? '#8a8378' : '#6b6459',
    trap: dark ? '#f0a94a' : '#a8650f',
  }
  const pad = isMobile ? 14 : 24
  const mono = "'Consolas','SF Mono',ui-monospace,monospace"

  const Head = ({ children }: { children: React.ReactNode }) => (
    <h3 style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: c.accent, letterSpacing: '0.06em', margin: '28px 0 10px' }}>{children}</h3>
  )
  const P = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: isMobile ? 12 : 13, lineHeight: 1.9, color: c.sub, margin: '0 0 10px' }}>{children}</p>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.bg, color: c.text, position: 'relative' }}>
      {/* コンクリートの目地（薄く敷くだけ。読みやすさを壊さない） */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', opacity: dark ? 1 : 0.6,
        backgroundImage: `linear-gradient(${dark ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.035)'} 1px, transparent 1px), linear-gradient(90deg, ${dark ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.035)'} 1px, transparent 1px)`,
        backgroundSize: '72px 34px',
      }} />
      {/* 裸電球の光（上からぼんやり） */}
      <div aria-hidden className="bsmt-glow" style={{
        position: 'fixed', left: '50%', top: 0, width: '120%', height: '52%', transform: 'translateX(-50%)',
        pointerEvents: 'none',
        background: 'radial-gradient(46% 60% at 50% 0%, rgba(255,205,130,0.16) 0%, rgba(255,205,130,0.05) 45%, transparent 74%)',
      }} />
      <div style={{ position: 'sticky', top: 0, zIndex: 3, background: c.bg, borderBottom: `1px solid ${c.border}`, padding: `${pad / 2}px ${pad}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: isMobile ? 10 : 11, letterSpacing: '0.14em', color: c.accent }}>
          <span aria-hidden className="bsmt-glow" style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ffd79a',
            boxShadow: '0 0 8px 3px rgba(255,205,130,0.5)', display: 'inline-block',
          }} />
          地下室 / 研究記録〜デイトレード
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる"
          style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: pad, position: 'relative' }}>
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, margin: '4px 0 6px' }}>デイトレは成立するか</h1>
        <div style={{ fontFamily: mono, fontSize: 11, color: c.sub, marginBottom: 6 }}>2026-08-13 計測 ／ 日経225・1321 の20年＋1時間足3年</div>
        <div style={{ fontSize: isMobile ? 11 : 12, color: c.sub, marginBottom: 16, lineHeight: 1.8 }}>
          ここは<strong style={{ color: c.accent }}>地下室</strong>——まだ人に見せる形になっていない研究を置いておく場所。
          効かなかったことも、効かなかったまま残す。
        </div>

        <div style={{ padding: pad, border: `1px solid ${c.border}`, borderRadius: 10, background: c.card, marginBottom: 8 }}>
          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, lineHeight: 1.8 }}>
            結論：<span style={{ color: c.trap }}>いま手に入るデータの範囲では、日計りの根拠は見つからなかった。</span>
          </div>
          <P>効きそうに見えたものは1つだけあったが、それは<strong>実際には買えない価格</strong>で計算していたための幻だった（下記）。</P>
        </div>

        <Head>測ったこと</Head>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {FINDINGS.map((f, i) => (
            <div key={f.label} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 2 : 12, padding: '10px 12px', background: i % 2 ? 'transparent' : c.card, borderTop: i ? `1px solid ${c.border}` : 'none' }}>
              <div style={{ flex: isMobile ? undefined : '1 1 auto', fontSize: isMobile ? 12 : 13, fontWeight: 600 }}>
                <span style={{ color: f.verdict === 'trap' ? c.trap : c.no, marginRight: 6 }}>{f.verdict === 'trap' ? '⚠' : '×'}</span>
                {f.label}
              </div>
              <div style={{ flex: isMobile ? undefined : '0 0 auto', fontFamily: mono, fontSize: 11, color: c.sub, whiteSpace: 'nowrap' }}>{f.n}</div>
              <div style={{ flex: isMobile ? undefined : '0 0 240px', fontFamily: mono, fontSize: 11, color: c.sub }}>{f.result}</div>
            </div>
          ))}
        </div>
        <P>※ t は「偶然ではない度合い」。<strong>2未満は誤差の範囲</strong>として扱い、採用しない。</P>

        <Head>いちばんの学び：指数で測ると勝てて、実物で測ると消える</Head>
        <P>
          寄りギャップの順張りは、日経平均で測ると <strong>+0.257%・勝率57.3%・t=8.12</strong> と強く出た。
          5年ごとに区切っても4区間すべてプラスで、安定しているように見えた。
        </P>
        <P>
          ところが同じ条件を <strong>1321（実際に売買するETF）</strong>で測ると <strong>−0.010%</strong> になり、消えた。
          理由は、日経平均の「始値」が225銘柄の寄り値を合成した数字で、<strong>実際には誰も取引できない価格</strong>だから。
          1321はひとつの銘柄として寄るので、寄り値にギャップが既に織り込まれている。
        </P>
        <P>
          🔴 <strong>指数でバックテストして実物で負ける</strong>、という典型的な罠。
          以後、日中の検証は必ず売買する銘柄そのもので測る。
        </P>

        <Head>1日の「型」の内訳（20年）</Head>
        <P>「いくつかの型に分かれるはず」という感覚は正しく、実際に分かれる。ただし<strong>これは終わってから分かる分類</strong>であって、予測ではない。</P>
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {DAY_TYPES.map((d, i) => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', background: i % 2 ? 'transparent' : c.card, borderTop: i ? `1px solid ${c.border}` : 'none', fontSize: isMobile ? 12 : 13 }}>
              <span>{d.name}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: c.sub, whiteSpace: 'nowrap' }}>{d.share}　寄→引 {d.mean}</span>
            </div>
          ))}
        </div>
        <P>
          寄り天（20.7%）と寄り底（22.8%）は<strong>ほぼ同数</strong>。どちらかに偏っているわけではない。
          寄りの時点の情報（ギャップ）で寄り天率は動く（大きく上に窓を開けた日は 20.7% → 8.1% に下がる）が、
          この偏りも <strong>1321で測ると取り分にならなかった</strong>。
        </P>

        <Head>なぜ日中は伸びないのか</Head>
        <P>
          1321の寄り→引けは20年で <strong>平均 −0.001%・勝率47.7%</strong>。ほぼコイン投げで、わずかに負け越す。
          これは日本株の既知の性質と整合する——<strong>上昇は夜間（前日の海外市場を受けた寄り付き）に集中し、日中はほぼゼロ</strong>。
          「寄りで買って引けで売る」は、儲かる時間帯を避けて儲からない時間帯だけを取りに行く形になる。
        </P>
        <P>
          🔵 ぽいロボが<strong>引け（15:00判断・引成執行）で建てる</strong>設計になっているのは、この性質と合っている。
        </P>

        <Head>これから（貯めているもの）</Head>
        <P>
          5分足は<strong>60日しか遡れない</strong>（過去に戻って買うこともできない）。
          そこで <strong>2026-08-13 から毎日保存を開始</strong>した（平日16:30・日経225／1321／1571）。
          15分・30分・1時間足は、この5分足から後で合成できる。
        </P>
        <P>
          1年貯まれば「寄り天の形を見て途中で降りる」「損切りを置く」といった、
          <strong>今日は測れなかった形</strong>を検証できる。それまでは根拠が無いので、
          リアルタイムのデータ契約も自動発注の口座変更も<strong>先に進めない</strong>。
        </P>

        <div style={{ marginTop: 24, padding: pad, border: `1px dashed ${c.border}`, borderRadius: 10, fontSize: isMobile ? 11 : 12, lineHeight: 1.9, color: c.sub }}>
          🔴 このページは研究の記録であり、売買の推奨ではありません。数値は特定期間の過去データにもとづくもので、将来の成果を示すものではありません。
        </div>
      </div>
    </div>
  )
}
