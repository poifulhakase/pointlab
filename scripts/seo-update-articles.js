#!/usr/bin/env node
/**
 * SEO最適化: 記事ページの canonical, hreflang x-default, og:image を更新
 * 実行: node scripts/seo-update-articles.js (pointlab フォルダで)
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const ARTICLES = path.join(BASE, 'articles');
const SITE = 'https://pointlab.vercel.app';

function processFile(filepath) {
  let c = fs.readFileSync(filepath, 'utf8');
  const base = path.basename(filepath);
  const isEn = base.includes('-en.html');
  const rel = path.relative(BASE, path.dirname(filepath));
  const urlPath = rel ? `${SITE}/${rel.replace(/\\/g, '/')}/${base}` : `${SITE}/${base}`;

  // 1. canonical を自サイトに (note.com/medium.com → pointlab)
  c = c.replace(/<link rel="canonical" href="https:\/\/(note\.com|medium\.com)[^"]*" \/>/,
    `<link rel="canonical" href="${urlPath}" />`);

  // 2. hreflang x-default を追加
  if (!c.includes('hreflang="x-default"')) {
    const xdefaultHref = isEn ? `${SITE}/articles/${base.replace('-en.html', '.html')}` : urlPath;
    c = c.replace(/(<link rel="alternate" hreflang="en" href="[^"]*" \/>)/,
      `$1\n    <link rel="alternate" hreflang="x-default" href="${xdefaultHref}" />`);
  }

  // 3. og:image がない記事に追加
  if (!c.includes('og:image') && c.includes('og:type" content="article"')) {
    c = c.replace(/<meta property="og:type" content="article" \/>/,
      `<meta property="og:type" content="article" />\n    <meta property="og:image" content="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop" />`);
  }

  fs.writeFileSync(filepath, c);
}

// note-*.html と tradingview-*.html
for (const f of fs.readdirSync(ARTICLES)) {
  if ((f.startsWith('note-') || f.startsWith('tradingview')) && f.endsWith('.html')) {
    processFile(path.join(ARTICLES, f));
  }
}
console.log('SEO update done');
