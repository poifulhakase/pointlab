type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

const SECTIONS = [
  {
    icon: '🏠',
    title: 'ホーム（カレンダー）',
    items: [
      '画面下のナビバーから「ホーム」をタップすると、カレンダーが表示されます。',
      '「日・週・月」タブでビューを切り替えられます。「今日」ボタンで今日の日付に戻ります。',
      '日付をタップ → メモ入力パネルが開きます。スケジュール（時間・タイトル）も登録できます。',
      '配当落ち日・SQ日・FOMC などのマーケットイベントが自動表示されます。',
    ],
  },
  {
    icon: '📈',
    title: 'チャート',
    items: [
      'ナビバーの波形アイコンから表示。日経225・ドル円・米国債の TradingView チャートを使えます。',
      '右上の分割ボタンで1画面 / 2画面を切り替えられます。',
    ],
  },
  {
    icon: '📊',
    title: 'データ（需給分析）',
    items: [
      'ナビバーのロボットアイコンから表示。環境・現物・先物の3タブ構成です。',
      '【環境】VIX・NS倍率チャートと、クオンツ分析レポート（AIへのメモ帳）を表示します。',
      '【現物】信用倍率・投資主体別売買動向・需給指標（騰落レシオ・空売り比率・裁定買い残）を表示します。',
      '【先物】投資部門別（外国人・信託銀行・生命保険・投資信託・個人・証券会社）の先物ネット枚数（週次）・売り圧力スコアを左2/3に、建玉残高・取引高・PCR（プット/コール比）の統合テーブル（日次）を右1/3に表示します。',
      'PCRセルは ≥1.2（プット優勢・弱気）= 赤背景、≤0.8（コール優勢・強気）= 緑背景で色付けされます。',
      '各テーブルヘッダーの「Δ」ボタンで前日比チャートをポップアップ表示できます。',
    ],
  },
  {
    icon: '🤖',
    title: 'AI分析プロンプト',
    items: [
      'データビュー右上の「ぽいロボ エンジン（レンチアイコン）」ボタン →「プロンプト＋データをコピー」を押します。',
      'モーダル内の Gemini / Claude / ChatGPT ボタンをタップするとAIチャットが直接開きます（Android PWA対応）。',
      'クリップボードにコピーされたテキストをそのまま貼り付けるだけです。',
      'AIが最新の需給データ（VIX・信用倍率・投資主体別・先物OI・PCRなど）を読み取り、市場の「脆弱性」と「清算プロセス」を定量的に特定します。',
      '出力形式: 脆弱性シミュレーション報告書（フェーズ / 偏差スコア / Signal Density）・Pain Capacity（主体別耐久限界）・清算・流動性マップ（天井/断崖/安住帯/底）・観測限界。',
    ],
  },
  {
    icon: '📝',
    title: 'メモ・スケジュール',
    items: [
      'カレンダーの日付をタップするとメモパネルが開きます。',
      'テキストメモのほか、時間・タイトル付きのスケジュールを複数追加できます。タイトル未入力のまま閉じると、空のスケジュールは自動的に破棄されます。',
      '週/日ビューでは、スケジュールが時間グリッド上に帯として表示されます。',
      'サイドバーの付箋メモは、どのビューからでも素早くメモを取るために使います（最大1件）。',
    ],
  },
  {
    icon: '🔄',
    title: 'クロスデバイス同期',
    items: [
      '歯車メニュー →「Googleでログイン」で複数デバイス間でメモを自動同期します。',
      'ログアウト中でも、メモはデバイス内の localStorage に保存されます。',
      'ログイン後、自動でサーバーのデータとマージされます。',
    ],
  },
  {
    icon: '🌙',
    title: 'その他の設定',
    items: [
      '歯車メニュー →「ダークモード / ライトモード」でテーマを切り替えられます。',
      '歯車メニュー →「通知設定」でスケジュールのブラウザ通知を有効にできます。',
      'このアプリは PWA 対応です。スマートフォンのホーム画面に追加するとアプリのように使えます。',
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
          <img src="/logo.svg" alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
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
