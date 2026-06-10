# CLAUDE.md — ぽいロボ (stock-calendar) 作業規約

> このファイルは Claude Code がセッション開始時に**自動で読み込む**。
> 会話履歴に依存せず、ここと `handover.md` / `requirements.md` を「正」として作業する。

---

## 🔁 作業フロー（毎回これに従う）

1. **作業開始**: `CLAUDE.md`（本書）→ `handover.md`（直近状態・次やること）→ 必要なら `requirements.md`（仕様の正）/ `docs/` を読む。
2. **開発**: コード修正・機能追加・テスト。
3. **作業完了**: 今回の変更を **`handover.md` に追記**（古い内容は要約して圧縮、肥大化させない）。
4. **Git保存**: ユーザーが保存を指示したら commit & push。**`vercel --prod` した時は必ず commit & push する**（本番とリポジトリの乖離を作らない）。
5. 終了（`/clear`）。

> ねらい: セッションをまたいで会話履歴に頼らない。記憶の正は常にこのリポジトリ内のファイル。

---

## プロジェクト概要

- **アプリ名**: ぽいロボ（株式投資家向けカレンダー / 需給分析 PWA）
- **本番URL**: https://pointlab.vercel.app/stock-calendar
- **Vercel**: `pointlabs-projects/pointlab`（`vercel --prod` でデプロイ）
- **Firebase**: project `pointlab-96310`（Firestore / Auth / FCM）
- **スタック**: React 19 + TypeScript + Vite + vite-plugin-pwa / Firestore / TradingView Lightweight Charts
- **方針（重要）**: 当面【無料・友人限定クローズドβ】。投資助言業の登録はせず、出力は**客観的状態記述型**（命令・推奨をしない）。一般公開は法務解決後。

詳細仕様は `requirements.md`、設計の深掘りは `docs/` と `~/.claude` メモリ（過去25セッションの作業ログ）を参照。

---

## コマンド（Windows / PowerShell 環境）

```powershell
# 開発（http://localhost:5173/）
Set-Location 'C:\Project\PointLab\stock-calendar'; npm run dev

# ビルド（build-sw → tsc -b → vite build → copy-static）
Set-Location 'C:\Project\PointLab\stock-calendar'; npm run build

# 型チェック単体（🔴 tsconfig.app.json を必ず指定）
cmd /c "cd C:\Project\PointLab\stock-calendar && npx tsc --noEmit -p tsconfig.app.json"

# Lint
Set-Location 'C:\Project\PointLab\stock-calendar'; npm run lint

# テスト（vitest）
Set-Location 'C:\Project\PointLab\stock-calendar'; npm test

# データ取得（JPX Excel + nikkei225jp.com → public/data/*.json）
Set-Location 'C:\Project\PointLab\stock-calendar'; npm run fetch-data

# バックテスト再計算（→ public/data/backtest_results.json）
Set-Location 'C:\Project\PointLab\stock-calendar'; npm run backtest

# 本番デプロイ
Set-Location 'C:\Project\PointLab\stock-calendar'; vercel --prod

# Firestore ルール デプロイ
npx firebase-tools deploy --only firestore:rules --project pointlab-96310
```

### 環境固有の落とし穴
- **PowerShell では `&&` は使えない** → `Set-Location ...; <cmd>` で繋ぐ。
- 型チェックは **`tsconfig.app.json` 指定必須**。指定しないと `noUnusedLocals/noUnusedParameters` が効かず、Vercel ビルドでだけ型エラーが出る。
- `npm install` は `.npmrc` の `legacy-peer-deps=true` 前提（vite-plugin-pwa の peer deps 対応）。
- Vercel の env 追加は `echo` 禁止（末尾改行が付き CRON_SECRET 等で HTTP ヘッダーエラー）→ `node -e "process.stdout.write(...)"` を使う。

---

## 🔴 不変ルール（壊すと本番事故になる箇所）

- **TEV計算式は `src/utils/tevCore.mjs` が単一情報源**。`backtest-tev.mjs` と `engineExport.ts` はこれを呼ぶ。式を二重定義しない／片方だけ変えない。
- **データ更新は `.github/workflows/fetch-data.yml` に一本化**。コミットメッセージに `[skip ci]` を付けない（自動デプロイが止まる）。
- **管理者メールは `firestore.rules` の `isAdmin()` に集約**（`utils/admin.ts` と齟齬が出ないようテストあり）。変更時は両方確認。
- **`api/` は ESM 必須**。firebase-admin 系は `FIREBASE_SERVICE_ACCOUNT` 環境変数 + `getAdmin()` の遅延初期化で使う。
- **PCR データソースは `parseDailyArray` 必須**（配列の hole 対策）。
- **エンジン/シールド出力は状態記述型**（命令・推奨を出さない）。プロンプト改修時は **EvalsPanel の採点キーも同時に直す**。
- **`vercel --prod` 後は必ず commit & push**（本番=リポジトリを保つ）。

---

## 関連ドキュメント
- `handover.md` … 直近の作業状態・未コミット内容・次やること（**毎回更新**）
- `requirements.md` … アプリ仕様・機能要件の正
- `docs/` … デプロイ手順・法務(`docs/legal/`)・年次メンテ(`docs/maintenance/`)
- `~/.claude` メモリ … 第1〜25セッションの詳細作業ログ（背景・経緯の参照用）
