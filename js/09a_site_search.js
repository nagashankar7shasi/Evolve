    /* ----------------------------------------------------
       SITE SEARCH — searches test paper titles/subjects and custom page
       titles/content (Current Affairs is just a custom page, so it's covered
       automatically). Everything it searches is already loaded client-side
       (testsCatalog metadata + customPages), so this is a pure in-memory
       filter with no network call — instant as you type.
    ----------------------------------------------------- */
    // Strips HTML down to plain text for matching inside page bodies (Current Affairs, custom
    // pages) without accidentally matching on tag names/attributes. Never re-inserted as HTML.
    function stripHtmlToText(html) {
      const div = document.createElement('div');
      div.innerHTML = html || '';
      return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function openSiteSearch() {
      const modal = document.getElementById('site-search-modal');
      modal.classList.remove('hidden');
      const input = document.getElementById('site-search-input');
      input.value = '';
      renderSiteSearchResults('');
      setTimeout(() => input.focus(), 50);
    }

    function closeSiteSearch() {
      document.getElementById('site-search-modal').classList.add('hidden');
    }

    function siteSearchResults(query) {
      const q = query.trim().toLowerCase();
      if (q.length < 2) return { pages: [], papers: [] };

      const pages = customPages.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        stripHtmlToText(p.content).toLowerCase().includes(q)
      ).slice(0, 6);

      // BUG FIX: this previously had no active/delisted check at all, so an inactive paper (fully
      // hidden and unopenable everywhere else) or a delisted one (hidden from the browse grid on
      // purpose) could still surface here and send a student to a dead end. Matches the same
      // active/delisted scope filterExamCategoryBase uses for the browse grid.
      const papers = testsCatalog.filter(p =>
        p.active !== false && !p.delisted &&
        ((p.title || '').toLowerCase().includes(q) ||
        (EXAM_CATEGORIES[p.category]?.name || '').toLowerCase().includes(q) ||
        (p.scheme?.examBadge || '').toLowerCase().includes(q))
      ).slice(0, 6);

      return { pages, papers };
    }

    function renderSiteSearchResults(query) {
      const box = document.getElementById('site-search-results');
      const q = (query || '').trim();
      if (q.length < 2) {
        box.innerHTML = `<p class="text-center text-slate-400 py-8 text-xs">${q ? 'Keep typing… (2+ characters)' : 'Start typing to search the site.'}</p>`;
        return;
      }
      const { pages, papers } = siteSearchResults(q);
      if (!pages.length && !papers.length) {
        box.innerHTML = `<p class="text-center text-slate-400 py-8 text-xs">No matches for "${escapeHtml(q)}".</p>`;
        return;
      }
      let html = '';
      if (papers.length) {
        html += `<p class="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Test papers</p>`;
        html += papers.map(p => `
          <button onclick="goToSearchResult('paper','${p.id}')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center justify-between gap-2">
            <span class="truncate">${escapeHtml(p.title)}</span>
            <span class="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">${escapeHtml(EXAM_CATEGORIES[p.category]?.defaultScheme?.examBadge || p.category)}</span>
          </button>`).join('');
      }
      if (pages.length) {
        html += `<p class="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pages</p>`;
        html += pages.map(p => `
          <button onclick="goToSearchResult('page','${p.id}')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 truncate">
            ${escapeHtml(p.title)}
          </button>`).join('');
      }
      box.innerHTML = html;
    }

    function goToSearchResult(type, id) {
      closeSiteSearch();
      if (type === 'page') {
        renderDynamicCustomPage(id);
        return;
      }
      if (type === 'paper') {
        const paper = testsCatalog.find(p => p.id === id);
        if (!paper) return;
        navigate('tests');
        filterExamCategory(paper.category);
        setTimeout(() => {
          // A locked paper now renders inside a collapsed bundle (or "Individual Papers") group
          // rather than always as its own flat card -- open that group first, or the scroll below
          // would land on a hidden element.
          expandTestGroupContainingPaper(id);
          const el = document.getElementById('paper-card-' + id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('search-result-highlight');
            setTimeout(() => el.classList.remove('search-result-highlight'), 2200);
          }
        }, 150);
      }
    }

    // "/" opens search from anywhere (unless typing in a field); Escape closes it.
    document.addEventListener('keydown', e => {
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        const modal = document.getElementById('site-search-modal');
        if (modal && modal.classList.contains('hidden')) { e.preventDefault(); openSiteSearch(); }
      } else if (e.key === 'Escape') {
        const modal = document.getElementById('site-search-modal');
        if (modal && !modal.classList.contains('hidden')) closeSiteSearch();
      }
    });

    async function navigate(view) {
      if (view === 'dashboard' && !currentUser) {
        openLoginModal('Log in to see your dashboard.');
        return;
      }
      if (view === 'admin' && !isAdmin()) {
        openModal('admin-login-modal');
        return;
      }
      if (view === 'admin') {
        setTimeout(() => { showAdminPanel(currentAdminPanel); }, 0);
        const emailLabel = document.getElementById('admin-account-email');
        if (emailLabel) emailLabel.textContent = currentUser.email;
        renderPaymentOrders();
        renderStudentDirectoryTable();
      }
      if (view !== 'custom-page') {
        currentPageId = null;
        if (location.hash.startsWith('#/page/')) clearPageHash();
      }
      if (view !== 'engine' && !(await guardLeavingExam())) return;
      ['home', 'tests', 'dashboard', 'admin', 'custom-page', 'engine'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
      });
      document.getElementById(`view-${view}`).classList.remove('hidden');
    }

    function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

