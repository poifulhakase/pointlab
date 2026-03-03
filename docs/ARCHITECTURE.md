# PointLab デプロイまわり構成（簡素化版）

## 基本方針

- **deploy-now.bat 1本で本番反映**
- 副業画像は HTML 埋め込み（404 回避）
- 重複スクリプトを削除

---

## デプロイフロー

```
deploy-now.bat
  ├─ copy-images.bat … ポイ活・マツ活・株式等を images/ へコピー
  ├─ embed-sidebiz-image.js … 副業画像を HTML に Base64 埋め込み
  ├─ verify-before-deploy.js … 必須ファイルチェック
  └─ vercel --prod … 本番デプロイ
```

---

## 画像の流れ

| 種類 | コピー元 | 配置先 | 備考 |
|------|----------|--------|------|
| 副業カード | assets / images / images-source | **HTML に埋め込み** | embed-sidebiz-image.js |
| ポイ活・マツ活・生き方・株式等 | note用, assets | images/ | copy-images.bat |
| favicon 等 | assets | pointlab 直下 | copy-images.bat |

副業画像はファイルとしてデプロイせず、HTML 内に Base64 で埋めるため 404 が出ない。

---

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| deploy-now.bat | メインのデプロイ入口 |
| deploy.bat | 選択式（CLI / Git / 同期） |
| batch/copy-images.bat | 他画像を images/ にコピー |
| scripts/embed-sidebiz-image.js | 副業画像の HTML 埋め込み |
| scripts/verify-before-deploy.js | デプロイ前チェック |

---

## 削除済み（役割が embed に統合）

- copy-sidebiz-only.bat
- copy-note-from-assets.bat
- copy-sidebiz-now.js
- copy-sidebiz-image.ps1
