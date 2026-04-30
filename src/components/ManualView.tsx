type Props = { theme: 'dark' | 'light'; isMobile: boolean }

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
      'ナビバーのロボットアイコンから表示。マクロ需給とミクロ需給の2タブ構成です。',
      '【マクロ需給】VIX・NS倍率・信用倍率・投資主体別売買動向・裁定買い残・空売り比率などのデータを表示します。',
      '【先物需給】投資部門別（外国人・信託銀行・生命保険・投資信託・個人・証券会社）の先物ネット枚数と売り圧力スコアを表示します。',
      '各テーブルヘッダーの「Δ」ボタンで前週比チャートをポップアップ表示できます。',
    ],
  },
  {
    icon: '🤖',
    title: 'AI分析プロンプト',
    items: [
      'データビューの右上「設定（歯車）」→「プロンプト＋データをコピー」を押します。',
      'クリップボードにコピーされたテキストを Gemini または Claude に貼り付けるだけです。',
      'AIが最新の需給データを読み取り、スイングトレード向けの戦略レポートを自動生成します。',
      '「確信度70%超 = 勝負圏」「60〜69% = 打診」「59%以下 = 見送り」が判定基準です。',
    ],
  },
  {
    icon: '📝',
    title: 'メモ・スケジュール',
    items: [
      'カレンダーの日付をタップするとメモパネルが開きます。',
      'テキストメモのほか、時間・タイトル付きのスケジュールを複数追加できます。',
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

export function ManualView({ theme, isMobile }: Props) {
  const isDark = theme === 'dark'

  const c = {
    bg:          isDark ? 'transparent'                 : 'transparent',
    cardBg:      isDark ? 'rgba(255,255,255,0.04)'      : 'rgba(0,0,0,0.03)',
    cardBorder:  isDark ? 'rgba(255,255,255,0.08)'      : 'rgba(0,0,0,0.08)',
    title:       isDark ? 'rgba(220,225,245,0.95)'      : 'rgba(30,40,80,0.95)',
    text:        isDark ? 'rgba(180,185,210,0.85)'      : 'rgba(50,60,100,0.80)',
    bullet:      isDark ? 'rgba(96,165,250,0.7)'        : 'rgba(37,99,235,0.7)',
    logoText:    isDark ? 'rgba(180,185,210,0.6)'       : 'rgba(80,90,130,0.55)',
    accent:      isDark ? 'rgba(96,165,250,0.15)'       : 'rgba(37,99,235,0.08)',
    accentBorder:isDark ? 'rgba(96,165,250,0.25)'       : 'rgba(37,99,235,0.2)',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '20px 16px 40px' : '28px 32px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.svg" alt="ぽいらぼ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.title, letterSpacing: '-0.5px' }}>
              説明書
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: c.logoText }}>
              ぽいらぼ — 使い方ガイド
            </p>
          </div>
        </div>

        {/* リード */}
        <div style={{
          padding: '14px 18px', borderRadius: 12, marginBottom: 20,
          background: c.accent, border: `1px solid ${c.accentBorder}`,
          fontSize: 13, color: c.text, lineHeight: 1.7,
        }}>
          ぽいらぼは、株式投資家向けのカレンダー＋需給分析アプリです。
          AI分析プロンプトをワンクリックで生成し、GeminiやClaudeに貼り付けるだけでスイングトレード向けのレポートが得られます。
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

        {/* フッター */}
        <p style={{ marginTop: 24, fontSize: 11, color: c.logoText, textAlign: 'center' }}>
          詳細な技術仕様はノートメニュー →「システム仕様」をご覧ください。
        </p>

      </div>
    </div>
  )
}
