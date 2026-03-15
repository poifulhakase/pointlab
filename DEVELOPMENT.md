# 開発フロー - ローカル → 本番

ローカル環境で開発し、本番環境（Vercel）にデプロイするためのガイドです。

## プロジェクト構成

```
PointLab/                    # ワークスペースルート
├── package.json             # npm run dev でローカル起動
└── pointlab/                 # 本番デプロイ対象（Vercel ルート）
    ├── vercel.json          # 本番設定（リダイレクト等）
    ├── package.json         # ビルド用スクリプト
    ├── index.html           # サイトトップ
    ├── poinavi/             # ぽいナビ（地図・翻訳・ラボノート）
    ├── poirobo/             # ぽいロボ
    ├── hakaseAI/            # 博士AI
    └── admin/               # 管理画面
```

**重要**: `pointlab/` フォルダがローカル・本番とも共通のドキュメントルートです。
URL 構成は同一（例: `/poinavi/` = ぽいナビ）です。

---

## ローカル開発

### 1. 起動

**方法A**: ワークスペースルート（PointLab/）で実行：

```bash
npm run dev
```

**方法B**: pointlab フォルダ内で実行：

```bash
cd pointlab
npm run dev
```

いずれも同じ構成で起動します。

- ローカル: http://localhost:3000
- ぽいナビ: http://localhost:3000/poinavi/
- 翻訳マシン: http://localhost:3000/poinavi/translate.html

### 2. アクセス時の注意

- **必ず末尾スラッシュ付きでアクセス**: `http://localhost:3000/poinavi/`
- `/poinavi` のみだと相対パスの解決が崩れる場合があります
- 各 HTML に `<base href="/poinavi/">` を設定済みのため、多くのケースでは両方で動作します

### 3. ローカルと本番の差異

| 項目 | ローカル (serve) | 本番 (Vercel) |
|------|------------------|---------------|
| リダイレクト | なし | `/poinavi` → `/poinavi/` 等 |
| API（hakaseAI等） | 動作しない | サーバーレス関数で動作 |
| 静的ファイル | 同一 | 同一 |

---

## 本番デプロイ（Vercel）

### デプロイ方法

1. **Git 連携**  
   - リポジトリを Vercel に接続  
   - プロジェクト設定で **Root Directory** を `pointlab` に設定

2. **コマンドからデプロイ**:
   ```bash
   cd pointlab
   vercel          # プレビュー
   vercel --prod   # 本番
   ```

### 本番 URL

- サイト: https://pointlab.vercel.app
- ぽいナビ: https://pointlab.vercel.app/poinavi/

---

## 開発の流れ

```
1. ローカルで開発
   npm run dev → http://localhost:3000/poinavi/ で確認

2. 変更をコミット
   git add .
   git commit -m "機能追加: xxx"

3. プッシュで本番デプロイ
   git push origin main
   （Vercel が自動デプロイ）
```

---

## パス・アセットのルール

### 相対パス

- `./style.css` など相対パスを使用
- 各アプリ（poinavi, hakaseAI）には `<base href="...">` を設定済み

### base タグ

- `poinavi/*.html`: `<base href="/poinavi/">`
- `hakaseAI/index.html`: `<base href="/hakaseAI/">`

末尾スラッシュの有無によるパス崩れを防ぐため、これらの base タグは削除しないでください。

---

## トラブルシューティング

### ERR_TOO_MANY_REDIRECTS
- `serve.json` のリダイレクト設定が原因の可能性があります
- `serve.json` がある場合は削除し、`/poinavi/` のように末尾スラッシュ付きでアクセスしてください

### スタイル・スクリプトが効かない
- `http://localhost:3000/poinavi/`（末尾スラッシュ付き）で開き直してください
- ブラウザのキャッシュを削除して再読み込みしてください

### 本番とローカルで表示が違う
- 本番の `translate.html` 等は本番環境を正として同期済みです
- 差分が出る場合は本番の該当ファイルをローカルに反映してください
