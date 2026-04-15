# vw/vh 変換候補 調査レポート

スマホ版で vw/vh 化できる可能性のある箇所を調査しました。  
**除外対象**：border-width、box-shadow、backdrop-filter、1px（非表示要素）、SVG内部座標

---

## 1. style.css

### 高優先（レイアウト・表示サイズに直結）

| 行 | セレクタ/箇所 | 現在の値 | 推奨置換 | 備考 |
|---|---|---|---|---|
| 579 | `.gm-style-iw` 系 | max-width: 328px | var(--s328) | Google Maps InfoWindow |
| 585 | 同上 | max-height: 350px | var(--s350) | 同上 |
| 603-604 | InfoWindow 閉じるボタン | top: 8px; right: 8px | var(--s8) | 位置 |
| 639, 647 | InfoWindow | margin: 8px | var(--s8) | 余白 |
| 1001 | モーダル等 | width: 280px | var(--s280) | 幅 |
| 1396, 1401, 1407 | ポップアップ | max-width: 228px→200px→168px | var(--s228)等 | メディアクエリ内 |
| 1482, 4951 | モーダル/カメラ | max-width: 328px | var(--s328) | 同上 |
| 1614 | モーダル | max-width: 360px | var(--s360) | 同上 |
| 1764, 2768, 3556, 5324, 5775, 5967, 6074 | 各種 | max-width: 500px | var(--s200) or 固定 | 500px は未定義、必要なら --s500 追加 |
| 2038 | 画像プレビュー | max-height: 200px | var(--sh150) 等 | 高さ |
| 2061 | アバター等 | max-width: 128px | var(--s128) | 既に置換済みの可能性 |
| 2544, 2594, 3995 | モーダル | padding: 28px | var(--s28) | 余白 |
| 2679 | カード | max-width: 228px | var(--s228) | 要 --s228 追加 |
| 3429 | パネル | padding: ... 16px 0 | var(--s16) | 余白 |
| 3986 | モーダル | margin: 16px 0 0 | var(--s16) | 余白 |
| 4246-4247 | トグル | top: 4px; left: 4px | var(--s4) | 位置 |
| 4774, 4813, 4826 | 通貨/QRボタン | max-width: 180px→160px→150px | var(--s180)等 | 要変数追加 |
| 5381 | 翻訳結果 | min-height: 150px | var(--sh150) | 高さ |
| 5392 | オーバーレイ | margin-top: 8px | var(--s8) | 余白 |
| 5833-5834 | 音声 wave | width/height: 250px | var(--s250) | 波形キャンバス |
| 6111-6112 | ラボページ | padding: 0 16px; padding-bottom: calc(28px + ...) | var(--s16), var(--s28) | 余白 |
| 6128 | ヒーロー時刻 | letter-spacing: -8px | 要検討 | デザイン要 |
| 5908 | 音声 | margin: 0 0 16px 0 | var(--s16) | 余白 |

### 要検討（position / transform の px）

| 行 | 値 | 備考 |
|---|---|---|
| 711 | top: -40px | 吹き出しテール位置 |
| 1568, 1622, 1773 | transform: translateY(28px) | アニメーション |
| 1964, 2369, 2642 | transform: translateY(-8px) | ホバー時の浮き |
| 2623 | transform: translateX(-8px) | スライド |
| 4257 | transform: translateX(24px) | トグル位置 |
| 5085-5131 | top/left/right/bottom: -8px | クロップオーバーレイ |
| 5849-5874 | 同上 | 波形キャンバス周り |

### 除外（border / box-shadow / 1px 等）

- border: 1px / 8px solid … → 現状維持
- box-shadow, backdrop-filter → 現状維持
- width/height: 1px（.visually-hidden, .memo-image-input）→ 現状維持
- 677行目 background-size: 256px 256px → パターン用、要検討
- 677行目以降 @media (min-width: 501px) 内 → PC 用のため px のまま

---

## 2. lab.html（インラインスタイル）

※ `.lab-dashboard`, `.lab-activity-container` は `display: none` のため現状非表示

| 行 | クラス/要素 | 現在の値 | 推奨 |
|---|---|---|---|
| 75-76 | .lab-dashboard | gap: 16px; margin-bottom: 16px | var(--s16) |
| 96-98 | .lab-activity-panel | border-radius: 16px; padding: 16px; margin-bottom: 16px | var(--s16) |
| 110 | .lab-activity-panel__item | gap: 16px | var(--s16) |
| 114-116 | .lab-activity-panel__divider | width: 1px; margin: 0 16px | 1px 維持、margin→var(--s16) |
| 120-122 | .lab-activity-panel__icon | width: 40px; height: 40px; border-radius: 8px | var(--s40), var(--s8) |
| 132-133 | .lab-activity-panel__icon svg | width: 24px; height: 24px | var(--s24) |
| 143 | .lab-activity-panel__label | margin-bottom: 8px | var(--s8) |
| 173-180 | .lab-activity-overlay | border-radius: 16px; gap: 16px; padding: 8px 16px | var(--s16), var(--s8) |
| 197-202 | .lab-activity-overlay__btn | gap: 8px; padding: 8px 16px; border-radius: 8px | var(--s8), var(--s16) |
| 218-219 | .lab-activity-overlay__btn svg | width: 16px; height: 16px | var(--s16) |
| 264 | .lab-character | min-height: 96px | var(--sh96) |
| 456 | モーダル内文 | margin: 8px 0 0 0 | var(--s8) |

---

## 3. script.js（動的 HTML）

地図 InfoWindow・モーダル・ツールチップ等のテンプレート literals 内

| 行付近 | 用途 | 主な px 箇所 |
|---|---|---|
| 1104-1111 | マップ初期化エラー | padding: 24px; font-size: 18px/16px; margin-bottom: 8px |
| 2285, 2385, 2419 | InfoWindow スタイル | fontSize: "14px" |
| 2887-2920 | ルート案内パネル | padding: 16px; min-width: 240px; max-width: 280px; font-size: 16px/21px; margin, gap, border-radius 等 |
| 4034-4068 | マーカー InfoWindow | padding: 12px 16px; min-width: 150px; font-size: 11px/16px 等 |
| 4388-4412 | InfoWindow サブテキスト | font-size: 11px/12px |
| 4420-4476 | 詳細 InfoWindow | padding: 12px 16px; min-width: 160px; font-size: 11px/12px/16px 等 |

**注意**：JS 内のインラインスタイルは `var(--s16)` 等が使えるが、`:root` の CSS 変数は読み込まれる。ただし `calc()` や複雑な値は扱いに注意。

---

## 4. map.html

| 行 | 用途 | 値 |
|---|---|---|
| 115 | エラーオーバーレイ | padding: 24px |
| 120-122 | エラーメッセージ | font-size: 48px/16px; margin-bottom: 16px |

---

## 5. index.html

| 行 | 用途 | 値 |
|---|---|---|
| 153 | 免責文言 | margin: 0 0 8px 0 |
| 215 | 入力欄 | font-size: 16px !important |

---

## 6. 追加が必要な CSS 変数（:root + PC 上書き）

| 変数名 | スマホ(vw/vh) | PC(px) | 用途 |
|---|---|---|---|
| --s168 | 43vw | 168px | 小画面ポップアップ |
| --s180 | 46vw | 180px | 通貨ボタン |
| --s200 | 51vw（既存） | 200px | max-height 等 |
| --s228 | 58.5vw | 228px | カード幅 |
| --s240 | 61.5vw | 240px | パネル min-width |
| --s256 | 66vw | 256px | background-size 等 |
| --s500 | 128vw または min(500px,92vw) | 500px | モーダル max-width 汎用 |

※ `max-width: 500px` は `min(500px, 92vw)` で既に可変の箇所あり。統一方針要検討。

---

## 推奨実施順序

1. **style.css：高優先の max-width / padding / margin**（変数追加→置換）
2. **style.css：position（top/left等）の px**（影響範囲を確認してから）
3. **lab.html**（再表示する場合）
4. **script.js 動的 HTML**（テンプレートごとに置換）
5. **map.html / index.html**（個別対応）

---

## 注意点

- **Google Maps InfoWindow**（579-647行付近）は `.gm-style-iw` 等の Google 提供クラス。上書きは効くが、API 更新で変わる可能性あり。
- **script.js** の `fontSize: "14px"` 等は、`getComputedStyle` で取得した `var(--fs-14)` の解決値を渡す必要があり、現状の文字列のままだと CSS 変数は使えない。CSS クラスでフォントを指定し、JS ではクラス名だけ渡す方式に変更する必要あり。
- **letter-spacing: -8px**（6128行）は時刻表示の特殊レイアウト用。vw にすると幅によって letter-spacing が変わり、数字の重なり具合が崩れる可能性あり。
