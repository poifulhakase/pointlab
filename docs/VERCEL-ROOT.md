# Vercel Root Directory の設定

間違ったフォルダが配信されている場合の修正方法です。

## 修正方法

### A. deploy.bat で再デプロイ（推奨）

`pointlab/deploy.bat` を実行し、**1** を選択。

### B. Vercel ダッシュボードで Root Directory を変更

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. **pointlab** プロジェクトを選択
3. **Settings** → **General**
4. **Root Directory** を `pointlab/pointlab` に変更
5. **Save** 後、**Redeploy** を実行
