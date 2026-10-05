    // ============================================================
    // TEST PAPER STUDIO — Round A
    // ============================================================
    // State: studioState holds the paper being built/edited.
    //   { mode: 'new'|'edit'|'duplicate', originalId, questions:[…], … }
    // Questions use the same shape the exam engine already renders:
    //   { id, q_en, q_kn, options_en:[4], options_kn:[4], correct, exp, exp_kn, subject, image_url,
    //     contentType, relevantPeriod, relevantUntil, askedInYears, retired, sourceQuestionId }
    // exp_kn (Kannada explanation) is optional and independent of exp (English) — a paper can have
    // English-only explanations, Kannada-only, both, or neither, same as q_en/q_kn.
    // contentType ('static' | 'ca') separates a question's SHELF LIFE from its Subject — "Fundamental
    // Rights" (Polity, static) and "Budget 2026 allocations" (also Polity, but current-affairs and
    // time-bound) stay under the same Subject but are tagged differently, rather than forking Subject
    // into "Polity" / "Polity CA" pairs (which would fragment the registry we built the cleanup tool
    // for). Unset/missing === 'static', so every question from before this field existed needs no
    // migration. relevantPeriod is a free-text period ("Sep 2026") used only for 'ca' questions, shown
    // in the Current Affairs review tool (see renderCoverageAndCaReview) to help decide what's stale —
    // it's descriptive only, not parsed by anything.
    // relevantUntil is the STRUCTURED counterpart: an ISO date ("2027-10-04"), only meaningful for
    // contentType==='ca', auto-defaulted to one year from the day the question is added/marked CA
    // (see studioApplyMappingAndAdd / studioSetContentTypeSelected / editSetContentType) so every CA
    // question gets a one-year relevance window without the admin having to set it by hand. There is
    // deliberately no separate "archived"/"lapsed" boolean — "lapsed, pending review" is computed on
    // the fly as contentType==='ca' && !retired && relevantUntil && relevantUntil < today (see
    // isCaLapsedPendingReview below). Once the admin Accepts (→ becomes permanent static, relevantUntil
    // cleared) or Rejects (→ retired, same as the existing Retire mechanism) a lapsed question in the
    // Archive review panel (renderCoverageAndCaReview, js/11d_study_planner_admin_csv.js), it naturally
    // falls out of that computed set — no extra bookkeeping needed.
    // askedInYears is an admin-entered list of years this question (or a close variant) appeared in a
    // real exam — used to show students "asked before" and to prioritize sampling in Generate-from-
    // Bank. retired excludes a question from the question bank / Topic Builder / Generate-from-Bank
    // entirely (without deleting it or touching the paper it lives in) — the mechanism the CA review
    // tool uses to retire a stale current-affairs question. isCaLapsedPendingReview (below) is excluded
    // the same way, from the same two sampling sites, until the admin decides on it.

    // A CA question's relevance window, in days, before it's considered lapsed and routed to the
    // Archive review queue. One year, per policy — change here only, everything else derives from it.
    const CA_RELEVANCE_WINDOW_DAYS = 365;

    function studioTodayIso() {
      return new Date().toISOString().slice(0, 10);
    }

    function studioAddDaysIso(isoDate, days) {
      const d = new Date(isoDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }

    function studioDefaultRelevantUntil() {
      return studioAddDaysIso(studioTodayIso(), CA_RELEVANCE_WINDOW_DAYS);
    }

    // True exactly when q is a Current-Affairs question whose relevance window has passed and no
    // admin decision (Accept/Reject in the Archive panel) has been made yet. Used to exclude such
    // questions from the question bank / Topic Builder / Generate-from-Bank, mirroring `retired`.
    function isCaLapsedPendingReview(q) {
      return q && q.contentType === 'ca' && !q.retired && !!q.relevantUntil && q.relevantUntil < studioTodayIso();
    }
    let studioState = null;
    let studioLangMode = 'en';      // 'en' | 'kn' | 'both'
    let studioInputMode = 'csv';    // 'csv' | 'paste' | 'manual' | 'bank'
    let studioBankPool = [];        // last-scanned question bank pool for the 'bank' generate mode
    let studioEditingIndex = -1;    // index of the question open in the edit modal
    let studioPendingMapping = null; // { headers:[], mapping:{}, rows:[] } — when parser needs help

    // ---- Header alias table (smart-and-forgiving CSV parsing) ----
    // Normalized header (lowercase, non-alnum stripped) → canonical field.
    const STUDIO_HEADER_ALIASES = {
      // Question EN
      'questionen': 'q_en', 'question': 'q_en', 'q': 'q_en', 'qen': 'q_en', 'questionenglish': 'q_en',
      // Question KN
      'questionkn': 'q_kn', 'qkn': 'q_kn', 'kannada': 'q_kn', 'questionkannada': 'q_kn', 'kannadaquestion': 'q_kn',
      // Options EN
      'optaen': 'a_en', 'aen': 'a_en', 'optiona': 'a_en', 'opta': 'a_en', 'a': 'a_en', 'optionaen': 'a_en',
      'optben': 'b_en', 'ben': 'b_en', 'optionb': 'b_en', 'optb': 'b_en', 'b': 'b_en', 'optionben': 'b_en',
      'optcen': 'c_en', 'cen': 'c_en', 'optionc': 'c_en', 'optc': 'c_en', 'c': 'c_en', 'optioncen': 'c_en',
      'optden': 'd_en', 'den': 'd_en', 'optiond': 'd_en', 'optd': 'd_en', 'd': 'd_en', 'optionden': 'd_en',
      // Options KN
      'optakn': 'a_kn', 'akn': 'a_kn', 'optionakn': 'a_kn',
      'optbkn': 'b_kn', 'bkn': 'b_kn', 'optionbkn': 'b_kn',
      'optckn': 'c_kn', 'ckn': 'c_kn', 'optionckn': 'c_kn',
      'optdkn': 'd_kn', 'dkn': 'd_kn', 'optiondkn': 'd_kn',
      // Correct
      'correct': 'correct', 'answer': 'correct', 'ans': 'correct', 'correctanswer': 'correct', 'key': 'correct',
      // Explanation (English)
      'explanation': 'exp', 'explain': 'exp', 'solution': 'exp', 'sol': 'exp', 'reason': 'exp',
      'explanationen': 'exp', 'explanationenglish': 'exp',
      // Explanation (Kannada)
      'explanationkn': 'exp_kn', 'expkn': 'exp_kn', 'explanationkannada': 'exp_kn', 'solutionkn': 'exp_kn', 'reasonkn': 'exp_kn',
      // Subject
      'subject': 'subject', 'topic': 'subject', 'category': 'subject', 'tag': 'subject',
      // Difficulty
      'difficulty': 'difficulty', 'level': 'difficulty', 'diff': 'difficulty', 'difficultylevel': 'difficulty',
      // Image
      'image': 'image_url', 'imageurl': 'image_url', 'diagram': 'image_url', 'graph': 'image_url', 'graphurl': 'image_url', 'img': 'image_url',
      // Content type (Static syllabus vs Current Affairs) — see studioQuestionProblem/getQuestionBank
      // comments near contentType for why this is a field of its own rather than folded into Subject.
      'contenttype': 'contentType', 'type': 'contentType', 'nature': 'contentType', 'static': 'contentType',
      // Relevant period — only meaningful for Current Affairs rows; ignored for Static ones
      'relevantperiod': 'relevantPeriod', 'period': 'relevantPeriod', 'caperiod': 'relevantPeriod', 'month': 'relevantPeriod',
      // Relevant until — structured expiry date (CA only); auto-defaulted to +1yr if left blank
      'relevantuntil': 'relevantUntil', 'until': 'relevantUntil', 'expiry': 'relevantUntil', 'expires': 'relevantUntil',
      'validuntil': 'relevantUntil', 'validtill': 'relevantUntil', 'relevanttill': 'relevantUntil',
      // Asked in (years) — comma/space separated list of years this exact question appeared in a real exam
      'askedinyears': 'askedInYears', 'askedyears': 'askedInYears', 'pyq': 'askedInYears', 'previouslyasked': 'askedInYears', 'years': 'askedInYears'
    };
    const STUDIO_FIELD_LABELS = {
      q_en: 'Question (English)',      q_kn: 'Question (Kannada)',
      a_en: 'Option A (English)',      a_kn: 'Option A (Kannada)',
      b_en: 'Option B (English)',      b_kn: 'Option B (Kannada)',
      c_en: 'Option C (English)',      c_kn: 'Option C (Kannada)',
      d_en: 'Option D (English)',      d_kn: 'Option D (Kannada)',
      correct: 'Correct Answer',       exp: 'Explanation (English)',
      exp_kn: 'Explanation (Kannada)',
      subject: 'Subject / Topic Tag',  image_url: 'Image URL',
      difficulty: 'Difficulty (1-5)',
      contentType: 'Type (Static/Current Affairs)', relevantPeriod: 'Relevant Period (CA only)',
      relevantUntil: 'Relevant Until (CA only, YYYY-MM-DD)',
      askedInYears: 'Asked In (years)',
      _ignore: '— Ignore this column —'
    };

    function studioNormalizeHeader(s) {
      return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // ---- Save draft ----
    // Addresses "one-by-one question entry is slow and time-consuming, needs a save draft option" —
    // an admin building up a large paper across multiple sessions can now save progress and resume
    // later, rather than losing everything if they close the tab or the browser crashes mid-entry.
    // Deliberately a single draft slot (not multiple named drafts) to keep this simple — matches how
    // most admins actually work: one paper in progress at a time.
    const STUDIO_DRAFT_KEY = 'kas_paper_draft';

    function studioSerializeDraft() {
      return {
        savedAt: new Date().toISOString(),
        title: document.getElementById('studio-paper-title').value,
        category: document.getElementById('studio-category').value,
        extraCategories: [...document.querySelectorAll('.studio-extracat-cb:checked')].map(cb => cb.value),
        alsoListCategories: [...document.querySelectorAll('.studio-alsolist-cb:checked')].map(cb => cb.value),
        active: document.getElementById('studio-active').checked,
        delisted: document.getElementById('studio-delisted').checked,
        price: document.getElementById('studio-price').value,
        scheduledFor: document.getElementById('studio-scheduled-for').value,
        markCorrect: document.getElementById('studio-mark-correct').value,
        markWrong: document.getElementById('studio-mark-wrong').value,
        duration: document.getElementById('studio-duration').value,
        cutoff: document.getElementById('studio-cutoff').value,
        questions: studioState ? studioState.questions : []
      };
    }

    function studioSaveDraft() {
      if (!studioState) return;
      // BUG FIX: the draft slot is a single global "unpublished new paper in progress" slot — openStudio()
      // only ever offers to resume it `if (!paperId)`, i.e. for a brand-new paper. But this button had no
      // mode check, so saving a draft while EDITING or DUPLICATING an already-published paper silently
      // overwrote that same slot with the in-progress edit. If the admin then published (mode !== 'new'),
      // studioPublish() correctly left that slot alone — leaving a stale "edit" draft behind — and the next
      // time Studio opened for a genuinely new paper, it resurfaced that leftover and offered to resume it.
      // That's the "I saved a draft and published, but Studio keeps taking me back to that draft" bug.
      // Editing/duplicating never needed draft-saving in the first place (Publish already saves the real
      // thing) — same day-one-comment for the discard side. Now this is a no-op outside 'new' mode.
      if (studioState.mode !== 'new') {
        return alert('Save draft only applies to a brand-new, not-yet-published paper.\n\nYou\'re editing/duplicating an existing one — just Publish when ready; there\'s nothing separate to save as a draft.');
      }
      const draft = studioSerializeDraft();
      if (!draft.title && !draft.questions.length) {
        return alert('Nothing to save yet — add a title or at least one question first.');
      }
      try {
        localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
        const status = document.getElementById('studio-draft-status');
        status.innerText = `✓ Draft saved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        setTimeout(() => { if (status.innerText.startsWith('✓')) status.innerText = ''; }, 4000);
      } catch (err) {
        alert('Could not save draft (browser storage may be full): ' + err.message);
      }
    }

    function studioLoadDraftIntoForm(draft) {
      document.getElementById('studio-paper-title').value = draft.title || '';
      document.getElementById('studio-category').value = draft.category || Object.keys(EXAM_CATEGORIES)[0] || 'kpsc_kas';
      studioRefreshExtraCategoryOptions(Array.isArray(draft.extraCategories) ? draft.extraCategories : []);
      studioRefreshAlsoListCategoryOptions(Array.isArray(draft.alsoListCategories) ? draft.alsoListCategories : []);
      document.getElementById('studio-active').checked = draft.active !== false;
      document.getElementById('studio-delisted').checked = !!draft.delisted;
      document.getElementById('studio-price').value = draft.price || 99;
      document.getElementById('studio-scheduled-for').value = draft.scheduledFor || '';
      if (draft.markCorrect != null) document.getElementById('studio-mark-correct').value = draft.markCorrect;
      if (draft.markWrong != null)   document.getElementById('studio-mark-wrong').value = draft.markWrong;
      if (draft.duration != null)    document.getElementById('studio-duration').value = draft.duration;
      if (draft.cutoff != null)      document.getElementById('studio-cutoff').value = draft.cutoff;
      studioState.questions = Array.isArray(draft.questions) ? draft.questions : [];
      const status = document.getElementById('studio-draft-status');
      status.innerText = `↩ Resumed draft from ${new Date(draft.savedAt).toLocaleString('en-IN')}`;
    }

    function studioDiscardDraft() {
      localStorage.removeItem(STUDIO_DRAFT_KEY);
    }

    // ---- Open / close ----
    async function openStudio(paperId, asDuplicate) {
      studioState = {
        mode: paperId ? (asDuplicate ? 'duplicate' : 'edit') : 'new',
        originalId: paperId || null,
        questions: []
      };
      studioLangMode = 'en';
      studioInputMode = 'csv';
      studioPendingMapping = null;
      studioBankPool = [];
      document.getElementById('studio-draft-status').innerText = '';

      // Reset sidebar defaults
      document.getElementById('studio-paper-title').value = '';
      const firstCatId = Object.keys(EXAM_CATEGORIES)[0] || 'kpsc_kas';
      document.getElementById('studio-category').value = firstCatId;
      document.getElementById('studio-price').value = 99;
      document.getElementById('studio-scheduled-for').value = '';
      document.getElementById('studio-active').checked = true;
      document.getElementById('studio-delisted').checked = false;
      studioApplyCategoryDefaults(firstCatId);
      studioRefreshExtraCategoryOptions([]);
      studioRefreshAlsoListCategoryOptions([]);
      studioRefreshBundleCheckOptions();

      // Offer to resume a saved draft — only for brand-new papers (not editing/duplicating an
      // already-published one, where "draft" doesn't make sense as a concept).
      if (!paperId) {
        try {
          const raw = localStorage.getItem(STUDIO_DRAFT_KEY);
          if (raw) {
            const draft = JSON.parse(raw);
            const when = new Date(draft.savedAt).toLocaleString('en-IN');
            const qCount = Array.isArray(draft.questions) ? draft.questions.length : 0;
            if (confirm(`Resume your saved draft "${draft.title || '(untitled)'}" (${qCount} question${qCount === 1 ? '' : 's'}, saved ${when})?\n\nClick Cancel to discard it and start fresh.`)) {
              studioLoadDraftIntoForm(draft);
            } else {
              studioDiscardDraft();
            }
          }
        } catch (err) {
          console.error('Failed to read saved draft:', fmtErr(err));
        }
      }

      // Preload if editing/duplicating
      if (paperId) {
        const p = testsCatalog.find(x => x.id === paperId);
        if (p) {
          // The catalog only carries metadata by default — fetch this paper's actual questions
          // now that the admin is opening it to edit, rather than for every paper on every load.
          await ensurePaperQuestionsLoaded(p);
          document.getElementById('studio-paper-title').value = asDuplicate ? `Copy of ${p.title}` : p.title;
          document.getElementById('studio-category').value = p.category;
          studioRefreshExtraCategoryOptions(p.extraCategories || []);
          studioRefreshAlsoListCategoryOptions(p.alsoListCategories || []);
          document.getElementById('studio-active').checked = p.active !== false;
          document.getElementById('studio-delisted').checked = !!p.delisted;
          // SECURITY FIX: if p.price is undefined/null/NaN (older rows, direct DB edits, or any
          // upload path that didn't set it), assigning it straight to .value leaves the field blank.
          // On save, parseInt("") is NaN, which the old publish code silently coerced to 0 — meaning
          // simply opening a paper to fix a typo and republishing could silently make it FREE with no
          // warning. Now: a missing/invalid price is visibly flagged, never silently blanked.
          const priceIsValid = p.price !== undefined && p.price !== null && !isNaN(Number(p.price));
          document.getElementById('studio-price').value = priceIsValid ? p.price : 99;
          if (!priceIsValid) {
            alert(`⚠ "${p.title}" had no valid price on file (found: ${JSON.stringify(p.price)}). Defaulted to ₹99 — please confirm the correct price before publishing, or this paper may have been silently free.`);
          }
          // Preload schedule if present. datetime-local wants "YYYY-MM-DDTHH:mm" (local time, no seconds/TZ)
          if (p.scheduled_for) {
            const d = new Date(p.scheduled_for);
            const pad = n => String(n).padStart(2, '0');
            const localVal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            document.getElementById('studio-scheduled-for').value = localVal;
          }
          if (p.scheme) {
            document.getElementById('studio-mark-correct').value = p.scheme.marksCorrect;
            document.getElementById('studio-mark-wrong').value = p.scheme.marksWrong;
            document.getElementById('studio-duration').value = p.scheme.duration;
            document.getElementById('studio-cutoff').value = p.scheme.cutoff;
          }
          studioState.questions = (p.questions || []).map((q, i) => ({
            id: i + 1,
            q_en: q.q_en || '', q_kn: q.q_kn || '',
            options_en: Array.isArray(q.options_en) ? q.options_en.slice(0, 4) : ['', '', '', ''],
            options_kn: Array.isArray(q.options_kn) ? q.options_kn.slice(0, 4) : ['', '', '', ''],
            correct: (q.correct || 'A').toUpperCase(),
            exp: q.exp || '', exp_kn: q.exp_kn || '', subject: q.subject || '',
            image_url: q.image_url || '',
            contentType: q.contentType === 'ca' ? 'ca' : 'static',
            relevantPeriod: q.relevantPeriod || '',
            relevantUntil: q.relevantUntil || '',
            askedInYears: Array.isArray(q.askedInYears) ? q.askedInYears : [],
            retired: !!q.retired,
            // Carry forward the bank-generation lineage tag, if any (see studioGenerateFromBank) — without
            // this, simply opening a generated paper to fix a typo and republishing would silently drop
            // the tag and let the duplicate resurface in the Topic Builder.
            ...(q.sourceQuestionId ? { sourceQuestionId: q.sourceQuestionId } : {})
          }));
        }
      }
      document.getElementById('studio-mode-label').innerText =
        studioState.mode === 'edit' ? 'Editing paper' :
        studioState.mode === 'duplicate' ? 'Duplicating paper' : 'New paper';

      studioSetInputMode('csv');
      studioSetLangMode('en');
      studioRenderList();
      document.getElementById('view-studio').classList.remove('hidden');
    }

    function closeStudio() {
      if (studioState && studioState.questions.length && !confirm('Close the studio?\n\nAny changes since your last "Save draft" will be lost. Click Cancel to go back and save a draft first.')) return;
      document.getElementById('view-studio').classList.add('hidden');
      studioState = null;
    }

    function studioApplyCategoryDefaults(cat) {
      const def = EXAM_CATEGORIES[cat] && EXAM_CATEGORIES[cat].defaultScheme;
      if (!def) return;
      // Only apply defaults if the current values look untouched (avoid overwriting explicit edits)
      const mc = document.getElementById('studio-mark-correct');
      const mw = document.getElementById('studio-mark-wrong');
      const dur = document.getElementById('studio-duration');
      const cut = document.getElementById('studio-cutoff');
      // If they're all still defaults from another category, replace; otherwise leave alone
      if (mc && !mc.dataset.touched) mc.value = def.marksCorrect;
      if (mw && !mw.dataset.touched) mw.value = def.marksWrong;
      if (dur && !dur.dataset.touched) dur.value = def.duration;
      if (cut && !cut.dataset.touched) cut.value = def.cutoff;
    }

    // Rebuilds the "Also show in" checkbox list, always excluding whatever is currently the primary
    // Category (no point letting a paper be cross-listed against itself). Pass `preselect` to force
    // which extra categories start checked (used when loading an existing paper); omit it to keep
    // whatever the admin already had checked (used when they just switch the primary Category).
    function studioRefreshExtraCategoryOptions(preselect) {
      const primary = document.getElementById('studio-category').value;
      const selected = preselect || [...document.querySelectorAll('.studio-extracat-cb:checked')].map(cb => cb.value);
      // Admin-only backend control — deactivated categories stay selectable here too (see
      // populateCategoryDropdown for the same fix/rationale), marked so the admin knows.
      const items = Object.values(EXAM_CATEGORIES)
        .filter(c => c.id !== primary)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(c => ({ value: c.id, label: escapeHtml(c.name) + (c.active === false ? ' (hidden from students)' : '') }));
      checkboxList('studio-extra-categories', items, selected.filter(v => v !== primary), 'studio-extracat-cb');
    }

    // Rebuilds the "Also list as its own paper" checkbox list — same shape as the question-bank one
    // above, but a SEPARATE, independently-checked field (also_list_categories / alsoListCategories).
    // BUG FIX: these two used to be the same single field (extraCategories), which meant tagging a
    // paper as question-bank-applicable to another exam silently also cross-listed the whole paper as
    // its own purchasable card there AND extended entitlement to it via bundleCoversPaper — neither of
    // which the admin necessarily intended. Now fully independent; this one defaults to nothing checked.
    function studioRefreshAlsoListCategoryOptions(preselect) {
      const primary = document.getElementById('studio-category').value;
      const selected = preselect || [...document.querySelectorAll('.studio-alsolist-cb:checked')].map(cb => cb.value);
      const items = Object.values(EXAM_CATEGORIES)
        .filter(c => c.id !== primary)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(c => ({ value: c.id, label: escapeHtml(c.name) + (c.active === false ? ' (hidden from students)' : '') }));
      checkboxList('studio-also-list-categories', items, selected.filter(v => v !== primary), 'studio-alsolist-cb');
    }

    function studioSetInputMode(mode) {
      studioInputMode = mode;
      ['csv', 'paste', 'manual', 'bank'].forEach(m => {
        document.getElementById(`studio-input-${m}`).classList.toggle('hidden', m !== mode);
        document.getElementById(`studio-tab-${m}`).classList.toggle('active', m === mode);
      });
      if (mode === 'bank') {
        const cat = document.getElementById('studio-category').value;
        document.getElementById('studio-bank-category-name').innerText = categoryDisplayName(cat);
      }
    }

    // ---- Generate from Question Bank (static, one-time sample by subject) ----
    // Scans every paper that feeds this category's question bank (its own papers, plus anything
    // cross-tagged via extraCategories) — the same scope getQuestionBank() uses for the
    // student-facing Topic Builder, but WITHOUT its student-only filters: isTestUnlockedForUser
    // (entitlement) and active status. This is an admin authoring tool: an inactive/draft paper is
    // exactly where an admin stages questions before ever publishing them, and requiring the source
    // paper to already be live would defeat that (previously this scan DID require active !== false,
    // which is the bug behind "I tagged an inactive paper for the bank and its questions didn't show
    // up until I made it live" — fixed by dropping that check here). Retired questions (see
    // retireQuestion) ARE excluded — a stale current-affairs question shouldn't get re-sampled into a
    // brand new paper any more than it should surface in the live Topic Builder.
    async function studioScanQuestionBank() {
      const cat = document.getElementById('studio-category').value;
      const status = document.getElementById('studio-bank-scan-status');
      status.innerText = 'Scanning…';
      const candidatePapers = testsCatalog.filter(p =>
        (p.category === cat || (p.extraCategories || []).includes(cat)));
      await Promise.all(candidatePapers.map(ensurePaperQuestionsLoaded));
      studioBankPool = [];
      candidatePapers.forEach(p => {
        (p.questions || []).forEach(q => {
          if (q.retired) return;
          if (isCaLapsedPendingReview(q)) return;
          studioBankPool.push({
            paperId: p.id, paperTitle: p.title, q, subject: subjectOf(q),
            contentType: q.contentType === 'ca' ? 'ca' : 'static',
            isPyq: Array.isArray(q.askedInYears) && q.askedInYears.length > 0
          });
        });
      });
      status.innerText = `${studioBankPool.length} question${studioBankPool.length === 1 ? '' : 's'} found across ${candidatePapers.length} paper(s).`;
      renderStudioBankSubjectRows();
    }

    // Groups the last scan's pool by subject, then by Static/CA within each subject — the shape both
    // renderStudioBankSubjectRows and studioGenerateFromBank build on.
    function studioBankBySubjectAndType() {
      const bySubject = {};
      studioBankPool.forEach(b => {
        const row = bySubject[b.subject] = bySubject[b.subject] || { static: [], ca: [] };
        row[b.contentType].push(b);
      });
      return bySubject;
    }

    function renderStudioBankSubjectRows() {
      const root = document.getElementById('studio-bank-subject-rows');
      const genRow = document.getElementById('studio-bank-generate-row');
      const suggestRow = document.getElementById('studio-bank-suggest-row');
      if (!studioBankPool.length) {
        root.innerHTML = '<p class="text-[11px] text-slate-400">No questions found yet — tag some papers to feed this category\'s bank (the "Feeds the question bank of" field in this sidebar), or upload directly into this category, then scan again.</p>';
        genRow.classList.add('hidden');
        suggestRow.classList.add('hidden');
        return;
      }
      const cat = document.getElementById('studio-category').value;
      const bySubject = studioBankBySubjectAndType();
      const subjects = Object.keys(bySubject).sort((a, b) => a.localeCompare(b));
      root.innerHTML = subjects.map(s => {
        const { static: staticPool, ca: caPool } = bySubject[s];
        const staticPyq = staticPool.filter(b => b.isPyq).length;
        const caPyq = caPool.filter(b => b.isPyq).length;
        return `
        <div class="border border-slate-200 rounded-lg p-2" data-bank-subject-row="${escapeHtml(s)}">
          <div class="flex items-center gap-2 text-xs mb-1.5">
            <span class="flex-1 font-bold text-slate-700">${escapeHtml(s)}</span>
            <span class="text-slate-400" title="Importance weight — set per-subject in Exam Categories admin → Subjects">Weight ${subjectWeight(cat, s)}/5</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="flex items-center gap-1.5">
              <span class="w-16 text-slate-500 shrink-0">📖 Static</span>
              <span class="text-slate-400 shrink-0">(${staticPool.length}${staticPyq ? `, ⭐${staticPyq}` : ''})</span>
              <input type="number" min="0" max="${staticPool.length}" value="0" data-bank-subject="${escapeHtml(s)}" data-bank-type="static" oninput="studioUpdateBankTotal()" class="w-16 px-2 py-1 border rounded-lg font-mono text-right" />
            </label>
            <label class="flex items-center gap-1.5">
              <span class="w-16 text-slate-500 shrink-0">📰 CA</span>
              <span class="text-slate-400 shrink-0">(${caPool.length}${caPyq ? `, ⭐${caPyq}` : ''})</span>
              <input type="number" min="0" max="${caPool.length}" value="0" data-bank-subject="${escapeHtml(s)}" data-bank-type="ca" oninput="studioUpdateBankTotal()" class="w-16 px-2 py-1 border rounded-lg font-mono text-right" />
            </label>
          </div>
        </div>`;
      }).join('');
      genRow.classList.remove('hidden');
      suggestRow.classList.remove('hidden');
      studioUpdateBankTotal();
    }

    function studioUpdateBankTotal() {
      const total = [...document.querySelectorAll('[data-bank-subject]')].reduce((sum, el) => sum + (parseInt(el.value, 10) || 0), 0);
      document.getElementById('studio-bank-total').innerText = total;
    }

    // Splits a desired `total` between two capped buckets (Static/CA) roughly according to `bRatio`
    // (0-1, the share that should go to bucket B), then tops each bucket up from the other's spare
    // capacity if one runs out — so the requested total is still hit whenever the combined pool allows
    // it, rather than silently under-filling just because the mix ratio didn't fit one bucket exactly.
    function splitWithCaps(total, aAvail, bAvail, bRatio) {
      let b = Math.min(Math.round(total * bRatio), bAvail);
      let a = Math.min(total - b, aAvail);
      const shortfall = (total - a - b);
      if (shortfall > 0) {
        const moreB = Math.min(shortfall, bAvail - b);
        b += moreB;
        const stillShort = shortfall - moreB;
        if (stillShort > 0) a = Math.min(a + stillShort, aAvail);
      }
      return { a, b };
    }

    // Pre-fills every subject's Static/CA count inputs proportional to (a) how much of the target
    // total that subject's importance weight earns it relative to every other subject with any
    // availability, and (b) the requested Current Affairs mix %. Purely a starting point — every
    // number is a plain input the admin can still hand-edit before generating, same as before this
    // existed (leaving Target total blank/0 leaves every count at 0, exactly like the original version
    // of this tool).
    function studioSuggestBankCounts() {
      const target = parseInt(document.getElementById('studio-bank-target-total').value, 10) || 0;
      const caMix = Math.max(0, Math.min(100, parseInt(document.getElementById('studio-bank-ca-mix').value, 10) || 0)) / 100;
      if (!target) return;
      const cat = document.getElementById('studio-category').value;
      const bySubject = studioBankBySubjectAndType();
      const subjects = Object.keys(bySubject);
      const totalWeight = subjects.reduce((sum, s) => {
        const avail = bySubject[s].static.length + bySubject[s].ca.length;
        return sum + (avail > 0 ? subjectWeight(cat, s) : 0);
      }, 0);
      if (!totalWeight) return;
      subjects.forEach(s => {
        const { static: staticPool, ca: caPool } = bySubject[s];
        const avail = staticPool.length + caPool.length;
        if (!avail) return;
        const share = Math.min(Math.round(target * subjectWeight(cat, s) / totalWeight), avail);
        const { a: staticCount, b: caCount } = splitWithCaps(share, staticPool.length, caPool.length, caMix);
        const staticInput = [...document.querySelectorAll('[data-bank-subject][data-bank-type="static"]')].find(el => el.dataset.bankSubject === s);
        const caInput = [...document.querySelectorAll('[data-bank-subject][data-bank-type="ca"]')].find(el => el.dataset.bankSubject === s);
        if (staticInput) staticInput.value = staticCount;
        if (caInput) caInput.value = caCount;
      });
      studioUpdateBankTotal();
    }

    // ---- Avoid repeating a question across a bundle's other papers ----
    // "The bundle's papers" isn't a stored reverse-lookup -- only an explicit `bundle.papers` list is
    // a bounded, deliberate set of papers (a curated test series); a category-wide or all-access
    // bundle resolves to every paper in that scope, which is both far too broad for a meaningful
    // per-paper check and usually not what "repeats across the bundle" means to the admin building a
    // series. So this only ever offers bundles with a real `papers` list, same rationale as the
    // explicit-only decision documented when this feature was scoped.
    function studioRefreshBundleCheckOptions() {
      const sel = document.getElementById('studio-bundle-check');
      if (!sel) return;
      const eligible = (bundles || []).filter(b => Array.isArray(b.papers) && b.papers.length);
      sel.innerHTML = '<option value="">— none selected —</option>' +
        eligible.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${b.papers.length} paper${b.papers.length === 1 ? '' : 's'})</option>`).join('');
      document.getElementById('studio-bank-exclude-bundle-dup').checked = false;
    }

    // Every OTHER paper the selected bundle explicitly lists (never this paper itself, relevant when
    // editing/duplicating an already-published member of the bundle).
    function studioBundleSiblingPapers(bundleId) {
      const b = getBundle(bundleId);
      if (!b || !Array.isArray(b.papers)) return [];
      const selfId = studioState.originalId || null;
      return testsCatalog.filter(p => b.papers.includes(p.id) && p.id !== selfId);
    }

    // Is `q` already present in one of `otherPapers`? Two signals, since there's no identity key
    // reliably shared across every authoring path (see the sourceQuestionId note in the file header):
    // an exact bank-lineage match (both copies trace back to the same original bank question) first,
    // then the same word-overlap similarity check used for CSV-ingest duplicate warnings, which also
    // catches two independently-typed or independently-pasted copies of the same question that share
    // no id at all.
    function studioFindBundleMatch(q, otherPapers) {
      const rootId = q.sourceQuestionId || null;
      const tokens = q.q_en ? studioSimilarityTokens(q.q_en) : new Set();
      for (const p of otherPapers) {
        for (const other of (p.questions || [])) {
          if (rootId && other.sourceQuestionId && other.sourceQuestionId === rootId) {
            return { paper: p, text: other.q_en, score: 1, reason: 'same bank question' };
          }
          if (tokens.size >= STUDIO_DUP_MIN_WORDS && other.q_en) {
            const score = studioJaccard(tokens, studioSimilarityTokens(other.q_en));
            if (score >= STUDIO_DUP_THRESHOLD) return { paper: p, text: other.q_en, score, reason: 'similar text' };
          }
        }
      }
      return null;
    }

    // Manual, on-demand audit — covers questions added ANY way (manual, CSV/paste, or bank-generated),
    // unlike the bank-generation exclusion below which only ever prevents NEW bank picks from
    // repeating. Warns only, same posture as every other duplicate check in Studio: a false positive
    // here costs a glance, and the admin is always the one who decides whether to edit or delete.
    async function studioCheckBundleDuplicates() {
      const bundleId = (document.getElementById('studio-bundle-check') || {}).value;
      if (!bundleId) return alert('Pick a bundle to check against first.');
      const b = getBundle(bundleId);
      const siblings = studioBundleSiblingPapers(bundleId);
      if (!siblings.length) return alert(`"${b ? b.name : bundleId}" has no other papers to compare against yet.`);
      await Promise.all(siblings.map(ensurePaperQuestionsLoaded));
      const hits = [];
      studioState.questions.forEach(q => {
        const match = studioFindBundleMatch(q, siblings);
        if (match) hits.push({ q, match });
      });
      if (!hits.length) {
        return alert(`✓ No repeats found — none of this paper's ${studioState.questions.length} question(s) match anything in "${b.name}"'s other ${siblings.length} paper(s).`);
      }
      const lines = hits.slice(0, 10).map(({ q, match }) =>
        `• "${(q.q_en || '(no English text)').slice(0, 80)}"\n   ${Math.round(match.score * 100)}% match (${match.reason}) in "${match.paper.title}": "${(match.text || '').slice(0, 80)}"`
      ).join('\n');
      alert(`⚠️ ${hits.length} question${hits.length === 1 ? '' : 's'} in this paper look like repeats from elsewhere in "${b.name}":\n\n${lines}` +
        (hits.length > 10 ? `\n…and ${hits.length - 10} more.` : '') +
        `\n\nNothing was changed — review and edit/delete as needed, then re-check.`);
    }

    async function studioGenerateFromBank() {
      // Preload the bundle's other papers up front (one await) rather than inside the per-subject
      // sampling loop below, so the loop itself stays synchronous and easy to follow.
      const excludeBundleDup = document.getElementById('studio-bank-exclude-bundle-dup').checked;
      const bundleId = (document.getElementById('studio-bundle-check') || {}).value;
      let siblings = [];
      if (excludeBundleDup && bundleId) {
        siblings = studioBundleSiblingPapers(bundleId);
        await Promise.all(siblings.map(ensurePaperQuestionsLoaded));
      }
      const bySubject = studioBankBySubjectAndType();
      const prioritizePyq = document.getElementById('studio-bank-prioritize-pyq').checked;
      const rows = [...document.querySelectorAll('[data-bank-subject]')];
      let added = 0, skippedAsBundleDup = 0;
      const difficultyCounts = {}, typeCounts = { static: 0, ca: 0 };
      rows.forEach(el => {
        const subject = el.dataset.bankSubject, type = el.dataset.bankType;
        const want = parseInt(el.value, 10) || 0;
        if (!want) return;
        let pool = ((bySubject[subject] || {})[type] || []).slice();
        if (siblings.length) {
          const before = pool.length;
          pool = pool.filter(b => !studioFindBundleMatch(b.q, siblings));
          skippedAsBundleDup += before - pool.length;
        }
        // Sampling without replacement, PYQ-first when requested: shuffle the "asked before" and
        // "never asked" questions separately, then take PYQ ones first up to `want` before falling
        // back to the rest — so a generation that asks for fewer questions than are PYQ-tagged still
        // fills entirely from proven, previously-asked content.
        const ordered = prioritizePyq
          ? [...shuffle(pool.filter(b => b.isPyq)), ...shuffle(pool.filter(b => !b.isPyq))]
          : shuffle(pool);
        ordered.slice(0, Math.min(want, ordered.length)).forEach(b => {
          // Deep clone: this generated paper's copy is now independent of the source paper — editing
          // or deleting the source later never silently changes an already-generated paper.
          const q = JSON.parse(JSON.stringify(b.q));
          q.id = studioState.questions.length + 1;
          // Tag this copy with where it originally came from, so getQuestionBank() can tell it's the
          // SAME underlying question as its source rather than new content, and not show both to a
          // student in the same category's Topic Builder (see getQuestionBank() for the dedupe logic).
          // If the source question was itself already a bank-generated copy (chained generation), carry
          // its ORIGINAL root id forward rather than pointing at the intermediate copy, so the lineage
          // always resolves back to one true origin no matter how many times it's been re-sampled.
          q.sourceQuestionId = b.q.sourceQuestionId || `${b.paperId}::${b.q.id}`;
          studioState.questions.push(q);
          added++;
          typeCounts[type]++;
          const d = Number.isInteger(q.difficulty) ? q.difficulty : 'unrated';
          difficultyCounts[d] = (difficultyCounts[d] || 0) + 1;
        });
      });
      if (!added) {
        return alert(skippedAsBundleDup
          ? `All ${skippedAsBundleDup} matching question(s) in the subjects you picked were already used elsewhere in the bundle, so none were added. Try different subjects/counts, or turn off the bundle-skip checkbox to allow repeats.`
          : 'Set a count greater than 0 for at least one subject first.');
      }
      studioRenumber();
      studioRenderList();
      studioSetInputMode('manual'); // switch to reviewing the generated list, same as any other add path
      const diffSummary = Object.keys(difficultyCounts).sort().map(d => `${d === 'unrated' ? 'Unrated' : 'Lvl ' + d}: ${difficultyCounts[d]}`).join(', ');
      const bundleNote = skippedAsBundleDup ? `\n🔁 Skipped ${skippedAsBundleDup} question(s) already used elsewhere in the selected bundle.` : '';
      alert(`${added} question${added === 1 ? '' : 's'} generated from the bank (Static: ${typeCounts.static}, Current Affairs: ${typeCounts.ca}).\nDifficulty mix — ${diffSummary}.${bundleNote}\n\nReview them below — you can edit or delete any of them — then Publish when ready.`);
    }

    function studioSetLangMode(mode) {
      studioLangMode = mode;
      ['en', 'kn', 'both'].forEach(m => {
        document.getElementById(`studio-lang-${m}`).classList.toggle('active', m === mode);
      });
      studioRenderList();
    }

    // ---- Ingest: CSV file ----
    function studioIngestCsvFile(input) {
      if (!input.files || !input.files[0]) return;
      Papa.parse(input.files[0], {
        header: true, skipEmptyLines: true,
        complete: (res) => studioIngestParsed(res.meta.fields || [], res.data),
        error: (err) => alert('CSV parse failed: ' + err.message)
      });
      input.value = ''; // allow re-selecting the same file
    }

    // ---- Ingest: pasted spreadsheet text ----
    function studioIngestPasted() {
      const txt = document.getElementById('studio-paste-box').value.trim();
      if (!txt) return alert('Paste some rows first.');
      // Auto-detect delimiter: prefer tab (from Excel), fall back to comma
      const firstLine = txt.split(/\r?\n/, 1)[0];
      const delim = firstLine.includes('\t') ? '\t' : ',';
      const res = Papa.parse(txt, { header: true, skipEmptyLines: true, delimiter: delim });
      if (!res.data || !res.data.length) return alert("Couldn't find any rows to import.");
      studioIngestParsed(res.meta.fields || [], res.data);
      document.getElementById('studio-paste-box').value = '';
    }

    // ---- Ingest: map headers, then add to studioState.questions ----
    function studioIngestParsed(headers, rows) {
      const mapping = {}; // headerName → canonicalField or '_unknown'
      const unknown = [];
      headers.forEach(h => {
        if (!h) return;
        const norm = studioNormalizeHeader(h);
        if (STUDIO_HEADER_ALIASES[norm]) mapping[h] = STUDIO_HEADER_ALIASES[norm];
        else { mapping[h] = '_unknown'; unknown.push(h); }
      });
      // If everything mapped, ingest immediately. Otherwise ask admin.
      if (!unknown.length) return studioApplyMappingAndAdd(mapping, rows);

      studioPendingMapping = { headers, mapping, rows };
      const box = document.getElementById('studio-mapping-panel');
      const list = document.getElementById('studio-mapping-rows');
      list.innerHTML = unknown.map(h => `
        <div class="flex items-center gap-2">
          <span class="font-mono text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded">${escapeHtml(h)}</span>
          <span class="text-slate-500">→</span>
          <select data-map-header="${escapeHtml(h)}" class="px-2 py-1 border rounded bg-white outline-none flex-1">
            <option value="_ignore">— Ignore this column —</option>
            ${Object.entries(STUDIO_FIELD_LABELS).filter(([k]) => k !== '_ignore').map(([k, lbl]) => `<option value="${k}">${escapeHtml(lbl)}</option>`).join('')}
          </select>
        </div>
      `).join('');
      box.classList.remove('hidden');
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function studioApplyMapping() {
      if (!studioPendingMapping) return;
      document.querySelectorAll('[data-map-header]').forEach(sel => {
        const h = sel.dataset.mapHeader;
        studioPendingMapping.mapping[h] = sel.value;
      });
      studioApplyMappingAndAdd(studioPendingMapping.mapping, studioPendingMapping.rows);
      studioPendingMapping = null;
      document.getElementById('studio-mapping-panel').classList.add('hidden');
    }

    // ---- Near-duplicate detection at ingestion (warns, never blocks) ----
    // A cheap, dependency-free proxy for "this is probably the same question reworded": word-set
    // Jaccard overlap on the English question text. Good enough to flag for a human glance; a false
    // positive costs a second of reading, a false negative loses nothing this feature didn't already
    // not have. Only ever surfaced as a warning alongside the normal "N questions added" message —
    // it never removes a row or stops an upload, matching how `retired` and the coverage dashboard
    // elsewhere in Studio flag things for the admin to judge rather than deciding for them.
    const STUDIO_DUP_THRESHOLD = 0.6;
    const STUDIO_DUP_MIN_WORDS = 5; // shorter questions collide on word overlap by chance too often to be useful
    function studioSimilarityTokens(text) {
      return new Set(String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    }
    function studioJaccard(setA, setB) {
      if (!setA.size || !setB.size) return 0;
      let inter = 0;
      setA.forEach(w => { if (setB.has(w)) inter++; });
      return inter / (setA.size + setB.size - inter);
    }
    // Compares each newly-added row against: (a) questions already in this paper's draft, (b) the
    // existing question bank for this category (best-effort — only papers already loaded into
    // testsCatalog are visible to getQuestionBank(), same limitation the live bank itself has), and
    // (c) earlier rows in this same upload, so an accidentally duplicated CSV row is caught too.
    function studioFindNearDuplicates(newlyAdded, preExisting, bankPool) {
      const candidates = [
        ...preExisting.map(q => ({ text: q.q_en, source: 'already in this paper' })),
        ...bankPool.map(b => ({ text: b.q.q_en, source: `question bank (${b.subject || 'no subject'})` }))
      ].filter(c => c.text && c.text.trim()).map(c => ({ ...c, tokens: studioSimilarityTokens(c.text) }));
      const warnings = [];
      newlyAdded.forEach((q, idx) => {
        if (!q.q_en || !q.q_en.trim()) return;
        const tokens = studioSimilarityTokens(q.q_en);
        if (tokens.size < STUDIO_DUP_MIN_WORDS) return;
        let best = null;
        candidates.forEach(c => {
          const score = studioJaccard(tokens, c.tokens);
          if (score >= STUDIO_DUP_THRESHOLD && (!best || score > best.score)) best = { score, text: c.text, source: c.source };
        });
        for (let j = 0; j < idx; j++) {
          const other = newlyAdded[j];
          if (!other.q_en || !other.q_en.trim()) continue;
          const otherTokens = studioSimilarityTokens(other.q_en);
          if (otherTokens.size < STUDIO_DUP_MIN_WORDS) continue;
          const score = studioJaccard(tokens, otherTokens);
          if (score >= STUDIO_DUP_THRESHOLD && (!best || score > best.score)) best = { score, text: other.q_en, source: 'this same upload' };
        }
        if (best) warnings.push({ newText: q.q_en, matchText: best.text, source: best.source, score: best.score });
      });
      return warnings;
    }

    function studioApplyMappingAndAdd(mapping, rows) {
      const startId = studioState.questions.length + 1;
      const category = (document.getElementById('studio-category') || {}).value || '';
      const seenSubjects = new Set();
      const preExistingForDupCheck = studioState.questions.slice();
      const bankPoolForDupCheck = category ? getQuestionBank().filter(b => b.category === category) : [];
      const newlyAddedForDupCheck = [];
      let added = 0;
      rows.forEach((row, i) => {
        const q = { id: startId + i, q_en: '', q_kn: '', options_en: ['', '', '', ''], options_kn: ['', '', '', ''], correct: 'A', exp: '', exp_kn: '', subject: '', difficulty: null, image_url: '', contentType: 'static', relevantPeriod: '', relevantUntil: '', askedInYears: [] };
        for (const [colName, field] of Object.entries(mapping)) {
          const val = row[colName];
          if (val == null || field === '_unknown' || field === '_ignore') continue;
          if (field === 'q_en') q.q_en = String(val).trim();
          else if (field === 'q_kn') q.q_kn = String(val).trim();
          else if (field === 'a_en') q.options_en[0] = String(val).trim();
          else if (field === 'b_en') q.options_en[1] = String(val).trim();
          else if (field === 'c_en') q.options_en[2] = String(val).trim();
          else if (field === 'd_en') q.options_en[3] = String(val).trim();
          else if (field === 'a_kn') q.options_kn[0] = String(val).trim();
          else if (field === 'b_kn') q.options_kn[1] = String(val).trim();
          else if (field === 'c_kn') q.options_kn[2] = String(val).trim();
          else if (field === 'd_kn') q.options_kn[3] = String(val).trim();
          else if (field === 'correct') {
            // FIX: was `.charAt(0)` on the trimmed/uppercased value, which grabbed the wrong
            // character for common real-world formats like "(A)", "A)", "Option A" — any of these
            // would produce something other than a clean A-D letter and get flagged as broken,
            // potentially for EVERY row in a sheet (matching "shows 100 broken questions despite a
            // proper file"). Strips known wrapper noise (parens, dots, "Option"/"Opt" prefixes,
            // whitespace) and only accepts the result if it's then EXACTLY one clean A-D letter —
            // deliberately does NOT search for a letter buried inside a longer word/phrase (e.g. if
            // the column actually contains full answer text like "Bengaluru"), since guessing wrong
            // there would silently mis-score a question instead of correctly flagging it as broken.
            const raw = String(val).trim().toUpperCase();
            const stripped = raw.replace(/^(OPTION|OPT)\.?\s*/i, '').replace(/[().\s]/g, '');
            q.correct = /^[ABCD]$/.test(stripped) ? stripped : raw.charAt(0);
          }
          else if (field === 'exp') q.exp = String(val).trim();
          else if (field === 'exp_kn') q.exp_kn = String(val).trim();
          else if (field === 'subject') {
            // Canonicalize against the registry (case/whitespace-insensitive match) so "polity" and
            // "Polity" from different uploads collapse onto one canonical spelling automatically; a
            // genuinely new subject is kept as typed and queued to be registered below, rather than
            // being silently dropped or blocking the upload.
            q.subject = category ? canonicalizeSubject(category, String(val).trim()) : String(val).trim();
            if (q.subject) seenSubjects.add(q.subject);
          }
          else if (field === 'difficulty') {
            const n = parseInt(String(val).trim(), 10);
            q.difficulty = (Number.isInteger(n) && n >= 1 && n <= 5) ? n : null;
          }
          else if (field === 'image_url') q.image_url = String(val).trim();
          else if (field === 'contentType') {
            // Strip spaces/hyphens before matching so "Current Affairs" (the column's own sample
            // value in the downloadable template) normalizes the same as "CurrentAffairs" or "CA" —
            // without this, the template's own sample row silently ingested as 'static'.
            const raw = String(val).trim().toLowerCase().replace(/[\s-]+/g, '');
            q.contentType = /^(ca|current|currentaffairs|dynamic|c)$/.test(raw) ? 'ca' : 'static';
          }
          else if (field === 'relevantPeriod') q.relevantPeriod = String(val).trim();
          else if (field === 'relevantUntil') {
            const raw = String(val).trim();
            q.relevantUntil = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
          }
          else if (field === 'askedInYears') {
            // Accept any of "2018, 2021, 2023" / "2018 2021 2023" / "2018;2021" — split on anything
            // that isn't a run of digits, keep 4-digit-looking tokens, drop the rest silently rather
            // than blocking the whole row over one malformed cell.
            q.askedInYears = String(val).split(/[^0-9]+/).map(s => s.trim()).filter(s => /^(19|20)\d{2}$/.test(s));
          }
        }
        // Skip completely blank rows
        if (!q.q_en && !q.q_kn && !q.options_en.some(Boolean)) return;
        // Every CA question gets a one-year relevance window by default -- only fill it in when the
        // sheet didn't already specify one, so an admin's explicit date (e.g. re-uploading an edited
        // export) is never overwritten.
        if (q.contentType === 'ca' && !q.relevantUntil) q.relevantUntil = studioDefaultRelevantUntil();
        studioState.questions.push(q);
        newlyAddedForDupCheck.push(q);
        added++;
      });
      studioRenumber();
      studioRenderList();
      if (category) registerSubjectsIfNew(category, [...seenSubjects]);
      const dupWarnings = studioFindNearDuplicates(newlyAddedForDupCheck, preExistingForDupCheck, bankPoolForDupCheck);
      let msg = `${added} question${added === 1 ? '' : 's'} added. Total now ${studioState.questions.length}.`;
      if (dupWarnings.length) {
        msg += `\n\n⚠️ ${dupWarnings.length} possible near-duplicate${dupWarnings.length === 1 ? '' : 's'} — review before publishing:\n` +
          dupWarnings.slice(0, 8).map(w => `• "${w.newText.slice(0, 80)}"\n   ~${Math.round(w.score * 100)}% similar to ${w.source}: "${w.matchText.slice(0, 80)}"`).join('\n') +
          (dupWarnings.length > 8 ? `\n…and ${dupWarnings.length - 8} more.` : '');
      }
      alert(msg);
    }

    // Exact header row the CSV upload path round-trips cleanly (every one of these names is a key
    // in STUDIO_HEADER_ALIASES above) -- used by both the blank sample template and the real
    // paper-export functions below, so a downloaded paper always re-uploads without a remapping step.
    const STUDIO_CSV_HEADERS = ['Question_EN', 'Question_KN', 'Opt_A_EN', 'Opt_B_EN', 'Opt_C_EN', 'Opt_D_EN', 'Opt_A_KN', 'Opt_B_KN', 'Opt_C_KN', 'Opt_D_KN', 'Correct', 'Explanation', 'Explanation_KN', 'Subject', 'Difficulty', 'Type', 'Relevant_Period', 'Asked_In_Years', 'Image_URL', 'Relevant_Until'];

    function studioRowsToCsv(rows) {
      return rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    function studioTriggerCsvDownload(csvText, filename) {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }

    // Turns a paper's (or studioState's) question objects back into the same CSV shape the upload
    // path expects -- lets an admin download a published paper, fix a typo/mistagged subject/wrong
    // answer key in a spreadsheet, and re-upload the corrected CSV via "New paper (guided studio)"
    // rather than hand-editing each question through the UI one at a time.
    function studioQuestionsToCsv(questions) {
      const rows = (questions || []).map(q => {
        const optsEn = Array.isArray(q.options_en) ? q.options_en : [];
        const optsKn = Array.isArray(q.options_kn) ? q.options_kn : [];
        const years = Array.isArray(q.askedInYears) ? q.askedInYears.join(', ') : '';
        const difficulty = (Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 5) ? q.difficulty : '';
        return [
          q.q_en || '', q.q_kn || '',
          optsEn[0] || '', optsEn[1] || '', optsEn[2] || '', optsEn[3] || '',
          optsKn[0] || '', optsKn[1] || '', optsKn[2] || '', optsKn[3] || '',
          (q.correct || '').toUpperCase(),
          q.exp || '', q.exp_kn || '',
          q.subject || '',
          difficulty,
          q.contentType === 'ca' ? 'Current Affairs' : 'Static',
          q.relevantPeriod || '',
          years,
          q.image_url || '',
          q.relevantUntil || ''
        ];
      });
      return studioRowsToCsv([STUDIO_CSV_HEADERS, ...rows]);
    }

    // Turns a title into a safe filename: letters/digits/spaces only, collapsed to underscores.
    function studioFilenameFromTitle(title) {
      return (String(title || '').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'paper');
    }

    function studioDownloadTemplate() {
      const sample = [
        STUDIO_CSV_HEADERS,
        ['Which article of the Indian Constitution deals with Fundamental Duties?', 'ಭಾರತೀಯ ಸಂವಿಧಾನದ ಯಾವ ಆರ್ಟಿಕಲ್ ಮೂಲಭೂತ ಕರ್ತವ್ಯಗಳ ಬಗ್ಗೆ ಇದೆ?', 'Article 51A', 'Article 32', 'Article 21', 'Article 14', 'ಆರ್ಟಿಕಲ್ 51A', 'ಆರ್ಟಿಕಲ್ 32', 'ಆರ್ಟಿಕಲ್ 21', 'ಆರ್ಟಿಕಲ್ 14', 'A', 'Article 51A was added by the 42nd Amendment (1976).', 'ಆರ್ಟಿಕಲ್ 51A ಅನ್ನು 42ನೇ ತಿದ್ದುಪಡಿಯ (1976) ಮೂಲಕ ಸೇರಿಸಲಾಯಿತು.', 'Polity', '2', 'Static', '', '2018, 2021, 2023', '', ''],
        ['The capital of Karnataka is:', 'ಕರ್ನಾಟಕದ ರಾಜಧಾನಿ:', 'Mysuru', 'Bengaluru', 'Hubballi', 'Mangaluru', 'ಮೈಸೂರು', 'ಬೆಂಗಳೂರು', 'ಹುಬ್ಬಳ್ಳಿ', 'ಮಂಗಳೂರು', 'B', 'Bengaluru has been the capital of Karnataka since the state was formed in 1956.', '1956ರಲ್ಲಿ ರಾಜ್ಯ ರಚನೆಯಾದಾಗಿನಿಂದ ಬೆಂಗಳೂರು ಕರ್ನಾಟಕದ ರಾಜಧಾನಿಯಾಗಿದೆ.', 'Geography', '1', 'Static', '', '', '', ''],
        ['Which state topped NITI Aayog\'s latest SDG India Index?', 'ಇತ್ತೀಚಿನ NITI ಆಯೋಗ್ SDG ಇಂಡಿಯಾ ಇಂಡೆಕ್ಸ್‌ನಲ್ಲಿ ಯಾವ ರಾಜ್ಯ ಅಗ್ರಸ್ಥಾನದಲ್ಲಿದೆ?', 'Kerala', 'Karnataka', 'Tamil Nadu', 'Punjab', 'ಕೇರಳ', 'ಕರ್ನಾಟಕ', 'ತಮಿಳುನಾಡು', 'ಪಂಜಾಬ್', 'A', 'Released by NITI Aayog; ranking current as of this edition of the index.', 'NITI ಆಯೋಗ್ ಬಿಡುಗಡೆ ಮಾಡಿದೆ; ಈ ಆವೃತ್ತಿಯ ಶ್ರೇಯಾಂಕ.', 'Current Affairs', '2', 'Current Affairs', 'Sep 2026', '', '', '2027-09-30']
      ];
      studioTriggerCsvDownload(studioRowsToCsv(sample), 'gritpro_question_template.csv');
    }

    // Exports whatever is currently open in the Studio editor -- works for a paper mid-edit (so an
    // admin can grab a CSV of their in-progress changes too), not just already-published ones.
    function studioDownloadCurrentCsv() {
      if (!studioState || !studioState.questions.length) return alert('No questions to export yet.');
      const title = (document.getElementById('studio-paper-title').value || '').trim();
      studioTriggerCsvDownload(studioQuestionsToCsv(studioState.questions), `${studioFilenameFromTitle(title)}.csv`);
    }

    function studioShowFormatHelp() { openModal('studio-help-modal'); }

    // ---- Add / clear / renumber ----
    function studioAddBlankQuestion() {
      const q = { id: studioState.questions.length + 1, q_en: '', q_kn: '', options_en: ['', '', '', ''], options_kn: ['', '', '', ''], correct: 'A', exp: '', exp_kn: '', subject: '', difficulty: null, image_url: '', contentType: 'static', relevantPeriod: '', relevantUntil: '', askedInYears: [], _isNew: true };
      studioState.questions.push(q);
      studioRenderList();
      // Open edit modal immediately for the new blank question
      studioEditQuestion(studioState.questions.length - 1);
    }

    function studioClearAll() {
      if (!studioState.questions.length) return;
      if (!confirm(`Remove all ${studioState.questions.length} questions from the studio? (The paper isn't saved until you Publish.)`)) return;
      studioState.questions = [];
      studioRenderList();
    }

    function studioRenumber() {
      studioState.questions.forEach((q, i) => { q.id = i + 1; });
    }

    // ---- Bulk actions ----
    function studioToggleAll(on) {
      document.querySelectorAll('.studio-row-cb').forEach(cb => { cb.checked = !!on; });
      studioUpdateBulkBar();
    }

    function studioUpdateBulkBar() {
      const sel = document.querySelectorAll('.studio-row-cb:checked').length;
      const bar = document.getElementById('studio-bulk-actions');
      bar.classList.toggle('hidden', sel === 0);
      bar.classList.toggle('flex', sel > 0);
      document.getElementById('studio-selected-count').innerText = `${sel} selected`;
    }

    function studioSelectedIndices() {
      return Array.from(document.querySelectorAll('.studio-row-cb:checked')).map(cb => parseInt(cb.dataset.i, 10));
    }

    function studioDeleteSelected() {
      const idxs = studioSelectedIndices().sort((a, b) => b - a);
      if (!idxs.length) return;
      if (!confirm(`Delete ${idxs.length} selected question${idxs.length === 1 ? '' : 's'}?`)) return;
      idxs.forEach(i => studioState.questions.splice(i, 1));
      studioRenumber();
      studioRenderList();
    }

    function studioDuplicateSelected() {
      const idxs = studioSelectedIndices();
      if (!idxs.length) return;
      idxs.forEach(i => {
        const orig = studioState.questions[i];
        const copy = JSON.parse(JSON.stringify(orig));
        delete copy._isNew;
        studioState.questions.push(copy);
      });
      studioRenumber();
      studioRenderList();
    }

    function studioCopyEnToKn(bulk) {
      const idxs = bulk ? studioSelectedIndices() : [studioEditingIndex];
      if (!idxs.length) return;
      let count = 0;
      idxs.forEach(i => {
        const q = studioState.questions[i];
        if (!q) return;
        if (!q.q_kn && q.q_en) { q.q_kn = q.q_en; count++; }
        q.options_en.forEach((opt, j) => {
          if (!q.options_kn[j] && opt) q.options_kn[j] = opt;
        });
      });
      studioRenderList();
      if (bulk) alert(`Copied EN → KN for ${count} question${count === 1 ? '' : 's'} (blank Kannada fields only — existing Kannada text was not overwritten).`);
    }

    // One-click fix for papers that were mistagged by the retired legacy upload form (which never
    // set contentType, so every one of its questions silently defaulted to "Static" even for
    // Current-Affairs papers). "Select all" + "Mark CA" relabels a whole paper in two clicks,
    // instead of opening each question's own edit modal to flip the Static/CA toggle one at a time.
    // Like every other bulk action here, this only updates the in-memory draft -- Publish still
    // has to be clicked to write it back to Supabase.
    function studioSetContentTypeSelected(type) {
      const idxs = studioSelectedIndices();
      if (!idxs.length) return;
      const label = type === 'ca' ? 'Current Affairs (CA)' : 'Static';
      if (!confirm(`Mark ${idxs.length} selected question${idxs.length === 1 ? '' : 's'} as ${label}?`)) return;
      idxs.forEach(i => {
        const q = studioState.questions[i];
        if (!q) return;
        q.contentType = type === 'ca' ? 'ca' : 'static';
        // relevantPeriod is documented as "CA only" -- clear it when a question stops being CA so
        // a stale period doesn't linger and mislead the Coverage dashboard after a re-tag.
        if (q.contentType !== 'ca') {
          q.relevantPeriod = '';
          q.relevantUntil = '';
        } else if (!q.relevantUntil) {
          // Newly marked CA and no relevance window set yet -- give it the standard one-year default
          // rather than leaving it blank (which would make it look "lapsed" immediately).
          q.relevantUntil = studioDefaultRelevantUntil();
        }
      });
      studioRenderList();
    }

    // ---- Question row rendering ----
    function studioRenderList() {
      const list = document.getElementById('studio-question-list');
      const qs = studioState.questions;
      document.getElementById('studio-qcount').innerText = `${qs.length} question${qs.length === 1 ? '' : 's'}`;
      // Language completeness stats
      const bothCount = qs.filter(q => q.q_en && q.q_kn && q.options_en.every(Boolean) && q.options_kn.every(Boolean)).length;
      const enOnly = qs.filter(q => q.q_en && q.options_en.every(Boolean) && !(q.q_kn && q.options_kn.every(Boolean))).length;
      const problems = qs.filter(q => studioQuestionProblem(q)).length;
      document.getElementById('studio-lang-stats').innerHTML = `
        <div>✅ Both languages complete: <b>${bothCount}</b></div>
        <div>🟡 English only: <b>${enOnly}</b></div>
        <div class="${problems ? 'text-rose-600' : ''}">⚠ With problems: <b>${problems}</b></div>
      `;

      if (!qs.length) {
        list.innerHTML = '<div class="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-2xl">No questions yet. Use the CSV, Paste or Add options above to get started.</div>';
        studioUpdateBulkBar();
        return;
      }
      list.innerHTML = qs.map((q, i) => studioRenderRow(q, i)).join('');
      // Wire checkbox change once
      list.querySelectorAll('.studio-row-cb').forEach(cb => cb.addEventListener('change', studioUpdateBulkBar));
      studioUpdateBulkBar();
    }

    function studioQuestionProblem(q) {
      if (!q.q_en && !q.q_kn) return 'No question text (English or Kannada)';
      if (!q.correct || !/^[A-D]$/.test(q.correct)) return 'Missing/invalid Correct letter (must be A/B/C/D)';
      const hasOpts = q.options_en.every(Boolean) || q.options_kn.every(Boolean);
      if (!hasOpts) return 'Missing at least one full set of 4 options';
      return null;
    }

    function studioRenderRow(q, i) {
      const problem = studioQuestionProblem(q);
      const hasBoth = q.q_en && q.q_kn && q.options_en.every(Boolean) && q.options_kn.every(Boolean);
      const hasEn = q.q_en && q.options_en.every(Boolean);
      const badge = hasBoth ? '<span class="qbadge badge-both">EN·KN</span>' : (hasEn ? '<span class="qbadge badge-en">EN only</span>' : '<span class="qbadge badge-none">Incomplete</span>');
      const cIdx = { A: 0, B: 1, C: 2, D: 3 }[q.correct] ?? 0;

      const rowClass = 'studio-qrow' + (problem ? ' error' : '');

      const renderCol = (lang) => {
        const qText = lang === 'en' ? q.q_en : q.q_kn;
        const opts = lang === 'en' ? q.options_en : q.options_kn;
        if (!qText && !opts.some(Boolean)) return `<div class="qtext text-slate-300 italic">(empty ${lang === 'en' ? 'English' : 'Kannada'})</div>`;
        return `
          <div class="qtext">${escapeHtml(qText || '(empty)')}</div>
          <div class="qopts">
            ${['A','B','C','D'].map((L, j) => `<span class="${j === cIdx ? 'correct' : ''}">${L}. ${escapeHtml(opts[j] || '—')}</span>`).join(' &nbsp;·&nbsp; ')}
          </div>
        `;
      };

      let body;
      if (studioLangMode === 'both') {
        body = `<div class="qbody"><div class="qboth"><div class="qcol">${renderCol('en')}</div><div class="qcol" style="font-family:'Noto Sans Kannada',sans-serif">${renderCol('kn')}</div></div>`;
      } else if (studioLangMode === 'kn') {
        body = `<div class="qbody" style="font-family:'Noto Sans Kannada',sans-serif">${renderCol('kn')}`;
      } else {
        body = `<div class="qbody">${renderCol('en')}`;
      }
      const askedCount = Array.isArray(q.askedInYears) ? q.askedInYears.length : 0;
      body += `<div class="qmeta">${badge}<span>Correct: <b>${escapeHtml(q.correct)}</b></span>${q.subject ? `<span>· ${escapeHtml(q.subject)}</span>` : ''}${q.difficulty ? `<span>· Lvl ${q.difficulty}/5</span>` : ''}${q.image_url ? '<span>· 🖼️ image</span>' : ''}${q.contentType === 'ca' ? `<span>· 📰 CA${q.relevantPeriod ? ` (${escapeHtml(q.relevantPeriod)})` : ''}</span>` : ''}${askedCount ? `<span>· ⭐ Asked ${askedCount}×</span>` : ''}${q.retired ? '<span class="text-rose-500">· 🚫 retired</span>' : ''}${problem ? `<div class="qerr">⚠ ${escapeHtml(problem)}</div>` : ''}</div>`;
      body += `</div>`;

      return `
        <div class="${rowClass}" onclick="studioEditQuestion(${i})">
          <input type="checkbox" class="studio-row-cb" data-i="${i}" onclick="event.stopPropagation()" />
          <div class="qnum">${q.id}.</div>
          ${body}
          <div class="qactions" onclick="event.stopPropagation()">
            <button onclick="studioMoveQuestion(${i}, -1)" title="Move up">↑</button>
            <button onclick="studioMoveQuestion(${i},  1)" title="Move down">↓</button>
            <button onclick="studioEditQuestion(${i})" title="Edit">✎</button>
            ${q.image_url ? `<img src="${escapeHtml(q.image_url)}" class="qthumb" alt="" />` : ''}
          </div>
        </div>
      `;
    }

    function studioMoveQuestion(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= studioState.questions.length) return;
      const arr = studioState.questions;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      studioRenumber();
      studioRenderList();
    }

    // ---- Edit modal ----
    // Fills the manual editor's Subject <select> from that category's registry (examSubjects),
    // always including the current value even if it isn't (yet) a registered subject — e.g. legacy
    // free-text from before this feature existed, or something a CSV upload brought in that hasn't
    // been reconciled by the cleanup tool yet — so simply opening the editor never silently changes
    // what's saved.
    function populateEditSubjectSelect(selected) {
      const sel = document.getElementById('edit-subject');
      if (!sel) return;
      const cat = document.getElementById('studio-category').value;
      const list = (examSubjects[cat] || []).slice().sort((a, b) => a.localeCompare(b));
      const opts = [...list];
      if (selected && !opts.some(s => s.toLowerCase() === selected.toLowerCase())) opts.unshift(selected);
      sel.innerHTML = '<option value="">— No subject —</option>' +
        opts.map(s => `<option value="${escapeHtml(s)}" ${s === selected ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('') +
        '<option value="__add_new__">+ Add new subject…</option>';
    }

    function studioAddSubjectInline() {
      const sel = document.getElementById('edit-subject');
      const cat = document.getElementById('studio-category').value;
      const name = prompt(`New subject name for ${categoryDisplayName(cat)}:`);
      if (!name || !name.trim()) { populateEditSubjectSelect(''); return; }
      const trimmed = name.trim();
      const canonical = canonicalizeSubject(cat, trimmed);
      registerSubjectIfNew(cat, canonical);
      populateEditSubjectSelect(canonical);
    }

    function studioEditQuestion(i) {
      const q = studioState.questions[i];
      if (!q) return;
      studioEditingIndex = i;
      document.getElementById('edit-q-num').innerText = q.id;
      document.getElementById('edit-q-en').value = q.q_en;
      document.getElementById('edit-q-kn').value = q.q_kn;
      ['a','b','c','d'].forEach((L, j) => {
        document.getElementById(`edit-${L}-en`).value = q.options_en[j] || '';
        document.getElementById(`edit-${L}-kn`).value = q.options_kn[j] || '';
      });
      document.getElementById('edit-correct').value = q.correct || 'A';
      document.getElementById('edit-difficulty').value = q.difficulty || '';
      populateEditSubjectSelect(q.subject || '');
      document.getElementById('edit-exp').value = q.exp || '';
      document.getElementById('edit-exp-kn').value = q.exp_kn || '';
      document.getElementById('edit-relevant-until').value = q.relevantUntil || '';
      editSetContentType(q.contentType === 'ca' ? 'ca' : 'static');
      document.getElementById('edit-relevant-period').value = q.relevantPeriod || '';
      document.getElementById('edit-asked-years').value = (Array.isArray(q.askedInYears) ? q.askedInYears : []).join(', ');
      document.getElementById('edit-retired').checked = !!q.retired;
      document.getElementById('edit-image-url').value = q.image_url || '';
      const preview = document.getElementById('edit-image-preview');
      if (q.image_url) { preview.src = q.image_url; preview.classList.remove('hidden'); }
      else { preview.classList.add('hidden'); }
      document.getElementById('edit-image-file').value = '';
      openModal('studio-edit-modal');
    }

    function editSaveQuestion() {
      const q = studioState.questions[studioEditingIndex];
      if (!q) return;
      q.q_en = document.getElementById('edit-q-en').value.trim();
      q.q_kn = document.getElementById('edit-q-kn').value.trim();
      q.options_en = ['a','b','c','d'].map(L => document.getElementById(`edit-${L}-en`).value.trim());
      q.options_kn = ['a','b','c','d'].map(L => document.getElementById(`edit-${L}-kn`).value.trim());
      q.correct = document.getElementById('edit-correct').value;
      const diffVal = document.getElementById('edit-difficulty').value;
      q.difficulty = diffVal ? +diffVal : null;
      const subjVal = document.getElementById('edit-subject').value;
      q.subject = subjVal === '__add_new__' ? '' : subjVal.trim();
      q.exp = document.getElementById('edit-exp').value.trim();
      q.exp_kn = document.getElementById('edit-exp-kn').value.trim();
      q.contentType = editCurrentContentType;
      q.relevantPeriod = q.contentType === 'ca' ? document.getElementById('edit-relevant-period').value.trim() : '';
      q.relevantUntil = q.contentType === 'ca' ? document.getElementById('edit-relevant-until').value.trim() : '';
      q.askedInYears = document.getElementById('edit-asked-years').value
        .split(/[^0-9]+/).map(s => s.trim()).filter(s => /^(19|20)\d{2}$/.test(s));
      q.retired = document.getElementById('edit-retired').checked;
      q.image_url = document.getElementById('edit-image-url').value.trim();
      delete q._isNew;
      closeModal('studio-edit-modal');
      studioRenderList();
    }

    // ---- Content type (Static / Current Affairs) toggle in the edit modal ----
    // Kept as a simple two-button toggle (like the EN/KN/Both language switch) rather than a <select>,
    // since it's a binary choice checked on every single question edit — a toggle is one click either
    // way, a dropdown is two. editCurrentContentType is the source of truth while the modal is open;
    // editSaveQuestion() reads it (not the DOM) when writing back to the question.
    let editCurrentContentType = 'static';
    function editSetContentType(type) {
      editCurrentContentType = type === 'ca' ? 'ca' : 'static';
      const activeCls = 'flex-1 px-2 py-1.5 text-xs font-bold bg-amber-500 text-slate-950';
      const inactiveCls = 'flex-1 px-2 py-1.5 text-xs font-bold bg-white text-slate-500 hover:bg-slate-50';
      document.getElementById('edit-type-static').className = editCurrentContentType === 'static' ? activeCls : inactiveCls;
      document.getElementById('edit-type-ca').className = (editCurrentContentType === 'ca' ? activeCls : inactiveCls) + ' border-l';
      // Relevant period/until only make sense for Current Affairs — hide them for Static so they
      // aren't half-filled-in on a question they don't apply to.
      document.getElementById('edit-relevant-period-wrap').classList.toggle('hidden', editCurrentContentType !== 'ca');
      const untilInput = document.getElementById('edit-relevant-until');
      if (untilInput) {
        untilInput.closest('.studio-edit-relevant-until-wrap') &&
          untilInput.closest('.studio-edit-relevant-until-wrap').classList.toggle('hidden', editCurrentContentType !== 'ca');
        // Switching a question INTO CA with no window set yet gets the standard one-year default,
        // same as the CSV import and bulk "Mark CA" paths — never left blank (which would make a
        // freshly-tagged question look "lapsed" the instant it's saved).
        if (editCurrentContentType === 'ca' && !untilInput.value) untilInput.value = studioDefaultRelevantUntil();
      }
    }

    function editDeleteQuestion() {
      if (!confirm('Delete this question from the studio?')) return;
      studioState.questions.splice(studioEditingIndex, 1);
      studioRenumber();
      closeModal('studio-edit-modal');
      studioRenderList();
    }

    function editCopyEnToKn() {
      document.getElementById('edit-q-kn').value = document.getElementById('edit-q-en').value;
      ['a','b','c','d'].forEach(L => {
        document.getElementById(`edit-${L}-kn`).value = document.getElementById(`edit-${L}-en`).value;
      });
      // Only copy the explanation across if the Kannada side is still empty — unlike the question/
      // options above (always meant to be parallel text), an admin may have already written a
      // genuinely different Kannada explanation, and this button shouldn't clobber it.
      const expKn = document.getElementById('edit-exp-kn');
      if (expKn && !expKn.value.trim()) expKn.value = document.getElementById('edit-exp').value;
    }

    async function editUploadImage(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        input.value = '';
        return alert('Image is bigger than 5 MB. Compress it or paste a URL instead.');
      }
      const path = `question_images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      try {
        const { error } = await supabaseClient.storage.from('study_materials').upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data } = supabaseClient.storage.from('study_materials').getPublicUrl(path);
        document.getElementById('edit-image-url').value = data.publicUrl;
        const preview = document.getElementById('edit-image-preview');
        preview.src = data.publicUrl;
        preview.classList.remove('hidden');
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
      input.value = '';
    }

    // ---- Publish ----
    async function studioPublish() {
      const title = document.getElementById('studio-paper-title').value.trim();
      const category = document.getElementById('studio-category').value;
      const extraCategories = [...document.querySelectorAll('.studio-extracat-cb:checked')].map(cb => cb.value).filter(c => c !== category);
      const alsoListCategories = [...document.querySelectorAll('.studio-alsolist-cb:checked')].map(cb => cb.value).filter(c => c !== category);
      const active = document.getElementById('studio-active').checked;
      const delisted = document.getElementById('studio-delisted').checked;
      // SECURITY FIX: previously `parseInt(rawValue, 10) || 0` treated a BLANK/invalid field exactly
      // the same as an admin explicitly typing 0 — meaning a stray cleared field silently published a
      // paid paper as free, with no warning. Now those two cases are told apart: blank/invalid requires
      // explicit confirmation before proceeding.
      const rawPrice = document.getElementById('studio-price').value;
      let price;
      if (rawPrice.trim() === '' || isNaN(parseInt(rawPrice, 10))) {
        if (!confirm(`The price field is blank or invalid. Publish "${title}" as FREE (₹0)?\n\nClick Cancel to go back and enter a price.`)) return;
        price = 0;
      } else {
        price = Math.max(0, parseInt(rawPrice, 10));
      }
      const scheme = {
        examBadge: (EXAM_CATEGORIES[category]?.defaultScheme?.examBadge) || 'EXAM',
        marksCorrect: parseFloat(document.getElementById('studio-mark-correct').value) || 2,
        marksWrong: parseFloat(document.getElementById('studio-mark-wrong').value) || 0.5,
        duration: parseInt(document.getElementById('studio-duration').value, 10) || 120,
        cutoff: parseFloat(document.getElementById('studio-cutoff').value) || 0
      };
      if (!title) return alert('Give the paper a title.');
      if (!studioState.questions.length) return alert('Add at least one question before publishing.');

      const problems = studioState.questions.map((q, i) => ({ i: i + 1, why: studioQuestionProblem(q) })).filter(x => x.why);
      if (problems.length) {
        const preview = problems.slice(0, 6).map(p => `  • Q${p.i}: ${p.why}`).join('\n');
        const more = problems.length > 6 ? `\n  … and ${problems.length - 6} more.` : '';
        if (!confirm(`⚠ ${problems.length} question${problems.length === 1 ? ' has a' : 's have'} problems:\n\n${preview}${more}\n\nPublish anyway? (Students will hit errors on the broken ones.)`)) return;
      }

      // Assign IDs; keep original ID for edit mode, generate new one for new/duplicate
      const paperId = (studioState.mode === 'edit' && studioState.originalId) ? studioState.originalId : ('paper_' + Date.now());
      // Convert the datetime-local input (local time) to ISO for storage. Empty string → null.
      const schedRaw = document.getElementById('studio-scheduled-for').value;
      const scheduledFor = schedRaw ? new Date(schedRaw).toISOString() : null;
      // Clean question data for storage (drop internal-only flags like _isNew)
      const cleanQuestions = studioState.questions.map(q => ({
        id: q.id, q_en: q.q_en, q_kn: q.q_kn,
        options_en: q.options_en, options_kn: q.options_kn,
        correct: q.correct, exp: q.exp, exp_kn: q.exp_kn || '', subject: q.subject || '',
        image_url: q.image_url || '',
        contentType: q.contentType === 'ca' ? 'ca' : 'static',
        relevantPeriod: q.relevantPeriod || '',
        relevantUntil: q.relevantUntil || '',
        askedInYears: Array.isArray(q.askedInYears) ? q.askedInYears : [],
        retired: !!q.retired,
        // See studioGenerateFromBank / getQuestionBank — omitted entirely for ordinary questions, so
        // storage and dedupe behavior are unchanged for every paper that isn't bank-generated.
        ...(q.sourceQuestionId ? { sourceQuestionId: q.sourceQuestionId } : {})
      }));

      const btn = document.getElementById('studio-publish-btn');
      const oldText = btn.innerText;
      btn.disabled = true; btn.innerText = 'Publishing…';

      try {
        const { error } = await supabaseClient.from('tests_catalog').upsert({
          id: paperId, category, extra_categories: extraCategories, also_list_categories: alsoListCategories, active, delisted, title, price, scheme, questions: cleanQuestions, question_count: cleanQuestions.length, scheduled_for: scheduledFor
        });
        if (error) throw error;

        // Update local catalog
        const runtimePaper = { id: paperId, category, extraCategories, alsoListCategories, active, delisted, title, price, scheme, questions: cleanQuestions, questionCount: cleanQuestions.length, scheduled_for: scheduledFor };
        const existingIdx = testsCatalog.findIndex(p => p.id === paperId);
        if (existingIdx >= 0) testsCatalog[existingIdx] = runtimePaper;
        else testsCatalog.push(runtimePaper);

        // Always clear the draft slot on a successful publish. studioSaveDraft() is now gated to
        // 'new' mode only (see its comment), so in practice this only ever fires for a genuinely new
        // paper — but clearing unconditionally here too is a harmless safety net against the same
        // stale-draft-resurfaces-later bug if the slot ever ends up populated some other way.
        studioDiscardDraft();

        document.getElementById('view-studio').classList.add('hidden');
        studioState = null;
        renderTestsCatalogAdmin();
        if (typeof filterExamCategory === 'function') filterExamCategory(selectedCategory);
        alert(`✓ Published "${title}" (${cleanQuestions.length} question${cleanQuestions.length === 1 ? '' : 's'}) live to the cloud.`);
      } catch (err) {
        alert('Publish failed: ' + err.message);
      } finally {
        btn.disabled = false; btn.innerText = oldText;
      }
    }


// handleBundleAndUploadPaper() (the legacy one-shot "Quick upload" CSV form) was retired along
// with its markup in index.html -- see the comment there for why. Test Paper Studio's own CSV
// upload is the only paper-upload path now, and it always sets contentType, so a new
// Current-Affairs paper can no longer silently default to "Static" by going through a form
// that never asked.

