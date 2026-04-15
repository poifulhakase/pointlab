# 404 エラー対策ガイド

画像や JS が 404 になる場合、以下の手順で解消できます。

## 404 の種類と原因

| リソース | 原因 |
|---------|------|
| **副業カード画像** | deploy-now.bat の embed が画像を見つけられなかった。Cursor に貼るか images/ に配置 |
| **他画像** (Poikatsu_*.jpg など) | `images/` が空。`batch\copy-images.bat` 未実行、または images/ に直接配置 |
| **JS** (language-switcher.js など) | Vercel の Root Directory が `pointlab/pointlab` になっていない |

---

## 必須：コピー元フォルダの準備

`batch\copy-images.bat` が正常に動作するには、以下のフォルダに画像が必要です。

| フォルダ | 場所 | 必要な画像 |
|---------|------|-----------|
| ポイ活 | `%USERPROFILE%\Downloads\note用` | Poikatsu_3min_Recipe_*.jpg（10種） |
| 生き方 | `%USERPROFILE%\Downloads\note用2` | Compass_for_Living_*.jpg（3種） |
| 株式投資 | `%USERPROFILE%\Downloads\新しいフォルダー` | Stock_Trade_Lab_*.png（複数） |
| ハカセAI・開業・ぽいんとらぼ | Cursor プロジェクトの `assets` | *HakaseAI*.png, *Sole_Proprietor*.png, *Pointlab*.png |

**フォルダがない場合**：  
該当する画像を `pointlab/pointlab/images/` に直接配置してください。

---

## デプロイ手順（Vercel CLI・推奨）

**deploy-now.bat を実行するだけ**（1本で完結）

内部で自動実行:
1. copy-images.bat（ポイ活・マツ活等を images/ へコピー）
2. embed-sidebiz-image.js（副業画像を HTML に埋め込み）
3. 事前チェック
4. Vercel デプロイ

副業画像が見つからない場合 → Cursor に貼るか images/ か images-source/ に配置して再実行

**本番に反映されない場合**
   - Vercel が **Git と連携** だと、本番 URL は Git の内容を表示します。CLI デプロイしても反映されないことがあります。
   - **対処A**: `images` フォルダを Git にコミットして push（下記 Git デプロイ参照）
   - **対処B**: Vercel → Settings → Git → **Disconnect** で Git 連携を外す（以降は CLI デプロイのみ）
   - キャッシュ: Ctrl+Shift+R でハードリロード、またはシークレットウィンドウで確認

---

## Git デプロイの場合

**deploy.bat の [2] を選ぶと、画像コピー・検証が自動で実行されます。**

1. **Vercel ダッシュボード**
   - [vercel.com/dashboard](https://vercel.com/dashboard) → プロジェクト選択
   - Settings → General → **Root Directory** を `pointlab/pointlab` に設定
   - 保存後、Redeploy

2. **images をコミット**
   - `deploy.bat` の [2] を使うと、copy-images 後に `git add` が実行される
   - `.gitignore` に `images/` が含まれていないか確認

---

## JS が 404 になる場合

- Vercel → プロジェクト → Settings → General
- **Root Directory** が `pointlab/pointlab` であることを確認
- 誤: `pointlab` や空欄
- 正: `pointlab/pointlab`

---

## 確認方法

デプロイ後、以下にアクセスして確認：

- https://pointlab.vercel.app/images/Poikatsu_3min_Recipe_rakutenSPS.jpg
- https://pointlab.vercel.app/js/language-switcher.js

404 の場合は、上記手順を再度確認してください。
