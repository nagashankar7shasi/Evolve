#!/usr/bin/env node
/*
 * Prerenders a crawlable copy of every custom page (custom_pages in Supabase) so search engines
 * can index them. Why this exists: the app is a hash-routed SPA (#/page/<slug>), and crawlers
 * ignore everything after the "#", so without this the whole site is one indexable URL.
 *
 * For each page this writes  p/<slug>/index.html  =  the real index.html shell, unchanged, plus:
 *   - a page-specific <title>, description, canonical, Open Graph / Twitter tags, JSON-LD
 *   - a visually hidden, static copy of the page's text and links inside <div id="seo-prerender">
 *     (paid pages: title + summary only, never the body)
 *   - one tiny inline script that opens the page the same way a #/page/ link would and then moves
 *     the address bar back to "/", so the app always runs from the root URL it was written for
 * It also rewrites sitemap.xml to list every page.
 *
 * Nothing here touches index.html, js/ or css/. The only things written are p/** and sitemap.xml.
 * It aborts before writing anything if the data looks wrong or index.html's <head> no longer has
 * the tags it rewrites, so a bad run can't blank out the existing pages.
 *
 * Usage:
 *   node scripts/prerender.js                         fetch from Supabase, write into the repo
 *   node scripts/prerender.js --from-file rows.json   use saved rows (raw custom_pages rows)
 *   node scripts/prerender.js --out-dir /tmp/out      write somewhere else (tests, dry runs)
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://evolveplus.in';
const COLUMNS = 'id,slug,title,is_gated,price,bundle_only,parent_id,icon,image,summary,content,order_num,published_at,old_slugs';

function fail(msg) {
  console.error('prerender: ' + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { fromFile: null, outDir: ROOT, template: path.join(ROOT, 'index.html') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from-file') out.fromFile = path.resolve(argv[++i]);
    else if (argv[i] === '--out-dir') out.outDir = path.resolve(argv[++i]);
    else if (argv[i] === '--template') out.template = path.resolve(argv[++i]);
    else fail('unknown argument ' + argv[i]);
  }
  return out;
}

// ---------------------------------------------------------------- data

// The URL and publishable key are already public in js/00_supabase_init.js (the browser needs
// them), so read them from there rather than keeping a second copy that could drift.
function supabaseConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'js', '00_supabase_init.js'), 'utf8');
  const url = (src.match(/const SUPABASE_URL = '([^']+)'/) || [])[1];
  const key = (src.match(/const SUPABASE_ANON_KEY = '([^']+)'/) || [])[1];
  if (!url || !key) fail('could not read SUPABASE_URL / SUPABASE_ANON_KEY from js/00_supabase_init.js');
  return { url, key };
}

async function fetchRows() {
  const { url, key } = supabaseConfig();
  const rows = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    // apikey only: the publishable key is not a JWT, so it must not be sent as a Bearer token.
    const res = await fetch(`${url}/rest/v1/custom_pages?select=${COLUMNS}&order=order_num.asc,id.asc`, {
      headers: { apikey: key, Range: `${from}-${from + size - 1}`, 'Range-Unit': 'items' }
    });
    if (!res.ok) fail(`Supabase returned HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) fail('unexpected Supabase response (not an array)');
    rows.push(...batch);
    if (batch.length < size) break;
  }
  return rows;
}

// Same field meanings as the client's mapping in js/02a_bundles.js.
function normalize(r) {
  return {
    id: r.id,
    ref: r.slug || r.id, // what pageLinkHash() uses
    title: (r.title || '').trim(),
    isGated: !!r.is_gated,
    price: Number(r.price) || 0,
    bundleOnly: !!r.bundle_only,
    parentId: r.parent_id || null,
    icon: r.icon || '',
    image: r.image || '',
    summary: (r.summary || '').trim(),
    content: r.content || '',
    order: r.order_num == null ? 0 : r.order_num,
    publishedAt: r.published_at || null,
    oldSlugs: Array.isArray(r.old_slugs) ? r.old_slugs : []
  };
}

const SAFE_REF = /^[A-Za-z0-9._~-]+$/;
const isSafeRef = ref => SAFE_REF.test(ref) && ref !== '.' && ref !== '..';

function buildModel(rawRows) {
  const pages = [];
  const seenRefs = new Set();
  const skipped = [];
  for (const raw of rawRows) {
    const p = normalize(raw);
    if (!p.id) { skipped.push('(row without id)'); continue; }
    if (!isSafeRef(p.ref)) { skipped.push(`${p.id}: slug "${p.ref}" is not a safe path segment`); continue; }
    if (seenRefs.has(p.ref)) { skipped.push(`${p.id}: duplicate slug "${p.ref}"`); continue; }
    seenRefs.add(p.ref);
    pages.push(p);
  }
  const byId = new Map(pages.map(p => [p.id, p]));
  const byRef = new Map();
  pages.forEach(p => byRef.set(p.ref, p));
  pages.forEach(p => p.oldSlugs.forEach(s => { if (!byRef.has(s)) byRef.set(s, p); }));

  // Mirrors findPage() in js/02_pricing_master_storage.js: id, current slug, then any old slug.
  const resolve = ref => byId.get(ref) || byRef.get(ref) || null;
  const childrenOf = id => pages
    .filter(p => p.parentId === id)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const ancestry = page => {
    const chain = [];
    const seen = new Set();
    for (let cur = page; cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : null) {
      chain.unshift(cur);
      seen.add(cur.id);
    }
    return chain;
  };
  // Mirrors isGatedPage() + lockingPageFor() with nobody entitled: locked if the page or any
  // page above it is paid. Locked pages never get their body written out.
  const isGated = p => p.isGated && (p.price > 0 || p.bundleOnly);
  const isLocked = page => ancestry(page).some(isGated);

  return { pages, byId, resolve, childrenOf, ancestry, isLocked, skipped };
}

// ---------------------------------------------------------------- text helpers

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escXml = escHtml;
const pagePath = p => `/p/${p.ref}/`;
const pageUrl = p => SITE + pagePath(p);

function absoluteUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return 'https:' + u;
  if (/^(data|javascript|blob):/i.test(u)) return '';
  return SITE + '/' + u.replace(/^\.?\/+/, '');
}

function truncate(text, max) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:\s-]+$/, '') + '…';
}

// ---------------------------------------------------------------- content

// Turns the admin-authored page HTML into a safe, static, crawlable copy. Not what visitors see
// (the app renders the live page itself); this only has to carry the text and the links.
function sanitizeContent(html, model) {
  const $ = cheerio.load(`<div id="root">${html}</div>`, null, false);
  const root = $('#root');

  // Scripts must never run from the static copy (the app inserts page HTML with innerHTML, where
  // they are inert; in real markup they would execute). Editor overlays are stripped by the app
  // too. Embeds/controls add nothing a crawler can read.
  root.find('script,style,iframe,object,embed,link,meta,form,button,input,textarea,select,noscript,video,audio,source,.kb-block-delete,.kb-block-move,.kb-img-handle').remove();

  // Page cards are placeholders the app fills in live; here they become plain links.
  root.find('.kb-pagelink[data-page]').each((_, el) => {
    const target = model.byId.get($(el).attr('data-page'));
    if (!target) { $(el).remove(); return; }
    $(el).replaceWith(`<p><a href="${escHtml(pagePath(target))}">${escHtml(target.title)}</a>${target.summary ? ' &mdash; ' + escHtml(target.summary) : ''}</p>`);
  });

  root.find('*').each((_, el) => {
    for (const name of Object.keys(el.attribs || {})) {
      if (/^on/i.test(name) || name.startsWith('data-') ||
          ['id', 'class', 'style', 'contenteditable', 'draggable', 'tabindex', 'role', 'srcdoc'].includes(name)) {
        $(el).removeAttr(name);
      }
    }
  });

  root.find('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (/^(javascript|data|vbscript):/i.test(href)) { $(el).removeAttr('href'); return; }
    if (href.startsWith('#/page/')) {
      let ref = href.slice('#/page/'.length).split(/[?#]/)[0];
      try { ref = decodeURIComponent(ref); } catch (_) { /* keep raw */ }
      const target = model.resolve(ref);
      if (target) $(el).attr('href', pagePath(target)); else $(el).removeAttr('href');
      return;
    }
    if (href.startsWith('#')) { $(el).removeAttr('href'); return; } // bundle/pdf/in-page routes: not crawlable targets
    if (/^(https?:|mailto:|tel:)/i.test(href) || href.startsWith('/')) return;
    $(el).attr('href', '/' + href.replace(/^\.?\/+/, '')); // relative -> root-relative (we live at /p/<slug>/)
  });

  root.find('img').each((_, el) => {
    const src = ($(el).attr('src') || '').trim();
    if (!src) { $(el).remove(); return; }
    if (!/^(https?:|data:|\/)/i.test(src)) $(el).attr('src', '/' + src.replace(/^\.?\/+/, ''));
    $(el).attr('loading', 'lazy');
    if ($(el).attr('alt') == null) $(el).attr('alt', '');
    $(el).removeAttr('srcset').removeAttr('sizes');
  });

  return root.html();
}

// Block-level tags become spaces first so adjacent paragraphs/cells/headings don't run together
// ("MeaningPublic administration..."); inline tags are left alone so "Paper <b>I</b>" stays intact.
function plainText(html) {
  const spaced = html.replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|tr|td|th|table|tbody|thead|br|blockquote|section|article|figure|figcaption|details|summary)\b[^>]*>/gi, ' ');
  return cheerio.load(`<div>${spaced}</div>`, null, false).root().text().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- one page

function replaceOnce(html, regex, replacement, label) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const matches = html.match(new RegExp(regex.source, flags));
  if (!matches || matches.length !== 1) {
    throw new Error(`index.html anchor "${label}" matched ${matches ? matches.length : 0} time(s), expected exactly 1 -- ` +
      `index.html's <head> changed; update scripts/prerender.js to match`);
  }
  // A function (not a string) so "$&"-style sequences in page titles/descriptions stay literal.
  return html.replace(regex, typeof replacement === 'function' ? replacement : () => replacement);
}

function renderPage(template, page, model) {
  const locked = model.isLocked(page);
  const title = page.title || 'Study resource';
  const cleaned = locked ? '' : sanitizeContent(page.content, model);
  const description = truncate(
    page.summary || (locked ? '' : plainText(cleaned)) || `${title} -- study material on Evolve+ for UPSC CSE, KPSC KAS, Karnataka PSI and FDA/SDA aspirants.`,
    158
  );
  const url = pageUrl(page);
  const pageTitle = `${title} | Evolve+`;
  const ogImage = absoluteUrl(page.image);
  const chain = model.ancestry(page);
  const kids = model.childrenOf(page.id);

  let html = template;
  const meta = (attr, name, value) => new RegExp(`<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/?>`);
  const metaTag = (attr, name, value) => `<meta ${attr}="${name}" content="${escHtml(value)}" />`;

  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escHtml(pageTitle)}</title>`, 'title');
  html = replaceOnce(html, meta('name', 'description'), metaTag('name', 'description', description), 'meta description');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escHtml(url)}" />`, 'canonical');
  html = replaceOnce(html, meta('property', 'og:type'), metaTag('property', 'og:type', 'article'), 'og:type');
  html = replaceOnce(html, meta('property', 'og:url'), metaTag('property', 'og:url', url), 'og:url');
  html = replaceOnce(html, meta('property', 'og:title'), metaTag('property', 'og:title', pageTitle), 'og:title');
  html = replaceOnce(html, meta('property', 'og:description'), metaTag('property', 'og:description', description), 'og:description');
  html = replaceOnce(html, meta('name', 'twitter:title'), metaTag('name', 'twitter:title', pageTitle), 'twitter:title');
  html = replaceOnce(html, meta('name', 'twitter:description'), metaTag('name', 'twitter:description', description), 'twitter:description');
  // Default share image is 1200x630; a page's own image has unknown dimensions, so drop the size tags.
  const imgW = meta('property', 'og:image:width');
  const imgH = meta('property', 'og:image:height');
  const imgOg = meta('property', 'og:image');
  const imgTw = meta('name', 'twitter:image');
  // validate anchors even when the default image is kept
  for (const [re, label] of [[imgW, 'og:image:width'], [imgH, 'og:image:height'], [imgOg, 'og:image'], [imgTw, 'twitter:image']]) {
    if ((html.match(new RegExp(re.source, 'g')) || []).length !== 1) {
      throw new Error(`index.html anchor "${label}" not found exactly once; update scripts/prerender.js`);
    }
  }
  if (ogImage) {
    html = html.replace(imgW, () => '').replace(imgH, () => '');
    html = html.replace(imgOg, () => metaTag('property', 'og:image', ogImage));
    html = html.replace(imgTw, () => metaTag('name', 'twitter:image', ogImage));
  }

  // The shell loads css/ and js/ relatively; from /p/<slug>/ that must be root-relative.
  const before = html;
  html = html.replace(/(\s(?:href|src)=")(css|js|assets)\//g, '$1/$2/');
  if (html === before) throw new Error('found no relative css/js/assets references in index.html to rewrite');
  const leftover = html.match(/\s(?:href|src)="(?:css|js|assets)\//g);
  if (leftover) throw new Error('relative asset references remain after rewrite');

  const bootScript =
`<script>
/* Prerendered entry point for /p/${page.ref}/ (see scripts/prerender.js). The app is hash-routed:
   open this page the way a #/page/ link would, then move the address bar to the app's own root
   URL. Everything path-relative in the app (admin-console.html fetch, assets/ images, auth
   redirectTo = origin + pathname, share-link building) assumes it is served from "/". */
(function () {
  try {
    var h = location.hash;
    if (!h || h === '#') h = '#/page/' + encodeURIComponent(${JSON.stringify(page.ref)});
    history.replaceState(null, '', '/' + location.search + h);
  } catch (e) {}
})();
</script>`;
  html = replaceOnce(html, /<meta charset="UTF-8"\s*\/?>/, m => m + '\n  ' + bootScript, 'charset');

  const crumbs = chain.map((p, i) => ({ '@type': 'ListItem', position: i + 2, name: p.title, item: pageUrl(p) }));
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: truncate(title, 110),
        description,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        inLanguage: 'en',
        isAccessibleForFree: !locked,
        ...(page.publishedAt && !isNaN(new Date(page.publishedAt)) ? { datePublished: new Date(page.publishedAt).toISOString() } : {}),
        ...(ogImage ? { image: ogImage } : {}),
        author: { '@type': 'Organization', name: 'Evolve+' },
        publisher: { '@type': 'Organization', name: 'Evolve+', logo: { '@type': 'ImageObject', url: SITE + '/og-image.png' } }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, ...crumbs]
      }
    ]
  };
  const ldJson = JSON.stringify(graph).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  html = replaceOnce(html, /<\/head>/, `  <script type="application/ld+json">${ldJson}</script>\n</head>`, '</head>');

  const crumbHtml = ['<a href="/">Home</a>']
    .concat(chain.slice(0, -1).map(p => `<a href="${escHtml(pagePath(p))}">${escHtml(p.title)}</a>`))
    .join(' &rsaquo; ');
  const kidsHtml = kids.length
    ? `<nav aria-label="Inside this section"><h2>Inside this section</h2><ul>${kids.map(k =>
        `<li><a href="${escHtml(pagePath(k))}">${escHtml(k.title)}</a>${k.summary ? ' &mdash; ' + escHtml(k.summary) : ''}</li>`).join('')}</ul></nav>`
    : '';
  const bodyHtml = locked
    ? `<p>This is paid study material on Evolve+. Open the page on the site to see how to unlock it.</p>`
    : cleaned;
  const article =
`<div id="seo-prerender" aria-hidden="true" style="position:absolute;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;">
<nav aria-label="Breadcrumb">${crumbHtml}</nav>
<article>
<h1>${escHtml(title)}</h1>
${page.summary ? `<p>${escHtml(page.summary)}</p>` : ''}
${bodyHtml}
</article>
${kidsHtml}
</div>`;
  const bodyTag = /<body\b[^>]*>/;
  if ((html.match(new RegExp(bodyTag.source, 'g')) || []).length !== 1) throw new Error('index.html anchor "<body>" not found exactly once');
  html = html.replace(bodyTag, m => m + '\n' + article);

  return { html, locked };
}

// ---------------------------------------------------------------- sitemap

function buildSitemap(model) {
  const dates = model.pages.map(p => p.publishedAt && new Date(p.publishedAt)).filter(d => d && !isNaN(d));
  const iso = d => d.toISOString().slice(0, 10);
  const latest = dates.length ? iso(new Date(Math.max(...dates))) : null;
  const entries = [{ loc: SITE + '/', lastmod: latest }];
  model.pages.forEach(p => {
    const d = p.publishedAt && new Date(p.publishedAt);
    entries.push({ loc: pageUrl(p), lastmod: d && !isNaN(d) ? iso(d) : null });
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(e => `  <url>\n    <loc>${escXml(e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}  </url>`).join('\n') +
    '\n</urlset>\n';
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const template = fs.readFileSync(args.template, 'utf8');
  const rawRows = args.fromFile ? JSON.parse(fs.readFileSync(args.fromFile, 'utf8')) : await fetchRows();
  if (!Array.isArray(rawRows) || rawRows.length === 0) fail('no pages returned -- refusing to overwrite the existing output with nothing');

  const model = buildModel(rawRows);
  if (model.pages.length === 0) fail('no usable pages after validation -- refusing to write');
  model.skipped.forEach(s => console.warn('prerender: skipped ' + s));

  // Render everything in memory first; only touch disk once every page succeeded.
  const files = new Map();
  let lockedCount = 0;
  for (const page of model.pages) {
    const { html, locked } = renderPage(template, page, model);
    if (locked) lockedCount++;
    files.set(path.join('p', page.ref, 'index.html'), html);
  }
  files.set('sitemap.xml', buildSitemap(model));

  fs.rmSync(path.join(args.outDir, 'p'), { recursive: true, force: true });
  for (const [rel, content] of files) {
    const dest = path.join(args.outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  console.log(`prerender: wrote ${model.pages.length} pages (${lockedCount} paid, summary only) + sitemap.xml to ${args.outDir}` +
    (model.skipped.length ? `; skipped ${model.skipped.length}` : ''));
}

if (require.main === module) main().catch(err => fail(err && err.stack ? err.stack : String(err)));

module.exports = { buildModel, renderPage, sanitizeContent, buildSitemap };
