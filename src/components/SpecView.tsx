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
        text: 'ぽいロボは、株式投資家向けのWebカレンダーアプリです。配当日・SQ日・マクロイベント・市場休場日を一画面で把握し、メモ・チャート・需給分析を統合した投資支援ツールです。',
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
          'カレンダー（ホーム）：月/週/日ビュー＋ メモ・スケジュール管理',
          'チャート：TradingView チャート（日経225・ドル円・米国債）',
          'ぽいロボ（データ）：需給分析（環境 / 現物 / 先物 の3タブ構成）＋ AI分析プロンプト自動生成',
          '研究室：資料閲覧 / 設定（テーマ切替・アカウント）/ 使い方ガイド / ぽいロボ コネクト',
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
          '市場休場日（東証・NYSE）。振替休日はゴールデンウィーク等の多段ずれにも対応（火曜以降への繰り越し判定）',
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
        text: '需給分析に特化したビューです。環境・現物・先物の3タブ構成。環境・現物タブは3カラムレイアウト（各1/3幅）、先物タブは左2/3（週次分析）＋右1/3（日次テーブル）の横分割。市場の過熱感・資金動向を把握します。スマートフォンでは縦1列に並びます。',
      },
      {
        type: 'table' as const,
        headers: ['タブ', '左1/3', '中1/3', '右1/3'],
        rows: [
          ['環境', 'VIXチャート', 'NS倍率チャート', 'クオンツ分析レポート'],
          ['現物', '信用倍率', '投資主体別売買動向', '需給指標（騰落レシオ・空売り・裁定）'],
          ['先物', '先物参加者別ネット枚数＋ベクター分析（左2/3幅）', '←', '建玉残高・取引高統合テーブル（右1/3幅・日次）'],
        ],
      },
      {
        type: 'list' as const,
        heading: '環境タブ ─ VIX / NS倍率チャート',
        items: [
          'VIXチャート: Yahoo Finance から ^VIX 日足データを取得。市場時間中は5分ごと自動更新',
          'NS倍率チャート: 日経225 ÷ S&P500 の比率チャート（^N225 / ^GSPC から計算）',
          '温度計カラー配色: 上=赤（過熱）/ 下=青（冷静）のグラデーション背景',
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
        type: 'list' as const,
        heading: '環境タブ ─ クオンツ分析レポート',
        items: [
          'データビュー専用のメモパネル（AIへの引継ぎメモとして使用）',
          'テキストエリアが常時表示（全文見える・長い場合は縦スクロール）',
          '未保存時のみ「保存」ボタンが活性化。保存後2秒間「保存しました」を表示',
          'データは localStorage `poical-quant-memo` に永続保存',
          'データ更新時に自動でAIプロンプトをカレンダーメモに追記（poical-auto-prompt-last-added で重複防止）',
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
          ['先物投資部門別手口', '毎週金曜日', '翌週木曜日', '毎週金曜19:00 JST 自動取得'],
          ['PCR（プット・コール・レシオ）', '毎日', '当日（オプション引け後）', '毎週金曜19:00 JST 自動取得（日次60件）'],
        ],
      },
      {
        type: 'list' as const,
        heading: '現物需給タブ ─ 信用倍率',
        items: [
          'データソース: JPX 信用取引残高 Excel + nikkei225jp.com（評価損益率）',
          '表示列: 日付・買い残・売り残・信用倍率・評価損益率',
          '信用倍率の着色: ≥6=赤（過熱危険）/ ≥4=薄赤 / ≤2.5=緑 / ≤1.5=濃緑',
          'キャッシュ: localStorage 24時間（`poical-margin-data`）',
        ],
      },
      {
        type: 'list' as const,
        heading: '現物需給タブ ─ 投資主体別売買動向',
        items: [
          'データソース: JPX 投資部門別売買状況 Excel',
          '表示列: 外国人・個人・信託銀行・証券自己（差引金額・百万円単位）',
          'キャッシュ: localStorage 24時間（`poical-investor-data`）',
        ],
      },
      {
        type: 'list' as const,
        heading: '現物需給タブ ─ 需給指標統合テーブル',
        items: [
          '空売り比率・騰落レシオ・裁定買い残を1つのテーブルに統合表示',
          '週カラムは共通化（日付キーで3データをマージ）。データがない週は「-」表示',
          '空売り比率データソース: nikkei225jp.com daily2year.json（col[11]）・着色: ≥50%=赤 / ≤38%=緑',
          '騰落レシオデータソース: nikkei225jp.com daily2year.json（col[7]・25日）・着色: ≥120=赤 / ≤70=緑',
          '裁定買い残データソース: nikkei225jp.com daily_saitei.json（col[8]）・着色: Q1/Q3四分位基準',
          '各テーブルヘッダーの「Δ」ボタンで前週比チャートモーダルを表示（信用倍率・裁定・騰落・空売り）',
          'キャッシュ: poical-short-sell-data / poical-ad-ratio-data / poical-arbitrage-data（各24時間）',
        ],
      },
      {
        type: 'list' as const,
        heading: '先物タブ ─ CFTC COT 日経225先物ポジション（MicroQuantView・左2/3）',
        items: [
          'データソース: CFTC Legacy Financial Futures Only Report → public/data/cot_nikkei.json',
          '3区分: Non-Commercial（投機筋）/ Commercial（ヘッジャー）/ Non-Reportable（小口）',
          '週次テーブル列: NC Net / NC Long / NC Short / Comm Net / Comm Long / Comm Short / OI',
          '売り圧力スコア: NC Netの直近26週百分位を逆転してalertLevel（green/yellow/orange/red）判定',
          '遅延: 火曜基準データを毎週金曜公表（約3〜4日遅延）',
          'キャッシュ: localStorage 24時間（`poical-cot-nikkei-v1`）',
        ],
      },
      {
        type: 'list' as const,
        heading: '先物タブ ─ 建玉残高・取引高統合テーブル（右1/3・日次）',
        items: [
          'データソース: JPX 先物日次データ → public/data/futures_daily.json',
          '表示列: 日付 | 建玉残高（万枚）＋前日比Δ | 取引高（枚）＋前日比Δ | PCR＋前日比Δ',
          'PCR（プット・コール・レシオ）: nikkei225jp.com daily2year.json col[16] から取得',
          'PCR セル背景色: ≥1.2=赤（プット優勢・弱気）/ ≤0.8=緑（コール優勢・強気）/ その他=なし',
          'PCR テキスト色: ≥1.2=赤 / ≤0.8=緑 / その他=デフォルト（前日比Δ付き）',
          '日経225先物 全限月（大証）の日次集計。直近20件表示（スマートフォンでは全件）',
          'Δボタン: 建玉残高・取引高・PCR それぞれ個別チャートモーダル表示',
          'キャッシュ: localStorage 24時間（`poical-futures-daily-data`）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'AI分析プロンプト',
        items: [
          '直近12週分のデータをJSON形式でエクスポート（buildExportJson）',
          '含まれるフィールド: VIX・NS倍率・投資主体別フロー・信用倍率・空売り比率・騰落レシオ・裁定買い残・先物ミクロベクター・PCR・NAS100日次・VIX日次・偏差スコア・観測限界・SQ/TPI・価格帯空間情報',
          'futures_oi_recent: 日付/OI/OI前日比Δ/OI前日比%/取引高/取引高Δ/PCR/PCR前日比Δ（直近20件）',
          '今後28日のSQ・FOMC等のイベント一覧も含む',
          'AIプロンプトテンプレート名: シニア・クオンツ・ストラテジスト（需給ストレス監視エンジン）',
          'フレームワーク: Layer 0（固定観測ルール） / ステージ1（耐久限界とレジーム） / 解析レイヤー（清算フェーズと自己増殖）',
          '偏差スコア: 0.30×Z_USDJPY + 0.25×Z_NAS100 + 0.20×Z_VIX⁻¹ + 0.15×Z_OI（MIN_Z=3件以上あれば計算・NAS100失敗時は日経225でフォールバック）',
          '偏差加速度: Acc = 本日Score - 3日前Score（scoreAtOffset()で計算）',
          'TPI: (1/SQ残日数) × |VIX日次変化率| — iv_proxyはvixDailyData末尾のchangePct',
          'price_levels: 日経225 MA5/MA20/MA60・MA乖離率・60日高値/安値 / USDJPY MA5/MA20・MA乖離率・60日高値/安値 / OI集積日Top3',
          '出力: 脆弱性シミュレーション報告書 / Pain Capacity / 清算・流動性マップ（天井・断崖・安住・底） / 観測限界（Tier比率）',
          'Cascade Phase 0〜4: 通常→局所清算→自己増殖→パニック連鎖→投げ切り',
          'Signal Density: [Price急変/OI減少/IV急騰/VIX急騰/USDJPY急変/出来高急増] の同時点灯数/6',
          'ぽいロボエンジンモーダル: Gemini / Claude / ChatGPT のリンクをワンタップで開く（Android PWA対応: window.open() 使用）',
          'ぽいロボエンジンボタンアイコン: レンチ（スパナ）形状',
          'シグナルコンフリクト解決ルール（優先順位: 慣性 ＞ 質量 ＞ 弾性）: 慣性優勢→方向維持/質量確認、慣性停止反転→反転シグナル発行、弾性極限→反転優先/慣性は従属、全シグナル拮抗→全力待機強制',
        ],
      },
    ],
  },
  {
    id: 'support',
    icon: '🧪',
    title: '研究室（SupportView）',
    content: [
      {
        type: 'para' as const,
        text: '研究室は、資料閲覧・設定・ぽいロボ コネクトへのアクセスを統合したハブビューです。ヘッダーのフラスコアイコンをタップして表示します。',
      },
      {
        type: 'table' as const,
        headers: ['パネル', '内容'],
        rows: [
          ['研究室（左）', 'メニュー（6ボタン）: DATA / REPORT / MANUAL / SETTINGS / HOME / CHART'],
          ['資料（中央）', 'NoteView — 記事一覧（基本・インジケーター・イベントドリブン・未来ガジェット）。「← 研究室」ボタンで研究室パネルへ戻れる'],
          ['使い方（右）', 'ManualView — アプリ説明書'],
        ],
      },
      {
        type: 'list' as const,
        heading: 'メニューボタン（6項目）',
        items: [
          'DATA → QuantView（需給分析ビュー）へ遷移。NoteView 内「← 研究室」ボタンで研究室へ戻れる',
          'REPORT → 研究室パネルの資料タブ（NoteView）へ切り替え',
          'MANUAL → 研究室パネルの使い方タブ（ManualView）へ切り替え',
          'SETTINGS → 設定モーダルを開く（ヘッダー歯車アイコンは廃止）',
          'HOME → カレンダービュー（月ビュー）へ遷移',
          'CHART → チャートビューへ遷移',
        ],
      },
      {
        type: 'list' as const,
        heading: '設定モーダル（SettingsPanel）',
        items: [
          '研究室 > SETTINGS ボタンからのみ開く（ヘッダー歯車アイコンは削除済み）',
          '表示セクション: ライト / ダーク テーマ切り替え（segmented buttons）',
          'アカウントセクション: Googleログイン / ログアウト（AuthModal を開く）・同期ステータス表示',
          '開発者セクション: システム仕様を開く（管理者アカウントのみ表示）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'ぽいロボ コネクト（右下ボタン）',
        items: [
          '研究室ビュー右下に配置（position: absolute, bottom: 20-28px, right: 16-28px, zIndex: 20）',
          '博士画像（hakase.png）＋「ぽいロボ コネクト」テキスト＋「ぽいふる博士と接続」サブテキスト',
          'ホバー時: POIROBO_CONNECT_v2.0 HUDパネルを表示',
          'スキャナーリング（slow-rotate 8s）・ダスト粒子8個（digital-dust 4-8s シアン浮上）・スキャンライン（support-scanline 3s 縦スクロール）',
          'ダスト・スキャンラインは背景（support-room.jpg）の前面（zIndex: 3）に描画',
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
          ['poical-settings', '永続', 'アプリ設定（テーマ設定）'],
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
          ['poical-futures-participants-v2', '24時間', '先物投資部門別ネット枚数データ（先物タブ・週次）'],
          ['poical-futures-daily-data', '24時間', '先物建玉残高・取引高・PCRデータ（先物タブ・日次）'],
          ['poical-usdjpy-data', '30分（平日）/ 2時間（土日）', 'USD/JPY 日次データ（現物タブ）'],
          ['poical-nas100-data', '30分（平日）/ 2時間（土日）', 'NAS100(^NDX) 日次データ（偏差スコア計算用）'],
          ['poical-vix-daily-data', '30分（平日）/ 2時間（土日）', 'VIX 日次データ（偏差スコア・TPI計算用）'],
          ['poical-nk-futures-price-v2', '1時間（平日）/ 3時間（土日）', '日経先物 OHLCV データ（^N225 fallback、AI プロンプト用）'],
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
          '騰落レシオ・空売り比率・PCR: nikkei225jp.com daily2year.json（col[7]/col[11]/col[16]）を一括取得・キャッシュ共有',
          'PCR = プット/コールOI比（日次・値域0.75〜2.52）。オプション市場引け後更新のためOIより数時間遅れる場合あり',
          '裁定買い残: nikkei225jp.com/_data/_nfsWEB/HS_DATA_DAY/daily_saitei.json（col[8]、Refererヘッダー必要）を週次52件',
          'USD/JPY: Yahoo Finance USDJPY=X（日次・3ヶ月・終値/前日比/MA5/MA5乖離）→ public/data/usdjpy.json',
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
    text:       isDark ? 'rgba(255,255,255,0.90)'  : 'rgba(15,20,50,0.88)',
    sub:        isDark ? 'rgba(255,255,255,0.60)'  : 'rgba(15,20,50,0.62)',
    heading:    isDark ? 'rgba(255,255,255,0.97)'  : 'rgba(10,15,45,0.97)',
    border:     isDark ? 'rgba(255,255,255,0.10)'  : 'rgba(0,0,0,0.08)',
    rowEven:    isDark ? 'rgba(255,255,255,0.05)'  : 'rgba(0,0,0,0.03)',
    bullet:     isDark ? 'rgba(96,165,250,0.90)'   : 'rgba(37,99,235,0.70)',
    thBg:       isDark ? 'rgba(255,255,255,0.08)'  : 'rgba(0,0,0,0.04)',
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
    bg:           isDark ? 'transparent'              : 'transparent',
    cardBg:       isDark ? 'rgba(255,255,255,0.04)'   : 'rgba(255,255,255,0.7)',
    cardBorder:   isDark ? 'rgba(255,255,255,0.12)'   : 'rgba(0,0,0,0.08)',
    sectionTitle: isDark ? 'rgba(255,255,255,0.97)'   : 'rgba(10,15,45,0.97)',
    divider:      isDark ? 'rgba(255,255,255,0.10)'   : 'rgba(0,0,0,0.07)',
    logoText:     isDark ? 'rgba(255,255,255,0.45)'   : 'rgba(15,20,50,0.50)',
  }

  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      padding: isMobile ? '20px 16px 40px' : '28px 32px 48px',
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.sectionTitle, letterSpacing: '-0.5px' }}>
              システム仕様
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: c.logoText }}>
              ぽいロボ — 最終更新: 2026-05-12
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
