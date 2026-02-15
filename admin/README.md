# 記事管理画面

GitHub API を使い、ブラウザから記事を編集してリポジトリに直接コミットする管理画面です。

## 前提条件

- サイトのソースが **GitHub リポジトリ** にプッシュされていること
- **Personal Access Token**（`repo` スコープ付き）を用意すること

## パスワード保護

管理画面には簡易パスワード保護がかかっています。

1. **Vercel の環境変数**に `ADMIN_PASSWORD` を設定してください（例: 英数字8文字以上）
2. Vercel ダッシュボード → プロジェクト → Settings → Environment Variables
3. Name: `ADMIN_PASSWORD`、Value: 任意のパスワード

※ローカルで `admin/index.html` を開く場合、API が存在しないためパスワード認証はスキップされます。本番（`https://pointlab.vercel.app/admin/`）では認証が有効になります。

## 使い方

1. `admin/index.html` を開く（ローカルでも Vercel デプロイ先の `/admin/` でも可）
2. **設定** に以下を入力して「設定を保存」：
   - **GitHub ユーザー名 / 組織名**：例 `pointlab`
   - **リポジトリ名**：例 `PointLab`
   - **ブランチ**：通常 `main`
   - **コンテンツのベースパス**：リポジトリルートに `index.html` や `articles/` がある場合は空欄。`pointlab/pointlab/` のようにサブフォルダにある場合はそのパスを指定
   - **Personal Access Token**：GitHub → Settings → Developer settings → Personal access tokens で作成（`repo` にチェック）

3. 記事一覧が表示されたら、編集したい記事をクリック
4. 内容を修正し「保存」をクリック
5. GitHub にコミットされ、Vercel が自動デプロイします

## 画像アップロード（Imgur）

記事に画像を挿入するには、Imgur の Client ID を設定してください。

1. [Imgur API](https://api.imgur.com/oauth2/addclient) でアプリ登録
2. 「OAuth 2 authorization without a callback URL」を選択
3. 発行された **Client ID** を管理画面の設定に入力
4. 記事編集画面で「ファイルを選択」から画像をアップロード
5. アップロード完了後、カーソル位置に `<img>` タグが自動挿入されます

## Token の発行

1. GitHub → 右上アイコン → **Settings**
2. 左メニュー最下部 **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** または **Fine-grained tokens**
4. 新規作成し、**repo** スコープを付与
5. トークンをコピーし、管理画面の設定に貼り付け

## セキュリティ

- トークンはブラウザの localStorage に保存されます
- 公開サイトで `/admin/` を公開する場合は、URL を人に教えないようにするか、Basic 認証などを検討してください
- トークンは定期的にローテーションすることを推奨します
