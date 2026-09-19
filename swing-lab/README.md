# swing-lab — LLMスイングトレード 疑似トレードマシン

日本株のスイング（保有2〜14日・**買いのみ**）を、複数の LLM エージェントが日次で判断する
**疑似トレード**マシン。実弾は一切使わない。

位置づけは「勝つ bot」ではなく **LLM の判断ロジックを観察・実験する装置**。
成績そのものより、各エージェントがどう考えて判断したかのログを残すことを重視する。

- 仕様の正 … [`SPEC.md`](SPEC.md)
- Discord の設計 … [`DISCORD.md`](DISCORD.md)（チャンネル・通知フォーマット・運用）
- ローカル完結。Vercel にはデプロイしない。ぽいロボ本体のビルドとは無関係。

---

## セットアップ

```powershell
Set-Location 'C:\Project\PointLab\stock-calendar\swing-lab'
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# .env を作る（.env.example をコピー）
#   ANTHROPIC_API_KEY=...
#   DISCORD_WEBHOOK_DECISIONS / _FILLS / _PERFORMANCE / _ERRORS
#   🔴 Webhook URLは実質パスワード。知っている人は誰でも投稿できる

# Discord のアバター画像を作り直したいとき（通常は不要）
.\.venv\Scripts\python.exe scripts/make_avatars.py
```

---

## 毎日の動かし方

```powershell
# ① ぽいロボのデータを最新にする（swing-lab はこれを読むだけ）
Set-Location 'C:\Project\PointLab\stock-calendar'; git pull

# ② カレンダーを書き出す（年1回でよい。休場日・マクロイベント・SQ）
npx tsx swing-lab/scripts/export_calendar.mjs 2024 2027

# ③ 大引け後（15:30以降）に1回走らせる
Set-Location 'C:\Project\PointLab\stock-calendar\swing-lab'
.\.venv\Scripts\python.exe main.py
```

| コマンド | 内容 |
|---|---|
| `main.py` | 直近の営業日を対象に1回実行 → Discord 通知 |
| `main.py --date 2026-09-18` | 対象日を指定 |
| `main.py --dry-run` | DBに書き込まない（判断だけ見る） |
| `main.py --force` | 実行済みの日をやり直す |
| `main.py --no-notify` | Discord に送らない |
| `main.py --weekly` | 曜日に関係なく #成績 も出す（既定は金曜だけ） |
| `main.py --notify-test` | Discord 4チャンネルの疎通確認だけ |
| `eda/run_eda.py [--limit N]` | 探索的データ分析（分布・相関・ファネル） |
| `-m pytest` | テスト（132件） |

---

## 🔴 触る前に知っておくこと

### 1. データは「ぽいロボが正」。ここでは読むだけ

`public/data/*.json` は `fetch-data.yml`（GitHub Actions）が毎日更新してコミットする。
swing-lab が同じものを取りに行くと**同じ数字の出どころが2つ**になり、食い違ったとき
どちらが正か分からなくなる。だから `swinglab/data/poirobo.py` は読むだけ。

| 使っているもの | 何に |
|---|---|
| `stock_master.json` | ユニバース3,707銘柄＋セクター（SPEC 5.3 プロファイル） |
| `usdjpy.json` / `vix.json` / `topix.json` | マクロ入力・リスクオフ検知・ベンチマーク超過 |
| `investor.json` / `short_sell.json` / `advance_decline.json` | 市場全体の需給 |
| `margin_weekly/` | 銘柄ごとの週次信用残（制度/一般の内訳） |
| `src/utils/{marketCalendar.mjs,macroCalendar.ts,sqCalendar.ts}` | 休場・FOMC/日銀/SQ |

🔴 ローカルのファイルは **`git pull` した時点の鮮度**。7日以上古いと実行を止める
（`poirobo.max_stale_days`）。欠損を捏造しない。

🔴 **カレンダーを Python に書き写さない**。`marketCalendar.mjs` は CLAUDE.md で
「休場判定を二箇所に書くと、片方だけ直して祝日に発注する事故になる」と単一情報源に
指定されている。JS を実行して JSON に書き出したものを読む（`scripts/export_calendar.mjs`）。

🔴 信用残は **2026-08-14 の週からの蓄積しか無い**（JPX が直近5週しか公開しない）。
週数が足りないことも「データの状態」として需給AIに渡す。

### 2. 先読みを作らないための仕掛け

判断した日には約定させない。判断は `pending_orders` に積み、**翌営業日の実際の寄り**を
見てから約定/見送りを決める（`order_is_due()`）。
同じ日の寄りで約定させると「その日の終値まで見たうえでその日の始値で買う」ことになる。
2026-09-19 に `--force` で実際にこれを踏んだので、回帰テストが入っている。

大引け前（15:30より前）に走らせた場合は、その日の四本値が未確定なので**前営業日**を対象にする。

### 3. 責任の分け方（二段構え）

| 誰が | 何を決めるか |
|---|---|
| **売買判断AI** | 方向（buy/sell/hold）・価格水準（entry/stop/target）・確信度・理由 |
| **コード** | 数量・各種上限・ギャップ見送り・単元丸め・ストップ妥当性・時間手仕舞い・リスクオフ |

LLM が暴走しても資金とリスクの一線はコードが守る。
そのため出力スキーマから `quantity` を**外してある**（SPEC 7.5 のスキーマ例にはあるが、
同じ SPEC の共通ルール「数量計算はコード側だけ」に従った）。

### 4. お金は float で持たない

価格・損益・資産額はすべて **銭（1円の1/100）単位の int**（`swinglab/money.py`）。
`0.1+0.2 != 0.3` の誤差が積み上がると成績がじわじわズレる。DBも INTEGER。

### 5. 現行APIと仕様書の食い違い（2026-09-19 時点）

| SPEC | 現実 | 対応 |
|---|---|---|
| 7.6「temperature を低めに」 | **渡せない**。Anthropic Python SDK 1.7 の `messages.create()` に引数が無い | 再現性は「ログにモデル・プロンプト版・入力ハッシュを残す」で担保 |
| tool スキーマの数値範囲 | `strict` では `minimum`/`maximum` が **400** | 範囲は `validate()` で弾いてリトライ |
| — | `output_config.effort` は Sonnet 5 のみ。Haiku 4.5 は 400 | `models.*_effort` で出し分け |

### 6. 通知は4チャンネルに振り分ける

`#判断サマリ` / `#約定・保有` / `#成績`（週次）/ `#エラー・異常`。詳細は `DISCORD.md`。
🔴 **異常を日次の一目に混ぜない**。ノイズにすると見なくなる。
🔴 **総資産の増減率は週次の #成績 だけ**に出す（日々のP&Lを煽らない）。
　 ただし**含み損は毎日出す**（見たくないものから目を背けさせない・SPEC 12.1）。

### 7. LLM は稀にプレースホルダーを返す

強いモデルでも `market_view: "dummy"` / `ticker: "dummy"` を返すことが**実際にあった**
（同じ入力で再試行すると正常に返る＝非決定性）。`validate()` で弾いて再試行させている。
判断してよい ticker も候補＋保有に限定している。

---

## モデルとコスト

| 用途 | モデル | 料金（$/1M） |
|---|---|---|
| 選定・チャート・需給・ニュース（銘柄数ぶん呼ぶ） | `claude-haiku-4-5` | 1 / 5 |
| 売買判断（1日1回） | `claude-sonnet-5` | 2 / 10 |

実測 **$0.10〜0.17/日**（10〜12回）。`ops.daily_cost_alert_usd`（$3）を超えると警告。
🔴 モデルIDは置きっぱなしにしない。`/v1/models` と公式料金表を定期的に見る。

---

## 構成

```
swing-lab/
├── SPEC.md                 仕様の正
├── config.yaml             閾値はすべてここ。コード・プロンプトにハードコードしない
├── main.py                 エントリポイント
├── scripts/export_calendar.mjs   ぽいロボのカレンダーを JSON に書き出す
├── eda/run_eda.py          Phase 0 の探索的データ分析
└── swinglab/
    ├── config.py           起動時バリデーション（矛盾は落とす）
    ├── money.py            銭(int)の金額型
    ├── logs.py             判断ログ（生のLLM入出力を残す）
    ├── orchestrator.py     日次パイプライン
    ├── data/
    │   ├── poirobo.py      ぽいロボのデータを読む＋カレンダー
    │   ├── fetch.py        yfinance＋クレンジング
    │   ├── indicators.py   🔴 指標の単一情報源（AI・ML・スクリーニングが同じ値を見る）
    │   └── prefilter.py    3層の数値プレフィルタ
    ├── agents/             base / selector / chart / supply_demand / news / decider
    ├── portfolio/          portfolio（FSM）/ execution（執行・サイジング）/ store（SQLite）
    ├── learning/outcomes.py  ラベリング・期待値分解・信頼区間
    └── notify/
        ├── discord.py      Webhook（4チャンネルのルーター・添付対応）
        ├── summary.py      チャンネル別の embed 組み立て
        └── chart.py        #成績 の推移グラフ（起点100の指数・二軸にしない）
```

---

## 実装状況

**Phase 0〜6 完了**（SPEC 14 の作業順序）。

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | EDA | ✅ `eda_out/eda_report.json` |
| 1 | config / 価格取得 / SQLite / Discord | ✅ |
| 2 | 売買判断AI（tool use 疎通） | ✅ |
| 3 | プレフィルタ＋選定AI | ✅ |
| 4 | チャート・需給・ニュース分析AI | ✅ |
| 5 | オーケストレーター結合 | ✅ |
| 6 | 疑似執行・コスト・ラベリング・単体テスト | ✅ 132件 全green |
| 7 | 通知の作り込み（4チャンネル振り分け・embed・グラフ） | ✅ `DISCORD.md` |
| 8 | Streamlit ダッシュボード | ⬜ 未 |
| 9 | リスク管理の拡充 | ✅（サイジング・相関/集中・DDスロットル・ストップガード） |
| 10 | 学習ループ(1) フィードバック | ⬜ 未（成績サマリは判断AIに渡している） |
| 11 | point-in-time ユニバース＋バックテスト | ⬜ 未（J-Quants 登録が要る） |
| 12 | 予測MLモデル | ⬜ 未（`ml_prob` は常に null で動く） |
| 13 | スケジュール化 | ⬜ 未 |

### 未実装のために「データなし」で回しているもの

**推測で埋めていない**（SPEC 5.2 / 7.3）:

- 個別銘柄の**決算日・権利確定日** … 取得元が無い（J-Quants＝Phase 11 待ち）
- 個別銘柄の**空売り残高**・適時開示 … 同上
- **ニュース/TDnet** … `NoHeadlines` が空を返す → LLM を呼ばずに `catalyst: none`
- **`ml_prob`** … Phase 12 まで `null`

### EDA で分かったこと（2026-09-19・3,678銘柄）

- リターン分布は**正規ではない**。尖度41.1、±5σ超が0.55%（正規なら0.00006%＝9,200倍）。
  1日の最大変動 +148.8% / −80.0%。→ 正規分布前提の計算は使わない。
- **指標の重複が実在する**（SPEC 8.3 見かけの独立性）:
  RSI↔BB%B **+0.86** / ATR%↔バンド幅 **+0.78** / 乖離率↔RSI +0.76 / SMA25傾き↔乖離率 +0.74。
  → 「補助」指標（RSI・MACD・BB）はプロンプトには載せるが、**MLの特徴量には入れない**
  （Phase 12 でアブレーションして判断する）。
- プレフィルタのファネル: 3,678 → 第1層 1,014 → 上位15 → 第3層 12。
  第1層の落ち方は**売買代金で2,566銘柄（70%）**。

---

## ログとバックアップ

- `logs/<日付>/agent_calls.jsonl` … LLM の**生の入出力**（system/user/output/コスト/試行回数）
- `logs/<日付>/snapshot.json` … その日の全体スナップショット
- `swing_lab.db` … ポートフォリオ・約定・判断・成績

🔴 リポジトリ直下の `.gitignore` に `logs` があるため **git に入らない**。
判断ログと成績DBは**ローカルだけの資産**。バックアップは手動。

---

## これは投資助言ではない

疑似トレードの実験装置。実弾投入の判断には使わない。
通知や結果を他人と共有・公開すると、日本では投資助言・勧誘とみなされうる（金商法）。
Discord 通知には免責を入れてある。
