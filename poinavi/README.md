# ぽいナビ MVP

現在地から近い店舗・スポットを直感的に検索・ナビゲーションするアプリケーション

## 機能

### 1️⃣ 設定バー（画面上部）
- **タグ選択**: 複数タグを選択して検索
- **検索テキスト入力**: 店名やスポット名で検索
- **表示件数**: 3～5件から選択
- **営業中のみ表示**: ON/OFF切り替え
- **ライト／ダークモード**: テーマ切替

### 2️⃣ マップ表示（中央）
- **現在地表示**: GPS連動で現在地を表示
- **マーカー表示**: 
  - 赤：営業中
  - 黄：情報なし
  - 青：閉店
- **トップ3～5件リスト**: 距離順で表示、マーカーと連動
- **ルート表示**: 簡易所要時間表示

### 3️⃣ 固定要素（画面下部）
- **noteバナー**: ぽいふる博士コンテンツへの誘導

## セットアップ

### 1. Google Maps API キーの設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Maps JavaScript API と Places API を有効化
3. API キーを取得
4. `index.html` の以下の部分を編集：

```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places,geometry"
  defer
></script>
```

`YOUR_GOOGLE_MAPS_API_KEY` を実際のAPIキーに置き換えてください。

### 2. ローカルで実行

```bash
# 簡単なHTTPサーバーを起動（例：Python）
python -m http.server 8000

# または Node.js の場合
npx http-server
```

ブラウザで `http://localhost:8000` にアクセス

## 技術スタック

- HTML5
- CSS3（カスタムプロパティでライト／ダークモード対応）
- JavaScript（Vanilla JS）
- Google Maps JavaScript API
- Google Places API

## 注意事項

- Google Maps API は使用量に応じて課金されます
- 本番環境では、APIキーを適切に管理してください
- 位置情報の取得にはユーザーの許可が必要です

## 今後の拡張予定

- 天気情報の表示
- お気に入り機能
- 詳細なルート案内（Directions API）
- 公共交通機関の案内

