#!/usr/bin/env python3
"""Update article pages: add language switcher and enrich English content."""
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES_DIR = os.path.join(BASE, 'articles')
TRANSLATIONS_PATH = os.path.join(BASE, '_en-translations.json')

def get_note_ids():
    """Get all note article IDs from filenames."""
    ids = []
    for f in os.listdir(ARTICLES_DIR):
        m = re.match(r'note-(n[a-f0-9]+)(-en)?\.html$', f)
        if m and '-en' not in f:
            ids.append(m.group(1))
    return sorted(set(ids))

def add_lang_switcher_ja(content, article_id):
    """Add language switcher to Japanese article."""
    if 'lang-switcher' in content:
        return content
    # Minified or pretty
    old_pretty = '''      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">記事一覧</h3>
          <ul class="sidebar-list">
            <li><a href="../">全記事を見る</a></li>
          </ul>
        </div>
      </aside>'''
    old_mini = '<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">記事一覧</h3><ul class="sidebar-list"><li><a href="../">全記事を見る</a></li></ul></div></aside>'
    new_mini = '''<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">記事一覧</h3><ul class="sidebar-list"><li><a href="../">全記事を見る</a></li></ul></div><div class="sidebar-section"><h3 class="sidebar-section__title">言語</h3><div class="lang-switcher" data-lang="ja"><a href="note-{id}.html" class="lang-switcher__tag" data-lang="ja" aria-current="page">日本語</a><a href="note-{id}-en.html" class="lang-switcher__tag" data-lang="en">English</a></div></div></aside>'''.format(id=article_id)
    new_pretty = '''      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">記事一覧</h3>
          <ul class="sidebar-list">
            <li><a href="../">全記事を見る</a></li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">言語</h3>
          <div class="lang-switcher" data-lang="ja">
            <a href="note-{id}.html" class="lang-switcher__tag" data-lang="ja" aria-current="page">日本語</a>
            <a href="note-{id}-en.html" class="lang-switcher__tag" data-lang="en">English</a>
          </div>
        </div>
      </aside>'''.format(id=article_id)
    if old_mini in content:
        return content.replace(old_mini, new_mini)
    if old_pretty in content:
        return content.replace(old_pretty, new_pretty)
    return content

def add_lang_switcher_en(content, article_id):
    """Add language switcher to English article."""
    if 'lang-switcher' in content:
        return content
    old_mini = '<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">Articles</h3><ul class="sidebar-list"><li><a href="../">View all</a></li></ul></div></aside>'
    new_mini = '''<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">Articles</h3><ul class="sidebar-list"><li><a href="../index-en.html">View all</a></li></ul></div><div class="sidebar-section"><h3 class="sidebar-section__title">Language</h3><div class="lang-switcher" data-lang="en"><a href="note-{id}.html" class="lang-switcher__tag" data-lang="ja">日本語</a><a href="note-{id}-en.html" class="lang-switcher__tag" data-lang="en" aria-current="page">English</a></div></div></aside>'''.format(id=article_id)
    old_pretty = '''      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Articles</h3>
          <ul class="sidebar-list">
            <li><a href="../">View all</a></li>
          </ul>
        </div>
      </aside>'''
    new_pretty = '''      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Articles</h3>
          <ul class="sidebar-list">
            <li><a href="../index-en.html">View all</a></li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Language</h3>
          <div class="lang-switcher" data-lang="en">
            <a href="note-{id}.html" class="lang-switcher__tag" data-lang="ja">日本語</a>
            <a href="note-{id}-en.html" class="lang-switcher__tag" data-lang="en" aria-current="page">English</a>
          </div>
        </div>
      </aside>'''.format(id=article_id)
    if old_mini in content:
        return content.replace(old_mini, new_mini)
    if old_pretty in content:
        return content.replace(old_pretty, new_pretty)
    return content

def add_script(content):
    """Add language-switcher.js and mobile-nav.js to article head."""
    scripts = '<script src="../js/language-switcher.js" defer></script>\n    <script src="../js/mobile-nav.js" defer></script>'
    if 'language-switcher.js' in content and 'mobile-nav.js' in content:
        return content
    if 'language-switcher.js' in content and 'mobile-nav.js' not in content:
        return content.replace(
            '<script src="../js/language-switcher.js" defer></script>',
            scripts
        )
    # Handle both separate and combined link
    if '<link rel="stylesheet" href="../css/article.css" />' in content:
        return content.replace(
            '<link rel="stylesheet" href="../css/article.css" />',
            '<link rel="stylesheet" href="../css/article.css" />\n    ' + scripts
        )
    if 'href="../css/article.css"' in content and 'language-switcher' not in content:
        return content.replace(
            '<link rel="stylesheet" href="../css/base.css" /><link rel="stylesheet" href="../css/article.css" />',
            '<link rel="stylesheet" href="../css/base.css" /><link rel="stylesheet" href="../css/article.css" /><script src="../js/language-switcher.js" defer></script><script src="../js/mobile-nav.js" defer></script>'
        )
    return content

def escape_html(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('"', '&quot;')

def update_en_article(path, article_id, trans):
    """Update English article with translated content."""
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if article_id not in trans.get('articles', {}):
        return content
    t = trans['articles'][article_id]
    title_esc = escape_html(t['title'])
    excerpt_esc = escape_html(t['excerpt'])
    # Update title
    content = re.sub(r'<title>[^<]*</title>', '<title>{}｜PointLab</title>'.format(title_esc), content, count=1)
    # Update meta description
    content = re.sub(r'<meta name="description" content="[^"]*"', '<meta name="description" content="{}"'.format(excerpt_esc), content, count=1)
    # Update article header meta
    content = re.sub(r'<p class="article-header__meta">[^<]*</p>', '<p class="article-header__meta">{}</p>'.format(t['meta']), content, count=1)
    # Update h1
    content = re.sub(r'<h1 class="article-header__title">[^<]*</h1>', '<h1 class="article-header__title">{}</h1>'.format(title_esc), content, count=1)
    # Update excerpt under h1 (description line)
    content = re.sub(
        r'<p style="color:var\(--color-text-muted\);font-size:0\.9rem;">[^<]*</p>',
        '<p style="color:var(--color-text-muted);font-size:0.9rem;">{}</p>'.format(excerpt_esc),
        content, count=1
    )
    # Fix header/nav links to index-en
    content = content.replace(
        '<a href="../" class="site-logo">PointLab</a>',
        '<a href="../index-en.html" class="site-logo"><img src="../logo.svg" alt="PointLab" /></a>'
    )
    content = content.replace(
        '<a href="../index-en.html" class="site-logo">PointLab</a>',
        '<a href="../index-en.html" class="site-logo"><img src="../logo.svg" alt="PointLab" /></a>'
    )
    content = content.replace(
        '<li><a href="../">Articles</a></li>',
        '<li><a href="../index-en.html">Articles</a></li>'
    )
    return content

def main():
    with open(TRANSLATIONS_PATH, 'r', encoding='utf-8') as f:
        trans = json.load(f)
    ids = get_note_ids()
    for aid in ids:
        ja_path = os.path.join(ARTICLES_DIR, 'note-{}.html'.format(aid))
        en_path = os.path.join(ARTICLES_DIR, 'note-{}-en.html'.format(aid))
        if os.path.exists(ja_path):
            with open(ja_path, 'r', encoding='utf-8') as f:
                c = f.read()
            c = add_script(c)
            c = add_lang_switcher_ja(c, aid)
            with open(ja_path, 'w', encoding='utf-8') as f:
                f.write(c)
        if os.path.exists(en_path):
            with open(en_path, 'r', encoding='utf-8') as f:
                c = f.read()
            c = add_script(c)
            c = add_lang_switcher_en(c, aid)
            c = update_en_article(en_path, aid, trans)
            with open(en_path, 'w', encoding='utf-8') as f:
                f.write(c)
    print('Updated', len(ids), 'note article pairs')
    # TradingView
    for name, lang in [('tradingview-ja', 'ja'), ('tradingview-en', 'en')]:
        path = os.path.join(ARTICLES_DIR, '{}.html'.format(name))
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                c = f.read()
            if 'language-switcher.js' not in c:
                c = c.replace(
                    '<link rel="stylesheet" href="../css/article.css" />',
                    '<link rel="stylesheet" href="../css/article.css" />\n    <script src="../js/language-switcher.js" defer></script>'
                )
            if 'lang-switcher' not in c:
                heading = '言語' if lang == 'ja' else 'Language'
                ja_extra = ' aria-current="page"' if lang == 'ja' else ''
                en_extra = ' aria-current="page"' if lang == 'en' else ''
                block = '''        <div class="sidebar-section">
          <h3 class="sidebar-section__title">''' + heading + '''</h3>
          <div class="lang-switcher" data-lang="''' + lang + '''">
            <a href="tradingview-ja.html" class="lang-switcher__tag" data-lang="ja"''' + ja_extra + '''>日本語</a>
            <a href="tradingview-en.html" class="lang-switcher__tag" data-lang="en"''' + en_extra + '''>English</a>
          </div>
        </div>
      </aside>'''
                # Insert before the closing </aside> of layout-sidebar
                old = '''            <li><a href="./tradingview-en.html">TradingView Free vs Paid (EN)</a></li>
          </ul>
        </div>
      </aside>''' if lang == 'ja' else '''            <li><a href="./tradingview-ja.html">TradingView無料版 vs 有料版 (JA)</a></li>
          </ul>
        </div>
      </aside>'''
                new = old.replace('      </aside>', block)
                if old in c:
                    c = c.replace(old, new)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(c)
    print('Updated TradingView articles')

if __name__ == '__main__':
    main()
