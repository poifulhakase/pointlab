# 言語切り替え・英語版 更新手順

## 実施済み

- ① リンク下に言語切り替えタグ（日本語 / English）を追加
- ② ブラウザ言語に基づいてタグを自動選択（`js/language-switcher.js`）
- ③ 英語版トップページ（`index-en.html`）作成
- ④ サンプル記事の英語版更新（nd0b5eba1a7d7, n383409929e89）
- ⑤ TradingView 記事に言語切り替えを追加

## 残りの記事を更新する場合

以下のコマンドで残りの記事に言語切り替えと英語コンテンツを一括適用できます。
プロジェクトの `pointlab` フォルダで実行してください。

```bash
node apply-updates.js
```

または Python の場合:

```bash
python scripts/update-articles.py
```

## 翻訳データ

`_en-translations.json` に英語タイトル・概要・カテゴリが格納されています。
