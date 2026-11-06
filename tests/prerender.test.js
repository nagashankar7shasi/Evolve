// Tests for scripts/prerender.js (crawlable /p/<slug>/ pages). Two halves:
//   1. Static: run the generator on tests/fixtures/prerender-pages.json against the REAL index.html
//      and check what it writes -- SEO tags, link rewriting, sanitising, paid pages never leaking
//      their body, and that it refuses to run (leaving existing output alone) if index.html's
//      <head> drifts away from what it rewrites.
//   2. Browser: serve the generated pages the way GitHub Pages would and check the real app boots
//      from /p/<slug>/ into the right page, with the address bar normalised to "/" so every
//      path-relative thing in the app (admin-console.html fetch, assets/, auth redirects) works.
//
// Usage: node tests/prerender.test.js      (PLAYWRIGHT_EXECUTABLE_PATH optional, like tests/run.js)

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'prerender.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'prerender-pages.json');

const results = [];
const ok = (name, pass, detail) => results.push({ name, pass: !!pass, detail: pass ? undefined : detail });
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });

function runGenerator(extraArgs, outDir) {
  try {
    const stdout = execFileSync('node', [SCRIPT, '--out-dir', outDir, ...extraArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ''), stderr: String(e.stderr || '') };
  }
}
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));

function staticChecks(out) {
  const slugs = ['public-administration-notes', 'what-is-public-administration', 'premium-handbook', 'premium-handbook-chapter-1', 'gate-flag-but-free', 'p_no_slug'];
  slugs.forEach(s => ok(`static: p/${s}/index.html written`, exists(out, `p/${s}/index.html`)));
  ok('static: unsafe slug skipped', !exists(out, 'p/has') && !exists(out, 'p/has/slash'));

  const sitemap = read(out, 'sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  eq('static: sitemap lists home + every written page', locs, [
    'https://evolveplus.in/',
    ...['public-administration-notes', 'what-is-public-administration', 'premium-handbook', 'premium-handbook-chapter-1', 'gate-flag-but-free', 'p_no_slug']
      .map(s => `https://evolveplus.in/p/${s}/`)
  ]);

  // ---- a normal page
  const html = read(out, 'p/what-is-public-administration/index.html');
  const $ = cheerio.load(html);
  const expectedTitle = 'What is Public Administration? Wilson\'s "Vision" & Scope $& more | Evolve+';
  eq('static: <title> replaced (specials and "$&" kept literal)', $('title').text(), expectedTitle);
  eq('static: exactly one <title>', $('title').length, 1);
  eq('static: canonical', $('link[rel=canonical]').attr('href'), 'https://evolveplus.in/p/what-is-public-administration/');
  eq('static: exactly one canonical', $('link[rel=canonical]').length, 1);
  eq('static: og:url', $('meta[property="og:url"]').attr('content'), 'https://evolveplus.in/p/what-is-public-administration/');
  eq('static: og:type', $('meta[property="og:type"]').attr('content'), 'article');
  eq('static: og:title', $('meta[property="og:title"]').attr('content'), expectedTitle);
  eq('static: twitter:title', $('meta[name="twitter:title"]').attr('content'), expectedTitle);
  const desc = $('meta[name="description"]').attr('content');
  ok('static: description built from content, words not run together', /Meaning Public administration is the implementation of public policy\./.test(desc), desc);
  eq('static: og:description matches description', $('meta[property="og:description"]').attr('content'), desc);
  eq('static: default share image kept when page has none', $('meta[property="og:image"]').attr('content'), 'https://evolveplus.in/og-image.png');
  eq('static: default image size tags kept', [$('meta[property="og:image:width"]').length, $('meta[property="og:image:height"]').length], [1, 1]);

  const ld = $('script[type="application/ld+json"]').toArray().map(el => JSON.parse($(el).contents().text()));
  eq('static: site-level JSON-LD kept + one page graph added', ld.length, 2);
  eq('static: site JSON-LD untouched', ld[0]['@type'], 'EducationalOrganization');
  const article = ld[1]['@graph'].find(n => n['@type'] === 'Article');
  const crumbs = ld[1]['@graph'].find(n => n['@type'] === 'BreadcrumbList');
  eq('static: Article url', article.url, 'https://evolveplus.in/p/what-is-public-administration/');
  eq('static: Article is free', article.isAccessibleForFree, true);
  eq('static: Article datePublished', article.datePublished, '2026-10-21T06:41:00.000Z');
  eq('static: breadcrumb trail', crumbs.itemListElement.map(i => i.name), ['Home', 'Public Administration Notes', 'What is Public Administration? Wilson\'s "Vision" & Scope $& more']);

  const bootIdx = html.indexOf('history.replaceState(null, \'\', \'/\' + location.search + h)');
  ok('static: boot script present, names this page', bootIdx > 0 && html.includes('encodeURIComponent("what-is-public-administration")'));
  ok('static: boot script runs before any stylesheet/app script', bootIdx > 0 && bootIdx < html.indexOf('/css/tailwind.css') && bootIdx < html.indexOf('/js/00_supabase_init.js'));
  ok('static: css/js made root-relative', html.includes('href="/css/main.css?v=') && html.includes('src="/js/00_supabase_init.js?v='));
  ok('static: no path-relative css/js/assets references left', !/\s(?:href|src)="(?:css|js|assets)\//.test(html));
  ok('static: app markup still present (view-custom-page, page-children-grid)', html.includes('id="view-custom-page"') && html.includes('id="page-children-grid"'));

  const pre = $('#seo-prerender');
  eq('static: hidden prerender block present once', pre.length, 1);
  eq('static: h1 is the page title', pre.find('h1').text(), 'What is Public Administration? Wilson\'s "Vision" & Scope $& more');
  eq('static: breadcrumb links', pre.find('nav[aria-label=Breadcrumb] a').toArray().map(a => $(a).attr('href')), ['/', '/p/public-administration-notes/']);
  ok('static: body text present', pre.text().includes('Public administration is the implementation of public policy.'));
  ok('static: no script/iframe/onclick/javascript: in static copy', pre.find('script,iframe').length === 0 && !/onclick|javascript:/i.test(pre.html()));
  ok('static: no ids/styles/classes leaked from authored HTML', pre.find('article [id],article [style],article [class]').length === 0);
  eq('static: relative image made root-relative + lazy', [pre.find('img').eq(0).attr('src'), pre.find('img').eq(0).attr('loading')], ['/assets/upsc/diagram.png', 'lazy']);
  eq('static: relative link made root-relative', pre.find('a[href="/notes/extra.html"]').length, 1);
  eq('static: external link kept', pre.find('a[href="https://example.org/"]').length, 1);
  eq('static: bundle/javascript links lose their href', pre.find('a:not([href])').length, 2);

  // ---- root page: link rewriting, page card, own image, children list
  const rootHtml = read(out, 'p/public-administration-notes/index.html');
  const $r = cheerio.load(rootHtml);
  const rootPre = $r('#seo-prerender');
  eq('static: old-slug + id links rewritten to current /p/ URLs',
    rootPre.find('article a[href^="/p/"]').toArray().map(a => $r(a).attr('href')),
    ['/p/public-administration-notes/', '/p/what-is-public-administration/', '/p/what-is-public-administration/']);
  eq('static: dead #/page link loses href', rootPre.find('article a:not([href])').text(), 'dead link');
  ok('static: page-card placeholder became a plain link, editor button gone', rootPre.find('button,.kb-block-delete').length === 0);
  eq('static: page image becomes og:image', $r('meta[property="og:image"]').attr('content'), 'https://example.com/cover.jpg');
  eq('static: default size tags dropped for a custom image', [$r('meta[property="og:image:width"]').length, $r('meta[property="og:image:height"]').length], [0, 0]);
  eq('static: children listed', rootPre.find('nav[aria-label="Inside this section"] a').attr('href'), '/p/what-is-public-administration/');

  // ---- paid pages never leak their body (own flag, and inherited from a paid parent)
  let leaked = false;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (/SECRET-/.test(fs.readFileSync(f, 'utf8'))) leaked = true;
  });
  walk(out);
  ok('static: paid / inherited-paid body text appears nowhere in the output', !leaked);
  for (const s of ['premium-handbook', 'premium-handbook-chapter-1']) {
    const $p = cheerio.load(read(out, `p/${s}/index.html`));
    ok(`static: ${s} shows only the locked notice`, $p('#seo-prerender article').text().includes('paid study material'), $p('#seo-prerender').text());
    const g = JSON.parse($p('script[type="application/ld+json"]').last().contents().text())['@graph'].find(n => n['@type'] === 'Article');
    eq(`static: ${s} marked not free in JSON-LD`, g.isAccessibleForFree, false);
  }
  eq('static: paid page keeps its public summary', cheerio.load(read(out, 'p/premium-handbook/index.html'))('meta[name=description]').attr('content'), 'Paid handbook, summary is public.');
  ok('static: is_gated with price 0 is open (same rule as the app)', read(out, 'p/gate-flag-but-free/index.html').includes('is_gated is set but price is 0'));
  eq('static: empty slug falls back to id', cheerio.load(read(out, 'p/p_no_slug/index.html'))('link[rel=canonical]').attr('href'), 'https://evolveplus.in/p/p_no_slug/');
}


function installableAppChecks() {
  // The app must stay installable: a real manifest FILE (Chrome ignores data: manifests), PNG icons
  // of the sizes it requires, and root-relative links so /p/<slug>/ pages share the same head.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok('pwa: index.html links the manifest file, root-relative', /<link rel="manifest" href="\/manifest\.webmanifest"/.test(html));
  ok('pwa: no inline data: manifest left in index.html', !/rel="manifest" href=['"]data:/.test(html));
  ok('pwa: apple-touch-icon is a real PNG file', /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png(\?v=\d+)?"/.test(html));
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')); } catch (e) { m = null; }
  ok('pwa: manifest.webmanifest is valid JSON', !!m);
  if (!m) return;
  eq('pwa: manifest start_url / scope / display', [m.start_url, m.scope, m.display], ['/', '/', 'standalone']);
  ok('pwa: manifest has name and short_name', !!m.name && !!m.short_name);
  const png = f => { const b = fs.readFileSync(path.join(ROOT, f.replace(/^\//, '').split('?')[0])); return b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
  for (const [size, purpose] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
    const icon = (m.icons || []).find(i => i.sizes === `${size}x${size}` && i.purpose === purpose);
    ok(`pwa: manifest declares a ${size}px ${purpose} icon`, !!icon);
    if (icon) { let dim = null; try { dim = png(icon.src); } catch (e) {} eq(`pwa: ${icon.src} is a real ${size}x${size} PNG`, dim, [size, size]); }
  }
  let ap = null; try { ap = png('/icons/apple-touch-icon.png'); } catch (e) {}
  eq('pwa: apple-touch-icon.png is 180x180', ap, [180, 180]);
  const stage = fs.readFileSync(path.join(ROOT, 'deploy', 'stage-site.sh'), 'utf8');
  ok('pwa: deploy stages the manifest and icons', /manifest\.webmanifest/.test(stage) && /\bicons\b/.test(stage));
}

function driftGuardChecks() {
  // If index.html's <head> loses a tag the generator rewrites, it must fail loudly and leave any
  // existing output exactly as it was -- never half-write or wipe the site's crawlable pages.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-drift-'));
  const brokenTemplate = path.join(tmp, 'index.html');
  fs.writeFileSync(brokenTemplate, fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<link rel="canonical"[^>]*>/, ''));
  const out = path.join(tmp, 'out');
  fs.mkdirSync(path.join(out, 'p', 'existing'), { recursive: true });
  fs.writeFileSync(path.join(out, 'p', 'existing', 'index.html'), 'keep me');
  const r = runGenerator(['--from-file', FIXTURE, '--template', brokenTemplate], out);
  ok('drift: generator exits non-zero when a head anchor is missing', r.code !== 0, r);
  ok('drift: error names the missing anchor', /canonical/.test(r.stderr || ''), r.stderr);
  ok('drift: existing output left untouched', exists(out, 'p/existing/index.html') && read(out, 'p/existing/index.html') === 'keep me' && !exists(out, 'sitemap.xml'));

  const empty = path.join(tmp, 'empty.json');
  fs.writeFileSync(empty, '[]');
  const r2 = runGenerator(['--from-file', empty], out);
  ok('drift: refuses to run on zero pages (so a bad fetch cannot blank the site)', r2.code !== 0 && exists(out, 'p/existing/index.html'), r2);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------- browser half

function startServer(dir) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(dir, p);
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); // GitHub Pages behaviour
    fs.readFile(file, (err, data) => {
      if (err) { // GitHub Pages behaviour: any missing path gets 404.html, with a 404 status
        return fs.readFile(path.join(dir, '404.html'), (e2, page) => { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(e2 ? 'not found' : page); });
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

async function browserChecks(out) {
  // Stage a site folder shaped like the repo root: the generated p/ plus the real css/js/assets/admin-console.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-site-'));
  fs.cpSync(path.join(out, 'p'), path.join(stage, 'p'), { recursive: true });
  for (const name of ['css', 'js', 'assets']) if (fs.existsSync(path.join(ROOT, name))) fs.cpSync(path.join(ROOT, name), path.join(stage, name), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'admin-console.html'), path.join(stage, 'admin-console.html'));
  fs.copyFileSync(path.join(ROOT, '404.html'), path.join(stage, '404.html'));
  const { server, base } = await startServer(stage);

  const vendor = path.join(__dirname, 'harness', 'vendor');
  const seeded = [
    { id: 'p_root', slug: 'public-administration-notes', title: 'Public Administration Notes', isGated: false, price: 0, content: '<p>Root body text</p>', parentId: null, icon: '📚', image: '', summary: 'Root summary', childStyle: 'tiles', order: 1, showOnHome: false, bundleOnly: false, oldSlugs: [], allowPdfDownload: true },
    { id: 'p_child', slug: 'what-is-public-administration', title: 'What is Public Administration', isGated: false, price: 0, content: '<p>Child body text</p>', parentId: 'p_root', icon: '📄', image: '', summary: '', childStyle: 'tiles', order: 1, showOnHome: false, bundleOnly: false, oldSlugs: [], allowPdfDownload: true }
  ];

  const launch = process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {};
  const browser = await chromium.launch(launch);
  const newPage = async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(pages => { try { localStorage.setItem('kas_custom_pages', JSON.stringify(pages)); } catch (_) {} }, seeded);
    // Third-party scripts are swapped for the same stubs the regression harness uses; everything else
    // (fonts, analytics) is dropped. The generated HTML itself is served byte-for-byte.
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(base)) return route.continue();
      if (/PapaParse/i.test(u)) return route.fulfill({ path: path.join(vendor, 'stubs.js'), contentType: 'application/javascript' });
      if (/pdf-lib/i.test(u)) return route.fulfill({ body: '', contentType: 'application/javascript' });
      if (/supabase-js/i.test(u)) return route.fulfill({ path: path.join(vendor, 'supabase.js'), contentType: 'application/javascript' });
      return route.abort();
    });
    return { page, errors };
  };
  const titleShown = (page, text) => page.waitForFunction(t => (document.getElementById('page-render-title') || {}).innerText?.includes(t), text, { timeout: 15000 });

  try {
    // A. opening /p/<slug>/ boots the app straight into that page, address bar normalised to "/"
    {
      const { page, errors } = await newPage();
      await page.goto(`${base}/p/public-administration-notes/`);
      await titleShown(page, 'Public Administration Notes');
      const s = await page.evaluate(() => ({
        path: location.pathname, hash: location.hash,
        customVisible: !document.getElementById('view-custom-page').classList.contains('hidden'),
        homeHidden: document.getElementById('view-home').classList.contains('hidden'),
        content: document.getElementById('page-render-content').innerText,
        childrenVisible: !document.getElementById('page-children').classList.contains('hidden'),
        childTile: document.getElementById('page-children-grid').innerText,
        hiddenH1: (document.querySelector('#seo-prerender h1') || {}).textContent,
        scrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
        resolvesAssets: new URL('assets/x.png', document.baseURI).pathname,
      }));
      eq('browser: address bar normalised to "/"', s.path, '/');
      eq('browser: hash routes to the page', s.hash, '#/page/public-administration-notes');
      ok('browser: custom-page view shown, home hidden', s.customVisible && s.homeHidden, s);
      ok('browser: live page content rendered by the app', s.content.includes('Root body text'), s.content);
      ok('browser: "Inside this section" grid still rendered', s.childrenVisible && s.childTile.includes('What is Public Administration'), s);
      eq('browser: hidden SEO copy is in the DOM', s.hiddenH1, 'Public Administration Notes');
      ok('browser: hidden SEO copy adds no horizontal scroll', !s.scrollsSideways);
      eq('browser: relative assets/ resolve against the site root', s.resolvesAssets, '/assets/x.png');
      const adminFetch = await page.evaluate(async () => (await fetch('admin-console.html?v=test')).status);
      eq('browser: relative admin-console.html fetch resolves to the real file', adminFetch, 200);
      // leaving the page works as before
      await page.evaluate(() => navigate('home'));
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ path: location.pathname, customHidden: document.getElementById('view-custom-page').classList.contains('hidden'), homeShown: !document.getElementById('view-home').classList.contains('hidden') }));
      ok('browser: navigate("home") still works from a prerendered entry', after.path === '/' && after.customHidden && after.homeShown, after);
      // in-app navigation to a child page keeps the root-based URL (no stale /p/... path)
      await page.evaluate(() => renderDynamicCustomPage('what-is-public-administration'));
      await titleShown(page, 'What is Public Administration');
      eq('browser: in-app navigation stays on root-based URL', await page.evaluate(() => location.pathname + location.hash), '/#/page/what-is-public-administration');
      eq('browser: no uncaught JS errors', errors, []);
      await page.close();
    }
    // B. query string survives; an explicit hash wins over the default
    {
      const { page, errors } = await newPage();
      await page.goto(`${base}/p/public-administration-notes/?utm_source=telegram#/page/what-is-public-administration`);
      await titleShown(page, 'What is Public Administration');
      eq('browser: ?query and explicit #/page hash preserved', await page.evaluate(() => location.pathname + location.search + location.hash), '/?utm_source=telegram#/page/what-is-public-administration');
      eq('browser: no uncaught JS errors (explicit hash)', errors, []);
      await page.close();
    }
    // D. 404.html: a /p/<slug>/ with no generated copy (page created since the last run) still opens in the app
    {
      const { page } = await newPage();
      await page.goto(`${base}/p/not-generated-yet/?utm=1`);
      await page.waitForFunction(() => location.pathname === '/' && location.hash, null, { timeout: 15000 });
      eq('browser: ungenerated /p/ link is forwarded into the app', await page.evaluate(() => location.pathname + location.search + location.hash), '/?utm=1#/page/not-generated-yet');
      await page.goto(`${base}/some/other/missing/path`);
      eq('browser: other missing URLs show the not-found message', await page.evaluate(() => [location.pathname, document.querySelector('h1').textContent]), ['/some/other/missing/path', 'Page not found']);
      await page.close();
    }
    // C. a paid page opened from /p/ goes through the app's own paywall UI, not the static copy
    {
      const gated = { id: 'p_paid', slug: 'premium-handbook', title: 'Premium Handbook', isGated: true, price: 499, content: '<p>REAL-PAID-BODY</p>', parentId: null, icon: '🔒', image: '', summary: 'Paid handbook, summary is public.', childStyle: 'tiles', order: 2, showOnHome: false, bundleOnly: false, oldSlugs: [], allowPdfDownload: true };
      const { page, errors } = await newPage();
      await page.addInitScript(g => { const pages = JSON.parse(localStorage.getItem('kas_custom_pages') || '[]'); pages.push(g); localStorage.setItem('kas_custom_pages', JSON.stringify(pages)); }, gated);
      await page.goto(`${base}/p/premium-handbook/`);
      await titleShown(page, 'Premium Handbook');
      const g = await page.evaluate(() => ({ lockedBanner: !document.getElementById('page-locked-banner').classList.contains('hidden'), shownBody: document.getElementById('page-render-content').innerText }));
      ok('browser: paid page still shows the app\'s locked banner and no body', g.lockedBanner && !g.shownBody.includes('REAL-PAID-BODY'), g);
      eq('browser: no uncaught JS errors (paid page)', errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-out-'));
  const gen = runGenerator(['--from-file', FIXTURE], out);
  ok('generator runs cleanly on the fixture against the real index.html', gen.code === 0, gen);
  if (gen.code === 0) {
    staticChecks(out);
    installableAppChecks();
    driftGuardChecks();
    await browserChecks(out);
  }
  fs.rmSync(out, { recursive: true, force: true });

  const failed = results.filter(r => !r.pass);
  results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n      ' + JSON.stringify(r.detail)}`));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) { console.log('\nFAILED.'); process.exit(1); }
  console.log('\nAll checks passed.');
})().catch(e => { console.error(e); process.exit(1); });
