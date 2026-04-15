# PointLab セキュリティガイド

本プロジェクトで実施しているセキュリティ対策と、開発・運用時の推奨事項をまとめています。

## 実施済み対策

### 1. HTTPセキュリティヘッダー（vercel.json）

すべてのレスポンスに以下のヘッダーを付与しています。

| ヘッダー | 値 | 役割 |
|----------|-----|------|
| X-Content-Type-Options | nosniff | MIME スニッフィングの無効化 |
| X-Frame-Options | SAMEORIGIN | クリックジャッキング対策 |
| Referrer-Policy | strict-origin-when-cross-origin | リファラ情報の制限 |
| Permissions-Policy | camera=(self), microphone=(self), geolocation=(self) | カメラ・マイク・位置情報の利用制限 |

### 2. XSS（クロスサイトスクリプティング）対策

- **HTML エスケープ**: ユーザー入力や外部 API の応答を `innerHTML` / `insertAdjacentHTML` に挿入する前に `escapeHtml` でエスケープ
- **適用箇所**:
  - 地図検索結果（店舗名・営業状況）
  - マーカー情報ウィンドウ（店舗名・住所・営業時間）
  - お手洗いレイヤーの InfoWindow
  - 翻訳・通貨・単位変換の表示
- **画像 URL の制限**: OCR プレビュー画像は `data:image/` および `blob:` のみ許可

### 3. その他の対策

- メモ・ラボノートのメモ内容は `linkifyUrls` 内でエスケープ後に URL をリンク化
- タグ名は `textContent` で挿入しており、そのままエスケープ相当
- `map.html` には `X-Content-Type-Options` および `referrer` の meta タグを設定（一部ページ）

## 推奨事項

### Google Maps API キーの制限

本番環境では、Google Cloud Console で API キーに**アプリケーションの制限**と**API の制限**を設定してください。

1. **アプリケーションの制限**
   - ウェブサイト: デプロイ先ドメインのみ許可（例: `https://your-domain.vercel.app/*`, `https://your-domain.com/*`）

2. **API の制限**
   - 使用する API のみ有効化（Maps JavaScript API、Places API、Geocoding API など）

### Fitbit トークンの取り扱い

- `lab.html` で Fitbit のアクセストークンを `localStorage` に保存しています
- 本番環境では HTTPS を必ず使用してください
- トークンの有効期限管理とリフレッシュ処理を適切に実装してください

### 定期的な確認

- 依存関係の更新（`npm audit`）
- 新たなユーザー入力や外部データを DOM に反映する際のエスケープの見直し
- 本番環境での HTTP セキュリティヘッダーの動作確認
