#!/usr/bin/env node
/**
 * 記事ページのタイトルを一意にする（GA4で記事別に識別するため）
 * _note-articles-content.json / _en-translations.json の title を使用
 * node scripts/update-article-titles.js
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(BASE, 'articles');

const contentJa = JSON.parse(fs.readFileSync(path.join(BASE, '_note-articles-content.json'), 'utf8'));
const contentEn = JSON.parse(fs.readFileSync(path.join(BASE, '_en-translations.json'), 'utf8')).articles;
const articles = JSON.parse(fs.readFileSync(path.join(BASE, '_note-articles.json'), 'utf8'));

function toTitleJaFallback(tags, category) {
  if (tags.length >= 2) return `${tags[0]}・${tags[1]}｜${tags.slice(2, 4).join('・')}`;
  if (tags.length === 1) return `${tags[0]}｜${category}`;
  return `${category}｜ぽいんとらぼ`;
}

function toTitleEnFallback(tags, category) {
  const catEn = { 'ポイ活': 'Points', '株式投資': 'Stocks', '副業': 'Side Jobs', '生き方': 'Lifestyle', 'その他': 'Other', '節税': 'Tax Savings', 'ツール': 'Tools' };
  const c = catEn[category] || category;
  if (tags.length >= 2) return `${tags[0]} & ${tags[1]}｜${c}`;
  if (tags.length === 1) return `${tags[0]}｜${c}`;
  return `${c}｜PointLab`;
}

function getTitle(articleId, lang) {
  if (lang === 'ja') {
    const c = contentJa[articleId];
    if (c?.title) return c.title;
    const a = articles.find((x) => x.id === articleId);
    return a ? toTitleJaFallback(a.tags || [], a.category) : null;
  }
  const c = contentEn[articleId];
  if (c?.title) return c.title;
  const a = articles.find((x) => x.id === articleId);
  return a ? toTitleEnFallback(a.tags || [], a.category) : null;
}

const JA_SUFFIX = '｜ぽいんとらぼ';
const EN_SUFFIX = '｜PointLab';

let updated = 0;
const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.startsWith('note-') && f.endsWith('.html'));

for (const file of files) {
  const m = file.match(/^note-(n[a-z0-9]+)(-en)?\.html$/);
  if (!m) continue;

  const articleId = m[1];
  const isEn = !!m[2];
  const lang = isEn ? 'en' : 'ja';

  const baseTitle = getTitle(articleId, lang);
  if (!baseTitle) continue;

  const fullTitle =
    lang === 'ja'
      ? baseTitle.endsWith(JA_SUFFIX)
        ? baseTitle
        : baseTitle + JA_SUFFIX
      : baseTitle.endsWith(EN_SUFFIX)
        ? baseTitle
        : baseTitle + EN_SUFFIX;
  const safeTitle = fullTitle.replace(/\|/g, '｜');

  const filepath = path.join(ARTICLES_DIR, file);
  let content = fs.readFileSync(filepath, 'utf8');

  const titleRe = /<title>[^<]*<\/title>/;
  const ogTitleRe = /<meta property="og:title" content="[^"]*"\s*\/?>/;

  const newTitleTag = `<title>${safeTitle}</title>`;
  const newOgTitle = `<meta property="og:title" content="${safeTitle}" />`;

  let changed = false;
  if (titleRe.test(content) && !content.includes(`<title>${safeTitle}</title>`)) {
    content = content.replace(titleRe, newTitleTag);
    changed = true;
  }
  if (ogTitleRe.test(content) && !content.includes(`og:title" content="${safeTitle}"`)) {
    content = content.replace(ogTitleRe, newOgTitle);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filepath, content);
    updated++;
    console.log('Updated:', file, '→', safeTitle);
  }
}

console.log('Done. Updated', updated, 'files.');
