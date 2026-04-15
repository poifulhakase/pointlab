# -*- coding: utf-8 -*-
import json
import os

base = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(base, '_note-articles.json'), 'r', encoding='utf-8') as f:
    articles = json.load(f)
content_ja = {}
_content_path = os.path.join(base, '_note-articles-content.json')
if os.path.exists(_content_path):
    with open(_content_path, 'r', encoding='utf-8') as f:
        content_ja = json.load(f)

GA = """    <script src="../js/ga-loader.js"></script>"""

def title_ja(tags, cat):
    if len(tags) >= 2: return f"{tags[0]}・{tags[1]}｜{'・'.join(tags[2:4])}"
    if tags: return f"{tags[0]}｜{cat}"
    return f"{cat}｜ぽいんとらぼ"

def title_en(tags, cat):
    ce = {'ポイ活':'Points','株式投資':'Stocks','副業':'Side Jobs','生き方':'Lifestyle','その他':'Other'}
    c = ce.get(cat, cat)
    if len(tags) >= 2: return f"{tags[0]} & {tags[1]}｜{c}"
    if tags: return f"{tags[0]}｜{c}"
    return f"{c}｜PointLab"

def desc_ja(tags):
    return f"{'・'.join(tags)}について。noteで続きを読む。" if tags else "ぽいんとらぼの記事。noteで続きを読む。"

def desc_en(tags):
    return f"About {', '.join(tags)}. Read more on note." if tags else "PointLab article. Read more on note."

def tags_html(tags, default='#ぽいんとらぼ'):
    if not tags: return f'<span class="tag">{default}</span>'
    return '\n                '.join(f'<span class="tag">#{t}</span>' for t in tags)

with open(os.path.join(base, '_en-translations.json'), 'r', encoding='utf-8') as f:
    trans = json.load(f)
content_en = trans.get('articles', {})

for a in articles:
    if a.get('hub'): continue
    aid, tags, cat = a['id'], a['tags'], a['category']
    url = f"https://note.com/pointlab/n/{aid}"
    hub_url = f"https://pointlab.vercel.app/articles/note-{aid}"
    _tja = content_ja.get(aid, {}).get('title') or title_ja(tags, cat)
    _ten = content_en.get(aid, {}).get('title') or title_en(tags, cat)
    _ja_suffix, _en_suffix = '｜ぽいんとらぼ', '｜PointLab'
    tja = _tja[:-len(_ja_suffix)] if _tja.endswith(_ja_suffix) else _tja
    ten = _ten[:-len(_en_suffix)] if _ten.endswith(_en_suffix) else _ten
    dja, den = desc_ja(tags), desc_en(tags)
    arts = os.path.join(base, 'articles')
    # JA
    ja = f'''<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
{GA}
    <title>{tja}｜ぽいんとらぼ</title>
    <meta name="description" content="{dja}" />
    <meta property="og:title" content="{tja}｜ぽいんとらぼ" />
    <meta property="og:description" content="{dja}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="{hub_url}.html" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{url}" />
    <link rel="alternate" hreflang="ja" href="{hub_url}.html" />
    <link rel="alternate" hreflang="en" href="{hub_url}-en.html" />
    <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
    <link rel="stylesheet" href="../css/base.css" />
    <link rel="stylesheet" href="../css/article.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a href="../" class="site-logo"><img src="../logo.svg" alt="ぽいんとらぼ" /></a>
        <nav><ul class="nav-list">
          <li><a href="../">ホーム</a></li>
          <li><a href="https://note.com/pointlab/n/n9f6f5df2d619" target="_blank" rel="noopener noreferrer">プロフィール</a></li>
          <li><a href="../contact.html">研究室への連絡</a></li>
        </ul></nav>
      </div>
    </header>
    <div class="layout-main">
      <main class="layout-content">
        <article>
          <header class="article-header">
            <p class="article-header__meta">{cat}</p>
            <h1 class="article-header__title">{tja}</h1>
            <p style="color:var(--color-text-muted);font-size:0.9rem;">※ 続きはnoteでお読みください</p>
          </header>
          <div class="article-body">
            <p>この記事の続きは、noteにて公開しています。</p>
            <div class="article-cta">
              <p class="article-cta__title">続きはnoteで！</p>
              <div class="article-cta__buttons">
                <a href="{url}" class="btn" target="_blank" rel="noopener noreferrer">noteで続きを読む</a>
              </div>
            </div>
            <div class="article-tags"><div class="tag-list">{tags_html(tags)}</div></div>
          </div>
        </article>
      </main>
      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">記事一覧</h3>
          <ul class="sidebar-list"><li><a href="../">全記事を見る</a></li></ul>
        </div>
      </aside>
    </div>
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__links">
          <a href="../privacy.html">プライバシーポリシー</a>
          <a href="../disclaimer.html">免責事項</a>
        </div>
        <p class="site-footer__copyright">© 2026 ぽいんとらぼ</p>
      </div>
    </footer>
  </body>
</html>'''
    with open(os.path.join(arts, f'note-{aid}.html'), 'w', encoding='utf-8') as f:
        f.write(ja)
    # EN
    en = f'''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
{GA}
    <title>{ten}｜PointLab</title>
    <meta name="description" content="{den}" />
    <meta property="og:title" content="{ten}｜PointLab" />
    <meta property="og:description" content="{den}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="{hub_url}-en.html" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="{url}" />
    <link rel="alternate" hreflang="ja" href="{hub_url}.html" />
    <link rel="alternate" hreflang="en" href="{hub_url}-en.html" />
    <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
    <link rel="stylesheet" href="../css/base.css" />
    <link rel="stylesheet" href="../css/article.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a href="../index-en.html" class="site-logo"><img src="../logo.svg" alt="PointLab" /></a>
        <nav><ul class="nav-list">
          <li><a href="../">Home</a></li>
          <li><a href="https://note.com/pointlab/n/n9f6f5df2d619" target="_blank" rel="noopener noreferrer">Profile</a></li>
          <li><a href="../contact.html">Contact</a></li>
        </ul></nav>
      </div>
    </header>
    <div class="layout-main">
      <main class="layout-content">
        <article>
          <header class="article-header">
            <p class="article-header__meta">{cat}</p>
            <h1 class="article-header__title">{ten}</h1>
            <p style="color:var(--color-text-muted);font-size:0.9rem;">※ Read the rest on note</p>
          </header>
          <div class="article-body">
            <p>This article continues on note.</p>
            <div class="article-cta">
              <p class="article-cta__title">Continue on note!</p>
              <div class="article-cta__buttons">
                <a href="{url}" class="btn" target="_blank" rel="noopener noreferrer">Read on note</a>
              </div>
            </div>
            <div class="article-tags"><div class="tag-list">{tags_html(tags, '#PointLab')}</div></div>
          </div>
        </article>
      </main>
      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Articles</h3>
          <ul class="sidebar-list"><li><a href="../">View all</a></li></ul>
        </div>
      </aside>
    </div>
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__links">
          <a href="../privacy.html">Privacy Policy</a>
          <a href="../disclaimer.html">Disclaimer</a>
        </div>
        <p class="site-footer__copyright">© 2026 ぽいんとらぼ</p>
      </div>
    </footer>
  </body>
</html>'''
    with open(os.path.join(arts, f'note-{aid}-en.html'), 'w', encoding='utf-8') as f:
        f.write(en)

print(f"Generated {len([a for a in articles if not a.get('hub')]) * 2} pages")
