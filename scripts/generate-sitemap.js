#!/usr/bin/env node
/** Generate sitemap.xml with all page URLs */
const fs = require('fs');
const path = require('path');

const BASE = 'https://pointlab.vercel.app';
const BASE_DIR = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(BASE_DIR, 'articles');
const POINAVI_DIR = path.join(BASE_DIR, 'poinavi');
const HAKASEAI_DIR = path.join(BASE_DIR, 'hakaseAI');
const POIROBO_DIR = path.join(BASE_DIR, 'poirobo');

// Collect note article IDs (ja only) and check which have -en
const noteIds = [];
const noteHasEn = new Set();
for (const f of fs.readdirSync(ARTICLES_DIR)) {
  const mEn = f.match(/^note-(n[a-f0-9]+)-en\.html$/);
  if (mEn) noteHasEn.add(mEn[1]);
  const mJa = f.match(/^note-(n[a-f0-9]+)\.html$/);
  if (mJa) noteIds.push(mJa[1]);
}
const uniqueNoteIds = [...new Set(noteIds)].sort();

// Static root pages with multi-lang
const rootPages = [
  { path: '/', loc: `${BASE}/`, en: `${BASE}/index-en.html`, zh: `${BASE}/index-zh.html`, freq: 'daily', priority: 1.0 },
  { path: '/index-en.html', loc: `${BASE}/index-en.html`, en: `${BASE}/index-en.html`, zh: `${BASE}/index-zh.html`, freq: 'daily', priority: 0.9 },
  { path: '/index-zh.html', loc: `${BASE}/index-zh.html`, en: `${BASE}/index-en.html`, zh: `${BASE}/index-zh.html`, freq: 'daily', priority: 0.9 },
];

// Single pages (no multi-lang)
const singlePages = [
  { path: '/contact.html', freq: 'yearly', priority: 0.6 },
  { path: '/service.html', freq: 'monthly', priority: 0.7 },
  { path: '/profile.html', freq: 'monthly', priority: 0.6 },
  { path: '/disclaimer.html', freq: 'yearly', priority: 0.5 },
  { path: '/privacy.html', freq: 'yearly', priority: 0.5 },
  { path: '/settings.html', freq: 'monthly', priority: 0.5 },
  { path: '/settings-en.html', freq: 'monthly', priority: 0.5 },
  { path: '/settings-zh.html', freq: 'monthly', priority: 0.5 },
];

// TradingView: ja, en, zh
const tradingViewPages = [
  { loc: 'tradingview-ja.html', ja: true, en: true, zh: true },
  { loc: 'tradingview-en.html', ja: true, en: true, zh: true },
  { loc: 'tradingview-zh.html', ja: true, en: true, zh: true },
];

function urlEntry(loc, hreflangs, changefreq, priority) {
  let links = '';
  for (const [lang, href] of Object.entries(hreflangs)) {
    links += `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`;
  }
  return `  <url>
    <loc>${loc}</loc>
${links}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
`;
}

function simpleUrl(loc, changefreq, priority) {
  return `  <url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>
`;
}

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

// Root multi-lang pages
for (const p of rootPages) {
  xml += urlEntry(p.loc, {
    ja: `${BASE}/`,
    en: p.en,
    'zh-Hant': p.zh,
    'x-default': `${BASE}/`,
  }, p.freq, p.priority);
}

// Single root pages
for (const p of singlePages) {
  xml += simpleUrl(`${BASE}${p.path}`, p.freq, p.priority);
}

// TradingView articles
const tvBase = `${BASE}/articles/`;
for (const p of tradingViewPages) {
  xml += urlEntry(`${tvBase}${p.loc}`, {
    ja: `${tvBase}tradingview-ja.html`,
    en: `${tvBase}tradingview-en.html`,
    'zh-Hant': `${tvBase}tradingview-zh.html`,
    'x-default': `${tvBase}tradingview-ja.html`,
  }, 'monthly', 0.8);
}

// Note articles (ja + en where exists)
for (const id of uniqueNoteIds) {
  const ja = `${BASE}/articles/note-${id}.html`;
  const en = `${BASE}/articles/note-${id}-en.html`;
  const hasEn = noteHasEn.has(id);

  const hreflangs = { ja, 'x-default': ja };
  if (hasEn) hreflangs.en = en;

  xml += urlEntry(ja, hreflangs, 'monthly', 0.8);
  if (hasEn) {
    xml += urlEntry(en, hreflangs, 'monthly', 0.8);
  }
}

// ぽいナビ
const poinaviUrls = [`${BASE}/poinavi/`, `${BASE}/poinavi/index.html`];
if (fs.existsSync(POINAVI_DIR)) {
  for (const f of fs.readdirSync(POINAVI_DIR)) {
    if (f.endsWith('.html') && f !== 'index.html') {
      poinaviUrls.push(`${BASE}/poinavi/${f}`);
    }
  }
}
for (const url of poinaviUrls) {
  xml += simpleUrl(url, 'weekly', 0.9);
}

// ハカセAI
if (fs.existsSync(path.join(HAKASEAI_DIR, 'index.html'))) {
  xml += simpleUrl(`${BASE}/hakaseAI/`, 'weekly', 0.8);
  xml += simpleUrl(`${BASE}/hakaseAI/index.html`, 'weekly', 0.8);
}

// ぽいらぼ
if (fs.existsSync(POIROBO_DIR)) {
  for (const f of fs.readdirSync(POIROBO_DIR)) {
    if (f.endsWith('.html')) {
      xml += simpleUrl(`${BASE}/poirobo/${f}`, 'monthly', 0.7);
    }
  }
}

xml += '</urlset>';

fs.writeFileSync(path.join(BASE_DIR, 'sitemap.xml'), xml, 'utf8');

const urlCount = (xml.match(/<url>/g) || []).length;
console.log('Generated sitemap.xml with', urlCount, 'URLs');
