# handover.md — 直近の作業引継ぎ

> セッションをまたぐ「直近状態」の正。作業完了時に**先頭の「現在の状態」を更新**し、古い分は「履歴」に1〜2行で畳む。
> 背景・経緯の深掘りは `~/.claude` メモリ（第1〜25セッションの詳細ログ）。

最終更新: 2026-06-18

---

## 🟢 現在の状態

**ブランチ**: `main`（origin/main へ push・本番反映済）

### 第29 (2026-06-18): 環境タブ NS倍率 → **NT倍率（日経÷TOPIX）** へ変更 ✅本番反映済（`a8c7809` ほか）
- **概要**: 環境タブの倍率指標を NS倍率（日経÷S&P500）から **NT倍率（日経÷TOPIX）** に変更。ファイル名は元から `NtRatio*` だったが中身がNSのままだった配線を完成させた。
- **データソース（重要・難所だった）**:
  - 日経=Yahoo `^N225`（ライブ・既存プロキシ）。
  - 🔴 **TOPIX指数は無料で取りにくい**＝`^TPX` はYahoo欠損、`stooq ^tpx` は residential/公開プロキシ/**GitHub Actions/Vercel すべてでJSチャレンジによりブロック**（topix.jsonがgit履歴に一度も無いのが証拠）。ETF(1306.T等)は指数と水準ズレで不採用。
  - ✅ **解決＝kabutan の TOPIX時系列をスクレイプ**（`code=0010`・`/stock/kabuka`）。**Vercel egress IP からは200で取得可**を本番で実測確認。
  - 配線＝フロントは **①`/api/stocks-daily?only=topix`**（Vercel側でkabutan・🔴Hobby12 Functions上限のため専用ルートは作らず stocks-daily に相乗り・重いスクレイプ前に短絡）→ **②静的 `/calendar/data/topix.json`**（`fetch-jpx.mjs buildTopixData` がkabutanで生成・90日シード済）の順にフォールバック。
- **しきい値**: NT倍率の水準ラベル（酷暑/真夏日/適温/冷え込みの温度メタファー）を**実測レンジに較正**。本環境の実NT倍率は **≈17.5**（Nikkei71,053÷TOPIX4,068。直近90日 min14.5/中央15.2/max17.5）。`≥16.5酷暑 / ≥15.5真夏日 / ≥14.8適温 / <14.8冷え込み`（現状=酷暑＝値がさ過熱）。※ユーザー選択は「直近レンジ基準」（real world前提の13〜15）だったが、本環境のNikkei高値圏では常時"酷暑"固定になるため、intentを汲んで実データ四分位へ較正した。
- **エンジン非影響**: `engineExport.ts` は `NtRatioPoint.nikkei` のみ参照（ratio/benchmark不使用）＝TEV/エンジン計算に影響なし。需給プロンプト(`enginePrompt.ts`)/EvalsにもNS/NT倍率の参照は無く改修不要（「倍率」の語は全て『信用倍率』）。
- **変更ファイル**: `ntRatioData.ts`(NT化+APIフォールバック) / `NtRatioPanel.tsx`(ラベル/配色/TOPIX表示) / `QuantView.tsx`(見出し) / `api/stocks-daily.js`(?only=topix+kabutan) / `scripts/fetch-jpx.mjs`(buildTopixData=kabutan) / `public/data/topix.json`(seed) / SpecView/ManualView/VixPanel/LockSkeletons/requirements/dataCache(キー `poical-nt-ratio-v1`)。
- **本番検証済**: `/api/stocks-daily?only=topix`=200(30件・TOPIX4068.18) / 静的=200(90件) / tsc=0 / lint=0 / vitest 169 pass / build=0 / Vercel READY(alias済)。
- 🔴 **残注意**: ①kabutanはVercelからは可だが**CI(Actions)からは未確認**＝静的topix.jsonがCIで更新できない可能性（その場合も①APIが主なので表示は維持）。②kabutanは~30〜90日のみで旧NSの1年チャートより短い。③より堅牢にするなら **J-Quants(無料登録・JPX公式でTOPIX有)** へ移行が本筋（メモリ`reference_stock_calendar_data_apis`参照）。

### 第28 (2026-06-18): 一時的に全ページ公開 → 同日撤回（`TEMP_PUBLIC_ALL_PAGES=false`・`src/App.tsx`冒頭・再ONで一時公開可）。コネクト/通知は据え置きでメンバー限定。検証 tsc/lint/test=169pass。

### 第27 (2026-06-15): 需給推進力(TEV)=null の真因対応 ✅push済 `c5e58c1`
**事象**: 日曜にエンジン出力で「需給推進力：計算不能（データ不足）」となり、AIが「最新の信用データが無いからnull」と**誤った理由を創作**していた。
**真因（調査結果）**: TEV の V/A は**日次モメンタム（USD/JPY 30%・NAS100 25%・VIX 20%・先物OI 15%）のZスコア**から算出され、信用残など週次データとは無関係。日次ローダー（`usdjpyData`/`nas100Data`/`vixData`）は静的JSONが**12時間より古いと不安定な公開CORSプロキシ（allorigins/codetabs）へライブ切替**する。週末はfetchワークフロー（平日のみ）が止まり静的JSONが必ず>12h→日次3系列が一斉にライブ依存→プロキシのレート制限/薄い週末データで系列が短縮・空→`score_today/score_3d`がnull→**TEV null**。週次データは12h制限が無く読めるため「信用残は豊富だがTEVだけnull」の非対称が混乱の元。
**対応4点**:
1. **真因の明示**（`engineExport.ts`）: tev null時に `tev_value!==null` ガードの外で `sanity_warnings` に「どの日次系列が何本か＋信用残とは無関係」を必ず積む。AIの創作を封じる。
2. **加速度の頑健化**（`engineExport.ts`）: 日次履歴<6本で `score_3d` が無い時、オフセット2→1で加速度を近似（`tev_A_approx`）。「Vは出るがAが無くTEVだけnull」を緩和。近似時は警告を積み `tev_for_execution` を保留に。
3. **プロンプト**（`enginePrompt.ts`）: null理由は必ず `sanity_warnings` から引用し、信用データ等を理由に創作禁止と明記。**EvalsPanel** のScenario3を真因入りに更新＋「信用起因と創作していないか」採点を追加。
4. **根本修正**（`usdjpyData`/`nas100Data`/`vixData`）: **市場休場日（週末/祝日）は静的JSONの最終終値が当日値**なのでライブ切替しない（休場時の許容を最大4日に）。これで週末のライブ一斉依存が消える。
**検証**: tsc(app)=0 / lint=0 / vitest **169 pass**（engineExport に回帰テスト2件追加）。

---

直近の過去作業はすべて push 済み（Vercel Git 連携で自動デプロイ）。

- `e52382b` プレイブックのスワイプ改善・文言調整＋CSPで data: フォント許可（第26節）
- `7a6002e` 時計フォント再サブセット（22.75→1.5KB）＋説明書/プレイブックの文言平易化
- `2701880` ロック画面のフッターをサイバー調に＋ログイン導線を明確化

### プレイブックのスワイプ改善・CSP（`e52382b`）
- 🔴 **スワイプでスライドが飛ぶ問題を是正**: コンテンツがはみ出すスライドで下スクロールすると次スライドに切り替わってしまっていた。`StrategyPlaybookPanel` のタッチ判定を、開始時に内部スクロールの上端/下端到達を記録し「下端で上スワイプ＝次へ／上端で下スワイプ＝前へ」のときだけ切替に変更（途中はスライド内スクロール優先）。`trackRef`/`touchAtTop`/`touchAtBottom`。
- カード文言: トレンドフィルターの `gradeLabel`「（一番だいじ）」と `plain` 末尾「これで大きな暴落をよけられます。」を削除。
- 🔴 **CSP**: 第三者ウィジェット（TradingView 等）が main document に注入する `data:` インラインフォントが `font-src 'self'` でブロックされコンソールエラーが出ていたため、`vercel.json` の CSP を `font-src 'self' data:` に緩和。**CSP は Vercel レスポンスヘッダーのため本番デプロイで初めて反映**。自前フォントは引き続き自己ホスト。

### 表示速度・文言（`7a6002e`）
- 時計フォント Cherry Bomb One を `0123456789:` の11グリフのみに `pyftsubset` で再サブセット（22.75KB→1.5KB、約93%減）。preload されるレンダリングブロッキング資源を削減。元フォントから再サブセットする手順は `src/index.css` コメント参照。
- 説明書（ManualView）: チャート「米国債(10年利回り)」→ 実シンボル `NASDAQ:TLT` に合わせ「米国債(米国長期国債ETF)」へ訂正。他は全文精査し誤りなし。
- 戦略プレイブック: 見出し「安全に回すコツ」→「リスクを抑えるには？」、「勝てる4つの理由」→「期待値が高い4つの作戦」。トグル「くわしい数字でみる」→「過去20年のバックテスト」。カード冒頭の説明文と用語集（CAGR/DD/乖離）を削除。カード詳細の専門用語を平易な日本語化（数値は不変）。

### ロック画面のサイバー調フッター＋ログイン導線（`2701880`）
- 非メンバーが会員限定ビュー（カレンダー/エンジン/シールド）を開きロック画面が出ている間、`CalendarHeader` の `forceNeon` でフッターを研究室と同じネオン配色に切替（`useNeon = (isLab || forceNeon) && dark`）。
- ロック画面の案内「右下の『ぽいロボ コネクト』から」は実態（コネクトは研究室にしか無い）と不整合だったため、**未ログイン時のみ「研究室でログイン →」ボタン**（サイバー調）を追加し研究室へ遷移（`onGoToConnect` を quant/shield/calendar の3箇所に配線）。文言も修正。

### 非メンバー初期表示の研究室化（`7a19f1a`）
- 新規セッションのデフォルト着地で非メンバーが会員限定ビュー（`month/week/day/quant/shield`）に来た場合、`CommunityLockScreen` ではなく研究室（`support`）へ遷移。ユーザーが自分で遷移した場合（`sessionStorage` に保存ビューあり）は尊重。
- `App.tsx`: マウント毎に一度だけ・`!authLoading && membershipResolved` 確定後に判定（`wasFreshLoad` + `initialMemberRedirectDone` ref）。
- `useCommunityAccess.ts`: `membershipResolved`（`checkedEmail === user.email`／logout 時 true）を追加。**非同期の会員判定が確定する前のリダイレクト誤発火（レース）を防止**（メンバーを誤って研究室へ飛ばさない）。
- 検証: tsc(app)=0 / lint=0 / vitest 167 pass。

### トレンド整合ゲートの要点（`1a1ec2b`）
- `tevCore.mjs`: `priceTrend` 逆行時のみ `tev_confidence` を最大 **55%** に抑制（`tev_counterTrend` 付与）。**シグナル方向（`tev_value` 符号）は変えない**保守設計＝極限が反転に先行する余地を残す。
- 供給元: backtest=週次close 8週前比 / 本番=`nkRegime`（MA20/60）。
- 背景: 52週検証で期間の日経 +76% の大相場に対しエンジンが逆張り bear を量産し負け（順張り56% vs 逆張り36%）。確信度の「反転」（高確信度ほど実勝率↓）の主因がこれ。第15-16の20年R&D（トレンドフィルター必須）と整合。

---

## ▶ 次にやること（候補）

1. エンジン本番プロンプト側の「価格レジーム逆行時は確信度を引き下げ」文言と、数値側ゲートの一貫性を最終確認。
2. 残課題: 高確信度帯（順張り）も n が小さく正の識別力は未確証。勝率を上げる「逆張りシグナルの中立化」は**下落相場のデータが揃うまで保留**（現在は確信度抑制のみで方向は据え置き）。
3. ローンチ前法務（`docs/legal/` の専門家レビュー）— `~/.claude` メモリ「残タスク一覧」参照。
4. NT倍率データの堅牢化: ①次回 fetch-data ワークフロー後に `topix.json` がCIで更新できたか確認（kabutanがActions IPから取れるか未確認）。②長期チャート/恒久安定を狙うなら **J-Quants（無料登録・TOPIX公式）** へ移行検討。

---

## ✅ 直近の完了済み（履歴・新しい順）

- **第26 (2026-06-11)**: ①非メンバーの初期表示を会員限定ロック画面（`CommunityLockScreen`）→ 研究室（`support`）に変更 `7a19f1a`（`useCommunityAccess` に `membershipResolved` を追加し非同期会員判定のレースを回避）。②ロック画面のフッターを研究室と同じサイバー調に（`CalendarHeader` `forceNeon`）＋「右下のコネクト」不整合を解消し未ログイン時に「研究室でログイン →」ボタン追加 `2701880`。検証 tsc/lint/test=167pass。push 済み。
- **第25 後半 (2026-06-10)**: トレンド整合ゲート（逆張り確信度を最大55%に抑制・方向は不変）を本番反映 `1a1ec2b`。資料カード「基礎」のタイトルを「レジサポ・移動平均線」に短縮（折返し防止）`8ec8a23`。ファイルベース引継ぎ運用（`CLAUDE.md`/`handover.md`/`requirements.md`）導入 `d11f648`＋本番反映ルーティン「D」をメモリ登録。SpecView 第25節追記。検証 tsc/lint/test=167pass。最新 `aa7d20c` 以降に push 済み。
- **第25 (2026-06-10)**: バックテスト期間を 52週へ拡張（`fetch-jpx` の investor 取得上限 26→55 是正）。確信度キャリブレーション機能追加（10%刻みで予想確率 vs 実勝率）。発見=確信度が自信過剰かつ反転。`tevCore.mjs` で確信度を再キャリブレーション（傾き0.5→0.3・上限95→70・範囲50-70%）。push済 `640c563`。
- **第24**: タイムマシンに逸話/格言の2モード追加（相場格言23個）。push済 `ec31844`。
- **第23**: 管理者メールを `firestore.rules` の `isAdmin()` 1箇所に集約。TEV計算式を `tevCore.mjs` に単一情報源化。PWA SWキャッシュ固着の逃げ道 `forceUpdate.ts` 追加。セキュリティ横断点検。本番デプロイ済。
- それ以前（第1〜22）の詳細は `~/.claude` メモリ「ぽいロボ 作業ログ」を参照。

---

## メモ
- データ鮮度: `fetch-data.yml` が平日 19:30 / 21:30 JST に取得、土曜 09:00 に週次・バックテスト再計算。
- TEV ロジックバージョン: `v2-symmetric-restoring`（復元力 `tev_rResist` 両側化）。今回のゲートはこの上に乗る確信度の後処理。
