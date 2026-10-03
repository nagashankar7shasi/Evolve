    /* ----------------------------------------------------
       6. CATEGORY-WISE EXAM PAGES & TEST INGESTION
    ----------------------------------------------------- */
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
      const papers = testsCatalog.filter(p => p.active !== false &&
        (scope.includes(p.category) || (p.alsoListCategories || []).some(c => scope.includes(c))));

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

      papers.forEach(paper => {
        const s = paper.scheme;
        // Uses the lightweight questionCount metadata, not paper.questions — the actual question
        // content (with answers) isn't fetched for browsing cards, locked or unlocked; see
        // fetchCloudContent/ensurePaperQuestionsLoaded.
        const maxMarks = (paper.questionCount * s.marksCorrect).toFixed(0);
        const isUnlocked = isTestUnlockedForUser(paper.id);
        const priceLabel = paper.price === 0 ? 'FREE DEMO' : `₹${paper.price}`;

        const card = document.createElement('div');
        card.id = 'paper-card-' + paper.id;
        card.className = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between transition-shadow";
        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">${s.examBadge}</span>
              <span class="text-xs font-mono font-bold ${paper.price === 0 ? 'text-emerald-600' : 'text-slate-900'}">${priceLabel}</span>
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
          ${isUnlocked ? `
            <button onclick="launchExamPaper('${paper.id}')" class="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow">
              Launch OMR Mock Exam
            </button>
            <button onclick="launchExamPaperPractice('${paper.id}')" class="mt-2 w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-lg transition" title="Untimed, one question at a time, answer shown immediately">
              🎯 Attempt in Practice Mode
            </button>
          ` : `
            <button onclick="openPaperCheckout('${paper.id}')" class="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5">
              <span>🔒 Unlock Paper (₹${paper.price})</span>
            </button>
          `}
        `;
        grid.appendChild(card);
      });
    }

    // handleExamCategoryChange() was only wired to the legacy "Quick upload" form's category
    // select (removed from index.html along with that form) -- removed here too since nothing
    // else calls it.

    // ---- Uploaded papers: list, edit price/title, delete with cascade ----
    function renderTestsCatalogAdmin() {
      const root = document.getElementById('tests-catalog-list');
      if (!root) return;
      const filter = (document.getElementById('tests-list-filter') || {}).value || 'all';
      const q = ((document.getElementById('tests-list-search') || {}).value || '').trim().toLowerCase();
      const rows = (testsCatalog || []).filter(p =>
        (filter === 'all' || p.category === filter) &&
        (!q || (p.title || '').toLowerCase().includes(q))
      );
      const catName = c => (EXAM_CATEGORIES[c] && EXAM_CATEGORIES[c].name) || c || '—';
      if (!rows.length) {
        root.innerHTML = '<p class="text-slate-400 text-center py-6">No papers match. Upload one above, or clear the filter.</p>';
        return;
      }
      // Papers with problems get flagged so admin can spot the ones that don't work
      const problem = p => {
        if (!Array.isArray(p.questions) || p.questions.length === 0) return 'No questions attached';
        if (!p.scheme || typeof p.scheme !== 'object') return 'Marking scheme missing';
        const bad = p.questions.filter(q => !q || !q.correct || !/^[A-D]$/i.test(q.correct));
        if (bad.length) return `${bad.length} question${bad.length > 1 ? 's are' : ' is'} missing a valid Correct letter (A-D)`;
        return null;
      };
      root.innerHTML = rows.map(p => {
        const p_issue = problem(p);
        const inBundles = (bundles || []).filter(b => (b.papers || []).includes(p.id)).map(b => b.name);
        const isInactive = p.active === false;
        return `<div class="border ${p_issue ? 'border-rose-300 bg-rose-50' : isInactive ? 'border-slate-200 bg-slate-100' : 'border-slate-200 bg-white'} rounded-lg p-2.5 ${isInactive ? 'opacity-70' : ''}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-slate-900 truncate">${escapeHtml(p.title || 'Untitled paper')}</div>
              <div class="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                ${isInactive ? '<span class="font-bold uppercase tracking-wider bg-slate-700 text-white px-1.5 py-0.5 rounded">Inactive</span>' : ''}
                <span class="font-mono uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${escapeHtml(catName(p.category))}</span>
                ${(p.extraCategories || []).map(c => `<span class="font-mono uppercase tracking-wider bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded" title="Feeds the question bank of ${escapeHtml(catName(c))}">🏦 ${escapeHtml(catName(c))}</span>`).join('')}
                ${(p.alsoListCategories || []).map(c => `<span class="font-mono uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded" title="Also listed as its own paper + unlockable under ${escapeHtml(catName(c))}">🔗 ${escapeHtml(catName(c))}</span>`).join('')}
                <span>${(Array.isArray(p.questions) && p.questions.length) ? p.questions.length : (p.questionCount || 0)} Qs</span>
                <span>${p.price === 0 ? '<b class="text-emerald-700">Free</b>' : '₹' + p.price}</span>
                ${p.scheme && p.scheme.duration ? `<span>${p.scheme.duration} min</span>` : ''}
                ${p.scheduled_for ? `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">🗓 Live ${new Date(p.scheduled_for).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                ${inBundles.length ? `<span class="text-slate-500">In ${inBundles.length} bundle${inBundles.length > 1 ? 's' : ''}: ${escapeHtml(inBundles.slice(0, 2).join(', '))}${inBundles.length > 2 ? '…' : ''}</span>` : ''}
              </div>
              ${p_issue ? `<div class="mt-1 text-[11px] font-bold text-rose-700">⚠ ${escapeHtml(p_issue)}. Re-upload the CSV to fix.</div>` : ''}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="openStudio('${p.id}')" class="px-2 py-1 border border-amber-300 hover:bg-amber-100 text-amber-800 font-bold rounded" title="Open in studio to edit">✎</button>
              <button onclick="openStudio('${p.id}', true)" class="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded" title="Duplicate as a new paper">⎘</button>
              <button onclick="toggleTestPaperActive('${p.id}')" class="px-2 py-1 border ${isInactive ? 'border-emerald-300 hover:bg-emerald-100 text-emerald-700' : 'border-slate-300 hover:bg-slate-100 text-slate-700'} font-bold rounded" title="${isInactive ? 'Reactivate — visible and openable again' : 'Deactivate — hides it and blocks opening for everyone'}">${isInactive ? '▶' : '⏸'}</button>
              <button onclick="editTestPaperPrice('${p.id}')" class="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded" title="Change price">₹</button>
              <button onclick="editTestPaperTitle('${p.id}')" class="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded" title="Rename">✎T</button>
              <button onclick="deleteTestPaper('${p.id}')" class="px-2 py-1 border border-rose-300 hover:bg-rose-100 text-rose-700 font-bold rounded" title="Delete permanently">×</button>
            </div>
          </div>
        </div>`;
      }).join('');
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


