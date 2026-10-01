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
      return `
        <div class="${theme.card} p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          ${b.featured ? '<div class="absolute -right-12 top-6 bg-amber-500 text-slate-950 text-[10px] font-bold px-12 py-0.5 rotate-45 uppercase">Popular</div>' : ''}
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider ${theme.tag} px-2.5 py-0.5 rounded-full">${b.allAccess ? 'Everything included' : 'Bundle'}</span>
            <h4 class="text-lg font-bold mt-2">${escapeHtml(b.name)}</h4>
            <p class="text-xs ${theme.sub} mt-1">${escapeHtml(b.tagline || '')}</p>
            <div class="my-4 text-3xl font-black ${theme.price}">₹${b.price} <span class="text-xs font-normal ${theme.sub}">${b.validityDays > 0 ? `for ${b.validityDays >= 360 && b.validityDays % 365 === 0 ? (b.validityDays / 365) + ' year' + (b.validityDays > 365 ? 's' : '') : b.validityDays + ' days'}` : 'one-time'}</span></div>
            <ul class="text-xs ${theme.li} space-y-1.5">${(b.highlights || []).map(h => `<li>• ${escapeHtml(h)}</li>`).join('')}</ul>
          </div>
          <button onclick="openBundleCheckout('${b.id}')" class="mt-6 w-full py-2.5 ${theme.btn} font-bold text-xs rounded-lg transition shadow">
            ${owned ? 'You have this. Extend' : `Get ${escapeHtml(b.name)}`}
          </button>
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

    function bundleSummary(b) {
      if (b.allAccess) return 'Everything on the site';
      const parts = [];
      if (b.categories.length) parts.push(b.categories.map(c => EXAM_CATEGORIES[c]?.defaultScheme.examBadge || c).join(', ') + ' papers');
      if (b.papers.length) parts.push(`${b.papers.length} paper${b.papers.length > 1 ? 's' : ''}`);
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
          planners: b.planners || [], features: b.features || []
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
        planners: [], features: [], highlights: [], active: true, featured: false, showOnHome: true, style: 'light', order: bundles.length + 1
      };
      editingBundleId = id;
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

      checkboxList('bdl-categories', Object.values(EXAM_CATEGORIES).map(c => ({ value: c.id, label: escapeHtml(c.name) })), b.categories, 'bdl-cat-cb');
      checkboxList('bdl-papers', testsCatalog.map(p => ({ value: p.id, label: `${escapeHtml(p.title)} <span class="text-slate-400">₹${p.price}</span>` })), b.papers, 'bdl-paper-cb');
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

async function saveBundle(e) {
  e.preventDefault();
  const vals = cls => [...document.querySelectorAll(`.${cls}:checked`)].map(cb => cb.value);
  const bundleId = editingBundleId || ('b_' + Date.now());
  
  const data = {
    id: bundleId,
    name: document.getElementById('bdl-name').value.trim(),
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
    features: vals('bdl-feature-cb')
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
    features: data.features
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
  const duplicatedData = {
    id: newId,
    name: `${b.name} (copy)`,
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
    features: b.features || []
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
    features: duplicatedData.features
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

