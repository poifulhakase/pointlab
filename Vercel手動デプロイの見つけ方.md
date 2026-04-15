# Vercel「Deploy manually」の見つけ方

## 🔍 現在の状況

あなたが見ている画面には：
- Gitリポジトリのインポート
- テンプレートの複製

が表示されていますが、「Deploy manually」が見当たらない状態ですね。

## 📍 「Deploy manually」の場所

### 方法1：画面を下にスクロール
1. 現在の画面を**下にスクロール**してください
2. 「Deploy manually」または「**Upload**」というセクションがあるはずです
3. そこに「**Browse**」ボタンやドラッグ&ドロップエリアがあります

### 方法2：URLから直接アクセス
以下のURLに直接アクセスしてみてください：
```
https://vercel.com/new?mode=manual
```

### 方法3：別の入口から
1. ダッシュボード（https://vercel.com/dashboard）に戻る
2. 右上の「**Add New...**」をクリック
3. 「**Project**」を選択
4. 画面下部に「**Deploy manually**」があるか確認

---

## 🚀 代替方法：GitHubリポジトリを作成してインポート（推奨）

もし「Deploy manually」が見つからない場合は、GitHubリポジトリを作成してインポートする方法が確実です：

### ステップ1：GitHubでリポジトリを作成
1. https://github.com/new にアクセス
2. Repository name: `pointlab` と入力
3. 「Create repository」をクリック

### ステップ2：ファイルをプッシュ
PowerShellで以下を実行：

```powershell
cd "C:\Users\owner\OneDrive\デスクトップ\PointLab"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/poifulhakase/pointlab.git
git push -u origin main
```

### ステップ3：Vercelでインポート
1. Vercelの画面で「**Gitリポジトリをインポートする**」を選択
2. GitHubアカウントを連携（まだの場合）
3. `poifulhakase/pointlab` リポジトリを選択
4. 「Import」をクリック
5. 設定はそのままで「Deploy」をクリック

---

## 🌐 別の選択肢：Netlifyを使う

Vercelで見つからない場合は、Netlifyも同様に簡単です：

1. https://www.netlify.com にアクセス
2. 「Sign up」でログイン
3. ダッシュボードで「**Add new site**」をクリック
4. 「**Deploy manually**」が明確に表示されます
5. フォルダをドラッグ&ドロップ

Netlifyの方が「Deploy manually」が見つかりやすい場合があります。

---

## 🎯 今すぐ試せること

### オプションA：画面をスクロール
- 現在のVercelの画面を**一番下までスクロール**して「Deploy manually」を探す

### オプションB：直接URLアクセス
- https://vercel.com/new?mode=manual にアクセス

### オプションC：GitHubリポジトリ作成
- 上記のステップ1〜3を実行（自動デプロイも設定できます）

### オプションD：Netlifyを使用
- Netlifyに切り替える（手動デプロイが分かりやすい）

---

## 💡 推奨

**GitHubリポジトリを作成してインポートする方法**を推奨します：
- 確実に動作する
- 今後、ファイルを更新すると自動で再デプロイされる
- バージョン管理もできる

どの方法を試しますか？

