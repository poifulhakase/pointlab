import type { FC } from 'react'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

type Section = { title: string; items: string[] }

const SECTIONS: Section[] = [
  {
    title: 'カレンダー',
    items:[
      '画面下のナビバーにある「カレンダー」アイコンをタップすると表示されます。',
      '上部のタブで「月・週・日」の3つのビューを切り替えられます。',
      '配当落ち日・SQ日・FOMC など、相場に影響するイベントが自動でカレンダーに表示されます。',
      '日付をタップするとメモパネルが開きます。自由記述のメモやチェックリストのほか、時間帯を指定したスケジュールを複数登録できます。タイトルを入力せずに閉じると空のスケジュールは自動で削除されます。',
      '週・日ビューでは、登録したスケジュールが時間グリッド上に帯として表示されます。',
      '画面左のサイドバーには付箋メモ欄があります。どのビューからでもすぐに書き留められる簡易メモです（最大1件）。',
    ],
  },
  {
    title: 'チャート',
    items:[
      '画面下のナビバーにある「チャート」アイコンをタップすると表示されます。',
      '日経225・ドル円・米国債（10年利回り）の TradingView チャートを表示できます。上部のタブで切り替えてください。',
      '右上の分割ボタンで1画面 / 2画面を切り替えられます。2画面では2つのチャートを並べて確認できます（スマートフォンは1画面固定）。',
    ],
  },
  {
    title: 'エンジン（需給分析）',
    items:[
      '画面下のナビバーにある「エンジン」アイコンをタップすると表示されます。',
      '「分析・環境・現物・先物」の4つのタブで切り替えられます。',
      '【分析】左側の「ぽいロボ エンジン」エリアで「クオンツ分析用プロンプト＋需給データをコピー」ボタンを押すと、需給データが入ったプロンプトがコピーされます。Gemini・Claude・ChatGPT・DeepSeek などの AI に貼り付けて分析を依頼してください。右側のテキストエリアは、AI から得た分析レポートを貼り付けて保存しておくためのメモ欄です。',
      '【分析】需給分析レポートを保存するとプレビューモードに切り替わります。「確信度：XX%」「判定：〜」の行がシアン色でハイライトされるので、重要な結論がひと目でわかります。「全選択」ボタンでテキスト全体をまとめてコピーできます。',
      '【分析】AI分析の出力には「慣性持続性」（強持続 / 中持続 / 枯渇圏）が含まれます。現在の需給エネルギーがあと何週持続しそうかを示す指標です。「枯渇圏」と判定された場合は、TEVがどれだけ大きな値でも本命エントリーは控えることを推奨します。「強持続」はモメンタム戦略、「中持続」は打診のみが基本方針です。',
      '【環境】VIX（恐怖指数）・NS倍率のチャートと、ドル円の日次推移テーブルを表示します。',
      '【現物】信用倍率・投資主体別の売買動向・騰落レシオ・空売り比率・裁定買い残のほか、日経平均の銘柄別寄与度と業種別騰落率（東証33業種）を確認できます。',
      '【先物】海外投機筋（ヘッジファンド）の日経225先物ポジション（週次）と売り圧力スコア、建玉残高・出来高・PCR（プット/コール比、オプション市場の強気・弱気の目安）の日次テーブルを表示します。PCR が 1.2 以上は赤（弱気）、0.8 以下は緑（強気）で色付けされます。右下には日経平均の日次 OHLC テーブル（高値・安値・終値・前日比）も表示されます。',
    ],
  },
  {
    title: 'シールド（ポジション管理）',
    items:[
      '画面下のナビバーにある「シールド」アイコンをタップすると表示されます。',
      '保有中のポジション管理と出口戦略の検討に特化したツールです。新規エントリーの判断には使いません。',
      '日経225の最新の値動き・移動平均線（20日・60日・200日）・直近の高値・安値・建玉残高・PCR・VIX が自動で取得されます。',
      '「AIプロンプトをコピー」ボタンを押すと、市場データ入りのプロンプトがコピーされます。Gemini・Claude・ChatGPT・DeepSeek に貼り付け、保有ポジションのスクリーンショットも添付して送ると、出口戦略のアドバイスが得られます。',
      '保有ポジションの画像（証券会社アプリの保有画面のスクリーンショット）は必ず添付してください。画像がないと AI は正確な分析ができません。',
    ],
  },
  {
    title: '研究室',
    items:[
      '画面下のナビバーにある「研究室」アイコンをタップすると表示されます。',
      '左のメニューから「資料」「設定」「お問い合わせ」の3つの機能にアクセスできます。',
      '「資料」では記事や解説資料を読めます。資料を開いた後、右上の「×」ボタンを押すと資料一覧に戻ります。「TEV バックテスト」カードでは、過去のシグナル勝率・慣性フィルター効果を確認できます。',
      '「設定」ではテーマ（ライト / ダーク）の切り替えと、Google アカウントでのログイン・ログアウトができます。ログインすると複数のデバイス間でメモが自動的に同期されます。',
      '「お問い合わせ」ではフォームからお問い合わせを送信できます（種別選択 ＋ 内容入力）。',
      '画面右下の「ぽいロボ コネクト」ボタンから予約画面を開けます。ログイン不要で空き枠を確認でき、枠を選んで申請するとログインを求められます。ログイン後は予約内容の確認やカレンダーへの登録（.ics ファイルのダウンロード）もできます。',
      'セッション開始の5分前になると「今すぐ接続する」ボタンが現れます。タップするとぽいふる博士との音声通話・画面共有が始まります。通話中でも最小化して他の画面を見ながら話せます（iOS は画面共有非対応）。同時接続は最大2名です。',
    ],
  },
]

export const ManualView: FC<Props> = ({ theme, isMobile, onClose }) => {
  const L = theme === 'light'

  const c = {
    HDRBG:  L ? 'rgba(228,242,255,0.97)' : 'rgba(3,9,22,0.97)',
    BG:     L ? 'rgba(218,236,255,0.92)' : 'rgba(3,10,24,0.92)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.52)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.12)'   : 'rgba(0,200,255,0.10)',
    CARD:   L ? 'rgba(255,255,255,0.52)' : 'rgba(0,200,255,0.04)',
    CARDBR: L ? 'rgba(3,105,161,0.14)'   : 'rgba(0,200,255,0.10)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    BULLET: L ? 'rgba(3,105,161,0.50)'   : 'rgba(0,229,255,0.45)',
  }

  const mono = "'Courier New', Courier, monospace" as const

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:30,
      overflow:'hidden',
      background: c.BG,
      backgroundImage: c.SCAN,
      backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)',
    }}>
      <style>{`
        @keyframes mvFadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mvSweep  { from { transform:translateY(-100%); } to { transform:translateY(250%); } }
        .mv-s { opacity:0; animation: mvFadeUp .55s cubic-bezier(.16,1,.3,1) forwards; }
      `}</style>

      {!L && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
          <div style={{
            position:'absolute', left:0, right:0, height:'26%',
            background:'linear-gradient(to bottom,transparent 0%,rgba(0,229,255,0.024) 50%,transparent 100%)',
            animation:'mvSweep 11s linear infinite',
          }} />
        </div>
      )}

      <div style={{ position:'absolute', inset:0, overflowY:'auto', zIndex:1 }}>
        {/* Sticky header */}
        <div style={{
          position:'sticky', top:0, zIndex:5,
          display:'flex', alignItems:'center', gap:10,
          padding: isMobile ? '11px 16px' : '12px 28px',
          background: c.HDRBG,
          backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
          borderBottom:`1px solid ${c.RULE}`,
        }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:c.ACCENT, boxShadow: L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink:0 }} />
          <span style={{
            flex:1, fontSize:10, fontWeight:700, letterSpacing:'0.22em',
            color:c.DIM, fontFamily: mono, whiteSpace:'nowrap',
            textShadow: L ? 'none' : '0 0 10px rgba(0,229,255,0.28)',
          }}>
            POIROBO_OS ▸ MANUAL
          </span>
          <span style={{ fontSize:9, color:c.SUB, fontFamily: mono, flexShrink:0, letterSpacing:'0.06em' }}>v2.0</span>
          {onClose && (
            <button onClick={onClose} style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              width:28, height:28, borderRadius:7,
              border: L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
              background: L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
              color: L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)',
              cursor:'pointer', flexShrink:0,
            }} aria-label="閉じる">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{
          maxWidth: isMobile ? '100%' : 680,
          margin:'0 auto',
          padding: isMobile ? '20px 16px 80px' : '28px 48px 100px',
          display:'flex', flexDirection:'column', gap: isMobile ? 14 : 18,
        }}>
          {SECTIONS.map((sec, i) => (
            <div key={sec.title} className="mv-s" style={{ animationDelay:`${i * 60}ms` }}>
              <div style={{ background: c.CARD, border: `1px solid ${c.CARDBR}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{
                  padding: isMobile ? '11px 16px' : '12px 20px',
                  borderBottom: `1px solid ${c.CARDBR}`,
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  <span style={{ width:4, height:14, borderRadius:2, background:c.ACCENT, flexShrink:0, boxShadow: L ? 'none' : `0 0 6px ${c.ACCENT}` }} />
                  <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: c.TEXT, letterSpacing: '0.03em' }}>
                    {sec.title}
                  </span>
                </div>
                <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', display:'flex', flexDirection:'column', gap: isMobile ? 11 : 13 }}>
                  {sec.items.map((item, ii) => (
                    <div key={ii} style={{ display:'flex', gap: isMobile ? 9 : 10, alignItems:'flex-start' }}>
                      <span style={{
                        fontFamily: mono, fontSize: isMobile ? 9 : 10, fontWeight: 700,
                        color: c.BULLET, flexShrink: 0, marginTop: isMobile ? 4 : 5,
                        textShadow: L ? 'none' : `0 0 6px ${c.BULLET}`,
                      }}>▸</span>
                      <span style={{ fontSize: isMobile ? 13 : 13.5, color: c.SUB, lineHeight: 1.82, letterSpacing: '0.01em' }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ManualView
