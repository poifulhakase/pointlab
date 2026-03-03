/**
 * note記事のハブページを生成するスクリプト
 * node scripts/generate-note-pages.js
 */
const fs = require('fs');
const path = require('path');

const articlesPath = path.join(__dirname, '..');
const dataPath = path.join(__dirname, '..', '_note-articles.json');
const articles = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const GA_SNIPPET = `    <script src="../js/ga-loader.js"></script>`;

function toTitleJa(tags, category) {
  if (tags.length >= 2) return `${tags[0]}・${tags[1]}｜${tags.slice(2, 4).join('・')}`;
  if (tags.length === 1) return `${tags[0]}｜${category}`;
  return `${category}｜ぽいんとらぼ`;
}

function toTitleEn(tags, category) {
  const catEn = { 'ポイ活': 'Points', '株式投資': 'Stocks', '副業': 'Side Jobs', '生き方': 'Lifestyle', 'その他': 'Other' };
  const c = catEn[category] || category;
  if (tags.length >= 2) return `${tags[0]} & ${tags[1]}｜${c}`;
  if (tags.length === 1) return `${tags[0]}｜${c}`;
  return `${c}｜PointLab`;
}

function toDescJa(tags) {
  if (tags.length) return `${tags.join('・')}について。noteで続きを読む。`;
  return 'ぽいんとらぼの記事。noteで続きを読む。';
}

function toDescEn(tags) {
  if (tags.length) return `About ${tags.join(', ')}. Read more on note.`;
  return 'PointLab article. Read more on note.';
}

function articlePageJa(a) {
  if (a.hub) return null;
  const noteUrl = `https://note.com/pointlab/n/${a.id}`;
  const title = toTitleJa(a.tags, a.category);
  const desc = toDescJa(a.tags);
  const tagsHtml = a.tags.map(t => `<span class="tag">#${t}</span>`).join('\n                ');
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (function(){var t=localStorage.getItem('pointlab_theme');var s=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t==='dark'||t==='light'?t:s);})();
    </script>
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preload" href="../css/base.css" as="style" />
${GA_SNIPPET}
    <title>${title}｜ぽいんとらぼ</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}｜ぽいんとらぼ" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://pointlab.vercel.app/articles/note-${a.id}.html" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="${noteUrl}" />
    <link rel="alternate" hreflang="ja" href="https://pointlab.vercel.app/articles/note-${a.id}.html" />
    <link rel="alternate" hreflang="en" href="https://pointlab.vercel.app/articles/note-${a.id}-en.html" />
    <link rel="alternate" hreflang="zh-Hant" href="https://pointlab.vercel.app/articles/note-${a.id}-en.html" />
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="../favicon-16x16.png" />
    <link rel="stylesheet" href="../css/base.css" />
    <link rel="stylesheet" href="../css/article.css" />
    <script src="../js/mobile-nav.js" defer></script>
  </head>
  <body>
    <div id="site-header-root"></div>
    <script src="../js/header-include.js"></script>

    <div class="layout-main">
      <main class="layout-content">
        <article>
          <header class="article-header">
            <p class="article-header__meta">${a.category}</p>
            <h1 class="article-header__title">${title}</h1>
            <p style="color:var(--color-text-muted);font-size:0.9rem;">※ 続きはnoteでお読みください</p>
          </header>

          <div class="article-body">
            <p>この記事の続きは、noteにて公開しています。</p>
            <div class="article-cta">
              <p class="article-cta__title">続きはnoteで！</p>
              <div class="article-cta__buttons">
                <a href="${noteUrl}" class="btn" target="_blank" rel="noopener noreferrer">noteで続きを読む</a>
              </div>
            </div>
            <div class="article-tags">
              <div class="tag-list">
                ${tagsHtml || '<span class="tag">#ぽいんとらぼ</span>'}
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>

    <footer class="site-footer">
      <div class="site-footer__inner">
        <p class="site-footer__copyright">© 2026 ぽいんとらぼ</p>
      </div>
    </footer>
  </body>
</html>`;
}

function articlePageEn(a) {
  if (a.hub) return null;
  const noteUrl = `https://note.com/pointlab/n/${a.id}`;
  const title = toTitleEn(a.tags, a.category);
  const desc = toDescEn(a.tags);
  const tagsHtml = a.tags.map(t => `<span class="tag">#${t}</span>`).join('\n                ');
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (function(){var t=localStorage.getItem('pointlab_theme');var s=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t==='dark'||t==='light'?t:s);})();
    </script>
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin />
    <link rel="preload" href="../css/base.css" as="style" />
${GA_SNIPPET}
    <title>${title}｜PointLab</title>
    <meta name="description" content="${desc}" />
    <meta property="og:title" content="${title}｜PointLab" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://pointlab.vercel.app/articles/note-${a.id}-en.html" />
    <meta property="og:image" content="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=630&fit=crop" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="${noteUrl}" />
    <link rel="alternate" hreflang="ja" href="https://pointlab.vercel.app/articles/note-${a.id}.html" />
    <link rel="alternate" hreflang="en" href="https://pointlab.vercel.app/articles/note-${a.id}-en.html" />
    <link rel="alternate" hreflang="zh-Hant" href="https://pointlab.vercel.app/articles/note-${a.id}-en.html" />
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="../favicon-16x16.png" />
    <link rel="stylesheet" href="../css/base.css" />
    <link rel="stylesheet" href="../css/article.css" />
    <script src="../js/mobile-nav.js" defer></script>
  </head>
  <body>
    <div id="site-header-root"></div>
    <script src="../js/header-include.js"></script>

    <div class="layout-main">
      <main class="layout-content">
        <article>
          <header class="article-header">
            <p class="article-header__meta">${a.category}</p>
            <h1 class="article-header__title">${title}</h1>
            <p style="color:var(--color-text-muted);font-size:0.9rem;">※ Read the rest on note</p>
          </header>

          <div class="article-body">
            <p>This article continues on note.</p>
            <div class="article-cta">
              <p class="article-cta__title">Continue on note!</p>
              <div class="article-cta__buttons">
                <a href="${noteUrl}" class="btn" target="_blank" rel="noopener noreferrer">Read on note</a>
              </div>
            </div>
            <div class="article-tags">
              <div class="tag-list">
                ${tagsHtml || '<span class="tag">#PointLab</span>'}
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>

    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__links">
          <a href="../privacy.html">Privacy Policy</a>
          <a href="../disclaimer.html">Disclaimer</a>
        </div>
        <p class="site-footer__copyright">© PointLab</p>
      </div>
    </footer>
  </body>
</html>`;
}

// 生成
const toGenerate = articles.filter(a => !a.hub);
toGenerate.forEach(a => {
  const ja = articlePageJa(a);
  const en = articlePageEn(a);
  if (ja) fs.writeFileSync(path.join(articlesPath, 'articles', `note-${a.id}.html`), ja);
  if (en) fs.writeFileSync(path.join(articlesPath, 'articles', `note-${a.id}-en.html`), en);
});

console.log(`Generated ${toGenerate.length * 2} note hub pages (${toGenerate.length} JA + ${toGenerate.length} EN)`);
