    /* ----------------------------------------------------
       9. NAVIGATION & GRANULAR CONTROLS
    ----------------------------------------------------- */
    // ---- Menu manager ----
    // navStructure: [{ id, label, action, autoChildren?, submenus: [{ id, label, action }] }]
    // action: 'page:<id>' | 'category:<cat>' | 'home' | 'tests' | 'dashboard' | 'https://…' | '#'
    let editingMenu = null; // { id, parentId }

    async function saveNav() {
      localStorage.setItem('kas_nav_menu', JSON.stringify(navStructure));

      // --- SYNC TO SUPABASE CLOUD ---
      // Each top-level menu is one row; its submenus travel with it as JSONB.
      const rows = navStructure.map((m, i) => ({
        id: m.id,
        label: m.label,
        action: m.action,
        auto_children: m.autoChildren || false,
        submenus: m.submenus || [],
        order_num: i
      }));

      if (rows.length) {
        const { error } = await supabaseClient.from('nav_menu').upsert(rows);
        if (error) console.error("Failed to sync menu to cloud:", fmtErr(error));
      }
    }

    function findMenuItem(id, parentId) {
      const list = parentId ? (navStructure.find(m => m.id === parentId) || {}).submenus || [] : navStructure;
      return { list, item: list.find(m => m.id === id) };
    }

    function menuPageId(action) {
      return typeof action === 'string' && action.startsWith('page:') ? action.slice(5) : null;
    }

    // Drop-down items: the ones added by hand, then (optionally) the linked page's own sub-pages
    function menuChildren(menu) {
      const manual = menu.submenus || [];
      const pid = menuPageId(menu.action);
      if (!menu.autoChildren || !pid) return manual;
      const linked = new Set(manual.map(s => menuPageId(s.action)).filter(Boolean));
      return manual.concat(childPagesOf(pid).filter(p => !linked.has(p.id)).map(p => ({ id: 'auto_' + p.id, label: p.title, action: 'page:' + p.id, auto: true })));
    }

    function uniquePageSlug(base, id) {
      let slug = slugify(base) || id;
      const taken = x => customPages.some(p => p.id !== id && (p.slug === x || p.id === x || (p.oldSlugs || []).includes(x)));
      let n = 2, out = slug;
      while (taken(out)) out = `${slug}-${n++}`;
      return out;
    }

    function syncMenuTargetFields() {
      const type = document.getElementById('menu-target-type').value;
      const parentId = document.getElementById('menu-parent-select').value;
      const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);
      show('menu-target-page', type === 'custom_page');
      show('menu-target-exam', type === 'exam_cat');
      show('menu-target-builtin', type === 'built_in');
      show('menu-target-url', type === 'external');
      document.getElementById('menu-target-url').required = type === 'external';

      // page list is rebuilt every time, so pages created a moment ago are always there
      const pageSel = document.getElementById('menu-target-page');
      const keep = pageSel.value;
      pageSel.innerHTML = pageTreeList().map(({ page, depth }) =>
        `<option value="page:${page.id}">${'\u00a0\u00a0\u00a0'.repeat(depth)}${depth ? '↳ ' : ''}${escapeHtml(page.title)}</option>`).join('')
        || '<option value="">No pages yet. Choose "A new page" instead.</option>';
      if (keep && [...pageSel.options].some(o => o.value === keep)) pageSel.value = keep;

      const examSel = document.getElementById('menu-target-exam');
      if (!examSel.options.length) {
        examSel.innerHTML = Object.values(EXAM_CATEGORIES).map(c => `<option value="category:${c.id}">${escapeHtml(c.name)} papers</option>`).join('');
      }

      const note = document.getElementById('menu-new-page-note');
      if (type === 'new_page') {
        const parentMenu = navStructure.find(m => m.id === parentId);
        const parentPage = parentMenu && customPages.find(p => p.id === menuPageId(parentMenu.action));
        note.innerHTML = `A blank page with this label as its title is created${parentPage ? ` <b>inside "${escapeHtml(parentPage.title)}"</b>` : ''} and linked to this menu item. It then opens in the Page Editor so you can write it.`;
        note.classList.remove('hidden');
      } else if (type === 'none') {
        note.innerHTML = parentId ? '<span class="text-rose-700">A drop-down heading only works in the top bar. Change "Where it appears" to Top bar.</span>' : 'Clicking the label does nothing; it only opens its drop-down. Add items inside it afterwards.';
        note.classList.remove('hidden');
      } else {
        note.classList.add('hidden');
      }
      const autoOk = !parentId && (type === 'custom_page' || type === 'new_page');
      document.getElementById('menu-auto-wrap').classList.toggle('hidden', !autoOk);
      document.getElementById('menu-auto-wrap').classList.toggle('flex', autoOk);
    }

    function fillMenuParentOptions(selected) {
      const sel = document.getElementById('menu-parent-select');
      sel.innerHTML = '<option value="">Top bar (main menu)</option>' + navStructure
        .filter(m => !editingMenu || editingMenu.parentId || m.id !== editingMenu.id)
        .map(m => `<option value="${m.id}">Inside the "${escapeHtml(m.label)}" drop-down</option>`).join('');
      sel.value = selected || '';
    }

    function resetMenuForm(parentId = '') {
      editingMenu = null;
      document.getElementById('menu-form').reset();
      document.getElementById('menu-form-title').innerText = 'Add a menu item';
      document.getElementById('menu-submit').innerText = 'Add to menu';
      document.getElementById('menu-cancel-edit').classList.add('hidden');
      fillMenuParentOptions(parentId);
      document.getElementById('menu-target-type').value = 'new_page';
      syncMenuTargetFields();
    }

    function addMenuItemInside(parentId) {
      resetMenuForm(parentId);
      document.getElementById('menu-label').focus();
      document.getElementById('menu-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function editMenuItem(id, parentId = '') {
      const { item } = findMenuItem(id, parentId);
      if (!item) return;
      editingMenu = { id, parentId: parentId || null };
      document.getElementById('menu-form-title').innerText = `Edit "${item.label}"`;
      document.getElementById('menu-submit').innerText = 'Save changes';
      document.getElementById('menu-cancel-edit').classList.remove('hidden');
      fillMenuParentOptions(parentId);
      document.getElementById('menu-label').value = item.label;
      const a = item.action || '#';
      let type = 'built_in';
      if (a.startsWith('page:')) type = 'custom_page';
      else if (a.startsWith('category:')) type = 'exam_cat';
      else if (a.startsWith('http')) type = 'external';
      else if (a === '#') type = 'none';
      document.getElementById('menu-target-type').value = type;
      syncMenuTargetFields();
      if (type === 'custom_page') document.getElementById('menu-target-page').value = a;
      if (type === 'exam_cat') document.getElementById('menu-target-exam').value = a;
      if (type === 'built_in') document.getElementById('menu-target-builtin').value = a;
      if (type === 'external') document.getElementById('menu-target-url').value = a;
      document.getElementById('menu-auto-children').checked = !!item.autoChildren;
      document.getElementById('menu-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function handleSaveMenuItem(e) {
      e.preventDefault();
      const label = document.getElementById('menu-label').value.trim();
      const parentId = document.getElementById('menu-parent-select').value || null;
      const type = document.getElementById('menu-target-type').value;
      if (!label) return;
      if (type === 'none' && parentId) return alert('A drop-down heading only works in the top bar. Change "Where it appears" to Top bar.');

      let action = '#';
      let createdPage = null;
      if (type === 'new_page') {
        const parentMenu = navStructure.find(m => m.id === parentId);
        const parentPageId = parentMenu ? menuPageId(parentMenu.action) : null;
        const id = 'p_' + Date.now();
        createdPage = {
          id, slug: uniquePageSlug(label, id), title: label, isGated: false, price: 0, oldSlugs: [],
          content: `<h1>${escapeHtml(label)}</h1><p>Write this page's content here.</p>`,
          parentId: parentPageId && customPages.some(p => p.id === parentPageId) ? parentPageId : null,
          icon: '📄', summary: '', childStyle: 'tiles', order: childPagesOf(parentPageId).length
        };
        customPages.push(createdPage);
        localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));
        action = 'page:' + id;
      } else if (type === 'custom_page') {
        action = document.getElementById('menu-target-page').value;
        if (!action) return alert('There are no pages yet. Choose "A new page" instead.');
      } else if (type === 'exam_cat') action = document.getElementById('menu-target-exam').value;
      else if (type === 'built_in') action = document.getElementById('menu-target-builtin').value;
      else if (type === 'external') {
        action = document.getElementById('menu-target-url').value.trim();
        if (!/^https?:\/\//i.test(action)) return alert('Web links must start with http:// or https://');
      }
      const autoChildren = !parentId && (type === 'custom_page' || type === 'new_page') && document.getElementById('menu-auto-children').checked;

      if (editingMenu) {
        const { list, item } = findMenuItem(editingMenu.id, editingMenu.parentId);
        if (!item) return resetMenuForm();
        const moving = (editingMenu.parentId || null) !== parentId;
        if (moving && !editingMenu.parentId && (item.submenus || []).length) {
          return alert(`"${item.label}" has its own drop-down items, so it can't go inside another drop-down. Move or delete its items first.`);
        }
        Object.assign(item, { label, action });
        if (!parentId) item.autoChildren = autoChildren; else delete item.autoChildren;
        if (moving) {
          list.splice(list.indexOf(item), 1);
          if (parentId) { delete item.submenus; navStructure.find(m => m.id === parentId).submenus.push(item); }
          else navStructure.push({ ...item, submenus: [] });
        }
      } else {
        const item = { id: 'nav_' + Date.now(), label, action };
        if (parentId) {
          const parent = navStructure.find(m => m.id === parentId);
          parent.submenus = parent.submenus || [];
          parent.submenus.push(item);
        } else {
          navStructure.push({ ...item, autoChildren, submenus: [] });
        }
      }

      saveNav();
      renderNavigation();
      renderGranularNavTree();
      resetMenuForm();
      if (createdPage) {
        showAdminPanel('pages');
        renderPagesList();
        loadPageIntoWordEditor(createdPage.id);
        document.getElementById('page-title-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
        alert(`Menu item "${label}" added, and a new page "${createdPage.title}" was created for it.\n\nIt's now open in the Page Editor. Write its content, then click "Save & Publish Page Live".`);
      }
    }

    function moveMenuItem(id, parentId, dir) {
      const { list, item } = findMenuItem(id, parentId);
      const i = list.indexOf(item), j = i + dir;
      if (!item || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      saveNav();
      renderNavigation();
      renderGranularNavTree();
    }

    async function deleteMenuItem(id, parentId = '') {
      const { list, item } = findMenuItem(id, parentId);
      if (!item) return;
      const n = (item.submenus || []).length;
      if (!confirm(`Remove "${item.label}" from the menu${n ? ` along with the ${n} item(s) in its drop-down` : ''}?\n\nPages it links to are not deleted.`)) return;
      list.splice(list.indexOf(item), 1);
      if (editingMenu && editingMenu.id === id) resetMenuForm();

      // --- SYNC TO SUPABASE CLOUD ---
      // Top-level delete removes the row; submenu delete is just the parent's JSONB updating (saveNav handles that).
      if (!parentId) {
        const { error } = await supabaseClient.from('nav_menu').delete().eq('id', id);
        if (error) console.error("Failed to delete menu from cloud:", fmtErr(error));
      }

      await saveNav();
      renderNavigation();
      renderGranularNavTree();
    }
    // old names, still used by older saved content
    function deleteTopMenu(id) { deleteMenuItem(id); }
    function deleteSubmenu(parentId, subId) { deleteMenuItem(subId, parentId); }
    function handleTargetTypeChange() { syncMenuTargetFields(); }

    function describeNavAction(action) {
      const a = action || '#';
      if (a === '#') return 'Drop-down heading';
      if (a.startsWith('page:')) {
        const page = findPage(a.slice(5));
        return page ? `Page: ${escapeHtml(page.title)}` : '⚠ page was deleted';
      }
      if (a.startsWith('category:')) return `Papers: ${escapeHtml(EXAM_CATEGORIES[a.slice(9)]?.name || a.slice(9))}`;
      if (a === 'home') return 'Home';
      if (a === 'tests') return 'Exam Hub';
      if (a === 'dashboard') return 'Student dashboard';
      return `Link: ${escapeHtml(a)}`;
    }

    function renderGranularNavTree() {
      const container = document.getElementById('granular-nav-tree');
      if (!container) return;
      const btns = (id, parentId) => `
        <span class="flex items-center gap-2 shrink-0">
          <button onclick="moveMenuItem('${id}', ${parentId ? `'${parentId}'` : 'null'}, -1)" class="text-slate-500 hover:text-slate-900" aria-label="Move up">▲</button>
          <button onclick="moveMenuItem('${id}', ${parentId ? `'${parentId}'` : 'null'}, 1)" class="text-slate-500 hover:text-slate-900" aria-label="Move down">▼</button>
          <button onclick="editMenuItem('${id}', '${parentId || ''}')" class="text-blue-600 font-bold hover:underline">Edit</button>
          <button onclick="deleteMenuItem('${id}', '${parentId || ''}')" class="text-rose-600 font-bold hover:underline">Remove</button>
        </span>`;
      container.innerHTML = navStructure.map(menu => {
        const kids = menuChildren(menu);
        const broken = a => menuPageId(a) && !findPage(menuPageId(a));
        return `
          <div class="p-2.5 bg-slate-50 border rounded-lg">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="min-w-0"><b class="text-slate-900">${escapeHtml(menu.label)}</b>
                <span class="${broken(menu.action) ? 'text-rose-600' : 'text-slate-500'}"> → ${describeNavAction(menu.action)}</span>
                ${kids.length ? `<span class="ml-1 px-1.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">DROP-DOWN · ${kids.length}</span>` : ''}</span>
              ${btns(menu.id, null)}
            </div>
            <div class="pl-3 mt-1.5 space-y-1 border-l-2 border-amber-300 ml-1">
              ${(menu.submenus || []).map(sub => `
                <div class="flex flex-wrap items-center justify-between gap-2 bg-white p-1.5 rounded border">
                  <span class="min-w-0">↳ <b>${escapeHtml(sub.label)}</b> <span class="${broken(sub.action) ? 'text-rose-600' : 'text-slate-500'}">→ ${describeNavAction(sub.action)}</span></span>
                  ${btns(sub.id, menu.id)}
                </div>`).join('')}
              ${kids.filter(k => k.auto).map(k => `<div class="p-1 text-slate-400">↳ ${escapeHtml(k.label)} <i>(sub-page, listed automatically)</i></div>`).join('')}
              <button onclick="addMenuItemInside('${menu.id}')" class="text-emerald-700 font-bold hover:underline p-1">+ Add item inside "${escapeHtml(menu.label)}"</button>
            </div>
          </div>`;
      }).join('') || '<p class="text-slate-400">The menu is empty.</p>';
      if (!editingMenu) fillMenuParentOptions(document.getElementById('menu-parent-select').value);
      syncMenuTargetFields();
    }

    function renderNavigation() {
      const container = document.getElementById('dynamic-nav-links');
      container.innerHTML = navStructure.map(menu => {
        const kids = menuChildren(menu);
        const hasLink = menu.action && menu.action !== '#';
        if (!kids.length) {
          return `<button class="hover:text-amber-400 transition" data-action="${escapeHtml(menu.action || '#')}" onclick="executeNav(this.dataset.action)">${escapeHtml(menu.label)}</button>`;
        }
        return `
          <div class="relative dropdown-parent group py-2">
            <button class="flex items-center space-x-1 hover:text-amber-400 transition" aria-haspopup="true"
              ${hasLink ? `data-action="${escapeHtml(menu.action)}" onclick="executeNav(this.dataset.action)"` : ''}>
              <span>${escapeHtml(menu.label)}</span>
              <svg class="w-3 h-3 fill-current mt-0.5 opacity-70" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
            </button>
            <div class="dropdown-menu hidden absolute left-0 top-full mt-1 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-2 z-50">
              ${hasLink ? `<a href="javascript:void(0)" data-action="${escapeHtml(menu.action)}" onclick="executeNav(this.dataset.action)" class="block px-4 py-2 text-xs font-bold text-amber-400 hover:bg-slate-700">${escapeHtml(menu.label)}: overview</a>` : ''}
              ${kids.map(k => `<a href="javascript:void(0)" data-action="${escapeHtml(k.action)}" onclick="executeNav(this.dataset.action)" class="block px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-amber-400 transition">${escapeHtml(k.label)}</a>`).join('')}
            </div>
          </div>`;
      }).join('');
      renderMobileMenu();
    }

    function renderMobileMenu() {
      const box = document.getElementById('mobile-menu');
      if (!box) return;
      const link = (label, action, cls = '') => `<a href="javascript:void(0)" data-action="${escapeHtml(action)}" onclick="toggleMobileMenu(false); executeNav(this.dataset.action)" class="block py-2 ${cls}">${escapeHtml(label)}</a>`;
      const items = navStructure.map(menu => {
        const kids = menuChildren(menu);
        const hasLink = menu.action && menu.action !== '#';
        if (!kids.length) return link(menu.label, menu.action || '#', 'font-bold');
        return `<div class="py-1">
          ${hasLink ? link(menu.label, menu.action, 'font-bold') : `<div class="py-2 font-bold">${escapeHtml(menu.label)}</div>`}
          <div class="pl-4 border-l border-slate-700">${kids.map(k => link(k.label, k.action, 'text-slate-300')).join('')}</div>
        </div>`;
      }).join('');
      const account = !currentUser
        ? `<button onclick="toggleMobileMenu(false); openLoginModal()" class="w-full mt-2 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">Aspirant Login</button>`
        : `${link('My Dashboard', 'dashboard', 'font-bold text-amber-400')}${isAdmin() ? link('⚙️ Dev Console', 'admin', 'font-bold text-amber-400') : ''}
           <button onclick="toggleMobileMenu(false); logout()" class="py-2 text-slate-400 underline">Logout (${escapeHtml(currentUser.name)})</button>`;
      box.innerHTML = `<nav aria-label="Main menu">${items}</nav><div class="mt-2 pt-2 border-t border-slate-700">${account}</div>`;
    }

    function toggleMobileMenu(force) {
      const box = document.getElementById('mobile-menu');
      const open = typeof force === 'boolean' ? force : box.classList.contains('hidden');
      box.classList.toggle('hidden', !open);
      document.getElementById('mobile-menu-btn').setAttribute('aria-expanded', String(open));
      if (open) renderMobileMenu();
    }

    function executeNav(action) {
      if (!action || action === '#') return;
      if (['home', 'tests', 'dashboard', 'admin'].includes(action)) {
        navigate(action);
      } else if (action.startsWith('category:')) {
        navigate('tests');
        filterExamCategory(action.replace('category:', ''));
      } else if (action.startsWith('page:')) {
        renderDynamicCustomPage(action.replace('page:', ''));
      } else if (action.startsWith('http')) {
        window.open(action, '_blank');
      }
    }

