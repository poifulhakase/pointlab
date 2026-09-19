# welcomebot — 入場歓迎Bot（ぽいふる博士の口上）

新メンバーが `#やぁ諸君！` に入ってきたら、**ぽいふる博士の口上で自動歓迎**する常駐Bot。

トレードマシン（[`../robotrade/SPEC.md`](../robotrade/SPEC.md)）・通知（`DISCORD.md`）・
RSS通知（`NOTE_FEED.md`）とは**別系統**。コミュニティ運営の機能。

設計の正 … [`WELCOME_BOT.md`](WELCOME_BOT.md)

---

## 🔴 Webhook だけでは作れない

「メンバー参加イベントを検知して反応する」には **Gateway 接続（＝常駐Bot）** が要る。
Webhook は**送信専用**なので、参加を知ることができない。

→ Bot が参加を検知し、**歓迎文は Webhook で投げる**（送信者が「ハカセ」になる）。

🔵 **この形だと Bot 自身に投稿権限が要らない**。Bot に必要なのは
「サーバーにいること」と `SERVER MEMBERS INTENT` だけ。権限を最小にできるので、
万一トークンが漏れても被害が小さい。

---

## セットアップ

### ① Discord 側（こちらでは作れないので手作業）

1. [Developer Portal](https://discord.com/developers/applications) → **New Application**
2. 左メニュー **Bot** → **Reset Token** でトークンを取得
3. 同じ画面の **Privileged Gateway Intents** で **SERVER MEMBERS INTENT** を **ON**
   （🔴 これが無いと参加を検知できない。Bot は起動時に気づいてエラーを出す）
4. 左メニュー **OAuth2 → URL Generator**
   - SCOPES: **`bot`** だけ
   - BOT PERMISSIONS: **なし**（投稿は Webhook で行うため）
   - 生成された URL を開いてサーバーに招待

### ② こちら側

```powershell
Set-Location 'C:\Project\PointLab\stock-calendar\welcomebot'
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# .env.example をコピーして .env を作り、DISCORD_BOT_TOKEN を入れる
```

| 変数 | 中身 |
|---|---|
| `DISCORD_BOT_TOKEN` | 🔴 Bot トークン（実質パスワード） |
| `WELCOME_WEBHOOK_URL` | `#やぁ諸君！` の Webhook（「ハカセ」） |
| `DISCORD_GUILD_ID` | サーバーID |
| `WELCOME_CATCH_UP_DAYS` | 落ちていた間の参加を何日ぶん拾うか（既定14） |

### ③ 動かす

```powershell
.\.venv\Scripts\python.exe bot.py --dry-run   # 投稿せず、誰を歓迎するかだけ見る
.\.venv\Scripts\python.exe bot.py             # 本番（Ctrl+C で停止）

# ログオン時に自動起動して常駐させる
powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1
powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Start   # 今すぐ起動
powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Show    # 状態を見る
powershell -ExecutionPolicy Bypass -File scripts\register_bot_task.ps1 -Remove  # 解除
```

---

## 🔴 事故を防ぐための決め

| 場面 | どうするか | なぜ |
|---|---|---|
| **初回起動** | 今いる人を「歓迎済み」として記録するだけ。**口上は送らない** | 入れた瞬間に既存メンバー全員へ飛ぶ |
| **Botが落ちていた間の参加** | 起動時に「最近参加したが歓迎していない人」を拾い直す | PCは寝るし再起動もする。その間の参加イベントは届かない |
| **拾い直しの範囲** | 直近14日に参加した人だけ | 記録を消したときに古参まで歓迎してしまう |
| **参加日時が取れない人** | 対象にしない | 推測で歓迎しない |
| **同じ人の再入場** | 歓迎しない（初回のみ） | 設計書の「歓迎の重複防止」 |
| **投稿に失敗** | 記録しない | 次の起動でもう一度拾う |
| **記録ファイルが壊れた** | 例外を投げて止まる（まっさらにしない） | まっさらにすると全員を歓迎し直す |
| **Botの参加** | 歓迎しない | 相手が人間のときだけ |

### 表示名の扱い

表示名は**メンバーが自分で決める値**なので、そのまま文面に埋めない（`safe_name`）:

- `@everyone` / `@here` → 全角の `＠` にして無効化（**全員に通知が飛ぶのを防ぐ**）
- Markdown（`*` `_` `~` `|` `` ` ``）→ 落とす（口上が崩れる）
- 改行 → 1行に畳む
- 32文字で切る／空になったら「名無しの研究員」

さらに投稿時に `allowed_mentions` で**参加した本人だけ**にメンションを絞ってある（二重の防御）。

---

## 🔴 PowerShell の落とし穴（ロボトレードで踏んだもの）

`.ps1` には最初から対策を入れてある。書き換えるときは崩さないこと。

1. **`.ps1` は UTF-8 に BOM が要る**。無いと 5.1 が ANSI として読み、日本語が壊れて
   スクリプトごと誤動作する
2. **native コマンドに `2>&1` を付けない**。stderr の各行が ErrorRecord に包まれ、
   成功しても終了コードが 1 になる。Python 側のログは **stdout** に出している
3. **`[Console]::OutputEncoding` を UTF-8 に**。既定は cp932 なのでログが化ける。
   **タスク経由でだけ**起きるので、手で動かしただけでは気づけない

### 常駐タスクとしての違い（ロボトレードの日次タスクと比べて）

| | ロボトレード | welcomebot |
|---|---|---|
| トリガー | 平日17:00 | **ログオン時** |
| 実行時間の上限 | 30分 | **無し**（時間で切られると止まる） |
| 落ちたとき | 次の営業日 | **1分後に再起動**（最大999回） |

---

## 構成

```
welcomebot/
├── WELCOME_BOT.md          設計の正
├── bot.py                  常駐Bot（Gateway 接続・参加を検知）
├── welcomebot/greeting.py  文面と記録（Discord に繋がない部分）
├── scripts/
│   ├── run_bot.ps1         Bot を動かす
│   └── register_bot_task.ps1  ログオン時に常駐させる
├── welcomed.json           誰を歓迎したか（ローカルだけ・gitに入らない）
└── tests/                  23件
```

---

## 実装状況（2026-09-19）

✅ 文面・記録・拾い直しは実装＆テスト済み（23件 全green）。文面は運用者確定版（2026-09-19）。
⬜ **Bot トークン待ち**。`.env` に入れれば動く。

**まだやっていない**（設計書の「将来拡張」）:
- 退場時のメッセージ
- ロール自動付与（「研究員」ロールを自動で付ける）
