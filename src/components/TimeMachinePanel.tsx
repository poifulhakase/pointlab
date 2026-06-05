import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const mono = "'Courier New', Courier, monospace" as const
const AUTOPLAY_MS = 9000

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
    id: 'urakaido',
    title: '人の行く裏に道あり花の山',
    era: 'EDO · 米相場', eraJa: '江戸時代 米相場',
    body: '誰もが群がる花見のメインストリート（人気の投資先）をあえて避け、人が見向きもしない裏道にこそ大きな利益が眠っている——江戸の米相場から伝わる、最も有名な相場格言のひとつ。「いずれを行くも散らぬ間に」と結ばれる。',
    lesson: '群衆と逆を行く勇気が、最大の果実を生む。',
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
    id: 'rumor',
    title: '噂で買って、事実で売れ',
    era: 'MARKET PROVERB', eraJa: '相場格言',
    body: '好材料は「期待」の段階で買われ、実際に発表された瞬間にはもう価格に織り込まれている。だから噂が広がる初動で仕込み、事実が出て皆が飛びつく頃には静かに降りる——相場の先回りを説いた古い知恵。',
    lesson: '相場は、現実ではなく「予想」を取引している。',
  },
  {
    id: 'matsu',
    title: '待つも相場',
    era: 'MARKET PROVERB', eraJa: '相場格言',
    body: '常に売買していなければ気が済まない——それが多くの人を負けへ導く。好機が訪れるまで何もせずに待つこと、それ自体がひとつの立派な戦略である、という戒め。「休むも相場」とも言う。',
    lesson: '何もしない勇気が、資産を守る。',
  },
  {
    id: 'mikiri',
    title: '見切り千両',
    era: 'MARKET PROVERB', eraJa: '相場格言',
    body: '損失を抱えた時、潔く損切りできる判断には千両の価値がある——という意味。人は「いつか戻る」と願って傷を広げてしまう。素早く見切る決断こそ、相場で生き残る者の条件だと説く。',
    lesson: '損を認める速さが、退場を防ぐ。',
  },
  {
    id: 'eggs',
    title: '卵は一つの籠に盛るな',
    era: 'INVESTMENT PROVERB', eraJa: '投資格言',
    body: 'すべての卵を一つの籠に入れれば、籠を落とした時に全部割れる。資産も同じで、一つの銘柄・一つの市場に集中させれば、それが崩れた時にすべてを失う。分散こそが、読めない未来への最も確実な備えだという教え。',
    lesson: '分散は、未来が読めないことへの唯一の保険。',
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
          animation: 'tm-flash .7s ease-out forwards',
        }} />
        {/* 放射状のワープ線 */}
        {STREAKS.map((deg, i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '46%', width: 2, height: 0,
            transformOrigin: 'top center', transform: `rotate(${deg}deg)`,
            background: `linear-gradient(to bottom, ${c.ACCENT}, transparent)`,
            animation: `tm-streak .72s cubic-bezier(.2,.7,.3,1) ${(i % 4) * 0.02}s forwards`,
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
          animation: 'tm-ghost .9s cubic-bezier(.2,.8,.2,1) forwards',
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
            animation: 'tm-up .6s ease-out .05s both',
          }}>{s.era}<span style={{ margin: '0 10px', opacity: 0.6 }}>·</span>{s.eraJa}</div>

          <h2 style={{
            fontSize: isMobile ? 24 : 38, fontWeight: 800, lineHeight: 1.25, color: c.TEXT,
            margin: 0, letterSpacing: '0.01em',
            textShadow: c.L ? 'none' : '0 2px 24px rgba(0,0,0,0.4)',
            animation: 'tm-up .6s ease-out .14s both',
          }}>{s.title}</h2>

          <p style={{
            fontSize: isMobile ? 13.5 : 16.5, lineHeight: 1.95, color: c.SUB,
            margin: isMobile ? '20px auto 0' : '28px auto 0', maxWidth: 640, textAlign: 'left',
            animation: 'tm-up .7s ease-out .26s both',
          }}>{s.body}</p>

          <div style={{
            display: 'inline-block', marginTop: isMobile ? 22 : 30,
            padding: isMobile ? '11px 18px' : '13px 24px', borderRadius: 12,
            background: c.LESSONBG, border: `1px solid ${c.TAGBDR}`, borderLeft: `3px solid ${c.ACCENT}`,
            fontSize: isMobile ? 12.5 : 14.5, fontWeight: 700, color: c.TEXT, lineHeight: 1.6,
            animation: 'tm-up .7s ease-out .4s both',
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
