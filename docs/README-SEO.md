# SEO構成メモ

## 実施済み

### トップページ (index.html / index-en.html)
- **canonical**: 自URL
- **hreflang**: ja, en, x-default（日本語をデフォルト）
- **og:image**, **og:locale**, **og:site_name**
- **JSON-LD**: WebSite + Organization
- **メタdescription**: キーワード最適化

### 記事ページ (noteハブ)
- **canonical**: note.com（正規URLはnote、ハブは導線用）
- **hreflang**: ja, en, x-default
- **JSON-LD**: WebPage + mainEntityOfPage（note記事への参照）
- **要点まとめ注釈**: 重複コンテンツ回避

### 記事ページ (TradingView)
- **canonical**: 自サイト（完全版記事）
- **hreflang**: x-default 追加
- **JSON-LD**: BlogPosting（url, mainEntityOfPage, inLanguage, breadcrumb）

### 共通
- **sitemap.xml**: トップ・固定ページ・記事
- **robots.txt**: Sitemap 指定
- **スキップリンク**: アクセシビリティ

## 重複コンテンツ対策（note記事一括）

```bash
cd pointlab && node scripts/fix-duplicate-content.js
```

## 画像の軽量化

```bash
cd pointlab && npm install sharp --save-dev && npm run optimize-images
```

## サイトマップの全URL生成

```bash
node scripts/generate-sitemap.js
```
