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
const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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
      '右上の分割ボタンで1画面 / 2画面を切り替えられます（スマートフォンでは1画面固定）。',
    ],
  },
  {
    icon: <IconRobot />,
    title: 'エンジン（需給分析）',
    items: [
      '画面下のナビバーの「エンジン」アイコンをタップすると表示されます。',
      '「分析・環境・現物・先物」の4タブで切り替えられます。',
      '【分析】ぽいロボ エンジンとクオンツ分析レポートを横並びで表示します。「クオンツ分析用プロンプト＋需給データをコピー」ボタンでAI分析用データをクリップボードにコピーし、Gemini / Claude / ChatGPT / DeepSeek へワンタップで開けます。',
      '【分析】クオンツ分析レポートは保存するとプレビューモードに切り替わり、「確信度：XX%」「判定：〜」の行がシアン色でハイライト表示されます。「全選択」ボタンでテキスト全体を選択できます（スマートフォンでの貼り替えに便利）。',
      '【環境】VIX・NS倍率チャートと、USD/JPY 日次テーブルを表示します。',
      '【現物】信用倍率・投資主体別売買動向・需給指標（騰落レシオ・空売り比率・裁定買い残）・日経平均（銘柄別寄与度/業種別騰落率）を表示します。スマートフォンでは銘柄別寄与度と業種別騰落率が縦並びで表示されます。',
      '【先物】CFTC COT 日経225先物ポジション（週次）・売り圧力スコアと、建玉残高・取引高・PCR（プット/コール比）の統合テーブル（日次）を表示します。PCR ≥1.2（弱気）= 赤、≤0.8（強気）= 緑で色付けされます。',
    ],
  },
  {
    icon: <IconShield />,
    title: 'シールド（ポジション管理）',
    items: [
      '画面下のナビバーの「シールド」アイコンをタップすると表示されます。',
      '保有中ポジションの管理・出口戦略に特化した分析ツールです。エントリー判断は対象外です。',
      '日経225の最新OHLCV・移動平均（MA20/MA60/MA200）・直近高値安値・建玉残高・PCR・VIXが自動取得されます。',
      '「AIプロンプトをコピー」ボタンで市場データ付きプロンプトをクリップボードにコピーできます。Gemini / Claude / ChatGPT / DeepSeek に貼り付けた後、保有ポジションのスクリーンショットを添付して送信すると、出口戦略のアドバイスが得られます。',
      'ポジション画像（証券会社の保有画面スクリーンショット）は必須です。画像なしの場合、AIは分析を行いません。',
    ],
  },
  {
    icon: <IconLab />,
    title: '研究室',
    items: [
      '画面下のナビバーの「研究室」アイコンをタップすると表示されます。研究室でもナビバーは共通で表示されます。',
      '左のメニューは「資料（Data）」「設定（Settings）」「お問い合わせ（Contact）」の3項目です。',
      '「資料」で記事・解説資料を閲覧できます。資料を開いた後は右上の「×」ボタンで資料トップへ戻れます。',
      '「設定」をタップすると画面右からスライドインするドロワーが開きます。テーマ（ライト/ダーク）の切り替えや、Google アカウントでのログイン/ログアウトができます。ログイン後、複数デバイス間でメモが自動同期されます。',
      '「お問い合わせ」をタップすると画面右からドロワーが開き、お問い合わせフォームに入力・送信できます（お客様種別選択 ＋ 内容入力）。',
      '右下の「ぽいロボ コネクト」ボタンをタップすると予約画面が開きます。Googleログイン不要で空き枠を閲覧できます。枠を選んで「予約を申請する」を押すとログインを求められます（未ログイン時）。ログイン後は予約の確認・.ics カレンダーファイルのダウンロードができます。',
      'セッション開始5分前になると「今すぐ接続する」ボタンが表示され、ぽいふる博士との音声通話・画面共有が始まります。通話パネルを最小化すると、他の画面を見ながら通話を継続できます。マイク・画面共有・切断ボタンのみ表示されます（iOS は画面共有非対応）。同時接続は最大2名です。',
    ],
  },
]

export function ManualView({ theme, isMobile, onClose }: Props) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      padding: isMobile ? '20px 16px 40px' : '28px 32px 48px',
      background: theme === 'dark' ? '#0f0f0f' : '#f4f6f9',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              説明書
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              ぽいロボ — 説明書
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0 }}
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
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.7,
        }}>
          ぽいロボは、株式投資家向けのカレンダー＋需給分析アプリです。
          AI分析プロンプトをワンクリックで生成し、Gemini / Claude / ChatGPT / DeepSeek に貼り付けるだけで市場の脆弱性・清算プロセスの定量レポートが得られます。
        </div>

        {/* セクション */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SECTIONS.map(sec => (
            <div key={sec.title} style={{
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 14, padding: isMobile ? '16px 16px' : '18px 22px',
            }}>
              <h2 style={{ margin: '0 0 12px', fontSize: isMobile ? 15 : 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--text-dim)' }}>{sec.icon}</span>
                {sec.title}
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sec.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--text-dim)', flexShrink: 0, fontWeight: 700, marginTop: 1 }}>▸</span>
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
