# 記事管理画面

パスワードでログインし、ブラウザから記事を編集してリポジトリに直接コミットする管理画面です。

## 必要な環境変数（Vercel）

Vercel ダッシュボード → プロジェクト → Settings → Environment Variables で設定：

| 変数名 | 説明 |
|--------|------|
| `ADMIN_PASSWORD` | 管理画面のログインパスワード（必須） |
| `ADMIN_GITHUB_TOKEN` | GitHub Personal Access Token（`repo` スコープ必須） |
| `ADMIN_GITHUB_OWNER` | リポジトリのオーナー（省略時: poifulhakase） |
| `ADMIN_GITHUB_REPO` | リポジトリ名（省略時: pointlab） |
| `ADMIN_GITHUB_BRANCH` | ブランチ（省略時: main） |
| `ADMIN_GITHUB_BASE_PATH` | コンテンツのベースパス（省略時: pointlab/pointlab） |

## 使い方

1. `/admin/` にアクセス
2. **パスワード**を入力してログイン
3. 記事一覧から編集したい記事をクリック
4. 内容を修正し「保存」をクリック
5. GitHub にコミットされ、Vercel が自動デプロイされます

## 画像アップロード（Imgur）

記事に画像を挿入するには、Imgur の Client ID を設定してください。

1. [Imgur API](https://api.imgur.com/oauth2/addclient) でアプリ登録
2. 「OAuth 2 authorization without a callback URL」を選択
3. 発行された **Client ID** を管理画面の設定に入力
4. 記事編集画面で「ファイルを選択」から画像をアップロード
5. アップロード完了後、カーソル位置に `<img>` タグが自動挿入されます

## セキュリティ

- トークンは Vercel の環境変数に保存され、ブラウザには渡されません
- 公開サイトで `/admin/` を公開する場合は、URL を人に教えないようにするか、Basic 認証などを検討してください
- トークンは定期的にローテーションすることを推奨します
