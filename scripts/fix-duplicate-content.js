#!/usr/bin/env node
/**
 * 重複コンテンツ対策（SEO方針準拠）: canonicalをnoteに統一、nofollow付与、要点まとめ注釈
 * 正規URLはnote.com。ハブは導線用。実行: node scripts/fix-duplicate-content.js
 */
const fs = require('fs');
const path = require('path');

const ARTICLES = path.join(__dirname, '..', 'articles');
const SITE = 'https://pointlab.vercel.app';

function extractNoteId(filename) {
  const m = filename.match(/note-([a-z0-9]+)(?:-en)?\.html/);
  return m ? m[1] : null;
}

function processFile(filepath) {
  let c = fs.readFileSync(filepath, 'utf8');
  const base = path.basename(filepath);
  const isEn = base.includes('-en.html');
  const noteId = extractNoteId(base);
  if (!noteId) return false;

  const noteUrl = `https://note.com/pointlab/n/${noteId}`;
  const hubJa = `${SITE}/articles/note-${noteId}.html`;

  // 1. canonical を note.com に統一（正規URLはnote、ハブは導線用）
  c = c.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${noteUrl}" />`
  );

  // 2. hreflang は pointlab ハブURLを指定（言語切り替え用）
  const enBase = base.replace(/-en\.html$/, '.html').replace('.html', '-en.html');
  const enUrl = `${SITE}/articles/note-${noteId}-en.html`;
  c = c.replace(/<link rel="alternate" hreflang="ja" href="[^"]*"\s*\/?>/g, `<link rel="alternate" hreflang="ja" href="${hubJa}" />`);
  c = c.replace(/<link rel="alternate" hreflang="en" href="[^"]*"\s*\/?>/g, `<link rel="alternate" hreflang="en" href="${enUrl}" />`);
  c = c.replace(/<link rel="alternate" hreflang="x-default" href="[^"]*"\s*\/?>/g, `<link rel="alternate" hreflang="x-default" href="${hubJa}" />`);

  // 3. JSON-LD WebPage + mainEntityOfPage（まだない場合）
  if (!c.includes('mainEntityOfPage')) {
    const jsonLd = `{"@context":"https://schema.org","@type":"WebPage","name":"記事紹介ページ","mainEntityOfPage":{"@id":"${noteUrl}"}}`;
    c = c.replace(/(<script src="\.\.\/js\/ga-loader\.js"><\/script>)/, `$1\n    <script type="application/ld+json">${jsonLd}</script>`);
  }

  // 4. note/Medium への CTA リンクに nofollow 追加（まだない場合）
  c = c.replace(
    /<a href="https:\/\/(?:note\.com|medium\.com)[^"]*"[^>]*rel="noopener noreferrer"(?!\s+nofollow)[^>]*>/g,
    (m) => m.replace('rel="noopener noreferrer"', 'rel="noopener noreferrer nofollow"')
  );

  // 5. article-body 冒頭に要点まとめ注釈を追加（まだない場合）
  if (!c.includes('article-note') && !c.includes('要点をまとめた') && !c.includes('page is a summary')) {
    const introJa = '<p class="article-note" style="background:#f5f5f5;padding:0.75rem 1rem;border-radius:6px;font-size:0.9rem;margin-bottom:1rem;">本ページは要点をまとめた版です。詳細はnoteで全文公開中。</p>';
    const introEn = '<p class="article-note" style="background:#f5f5f5;padding:0.75rem 1rem;border-radius:6px;font-size:0.9rem;margin-bottom:1rem;">This page is a summary. Full article on note/Medium.</p>';
    const intro = isEn ? introEn : introJa;
    c = c.replace(/<div class="article-body">\s*<p>/g, `<div class="article-body">${intro}<p>`);
    c = c.replace(/<div class="article-body"><p>/g, `<div class="article-body">${intro}<p>`);
  }

  // 6. 重複 hreflang x-default を削除
  const xdefaultMatches = c.match(/<link rel="alternate" hreflang="x-default"[^>]*\/>/g);
  if (xdefaultMatches && xdefaultMatches.length > 1) {
    const first = xdefaultMatches[0];
    c = c.replace(/(<link rel="alternate" hreflang="x-default"[^>]*\/>\s*)+/g, `${first}\n    `);
  }

  fs.writeFileSync(filepath, c);
  return true;
}

let count = 0;
for (const f of fs.readdirSync(ARTICLES)) {
  if (f.startsWith('note-') && f.endsWith('.html') && extractNoteId(f)) {
    processFile(path.join(ARTICLES, f));
    count++;
  }
}
console.log(`Fixed ${count} articles`);
