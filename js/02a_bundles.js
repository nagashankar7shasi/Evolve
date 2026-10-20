    /* ----------------------------------------------------
       BUNDLES (editable passes). Student.passes holds bundle ids; student.passExpiry[id] holds an ISO date.
    ----------------------------------------------------- */
    function seedBundles() {
      const cp = (pricingMaster && pricingMaster.categoryPasses) || {};
      const cat = (id, name, price, planners, highlights, extra = {}) => ({
        id, name, price, validityDays: 365, allAccess: false,
        tagline: `Every ${name.replace(' Pass', '')} mock, including papers added later.`,
        categories: [id], papers: [], pages: [], pdfs: [], planners, features: ['mistakes', 'topic_builder'],
        highlights, active: true, featured: false, showOnHome: false, style: 'light', order: 10,
        slug: slugify(name), oldSlugs: [], ...extra
      });
      return [
        cat('kpsc_kas', 'KPSC KAS Complete Pass', cp.kpsc_kas || 699, ['kpsc'],
          ['All KAS Paper 1 & Paper 2 mocks', 'Advanced KPSC study planner', 'Practise my mistakes + topic tests'],
          { featured: true, showOnHome: true, style: 'amber', order: 1 }),
        cat('karnataka_psi', 'Karnataka PSI Pass', cp.karnataka_psi || 499, [], ['All PSI civil mocks', 'Instant evaluation and solutions']),
        cat('kpsc_fda_sda', 'FDA / SDA Pass', cp.kpsc_fda_sda || 399, [], ['All FDA/SDA mocks', 'Instant evaluation and solutions']),
        cat('upsc_cse', 'UPSC CSE Pass', cp.upsc_cse || 999, ['upsc'], ['All UPSC GS mocks', 'Advanced UPSC study planner', 'Practise my mistakes + topic tests']),
        {
          id: 'all_access', name: 'All-Access Master Pass', price: pricingMaster.allAccessPrice || 1499, validityDays: 365, allAccess: true,
          tagline: 'Unlimited access to every exam, paper, page, PDF and dashboard feature.',
          categories: [], papers: [], pages: [], pdfs: [], planners: [], features: [],
          highlights: ['KAS, PSI, FDA/SDA and UPSC mocks', 'All gated PDFs and study pages', 'Every advanced planner and dashboard feature'],
          active: true, featured: false, showOnHome: true, style: 'dark', order: 2,
          slug: 'all-access-master-pass', oldSlugs: []
        }
      ];
    }
    let bundles = JSON.parse(localStorage.getItem('kas_bundles')) || seedBundles();
    function saveBundles() {
      localStorage.setItem('kas_bundles', JSON.stringify(bundles));
    }
    saveBundles();

    function getBundle(id) {
      return bundles.find(b => b.id === id) || null;
    }
    // Ref-resolving lookup mirroring findPage() (js/02_pricing_master_storage.js) -- matches by id,
    // current slug, or any old slug (so a renamed bundle's previously-shared landing-page links keep
    // working). getBundle() above stays a strict id-only lookup since that's what every entitlement
    // call site (student.passes, bundleCoversPaper, etc.) always passes; this one is for resolving a
    // URL/user-typed reference, same split as findPage() vs. direct customPages.find(p => p.id === ...).
    function findBundleByRef(ref) {
      if (!ref) return null;
      return bundles.find(b => b.id === ref) || bundles.find(b => b.slug === ref) || bundles.find(b => (b.oldSlugs || []).includes(ref)) || null;
    }
    // '#/bundle/{slug}' URL for a bundle's landing page, mirroring pageLinkHash(page). Falls back to
    // the bundle id for any bundle that hasn't been saved since the slug field was introduced (slug
    // is backfilled in the DB -- see sql/add_bundle_slug.sql -- but a bundle still on local seed data,
    // before the cloud fetch lands, won't have one yet).
    function bundleLinkHash(b) {
      return '#/bundle/' + encodeURIComponent((b && b.slug) || (b && b.id) || '');
    }
    // Shared by bundleCardHtml (js/03c_bundles_admin_editor.js) and the bundle landing page below --
    // one place that decides whether a no-code auto-coupon currently discounts this bundle, so both
    // surfaces always agree on the price shown. Guarded for load order: js/03f_coupons.js (which
    // defines bestAutoCoupon/computeCouponDiscount) loads after this file, but by the time anything
    // actually CALLS this (a render, well after boot), both are already defined globals.
    function bundlePricingInfo(b) {
      const autoCoupon = (typeof bestAutoCoupon === 'function') ? bestAutoCoupon({ type: 'pass', id: b.id }, b.price) : null;
      const discount = autoCoupon ? computeCouponDiscount(autoCoupon, b.price) : 0;
      const finalPrice = autoCoupon ? Math.max(0, b.price - discount) : b.price;
      return { autoCoupon, discount, finalPrice };
    }
    function bundleLabel(id) {
      const b = getBundle(id);
      return b ? b.name : id;
    }
    function isPassExpired(student, id) {
      const exp = (student.passExpiry || {})[id];
      return !!exp && new Date(exp) < new Date();
    }
    // Bundles a student holds right now (deleted or expired ones don't count; "not on sale" still counts)
    function activeBundlesFor(student) {
      if (!student) return [];
      return (student.passes || []).map(getBundle).filter(b => b && !isPassExpired(student, b.id));
    }
    function grantPass(student, bundleId) {
      const b = getBundle(bundleId);
      if (!student.passes.includes(bundleId)) student.passes.push(bundleId);
      student.passExpiry = student.passExpiry || {};
      if (b && b.validityDays > 0) {
        const current = student.passExpiry[bundleId] ? new Date(student.passExpiry[bundleId]) : null;
        const start = current && current > new Date() ? current : new Date();   // renewals extend from the current end date
        student.passExpiry[bundleId] = new Date(start.getTime() + b.validityDays * 86400000).toISOString();
      } else {
        delete student.passExpiry[bundleId];
      }
    }
    function revokePass(student, bundleId) {
      student.passes = student.passes.filter(x => x !== bundleId);
      if (student.passExpiry) delete student.passExpiry[bundleId];
    }
    function bundleCoversPaper(b, paper) {
      // BUG FIX: this used to also check paper.extraCategories — meaning tagging a paper as
      // question-bank-applicable to another exam (so its questions feed that exam's Topic Builder)
      // silently ALSO extended entitlement to it via any bundle covering that other exam. That's a
      // real access leak: applicability was never meant to imply "unlockable here too". Entitlement
      // now only follows the primary category (+ its category ancestors via categoryAndAncestors, so
      // a bundle covering a parent sub-category umbrella still covers its children) or the explicit,
      // admin opt-in alsoListCategories field — never extraCategories.
      if (!paper) return false;
      if (b.allAccess || b.papers.includes(paper.id)) return true;
      const coveredCats = categoryAndAncestors(paper.category);
      if (coveredCats.some(c => b.categories.includes(c))) return true;
      return (paper.alsoListCategories || []).some(c => b.categories.includes(c));
    }
    // Reverse lookup of bundleCoversPaper(): every active, for-sale bundle that covers this paper,
    // cheapest first. A paper can legitimately be covered by more than one bundle at once (e.g. a
    // small subset pass carved out of a larger category pass) -- that's intentional, not a bug, so
    // this returns all of them rather than picking a single "owning" bundle. Used for bundle-only
    // papers' "Included in ..." / "Renew ..." UI and the Studio's safety-net warnings. Never used for
    // entitlement itself -- that's still bundleCoversPaper()/activeBundlesFor() per student.
    function bundlesCoveringPaper(paper) {
      return bundlesForSale(b => bundleCoversPaper(b, paper));
    }
    // Shared "how do I unlock this" CTA for a bundle-only paper (paper.bundleOnly === true), used by
    // both the Test Papers grid card and a custom Word Page's embedded paper card -- so a bundle-only
    // paper never grows a standalone "Unlock Paper (₹price)" button in either place, wherever it's
    // rendered. Returns an HTML string for the locked-state CTA area.
    function bundleOnlyUnlockCta(paper) {
      const covering = bundlesCoveringPaper(paper);
      if (!covering.length) {
        // Marked bundle-only but no bundle currently covers it -- the Studio warns the admin about
        // this separately (see studioCheckBundleOnlyCoverage); a visitor just sees a neutral,
        // non-actionable state here, never a price, since there's genuinely nothing to buy yet.
        return `<div class="mt-6 w-full py-3 bg-slate-100 text-slate-400 font-bold text-xs rounded-lg text-center">Not available yet</div>`;
      }
      const student = getCurrentStudent();
      // A bundle the student held for this exact paper but let lapse gets "Renew" instead of
      // "Included in" -- same checkout either way, just a truer label for getting access back vs
      // discovering it for the first time.
      const lapsed = student && covering.find(b => (student.passes || []).includes(b.id) && isPassExpired(student, b.id));
      if (lapsed) {
        return `
          <button onclick="openBundleCheckout('${lapsed.id}')" class="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow">
            🔄 Renew ${escapeHtml(lapsed.name)}
          </button>`;
      }
      return `
        <div class="mt-6 text-xs text-slate-500 text-center">
          Included in: ${covering.map(b => `<button onclick="openBundleCheckout('${b.id}')" class="font-bold text-amber-700 hover:underline">${escapeHtml(b.name)}</button>`).join(', ')}
        </div>`;
    }
    function bundleCoversPage(b, page) {
      return b.allAccess || pageAncestry(page).some(p => b.pages.includes(p.id));
    }
    function bundleCoversPdf(b, doc) {
      return b.allAccess || b.pdfs.includes(doc.id);
    }
    function bundleCoversPlanner(b, plannerId) {
      return b.allAccess || (b.planners || []).includes(plannerId);
    }
    function bundleCoversFeature(b, featureId) {
      return b.allAccess || (b.features || []).includes(featureId);
    }
    // A bundle covers a Mains test paper either by explicitly listing it (b.mainsPapers, the
    // per-paper equivalent of `papers` for Prelims) or by covering its whole category already
    // (b.allAccess / b.categories) -- same two routes isMainsTestUnlockedForUser checks.
    function bundleCoversMainsTest(b, paper) {
      if (!paper) return false;
      if (b.allAccess || (b.mainsPapers || []).includes(paper.id)) return true;
      const coveredCats = categoryAndAncestors(paper.categoryId);
      return coveredCats.some(c => (b.categories || []).includes(c));
    }
    // Bundles on sale that would unlock something, cheapest first (narrow bundles before all-access at equal price)
    function bundlesForSale(test) {
      return bundles.filter(b => b.active && test(b)).sort((a, b) => a.price - b.price || (a.allAccess ? 1 : 0) - (b.allAccess ? 1 : 0));
    }
    function openBundleCheckout(id) {
      const b = getBundle(id);
      if (b) openCheckout('pass', b.id, b.name, b.price);
    }
    function fmtDate(iso) {
      return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    }

    normalizeStudentDirectory();
    normalizePageReferences();

    let selectedCategory = 'kpsc_kas';
    let selectedSubCategory = null; // null = "All" within selectedCategory; otherwise a child category id
    let savedEditorRange = null;
    let activeSelectedStudent = null;
    let activeReviewAttempt = null; // Currently inspected attempt
    let currentBundleLandingId = null; // bundle currently shown at #/bundle/{slug}, mirroring currentPageId

    // Runtime state
    let activeTest = null;
    let currentLang = 'en';
    let userSelections = {};
    let markedForReview = {};  // { qNum: true } — flagged during a live test to revisit before submitting
    // Chosen on the mode-picker modal before a real (non-Practice) attempt starts -- 'easy' (today's
    // long-standing behavior: an answer can be changed freely any time before submitting) or
    // 'difficult' (an answer locks the moment it's first chosen; see selectAnswer/clearQ in
    // js/10_omr_exam_engine.js). Practice Mode is unaffected by this -- it's always free to change,
    // same as it always was, since it's meant for learning rather than simulating exam conditions.
    let examMode = 'easy';
    let pendingExamModePaperId = null; // set while the mode-picker modal is open; see openExamModePicker
    let timerSeconds = 0;
    let timerInterval = null;
    // { qNum: seconds } -- active time spent with each question actually in view (tab focused) during
    // a real, timed OMR attempt. See currentlyVisibleQNum/startTimer in js/10_omr_exam_engine.js.
    // Untracked for Practice Mode, which is untimed and one-question-at-a-time already.
    let questionTimeSpent = {};
    // Guards evaluateOMRSubmission (js/10_omr_exam_engine.js) against a double-fire -- e.g. the
    // countdown hitting zero at the same moment the student taps Submit, or a manual retry racing
    // an in-flight one -- so a flaky connection never results in two attempts being inserted.
    let submitInFlight = false;

// -------- Global error handler --------
// Catches uncaught JS errors and unhandled promise rejections so the app never
// silently breaks in ways that look like "nothing happened when I clicked."
// Shows a friendly toast in the bottom-right; users can dismiss and continue,
// or click "Reload" if things are really broken. All errors go to console for
// debugging.
(function installGlobalErrorHandler() {
  let toastCount = 0;   // don't spam if many errors fire in a row
  const showErrorToast = (msg) => {
    if (toastCount > 2) return;   // cap at 3 visible toasts
    toastCount++;
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;max-width:360px;background:#fff;border:2px solid #f43f5e;border-radius:12px;padding:12px 14px;box-shadow:0 8px 24px rgba(15,23,42,.15);z-index:9999;font-family:system-ui,sans-serif;font-size:12px;color:#0f172a;';
    t.innerHTML = `
      <div style="font-weight:800;color:#991b1b;margin-bottom:4px;">⚠ Something went wrong</div>
      <div style="color:#475569;line-height:1.4;margin-bottom:6px;">${(msg || 'Unknown error').slice(0, 200).replace(/</g,'&lt;')}</div>
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button onclick="location.reload()" style="padding:4px 10px;background:#0f172a;color:#fff;border:0;border-radius:6px;font-weight:700;cursor:pointer;font-size:11px;">Reload</button>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:4px 10px;background:#f1f5f9;color:#475569;border:0;border-radius:6px;font-weight:700;cursor:pointer;font-size:11px;">Dismiss</button>
      </div>`;
    document.body && document.body.appendChild(t);
    setTimeout(() => { t.remove(); toastCount = Math.max(0, toastCount - 1); }, 12000);
  };
  window.addEventListener('error', (e) => {
    console.error('[global error]', e.error || e.message, e.filename, e.lineno);
    showErrorToast(e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled rejection]', e.reason);
    showErrorToast((e.reason && (e.reason.message || String(e.reason))) || 'Async operation failed');
  });
})();

// -------- PWA install prompt --------
// The browser fires 'beforeinstallprompt' when the site meets PWA criteria (manifest + HTTPS).
// We stash the event and show a floating "Install app" chip. When user clicks, we trigger
// the native install dialog. Once installed (or dismissed), the chip disappears.
// No service worker required for the browser prompt to fire on modern Chrome/Edge.
(function pwaInstall() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show a small install chip if not already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('gp_pwa_dismissed')) return;
    const chip = document.createElement('div');
    chip.id = 'pwa-install-chip';
    chip.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9997;background:#172554;color:#fff;padding:10px 14px;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,.3);font-family:system-ui,sans-serif;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;';
    chip.innerHTML = `
      <span style="font-size:16px;">📱</span>
      <span>Install Evolve+ on your device?</span>
      <button id="pwa-install-yes" style="background:#f59e0b;color:#0f172a;border:0;padding:5px 12px;border-radius:999px;font-weight:800;cursor:pointer;font-size:11px;">Install</button>
      <button id="pwa-install-no" style="background:transparent;color:#94a3b8;border:0;padding:5px 8px;font-weight:700;cursor:pointer;font-size:11px;">Not now</button>
    `;
    document.body && document.body.appendChild(chip);
    document.getElementById('pwa-install-yes').onclick = async () => {
      if (!deferredPrompt) return;
      chip.remove();
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log('[pwa] install choice:', choice.outcome);
      deferredPrompt = null;
    };
    document.getElementById('pwa-install-no').onclick = () => {
      chip.remove();
      localStorage.setItem('gp_pwa_dismissed', '1');   // don't re-show for 30 days
      setTimeout(() => localStorage.removeItem('gp_pwa_dismissed'), 30 * 24 * 60 * 60 * 1000);
    };
  });
  window.addEventListener('appinstalled', () => {
    console.log('[pwa] installed');
    const chip = document.getElementById('pwa-install-chip');
    chip && chip.remove();
  });
})();

// -------- Show/hide password toggles --------
// Wraps every password input on the page with a 👁 toggle button, rather than hand-editing each of
// the dozen+ password fields scattered across login/signup/reset/admin modals (which have different
// styling contexts and would be easy to get subtly wrong in some of them). Runs once at boot; safe
// to call again if new password fields are added to the DOM later (skips ones already wrapped).
function addShowPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggleWrapped) return;  // idempotent — don't double-wrap
    input.dataset.toggleWrapped = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    // Reserve room on the right so the toggle doesn't sit over typed text
    const existingPad = window.getComputedStyle(input).paddingRight;
    input.style.paddingRight = `calc(${existingPad} + 28px)`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;  // don't steal tab order from the actual form fields
    btn.setAttribute('aria-label', 'Show password');
    btn.className = 'absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-sm leading-none select-none';
    btn.style.background = 'none';
    btn.style.border = '0';
    btn.style.cursor = 'pointer';
    btn.innerHTML = '👁';
    btn.onclick = () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? '👁' : '🙈';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    };
    wrapper.appendChild(btn);
  });
}

// Lightweight "how many people visited today" gauge for the admin Overview panel -- NOT a real
// analytics system (no cookies/IP captured). "Unique" is approximated per browser: this sets a
// localStorage flag the first time it fires each calendar day and is a no-op on every later
// page load/tab that same day, so one person refreshing repeatedly doesn't inflate the count.
// Skipped entirely for the admin's own session so checking the site doesn't count as a visitor.
// See sql/add_site_visit_counter.sql for the server side (increment_daily_visit RPC).
function recordDailyVisit() {
  if (typeof isAdmin === 'function' && isAdmin()) return;
  const today = new Date().toISOString().slice(0, 10);
  const key = 'kas_visit_counted_' + today;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  supabaseClient.rpc('increment_daily_visit').then(({ error }) => {
    if (error) console.error('increment_daily_visit failed:', fmtErr(error));
  });
}

window.onload = async function() {
      recordDailyVisit();
      // REMOVED (2026-10-12): this used to fetch a static data.json from the repo root and
      // unconditionally overwrite pricingMaster/navStructure/customPages/testsCatalog/pdfVault with
      // it, racing against the real Supabase fetch further below. Supabase is the actual source of
      // truth now (fetchCloudPricingMaster() etc., in the Promise.all below) -- data.json was a
      // leftover pre-Supabase bootstrap seed that nothing regenerates. A stale copy of it uploaded
      // to the repo on 2026-10-01 still carried the hardcoded placeholder UPI ID
      // ('yourkasacademy@upi'); whenever the Supabase pricing-master fetch hiccupped on a page load,
      // that placeholder won the race, got persisted to localStorage, and then got written straight
      // into the live Supabase app_settings row the moment the admin next clicked "Save Pricing
      // Settings" for *any* reason (that one save button re-saves the whole pricingMaster object,
      // not just whatever field was actually changed) -- silently clobbering the real UPI ID both
      // locally and in the cloud. Same unconditional-overwrite risk applied to nav/pages/catalog/pdfs.
      // Deleted entirely rather than patched, since nothing depends on data.json anymore (see repo
      // root -- also removed).
      // ----------------------------------------

      // Resume normal startup sequence
      // Admin console HTML (admin-console.html) is fetched/injected into the empty <main
      // id="view-admin"> shell here, as early as possible -- covers the common case (the admin
      // revisiting on a device where kas_user was already saved as role:'admin' from a previous
      // visit), BEFORE any of the render calls below that touch its DOM run. A second check sits
      // right after restoreSupabaseSession() below for the rarer case where isAdmin() only
      // becomes true once that resolves; ensureAdminConsoleLoaded() is a no-op the second time.
      if (isAdmin()) await ensureAdminConsoleLoaded();
      if (typeof validateSession === 'function') validateSession();
      if (typeof renderAuthSettings === 'function') renderAuthSettings();
      applyPricingLabels();
      renderNavigation();
      renderGranularNavTree();
      renderPagesList();
      renderPdfVault();
      // FIX: tabs/dropdowns must exist (even from local seed data) BEFORE the first filterExamCategory
      // call, or the initial tab has nothing to visually highlight — matches the same "populate before
      // use" ordering already established for home_config etc. elsewhere in this boot sequence.
      renderCategoryTabs();
      populateAllCategoryDropdowns();
      filterExamCategory('kpsc_kas');
      renderDashboard();
      renderStudentEntitlementsDesk();

      // PHASE 3b: restoreSupabaseSession() must fully resolve BEFORE any of the fetches below run, not
      // alongside them. As of Phase 3b, students/attempts/payment_orders/student_progress SELECT is
      // scoped to "your own row (or admin)" — every fetch below now depends on the right identity
      // already being attached to supabaseClient's requests. Running it concurrently (as it used to)
      // could race: a fetch's request could go out while still anonymous, silently come back empty, and
      // (for the bulk ones) overwrite data a slightly-slower-to-start-but-faster-to-resolve identity
      // restore had just correctly populated. In the common case this is a local storage read with no
      // network round trip at all, so it costs boot next to nothing; it only becomes a real network call
      // when the stored session's token needs a refresh.
      await restoreSupabaseSession(); // PHASE 3: recognize a real Supabase Auth session, admin or student, if one exists
      // Second check (see the comment above the first one near the top of this function) -- a
      // no-op if it already ran, but catches a live Supabase Auth admin session that
      // restoreSupabaseSession() just promoted currentUser to, which the earlier check couldn't
      // have seen yet. Must land before the Promise.all below, since several of its fetches
      // render straight into admin-console.html's DOM (fetchCloudStudents, fetchCloudPricingMaster,
      // fetchCloudAuthSettings, fetchCloudFeatureAccess, fetchCloudPlanners, fetchCloudCoupons,
      // fetchCloudMainsQuestions, fetchCloudSiteBranding, fetchCloudVisitStats).
      if (isAdmin()) await ensureAdminConsoleLoaded();
      // Page templates (js/08_word_page_creator.js) are admin-only and, like the admin-console
      // fetches above, need wiring into BOTH load paths: this one (already-logged-in-at-boot) and
      // paintAdminConsoleOnce() (js/03b_dev_console.js, mid-session login via navigate('admin')) --
      // same lesson as the dead-listener bug fixed in PR #66. Fire-and-forget, same as the renders
      // below; it paints the template picker whenever it resolves.
      if (isAdmin() && typeof fetchCloudPageTemplates === 'function') fetchCloudPageTemplates();

      // Everything below reads Supabase into its OWN distinct global (testsCatalog, studentDirectory,
      // pricingMaster, etc.) and none of them need another one to have finished first — except two
      // pairs with a real order dependency (seed-then-fetch, and pull-content-then-fill-in-missing-
      // legal-pages), which stay as small sequential chains below. Everything used to run one at a time
      // (~14 separate awaits), which on a fresh device with no localStorage cache to show meanwhile is
      // exactly what caused "shows only the old setup for a few seconds" — every one of those awaits was
      // a full Supabase round trip, back to back, before the page had real data to repaint with. Running
      // them concurrently cuts that wait to roughly the slowest single one instead of the sum of all.
      await Promise.all([
        (async () => { await ensureExamCategoriesSeeded(); await fetchCloudExamCategories(); })(),
        fetchCloudExamSubjects(),
        fetchCloudSubjectGroups(), // subject-group mappings for the Weakness/Strength dashboard -- needed by students, not just admin
        (async () => { await fetchCloudContent(); await ensureLegalPagesExist(); })(),
        fetchCloudPayments(),
        fetchCloudAttempts(),
        fetchCloudStudents(),
        fetchCloudVisitStats(),   // admin-only (RLS); no-op data for everyone else
        currentUser ? fetchCloudProgress() : Promise.resolve(),
        fetchCloudAllProgress(),   // admin-only bulk fetch so Student Directory summaries work
        fetchCloudPricingMaster(),
        fetchCloudAuthSettings(),
        fetchCloudFeatureAccess(),
        fetchCloudPlanners(),
        fetchCloudAnnouncements(),
        fetchCloudSiteBranding(),  // header logo/name/tagline — same generic app_settings pattern
        fetchCloudSocialFeedSettings(), // whole-feature on/off switch for the public "Updates" nav link/page
        fetchCloudQuizAutoSettings(), // Dev Console -> Telegram quiz automation panel settings
        fetchCloudCoupons(),
        fetchCloudCouponRedemptions(), // admin-only (RLS); no-op data for everyone else
        fetchCloudMainsQuestions(),
        fetchCloudMainsTestPapers(),
      ]);
      if (typeof renderStudentDirectoryTable === 'function') renderStudentDirectoryTable();
      if (typeof renderAnnouncements === 'function') renderAnnouncements();
      renderHomeSections();
      renderHomeBundles();
      renderHomePage();          // NEW: paint homeConfig sections from local cache immediately
      fetchCloudHomeConfig();    // NEW: then overwrite with cloud copy and repaint
      fetchCloudEmailTemplates();// NEW: pull custom email templates so any sends use the latest wording
      updateCategoryBundleButton();
      renderFeatureAccessAdmin();
      renderPlannersAdmin();
      resetMenuForm();
      if (typeof currentAdminPanel !== 'undefined') showAdminPanel(currentAdminPanel);
      renderPricingMasterSettings();
      if (typeof updateAuthUI === 'function') updateAuthUI();
      resetWordEditorToNew();
      addShowPasswordToggles();  // NEW: 👁 toggle on every password field, wrapped generically at boot

      checkUnfinishedExam();
      migrateStoredPdfs();
      window.addEventListener('hashchange', routeFromHash);
      window.addEventListener('popstate', routeFromHash);
      routeFromHash();
    };
    async function fetchCloudAttempts() {
  const { data, error } = await supabaseClient
    .from('attempts')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (data) {
    userAttempts = data.map(a => ({
      id: a.id,
      userEmail: a.user_email,
      userName: a.user_name,
      date: a.date,
      paperId: a.paper_id,
      paperTitle: a.paper_title,
      category: a.category,
      isCustom: a.is_custom,
      badge: a.badge,
      score: Number(a.score).toFixed(2),
      maxMarks: Number(a.max_marks).toFixed(0),
      accuracy: a.accuracy.toString(),
      schemeDesc: a.scheme_desc,
      passed: a.passed,
      userSelections: a.user_selections,
      questionsSnapshot: a.questions_snapshot,
      schemeSnapshot: a.scheme_snapshot,
      questionTimes: a.question_times || {},
      mode: a.mode || 'standard'
    }));
    
    renderDashboard();
    
    // Refresh Admin Overview if it is currently open
    if (typeof renderOverview === 'function' && typeof currentAdminPanel !== 'undefined' && currentAdminPanel === 'overview') {
      renderOverview();
    }
  } else if (error) {
    console.error("Failed to fetch attempts:", fmtErr(error));
  }
}
    // PHASE 3b: shared row->local-object mapper, used everywhere a `students` row comes back from
    // Supabase (the bulk admin fetch below, the student_upsert_credentials RPC, and the fresh
    // own-row fetch in applySupabaseStudentSession) so all three stay in sync with the DB schema by
    // construction instead of three separately-maintained copies of this mapping drifting apart.
    function mapCloudStudentRow(s) {
      return {
        email: normalizeEmail(s.email),
        name: s.name || '',
        phone: s.phone || '',
        utr: s.utr || '',
        status: s.status || 'active',
        allowedExams: Array.isArray(s.allowed_exams) ? s.allowed_exams : [],
        allowedPages: Array.isArray(s.allowed_pages) ? s.allowed_pages : [],
        allowedPdfs: Array.isArray(s.allowed_pdfs) ? s.allowed_pdfs : [],
        allowedPlanners: Array.isArray(s.allowed_planners) ? s.allowed_planners : [],
        allowedMains: Array.isArray(s.allowed_mains) ? s.allowed_mains : [],
        allowedMainsTests: Array.isArray(s.allowed_mains_tests) ? s.allowed_mains_tests : [],
        passes: Array.isArray(s.passes) ? s.passes : [],
        passExpiry: s.pass_expiry || {},
        passwordHash: s.password_hash || undefined,
        passwordSalt: s.password_salt || undefined,
        supabaseAuthMigrated: !!s.supabase_auth_migrated,
        createdAt: s.created_at,
        lastLoginAt: s.last_login_at,
        // Per-student Telegram alerts (task #198) — set once the student completes the
        // /start <token> deep link via telegram-webhook; see sql/add_telegram_per_student_alerts.sql.
        telegramChatId: s.telegram_chat_id || null
      };
    }

    async function fetchCloudStudents() {
  // PHASE 3b: under the scoped `students_read` policy this returns every row for the admin
  // (is_admin() bypass) but only the caller's own row (or none) for anyone else — exactly what the
  // admin-only UI this feeds (renderStudentEntitlementsDesk / renderStudentDirectoryTable) needs, and
  // exactly why a logged-in student's OWN entitlements must never depend on this call (they don't —
  // see applySupabaseStudentSession's own dedicated fetch).
  const { data, error } = await supabaseClient
    .from('students')
    .select('*');

  if (data) {
    studentDirectory = data.map(mapCloudStudentRow);

    renderStudentEntitlementsDesk();
    if (typeof renderStudentDirectoryTable === 'function') renderStudentDirectoryTable();
    if (typeof filterExamCategory === 'function') filterExamCategory(selectedCategory);
  } else if (error) {
    console.error("Failed to fetch students:", fmtErr(error));
  }
}

// Daily visit counts for the admin Overview panel (see sql/add_site_visit_counter.sql). RLS
// restricts SELECT on site_visit_counts to the admin, so this comes back empty (not an error
// worth logging) for every student/anonymous session -- that's expected, not a bug.
let siteVisitCounts = [];
async function fetchCloudVisitStats() {
  const { data, error } = await supabaseClient
    .from('site_visit_counts')
    .select('*')
    .order('day', { ascending: false });

  if (data) {
    siteVisitCounts = data;
    if (typeof renderOverview === 'function' && typeof currentAdminPanel !== 'undefined' && currentAdminPanel === 'overview') renderOverview();
  } else if (error) {
    if (typeof isAdmin === 'function' && isAdmin()) console.error('fetchCloudVisitStats failed:', fmtErr(error));
    siteVisitCounts = [];
  }
}

    async function fetchCloudProgress() {
  if (!currentUser) return;
  const email = normalizeEmail(currentUser.email);
  const { data, error } = await supabaseClient
    .from('student_progress')
    .select('*')
    .eq('email', email)
    .single();

  if (data) {
    // BUG FIX: plannerStore/practiceLog are multi-student objects keyed by email
    // (plannerStore = { "a@x.com": {...}, "b@y.com": {...} }). The old code did a FULL replace
    // (plannerStore = data.planner_data), which meant this student's login could silently wipe out
    // every OTHER student's already-loaded planner/practice data from memory. Now we merge into just
    // this student's own key.
    if (data.planner_data)  plannerStore[email] = data.planner_data;
    if (data.practice_log)  practiceLog[email]  = data.practice_log;

    // Update local storage so the UI stays snappy
    localStorage.setItem('kas_study_planner', JSON.stringify(plannerStore));
    localStorage.setItem('kas_practice_log', JSON.stringify(practiceLog));
    
    renderStudyPlanner();
    renderPracticeCenter();
    renderMainsDashboardCard();
  }
}

    // Admin-only bulk fetch: the Student Directory's plannerSummary(email) needs every student's
    // planner/practice data available locally, not just the logged-in admin's own (which is empty —
    // admins don't have planners). Pulls all rows and populates the same multi-student objects that
    // fetchCloudProgress's per-student fix now correctly merges into one key at a time.
    async function fetchCloudAllProgress() {
      if (!isAdmin()) return;
      try {
        const { data, error } = await supabaseClient.from('student_progress').select('*');
        if (error) throw error;
        (data || []).forEach(row => {
          const email = normalizeEmail(row.email);
          if (row.planner_data) plannerStore[email] = row.planner_data;
          if (row.practice_log) practiceLog[email] = row.practice_log;
        });
        localStorage.setItem('kas_study_planner', JSON.stringify(plannerStore));
        localStorage.setItem('kas_practice_log', JSON.stringify(practiceLog));
        if (typeof renderStudentDirectoryTable === 'function') renderStudentDirectoryTable();
      } catch (err) {
        console.error('fetchCloudAllProgress failed:', fmtErr(err));
      }
    }

    async function fetchCloudContent() {
  // PERFORMANCE FIX: these five reads are all independent (five different tables, none of their
  // mappings below reads another's result), so they're fired together instead of one at a time. This
  // function alone used to be 5 sequential Supabase round trips back to back -- exactly the kind of
  // per-function sequential chain the comment on the outer boot-sequence Promise.all (see
  // runStartupSequence) already called out and fixed one level up ("shows only the old setup for a few
  // seconds"); fetchCloudContent is one of that outer list's own ~15 items, so being internally
  // sequential made IT the single slowest item and put a floor of "sum of all 5" under the whole page's
  // wait, regardless of how parallel everything around it already was. Reported in practice as the
  // page showing cached/seed content for 7-8 seconds before repainting with real data -- consistent
  // with 5 round trips at roughly 1.5s each. Now it's roughly the slowest of the five, not the sum.
  const [testsRes, pagesRes, bdlRes, menuRes, pdfsRes] = await Promise.all([
    // Tests — METADATA ONLY, via the tests_catalog_public view (PHASE 3b) rather than the base table.
    // Deliberately excludes the `questions` column (every question's text, options AND correct
    // answer) from this bulk, load-time fetch: previously this was `select('*')` on the base table,
    // which meant the full answer key for every paper — including ones nobody has paid for — was
    // downloaded to every visitor's browser on every page load. Now that the base table's own SELECT
    // policy is scoped to student_can_access_paper() (see phase3b_row_scoping.sql), querying it
    // directly here would ALSO only return papers the current viewer already has access to — wrong for
    // a catalog listing, which needs to show every paper (title, price, paywall card) to everyone,
    // entitled or not. The view has no such restriction (it's metadata-only, so there's nothing on it
    // worth protecting) and always returns the full catalog. A paper's actual question content is
    // fetched separately, on demand, straight from the (now-gated) base table, only once a signed-in
    // student who's confirmed to hold it opens it (see ensurePaperQuestionsLoaded/
    // ensureUnlockedPapersLoaded), or an admin manages it (see ensureFullTestsCatalogForAdmin).
    // `question_count` is a plain number kept in sync by Studio on every publish — safe to ship in bulk
    // since it carries no question content.
    // BUG FIX: this select string previously omitted `also_list_categories` entirely (even though the
    // mapping below already read `t.also_list_categories`) — the view had the same gap, so cross-listing
    // a paper under alsoListCategories silently never worked via this bulk fetch; it always came back
    // as [] here regardless of what was saved. Also now requests `delisted` (see the Studio "Delist"
    // toggle), which hides a paper from the Test Papers browse grid/search while leaving it fully
    // purchasable via a direct link or a page's Test paper card.
    supabaseClient.from('tests_catalog_public')
      .select('id, category, extra_categories, also_list_categories, active, delisted, bundle_only, title, price, scheme, scheduled_for, question_count, order_num, coming_soon, revision_notes'),
    supabaseClient.from('custom_pages').select('*'),
    supabaseClient.from('bundles').select('*'),
    supabaseClient.from('nav_menu').select('*').order('order_num'),
    supabaseClient.from('pdf_vault').select('*'),
  ]);

  const { data: tests } = testsRes;
  if (tests && tests.length > 0) {
    testsCatalog = tests.map(t => {
      // Defensive: Supabase may return jsonb columns as parsed objects, but if the
      // columns were created as `text` (or the DB returned a stringified value),
      // scheme arrives as a string. Parse it so the exam engine works either way
      // instead of throwing a silent "OMR won't open" error.
      let scheme = t.scheme;
      if (typeof scheme === 'string') {
        try { scheme = JSON.parse(scheme); } catch (_) { scheme = null; }
      }
      // extra_categories may not exist yet on older rows (pre-migration) — default to [].
      // Same for `active`: a column that doesn't exist yet, or a legacy row saved before this
      // feature existed, must default to true so nothing already-published silently disappears.
      let extraCategories = t.extra_categories;
      if (typeof extraCategories === 'string') {
        try { extraCategories = JSON.parse(extraCategories); } catch (_) { extraCategories = []; }
      }
      if (!Array.isArray(extraCategories)) extraCategories = [];
      // also_list_categories is a newer column, separate from extra_categories — see
      // studioRefreshAlsoListCategoryOptions for why these two are no longer the same field.
      // Missing column / older rows default to [] (nothing cross-listed), same defensive pattern.
      let alsoListCategories = t.also_list_categories;
      if (typeof alsoListCategories === 'string') {
        try { alsoListCategories = JSON.parse(alsoListCategories); } catch (_) { alsoListCategories = []; }
      }
      if (!Array.isArray(alsoListCategories)) alsoListCategories = [];
      // revision_notes is small (just typed text + an uploaded file's URL/name, never question
      // content) so it's cheap to ship in this bulk metadata fetch, same as question_count --
      // unlike `questions` below, cards need to know up front whether to show the "📄 Revision
      // Notes" button at all, not just once a student opens the paper.
      let revisionNotes = t.revision_notes;
      if (typeof revisionNotes === 'string') {
        try { revisionNotes = JSON.parse(revisionNotes); } catch (_) { revisionNotes = null; }
      }
      if (!revisionNotes || typeof revisionNotes !== 'object') revisionNotes = null;
      // `questions` is intentionally left unset here — [] would look like "loaded, zero questions"
      // and silently mask a paper failing to load; leaving it undefined makes every loader below
      // treat this paper as "content not fetched yet" until ensurePaperQuestionsLoaded runs.
      return { id: t.id, category: t.category, extraCategories, alsoListCategories, active: t.active !== false, delisted: !!t.delisted, bundleOnly: !!t.bundle_only, comingSoon: !!t.coming_soon, revisionNotes, title: t.title, price: t.price, scheme, questionCount: +t.question_count || 0, scheduled_for: t.scheduled_for || null, order: Number.isFinite(+t.order_num) ? +t.order_num : 0 };
    });
  }

  // Pages
  const { data: pages } = pagesRes;
  if (pages && pages.length > 0) {
    customPages = pages.map(p => ({
      id: p.id, slug: p.slug, title: p.title, isGated: p.is_gated, price: p.price, content: p.content,
      parentId: p.parent_id, icon: p.icon, image: p.image, summary: p.summary, childStyle: p.child_style,
      order: p.order_num, showOnHome: p.show_on_home, bundleOnly: p.bundle_only, oldSlugs: p.old_slugs || [],
      // published_at/date_position: optional "posted on <date>" display for daily content (current
      // affairs, etc.) -- see sql/add_custom_pages_published_date.sql. null/'hidden' means "don't
      // show one" (see sql/add_custom_pages_date_hidden_and_pdf_toggle.sql for the 'hidden' value).
      publishedAt: p.published_at || null, datePosition: p.date_position || 'above',
      // allow_pdf_download defaults to true at the DB level for every row (new and pre-existing),
      // but guard defensively anyway: undefined/null (a row read before this column existed in a
      // stale cache) should still mean "show the button", not "hide it".
      allowPdfDownload: p.allow_pdf_download !== false
    }));
  }

  // Bundles
  const { data: bdl } = bdlRes;
  if (bdl && bdl.length > 0) {
    bundles = bdl.map(b => ({
      id: b.id, name: b.name, price: b.price, validityDays: b.validity_days, allAccess: b.all_access,
      tagline: b.tagline, categories: b.categories, papers: b.papers, pages: b.pages, pdfs: b.pdfs,
      planners: b.planners, features: b.features, highlights: b.highlights, active: b.active,
      featured: b.featured, showOnHome: b.show_on_home, style: b.style, order: b.order_num,
      mainsPapers: Array.isArray(b.mains_papers) ? b.mains_papers : [],
      // slug/old_slugs: added for #/bundle/{slug} landing pages (sql/add_bundle_slug.sql). Older
      // rows saved before this column existed in a stale cache default to no slug -- bundleLinkHash()
      // falls back to the id in that case, same defensive pattern as customPages' slug handling.
      slug: b.slug || null, oldSlugs: Array.isArray(b.old_slugs) ? b.old_slugs : [],
      // schedulePdfId: optional PDF-vault reference shown as a "View schedule/syllabus" link on the
      // public bundle card (sql/add_bundle_schedule_pdf.sql) -- NOT an entitlement, see `pdfs` above.
      schedulePdfId: b.schedule_pdf_id || null
    }));
  }

  // Navigation menu
  const { data: menu } = menuRes;
  if (menu && menu.length > 0) {
    navStructure = menu.map(m => ({ id: m.id, label: m.label, action: m.action, autoChildren: m.auto_children, submenus: m.submenus || [] }));
  }

  // PDF vault
  const { data: pdfs } = pdfsRes;
  if (pdfs && pdfs.length > 0) {
    pdfVault = pdfs.map(d => ({ id: d.id, title: d.title, category: d.category, access: d.access, price: d.price, url: d.url, bytes: d.bytes }));
  }

  // Refresh UI
  filterExamCategory(selectedCategory);
  renderNavigation();
  renderGranularNavTree();
  renderPagesList();
  renderPdfVault();
  renderHomeSections();
  renderHomeBundles();
  renderBundlesAdmin();
}

// ---- On-demand question content loaders (see fetchCloudContent's metadata-only fetch above) ----
// Fetches ONE paper's actual questions (with answers) from Supabase, only when a student who's
// already been confirmed to hold it is about to open it, or an admin is managing it. No-ops if the
// paper's content is already loaded (checked by the caller too, but safe either way), and merges the
// result straight into the shared testsCatalog entry so a second open in the same session doesn't
// re-fetch. This closes the passive leak (every browser silently holding every answer key on load) —
// a deliberate, targeted REST query for one specific paper's questions is still possible until RLS +
// server-side entitlement checks land (a later phase), since nothing here changes who is ALLOWED to
// ask the database for this row, only what the app fetches automatically by default.
async function ensurePaperQuestionsLoaded(paper) {
  if (!paper) return null;
  if (Array.isArray(paper.questions) && paper.questions.length) return paper; // already loaded
  const { data, error } = await supabaseClient.from('tests_catalog').select('scheme, questions').eq('id', paper.id).single();
  if (error || !data) { console.error('Failed to load paper content:', fmtErr(error)); return null; }
  let scheme = data.scheme, questions = data.questions;
  if (typeof scheme === 'string') { try { scheme = JSON.parse(scheme); } catch (_) { scheme = null; } }
  if (typeof questions === 'string') { try { questions = JSON.parse(questions); } catch (_) { questions = null; } }
  paper.questions = Array.isArray(questions) ? questions : [];
  if (scheme && typeof scheme === 'object') paper.scheme = scheme;
  return paper;
}

// Batched version for a student's whole unlocked set at once — used by Topic Builder and "Practise
// my mistakes", which pool/reference questions across every paper a student can open, not just one.
// Never touches papers the student hasn't unlocked, so locked-paper content still never reaches the
// browser just because this ran. Cheap to call repeatedly: returns false immediately (no query) once
// everything needed is already loaded.
async function ensureUnlockedPapersLoaded() {
  const need = testsCatalog.filter(p => isTestUnlockedForUser(p.id) && !(Array.isArray(p.questions) && p.questions.length));
  if (!need.length) return false;
  const { data, error } = await supabaseClient.from('tests_catalog').select('id, scheme, questions').in('id', need.map(p => p.id));
  if (error || !data) { console.error('Failed to load unlocked papers content:', fmtErr(error)); return false; }
  data.forEach(row => {
    const p = testsCatalog.find(x => x.id === row.id);
    if (!p) return;
    let scheme = row.scheme, questions = row.questions;
    if (typeof scheme === 'string') { try { scheme = JSON.parse(scheme); } catch (_) { scheme = null; } }
    if (typeof questions === 'string') { try { questions = JSON.parse(questions); } catch (_) { questions = null; } }
    p.questions = Array.isArray(questions) ? questions : [];
    if (scheme && typeof scheme === 'object') p.scheme = scheme;
  });
  return true;
}

// Full-content fetch for the admin's own Test Papers management panel (editing, broken-question
// validation, question counts) — a one-time bulk load when the admin actually opens that panel,
// not on every visitor's page load. Everyone else keeps getting metadata-only via fetchCloudContent.
let _fullTestsCatalogLoadedForAdmin = false;
async function ensureFullTestsCatalogForAdmin() {
  if (_fullTestsCatalogLoadedForAdmin) return;
  const { data, error } = await supabaseClient.from('tests_catalog').select('*');
  if (error || !data) { console.error('Failed to load full catalog for admin:', fmtErr(error)); return; }
  data.forEach(t => {
    const p = testsCatalog.find(x => x.id === t.id);
    if (!p) return;
    let questions = t.questions;
    if (typeof questions === 'string') { try { questions = JSON.parse(questions); } catch (_) { questions = []; } }
    p.questions = Array.isArray(questions) ? questions : [];
  });
  _fullTestsCatalogLoadedForAdmin = true;
}

    async function pushStudentToCloud(email) {
  const student = getStudentRecord(email);
  if (!student) return;
  
  const { error } = await supabaseClient
    .from('students')
    .upsert({
      email: student.email,
      name: student.name || '',
      utr: student.utr || '',
      status: student.status || 'active',
      allowed_exams: student.allowedExams || [],
      allowed_pages: student.allowedPages || [],
      allowed_pdfs: student.allowedPdfs || [],
      passes: student.passes || [],
      pass_expiry: student.passExpiry || {},
      password_hash: student.passwordHash,
      password_salt: student.passwordSalt,
      supabase_auth_migrated: !!student.supabaseAuthMigrated,
      last_login_at: student.lastLoginAt
    });

  if (error) console.error("Failed to sync student to cloud:", fmtErr(error));
}

// PHASE 3b: two narrow SECURITY DEFINER RPCs (see phase3b_row_scoping.sql) that let the anonymous
// signup/login/reset flows below check an account's status and safely write credentials, now that
// `students` SELECT is scoped to "your own row or admin" and an anonymous request can no longer just
// read a row to find out whether it exists.
//
// student_login_precheck: read-only, never returns the row itself -- just enough to route the UI
// correctly (does an account exist, is it deactivated, has it activated the real Supabase Auth login).
async function studentLoginPrecheck(email) {
  const fallback = { row_exists: false, blocked: false, migrated: false, has_password: false };
  try {
    const { data, error } = await supabaseClient.rpc('student_login_precheck', { p_email: normalizeEmail(email) });
    if (error) { console.error('student_login_precheck failed:', fmtErr(error)); return fallback; }
    const row = Array.isArray(data) ? data[0] : data;
    return row || fallback;
  } catch (err) {
    console.error('student_login_precheck threw:', fmtErr(err));
    return fallback;
  }
}

// student_upsert_credentials: the ONLY write this app makes to an anonymous student's row before they
// have a real session. It touches name/password/migration-flag alone -- whether that lands on a
// brand-new row or an existing (possibly admin-pre-created, possibly already-entitled) one is decided
// atomically inside the function itself, and every entitlement column is left completely untouched
// either way (never even read, let alone written) so there is nothing here for a client-controlled
// payload to clobber. Returns the resulting full row (safe to hand back to the caller: by the time this
// runs, the caller has either just OTP-verified this email or is completing a same-session signup, the
// same trust level as a real login) or null on failure.
async function studentUpsertCredentials(email, passwordHash, passwordSalt, name, migrated, phone) {
  try {
    const { data, error } = await supabaseClient.rpc('student_upsert_credentials', {
      p_email: normalizeEmail(email),
      p_password_hash: passwordHash,
      p_password_salt: passwordSalt,
      p_name: name || null,
      p_migrated: !!migrated,
      p_phone: phone || null
    });
    if (error) { console.error('student_upsert_credentials failed:', fmtErr(error)); return null; }
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error('student_upsert_credentials threw:', fmtErr(err));
    return null;
  }
}
