type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

const SECTIONS = [
  {
    icon: '🏠',
    title: 'ホーム（カレンダー）',
    items: [
      '画面下のナビバーの「カレンダー」アイコンをタップすると表示されます。',
      '「月・週・日」タブでビューを切り替えられます。「今日」ボタンで今日の日付に戻ります。',
      '配当落ち日・SQ日・FOMC などのマーケットイベントが自動表示されます。',
      '日付をタップするとメモパネルが開きます。テキストメモ・チェックリストのほか、開始〜終了時刻とタイトル付きのスケジュールを複数追加できます。タイトル未入力のまま閉じると、空のスケジュールは自動的に破棄されます。',
      '週・日ビューでは、スケジュールが時間グリッド上に帯として表示されます。',
      '画面左のサイドバーにある付箋メモは、どのビューからでも素早くメモを取るために使います（最大1件）。',
    ],
  },
  {
    icon: '📈',
    title: 'チャート',
    items: [
      '画面下のナビバーの「チャート」アイコンをタップすると表示されます。',
      '日経225・ドル円・米国債の TradingView チャートを表示できます。上部のタブで銘柄を切り替えられます。',
      '右上の分割ボタンで1画面 / 2画面を切り替えられます。',
    ],
  },
  {
    icon: '🤖',
    title: 'ぽいロボ（需給分析）',
    items: [
      '画面下のナビバーの「ぽいロボ」アイコンをタップすると表示されます。',
      '画面上部の「環境・現物・先物」タブで切り替えられます。',
      '【環境】VIX・NS倍率チャートと、クオンツ分析レポート（AIへのメモ帳）を表示します。',
      '【現物】信用倍率・投資主体別売買動向・需給指標（騰落レシオ・空売り比率・裁定買い残）を表示します。',
      '【先物】投資部門別の先物ネット枚数（週次）・売り圧力スコアと、建玉残高・取引高・PCR（プット/コール比）の統合テーブル（日次）を表示します。',
      'PCRセルは ≥1.2（プット優勢・弱気）= 赤背景、≤0.8（コール優勢・強気）= 緑背景で色付けされます。',
      '右上の「ぽいロボ エンジン（レンチアイコン）」→「プロンプト＋データをコピー」を押すと、AI分析用のプロンプトとデータがクリップボードにコピーされます。モーダル内の Gemini / Claude / ChatGPT ボタンをタップするとAIチャットが直接開きます。',
    ],
  },
  {
    icon: '🧪',
    title: '研究室',
    items: [
      '画面下のナビバーの「研究室」アイコンをタップすると表示されます。研究室に入るとナビバーは非表示になります。',
      '左のメニューから「DATA（需給分析）」「REPORT（資料）」「SETTINGS（設定）」「HOME（カレンダー）」「CHART（チャート）」へ移動できます。',
      '「REPORT」で記事・解説資料を閲覧できます。資料を開いた後は右上の「×」ボタンで資料トップへ戻れます。',
      '「SETTINGS」では、テーマ（ライト/ダーク）の切り替えや、Google アカウントでのログイン/ログアウトができます。ログイン後、複数デバイス間でメモが自動同期されます。',
      '右下の「ぽいロボ コネクト」ボタンをホバー（またはタップ）すると説明パネルが表示されます。Google ログイン後にボタンを押すと、ぽいふる博士との音声通話・画面共有セッションが始まります。',
      '通話中はメニューが非表示になり、画面中央に通話パネルが表示されます。マイク・画面共有・切断ボタンのみ表示されます（iOS は画面共有非対応）。同時接続は最大2名までです。',
    ],
  },
]

export function ManualView({ theme, isMobile, onClose }: Props) {
  const isDark = theme === 'dark'

  const c = {
    bg:          isDark ? 'transparent'                 : 'transparent',
    cardBg:      isDark ? 'rgba(255,255,255,0.04)'      : 'rgba(0,0,0,0.03)',
    cardBorder:  isDark ? 'rgba(255,255,255,0.12)'      : 'rgba(0,0,0,0.08)',
    title:       isDark ? 'rgba(255,255,255,0.97)'      : 'rgba(30,40,80,0.95)',
    text:        isDark ? 'rgba(255,255,255,0.90)'      : 'rgba(50,60,100,0.80)',
    bullet:      isDark ? 'rgba(96,165,250,0.90)'       : 'rgba(37,99,235,0.7)',
    logoText:    isDark ? 'rgba(255,255,255,0.45)'      : 'rgba(80,90,130,0.55)',
    accent:      isDark ? 'rgba(96,165,250,0.15)'       : 'rgba(37,99,235,0.08)',
    accentBorder:isDark ? 'rgba(96,165,250,0.25)'       : 'rgba(37,99,235,0.2)',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '20px 16px 40px' : '28px 32px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.title, letterSpacing: '-0.5px' }}>
              説明書
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: c.logoText }}>
              ぽいロボ — 説明書
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: c.logoText, cursor: 'pointer', flexShrink: 0 }}
              aria-label="閉じる"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* リード */}
        <div style={{
          padding: '14px 18px', borderRadius: 12, marginBottom: 20,
          background: c.accent, border: `1px solid ${c.accentBorder}`,
          fontSize: 13, color: c.text, lineHeight: 1.7,
        }}>
          ぽいロボは、株式投資家向けのカレンダー＋需給分析アプリです。
          AI分析プロンプトをワンクリックで生成し、Gemini / Claude / ChatGPT に貼り付けるだけで市場の脆弱性・清算プロセスの定量レポートが得られます。
        </div>

        {/* セクション */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SECTIONS.map(sec => (
            <div key={sec.title} style={{
              background: c.cardBg, border: `1px solid ${c.cardBorder}`,
              borderRadius: 14, padding: isMobile ? '16px 16px' : '18px 22px',
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: isMobile ? 15 : 16, fontWeight: 700, color: c.title, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 17 }}>{sec.icon}</span>
                {sec.title}
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sec.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: c.text, lineHeight: 1.6 }}>
                    <span style={{ color: c.bullet, flexShrink: 0, fontWeight: 700, marginTop: 1 }}>▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>


      </div>
    </div>
  )
}
