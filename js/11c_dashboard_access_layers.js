    /* ----------------------------------------------------
       11c. DASHBOARD ACCESS LAYERS
    ----------------------------------------------------- */
    const DASHBOARD_FEATURES = [
      { id: 'planner', name: 'Study planner', desc: 'Week-by-week checklists for KPSC and UPSC, with daily routine and booklist.', def: 'free' },
      { id: 'analysis', name: 'Performance analysis', desc: 'Subject-wise accuracy and score trend across your tests.', def: 'free' },
      { id: 'mistakes', name: 'Practise my mistakes', desc: 'Re-practise every question you got wrong until you get it right.', def: 'paid' },
      { id: 'topic_builder', name: 'Topic test builder', desc: 'Build practice sessions or timed tests by exam and subject.', def: 'paid' },
      { id: 'material', name: 'My study material', desc: 'Quick links to the paid pages and PDFs you have unlocked.', def: 'free' }
    ];
    const FEATURE_LEVELS = { free: 'Everyone logged in', paid: 'Paying students', bundle: 'Chosen bundles only', off: 'Hidden' };
    let featureAccess = Object.assign(
      Object.fromEntries(DASHBOARD_FEATURES.map(f => [f.id, f.def])),
      JSON.parse(localStorage.getItem('kas_feature_access') || '{}'));

    function featureLevelLabel(level) {
      return FEATURE_LEVELS[level] || level;
    }

    // Anyone holding a bundle or at least one paid item
    function isPaidCustomer(student) {
      if (!student) return false;
      return activeBundlesFor(student).length > 0
        || student.allowedExams.some(id => (testsCatalog.find(p => p.id === id) || {}).price > 0)
        || student.allowedPages.length > 0 || student.allowedPdfs.length > 0;
    }

    function canUseFeature(fid) {
      if (isAdmin()) return true;
      const student = getCurrentStudent();
      if (!student) return false;
      const level = featureAccess[fid] || 'free';
      if (level === 'free') return true;
      if (level === 'paid') return isPaidCustomer(student);
      if (level === 'bundle') return activeBundlesFor(student).some(b => bundleCoversFeature(b, fid));
      return false;
    }

    function lockedFeatureHtml(fid, compact = false) {
      const f = DASHBOARD_FEATURES.find(x => x.id === fid);
      const level = featureAccess[fid];
      const offers = level === 'bundle'
        ? bundlesForSale(b => bundleCoversFeature(b, fid)).slice(0, 2)
        : bundlesForSale(() => true).slice(0, 2);
      return `
        <div class="${compact ? 'p-4' : 'p-6'} rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
          <div class="text-2xl" aria-hidden="true">🔒</div>
          <p class="font-bold text-slate-900 mt-1">${escapeHtml(f.name)}</p>
          <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">${escapeHtml(f.desc)}</p>
          <p class="text-[11px] text-slate-500 mt-2">${level === 'paid' ? 'Included with any paid bundle or purchase.' : 'Included in the bundles below.'}</p>
          <div class="flex flex-wrap justify-center gap-2 mt-3">
            ${offers.map(b => `<button onclick="openBundleCheckout('${b.id}')" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg">Get ${escapeHtml(b.name)} · ₹${b.price}</button>`).join('')
              || '<span class="text-xs text-slate-400">Ask the academy how to unlock this.</span>'}
          </div>
        </div>`;
    }

    function renderFeatureAccessAdmin() {
      const body = document.getElementById('feature-access-body');
      if (!body) return;
      body.innerHTML = DASHBOARD_FEATURES.map(f => {
        const inc = bundles.filter(b => bundleCoversFeature(b, f.id));
        return `
          <tr>
            <td class="py-2.5 pr-3"><b class="text-slate-800">${escapeHtml(f.name)}</b><div class="text-slate-500">${escapeHtml(f.desc)}</div></td>
            <td class="py-2.5 pr-3">
              <select data-feature="${f.id}" class="feature-level-sel px-2 py-1.5 border rounded-lg bg-white outline-none">
                ${Object.entries(FEATURE_LEVELS).map(([v, l]) => `<option value="${v}" ${featureAccess[f.id] === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </td>
            <td class="py-2.5 text-slate-600">${inc.length ? inc.map(b => escapeHtml(b.name)).join(', ') : '<span class="text-slate-400">None. Tick it inside a bundle.</span>'}</td>
          </tr>`;
      }).join('');
    }

    async function fetchCloudFeatureAccess() {
      const cloud = await fetchCloudAppSetting('feature_access');
      if (cloud) {
        featureAccess = { ...featureAccess, ...cloud };
        localStorage.setItem('kas_feature_access', JSON.stringify(featureAccess));
        renderFeatureAccessAdmin();
        refreshUserScopedViews();
      }
    }

    function saveFeatureAccess() {
      document.querySelectorAll('.feature-level-sel').forEach(sel => { featureAccess[sel.dataset.feature] = sel.value; });
      localStorage.setItem('kas_feature_access', JSON.stringify(featureAccess));
      saveCloudAppSetting('feature_access', featureAccess).then(ok => {
        if (!ok) console.warn('Access layers saved locally but cloud sync failed — will retry next save.');
      });
      const warn = DASHBOARD_FEATURES.filter(f => featureAccess[f.id] === 'bundle' && !bundles.some(b => bundleCoversFeature(b, f.id)));
      alert('Access layers saved.' + (warn.length ? `\n\nNote: no bundle includes ${warn.map(f => f.name).join(', ')} yet, so nobody can use ${warn.length > 1 ? 'them' : 'it'}. Tick it under "Dashboard features" in a bundle.` : ''));
      renderFeatureAccessAdmin();
      refreshUserScopedViews();
    }

