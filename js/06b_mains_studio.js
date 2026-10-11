    /* ----------------------------------------------------
       6b. MAINS QUESTION STUDIO (admin CRUD for the descriptive-answer question bank)
    ----------------------------------------------------- */
    // Scoped to KPSC KAS + UPSC CSE only -- the two exams with a real Mains/descriptive stage (PSI and
    // FDA-SDA are prelims-only objective exams). See sql/add_mains_ecosystem.sql for the full schema
    // and RLS rationale. This module only manages the question bank itself (mains_questions) -- student
    // submissions, AI evaluation and the human-eval queue are separate, later pieces.
    const MAINS_CATEGORY_IDS = ['kpsc_kas', 'upsc_cse'];
    let mainsQuestions = [];
    let editingMainsQuestionId = null;
    let mainsAdminFilterCategory = '';
    let mainsAdminFilterSubject = '';
    let mainsAdminSearch = '';

    function getMainsQuestion(id) {
      return mainsQuestions.find(q => q.id === id) || null;
    }

    async function fetchCloudMainsQuestions() {
      const { data, error } = await supabaseClient.from('mains_questions').select('*').order('created_at', { ascending: false });
      if (error) { console.error('fetchCloudMainsQuestions:', fmtErr(error)); return; }
      if (data) {
        mainsQuestions = data.map(q => ({
          id: q.id, categoryId: q.category_id, subject: q.subject || '', question: q.question || '',
          modelAnswer: q.model_answer || '', rubric: Array.isArray(q.rubric) ? q.rubric : [],
          marks: +q.marks || 0, wordLimit: q.word_limit != null ? +q.word_limit : null,
          previousYear: q.previous_year != null ? +q.previous_year : null, sourceNote: q.source_note || '',
          active: q.active !== false, createdAt: q.created_at
        }));
        if (typeof renderMainsQuestionsAdmin === 'function') renderMainsQuestionsAdmin();
      }
    }

    // ---- Category / subject pickers (category is a fixed 2-value set -- the DB CHECK constraint only
    // allows kpsc_kas/upsc_cse -- but display names come from the live, admin-editable EXAM_CATEGORIES
    // rather than being hardcoded here, so a category rename elsewhere shows up here automatically) ----
    function populateMainsCategorySelect(selected) {
      const sel = document.getElementById('mq-category');
      if (!sel) return;
      sel.innerHTML = MAINS_CATEGORY_IDS.map(id => {
        const name = EXAM_CATEGORIES[id] ? EXAM_CATEGORIES[id].name : id;
        return `<option value="${id}" ${id === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`;
      }).join('');
    }

    // Same registry + "+ Add new subject…" pattern as the Test Paper Studio's Subject field
    // (populateEditSubjectSelect in 06a_test_paper_studio.js) -- one shared examSubjects[categoryId]
    // registry across both Prelims papers and Mains questions, not a second parallel taxonomy.
    function populateMainsSubjectSelect(selected) {
      const sel = document.getElementById('mq-subject');
      if (!sel) return;
      const cat = document.getElementById('mq-category').value;
      const list = (examSubjects[cat] || []).slice().sort((a, b) => a.localeCompare(b));
      const opts = [...list];
      if (selected && !opts.some(s => s.toLowerCase() === selected.toLowerCase())) opts.unshift(selected);
      sel.innerHTML = '<option value="">— No subject —</option>' +
        opts.map(s => `<option value="${escapeHtml(s)}" ${s === selected ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('') +
        '<option value="__add_new__">+ Add new subject…</option>';
    }

    function mainsAddSubjectInline() {
      const cat = document.getElementById('mq-category').value;
      const name = prompt(`New subject name for ${EXAM_CATEGORIES[cat] ? EXAM_CATEGORIES[cat].name : cat}:`);
      if (!name || !name.trim()) { populateMainsSubjectSelect(''); return; }
      const trimmed = name.trim();
      const canonical = typeof canonicalizeSubject === 'function' ? canonicalizeSubject(cat, trimmed) : trimmed;
      if (typeof registerSubjectIfNew === 'function') registerSubjectIfNew(cat, canonical);
      populateMainsSubjectSelect(canonical);
    }

    function mainsSubjectChanged() {
      const sel = document.getElementById('mq-subject');
      if (sel.value === '__add_new__') mainsAddSubjectInline();
    }

    // ---- Rubric rows: plain DOM, no parallel JS array to keep in sync -- each row is a self-contained
    // pair of inputs, added/removed directly in the DOM, and read back by querySelectorAll at save time.
    // Simpler and less bug-prone than mirroring state for something this small. ----
    function mainsRubricRowHtml(criterion, weight) {
      return `<div class="mq-rubric-row flex gap-2 items-center">
        <input type="text" class="mq-rubric-criterion flex-1 px-2 py-1 border rounded outline-none" placeholder="e.g. Introduction &amp; context" value="${escapeHtml(criterion || '')}" />
        <input type="number" class="mq-rubric-weight w-20 px-2 py-1 border rounded outline-none font-mono" min="0" max="100" step="1" placeholder="%" value="${weight != null ? weight : ''}" />
        <button type="button" onclick="this.closest('.mq-rubric-row').remove()" class="text-rose-500 hover:text-rose-700 font-bold px-1" title="Remove criterion">&times;</button>
      </div>`;
    }
    function addMainsRubricRow() {
      document.getElementById('mq-rubric-rows').insertAdjacentHTML('beforeend', mainsRubricRowHtml('', ''));
    }
    function renderMainsRubricRowsFrom(rubric) {
      const wrap = document.getElementById('mq-rubric-rows');
      wrap.innerHTML = (rubric && rubric.length ? rubric : [{ criterion: '', weight: '' }])
        .map(r => mainsRubricRowHtml(r.criterion, r.weight)).join('');
    }
    function collectMainsRubricFromForm() {
      return [...document.querySelectorAll('#mq-rubric-rows .mq-rubric-row')]
        .map(row => ({
          criterion: row.querySelector('.mq-rubric-criterion').value.trim(),
          weight: Math.max(0, parseFloat(row.querySelector('.mq-rubric-weight').value) || 0)
        }))
        .filter(r => r.criterion); // a row left blank (e.g. accidentally added, never filled in) is just dropped, not saved as empty
    }
    function mainsRubricWeightTotal() {
      return collectMainsRubricFromForm().reduce((sum, r) => sum + r.weight, 0);
    }

    // ---- Admin list (filterable by category/subject/search -- the bank will grow into the hundreds
    // across two exams and many subjects, so a flat unfiltered list stops being usable fast) ----
    function mainsFilteredQuestions() {
      return mainsQuestions.filter(q => {
        if (mainsAdminFilterCategory && q.categoryId !== mainsAdminFilterCategory) return false;
        if (mainsAdminFilterSubject && q.subject !== mainsAdminFilterSubject) return false;
        if (mainsAdminSearch && !q.question.toLowerCase().includes(mainsAdminSearch.toLowerCase())) return false;
        return true;
      });
    }
    function mainsAdminFilterChanged() {
      mainsAdminFilterCategory = document.getElementById('mq-filter-category').value;
      mainsAdminFilterSubject = document.getElementById('mq-filter-subject').value;
      mainsAdminSearch = document.getElementById('mq-filter-search').value;
      renderMainsQuestionsAdmin();
    }
    // Subject filter options depend on which category is selected (or the union of both, if "All") --
    // repopulated whenever the category filter changes so it never shows subjects that can't match anything.
    function refreshMainsSubjectFilterOptions() {
      const sel = document.getElementById('mq-filter-subject');
      if (!sel) return;
      const cats = mainsAdminFilterCategory ? [mainsAdminFilterCategory] : MAINS_CATEGORY_IDS;
      const subjects = [...new Set(cats.flatMap(c => examSubjects[c] || []))].sort((a, b) => a.localeCompare(b));
      const prev = sel.value;
      sel.innerHTML = '<option value="">All subjects</option>' + subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      if (subjects.includes(prev)) sel.value = prev; else mainsAdminFilterSubject = '';
    }

    function renderMainsQuestionsAdmin() {
      const list = document.getElementById('mains-questions-admin-list');
      if (!list) return;
      refreshMainsSubjectFilterOptions(); // cheap + idempotent -- keeps the subject filter in sync with examSubjects even before the admin touches the category filter
      const rows = mainsFilteredQuestions();
      list.innerHTML = rows.map(q => {
        const catName = EXAM_CATEGORIES[q.categoryId] ? EXAM_CATEGORIES[q.categoryId].name : q.categoryId;
        return `
        <div class="p-3 border rounded-xl ${q.active ? 'bg-white' : 'bg-slate-50'}">
          <div class="flex justify-between gap-2">
            <span class="flex flex-wrap gap-1 text-[10px] font-bold">
              <span class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800">${escapeHtml(catName)}</span>
              ${q.subject ? `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(q.subject)}</span>` : ''}
              ${q.previousYear ? `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">PYQ ${q.previousYear}</span>` : ''}
              ${!q.active ? `<span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Off</span>` : ''}
            </span>
            <span class="font-mono font-bold text-emerald-700 whitespace-nowrap">${q.marks} marks</span>
          </div>
          <p class="text-slate-800 mt-1.5 line-clamp-3">${escapeHtml(q.question)}</p>
          <p class="text-slate-400 mt-1">${q.wordLimit ? `${q.wordLimit}-word limit · ` : ''}${q.rubric.length} rubric criteri${q.rubric.length === 1 ? 'on' : 'a'}</p>
          <div class="flex gap-3 mt-2 items-center">
            <button onclick="editMainsQuestion('${q.id}')" class="text-blue-600 font-bold hover:underline">Edit</button>
            <button onclick="duplicateMainsQuestion('${q.id}')" class="text-slate-600 font-bold hover:underline">Duplicate</button>
            <button onclick="deleteMainsQuestion('${q.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
          </div>
        </div>`;
      }).join('') || '<p class="text-slate-400 col-span-full">No questions match the current filter.</p>';
      const countEl = document.getElementById('mains-questions-count');
      if (countEl) countEl.innerText = `${rows.length} of ${mainsQuestions.length}`;
    }

    function editMainsQuestion(id) {
      const q = id ? getMainsQuestion(id) : {
        categoryId: 'kpsc_kas', subject: '', question: '', modelAnswer: '', rubric: [],
        marks: 10, wordLimit: null, previousYear: null, sourceNote: '', active: true
      };
      editingMainsQuestionId = id;
      document.getElementById('mains-question-editor-title').innerText = id ? 'Edit question' : 'New question';
      populateMainsCategorySelect(q.categoryId);
      populateMainsSubjectSelect(q.subject);
      document.getElementById('mq-question').value = q.question;
      document.getElementById('mq-model-answer').value = q.modelAnswer;
      document.getElementById('mq-marks').value = q.marks;
      document.getElementById('mq-word-limit').value = q.wordLimit != null ? q.wordLimit : '';
      document.getElementById('mq-previous-year').value = q.previousYear != null ? q.previousYear : '';
      document.getElementById('mq-source-note').value = q.sourceNote || '';
      document.getElementById('mq-active').checked = !!q.active;
      renderMainsRubricRowsFrom(q.rubric);

      const form = document.getElementById('mains-question-editor');
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeMainsQuestionEditor() {
      editingMainsQuestionId = null;
      document.getElementById('mains-question-editor').classList.add('hidden');
    }

    async function saveMainsQuestion(e) {
      e.preventDefault();
      const question = document.getElementById('mq-question').value.trim();
      if (!question) return alert('The question text is required.');
      const rubric = collectMainsRubricFromForm();
      const weightTotal = rubric.reduce((sum, r) => sum + r.weight, 0);
      if (rubric.length && Math.abs(weightTotal - 100) > 0.5 &&
          !confirm(`Rubric weights add up to ${weightTotal}%, not 100%. Both self-assessment and AI evaluation will still work, but scores may look a little off. Save anyway?`)) return;

      const wordLimitRaw = document.getElementById('mq-word-limit').value;
      const previousYearRaw = document.getElementById('mq-previous-year').value;
      const questionId = editingMainsQuestionId || ('mq_' + Date.now());
      const data = {
        id: questionId,
        category_id: document.getElementById('mq-category').value,
        subject: document.getElementById('mq-subject').value === '__add_new__' ? '' : document.getElementById('mq-subject').value,
        question,
        model_answer: document.getElementById('mq-model-answer').value.trim(),
        rubric,
        marks: Math.max(0, parseFloat(document.getElementById('mq-marks').value) || 0),
        word_limit: wordLimitRaw ? Math.max(1, parseInt(wordLimitRaw, 10)) : null,
        previous_year: previousYearRaw ? parseInt(previousYearRaw, 10) : null,
        source_note: document.getElementById('mq-source-note').value.trim(),
        active: document.getElementById('mq-active').checked
      };

      const { error } = await supabaseClient.from('mains_questions').upsert(data);
      if (error) return alert('Failed to save question to cloud: ' + error.message);

      const runtime = {
        id: data.id, categoryId: data.category_id, subject: data.subject, question: data.question,
        modelAnswer: data.model_answer, rubric: data.rubric, marks: data.marks, wordLimit: data.word_limit,
        previousYear: data.previous_year, sourceNote: data.source_note, active: data.active,
        createdAt: editingMainsQuestionId ? (getMainsQuestion(editingMainsQuestionId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
      };
      const idx = mainsQuestions.findIndex(q => q.id === questionId);
      if (idx >= 0) mainsQuestions[idx] = runtime; else mainsQuestions.unshift(runtime);

      closeMainsQuestionEditor();
      renderMainsQuestionsAdmin();
    }

    async function duplicateMainsQuestion(id) {
      const q = getMainsQuestion(id);
      if (!q) return;
      const newId = 'mq_' + Date.now();
      const data = {
        id: newId, category_id: q.categoryId, subject: q.subject, question: q.question + ' (copy)',
        model_answer: q.modelAnswer, rubric: q.rubric, marks: q.marks, word_limit: q.wordLimit,
        previous_year: q.previousYear, source_note: q.sourceNote, active: false
      };
      const { error } = await supabaseClient.from('mains_questions').upsert(data);
      if (error) return alert('Failed to duplicate question to cloud: ' + error.message);
      mainsQuestions.unshift({
        id: data.id, categoryId: data.category_id, subject: data.subject, question: data.question,
        modelAnswer: data.model_answer, rubric: data.rubric, marks: data.marks, wordLimit: data.word_limit,
        previousYear: data.previous_year, sourceNote: data.source_note, active: false, createdAt: new Date().toISOString()
      });
      renderMainsQuestionsAdmin();
    }

    // Deleting a question CASCADEs to any submissions/evaluations already made against it (see
    // sql/add_mains_ecosystem.sql) -- worth an honest warning before that happens, since unlike most
    // admin deletes in this app, this one can silently erase a student's already-submitted work.
    async function deleteMainsQuestion(id) {
      const q = getMainsQuestion(id);
      if (!q) return;
      const { count, error: countErr } = await supabaseClient.from('mains_submissions').select('id', { count: 'exact', head: true }).eq('question_id', id);
      if (countErr) console.error('deleteMainsQuestion count check:', fmtErr(countErr));
      const submissionWarning = count ? `\n\n⚠️ ${count} student submission(s) already exist for this question and will be permanently deleted along with it.` : '';
      if (!confirm(`Delete this question?${submissionWarning}\n\n"${q.question.slice(0, 120)}${q.question.length > 120 ? '…' : ''}"`)) return;
      const { error } = await supabaseClient.from('mains_questions').delete().eq('id', id);
      if (error) return alert('Failed to delete question from cloud: ' + error.message);
      mainsQuestions = mainsQuestions.filter(x => x.id !== id);
      renderMainsQuestionsAdmin();
    }
