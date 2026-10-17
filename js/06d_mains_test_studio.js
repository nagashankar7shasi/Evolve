    /* ----------------------------------------------------
       6d. MAINS TEST PAPERS (admin)
    ----------------------------------------------------- */
    // A named, priced, bundle-coverable "N-question test" assembled from the existing Mains
    // question bank -- the Mains analog of tests_catalog / Test Paper Studio for Prelims, but far
    // lighter: there's no question AUTHORING here, just picking which already-written bank
    // questions belong to this paper, what it's worth, what it costs, and whether a bundle covers
    // it. The actual question text/model-answer/rubric always stays in mains_questions -- this
    // table only ever stores references (question_ids), never a content copy, so editing or
    // retiring a bank question is reflected everywhere it's used, including inside any paper.
    let mainsTestPapers = [];
    let editingMainsTestPaperId = null;
    let mtpFilterCategory = '';
    let mtpPickerCategory = '';
    let mtpPickerSubject = '';

    function getMainsTestPaper(id) {
      return mainsTestPapers.find(p => p.id === id) || null;
    }

    async function fetchCloudMainsTestPapers() {
      const { data, error } = await supabaseClient.from('mains_test_papers').select('*').order('order_num');
      if (error) { console.error('fetchCloudMainsTestPapers:', fmtErr(error)); return; }
      if (data) {
        mainsTestPapers = data.map(p => ({
          id: p.id, categoryId: p.category_id, subject: p.subject || '', title: p.title,
          questionIds: Array.isArray(p.question_ids) ? p.question_ids : [],
          price: +p.price || 0, bundleOnly: !!p.bundle_only, scheduled_for: p.scheduled_for || null,
          active: p.active !== false, delisted: !!p.delisted,
          order: Number.isFinite(+p.order_num) ? +p.order_num : 0
        }));
        if (typeof renderMainsTestPapersAdmin === 'function') renderMainsTestPapersAdmin();
        if (typeof renderMainsTestPapersGrid === 'function') renderMainsTestPapersGrid();
      }
    }

    function mainsTestPaperMarks(paper) {
      return paper.questionIds.reduce((sum, qid) => {
        const q = getMainsQuestion(qid);
        return sum + (q ? (+q.marks || 0) : 0);
      }, 0);
    }

    // ---- Admin list ----
    function mtpFilteredPapers() {
      return mainsTestPapers.filter(p => !mtpFilterCategory || p.categoryId === mtpFilterCategory);
    }

    function mtpAdminFilterChanged() {
      mtpFilterCategory = document.getElementById('mtp-filter-category').value;
      renderMainsTestPapersAdmin();
    }

    function renderMainsTestPapersAdmin() {
      const list = document.getElementById('mains-test-papers-admin-list');
      if (!list) return;
      const rows = mtpFilteredPapers();
      list.innerHTML = rows.map(p => {
        const catName = categoryDisplayName(p.categoryId);
        const liveDateStr = p.scheduled_for ? new Date(p.scheduled_for).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const coveringBundles = bundlesForSale(b => bundleCoversMainsTest(b, p));
        return `
        <div class="p-3 border rounded-xl ${p.active ? 'bg-white' : 'bg-slate-50'}">
          <div class="flex justify-between gap-2">
            <span class="flex flex-wrap gap-1 text-[10px] font-bold">
              <span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800">${escapeHtml(catName)}</span>
              ${p.subject ? `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(p.subject)}</span>` : ''}
              ${!p.active ? `<span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Off</span>` : ''}
              ${p.delisted ? `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Delisted</span>` : ''}
              ${p.bundleOnly ? `<span class="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">Bundle-only</span>` : ''}
            </span>
            <span class="font-mono font-bold text-emerald-700 whitespace-nowrap">${p.bundleOnly ? 'BUNDLE' : `₹${p.price}`}</span>
          </div>
          <p class="font-bold text-slate-900 mt-1.5">${escapeHtml(p.title)}</p>
          <p class="text-slate-500 mt-0.5">${p.questionIds.length} question${p.questionIds.length === 1 ? '' : 's'} · ${mainsTestPaperMarks(p)} marks${liveDateStr ? ` · 🗓 Live ${liveDateStr}` : ''}</p>
          <p class="text-slate-400 mt-0.5">${coveringBundles.length ? `Included in: ${coveringBundles.map(b => escapeHtml(b.name)).join(', ')}` : 'Not in any bundle yet'}</p>
          <div class="flex gap-3 mt-2 items-center">
            <button onclick="editMainsTestPaper('${p.id}')" class="text-blue-600 font-bold hover:underline">Edit</button>
            <button onclick="duplicateMainsTestPaper('${p.id}')" class="text-slate-600 font-bold hover:underline">Duplicate</button>
            <button onclick="deleteMainsTestPaper('${p.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
          </div>
        </div>`;
      }).join('') || '<p class="text-slate-400 col-span-full">No Mains test papers yet -- create one from the question bank below.</p>';
    }

    // ---- Editor ----
    function mtpPopulateCategorySelect(selected) {
      const sel = document.getElementById('mtp-category');
      if (!sel) return;
      sel.innerHTML = MAINS_CATEGORY_IDS.map(id => `<option value="${id}" ${id === selected ? 'selected' : ''}>${escapeHtml(categoryDisplayName(id))}</option>`).join('');
    }

    function editMainsTestPaper(id) {
      const p = id ? getMainsTestPaper(id) : {
        categoryId: MAINS_CATEGORY_IDS[0], subject: '', title: '', questionIds: [],
        price: 99, bundleOnly: false, scheduled_for: null, active: true, delisted: false,
        order: mainsTestPapers.reduce((max, x) => Math.max(max, x.order || 0), 0) + 10
      };
      editingMainsTestPaperId = id;
      document.getElementById('mtp-editor-title').innerText = id ? `Editing: ${p.title}` : 'New Mains test paper';
      mtpPopulateCategorySelect(p.categoryId);
      document.getElementById('mtp-title').value = p.title;
      document.getElementById('mtp-subject').value = p.subject || '';
      document.getElementById('mtp-price').value = p.price;
      document.getElementById('mtp-bundleonly').checked = !!p.bundleOnly;
      document.getElementById('mtp-active').checked = p.active !== false;
      document.getElementById('mtp-delisted').checked = !!p.delisted;
      document.getElementById('mtp-order').value = p.order || 0;
      if (p.scheduled_for) {
        const d = new Date(p.scheduled_for);
        const pad = n => String(n).padStart(2, '0');
        document.getElementById('mtp-scheduled-for').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        document.getElementById('mtp-scheduled-for').value = '';
      }
      mtpPickerCategory = p.categoryId;
      mtpPickerSubject = '';
      mtpRefreshPickerSubjectOptions();
      mtpRenderQuestionPicker(p.questionIds);

      const form = document.getElementById('mains-test-paper-editor');
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeMainsTestPaperEditor() {
      editingMainsTestPaperId = null;
      document.getElementById('mains-test-paper-editor').classList.add('hidden');
    }

    // The question picker always scopes to ONE category (a paper can't mix categories -- it's sold
    // and unlocked as a unit for that category) and, like the question bank's own filter, can be
    // narrowed further by subject. Ticking "Category" in the picker re-scopes it -- note this is a
    // SEPARATE field from the paper's own "Category" select above only in that changing one doesn't
    // silently move already-picked questions out of view; mtpSetPickerCategory keeps both in sync
    // since a paper's category and its question pool's category are always meant to match.
    function mtpSetPickerCategory(catId) {
      mtpPickerCategory = catId;
      document.getElementById('mtp-category').value = catId;
      mtpPickerSubject = '';
      mtpRefreshPickerSubjectOptions();
      mtpRenderQuestionPicker(mtpCurrentlyCheckedIds());
    }

    function mtpRefreshPickerSubjectOptions() {
      const sel = document.getElementById('mtp-picker-subject');
      if (!sel) return;
      const subjects = [...new Set(mainsQuestions.filter(q => q.categoryId === mtpPickerCategory).map(q => q.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      sel.innerHTML = '<option value="">All subjects</option>' + subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      sel.value = mtpPickerSubject;
    }

    function mtpPickerSubjectChanged() {
      mtpPickerSubject = document.getElementById('mtp-picker-subject').value;
      mtpRenderQuestionPicker(mtpCurrentlyCheckedIds());
    }

    function mtpCurrentlyCheckedIds() {
      return [...document.querySelectorAll('.mtp-question-cb:checked')].map(cb => cb.value);
    }

    // Renders every active bank question in the picker's current category/subject scope as a
    // checkbox, preserving whichever of `checkedIds` still match the current scope (so narrowing by
    // subject never silently drops an already-picked question from elsewhere in the same category --
    // it just scrolls out of view until the subject filter is cleared again).
    function mtpRenderQuestionPicker(checkedIds) {
      const checked = new Set(checkedIds || []);
      const pool = mainsQuestions.filter(q => q.categoryId === mtpPickerCategory && (!mtpPickerSubject || q.subject === mtpPickerSubject));
      const box = document.getElementById('mtp-question-picker');
      box.innerHTML = pool.length ? pool.map(q => `
        <label class="flex items-start gap-2 p-2 border-b border-slate-100 cursor-pointer">
          <input type="checkbox" value="${q.id}" class="mtp-question-cb mt-0.5 rounded" ${checked.has(q.id) ? 'checked' : ''} onchange="mtpUpdatePickerTotal()" />
          <span class="flex-1 text-xs">
            <span class="font-mono font-bold text-emerald-700">${q.marks}m</span>
            ${q.subject ? `<span class="ml-1 px-1 py-0 rounded bg-slate-100 text-slate-500 text-[10px]">${escapeHtml(q.subject)}</span>` : ''}
            <span class="text-slate-800 ml-1">${escapeHtml(q.question)}</span>
            ${!q.active ? '<span class="ml-1 text-rose-500 font-bold">(inactive -- can still be used, but won\'t appear in free practice)</span>' : ''}
          </span>
        </label>`).join('') : '<p class="text-slate-400 text-xs p-2">No bank questions in this category/subject yet. Add some under Mains question bank first.</p>';
      mtpUpdatePickerTotal();
    }

    function mtpUpdatePickerTotal() {
      const ids = mtpCurrentlyCheckedIds();
      const marks = ids.reduce((sum, qid) => { const q = getMainsQuestion(qid); return sum + (q ? (+q.marks || 0) : 0); }, 0);
      const el = document.getElementById('mtp-picker-total');
      if (el) el.innerText = `${ids.length} question${ids.length === 1 ? '' : 's'} selected · ${marks} marks`;
    }

    async function saveMainsTestPaper(e) {
      e.preventDefault();
      const title = document.getElementById('mtp-title').value.trim();
      if (!title) return alert('Give the paper a title.');
      const questionIds = mtpCurrentlyCheckedIds();
      if (!questionIds.length) return alert('Pick at least one question for this paper.');
      const scheduledRaw = document.getElementById('mtp-scheduled-for').value;
      const paperId = editingMainsTestPaperId || ('mtp_' + Date.now());
      const data = {
        id: paperId,
        category_id: document.getElementById('mtp-category').value,
        subject: document.getElementById('mtp-subject').value.trim(),
        title,
        question_ids: questionIds,
        price: Math.max(0, parseFloat(document.getElementById('mtp-price').value) || 0),
        bundle_only: document.getElementById('mtp-bundleonly').checked,
        scheduled_for: scheduledRaw ? new Date(scheduledRaw).toISOString() : null,
        active: document.getElementById('mtp-active').checked,
        delisted: document.getElementById('mtp-delisted').checked,
        order_num: parseInt(document.getElementById('mtp-order').value, 10) || 0
      };
      const { error } = await supabaseClient.from('mains_test_papers').upsert(data);
      if (error) return alert('Failed to save to cloud: ' + error.message);

      const runtime = {
        id: data.id, categoryId: data.category_id, subject: data.subject, title: data.title,
        questionIds: data.question_ids, price: data.price, bundleOnly: data.bundle_only,
        scheduled_for: data.scheduled_for, active: data.active, delisted: data.delisted, order: data.order_num
      };
      const idx = mainsTestPapers.findIndex(p => p.id === paperId);
      if (idx >= 0) mainsTestPapers[idx] = runtime; else mainsTestPapers.push(runtime);

      closeMainsTestPaperEditor();
      renderMainsTestPapersAdmin();
      if (typeof renderMainsTestPapersGrid === 'function') renderMainsTestPapersGrid();
      alert(`"${data.title}" saved live to the cloud!`);
    }

    async function duplicateMainsTestPaper(id) {
      const p = getMainsTestPaper(id);
      if (!p) return;
      const newId = 'mtp_' + Date.now();
      const data = {
        id: newId, category_id: p.categoryId, subject: p.subject, title: `${p.title} (copy)`,
        question_ids: p.questionIds, price: p.price, bundle_only: p.bundleOnly,
        scheduled_for: null, active: false, delisted: false, order_num: (p.order || 0) + 1
      };
      const { error } = await supabaseClient.from('mains_test_papers').upsert(data);
      if (error) return alert('Failed to duplicate: ' + error.message);
      mainsTestPapers.push({
        id: data.id, categoryId: data.category_id, subject: data.subject, title: data.title,
        questionIds: data.question_ids, price: data.price, bundleOnly: data.bundle_only,
        scheduled_for: data.scheduled_for, active: data.active, delisted: data.delisted, order: data.order_num
      });
      renderMainsTestPapersAdmin();
      alert(`Duplicated as "${data.title}" (left Off so you can review before publishing).`);
    }

    async function deleteMainsTestPaper(id) {
      const p = getMainsTestPaper(id);
      if (!p) return;
      const holders = studentDirectory.filter(st => (st.allowedMainsTests || []).includes(id));
      if (holders.length && !confirm(`${holders.length} student(s) individually hold this paper. Deleting it won't remove that grant from their record (it'll just point at nothing), but they'll no longer see the paper itself. Continue?`)) return;
      if (!holders.length && !confirm(`Delete "${p.title}"? This can't be undone.`)) return;
      const { error } = await supabaseClient.from('mains_test_papers').delete().eq('id', id);
      if (error) return alert('Failed to delete: ' + error.message);
      mainsTestPapers = mainsTestPapers.filter(x => x.id !== id);
      renderMainsTestPapersAdmin();
      if (typeof renderMainsTestPapersGrid === 'function') renderMainsTestPapersGrid();
      alert(`"${p.title}" deleted.`);
    }

    function openMainsTestCheckout(paperId) {
      const p = getMainsTestPaper(paperId);
      if (!p) return;
      if (p.bundleOnly) { alert('This test is bundle-only -- it isn\'t sold individually.'); return; }
      openCheckout('mains_test', p.id, `Mains Test — ${p.title}`, p.price);
    }
