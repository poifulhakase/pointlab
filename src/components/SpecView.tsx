type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

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
          'エンジン（需給分析）：分析 / 環境 / 現物 / 先物 の4タブ構成 ＋ AI分析プロンプト自動生成',
          'シールド：保有中ポジション管理・出口戦略アドバイス（NK225先物データ＋AIプロンプト生成）',
          '研究室：資料閲覧 / 設定（テーマ切替・アカウント）/ お問い合わせ / ぽいロボ コネクト（予約通話システム）',
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
        text: '需給分析に特化したビューです。分析・環境・現物・先物の4タブ構成。分析タブは2カラム（ぽいロボ エンジン / エントリー分析レポート）、環境・現物タブは3カラムレイアウト（各1/3幅）、先物タブは左2/3（週次分析）＋右1/3（日次テーブル）の横分割。市場の過熱感・資金動向を把握します。スマートフォンでは縦1列に並びます。',
      },
      {
        type: 'table' as const,
        headers: ['タブ', '左', '中', '右'],
        rows: [
          ['分析', 'ぽいロボ エンジン（左1/2）', '←', 'エントリー分析レポート（右1/2）'],
          ['環境', 'VIXチャート', 'NS倍率チャート', 'USD/JPY 日次テーブル'],
          ['現物', '信用倍率', '投資主体別売買動向', '需給指標（騰落レシオ・空売り・裁定）＋日経平均（銘柄別寄与度/業種別騰落率）'],
          ['先物', '先物参加者別ネット枚数＋ベクター分析（左2/3幅）', '←', '建玉残高・取引高統合テーブル（右1/3幅・日次）'],
        ],
      },
      {
        type: 'list' as const,
        heading: '分析タブ ─ ぽいロボ エンジン（左1/2）',
        items: [
          'ぽいロボ エンジンが分析タブにインライン表示（モーダルではなく常時表示）',
          '「クオンツ分析用プロンプト＋需給データをコピー」ボタンでAI分析用データをクリップボードにコピー',
          'Gemini / Claude / ChatGPT / DeepSeek の各AIサービスへのリンクをワンタップで開く（Android PWA対応: window.open() 使用）',
          'SYSTEM LOG ▶ LIVE: 最終行がタイプライターアニメーション（38ms/文字）で表示',
          'CYBER_MODE: サイバー風UIデザイン（シアン・グリーン配色、ターミナル風ログ）',
        ],
      },
      {
        type: 'list' as const,
        heading: '分析タブ ─ エントリー分析レポート（右1/2）',
        items: [
          'データビュー専用のメモパネル（AIへの引継ぎメモとして使用）',
          'テキストエリア入力後に「保存」ボタンでプレビューモードへ切り替わる',
          'プレビューモード: 「確信度：XX%」「判定：〜」の行がシアン色でハイライト表示',
          '「編集」ボタンまたはプレビュー領域をタップすると編集モードに戻る',
          '「全選択」ボタン: プレビュー時は編集モードへ切り替えてから全選択、編集時は直接全選択（スマートフォンでの貼り替えに便利）',
          'データは localStorage `poical-quant-memo` に永続保存',
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
          'キャッシュ: localStorage 24時間（`poical-margin-data-v2`）',
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
        heading: '現物需給タブ ─ 日経平均（ContribSectorPanel）',
        items: [
          '銘柄別寄与度（上位/下位5銘柄）と業種別騰落率（東証33業種）を表示',
          'PC: 7カラム単一テーブル構造（銘柄寄与度5列 ＋ 区切り ＋ 業種騰落2列、行高さが自動同期）',
          'スマートフォン: 銘柄別寄与度テーブルと業種別騰落率テーブルを縦積み1列表示',
          '上昇/下落カラーはテーマに応じて配色（ダーク: 緑/赤、ライト: 濃緑/濃赤）',
        ],
      },
      {
        type: 'list' as const,
        heading: '先物タブ ─ CFTC COT 日経225先物ポジション（MicroQuantView・左2/3）',
        items: [
          'データソース: CFTC Legacy Financial Futures Only Report → public/data/cot_nikkei.json',
          '3区分: Non-Commercial（投機筋）/ Commercial（ヘッジャー）/ Non-Reportable（小口）',
          '週次テーブル列: NC Net / NC Long / NC Short / Comm Net / Comm Long / Comm Short / COT建玉',
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
          'キャッシュ: localStorage 24時間（`poical-futures-daily-data-v2`）',
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
          'AIロール名: ぽいロボ エンジン（需給物理解析OS）',
          'フレームワーク: 4大物理原則（質量の法則・弾性の法則・呼吸の法則・慣性の法則）',
          'トータル・エネルギー・ベクター（TEV）: TypeScript側で事前計算 → tev_analysis フィールドとして JSON に格納',
          'トータル・エネルギー・ベクター 構成要素: 上昇エネルギー（外国人フロー×加速度）+ 売り圧（信用残・空売り比率の非線形圧縮）×エネルギー減衰係数',
          'トータル・エネルギー・ベクター ステータス5種: 慣性航行中 / 限界膨張 / 重力反転中 / 真空落下 / 底打ち反転',
          'tev_analysis フィールド（公開）: note / tev / status / confidence_pct / decay_factor / decay_reasons / sanity_ok / sanity_warnings',
          'AIの役割: 独自計算を禁じ、tev_analysis.tev・status・confidence_pct をそのまま引用して物理的意味の解釈に専念',
          '偏差スコア: 0.30×Z_USDJPY + 0.25×Z_NAS100 + 0.20×Z_VIX⁻¹ + 0.15×Z_OI（MIN_Z=3件以上あれば計算・NAS100失敗時は日経225でフォールバック）',
          '偏差加速度: Acc = 本日Score - 3日前Score（scoreAtOffset()で計算）',
          'TPI: (1/SQ残日数) × |VIX日次変化率| — iv_proxyはvixDailyData末尾のchangePct',
          'price_structure: 日経225 MA5/MA20/MA60・MA乖離率・60日高値/安値 / USDJPY MA5/MA20・MA乖離率・60日高値/安値',
          '出力形式: 需給物理・執行ログ（エネルギー・サマリー → 市場の状態診断 → 本質的結論 → 最終執行指令）',
          '最終執行指令: ブル/ベア各1倍・2倍の判定（購入禁止/打診/本命/継続保持）と物理的根拠（日本語表記）',
          'ぽいロボエンジン（分析タブインライン）: Gemini / Claude / ChatGPT / DeepSeek のリンクをワンタップで開く（Android PWA対応: window.open() 使用）',
          'ぽいロボエンジンボタンアイコン: レンチ（スパナ）形状',
          'ニュース分析プロンプト コピーボタン（★2026-05-23 追加 → ★2026-05-27 削除）: エンジンパネル・シールドパネルの小ボタンは廃止し、シールドビューの「ニュースタブ」（NewsPanel）に統合',
          'シグナルコンフリクト解決ルール（優先順位: 慣性 ＞ 質量 ＞ 弾性）: 慣性優勢→方向維持/質量確認、慣性停止反転→反転シグナル発行、弾性極限→反転優先/慣性は従属、全シグナル拮抗→全力待機強制',
          '慣性の持続可能性（慣性持続性）★2026-05-26: 需給サマリーに「慣性持続性：[強持続/中持続/枯渇圏]（根拠：...）」を必須出力。強持続=decay≥0.95＋acc>0＋3週同方向フロー / 中持続=混在シグナル / 枯渇圏=decay<0.85 or acc<0 or フロー逆転 or 限界膨張ステータス',
          'PROMPT_TEV_REGIME（慣性持続性による戦略分岐）★2026-05-26: 強持続→モメンタム戦略（TEV方向に追随・本命エントリー可） / 中持続→慎重追随（打診止まり） / 枯渇圏→本命エントリー禁止（反転候補意識）。例外: 真空落下＋枯渇圏=バンドウォーク残存のため全力待機',
        ],
      },
      {
        type: 'list' as const,
        heading: '需給エネルギーバックテスト（BacktestPanel）★2026-05-27 改称',
        items: [
          '研究室 > 資料 > 「需給エネルギーバックテスト」カードからアクセス（一般ユーザーも閲覧可）。モバイル表示名: 「エネルギーバックテスト」',
          'バックテスト生成スクリプト: scripts/backtest-tev.mjs（npm run backtest で実行）→ public/data/backtest_results.json を生成',
          'サマリーカード（4列）: 全体勝率（OVERALL）/ BULL 勝率 / BEAR 勝率 / NEUTRAL 回避週数',
          'テーブル（3列レイアウト）: ステータス別勝率 / 信頼度別勝率 / 慣性フィルター別勝率',
          '慣性フィルター テーブル: 全シグナル / 枯渇圏除外 / 強持続のみ の3条件で回数・勝率を比較表示（★2026-05-26 新規）',
          '慣性フィルター判定ロジック（inertiaPhase）: acc・foreign4w_pct・cot_pct の3基準で判定。枯渇シグナル2つ以上=枯渇圏 / decay≥0.95＋acc>0＋f4w≥60＋慣性航行中=強持続 / それ以外=中持続',
          'JSON週次フィールド（WeeklyEntry）: week / tev / status / confidence / decay / acc / foreign4w_pct / cot_pct / signal / nk_close / price_change_pct / win（★acc/f4w/cot は2026-05-26 追加）',
          'WEEKLY LOG ボタン: 全週のシグナル・TEV・ステータス・確信度・日経リターン・勝敗の一覧モーダルを表示',
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
        text: '研究室は、資料閲覧・設定・ぽいロボ コネクトへのアクセスを統合したハブビューです。フッターのフラスコアイコンをタップして表示します。',
      },
      {
        type: 'table' as const,
        headers: ['パネル', '内容'],
        rows: [
          ['研究室', 'メニュー（2ボタン）: 資料（DATA）/ 設定（SETTINGS）'],
          ['資料', 'NoteView — 記事一覧（基礎・インジケーター・イベントドリブン・未来ガジェット）。特殊カード: 需給エネルギーバックテスト（一般ユーザーも閲覧可）/ システム仕様・プロンプト Evals（管理者のみ）。DATAドロワー幅: PC時 1000px（★2026-05-27 500px→1000px に拡大）。「← 研究室」ボタンで研究室へ戻れる'],
          ['使い方', 'ManualView — アプリ説明書（研究室 > 資料 > 使い方ガイドカードからアクセス）。★2026-05-27 PC2カラムレイアウト・サブセクション構造に改善（maxWidth: 1000、エンジン/研究室は gridColumn: 1/-1 でフル幅）'],
        ],
      },
      {
        type: 'list' as const,
        heading: 'メニューボタン（2項目）★2026-05-14 簡略化',
        items: [
          '資料（DATA）→ NoteView（記事一覧）へ切り替え',
          '設定（SETTINGS）→ 右スライドドロワーで開く（テーマ / アカウント / 開発者セクション）',
          'お問い合わせ（CONTACT）→ 右スライドドロワーでカスタムフォームを表示（Google Forms バックエンド経由送信）',
          'カレンダー・チャート・エンジン・シールドはフッターの共通メニューから切り替え（研究室固有メニューから削除）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'フッターメニュー（全ビュー共通）★2026-05-14 研究室にも追加',
        items: [
          '全ビュー共通の CalendarHeader をフッターに表示（研究室も含む）',
          'つまみボタン（footer wrapper zIndex: 161）でフッター開閉可能',
          'タブ: カレンダー / チャート / エンジン / シールド / 研究室（5タブ・アイコンのみ表示）',
          '選択中タブの左右 padding: 14px（非選択: 8px）',
          'フローティングサブバー（右下 position:fixed zIndex: 150）: カレンダー(月/週/日)・チャート(銘柄)・エンジン(エンジン/環境/現物/先物)・シールド(シールド/イベント)・LegalModal(プライバシー/免責事項)でタブ表示。各ビューのアクティブタブを右下 pill で切り替え（★2026-05-27 シールドタブ・LegalModalタブ追加、「分析」→「エンジン」改称、「ニュース」→「イベント」改称）',
        ],
      },
      {
        type: 'list' as const,
        heading: '設定モーダル（SettingsPanel）★2026-05-27 開発者セクション削除',
        items: [
          '研究室 > SETTINGS ボタンで右スライドドロワーとして開く',
          'セクション順: アカウント → 通知 → 表示',
          'アカウントセクション: Googleログイン / ログアウト（AuthModal を開く）・同期ステータス表示',
          '通知セクション（★2026-05-20 新規）: プッシュ通知 ON/OFF トグル。未ログイン時はグレーアウト＋「ログインが必要です」表示。ON 時「前日 12:30 に通知」表示',
          '表示セクション: ライト / ダーク テーマ切り替え（segmented buttons）',
          '開発者セクション（★2026-05-27 削除）: 以前は「システム仕様を開く」ボタンあり → NoteView 管理者カードに統合したため削除',
        ],
      },
      {
        type: 'list' as const,
        heading: 'プッシュ通知（FCM）★2026-05-20 新規',
        items: [
          '対象: ぽいロボ レーダーで選択したイベントの前日 12:30 JST に通知',
          '条件: Googleログイン必須 / 設定 > 通知 で ON',
          'フロー: ブラウザ通知許可 → VAPID キーで FCM トークン取得 → Firestore REST API で pushSubscriptions/{uid} に保存',
          'Vercel Cron: `api/cron-push-notifications.js`（毎日 03:30 UTC = 12:30 JST）',
          'Cron処理: pushEnabled=true かつ poiroboAlertEnabled=true のユーザーを全件取得 → 翌日イベントと poiroboAlertConfig を照合 → 一致時 FCM 送信',
          'SW: `firebase-messaging-sw.js` をドメインルート `/` に配置。バックグラウンド受信・通知クリックで https://pointlab.vercel.app/calendar/ を開く',
          '実装注意: Firestore SDK の setDoc() はこのアプリでハングするため、firestoreRest.ts の restSetDoc() を使用すること',
          'localStorage: `poical-push-enabled` で ON/OFF を永続化（再ログイン時の復元用）',
          '環境変数: VITE_FIREBASE_VAPID_KEY（Vercel プロジェクトレベル環境変数）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'お問い合わせフォーム（ContactForm）★2026-05-18 新規',
        items: [
          '研究室 > CONTACT ボタンで右スライドドロワーとして開く',
          'Google Forms バックエンドと連携（formResponse エンドポイントへ mode: no-cors POST）',
          'フォームID: 1FAIpQLSfAwqrLssbR0EKh19J3m634gvJtggSbTrl7wDYjWGc3K4-j0A',
          'お客様種別: entry.557781178（ラジオボタン: 個人のお客様 / 法人のお客様 / その他）',
          'お問い合わせ内容: entry.1905599788（textarea）',
          '送信後: 成功チェックマーク表示 ＋「別の内容を送る」リセットボタン / エラー時はエラーメッセージ表示',
          'テーマ対応（dark/light）: cy系変数でサイバーUIに統一',
        ],
      },
      {
        type: 'list' as const,
        heading: 'ぽいロボ コネクト（右下ボタン）★2026-05-18 予約システム実装',
        items: [
          '研究室ビュー右下に配置（position: absolute, bottom: 20-28px, right: 16-28px, zIndex: 20）・transform: scale(1.2) で 1.2 倍表示',
          '博士画像（hakase.webp）＋「ぽいロボ コネクト」テキスト',
          'ユーザー: ボタン押下 → BookingModal（予約UI）が開く（未ログインでも空き枠閲覧可）',
          '管理者（sushi.ramen.unajyu@gmail.com）: ボタン押下 → AdminBookingPanel（予約管理UI）が開く。サブテキストは「予約管理」と表示',
          'ホバー時（PC）: POIROBO_CONNECT_v2.0 HUDパネルを表示',
        ],
      },
      {
        type: 'list' as const,
        heading: 'ぽいロボ コネクト — 予約システム仕様（BookingModal）★2026-05-18 新規',
        items: [
          '空き枠は管理者が事前登録（Firestore /slots コレクション）',
          'セッション長: 30分固定',
          '予約上限: 1ユーザーにつき pending + confirmed 合計1件まで',
          '予約可能期間: 直近2週間以内の枠のみ表示',
          'キャンセルポリシー: pending=いつでも可 / confirmed=48h前まで自由 / 24〜48h=警告あり / 24h以内=不可',
          '.ics ダウンロード: 予約申請後・状態確認画面からカレンダー追加ファイルをDL可（Google/Apple/Outlook 対応）',
          'BookingModal スクリーン遷移: loading → has_booking（既存予約あり）or slot_list（枠選択）→ confirm_book → booked',
          'セッション開始5分前〜終了まで「今すぐ接続する」ボタンが表示され JitsiPanel に接続',
          '未ログイン: 空き枠一覧は閲覧可。「予約を申請する」押下時にログイン画面へ誘導',
        ],
      },
      {
        type: 'list' as const,
        heading: 'ぽいロボ コネクト — 管理者UI仕様（AdminBookingPanel）★2026-05-18 新規',
        items: [
          '予約管理 タブ: 予約一覧（全件）。pending→「✓ 承認」ボタン / confirmed→「完了」ボタン / 双方とも「キャンセル」ボタン',
          '枠設定 タブ: 空き枠一覧 ＋ 日付・時刻入力で「+ 追加」。予約済みの枠は削除不可',
          '承認・キャンセル時はメッセージ入力欄付きの確認ダイアログを表示（任意メッセージをユーザーメールに送付）',
          '「▶ 接続」ボタン: AdminBookingPanel を閉じて即 JitsiPanel に接続（予約不要で通話開始可）',
        ],
      },
      {
        type: 'table' as const,
        headers: ['Firestore コレクション', 'ドキュメント構造', '権限'],
        rows: [
          ['/slots/{slotId}', 'date(YYYY-MM-DD) / startTime(HH:MM) / isBooked(bool) / createdAt', '読み: 全員 / 書き: 管理者のみ'],
          ['/bookings/{bookingId}', 'userId / userDisplayName / userEmail / slotId / date / startTime / status / adminMessage / requestedAt / updatedAt', '読み: 管理者 or 本人 / 作成: 認証済み / 更新: 管理者 or 本人'],
        ],
      },
      {
        type: 'table' as const,
        headers: ['status 値', '意味'],
        rows: [
          ['pending', '申請済み・承認待ち'],
          ['confirmed', '承認済み・確定'],
          ['cancelled_user', 'ユーザーによるキャンセル'],
          ['cancelled_admin', '管理者によるキャンセル'],
          ['completed', 'セッション完了'],
        ],
      },
      {
        type: 'list' as const,
        heading: 'ぽいロボ コネクト — 通知仕様（Resend / .ics）★2026-05-18 新規',
        items: [
          'メール通知: Vercel API Route `api/send-booking-email.js`（Resend API 経由）',
          '通知タイミング: 予約申請時（ユーザー受付確認 ＋ 管理者通知）/ 承認時 / ユーザーキャンセル時 / 管理者キャンセル時',
          '必要環境変数: RESEND_API_KEY / RESEND_FROM_DOMAIN',
          '.ics 生成: Vercel API Route `api/booking-ics.js`。クエリパラメータ: date/startTime/bookingId/name',
          '.ics 仕様: VCALENDAR/VEVENT 形式。開始〜30分のイベント（UTC変換）。Google/Apple/Outlook 対応',
        ],
      },
      {
        type: 'list' as const,
        heading: 'ぽいロボ コネクト — 通話仕様（JaaS / 8x8.vc）',
        items: [
          '通話基盤: JaaS (Jitsi as a Service) — 8x8.vc（無料枠 月10,000分）',
          'JWT 認証: Vercel API Route `api/jitsi-token.js` で RS256 署名（jose ライブラリ）',
          '必要環境変数: JAAS_APP_ID / JAAS_KEY_ID / JAAS_PRIVATE_KEY（サーバー）/ VITE_JAAS_APP_ID（クライアント）',
          'ルーム名: `{VITE_JAAS_APP_ID}/poirobo-{uid先頭12文字}`（ユーザー UID ベースで固有）',
          '最大参加人数: 2名（3人目が入ろうとした場合: 管理者がいれば即キック、ユーザーは「満員」表示で切断）',
          'ツールバー: マイク・画面共有・切断のみ（iOS は画面共有非対応のため2ボタン）',
          '管理者アカウント（sushi.ramen.unajyu@gmail.com）は表示名「ぽいふる博士」・moderator: true',
          'アバター: videoConferenceJoined 後に executeCommand("avatarUrl", hakase.png) で博士画像に設定',
          'JitsiPanel は App レベルで管理（position: fixed, zIndex: 500）。研究室以外のビューへ移動しても通話は維持される',
          '最小化ボタン: パネルを display:none にしてWebRTC接続を維持しつつ、右上にフローティングミニバー（ステータスドット・展開ボタン・切断ボタン）を表示',
          '展開ボタン: 研究室ビューへ遷移してパネルを全画面に戻す（onExpand）',
          '研究室以外のビューへ移動すると自動最小化 / 研究室へ戻ると自動展開',
          'iOS 判定: /iPhone|iPad|iPod/.test(userAgent) || (platform===MacIntel && maxTouchPoints>1)',
        ],
      },
      {
        type: 'list' as const,
        heading: 'プロンプト Evals（EvalsPanel）★2026-05-26 — 管理者専用',
        items: [
          '研究室 > 資料 > 「プロンプト Evals」カードからアクセス（管理者アカウントのみ表示）',
          '用途: AIプロンプト変更時の品質劣化チェック。3シナリオで出力の一貫性を定量評価',
          'スコア構成: 3シナリオ（強気相場・恐怖相場・データ品質問題）× 各9項目 = 最大27点',
          '採点項目（各シナリオ共通）: ① 確信度の形式（確信度：XX%）/ ② マークダウン禁止（- * ##）/ ③ 英語変数名禁止 / ④ JSON転記禁止 / ⑤ 慣性持続性の出力（★2026-05-26 追加）/ ⑥ 執行指令の必須語 / ⑦ ネガティブ形容詞の禁止 / ⑧ セクション見出し必須語 / ⑨ 総合テキスト判定',
          'スコアゲージ: ▓░ ブロックバー・PASS（24〜27点）/ WARN（18〜23点）/ FAIL（〜17点）',
          'カード枠色: PASS=緑 / WARN=黄 / FAIL=赤でシナリオ別に即時フィードバック',
          '操作: 各シナリオの想定AI出力（プロンプト・JSONは不要）を貼り付けて「採点」ボタンを押すだけ',
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
          ['poical-margin-data-v2', '24時間', '信用倍率JSONキャッシュ'],
          ['poical-investor-data', '24時間', '投資主体別JSONキャッシュ'],
          ['poical-nhk-news', '30分', 'NHKニュースRSS'],
          ['poical-sticky-notes', '永続', 'サイドバースティッキーメモ（最大1件）'],
          ['poical-short-sell-data', '24時間', '空売り比率JSONキャッシュ'],
          ['poical-ad-ratio-data', '24時間', '騰落レシオJSONキャッシュ'],
          ['poical-arbitrage-data', '24時間', '裁定買い残JSONキャッシュ'],
          ['poical-quant-memo', '永続', 'データビュー エントリー分析レポートメモ（分析タブ右）'],
          ['poical-auto-prompt-last-added', '永続', '週次自動メモ追加済みキー'],
          ['poical-chart-split', '永続', 'チャート分割設定'],
          ['poical-futures-participants-v2', '24時間', '先物投資部門別ネット枚数データ（先物タブ・週次）'],
          ['poical-futures-daily-data-v2', '24時間', '先物建玉残高・取引高・PCRデータ（先物タブ・日次）'],
          ['poical-usdjpy-data', '30分（平日）/ 2時間（土日）', 'USD/JPY 日次データ（現物タブ）'],
          ['poical-nas100-data', '30分（平日）/ 2時間（土日）', 'NAS100(^NDX) 日次データ（偏差スコア計算用）'],
          ['poical-vix-daily-data', '30分（平日）/ 2時間（土日）', 'VIX 日次データ（偏差スコア・TPI計算用）'],
          ['poical-nk-futures-price-v4', '30分（平日）/ 2時間（土日）', '日経平均 OHLCV データ（静的JSON優先 → Yahoo Finance プロキシ フォールバック）'],
        ],
      },
      {
        type: 'list' as const,
        heading: '週次データ自動取得スクリプト',
        items: [
          'スクリプト: `scripts/fetch-jpx.mjs`',
          '実行: `npm run fetch-data`',
          'GitHub Actions: `.github/workflows/fetch-data.yml`（火 18:30 / 水 18:00 / 木 18:30 / 金 18:30 / 土 09:00 JST 自動実行 ＋ Vercel自動デプロイ）',
          '出力先: `public/data/margin.json` / `public/data/investor.json` / `public/data/vix.json` / `public/data/usdjpy.json` / `public/data/nk_futures_price.json` / `public/data/advance_decline.json` / `public/data/short_sell.json` / `public/data/arbitrage.json`',
          '騰落レシオ・空売り比率・PCR: nikkei225jp.com daily2year.json（col[7]/col[11]/col[16]）を一括取得・キャッシュ共有',
          'PCR = プット/コールOI比（日次・値域0.75〜2.52）。オプション市場引け後更新のためOIより数時間遅れる場合あり',
          '裁定買い残: nikkei225jp.com/_data/_nfsWEB/HS_DATA_DAY/daily_saitei.json（col[8]、Refererヘッダー必要）を週次52件',
          'USD/JPY: Yahoo Finance USDJPY=X（日次・3ヶ月・終値/前日比/MA5/MA5乖離）→ public/data/usdjpy.json',
        ],
      },
    ],
  },
  {
    id: 'shield',
    icon: '🛡️',
    title: 'シールドビュー（ShieldView）',
    content: [
      {
        type: 'para' as const,
        text: 'フッターナビの「シールド」タブからアクセスできるビューです。保有中ポジションの管理・出口戦略に特化し、エントリー判断は対象外です。NK225先物マーケットデータ（OHLCV・MA・建玉残高・PCR・VIX）を自動取得・表示し、AIプロンプトと保有ポジション画像を組み合わせて分析します。',
      },
      {
        type: 'list' as const,
        heading: 'NK225マーケットデータ（buildShieldData）',
        items: [
          'データソース: Yahoo Finance ^N225（query1→query2 フォールバック、encodeURIComponent 使用）',
          '取得期間: 1年分日足 OHLCV（interval=1d&range=1y）',
          '計算値: MA20 / MA60 / MA200 / 直近20日高値 / 直近20日安値 / 直近10日OHLCV（前日比%付き）',
          '先物建玉・PCR: fetchFuturesDailyData（public/data/futures_daily.json）から最新値',
          'VIX: fetchVixData（週次 newest-first 配列の[0]が最新）から最新値・前週比',
          'キャッシュなし（リロードごとに再取得）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'シールド画面構成 ★2026-05-27 イベントタブ追加・ニュース→イベント改称',
        items: [
          'タブ切り替え: 右下フローティングpill（App.tsx の floatSubBar に統合）でシールド / イベント を切り替え。cal.view === "shield" のときのみ表示',
          '【シールドタブ】SHIELD_STATUS_LINES: ターミナル風ステータスログ（12行）をタイプライターアニメーションで表示',
          '【シールドタブ】マーケットデータカード: 日付・終値・前日比・MA20/MA60/MA200・20日高値/安値・建玉残高・PCR・VIXを表示',
          '【シールドタブ】直近OHLCV テーブル（10件）: 日付 / 始値 / 高値 / 安値 / 終値 / 前日比%',
          '【シールドタブ】AIプロンプト生成ボタン: マーケットデータ JSON ＋ プロンプトテンプレートをクリップボードにコピー',
          '【シールドタブ】プロンプト中には添付画像（ポジション画像）が必須と明示。画像未添付の場合AIが分析拒否',
          '【イベントタブ】NewsPanel（★2026-05-27 旧「ニュースタブ」を「イベントタブ」に改称）: シールドパネルと同デザイン（サイバーターミナル風）。NEWS_STATUS_LINES（10行）をタイプライターアニメーションで表示。右側エリアは未実装（予約済み）',
          '【イベントタブ】ヘッダー: 「ぽいロボ イベント」＋メガホンSVGアイコン。COPYボタンはイベントプロンプトをコピー（copyStatus: "news_shield"）',
          '【イベントタブ】ニュースプロンプト（newsPrompt.ts）: COPYボタン押下時に getRecentEngineReport() で直近エンジンレポートを取得し【参照需給状態】セクションに動的挿入（★2026-05-27 静的プレースホルダーから動的化）',
          'ログイン済みユーザーにのみコピーボタン・データを表示（未ログイン: ログイン促す表示）',
          '旧ニュース小ボタン（★2026-05-23）は削除済み（★2026-05-27）: シールドパネル・エンジンパネル両方から削除し NewsPanel に統合',
        ],
      },
      {
        type: 'list' as const,
        heading: 'シールド AIプロンプト仕様',
        items: [
          'Role: 保有中ポジション専門アドバイザー「ぽいロボ シールド」',
          '分析対象: 保有中のポジション（ブル/ベアファンド・先物）の管理・出口戦略のみ',
          '必須入力: 証券会社保有画面のスクリーンショット（銘柄名・平均取得価格・現在価格・損益）',
          '提供データ: built_at / nk225（latest_close・change_1d・MA20/60/200・high/low_20d・ohlcv_recent）/ futures（oi・oi_delta・pcr）/ vix（latest・change_pct）',
          'JSON末尾に市場データを添付。画像確認できない場合はエラーメッセージのみ出力する設計',
        ],
      },
    ],
  },
  {
    id: 'design',
    icon: '🎨',
    title: 'デザイン仕様',
    content: [
      {
        type: 'para' as const,
        text: 'ぽいロボのUI・配色システムの概要です。コンポーネントの役割によって配色システムを使い分けています。',
      },
      {
        type: 'list' as const,
        heading: '配色システム — 2分類',
        items: [
          'ぽいロボ機能系（シアン）: QuantView / EnginePanel / ShieldView / ShieldPanel / ShieldMemoPanel / QuantMemoPanel / MicroQuantView / DeltaModal / PoiroboAlertModal。サイバーターミナル風デザイン。カラー: #00e5ff (dark) / #0369a1 (light)',
          '一般UI系（CSS変数）: SupportView / SettingsPanel / AuthModal / ContactForm / BookingModal / AdminBookingPanel / ManualView / LegalModal / SpecView。var(--glass-bg) / var(--glass-border) / var(--text) / var(--text-dim) などを使用',
        ],
      },
      {
        type: 'table' as const,
        headers: ['CSS変数', '用途'],
        rows: [
          ['--text', 'メインテキスト'],
          ['--text-sub', 'サブテキスト・説明文'],
          ['--text-dim', '薄いテキスト・プレースホルダー・アイコン'],
          ['--glass-bg', 'カードの背景色（半透明ガラス風）'],
          ['--glass-border', 'カードのボーダー色'],
          ['--modal-bg', 'モーダル・スクロール固定ヘッダー背景'],
          ['--bg-subtle', 'テーブルの交互行背景・セクション区切り'],
          ['--border-dim', '薄いボーダー・区切り線'],
          ['--view-btn-active-bg', 'アクティブタブの背景色'],
          ['--view-btn-active-color', 'アクティブタブのテキスト色'],
          ['--latest-row-bg', 'テーブル最新行のハイライト背景'],
        ],
      },
      {
        type: 'list' as const,
        heading: 'テーマ',
        items: [
          'ダークモード / ライトモードの2テーマ。設定は localStorage `poical-settings` に永続保存',
          'テーマ切り替え: 研究室 > 設定 > 表示セクションの segmented buttons',
          'カレンダービューはダークモード専用の配色ルールあり（MonthView / WeekView / DayView）',
          'ぽいロボ機能系は `cy(theme)` ヘルパーで全色変数を切り替え（dark: #00e5ff / light: #0369a1）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'データ着色ルール（QuantView）',
        items: [
          '上昇（プラス）: 赤系 / 下落（マイナス）: 緑系（日本株の慣習）',
          '信用倍率: ≥6=赤（過熱危険）/ ≥4=薄赤 / ≤2.5=緑 / ≤1.5=濃緑',
          '評価損益率: >−3%=緑背景 / <−15%=赤背景（濃）/ <−10%=赤背景（薄）/ それ以外=透明',
          'PCR: ≥1.2=赤（プット優勢・弱気）/ ≤0.8=緑（コール優勢・強気）',
          '空売り比率: ≥50%=赤 / ≤38%=緑',
          '騰落レシオ: ≥120=赤（過熱）/ ≤70=緑（底値圏）',
          '前日比（日経平均先物テーブル）: プラス=緑背景 / マイナス=赤背景',
        ],
      },
      {
        type: 'list' as const,
        heading: 'レイアウト・ブレークポイント',
        items: [
          'isMobile: window.innerWidth ≤ 768 を基準に判定（App.tsx で resize イベントにより動的更新）',
          'スマートフォン（isMobile=true）: 縦1列レイアウト / テーブルは折りたたみ式（MOBILE_ROW_LIMIT=10件）',
          'PC: 各ビュー固有のカラム構成（2〜3カラム）',
          'サイドバー: PC のみ表示（width: 280px）/ スマートフォンでは非表示',
          'フッター CalendarHeader: 全ビュー・全デバイス共通（つまみボタンで開閉可能）',
          'パネルヘッダー高さ: minHeight: 36 を全パネルで統一（★2026-05-26）。ボタン・select 等のコントロールがある場合は height: 26px・padding: 5px 14px に統一してはみ出しを防止',
        ],
      },
    ],
  },
  {
    id: 'maintenance',
    icon: '🔧',
    title: 'メンテナンス手順',
    content: [
      {
        type: 'para' as const,
        text: 'ぽいロボの定期メンテナンス項目と実行手順をまとめています。AI推奨モデルテキストは各AIのモデルリリースに合わせて更新が必要です。',
      },
      {
        type: 'list' as const,
        heading: 'Claude への指示文（コピー＆送信するだけで実行）',
        items: [
          '【カテゴリA / 不定期】ぽいロボのAIモデル推奨ヒントをメンテナンスしてください。手順書は C:\\Project\\PointLab\\stock-calendar\\docs\\maintenance\\ai-model-check.md にあります。手順書を読んで、Web検索で各AIの最新モデルを調べ、更新が必要なら該当ファイルを修正してビルド・コミット・プッシュ・デプロイまで行ってください。',
          '【🔴 カテゴリB / 毎年12月必須】ぽいロボのカレンダー年次日程をメンテナンスしてください。手順書は C:\\Project\\PointLab\\stock-calendar\\docs\\maintenance\\calendar-dates-check.md にあります。手順書を読んで、Web検索で翌年のNYSE休場日・各マクロイベント日程を調べ、該当ファイルに追記してビルド・コミット・プッシュ・デプロイまで行ってください。',
        ],
      },
      {
        type: 'list' as const,
        heading: 'カテゴリA — AIモデル推奨ヒント更新（手順書: docs/maintenance/ai-model-check.md）',
        items: [
          '対象テキスト: ChatGPT「o3以上推奨」/ Gemini「思考モード推奨」/ DeepSeek「R1モデル推奨」',
          '対象ファイル: src/components/QuantView.tsx（CYBER_MODE行 + 通常モード行、各AI 2箇所） / src/components/ShieldView.tsx（SHIELD_AI_LINKS の hint、各AI 1箇所）',
          '更新トリガー: 各AIが新しい推論/思考モデルを正式リリースした時（プレビュー・限定公開は対象外）',
          '更新頻度目安: 数ヶ月〜1年に1回程度',
        ],
      },
      {
        type: 'list' as const,
        heading: 'カテゴリA 実行手順',
        items: [
          '手順1 — Web検索: ChatGPT（OpenAI最新推論モデル）/ Gemini（思考モード対応モデル）/ DeepSeek（最新モデル）を検索して現在推奨すべきモデルを確認',
          '手順2 — 変更判断: 正式リリース済み・一般利用可能な場合のみ更新する。プレビュー版は対象外',
          '手順3 — ファイル更新: Editツールで replace_all: true を使用して各ファイルのテキストを一括変換',
          '手順4 — ビルド確認: npm run build でTypeScriptエラーがないことを確認',
          '手順5 — コミット & プッシュ: git commit → git push → Vercel自動デプロイ確認',
          '手順6 — docs/maintenance/ai-model-check.md の「現在の値」テーブルと「最終更新」日付を更新',
        ],
      },
      {
        type: 'table' as const,
        headers: ['AI', 'QuantView CYBER行', 'QuantView 通常行', 'ShieldView hint行', '現在のヒント'],
        rows: [
          ['ChatGPT', '1479', '1590', '1002', 'o3以上推奨'],
          ['Gemini', '1509', '1614', '1011', '思考モード推奨'],
          ['DeepSeek', '1567', '1660', '1030', 'R1モデル推奨'],
        ],
      },
      {
        type: 'list' as const,
        heading: '注意事項',
        items: [
          'ファイル編集後は行番号がずれる場合があるため、次回更新時は Grep で最新行番号を確認すること',
          'ヒントテキストは表示スペースが限られるため6〜10文字程度に収める',
          'DeepSeekはサーバー安定性・データプライバシー懸念（中国企業）のため、ポジション情報を含むシールドプロンプトへの利用には注意喚起を検討すること',
        ],
      },
      {
        type: 'list' as const,
        heading: '🔴 カテゴリB — カレンダー年次日程更新（手順書: docs/maintenance/calendar-dates-check.md）',
        items: [
          '実施タイミング: 毎年12月上旬（翌年分のFOMCスケジュール等が公表される頃）',
          '更新しないと機能破綻: 翌年のNYSE休場日・マクロイベントがカレンダーに一切表示されなくなる',
          'src/utils/marketHolidays.ts — NYSE_HOLIDAYS 配列に翌年分を追加（NYSE公式サイトから取得）',
          'src/utils/macroCalendar.ts — FOMC / 日銀 / NFP / CPI / PCE / GDP / 短観 の各配列に翌年分を追加',
          'SQ算出日・配当権利日は計算式で自動判定されるため更新不要',
          '現在のカバレッジ: 〜2026年末（次回更新: 2026年12月頃・2027年分を追加）',
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
function renderContent(block: (typeof SPEC_SECTIONS)[0]['content'][0]) {
  if (block.type === 'para') {
    return (
      <p key={block.text} style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.75, color: 'var(--text-sub)' }}>
        {block.text}
      </p>
    )
  }

  if (block.type === 'list') {
    return (
      <div key={block.heading} style={{ marginBottom: 20 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {block.heading}
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>›</span>
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
                  background: 'var(--bg-subtle)', color: 'var(--text)', fontWeight: 600,
                  borderBottom: '1px solid var(--glass-border)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '7px 12px',
                    color: ci === 0 ? 'var(--text)' : 'var(--text-sub)',
                    fontWeight: ci === 0 ? 500 : 400,
                    borderBottom: '1px solid var(--glass-border)',
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
export function SpecView({ theme, isMobile, onClose }: Props) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      padding: isMobile ? '20px 16px 40px' : '28px 32px 48px',
      background: theme === 'dark' ? '#0f0f0f' : '#f4f6f9',
    }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 14 }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid var(--glass-border)', borderRadius: 8,
                padding: '6px 12px', cursor: 'pointer', color: 'var(--text-dim)',
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              ← 戻る
            </button>
          )}
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ぽいロボ" style={{ height: 36, objectFit: 'contain', opacity: 0.9 }} />
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              システム仕様
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              ぽいロボ — 最終更新: 2026-05-26
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
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 14,
                padding: isMobile ? '18px 16px' : '22px 24px',
              }}
            >
              {/* セクションタイトル */}
              <h2 style={{
                margin: '0 0 16px',
                fontSize: isMobile ? 16 : 17,
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 8,
                letterSpacing: '-0.3px',
              }}>
                <span style={{ fontSize: 18 }}>{section.icon}</span>
                {section.title}
              </h2>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                {section.content.map((block, i) => (
                  <div key={i}>{renderContent(block)}</div>
                ))}
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  )
}
