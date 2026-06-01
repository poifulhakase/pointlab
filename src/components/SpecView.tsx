import { useState, useRef, useEffect } from 'react'

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
          'マクロイベント：FOMC・雇用統計（NFP）・ADP雇用統計・CPI・PCE・ISM製造業景気指数・日銀会合・短観（米国/日本フィルター付き）',
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
          'タイトルが空のままスケジュール保存する場合、メモ欄先頭行を自動でタイトルに補完',
          '30分刻みドロップダウン + テキスト入力のハイブリッド時刻入力',
          'メモ・スケジュール全削除: 確認ダイアログ → localStorage と Firestore 両方から削除（★2026-05-28 修正: handleDelete で onAfterSave を呼び出し空データを Firestore に書き込むことで同期削除）',
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
          '米国イベント（FOMC・雇用統計（NFP）・ADP雇用統計・CPI・PCE・ISM製造業）の表示ON/OFF',
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
    title: 'エンジン（QuantView）',
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
          ['信用倍率', '毎週金曜日', '翌週火曜日', '週次自動取得（火〜土 JST）'],
          ['投資主体別売買動向', '毎週金曜日', '翌週木曜日', '週次自動取得（火〜土 JST）'],
          ['騰落レシオ・空売り比率', '毎日', '当日', '週次自動取得（火〜土 JST）（52週分）'],
          ['裁定買い残', '毎週金曜日', '翌週金曜日', '週次自動取得（火〜土 JST）（52週分）'],
          ['先物投資部門別手口', '毎週金曜日', '翌週木曜日', '週次自動取得（火〜土 JST）'],
          ['PCR（プット・コール・レシオ）', '毎日', '当日（オプション引け後）', '週次自動取得（火〜土 JST）（日次60件）'],
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
        heading: 'バックテスト（BacktestPanel）★2026-05-30 改称',
        items: [
          '研究室 > 資料 > 「バックテスト」カードからアクセス（★2026-05-30 管理者限定に変更＝検証途上・サンプル不足のため当面は内部R&D扱い。サンプルが揃い次第 公開範囲を再検討）。パネル冒頭に「サンプル不足・継続検証中」の注意書きを表示',
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
          ['研究室', 'メニュー（4ボタン）: POIROBO（ぽいロボとは？）/ 資料（DATA）/ 設定（SETTINGS）/ お問い合わせ（CONTACT）'],
          ['資料', 'NoteView — 記事一覧（基礎・インジケーター・イベントドリブン・未来ガジェット）。特殊カード: バックテスト・システム仕様・プロンプト Evals（いずれも管理者のみ）。DATAドロワー幅: PC時 1000px（★2026-05-27 500px→1000px に拡大）。「← 研究室」ボタンで研究室へ戻れる'],
          ['使い方', 'ManualView — アプリ説明書（研究室 > 資料 > 使い方ガイドカードからアクセス）。★2026-05-27 PC2カラムレイアウト・サブセクション構造に改善（maxWidth: 1000、エンジン/研究室は gridColumn: 1/-1 でフル幅）'],
        ],
      },
      {
        type: 'list' as const,
        heading: 'メニューボタン（4項目）',
        items: [
          'POIROBO → ぽいロボとは？ページ（PoiroboAboutPanel）をフルスクリーンオーバーレイで表示',
          '資料（DATA）→ NoteView（記事一覧）を右スライドドロワーで表示（PC: 1000px幅）',
          '設定（SETTINGS）→ 右スライドドロワーで開く（テーマ / アカウント / 通知）',
          'お問い合わせ（CONTACT）→ 右スライドドロワーでカスタムフォームを表示（Google Forms バックエンド経由送信）',
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
          'ハンバーガーメニューアイコン（左下）: スマートフォン（<640px）のみ表示。タブレット幅（640〜1023px）では非表示（★2026-05-28 修正）。CalendarHeader: showMenu = isMobile のみ',
        ],
      },
      {
        type: 'list' as const,
        heading: '設定（研究室 > SETTINGS ドロワー）★2026-05-30 SettingsPanel 統合・整理',
        items: [
          '研究室 > SETTINGS ボタンで右スライドドロワーとして開く（SupportView 内に実装）',
          '★2026-05-30: 旧 SettingsPanel モーダル（到達不能なデッドコード）を削除し、設定UIを SupportView ドロワー1箇所に統合。設定UIの二重実装を解消',
          'セクション順: アカウント → 通知 → 表示 → 表示プレビュー（管理者）→ メンテナンスモード（管理者）',
          'アカウントセクション: Googleログイン / ログアウト（AuthModal を開く）・同期ステータス表示',
          '通知セクション: 共通コンポーネント NotificationSettings（src/components/NotificationSettings.tsx）。プッシュ通知 ON/OFF トグル＋種別チェックボックス。未ログイン時はグレーアウト。★2026-05-30 共通部品化（以前は2箇所に重複実装されチェックボックス欠落バグの原因だった）',
          '通知種別: ① ぽいロボ レーダー（イベント前日 12:30）② データ更新通知（週次・土曜）。localStorage: poical-notify-radar / poical-notify-data-ready',
          '表示セクション: ライト / ダーク テーマ切り替え（segmented buttons）。dark の neutral/blue 切替UIは SettingsPanel 削除に伴い廃止（保存値は引き続き適用）',
          '表示プレビュー（管理者のみ）: メンバー/非メンバーモード切替でロック画面を確認',
          'メンテナンスモード（管理者のみ・★2026-05-30）: トグルで全ユーザー（管理者以外）を全画面ブロック。Firestore config/maintenance に保存・即時反映',
        ],
      },
      {
        type: 'list' as const,
        heading: 'プッシュ通知（FCM）★2026-05-28 種別選択追加',
        items: [
          '通知種別① ぽいロボ レーダー: 選択イベントの前日 12:30 JST に通知。Vercel Cron `api/cron-push-notifications.js`（毎日 03:30 UTC）',
          '通知種別② データ更新通知: 週次需給データ更新後（土曜）に通知。GitHub Actions 成功後 `api/notify-data-ready.js` を POST 呼び出し',
          'Firestore スキーマ: pushSubscriptions/{uid} に pushEnabled / notifyRadar / notifyDataReady / fcmToken / poiroboAlertConfig を保存',
          'notify-data-ready.js 認証: x-notify-secret ヘッダー（NOTIFY_SECRET 環境変数）で保護。Vercel + GitHub Secrets に登録済み',
          'フロー: ブラウザ通知許可 → VAPID キーで FCM トークン取得 → firestoreRest.ts の restSetDoc() で保存',
          'SW: `firebase-messaging-sw.js` をドメインルート `/` に配置。バックグラウンド受信・通知クリックで https://pointlab.vercel.app/calendar/ を開く',
          '実装注意: Firestore SDK の setDoc() はこのアプリでハングするため、必ず firestoreRest.ts の restSetDoc() を使用すること',
          'localStorage: poical-push-enabled / poical-notify-radar（デフォルトtrue）/ poical-notify-data-ready（デフォルトfalse）',
          '後方互換: cron-push-notifications.js は notifyRadar ?? poiroboAlertEnabled で旧データに対応',
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
          '必要環境変数: RESEND_API_KEY / RESEND_FROM_EMAIL（後方互換: RESEND_FROM_DOMAIN）。値はメールアドレス形式（例: noreply@yourdomain.com）で設定すること',
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
          ['poical-quant-memo', '永続', 'エントリー分析レポートメモ（エンジン 分析タブ右）'],
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
          'GitHub Actions: `.github/workflows/fetch-data.yml`（火 20:30 / 水 18:30 / 木 20:30 / 金 20:30 / 土 09:00 JST 自動実行 ＋ Vercel自動デプロイ）★火/木/金は2026-05-29に18:30→20:30へ変更（JPX日次レポート17:00公表の3.5h後）',
          'データ鮮度チェック（★2026-05-29追加）: クロン実行後に futures_daily（4日以内）/ investor（10日以内）を自動検証。古い場合はGitHub Issueを自動作成（data-staleラベル）',
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
          '一般UI系（CSS変数）: SupportView / NotificationSettings / MaintenanceScreen / AuthModal / ContactForm / BookingModal / AdminBookingPanel / ManualView / LegalModal / SpecView。var(--glass-bg) / var(--glass-border) / var(--text) / var(--text-dim) などを使用',
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
          'src/utils/macroCalendar.ts — FOMC / 日銀 / NFP / CPI / PCE / 短観 の各配列に翌年分を追加（ADP は NFP の2営業日前として自動導出・ISM は毎月第1営業日として自動算出のため手動追加不要だが、ISM は祝日事情で稀にずれるため要確認）',
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
  {
    id: 'security',
    icon: '🔒',
    title: 'セキュリティ・品質',
    content: [
      {
        type: 'para' as const,
        text: 'Vercel サーバーレス API のセキュリティ対策、フロントエンドパフォーマンス最適化、およびアクセシビリティ対応の実施状況です。（★2026-05-28 対応）',
      },
      {
        type: 'list' as const,
        heading: 'API セキュリティ対策（api/*.js）',
        items: [
          'CORS: 全APIで ALLOWED_ORIGIN（https://pointlab.vercel.app）による Origin ヘッダー検証を実施',
          'jitsi-token.js: 管理者判定をメールアドレス（クライアント入力・信頼不可）→ uid + ADMIN_UID 環境変数に変更。ADMIN_EMAIL のハードコードを削除',
          'send-booking-email.js: escapeHtml() 関数でユーザー入力の HTML 特殊文字をエスケープ（XSS防止）。ADMIN_EMAIL を環境変数化',
          'booking-ics.js: escapeIcs() 関数で RFC 5545 準拠の ICS フィールドエスケープ。date / startTime の書式バリデーション（正規表現 + 値域チェック）を追加',
          'youtube-rss.js: AbortSignal.timeout(10000) でタイムアウト制御（Vercel Function の無限ハング防止）',
          '全 API: エラーレスポンスから String(e) などの内部詳細を除去し、固定の日本語メッセージのみ返却',
          'ADMIN_EMAIL 環境変数: Vercel production に設定済み',
          'CRON_SECRET: Vercel production に設定済み（★2026-05-29）。cron-push-notifications.js の Authorization: Bearer 認証に使用',
        ],
      },
      {
        type: 'list' as const,
        heading: 'フロントエンドパフォーマンス最適化',
        items: [
          'exportJson の遅延計算: buildExportJson() を useMemo（全データソース変化で再計算）→ handlePromptCopy 内のみ実行に変更。初回ロード時の無駄な重複計算（最大14回）を排除',
          'Firestore 遅延ロード: firebase.ts の getDb() で動的 import。認証後にのみ Firestore SDK がロードされる',
          'バンドル分割: vite.config.ts の manualChunks で Firestore を専用チャンク "firestore"（gzip 86KB）に分離。初期ロード不要',
          '遅延ロードビュー: 12 ビューを React.lazy() で分割。初回描画は CalendarHeader + DayView のみ',
          'PWA precache: data/*.json・notes/*.webp を除外し、JS/CSS/HTML/アイコンのみキャッシュ（約 1780KB）',
          'Console / debugger 削除: vite.config.ts の esbuild.drop で本番ビルドから自動除去',
          'Cache-Control immutable: /calendar/assets/* に max-age=31536000, immutable 設定（ハッシュ付きファイル名のため安全）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'アクセシビリティ（★2026-05-28 対応）',
        items: [
          '全モーダルに role="dialog" + aria-modal="true" を追加: AuthModal / SettingsPanel / StickyNoteModal / DayNotePanel / BookingModal',
          'SettingsPanel / DayNotePanel: aria-labelledby でモーダルタイトルを参照（スクリーンリーダー対応）',
          'アイコンボタンの aria-label: SettingsPanel / BookingModal の閉じるボタンに aria-label="閉じる" を追加',
          'CalendarHeader: ナビゲーションボタンに aria-label={v.label}、ハンバーガーメニューに aria-label="メニュー" 設定済み',
          'Escape キー: 全モーダルで keydown リスナーにより閉じる動作を実装済み',
          '★2026-05-30 対応済み: Vitest 114テスト（前述 + firestoreRest 往復 / maintenanceState / admin / newsPrompt / validate）/ 全lazy ビューにErrorBoundary適用＋Sentry自動上報',
          'Sentry エラー監視（★2026-05-29 有効化）: VITE_SENTRY_DSN を Vercel env に設定済み。本番エラーを https://sentry.io で自動検知。新規エラー発生時はメール通知（sentry.io Alerts 設定済み）',
        ],
      },
      {
        type: 'list' as const,
        heading: 'アーキテクチャ整理（★2026-05-30 リファクタ）',
        items: [
          '管理者判定の集約: src/utils/admin.ts に ADMIN_EMAIL / isAdminEmail() を集約。App.tsx・SupportView・JitsiPanel のハードコードを置換（firestore.rules と api/*.js は別管理）',
          '設定UI統合: 到達不能だった SettingsPanel モーダルを削除し、研究室 SETTINGS ドロワー1箇所に統一。通知UIは NotificationSettings コンポーネントに共通化',
          'App.tsx フック抽出: useCommunityAccess / usePushNotifications / useMaintenance / useBooking に分割し App.tsx を組み立て役へ軽量化',
          'ShieldView 分割: cyberTheme.ts / CyberSystemLog.tsx / shieldPrompt.ts / shieldData.ts / CyberAiLaunch.tsx（AILaunchRow を ShieldPanel⇄NewsPanel で共通化）を抽出',
          'Firestore 書き込みは REST（firestoreRest）に一本化。★2026-05-30 検証: SDK の setDoc は forceLongPolling を試してもハング（メモ保存で write-path=rest を確認）→ REST が正解と確定し、SDK書き込み実験（setDocGuarded）は撤去。getDb() は onSnapshot 読み取り専用',
          'localStorage キー集約: storageKeys.ts（LS）に新規・重要キーを集約',
          'データ境界検証: validate.ts（isRecord/asNumber/asString/asBoolean/asArray/field）。maintenanceState の REST パースに適用（パターン確立・データ取得層は順次移行）',
          'Firestore ルール強化: bookings の create を userId==auth.uid・status=pending・必須フィールドで検証。slots は管理者のみ書き込み可に変更（旧「認証ユーザーは isBooked のみ更新可」の改ざん穴を廃止）。rateLimits はサーバー専用',
          '予約キャンセルのサーバー化: api/cancel-booking.js（Admin SDK・本人/管理者のみ・スロット解放をトランザクションで実行）。クライアント直接の slots 書き込みを撤廃',
          'API レート制限: api/_ratelimit.js（Firestore ベース・per uid/action）を create-booking / cancel-booking に適用（連打濫用の抑止）',
          'データ境界パーサ集約: utils/yahooChart.ts（parseYahooChart）。vix/nas100/ntRatio/usdjpy/nkFuturesPrice/shield の Yahoo パースを統一し as any を排除',
          'コミュニティ非メンバー時はフローティングサブバー（月/週等）も非表示（legal は全員公開のため維持）',
          'CI lint をブロッキング化（★2026-05-30 エラー0件化）: 本物の指摘（no-empty/no-irregular-whitespace/ban-ts-comment）を修正、hakaseAI（別プロジェクト）を eslint 対象外に、React Compiler 系ルール（set-state-in-effect/purity/refs/preserve-manual-memoization）と react-refresh/only-export-components は最適化助言のため warn に格下げ。error 0・warning 37',
          'a11y: 通知トグル/チェックボックスに role/aria/キーボード操作を付与',
          '表示速度: Sentry を初期ロードから除外（sentry.ts は動的 import + requestIdleCallback で遅延 init、ErrorBoundary もエラー時に動的 import）。gzip 約46KB を初回描画クリティカルパスから外した',
          '管理者は単一運用（★2026-05-31 整理）: 一時的に ADMIN_EMAILS 配列化したが、firestore.rules/API env まで一貫配線しないと中途半端になり誤解の元のため単一 ADMIN_EMAIL 定数に戻した。副管理者が必要になれば全層をまとめて対応する',
          'JST 日付の正確化: utils/jstDate.ts（jstTodayKey/jstTimestamp）。手動 +9h オフセットを Intl の Asia/Tokyo に置換し日付境界の off-by-one を解消',
          'アプリアイコン: インストール後表示アイコン（icon-192/512/maskable/apple-touch）のロゴを 1.1倍にズーム（scripts/zoom-icons.cjs・キャンバス寸法は維持）',
          'テスト追加（計117）: firestoreRest 往復・maintenanceState・admin・newsPrompt・validate・jstDate',
        ],
      },
      {
        type: 'list' as const,
        heading: 'セキュリティ・品質・パフォーマンス改善（★2026-05-31 第12セッション）',
        items: [
          'カレンダー月送りバグ修正: 月末(31日等)に居る状態で「>」を押すと setMonth の繰り上がりで翌月を飛ばしていた（例 5/31→7月）。月送り前に日を1日へ固定。ロジックを純粋関数 stepDate に抽出し回帰テスト6件追加',
          'buildExportJson を分離: QuantView の約760行・15引数関数を純粋モジュール utils/engineExport.ts へ抽出（EngineExport 型をエクスポート）。構造検証テスト12件を追加',
          'JST 日付キー集約: MicroQuantView の todayStr() を jstTodayKey() に置換（深夜境界の off-by-one 解消）。任意 Date を YYYY-MM-DD 化する dateKey(d) を jstDate.ts に追加し useBooking と共通化',
          '管理者は単一運用に戻した: 副管理者(ADMIN_EMAILS配列)を廃止し ADMIN_EMAIL 単一定数に（配列に足しても firestore.rules/API は主管理者しか認識せず誤解の元のため）',
          'チャート(TradingView)を無料公開化: 無料ウィジェットをメンバー限定(ペイウォール)内に置く規約上の曖昧さ回避。アトリビューション(ロゴ・リンク)は保持。チャート本体とフローティングサブバーを isMember 条件の外へ（legal と同扱い）。有料価値の本体=エンジン/需給/シールドは限定継続',
          'jitsi-token のセキュリティ強化: 従来はクエリの uid/email を信頼し誰でもトークン生成可だった。Admin SDK で idToken を検証し uid/email は検証済みトークンから採用（Authorization:Bearer で受領）。moderator 判定に ADMIN_EMAIL も追加。uid あたり 60秒20回のレート制限',
          'lint warning 0 件化（37→0）: no-explicit-any は実型付け、exhaustive-deps は依存追加 or useCallback 安定化、only-export-components は理由付き disable、LockSkeletons の描画中 Math.random をモジュール定数化（再ランダム化バグも修正）。残る React Compiler 助言(set-state-in-effect/refs/preserve-manual-memoization)は未導入のため off（purity/exhaustive-deps は実バグ捕捉のため維持）',
          'Lighthouse 実測（本番モバイル）: Performance 77 / LCP 4.8s / TBT 200ms / CLS 0。最大転送 poirobo.png 247KB を webp 49KB に切替（研究室・ロック画面・PWAバナーの小サムネが webp 未使用だった）。残課題は Firebase Auth iframe(90KB)・firebase SDK の削減',
          'テスト計136件（+19）: engineExport(12)・jstDate dateKey・useCalendar stepDate(6) を追加。lint error 0/warning 0・tsc 0',
          'グローバルナビ順変更: チャートを「研究室の左隣」へ移動（カレンダー→エンジン→シールド→チャート→研究室）。CalendarHeader の MAIN_VIEWS が単一情報源',
        ],
      },
      {
        type: 'list' as const,
        heading: 'セキュリティ・品質・パフォーマンス改善（★2026-05-31 第13セッション）',
        items: [
          'Firebase を完全遅延化（初期ロード -約69KB gzip）: firebase.ts の initializeApp / auth を promise シングルトンの getApp() / getAuthInstance() に全面遅延化（eager な firebase import をゼロに）。consumer（firestoreRest/bookingApi/JitsiPanel/fcmNotifications/useFirebaseSync）は await で取得し、useFirebaseSync は firebase/auth を effect・handler 内で動的 import。vite.config の manualChunks に firebase-auth チャンクを追加。ビルド index.html の modulepreload から firebase/firebase-auth/firestore が全消失＝初期クリティカルパスから除外',
          'Firebase Auth iframe(≈90KB) の遅延: getAuth → initializeAuth(popupRedirectResolver なし) に変更し、popup 用 gapi iframe の読み込みをサインイン実行時まで遅延（resolver は signInWithPopup に明示注入）',
          'Sentry ソースマップ有効化: @sentry/vite-plugin を導入し本番ビルド時に .map を Sentry へアップロード＆公開ディレクトリから削除（build.sourcemap: hidden）。本番のミニファイ済みエラーが元ソース行で解読可能に。env: SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN（Organization Token・org:ci）',
          '旧チャンク404の自動リロード: utils/lazyWithReload.ts。デプロイでハッシュが変わり古いタブが旧チャンクの取得に失敗（Failed to fetch dynamically imported module）した際、sessionStorage ガード付きで一度だけ自動リロードして最新チャンクを取得。全 lazy() に適用',
          'Sentry ノイズ除去: ignoreErrors に /has no method/（旧ブラウザ/拡張の注入スクリプト由来）、denyUrls に拡張機能スキーム（chrome/moz/safari-extension）を追加',
          '🔴 重大バグ修正① FIREBASE_SERVICE_ACCOUNT 未設定: Admin SDK 依存の全 API（jitsi-token / create-booking / cancel-booking / cron-push-notifications / notify-data-ready / send-booking-push）がモジュール初期化でクラッシュ（FUNCTION_INVOCATION_FAILED）していた。Firebase サービスアカウント鍵を Vercel env に設定して復旧。コネクト・予約・プッシュ通知が初めて実動作可能に',
          '🔴 重大バグ修正② api/ の CommonJS が ESM 環境でクラッシュ: package.json は "type":"module" なのに create-booking / cancel-booking / _ratelimit / admin-auth / booking-ics / rainviewer-weather-maps / youtube-rss / send-booking-push が require・module.exports（CJS）で書かれ、読み込み時に "require is not defined" でクラッシュしていた。全て import・export default（ESM）に変換（相対 import は拡張子 .js 必須）。api/ から CJS は完全消滅',
          'Admin 関数の堅牢化: 全 firebase-admin 系 API でモジュール直下の初期化を handler 内 getAdmin() 遅延初期化＋try/catch に統一。FIREBASE_SERVICE_ACCOUNT 不備時は FUNCTION_INVOCATION_FAILED クラッシュではなく 503（原因明示）を返す',
          '予約文言の実態合わせ: BookingModal の「承認されるとメールでお知らせします」を「この画面に反映されます」へ修正（メールは Resend 無料枠の制約で一般ユーザーに届かないため／方針B＝割り切り）',
          'CSP: connect-src に裸ドメイン https://8x8.vc を追加（*.8x8.vc ではサブドメインのみで一致せず external_api の .map 取得がブロックされていた）',
          'firestore reads の REST 化は見送り（方針判断）: firestore SDK は既に遅延ロードで初回 LCP に無影響、REST 化は実働中の onSnapshot リアルタイム同期をポーリングへダウングレードするネットマイナスのため不採用',
          'env 完全性チェック: コードが参照する全 env（サーバー/VITE_）と Vercel 設定を突合し欠落なしを確認',
          '🔴 セキュリティ監査の是正① 予約の自己承認の穴: firestore.rules の bookings allow update が予約者本人にも更新を許可していたため、ユーザーが自分の予約を直接 status:confirmed に書き換えて管理者承認なしにコネクト権限を得られた。正規の更新は管理者の confirm/complete のみ（本人の cancel/create はサーバーAPI経由）なので、本人句を廃止し管理者のみに厳格化',
          'セキュリティ監査の是正② 内部エラー漏洩: stocks-daily.js が 500 時に String(e) を返していたのを固定メッセージに変更（全API方針に統一）',
          '監査の確認事項: .gitignore は秘密情報（*.local/.env*.local/.vercel）を除外済み・env 欠落なし・api ESM 化済み。admin-auth.js のトークンは偽造可能だが消費側が別プロジェクト hakaseAI のため stock-calendar 環境に実害なし（対象外）',
          '予約システム API E2E テスト: scripts/e2e-booking.mjs（npm: e2e:booking）。Admin SDK でテスト用 idToken を発行し、本番 create-booking（200/スロットロック/pending）→ 二重予約 409 LIMIT_EXCEEDED → cancel-booking（200/cancelled_user/スロット解放）を通し検証してテストデータを後始末。サービスアカウント JSON は --sa で渡す（vercel env pull は Sensitive 値を空で返すため）。実行で 11/11 グリーン確認',
          '🔴 E2E が発見・修正した実バグ: cancel-booking.js のトランザクションが「予約を tx.update（write）→ スロットを tx.get（read）」の順で Firestore の read-before-write 制約に違反し、キャンセルが常に 500「キャンセルに失敗しました」だった（＝キャンセルも実は一度も動いていなかった）。スロット読み取りを書き込み前に並べ替えて修正',
          '予約ビジネスルールの単体テスト: bookingTypes.ts の getCancelPolicy（24h/48h 境界）/ isSessionNow（セッション枠）/ statusLabel / formatBookingLabel に Vitest 12件追加（計148件・全パス）',
          '本番 env の改行混入を清掃: ADMIN_EMAIL / VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_STORAGE_BUCKET / VITE_FIREBASE_MESSAGING_SENDER_ID の末尾 \\r\\n（過去の echo/貼り付け由来）を除いて実値で再設定（node -e write で改行なし）→ 再デプロイ・ログイン/同期 実機OK。E2E スクリプトは API キーを AIza+35文字 正規表現で抽出し保険化',
        ],
      },
      {
        type: 'list' as const,
        heading: 'データ鮮度・パイプライン修正（★2026-06-01 第14セッション）',
        items: [
          '🔴 PCR・騰落レシオ・空売り比率の欠落バグ修正: 取得元 nikkei225jp.com の var DAILY 配列に空要素（配列hole「,,」）が混入することがあり、JS では有効でも JSON.parse が配列全体で失敗していた。PCR 等が丸ごとサイレント欠落（「PCR取得失敗（スキップ）」）。scripts/fetch-jpx.mjs に parseDailyArray()（hole→null 補完・末尾カンマ除去してからパース）を追加し、DAILY を読む4箇所を統一',
          'エンジン価格鮮度チェックを営業日数判定に変更: engineExport.ts の価格データ陳腐化チェックがカレンダー日数で乖離を測っていたため、週末を挟む月曜は MA計算基準日（NS倍率=^N225÷^GSPC の最新ペアで、S&P500 にゲートされ金曜）と 先物価格JSON（日経単独で月曜）が3カレンダー日＝実質1営業日となり毎週月曜に誤発火し、tev_for_execution が不要に null 化されていた。businessDaysBetween()（土日除外・getUTCDay）で営業日数判定へ。金→月＝1営業日で無警告、真の陳腐化（2営業日以上）は従来通り検出。回帰テスト5件追加（engineExport 計17件）',
          '🔴 データ自動更新が本番に届かない問題を根治: 週次データ更新ワークフローが2つ併存（update-data.yml と fetch-data.yml）し、土曜0:00 UTC で重複実行してレース。さらに update-data.yml が「[skip ci]」付きでコミットしており、これが Vercel のGitHub連携デプロイもスキップさせ本番が更新されなかった。update-data.yml を削除し fetch-data.yml に一本化。冗長で失敗していた明示 vercel --prod step も撤去し、main への push をトリガーに Vercel Git連携が本番自動デプロイする構成に統一（[skip ci] は今後付けない）',
          '本番データ最新化: 先物日次を 5/29（PCR 復活）・COT を 5/26 週まで反映。投資主体別（5/22 週）は JPX が翌週木曜公表のため公表待ちで正常と確認',
          'リポジトリ整合: 直接デプロイ運用で未push/未コミットだった過去セッション分を origin/main に集約（以後はデプロイ＝push＝Git連携自動デプロイの単一経路）',
          'マクロイベント刷新（カレンダー・ぽいロボレーダー）: 米GDP速報値を削除し、ADP雇用統計（雇用統計（NFP）の2営業日前・水曜を自動導出）と ISM製造業景気指数（毎月第1営業日を自動算出）を追加。「雇用統計」表示を「雇用統計（NFP）」に改称。macroCalendar.ts / settingsStorage.ts(PoiroboAlertConfig) / PoiroboAlertModal / ClockWidget / cron-push-notifications.js を同期。既存設定は移行不要（adp/ism 未定義→OFF・旧 gdp キーは無害）。ADP/ISM のテストを追加（計156テスト）。ISM は祝日事情で稀に1日ずれるため年次更新で要確認',
          '先物タブ 日経平均先物テーブルに25日MA乖離率を追加: UIで高値・安値を非表示にし「乖離率（25日MA%）」列を追加（高値安値はJSON保持）。ma25_dev は切り詰め前の全系列（約3ヶ月）から算出し各行に付与（fetch-jpx.mjs と client parseYahooOhlcv の両経路）。フィールド追加に伴いキャッシュキーを v4→v5 に更新（旧キャッシュが「—」を返すため）',
          '25日MA乖離率の色分け（日経20年実分布の非対称性を反映）: +側=+5%注意(黄)/+7%以上過熱(赤)、−側=-5%注意(黄)/-7%過冷(青)/-10%以下=暴落・最終局面(紫)。上側天井は約+13%・下側は-28%まで伸びる非対称のため下側のみ深いティアを追加。列順は 終値→前日比→乖離率、両テーブルに table-layout:fixed で列幅を均等化（日付列は固定）',
          'エンジンへ25日乖離を連携: engineExport.price_structure.nikkei225 に ma25_dev_pct を追加（テーブルと同値）。enginePrompt の「弾性（復元力）」評価で同じ非対称しきい値を参照させ、画面の色とAIの判断軸を一致させた（トレンド時バンドウォーク注意も明記）',
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
  const D = theme === 'dark'
  const mono = "'Courier New', Courier, monospace" as const
  const c = {
    bg:     D ? 'rgba(3,10,24,0.92)'  : 'rgba(218,236,255,0.92)',
    hdrBg:  D ? 'rgba(3,9,22,0.97)'   : 'rgba(228,242,255,0.97)',
    scan:   D ? 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)' : 'none',
    accent: D ? '#00e5ff'              : '#0369a1',
    dim:    D ? 'rgba(0,229,255,0.42)' : 'rgba(3,105,161,0.62)',
    rule:   D ? 'rgba(0,200,255,0.10)' : 'rgba(3,105,161,0.12)',
    cardBg: D ? 'rgba(0,229,255,0.05)' : 'var(--glass-bg)',
    cardBr: D ? 'rgba(0,229,255,0.18)' : 'var(--glass-border)',
    text:   D ? 'rgba(220,240,255,0.90)' : 'rgba(8,28,75,0.90)',
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState(SPEC_SECTIONS[0].id)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || isMobile) return
    const handler = () => {
      const secs = [...container.querySelectorAll<HTMLElement>('.spec-section')]
      if (!secs.length) return
      // ページ最下部に到達したら最後のセクションをアクティブにする
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 4
      if (atBottom) { setActiveId(secs[secs.length - 1].id); return }
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

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: c.bg, backgroundImage: c.scan }}>
      <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 1 }}>

        {/* Sticky header — ManualView スタイル */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '11px 16px' : '12px 28px',
          background: c.hdrBg,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${c.rule}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.accent, boxShadow: D ? `0 0 7px ${c.accent}` : 'none', flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            color: c.dim, fontFamily: mono, whiteSpace: 'nowrap',
            textShadow: D ? '0 0 10px rgba(0,229,255,0.28)' : 'none',
          }}>
            ぽいロボ ▸ システム仕様
          </span>
          {onClose && (
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7,
              border: D ? '1px solid rgba(0,200,255,0.20)' : '1px solid rgba(0,100,180,0.25)',
              background: D ? 'rgba(0,200,255,0.06)' : 'rgba(0,100,180,0.08)',
              color: D ? 'rgba(0,200,255,0.65)' : 'rgba(0,80,160,0.70)',
              cursor: 'pointer', flexShrink: 0,
            }} aria-label="閉じる">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* コンテンツ + 追従目次 */}
        <div style={{
          maxWidth: isMobile ? '100%' : 1040,
          margin: '0 auto',
          padding: isMobile ? '20px 16px 40px' : '0 32px 200px',
          ...(isMobile ? {} : { display: 'flex', gap: 28, alignItems: 'flex-start' }),
        }}>

          {/* 追従目次 — PC のみ */}
          {!isMobile && (
            <nav style={{ width: 176, flexShrink: 0, position: 'sticky', top: 52, alignSelf: 'flex-start', paddingRight: 4, paddingTop: 28 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.20em', color: c.dim, fontFamily: mono, marginBottom: 12, paddingLeft: 4 }}>
                CONTENTS
              </div>
              {SPEC_SECTIONS.map(sec => (
                <button key={sec.id} onClick={() => scrollToId(sec.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '5px 8px', marginBottom: 2, borderRadius: 7,
                  border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                  background: activeId === sec.id ? c.cardBg : 'transparent',
                  borderLeft: `2px solid ${activeId === sec.id ? c.accent : 'transparent'}`,
                  color: activeId === sec.id ? c.accent : c.dim,
                  fontSize: 11.5, fontFamily: mono, lineHeight: 1.35,
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{sec.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.title}</span>
                </button>
              ))}
            </nav>
          )}

          {/* セクション一覧 */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 28 }}>
            {SPEC_SECTIONS.map(section => (
              <section
                key={section.id}
                id={section.id}
                className="spec-section"
                style={{
                  background: c.cardBg,
                  border: `1px solid ${c.cardBr}`,
                  borderRadius: 14,
                  padding: isMobile ? '18px 16px' : '22px 24px',
                }}
              >
                {/* セクションタイトル */}
                <h2 style={{
                  margin: '0 0 16px',
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 700,
                  color: c.text,
                  display: 'flex', alignItems: 'center', gap: 8,
                  letterSpacing: '0.03em',
                }}>
                  <span style={{ width: 4, height: 14, borderRadius: 2, background: c.accent, flexShrink: 0, boxShadow: D ? `0 0 6px ${c.accent}` : 'none' }} />
                  {section.title}
                </h2>

                <div style={{ borderTop: `1px solid ${c.cardBr}`, paddingTop: 16 }}>
                  {section.content.map((block, i) => (
                    <div key={i}>{renderContent(block)}</div>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
