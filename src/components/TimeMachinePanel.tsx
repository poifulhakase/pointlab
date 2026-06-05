import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const mono = "'Courier New', Courier, monospace" as const
const AUTOPLAY_MS = 18000

// ── 物語データ（タイトル / 年号 / 物語 / 教訓）──────────────────────
type Story = { id: string; title: string; era: string; eraJa: string; body: string; lesson: string }
const STORIES: Story[] = [
  {
    id: 'shoeshine',
    title: '「靴磨きの少年」の法則',
    era: '1929 · WALL STREET', eraJa: '1920年代 アメリカ',
    body: 'ケネディ大統領の父ジョセフ・ケネディが、ウォール街で靴を磨いてもらっていた時のこと。靴磨きの少年までもが「この株がいい」と銘柄を勧めてきた。彼はその足で持ち株をすべて売り払い、直後に訪れた世界大恐慌を回避したと伝わる。',
    lesson: '株に縁のない人まで熱狂し始めたら、それは天井のサイン。',
  },
  {
    id: 'tulip',
    title: 'チューリップ・バブル',
    era: '1637 · NETHERLANDS', eraJa: '1637年 オランダ',
    body: '17世紀オランダで、一輪のチューリップの球根が職人の年収の何十倍もの値で取引された。人々は花ではなく「値上がり」を買っていた。ある日、買い手が忽然と消え、価格は一夜にして百分の一に。記録に残る世界最初の資産バブルである。',
    lesson: '値上がりだけを当てにした相場は、必ず崩れる。',
  },
  {
    id: 'southsea',
    title: '南海泡沫事件とニュートンの嘆き',
    era: '1720 · LONDON', eraJa: '1720年 イギリス',
    body: '万有引力を発見した天才ニュートンも、南海会社の株に投資して巨額の損失を被った。彼はこう嘆いたと伝わる——「天体の動きは計算できても、人々の狂気は計算できない」。',
    lesson: '知性も、群衆心理の前では無力になりうる。',
  },
  {
    id: 'honma',
    title: 'ローソク足を生んだ男・本間宗久',
    era: '18C · 出羽庄内', eraJa: '18世紀 日本',
    body: '出羽庄内の米商人・本間宗久は、価格の動きを「足跡」として図に記し、酒田五法と呼ばれる手法を編み出した。これが現代のローソク足チャートの原型となる。彼は相場は希望と恐怖で動くと説き、人の心理こそ最大の変数だと見抜いていた。',
    lesson: 'チャートとは、群衆の感情の記録である。',
  },
  {
    id: 'livermore',
    title: '世界恐慌を売り抜けた男・リバモア',
    era: '1929 · WALL STREET', eraJa: '1929年 ウォール街',
    body: '相場師ジェシー・リバモアは、誰もが熱狂する中で「下がる」方に賭けた。1929年の大暴落で彼は空売りにより巨万の富を築く。だが彼は同時に語る——「相場で最も難しいのは、正しいと分かっていて、ただ待つことだ」。',
    lesson: '人と逆を張る胆力と、待つ忍耐。その両方がいる。',
  },
  {
    id: 'buffett',
    title: '11歳の少年と複利の魔法',
    era: '1942 · USA', eraJa: '1942年 アメリカ',
    body: '11歳のウォーレン・バフェット少年は、初めて買った株がすぐ下がり、わずかに回復したところで売った。その後その株は何倍にも値上がりした。彼はこの失敗を生涯忘れず、優れた企業をただ長く持ち続ける力——複利の魔法を学んだ。',
    lesson: '時間を味方につけた者が、最後に勝つ。',
  },
  {
    id: 'gould',
    title: 'ジェイ・グールドの「地獄へ落ちろ」',
    era: '1869 · WALL STREET', eraJa: '1869年 アメリカ',
    body: '冷酷な相場師ジェイ・グールドは相棒ジム・フィスクと組み、金（ゴールド）市場を買い占めて価格を吊り上げた。破滅する者がいようと「地獄へ落ちろ」と意に介さない。そして暴騰の頂点、彼は相棒にすら告げず密かに売り抜けた。9月24日「暗黒の金曜日」、政府の金放出で相場は大暴落し、熱狂した群衆は破滅する——グールドだけが富を抱えて。',
    lesson: '操作された熱狂のなかでは、噂を信じた者から狩られる。',
  },
  {
    id: 'rothschild',
    title: 'ロスチャイルド「血が流れている時こそ買い」',
    era: '1815 · LONDON', eraJa: '1815年 イギリス',
    body: 'ワーテルローの戦いの帰趨を、ロスチャイルド家は伝書鳩でいち早く知ったと伝わる。ナポレオン敗北の報が市場に届く前、人々が最悪を恐れて売り急ぐなか、彼は静かに買い向かった。その信条はこうだ——「血が流れている時こそ買え。たとえ、その血が自分自身のものであっても」。',
    lesson: '極限の恐怖こそ、最大の好機が生まれる場所。',
  },
  {
    id: 'saladoil',
    title: '「大豆油の王」デアンジェリスの空タンク',
    era: '1963 · NEW YORK', eraJa: '1963年 アメリカ',
    body: '「サラダ油（大豆油）の王」と呼ばれたティノ・デアンジェリスは、巨大タンクの油を担保に巨額を借り、相場を吊り上げた。だがタンクの中身はほとんどが水で、油は表面に薄く浮かべただけ。検査をすり抜けて膨らませた幻の在庫が1963年に露見すると、相場は崩壊。仲買は次々と倒れ、関わったアメックスの株すら暴落した。',
    lesson: '担保や在庫の「中身」を確かめぬ熱狂は、底が抜ける。',
  },
  {
    id: 'mississippi',
    title: 'ミシシッピ計画とジョン・ロー',
    era: '1720 · FRANCE', eraJa: '1720年 フランス',
    body: 'スコットランド人ジョン・ローはフランスで紙幣制度を生み出し、北米ミシシッピ開発を担う会社の株を売り出した。莫大な利益を夢見た人々が殺到し、株価は数十倍に。にわか富豪が街にあふれ「ミリオネア（百万長者）」という言葉まで生まれた。だが幻の利益はやがて露見し、株は紙くずと化す。',
    lesson: '刷られた紙幣と夢が膨らませた相場は、いつか紙に戻る。',
  },
  {
    id: 'railway',
    title: '鉄道狂時代',
    era: '1840s · BRITAIN', eraJa: '1840年代 イギリス',
    body: '新技術「鉄道」の登場に、英国中が熱狂した。線路も通っていない計画段階の会社が次々と上場し、庶民から議員までが貯金を鉄道株につぎ込む。だが採算の取れない路線が大半で、ブームは崩壊。多くの家庭が財産を失った。',
    lesson: '革新は本物でも、それに群がる相場は別物である。',
  },
  {
    id: 'soros',
    title: 'ソロス「イングランド銀行を破った男」',
    era: '1992 · LONDON', eraJa: '1992年 イギリス',
    body: '英ポンドが実力以上に高く据え置かれていると見たジョージ・ソロスは、巨額のポンド売りを仕掛けた。イングランド銀行は買い支えたが、ついに力尽きて通貨防衛を放棄する。「ブラック・ウェンズデー」——彼はこの一撃で、わずか1日に約10億ドルを手にした。',
    lesson: '価格が実力から乖離した時、相場は容赦なく修正する。',
  },
  {
    id: 'hunt',
    title: 'ハント兄弟の銀（シルバー）買い占め',
    era: '1980 · USA', eraJa: '1980年 アメリカ',
    body: '大富豪ハント兄弟は世界中の銀を買い集め、価格を1年で10倍近くまで吊り上げた。市場を独占しかけたが、取引所が突如ルールを変更。価格は暴落し「シルバー・サーズデー」、彼らは巨万の富とともに転落した。',
    lesson: '市場を独り占めしようとする者を、市場は最後に振り落とす。',
  },
  {
    id: 'hetty',
    title: '「ウォール街の魔女」ヘティ・グリーン',
    era: '19–20C · USA', eraJa: '19〜20世紀 アメリカ',
    body: '当時世界一の女富豪ヘティ・グリーンは、皆が熱狂する時に売り、皆が恐怖で投げ売る時に買った。暖房さえ惜しむ徹底した倹約家。彼女は言う——「安く買って高く売る。誰もがそう口にするが、実際にやり通せる者は少ない」。',
    lesson: '逆張りと倹約。地味な規律こそ、富を残す。',
  },
  {
    id: 'mrmarket',
    title: 'グレアムと「ミスター・マーケット」',
    era: '1949 · USA', eraJa: '1949年 アメリカ',
    body: 'バフェットの師ベンジャミン・グレアムは、市場をこう例えた。あなたの事業の共同経営者「ミスター・マーケット」は気分屋で、毎日やって来ては値段を叫ぶ。ある日は熱狂して高値を、ある日は絶望して投げ売り値を。彼に従う必要はない。気が向いた時だけ利用すればいい。',
    lesson: '市場の気分は、従う相手ではなく利用する道具。',
  },
  {
    id: 'blackmonday',
    title: 'ブラックマンデー',
    era: '1987 · WALL STREET', eraJa: '1987年 アメリカ',
    body: '1987年10月19日、はっきりした理由もないまま、ニューヨーク市場は1日で−22.6%という史上最悪の暴落を記録した。下げが新たな売りを呼ぶプログラム売買が連鎖し、恐怖が一瞬で世界の市場を駆け巡った。',
    lesson: '理由なき暴落もある。下落を増幅する仕組みを侮るな。',
  },
  {
    id: 'leeson',
    title: 'リーソンとベアリングス銀行の崩壊',
    era: '1995 · SINGAPORE', eraJa: '1995年 シンガポール',
    body: 'たった一人のトレーダー、ニック・リーソンは、日経先物で出した損失を隠し口座に押し込み、取り返そうと賭けを膨らませ続けた。阪神大震災後の急落がとどめとなり、損失は約13億ドルに。232年続いた名門ベアリングス銀行は、わずか1ポンドで売却され消滅した。',
    lesson: '損を隠して取り返そうとする賭けが、すべてを飲み込む。',
  },
  {
    id: 'ltcm',
    title: '天才たちの誤算・LTCM破綻',
    era: '1998 · USA', eraJa: '1998年 アメリカ',
    body: 'ノーベル賞経済学者を擁したヘッジファンドLTCMは、精緻な数式で「ほぼありえない損失」まで計算し尽くしたはずだった。だがロシア危機という想定外が現実になると、巨大なレバレッジが牙をむく。天才集団は、わずか数週間で破綻した。',
    lesson: '数式が「ありえない」と呼ぶ事は、いつか必ず起きる。',
  },
  {
    id: 'korekawa',
    title: '是川銀蔵「最後の相場師」',
    era: '1982 · 日本', eraJa: '昭和 日本',
    body: '小学校しか出ていない是川銀蔵は、独学で経済を学び、徹底した現地調査で勝負した。住友金属鉱山の金鉱脈に目をつけて巨額の利益を上げる。「カネを追うな、価値を追え」と説いた彼は、戦後日本で「最後の相場師」と呼ばれた。',
    lesson: '群衆の噂ではなく、自分の足で確かめた事実に賭けよ。',
  },
  {
    id: 'jpbubble',
    title: '日本のバブルと日経3万8915円',
    era: '1989 · TOKYO', eraJa: '1989年 日本',
    body: '1989年の大納会、日経平均は史上最高値3万8915円をつけた。「土地は永遠に上がる」と誰もが信じ、東京の地価でアメリカ全土が買えるとまで言われた。だが、これが頂点だった。以後、日本は長い下落と低迷の時代へ沈んでいく。',
    lesson: '「今度こそ違う」と皆が信じた時が、たいてい天井。',
  },
  {
    id: 'btcpizza',
    title: 'ビットコイン・ピザ',
    era: '2010 · INTERNET', eraJa: '2010年 アメリカ',
    body: '2010年5月22日、あるプログラマーが1万ビットコインでピザ2枚を買った。当時の価値は約25ドル。だがその1万BTCは、のちに数百億円に化ける。この日は「ビットコイン・ピザ・デー」として、今も語り継がれている。',
    lesson: '価値は時とともに化ける。何を手放すかは慎重に。',
  },
  {
    id: 'gamestop',
    title: 'ゲームストップ・ミーム株騒動',
    era: '2021 · INTERNET', eraJa: '2021年 アメリカ',
    body: '経営不振のゲーム店ゲームストップ株を、ヘッジファンドは大量に空売りしていた。それに気づいた個人投資家たちがSNSで結束して買い上げ、株価は数十倍に暴騰。巨大ファンドは巨額損失を被り、「個人 対 プロ」の構図が世界の注目を集めた。',
    lesson: '結束した個人の群れは、時に巨人をも追い詰める。',
  },
]

// ── 背景の星（モジュール定数＝再レンダーで再ランダム化しない）────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const STARS = (() => {
  const rnd = mulberry32(20260606)
  return Array.from({ length: 70 }, () => ({
    x: rnd() * 100, y: rnd() * 100,
    r: 0.6 + rnd() * 1.8,
    d: 1.8 + rnd() * 3.4,   // twinkle duration
    delay: rnd() * 4,
  }))
})()
// ワープ線の角度（中心から放射）
const STREAKS = Array.from({ length: 16 }, (_, i) => (360 / 16) * i)

// 物語の表示順をシャッフル（Fisher–Yates）。開くたびに順番を変えて飽きを防ぐ
function shuffle<T>(arr: T[]): T[] {
  const r = [...arr]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

type C = { L: boolean; BG: string; HDRBG: string; ACCENT: string; DIM: string; TEXT: string; SUB: string; RULE: string; TAGBDR: string; STAR: string; GHOST: string; LESSONBG: string }
function makeC(theme: 'dark' | 'light'): C {
  const L = theme === 'light'
  return {
    L,
    BG:      L ? 'radial-gradient(ellipse at 50% 38%, #eaf3ff 0%, #d4e6fb 52%, #c2dbf6 100%)'
               : 'radial-gradient(ellipse at 50% 40%, #061229 0%, #030a18 55%, #01040c 100%)',
    HDRBG:   L ? 'rgba(245,250,255,0.82)' : 'rgba(3,8,20,0.74)',
    ACCENT:  L ? '#0369a1'                : '#00e5ff',
    DIM:     L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.50)',
    TEXT:    L ? 'rgba(10,30,70,0.94)'    : 'rgba(228,244,255,0.96)',
    SUB:     L ? 'rgba(28,60,120,0.74)'   : 'rgba(176,210,240,0.82)',
    RULE:    L ? 'rgba(3,105,161,0.18)'   : 'rgba(0,229,255,0.18)',
    TAGBDR:  L ? 'rgba(3,105,161,0.24)'   : 'rgba(0,229,255,0.20)',
    STAR:    L ? 'rgba(40,90,170,0.55)'   : 'rgba(190,230,255,0.95)',
    GHOST:   L ? 'rgba(3,105,161,0.10)'   : 'rgba(0,229,255,0.10)',
    LESSONBG:L ? 'rgba(3,105,161,0.07)'   : 'rgba(0,229,255,0.07)',
  }
}

// タイトルに「」がある時だけ、鉤括弧の前後にのみ改行機会(<wbr>)を挿入する。
// word-break:keep-all と併用し、変な位置での折り返しを防いで「」境界で改行させる。
function renderTitle(title: string): React.ReactNode {
  if (!title.includes('「') || !title.includes('」')) return title
  const nodes: React.ReactNode[] = []
  let buf = ''
  let k = 0
  const flush = () => { if (buf) { nodes.push(<span key={`s${k++}`}>{buf}</span>); buf = '' } }
  for (const ch of title) {
    if (ch === '「') { flush(); nodes.push(<wbr key={`b${k++}`} />); buf += ch }
    else if (ch === '」') { buf += ch; flush(); nodes.push(<wbr key={`b${k++}`} />) }
    else buf += ch
  }
  flush()
  return nodes
}

export function TimeMachinePanel({ theme, isMobile, onClose }: Props) {
  const c = makeC(theme)
  const total = STORIES.length
  // マウントごとにシャッフルした表示順（idx は order 上の位置）
  const [order] = useState(() => shuffle(STORIES.map((_, i) => i)))
  const [idx, setIdx] = useState(0)
  const [pulse, setPulse] = useState(0)     // ワープ演出のリプレイ用キー
  const [playing, setPlaying] = useState(true)
  const touchX = useRef<number | null>(null)

  const go = useCallback((n: number) => {
    const next = ((n % total) + total) % total
    setIdx(next)
    setPulse(p => p + 1)
  }, [total])

  // キーボード操作
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx, go, onClose])

  // 自動再生
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => go(idx + 1), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [idx, playing, go])

  const s = STORIES[order[idx]]
  // 年号背景に流す巨大数字（年号文字列から数字部分を抽出）
  const ghostNum = useMemo(() => {
    const m = s.era.match(/\d{3,4}/)
    return m ? m[0] : '∞'
  }, [s.era])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      background: c.BG, overflow: 'hidden',
      color: c.TEXT,
    }}>
      <style>{`
        @keyframes tm-twinkle { 0%,100%{opacity:.25} 50%{opacity:1} }
        @keyframes tm-streak  { 0%{height:0;opacity:0} 22%{opacity:.9} 100%{height:64vh;opacity:0} }
        @keyframes tm-flash   { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.85} 100%{transform:translate(-50%,-50%) scale(3.4);opacity:0} }
        @keyframes tm-ghost   { 0%{transform:translate(-50%,-50%) scale(2.7);opacity:0;filter:blur(16px)} 60%{opacity:1} 100%{transform:translate(-50%,-50%) scale(1);opacity:1;filter:blur(0)} }
        @keyframes tm-up      { 0%{opacity:0;transform:translateY(24px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes tm-drift   { 0%{transform:scale(1)} 100%{transform:scale(1.18)} }
        @keyframes tm-prog    { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
      `}</style>

      {/* ── 星空（常時ゆっくりドリフト）── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, animation: 'tm-drift 18s ease-in-out infinite alternate', pointerEvents: 'none' }}>
        {STARS.map((st, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${st.x}%`, top: `${st.y}%`,
            width: st.r, height: st.r, borderRadius: '50%', background: c.STAR,
            boxShadow: c.L ? 'none' : `0 0 ${st.r * 2}px ${c.STAR}`,
            animation: `tm-twinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
          }} />
        ))}
      </div>

      {/* ── ワープ演出（スライド切替のたびにリプレイ）── */}
      <div key={pulse} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        {/* 中心フラッシュ */}
        <div style={{
          position: 'absolute', left: '50%', top: '46%', width: isMobile ? 120 : 200, height: isMobile ? 120 : 200,
          borderRadius: '50%', background: `radial-gradient(circle, ${c.ACCENT}cc 0%, ${c.ACCENT}33 40%, transparent 70%)`,
          animation: 'tm-flash 1.1s ease-out forwards',
        }} />
        {/* 放射状のワープ線 */}
        {STREAKS.map((deg, i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '46%', width: 2, height: 0,
            transformOrigin: 'top center', transform: `rotate(${deg}deg)`,
            background: `linear-gradient(to bottom, ${c.ACCENT}, transparent)`,
            animation: `tm-streak 1.1s cubic-bezier(.2,.7,.3,1) ${(i % 4) * 0.03}s forwards`,
          }} />
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{
        position: 'relative', zIndex: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '11px 16px' : '12px 28px',
        background: c.HDRBG, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${c.RULE}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap' }}>
          ぽいロボ ▸ タイムマシン
        </span>
        <button onClick={() => setPlaying(p => !p)} aria-label={playing ? '一時停止' : '再生'} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7,
          cursor: 'pointer', border: `1px solid ${c.TAGBDR}`, background: 'transparent', color: c.DIM, flexShrink: 0,
        }}>
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>
          )}
        </button>
        <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>{idx + 1} / {total}</span>
        <button onClick={onClose} aria-label="閉じる" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
          border: `1px solid ${c.TAGBDR}`, background: 'transparent', color: c.DIM, flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── 自動再生プログレスバー ── */}
      <div style={{ position: 'relative', zIndex: 6, flexShrink: 0, height: 2, background: c.RULE }}>
        <div key={`${idx}-${pulse}-${playing}`} style={{
          height: '100%', background: c.ACCENT, transformOrigin: 'left center',
          boxShadow: c.L ? 'none' : `0 0 8px ${c.ACCENT}`,
          animation: playing ? `tm-prog ${AUTOPLAY_MS}ms linear forwards` : 'none',
          transform: playing ? undefined : 'scaleX(0)',
        }} />
      </div>

      {/* ── ステージ ── */}
      <div
        style={{ position: 'relative', flex: 1, zIndex: 2, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchX.current == null) return
          const d = touchX.current - e.changedTouches[0].clientX
          if (Math.abs(d) > 50) go(idx + (d > 0 ? 1 : -1))
          touchX.current = null
        }}
      >
        {/* 巨大な年号（奥から飛来） */}
        <div key={`ghost-${pulse}`} style={{
          position: 'absolute', left: '50%', top: '44%', zIndex: 0,
          fontSize: isMobile ? 120 : 260, fontWeight: 800, fontFamily: mono, lineHeight: 1,
          color: c.GHOST, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          animation: 'tm-ghost 1.4s cubic-bezier(.2,.8,.2,1) forwards',
        }}>{ghostNum}</div>

        {/* テキスト（タイトル / 年号 / 物語 / 教訓）── idx でリマウントしフェードイン */}
        <div key={`content-${idx}`} style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: isMobile ? 560 : 760,
          padding: isMobile ? '0 26px' : '0 48px', textAlign: 'center',
        }}>
          <div style={{
            fontSize: isMobile ? 10 : 12, fontFamily: mono, letterSpacing: '0.26em', color: c.ACCENT,
            fontWeight: 700, marginBottom: isMobile ? 14 : 18,
            textShadow: c.L ? 'none' : `0 0 12px ${c.ACCENT}66`,
            animation: 'tm-up .9s ease-out .1s both',
          }}>{s.era}<span style={{ margin: '0 10px', opacity: 0.6 }}>·</span>{s.eraJa}</div>

          <h2 style={{
            fontSize: isMobile ? 24 : 38, fontWeight: 800, lineHeight: 1.25, color: c.TEXT,
            margin: 0, letterSpacing: '0.01em',
            wordBreak: s.title.includes('「') ? 'keep-all' : undefined,
            overflowWrap: 'anywhere',
            textShadow: c.L ? 'none' : '0 2px 24px rgba(0,0,0,0.4)',
            animation: 'tm-up .9s ease-out .28s both',
          }}>{renderTitle(s.title)}</h2>

          <p style={{
            fontSize: isMobile ? 13.5 : 16.5, lineHeight: 1.95, color: c.SUB,
            margin: isMobile ? '20px auto 0' : '28px auto 0', maxWidth: 640, textAlign: 'left',
            animation: 'tm-up 1s ease-out .5s both',
          }}>{s.body}</p>

          <div style={{
            display: 'inline-block', marginTop: isMobile ? 22 : 30,
            padding: isMobile ? '11px 18px' : '13px 24px', borderRadius: 12,
            background: c.LESSONBG, border: `1px solid ${c.TAGBDR}`, borderLeft: `3px solid ${c.ACCENT}`,
            fontSize: isMobile ? 12.5 : 14.5, fontWeight: 700, color: c.TEXT, lineHeight: 1.6,
            animation: 'tm-up 1s ease-out .75s both',
          }}>
            <span style={{ color: c.ACCENT, fontFamily: mono, fontSize: isMobile ? 9.5 : 10.5, letterSpacing: '0.14em', marginRight: 10 }}>教訓</span>
            {s.lesson}
          </div>
        </div>
      </div>

      {/* ── コントロール（前 / ドット / 次）── */}
      <div style={{ position: 'relative', zIndex: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 16 : 22, padding: isMobile ? '12px 12px 16px' : '16px 0 20px' }}>
        <button onClick={() => go(idx - 1)} aria-label="前の物語" style={ctrlBtn(c, false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(90deg)' }}><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {order.map((storyIdx, i) => (
            <button key={STORIES[storyIdx].id} onClick={() => go(i)} aria-label={`${i + 1}番目へ`} style={{
              width: i === idx ? 24 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0,
              background: i === idx ? c.ACCENT : c.TAGBDR, cursor: 'pointer',
              boxShadow: i === idx && !c.L ? `0 0 8px ${c.ACCENT}` : 'none',
              transition: 'all .4s cubic-bezier(.22,1,.36,1)',
            }} />
          ))}
        </div>

        <button onClick={() => go(idx + 1)} aria-label="次の物語" style={ctrlBtn(c, true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-90deg)' }}><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>
    </div>
  )
}

function ctrlBtn(c: C, primary: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: primary ? 46 : 40, height: primary ? 46 : 40, borderRadius: '50%', flexShrink: 0,
    border: `1px solid ${c.TAGBDR}`,
    background: primary ? (c.L ? 'rgba(3,105,161,0.10)' : 'rgba(0,229,255,0.10)') : 'transparent',
    color: primary ? c.ACCENT : c.DIM, cursor: 'pointer',
    boxShadow: primary && !c.L ? `0 0 14px ${c.ACCENT}33` : 'none',
  }
}
