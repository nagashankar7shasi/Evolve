    /* ----------------------------------------------------
       3a. BUNDLES: FRONT END + ADMIN EDITOR
    ----------------------------------------------------- */
    function bundleCardHtml(b) {
      const theme = {
        light: { card: 'bg-white border border-slate-200', tag: 'bg-slate-100 text-slate-700', price: 'text-slate-900', sub: 'text-slate-500', li: 'text-slate-600', btn: 'bg-slate-900 hover:bg-slate-800 text-white' },
        amber: { card: 'bg-white border-2 border-amber-500 shadow-md', tag: 'bg-amber-100 text-amber-900', price: 'text-slate-900', sub: 'text-slate-500', li: 'text-slate-600', btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950' },
        dark: { card: 'bg-slate-900 border border-slate-800 shadow-lg text-white', tag: 'bg-emerald-500/20 text-emerald-300', price: 'text-amber-400', sub: 'text-slate-400', li: 'text-slate-300', btn: 'bg-emerald-600 hover:bg-emerald-500 text-white' }
      }[b.style] || {};
      const student = getCurrentStudent();
      const owned = student && activeBundlesFor(student).some(x => x.id === b.id);
      // On-card discount: reuses the SAME auto-coupon engine the checkout modal already applies
      // (bestAutoCoupon/computeCouponDiscount, js/03f_coupons.js), via the shared bundlePricingInfo()
      // helper (js/02a_bundles.js) that the bundle landing page also uses -- so a no-code early-bird
      // coupon shows its struck-through MRP right on the card, before the student ever opens
      // checkout, instead of only revealing the saving once they click through. A code-required
      // coupon never shows here (nothing to type on a card).
      const { autoCoupon, finalPrice } = bundlePricingInfo(b);
      const priceHtml = autoCoupon
        ? `<div class="my-4">
             <div class="flex items-baseline gap-2">
               <span class="text-3xl font-black ${theme.price}">₹${finalPrice}</span>
               <span class="text-sm font-bold line-through ${theme.sub}">₹${b.price}</span>
               <span class="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">${autoCoupon.type === 'flat' ? `₹${autoCoupon.value} off` : `${autoCoupon.value}% off`}</span>
             </div>
             <span class="text-xs font-normal ${theme.sub}">${b.validityDays > 0 ? `for ${b.validityDays >= 360 && b.validityDays % 365 === 0 ? (b.validityDays / 365) + ' year' + (b.validityDays > 365 ? 's' : '') : b.validityDays + ' days'}` : 'one-time'}</span>
           </div>`
        : `<div class="my-4 text-3xl font-black ${theme.price}">₹${b.price} <span class="text-xs font-normal ${theme.sub}">${b.validityDays > 0 ? `for ${b.validityDays >= 360 && b.validityDays % 365 === 0 ? (b.validityDays / 365) + ' year' + (b.validityDays > 365 ? 's' : '') : b.validityDays + ' days'}` : 'one-time'}</span></div>`;
      // Schedule/syllabus PDF link: a single optional PDF-vault reference shown as a plain info link
      // on the card -- deliberately NOT an entitlement (that's what `pdfs`/bundleCoversPdf is for).
      // Resolved defensively: if the referenced doc was since deleted from the vault, nothing renders
      // rather than a dead button. Reuses downloadOrOpenPdf() as-is (same gating it already applies
      // everywhere else a PDF is linked) -- an admin who points this at a paid PDF by mistake sends
      // the visitor to checkout for it, same as linking a gated PDF anywhere else in the app.
      const schedulePdf = b.schedulePdfId && typeof pdfVault !== 'undefined' ? pdfVault.find(d => d.id === b.schedulePdfId) : null;
      const schedulePdfHtml = schedulePdf
        ? `<button onclick="downloadOrOpenPdf('${schedulePdf.id}')" class="mt-2 w-full py-2 border ${b.style === 'dark' ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'} font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5">
             📄 View schedule / syllabus
           </button>`
        : '';
      return `
        <div class="${theme.card} p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          ${b.featured ? '<div class="absolute -right-12 top-6 bg-amber-500 text-slate-950 text-[10px] font-bold px-12 py-0.5 rotate-45 uppercase">Popular</div>' : ''}
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider ${theme.tag} px-2.5 py-0.5 rounded-full">${b.allAccess ? 'Everything included' : 'Bundle'}</span>
            <h4 class="text-lg font-bold mt-2">${escapeHtml(b.name)}</h4>
            <p class="text-xs ${theme.sub} mt-1">${escapeHtml(b.tagline || '')}</p>
            ${priceHtml}
            <ul class="text-xs ${theme.li} space-y-1.5">${(b.highlights || []).map(h => `<li>• ${escapeHtml(h)}</li>`).join('')}</ul>
          </div>
          <div class="mt-6">
            <button onclick="openBundleCheckout('${b.id}')" class="w-full py-2.5 ${theme.btn} font-bold text-xs rounded-lg transition shadow">
              ${owned ? 'You have this. Extend' : `Get ${escapeHtml(b.name)}`}
            </button>
            ${schedulePdfHtml}
          </div>
        </div>`;
    }

    function renderHomeBundles() {
      const grid = document.getElementById('home-bundles');
      const extra = document.getElementById('home-bundles-extra');
      if (!grid) return;
      grid.querySelectorAll('.home-bundle').forEach(el => el.remove());
      const list = bundles.filter(b => b.active && b.showOnHome).sort((a, b) => (a.order || 0) - (b.order || 0) || a.price - b.price);
      // first two sit beside the "individual papers" card; the rest flow into the next row(s)
      list.slice(0, 2).forEach(b => {
        const wrap = document.createElement('div');
        wrap.className = 'home-bundle contents';
        wrap.innerHTML = bundleCardHtml(b);
        grid.appendChild(wrap);
      });
      extra.innerHTML = list.slice(2).map(bundleCardHtml).join('');
      extra.classList.toggle('hidden', list.length <= 2);
    }

    // Resolves a bundle's actual included-item NAMES (not just counts, unlike bundleSummary()'s
    // compact admin-list line above) -- used by the landing page's "What's included" section, since
    // the whole point of a dedicated landing page over the compact card is to show a prospective
    // buyer exactly what they're getting, not just "3 pages, 2 PDFs".
    function bundleIncludedSections(b) {
      if (b.allAccess) {
        return [{ heading: 'Everything on the site', items: ['Every exam category\'s mocks, including ones added later', 'All gated pages, PDFs, planners and dashboard features'] }];
      }
      const sections = [];
      const cats = (b.categories || []).map(c => EXAM_CATEGORIES[c]?.name).filter(Boolean);
      if (cats.length) sections.push({ heading: 'Exam categories (all papers, including future ones)', items: cats });
      const papers = (b.papers || []).map(id => testsCatalog.find(p => p.id === id)?.title).filter(Boolean);
      if (papers.length) sections.push({ heading: 'Individual test papers', items: papers });
      const mains = (b.mainsPapers || []).map(id => (typeof mainsTestPapers !== 'undefined' ? mainsTestPapers.find(p => p.id === id)?.title : null)).filter(Boolean);
      if (mains.length) sections.push({ heading: 'Mains test papers', items: mains });
      const pages = (b.pages || []).map(id => findPage(id)?.title).filter(Boolean);
      if (pages.length) sections.push({ heading: 'Pages', items: pages });
      const pdfs = (b.pdfs || []).map(id => pdfVault.find(d => d.id === id)?.title).filter(Boolean);
      if (pdfs.length) sections.push({ heading: 'PDFs', items: pdfs });
      const planners = (b.planners || []).map(id => (typeof plannerList === 'function' ? plannerList().find(p => p.id === id)?.label : null)).filter(Boolean);
      if (planners.length) sections.push({ heading: 'Advanced study planners', items: planners });
      const features = (b.features || []).map(id => (typeof DASHBOARD_FEATURES !== 'undefined' ? DASHBOARD_FEATURES.find(f => f.id === id)?.name : null)).filter(Boolean);
      if (features.length) sections.push({ heading: 'Dashboard features', items: features });
      return sections;
    }

    // Auto-generated, shareable landing page for one bundle at #/bundle/{slug} -- mirrors
    // renderDynamicCustomPage's routing pattern (js/08_word_page_creator.js) exactly: resolves the
    // ref, pushes/replaces the canonical hash, hides every other top-level view, and (critically,
    // same "editor-placeholder vs public-render-rebuild" pattern as page cards -- see CLAUDE.md)
    // rebuilds every field from the CURRENT bundle/coupon/vault data on every call, so a shared link
    // never shows a stale price or a since-removed schedule PDF.
    async function renderBundleLandingPage(ref, opts = {}) {
      const b = findBundleByRef(ref);
      if (!b) {
        alert('This bundle link is no longer valid. It may have been removed or renamed.');
        return navigate('home');
      }
      // Same exam-in-progress guard navigate()/renderDynamicCustomPage() use -- this function hides
      // view-engine itself just below and can be reached directly from routeFromHash (e.g. Back
      // button), so it needs its own copy of the check.
      if (!(await guardLeavingExam())) return;

      currentBundleLandingId = b.id;
      currentPageId = null; // leaving any custom page that might have been open
      const hash = bundleLinkHash(b);
      if (location.hash !== hash) {
        // Opened from an old slug: quietly switch to the current one without adding history.
        setPageHash(hash, !!opts.fromRoute);
      }

      ['home', 'tests', 'dashboard', 'admin', 'custom-page', 'engine'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
      });
      document.getElementById('view-bundle-landing').classList.remove('hidden');

      document.getElementById('bundle-landing-badge').innerText = b.allAccess ? 'Everything included' : 'Bundle';
      document.getElementById('bundle-landing-title').innerText = b.name;
      document.getElementById('bundle-landing-tagline').innerText = b.tagline || '';

      const { autoCoupon, finalPrice } = bundlePricingInfo(b);
      const validityLabel = b.validityDays > 0
        ? `for ${b.validityDays >= 360 && b.validityDays % 365 === 0 ? (b.validityDays / 365) + ' year' + (b.validityDays > 365 ? 's' : '') : b.validityDays + ' days'}`
        : 'one-time';
      document.getElementById('bundle-landing-price').innerHTML = autoCoupon
        ? `<span class="text-4xl font-black text-slate-900">₹${finalPrice}</span>
           <span class="text-lg font-bold line-through text-slate-400 ml-2">₹${b.price}</span>
           <span class="text-[11px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full ml-2">${autoCoupon.type === 'flat' ? `₹${autoCoupon.value} off` : `${autoCoupon.value}% off`}</span>
           <span class="block text-xs font-normal text-slate-500 mt-1">${validityLabel}</span>`
        : `<span class="text-4xl font-black text-slate-900">₹${b.price}</span>
           <span class="block text-xs font-normal text-slate-500 mt-1">${validityLabel}</span>`;

      const highlightsWrap = document.getElementById('bundle-landing-highlights-wrap');
      const highlights = b.highlights || [];
      highlightsWrap.classList.toggle('hidden', !highlights.length);
      document.getElementById('bundle-landing-highlights').innerHTML = highlights.map(h => `<li class="flex gap-2"><span>✅</span><span>${escapeHtml(h)}</span></li>`).join('');

      const sections = bundleIncludedSections(b);
      document.getElementById('bundle-landing-included').innerHTML = sections.map(s => `
        <div>
          <h4 class="font-bold text-slate-900 text-sm mb-1.5">${escapeHtml(s.heading)}</h4>
          <ul class="text-sm text-slate-600 space-y-1">${s.items.map(i => `<li>• ${escapeHtml(i)}</li>`).join('')}</ul>
        </div>`).join('') || '<p class="text-slate-400 text-sm">Nothing included yet.</p>';

      const schedulePdf = b.schedulePdfId ? pdfVault.find(d => d.id === b.schedulePdfId) : null;
      const scheduleBtn = document.getElementById('bundle-landing-schedule-btn');
      scheduleBtn.classList.toggle('hidden', !schedulePdf);
      if (schedulePdf) scheduleBtn.onclick = () => downloadOrOpenPdf(schedulePdf.id);

      const student = getCurrentStudent();
      const owned = student && activeBundlesFor(student).some(x => x.id === b.id);
      const ctaBtn = document.getElementById('bundle-landing-cta');
      ctaBtn.innerText = owned ? 'You have this. Extend' : `Enroll in ${b.name}`;
      ctaBtn.onclick = () => openBundleCheckout(b.id);
    }

    function updateCategoryBundleButton() {
      const btn = document.getElementById('cat-bundle-btn');
      if (!btn) return;
      const b = bundlesForSale(x => !x.allAccess && x.categories.includes(selectedCategory))[0]
        || bundlesForSale(x => x.allAccess)[0];
      btn.classList.toggle('hidden', !b);
      if (b) document.getElementById('cat-bundle-label').innerText = `⚡ ${b.name} (₹${b.price})`;
    }

    function openCategoryBundle() {
      const b = bundlesForSale(x => !x.allAccess && x.categories.includes(selectedCategory))[0] || bundlesForSale(x => x.allAccess)[0];
      if (b) openBundleCheckout(b.id);
    }

    function openAllAccessUpsell() {
      const b = bundlesForSale(x => x.allAccess)[0];
      if (b) openBundleCheckout(b.id);
    }

    // ---- Admin ----
    let editingBundleId = null;
    // Separate from the Word Page Creator's own `slugManuallyEdited` global (js/08_word_page_creator.js)
    // -- same Edit/Done-toggle-on-a-readonly-field pattern, but a bundle and a page can be open for
    // editing independently, so this needs its own flag rather than sharing that one.
    let bdlSlugManuallyEdited = false;

    function bundleSummary(b) {
      if (b.allAccess) return 'Everything on the site';
      const parts = [];
      if (b.categories.length) parts.push(b.categories.map(c => EXAM_CATEGORIES[c]?.defaultScheme.examBadge || c).join(', ') + ' papers');
      if (b.papers.length) parts.push(`${b.papers.length} paper${b.papers.length > 1 ? 's' : ''}`);
      if ((b.mainsPapers || []).length) parts.push(`${b.mainsPapers.length} Mains test${b.mainsPapers.length > 1 ? 's' : ''}`);
      if (b.pages.length) parts.push(`${b.pages.length} page section${b.pages.length > 1 ? 's' : ''}`);
      if (b.pdfs.length) parts.push(`${b.pdfs.length} PDF${b.pdfs.length > 1 ? 's' : ''}`);
      if ((b.planners || []).length) parts.push(`advanced planner${b.planners.length > 1 ? 's' : ''}`);
      if ((b.features || []).length) parts.push(`${b.features.length} dashboard feature${b.features.length > 1 ? 's' : ''}`);
      return parts.join(' · ') || 'Nothing included yet';
    }

    function renderBundlesAdmin() {
      const list = document.getElementById('bundles-admin-list');
      if (!list) return;
      const holders = id => studentDirectory.filter(st => st.passes.includes(id)).length;
      list.innerHTML = bundles.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(b => `
        <div class="p-3 border rounded-xl ${b.active ? 'bg-white' : 'bg-slate-50'}">
          <div class="flex justify-between gap-2">
            <b class="text-slate-900">${escapeHtml(b.name)}</b>
            <span class="font-mono font-bold text-emerald-700">₹${b.price}</span>
          </div>
          <p class="text-slate-500 mt-0.5">${escapeHtml(bundleSummary(b))}</p>
          <div class="flex flex-wrap gap-1 mt-2 text-[10px] font-bold">
            <span class="px-1.5 py-0.5 rounded ${b.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">${b.active ? 'On sale' : 'Not on sale'}</span>
            ${b.showOnHome ? '<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">On home page</span>' : ''}
            ${b.featured ? '<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Popular</span>' : ''}
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${b.validityDays > 0 ? b.validityDays + ' days' : 'No expiry'}</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${holders(b.id)} student(s)</span>
          </div>
          <div class="flex gap-3 mt-2 items-center flex-wrap">
            <button onclick="editBundle('${b.id}')" class="text-blue-600 font-bold hover:underline">Edit</button>
            <button onclick="duplicateBundle('${b.id}')" class="text-slate-600 font-bold hover:underline">Duplicate</button>
            <button onclick="deleteBundle('${b.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
            <button onclick="renderBundleLandingPage('${b.id}')" class="text-emerald-700 font-bold hover:underline" title="Preview the shareable landing page">View landing page</button>
            <span class="text-slate-300">|</span>
            <label class="flex items-center gap-1 cursor-pointer text-[11px]" title="Whether this bundle can be purchased right now">
              <input type="checkbox" ${b.active ? 'checked' : ''} onchange="toggleBundleFlag('${b.id}', 'active', this.checked)" class="rounded" />
              <span class="font-medium text-slate-700">On sale</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer text-[11px]" title="Whether this bundle appears in the passes strip on the home page">
              <input type="checkbox" ${b.showOnHome ? 'checked' : ''} onchange="toggleBundleFlag('${b.id}', 'showOnHome', this.checked)" class="rounded" />
              <span class="font-medium text-slate-700">Show on home</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer text-[11px]" title="Highlights this bundle as Popular">
              <input type="checkbox" ${b.featured ? 'checked' : ''} onchange="toggleBundleFlag('${b.id}', 'featured', this.checked)" class="rounded" />
              <span class="font-medium text-slate-700">Popular</span>
            </label>
          </div>
        </div>`).join('') || '<p class="text-slate-400">No bundles yet.</p>';
    }

    // One-click bundle flag toggle from the admin list (mirrors what the bundle editor does)
    async function toggleBundleFlag(bundleId, flag, value) {
      const b = bundles.find(x => x.id === bundleId);
      if (!b) return;
      b[flag] = !!value;
      saveBundles();
      // Cloud upsert of just this bundle (same shape saveBundle uses)
      try {
        const { error } = await supabaseClient.from('bundles').upsert({
          id: b.id, name: b.name, tagline: b.tagline || '', price: b.price,
          validity_days: b.validityDays, highlights: b.highlights || [], active: b.active,
          show_on_home: b.showOnHome, featured: b.featured, style: b.style || 'light',
          order_num: b.order || 0, all_access: b.allAccess, categories: b.categories || [],
          papers: b.papers || [], pages: b.pages || [], pdfs: b.pdfs || [],
          planners: b.planners || [], features: b.features || [],
          mains_papers: b.mainsPapers || []
        });
        if (error) throw error;
      } catch (err) {
        console.error('Failed to sync bundle toggle to cloud:', fmtErr(err));
        alert('Toggle saved locally, but cloud sync failed: ' + err.message);
      }
      renderBundlesAdmin();
      renderHomeBundles();
    }

    function checkboxList(containerId, items, selected, cls) {
      document.getElementById(containerId).innerHTML = items.length ? items.map(it => `
        <label class="flex items-start gap-1.5 cursor-pointer" style="padding-left:${(it.depth || 0) * 14}px">
          <input type="checkbox" value="${escapeHtml(it.value)}" class="${cls} rounded mt-0.5" ${selected.includes(it.value) ? 'checked' : ''} />
          <span>${it.label}</span>
        </label>`).join('') : '<span class="text-slate-400">None yet</span>';
    }

    function editBundle(id) {
      const b = id ? getBundle(id) : {
        name: '', tagline: '', price: 499, validityDays: 365, allAccess: false, categories: [], papers: [], pages: [], pdfs: [],
        planners: [], features: [], highlights: [], active: true, featured: false, showOnHome: true, style: 'light', order: bundles.length + 1,
        slug: '', oldSlugs: [], schedulePdfId: null
      };
      editingBundleId = id;
      bdlSlugManuallyEdited = !!id; // existing bundles keep their link when the name changes, same as pages
      document.getElementById('bdl-slug-input').value = b.slug || '';
      setBdlSlugFieldEditable(false);
      updateBdlSlugHint();
      document.getElementById('bundle-editor-title').innerText = id ? `Edit: ${b.name}` : 'New bundle';
      document.getElementById('bdl-name').value = b.name;
      document.getElementById('bdl-tagline').value = b.tagline || '';
      document.getElementById('bdl-price').value = b.price;
      document.getElementById('bdl-validity').value = b.validityDays || '';
      document.getElementById('bdl-highlights').value = (b.highlights || []).join('\n');
      document.getElementById('bdl-active').checked = !!b.active;
      document.getElementById('bdl-home').checked = !!b.showOnHome;
      document.getElementById('bdl-featured').checked = !!b.featured;
      document.getElementById('bdl-style').value = b.style || 'light';
      document.getElementById('bdl-order').value = b.order || 0;
      document.getElementById('bdl-all').checked = !!b.allAccess;
      document.getElementById('bdl-includes').classList.toggle('opacity-40', !!b.allAccess);

      // Schedule/syllabus PDF picker: a single optional dropdown, separate from the `bdl-pdfs`
      // entitlement checkbox list above -- this one's purely informational (see bundleCardHtml).
      const schedSel = document.getElementById('bdl-schedule-pdf');
      schedSel.innerHTML = '<option value="">— None —</option>' +
        pdfVault.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.title)}</option>`).join('');
      schedSel.value = b.schedulePdfId || '';

      checkboxList('bdl-categories', Object.values(EXAM_CATEGORIES).map(c => ({ value: c.id, label: escapeHtml(c.name) })), b.categories, 'bdl-cat-cb');
      checkboxList('bdl-papers', testsCatalog.map(p => ({ value: p.id, label: `${escapeHtml(p.title)} <span class="text-slate-400">₹${p.price}</span>` })), b.papers, 'bdl-paper-cb');
      checkboxList('bdl-mains-papers', mainsTestPapers.map(p => ({ value: p.id, label: `${escapeHtml(p.title)} <span class="text-slate-400">₹${p.price}</span>` })), b.mainsPapers || [], 'bdl-mains-paper-cb');
      checkboxList('bdl-pages', pageTreeList().map(({ page, depth }) => ({ value: page.id, depth, label: `${escapeHtml(page.icon || '📄')} ${escapeHtml(page.title)}${page.isGated ? ' <span class="text-amber-700">(paid)</span>' : ''}` })), b.pages, 'bdl-page-cb');
      checkboxList('bdl-pdfs', pdfVault.map(d => ({ value: d.id, label: escapeHtml(d.title) })), b.pdfs, 'bdl-pdf-cb');
      checkboxList('bdl-planners', plannerList().map(pl => ({ value: pl.id, label: escapeHtml(pl.label) })), b.planners || [], 'bdl-planner-cb');
      checkboxList('bdl-features', DASHBOARD_FEATURES.map(f => ({ value: f.id, label: `${escapeHtml(f.name)} <span class="text-slate-400">(${featureLevelLabel(featureAccess[f.id])})</span>` })), b.features || [], 'bdl-feature-cb');

      const form = document.getElementById('bundle-editor');
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeBundleEditor() {
      editingBundleId = null;
      document.getElementById('bundle-editor').classList.add('hidden');
    }

    // ---- Bundle link/slug field (mirrors page-slug-input's Edit/Done pattern in
    // js/08_word_page_creator.js: syncSlugFromTitle/setSlugFieldEditable/toggleSlugEditing/updateSlugHint) ----
    function syncBdlSlugFromTitle() {
      if (bdlSlugManuallyEdited) return;
      document.getElementById('bdl-slug-input').value = slugify(document.getElementById('bdl-name').value);
      updateBdlSlugHint();
    }

    function setBdlSlugFieldEditable(editable) {
      const input = document.getElementById('bdl-slug-input');
      input.readOnly = !editable;
      input.classList.toggle('bg-slate-50', !editable);
      input.classList.toggle('text-slate-500', !editable);
      input.classList.toggle('bg-white', editable);
      input.classList.toggle('text-slate-900', editable);
      document.getElementById('bdl-slug-edit-btn').innerText = editable ? 'Done' : 'Edit';
    }

    function toggleBdlSlugEditing() {
      const input = document.getElementById('bdl-slug-input');
      if (input.readOnly) {
        bdlSlugManuallyEdited = true;
        setBdlSlugFieldEditable(true);
        input.focus();
        input.select();
      } else {
        input.value = slugify(input.value);
        if (!input.value && !editingBundleId) {
          bdlSlugManuallyEdited = false; // cleared on a new bundle: go back to following the name
          syncBdlSlugFromTitle();
        }
        setBdlSlugFieldEditable(false);
      }
      updateBdlSlugHint();
    }

    function updateBdlSlugHint() {
      const hint = document.getElementById('bdl-slug-hint');
      if (!hint) return;
      const slugVal = document.getElementById('bdl-slug-input').value.trim();
      const nameVal = document.getElementById('bdl-name').value.trim();
      if (editingBundleId) {
        const b = getBundle(editingBundleId);
        hint.innerText = (b && b.slug && slugify(slugVal) !== b.slug)
          ? `The old link (#/bundle/${b.slug}) will keep working and open this bundle.`
          : 'Changing the name keeps this link, so shared links stay valid.';
      } else if (nameVal && !slugVal) {
        hint.innerText = 'This name has no English letters, so the link will use the bundle ID. Click Edit to set a readable one.';
      } else if (bdlSlugManuallyEdited) {
        hint.innerText = 'Custom link. Lowercase letters, numbers and dashes only.';
      } else {
        hint.innerText = 'Filled in from the bundle name. Click Edit to change it.';
      }
    }

async function saveBundle(e) {
  e.preventDefault();
  const vals = cls => [...document.querySelectorAll(`.${cls}:checked`)].map(cb => cb.value);
  const bundleId = editingBundleId || ('b_' + Date.now());
  const name = document.getElementById('bdl-name').value.trim();

  // Slug uniqueness + old-slug-redirect-on-rename, mirroring js/08_word_page_creator.js's `taken`
  // closure and oldSlugs.push(existing.slug) logic (lines ~1786-1798) exactly.
  const slugInput = document.getElementById('bdl-slug-input');
  let slug = slugify(slugInput.value) || slugify(name) || bundleId;
  const bdlSlugTaken = s => bundles.some(x => x.id !== bundleId && (x.slug === s || x.id === s || (x.oldSlugs || []).includes(s)));
  if (bdlSlugTaken(slug)) {
    let n = 2;
    while (bdlSlugTaken(`${slug}-${n}`)) n++;
    const suggestion = `${slug}-${n}`;
    if (bdlSlugManuallyEdited && !confirm(`The link "${slug}" is already used by another bundle.\n\nUse "${suggestion}" instead?`)) return;
    slug = suggestion;
  }
  const existingBundle = editingBundleId ? getBundle(editingBundleId) : null;
  let oldSlugs = existingBundle ? (existingBundle.oldSlugs || []) : [];
  if (existingBundle && existingBundle.slug && existingBundle.slug !== slug && !oldSlugs.includes(existingBundle.slug)) {
    oldSlugs.push(existingBundle.slug);
  }

  const data = {
    id: bundleId,
    name,
    slug,
    old_slugs: oldSlugs,
    tagline: document.getElementById('bdl-tagline').value.trim(),
    price: Math.max(0, parseInt(document.getElementById('bdl-price').value, 10) || 0),
    validity_days: Math.max(0, parseInt(document.getElementById('bdl-validity').value, 10) || 0),
    highlights: document.getElementById('bdl-highlights').value.split('\n').map(x => x.trim()).filter(Boolean),
    active: document.getElementById('bdl-active').checked,
    show_on_home: document.getElementById('bdl-home').checked,
    featured: document.getElementById('bdl-featured').checked,
    style: document.getElementById('bdl-style').value,
    order_num: parseInt(document.getElementById('bdl-order').value, 10) || 0,
    all_access: document.getElementById('bdl-all').checked,
    categories: vals('bdl-cat-cb'),
    papers: vals('bdl-paper-cb'),
    pages: vals('bdl-page-cb'),
    pdfs: vals('bdl-pdf-cb'),
    planners: vals('bdl-planner-cb'),
    features: vals('bdl-feature-cb'),
    mains_papers: vals('bdl-mains-paper-cb'),
    schedule_pdf_id: document.getElementById('bdl-schedule-pdf').value || null
  };

  if (!data.name) return alert('Give the bundle a name.');

  // --- SYNC TO SUPABASE CLOUD ---
  const { error } = await supabaseClient.from('bundles').upsert(data);
  if (error) {
    return alert("Failed to save bundle to cloud: " + error.message);
  }

  // Remap back for local runtime state
  const runtimeBundle = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    oldSlugs: data.old_slugs,
    tagline: data.tagline,
    price: data.price,
    validityDays: data.validity_days,
    highlights: data.highlights,
    active: data.active,
    showOnHome: data.show_on_home,
    featured: data.featured,
    style: data.style,
    order: data.order_num,
    allAccess: data.all_access,
    categories: data.categories,
    papers: data.papers,
    pages: data.pages,
    pdfs: data.pdfs,
    planners: data.planners,
    features: data.features,
    mainsPapers: data.mains_papers,
    schedulePdfId: data.schedule_pdf_id
  };

  if (editingBundleId) {
    const index = bundles.findIndex(b => b.id === editingBundleId);
    if (index >= 0) bundles[index] = runtimeBundle;
  } else {
    bundles.push(runtimeBundle);
  }

  closeBundleEditor();
  afterBundleChange();
  alert(`Bundle "${data.name}" saved live to the cloud!`);
}

async function duplicateBundle(id) {
  const b = getBundle(id);
  if (!b) return;

  const newId = 'b_' + Date.now();
  // Fresh, non-colliding slug for the copy -- never reuses the original's slug (that would make
  // #/bundle/{slug} ambiguous between the two until the admin edits one), same uniqueness check
  // saveBundle uses, just without a confirm prompt since there's no user-typed input to respect here.
  let copySlug = slugify(`${b.name} copy`) || newId;
  const copySlugTaken = s => bundles.some(x => x.slug === s || x.id === s || (x.oldSlugs || []).includes(s));
  if (copySlugTaken(copySlug)) {
    let n = 2;
    while (copySlugTaken(`${copySlug}-${n}`)) n++;
    copySlug = `${copySlug}-${n}`;
  }
  const duplicatedData = {
    id: newId,
    name: `${b.name} (copy)`,
    slug: copySlug,
    old_slugs: [],
    tagline: b.tagline || '',
    price: b.price,
    validity_days: b.validityDays,
    highlights: b.highlights || [],
    active: false, // Default to inactive so you can review it before making it public
    show_on_home: false,
    featured: false,
    style: b.style || 'light',
    order_num: (b.order || 0) + 1,
    all_access: b.allAccess,
    categories: b.categories || [],
    papers: b.papers || [],
    pages: b.pages || [],
    pdfs: b.pdfs || [],
    planners: b.planners || [],
    features: b.features || [],
    mains_papers: b.mainsPapers || [],
    schedule_pdf_id: b.schedulePdfId || null
  };

  // --- SYNC TO SUPABASE CLOUD ---
  const { error } = await supabaseClient.from('bundles').upsert(duplicatedData);
  if (error) {
    return alert("Failed to duplicate bundle to cloud: " + error.message);
  }

  // Runtime state mapping
  const runtimeBundle = {
    id: duplicatedData.id,
    name: duplicatedData.name,
    slug: duplicatedData.slug,
    oldSlugs: duplicatedData.old_slugs,
    tagline: duplicatedData.tagline,
    price: duplicatedData.price,
    validityDays: duplicatedData.validity_days,
    highlights: duplicatedData.highlights,
    active: duplicatedData.active,
    showOnHome: duplicatedData.show_on_home,
    featured: duplicatedData.featured,
    style: duplicatedData.style,
    order: duplicatedData.order_num,
    allAccess: duplicatedData.all_access,
    categories: duplicatedData.categories,
    papers: duplicatedData.papers,
    pages: duplicatedData.pages,
    pdfs: duplicatedData.pdfs,
    planners: duplicatedData.planners,
    features: duplicatedData.features,
    mainsPapers: duplicatedData.mains_papers,
    schedulePdfId: duplicatedData.schedule_pdf_id
  };

  bundles.push(runtimeBundle);
  afterBundleChange();
  alert(`Bundle duplicated successfully as "${runtimeBundle.name}"!`);
}

async function deleteBundle(id) {
  const b = getBundle(id);
  if (!b) return;
  const holders = studentDirectory.filter(st => st.passes.includes(id));
  if (holders.length) {
    // FIX: this used to be a dead end — admin got an alert and no way forward except manually
    // finding and revoking the bundle from every holder one by one. Now: offer an explicit,
    // clearly-labeled force-delete that revokes it from all holders first, then deletes.
    const names = holders.slice(0, 5).map(s => s.email).join(', ');
    const more = holders.length > 5 ? ` and ${holders.length - 5} more` : '';
    const proceed = confirm(
      `${holders.length} student(s) currently hold "${b.name}" (${names}${more}).\n\n` +
      `Deleting this bundle will REMOVE THEIR ACCESS to everything it covers.\n\n` +
      `Click OK to revoke it from all ${holders.length} student(s) AND delete the bundle.\n` +
      `Click Cancel to keep the bundle (you can untick "On sale" instead to stop selling it without affecting current holders).`
    );
    if (!proceed) return;
    // Revoke from every holder first, pushing each updated student to cloud
    for (const st of holders) {
      revokePass(st, id);
      try {
        await supabaseClient.from('students').upsert({
          email: st.email, name: st.name || '', utr: st.utr || '', status: st.status || 'active',
          allowed_exams: st.allowedExams, allowed_pages: st.allowedPages, allowed_pdfs: st.allowedPdfs,
          passes: st.passes, pass_expiry: st.passExpiry || {}
        });
      } catch (err) {
        console.error(`Failed to revoke bundle from ${st.email} during force-delete:`, fmtErr(err));
      }
    }
  } else if (!confirm(`Delete the bundle "${b.name}"?`)) {
    return;
  }

  // --- DELETE FROM SUPABASE CLOUD ---
  const { error } = await supabaseClient
    .from('bundles')
    .delete()
    .eq('id', id);

  if (error) {
    return alert("Failed to delete bundle from cloud: " + error.message);
  }

  bundles = bundles.filter(x => x.id !== id);
  saveBundles();
  afterBundleChange();
  alert(`Bundle "${b.name}" deleted from cloud.${holders.length ? ` Access was revoked from ${holders.length} student(s) first.` : ''}`);
}
    function afterBundleChange() {
      renderBundlesAdmin();
      renderFeatureAccessAdmin();
      renderPlannersAdmin();
      renderHomeBundles();
      updateCategoryBundleButton();
      renderStudentEntitlementsDesk();
      renderStudentDirectoryTable();
      refreshUserScopedViews();
    }

