# AIモデル推奨テキスト メンテナンスプロンプト

## 目的
ぽいロボエンジン・シールドのAIリンクボタンに表示される「モデル推奨ヒント」を最新情報に更新する。

---

## ステップ1: 最新モデルをWeb検索で確認

以下の3つをそれぞれWeb検索し、ユーザーに推奨すべき最新モデル名・モードを特定する。

### ChatGPT (OpenAI)
- 検索クエリ: `site:openai.com "o3" OR "o4" reasoning model 2025`
- 確認ポイント: 現在の最新推論モデルは何か？ o3 より新しいモデルが出ているか？
- 現在の値: **`o3以上推奨`**
- 更新例: `o4以上推奨` / `o3 mini以上推奨` など

### Gemini (Google)
- 検索クエリ: `site:blog.google gemini thinking mode 2025` または `gemini 2.5 pro thinking`
- 確認ポイント: 「思考モード（Thinking mode）」は現在どのモデルで利用可能か？ 名称変更はないか？
- 現在の値: **`思考モード推奨`**
- 更新例: `2.5 Pro思考モード推奨` など（表示スペースが限られるため短く）

### DeepSeek
- 検索クエリ: `deepseek R2 OR R1 latest model 2025`
- 確認ポイント: R1の後継モデルは出ているか？ R2などリリース済みか？
- 現在の値: **`R1モデル推奨`**
- 更新例: `R2モデル推奨` など

---

## ステップ2: 更新が必要か判断

変更不要の条件:
- 検索結果が「現在の値」と同じモデルを最新として指している

変更必要の条件:
- 新しい推論/思考モデルが正式リリース済み（プレビュー除く）
- ユーザーが通常利用できる状態（無料 or 有料プランで一般提供中）

---

## ステップ3: ファイルを更新（replace_all: true）

### 3-1. ChatGPT ヒント（3箇所を一括）

**ファイル:** `src/components/QuantView.tsx`
- 行1479: CYBER_MODEスパン
- 行1590: 通常モード div

```
old_string: "o3以上推奨"
new_string: "（新しいヒントテキスト）"
replace_all: true
```

**ファイル:** `src/components/ShieldView.tsx`
- 行1002: SHIELD_AI_LINKS の hint フィールド

```
old_string: hint: 'o3以上推奨'
new_string: hint: '（新しいヒントテキスト）'
```

### 3-2. Gemini ヒント（3箇所を一括）

**ファイル:** `src/components/QuantView.tsx`
- 行1509: CYBER_MODEスパン
- 行1614: 通常モード div

```
old_string: "思考モード推奨"
new_string: "（新しいヒントテキスト）"
replace_all: true
```

**ファイル:** `src/components/ShieldView.tsx`
- 行1011: SHIELD_AI_LINKS の hint フィールド

```
old_string: hint: '思考モード推奨'
new_string: hint: '（新しいヒントテキスト）'
```

### 3-3. DeepSeek ヒント（3箇所を一括）

**ファイル:** `src/components/QuantView.tsx`
- 行1567: CYBER_MODEスパン
- 行1660: 通常モード div

```
old_string: "R1モデル推奨"
new_string: "（新しいヒントテキスト）"
replace_all: true
```

**ファイル:** `src/components/ShieldView.tsx`
- 行1030: SHIELD_AI_LINKS の hint フィールド

```
old_string: hint: 'R1モデル推奨'
new_string: hint: '（新しいヒントテキスト）'
```

---

## ステップ4: ビルド確認 & デプロイ

```bash
# ビルド確認
npm run build

# 問題なければ git コミット & push
git add src/components/QuantView.tsx src/components/ShieldView.tsx
git commit -m "chore: AIモデル推奨ヒント更新 $(date '+%Y-%m-%d')"
git push
```

GitHub Actions の Vercel デプロイが自動実行される（または `npx vercel --prod` で手動デプロイ）。

---

## 現在の値（最終更新: 2026-05-24）

| AI | QuantView CYBER行 | QuantView 通常行 | ShieldView hint行 | 現在のヒント |
|---|---|---|---|---|
| ChatGPT | 1479 | 1590 | 1002 | `o3以上推奨` |
| Gemini | 1509 | 1614 | 1011 | `思考モード推奨` |
| DeepSeek | 1567 | 1660 | 1030 | `R1モデル推奨` |

> **注意:** ファイル編集後に行番号がずれるため、次回更新時はGrep検索で最新行番号を確認すること。
