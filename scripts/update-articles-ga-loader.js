#!/usr/bin/env node
/**
 * 記事HTMLのGAをga-loaderに置き換え
 * node scripts/update-articles-ga-loader.js
 */
const fs = require('fs');
const path = require('path');

const ARTICLES = path.join(__dirname, '..', 'articles');
const NEW_GA = '<script src="../js/ga-loader.js"></script>';

// gtagの2つのscriptタグを1つに置換（形式は様々なので複数パターン）
const OLD_GA_REGEX = /<script\s+async\s+src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-ERDSPE9CZM"><\/script>\s*<script>[\s\S]*?gtag\('config',\s*'G-ERDSPE9CZM'\)[^<]*<\/script>/g;

let count = 0;
for (const f of fs.readdirSync(ARTICLES)) {
  if (!f.endsWith('.html') || (!f.startsWith('note-') && !f.startsWith('tradingview'))) continue;
  const fp = path.join(ARTICLES, f);
  let c = fs.readFileSync(fp, 'utf8');
  if (!c.includes('googletagmanager.com/gtag')) continue;
  const before = c;
  c = c.replace(OLD_GA_REGEX, NEW_GA);
  if (c !== before) {
    fs.writeFileSync(fp, c);
    count++;
    console.log('Updated:', f);
  }
}
console.log('Done. Updated', count, 'files.');
