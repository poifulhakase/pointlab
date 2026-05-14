import React from 'react'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

type Section = { icon: React.ReactNode; title: string; items: string[] }

const IconCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const IconRobot = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/>
    <rect width="16" height="12" x="4" y="8" rx="2"/>
    <path d="M2 14h2"/><path d="M20 14h2"/>
    <path d="M15 13v2"/><path d="M9 13v2"/>
  </svg>
)
const IconLab = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v8L5.5 16.5A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3.5L15 11V3"/>
    <line x1="6" y1="3" x2="18" y2="3"/>
    <path d="M9 12h6"/>
  </svg>
)

const SECTIONS: Section[] = [
  {
    icon: <IconCalendar />,
    title: 'ホーム（カレンダー）',
    items: [
      '画面下のナビバーの「カレンダー」アイコンをタップすると表示されます。',
      '「月・週・日」タブでビューを切り替えられます。',
      '配当落ち日・SQ日・FOMC などのマーケットイベントが自動表示されます。',
      '日付をタップするとメモパネルが開きます。テキストメモ・チェックリストのほか、開始〜終了時刻とタイトル付きのスケジュールを複数追加できます。タイトル未入力のまま閉じると、空のスケジュールは自動的に破棄されます。',
      '週・日ビューでは、スケジュールが時間グリッド上に帯として表示されます。',
      '画面左のサイドバーにある付箋メモは、どのビューからでも素早くメモを取るために使います（最大1件）。',
    ],
  },
  {
    icon: <IconChart />,
    title: 'チャート',
    items: [
      '画面下のナビバーの「チャート」アイコンをタップすると表示されます。',
      '日経225・ドル円・米国債の TradingView チャートを表示できます。上部のタブで銘柄を切り替えられます。',
      '右上の分割ボタンで1画面 / 2画面を切り替えられます。',
    ],
  },
  {
    icon: <IconRobot />,
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
    icon: <IconLab />,
    title: '研究室',
    items: [
      '画面下のナビバーの「研究室」アイコンをタップすると表示されます。研究室でもナビバーは共通で表示されます。',
      '左のメニューは「資料（Data）」「設定（Settings）」の2項目です。',
      '「資料」で記事・解説資料を閲覧できます。資料を開いた後は右上の「×」ボタンで資料トップへ戻れます。',
      '「設定」では、テーマ（ライト/ダーク）の切り替えや、Google アカウントでのログイン/ログアウトができます。ログイン後、複数デバイス間でメモが自動同期されます。',
      '右下の「ぽいロボ コネクト」ボタンはGoogleログインが必要です。未ログイン時はボタン下に「Googleログインが必要です」と表示され、タップするとGoogleログインモーダルが開きます。ログイン成功後、自動的に接続確認モーダルが表示されます。',
      'ぽいロボ コネクトの確認モーダルで「開始」を押すと、ぽいふる博士との音声通話・画面共有セッションが始まります。通話中はメニューが非表示になり、画面中央に通話パネルが表示されます。マイク・画面共有・切断ボタンのみ表示されます（iOS は画面共有非対応）。同時接続は最大2名までです。',
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
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: c.bullet }}>{sec.icon}</span>
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
