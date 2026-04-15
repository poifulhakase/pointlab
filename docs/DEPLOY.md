# 本番反映手順（Vercel）

## 方法1: デプロイスクリプト（推奨）

`pointlab/deploy.bat` をダブルクリックして実行。

- **1** … Vercel CLI で直接デプロイ（初回は `npx vercel login` が必要）
- **2** … Git でコミット＆プッシュ → Vercel が自動デプロイ

## 方法2: Vercel CLI（手動）

```bash
# 初回のみ: ログイン
npx vercel login

# pointlab フォルダに移動してデプロイ
cd pointlab
npx vercel --prod
```

プロンプトで **Set up and deploy?** → `Y`  
**Which scope?** → 自分のアカウント  
**Link to existing project?** → 既存の pointlab プロジェクトがあれば `Y`、なければ `N`  
**Project name?** → `pointlab` など

## 方法3: GitHub 連携

1. リポジトリを GitHub にプッシュ
2. [vercel.com](https://vercel.com) にログイン
3. **Add New** → **Project** → リポジトリを選択
4. **Root Directory** で `pointlab/pointlab` を指定（メインサイトのルート）
5. **Deploy** を実行

## 方法4: ドラッグ＆ドロップ

1. [vercel.com](https://vercel.com) → **Add New** → **Project**
2. **Deploy** タブで `pointlab/pointlab` フォルダをドラッグ＆ドロップ

---

**デプロイ後**
- サイト: https://pointlab.vercel.app
- 管理画面: https://pointlab.vercel.app/admin/
