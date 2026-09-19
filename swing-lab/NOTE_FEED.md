# note 新着通知（おまけ機能）

トレードマシン（`SPEC.md` / `DISCORD.md`）とは**別系統のおまけ機能**。混ぜない。
note の新着記事を Discord の `#note新着` に流すだけの「お知らせ機能」。

実装: `swinglab/notify/note_feed.py` ／ 設定: `config.yaml` の `note_feed:` ／
Webhook: `.env` の `DISCORD_WEBHOOK_NOTE` ／ テスト: `tests/test_note_feed.py`

---

## 方針（Zapier は使わない）

Zapier は初回設定が面倒＆無料枠に制限があるので不採用。
**既存の日次バッチに相乗りさせる**のが構成的に自然（外部サービス不要・コスト0）。

---

## 確認済みの事実（2026-09-19 実測）

- RSS: `https://note.com/pointlab/m/m7be629812c81/rss` → **200 / 25件取得できた**
  - 「普通じゃない副業図鑑」共同マガジン（オーナー＝運用者本人、クリエイター13人以上）
- feedparser でのキー名:

| ほしいもの | feedparser のキー |
|---|---|
| 記事名 | `title` |
| URL | `link`（`id` も同じ値） |
| 公開日時 | `published` / `published_parsed` |
| 投稿者名 | **`note_creatorname`**（名前空間つき要素が正規化される） |
| サムネ | `media_thumbnail` |

- `note_creatorname` があるので、**特定クリエイターだけに絞る**のも可能
  （`config.yaml` の `note_feed.only_creators` に名前を並べる。空＝全員）

---

## 🔴 依頼文から変えた2点

### 1. 「日次バッチの**最後**に足す」→ **スキップ判定より前**に置いた

トレードの日次バッチは**休場日・参照データが古い日にスキップして早期 return する**。
末尾に置くと、連休のあいだ note の新着が溜まったまま流れない。
（実際 2026-09-19〜23 は土日＋敬老の日＋国民の休日＋秋分の日で **5日連続の休場**）

→ 相乗りはするが、`main.py` の**トレード側スキップ判定より前**で独立して走らせる。
　 `--note-only` で note のチェックだけ走らせることもできる。

### 2. 重複防止は pubDate ではなく **guid の集合**

記事は後から編集・バックデートされることがある。「最後の pubDate より新しいもの」方式だと
取りこぼしや二重投稿が起きる。見た guid を覚えるほうが素直で確実
（`note_feed_state.json`・直近500件ぶん）。

---

## 動き

```
RSS取得 → 古い順に並べ直す → 既読(guid)を引く → 増えたぶんだけ投稿 → 既読に足す
```

通知フォーマット: `📝 新着｜{title}｜by {creatorName}｜{link}`

### 事故を防ぐための決め

| 場面 | どうするか | なぜ |
|---|---|---|
| **初回実行** | 投稿せず、全件を既読にするだけ | 導入した瞬間に25件でチャンネルが埋まる |
| **RSSが0件** | 既読をいじらず「取得失敗の可能性」として終わる | ここで保存すると既読が消え、次回に全件投稿してしまう |
| **既読ファイルが壊れている** | 例外を投げて止める（初回扱いにしない） | 初回扱いにすると既読が消えて全件投稿になる |
| **投稿に失敗** | そこで止め、失敗したぶんは既読にしない | 次回もう一度出す |
| **新着が多い** | `max_per_run`（既定10件）まで。残りは次回 | 一気に流さない |

---

## 使い方

```powershell
Set-Location 'C:\Project\PointLab\stock-calendar\swing-lab'

.\.venv\Scripts\python.exe main.py --note-only            # note のチェックだけ
.\.venv\Scripts\python.exe main.py --note-only --dry-run  # 投稿せず件数だけ見る
.\.venv\Scripts\python.exe main.py --no-note              # note を飛ばしてトレードだけ
.\.venv\Scripts\python.exe main.py                        # 通常（note → トレードの順）
```

投稿は `logs/sent_messages.jsonl` に記録されるので、`main.py --purge-all` で消せる。

---

## 実装状況（2026-09-19）

✅ 実装・実機確認済み。RSS取得 → 初回25件を既読化（投稿ゼロ）→
未読1件を投稿 → `--purge-all` で削除、まで通した。

🔵 **`#note新着` には判断/約定/成績/エラーの通知は流れない**。
送信経路を `discord.channels` と分けてあるので、構造的に混ざらない。
ただし**後片付け（削除）だけは届く**ようにしてある
（分離を優先した結果、投稿できるのに消せない状態を一度作ってしまったため）。
