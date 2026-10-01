// Regression suite for index.html, run against the local test harness (see tests/harness/).
// Unlike the ad hoc scripts this was consolidated from, every check here produces an explicit
// pass/fail (deep-equal where needed) and the process exits non-zero if anything fails, so this
// can gate a CI run instead of needing a human to eyeball JSON output.
//
// Usage: node tests/run.js   (expects the harness server already running on :8899 — see
// .github/workflows/test.yml or README.md for the full sequence)

const { chromium } = require('playwright');

(async () => {
  const launchOpts = process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') pageErrors.push('console.error: ' + msg.text()); });
  await page.goto('http://localhost:8899/test-visual.html', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const checks = await page.evaluate(async () => {
    const results = [];
    const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const ok = (name, pass, detail) => results.push({ name, pass: !!pass, detail });
    const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected),
      { actual, expected });

    // ============================================================
    // Group 1: sub-categories, entitlement split, subject registry, bank generation (Wave 2)
    // ============================================================
    EXAM_CATEGORIES.kas_current_affairs = {
      id: 'kas_current_affairs', name: 'KAS Current Affairs', desc: 'Sub-category test',
      defaultScheme: { examBadge: 'KAS CA', marksCorrect: 1, marksWrong: 0.25, duration: 30, cutoff: 20 },
      parentId: 'kpsc_kas', order: 1, active: true, showScoringPattern: true
    };
    testsCatalog = [
      { id: 'paper_kas_main', category: 'kpsc_kas', extraCategories: ['karnataka_psi'], alsoListCategories: [],
        active: true, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 2, title: 'KAS Main Paper',
        questions: [
          { id: 1, q_en: 'Q1', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 2 },
          { id: 2, q_en: 'Q2', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'B', subject: 'polity', difficulty: 3 }
        ] },
      { id: 'paper_kas_ca', category: 'kas_current_affairs', extraCategories: [], alsoListCategories: [],
        active: true, price: 0, scheme: EXAM_CATEGORIES.kas_current_affairs.defaultScheme, questionCount: 1, title: 'KAS CA Paper',
        questions: [{ id: 1, q_en: 'Q3', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'C', subject: 'Economy', difficulty: 1 }] },
      { id: 'paper_crosslisted', category: 'karnataka_psi', extraCategories: [], alsoListCategories: ['kpsc_kas'],
        active: true, price: 0, scheme: EXAM_CATEGORIES.karnataka_psi.defaultScheme, questionCount: 1, title: 'Cross-listed PSI Paper',
        questions: [{ id: 1, q_en: 'Q4', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'D', subject: 'Geography', difficulty: 1 }] }
    ];

    const bundlePsiOnly = { id: 'b1', allAccess: false, categories: ['karnataka_psi'], papers: [] };
    eq('entitlement_no_longer_follows_extraCategories', bundleCoversPaper(bundlePsiOnly, testsCatalog[0]), false);

    const bundleKasOnly = { id: 'b2', allAccess: false, categories: ['kpsc_kas'], papers: [] };
    eq('entitlement_follows_alsoListCategories', bundleCoversPaper(bundleKasOnly, testsCatalog[2]), true);
    eq('entitlement_rolls_up_to_children', bundleCoversPaper(bundleKasOnly, testsCatalog[1]), true);

    document.body.insertAdjacentHTML('beforeend', `
      <div id="exam-category-tabs"></div>
      <div class="hidden" id="exam-subcategory-chips"></div>
      <h4 id="cat-banner-title"></h4><p id="cat-banner-desc"></p><span id="cat-banner-count"></span>
      <div id="tests-catalog-grid"></div>
    `);
    // Stubbed for the catalog-visibility checks below only (they need every paper to render
    // regardless of entitlement) — restored before Group 2, which needs the REAL entitlement
    // check (its "inactive paper excluded from the live bank" control depends on it).
    const origIsTestUnlockedForUser = window.isTestUnlockedForUser;
    window.isTestUnlockedForUser = () => true;

    renderCategoryTabs();
    const tabsHtml = document.getElementById('exam-category-tabs').innerHTML;
    ok('toplevel_tabs_exclude_subcategory',
      tabsHtml.includes(`data-category="kpsc_kas"`) && !tabsHtml.includes(`data-category="kas_current_affairs"`));

    filterExamCategoryBase('kpsc_kas');
    const gridHtmlAll = document.getElementById('tests-catalog-grid').innerHTML;
    ok('parent_all_view_rolls_up_children_and_crosslisted',
      gridHtmlAll.includes('KAS Main Paper') && gridHtmlAll.includes('KAS CA Paper') && gridHtmlAll.includes('Cross-listed PSI Paper'));

    const chipHtml = document.getElementById('exam-subcategory-chips').innerHTML;
    ok('subcategory_chips_render_for_parent',
      !document.getElementById('exam-subcategory-chips').classList.contains('hidden')
      && chipHtml.includes('All KPSC KAS') && chipHtml.includes('KAS Current Affairs'));

    filterExamCategoryBase('kpsc_kas', 'kas_current_affairs');
    const gridHtmlChild = document.getElementById('tests-catalog-grid').innerHTML;
    ok('narrowing_to_child_excludes_parent_papers',
      gridHtmlChild.includes('KAS CA Paper') && !gridHtmlChild.includes('KAS Main Paper'));

    filterExamCategoryBase('karnataka_psi');
    const gridHtmlPsi = document.getElementById('tests-catalog-grid').innerHTML;
    ok('question_bank_tagging_does_not_leak_into_catalog',
      !gridHtmlPsi.includes('KAS Main Paper') && gridHtmlPsi.includes('Cross-listed PSI Paper'));

    const bankWave2 = getQuestionBank();
    eq('question_bank_applicability_unaffected_by_split',
      bankWave2.filter(b => b.category === 'karnataka_psi').some(b => b.key.startsWith('paper_kas_main::')), true);

    examSubjects = {};
    registerSubjectIfNew('kpsc_kas', 'Polity');
    eq('subject_registered', examSubjects.kpsc_kas, ['Polity']);
    eq('canonicalize_case_insensitive', canonicalizeSubject('kpsc_kas', 'polity'), 'Polity');
    eq('canonicalize_new_subject_passthrough', canonicalizeSubject('kpsc_kas', '  Economy  '), 'Economy');

    document.body.insertAdjacentHTML('beforeend', `
      <select id="studio-category"><option value="kpsc_kas" selected>KAS</option></select>
      <select id="edit-subject"></select>
    `);
    populateEditSubjectSelect('Polity');
    const subjSelectHtml = document.getElementById('edit-subject').innerHTML;
    ok('subject_select_populated',
      subjSelectHtml.includes('>Polity<') && subjSelectHtml.includes('__add_new__') && document.getElementById('edit-subject').value === 'Polity');

    studioState = { mode: 'new', questions: [] };
    studioApplyMappingAndAdd(
      { 'Question_EN': 'q_en', 'Correct': 'correct', 'Subject': 'subject' },
      [{ 'Question_EN': 'CSV Q1', 'Correct': 'A', 'Subject': 'polity' }, { 'Question_EN': 'CSV Q2', 'Correct': 'B', 'Subject': 'Brand New Topic' }]
    );
    ok('csv_subject_canonicalized_and_registered',
      studioState.questions[0].subject === 'Polity'
      && studioState.questions[1].subject === 'Brand New Topic'
      && (examSubjects.kpsc_kas || []).includes('Brand New Topic'));

    testsCatalog[0].questions[0].subject = 'Polity';
    testsCatalog[0].questions[1].subject = 'polity';
    const groups = subjectCleanupScan('kpsc_kas');
    ok('cleanup_scan_groups_case_insensitively', groups.length === 1 && groups[0].total === 2);

    document.getElementById('studio-category').value = 'kpsc_kas';
    studioState = { mode: 'new', questions: [] };
    await studioScanQuestionBank();
    eq('bank_scan_finds_pool', studioBankPool.length, 2);

    document.getElementById('studio-bank-subject-rows') || document.body.insertAdjacentHTML('beforeend', '<div id="studio-bank-subject-rows"></div>');
    renderStudioBankSubjectRows();
    ok('bank_subject_rows_rendered', document.querySelectorAll('[data-bank-subject]').length > 0);
    const bankInputs = [...document.querySelectorAll('[data-bank-subject]')];
    if (bankInputs[0]) bankInputs[0].value = String(bankInputs[0].max || 1);
    studioGenerateFromBank();
    ok('bank_generate_populates_studio_questions', studioState.questions.length > 0);

    // ============================================================
    // Group 2: the three Studio authoring bugfixes (inactive-paper scan, stale draft, dedup lineage)
    // ============================================================
    window.isTestUnlockedForUser = origIsTestUnlockedForUser;
    testsCatalog.push({
      id: 'paper_inactive_draft', category: 'kpsc_kas', extraCategories: [], alsoListCategories: [],
      active: false, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 1, title: 'Inactive Draft Paper',
      questions: [{ id: 1, q_en: 'Draft Q1', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 1 }]
    });
    studioBankPool = [];
    await studioScanQuestionBank();
    ok('bug1_inactive_paper_feeds_studio_bank_scan', studioBankPool.some(b => b.paperId === 'paper_inactive_draft'));

    const liveBank = getQuestionBank();
    ok('bug1_control_inactive_paper_still_excluded_from_live_student_bank',
      !liveBank.some(b => b.q && b.q.q_en === 'Draft Q1'));

    document.body.insertAdjacentHTML('beforeend', `
      <input id="studio-paper-title" value="Edited Paper" />
      <input id="studio-price" value="99" />
      <input type="checkbox" id="studio-active" checked />
      <input id="studio-scheduled-for" value="" />
      <input id="studio-mark-correct" value="2" /><input id="studio-mark-wrong" value="0.5" />
      <input id="studio-duration" value="120" /><input id="studio-cutoff" value="120" />
      <span id="studio-draft-status"></span>
    `);
    localStorage.removeItem('kas_paper_draft');
    studioState = { mode: 'edit', originalId: 'paper_kas_main', questions: [{ id: 1, q_en: 'x', q_kn:'', options_en:['a','b','c','d'], options_kn:[], correct:'A' }] };
    const origAlert1 = window.alert; window.alert = () => {};
    studioSaveDraft();
    ok('bug2_save_draft_noop_outside_new_mode', localStorage.getItem('kas_paper_draft') === null);
    window.alert = origAlert1;

    studioState = { mode: 'new', originalId: null, questions: [{ id: 1, q_en: 'x', q_kn:'', options_en:['a','b','c','d'], options_kn:[], correct:'A' }] };
    document.getElementById('studio-paper-title').value = 'Brand New Paper';
    localStorage.removeItem('kas_paper_draft');
    studioSaveDraft();
    ok('bug2_save_draft_still_works_for_new_mode', localStorage.getItem('kas_paper_draft') !== null);
    localStorage.removeItem('kas_paper_draft');

    testsCatalog.length = 0;
    testsCatalog.push({
      id: 'paper_source', category: 'kpsc_kas', extraCategories: [], alsoListCategories: [],
      active: true, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 1, title: 'Source Paper',
      questions: [{ id: 1, q_en: 'Shared Q', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 1 }]
    });
    testsCatalog.push({
      id: 'paper_generated', category: 'kpsc_kas', extraCategories: [], alsoListCategories: [],
      active: true, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 1, title: 'Generated Paper',
      questions: [{ id: 1, q_en: 'Shared Q', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 1, sourceQuestionId: 'paper_source::1' }]
    });
    let bank2 = getQuestionBank().filter(b => b.category === 'kpsc_kas' && b.q.q_en === 'Shared Q');
    eq('bug3_generated_duplicate_deduped_in_bank', bank2.length, 1);

    testsCatalog.push({
      id: 'paper_coincidence', category: 'kpsc_kas', extraCategories: [], alsoListCategories: [],
      active: true, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 1, title: 'Coincidence Paper',
      questions: [{ id: 1, q_en: 'Shared Q', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 1 }]
    });
    let bank3 = getQuestionBank().filter(b => b.category === 'kpsc_kas' && b.q.q_en === 'Shared Q');
    eq('bug3_control_no_fuzzy_text_dedupe', bank3.length, 2);

    await ensurePaperQuestionsLoaded(testsCatalog.find(p => p.id === 'paper_generated'));
    const pGen = testsCatalog.find(x => x.id === 'paper_generated');
    const preloaded = (pGen.questions || []).map((q, i) => ({
      id: i + 1, q_en: q.q_en || '', ...(q.sourceQuestionId ? { sourceQuestionId: q.sourceQuestionId } : {})
    }));
    eq('bug3_lineage_survives_edit_preload_mapping', preloaded[0].sourceQuestionId, 'paper_source::1');

    // ============================================================
    // Group 3: bilingual (EN/KN) explanations + language-toggle color fix
    // ============================================================
    activeTest = {
      id: 'paper_x', title: 'Test', scheme: { duration: 60 },
      questions: [{ id: 1, q_en: 'Q1 EN', q_kn: 'Q1 KN', options_en: ['a','b','c','d'], options_kn: ['ಎ','ಬಿ','ಸಿ','ಡಿ'], correct: 'A', exp: 'Exp EN', exp_kn: 'Exp KN' }]
    };
    userSelections = {};
    document.body.insertAdjacentHTML('beforeend', `
      <button id="lang-en" class="px-2.5 py-0.5 rounded font-bold bg-amber-500 text-slate-950 transition">ENG</button>
      <button id="lang-kn" class="px-2.5 py-0.5 rounded text-slate-300 hover:text-white font-medium transition">ಕನ್ನಡ</button>
      <div id="questions-stream"></div>
    `);
    currentLang = 'en';
    renderPaper();
    ok('toggle_starts_with_en_highlighted',
      document.getElementById('lang-en').className.includes('bg-amber-500') && !document.getElementById('lang-kn').className.includes('bg-amber-500'));
    setLanguage('kn');
    ok('toggle_color_shifts_to_kannada_on_click',
      !document.getElementById('lang-en').className.includes('bg-amber-500') && document.getElementById('lang-kn').className.includes('bg-amber-500'));

    document.body.insertAdjacentHTML('beforeend', `<select id="studio-category-2"><option value="kpsc_kas" selected>KAS</option></select>`);
    document.getElementById('studio-category').value = 'kpsc_kas';
    studioState = { mode: 'new', questions: [] };
    studioApplyMappingAndAdd(
      { 'Question_EN': 'q_en', 'Correct': 'correct', 'Explanation': 'exp', 'Explanation_KN': 'exp_kn' },
      [{ 'Question_EN': 'CSV Q1', 'Correct': 'A', 'Explanation': 'Because A', 'Explanation_KN': 'ಎ ಏಕೆಂದರೆ' }]
    );
    ok('csv_ingests_bilingual_explanation',
      studioState.questions[0].exp === 'Because A' && studioState.questions[0].exp_kn === 'ಎ ಏಕೆಂದರೆ');

    document.body.insertAdjacentHTML('beforeend', `
      <span id="edit-q-num"></span>
      <input id="edit-q-en" /><input id="edit-q-kn" />
      <input id="edit-a-en" /><input id="edit-a-kn" /><input id="edit-b-en" /><input id="edit-b-kn" />
      <input id="edit-c-en" /><input id="edit-c-kn" /><input id="edit-d-en" /><input id="edit-d-kn" />
      <select id="edit-correct"><option value="A">A</option></select>
      <select id="edit-difficulty"><option value=""></option></select>
      <textarea id="edit-exp"></textarea>
      <textarea id="edit-exp-kn"></textarea>
      <input id="edit-image-url" /><input id="edit-image-file" />
      <img id="edit-image-preview" class="hidden" />
      <div class="col-span-2" id="edit-relevant-period-wrap"><input id="edit-relevant-period" /></div>
      <button id="edit-type-static"></button><button id="edit-type-ca"></button>
      <input id="edit-asked-years" /><input type="checkbox" id="edit-retired" />
      <div id="studio-edit-modal" class="hidden"></div>
    `);
    studioState.questions = [{ id: 1, q_en: 'Q', q_kn: '', options_en: ['a','b','c','d'], options_kn: ['','','',''], correct: 'A', exp: 'Old EN', exp_kn: 'Old KN', subject: '' }];
    studioEditingIndex = -1;
    studioEditQuestion(0);
    const populatedExp = document.getElementById('edit-exp').value, populatedExpKn = document.getElementById('edit-exp-kn').value;
    document.getElementById('edit-exp').value = 'New EN';
    document.getElementById('edit-exp-kn').value = 'New KN';
    editSaveQuestion();
    ok('edit_modal_populates_and_saves_bilingual_explanation',
      populatedExp === 'Old EN' && populatedExpKn === 'Old KN'
      && studioState.questions[0].exp === 'New EN' && studioState.questions[0].exp_kn === 'New KN');

    document.getElementById('edit-exp').value = 'English text';
    document.getElementById('edit-exp-kn').value = 'Already written Kannada';
    document.getElementById('edit-q-en').value = 'Qe'; document.getElementById('edit-q-kn').value = '';
    editCopyEnToKn();
    ok('copy_en_to_kn_does_not_overwrite_existing_kannada_explanation', document.getElementById('edit-exp-kn').value === 'Already written Kannada');
    document.getElementById('edit-exp-kn').value = '';
    editCopyEnToKn();
    ok('copy_en_to_kn_fills_blank_kannada_explanation', document.getElementById('edit-exp-kn').value === 'English text');

    practice = { title: 't', items: [{ key: 'k1', q: activeTest.questions[0] }], idx: 0, answers: [{ choice: 'A', correct: true }], lang: 'en', source: 'builder' };
    document.body.insertAdjacentHTML('beforeend', `
      <span id="practice-title"></span><div id="practice-bar"></div>
      <button id="practice-lang-en"></button><button id="practice-lang-kn"></button>
      <span id="practice-progress"></span><div id="practice-body"></div><div id="practice-footer"></div>
    `);
    renderPracticeQuestion();
    const bodyEn = document.getElementById('practice-body').innerHTML;
    practice.lang = 'kn';
    renderPracticeQuestion();
    const bodyKn = document.getElementById('practice-body').innerHTML;
    ok('practice_mode_explanation_switches_with_language', bodyEn.includes('Exp EN') && bodyKn.includes('Exp KN'));

    // ============================================================
    // Group 4: Studio intelligence build (Static/CA, PYQ, weights, coverage, bank rework, near-dup, Topic Builder filter)
    // ============================================================
    examSubjects.kpsc_kas = ['Polity', 'Economy', 'History'];
    examSubjectWeights.kpsc_kas = {};
    testsCatalog.length = 0;
    testsCatalog.push({
      id: 'paper_active', category: 'kpsc_kas', extraCategories: [], alsoListCategories: [],
      active: true, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 5, title: 'Active Paper',
      questions: [
        { id: 1, q_en: 'Polity static Q1 about fundamental rights and the constitution of India in great detail', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 2, contentType: 'static', askedInYears: ['2018', '2021'] },
        { id: 2, q_en: 'Economy CA Q about the latest budget allocation for a certain welfare scheme', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'B', subject: 'Economy', difficulty: 3, contentType: 'ca', relevantPeriod: 'Sep 2026' },
        { id: 3, q_en: 'Economy CA Q about an old scheme that is now stale and should be retired from the bank', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'C', subject: 'Economy', difficulty: 1, contentType: 'ca', relevantPeriod: 'Jan 2024', retired: true },
        { id: 4, q_en: 'History static Q about the Indian independence movement and key leaders of that era', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'D', subject: 'History', difficulty: 4, contentType: 'static' },
        { id: 5, q_en: 'Polity static Q about the fundamental rights and the constitution of India explained', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', subject: 'Polity', difficulty: 2, contentType: 'static' }
      ]
    });
    testsCatalog.push({
      id: 'paper_inactive', category: 'kpsc_kas', extraCategories: [], alsoListCategories: [],
      active: false, price: 0, scheme: EXAM_CATEGORIES.kpsc_kas.defaultScheme, questionCount: 1, title: 'Inactive Draft Paper',
      questions: [{ id: 1, q_en: 'History static Q about ancient Indian dynasties and their major administrative reforms', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'B', subject: 'History', difficulty: 2, contentType: 'static' }]
    });
    currentUser = { email: '7shashank1992@gmail.com', role: 'admin', name: 'Admin' };

    document.body.insertAdjacentHTML('beforeend', `
      <select id="studio-category-3"><option value="kpsc_kas" selected>KAS</option></select>
      <span id="studio-bank-scan-status"></span>
      <span id="studio-bank-category-name"></span>
      <div id="studio-bank-generate-row" class="hidden"></div>
      <div id="studio-bank-suggest-row" class="hidden"></div>
      <span id="studio-bank-total"></span>
      <input type="number" id="studio-bank-target-total" />
      <input type="number" id="studio-bank-ca-mix" value="0" />
      <input type="checkbox" id="studio-bank-prioritize-pyq" checked />
    `);
    document.getElementById('studio-category').value = 'kpsc_kas';
    document.getElementById('studio-bank-subject-rows').innerHTML = '';

    studioState = { mode: 'new', questions: [] };
    studioApplyMappingAndAdd(
      { 'Question_EN': 'q_en', 'Correct': 'correct', 'Type': 'contentType', 'Relevant_Period': 'relevantPeriod', 'Asked_In_Years': 'askedInYears' },
      [{ 'Question_EN': 'CSV ingested current affairs question about a recent state government policy announcement', 'Correct': 'A', 'Type': 'Current Affairs', 'Relevant_Period': 'Oct 2026', 'Asked_In_Years': '2019, 2022' }]
    );
    const csvQ = studioState.questions[studioState.questions.length - 1];
    ok('task50_csv_ingests_contentType_period_askedInYears',
      csvQ.contentType === 'ca' && csvQ.relevantPeriod === 'Oct 2026' && deepEqual(csvQ.askedInYears, ['2019', '2022']));

    studioState.questions = [{ id: 1, q_en: 'Q', q_kn: '', options_en: ['a','b','c','d'], options_kn: ['','','',''], correct: 'A', exp: '', exp_kn: '', subject: '', contentType: 'static', relevantPeriod: '', askedInYears: [], retired: false }];
    studioEditingIndex = -1;
    studioEditQuestion(0);
    const periodHiddenForStatic = document.getElementById('edit-relevant-period-wrap').classList.contains('hidden');
    editSetContentType('ca');
    const periodShownForCa = !document.getElementById('edit-relevant-period-wrap').classList.contains('hidden');
    document.getElementById('edit-relevant-period').value = 'Nov 2026';
    document.getElementById('edit-asked-years').value = '2020, 2023';
    document.getElementById('edit-retired').checked = true;
    editSaveQuestion();
    ok('task50_edit_modal_type_toggle_and_retired',
      periodHiddenForStatic && periodShownForCa
      && studioState.questions[0].contentType === 'ca' && studioState.questions[0].relevantPeriod === 'Nov 2026'
      && deepEqual(studioState.questions[0].askedInYears, ['2020', '2023']) && studioState.questions[0].retired === true);

    ok('task51_askedBadgeHtml',
      askedBadgeHtml({ askedInYears: ['2018', '2021'] }).includes('2018') && askedBadgeHtml({ askedInYears: [] }) === '');

    setSubjectWeight('kpsc_kas', 'Polity', 5);
    setSubjectWeight('kpsc_kas', 'Economy', 1);
    ok('task52_subjectWeight_set_and_default',
      subjectWeight('kpsc_kas', 'Polity') === 5 && subjectWeight('kpsc_kas', 'Economy') === 1 && subjectWeight('kpsc_kas', 'History') === 3);

    document.body.insertAdjacentHTML('beforeend', `<div id="ec-coverage-kpsc_kas"></div>`);
    await renderCoverageAndCaReview('kpsc_kas');
    const coverageHtml = document.getElementById('ec-coverage-kpsc_kas').innerHTML;
    ok('task53_coverage_dashboard_renders',
      coverageHtml.includes('Polity') && coverageHtml.includes('Economy') && coverageHtml.includes('History')
      && coverageHtml.includes('retireQuestion') && !coverageHtml.includes('now stale and should be retired'));

    const bank4 = getQuestionBank().filter(b => b.category === 'kpsc_kas');
    ok('task56_backend_retired_excluded_and_contentType_tagged',
      !bank4.some(b => b.q.q_en && b.q.q_en.includes('now stale and should be retired')));

    builderState.category = 'kpsc_kas';
    builderState.subjects = new Set();
    builderState.difficulties = new Set();
    builderState.types = new Set();
    builderState.freshOnly = false;
    document.body.insertAdjacentHTML('beforeend', `<div id="topic-builder"></div>`);
    const origGetCurrentStudent = getCurrentStudent;
    getCurrentStudent = () => ({ email: 'student@test.com', name: 'Test Student' });
    window.canUseFeature = () => true;
    renderTopicBuilder();
    const builderHtml = document.getElementById('topic-builder').innerHTML;
    const showsTypeFilter = builderHtml.includes('Current Affairs') && builderHtml.includes('data-type');
    toggleBuilderType('ca');
    const poolAfterCaFilter = getBuilderPool(getCurrentStudent());
    ok('task56_topic_builder_static_ca_filter',
      showsTypeFilter && poolAfterCaFilter.length > 0 && poolAfterCaFilter.every(b => b.contentType === 'ca'));
    getCurrentStudent = origGetCurrentStudent;

    document.getElementById('studio-bank-subject-rows').innerHTML = '';
    await studioScanQuestionBank();
    const poolHasBothPapers = studioBankPool.some(b => b.paperId === 'paper_active') && studioBankPool.some(b => b.paperId === 'paper_inactive');
    const poolExcludesRetired = !studioBankPool.some(b => b.q.q_en && b.q.q_en.includes('now stale and should be retired'));
    renderStudioBankSubjectRows();
    document.getElementById('studio-bank-target-total').value = '10';
    document.getElementById('studio-bank-ca-mix').value = '20';
    studioSuggestBankCounts(); // the function whose cssEscape() reference was fixed before shipping
    const polityStaticInput = [...document.querySelectorAll('[data-bank-subject][data-bank-type="static"]')].find(el => el.dataset.bankSubject === 'Polity');
    const economyInputs = [...document.querySelectorAll('[data-bank-subject]')].filter(el => el.dataset.bankSubject === 'Economy');
    ok('task54_scan_and_suggest_counts_no_cssEscape_crash',
      poolHasBothPapers && poolExcludesRetired
      && !!polityStaticInput && parseInt(polityStaticInput.value, 10) > 0
      && economyInputs.some(el => parseInt(el.value, 10) > 0));

    studioState = { mode: 'new', questions: [] };
    studioGenerateFromBank();
    ok('task54_generate_from_bank_produces_tagged_copies',
      studioState.questions.length > 0 && studioState.questions.every(q => !!q.sourceQuestionId));

    studioState = { mode: 'new', questions: [
      { id: 1, q_en: 'Polity static Q1 about fundamental rights and the constitution of India in great detail', q_kn: '', options_en: ['a','b','c','d'], options_kn: [], correct: 'A', exp: '', exp_kn: '', subject: 'Polity' }
    ] };
    let lastAlert = '';
    const origAlert2 = window.alert; window.alert = (m) => { lastAlert = m; };
    studioApplyMappingAndAdd(
      { 'Question_EN': 'q_en', 'Correct': 'correct' },
      [
        { 'Question_EN': 'Polity static Q1 about fundamental rights and the constitution of India explained in detail', 'Correct': 'A' },
        { 'Question_EN': 'A totally unrelated question about rainfall patterns in the Western Ghats region', 'Correct': 'B' }
      ]
    );
    ok('task55_near_duplicate_warns_but_does_not_block',
      lastAlert.includes('near-duplicate') && studioState.questions.length === 3);

    studioState = { mode: 'new', questions: [] };
    lastAlert = '';
    studioApplyMappingAndAdd(
      { 'Question_EN': 'q_en', 'Correct': 'correct' },
      [
        { 'Question_EN': 'What is the capital city of the state of Karnataka in southern India', 'Correct': 'A' },
        { 'Question_EN': 'Which mountain range runs along the western coast of the Indian peninsula', 'Correct': 'B' }
      ]
    );
    ok('task55_control_unrelated_questions_not_flagged', !lastAlert.includes('near-duplicate'));
    window.alert = origAlert2;

    return results;
  });

  await browser.close();

  const failed = checks.filter(c => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);
  if (pageErrors.length) {
    const unexpected = pageErrors.filter(e => !e.includes('ERR_TUNNEL_CONNECTION_FAILED') && !e.includes('404'));
    if (unexpected.length) {
      console.log('Unexpected page errors:');
      unexpected.forEach(e => console.log('  ' + e));
    }
  }
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach(c => console.log(`  ✗ ${c.name}\n    ${JSON.stringify(c.detail)}`));
    process.exit(1);
  } else {
    console.log('All checks passed.');
    process.exit(0);
  }
})().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
