# Vercelデプロイ詳細手順

## 📍 「Add New Project」→「Deploy manually」の場所

### ステップ1：Vercelにアクセス・ログイン
1. https://vercel.com にアクセス
2. 右上の「Sign Up」または「Log In」をクリック
3. GitHubアカウントでログイン（推奨）またはメールアドレスで登録

### ステップ2：ダッシュボードに移動
- ログイン後、自動的にダッシュボード（Dashboard）に移動します
- もし別のページにいる場合は、左上の「Vercel」ロゴをクリックしてダッシュボードに戻ります

### ステップ3：「Add New Project」を探す
ダッシュボードには以下のいずれかが表示されます：

#### パターンA：初めての場合
- 画面中央に大きな「**Add New Project**」ボタンが表示されます
- または「**Create a New Project**」というボタン

#### パターンB：既にプロジェクトがある場合
- 右上に「**Add New...**」ボタンがあります
- クリックするとドロップダウンメニューが表示され、「**Project**」を選択

### ステップ4：「Deploy manually」を選択
1. 「Add New Project」をクリック
2. 次の画面で2つの選択肢が表示されます：
   - **「Import Git Repository」**（GitHubリポジトリからインポート）
   - **「Deploy manually」**（手動デプロイ）← **これを選択**

### ステップ5：ファイルをアップロード
1. 「Deploy manually」を選択すると、ファイルアップロード画面が表示されます
2. 以下のいずれかの方法でアップロード：
   - **ドラッグ&ドロップ**：`PointLab`フォルダをそのままドラッグ&ドロップ
   - **「Browse」ボタン**：クリックしてフォルダを選択

### ステップ6：デプロイ設定（通常はそのままでOK）
- **Project Name**: 自動で生成されます（変更可能）
- **Framework Preset**: 「Other」のまま
- **Build Command**: 空欄のまま
- **Output Directory**: 空欄のまま
- **Install Command**: 空欄のまま

### ステップ7：デプロイ実行
1. 「**Deploy**」ボタンをクリック
2. 数秒〜1分程度でデプロイが完了
3. 「**Visit**」ボタンまたはURLをクリックしてサイトを確認

---

## 🖼️ 画面の見つけ方（補足）

### もし「Add New Project」が見つからない場合

1. **左上のメニューを確認**
   - ハンバーガーメニュー（三本線）をクリック
   - 「Dashboard」を選択

2. **URLを直接確認**
   - ダッシュボードのURL: https://vercel.com/dashboard
   - プロジェクト追加のURL: https://vercel.com/new

3. **検索バーを使う**
   - 画面上部の検索バーで「new project」と検索

---

## 📸 画面のイメージ

```
┌─────────────────────────────────────┐
│  Vercel                    [ユーザー名] │
├─────────────────────────────────────┤
│                                     │
│         [Add New Project]          │  ← ここをクリック
│                                     │
│  または                              │
│                                     │
│  [Add New...] → [Project]          │  ← 右上のボタン
│                                     │
└─────────────────────────────────────┘
```

---

## 🔄 代替方法：Netlifyを使う場合

もしVercelの画面が見つからない場合は、Netlifyも同様に簡単です：

1. https://www.netlify.com にアクセス
2. 「Sign up」でログイン
3. ダッシュボードで「**Add new site**」をクリック
4. 「**Deploy manually**」を選択
5. フォルダをドラッグ&ドロップ

---

## ❓ よくある質問

### Q: ログインできない
A: GitHubアカウントでログインするのが最も簡単です。GitHubアカウントがない場合は、メールアドレスで新規登録できます。

### Q: ダッシュボードが表示されない
A: ブラウザをリフレッシュ（F5）するか、https://vercel.com/dashboard に直接アクセスしてください。

### Q: 「Deploy manually」が見つからない
A: 「Add New Project」をクリックした後の画面で、下の方にスクロールすると「Deploy manually」のオプションがあります。

---

## 🎯 クイックリファレンス

1. **Vercelにアクセス**: https://vercel.com
2. **ログイン**: GitHubアカウント推奨
3. **ダッシュボード**: https://vercel.com/dashboard
4. **新規プロジェクト**: https://vercel.com/new
5. **「Add New Project」をクリック**
6. **「Deploy manually」を選択**
7. **フォルダをドラッグ&ドロップ**
8. **「Deploy」をクリック**

