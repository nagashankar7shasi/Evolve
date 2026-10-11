    /* ----------------------------------------------------
       6c. MAINS PRACTICE (student-facing: browse, write, self-assess)
    ----------------------------------------------------- */
    // Full-screen overlay (#view-mains-practice), same pattern as the exam engine / Studio -- a
    // focused, single-task view rather than another dashboard widget. Three screens inside it:
    // browse -> write -> self-assess. AI-assisted evaluation calls the provider-agnostic
    // 'mains-ai-evaluate' Edge Function (Claude + OpenAI adapters, see that function's own comments);
    // it reports a clean "not configured yet" error until an admin adds a real API key, rather than
    // failing. Human-reviewed evaluation (the third tier) is still a "coming soon" placeholder -- the
    // admin review queue hasn't been built yet. INTENTIONALLY NOT LINKED from any dashboard button or
    // nav yet -- same staged-rollout discipline as the admin Question Studio PR: feature-complete,
    // reachable only by calling openMainsPractice() directly, until all tiers exist and
    // access-control (Task "wire into bundle scope") is wired in.
    let mainsSubmissions = [];        // this student's own submissions only (server-side .eq filter, even though RLS itself is public-read)
    let mainsPracticeFilterCategory = 'kpsc_kas';
    let mainsPracticeFilterSubject = '';
    let mainsPracticeCurrentQuestion = null; // question object currently being answered (write screen)
    let mainsPracticeAnswerPhotoFile = null; // staged File, not yet uploaded
    let mainsPracticeCurrentSubmissionId = null; // submission currently shown on the self-assess screen (AI-feedback button target)

    async function fetchCloudMainsSubmissions() {
      if (!currentUser) { mainsSubmissions = []; return; }
      const { data, error } = await supabaseClient.from('mains_submissions').select('*')
        .eq('student_email', normalizeEmail(currentUser.email)).order('submitted_at', { ascending: false });
      if (error) { console.error('fetchCloudMainsSubmissions:', fmtErr(error)); return; }
      if (data) {
        mainsSubmissions = data.map(s => ({
          id: s.id, questionId: s.question_id, studentEmail: s.student_email,
          answerText: s.answer_text || '', answerImagePath: s.answer_image_path || null,
          wantsHumanEval: !!s.wants_human_eval, humanEvalOrderId: s.human_eval_order_id || null,
          submittedAt: s.submitted_at
        }));
      }
    }

    async function openMainsPractice() {
      if (!currentUser) { openLoginModal('Log in to practice Mains answers.', () => openMainsPractice()); return; }
      document.getElementById('view-mains-practice').classList.remove('hidden');
      await fetchCloudMainsSubmissions();
      mainsPracticeShowBrowse();
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
    function mainsPracticeShowBrowse() {
      mainsPracticeSwitchScreen('browse');
      document.querySelectorAll('.mp-cat-tab').forEach(b => {
        const on = b.dataset.cat === mainsPracticeFilterCategory;
        b.classList.toggle('bg-slate-900', on);
        b.classList.toggle('text-white', on);
        b.classList.toggle('text-slate-700', !on);
      });
      mainsPracticeRefreshSubjectFilter();
      renderMainsPracticeQuestionList();
    }

    function mainsPracticeCategoryTabClick(catId) {
      mainsPracticeFilterCategory = catId;
      mainsPracticeFilterSubject = '';
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
            ${q.subject ? `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(q.subject)}</span>` : ''}
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
      mainsPracticeCurrentQuestion = q;
      mainsPracticeAnswerPhotoFile = null;
      document.getElementById('mp-write-subject').innerText = q.subject || q.categoryId;
      document.getElementById('mp-write-marks').innerText = `${q.marks} marks${q.wordLimit ? ` · ${q.wordLimit}-word limit` : ''}`;
      document.getElementById('mp-write-question').innerText = q.question;
      document.getElementById('mp-write-rubric-hint').innerText = q.rubric.length
        ? `Covers: ${q.rubric.map(r => r.criterion).join(' · ')}` : '';
      document.getElementById('mp-answer-text').value = '';
      document.getElementById('mp-answer-photo').value = '';
      document.getElementById('mp-photo-preview').classList.add('hidden');
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

    function mainsPracticeChoosePhoto(inputEl) {
      const file = inputEl.files[0];
      if (!file) return;
      mainsPracticeAnswerPhotoFile = file;
      document.getElementById('mp-photo-filename').innerText = file.name;
      document.getElementById('mp-photo-preview').classList.remove('hidden');
    }

    function mainsPracticeRemovePhoto() {
      mainsPracticeAnswerPhotoFile = null;
      document.getElementById('mp-answer-photo').value = '';
      document.getElementById('mp-photo-preview').classList.add('hidden');
    }

    async function submitMainsAnswer() {
      const errBox = document.getElementById('mp-submit-error');
      const showErr = msg => { errBox.innerText = msg; errBox.classList.remove('hidden'); };
      errBox.classList.add('hidden');
      if (!mainsPracticeCurrentQuestion || !currentUser) return;
      const answerText = document.getElementById('mp-answer-text').value.trim();
      if (!answerText && !mainsPracticeAnswerPhotoFile) return showErr('Type an answer or attach a photo before submitting.');

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
          submitted_at: new Date().toISOString()
        };
        const { error } = await supabaseClient.from('mains_submissions').insert([submission]);
        if (error) throw error;

        mainsSubmissions.unshift({
          id: submission.id, questionId: submission.question_id, studentEmail: submission.student_email,
          answerText: submission.answer_text || '', answerImagePath: submission.answer_image_path,
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
      document.getElementById('mp-assess-model-answer').innerText = q.modelAnswer || 'No model answer added yet for this question.';

      const myAnswerEl = document.getElementById('mp-assess-my-answer');
      const myPhotoEl = document.getElementById('mp-assess-my-photo');
      myAnswerEl.innerText = sub.answerText || (sub.answerImagePath ? '' : 'No answer text.');
      myPhotoEl.classList.add('hidden');
      if (sub.answerImagePath) {
        const { data, error } = await supabaseClient.storage.from('mains_answer_photos').createSignedUrl(sub.answerImagePath, 300);
        if (!error && data && data.signedUrl) {
          myPhotoEl.src = data.signedUrl;
          myPhotoEl.classList.remove('hidden');
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
