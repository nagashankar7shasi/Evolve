    /* ----------------------------------------------------
       6c. MAINS PRACTICE (student-facing: browse, write, self-assess)
    ----------------------------------------------------- */
    // Full-screen overlay (#view-mains-practice), same pattern as the exam engine / Studio -- a
    // focused, single-task view rather than another dashboard widget. Three screens inside it:
    // browse -> write -> self-assess. AI-assisted and human-reviewed evaluation (the other two tiers
    // from sql/add_mains_ecosystem.sql) show as "coming soon" placeholders on the self-assessment
    // screen for now -- they're separate, not-yet-built pieces (Edge Function + credits economy, and
    // the admin review queue). INTENTIONALLY NOT LINKED from any dashboard button or nav yet -- same
    // staged-rollout discipline as the admin Question Studio PR: feature-complete, reachable only by
    // calling openMainsPractice() directly, until the other tiers exist and access-control (Task
    // "wire into bundle scope") is wired in.
    let mainsSubmissions = [];        // this student's own submissions only (server-side .eq filter, even though RLS itself is public-read)
    let mainsPracticeFilterCategory = 'kpsc_kas';
    let mainsPracticeFilterSubject = '';
    let mainsPracticeCurrentQuestion = null; // question object currently being answered (write screen)
    let mainsPracticeAnswerPhotoFile = null; // staged File, not yet uploaded

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
