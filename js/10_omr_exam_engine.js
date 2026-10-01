    /* ----------------------------------------------------
       10. OMR EXAM ENGINE & COMPLETE ATTEMPT SNAPSHOTTING
    ----------------------------------------------------- */
    async function launchExamPaper(paperId) {
      if (!currentUser) {
        openLoginModal('Log in to take this test. Your score will be saved to your dashboard.', () => launchExamPaper(paperId));
        return;
      }
      activeTest = testsCatalog.find(p => p.id === paperId);
      if (!activeTest) return;

      if (!isTestUnlockedForUser(activeTest.id)) {
        openCheckout('paper', activeTest.id, activeTest.title, activeTest.price);
        return;
      }

      // The catalog only carries metadata by default (see fetchCloudContent) — fetch this one
      // paper's actual questions now that access is confirmed, rather than every paper on every
      // page load for everyone.
      if (!Array.isArray(activeTest.questions) || !activeTest.questions.length) {
        await ensurePaperQuestionsLoaded(activeTest);
      }

      // Defensive: heal any paper whose scheme/questions arrived from the cloud as strings
      // or that ended up with a missing scheme (older uploads, direct DB inserts, etc.)
      if (typeof activeTest.scheme === 'string') {
        try { activeTest.scheme = JSON.parse(activeTest.scheme); } catch (_) { activeTest.scheme = null; }
      }
      if (typeof activeTest.questions === 'string') {
        try { activeTest.questions = JSON.parse(activeTest.questions); } catch (_) { activeTest.questions = null; }
      }
      if (!Array.isArray(activeTest.questions) || activeTest.questions.length === 0) {
        alert(`This paper has no questions attached. It may not have been uploaded correctly.\n\nAsk the admin to re-upload the CSV for "${activeTest.title}".`);
        return;
      }

      // Validate each question has what OMR needs: a valid Correct letter (A-D) and 4 options.
      // If any are broken, OMR renders but scoring silently returns 0 — the classic "OMR works for
      // one paper but not another" symptom. Flag the exact rows so the admin can fix the CSV.
      const brokenQs = [];
      activeTest.questions.forEach((q, i) => {
        const problems = [];
        if (!q || typeof q !== 'object') { brokenQs.push({ n: i + 1, why: 'not an object' }); return; }
        if (!q.correct || !/^[A-D]$/i.test(String(q.correct).trim())) problems.push('missing Correct letter (A-D)');
        // BUG FIX: this used to check q.optAEN / q.opt_a_en / q.questionEN / q.question_en / q.q --
        // property names that don't exist on any real question object. Every question everywhere
        // else in the app (Studio, the exam engine, practice mode, result sheets) uses q.q_en/q.q_kn
        // for the question text and q.options_en[]/q.options_kn[] (4-element arrays) for the options.
        // Because the old names never matched, this check failed for literally every question on
        // every paper regardless of the CSV's actual quality -- exactly the "100 broken questions on
        // a proper file" report. Checking the real property names fixes that.
        const optsEN = Array.isArray(q.options_en) ? q.options_en : [];
        const optsKN = Array.isArray(q.options_kn) ? q.options_kn : [];
        const hasAnyOption = optsEN.some(Boolean) || optsKN.some(Boolean);
        if (!hasAnyOption) problems.push('no option text');
        if (!q.q_en && !q.q_kn) problems.push('no question text');
        if (problems.length) brokenQs.push({ n: i + 1, why: problems.join(', ') });
      });
      if (brokenQs.length) {
        const preview = brokenQs.slice(0, 5).map(b => `  • Question ${b.n}: ${b.why}`).join('\n');
        const more = brokenQs.length > 5 ? `\n  … and ${brokenQs.length - 5} more.` : '';
        alert(`"${activeTest.title}" has ${brokenQs.length} broken question${brokenQs.length > 1 ? 's' : ''}. OMR can't score them correctly.\n\n${preview}${more}\n\nFix the CSV (check the Correct column has just A/B/C/D letters and each row has 4 options) and re-upload.`);
        // Continue anyway so the admin can still see the working questions; but let them know
        // there's a data problem instead of failing silently.
      }

      if (!activeTest.scheme || typeof activeTest.scheme !== 'object') {
        // Fall back to the category's default scheme so the paper still opens
        const fallback = EXAM_CATEGORIES[activeTest.category]?.defaultScheme;
        if (fallback) activeTest.scheme = { ...fallback };
        else {
          alert(`This paper has no marking scheme. Ask the admin to re-upload "${activeTest.title}" so the scheme is attached.`);
          return;
        }
      }
      // Final safety: fill in any missing scheme field
      const s = activeTest.scheme;
      if (typeof s.duration !== 'number' || s.duration <= 0) s.duration = 120;
      if (typeof s.marksCorrect !== 'number') s.marksCorrect = 2;
      if (typeof s.marksWrong !== 'number') s.marksWrong = 0.5;
      if (typeof s.cutoff !== 'number') s.cutoff = 0;
      if (!s.examBadge) s.examBadge = 'EXAM';

      userSelections = {};
      markedForReview = {};
      examEndsAt = Date.now() + activeTest.scheme.duration * 60 * 1000;
      openExamEngine();
    }

    // Practice Mode on a whole paper: same unlock/validation rules as launchExamPaper above
    // (deliberately kept as its own copy rather than sharing code with launchExamPaper, so nothing
    // about the real, timed, paywalled OMR flow is touched by this). Runs through the existing
    // one-question-at-a-time instant-feedback engine instead of the OMR sheet: untimed, no lock,
    // negative marking still applies, and it's scored/saved as a downloadable attempt (tagged
    // 'practice') once finished — see finishPaperPractice().
    async function launchExamPaperPractice(paperId) {
      if (!currentUser) {
        openLoginModal('Log in to practice this paper. Your score will be saved to your dashboard.', () => launchExamPaperPractice(paperId));
        return;
      }
      const paper = testsCatalog.find(p => p.id === paperId);
      if (!paper) return;

      if (!isTestUnlockedForUser(paper.id)) {
        openCheckout('paper', paper.id, paper.title, paper.price);
        return;
      }

      // See launchExamPaper — content is fetched per-paper, on demand, once access is confirmed.
      if (!Array.isArray(paper.questions) || !paper.questions.length) {
        await ensurePaperQuestionsLoaded(paper);
      }

      if (typeof paper.scheme === 'string') {
        try { paper.scheme = JSON.parse(paper.scheme); } catch (_) { paper.scheme = null; }
      }
      if (typeof paper.questions === 'string') {
        try { paper.questions = JSON.parse(paper.questions); } catch (_) { paper.questions = null; }
      }
      if (!Array.isArray(paper.questions) || paper.questions.length === 0) {
        alert(`This paper has no questions attached. It may not have been uploaded correctly.\n\nAsk the admin to re-upload the CSV for "${paper.title}".`);
        return;
      }
      if (!paper.scheme || typeof paper.scheme !== 'object') {
        const fallback = EXAM_CATEGORIES[paper.category]?.defaultScheme;
        if (fallback) paper.scheme = { ...fallback };
        else {
          alert(`This paper has no marking scheme. Ask the admin to re-upload "${paper.title}" so the scheme is attached.`);
          return;
        }
      }
      const s = paper.scheme;
      if (typeof s.marksCorrect !== 'number') s.marksCorrect = 2;
      if (typeof s.marksWrong !== 'number') s.marksWrong = 0.5;
      if (typeof s.cutoff !== 'number') s.cutoff = 0;
      if (!s.examBadge) s.examBadge = 'EXAM';

      startPractice({
        title: paper.title,
        source: 'paper',
        paper,
        items: paper.questions.map((q, i) => ({ key: questionKey(q, paper.id), q }))
      });
    }

    // Shared by a fresh start and by resuming after a refresh
    let examEndsAt = 0;
    let examInProgress = false;

    function openExamEngine() {
      const s = activeTest.scheme;
      examInProgress = true;
      document.getElementById('engine-exam-title').innerText = activeTest.title;
      document.getElementById('engine-scheme-info').innerText = `Scheme: ${s.examBadge} (+${s.marksCorrect} / -${s.marksWrong}) • Duration: ${s.duration}m`;
      document.getElementById('view-engine').classList.remove('hidden');
      renderPaper();
      renderOMR();
      saveExamSession();
      startTimer();
    }

    // In-progress test is saved after every answer, so a refresh or closed tab doesn't lose it
    function saveExamSession() {
      if (!examInProgress || !activeTest || !currentUser) return;
      localStorage.setItem('kas_exam_session', JSON.stringify({
        email: normalizeEmail(currentUser.email), paperId: activeTest.id, selections: userSelections, markedForReview: markedForReview, endsAt: examEndsAt, lang: currentLang,
        customPaper: activeTest.isCustom ? activeTest : null
      }));
    }

    function clearExamSession() {
      localStorage.removeItem('kas_exam_session');
    }

    function checkUnfinishedExam() {
      const saved = JSON.parse(localStorage.getItem('kas_exam_session') || 'null');
      if (!saved) return;
      const paper = testsCatalog.find(p => p.id === saved.paperId)
        || (saved.customPaper && saved.customPaper.id === saved.paperId ? saved.customPaper : null);
      if (!paper || !currentUser || normalizeEmail(currentUser.email) !== saved.email) return;
      activeTest = paper;
      userSelections = saved.selections || {};
      markedForReview = saved.markedForReview || {};
      currentLang = saved.lang || 'en';
      examEndsAt = saved.endsAt;
      if (Date.now() >= examEndsAt) {
        examInProgress = true;
        evaluateOMRSubmission();
        alert(`Time ran out on "${paper.title}" while you were away, so it was submitted with the ${Object.keys(userSelections).length} answer(s) you had marked.`);
        return;
      }
      const mins = Math.ceil((examEndsAt - Date.now()) / 60000);
      document.getElementById('resume-exam-desc').innerText =
        `"${paper.title}" is still running: ${Object.keys(userSelections).length} answered, about ${mins} minute(s) left. The timer kept running while you were away.`;
      openModal('resume-exam-modal');
    }

    function resumeExam() {
      closeModal('resume-exam-modal');
      openExamEngine();
    }

    function submitSavedExam() {
      closeModal('resume-exam-modal');
      examInProgress = true;
      evaluateOMRSubmission();
    }

    window.addEventListener('beforeunload', e => {
      if (examInProgress) { e.preventDefault(); e.returnValue = ''; }
    });

    // Shared guard for anything about to hide the exam engine view (view-engine) — a Back-button
    // press (which arrives via popstate -> routeFromHash -> navigate('home') or
    // renderDynamicCustomPage), a nav-menu click, the Home logo, a page-card link, anything.
    // The beforeunload guard above only fires on a real page unload (closing the tab, refreshing,
    // typing a new URL) — it does nothing for this same-document in-app navigation, which is why
    // navigate() and renderDynamicCustomPage() used to just silently hide the exam mid-attempt:
    // no warning, nothing submitted, the whole attempt gone. This asks first and, if the student
    // wants to leave, submits whatever was answered so far as a real, saved attempt instead of
    // discarding it. Returns true if it's safe to proceed with the navigation, false if the caller
    // should stop and leave the exam exactly as it was.
    async function guardLeavingExam() {
      if (!examInProgress) return true;
      const answered = Object.keys(userSelections || {}).length;
      const total = activeTest ? activeTest.questions.length : 0;
      const ok = confirm(`Leave this exam?\n\n${answered ? `You've answered ${answered} of ${total} question(s). ` : ''}OK submits what you've answered so far as your final attempt (can't be undone). Cancel goes back to the exam.`);
      if (!ok) return false;
      await evaluateOMRSubmission();
      return true;
    }

    function renderPaper() {
      // BUG FIX: the ENG/ಕನ್ನಡ toggle buttons never reflected which language was actually active —
      // clicking ಕನ್ನಡ correctly switched the question/option text (via currentLang below) but the
      // buttons themselves kept whatever highlight they were given in the static HTML, so the toggle
      // looked stuck on ENG regardless of what was actually showing. Synced here (rather than only
      // inside setLanguage) so it's also correct the moment a resumed exam session restores a
      // previously-saved Kannada language choice, not just after the next click.
      const langEnBtn = document.getElementById('lang-en'), langKnBtn = document.getElementById('lang-kn');
      if (langEnBtn && langKnBtn) {
        const activeCls = 'px-2.5 py-0.5 rounded font-bold bg-amber-500 text-slate-950 transition';
        const inactiveCls = 'px-2.5 py-0.5 rounded text-slate-300 hover:text-white font-medium transition';
        langEnBtn.className = currentLang === 'en' ? activeCls : inactiveCls;
        langKnBtn.className = currentLang === 'kn' ? activeCls : inactiveCls;
      }
      const container = document.getElementById('questions-stream');
      container.innerHTML = '';

      activeTest.questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const qText = currentLang === 'en' ? q.q_en : (q.q_kn || q.q_en);
        const options = currentLang === 'en' ? q.options_en : (q.options_kn || q.options_en);
        const chosen = userSelections[qNum];

        const card = document.createElement('div');
        card.id = `q-card-${qNum}`;
        card.className = "question-card bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all";

        let optHtml = '';
        ['A', 'B', 'C', 'D'].forEach((l, i) => {
          const isSelected = chosen === l;
          optHtml += `
            <div onclick="selectAnswer(${qNum}, '${l}')" class="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer text-xs ${
              isSelected ? 'border-amber-600 bg-amber-50 font-bold' : 'border-slate-200 hover:bg-slate-50'
            }">
              <span class="w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 border'
              }">${l}</span>
              <span>${options[i]}</span>
            </div>
          `;
        });

        card.innerHTML = `
          <div class="flex justify-between border-b pb-2 mb-3">
            <span class="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">QUESTION ${qNum}</span>
            <span class="text-[11px] text-slate-400 font-mono">${activeTest.scheme.examBadge}</span>
          </div>
          ${q.image_url ? `<img src="${escapeHtml(q.image_url)}" alt="Question diagram" class="max-w-full max-h-80 rounded-lg border border-slate-200 mb-3 mx-auto block" />` : ''}
          <div class="text-sm font-medium text-slate-900 mb-4 whitespace-pre-line leading-relaxed">${qText}</div>
          <div class="space-y-2">${optHtml}</div>
        `;
        container.appendChild(card);
      });
    }

    function renderOMR() {
      const container = document.getElementById('omr-grid-container');
      container.innerHTML = '';

      activeTest.questions.forEach((_, idx) => {
        const qNum = idx + 1;
        const isMarked = !!markedForReview[qNum];
        const isAnswered = userSelections[qNum] != null;
        // Marking always wins visually, whether or not the question is answered — a flagged question
        // means "look at this again before submitting," which matters the same way either way. No
        // separate "not visited" state either: this engine shows all questions on one scrollable page,
        // so there's nothing to "visit" yet vs. see, unlike a one-question-at-a-time exam runner.
        const stateClass = isMarked ? 'omr-row-marked'
          : isAnswered ? 'omr-row-answered'
          : 'omr-row-unanswered';
        const row = document.createElement('div');
        row.className = `flex items-center px-3 py-1.5 rounded hover:bg-amber-100/50 font-mono text-xs ${stateClass}`;

        let bubbles = '';
        ['A', 'B', 'C', 'D'].forEach(l => {
          const filled = userSelections[qNum] === l;
          bubbles += `<div onclick="selectAnswer(${qNum}, '${l}')" class="omr-bubble ${filled ? 'filled' : ''}">${l}</div>`;
        });

        row.innerHTML = `
          <div class="w-12 text-center font-bold text-slate-700 cursor-pointer underline" onclick="scrollToQ(${qNum})">${qNum}</div>
          <div class="flex-1 flex justify-around pl-2">${bubbles}</div>
          <div class="w-8 text-center"><button onclick="toggleMarkForReview(${qNum})" title="${isMarked ? 'Unmark for review' : 'Mark for review'}" class="omr-flag-btn${isMarked ? ' active' : ''}">🚩</button></div>
          <div class="w-10 text-center"><button onclick="clearQ(${qNum})" class="text-slate-300 hover:text-rose-600 font-bold">&times;</button></div>
        `;
        container.appendChild(row);
      });
      const filledCount = Object.keys(userSelections).length;
      const unansweredCount = activeTest.questions.length - filledCount;
      const markedCount = Object.keys(markedForReview).filter(k => markedForReview[k]).length;
      document.getElementById('omr-tally').innerText = `${filledCount} Filled · ${unansweredCount} Unanswered${markedCount ? ` · ${markedCount} for review` : ''}`;
    }

    function selectAnswer(qNum, l) { userSelections[qNum] = l; renderPaper(); renderOMR(); saveExamSession(); }
    function clearQ(qNum) { delete userSelections[qNum]; renderPaper(); renderOMR(); saveExamSession(); }
    function toggleMarkForReview(qNum) {
      if (markedForReview[qNum]) delete markedForReview[qNum]; else markedForReview[qNum] = true;
      renderOMR();
      saveExamSession();
    }
    function scrollToQ(qNum) {
      const card = document.getElementById(`q-card-${qNum}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('active-target');
        setTimeout(() => card.classList.remove('active-target'), 1500);
      }
    }
    function setLanguage(l) { currentLang = l; renderPaper(); saveExamSession(); }
    // Counts down to a fixed end time, so background tabs and refreshes can't stretch the exam
    function startTimer() {
      clearInterval(timerInterval);
      let warned5 = false, warned1 = false;
      const tick = () => {
        timerSeconds = Math.max(0, Math.ceil((examEndsAt - Date.now()) / 1000));
        const h = Math.floor(timerSeconds / 3600);
        const m = Math.floor((timerSeconds % 3600) / 60);
        const sec = timerSeconds % 60;
        const el = document.getElementById('exam-timer');
        el.innerText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        el.classList.toggle('text-rose-400', timerSeconds <= 300);
        // 5-minute warning
        if (!warned5 && timerSeconds <= 300 && timerSeconds > 60) {
          warned5 = true;
          showExamWarning('⏰ 5 minutes remaining — start finishing up!', 'amber');
        }
        // 1-minute warning
        if (!warned1 && timerSeconds <= 60 && timerSeconds > 0) {
          warned1 = true;
          showExamWarning('🚨 1 minute left — the OMR will auto-submit at zero!', 'rose');
        }
        if (timerSeconds <= 0) {
          clearInterval(timerInterval);
          evaluateOMRSubmission();
        }
      };
      tick();
      timerInterval = setInterval(tick, 1000);
    }

    // Non-blocking floating warning shown near the timer during the last minutes of an exam.
    // A separate concern from the global error toast — this one is expected, informational, and
    // stays for a long enough time (10s) that the student sees it even if they were mid-scroll.
    function showExamWarning(msg, color) {
      const bg = color === 'rose' ? '#e11d48' : '#f59e0b';
      const t = document.createElement('div');
      t.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:9998;background:${bg};color:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.25);font-family:system-ui,sans-serif;font-size:14px;font-weight:800;`;
      t.innerText = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 10000);
    }

    function confirmSubmit() {
      if (confirm('Submit OMR response sheet for grading?')) {
        clearInterval(timerInterval);
        evaluateOMRSubmission();
      }
    }

async function evaluateOMRSubmission() {
  if (!examInProgress || !activeTest) return; // guards against double submission
  examInProgress = false;
  clearInterval(timerInterval);
  clearExamSession();
  
  const s = activeTest.scheme;
  let correct = 0, wrong = 0, unattempted = 0;

  activeTest.questions.forEach((q, idx) => {
    const choice = userSelections[idx + 1];
    if (!choice) unattempted++;
    else if (choice === q.correct) correct++;
    else wrong++;
  });

  const totalScore = (correct * s.marksCorrect) - (wrong * s.marksWrong);
  const maxMarks = activeTest.questions.length * s.marksCorrect;
  const attempted = correct + wrong;
  const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : 0;
  const passed = totalScore >= s.cutoff;

  // Change the submit button text while communicating with Supabase
  const submitBtn = document.querySelector('header button[onclick="confirmSubmit()"]');
  const originalBtnText = submitBtn ? submitBtn.innerText : "Submit OMR";
  if (submitBtn) {
    submitBtn.innerText = "Submitting to server...";
    submitBtn.disabled = true;
  }

  // Format the record for Supabase columns
  const attemptRecord = {
    id: 'att_' + Date.now(),
    user_email: currentUser ? normalizeEmail(currentUser.email) : null,
    user_name: currentUser ? currentUser.name : null,
    date: new Date().toLocaleDateString('en-GB'),
    paper_id: activeTest.id,
    paper_title: activeTest.title,
    category: activeTest.category,
    is_custom: !!activeTest.isCustom,
    badge: s.examBadge,
    score: parseFloat(totalScore.toFixed(2)),
    max_marks: parseFloat(maxMarks.toFixed(0)),
    accuracy: parseFloat(accuracy),
    scheme_desc: `+${s.marksCorrect} / -${s.marksWrong}`,
    passed: passed,
    user_selections: { ...userSelections },
    questions_snapshot: JSON.parse(JSON.stringify(activeTest.questions)),
    scheme_snapshot: { ...s },
    mode: 'standard'
  };

  // Insert the record into the cloud database
  const { data, error } = await supabaseClient
    .from('attempts')
    .insert([attemptRecord]);

  if (submitBtn) {
    submitBtn.innerText = originalBtnText;
    submitBtn.disabled = false;
  }

  if (error) {
    console.error("Supabase Insert Error:", fmtErr(error));
    return alert("Failed to submit exam to the server. Please try again or contact the academy.");
  }

  // Remap back to camelCase for the local UI to render instantly
  const localAttempt = {
    id: attemptRecord.id,
    userEmail: attemptRecord.user_email,
    userName: attemptRecord.user_name,
    date: attemptRecord.date,
    paperId: attemptRecord.paper_id,
    paperTitle: attemptRecord.paper_title,
    category: attemptRecord.category,
    isCustom: attemptRecord.is_custom,
    badge: attemptRecord.badge,
    score: attemptRecord.score.toFixed(2),
    maxMarks: attemptRecord.max_marks.toFixed(0),
    accuracy: attemptRecord.accuracy.toString(),
    schemeDesc: attemptRecord.scheme_desc,
    passed: attemptRecord.passed,
    userSelections: attemptRecord.user_selections,
    questionsSnapshot: attemptRecord.questions_snapshot,
    schemeSnapshot: attemptRecord.scheme_snapshot,
    mode: attemptRecord.mode
  };

  userAttempts.unshift(localAttempt);
  renderDashboard();

  document.getElementById('res-modal-title').innerText = `${activeTest.title}: Result`;
  document.getElementById('res-modal-desc').innerText = `Graded via ${s.examBadge} Master: (${correct} × +${s.marksCorrect}) - (${wrong} × -${s.marksWrong})`;
  document.getElementById('res-score').innerText = totalScore.toFixed(2);
  document.getElementById('res-max-label').innerText = `Max: ${maxMarks.toFixed(0)}`;
  document.getElementById('res-correct').innerText = correct;
  document.getElementById('res-wrong').innerText = wrong;
  document.getElementById('res-accuracy').innerText = `${accuracy}%`;

  const solBox = document.getElementById('res-solutions-stream');
  solBox.innerHTML = '';
  activeTest.questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const choice = userSelections[qNum] || 'Skipped';
    const isRight = choice === q.correct;
    const item = document.createElement('div');
    item.className = "p-3 bg-slate-50 border rounded-lg";
    item.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <span class="font-bold text-slate-800">Q${qNum}</span>
        <span class="font-bold ${isRight ? 'text-emerald-600' : (choice === 'Skipped' ? 'text-slate-400' : 'text-rose-600')}">
          ${isRight ? `+${s.marksCorrect.toFixed(2)}` : (choice === 'Skipped' ? '0.00' : `-${s.marksWrong.toFixed(2)}`)}
        </span>
      </div>
      <p class="text-slate-700 mb-1.5">${q.q_en}</p>
      ${q.q_kn && q.q_kn !== q.q_en ? `<p class="text-slate-500 mb-1.5" style="font-family:'Noto Sans Kannada',sans-serif">${q.q_kn}</p>` : ''}
      <div class="text-[11px] mb-1">Your Bubble: <b>${choice}</b> | Answer Key: <b class="text-emerald-700 font-bold">${q.correct}</b> ${askedBadgeHtml(q)}</div>
      <div class="p-2 bg-white rounded border border-slate-100 text-[11px] text-slate-600">
        <b>Explanation:</b> ${q.exp || ''}
        ${q.exp_kn ? `<div class="mt-1" style="font-family:'Noto Sans Kannada',sans-serif">${q.exp_kn}</div>` : ''}
      </div>
    `;
    solBox.appendChild(item);
  });

  lastSubmittedAttemptId = localAttempt.id;
  document.getElementById('view-engine').classList.add('hidden');
  document.getElementById('result-modal').classList.remove('hidden');
}

