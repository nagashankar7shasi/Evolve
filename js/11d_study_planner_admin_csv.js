    /* ----------------------------------------------------
       11d. STUDY PLANNER ADMIN + CSV
    ----------------------------------------------------- */
    const PLANNER_CSV_HEADER = ['Section', 'Week', 'Focus', 'Detail', 'Target', 'Book', 'Tag'];

    // Minimal CSV reader: quotes, escaped quotes, commas and new lines inside quotes
    function parseCSV(text) {
      const rows = [];
      let row = [], cell = '', q = false;
      text = text.replace(/^\ufeff/, '');
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
          else if (c === '"') q = false;
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
      }
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
      return rows.filter(r => r.some(x => String(x).trim() !== ''));
    }

    function plannerToCSV(c) {
      const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [PLANNER_CSV_HEADER];
      [['prelims_title', c.prelims.title], ['prelims_note', c.prelims.note], ['prelims_mock_from', c.prelims.mockFrom],
       ['mains_title', c.mains.title], ['mains_note', c.mains.note], ['mains_mock_from', c.mains.mockFrom],
       ['answer_rule', c.answerRule], ['revision', c.revision], ['resources_note', c.resourcesNote]]
        .forEach(([k, v]) => rows.push(['meta', '', k, v ?? '', '', '', '']));
      if (c.prelims.tab) rows.push(['meta', '', 'prelims_tab', c.prelims.tab, '', '', '']);
      if (c.mains.tab) rows.push(['meta', '', 'mains_tab', c.mains.tab, '', '', '']);
      c.prelims.weeks.forEach(x => rows.push(['prelims', x.w, x.focus, x.extra, x.target, x.book || '', x.tag || '']));
      c.mains.weeks.forEach(x => rows.push(['mains', x.w, x.focus, x.aw, x.target, '', x.tag || '']));
      c.daily.forEach(d => rows.push(['daily', '', d, '', '', '', '']));
      c.resources.forEach(g => g.items.forEach(it => rows.push(['books', '', g.g, it, '', '', ''])));
      return '\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n');
    }

    function csvToPlanner(text) {
      const rows = parseCSV(text);
      if (!rows.length) throw new Error('The file is empty.');
      const head = rows[0].map(h => h.trim().toLowerCase());
      const col = name => head.indexOf(name.toLowerCase());
      if (col('section') < 0 || col('focus') < 0) throw new Error('The first row must be the header: ' + PLANNER_CSV_HEADER.join(', '));
      const get = (r, name) => { const i = col(name); return i >= 0 ? String(r[i] ?? '').trim() : ''; };
      const c = { prelims: { title: 'Prelims', note: '', mockFrom: 99, weeks: [] }, mains: { title: 'Mains', note: '', mockFrom: 99, weeks: [] },
                  answerRule: '', daily: [], revision: '', resourcesNote: '', resources: [] };
      const problems = [];
      rows.slice(1).forEach((r, i) => {
        const sec = get(r, 'section').toLowerCase();
        const line = i + 2;
        if (sec === 'meta') {
          const k = get(r, 'focus'), v = get(r, 'detail');
          const map = { prelims_title: () => c.prelims.title = v, prelims_note: () => c.prelims.note = v, prelims_mock_from: () => c.prelims.mockFrom = parseInt(v, 10) || 99,
                        mains_title: () => c.mains.title = v, mains_note: () => c.mains.note = v, mains_mock_from: () => c.mains.mockFrom = parseInt(v, 10) || 99,
                        answer_rule: () => c.answerRule = v, revision: () => c.revision = v, resources_note: () => c.resourcesNote = v,
                        prelims_tab: () => { if (v) c.prelims.tab = v; }, mains_tab: () => { if (v) c.mains.tab = v; } };
          if (map[k]) map[k](); else problems.push(`Row ${line}: unknown meta key "${k}"`);
        } else if (sec === 'prelims' || sec === 'mains') {
          if (!get(r, 'focus')) { problems.push(`Row ${line}: ${sec} rows need a Focus`); return; }
          // Week left blank (checklists) → numbered in order
          const w = parseInt(get(r, 'week'), 10) || (c[sec].weeks.reduce((m, x) => Math.max(m, x.w), 0) + 1);
          const tag = get(r, 'tag').toLowerCase() || undefined;
          if (sec === 'prelims') c.prelims.weeks.push({ w, focus: get(r, 'focus'), extra: get(r, 'detail'), target: get(r, 'target'), book: get(r, 'book'), tag });
          else c.mains.weeks.push({ w, focus: get(r, 'focus'), aw: get(r, 'detail'), target: get(r, 'target'), tag });
        } else if (sec === 'daily') {
          if (get(r, 'focus')) c.daily.push(get(r, 'focus'));
        } else if (sec === 'books') {
          const g = get(r, 'focus'), it = get(r, 'detail');
          if (!g || !it) { problems.push(`Row ${line}: books rows need a group in Focus and a title in Detail`); return; }
          let grp = c.resources.find(x => x.g === g);
          if (!grp) c.resources.push(grp = { g, items: [] });
          grp.items.push(it);
        } else if (sec) problems.push(`Row ${line}: unknown section "${sec}"`);
      });
      ['prelims', 'mains'].forEach(k => {
        c[k].weeks.sort((a, b) => a.w - b.w);
        const dup = c[k].weeks.find((x, i, arr) => i && arr[i - 1].w === x.w);
        if (dup) problems.push(`${k} week ${dup.w} appears twice`);
      });
      if (!c.prelims.weeks.length && !c.mains.weeks.length && !c.daily.length) throw new Error('No prelims, mains or daily rows were found.');
      return { content: c, problems };
    }

    function versionSummary(c) {
      const books = c.resources.reduce((n, g) => n + g.items.length, 0);
      return `${c.prelims.weeks.length} ${c.prelims.tab || 'prelims'} · ${c.mains.weeks.length} ${c.mains.tab || 'mains'} · ${c.daily.length} daily · ${books} books`;
    }

    function renderPlannersAdmin() {
      const list = document.getElementById('planners-admin-list');
      if (!list) return;
      const users = id => Object.values(plannerStore).filter(r => r.exams && r.exams[id] && Object.keys(r.exams[id].done || {}).length).length;
      list.innerHTML = planners.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(pl => `
        <div class="p-4 border rounded-xl ${pl.active === false ? 'bg-slate-50' : 'bg-white'}">
          <div class="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
            <div><label class="block font-bold text-slate-700 mb-1">Switch label</label><input id="pl-label-${pl.id}" value="${escapeHtml(pl.label)}" maxlength="20" class="w-full px-2 py-1.5 border rounded-lg outline-none" /></div>
            <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Title</label><input id="pl-title-${pl.id}" value="${escapeHtml(pl.title)}" class="w-full px-2 py-1.5 border rounded-lg outline-none" /></div>
            <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Subtitle</label><input id="pl-sub-${pl.id}" value="${escapeHtml(pl.sub)}" class="w-full px-2 py-1.5 border rounded-lg outline-none" /></div>
            <div><label class="block font-bold text-slate-700 mb-1">Linked exam</label>
              <select id="pl-cat-${pl.id}" class="w-full px-2 py-1.5 border rounded-lg bg-white outline-none">
                ${Object.values(EXAM_CATEGORIES).map(c => `<option value="${c.id}" ${c.id === pl.category ? 'selected' : ''}>${escapeHtml(c.defaultScheme.examBadge)}</option>`).join('')}
              </select></div>
          </div>
          <div class="flex flex-wrap items-center gap-3 mt-3">
            <label class="flex items-center gap-1.5">Advanced version for
              <select id="pl-access-${pl.id}" class="px-2 py-1 border rounded bg-white outline-none">
                <option value="bundle" ${pl.advancedAccess === 'bundle' ? 'selected' : ''}>Bundles that include it</option>
                <option value="paid" ${pl.advancedAccess === 'paid' ? 'selected' : ''}>Any paying student</option>
                <option value="free" ${pl.advancedAccess === 'free' ? 'selected' : ''}>Everyone logged in</option>
              </select></label>
            <label class="flex items-center gap-1.5">Layout
              <select id="pl-layout-${pl.id}" class="px-2 py-1 border rounded bg-white outline-none">
                <option value="timeline" ${(pl.layout || 'timeline') === 'timeline' ? 'selected' : ''}>Weeks with dates (timeline)</option>
                <option value="checklist" ${pl.layout === 'checklist' ? 'selected' : ''}>Simple checklist (no weeks)</option>
              </select></label>
            <label class="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" id="pl-active-${pl.id}" ${pl.active !== false ? 'checked' : ''} class="rounded" /> Shown to students</label>
            <label class="flex items-center gap-1.5">Order <input type="number" id="pl-order-${pl.id}" value="${pl.order || 0}" class="w-14 px-1.5 py-1 border rounded font-mono" /></label>
            <button onclick="savePlannerDetails('${pl.id}')" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg">Save details</button>
            <button onclick="deletePlanner('${pl.id}')" class="text-rose-600 font-bold hover:underline">Delete planner</button>
            <span class="text-slate-400 ml-auto">${users(pl.id)} student(s) have ticks · in ${bundles.filter(b => bundleCoversPlanner(b, pl.id)).length} bundle(s)</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            ${['basic', 'advanced'].map(v => `
              <div class="p-3 rounded-lg border ${v === 'advanced' ? 'border-amber-300 bg-amber-50/50' : 'bg-slate-50'}">
                <div class="flex justify-between items-center">
                  <b class="text-slate-900">${v === 'basic' ? 'Basic · free for logged-in students' : 'Advanced · paid'}</b>
                </div>
                <p class="text-slate-500 mt-1">${versionSummary(pl.versions[v])}</p>
                <div class="flex flex-wrap gap-3 mt-2">
                  <button onclick="downloadPlannerCSV('${pl.id}', '${v}')" class="text-blue-600 font-bold hover:underline">Download CSV</button>
                  <button onclick="startPlannerUpload('${pl.id}', '${v}')" class="text-emerald-700 font-bold hover:underline">Upload CSV</button>
                  ${v === 'basic' ? `<button onclick="resetBasicFromAdvanced('${pl.id}')" class="text-slate-600 font-bold hover:underline">Rebuild from advanced (first 4 + 2 weeks)</button>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('') || '<p class="text-slate-400">No planners. Add one to show a checklist on student dashboards.</p>';
    }

    function savePlannerDetails(id) {
      const pl = planners.find(p => p.id === id);
      if (!pl) return;
      const v = k => document.getElementById(`pl-${k}-${id}`);
      pl.label = v('label').value.trim() || pl.label;
      pl.title = v('title').value.trim() || pl.title;
      pl.sub = v('sub').value.trim();
      pl.category = v('cat').value;
      pl.advancedAccess = v('access').value;
      pl.layout = v('layout').value;
      pl.active = v('active').checked;
      pl.order = parseInt(v('order').value, 10) || 0;
      savePlanners();
      renderPlannersAdmin();
      refreshUserScopedViews();
      alert(`"${pl.label}" planner saved.`);
    }

    function togglePlannerCsvHelp() {
      document.getElementById('planner-csv-help').classList.toggle('hidden');
    }

    function downloadPlannerCSV(id, version) {
      const pl = planners.find(p => p.id === id);
      if (pl) downloadFile(`planner_${slugify(pl.label) || pl.id}_${version}.csv`, plannerToCSV(pl.versions[version]), 'text/csv;charset=utf-8');
    }

    function downloadPlannerTemplate() {
      const c = {
        prelims: { title: 'Prelims — 12-Week Plan', note: 'Paper 1 + Paper 2 · objective', mockFrom: 11, weeks: [
          { w: 1, focus: 'Indian Polity — Constitution basics', extra: 'Newspaper 1 hr daily', target: 'Polity notes Part 1', book: 'Laxmikanth' },
          { w: 2, focus: 'Karnataka History — Kadambas to Hoysalas', extra: 'State current affairs', target: 'Dynasty table', book: 'Suryanath Kamath', tag: 'kn' }] },
        mains: { title: 'Mains — 10-Week Plan', note: 'Essay + GS I–IV', mockFrom: 9, weeks: [
          { w: 1, focus: 'GS-I: History of Karnataka', aw: '2 answers/day', target: 'Fact tables', tag: 'kn' }] },
        answerRule: '✍️ <b>Answer rule:</b> intro → body → conclusion.',
        daily: ['2 hrs core subject', '1 hr current affairs'],
        revision: 'Revise each subject 3 times.',
        resourcesNote: 'Standard booklist',
        resources: [{ g: 'Polity', items: ['M. Laxmikanth — Indian Polity'] }]
      };
      downloadFile('planner_template.csv', plannerToCSV(c), 'text/csv;charset=utf-8');
    }

    let plannerUploadTarget = null;
    function startPlannerUpload(id, version) {
      plannerUploadTarget = { id, version };
      document.getElementById('planner-csv-input').click();
    }

    function handlePlannerCSV(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file || !plannerUploadTarget) return;
      const { id, version } = plannerUploadTarget;
      const pl = planners.find(p => p.id === id);
      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try { parsed = csvToPlanner(reader.result); }
        catch (err) { return alert(`That CSV couldn't be used: ${err.message}`); }
        const msg = `Replace the ${version.toUpperCase()} version of "${pl.label}" with:\n${versionSummary(parsed.content)}` +
          (parsed.problems.length ? `\n\n${parsed.problems.length} row(s) were skipped:\n• ${parsed.problems.slice(0, 6).join('\n• ')}${parsed.problems.length > 6 ? '\n• …' : ''}` : '') +
          '\n\nStudents keep ticks for weeks with the same numbers.';
        if (!confirm(msg)) return;
        pl.versions[version] = parsed.content;
        savePlanners();
        renderPlannersAdmin();
        refreshUserScopedViews();
      };
      reader.readAsText(file);
    }

    function resetBasicFromAdvanced(id) {
      const pl = planners.find(p => p.id === id);
      if (!pl || !confirm(`Rebuild the Basic "${pl.label}" planner as the first 4 prelims weeks and first 2 mains weeks of the Advanced version?`)) return;
      pl.versions.basic = makeBasicVersion(pl.versions.advanced);
      savePlanners();
      renderPlannersAdmin();
      refreshUserScopedViews();
    }

    // ---- Exam Categories admin panel ----
    // Lists root categories (sorted by order) with each one's children (also sorted by order)
    // immediately following it, so the admin list visually groups sub-categories under their parent
    // instead of interleaving them by a flat order number.
    function hierarchicalCategoryList() {
      const all = Object.values(EXAM_CATEGORIES);
      const roots = all.filter(c => !c.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
      const out = [];
      roots.forEach(r => {
        out.push({ cat: r, depth: 0 });
        categoryChildren(r.id).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(ch => out.push({ cat: ch, depth: 1 }));
      });
      // Any orphaned category (parentId pointing at something deleted) still needs to show up somewhere
      const seen = new Set(out.map(x => x.cat.id));
      all.filter(c => !seen.has(c.id)).forEach(c => out.push({ cat: c, depth: 0 }));
      return out;
    }

    function renderExamCategoriesAdmin() {
      const list = document.getElementById('examcats-admin-list');
      if (!list) return;
      list.innerHTML = hierarchicalCategoryList().map(({ cat: c, depth }) => {
        const paperCount = testsCatalog.filter(p => p.category === c.id).length;
        const bundleCount = bundles.filter(b => (b.categories || []).includes(c.id)).length;
        const s = c.defaultScheme || {};
        // Parent options: every OTHER category that isn't this one's own descendant (prevents cycles)
        const descendantIds = new Set(categoryAndDescendants(c.id));
        const parentOptions = Object.values(EXAM_CATEGORIES).filter(o => !descendantIds.has(o.id));
        return `
        <div class="p-4 border rounded-xl ${c.active === false ? 'bg-slate-50' : 'bg-white'}" style="${depth ? `margin-left:${depth * 28}px; border-left:3px solid #f59e0b;` : ''}">
          ${depth ? `<div class="text-[10px] font-bold text-amber-700 mb-2">↳ SUB-CATEGORY OF ${escapeHtml(categoryDisplayName(c.parentId))}</div>` : ''}
          <div class="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
            <div><label class="block font-bold text-slate-700 mb-1">ID (fixed)</label><input value="${escapeHtml(c.id)}" disabled class="w-full px-2 py-1.5 border rounded-lg bg-slate-100 text-slate-500 font-mono" /></div>
            <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Display name</label><input id="ec-name-${c.id}" value="${escapeHtml(c.name)}" class="w-full px-2 py-1.5 border rounded-lg outline-none" /></div>
            <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Description (shown on Exam Hub banner)</label><input id="ec-desc-${c.id}" value="${escapeHtml(c.desc || '')}" class="w-full px-2 py-1.5 border rounded-lg outline-none" /></div>
            <div><label class="block font-bold text-slate-700 mb-1">Order</label><input id="ec-order-${c.id}" type="number" value="${c.order || 0}" class="w-full px-2 py-1.5 border rounded-lg font-mono" /></div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
            <div><label class="block font-bold text-slate-700 mb-1">OMR badge</label><input id="ec-badge-${c.id}" value="${escapeHtml(s.examBadge || c.name)}" class="w-full px-2 py-1.5 border rounded-lg" /></div>
            <div><label class="block font-bold text-slate-700 mb-1">Correct (+)</label><input id="ec-correct-${c.id}" type="number" step="0.05" value="${s.marksCorrect ?? 2}" class="w-full px-2 py-1.5 border rounded-lg font-mono text-emerald-700" /></div>
            <div><label class="block font-bold text-slate-700 mb-1">Wrong (-)</label><input id="ec-wrong-${c.id}" type="number" step="0.001" value="${s.marksWrong ?? 0.5}" class="w-full px-2 py-1.5 border rounded-lg font-mono text-rose-700" /></div>
            <div><label class="block font-bold text-slate-700 mb-1">Duration (min)</label><input id="ec-duration-${c.id}" type="number" value="${s.duration ?? 120}" class="w-full px-2 py-1.5 border rounded-lg font-mono" /></div>
            <div><label class="block font-bold text-slate-700 mb-1">Cutoff</label><input id="ec-cutoff-${c.id}" type="number" value="${s.cutoff ?? 100}" class="w-full px-2 py-1.5 border rounded-lg font-mono" /></div>
            <label class="flex items-center gap-1.5 pb-2 cursor-pointer"><input type="checkbox" id="ec-active-${c.id}" ${c.active !== false ? 'checked' : ''} class="rounded" /> Shown to students</label>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1 text-xs">Parent category (optional — nests this as a sub-category chip instead of its own tab)</label>
              <select id="ec-parent-${c.id}" class="w-full px-2 py-1.5 border rounded-lg bg-white outline-none text-xs">
                <option value="">— None (top-level tab) —</option>
                ${parentOptions.map(o => `<option value="${o.id}" ${c.parentId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="mt-2">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" id="ec-showscoring-${c.id}" ${c.showScoringPattern !== false ? 'checked' : ''} class="rounded" /> Show scoring pattern (marks per correct/wrong, max marks) on paper cards in this Exam Hub</label>
          </div>
          <details class="mt-3 border-t pt-3">
            <summary class="cursor-pointer text-xs font-bold text-slate-700">📚 Subjects (${(examSubjects[c.id] || []).length}) — used by Studio's Subject field and the student Topic Builder filter</summary>
            <div id="ec-subjects-${c.id}" class="mt-2"></div>
          </details>
          <details class="mt-3 border-t pt-3" ontoggle="if(this.open) renderCoverageAndCaReview('${c.id}')">
            <summary class="cursor-pointer text-xs font-bold text-slate-700">📊 Coverage &amp; Current Affairs review</summary>
            <div id="ec-coverage-${c.id}" class="mt-2 text-[11px] text-slate-400">Opens on expand…</div>
          </details>
          <div class="flex flex-wrap items-center gap-3 mt-3">
            <button onclick="saveExamCategoryDetails('${c.id}')" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg">Save</button>
            <button onclick="deleteExamCategoryMaster('${c.id}')" class="text-rose-600 font-bold hover:underline">Delete category</button>
            <span class="text-slate-400 ml-auto">${paperCount} paper(s) · ${bundleCount} bundle(s) reference this category</span>
          </div>
        </div>`;
      }).join('') || '<p class="text-slate-400">No exam categories yet.</p>';
      Object.keys(EXAM_CATEGORIES).forEach(renderCategorySubjectsAdmin);
    }

    // Non-blocking success toast for admin confirmations (Dev Console only) -- replaces a plain
    // alert() for "it worked, nothing else to do" cases. Two reasons alert() is the wrong tool here:
    // (1) once this browser tab has shown a few alert()s in a row (easy to do -- e.g. clicking Save
    // a few times on an already-saved group), Chrome offers "Prevent this page from creating
    // additional dialogs"; if that ever gets ticked, every later alert() on the page silently does
    // nothing -- no error, no visible failure, a save that fully succeeds just "doesn't pop". That's
    // what happened here: Supabase's logs showed every save landing with a 2xx, but the confirmation
    // never appeared. (2) a blocking modal interrupts the scroll position on an already-long admin
    // panel. Error alerts (validation failures, cloud-sync failures) stay as alert() since those are
    // rare and should demand attention -- this is only for "it worked" confirmations.
    function showAdminToast(message) {
      let host = document.getElementById('admin-toast-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'admin-toast-host';
        host.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none;';
        document.body.appendChild(host);
      }
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.cssText = 'background:#0f172a;color:#fff;font-size:12px;font-weight:600;padding:9px 14px;border-radius:10px;box-shadow:0 10px 25px -8px rgba(15,23,42,.45);max-width:320px;opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;';
      host.appendChild(toast);
      requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 220);
      }, 3200);
    }

    // Collapse state for the two things in this panel that can grow long over time: the raw subject
    // registry list (catId -> true once expanded; short lists just show, nothing to collapse) and
    // each subject group's checklist (`${catId}::${groupName}` -> true while its checkboxes are
    // shown). Both default to collapsed/summary so adding subjects or groups over time doesn't turn
    // this into one long scroll -- same instinct as the existing cleanup tool, which is already
    // hidden until its own button is clicked.
    let subjectRegistryExpanded = {};
    let expandedSubjectGroups = {};

    // ---- Subject registry admin (per category) ----
    function renderCategorySubjectsAdmin(catId) {
      const root = document.getElementById(`ec-subjects-${catId}`);
      if (!root) return;
      const list = (examSubjects[catId] || []).slice().sort((a, b) => a.localeCompare(b));
      const showList = subjectRegistryExpanded[catId] || list.length <= 8;
      root.innerHTML = `
        ${showList ? `
        <div class="space-y-1 mb-2">
          ${list.length ? list.map(s => `
            <div class="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1">
              <span class="flex-1 text-[11px] font-bold text-slate-700">${escapeHtml(s)}</span>
              <label class="text-[10px] text-slate-400">Weight</label>
              <select onchange="setSubjectWeight('${catId}', '${escapeHtml(s).replace(/'/g, "\\'")}', +this.value)" class="text-[11px] border rounded px-1 py-0.5 bg-white" title="Higher weight = Generate-from-Bank suggests pulling more of this subject">
                ${[1,2,3,4,5].map(n => `<option value="${n}" ${subjectWeight(catId, s) === n ? 'selected' : ''}>${n}${n===3 ? ' · Medium' : n===1 ? ' · Low' : n===5 ? ' · High' : ''}</option>`).join('')}
              </select>
              <button onclick="deleteSubjectFromRegistry('${catId}', '${escapeHtml(s).replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-rose-600" title="Remove from registry (existing questions keep their subject text)">✕</button>
            </div>`).join('') : '<p class="text-slate-400 text-[11px]">No subjects registered yet for this category.</p>'}
        </div>
        ${list.length > 8 ? `<button onclick="toggleSubjectRegistryExpanded('${catId}', false)" class="text-[11px] text-slate-400 hover:underline mb-2 block">▲ Collapse list</button>` : ''}
        ` : `<button onclick="toggleSubjectRegistryExpanded('${catId}', true)" class="text-[11px] font-bold text-slate-600 hover:underline mb-2 block">▼ ${list.length} subjects registered — show list</button>`}
        <div class="flex items-center gap-2 mb-2">
          <input type="text" id="ec-newsubject-${catId}" placeholder="New subject name" class="flex-1 px-2 py-1 border rounded-lg text-xs" onkeydown="if(event.key==='Enter'){event.preventDefault();addSubjectToRegistry('${catId}');}" />
          <button onclick="addSubjectToRegistry('${catId}')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg">Add</button>
        </div>
        <button onclick="renderSubjectCleanupTool('${catId}')" class="text-[11px] font-bold text-amber-700 hover:underline">🧹 Find & merge duplicate subjects in this category's questions</button>
        <div id="ec-subject-cleanup-${catId}" class="mt-2"></div>
        <div class="mt-3 border-t pt-2">
          <div class="text-[11px] font-bold text-slate-700 mb-1">📦 Subject groups <span class="text-slate-400 font-normal">— combine subjects into one row on the student Weakness/Strength dashboard (e.g. "History" + "Art &amp; Culture" → "Humanities"); a question's own subject tag is never changed, so ungrouping is just as easy</span></div>
          <div id="ec-subject-groups-${catId}"></div>
        </div>
      `;
      renderSubjectGroupsAdmin(catId);
    }

    function toggleSubjectRegistryExpanded(catId, open) {
      subjectRegistryExpanded[catId] = open;
      renderCategorySubjectsAdmin(catId);
    }

    // ---- Subject groups admin (per category) ----
    // Each group renders as a one-line summary (name + member count) with an "Edit" button, and only
    // expands to its full checkbox grid on demand -- a category with several groups used to mean
    // several full ~90-checkbox grids rendered at once, which is exactly what made this panel feel
    // endless. New drafts (from "+ Add group") open immediately since there's nothing to summarize
    // yet; a save collapses its group back to the summary row.
    function renderSubjectGroupsAdmin(catId) {
      const root = document.getElementById(`ec-subject-groups-${catId}`);
      if (!root) return;
      const groups = subjectGroups[catId] || [];
      const allSubjects = (examSubjects[catId] || []).slice().sort((a, b) => a.localeCompare(b));
      const groupedElsewhere = (subjName, exceptGroupName) =>
        groups.find(g => g.name !== exceptGroupName && g.members.includes(subjName));
      root.innerHTML = `
        ${groups.length ? groups.map((g, gi) => {
          const expanded = !!expandedSubjectGroups[`${catId}::${g.name}`];
          const delBtn = `<button onclick="deleteSubjectGroupUi('${catId}', ${JSON.stringify(g.name).replace(/"/g, '&quot;')})" class="text-rose-600 font-bold hover:underline">Delete${expanded ? ' group' : ''}</button>`;
          if (!expanded) {
            return `
            <div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2 text-[11px]">
              <span class="flex-1 font-bold text-slate-700">📦 ${escapeHtml(g.name)} <span class="text-slate-400 font-normal">(${g.members.length} subject${g.members.length === 1 ? '' : 's'})</span></span>
              <button onclick="toggleSubjectGroupExpanded('${catId}', ${JSON.stringify(g.name).replace(/"/g, '&quot;')}, true)" class="text-amber-700 font-bold hover:underline">Edit</button>
              ${delBtn}
            </div>`;
          }
          return `
          <div id="sg-group-${catId}-${gi}" class="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] mb-2">
            <div class="flex items-center gap-2 mb-1.5">
              <input type="text" class="sg-name-input flex-1 px-2 py-1 border rounded-lg font-bold" value="${escapeHtml(g.name)}" />
              <button onclick="toggleSubjectGroupExpanded('${catId}', ${JSON.stringify(g.name).replace(/"/g, '&quot;')}, false)" class="text-slate-500 font-bold hover:underline">Collapse</button>
              ${delBtn}
            </div>
            <div class="flex flex-wrap gap-2">
              ${allSubjects.length ? allSubjects.map(s => {
                const other = groupedElsewhere(s, g.name);
                const checked = g.members.includes(s);
                const disabled = !!other && !checked;
                return `<label class="flex items-center gap-1 ${disabled ? 'opacity-40' : 'cursor-pointer'}" ${disabled ? `title="Already in &quot;${escapeHtml(other.name)}&quot;"` : ''}>
                  <input type="checkbox" data-subject="${escapeHtml(s)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} class="rounded" />
                  ${escapeHtml(s)}
                </label>`;
              }).join('') : '<p class="text-slate-400">No subjects registered yet for this category.</p>'}
            </div>
            <button onclick="saveSubjectGroupUi('${catId}', ${gi})" class="mt-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg">Save group</button>
          </div>`;
        }).join('') : '<p class="text-slate-400 text-[11px] mb-2">No subject groups yet — ungrouped subjects show individually on the dashboard.</p>'}
        <div class="flex items-center gap-2">
          <input type="text" id="sg-newname-${catId}" placeholder="New group name" class="flex-1 px-2 py-1 border rounded-lg text-xs" onkeydown="if(event.key==='Enter'){event.preventDefault();addSubjectGroupUi('${catId}');}" />
          <button onclick="addSubjectGroupUi('${catId}')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg">+ Add group</button>
        </div>
      `;
    }

    function toggleSubjectGroupExpanded(catId, name, open) {
      const key = `${catId}::${name}`;
      if (open) expandedSubjectGroups[key] = true; else delete expandedSubjectGroups[key];
      renderSubjectGroupsAdmin(catId);
    }

    function addSubjectGroupUi(catId) {
      const input = document.getElementById(`sg-newname-${catId}`);
      const name = (input.value || '').trim();
      if (!name) return alert('Give the group a name.');
      const groups = subjectGroups[catId] || [];
      if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) return alert('A group with that name already exists.');
      // Draft only (local state) until "Save group" is clicked, same as every other admin form here --
      // lets the admin tick members before the first cloud write instead of creating an empty group.
      subjectGroups[catId] = [...groups, { name, members: [] }];
      expandedSubjectGroups[`${catId}::${name}`] = true; // open right away -- nothing to summarize yet
      input.value = '';
      renderSubjectGroupsAdmin(catId);
    }

    async function saveSubjectGroupUi(catId, gi) {
      const groups = subjectGroups[catId] || [];
      const g = groups[gi];
      if (!g) return;
      const container = document.getElementById(`sg-group-${catId}-${gi}`);
      const newName = (container.querySelector('.sg-name-input').value || '').trim();
      if (!newName) return alert('Give the group a name.');
      if (groups.some((og, ogi) => ogi !== gi && og.name.toLowerCase() === newName.toLowerCase())) {
        return alert('Another group already has that name.');
      }
      const members = [...container.querySelectorAll('input[type=checkbox][data-subject]')]
        .filter(cb => cb.checked).map(cb => cb.dataset.subject);
      const oldName = g.name;
      const ok = await saveSubjectGroup(catId, newName, members);
      // Renamed: the old-named row is a separate (category_id, group_name) primary key in Supabase,
      // so it has to be deleted explicitly too, or it'd linger as a stale duplicate.
      if (oldName !== newName) await deleteSubjectGroup(catId, oldName);
      delete expandedSubjectGroups[`${catId}::${oldName}`];
      delete expandedSubjectGroups[`${catId}::${newName}`]; // collapse back to the summary row once saved
      renderCategorySubjectsAdmin(catId); // full re-render so other groups' disabled checkboxes reflect the new membership
      // Re-saving an unchanged group leaves the screen looking identical, with nothing to signal
      // the click actually did anything -- so, same as applySubjectMerge's confirmation above,
      // give an explicit on-success confirmation here too (saveSubjectGroup already alerts on
      // failure, so skip this one then to avoid a confusing double popup).
      if (ok) showAdminToast(`Saved "${newName}" (${members.length} subject${members.length === 1 ? '' : 's'}).`);
    }

    function deleteSubjectGroupUi(catId, name) {
      if (!confirm(`Delete the "${name}" group? Its subjects will show individually on the dashboard again.`)) return;
      deleteSubjectGroup(catId, name);
      delete expandedSubjectGroups[`${catId}::${name}`];
      renderCategorySubjectsAdmin(catId);
    }

    function addSubjectToRegistry(catId) {
      const input = document.getElementById(`ec-newsubject-${catId}`);
      const name = (input.value || '').trim();
      if (!name) return;
      registerSubjectIfNew(catId, name);
      input.value = '';
      renderCategorySubjectsAdmin(catId);
    }

    function deleteSubjectFromRegistry(catId, name) {
      if (!confirm(`Remove "${name}" from the ${categoryDisplayName(catId)} subject list?\n\nQuestions already tagged with this subject keep their tag — they just won't offer it as a dropdown pick for NEW questions until it's re-added.`)) return;
      examSubjects[catId] = (examSubjects[catId] || []).filter(s => s !== name);
      if (examSubjectWeights[catId]) delete examSubjectWeights[catId][name];
      saveExamSubjects(catId, examSubjects[catId]);
      renderCategorySubjectsAdmin(catId);
    }

    // Scans every question across this category's papers, groups by subject text (case/whitespace-
    // insensitive), and shows each distinct group with its question count so the admin can merge
    // near-duplicates ("Polity" / "Indian Polity" / "POLITY ") into one canonical spelling in one go.
    // Exact-case-insensitive matches are already the same bucket (nothing further to merge there) —
    // this tool is for the genuinely different-looking duplicates a computer can't safely guess at.
    function subjectCleanupScan(catId) {
      const groups = {}; // normalized key -> { variants: Map(rawText -> count), total }
      testsCatalog.filter(p => p.category === catId && Array.isArray(p.questions)).forEach(p => {
        p.questions.forEach(q => {
          const raw = (q.subject || '').trim();
          if (!raw) return;
          const key = raw.toLowerCase();
          if (!groups[key]) groups[key] = { variants: new Map(), total: 0 };
          groups[key].variants.set(raw, (groups[key].variants.get(raw) || 0) + 1);
          groups[key].total++;
        });
      });
      return Object.values(groups).sort((a, b) => b.total - a.total);
    }

    async function renderSubjectCleanupTool(catId) {
      const root = document.getElementById(`ec-subject-cleanup-${catId}`);
      if (!root) return;
      root.innerHTML = '<p class="text-[11px] text-slate-400 mt-1">Scanning…</p>';
      // Admin catalog rows only carry question CONTENT once loaded on demand (see
      // ensurePaperQuestionsLoaded) — load every paper in this category first so the scan below sees
      // the full picture, not just whichever papers happened to already be open in this session.
      await Promise.all(testsCatalog.filter(p => p.category === catId).map(ensurePaperQuestionsLoaded));
      const groups = subjectCleanupScan(catId);
      if (!groups.length) {
        root.innerHTML = '<p class="text-[11px] text-slate-400 mt-1">No questions with a subject tag found in this category yet.</p>';
        return;
      }
      root.innerHTML = `<div class="mt-2 space-y-2 border-t pt-2">` + groups.map((g, gi) => {
        const variants = [...g.variants.entries()]; // [rawText, count][]
        const suggestion = variants.sort((a, b) => b[1] - a[1])[0][0]; // most common spelling wins by default
        return `
        <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
          <div class="flex flex-wrap items-center gap-1.5 mb-1">
            ${variants.map(([text, count]) => `<span class="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">${escapeHtml(text)} <b>×${count}</b></span>`).join('')}
          </div>
          <div class="flex items-center gap-1.5">
            <input type="text" id="ec-cleanup-target-${catId}-${gi}" value="${escapeHtml(suggestion)}" class="flex-1 px-2 py-1 border rounded-lg" />
            <button onclick="applySubjectMerge('${catId}', ${gi}, ${JSON.stringify(variants.map(v => v[0])).replace(/"/g, '&quot;')})" class="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg">Merge → this spelling</button>
          </div>
        </div>`;
      }).join('') + `</div>`;
    }

    // Rewrites every question in this category whose subject matches any of `fromVariants` (exact
    // text match) to the canonical spelling typed into that group's input, across every paper —
    // published papers included, since old attempts store their own frozen questionsSnapshot and are
    // unaffected either way. Also folds the registry down to just the canonical spelling.
    async function applySubjectMerge(catId, groupIndex, fromVariants) {
      const input = document.getElementById(`ec-cleanup-target-${catId}-${groupIndex}`);
      const canonical = (input.value || '').trim();
      if (!canonical) return alert('Type the spelling to merge these into first.');
      const fromSet = new Set(fromVariants);
      let changed = 0;
      const touchedPapers = [];
      testsCatalog.filter(p => p.category === catId && Array.isArray(p.questions)).forEach(p => {
        let paperChanged = false;
        p.questions.forEach(q => {
          if (fromSet.has((q.subject || '').trim())) { q.subject = canonical; changed++; paperChanged = true; }
        });
        if (paperChanged) touchedPapers.push(p);
      });
      if (!changed) return alert('Nothing matched — it may have already been merged.');
      registerSubjectIfNew(catId, canonical);
      // Drop the old spellings from the registry (keeping the canonical one) so they stop showing up
      // as separate dropdown options going forward.
      examSubjects[catId] = (examSubjects[catId] || []).filter(s => s === canonical || !fromSet.has(s));
      await saveExamSubjects(catId, examSubjects[catId]);
      // Persist each touched paper back to the cloud so the merge survives a reload, not just this tab.
      for (const p of touchedPapers) {
        try {
          await supabaseClient.from('tests_catalog').update({ questions: p.questions }).eq('id', p.id);
        } catch (err) {
          console.error(`Failed to save merged subjects for paper "${p.id}":`, fmtErr(err));
        }
      }
      showAdminToast(`Merged ${changed} question${changed === 1 ? '' : 's'} across ${touchedPapers.length} paper(s) into "${canonical}".`);
      renderCategorySubjectsAdmin(catId);
    }

    // ---- Coverage dashboard + Current Affairs staleness review (per category) ----
    // Both need the same up-front cost — every paper in the category with its full question content
    // loaded (ensurePaperQuestionsLoaded, same as the subject cleanup tool above) — so they share one
    // scan and one lazy-loaded panel rather than duplicating the load. Lazy: only scans when the
    // <details> is actually opened (see its ontoggle in renderExamCategoriesAdmin), not on every
    // render of the whole admin page.
    async function renderCoverageAndCaReview(catId) {
      const root = document.getElementById(`ec-coverage-${catId}`);
      if (!root) return;
      root.innerHTML = '<p class="text-slate-400">Scanning…</p>';
      const papers = testsCatalog.filter(p => p.category === catId);
      await Promise.all(papers.map(ensurePaperQuestionsLoaded));

      const bySubject = {}; // subject -> { static, ca }
      const caQuestions = []; // active (non-retired, not-yet-lapsed) CA questions, for the staleness review
      const lapsedQuestions = []; // active (non-retired) CA questions past their relevantUntil window, pending Accept/Reject
      papers.forEach(p => (p.questions || []).forEach(q => {
        const subj = subjectOf(q);
        const row = bySubject[subj] = bySubject[subj] || { static: 0, ca: 0 };
        if (q.contentType === 'ca') {
          row.ca++;
          if (!q.retired) {
            // Lapsed (relevantUntil has passed, no admin decision yet) goes to the Archive queue
            // instead of the ordinary staleness-review list — isCaLapsedPendingReview is the single
            // source of truth also used to exclude these from the bank/Topic Builder (see
            // js/06a_test_paper_studio.js, js/11b_practice_mistakes_topic_builder.js).
            if (isCaLapsedPendingReview(q)) lapsedQuestions.push({ paper: p, q });
            else caQuestions.push({ paper: p, q });
          }
        } else {
          row.static++;
        }
      }));
      const subjects = Object.keys(bySubject).sort((a, b) => a.localeCompare(b));

      const coverageHtml = subjects.length ? `
        <table class="w-full text-[11px] mb-3">
          <thead><tr class="text-left text-slate-400"><th class="font-bold pb-1">Subject</th><th class="font-bold pb-1 text-right">Static</th><th class="font-bold pb-1 text-right">Current Affairs</th><th class="font-bold pb-1 text-right">Total</th></tr></thead>
          <tbody>
            ${subjects.map(s => { const r = bySubject[s]; return `
            <tr class="border-t"><td class="py-1">${escapeHtml(s)}</td><td class="text-right ${r.static < 10 ? 'text-rose-600 font-bold' : ''}">${r.static}</td><td class="text-right">${r.ca}</td><td class="text-right font-bold">${r.static + r.ca}</td></tr>`; }).join('')}
          </tbody>
        </table>
        <p class="text-[10px] text-slate-400 mb-3">Subjects in red have fewer than 10 static questions — thin coverage worth topping up.</p>
      ` : '<p class="text-slate-400 mb-3">No questions found in this category yet.</p>';

      // Lapsed questions are sorted by relevantUntil ascending — longest-overdue first, since those
      // are the ones most likely to be showing genuinely outdated information if a student somehow
      // still saw them (they're already excluded from the bank, but the paper itself still has them).
      lapsedQuestions.sort((a, b) => (a.q.relevantUntil || '').localeCompare(b.q.relevantUntil || ''));
      const lapsedListHtml = lapsedQuestions.length ? `
        <div class="space-y-1.5 max-h-64 overflow-y-auto">
          ${lapsedQuestions.map(({ paper, q }) => `
            <div class="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
              <div class="flex-1 min-w-0">
                <div class="truncate">${escapeHtml(q.q_en || '(no English text)')}</div>
                <div class="text-slate-400">${escapeHtml(paper.title)} · lapsed ${escapeHtml(q.relevantUntil)}${q.relevantPeriod ? ' · ' + escapeHtml(q.relevantPeriod) : ''}</div>
              </div>
              <button onclick="archiveCaDecision('${paper.id}', ${q.id}, 'accept')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] whitespace-nowrap" title="Keep as a permanent Static question — clears the expiry">Accept</button>
              <button onclick="archiveCaDecision('${paper.id}', ${q.id}, 'reject')" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] whitespace-nowrap" title="Retire it — same as the staleness review's Retire">Reject</button>
            </div>`).join('')}
        </div>
      ` : '<p class="text-slate-400">No lapsed Current Affairs questions awaiting review in this category.</p>';

      // Nothing to sort chronologically on free-text periods, so this groups blank-period questions
      // first (most likely overlooked at authoring time) then alphabetically by period text.
      caQuestions.sort((a, b) => (a.q.relevantPeriod || '').localeCompare(b.q.relevantPeriod || ''));
      const caListHtml = caQuestions.length ? `
        <div class="space-y-1.5 max-h-64 overflow-y-auto">
          ${caQuestions.map(({ paper, q }) => `
            <div class="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              <div class="flex-1 min-w-0">
                <div class="truncate">${escapeHtml(q.q_en || '(no English text)')}</div>
                <div class="text-slate-400">${escapeHtml(paper.title)} · ${q.relevantPeriod ? escapeHtml(q.relevantPeriod) : '<span class="text-rose-500">no period set</span>'}${q.relevantUntil ? ' · relevant until ' + escapeHtml(q.relevantUntil) : ''}</div>
              </div>
              <button onclick="retireQuestion('${paper.id}', ${q.id})" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] whitespace-nowrap">Retire</button>
            </div>`).join('')}
        </div>
      ` : '<p class="text-slate-400">No active Current Affairs questions in this category.</p>';

      root.innerHTML = `
        <div class="mb-3"><b class="text-slate-700 block mb-1">Coverage by subject</b>${coverageHtml}</div>
        <div class="mb-3"><b class="text-slate-700 block mb-1">🗄 Archive — lapsed, needs a decision</b>
          <p class="text-[10px] text-slate-400 mb-1.5">These Current Affairs questions passed their one-year relevance window and are already excluded from the question bank, Topic Builder, and Generate-from-Bank — but still need you to Accept (keep permanently, as Static) or Reject (Retire) each one.</p>
          ${lapsedListHtml}
        </div>
        <div><b class="text-slate-700 block mb-1">Current Affairs — review for staleness</b>
          <p class="text-[10px] text-slate-400 mb-1.5">Retiring excludes a question from the question bank, Topic Builder, and future Generate-from-Bank sampling — it stays exactly as-is in the paper for anyone who already has it, and nothing is deleted.</p>
          ${caListHtml}
        </div>
      `;
    }

    async function retireQuestion(paperId, qId) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      await ensurePaperQuestionsLoaded(p);
      const q = (p.questions || []).find(x => x.id === qId);
      if (!q) return;
      if (!confirm(`Retire this question from "${p.title}"?\n\nIt stays in the paper for anyone who already has it, but is excluded from the question bank, Topic Builder, and future Generate-from-Bank sampling. This can be undone later from Studio's question editor.`)) return;
      q.retired = true;
      try {
        await supabaseClient.from('tests_catalog').update({ questions: p.questions }).eq('id', p.id);
      } catch (err) {
        alert('Retired locally, but cloud sync failed: ' + err.message);
      }
      renderCoverageAndCaReview(p.category);
    }

    // Admin decision on a lapsed (relevantUntil passed) Current Affairs question surfaced in the
    // Archive panel above. 'accept' keeps it permanently — reclassified to Static so it never lapses
    // again and clears relevantPeriod/relevantUntil (both documented as CA-only). 'reject' retires it,
    // identically to the existing standalone Retire button — same mechanism, same exclusion from the
    // bank/Topic Builder/Generate-from-Bank, same "stays as-is in the paper, nothing deleted" guarantee.
    async function archiveCaDecision(paperId, qId, decision) {
      const p = testsCatalog.find(x => x.id === paperId);
      if (!p) return;
      await ensurePaperQuestionsLoaded(p);
      const q = (p.questions || []).find(x => x.id === qId);
      if (!q) return;
      if (decision === 'accept') {
        if (!confirm(`Accept this question from "${p.title}"?\n\nIt becomes a permanent Static question — no more expiry, and it drops out of the Archive queue.`)) return;
        q.contentType = 'static';
        q.relevantPeriod = '';
        q.relevantUntil = '';
      } else {
        if (!confirm(`Reject this question from "${p.title}"?\n\nIt will be retired, same as the staleness review's Retire button — stays in the paper for anyone who already has it, but excluded from the question bank, Topic Builder, and future Generate-from-Bank sampling.`)) return;
        q.retired = true;
      }
      try {
        await supabaseClient.from('tests_catalog').update({ questions: p.questions }).eq('id', p.id);
      } catch (err) {
        alert(`${decision === 'accept' ? 'Accepted' : 'Rejected'} locally, but cloud sync failed: ` + err.message);
      }
      renderCoverageAndCaReview(p.category);
    }

    function addExamCategory() {
      const name = prompt('Name for the new exam category (e.g., "RRB NTPC"):');
      if (!name || !name.trim()) return;
      let id = slugify(name.trim()).replace(/-/g, '_');
      if (!id) return alert('Could not generate a valid ID from that name — try letters and numbers only.');
      if (EXAM_CATEGORIES[id]) {
        // Disambiguate if the slug collides with an existing category
        let n = 2;
        while (EXAM_CATEGORIES[`${id}_${n}`]) n++;
        id = `${id}_${n}`;
      }
      const cat = {
        id, name: name.trim(), desc: '',
        defaultScheme: { examBadge: name.trim(), marksCorrect: 2, marksWrong: 0.5, duration: 120, cutoff: 100 },
        order: Object.keys(EXAM_CATEGORIES).length + 1, active: true
      };
      saveExamCategory(cat).then(() => {
        refreshAllCategoryUI();
        alert(`"${cat.name}" added (ID: ${id}). It now appears in the Exam Hub tabs, the test paper studio, and bundle category checkboxes.`);
      });
    }

    function saveExamCategoryDetails(id) {
      const v = k => document.getElementById(`ec-${k}-${id}`);
      const cat = {
        id,
        name: v('name').value.trim() || EXAM_CATEGORIES[id].name,
        desc: v('desc').value.trim(),
        order: parseInt(v('order').value, 10) || 0,
        active: v('active').checked,
        showScoringPattern: v('showscoring').checked,
        parentId: (v('parent').value || '') || null,
        defaultScheme: {
          examBadge: v('badge').value.trim() || id,
          marksCorrect: parseFloat(v('correct').value) || 0,
          marksWrong: parseFloat(v('wrong').value) || 0,
          duration: parseInt(v('duration').value, 10) || 120,
          cutoff: parseFloat(v('cutoff').value) || 0
        }
      };
      saveExamCategory(cat).then(() => {
        refreshAllCategoryUI();
        alert(`"${cat.name}" saved.`);
      });
    }

    function addPlanner() {
      const label = prompt('Short label for the exam switch (for example "KPSC PSI"):');
      if (!label || !label.trim()) return;
      const asChecklist = confirm('Make it a simple checklist with no weeks?\n\nOK = checklist. Cancel = weekly timeline with dates.');
      const blank = () => ({
        prelims: { title: 'Prelims plan', note: '', mockFrom: 99, weeks: [{ w: 1, focus: 'First topic', extra: 'Daily task', target: 'Weekly target', book: '' }] },
        mains: { title: 'Mains plan', note: '', mockFrom: 99, weeks: [] },
        answerRule: '', daily: ['2 hrs core subject'], revision: '', resourcesNote: '', resources: []
      });
      planners.push({
        id: 'pl_' + Date.now(), label: label.trim().slice(0, 20), title: `${label.trim()} Study Planner`, sub: '',
        category: Object.keys(EXAM_CATEGORIES)[0], advancedAccess: 'bundle', active: false, order: planners.length,
        layout: asChecklist ? 'checklist' : 'timeline',
        versions: { basic: blank(), advanced: blank() }
      });
      savePlanners();
      renderPlannersAdmin();
      alert('Planner added (hidden for now). Upload its Basic and Advanced CSVs, then tick "Shown to students" and save.');
    }

    function deletePlanner(id) {
      const pl = planners.find(p => p.id === id);
      if (!pl || !confirm(`Delete the "${pl.label}" planner? Students' ticks for it are kept in case you re-create it with the same ID, but they won't see it.`)) return;
      planners = planners.filter(p => p.id !== id);
      bundles.forEach(b => { b.planners = (b.planners || []).filter(x => x !== id); });
      savePlanners();
      saveBundles();
      renderPlannersAdmin();
      renderBundlesAdmin();
      refreshUserScopedViews();
    }

    // Students see only their own attempts; the admin sees everyone's.
    function getVisibleAttempts() {
      if (!currentUser) return [];
      if (isAdmin()) return userAttempts;
      const email = normalizeEmail(currentUser.email);
      return userAttempts.filter(a => a.userEmail === email);
    }

    // Streak: count of consecutive days ending today (or yesterday) that had at least one attempt.
    // Uses attempt.date which is stored as 'dd/mm/yyyy' (en-GB). Parses back defensively.
    function renderStreakBadge(attempts) {
      const streakEl = document.getElementById('dash-streak');
      const hintEl = document.getElementById('dash-streak-hint');
      const pluralEl = document.getElementById('dash-streak-plural');
      if (!streakEl) return;
      if (!attempts.length) { streakEl.innerText = '0'; hintEl.innerText = 'Take a test today to start'; return; }
      const parseDate = (s) => {
        // 'dd/mm/yyyy' → Date at midnight local
        const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) return null;
        return new Date(+m[3], +m[2] - 1, +m[1]);
      };
      const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const daysWithAttempts = new Set(attempts.map(a => parseDate(a.date)).filter(Boolean).map(dayKey));
      let streak = 0;
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      // If today has no attempt, start counting from yesterday (grace period so a fresh visit doesn't
      // show 0 for someone whose streak is real from prior days)
      if (!daysWithAttempts.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
      while (daysWithAttempts.has(dayKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      streakEl.innerText = streak;
      if (pluralEl) pluralEl.innerText = streak === 1 ? '' : 's';
      if (streak === 0) hintEl.innerText = 'Take a test today to start';
      else if (streak < 3) hintEl.innerText = 'Keep going!';
      else if (streak < 7) hintEl.innerText = 'On a roll 🚀';
      else if (streak < 30) hintEl.innerText = 'Consistency pays off';
      else hintEl.innerText = 'Legendary discipline';
    }

    // Weakness heatmap: aggregate every question the student has attempted by its subject tag,
    // compute per-subject accuracy, and render as color-coded bars (green ≥70%, amber 40-70%, red <40%).
    function renderWeaknessHeatmap(attempts, admin) {
      const wrap = document.getElementById('dash-weakness-wrap');
      const strengthsGrid = document.getElementById('dash-strengths-grid');
      const weaknessGrid = document.getElementById('dash-weakness-grid');
      const strengthsEmpty = document.getElementById('dash-strengths-empty');
      const weaknessEmpty = document.getElementById('dash-weakness-empty');
      const countEl = document.getElementById('dash-weakness-count');
      if (!wrap) return;
      if (admin || attempts.length === 0) { wrap.classList.add('hidden'); return; }
      const subjects = {};       // { key: { correct, wrong, unattempted, total } }
      const labelByKey = {};     // key -> display label (a group name, or the raw subject if ungrouped)
      const membersByKey = {};   // key -> Set of raw subject strings actually seen under this key (for the Practise shortcut)
      // A student can have attempts from more than one exam category (e.g. KAS and PSI), and
      // subject groups are defined per category (see subjectGroupNameFor) -- so each attempt's own
      // paper->category has to be resolved to apply the RIGHT category's grouping to its questions,
      // rather than grouping blind off a bare subject string. Grouped rows are keyed internally by
      // `${categoryId}::${groupName}` so two different categories that happen to define a
      // same-named group (e.g. both calling one "Humanities") never get their stats merged into one
      // bucket -- only the display label is the plain group name. Ungrouped subjects keep the exact
      // same flat, cross-category key they always had (a bare subject string) -- unchanged behavior
      // for anyone who hasn't set up any groups.
      attempts.forEach(a => {
        const qs = a.questionsSnapshot || a.questions_snapshot || [];
        const sel = a.userSelections || a.user_selections || {};
        const paper = testsCatalog.find(p => p.id === (a.paperId || a.paper_id));
        const categoryId = paper && paper.category;
        qs.forEach((q, idx) => {
          const rawSubj = (q && q.subject && String(q.subject).trim()) || 'Untagged';
          const groupName = (categoryId && rawSubj !== 'Untagged') ? subjectGroupNameFor(categoryId, rawSubj) : rawSubj;
          const isGrouped = !!categoryId && groupName !== rawSubj;
          const key = isGrouped ? `${categoryId}::${groupName}` : rawSubj;
          if (!subjects[key]) {
            subjects[key] = { correct: 0, wrong: 0, unattempted: 0, total: 0 };
            labelByKey[key] = isGrouped ? groupName : rawSubj;
            membersByKey[key] = new Set();
          }
          membersByKey[key].add(rawSubj);
          subjects[key].total++;
          const choice = sel[idx + 1];
          if (!choice)                              subjects[key].unattempted++;
          else if (choice === (q && q.correct))     subjects[key].correct++;
          else                                       subjects[key].wrong++;
        });
      });
      const rows = Object.entries(subjects).map(([key, s]) => {
        const attempted = s.correct + s.wrong;
        const acc = attempted > 0 ? (s.correct / attempted) * 100 : 0;
        return { key, subj: labelByKey[key], members: [...membersByKey[key]], ...s, attempted, acc };
      });
      if (!rows.length) { wrap.classList.add('hidden'); return; }
      wrap.classList.remove('hidden');
      countEl.innerText = `${rows.length} subject${rows.length === 1 ? '' : 's'}`;

      // FIX: split into two explicit sections instead of one continuously-sorted list — strengths
      // (≥70%) sorted best-first, weaknesses (<70%) sorted worst-first so the most urgent thing to
      // fix surfaces at the top. The 70% cutoff matches the badge thresholds already used elsewhere.
      const strengths = rows.filter(r => r.acc >= 70).sort((a, b) => b.acc - a.acc);
      const weaknesses = rows.filter(r => r.acc < 70).sort((a, b) => a.acc - b.acc);

      const rowHtml = (r, isWeak) => {
        const barColor = r.acc >= 70 ? '#059669' : r.acc >= 40 ? '#f59e0b' : '#e11d48';
        const badgeBg  = r.acc >= 70 ? '#dcfce7' : r.acc >= 40 ? '#fef3c7' : '#fee2e2';
        const badgeFg  = r.acc >= 70 ? '#065f46' : r.acc >= 40 ? '#92400e' : '#991b1b';
        const label    = r.acc >= 70 ? 'Strong' : r.acc >= 40 ? 'Practise more' : 'Focus area';
        // Preserved from the old (now-removed) duplicate panel: a direct "Practise" shortcut that
        // jumps into a subject-filtered practice session — kept only on weak subjects, where it's
        // actually useful. For a grouped row, r.members holds every raw subject folded into it, so
        // the shortcut practises across all of them (matching what the row visually represents)
        // rather than just whichever one happened to be first.
        const practiseBtn = isWeak
          ? ` <button data-subjects='${escapeHtml(JSON.stringify(r.members))}' onclick="practiseSubject(JSON.parse(this.dataset.subjects))" class="text-amber-700 font-bold hover:underline text-[11px]">Practise →</button>`
          : '';
        const groupHint = r.members.length > 1
          ? ` <span class="text-[10px] text-slate-400" title="${escapeHtml(r.members.join(', '))}">(${r.members.length} subjects grouped)</span>`
          : '';
        return `
          <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
            <div class="min-w-0">
              <div class="flex items-baseline gap-2 flex-wrap">
                <span class="font-bold text-slate-800 text-sm truncate">${escapeHtml(r.subj)}</span>${groupHint}
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap" style="background:${badgeBg};color:${badgeFg};">${label}</span>
                ${practiseBtn}
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">${r.correct} right · ${r.wrong} wrong · ${r.unattempted} skipped (of ${r.total} seen)</div>
              <div class="h-2 mt-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div style="width:${r.acc.toFixed(0)}%;background:${barColor};height:100%;transition:width .3s;"></div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-black font-mono" style="color:${barColor};">${r.acc.toFixed(0)}%</div>
              <div class="text-[10px] text-slate-500 font-mono">accuracy</div>
            </div>
          </div>`;
      };

      strengthsGrid.innerHTML = strengths.map(r => rowHtml(r, false)).join('');
      weaknessGrid.innerHTML = weaknesses.map(r => rowHtml(r, true)).join('');
      strengthsEmpty.classList.toggle('hidden', strengths.length > 0);
      weaknessEmpty.classList.toggle('hidden', weaknesses.length > 0);
    }

    function renderDashboard() {
      const admin = isAdmin();
      const attempts = getVisibleAttempts();

      document.getElementById('dash-title').innerText = admin
        ? 'All Student Attempts'
        : (currentUser ? `Welcome, ${currentUser.name}` : 'Student Performance Dashboard');
      document.getElementById('dash-subtitle').innerText = admin
        ? 'Admin view: every attempt saved on this device, with the student who took it.'
        : (currentUser ? `Logged in as ${currentUser.email}. Your scorecards, unlocked material and answer keys.` : 'Log in to see your scorecards.');
      document.getElementById('dash-attempts-heading').innerText = admin
        ? 'All Completed Mock Tests'
        : 'My Completed Mock Tests (Click Review to View Solutions)';

      document.getElementById('dash-attempts-count').innerText = attempts.length;
      if (attempts.length > 0) {
        const totalScore = attempts.reduce((sum, a) => sum + parseFloat(a.score), 0);
        const totalAcc = attempts.reduce((sum, a) => sum + parseFloat(a.accuracy), 0);
        document.getElementById('dash-avg-score').innerText = (totalScore / attempts.length).toFixed(2);
        document.getElementById('dash-avg-accuracy').innerText = `${(totalAcc / attempts.length).toFixed(1)}%`;
      } else {
        document.getElementById('dash-avg-score').innerText = '--';
        document.getElementById('dash-avg-accuracy').innerText = '--%';
      }

      // Streak: consecutive days ending today or yesterday with at least one attempt.
      // If the last attempt was 2+ days ago, streak resets to 0.
      renderStreakBadge(attempts);
      // Weakness heatmap: per-subject accuracy aggregated across all attempts.
      renderWeaknessHeatmap(attempts, admin);

      document.getElementById('dash-student-col').classList.toggle('hidden', !admin);
      renderMyAccess();
      renderPerformanceAnalysis(admin ? [] : attempts);
      renderPracticeCenter();
      renderMyPayments();
      renderStudyPlanner();

      const table = document.getElementById('attempts-table-body');
      table.innerHTML = '';

      if (attempts.length === 0) {
        table.innerHTML = `
          <tr><td colspan="${admin ? 8 : 7}" class="py-8 text-center text-slate-400">${admin ? 'No students have completed a test on this device yet.' : 'No mock tests completed yet. Start a test in the Exam Hub!'}</td></tr>
        `;
        return;
      }

      attempts.forEach(a => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
          <td class="py-3 text-slate-500 font-mono">${a.date}</td>
          ${admin ? `<td class="py-3 text-slate-700">${a.userEmail ? escapeHtml(a.userEmail) : '<span class="text-slate-400">Unknown (older attempt)</span>'}</td>` : ''}
          <td class="py-3 font-bold text-slate-800">${escapeHtml(a.paperTitle)}${a.mode === 'practice' ? ' <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 align-middle">Practice</span>' : ''}</td>
          <td class="py-3 font-mono"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px]">${escapeHtml(a.badge)}</span></td>
          <td class="py-3 font-bold text-emerald-600 font-mono">${a.score} / ${a.maxMarks}</td>
          <td class="py-3 font-mono">${a.accuracy}%</td>
          <td class="py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${a.passed ? 'Cleared' : 'Under Cutoff'}</span></td>
          <td class="py-3 text-right">
            <button onclick="openAttemptReview('${a.id}')" class="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-[11px] transition shadow-sm">
              🔍 Review Solutions
            </button>
            <button onclick="downloadAttemptPdf('${a.id}')" class="ml-1 px-2.5 py-1 border border-slate-300 hover:bg-slate-50 rounded font-bold text-[11px]" title="Download question paper with your answers and explanations">⬇ PDF</button>
          </td>
        `;
        table.appendChild(tr);
      });
    }

