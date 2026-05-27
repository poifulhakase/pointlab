import { useState, useRef, useEffect, type FC } from 'react'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

type SubSection = { subtitle: string; items: string[] }
type Section = {
  id: string
  icon: string
  title: string
  tocLabel?: string
  intro?: string[]
  items?: string[]
  subs?: SubSection[]
  wide?: boolean
}

const SECTIONS: Section[] = [
  {
    id: 'calendar',
    icon: '📅',
    title: 'カレンダー',
    items: [
      '画面下のナビバーにある「カレンダー」アイコンをタップすると表示されます。',
      '上部のタブで「月・週・日」の3つのビューを切り替えられます。',
      '配当落ち日・SQ日・FOMC など、相場に影響するイベントが自動でカレンダーに表示されます。',
      '日付をタップするとメモパネルが開きます。自由記述のメモやチェックリストのほか、時間帯を指定したスケジュールを複数登録できます。タイトルを入力せずに閉じると空のスケジュールは自動で削除されます。',
      '週・日ビューでは、登録したスケジュールが時間グリッド上に帯として表示されます。',
      '画面左のサイドバーには付箋メモ欄があります。どのビューからでもすぐに書き留められる簡易メモです（最大1件）。',
    ],
  },
  {
    id: 'chart',
    icon: '📈',
    title: 'チャート',
    items: [
      '画面下のナビバーにある「チャート」アイコンをタップすると表示されます。',
      '日経225・ドル円・米国債（10年利回り）の TradingView チャートを表示できます。上部のタブで切り替えてください。',
      '右上の分割ボタンで1画面 / 2画面を切り替えられます。2画面では2つのチャートを並べて確認できます（スマートフォンは1画面固定）。',
    ],
  },
  {
    id: 'engine',
    icon: '📊',
    title: 'エンジン（需給分析）',
    tocLabel: 'エンジン',
    wide: true,
    intro: [
      '画面下のナビバーにある「エンジン」アイコンをタップすると表示されます。',
      '「分析・環境・現物・先物」の4つのタブで切り替えられます。',
    ],
    subs: [
      {
        subtitle: '分析タブ',
        items: [
          '「ぽいロボ エンジン」エリアの「クオンツ分析用プロンプト＋需給データをコピー」ボタンを押すと需給データ入りのプロンプトがコピーされます。Gemini・Claude・ChatGPT・DeepSeek などの AI に貼り付けて分析を依頼してください。右側のテキストエリアは AI 分析レポートを保存するメモ欄です。',
          '分析レポートを保存するとプレビューモードに切り替わります。「確信度：XX%」「判定：〜」の行がシアン色でハイライトされます。「全選択」ボタンでテキスト全体をコピーできます。',
          'AI 出力には「慣性持続性」（強持続 / 中持続 / 枯渇圏）が含まれます。需給エネルギーがあと何週持続しそうかの指標です。「枯渇圏」の場合は本命エントリーは控えてください。',
        ],
      },
      {
        subtitle: '環境タブ',
        items: [
          'VIX（恐怖指数）・NS倍率のチャートと、ドル円の日次推移テーブルを表示します。',
        ],
      },
      {
        subtitle: '現物タブ',
        items: [
          '信用倍率・投資主体別の売買動向・騰落レシオ・空売り比率・裁定買い残のほか、日経平均の銘柄別寄与度と業種別騰落率（東証33業種）を確認できます。',
        ],
      },
      {
        subtitle: '先物タブ',
        items: [
          '海外投機筋（ヘッジファンド）の日経225先物ポジション（週次）と売り圧力スコア、建玉残高・出来高・PCR（プット/コール比）の日次テーブルを表示します。PCR が 1.2 以上は赤（弱気）、0.8 以下は緑（強気）です。右下には日経平均の日次 OHLC テーブルも表示されます。',
        ],
      },
    ],
  },
  {
    id: 'shield',
    icon: '🛡️',
    title: 'シールド（ポジション管理）',
    tocLabel: 'シールド',
    items: [
      '画面下のナビバーにある「シールド」アイコンをタップすると表示されます。',
      '保有中のポジション管理と出口戦略の検討に特化したツールです。新規エントリーの判断には使いません。',
      '日経225の最新の値動き・移動平均線（20日・60日・200日）・直近の高値・安値・建玉残高・PCR・VIX が自動で取得されます。',
      '「AIプロンプトをコピー」ボタンを押すと市場データ入りのプロンプトがコピーされます。Gemini・Claude・ChatGPT・DeepSeek に貼り付け、保有ポジションのスクリーンショットも添付すると出口戦略のアドバイスが得られます。',
      '保有ポジションの画像（証券会社アプリの保有画面のスクリーンショット）は必ず添付してください。画像がないと AI は正確な分析ができません。',
    ],
  },
  {
    id: 'lab',
    icon: '🧪',
    title: '研究室',
    wide: true,
    intro: [
      '画面下のナビバーにある「研究室」アイコンをタップすると表示されます。',
      '左のメニューから「資料」「設定」「お問い合わせ」の3つの機能にアクセスできます。',
    ],
    subs: [
      {
        subtitle: '資料',
        items: [
          '記事や解説資料を読めます。資料を開いた後、右上の「×」ボタンを押すと資料一覧に戻ります。「需給エネルギーバックテスト」カードでは、過去のシグナル勝率・慣性フィルター効果を確認できます。',
        ],
      },
      {
        subtitle: '設定',
        items: [
          'テーマ（ライト / ダーク）の切り替えと、Google アカウントでのログイン・ログアウトができます。ログインすると複数デバイス間でメモが自動同期されます。',
        ],
      },
      {
        subtitle: 'お問い合わせ',
        items: [
          'フォームからお問い合わせを送信できます（種別選択 ＋ 内容入力）。',
        ],
      },
      {
        subtitle: 'ぽいロボ コネクト',
        items: [
          '画面右下の「ぽいロボ コネクト」ボタンから予約画面を開けます。ログイン不要で空き枠を確認でき、枠を選んで申請するとログインを求められます。ログイン後は予約内容の確認やカレンダーへの登録（.ics ファイルのダウンロード）もできます。',
          'セッション開始の5分前になると「今すぐ接続する」ボタンが現れます。タップするとぽいふる博士との音声通話・画面共有が始まります。通話中でも最小化して他の画面を見ながら話せます（iOS は画面共有非対応）。',
        ],
      },
    ],
  },
]

export const ManualView: FC<Props> = ({ theme, isMobile, onClose }) => {
  const L = theme === 'light'

  const c = {
    HDRBG:   L ? 'rgba(228,242,255,0.97)' : 'rgba(3,9,22,0.97)',
    BG:      L ? 'rgba(218,236,255,0.92)' : 'rgba(3,10,24,0.92)',
    ACCENT:  L ? '#0369a1'                : '#00e5ff',
    DIM:     L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.52)',
    TEXT:    L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:     L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:    L ? 'rgba(3,105,161,0.12)'   : 'rgba(0,200,255,0.10)',
    CARD:    L ? 'rgba(255,255,255,0.52)' : 'rgba(0,200,255,0.04)',
    CARDBR:  L ? 'rgba(3,105,161,0.14)'   : 'rgba(0,200,255,0.10)',
    SUBBG:   L ? 'rgba(3,105,161,0.04)'   : 'rgba(0,229,255,0.04)',
    SUBBR:   L ? 'rgba(3,105,161,0.10)'   : 'rgba(0,229,255,0.10)',
    SUBTAG:  L ? 'rgba(3,105,161,0.55)'   : 'rgba(0,229,255,0.60)',
    SCAN:    L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    BULLET:  L ? 'rgba(3,105,161,0.50)'   : 'rgba(0,229,255,0.45)',
  }

  const mono = "'Courier New', Courier, monospace" as const

  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState(SECTIONS[0].id)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || isMobile) return
    const handler = () => {
      const secs = [...container.querySelectorAll<HTMLElement>('.mv-toc-section')]
      if (!secs.length) return
      const ct = container.getBoundingClientRect().top
      let cur = secs[0].id
      for (const s of secs) {
        if (s.getBoundingClientRect().top - ct <= 56) cur = s.id
      }
      setActiveId(cur)
    }
    container.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => container.removeEventListener('scroll', handler)
  }, [isMobile])

  const scrollToId = (id: string) => {
    const container = scrollRef.current
    if (!container) return
    const target = document.getElementById(id)
    if (!target) return
    container.scrollTo({
      top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top - 52,
      behavior: 'smooth',
    })
  }

  const BulletItem = ({ text }: { text: string }) => (
    <div style={{ display: 'flex', gap: isMobile ? 9 : 10, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: mono, fontSize: isMobile ? 9 : 10, fontWeight: 700,
        color: c.BULLET, flexShrink: 0, marginTop: isMobile ? 4 : 5,
        textShadow: L ? 'none' : `0 0 6px ${c.BULLET}`,
      }}>▸</span>
      <span style={{ fontSize: isMobile ? 13 : 13.5, color: c.SUB, lineHeight: 1.82, letterSpacing: '0.01em' }}>
        {text}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      overflow: 'hidden',
      background: c.BG,
      backgroundImage: c.SCAN,
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
    }}>
      <style>{`
        @keyframes mvFadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mvSweep  { from { transform:translateY(-100%); } to { transform:translateY(250%); } }
        .mv-s { opacity:0; animation: mvFadeUp .55s cubic-bezier(.16,1,.3,1) forwards; }
      `}</style>

      {!L && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '26%',
            background: 'linear-gradient(to bottom,transparent 0%,rgba(0,229,255,0.024) 50%,transparent 100%)',
            animation: 'mvSweep 11s linear infinite',
          }} />
        </div>
      )}

      <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 1 }}>
        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '11px 16px' : '12px 28px',
          background: c.HDRBG,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${c.RULE}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap',
            textShadow: L ? 'none' : '0 0 10px rgba(0,229,255,0.28)',
          }}>
            ぽいロボ ▸ 使い方ガイド
          </span>
          <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>v2.0</span>
          {onClose && (
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7,
              border: L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
              background: L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
              color: L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)',
              cursor: 'pointer', flexShrink: 0,
            }} aria-label="閉じる">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Content with TOC */}
        <div style={{
          maxWidth: isMobile ? '100%' : 1200,
          margin: '0 auto',
          padding: isMobile ? '20px 16px 80px' : '0 40px 100px',
          ...(isMobile ? {} : { display: 'flex', gap: 28, alignItems: 'flex-start' }),
        }}>

          {/* 追従目次 — PC のみ */}
          {!isMobile && (
            <nav style={{ width: 176, flexShrink: 0, position: 'sticky', top: 52, alignSelf: 'flex-start', paddingRight: 4, paddingTop: 28 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: c.DIM, fontFamily: mono, marginBottom: 12, paddingLeft: 4 }}>
                CONTENTS
              </div>
              {SECTIONS.map(sec => (
                <button key={sec.id} onClick={() => scrollToId(sec.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '5px 8px', marginBottom: 2, borderRadius: 7,
                  border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                  background: activeId === sec.id ? c.CARD : 'transparent',
                  borderLeft: `2px solid ${activeId === sec.id ? c.ACCENT : 'transparent'}`,
                  color: activeId === sec.id ? c.ACCENT : c.DIM,
                  fontSize: 12, fontFamily: mono, lineHeight: 1.35,
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{sec.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sec.tocLabel ?? sec.title}
                  </span>
                </button>
              ))}
            </nav>
          )}

          {/* 2カラムグリッド（PCのみ）*/}
          <div style={{
            flex: 1, minWidth: 0,
            display: isMobile ? 'flex' : 'grid',
            gridTemplateColumns: '1fr 1fr',
            flexDirection: 'column',
            gap: isMobile ? 14 : 18,
            alignItems: 'start',
            paddingTop: isMobile ? 0 : 28,
          }}>
            {SECTIONS.map((sec, i) => (
              <div
                key={sec.title}
                id={sec.id}
                className="mv-s mv-toc-section"
                style={{
                  animationDelay: `${i * 60}ms`,
                  gridColumn: (!isMobile && sec.wide) ? '1 / -1' : 'auto',
                }}
              >
                <div style={{ background: c.CARD, border: `1px solid ${c.CARDBR}`, borderRadius: 12, overflow: 'hidden' }}>
                  {/* セクションヘッダー */}
                  <div style={{
                    padding: isMobile ? '11px 16px' : '12px 20px',
                    borderBottom: `1px solid ${c.CARDBR}`,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ width: 4, height: 14, borderRadius: 2, background: c.ACCENT, flexShrink: 0, boxShadow: L ? 'none' : `0 0 6px ${c.ACCENT}` }} />
                    <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: c.TEXT, letterSpacing: '0.03em' }}>
                      {sec.title}
                    </span>
                  </div>

                  {/* イントロ箇条書き */}
                  {sec.intro && (
                    <div style={{
                      padding: isMobile ? '14px 16px 12px' : '16px 20px 12px',
                      display: 'flex', flexDirection: 'column', gap: isMobile ? 11 : 13,
                      borderBottom: `1px solid ${c.CARDBR}`,
                    }}>
                      {sec.intro.map((item, ii) => <BulletItem key={ii} text={item} />)}
                    </div>
                  )}

                  {/* フラット箇条書き */}
                  {sec.items && (
                    <div style={{
                      padding: isMobile ? '14px 16px' : '16px 20px',
                      display: 'flex', flexDirection: 'column', gap: isMobile ? 11 : 13,
                    }}>
                      {sec.items.map((item, ii) => <BulletItem key={ii} text={item} />)}
                    </div>
                  )}

                  {/* サブセクション */}
                  {sec.subs && (
                    <div style={{
                      display: isMobile ? 'flex' : 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      flexDirection: 'column',
                      gap: 0,
                    }}>
                      {sec.subs.map((sub, si) => (
                        <div key={sub.subtitle} style={{
                          background: c.SUBBG,
                          borderTop: `1px solid ${c.SUBBR}`,
                          borderLeft: (!isMobile && si % 2 === 1) ? `1px solid ${c.SUBBR}` : 'none',
                          padding: isMobile ? '12px 16px' : '14px 20px',
                          display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                          {/* サブセクションタイトル */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: c.SUBTAG,
                              letterSpacing: '0.04em',
                              textShadow: L ? 'none' : `0 0 8px rgba(0,229,255,0.4)`,
                            }}>
                              {sub.subtitle}
                            </span>
                          </div>
                          {/* サブセクション箇条書き */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 9 : 10 }}>
                            {sub.items.map((item, ii) => <BulletItem key={ii} text={item} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManualView
