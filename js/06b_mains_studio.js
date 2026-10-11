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

    /* ----------------------------------------------------
       Bulk upload (CSV file or pasted spreadsheet rows) -- mirrors the Test Paper Studio's
       header-alias + unknown-header-mapping-UI pattern (studioNormalizeHeader, STUDIO_HEADER_ALIASES,
       the studio-mapping-panel flow in 06a_test_paper_studio.js) so admins get the same safety net
       here that fixed the earlier Exp_Image_URL alias bug there -- an unrecognized column is always
       surfaced for the admin to map, never silently dropped or misread.

       Deliberately a SIMPLER single-stage flow than the Test Paper Studio's CSV path, though: rows
       are validated/normalized then upserted straight to Supabase (no local-staging-array + separate
       "Publish" step), because the Mains Studio already has a full rich per-question edit form
       (editMainsQuestion/saveMainsQuestion above) the admin can use to touch up any row right after a
       bulk import -- a second staging layer on top of that would just be extra machinery for no real
       benefit here.
    ----------------------------------------------------- */
    // Rubric is a variable-length array of {criterion, weight} pairs, which doesn't fit a fixed set of
    // CSV columns without either capping how many criteria a question can have or producing a very
    // sparse sheet (most questions have 2-4 criteria, some none). A single delimited text column reads
    // naturally in a spreadsheet and round-trips cleanly: "Criterion:Weight; Criterion:Weight; ...".
    function mainsParseRubricString(s) {
      if (!s || !String(s).trim()) return [];
      return String(s).split(';').map(part => part.trim()).filter(Boolean).map(part => {
        const idx = part.lastIndexOf(':');
        if (idx === -1) return { criterion: part, weight: 0 };
        return { criterion: part.slice(0, idx).trim(), weight: Math.max(0, parseFloat(part.slice(idx + 1)) || 0) };
      }).filter(r => r.criterion);
    }
    function mainsRubricToString(rubric) {
      return (rubric || []).filter(r => r.criterion).map(r => `${r.criterion}:${r.weight}`).join('; ');
    }

    // Accepts the exam's own id ("kpsc_kas"), its live display name ("KPSC KAS (Gazetted)"), or loose
    // shorthand ("KAS", "UPSC", "CSE", "IAS") -- reuses studioNormalizeHeader (lowercase + strip to
    // [a-z0-9], defined in 06a_test_paper_studio.js, generic/standalone, loaded before this file) so a
    // renamed category in EXAM_CATEGORIES still matches here without a code change.
    function mainsResolveCategoryId(raw) {
      const norm = studioNormalizeHeader(raw);
      if (!norm) return '';
      if (/kas|kpscka/.test(norm)) return 'kpsc_kas';
      if (/upsc|cse|ias/.test(norm)) return 'upsc_cse';
      return '';
    }

    const MAINS_HEADER_ALIASES = {
      'category': 'categoryId', 'exam': 'categoryId', 'categoryid': 'categoryId', 'examcategory': 'categoryId', 'examname': 'categoryId',
      'subject': 'subject', 'topic': 'subject', 'tag': 'subject',
      'question': 'question', 'questiontext': 'question', 'q': 'question', 'descriptivequestion': 'question', 'qntext': 'question', 'qn': 'question',
      'modelanswer': 'modelAnswer', 'answer': 'modelAnswer', 'modelans': 'modelAnswer', 'sampleanswer': 'modelAnswer', 'idealanswer': 'modelAnswer',
      'marks': 'marks', 'mark': 'marks', 'totalmarks': 'marks',
      'wordlimit': 'wordLimit', 'limit': 'wordLimit', 'words': 'wordLimit',
      'previousyear': 'previousYear', 'pyq': 'previousYear', 'year': 'previousYear', 'askedinyear': 'previousYear',
      'sourcenote': 'sourceNote', 'source': 'sourceNote', 'note': 'sourceNote', 'notes': 'sourceNote',
      'rubric': 'rubric', 'rubriccriteria': 'rubric', 'criteria': 'rubric', 'gradingrubric': 'rubric',
      'active': 'active', 'status': 'active', 'isactive': 'active'
    };
    const MAINS_FIELD_LABELS = {
      categoryId: 'Exam (KPSC KAS / UPSC CSE)', subject: 'Subject', question: 'Question',
      modelAnswer: 'Model Answer', marks: 'Marks', wordLimit: 'Word Limit',
      previousYear: 'Previous Year (PYQ)', sourceNote: 'Source Note',
      rubric: 'Rubric ("Criterion:Weight; Criterion:Weight")', active: 'Active (Yes/No)',
      _ignore: '— Ignore this column —'
    };
    const MAINS_CSV_HEADERS = ['Category', 'Subject', 'Question', 'Model_Answer', 'Marks', 'Word_Limit', 'Previous_Year', 'Source_Note', 'Rubric', 'Active'];

    let mainsPendingMapping = null;

    function mainsIngestCsvFile(input) {
      if (!input.files || !input.files[0]) return;
      Papa.parse(input.files[0], {
        header: true, skipEmptyLines: true,
        complete: (res) => mainsIngestParsed(res.meta.fields || [], res.data),
        error: (err) => alert('CSV parse failed: ' + err.message)
      });
      input.value = ''; // allow re-selecting the same file
    }

    function mainsIngestPasted() {
      const txt = document.getElementById('mq-paste-box').value.trim();
      if (!txt) return alert('Paste some rows first.');
      const firstLine = txt.split(/\r?\n/, 1)[0];
      const delim = firstLine.includes('\t') ? '\t' : ','; // Excel/Sheets paste is tab-separated; comma otherwise
      const res = Papa.parse(txt, { header: true, skipEmptyLines: true, delimiter: delim });
      if (!res.data || !res.data.length) return alert("Couldn't find any rows to import.");
      mainsIngestParsed(res.meta.fields || [], res.data);
      document.getElementById('mq-paste-box').value = '';
    }

    function mainsIngestParsed(headers, rows) {
      const mapping = {}; // headerName -> canonicalField or '_unknown'
      const unknown = [];
      headers.forEach(h => {
        if (!h) return;
        const norm = studioNormalizeHeader(h);
        if (MAINS_HEADER_ALIASES[norm]) mapping[h] = MAINS_HEADER_ALIASES[norm];
        else { mapping[h] = '_unknown'; unknown.push(h); }
      });
      if (!unknown.length) return mainsApplyMappingAndAdd(mapping, rows);

      mainsPendingMapping = { headers, mapping, rows };
      const box = document.getElementById('mq-mapping-panel');
      const list = document.getElementById('mq-mapping-rows');
      list.innerHTML = unknown.map(h => `
        <div class="flex items-center gap-2">
          <span class="font-mono text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded">${escapeHtml(h)}</span>
          <span class="text-slate-500">→</span>
          <select data-map-header="${escapeHtml(h)}" class="px-2 py-1 border rounded bg-white outline-none flex-1">
            <option value="_ignore">— Ignore this column —</option>
            ${Object.entries(MAINS_FIELD_LABELS).filter(([k]) => k !== '_ignore').map(([k, lbl]) => `<option value="${k}">${escapeHtml(lbl)}</option>`).join('')}
          </select>
        </div>
      `).join('');
      box.classList.remove('hidden');
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function mainsApplyMapping() {
      if (!mainsPendingMapping) return;
      document.querySelectorAll('[data-map-header]').forEach(sel => {
        const h = sel.dataset.mapHeader;
        mainsPendingMapping.mapping[h] = sel.value;
      });
      // Awaited (not fire-and-forget) so a caller that awaits this -- e.g. a test, or any future
      // code that needs to know the upsert actually finished -- isn't told it's done before the
      // cloud write + local-array update have actually happened.
      await mainsApplyMappingAndAdd(mainsPendingMapping.mapping, mainsPendingMapping.rows);
      mainsPendingMapping = null;
      document.getElementById('mq-mapping-panel').classList.add('hidden');
    }

    async function mainsApplyMappingAndAdd(mapping, rows) {
      // Rows with no recognizable exam column fall back to whatever exam the admin has filtered to
      // (defaulting to KAS) rather than being rejected outright -- a sheet of KAS-only questions
      // reasonably has no "Category" column at all.
      const defaultCategory = MAINS_CATEGORY_IDS.includes(mainsAdminFilterCategory) ? mainsAdminFilterCategory : 'kpsc_kas';
      const toUpsert = [];
      const seenSubjectsByCategory = {};
      const weightWarnings = [];
      let skipped = 0;

      rows.forEach((row, i) => {
        const raw = { categoryId: '', subject: '', question: '', modelAnswer: '', marks: '', wordLimit: '', previousYear: '', sourceNote: '', rubric: '', active: '' };
        let sawActive = false;
        for (const [colName, field] of Object.entries(mapping)) {
          const val = row[colName];
          if (val == null || field === '_unknown' || field === '_ignore') continue;
          if (field === 'active') sawActive = true;
          if (field in raw) raw[field] = val;
        }

        const question = String(raw.question || '').trim();
        // Skip a row with nothing recognizable as a question -- but only count it as "skipped" (and
        // worth mentioning) if the row wasn't just entirely blank to begin with.
        if (!question) { if (Object.values(row).some(v => String(v || '').trim())) skipped++; return; }

        const categoryId = mainsResolveCategoryId(raw.categoryId) || defaultCategory;
        // Canonicalize against the same examSubjects[categoryId] registry the Test Paper Studio uses,
        // so "polity" and "Polity" from different uploads collapse onto one canonical spelling.
        const subjectRaw = String(raw.subject || '').trim();
        const subject = subjectRaw ? canonicalizeSubject(categoryId, subjectRaw) : '';
        if (subject) (seenSubjectsByCategory[categoryId] = seenSubjectsByCategory[categoryId] || new Set()).add(subject);

        const marksRaw = String(raw.marks || '').trim();
        const marks = marksRaw ? Math.max(0, parseFloat(marksRaw) || 0) : 10; // schema default when left blank
        const wlNum = parseInt(String(raw.wordLimit || '').trim(), 10);
        const wordLimit = Number.isInteger(wlNum) && wlNum > 0 ? wlNum : null;
        const pyNum = parseInt(String(raw.previousYear || '').trim(), 10);
        const previousYear = (Number.isInteger(pyNum) && pyNum > 1900) ? pyNum : null;
        const rubric = mainsParseRubricString(raw.rubric);
        const activeStr = String(raw.active || '').trim().toLowerCase();
        const active = sawActive ? !['no', 'false', '0', 'inactive', 'off'].includes(activeStr) : true;

        const weightTotal = rubric.reduce((sum, r) => sum + r.weight, 0);
        if (rubric.length && Math.abs(weightTotal - 100) > 0.5) weightWarnings.push({ question, weightTotal });

        toUpsert.push({
          id: 'mq_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
          category_id: categoryId, subject, question, model_answer: String(raw.modelAnswer || '').trim(),
          rubric, marks, word_limit: wordLimit, previous_year: previousYear,
          source_note: String(raw.sourceNote || '').trim(), active
        });
      });

      if (!toUpsert.length) {
        return alert(skipped ? `No valid rows found -- ${skipped} row(s) had no question text and were skipped.` : 'No rows to import.');
      }

      const { error } = await supabaseClient.from('mains_questions').upsert(toUpsert);
      if (error) return alert('Failed to upload questions to cloud: ' + error.message);

      Object.entries(seenSubjectsByCategory).forEach(([cat, set]) => registerSubjectsIfNew(cat, [...set]));

      const now = new Date().toISOString();
      toUpsert.forEach(data => {
        mainsQuestions.unshift({
          id: data.id, categoryId: data.category_id, subject: data.subject, question: data.question,
          modelAnswer: data.model_answer, rubric: data.rubric, marks: data.marks, wordLimit: data.word_limit,
          previousYear: data.previous_year, sourceNote: data.source_note, active: data.active, createdAt: now
        });
      });
      renderMainsQuestionsAdmin();

      let msg = `${toUpsert.length} question${toUpsert.length === 1 ? '' : 's'} added.` + (skipped ? ` ${skipped} blank row(s) skipped.` : '');
      if (weightWarnings.length) {
        msg += `\n\n⚠️ ${weightWarnings.length} question(s) have a rubric that doesn't add up to 100% -- review and fix in the editor:\n` +
          weightWarnings.slice(0, 8).map(w => `• "${w.question.slice(0, 70)}" -- totals ${w.weightTotal}%`).join('\n') +
          (weightWarnings.length > 8 ? `\n…and ${weightWarnings.length - 8} more.` : '');
      }
      alert(msg);
    }

    // ---- Template download / round-trip export (same CSV shape both directions) ----
    function mainsRowsToCsv(rows) {
      return rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    }
    function mainsTriggerCsvDownload(csvText, filename) {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
    function mainsDownloadTemplate() {
      const sample = [
        MAINS_CSV_HEADERS,
        ['KPSC KAS', 'Polity', 'Discuss the significance of the 73rd Constitutional Amendment in strengthening local self-government in India.', 'The 73rd Amendment (1992) institutionalized Panchayati Raj as a three-tier system...', '15', '250', '2023', 'KAS Mains 2023 GS2', 'Historical context:20; Constitutional provisions:30; Impact & critique:50', 'Yes'],
        ['UPSC CSE', 'International Relations', 'Examine the evolving dynamics of India-China relations in the context of regional security.', 'India-China relations are shaped by historical border disputes, economic interdependence...', '12', '200', '', '', 'Facts & background:40; Analysis:60', 'Yes']
      ];
      mainsTriggerCsvDownload(mainsRowsToCsv(sample), 'mains_question_template.csv');
    }
    // Exports whatever the current filter shows -- lets an admin grab a CSV of a subset (e.g. one
    // exam/subject), fix things in a spreadsheet, and re-upload the corrected file.
    function mainsDownloadCurrentCsv() {
      const rows = mainsFilteredQuestions();
      if (!rows.length) return alert('No questions to export with the current filter.');
      const catName = (id) => EXAM_CATEGORIES[id] ? EXAM_CATEGORIES[id].name : id;
      const data = rows.map(q => [
        catName(q.categoryId), q.subject || '', q.question, q.modelAnswer || '',
        q.marks, q.wordLimit != null ? q.wordLimit : '', q.previousYear != null ? q.previousYear : '', q.sourceNote || '',
        mainsRubricToString(q.rubric), q.active ? 'Yes' : 'No'
      ]);
      mainsTriggerCsvDownload(mainsRowsToCsv([MAINS_CSV_HEADERS, ...data]), 'mains_questions_export.csv');
    }

    /* ----------------------------------------------------
       AI evaluation settings (admin side) -- the 'mains-ai-evaluate' Edge Function (see
       sql/add_mains_ecosystem.sql for the credits tables it reads/writes) is provider-agnostic: a
       Claude adapter and an OpenAI adapter sit behind one interface, and either one works the moment
       its API key secret is set on the function, with no code change needed. This panel lets the
       admin (a) see which provider(s) currently have a key configured -- without ever exposing the
       key itself to the browser, the Edge Function only reports true/false -- (b) pick which one is
       tried first when both are configured, and (c) grant ad-hoc eval credits to a student's own
       email for testing, since the real credits economy (purchases + bundle monthly allowance) is a
       later, separate piece of work.
    ----------------------------------------------------- */
    async function mainsAiSettingsInit() {
      await Promise.all([mainsAiLoadProviderPref(), mainsAiCheckConfig()]);
    }

    async function mainsAiLoadProviderPref() {
      const sel = document.getElementById('mq-ai-provider-pref');
      if (!sel) return;
      const { data, error } = await supabaseClient.from('app_settings').select('value').eq('key', 'mains_ai_provider').maybeSingle();
      if (error) { console.error('mainsAiLoadProviderPref:', fmtErr(error)); return; }
      sel.value = (data && data.value && data.value.preferred === 'openai') ? 'openai' : 'claude';
    }

    async function mainsAiSaveProviderPref() {
      const sel = document.getElementById('mq-ai-provider-pref');
      const status = document.getElementById('mq-ai-provider-status');
      const { error } = await supabaseClient.from('app_settings').upsert({ key: 'mains_ai_provider', value: { preferred: sel.value } });
      if (error) { status.innerText = 'Failed to save: ' + error.message; return; }
      status.innerText = `✓ Saved -- ${sel.value === 'openai' ? 'OpenAI' : 'Claude'} tried first (falls back to whichever key is actually configured).`;
      setTimeout(() => { if (status.innerText.startsWith('✓')) status.innerText = ''; }, 5000);
    }

    // Asks the Edge Function which provider(s) have a key set -- it only ever answers true/false,
    // never the key itself, so this is safe to call straight from the admin browser.
    async function mainsAiCheckConfig() {
      const box = document.getElementById('mq-ai-config-status');
      if (!box) return;
      box.innerText = 'Checking…';
      try {
        const { data, error } = await supabaseClient.functions.invoke('mains-ai-evaluate', { body: { action: 'status' } });
        if (error) throw error;
        const claudeOn = !!data?.claude_configured;
        const openaiOn = !!data?.openai_configured;
        box.innerHTML = `Claude: <b class="${claudeOn ? 'text-emerald-700' : 'text-slate-400'}">${claudeOn ? 'configured' : 'not configured'}</b> &nbsp;·&nbsp; OpenAI: <b class="${openaiOn ? 'text-emerald-700' : 'text-slate-400'}">${openaiOn ? 'configured' : 'not configured'}</b>`;
      } catch (err) {
        box.innerText = 'Could not reach the evaluation function: ' + (err.message || err);
      }
    }

    // Ad-hoc credit grant for testing the AI-eval flow end-to-end before the real purchase/bundle-
    // allowance economy exists. Writes straight to the same tables that economy will later write to
    // (mains_eval_credits + mains_eval_credit_transactions with reason 'admin_adjustment'), so nothing
    // here needs to change when that later piece ships.
    async function mainsAiGrantCredits() {
      const emailInput = document.getElementById('mq-ai-grant-email');
      const amountInput = document.getElementById('mq-ai-grant-amount');
      const status = document.getElementById('mq-ai-grant-status');
      const email = normalizeEmail(emailInput.value);
      const amount = parseInt(amountInput.value, 10);
      if (!email) return alert('Enter the student\'s email first.');
      if (!Number.isInteger(amount) || amount === 0) return alert('Enter a non-zero whole number of credits.');

      const { data: existing, error: fetchErr } = await supabaseClient.from('mains_eval_credits').select('balance').eq('student_email', email).maybeSingle();
      if (fetchErr) return alert('Failed to look up current balance: ' + fetchErr.message);
      const newBalance = Math.max(0, (existing ? existing.balance : 0) + amount);
      const { error: upsertErr } = await supabaseClient.from('mains_eval_credits').upsert({ student_email: email, balance: newBalance, updated_at: new Date().toISOString() });
      if (upsertErr) return alert('Failed to update balance: ' + upsertErr.message);
      const { error: txnErr } = await supabaseClient.from('mains_eval_credit_transactions').insert({ student_email: email, delta: amount, reason: 'admin_adjustment' });
      if (txnErr) console.error('mainsAiGrantCredits transaction log:', fmtErr(txnErr));

      status.innerText = `✓ ${email} now has ${newBalance} credit${newBalance === 1 ? '' : 's'}.`;
      amountInput.value = '';
      setTimeout(() => { if (status.innerText.startsWith('✓')) status.innerText = ''; }, 6000);
    }
