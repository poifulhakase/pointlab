# -*- coding: utf-8 -*-
import os
import re

base = os.path.dirname(os.path.abspath(__file__))
articles_dir = os.path.join(base, '..', 'articles')
pattern = re.compile(
    r'<a href="https://note\.com/pointlab"[^>]*>note</a>'
    r'<a href="https://jp\.pinterest\.com/pointlab/"[^>]*>Pinterest</a>'
    r'<a href="https://medium\.com/@pointlab"[^>]*>Medium</a>',
    re.DOTALL
)

count = 0
for f in os.listdir(articles_dir):
    if not f.endswith('.html'):
        continue
    fp = os.path.join(articles_dir, f)
    with open(fp, 'r', encoding='utf-8') as file:
        content = file.read()
    new_content = pattern.sub('', content)
    if new_content != content:
        with open(fp, 'w', encoding='utf-8') as file:
            file.write(new_content)
        count += 1
        print(f'Updated: {f}')

print(f'Total: {count} files updated')
