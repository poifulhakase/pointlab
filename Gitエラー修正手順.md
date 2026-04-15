# Gitエラー修正手順

## 🔴 エラー内容
```
error: src refspec main does not match any
error: failed to push some refs to 'https://github.com/poifulhakase/pointlab.git'
```

## 🔍 原因
- Gitリポジトリが初期化されていない
- コミットが作成されていない
- ブランチ名が`main`ではない

## ✅ 解決手順

### ステップ1：PowerShellでプロジェクトフォルダに移動
```powershell
cd "C:\Users\owner\OneDrive\デスクトップ\PointLab"
```

### ステップ2：Gitリポジトリを初期化（まだの場合）
```powershell
git init
```

### ステップ3：すべてのファイルをステージング
```powershell
git add .
```

### ステップ4：初回コミットを作成
```powershell
git commit -m "Initial commit"
```

### ステップ5：ブランチ名を確認・変更
```powershell
# 現在のブランチを確認
git branch

# もしブランチ名が`master`の場合は`main`に変更
git branch -M main
```

### ステップ6：リモートリポジトリを追加
```powershell
git remote add origin https://github.com/poifulhakase/pointlab.git
```

### ステップ7：プッシュ
```powershell
git push -u origin main
```

---

## 📝 完全なコマンド（一括実行）

PowerShellで以下を順番に実行してください：

```powershell
cd "C:\Users\owner\OneDrive\デスクトップ\PointLab"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/poifulhakase/pointlab.git
git push -u origin main
```

---

## ⚠️ 注意点

- もし既に`git init`を実行している場合は、ステップ2をスキップしてください
- もし既にリモートが追加されている場合は、ステップ6の前に以下を実行：
  ```powershell
  git remote remove origin
  ```
- GitHubの認証が必要な場合は、ユーザー名とパスワード（またはPersonal Access Token）を入力してください

---

## 🎯 成功したら

GitHubリポジトリにファイルがアップロードされます。
その後、VercelでGitリポジトリをインポートできます。

