    /* ----------------------------------------------------
       3-. DEV CONSOLE LAYOUT, OVERVIEW, REVENUE
    ----------------------------------------------------- */
    let currentAdminPanel = localStorage.getItem('kas_admin_panel') || 'overview';

    // The Dev Console panels, Word Page Editor canvas, etc. used to ship inside index.html's
    // <main id="view-admin"> for every visitor, admin or not (132KB, ~47% of the page at the
    // time this was split out). That markup now lives in its own file, admin-console.html, at
    // the repo root, fetched and injected into the still-present-but-now-empty <main id=
    // "view-admin"> shell only once a visitor is confirmed to be an admin -- either at boot
    // (js/02a_bundles.js's window.onload, both before and after restoreSupabaseSession() resolves
    // isAdmin(), covering an already-logged-in admin device) or the moment a mid-session admin
    // login succeeds (navigate('admin') in js/09a_site_search.js). adminConsoleLoaded/
    // adminConsoleLoadPromise make repeat calls a cheap no-op instead of re-fetching or racing two
    // fetches against each other. Returns true only the one time it actually performs the
    // fetch+inject, so a caller can tell "just appeared" apart from "was already there" and decide
    // whether it still needs to paint the console's content (see paintAdminConsoleOnce below) --
    // window.onload's existing render calls don't need that signal since they already sit later in
    // the same function, in their original order, and now simply find real DOM once this has run.
    // NOTE: the hardcoded ?v= below is index.html's own cache-bust number, bumped by hand in
    // step with every other ?v=N tag in index.html (see CLAUDE.md) -- there's no shared JS
    // constant for it, so bumping one without the other means this fetch keeps serving a stale
    // cached admin-console.html after a change to it.
    let adminConsoleLoaded = false;
    let adminConsoleLoadPromise = null;
    async function ensureAdminConsoleLoaded() {
      if (adminConsoleLoaded) return false;
      if (adminConsoleLoadPromise) return adminConsoleLoadPromise;
      adminConsoleLoadPromise = (async () => {
        const shell = document.getElementById('view-admin');
        if (!shell) return false; // shouldn't happen -- the empty shell ships in every index.html
        try {
          const res = await fetch('admin-console.html?v=85');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          shell.innerHTML = await res.text();
          adminConsoleLoaded = true;
          // Wires up the Word Page Editor's canvas listeners (keydown for the multi-column
          // Enter-key escape, live word count, and image paste/drag-drop/click handling), which
          // all used to attach at script-parse time directly against #word-editor-canvas -- fine
          // while it was always inline in index.html, broken (silently -- no error, just dead
          // features) now that it only exists from this point on. See the comments on each of
          // these three functions (js/08_word_page_creator.js) for the bugs this fixes.
          if (typeof attachWordEditorCanvasKeydownHandler === 'function') attachWordEditorCanvasKeydownHandler();
          if (typeof wireWordCount === 'function') wireWordCount();
          if (typeof wireEditorImages === 'function') wireEditorImages();
          return true;
        } catch (err) {
          console.error('Failed to load admin-console.html', fmtErr(err));
          shell.innerHTML = '<p class="text-center text-red-600 py-10">Couldn\'t load the admin console. Please refresh to try again.</p>';
          return false;
        } finally {
          adminConsoleLoadPromise = null; // a failed load should be retryable on the next call
        }
      })();
      return adminConsoleLoadPromise;
    }

    // One-time paint of the admin console's content from whatever's already in memory, run exactly
    // once, right after admin-console.html's shell is first filled in. Mirrors the render calls that
    // already sit later in window.onload for the common "admin already logged in on this device"
    // boot path (those just work once ensureAdminConsoleLoaded() has run early enough) -- this
    // covers the other path, a mid-session admin login via the modal, where boot already ran and
    // skipped all of them (the console wasn't there yet for them to render into).
    function paintAdminConsoleOnce() {
      // BUG (found 2026-10-17, same root cause as the window.onload boot-order fix in PR #65):
      // tests-list-filter and studio-category (js/06_exam_pages_test_ingestion.js) are filled in
      // by populateAllCategoryDropdowns(), called unconditionally in window.onload's boot
      // sequence -- which already ran, and no-opped, for a mid-session admin login (the console
      // wasn't in the DOM yet for it to populate). Without this call here, those two selects would
      // stay permanently empty for that login path, same dead-feature pattern as the Word Editor
      // canvas listeners fixed in #66.
      if (typeof populateAllCategoryDropdowns === 'function') populateAllCategoryDropdowns();
      if (typeof fetchCloudPageTemplates === 'function') fetchCloudPageTemplates();
      renderGranularNavTree();
      renderPagesList();
      renderPdfVault();
      renderFeatureAccessAdmin();
      renderPlannersAdmin();
      resetMenuForm();
      renderPricingMasterSettings();
      resetWordEditorToNew();
      if (typeof hydrateBrandingAdmin === 'function') hydrateBrandingAdmin();
      if (typeof renderCouponsAdmin === 'function') renderCouponsAdmin();
      if (typeof renderMainsQuestionsAdmin === 'function') renderMainsQuestionsAdmin();
      if (typeof renderStudentDirectoryTable === 'function') renderStudentDirectoryTable();
      showAdminPanel(currentAdminPanel);
    }

    function showAdminPanel(id) {
      const panels = document.querySelectorAll('#admin-panels [data-panel]');
      if (![...panels].some(p => p.dataset.panel === id)) id = 'overview';
      currentAdminPanel = id;
      localStorage.setItem('kas_admin_panel', id);
      panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== id));
      document.querySelectorAll('.admin-nav-btn').forEach(b => {
        const on = b.dataset.panelLink === id;
        b.classList.toggle('bg-slate-900', on);
        b.classList.toggle('text-white', on);
        b.classList.toggle('font-bold', on);
        b.classList.toggle('hover:bg-slate-100', !on);
        b.classList.toggle('text-slate-700', !on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      const sel = document.getElementById('admin-panel-select');
      if (sel) sel.value = id;
      if (id === 'overview') renderOverview();
      if (id === 'revenue') renderRevenue();
      if (id === 'backup') renderStorageUsage();
      if (id === 'payments') renderPaymentOrders();
      if (id === 'coupons') renderCouponsAdmin();
      if (id === 'mains') { renderMainsQuestionsAdmin(); mainsAiSettingsInit(); mainsHumanEvalQueueInit(); mainsAccessPriceInit(); }
      if (id === 'mains_tests') { renderMainsTestPapersAdmin(); mtpPopulateCategorySelect(MAINS_CATEGORY_IDS[0]); }
      if (id === 'students') renderStudentDirectoryTable();
      if (id === 'home') renderHomeConfigAdmin();
      if (id === 'email') { renderEmailTemplatesAdmin(); setEmailTab('templates'); }
      if (id === 'tests') {
        // Full question content (for editing/validation/counts) is fetched once here, when the
        // admin actually opens this panel — not on every visitor's page load. First paint shows a
        // brief loading note only the very first time; after that it's already cached.
        const root = document.getElementById('tests-catalog-list');
        if (root && !_fullTestsCatalogLoadedForAdmin) root.innerHTML = '<p class="text-slate-400 text-center py-6">Loading full paper details…</p>';
        ensureFullTestsCatalogForAdmin().then(renderTestsCatalogAdmin);
      }
      if (id === 'examcats') renderExamCategoriesAdmin();
      if (id === 'feedback') renderFeedbackAdmin();
      if (id === 'branding') hydrateBrandingAdmin();
      // Each tab only knows what it fetched at load time (no realtime sync) -- a payment approved
      // or access edited on another device/tab wouldn't show up here otherwise, which is exactly
      // what the manual "Refresh from cloud" button on this panel exists for (see
      // refreshStudentDataFromCloud in 03e_feedback.js). Doing it automatically on every visit to
      // this tab removes the need to remember to click it first. The button stays, for a manual
      // re-check while already on the tab.
      if (id === 'entitlements' && typeof refreshStudentDataFromCloud === 'function') refreshStudentDataFromCloud();
      const view = document.getElementById('view-admin');
      if (view && !view.classList.contains('hidden')) window.scrollTo(0, 0);
    }

    function rupees(n) {
      return '₹' + Math.round(n || 0).toLocaleString('en-IN');
    }
    function orderTime(o) {
      return new Date(o.status === 'approved' ? (o.decidedAt || o.createdAt) : o.createdAt);
    }
    function statCard(label, value, sub = '', onclick = '') {
      return `<${onclick ? `button onclick="${onclick}"` : 'div'} class="text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-sm ${onclick ? 'hover:border-amber-500 transition' : ''}">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${label}</div>
        <div class="text-2xl font-black text-slate-900 mt-1">${value}</div>
        ${sub ? `<div class="text-[11px] text-slate-500 mt-0.5">${sub}</div>` : ''}
      </${onclick ? 'button' : 'div'}>`;
    }

    function renderOverview() {
      const box = document.getElementById('ov-cards');
      if (!box) return;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekAgo = new Date(now - 7 * 86400000);
      // Complimentary approvals grant access but aren't real money — excluded here so "Collected"
      // and the payment count stay honest instead of being inflated by waived-fee grants.
      const approved = paymentOrders.filter(o => o.status === 'approved' && !o.complimentary);
      const pending = paymentOrders.filter(o => o.status === 'pending');
      const monthRev = approved.filter(o => orderTime(o) >= monthStart).reduce((n, o) => n + orderNetAmount(o), 0);
      const holders = studentDirectory.filter(st => activeBundlesFor(st).length).length;
      const newStudents = studentDirectory.filter(st => st.createdAt && new Date(st.createdAt) >= weekAgo).length;
      const testsWeek = userAttempts.filter(a => attemptTime(a) >= weekAgo.getTime()).length;
      // site_visit_counts.day is the DB server's (UTC) calendar day -- see sql/add_site_visit_counter.sql.
      // "Unique" is a device-level approximation (one count per browser per day), not real analytics.
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayVisits = (siteVisitCounts.find(v => v.day === todayStr) || {}).count || 0;
      const totalVisits = siteVisitCounts.reduce((n, v) => n + (v.count || 0), 0);
      box.innerHTML =
        statCard('Payments waiting', pending.length, pending.length ? `${rupees(pending.reduce((n, o) => n + (+o.amount || 0), 0))} to verify` : 'All caught up', "showAdminPanel('payments')") +
        statCard('Collected this month', rupees(monthRev), `${approved.filter(o => orderTime(o) >= monthStart).length} payment(s)`, "showAdminPanel('revenue')") +
        statCard('Students', studentDirectory.length, `${newStudents} new this week · ${holders} with an active bundle`, "showAdminPanel('students')") +
        statCard('Tests taken', testsWeek, 'in the last 7 days') +
        statCard('Visitors today', todayVisits, `${totalVisits} all-time`);
      document.getElementById('ov-payments').innerHTML = paymentOrders.slice(0, 6).map(o => `
        <div class="flex justify-between gap-3 p-2 bg-slate-50 border rounded-lg">
          <span class="min-w-0 truncate"><b>${escapeHtml(o.name || o.email)}</b> · ${escapeHtml(o.title)}</span>
          <span class="shrink-0 font-mono">${rupees(o.amount)} <span class="px-1.5 rounded text-[10px] font-bold ${ORDER_STATUS_STYLE[o.status]}">${o.status}</span>${o.complimentary ? ' <span class="px-1.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800">Complimentary</span>' : ''}</span>
        </div>`).join('') || '<p class="text-slate-400">No payments yet.</p>';
      document.getElementById('ov-students').innerHTML = studentDirectory.slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6).map(st => `
        <button onclick="manageStudent('${escapeHtml(st.email)}')" class="w-full flex justify-between gap-3 p-2 bg-slate-50 border rounded-lg text-left hover:border-amber-500">
          <span class="min-w-0 truncate"><b>${escapeHtml(st.name || '—')}</b> · ${escapeHtml(st.email)}</span>
          <span class="shrink-0 text-slate-500">${st.createdAt ? fmtDate(st.createdAt) : ''}</span>
        </button>`).join('') || '<p class="text-slate-400">No students yet.</p>';
    }

    function revenueRange() {
      const period = document.getElementById('rev-period').value;
      const now = new Date();
      document.getElementById('rev-from-wrap').classList.toggle('hidden', period !== 'custom');
      document.getElementById('rev-to-wrap').classList.toggle('hidden', period !== 'custom');
      const y = now.getFullYear(), m = now.getMonth();
      if (period === 'month') return [new Date(y, m, 1), now, 'this month'];
      if (period === 'lastmonth') return [new Date(y, m - 1, 1), new Date(y, m, 1), 'last month'];
      if (period === '3m') return [new Date(y, m - 2, 1), now, 'the last 3 months'];
      if (period === 'fy') { const fy = m >= 3 ? y : y - 1; return [new Date(fy, 3, 1), now, `FY ${fy}–${String(fy + 1).slice(2)}`]; }
      if (period === 'custom') {
        const f = document.getElementById('rev-from').value, t = document.getElementById('rev-to').value;
        return [f ? new Date(f) : new Date(0), t ? new Date(new Date(t).getTime() + 86400000) : now, 'the chosen dates'];
      }
      return [new Date(0), now, 'all time'];
    }

    function ordersInRange() {
      const [from, to] = revenueRange();
      return paymentOrders.filter(o => { const t = orderTime(o); return t >= from && t < to; });
    }

    function renderRevenue() {
      if (!document.getElementById('rev-cards')) return;
      const [, , label] = revenueRange();
      const inRange = ordersInRange();
      // Complimentary approvals grant access but aren't real money received — excluded from every
      // sum/count on this screen so revenue reflects what was actually collected, not waived fees.
      const ok = inRange.filter(o => o.status === 'approved' && !o.complimentary);
      const total = ok.reduce((n, o) => n + orderNetAmount(o), 0);
      const pendingAll = paymentOrders.filter(o => o.status === 'pending');
      const buyers = new Set(ok.map(o => o.email)).size;
      document.getElementById('rev-cards').innerHTML =
        statCard('Collected', rupees(total), label) +
        statCard('Payments', ok.length, `${buyers} student(s)`) +
        statCard('Average payment', rupees(ok.length ? total / ok.length : 0)) +
        statCard('Waiting to verify', rupees(pendingAll.reduce((n, o) => n + (+o.amount || 0), 0)), `${pendingAll.length} payment(s), any date`, "showAdminPanel('payments')") +
        statCard('Rejected', inRange.filter(o => o.status === 'rejected').length, label);

      // last 12 months bar chart
      const now = new Date();
      const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
      const sums = months.map((d, i) => {
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return paymentOrders.filter(o => o.status === 'approved' && !o.complimentary && orderTime(o) >= d && orderTime(o) < next).reduce((n, o) => n + orderNetAmount(o), 0);
      });
      const max = Math.max(1, ...sums);
      const W = 720, H = 190, pad = 28, bw = (W - pad * 2) / 12;
      document.getElementById('rev-chart').innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="w-full min-w-[520px] h-auto" role="img" aria-label="Money collected per month over the last 12 months">
          ${sums.map((v, i) => {
            const h = Math.round((H - 50) * v / max);
            const x = pad + i * bw + 6, y = H - 26 - h;
            return `<rect x="${x}" y="${y}" width="${bw - 12}" height="${Math.max(h, v ? 2 : 0)}" rx="3" fill="${i === 11 ? '#f59e0b' : '#0f172a'}"><title>${months[i].toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}: ${rupees(v)}</title></rect>
              ${v ? `<text x="${x + (bw - 12) / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#475569">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</text>` : ''}
              <text x="${x + (bw - 12) / 2}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#64748b">${months[i].toLocaleDateString('en-IN', { month: 'short' })}</text>`;
          }).join('')}
          <line x1="${pad}" x2="${W - pad}" y1="${H - 26}" y2="${H - 26}" stroke="#cbd5e1" />
        </svg>`;

      const group = key => {
        const map = {};
        ok.forEach(o => { const k = key(o); (map[k] = map[k] || { n: 0, sum: 0 }); map[k].n++; map[k].sum += orderNetAmount(o); });
        return Object.entries(map).sort((a, b) => b[1].sum - a[1].sum);
      };
      const rowHtml = ([k, v]) => `<tr><td class="py-2 pr-3">${escapeHtml(k)}</td><td class="py-2 pr-3">${v.n}</td><td class="py-2 text-right font-mono font-bold">${rupees(v.sum)}</td></tr>`;
      const empty = '<tr><td colspan="3" class="py-4 text-center text-slate-400">No approved payments in this period.</td></tr>';
      document.getElementById('rev-by-item').innerHTML = group(o => o.title).map(rowHtml).join('') || empty;
      const typeName = { pass: 'Bundles', paper: 'Single papers', page: 'Pages', pdf: 'PDFs', mains: 'Mains access', mains_human_eval: 'Mains personal review' };
      document.getElementById('rev-by-type').innerHTML = group(o => typeName[o.type] || o.type).map(rowHtml).join('') || empty;
    }


    function exportPaymentsCSV() {
      const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = ordersInRange().map(o => [
        (o.createdAt || '').slice(0, 10), (o.decidedAt || '').slice(0, 10), o.receiptNo || '', o.name || '', o.email,
        o.title, o.type, o.amount, o.utr, o.status, o.rejectReason || '', o.complimentary ? 'Yes' : '', o.refundedAmount || '', o.refundReason || '', orderNetAmount(o)
      ].map(cell).join(','));
      const head = ['Submitted', 'Decided', 'Receipt', 'Name', 'Email', 'Item', 'Type', 'Amount (₹)', 'UTR', 'Status', 'Reject reason', 'Complimentary', 'Refunded (₹)', 'Refund reason', 'Net (₹)'].map(cell).join(',');
      downloadFile(`payments_${todayISO()}.csv`, '\ufeff' + [head, ...rows].join('\r\n'), 'text/csv;charset=utf-8');
    }

    async function renderStorageUsage() {
      const el = document.getElementById('storage-usage');
      if (!el) return;
      const used = Object.keys(localStorage).reduce((n, k) => n + (localStorage.getItem(k) || '').length, 0) * 2;
      let files = '';
      try {
        const keys = await FileStore.keys();
        let bytes = 0;
        for (const k of keys) { const b = await FileStore.get(k); bytes += b ? b.size : 0; }
        files = ` PDF file storage: ${keys.length} file(s), ${(bytes / 1048576).toFixed(1)} MB.`;
      } catch (err) { /* ignore */ }
      el.innerText = `Settings storage: ${(used / 1048576).toFixed(2)} MB of about 5 MB used (pages, pictures, students, payments).${files}`;
    }

