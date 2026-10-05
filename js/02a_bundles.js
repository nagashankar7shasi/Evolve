    /* ----------------------------------------------------
       BUNDLES (editable passes). Student.passes holds bundle ids; student.passExpiry[id] holds an ISO date.
    ----------------------------------------------------- */
    function seedBundles() {
      const cp = (pricingMaster && pricingMaster.categoryPasses) || {};
      const cat = (id, name, price, planners, highlights, extra = {}) => ({
        id, name, price, validityDays: 365, allAccess: false,
        tagline: `Every ${name.replace(' Pass', '')} mock, including papers added later.`,
        categories: [id], papers: [], pages: [], pdfs: [], planners, features: ['mistakes', 'topic_builder'],
        highlights, active: true, featured: false, showOnHome: false, style: 'light', order: 10, ...extra
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
          active: true, featured: false, showOnHome: true, style: 'dark', order: 2
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

window.onload = async function() {
      // --- FETCH LIVE DATA FROM GITHUB JSON ---
      try {
        const response = await fetch('data.json');
        if (response.ok) {
          const liveData = await response.json();

          // 1. Support both backup format ('nav') and code format ('initialNav')
          const newNav = liveData.nav || liveData.initialNav;
          const newPages = liveData.pages || liveData.initialPages;
          const newCatalog = liveData.catalog || liveData.initialPapersCatalog;
          const newPricing = liveData.pricing || liveData.initialPricingMaster;
          const newPdfs = liveData.pdfs || liveData.initialPdfs;

          // 2. Overwrite state and update browser storage
          if (newNav) {
            navStructure = newNav;
            localStorage.setItem('kas_nav_menu', JSON.stringify(navStructure));
          }
          if (newPages) {
            customPages = newPages;
            localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));
          }
          if (newCatalog) {
            testsCatalog = newCatalog;
            localStorage.setItem('kas_tests_catalog', JSON.stringify(testsCatalog));
          }
          if (newPricing) {
            pricingMaster = newPricing;
            localStorage.setItem('kas_pricing_master', JSON.stringify(pricingMaster));
          }
          if (newPdfs) {
            pdfVault = newPdfs;
            localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));
          }
        }
      } catch (err) {
        console.warn("Could not fetch data.json. Using local storage or defaults.");
      }
      // ----------------------------------------

      // Resume normal startup sequence
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
        currentUser ? fetchCloudProgress() : Promise.resolve(),
        fetchCloudAllProgress(),   // admin-only bulk fetch so Student Directory summaries work
        fetchCloudPricingMaster(),
        fetchCloudAuthSettings(),
        fetchCloudFeatureAccess(),
        fetchCloudPlanners(),
        fetchCloudAnnouncements(),
        fetchCloudSiteBranding(),  // header logo/name/tagline — same generic app_settings pattern
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
        utr: s.utr || '',
        status: s.status || 'active',
        allowedExams: Array.isArray(s.allowed_exams) ? s.allowed_exams : [],
        allowedPages: Array.isArray(s.allowed_pages) ? s.allowed_pages : [],
        allowedPdfs: Array.isArray(s.allowed_pdfs) ? s.allowed_pdfs : [],
        allowedPlanners: Array.isArray(s.allowed_planners) ? s.allowed_planners : [],
        passes: Array.isArray(s.passes) ? s.passes : [],
        passExpiry: s.pass_expiry || {},
        passwordHash: s.password_hash || undefined,
        passwordSalt: s.password_salt || undefined,
        supabaseAuthMigrated: !!s.supabase_auth_migrated,
        createdAt: s.created_at,
        lastLoginAt: s.last_login_at
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
      .select('id, category, extra_categories, also_list_categories, active, delisted, title, price, scheme, scheduled_for, question_count'),
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
      // `questions` is intentionally left unset here — [] would look like "loaded, zero questions"
      // and silently mask a paper failing to load; leaving it undefined makes every loader below
      // treat this paper as "content not fetched yet" until ensurePaperQuestionsLoaded runs.
      return { id: t.id, category: t.category, extraCategories, alsoListCategories, active: t.active !== false, delisted: !!t.delisted, title: t.title, price: t.price, scheme, questionCount: +t.question_count || 0, scheduled_for: t.scheduled_for || null };
    });
  }

  // Pages
  const { data: pages } = pagesRes;
  if (pages && pages.length > 0) {
    customPages = pages.map(p => ({
      id: p.id, slug: p.slug, title: p.title, isGated: p.is_gated, price: p.price, content: p.content,
      parentId: p.parent_id, icon: p.icon, image: p.image, summary: p.summary, childStyle: p.child_style,
      order: p.order_num, showOnHome: p.show_on_home, bundleOnly: p.bundle_only, oldSlugs: p.old_slugs || []
    }));
  }

  // Bundles
  const { data: bdl } = bdlRes;
  if (bdl && bdl.length > 0) {
    bundles = bdl.map(b => ({
      id: b.id, name: b.name, price: b.price, validityDays: b.validity_days, allAccess: b.all_access,
      tagline: b.tagline, categories: b.categories, papers: b.papers, pages: b.pages, pdfs: b.pdfs,
      planners: b.planners, features: b.features, highlights: b.highlights, active: b.active,
      featured: b.featured, showOnHome: b.show_on_home, style: b.style, order: b.order_num
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
async function studentUpsertCredentials(email, passwordHash, passwordSalt, name, migrated) {
  try {
    const { data, error } = await supabaseClient.rpc('student_upsert_credentials', {
      p_email: normalizeEmail(email),
      p_password_hash: passwordHash,
      p_password_salt: passwordSalt,
      p_name: name || null,
      p_migrated: !!migrated
    });
    if (error) { console.error('student_upsert_credentials failed:', fmtErr(error)); return null; }
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error('student_upsert_credentials threw:', fmtErr(err));
    return null;
  }
}
