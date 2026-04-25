type Props = { theme: 'dark' | 'light'; isMobile: boolean }

// ── セクションデータ ─────────────────────────────────
const SPEC_SECTIONS = [
  {
    id: 'overview',
    icon: '🧭',
    title: 'アプリ概要',
    content: [
      {
        type: 'para' as const,
        text: 'ぽいらぼは、株式投資家向けのWebカレンダーアプリです。配当日・SQ日・マクロイベント・市場休場日を一画面で把握し、メモ・チャート・需給分析を統合した投資支援ツールです。',
      },
      {
        type: 'table' as const,
        headers: ['項目', '内容'],
        rows: [
          ['URL', 'https://pointlab.vercel.app/stock-calendar'],
          ['対応デバイス', 'PC・タブレット・スマートフォン（PWA対応）'],
          ['データ永続化', 'localStorage ＋ Firebase Firestore（Googleログイン時クロスデバイス同期）'],
          ['テーマ', 'ダークモード / ライトモード'],
        ],
      },
      {
        type: 'list' as const,
        heading: '主要機能',
        items: [
          'ホーム：カレンダー（月/週/日ビュー）＋ メモ・スケジュール管理',
          'チャート：TradingView チャート（日経225・ドル円・米国債）',
          'データ：需給分析（VIX・NS倍率・信用倍率・投資主体別売買動向）',
          'ノート：記事一覧（実装予定）',
          'AI分析プロンプト自動生成・クリップボードコピー',
          'Firebase Auth（Googleログイン）によるメモ・設定のクロスデバイス同期',
        ],
      },
    ],
  },
  {
    id: 'calendar',
    icon: '📅',
    title: 'カレンダービュー',
    content: [
      {
        type: 'para' as const,
        text: '株式市場に関わる重要イベントをカレンダー形式で管理するメインビューです。月・週・日の3つのサブビューを切り替えて使用します。',
      },
      {
        type: 'list' as const,
        heading: 'ビュー切り替えタブ',
        items: [
          '「今日」ボタン：現在のビューを変えずに今日の日付へ移動（ラジオボタンではなく独立ボタン）',
          '「日」「週」「月」：ラジオ式タブで各サブビューを切り替え',
          '本日パネルは背景色（薄青）＋上部アクセントボーダー（青）でハイライト表示、白色の波紋アニメーション（2.8秒周期）で強調',
          'スマートフォンでは日付ナビゲーションエリア（← 年月 →）を高めに表示してタップしやすく改善',
        ],
      },
      {
        type: 'list' as const,
        heading: '月次イベント帯（ページ下部）',
        items: [
          '特定月に関連するイベント情報をカレンダー下部に帯として表示（月・週・日ビュー共通）',
          'URLリンクが設定されているアイテムは別タブで開くリンクになり、末尾に外部リンクアイコン（↗）を表示',
          'イベントがない月でも同一高さを確保（visibility: hidden プレースホルダー）',
        ],
      },
      {
        type: 'list' as const,
        heading: '表示されるマーカー',
        items: [
          '配当権利落日（主要銘柄）',
          'SQ（特別清算指数）算出日',
          'マクロイベント：FOMC・雇用統計・CPI・PCE・GDP・日銀会合・短観（米国/日本フィルター付き）',
          '市場休場日（東証・NYSE）',
          'メモあり日（ノート帯でタイトル表示）',
          'スマートフォンでもテキストバッジ表示（ドット表示を廃止）',
        ],
      },
      {
        type: 'table' as const,
        headers: ['サブビュー', '説明'],
        rows: [
          ['月ビュー', '月単位のグリッド表示。各日のマーカー・メモタイトルを確認'],
          ['週ビュー', '週単位のタイムライン。スケジュール予定を時刻付きで管理'],
          ['日ビュー', '1日の詳細ビュー。イベント一覧・メモを縦並びで表示'],
        ],
      },
      {
        type: 'list' as const,
        heading: 'メモ機能（DayNotePanel）',
        items: [
          'タイトル・開始時刻・終了時刻・本文（メモ）を入力',
          '「スケジュールに追加」で週ビューのタイムラインに表示',
          'タイトルが空のままスケジュール保存する場合、メモ欄またはチェックリスト先頭行を自動でタイトルに補完',
          '30分刻みドロップダウン + テキスト入力のハイブリッド時刻入力',
          'スケジュール削除時は確認ダイアログを表示',
          'データは localStorage `stock-cal-notes` ＋ Firestore（ログイン時）に保存',
        ],
      },
    ],
  },
  {
    id: 'sidebar',
    icon: '🕐',
    title: 'サイドバー',
    content: [
      {
        type: 'para' as const,
        text: 'カレンダー左側のサイドバーには、リアルタイム時計・スティッキーメモ・マーケットイベントフィルターが上から順に配置されています。',
      },
      {
        type: 'list' as const,
        heading: 'リアルタイム時計（ClockWidget）',
        items: [
          '現在時刻をJST（秒単位）でリアルタイム表示',
          '東証マーケットステータス：開場前 / 前場 / 昼休み / 後場 / 取引終了 / 休場',
          '24時間以内に迫ったイベントのカウントダウンを最大3件表示',
          'カウントダウン対象：前場・後場の開始／終了、FOMC・雇用統計・CPI等のマクロイベント、SQ日',
        ],
      },
      {
        type: 'list' as const,
        heading: 'スティッキーメモ',
        items: [
          '最大1件まで自由なメモを保存可能',
          'メモカードをクリックすると全画面モーダルエディタが開く',
          'Ctrl+S（⌘+S）で保存 / Esc で閉じる / 保存後「保存しました」を2秒間表示',
          '「＋」ボタンで新規追加、「✕」ボタンで削除（削除時は確認ダイアログあり）',
          'データは localStorage `poical-sticky-notes` ＋ Firestore（ログイン時）に永続保存',
        ],
      },
      {
        type: 'list' as const,
        heading: 'マーケットイベントフィルター',
        items: [
          '米国イベント（FOMC・雇用統計・CPI・PCE・GDP）の表示ON/OFF',
          '日本イベント（日銀決定会合・短観）の表示ON/OFF',
          '設定はカレンダー全ビューに即時反映',
        ],
      },
    ],
  },
  {
    id: 'chart',
    icon: '📈',
    title: 'チャートビュー',
    content: [
      {
        type: 'para' as const,
        text: 'TradingView Advanced Chart を埋め込んだチャートビューです。主要マーケット指標を最大2画面に分割して表示します。',
      },
      {
        type: 'table' as const,
        headers: ['銘柄', 'シンボル', '説明'],
        rows: [
          ['日経225', 'INDEX:NKY', '日経平均株価'],
          ['ドル円', 'FX:USDJPY', 'ドル円為替レート'],
          ['米国債', 'NASDAQ:TLT', '20年超国債ETF（利回りの逆指標）'],
        ],
      },
      {
        type: 'list' as const,
        heading: '仕様・制約',
        items: [
          '1分割 / 2分割レイアウトを切り替え可能（設定は localStorage に保存）',
          'スマートフォンでは1分割固定',
          'TradingView 比率シンボル（NKY/TOPIX等）は埋め込みウィジェットでは非対応',
          'TradingView 利回りシンボル（TVC:US10Y等）も埋め込み不可のためTLTで代用',
        ],
      },
    ],
  },
  {
    id: 'quant',
    icon: '📊',
    title: 'データビュー（QuantView）',
    content: [
      {
        type: 'para' as const,
        text: '需給分析に特化したビューです。3カラム構成（左：VIX＋NS倍率 / 中：信用倍率＋需給指標統合テーブル / 右：投資主体別売買動向＋クオンツ分析レポート）で市場の過熱感・資金動向を把握します。スマートフォンでは縦1列に並びます。',
      },
      {
        type: 'list' as const,
        heading: '左カラム（チャート2段）',
        items: [
          'VIXチャート（上）: Yahoo Finance から ^VIX 日足データを取得。市場時間中は5分ごと自動更新',
          'NS倍率チャート（下）: 日経225 ÷ S&P500 の比率チャート（^N225 / ^GSPC から計算）',
          '温度計カラー配色: 上=赤（過熱）/ 下=青（冷静）のグラデーション背景',
          'データ取得中はチャートエリアにローディングオーバーレイ（blur）を表示',
          'キャッシュTTL: 米国市場オープン時30分 / クローズ時2時間（レート制限対策）',
        ],
      },
      {
        type: 'table' as const,
        headers: ['NS倍率', 'ラベル'],
        rows: [
          ['≥ 8.5', '酷暑（オーバーヒート）'],
          ['8.0〜8.5', '真夏日'],
          ['7.5〜8.0', '適温'],
          ['< 7.5', '冷え込み'],
        ],
      },
      {
        type: 'table' as const,
        headers: ['データ', '基準日', 'JPX公表日', 'アプリ反映'],
        rows: [
          ['信用倍率', '毎週金曜日', '翌週火曜日', '毎週金曜19:00 JST 自動取得'],
          ['投資主体別売買動向', '毎週金曜日', '翌週木曜日', '毎週金曜19:00 JST 自動取得'],
          ['騰落レシオ・空売り比率', '毎日', '当日', '毎週金曜19:00 JST 自動取得（52週分）'],
          ['裁定買い残', '毎週金曜日', '翌週金曜日', '毎週金曜19:00 JST 自動取得（52週分）'],
        ],
      },
      {
        type: 'list' as const,
        heading: '中カラム上段（信用倍率）',
        items: [
          'データソース: JPX 信用取引残高 Excel + nikkei225jp.com（評価損益率）',
          '表示列: 日付・買い残・売り残・信用倍率・評価損益率',
          '信用倍率の着色: ≥6=赤（過熱危険）/ ≥4=薄赤 / ≤2.5=緑 / ≤1.5=濃緑',
          'キャッシュ: localStorage 24時間（`poical-margin-data`）',
        ],
      },
      {
        type: 'list' as const,
        heading: '中カラム下段（需給指標統合テーブル）',
        items: [
          '空売り比率・騰落レシオ・裁定買い残を1つのテーブルに統合表示',
          '週カラムは共通化（日付キーで3データをマージ）。データがない週は「-」表示',
          '空売り比率データソース: nikkei225jp.com daily2year.json（col[11]）・着色: ≥50%=赤 / ≤38%=緑',
          '騰落レシオデータソース: nikkei225jp.com daily2year.json（col[7]・25日）・着色: ≥120=赤 / ≤70=緑',
          '裁定買い残データソース: nikkei225jp.com daily_saitei.json（col[8]）・着色: Q1/Q3四分位基準',
          '更新ボタン1つで3データを同時リフレッシュ',
          'キャッシュ: poical-short-sell-data / poical-ad-ratio-data / poical-arbitrage-data（各24時間）',
        ],
      },
      {
        type: 'list' as const,
        heading: '右カラム上段（投資主体別売買動向）',
        items: [
          'データソース: JPX 投資部門別売買状況 Excel',
          '表示列: 外国人・個人・信託銀行・証券自己（差引金額・百万円単位）',
          'キャッシュ: localStorage 24時間（`poical-investor-data`）',
        ],
      },
      {
        type: 'list' as const,
        heading: '右カラム下段（クオンツ分析レポート）',
        items: [
          'データビュー専用のメモパネル',
          'テキストエリアが常時表示（全文見える・長い場合は縦スクロール）',
          '未保存時のみ「保存」ボタンが活性化。保存後2秒間「保存しました」を表示',
          'データは localStorage `poical-quant-memo` に永続保存',
          '編集はデータビュー内のこのパネルからのみ可能',
        ],
      },
      {
        type: 'list' as const,
        heading: 'AI分析プロンプト（クオンツ分析レポート）',
        items: [
          '直近12週分のデータをJSON形式でエクスポート',
          '含まれるフィールド: VIX・NS倍率（日経/S&P込み）・投資主体別フロー・信用倍率',
          '今後28日のSQ・FOMC等のイベント一覧も含む',
          'プロンプト基準: オーナー基準（確信度59%以下=静観 / 60〜69%=打診 / 70%超=勝負圏）',
          'AI分析エンジン名: 需給解析エンジン（スイング特化）',
          '設定モーダルからGemini（gemini.google.com/app）またはClaude（claude.ai/projects）をワンクリックで開くショートカットパネルあり',
        ],
      },
    ],
  },
  {
    id: 'data',
    icon: '🗄️',
    title: 'データ仕様',
    content: [
      {
        type: 'table' as const,
        headers: ['localStorageキー', 'TTL', '用途'],
        rows: [
          ['stock-cal-notes', '永続', 'カレンダーメモ全データ'],
          ['poical-settings', '永続', 'アプリ設定（テーマ・通知等）'],
          ['poical-vix-data', '30分（市場オープン）/ 2時間（クローズ）', 'VIX日足チャートデータ'],
          ['poical-ns-ratio-data', '30分（市場オープン）/ 2時間（クローズ）', 'NS倍率日足データ'],
          ['poical-margin-data', '24時間', '信用倍率JSONキャッシュ'],
          ['poical-investor-data', '24時間', '投資主体別JSONキャッシュ'],
          ['poical-nhk-news', '30分', 'NHKニュースRSS'],
          ['poical-sticky-notes', '永続', 'サイドバースティッキーメモ（最大1件）'],
          ['poical-short-sell-data', '24時間', '空売り比率JSONキャッシュ'],
          ['poical-ad-ratio-data', '24時間', '騰落レシオJSONキャッシュ'],
          ['poical-arbitrage-data', '24時間', '裁定買い残JSONキャッシュ'],
          ['poical-quant-memo', '永続', 'データビュー クオンツ分析レポートメモ'],
          ['poical-auto-prompt-last-added', '永続', '週次自動メモ追加済みキー'],
          ['poical-chart-split', '永続', 'チャート分割設定'],
        ],
      },
      {
        type: 'list' as const,
        heading: '週次データ自動取得スクリプト',
        items: [
          'スクリプト: `scripts/fetch-jpx.mjs`',
          '実行: `npm run fetch-data`',
          'GitHub Actions: `.github/workflows/update-data.yml`（毎週金曜19:00 JST + 土曜09:00 JST 自動実行）',
          '出力先: `public/data/margin.json` / `public/data/investor.json` / `public/data/vix.json` / `public/data/advance_decline.json` / `public/data/short_sell.json` / `public/data/arbitrage.json`',
          '騰落レシオ・空売り比率: nikkei225jp.com daily2year.json（col[7]/col[11]）を週次変換（52週）',
          '裁定買い残: nikkei225jp.com/_data/_nfsWEB/HS_DATA_DAY/daily_saitei.json（col[8]、Refererヘッダー必要）を週次52件',
        ],
      },
    ],
  },
  {
    id: 'sync',
    icon: '☁️',
    title: 'クロスデバイス同期（Firebase）',
    content: [
      {
        type: 'para' as const,
        text: 'Googleアカウントでログインすると、メモがFirestoreに保存され、PCとスマートフォン間で自動同期されます。',
      },
      {
        type: 'list' as const,
        heading: '仕様',
        items: [
          'ログイン方法: Googleサインイン（ポップアップ）',
          '同期対象: カレンダーメモ（stock-cal-notes）・スティッキーメモ',
          '未ログイン時: localStorageにフォールバック（データ消失なし）',
          'Firestoreデータ保持期間: 2年（自動削除ルール適用）',
          'authDomain: pointlab.vercel.app（Vercel でFirebaseへプロキシ）',
          '同期エラー時はアカウントモーダルに「再試行」ボタンが表示される',
          'オフライン検知時（code=unavailable）は8秒後に自動リトライ（1回）',
          'Firestore接続: HTTP長ポーリング固定（WebSocketではなくHTTPS経由で接続・CSP互換）',
        ],
      },
    ],
  },
]

// ── レンダラー ────────────────────────────────────────
function renderContent(block: (typeof SPEC_SECTIONS)[0]['content'][0], isDark: boolean) {
  const c = {
    text:       isDark ? 'rgba(200,205,225,0.9)'  : 'rgba(30,35,60,0.88)',
    sub:        isDark ? 'rgba(160,165,190,0.75)' : 'rgba(60,70,100,0.65)',
    heading:    isDark ? 'rgba(220,225,245,0.95)' : 'rgba(20,25,50,0.95)',
    border:     isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    rowEven:    isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
    bullet:     isDark ? 'rgba(96,165,250,0.7)'  : 'rgba(37,99,235,0.6)',
    thBg:       isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  }

  if (block.type === 'para') {
    return (
      <p key={block.text} style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.75, color: c.text }}>
        {block.text}
      </p>
    )
  }

  if (block.type === 'list') {
    return (
      <div key={block.heading} style={{ marginBottom: 20 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: c.heading }}>
          {block.heading}
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: c.text, lineHeight: 1.6 }}>
              <span style={{ color: c.bullet, flexShrink: 0, marginTop: 2 }}>›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (block.type === 'table') {
    return (
      <div key={block.headers.join()} style={{ marginBottom: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {block.headers.map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '7px 12px',
                  background: c.thBg, color: c.heading, fontWeight: 600,
                  borderBottom: `1px solid ${c.border}`,
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : c.rowEven }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '7px 12px', color: ci === 0 ? c.heading : c.text,
                    fontWeight: ci === 0 ? 500 : 400,
                    borderBottom: `1px solid ${c.border}`,
                    fontSize: 12.5,
                  }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}

// ── メインコンポーネント ──────────────────────────────
export function SpecView({ theme, isMobile }: Props) {
  const isDark = theme === 'dark'

  const c = {
    bg:         isDark ? 'transparent'              : 'transparent',
    cardBg:     isDark ? 'rgba(255,255,255,0.04)'   : 'rgba(255,255,255,0.7)',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)'   : 'rgba(0,0,0,0.08)',
    sectionTitle: isDark ? 'rgba(230,235,255,0.95)' : 'rgba(15,20,50,0.95)',
    divider:    isDark ? 'rgba(255,255,255,0.07)'   : 'rgba(0,0,0,0.07)',
    logoText:   isDark ? 'rgba(180,185,210,0.6)'    : 'rgba(80,90,130,0.55)',
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      padding: isMobile ? '20px 16px 40px' : '28px 32px 48px',
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.svg" alt="ぽいらぼ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.sectionTitle, letterSpacing: '-0.5px' }}>
              仕様書
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: c.logoText }}>
              ぽいらぼ — 最終更新: 2026-04-21
            </p>
          </div>
        </div>

        {/* セクション一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {SPEC_SECTIONS.map(section => (
            <section
              key={section.id}
              id={section.id}
              style={{
                background: c.cardBg,
                border: `1px solid ${c.cardBorder}`,
                borderRadius: 14,
                padding: isMobile ? '18px 16px' : '22px 24px',
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* セクションタイトル */}
              <h2 style={{
                margin: '0 0 16px',
                fontSize: isMobile ? 16 : 17,
                fontWeight: 700,
                color: c.sectionTitle,
                display: 'flex', alignItems: 'center', gap: 8,
                letterSpacing: '-0.3px',
              }}>
                <span style={{ fontSize: 18 }}>{section.icon}</span>
                {section.title}
              </h2>

              <div style={{ borderTop: `1px solid ${c.divider}`, paddingTop: 16 }}>
                {section.content.map((block, i) => (
                  <div key={i}>{renderContent(block, isDark)}</div>
                ))}
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  )
}
