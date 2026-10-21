    /* ----------------------------------------------------
       6. CATEGORY-WISE EXAM PAGES & TEST INGESTION
    ----------------------------------------------------- */
    // Explicit display order for test papers (order_num on tests_catalog) -- replaces what used to
    // be no sort at all: the bulk catalog fetch has no ORDER BY, so papers appeared in whatever
    // arbitrary order Postgres happened to hand rows back in, with no relationship to title, price,
    // or upload date. Lower order sorts first; a title tiebreak keeps same-order papers (e.g. every
    // paper still on its backfilled default) in a stable, predictable sequence instead of whatever
    // order the catalog array happens to be in. Shared by the student-facing grid
    // (filterExamCategoryBase), the admin list (renderTestsCatalogAdmin), and the ▲/▼ quick-reorder
    // (moveTestPaper) so all three always agree on "what order is this in right now".
    function testCatalogSortCompare(a, b) {
      return (a.order || 0) - (b.order || 0) || (a.title || '').localeCompare(b.title || '');
    }

    // Renders the Exam Hub's category tabs from EXAM_CATEGORIES — replaces what used to be 4
    // hand-typed <button> elements. Preserves the exact class/data-category shape that
    // filterExamCategoryBase already expects, so the active-tab-highlighting logic needs no changes.
    function renderCategoryTabs() {
      const wrap = document.getElementById('exam-category-tabs');
      if (!wrap) return;
      // Only TOP-LEVEL categories get their own tab — a sub-category (parentId set, e.g. "KAS
      // Current Affairs" under KPSC KAS) nests under its parent's tab as a chip instead (see the
      // subcategory-chips rendering in filterExamCategoryBase), so the nav doesn't grow one tab per
      // sub-category.
      const cats = Object.values(EXAM_CATEGORIES).filter(c => c.active !== false && !c.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
      wrap.innerHTML = cats.map((c, i) => `
        <button onclick="filterExamCategory('${c.id}')" class="category-tab-btn flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg ${i === 0 ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'}" data-category="${c.id}">
          ${escapeHtml(c.name)}
        </button>`).join('');
    }

    // Fills every <select> that lists exam categories (tests admin filter, studio dropdown --
    // the legacy quick-upload form's own copy of this dropdown was retired along with that form).
    // Each caller passes whether to prepend an "All categories" option and what the
    // currently-selected value should be (so re-populating after an admin edits the category list
    // doesn't reset an in-progress selection).
    function populateCategoryDropdown(selectId, { includeAll = false, keepValue = true } = {}) {
      // NOTE: these dropdowns (tests-list-filter, studio-category) are all admin-only backend
      // controls, never shown to students. Deactivated ("not shown to students")
      // categories must still be fully manageable in the backend, so they're intentionally included
      // here (with a "(hidden)" marker) — only the genuinely student-facing renderCategoryTabs()
      // should filter them out.
      const sel = document.getElementById(selectId);
      if (!sel) return;
      const prevValue = keepValue ? sel.value : null;
      const allOption = includeAll ? '<option value="all">All categories</option>' : '';
      // Hierarchical order + a "↳" prefix on sub-categories, so e.g. "KAS Current Affairs" reads as
      // nested under "KPSC KAS" here too, not just in the Exam Categories admin list.
      sel.innerHTML = allOption + hierarchicalCategoryList().map(({ cat: c, depth }) =>
        `<option value="${c.id}">${depth ? '↳ ' : ''}${escapeHtml(c.name)}${c.active === false ? ' (hidden from students)' : ''}</option>`
      ).join('');
      if (prevValue && [...sel.options].some(o => o.value === prevValue)) sel.value = prevValue;
    }

    function populateAllCategoryDropdowns() {
      populateCategoryDropdown('tests-list-filter', { includeAll: true });
      // tests-list-filter starts every admin-console load empty (its DOM is freshly injected each
      // time -- see ensureAdminConsoleLoaded), so populateCategoryDropdown's own "keep the current
      // value" logic has nothing to keep yet and it silently falls back to the first option ("All
      // categories"). Restoring the admin's last choice here is what actually lets a category like
      // "Daily PIB Current Affairs" work as a standing, separate view of the Test Paper Studio list
      // instead of resetting to the full pile on every visit -- renderTestsCatalogAdmin() is what
      // writes kas_tests_list_filter, on every filter change.
      const savedFilter = localStorage.getItem('kas_tests_list_filter');
      const filterSel = document.getElementById('tests-list-filter');
      if (savedFilter && filterSel && [...filterSel.options].some(o => o.value === savedFilter)) {
        filterSel.value = savedFilter;
      }
      // Same standing-preference treatment as the category filter above, for the status quick-
      // filter (All/Active/Inactive/Delisted) -- its options are static HTML, not JS-populated, so
      // there's no populateCategoryDropdown() call to carry a value through; just restore it here.
      const savedStatusFilter = localStorage.getItem('kas_tests_list_status_filter');
      const statusSel = document.getElementById('tests-list-status-filter');
      if (savedStatusFilter && statusSel && [...statusSel.options].some(o => o.value === savedStatusFilter)) {
        statusSel.value = savedStatusFilter;
      }
      populateCategoryDropdown('studio-category');
    }

    function filterExamCategoryBase(catId, subCatId) {
      // A direct link to a sub-category (e.g. from search) passes the child's own id as `catId` with
      // no `subCatId` — normalize that to "parent tab active, that child's chip selected" so the tab
      // row and chip row both end up in the right state either way this gets called.
      let rootId = catId;
      let sub = subCatId || null;
      const directInfo = EXAM_CATEGORIES[catId];
      if (directInfo && directInfo.parentId) {
        rootId = directInfo.parentId;
        sub = subCatId || catId;
      }
      selectedCategory = rootId;
      selectedSubCategory = sub;
      const catInfo = EXAM_CATEGORIES[rootId] || Object.values(EXAM_CATEGORIES)[0] || { name: rootId, desc: '' };

      document.querySelectorAll('.category-tab-btn').forEach(btn => {
        if (btn.dataset.category === rootId) {
          btn.className = "category-tab-btn flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg bg-slate-900 text-white shadow-sm";
        } else {
          btn.className = "category-tab-btn flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg bg-white text-slate-700 hover:bg-slate-200";
        }
      });

      // Sub-category chip row: only shown when the selected top-level category actually has children.
      const subWrap = document.getElementById('exam-subcategory-chips');
      const children = categoryChildren(rootId).filter(c => c.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
      if (subWrap) {
        if (children.length) {
          subWrap.classList.remove('hidden');
          const chipCls = active => `px-3 py-1.5 rounded-full border ${active ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`;
          subWrap.innerHTML = [`<button onclick="filterExamCategoryBase('${rootId}', null)" class="${chipCls(!selectedSubCategory)}">All ${escapeHtml(catInfo.name)}</button>`]
            .concat(children.map(c => `<button onclick="filterExamCategoryBase('${rootId}', '${c.id}')" class="${chipCls(selectedSubCategory === c.id)}">${escapeHtml(c.name)}</button>`))
            .join('');
        } else {
          subWrap.classList.add('hidden');
          subWrap.innerHTML = '';
        }
      }

      applyPricingLabels();
      // Inactive papers are fully hidden from browsing (isTestUnlockedForUser blocks opening them
      // too, for non-admins). The visible scope is either the one selected sub-category, or — when
      // "All" is selected — the parent category plus every one of its sub-categories rolled up
      // together. A paper shows if its primary Category falls in that scope, OR it was explicitly
      // opted into cross-listing there via alsoListCategories (see studioRefreshAlsoListCategoryOptions
      // for why this is no longer the same thing as extraCategories/question-bank applicability).
      const scope = categoryAndDescendants(selectedSubCategory || rootId);
      // Delisted papers (Studio's "Delist" toggle) are skipped here too, same as inactive ones — but
      // unlike inactive, a delisted paper stays fully purchasable/openable via a direct link or a
      // Test paper card on a page (see testPaperCardHtml/hydratePageCards); it just doesn't clutter
      // this browse grid.
      const papers = testsCatalog.filter(p => p.active !== false && !p.delisted &&
        (scope.includes(p.category) || (p.alsoListCategories || []).some(c => scope.includes(c))))
        .sort(testCatalogSortCompare);

      const bannerInfo = (selectedSubCategory && EXAM_CATEGORIES[selectedSubCategory]) || catInfo;
      document.getElementById('cat-banner-title').innerText = `${bannerInfo.name} Exam Room`;
      document.getElementById('cat-banner-desc').innerText = bannerInfo.desc;
      document.getElementById('cat-banner-count').innerText = `${papers.length} Active Papers`;

      const grid = document.getElementById('tests-catalog-grid');
      grid.innerHTML = '';

      if (papers.length === 0) {
        grid.innerHTML = `
          <div class="col-span-2 p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
            <span class="text-3xl">📭</span>
            <h4 class="font-bold text-slate-800">No Mock Papers Yet in ${catInfo.name}</h4>
            <p class="text-xs text-slate-500">Log in as Developer to upload mock papers into this exam room.</p>
          </div>
        `;
        return;
      }

      // ---- Split into unlocked (shown flat, exactly as every paper always has) vs locked (grouped
      // by the bundle(s) that would unlock them, so a category with a dozen locked papers behind one
      // ₹499 pass doesn't read as a dozen separate decisions) ----
      const unlockedPapers = [];
      const groupMap = new Map(); // bundleId -> { bundle, papers: [] }
      const individualPapers = []; // locked papers no active bundle currently covers -- sold one at a time
      papers.forEach(paper => {
        if (isTestUnlockedForUser(paper.id)) { unlockedPapers.push(paper); return; }
        const covering = bundlesCoveringPaper(paper);
        if (covering.length) {
          // A paper can legitimately be covered by more than one bundle at once (e.g. a cheaper
          // subset pass carved out of a larger one) -- that's two different ways to unlock the same
          // content, not a bug, so it's listed under every one of them rather than picking a single
          // "owning" bundle.
          covering.forEach(b => {
            if (!groupMap.has(b.id)) groupMap.set(b.id, { bundle: b, papers: [] });
            groupMap.get(b.id).papers.push(paper);
          });
        } else {
          individualPapers.push(paper);
        }
      });

      // Only the first time a paper is actually rendered gets the canonical `paper-card-<id>` DOM id
      // (site search / goToSearchResult looks it up by this id) -- a paper duplicated across two
      // bundle groups would otherwise produce two elements with the same id, which is invalid HTML
      // and would make getElementById unpredictable about which one it returns.
      const idClaimed = new Set();
      const cardHtml = paper => {
        let domId = null;
        if (!idClaimed.has(paper.id)) { idClaimed.add(paper.id); domId = 'paper-card-' + paper.id; }
        return testGridPaperCardHtml(paper, catInfo, domId);
      };

      let html = '';
      unlockedPapers.forEach(p => { html += cardHtml(p); });

      // Cheapest way to unlock something first -- same ordering bundlesForSale already uses
      // elsewhere in the app.
      const groups = [...groupMap.values()].sort((a, b) => a.bundle.price - b.bundle.price);
      groups.forEach(({ bundle, papers: groupPapers }) => {
        html += testGroupTileHtml({
          groupId: 'bdl_' + bundle.id,
          icon: '📦',
          title: bundle.name,
          subtitle: `${groupPapers.length} locked paper${groupPapers.length === 1 ? '' : 's'}`,
          priceHtml: `<span class="text-xs font-mono font-bold text-slate-900 shrink-0">₹${bundle.price}</span>`,
          actionHtml: `<button onclick="event.stopPropagation(); openBundleCheckout('${bundle.id}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shrink-0">Unlock all</button>`,
          bodyCardsHtml: groupPapers.map(cardHtml).join('')
        });
      });

      // Leftover locked papers no active bundle covers -- a plain declutter fold, not a purchase
      // unit, so no price/buy action on the header itself (each paper card underneath still has its
      // own "Unlock Paper (₹price)" button exactly as before grouping existed).
      if (individualPapers.length) {
        html += testGroupTileHtml({
          groupId: 'individual',
          icon: '📄',
          title: 'Individual Papers',
          subtitle: `${individualPapers.length} paper${individualPapers.length === 1 ? '' : 's'}, sold separately`,
          priceHtml: '',
          actionHtml: '',
          bodyCardsHtml: individualPapers.map(cardHtml).join('')
        });
      }

      grid.innerHTML = html;
    }

    // One paper's card, shared by the flat unlocked list and every bundle/individual group below.
    // `domId` is the DOM id to give the wrapper (goToSearchResult looks a paper up by
    // `paper-card-<id>`) -- pass null to render the same paper again (a locked paper duplicated
    // across two covering bundles) without creating a second element with a duplicate id.
    function testGridPaperCardHtml(paper, catInfo, domId) {
      const s = paper.scheme;
      // Uses the lightweight questionCount metadata, not paper.questions — the actual question
      // content (with answers) isn't fetched for browsing cards, locked or unlocked; see
      // fetchCloudContent/ensurePaperQuestionsLoaded.
      const maxMarks = (paper.questionCount * s.marksCorrect).toFixed(0);
      const isUnlocked = isTestUnlockedForUser(paper.id);
      // Separate from isUnlocked -- a paper can be fully owned/free and still not be live yet (see
      // isTestLiveYet's own comment). Only matters for the unlocked branch below: a locked paper's
      // buy flow is untouched, since paying for it ahead of the launch date is still fine.
      const liveYet = isTestLiveYet(paper);
      const liveDateStr = paper.scheduled_for ? new Date(paper.scheduled_for).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      // bundle-only papers never show a standalone price -- their price column is optional/
      // informational at best, since there's no individual-buy path for isTestUnlockedForUser to
      // gate on. A "BUNDLE" badge instead of a ₹ amount keeps the card from implying a price that
      // can't actually be paid on its own. "Coming Soon" is checked first and overrides this
      // entirely -- it's a separate, independent flag (see studioPublish's comment) for "this
      // paper is written but not ready for students yet", regardless of price/bundle/unlock state.
      const priceLabel = paper.comingSoon ? '⏱ COMING SOON' : (paper.bundleOnly ? 'BUNDLE' : (paper.price === 0 ? 'Free' : `₹${paper.price}`));
      const hasRevisionNotes = !!(paper.revisionNotes && (paper.revisionNotes.text || paper.revisionNotes.fileUrl));
      return `
        <div ${domId ? `id="${domId}"` : ''} class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between transition-shadow">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">${s.examBadge}</span>
              <span class="text-xs font-mono font-bold ${paper.comingSoon ? 'text-slate-400' : (paper.bundleOnly ? 'text-violet-600' : (paper.price === 0 ? 'text-emerald-600' : 'text-slate-900'))}">${priceLabel}</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mt-2">${paper.title}</h3>
            <p class="text-xs text-slate-500 mt-0.5 font-mono">${paper.questionCount} Bilingual Questions • ${s.duration} Mins</p>
            ${(EXAM_CATEGORIES[paper.category] || catInfo).showScoringPattern !== false ? `
            <div class="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1 border border-slate-100 font-mono">
              <div class="flex justify-between"><span>Marks per Correct:</span><b class="text-emerald-600">+${s.marksCorrect.toFixed(2)}</b></div>
              <div class="flex justify-between"><span>Penalty per Wrong:</span><b class="text-rose-600">-${s.marksWrong.toFixed(3)}</b></div>
              <div class="flex justify-between font-sans pt-1 border-t"><span>Max Attainable Marks:</span><b class="text-slate-900">${maxMarks}</b></div>
            </div>` : ''}
          </div>
          <div class="mt-6 space-y-2">
            ${hasRevisionNotes ? `
              <button onclick="openRevisionNotes('${paper.id}')" class="w-full py-2.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition">
                📄 Revision Notes
              </button>
            ` : ''}
            ${paper.comingSoon ? `
              <div class="w-full py-3 bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs rounded-lg text-center">
                ⏱ Coming Soon
              </div>
            ` : (isUnlocked && !liveYet ? `
              <div class="w-full py-3 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-lg text-center" title="You already have access -- it just isn't open yet">
                🗓 Live on ${liveDateStr}
              </div>
            ` : isUnlocked ? `
              <button onclick="openExamModePicker('${paper.id}')" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow">
                Launch OMR Mock Exam
              </button>
              <button onclick="launchExamPaperPractice('${paper.id}')" class="w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-lg transition" title="Untimed, one question at a time, answer shown immediately">
                🎯 Attempt in Practice Mode
              </button>
            ` : (paper.bundleOnly ? bundleOnlyUnlockCta(paper) : `
              <button onclick="openPaperCheckout('${paper.id}')" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5">
                <span>🔒 Unlock Paper (₹${paper.price})</span>
              </button>
            `))}
          </div>
        </div>`;
    }

    // Shows a paper's optional revision notes (typed text and/or an uploaded PDF/image, authored in
    // Test Paper Studio) in a lightweight modal. Reading these never requires owning the paper --
    // they're free supporting content, same spirit as a free-demo paper. Shared by both paper-card
    // renderers (this file's testGridPaperCardHtml and 08_word_page_creator.js's testPaperCardHtml).
    function openRevisionNotes(paperId) {
      const paper = testsCatalog.find(p => p.id === paperId);
      const notes = paper && paper.revisionNotes;
      if (!notes || (!notes.text && !notes.fileUrl)) return;
      const body = document.getElementById('revision-notes-modal-body');
      const parts = [];
      if (notes.text) parts.push(`<div class="whitespace-pre-wrap leading-relaxed">${escapeHtml(notes.text)}</div>`);
      if (notes.fileUrl) {
        parts.push(`<a href="${escapeHtml(notes.fileUrl)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition">📎 Open ${escapeHtml(notes.fileName || 'attachment')}</a>`);
      }
      body.innerHTML = parts.join('');
      document.getElementById('revision-notes-modal-title').innerText = `📄 ${paper.title}`;
      openModal('revision-notes-modal');
    }

    // ---- Dashboard "Daily Practice" boxes (students only) ----
    // One box per exam category the admin flagged with dailyPracticeBox (Exam Categories admin
    // panel) -- a quick, direct way to practice a daily series (e.g. "Daily PIB Current Affairs")
    // without going through the Test Papers grid at all.
    //
    // A paper only becomes a candidate once it has scheduled_for set, is within the last 30 days,
    // and is actually live yet (same "goes live on <date>" rule as everywhere else) -- a paper with
    // no scheduled_for never appears here (there'd be no date to show or sort by) but stays fully
    // reachable from the normal Test Papers grid, same as always.
    function dailyPracticeCandidates(catId) {
      const now = Date.now();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      return testsCatalog
        .filter(p => p.category === catId && p.active !== false && !p.delisted && p.scheduled_for)
        .map(p => ({ p, t: new Date(p.scheduled_for).getTime() }))
        .filter(({ t }) => !isNaN(t) && t <= now && t >= now - THIRTY_DAYS_MS)
        .sort((a, b) => b.t - a.t)
        .map(({ p }) => p);
    }

    function renderDailyPracticeBoxes() {
      const section = document.getElementById('dash-daily-practice-section');
      if (!section) return;
      const student = getCurrentStudent();
      const cats = Object.values(EXAM_CATEGORIES).filter(c => c.dailyPracticeBox);
      if (!student || !cats.length) { section.classList.add('hidden'); return; }
      section.classList.remove('hidden');
      section.innerHTML = cats.map(c => {
        const papers = dailyPracticeCandidates(c.id);
        if (!papers.length) {
          return `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 class="font-bold text-sm text-slate-900 mb-1">📰 ${escapeHtml(c.name)}</h3>
              <p class="text-xs text-slate-400 italic">Nothing posted in the last 30 days yet. Check back soon.</p>
            </div>`;
        }
        const selId = `daily-pick-${c.id}`;
        return `
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <h3 class="font-bold text-sm text-slate-900 mb-1">📰 ${escapeHtml(c.name)}</h3>
            <p class="text-[11px] text-slate-500 mb-3">Untimed, one question at a time, answer shown immediately.</p>
            <select id="${selId}" class="w-full px-2.5 py-1.5 border rounded-lg bg-white outline-none text-xs mb-3">
              ${papers.map((p, i) => {
                const dateStr = new Date(p.scheduled_for).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                const lock = isTestUnlockedForUser(p.id) ? '' : ' 🔒';
                return `<option value="${p.id}">${dateStr}${i === 0 ? ' (Latest)' : ''} — ${escapeHtml(p.title)}${lock}</option>`;
              }).join('')}
            </select>
            <button onclick="startDailyPracticeFromSelect('${selId}')" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs mt-auto">
              🎯 Start Practice
            </button>
            <button onclick="filterExamCategory('${c.id}'); navigate('tests');" class="w-full mt-2 text-[11px] text-slate-400 hover:text-slate-700 hover:underline">Browse all / older days →</button>
          </div>`;
      }).join('');
    }

    function startDailyPracticeFromSelect(selId) {
      const sel = document.getElementById(selId);
      if (!sel || !sel.value) return;
      launchExamPaperPractice(sel.value);
    }

    // A collapsible "folder" tile for a bundle's (or the leftover "Individual Papers" group's) locked
    // papers -- spans both grid columns as one row, with its own 2-column sub-grid of paper cards
    // inside. Collapsed by default (see toggleTestGroup); goToSearchResult expands one on demand when
    // the paper a search matched is inside it.
    function testGroupTileHtml({ groupId, icon, title, subtitle, priceHtml, actionHtml, bodyCardsHtml }) {
      return `
        <div class="md:col-span-2 border border-slate-200 rounded-2xl bg-white overflow-hidden" data-group-id="${groupId}">
          <div onclick="toggleTestGroup('${groupId}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleTestGroup('${groupId}');}" class="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition cursor-pointer">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-2xl">${icon}</span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(title)}</div>
                <div class="text-xs text-slate-500">${escapeHtml(subtitle)}</div>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              ${priceHtml}
              ${actionHtml}
              <span class="test-group-chevron text-slate-400 transition-transform">▾</span>
            </div>
          </div>
          <div class="test-group-body hidden px-5 pb-5 pt-1 border-t border-slate-100">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${bodyCardsHtml}</div>
          </div>
        </div>`;
    }

    // forceOpen: explicit true/false to set the state outright (used by goToSearchResult to expand a
    // group on arrival); omitted, it just toggles whatever the button click implies.
    function toggleTestGroup(groupId, forceOpen) {
      const groupEl = document.querySelector(`[data-group-id="${groupId}"]`);
      if (!groupEl) return;
      const body = groupEl.querySelector('.test-group-body');
      const chevron = groupEl.querySelector('.test-group-chevron');
      const shouldOpen = forceOpen !== undefined ? forceOpen : body.classList.contains('hidden');
      body.classList.toggle('hidden', !shouldOpen);
      if (chevron) chevron.textContent = shouldOpen ? '▴' : '▾';
    }

    // Used by goToSearchResult: if the paper a search matched only rendered inside a collapsed bundle
    // (or "Individual Papers") group, open that group before scrolling to/highlighting the card --
    // otherwise the scroll would land on a hidden element.
    function expandTestGroupContainingPaper(paperId) {
      const el = document.getElementById('paper-card-' + paperId);
      if (!el) return;
      const body = el.closest('.test-group-body');
      if (!body || !body.classList.contains('hidden')) return;
      const groupEl = body.closest('[data-group-id]');
      if (groupEl) toggleTestGroup(groupEl.dataset.groupId, true);
    }

    // handleExamCategoryChange() was only wired to the legacy "Quick upload" form's category
    // select (removed from index.html along with that form) -- removed here too since nothing
    // else calls it.

    // ---- Uploaded papers: list, edit price/title, delete with cascade ----
    // Bulk-select state (module-scope, not tied to one render -- survives filter/search changes so
    // an admin can select across two different filtered views and act on the union; it's only ever
    // cleared explicitly, by "Clear" or after a bulk action completes).
    let bulkSelectedPaperIds = new Set();
    // Which split-sibling groups (see split_group_id) are expanded right now. Collapsed by default
    // -- that's the whole point of grouping, declutter first, expand on demand.
    let expandedSplitGroups = new Set();

    // Papers with problems get flagged so admin can spot the ones that don't work. Shared by the
    // per-row renderer below and by nothing else, so it's a plain local function, not a global one.
    function testCatalogAdminProblem(p) {
      if (!Array.isArray(p.questions) || p.questions.length === 0) return 'No questions attached';
      if (!p.scheme || typeof p.scheme !== 'object') return 'Marking scheme missing';
      const bad = p.questions.filter(q => !q || !q.correct || !/^[A-D]$/i.test(q.correct));
      if (bad.length) return `${bad.length} question${bad.length > 1 ? 's are' : ' is'} missing a valid Correct letter (A-D)`;
      return null;
    }

    // One paper's row, shared by the flat (ungrouped) list and by every split-sibling group's
    // expanded body below. `atTop`/`atBottom` come from the paper's index in the OVERALL filtered
    // `rows` list (not its position within a group), since moveTestPaper() swaps order_num with
    // whatever's adjacent in that same flat, filtered sequence -- nesting a paper inside a group
    // header must never change what "adjacent" means for the ▲▼ buttons.
    function testCatalogAdminRowHtml(p, atTop, atBottom) {
      const catName = c => (EXAM_CATEGORIES[c] && EXAM_CATEGORIES[c].name) || c || '—';
      const p_issue = testCatalogAdminProblem(p);
      const inBundles = (bundles || []).filter(b => (b.papers || []).includes(p.id)).map(b => b.name);
      const isInactive = p.active === false;
      const isDelisted = !!p.delisted;
      const isBundleOnly = !!p.bundleOnly;
      const isChecked = bulkSelectedPaperIds.has(p.id);
      return `<div class="border ${p_issue ? 'border-rose-300 bg-rose-50' : isInactive ? 'border-slate-200 bg-slate-100' : 'border-slate-200 bg-white'} rounded-lg p-2.5 ${isInactive ? 'opacity-70' : ''}">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2 min-w-0 flex-1">
              <input type="checkbox" onchange="toggleBulkSelect('${p.id}', this.checked)" ${isChecked ? 'checked' : ''} class="mt-1 shrink-0" title="Select for bulk actions" />
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-900 truncate">${escapeHtml(p.title || 'Untitled paper')}</div>
                <div class="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                  ${isInactive ? '<span class="font-bold uppercase tracking-wider bg-slate-700 text-white px-1.5 py-0.5 rounded">Inactive</span>' : ''}
                  ${isDelisted ? '<span class="font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded" title="Hidden from the Test Papers grid and search — still purchasable via a direct link or a page\'s Test paper card">🙈 Delisted</span>' : ''}
                  ${isBundleOnly ? '<span class="font-bold uppercase tracking-wider bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded" title="Not free, but never sold individually — reachable only via a covering bundle">🎁 Bundle-only</span>' : ''}
                  <span class="font-mono uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${escapeHtml(catName(p.category))}</span>
                  ${(p.extraCategories || []).map(c => `<span class="font-mono uppercase tracking-wider bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded" title="Feeds the question bank of ${escapeHtml(catName(c))}">🏦 ${escapeHtml(catName(c))}</span>`).join('')}
                  ${(p.alsoListCategories || []).map(c => `<span class="font-mono uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded" title="Also listed as its own paper + unlockable under ${escapeHtml(catName(c))}">🔗 ${escapeHtml(catName(c))}</span>`).join('')}
                  <span class="font-mono text-slate-400" title="Display order — lower sorts first. Edit exactly in the Studio, or nudge with ▲▼.">#${p.order || 0}</span>
                  <span>${(Array.isArray(p.questions) && p.questions.length) ? p.questions.length : (p.questionCount || 0)} Qs</span>
                  <span>${p.price === 0 ? '<b class="text-emerald-700">Free</b>' : '₹' + p.price}</span>
                  ${p.scheme && p.scheme.duration ? `<span>${p.scheme.duration} min</span>` : ''}
                  ${p.scheduled_for ? `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">🗓 Live ${new Date(p.scheduled_for).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                  ${inBundles.length ? `<span class="text-slate-500">In ${inBundles.length} bundle${inBundles.length > 1 ? 's' : ''}: ${escapeHtml(inBundles.slice(0, 2).join(', '))}${inBundles.length > 2 ? '…' : ''}</span>` : ''}
                </div>
                ${p_issue ? `<div class="mt-1 text-[11px] font-bold text-rose-700">⚠ ${escapeHtml(p_issue)}. Re-upload the CSV to fix.</div>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="moveTestPaper('${p.id}', -1)" ${atTop ? 'disabled' : ''} class="px-1.5 py-1 border ${atTop ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 hover:bg-slate-100 text-slate-700'} font-bold rounded" title="Move up in this list (nudges display order)">▲</button>
              <button onclick="moveTestPaper('${p.id}', 1)" ${atBottom ? 'disabled' : ''} class="px-1.5 py-1 border ${atBottom ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 hover:bg-slate-100 text-slate-700'} font-bold rounded" title="Move down in this list (nudges display order)">▼</button>
              <button onclick="openStudio('${p.id}')" class="px-2 py-1 border border-amber-300 hover:bg-amber-100 text-amber-800 font-bold rounded" title="Open in studio to edit">✎</button>
              <button onclick="downloadTestPaperCsv('${p.id}')" class="px-2 py-1 border border-emerald-300 hover:bg-emerald-100 text-emerald-700 font-bold rounded" title="Download this paper's questions as CSV — fix mistakes in a spreadsheet, then re-upload">⬇</button>
              <button onclick="openStudio('${p.id}', true)" class="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded" title="Duplicate as a new paper">⎘</button>
              <button onclick="toggleTestPaperActive('${p.id}')" class="px-2 py-1 border ${isInactive ? 'border-emerald-300 hover:bg-emerald-100 text-emerald-700' : 'border-slate-300 hover:bg-slate-100 text-slate-700'} font-bold rounded" title="${isInactive ? 'Reactivate — visible and openable again' : 'Deactivate — hides it and blocks opening for everyone'}">${isInactive ? '▶' : '⏸'}</button>
              <button onclick="toggleTestPaperDelisted('${p.id}')" class="px-2 py-1 border ${isDelisted ? 'border-indigo-300 hover:bg-indigo-100 text-indigo-700' : 'border-slate-300 hover:bg-slate-100 text-slate-700'} font-bold rounded" title="${isDelisted ? 'Re-list — show in the Test Papers grid and search again' : 'Delist — hide from the Test Papers grid/search, keep it openable via a direct link or page card'}">${isDelisted ? '🙈' : '👁'}</button>
              <button onclick="toggleTestPaperBundleOnly('${p.id}')" class="px-2 py-1 border ${isBundleOnly ? 'border-violet-300 hover:bg-violet-100 text-violet-700' : 'border-slate-300 hover:bg-slate-100 text-slate-700'} font-bold rounded" title="${isBundleOnly ? 'Turn off Bundle-only — this paper becomes individually purchasable at its price again' : 'Bundle-only — not free, but never sold individually; reachable only via a covering bundle'}">🎁</button>
              <button onclick="editTestPaperPrice('${p.id}')" class="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded" title="Change price">₹</button>
              <button onclick="editTestPaperTitle('${p.id}')" class="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded" title="Rename">✎T</button>
              <button onclick="deleteTestPaper('${p.id}')" class="px-2 py-1 border border-rose-300 hover:bg-rose-100 text-rose-700 font-bold rounded" title="Delete permanently">×</button>
            </div>
          </div>
        </div>`;
    }

    // A split-generated group's collapsible header + (when expanded) its member rows. groupId is
    // the shared split_group_id; `papers` is every member still visible in this filtered view --
    // one of its siblings can legitimately be filtered out by the status quick-filter without
    // breaking this (renderTestsCatalogAdmin only calls this helper when 2+ survive the filter).
    function testCatalogAdminGroupHtml(groupId, papers, rowIndexById) {
      const expanded = expandedSplitGroups.has(groupId);
      // Sibling titles were generated as "<Subject> — <Label> (Part N of M)" by
      // studioConfirmSectionalSplit() -- strip the "(Part …)" suffix to get a shared group label.
      const label = (papers[0].title || 'Split papers').replace(/\s*\(Part \d+ of \d+\)\s*$/i, '');
      const activeCount = papers.filter(p => p.active !== false).length;
      const allChecked = papers.every(p => bulkSelectedPaperIds.has(p.id));
      const idsJson = JSON.stringify(papers.map(p => p.id));
      return `<div class="border border-amber-300 bg-amber-50 rounded-lg ${expanded ? '' : 'p-0'}">
        <div class="flex items-center gap-2 p-2.5 cursor-pointer" onclick="toggleSplitGroupExpanded('${groupId}')">
          <input type="checkbox" onclick="event.stopPropagation()" onchange="toggleSplitGroupSelectAll('${groupId}', ${idsJson.replace(/"/g, '&quot;')}, this.checked)" ${allChecked ? 'checked' : ''} title="Select all ${papers.length} papers in this group" />
          <span class="text-base">🧩</span>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-slate-900 truncate" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
            <div class="text-[11px] text-slate-600">${papers.length} papers from one split &middot; ${activeCount} active, ${papers.length - activeCount} inactive</div>
          </div>
          <span class="text-slate-500 font-bold text-sm shrink-0">${expanded ? '▾ Collapse' : '▸ Expand'}</span>
        </div>
        ${expanded ? `<div class="px-2.5 pb-2.5 space-y-2">${papers.map(p => testCatalogAdminRowHtml(p, rowIndexById.get(p.id) === 0, rowIndexById.get(p.id) === rowIndexById.get('__max__'))).join('')}</div>` : ''}
      </div>`;
    }

    function renderTestsCatalogAdmin() {
      const root = document.getElementById('tests-catalog-list');
      if (!root) return;
      const filter = (document.getElementById('tests-list-filter') || {}).value || 'all';
      // Remembered across admin-console loads (see populateAllCategoryDropdowns) so a category
      // like "Daily PIB Current Affairs" stays the standing filter instead of resetting to the
      // full list every time the panel reopens.
      localStorage.setItem('kas_tests_list_filter', filter);
      const statusFilter = (document.getElementById('tests-list-status-filter') || {}).value || 'all';
      localStorage.setItem('kas_tests_list_status_filter', statusFilter);
      const q = ((document.getElementById('tests-list-search') || {}).value || '').trim().toLowerCase();
      const rows = (testsCatalog || []).filter(p =>
        (filter === 'all' || p.category === filter) &&
        (!q || (p.title || '').toLowerCase().includes(q)) &&
        (statusFilter === 'all' ||
          // Active/Inactive and Delisted are independent flags (see toggleTestPaperDelisted's own
          // comment) -- a paper can be both Active and Delisted at once, and shows under either
          // filter in that case, rather than these three options being mutually exclusive buckets.
          (statusFilter === 'active' && p.active !== false) ||
          (statusFilter === 'inactive' && p.active === false) ||
          (statusFilter === 'delisted' && !!p.delisted))
      ).sort(testCatalogSortCompare);
      renderTestsBulkBar();
      if (!rows.length) {
        root.innerHTML = '<p class="text-slate-400 text-center py-6">No papers match. Upload one above, or clear the filter.</p>';
        return;
      }

      // ---- Collapse split-siblings (see split_group_id) under one header, same declutter idea as
      // the student-facing grid's bundle grouping, but admin-side and keyed by "created together in
      // one split" rather than "unlocked together by one bundle". A paper only counts as grouped
      // here if 2+ of its siblings survived the current filter -- a lone survivor just renders as
      // an ordinary row, same as a paper with no split_group_id at all. ----
      const siblingsByGroup = new Map();
      rows.forEach(p => {
        if (!p.splitGroupId) return;
        if (!siblingsByGroup.has(p.splitGroupId)) siblingsByGroup.set(p.splitGroupId, []);
        siblingsByGroup.get(p.splitGroupId).push(p);
      });
      const realGroups = new Map([...siblingsByGroup].filter(([, papers]) => papers.length > 1));

      // atTop/atBottom for ▲▼ must reflect each paper's position in the flat `rows` sequence (what
      // moveTestPaper actually swaps against), not its position inside a group's rendered body --
      // so index every id once, up front, before any grouping/collapsing happens.
      const rowIndexById = new Map(rows.map((p, i) => [p.id, i]));
      rowIndexById.set('__max__', rows.length - 1);

      const placedGroups = new Set();
      root.innerHTML = rows.map(p => {
        if (p.splitGroupId && realGroups.has(p.splitGroupId)) {
          if (placedGroups.has(p.splitGroupId)) return ''; // already rendered as part of this group
          placedGroups.add(p.splitGroupId);
          return testCatalogAdminGroupHtml(p.splitGroupId, realGroups.get(p.splitGroupId), rowIndexById);
        }
        const i = rowIndexById.get(p.id);
        return testCatalogAdminRowHtml(p, i === 0, i === rows.length - 1);
      }).join('');
    }

    // ---- Bulk select + bulk actions ----
    function toggleBulkSelect(paperId, checked) {
      if (checked) bulkSelectedPaperIds.add(paperId); else bulkSelectedPaperIds.delete(paperId);
      renderTestsBulkBar();
    }

    function toggleSplitGroupSelectAll(groupId, ids, checked) {
      ids.forEach(id => { if (checked) bulkSelectedPaperIds.add(id); else bulkSelectedPaperIds.delete(id); });
      renderTestsCatalogAdmin();
    }

    function toggleSplitGroupExpanded(groupId) {
      if (expandedSplitGroups.has(groupId)) expandedSplitGroups.delete(groupId); else expandedSplitGroups.add(groupId);
      renderTestsCatalogAdmin();
    }

    function clearBulkSelection() {
      bulkSelectedPaperIds.clear();
      renderTestsCatalogAdmin();
    }

    // Shows/hides the bulk action bar and keeps its button labels in sync with the current
    // selection count -- called on every checkbox toggle without re-rendering the whole (possibly
    // long) paper list underneath it.
    function renderTestsBulkBar() {
      const bar = document.getElementById('tests-bulk-bar');
      if (!bar) return;
      const n = bulkSelectedPaperIds.size;
      if (!n) { bar.classList.add('hidden'); bar.classList.remove('flex'); bar.innerHTML = ''; return; }
      bar.classList.remove('hidden'); bar.classList.add('flex');
      const btn = (onclick, label, extra) => `<button onclick="${onclick}" class="px-2.5 py-1 border border-white/30 hover:bg-white/10 font-bold rounded ${extra || ''}">${label}</button>`;
      bar.innerHTML = `<span class="font-bold">${n} selected</span>` +
        btn('bulkSetTestPapersActive(true)', '▶ Activate') +
        btn('bulkSetTestPapersActive(false)', '⏸ Deactivate') +
        btn('bulkSetTestPapersDelisted(false)', '👁 Re-list') +
        btn('bulkSetTestPapersDelisted(true)', '🙈 Delist') +
        btn('bulkDeleteTestPapers()', '× Delete', 'text-rose-300 hover:text-rose-200') +
        btn('clearBulkSelection()', 'Clear', 'ml-auto');
    }

    async function bulkSetTestPapersActive(nextActive) {
      const ids = [...bulkSelectedPaperIds];
      if (!ids.length) return;
      if (!nextActive && !confirm(`Deactivate ${ids.length} selected paper${ids.length === 1 ? '' : 's'}?\n\nThey'll disappear from the Exam Hub and can't be opened by anyone (even students who already unlocked one), until reactivated.`)) return;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ active: nextActive }).in('id', ids);
        if (error) throw error;
      } catch (err) {
        return alert('Bulk update failed, nothing was changed: ' + err.message);
      }
      ids.forEach(id => { const p = testsCatalog.find(x => x.id === id); if (p) p.active = nextActive; });
      clearBulkSelection();
      filterExamCategory(selectedCategory);
    }

    async function bulkSetTestPapersDelisted(nextDelisted) {
      const ids = [...bulkSelectedPaperIds];
      if (!ids.length) return;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ delisted: nextDelisted }).in('id', ids);
        if (error) throw error;
      } catch (err) {
        return alert('Bulk update failed, nothing was changed: ' + err.message);
      }
      ids.forEach(id => { const p = testsCatalog.find(x => x.id === id); if (p) p.delisted = nextDelisted; });
      clearBulkSelection();
      filterExamCategory(selectedCategory);
    }

    async function bulkDeleteTestPapers() {
      const ids = [...bulkSelectedPaperIds];
      if (!ids.length) return;
      const papers = ids.map(id => testsCatalog.find(x => x.id === id)).filter(Boolean);
      // Same cascade scope as the single-paper deleteTestPaper(): which bundles reference ANY of
      // the selected papers (each such bundle gets re-upserted once below, however many of the
      // selected papers it lost), and how many students had individual (non-bundle) access.
      const affectedBundles = (bundles || []).filter(b => (b.papers || []).some(pid => ids.includes(pid)));
      const studentsAffected = (studentDirectory || []).filter(s => (s.allowedExams || []).some(pid => ids.includes(pid)));
      let msg = `Delete ${ids.length} selected paper${ids.length === 1 ? '' : 's'}?\n\nThis cannot be undone.`;
      if (affectedBundles.length) msg += `\n\n${affectedBundles.length} bundle${affectedBundles.length > 1 ? 's' : ''} will be updated to no longer include them: ${affectedBundles.map(b => b.name).join(', ')}.`;
      if (studentsAffected.length) msg += `\n\n${studentsAffected.length} student${studentsAffected.length > 1 ? 's' : ''} had individual access to one or more of these — those entries will be dropped (bundle passes are unaffected).`;
      if (!confirm(msg)) return;

      try {
        const { error } = await supabaseClient.from('tests_catalog').delete().in('id', ids);
        if (error) throw error;
      } catch (err) {
        return alert('Bulk delete failed, nothing was deleted: ' + err.message);
      }
      testsCatalog = testsCatalog.filter(p => !ids.includes(p.id));

      // Cascade: same per-bundle full re-upsert deleteTestPaper() does, just batched over every
      // bundle that lost at least one of the selected papers instead of one bundle at a time.
      for (const b of affectedBundles) {
        b.papers = (b.papers || []).filter(pid => !ids.includes(pid));
        try {
          const { error: bErr } = await supabaseClient.from('bundles').upsert({
            id: b.id, name: b.name, tagline: b.tagline || '', price: b.price,
            validity_days: b.validityDays, highlights: b.highlights || [], active: b.active,
            show_on_home: b.showOnHome, featured: b.featured, style: b.style || 'light',
            order_num: b.order || 0, all_access: b.allAccess, categories: b.categories || [],
            papers: b.papers || [], pages: b.pages || [], pdfs: b.pdfs || [],
            planners: b.planners || [], features: b.features || []
          });
          if (bErr) console.error('Failed to re-sync bundle after bulk test delete:', bErr);
        } catch (err) {
          console.error('Bundle re-sync threw:', fmtErr(err));
        }
      }
      saveBundles();

      studentDirectory.forEach(s => { s.allowedExams = (s.allowedExams || []).filter(pid => !ids.includes(pid)); });
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));

      clearBulkSelection();
      renderHomeBundles();
      alert(`${papers.length} paper${papers.length === 1 ? '' : 's'} deleted.`);
      filterExamCategory(selectedCategory);
    }

    // Quick reorder: swaps order_num with whichever paper sits adjacent in the EXACT list currently
    // on screen (same category filter + search box the admin has active) -- "move this one up/down
    // in the list I'm looking at", mirroring movePage() (js/08_word_page_creator.js) and
    // moveMenuItem() (js/09_navigation_granular_controls.js), the same pattern this app already uses
    // for custom pages and nav items. For exact control (or setting a brand-new paper's starting
    // position) use the "Display order" field in the Studio instead -- this is just a fast nudge.
    async function moveTestPaper(paperId, dir) {
      const filter = (document.getElementById('tests-list-filter') || {}).value || 'all';
      const q = ((document.getElementById('tests-list-search') || {}).value || '').trim().toLowerCase();
      const rows = (testsCatalog || []).filter(p =>
        (filter === 'all' || p.category === filter) &&
        (!q || (p.title || '').toLowerCase().includes(q))
      ).sort(testCatalogSortCompare);
      const i = rows.findIndex(p => p.id === paperId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rows.length) return;
      const a = rows[i], b = rows[j];
      if ((a.order || 0) === (b.order || 0)) {
        // Tied order_num (two papers never individually reordered before) -- give every paper
        // CURRENTLY in view its own spaced-out value matching its present position, so the swap
        // below has two distinct numbers to exchange. This preserves the exact order everyone's
        // already seeing (idx*10 sorts identically to the tie it replaces); only a/b are actually
        // persisted to the cloud below, so this is a harmless, self-correcting renumber, not a
        // hidden mass-write.
        rows.forEach((p, idx) => { p.order = idx * 10; });
      }
      [a.order, b.order] = [b.order, a.order];
      try {
        const results = await Promise.all([
          supabaseClient.from('tests_catalog').update({ order_num: a.order }).eq('id', a.id),
          supabaseClient.from('tests_catalog').update({ order_num: b.order }).eq('id', b.id)
        ]);
        const failed = results.find(r => r.error);
        if (failed) throw failed.error;
      } catch (err) {
        alert('Reordered locally, but cloud save failed: ' + err.message);
      }
      renderTestsCatalogAdmin();
      if (typeof filterExamCategory === 'function' && typeof selectedCategory !== 'undefined') filterExamCategory(selectedCategory);
    }

    // Downloads a published (or draft-saved) paper's questions as the same CSV shape the upload
    // path accepts, so an admin can fix a mistagged subject, wrong answer key, or typo in a
    // spreadsheet and re-upload the corrected file via "New paper (guided studio)" -- the row
    // already flags common problems (missing Correct letter, no marking scheme, etc.) with a
    // "Re-upload the CSV to fix" hint; this button is the other half of that workflow.
    async function downloadTestPaperCsv(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      await ensurePaperQuestionsLoaded(p);
      if (!Array.isArray(p.questions) || !p.questions.length) return alert(`"${p.title || 'This paper'}" has no questions to export.`);
      studioTriggerCsvDownload(studioQuestionsToCsv(p.questions), `${studioFilenameFromTitle(p.title)}.csv`);
    }

    async function editTestPaperTitle(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      const nu = prompt('New title:', p.title || '');
      if (nu == null) return;
      const clean = nu.trim();
      if (!clean) return alert('Title cannot be blank.');
      p.title = clean;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ title: clean }).eq('id', paperId);
        if (error) throw error;
      } catch (err) {
        alert('Renamed locally, but cloud save failed: ' + err.message);
      }
      renderTestsCatalogAdmin();
      renderHomeBundles();
    }

    async function editTestPaperPrice(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      const nu = prompt(`New price for "${p.title}" in ₹ (0 for free):`, String(p.price || 0));
      if (nu == null) return;
      const price = Math.max(0, parseInt(nu, 10) || 0);
      p.price = price;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ price }).eq('id', paperId);
        if (error) throw error;
      } catch (err) {
        alert('Price changed locally, but cloud save failed: ' + err.message);
      }
      renderTestsCatalogAdmin();
    }

    async function toggleTestPaperActive(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      const nextActive = p.active === false; // currently inactive -> reactivate; currently active -> deactivate
      if (!nextActive && !confirm(`Deactivate "${p.title}"?\n\nIt will disappear from the Exam Hub and can no longer be opened by anyone (even students who already unlocked it), until you reactivate it.`)) return;
      p.active = nextActive;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ active: nextActive }).eq('id', paperId);
        if (error) throw error;
      } catch (err) {
        alert('Changed locally, but cloud save failed: ' + err.message);
      }
      renderTestsCatalogAdmin();
      filterExamCategory(selectedCategory);
    }

    // Unlike Active/Inactive, delisting never blocks opening the paper or earning entitlement to
    // it — isTestUnlockedForUser/launchExamPaper don't look at this flag at all. It only affects
    // whether the paper shows up in the ordinary Test Papers browse grid and site search (see
    // filterExamCategoryBase and siteSearch), so a direct link, a bundle, or a Test paper card
    // placed on a custom page keep working exactly as before either way.
    async function toggleTestPaperDelisted(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      const nextDelisted = !p.delisted;
      p.delisted = nextDelisted;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ delisted: nextDelisted }).eq('id', paperId);
        if (error) throw error;
      } catch (err) {
        alert('Changed locally, but cloud save failed: ' + err.message);
      }
      renderTestsCatalogAdmin();
      filterExamCategory(selectedCategory);
    }

    // Quick toggle for papers already created (e.g. in bulk via CSV) that need Bundle-only flipped
    // afterwards, without reopening each one in the Studio editor one at a time. Same safety-net
    // check as studioPublish(): warns if turning this off would leave a priced paper that's already
    // covered by a bundle also individually purchasable, and if turning it on would leave the paper
    // unreachable because no bundle currently covers it.
    async function toggleTestPaperBundleOnly(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      const nextBundleOnly = !p.bundleOnly;
      const covering = bundlesCoveringPaper(p);
      if (nextBundleOnly && !covering.length) {
        if (!confirm(`"${p.title}" isn't covered by any active bundle yet.\n\nMarking it Bundle-only now will make it unreachable by students until a bundle covers it.\n\nContinue anyway?`)) return;
      }
      if (!nextBundleOnly && p.price > 0 && covering.length) {
        const names = covering.map(b => b.name).join(', ');
        if (!confirm(`"${p.title}" is covered by: ${names}.\n\nTurning off Bundle-only will also make it individually purchasable at ₹${p.price}, separate from those bundle(s).\n\nContinue anyway?`)) return;
      }
      p.bundleOnly = nextBundleOnly;
      try {
        const { error } = await supabaseClient.from('tests_catalog').update({ bundle_only: nextBundleOnly }).eq('id', paperId);
        if (error) throw error;
      } catch (err) {
        alert('Changed locally, but cloud save failed: ' + err.message);
      }
      renderTestsCatalogAdmin();
      filterExamCategory(selectedCategory);
    }

    async function deleteTestPaper(paperId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      const inBundles = (bundles || []).filter(b => (b.papers || []).includes(paperId));
      const students = (studentDirectory || []).filter(s => (s.allowedExams || []).includes(paperId));
      let msg = `Delete "${p.title}"?\n\nThis cannot be undone.`;
      if (inBundles.length) msg += `\n\n${inBundles.length} bundle${inBundles.length > 1 ? 's' : ''} will be updated to no longer include it: ${inBundles.map(b => b.name).join(', ')}.`;
      if (students.length) msg += `\n\n${students.length} student${students.length > 1 ? 's' : ''} had individual access — that entry will be dropped (their bundle passes are unaffected).`;
      if (!confirm(msg)) return;

      // Delete from Supabase first (fail fast if RLS blocks it)
      try {
        const { error } = await supabaseClient.from('tests_catalog').delete().eq('id', paperId);
        if (error) throw error;
      } catch (err) {
        return alert('Failed to delete from cloud: ' + err.message);
      }

      // Local cleanup
      testsCatalog = testsCatalog.filter(x => x.id !== paperId);

      // Cascade: remove from bundles' papers arrays + re-upsert those bundles
      for (const b of inBundles) {
        b.papers = (b.papers || []).filter(x => x !== paperId);
        try {
          const { error: bErr } = await supabaseClient.from('bundles').upsert({
            id: b.id, name: b.name, tagline: b.tagline || '', price: b.price,
            validity_days: b.validityDays, highlights: b.highlights || [], active: b.active,
            show_on_home: b.showOnHome, featured: b.featured, style: b.style || 'light',
            order_num: b.order || 0, all_access: b.allAccess, categories: b.categories || [],
            papers: b.papers || [], pages: b.pages || [], pdfs: b.pdfs || [],
            planners: b.planners || [], features: b.features || []
          });
          if (bErr) console.error('Failed to re-sync bundle after test delete:', bErr);
        } catch (err) {
          console.error('Bundle re-sync threw:', fmtErr(err));
        }
      }
      saveBundles();

      // Local student cleanup — cloud students will drift; we leave individual student rows alone
      // (safer than doing 100 upserts here) and the app tolerates missing paper IDs in allowedExams.
      studentDirectory.forEach(s => { s.allowedExams = (s.allowedExams || []).filter(x => x !== paperId); });
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));

      renderTestsCatalogAdmin();
      renderHomeBundles();
      if (typeof filterExamCategory === 'function') filterExamCategory(selectedCategory);
      alert(`"${p.title}" deleted.`);
    }


