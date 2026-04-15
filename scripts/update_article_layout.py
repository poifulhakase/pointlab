# -*- coding: utf-8 -*-
"""記事ページ：古いヘッダーを差し替え、右サイドバー削除"""
import re
import os

articles_dir = os.path.join(os.path.dirname(__file__), '..', 'articles')

for name in os.listdir(articles_dir):
    if not name.endswith('.html'):
        continue
    path = os.path.join(articles_dir, name)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    changed = False

    # 古いヘッダーを header-include に差し替え
    old_header = re.compile(
        r'<header class="site-header"><div class="site-header__inner">.*?</div></header>',
        re.DOTALL
    )
    if old_header.search(content):
        content = old_header.sub(
            '    <div id="site-header-root"></div>\n    <script src="../js/header-include.js"></script>',
            content
        )
        changed = True

    # 右サイドバー削除
    sidebar = re.compile(r'<aside class="layout-sidebar">.*?</aside>\s*', re.DOTALL)
    if sidebar.search(content):
        content = sidebar.sub('', content)
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        print('Updated:', name)

print('Done.')
