# GitHub への本番反映手順

新しい note 風 UI を https://pointlab.vercel.app に反映するための手順です。

---

## ※ pointlab が二重の場合（事前に解消）

`PointLab\pointlab\pointlab` となっている場合は、先に `PointLab\flatten-pointlab.bat` を実行して `PointLab\pointlab` に統一してください。

---

## 前提

- **ローカル**: `PointLab\pointlab` フォルダに新しいサイト一式がある
- **GitHub**: https://github.com/poifulhakase/pointlab
- **Vercel**: 上記リポジトリの `main` にプッシュすると自動デプロイ

---

## 手順

### 1. リポジトリをクローンする

デスクトップなど作業しやすい場所で：

```powershell
cd C:\Users\owner\OneDrive\デスクトップ
git clone https://github.com/poifulhakase/pointlab.git pointlab-deploy
cd pointlab-deploy
```

`pointlab-deploy` がリポジトリの内容で作成されます。

---

### 2. 新しいファイルをコピーする

次のファイル・フォルダを、`PointLab\pointlab` から `pointlab-deploy` にコピーして上書きします。

| コピー元 (PointLab\pointlab\) | コピー先 (pointlab-deploy\) |
|---|---|
| index.html | index.html |
| contact.html | contact.html |
| profile.html | profile.html |
| service.html | service.html |
| favicon.svg | favicon.svg |
| vercel.json | vercel.json |
| middleware.js | middleware.js |
| css\ | css\ |
| js\ | js\ |
| articles\ | articles\ |
| images\ | images\ |
| public\ | public\ |
| README.md | README.md |

**手動でコピーする場合：**（省略）

---

### 4. コミットとプッシュ

```powershell
# pointlab-deploy フォルダ内で実行
git add .
git status
git commit -m "note風UIに更新"
git push origin main
```

---

## js だけ反映したい場合

`pointlab\batch\deploy-js-to-production.bat` を実行すると、`js` フォルダを `pointlab-deploy` にコピーしてプッシュします。
※ `pointlab-deploy` がデスクトップ直下にある必要があります。
