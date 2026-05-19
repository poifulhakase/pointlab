import type { FC } from 'react'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onBack: () => void
}

const ARMS = [
  { code: 'RADAR',   ja: 'レーダー', desc: '市場ルールがもたらす時間の歪みや、アノマリーを事前に察知する。',             accent: '#34d399' },
  { code: 'ENGINE',  ja: 'エンジン', desc: '複雑なクオンツ・需給データをAIプロンプトへ一瞬で錬成する。',               accent: '#00e5ff' },
  { code: 'SHIELD',  ja: 'シールド', desc: '証券口座の現実をシステムに直視させ、背中のリスクを徹底的に守る。',           accent: '#60a5fa' },
  { code: 'CONNECT', ja: 'コネクト', desc: '開発者（博士）の視点と思想をリアルタイムで同期し、孤独を消し去る。',         accent: '#a78bfa' },
]

type Section = {
  num: string; ja: string; en: string
  title: string; paragraphs: string[]
  arms?: true; final?: true
}

const SECTIONS: Section[] = [
  {
    num:'01', ja:'覚醒', en:'THE AWAKENING',
    title:'投資を「設計」するOSが、目を覚ます。',
    paragraphs:[
      '相場に「勘」で挑む時代は、終わった。',
      'ぽいロボは、需給という名の物理法則と、AIという名の知能を融合させた、まったく新しい投資OSだ。',
      '直感ではなく、設計で勝つ。',
    ],
  },
  {
    num:'02', ja:'哲学', en:'PHILOSOPHY',
    title:'感情は、最も精巧に設計された罠だ。',
    paragraphs:[
      '期待、恐怖、執着、そして根拠のない希望。それらは人間の本能であり、同時に、すべての判断を狂わせる致命的なノイズでもある。',
      'ぽいロボが求めるのは、感情の「抑制」ではない。',
      '感情を最初から「設計の外側に置く」、冷徹なアーキテクトの視点だ。',
    ],
  },
  {
    num:'03', ja:'唯一の真実', en:'THE ONLY TRUTH',
    title:'ニュースや噂は、すべてノイズだ。',
    paragraphs:[
      '相場を動かす唯一の真実は、金の流れだけだ。',
      '買い手と売り手の圧倒的な需給。裏側で蠢く資金の偏り、清算のプレッシャー、アノマリーの重力。',
      'ぽいロボは、市場の表面ではなく、その深部に流れる「不可視の力学」だけを信じる。',
    ],
  },
  {
    num:'04', ja:'知能同期', en:'TRI-BRAIN OVERLAY',
    title:'人間の脳を、三重に拡張する。',
    paragraphs:[
      '複雑なクオンツデータを、単独の人間の脳で処理することには限界がある。',
      'ぽいロボは、状況に応じて最先端のAIを自在に切り替え、深層シナリオの構築、リスクの定量化、冷徹な執行判断を、集合知として実行する。',
      'あなたの意思決定は、もう孤独ではない。',
    ],
  },
  {
    num:'05', ja:'戦略兵装', en:'SYSTEM ARMS',
    title:'4つの兵装が、感情の侵入を完全に遮断する。',
    paragraphs:[], arms: true,
  },
  {
    num:'06', ja:'索敵', en:'THE RADAR',
    title:'相場の「重力異常」を、先に知る。',
    paragraphs:[
      'SQ、配当落ち、権利確定。市場のシステムが価格を「強制的に歪める」特異点は、事前に地図として描ける。',
      'ぽいロボは、それを「待ち伏せ座標」として事前にマッピングする。',
      '暴風雨を恐れて逃げるのではなく、嵐が来る場所を先に知り、そこに罠を張れ。',
    ],
  },
  {
    num:'07', ja:'錬成', en:'THE ENGINE',
    title:'膨大なデータを、一瞬で「弾薬」に変える。',
    paragraphs:[
      '先物建玉の変化、投資主体別の資金フロー、信用倍率の歪み。それらは単体では「情報」に過ぎない。',
      'ぽいロボエンジンは、それらをAIが即座に解析できる「構造化された弾薬」へと錬成する。',
      'インターフェースが、すべての手間を消し去る。あなたは、引き金を引くだけでいい。',
    ],
  },
  {
    num:'08', ja:'堅守', en:'THE SHIELD',
    title:'生き残ることが、唯一の絶対条件だ。',
    paragraphs:[
      'エントリーは、誰でもできる。問題は、エグジットだ。欲と恐怖が100%支配するその瞬間に、ぽいロボは「現実の数字」を直視することを要求する。',
      'ポジションのスクリーンショット。生の損益。感情が塗り替えようとするその現実を、システムに直視させる。',
      '守りを固め、生き残れ。資産形成に、他の絶対条件は存在しない。',
    ],
  },
  {
    num:'09', ja:'共鳴', en:'THE CONNECT',
    title:'孤独なトレードは、今日で終わる。',
    paragraphs:[
      '投資とは本来、孤独な精神戦だ。誰も助けてくれず、答えは市場だけが知っている。',
      'ぽいロボ コネクトは、その孤独に終止符を打つために存在する。',
      '同じ思想、同じ規律を持つ設計者たちが集い、画面の向こうの開発者（博士）と戦術をリアルタイムで同期する。',
      'これは、ツールではない。孤独を消し去るための「知の伴走空間」だ。',
    ],
  },
  {
    num:'10', ja:'設計者', en:'THE ARCHITECT',
    title:'今日から、あなたは設計者だ。',
    paragraphs:[
      '勘で張る者は、いつか必ず市場に飲み込まれる。',
      'ぽいロボは、需給という物理法則を武器に、AIという知能を補助脳に、4つの兵装を盾に、相場という戦場を「設計」するためのOSだ。',
      '感情の時代は、終わった。',
      '設計の時代が、始まる。',
    ],
    final: true,
  },
]

export const PoiroboAboutPanel: FC<Props> = ({ theme, isMobile, onBack }) => {
  const L = theme === 'light'

  const c = {
    HDRBG:  L ? 'rgba(228,242,255,0.97)' : 'rgba(3,9,22,0.97)',
    BG:     L ? 'rgba(218,236,255,0.92)' : 'rgba(3,10,24,0.92)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.52)',
    NUM:    L ? 'rgba(3,105,161,0.06)'   : 'rgba(0,215,255,0.07)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.12)'   : 'rgba(0,200,255,0.10)',
    TAGBG:  L ? 'rgba(3,105,161,0.07)'   : 'rgba(0,200,255,0.06)',
    TAGBDR: L ? 'rgba(3,105,161,0.26)'   : 'rgba(0,200,255,0.22)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    GLOW:   L ? 'none'                   : '0 0 14px rgba(0,229,255,0.55)',
  }

  const mono = "'Courier New', Courier, monospace" as const
  const numSize = isMobile ? 88 : 120

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:30,
      overflow:'hidden',
      background: c.BG,
      backgroundImage: c.SCAN,
      backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)',
    }}>
      <style>{`
        @keyframes pabFadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pabSweep  { from { transform:translateY(-100%); } to { transform:translateY(250%); } }
        @keyframes pabBlink  { 0%,44%{ opacity:1; } 46%,100%{ opacity:0.15; } }
        .pab-s { opacity:0; animation: pabFadeUp .60s cubic-bezier(.16,1,.3,1) forwards; }
      `}</style>

      {/* Scan sweep (dark only) */}
      {!L && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
          <div style={{
            position:'absolute', left:0, right:0, height:'26%',
            background:'linear-gradient(to bottom,transparent 0%,rgba(0,229,255,0.024) 50%,transparent 100%)',
            animation:'pabSweep 11s linear infinite',
          }} />
        </div>
      )}

      {/* Scroll container */}
      <div style={{ position:'absolute', inset:0, overflowY:'auto', zIndex:1 }}>

        {/* ── Sticky header ── */}
        <div style={{
          position:'sticky', top:0, zIndex:5,
          display:'flex', alignItems:'center', gap:10,
          padding: isMobile ? '10px 16px' : '12px 28px',
          background: c.HDRBG,
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          borderBottom:`1px solid ${c.RULE}`,
        }}>
          <button
            onClick={onBack}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'5px 12px', borderRadius:5,
              border:`1px solid ${c.TAGBDR}`, background:c.TAGBG,
              color:c.ACCENT, fontSize:10, fontWeight:700,
              letterSpacing:'0.15em', cursor:'pointer',
              fontFamily: mono, textShadow: c.GLOW,
              flexShrink:0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            BACK
          </button>
          <div style={{ width:1, height:18, background:c.RULE, flexShrink:0 }} />
          <span style={{
            fontSize:10, fontWeight:700, letterSpacing:'0.24em',
            color:c.DIM, fontFamily: mono, whiteSpace:'nowrap',
            textShadow: L ? 'none' : '0 0 10px rgba(0,229,255,0.28)',
          }}>
            POIROBO_OS ▸ ABOUT
          </span>
          <div style={{ flex:1, height:1, background:`linear-gradient(to right,${c.RULE},transparent)` }} />
          <span style={{ fontSize:9, color:c.SUB, fontFamily: mono, flexShrink:0, letterSpacing:'0.06em' }}>v2.0</span>
        </div>

        {/* ── Content ── */}
        <div style={{
          maxWidth: isMobile ? '100%' : 680,
          margin:'0 auto',
          padding: isMobile ? '16px 20px 100px' : '24px 56px 120px',
        }}>
          {SECTIONS.map((sec, i) => (
            <div
              key={sec.num}
              className="pab-s"
              style={{ animationDelay:`${i * 48}ms` }}
            >
              {/* ── Section header block ── */}
              <div style={{
                paddingTop: i === 0 ? (isMobile ? 20 : 28) : (isMobile ? 52 : 72),
                paddingBottom: isMobile ? 20 : 28,
              }}>
                {/* Giant number watermark */}
                <div style={{
                  fontFamily: mono,
                  fontSize: numSize,
                  fontWeight:900,
                  lineHeight:1,
                  color: c.NUM,
                  letterSpacing:'-0.04em',
                  userSelect:'none',
                  marginBottom: isMobile ? -16 : -22,
                  marginLeft: -4,
                }}>
                  {sec.num}
                </div>

                {/* EN label */}
                <div style={{
                  fontSize: isMobile ? 10 : 11,
                  fontWeight:800,
                  color: c.ACCENT,
                  letterSpacing:'0.32em',
                  fontFamily: mono,
                  textTransform:'uppercase',
                  textShadow: c.GLOW,
                  marginBottom:4,
                }}>
                  {sec.en}
                </div>

                {/* JA label */}
                <div style={{
                  fontSize:10,
                  color: c.SUB,
                  letterSpacing:'0.16em',
                  fontFamily: mono,
                  marginBottom: isMobile ? 18 : 24,
                }}>
                  {sec.ja}
                </div>

                {/* Thin rule */}
                <div style={{
                  height:1,
                  background:`linear-gradient(to right, ${c.ACCENT} 0%, ${c.RULE} 40%, transparent 80%)`,
                  opacity: L ? 0.30 : 0.38,
                  marginBottom: isMobile ? 20 : 28,
                }} />

                {/* Section title */}
                <p style={{
                  margin:`0 0 ${isMobile ? 14 : 18}px`,
                  fontSize: isMobile ? 20 : 26,
                  fontWeight:700,
                  color: c.TEXT,
                  lineHeight:1.30,
                  letterSpacing:'0.01em',
                }}>
                  {sec.title}
                </p>

                {/* Body */}
                {sec.paragraphs.map((p, pi) => (
                  <p key={pi} style={{
                    margin: pi < sec.paragraphs.length - 1 ? `0 0 ${isMobile ? 9 : 11}px` : '0',
                    fontSize: isMobile ? 13 : 15,
                    color: c.SUB,
                    lineHeight:1.92,
                    letterSpacing:'0.02em',
                  }}>
                    {p}
                  </p>
                ))}

                {/* ── Arms list (sec 05) ── */}
                {sec.arms && (
                  <div style={{
                    marginTop: isMobile ? 22 : 28,
                    display:'flex', flexDirection:'column', gap:0,
                  }}>
                    {ARMS.map((arm, ai) => (
                      <div key={arm.code} style={{
                        paddingTop: isMobile ? 16 : 20,
                        paddingBottom: isMobile ? 16 : 20,
                        borderTop: ai === 0
                          ? `1px solid ${c.RULE}`
                          : `1px solid ${c.RULE}`,
                        borderBottom: ai === ARMS.length - 1
                          ? `1px solid ${c.RULE}`
                          : 'none',
                        display:'flex', flexDirection:'column', gap: isMobile ? 6 : 7,
                      }}>
                        {/* Code + name row */}
                        <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                          <span style={{
                            fontSize: isMobile ? 9 : 10,
                            fontWeight:900,
                            color: arm.accent,
                            letterSpacing:'0.22em',
                            fontFamily: mono,
                            textShadow: L ? 'none' : `0 0 10px ${arm.accent}`,
                            flexShrink:0,
                          }}>
                            {arm.code}
                          </span>
                          <span style={{
                            fontSize: isMobile ? 14 : 16,
                            fontWeight:700,
                            color: c.TEXT,
                            letterSpacing:'0.04em',
                          }}>
                            {arm.ja}
                          </span>
                        </div>
                        {/* Desc */}
                        <p style={{
                          margin:0,
                          fontSize: isMobile ? 12 : 13,
                          color: c.SUB,
                          lineHeight:1.82,
                          letterSpacing:'0.02em',
                          paddingLeft: isMobile ? 0 : 2,
                        }}>
                          {arm.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── SYSTEM ONLINE (sec 10) ── */}
                {sec.final && (
                  <div style={{
                    marginTop: isMobile ? 40 : 56,
                    display:'flex', flexDirection:'column', alignItems:'center', gap:32,
                  }}>
                    {/* Divider */}
                    <div style={{
                      width:'100%', height:1,
                      background:`linear-gradient(to right,transparent,${c.ACCENT},transparent)`,
                      opacity: L ? 0.25 : 0.30,
                    }} />

                    {/* Badge */}
                    <div style={{
                      position:'relative',
                      padding: isMobile ? '14px 32px' : '16px 44px',
                      border:`1px solid ${c.ACCENT}`,
                      background: L ? 'rgba(3,105,161,0.06)' : 'rgba(0,229,255,0.04)',
                      boxShadow: L
                        ? '0 0 24px rgba(3,105,161,0.14)'
                        : '0 0 40px rgba(0,229,255,0.18), 0 0 80px rgba(0,229,255,0.07)',
                      display:'inline-flex', alignItems:'center', gap:14,
                    }}>
                      {/* Corner deco */}
                      <span style={{ position:'absolute', top:-2, left:-2, width:12, height:12, borderTop:`2px solid ${c.ACCENT}`, borderLeft:`2px solid ${c.ACCENT}`, opacity: L ? 0.7 : 1 }} />
                      <span style={{ position:'absolute', bottom:-2, right:-2, width:12, height:12, borderBottom:`2px solid ${c.ACCENT}`, borderRight:`2px solid ${c.ACCENT}`, opacity: L ? 0.7 : 1 }} />

                      <div style={{ width:6, height:6, borderRadius:'50%', background:c.ACCENT, boxShadow:`0 0 8px ${c.ACCENT}`, animation:'pabBlink 1.5s ease-in-out infinite', flexShrink:0 }} />
                      <span style={{
                        fontSize: isMobile ? 13 : 15,
                        fontWeight:900, letterSpacing:'0.34em',
                        color: c.ACCENT, fontFamily: mono,
                        textShadow: L ? 'none' : '0 0 20px rgba(0,229,255,0.70)',
                      }}>
                        SYSTEM ONLINE
                      </span>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:c.ACCENT, boxShadow:`0 0 8px ${c.ACCENT}`, animation:'pabBlink 1.5s ease-in-out infinite .75s', flexShrink:0 }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
