# SEO対策・重複コンテンツ回避の方針

## 重複コンテンツ回避

### canonical の設定
- **noteハブページ**：`rel="canonical"` で **noteのURL** を指定
- 検索エンジンに「正規（オリジナル）の記事はnote上にある」と伝える
- ハブページは導線用のランディングページとして扱う

### コンテンツの扱い
- ハブページには**noteの本文をコピーしない**
- ゲートウェイ用の短い説明文のみ（「本文はnoteで公開。下のボタンからお読みください」）
- noteで使っているタグはハブページには**表示しない**（独自コンテンツとして差別化）

### JSON-LD schema
- `mainEntityOfPage` にnoteの記事URLを指定
- ハブページが記事の「紹介ページ」であることを明示

---

## 独自SEO施策

### メタ情報
- **title**：カテゴリ＋「記事紹介」＋サイト名（例：楽天ポイントの自動化｜ポイ活記事紹介｜ぽいんとらぼ）
- **description**：ハブ独自の説明文（noteと重ならない表現）
- 各ページで**異なる** title / description を設定

### 構造化データ
- トップ：`WebSite` schema
- 記事ハブ：`WebPage` + `mainEntityOfPage`（note記事への参照）
- 完全版記事（tradingviewなど）：`BlogPosting` + canonical で note を正規URLに指定

### 内部リンク
- トップから各ハブへリンク
- サイドバーで記事一覧への導線を整理
