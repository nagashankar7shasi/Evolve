    /* ----------------------------------------------------
       6c. MAINS PRACTICE (student-facing: browse, write, self-assess)
    ----------------------------------------------------- */
    // Full-screen overlay (#view-mains-practice), same pattern as the exam engine / Studio -- a
    // focused, single-task view rather than another dashboard widget. Three screens inside it:
    // browse -> write -> self-assess. AI-assisted evaluation calls the provider-agnostic
    // 'mains-ai-evaluate' Edge Function (Claude + OpenAI adapters, see that function's own comments);
    // it reports a clean "not configured yet" error until an admin adds a real API key, rather than
    // failing. Human-reviewed evaluation (the third tier) is a paid request into the admin's review
    // queue (see 06b_mains_studio.js). Access to the Mains question bank itself (this whole view, for
    // a given category) is gated like test papers -- see isMainsUnlockedForUser() in
    // 04_access_permission_checkers.js -- and is linked from the student dashboard
    // (renderMainsDashboardCard, #dash-mains-section) now that access-control is wired in.
    // Max size for an attached answer photo/PDF -- enforced here (fast feedback before upload even
    // starts) AND server-side on the 'mains_answer_photos' storage bucket itself (file_size_limit +
    // allowed_mime_types, set directly on the bucket -- see sql/limit_mains_answer_photos_bucket.sql)
    // so a student can't bypass this by skipping the UI. Kept well under the admin PDF Vault's 25MB
    // (full study documents) since this is one scanned answer, not a document.
    const MAX_MAINS_ANSWER_FILE_BYTES = 10 * 1024 * 1024;
    let mainsSubmissions = [];        // this student's own submissions only (server-side .eq filter, even though RLS itself is public-read)
    let mainsPracticeFilterCategory = 'kpsc_kas';
    let mainsPracticeFilterSubject = '';
    let mainsPracticeCurrentQuestion = null; // question object currently being answered (write screen)
    let mainsPracticeAnswerPhotoFile = null; // staged File (image or PDF), not yet uploaded
    let mainsPracticeCurrentSubmissionId = null; // submission currently shown on the self-assess screen (AI-feedback button target)
    let mainsAccessPriceCache = null; // lazy-loaded app_settings('mains_access_price'), {kpsc_kas, upsc_cse}
    // 'tests' (default): browse priced/bundle-coverable Mains test papers (mains_test_papers), each a
    // fixed set of N bank questions attempted as one unit -- see js/06d_mains_test_studio.js for the
    // admin side. 'bank': the original free-form "any active question in this category" browse,
    // unchanged and still available as a second tab -- nothing about it was removed.
    let mainsPracticeViewMode = 'tests';
    // Set while attempting one specific test paper (its id); null means "at the grid/bank, not
    // inside a paper". Snapshotted into mainsPracticeAnswerTestPaperId the moment "Write answer" is
    // clicked, so submitMainsAnswer() tags the submission correctly even if this changes later.
    let mainsPracticeActiveTestPaperId = null;
    let mainsPracticeAnswerTestPaperId = null;

    async function fetchCloudMainsSubmissions() {
      if (!currentUser) { mainsSubmissions = []; return; }
      const { data, error } = await supabaseClient.from('mains_submissions').select('*')
        .eq('student_email', normalizeEmail(currentUser.email)).order('submitted_at', { ascending: false });
      if (error) { console.error('fetchCloudMainsSubmissions:', fmtErr(error)); return; }
      if (data) {
        mainsSubmissions = data.map(s => ({
          id: s.id, questionId: s.question_id, studentEmail: s.student_email,
          answerText: s.answer_text || '', answerImagePath: s.answer_image_path || null,
          testPaperId: s.test_paper_id || null,
          wantsHumanEval: !!s.wants_human_eval, humanEvalOrderId: s.human_eval_order_id || null,
          submittedAt: s.submitted_at
        }));
      }
    }

    async function openMainsPractice() {
      if (!currentUser) { openLoginModal('Log in to practice Mains answers.', () => openMainsPractice()); return; }
      document.getElementById('view-mains-practice').classList.remove('hidden');
      mainsPracticeActiveTestPaperId = null; // always land back on the grid/bank, never resume mid-paper
      await fetchCloudMainsSubmissions();
      mainsPracticeShowBrowse();
    }

    // Dashboard entry point card (#dash-mains-section). Gated by the 'mains' dashboard feature
    // level (featureAccess, see DASHBOARD_FEATURES in 11c_dashboard_access_layers.js) -- defaults to
    // 'off' (Hidden) until the admin switches it on for everyone, once the end-to-end flow has
    // actually been tested. Even while it's off, a student the admin has already granted explicit
    // Mains access to for any category (Entitlements Desk -> individual grant, or a covering bundle/
    // pass) always sees the card, so a few test logins can be let in without exposing the
    // still-unfinished flow to every other student. Whether a given category is actually unlocked
    // for *this* student is decided inside Mains Practice itself, per category tab
    // (renderMainsLockedBox) -- this card is just the door in.
    function renderMainsDashboardCard() {
      const section = document.getElementById('dash-mains-section');
      if (!section) return;
      const student = getCurrentStudent();
      const visible = !!student && (canUseFeature('mains') || MAINS_CATEGORY_IDS.some(catId => isMainsUnlockedForUser(catId)));
      section.classList.toggle('hidden', !visible);
    }

    function closeMainsPractice() {
      const writing = !document.getElementById('mp-screen-write').classList.contains('hidden');
      const draftText = document.getElementById('mp-answer-text') ? document.getElementById('mp-answer-text').value.trim() : '';
      if (writing && (draftText || mainsPracticeAnswerPhotoFile) && !confirm('Discard this unsaved answer?')) return;
      mainsPracticeCurrentQuestion = null;
      mainsPracticeAnswerPhotoFile = null;
      document.getElementById('view-mains-practice').classList.add('hidden');
    }

    function mainsPracticeSwitchScreen(name) {
      ['browse', 'write', 'assess'].forEach(s => document.getElementById(`mp-screen-${s}`).classList.toggle('hidden', s !== name));
    }

    function backToMainsBrowse() {
      const writing = !document.getElementById('mp-screen-write').classList.contains('hidden');
      const draftText = document.getElementById('mp-answer-text') ? document.getElementById('mp-answer-text').value.trim() : '';
      if (writing && (draftText || mainsPracticeAnswerPhotoFile) && !confirm('Discard this unsaved answer?')) return;
      mainsPracticeCurrentQuestion = null;
      mainsPracticeAnswerPhotoFile = null;
      mainsPracticeShowBrowse();
    }

    // ---- Browse screen ----
    // Three things can be showing here: the Tests grid (mainsPracticeViewMode==='tests', the
    // default), the original free-practice bank (==='bank'), or one specific test paper's fixed
    // question set (mainsPracticeActiveTestPaperId set, which overrides whichever mode was active).
    function mainsPracticeShowBrowse() {
      mainsPracticeSwitchScreen('browse');
      renderMainsAdminPreviewNote();

      document.getElementById('mp-browse-controls').classList.toggle('hidden', !!mainsPracticeActiveTestPaperId);
      document.querySelectorAll('.mp-mode-tab').forEach(b => {
        const on = b.dataset.mode === mainsPracticeViewMode;
        b.classList.toggle('bg-slate-900', on);
        b.classList.toggle('text-white', on);
        b.classList.toggle('text-slate-700', !on);
      });
      document.querySelectorAll('.mp-cat-tab').forEach(b => {
        const on = b.dataset.cat === mainsPracticeFilterCategory;
        b.classList.toggle('bg-slate-900', on);
        b.classList.toggle('text-white', on);
        b.classList.toggle('text-slate-700', !on);
      });

      if (mainsPracticeActiveTestPaperId) { renderMainsTestAttempt(mainsPracticeActiveTestPaperId); return; }

      document.getElementById('mp-tests-grid').classList.toggle('hidden', mainsPracticeViewMode !== 'tests');
      if (mainsPracticeViewMode === 'tests') {
        document.getElementById('mp-filter-subject').classList.add('hidden');
        document.getElementById('mp-question-list').classList.add('hidden');
        document.getElementById('mp-locked-box').classList.add('hidden');
        renderMainsTestPapersGrid();
        return;
      }

      // 'bank' mode -- the original free-form practice browse, unchanged.
      const unlocked = isMainsUnlockedForUser(mainsPracticeFilterCategory);
      document.getElementById('mp-filter-subject').classList.toggle('hidden', !unlocked);
      document.getElementById('mp-question-list').classList.toggle('hidden', !unlocked);
      document.getElementById('mp-locked-box').classList.toggle('hidden', unlocked);
      if (unlocked) {
        mainsPracticeRefreshSubjectFilter();
        renderMainsPracticeQuestionList();
      } else {
        renderMainsLockedBox(mainsPracticeFilterCategory);
      }
    }

    function mainsPracticeSetViewMode(mode) {
      mainsPracticeViewMode = mode;
      mainsPracticeActiveTestPaperId = null;
      mainsPracticeShowBrowse();
    }

    // ---- Mains Test Papers (priced/bundle-coverable "N-question tests") ----
    function renderMainsTestPapersGrid() {
      const grid = document.getElementById('mp-tests-grid');
      if (!grid) return;
      const papers = mainsTestPapers
        .filter(p => p.categoryId === mainsPracticeFilterCategory && p.active !== false && !p.delisted)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      grid.innerHTML = papers.map(mainsTestPaperCardHtml).join('')
        || '<p class="text-slate-400 text-sm text-center py-8 col-span-full">No Mains tests posted for this category yet.</p>';
    }

    function mainsTestPaperCardHtml(p) {
      const unlocked = isMainsTestUnlockedForUser(p.id);
      const liveYet = isMainsTestLiveYet(p);
      const marks = mainsTestPaperMarks(p);
      const myAnswered = new Set(mainsSubmissions.filter(s => s.testPaperId === p.id).map(s => s.questionId)).size;
      const liveDateStr = p.scheduled_for ? new Date(p.scheduled_for).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const priceLabel = p.bundleOnly ? 'BUNDLE' : `₹${p.price}`;
      return `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2">
              ${p.subject ? `<span class="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">${escapeHtml(p.subject)}</span>` : '<span></span>'}
              <span class="text-xs font-mono font-bold ${p.bundleOnly ? 'text-violet-600' : 'text-slate-900'}">${priceLabel}</span>
            </div>
            <h3 class="text-base font-bold text-slate-900 mt-2">${escapeHtml(p.title)}</h3>
            <p class="text-xs text-slate-500 mt-0.5 font-mono">${p.questionIds.length} Question${p.questionIds.length === 1 ? '' : 's'} • ${marks} Marks</p>
            ${unlocked && myAnswered ? `<p class="text-[11px] text-emerald-700 font-bold mt-1.5">${myAnswered}/${p.questionIds.length} answered</p>` : ''}
          </div>
          ${unlocked && liveYet ? `
            <button onclick="openMainsTestAttempt('${p.id}')" class="mt-5 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition shadow">
              ${myAnswered ? 'Continue test' : 'Start test'}
            </button>
          ` : (unlocked ? `
            <div class="mt-5 w-full py-2.5 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-lg text-center">🗓 Live on ${liveDateStr}</div>
          ` : (p.bundleOnly ? mainsTestBundleOnlyCta(p) : `
            <button onclick="openMainsTestCheckout('${p.id}')" class="mt-5 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow">
              🔒 Unlock Test (₹${p.price})
            </button>`))}
        </div>`;
    }

    // Mirrors bundleOnlyUnlockCta's spirit (02a_bundles.js) for a bundle-only Mains test paper.
    function mainsTestBundleOnlyCta(p) {
      const covering = bundlesForSale(b => bundleCoversMainsTest(b, p));
      if (!covering.length) return `<div class="mt-5 w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-lg text-center">Not available yet</div>`;
      return `<div class="mt-5 text-xs text-slate-500 text-center">Included in: ${covering.map(b => `<button onclick="openBundleCheckout('${b.id}')" class="font-bold text-amber-700 hover:underline">${escapeHtml(b.name)}</button>`).join(', ')}</div>`;
    }

    function openMainsTestAttempt(paperId) {
      mainsPracticeActiveTestPaperId = paperId;
      mainsPracticeShowBrowse();
    }

    function backToMainsTestsGrid() {
      mainsPracticeActiveTestPaperId = null;
      mainsPracticeShowBrowse();
    }

    // The attempt view is just the paper's fixed question_ids rendered with the same card/write/
    // self-assess flow as free practice -- no separate timed "exam session", since Mains write-ups
    // are deliberately untimed and resumable (see startMainsAnswer's test-paper tagging below).
    function renderMainsTestAttempt(paperId) {
      document.getElementById('mp-tests-grid').classList.add('hidden');
      document.getElementById('mp-locked-box').classList.add('hidden');
      document.getElementById('mp-filter-subject').classList.add('hidden');
      const p = getMainsTestPaper(paperId);
      if (!p || !isMainsTestUnlockedForUser(paperId)) {
        mainsPracticeActiveTestPaperId = null;
        mainsPracticeShowBrowse();
        return;
      }
      const list = document.getElementById('mp-question-list');
      list.classList.remove('hidden');
      const answered = new Set(mainsSubmissions.filter(s => s.testPaperId === paperId).map(s => s.questionId));
      const rows = p.questionIds.map(getMainsQuestion).filter(Boolean);
      const header = `
        <div class="flex items-center justify-between mb-3">
          <button onclick="backToMainsTestsGrid()" class="text-slate-500 text-xs font-bold hover:underline">&larr; Back to tests</button>
          <span class="text-xs font-bold text-emerald-700">${answered.size}/${rows.length} answered</span>
        </div>
        <h3 class="font-bold text-slate-900 mb-3">${escapeHtml(p.title)}</h3>`;
      list.innerHTML = header + (rows.map(mainsQuestionCardHtml).join('') || '<p class="text-slate-400 text-sm text-center py-8">This test has no questions.</p>');
    }

    // isMainsUnlockedForUser() always returns true for isAdmin() -- without this note, testing
    // Mains from the admin's own login would never show the locked/paywall box, or any pricing or
    // bundle info, even with an empty question bank (just "No questions here yet"). Points at the
    // one toggle that actually previews the real, locked-out view.
    function renderMainsAdminPreviewNote() {
      const note = document.getElementById('mp-admin-preview-note');
      if (!note) return;
      note.classList.toggle('hidden', !isAdmin());
      if (isAdmin()) {
        note.innerHTML = `👁️ You're viewing this as admin, so every category shows unlocked, even with no access and no questions yet. Use <b>"View as student"</b> (top of the Dev Console) to see the real locked view -- pricing, bundles, the lot.`;
      }
    }

    // Locked-state CTA for a category the student doesn't have Mains access to -- mirrors
    // bundleOnlyUnlockCta's spirit (02a_bundles.js) but offers TWO kinds of unlock path, since the
    // product decision ("gated like test papers") explicitly allows either: a covering category
    // Pass/bundle (which already covers every mock paper in that category too), or a cheaper
    // standalone Mains-only purchase. The covering bundle(s) are looked up the same way
    // isMainsUnlockedForUser() decides entitlement -- categoryAndAncestors() + b.categories, or
    // all-access -- NOT by assuming a bundle id equals the category id. That assumption used to hold
    // for the seeded category-pass bundles, but bundles are freely editable from the admin console,
    // so once those are renamed, replaced or re-scoped this must keep showing whatever actually
    // covers the category today, including none.
    async function renderMainsLockedBox(categoryId) {
      const box = document.getElementById('mp-locked-box');
      box.innerHTML = `<div class="bg-white border rounded-xl p-6 text-center text-sm text-slate-500">Loading…</div>`;
      if (!mainsAccessPriceCache) mainsAccessPriceCache = (await fetchCloudAppSetting('mains_access_price')) || {};
      const price = mainsAccessPriceCache[categoryId] != null ? mainsAccessPriceCache[categoryId] : (MAINS_ACCESS_DEFAULT_PRICE[categoryId] || 0);
      const coveredCats = categoryAndAncestors(categoryId);
      const coveringBundles = bundlesForSale(b => b.allAccess || coveredCats.some(c => b.categories.includes(c)));
      const catName = categoryDisplayName(categoryId);
      box.innerHTML = `
        <div class="bg-white border rounded-xl p-6 text-center">
          <div class="text-3xl mb-2">🔒</div>
          <p class="font-bold text-slate-900 mb-1">Mains access needed for ${escapeHtml(catName)}</p>
          <p class="text-slate-500 text-xs mb-5">Unlock answer writing, AI feedback and self-assessment for this category.</p>
          <div class="flex flex-wrap justify-center gap-3">
            ${coveringBundles.map(b => `
              <button onclick="openBundleCheckout('${b.id}')" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow">
                🎓 ${escapeHtml(b.name)} — ₹${b.price}
              </button>`).join('')}
            <button onclick="openCheckout('mains', '${categoryId}', 'Mains Access — ${escapeHtml(catName)}', ${price})" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow">
              ✍️ Mains access only — ₹${price}
            </button>
          </div>
          ${coveringBundles.length ? `<p class="text-slate-400 text-[11px] mt-4">A Pass/bundle above also covers every mock test in ${escapeHtml(catName)} — the standalone option is Mains-only.</p>` : ''}
        </div>`;
    }

    function mainsPracticeCategoryTabClick(catId) {
      mainsPracticeFilterCategory = catId;
      mainsPracticeFilterSubject = '';
      mainsPracticeActiveTestPaperId = null;
      mainsPracticeShowBrowse();
    }

    function mainsPracticeRefreshSubjectFilter() {
      const sel = document.getElementById('mp-filter-subject');
      const subjects = [...new Set(mainsQuestions.filter(q => q.categoryId === mainsPracticeFilterCategory && q.active).map(q => q.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      sel.innerHTML = '<option value="">All subjects</option>' + subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      sel.value = mainsPracticeFilterSubject;
    }

    function mainsPracticeFilterChanged() {
      mainsPracticeFilterSubject = document.getElementById('mp-filter-subject').value;
      renderMainsPracticeQuestionList();
    }

    function mainsQuestionCardHtml(q) {
      const mySubs = mainsSubmissions.filter(s => s.questionId === q.id);
      return `<div class="bg-white border rounded-xl p-4">
        <div class="flex justify-between gap-2 text-[10px] font-bold mb-1.5">
          <span class="flex gap-1 flex-wrap">
            ${q.subject ? `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(q.subject)}${q.subTopic ? ` · ${escapeHtml(q.subTopic)}` : ''}</span>` : ''}
            ${q.previousYear ? `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">PYQ ${q.previousYear}</span>` : ''}
          </span>
          <span class="font-mono text-emerald-700 whitespace-nowrap">${q.marks} marks${q.wordLimit ? ` · ${q.wordLimit}w` : ''}</span>
        </div>
        <p class="text-slate-800 text-sm mb-2">${escapeHtml(q.question)}</p>
        <div class="flex items-center gap-3 text-xs">
          <button onclick="startMainsAnswer('${q.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg">Write answer</button>
          ${mySubs.length ? `<button onclick="renderMainsSelfAssessment('${mySubs[0].id}')" class="text-indigo-600 font-bold hover:underline">${mySubs.length} past attempt${mySubs.length > 1 ? 's' : ''} →</button>` : ''}
        </div>
      </div>`;
    }

    function renderMainsPracticeQuestionList() {
      const list = document.getElementById('mp-question-list');
      const rows = mainsQuestions.filter(q => q.active && q.categoryId === mainsPracticeFilterCategory &&
        (!mainsPracticeFilterSubject || q.subject === mainsPracticeFilterSubject));
      list.innerHTML = rows.map(mainsQuestionCardHtml).join('') || '<p class="text-slate-400 text-sm text-center py-8">No questions here yet — check back soon.</p>';
    }

    // ---- Write-answer screen ----
    function startMainsAnswer(questionId) {
      const q = getMainsQuestion(questionId);
      if (!q) return;
      // Defensive re-check -- the browse screen already hides question cards for a locked
      // category/test paper (renderMainsLockedBox / renderMainsTestAttempt), but this guards
      // against a stale question card still in the DOM (e.g. access was revoked mid-session)
      // rather than trusting only what's rendered. Inside a test attempt, the paper's OWN
      // entitlement is what matters (isMainsTestUnlockedForUser already also accepts whole-category
      // coverage), not just the question's category on its own.
      const unlocked = mainsPracticeActiveTestPaperId
        ? isMainsTestUnlockedForUser(mainsPracticeActiveTestPaperId)
        : isMainsUnlockedForUser(q.categoryId);
      if (!unlocked) {
        mainsPracticeFilterCategory = q.categoryId;
        mainsPracticeActiveTestPaperId = null;
        mainsPracticeShowBrowse();
        return;
      }
      mainsPracticeCurrentQuestion = q;
      // Snapshot now (not read fresh in submitMainsAnswer) so the submission is tagged correctly
      // even if the student somehow navigates away from the attempt before submitting.
      mainsPracticeAnswerTestPaperId = mainsPracticeActiveTestPaperId;
      mainsPracticeAnswerPhotoFile = null;
      document.getElementById('mp-write-subject').innerText = q.subject || q.categoryId;
      document.getElementById('mp-write-marks').innerText = `${q.marks} marks${q.wordLimit ? ` · ${q.wordLimit}-word limit` : ''}`;
      document.getElementById('mp-write-question').innerText = q.question;
      const writeQuestionKnEl = document.getElementById('mp-write-question-kn');
      writeQuestionKnEl.innerText = q.questionKn || '';
      writeQuestionKnEl.classList.toggle('hidden', !q.questionKn);
      document.getElementById('mp-write-rubric-hint').innerText = q.rubric.length
        ? `Covers: ${q.rubric.map(r => r.criterion).join(' · ')}` : '';
      document.getElementById('mp-answer-text').value = '';
      document.getElementById('mp-answer-file').value = '';
      document.getElementById('mp-answer-file-preview').classList.add('hidden');
      document.getElementById('mp-submit-error').classList.add('hidden');
      mainsPracticeWordCount();
      mainsPracticeSwitchScreen('write');
    }

    function mainsPracticeWordCount() {
      const text = document.getElementById('mp-answer-text').value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      const limit = mainsPracticeCurrentQuestion && mainsPracticeCurrentQuestion.wordLimit;
      document.getElementById('mp-word-count').innerText = limit ? `${words} / ${limit} words` : `${words} words`;
    }

    // Accepts either a photo or a PDF scan of a handwritten answer. Validated client-side for fast
    // feedback (type + size) -- the 'mains_answer_photos' storage bucket enforces the same size cap
    // and mime allow-list server-side too, so this can't be bypassed by skipping the UI.
    function mainsPracticeChooseAnswerFile(inputEl) {
      const file = inputEl.files[0];
      if (!file) return;
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isImage && !isPdf) {
        alert('Please attach a photo (JPG/PNG) or a PDF.');
        inputEl.value = '';
        return;
      }
      if (file.size > MAX_MAINS_ANSWER_FILE_BYTES) {
        alert(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB -- try a lower-resolution scan or photo.`);
        inputEl.value = '';
        return;
      }
      mainsPracticeAnswerPhotoFile = file;
      document.getElementById('mp-answer-filename').innerText = `${file.name} (${(file.size / 1048576).toFixed(1)} MB)`;
      document.getElementById('mp-answer-file-preview').classList.remove('hidden');
    }

    function mainsPracticeRemovePhoto() {
      mainsPracticeAnswerPhotoFile = null;
      document.getElementById('mp-answer-file').value = '';
      document.getElementById('mp-answer-file-preview').classList.add('hidden');
    }

    async function submitMainsAnswer() {
      const errBox = document.getElementById('mp-submit-error');
      const showErr = msg => { errBox.innerText = msg; errBox.classList.remove('hidden'); };
      errBox.classList.add('hidden');
      if (!mainsPracticeCurrentQuestion || !currentUser) return;
      const answerText = document.getElementById('mp-answer-text').value.trim();
      if (!answerText && !mainsPracticeAnswerPhotoFile) return showErr('Type an answer or attach a photo/PDF before submitting.');

      const btn = document.querySelector('#mp-screen-write button[onclick="submitMainsAnswer()"]');
      const originalLabel = btn ? btn.innerText : '';
      if (btn) { btn.innerText = 'Submitting…'; btn.disabled = true; }

      try {
        let answerImagePath = null;
        if (mainsPracticeAnswerPhotoFile) {
          const safeName = mainsPracticeAnswerPhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${normalizeEmail(currentUser.email)}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabaseClient.storage.from('mains_answer_photos').upload(path, mainsPracticeAnswerPhotoFile, { cacheControl: '3600', upsert: false });
          if (upErr) throw upErr;
          answerImagePath = path;
        }

        const submission = {
          id: 'msub_' + Date.now(),
          question_id: mainsPracticeCurrentQuestion.id,
          student_email: normalizeEmail(currentUser.email),
          answer_text: answerText || null,
          answer_image_path: answerImagePath,
          // null for free-practice (unchanged); set when this answer was written as part of a
          // specific Mains test paper attempt, so the paper's "X/N answered" progress can count it.
          test_paper_id: mainsPracticeAnswerTestPaperId || null,
          submitted_at: new Date().toISOString()
        };
        const { error } = await supabaseClient.from('mains_submissions').insert([submission]);
        if (error) throw error;

        mainsSubmissions.unshift({
          id: submission.id, questionId: submission.question_id, studentEmail: submission.student_email,
          answerText: submission.answer_text || '', answerImagePath: submission.answer_image_path,
          testPaperId: submission.test_paper_id,
          wantsHumanEval: false, humanEvalOrderId: null, submittedAt: submission.submitted_at
        });
        mainsPracticeAnswerPhotoFile = null;
        renderMainsSelfAssessment(submission.id);
      } catch (err) {
        console.error('submitMainsAnswer:', fmtErr(err));
        showErr('Failed to submit your answer: ' + (err.message || 'please try again.'));
      } finally {
        if (btn) { btn.innerText = originalLabel; btn.disabled = false; }
      }
    }

    // ---- Self-assessment screen ----
    async function renderMainsSelfAssessment(submissionId) {
      const sub = mainsSubmissions.find(s => s.id === submissionId);
      if (!sub) return;
      const q = getMainsQuestion(sub.questionId);
      if (!q) return;

      document.getElementById('mp-assess-question').innerText = q.question;
      const questionKnEl = document.getElementById('mp-assess-question-kn');
      questionKnEl.innerText = q.questionKn || '';
      questionKnEl.classList.toggle('hidden', !q.questionKn);
      document.getElementById('mp-assess-model-answer').innerText = q.modelAnswer || 'No model answer added yet for this question.';
      const modelAnswerKnEl = document.getElementById('mp-assess-model-answer-kn');
      modelAnswerKnEl.innerText = q.modelAnswerKn || '';
      modelAnswerKnEl.classList.toggle('hidden', !q.modelAnswerKn);
      const expImageEl = document.getElementById('mp-assess-model-answer-image');
      if (q.expImageUrl) { expImageEl.src = q.expImageUrl; expImageEl.classList.remove('hidden'); }
      else expImageEl.classList.add('hidden');

      const myAnswerEl = document.getElementById('mp-assess-my-answer');
      const myPhotoEl = document.getElementById('mp-assess-my-photo');
      const myPdfLinkEl = document.getElementById('mp-assess-my-pdf-link');
      myAnswerEl.innerText = sub.answerText || (sub.answerImagePath ? '' : 'No answer text.');
      myPhotoEl.classList.add('hidden');
      myPdfLinkEl.classList.add('hidden');
      if (sub.answerImagePath) {
        const isPdf = /\.pdf$/i.test(sub.answerImagePath);
        const { data, error } = await supabaseClient.storage.from('mains_answer_photos').createSignedUrl(sub.answerImagePath, 300);
        if (!error && data && data.signedUrl) {
          if (isPdf) {
            myPdfLinkEl.href = data.signedUrl;
            myPdfLinkEl.classList.remove('hidden');
          } else {
            myPhotoEl.src = data.signedUrl;
            myPhotoEl.classList.remove('hidden');
          }
        }
      }

      renderMainsAssessRubric(q.rubric);
      mainsPracticeCurrentSubmissionId = submissionId;
      await mainsAiFeedbackInit(submissionId);
      await mainsHumanReviewInit(submissionId);
      mainsPracticeSwitchScreen('assess');
    }

    function renderMainsAssessRubric(rubric) {
      const wrap = document.getElementById('mp-assess-rubric-list');
      wrap.innerHTML = (rubric || []).map(r => `
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" class="mp-rubric-check rounded" data-weight="${r.weight}" onchange="updateMainsAssessCoverage()" />
          <span class="flex-1">${escapeHtml(r.criterion)}</span>
          <span class="text-slate-400 font-mono text-xs">${r.weight}%</span>
        </label>`).join('') || '<p class="text-slate-400 italic">No rubric set for this question yet.</p>';
      updateMainsAssessCoverage();
    }

    function updateMainsAssessCoverage() {
      const boxes = [...document.querySelectorAll('.mp-rubric-check')];
      const total = boxes.reduce((s, b) => s + (parseFloat(b.dataset.weight) || 0), 0);
      const covered = boxes.filter(b => b.checked).reduce((s, b) => s + (parseFloat(b.dataset.weight) || 0), 0);
      const el = document.getElementById('mp-assess-coverage');
      el.innerText = total ? `Self-assessed coverage: ${Math.round(covered)}%` : '';
    }

    // ---- AI-assisted feedback (second evaluation tier) ----
    // Calls the provider-agnostic 'mains-ai-evaluate' Edge Function. On open, checks whether this
    // submission already has a saved evaluation (so re-opening a past attempt shows it again rather
    // than re-offering the button / re-spending a credit), and otherwise shows the current credit
    // balance alongside the button.
    function mainsAiFeedbackHideAll() {
      ['mp-ai-feedback-idle', 'mp-ai-feedback-loading', 'mp-ai-feedback-error', 'mp-ai-feedback-result'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });
    }

    async function mainsAiFeedbackInit(submissionId) {
      mainsAiFeedbackHideAll();
      document.getElementById('mp-ai-credits-label').innerText = '';

      const { data: existing, error } = await supabaseClient.from('mains_ai_evaluations')
        .select('*').eq('submission_id', submissionId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!error && existing) { renderMainsAiEvaluationResult(existing); return; }

      document.getElementById('mp-ai-feedback-idle').classList.remove('hidden');
      if (currentUser) {
        const { data: creditRow } = await supabaseClient.from('mains_eval_credits').select('balance').eq('student_email', normalizeEmail(currentUser.email)).maybeSingle();
        const bal = creditRow ? creditRow.balance : 0;
        document.getElementById('mp-ai-credits-label').innerText = `${bal} credit${bal === 1 ? '' : 's'} left`;
      }
    }

    function renderMainsAiEvaluationResult(evalRow) {
      mainsAiFeedbackHideAll();
      document.getElementById('mp-ai-feedback-result').classList.remove('hidden');
      document.getElementById('mp-ai-score').innerText = `${evalRow.overall_score} / ${evalRow.max_score} marks`;
      const criteria = Array.isArray(evalRow.criteria_scores) ? evalRow.criteria_scores : [];
      document.getElementById('mp-ai-criteria').innerHTML = criteria.map(c => `
        <div class="flex justify-between gap-2">
          <span>${escapeHtml(c.criterion)}${c.comment ? `<span class="text-slate-400"> — ${escapeHtml(c.comment)}</span>` : ''}</span>
          <span class="font-mono font-bold text-indigo-700 whitespace-nowrap">${c.score}/${c.max}</span>
        </div>`).join('');
      document.getElementById('mp-ai-summary').innerText = evalRow.summary_feedback || '';
    }

    // supabase-js v2 raises non-2xx Edge Function responses as a FunctionsHttpError whose parsed
    // JSON body lives on error.context (a Response) -- this pulls the { error, message } our
    // function sends back out of it, falling back to a generic message if that shape ever changes.
    async function mainsExtractFunctionErrorBody(error) {
      try {
        if (error && error.context && typeof error.context.json === 'function') return await error.context.json();
      } catch (_) { /* fall through to generic message below */ }
      return { error: 'call_failed', message: (error && error.message) || 'Unknown error' };
    }

    function mainsShowAiFeedbackError(body) {
      mainsAiFeedbackHideAll();
      const code = body && body.error;
      let msg;
      if (code === 'insufficient_credits') msg = "You're out of AI evaluation credits.";
      else if (code === 'not_configured') msg = "AI evaluation isn't set up yet — check back once an API key has been added.";
      else msg = 'Could not get AI feedback right now: ' + ((body && body.message) || 'please try again.');
      const errorBox = document.getElementById('mp-ai-feedback-error');
      errorBox.innerText = msg;
      errorBox.classList.remove('hidden');
      document.getElementById('mp-ai-feedback-idle').classList.remove('hidden'); // let them retry
    }

    async function requestMainsAiEvaluation() {
      const submissionId = mainsPracticeCurrentSubmissionId;
      if (!submissionId) return;
      mainsAiFeedbackHideAll();
      document.getElementById('mp-ai-feedback-loading').classList.remove('hidden');

      try {
        const { data, error } = await supabaseClient.functions.invoke('mains-ai-evaluate', { body: { submission_id: submissionId } });
        if (error) return mainsShowAiFeedbackError(await mainsExtractFunctionErrorBody(error));
        if (!data || !data.success) return mainsShowAiFeedbackError(data);
        renderMainsAiEvaluationResult(data.evaluation);
      } catch (err) {
        mainsShowAiFeedbackError({ error: 'network_error', message: err.message });
      }
    }

    // ---- Personal (human) review -- third evaluation tier ----
    // Purchased through the exact same manual UTR + admin-approval flow as every other purchase in
    // this app (openCheckout -> payment_orders, see 03_pricing_checkout.js / 03d_payment_claims.js) --
    // 'mains_human_eval' is just another order `type`, with the submission id as its item id.
    // Approving that order is what actually queues the submission (activateMainsHumanEvalOrder in
    // 06b_mains_studio.js); this file only has to show the right state back to the student.
    let mainsHumanReviewPrice = null;

    function mainsHumanReviewHideAll() {
      ['mp-human-review-idle', 'mp-human-review-pending', 'mp-human-review-queued', 'mp-human-review-done', 'mp-human-review-rejected'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });
    }

    async function mainsHumanReviewInit(submissionId) {
      mainsHumanReviewHideAll();

      // A row here means the submission was already queued (status 'pending') or graded ('done') --
      // either way, there's nothing left to request, so this takes priority over payment-order state.
      const { data: evalRow, error } = await supabaseClient.from('mains_human_evaluations')
        .select('*').eq('submission_id', submissionId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!error && evalRow) {
        if (evalRow.status === 'done') { renderMainsHumanEvalResult(evalRow); return; }
        document.getElementById('mp-human-review-queued').classList.remove('hidden');
        return;
      }

      // No queue row yet -- fall back to the latest payment_orders entry for this submission
      // (paymentOrders is already loaded globally at boot for everyone, public-read, no extra fetch).
      const order = (typeof paymentOrders !== 'undefined' ? paymentOrders : [])
        .filter(o => o.type === 'mains_human_eval' && o.itemId === submissionId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      if (order) {
        if (order.status === 'pending') { document.getElementById('mp-human-review-pending').classList.remove('hidden'); return; }
        if (order.status === 'approved') { document.getElementById('mp-human-review-queued').classList.remove('hidden'); return; } // safety net -- should already have an eval row by now
        if (order.status === 'rejected') {
          document.getElementById('mp-human-review-reject-reason').innerText = order.rejectReason || 'please try again.';
          document.getElementById('mp-human-review-rejected').classList.remove('hidden');
          return;
        }
      }

      // Idle -- nothing requested yet (or the only prior attempt was refunded, which never happens
      // here since this isn't a persistent entitlement).
      mainsHumanReviewPrice = (await fetchCloudAppSetting('mains_human_eval_price')) || MAINS_HUMAN_EVAL_DEFAULT_PRICE;
      document.getElementById('mp-human-review-price').innerText = `₹${mainsHumanReviewPrice}`;
      document.getElementById('mp-human-review-idle').classList.remove('hidden');
    }

    function renderMainsHumanEvalResult(evalRow) {
      mainsHumanReviewHideAll();
      document.getElementById('mp-human-review-done').classList.remove('hidden');
      document.getElementById('mp-human-review-score').innerText = `${evalRow.score} / ${evalRow.max_score} marks`;
      document.getElementById('mp-human-review-feedback').innerText = evalRow.feedback || '';
    }

    function requestMainsHumanReview() {
      const submissionId = mainsPracticeCurrentSubmissionId;
      if (!submissionId) return;
      const sub = mainsSubmissions.find(s => s.id === submissionId);
      const q = sub ? getMainsQuestion(sub.questionId) : null;
      const price = mainsHumanReviewPrice || MAINS_HUMAN_EVAL_DEFAULT_PRICE;
      const qText = q ? q.question : 'Mains answer';
      const title = 'Personal review — ' + (qText.length > 60 ? qText.slice(0, 60) + '…' : qText);
      openCheckout('mains_human_eval', submissionId, title, price);
    }
