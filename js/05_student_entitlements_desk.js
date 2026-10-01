    /* ----------------------------------------------------
       5. STUDENT ENTITLEMENTS DESK
    ----------------------------------------------------- */
    function renderStudentEntitlementsDesk() {
      const activeCount = document.getElementById('active-students-count');
      if (activeCount) activeCount.innerText = `${studentDirectory.length} Enrolled Students`;

      const sel = document.getElementById('quick-pick-student');
      if (sel) {
        sel.innerHTML = '<option value="">-- Choose Existing Student --</option>';
        studentDirectory.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.email;
          opt.innerText = `${s.email} (${s.passes.length ? s.passes.length + ' pass(es), ' : ''}${s.allowedExams.length} tests, ${s.allowedPages.length} pages, ${s.allowedPdfs.length} PDFs)`;
          sel.appendChild(opt);
        });
      }

      const passesBox = document.getElementById('entitle-passes-list');
      if (passesBox) {
        passesBox.innerHTML = bundles.map(b => `
          <label class="flex items-center space-x-1.5 cursor-pointer">
            <input type="checkbox" value="${b.id}" class="entitle-pass-cb rounded text-emerald-600" onchange="updateBundleCoverageHighlights()" />
            <span class="${b.allAccess ? 'font-bold text-emerald-700' : ''}">${escapeHtml(b.name)}${b.active ? '' : ' <span class="text-slate-400">(not on sale)</span>'}</span>
            <span class="entitle-pass-exp text-slate-400" data-bundle="${b.id}"></span>
          </label>`).join('') || '<span class="text-slate-400">No bundles yet. Create one under Bundles &amp; Passes.</span>';
      }

      const papersBox = document.getElementById('entitle-papers-list');
      if (papersBox) {
        papersBox.innerHTML = '';
        testsCatalog.forEach(p => {
          papersBox.innerHTML += `
            <label class="flex items-start space-x-2 cursor-pointer" data-entitle-row="paper" data-item-id="${p.id}">
              <input type="checkbox" value="${p.id}" class="entitle-paper-cb mt-0.5 rounded text-amber-500" />
              <span class="truncate">${p.title} <b class="text-slate-400 font-mono">(₹${p.price})</b> <span class="via-bundle-badge hidden text-[10px] font-bold text-emerald-600">✓ via bundle</span></span>
            </label>
          `;
        });
      }

      const pagesBox = document.getElementById('entitle-pages-list');
      if (pagesBox) {
        pagesBox.innerHTML = '';
        customPages.forEach(pg => {
          pagesBox.innerHTML += `
            <label class="flex items-start space-x-2 cursor-pointer" data-entitle-row="page" data-item-id="${pg.id}">
              <input type="checkbox" value="${pg.id}" class="entitle-page-cb mt-0.5 rounded text-amber-500" />
              <span class="truncate">${escapeHtml(pg.title)} <b class="text-slate-400 font-mono">(₹${pg.price || 0})</b> <span class="via-bundle-badge hidden text-[10px] font-bold text-emerald-600">✓ via bundle</span></span>
            </label>
          `;
        });
      }

      const pdfsBox = document.getElementById('entitle-pdfs-list');
      if (pdfsBox) {
        pdfsBox.innerHTML = '';
        pdfVault.forEach(doc => {
          pdfsBox.innerHTML += `
            <label class="flex items-start space-x-2 cursor-pointer" data-entitle-row="pdf" data-item-id="${doc.id}">
              <input type="checkbox" value="${doc.id}" class="entitle-pdf-cb mt-0.5 rounded text-amber-500" />
              <span class="truncate">${doc.title} <b class="text-slate-400 font-mono">(₹${doc.price || 0})</b> <span class="via-bundle-badge hidden text-[10px] font-bold text-emerald-600">✓ via bundle</span></span>
            </label>
          `;
        });
      }

      // NEW: individual planner grants — previously the Access Desk had no way to give a specific
      // student a planner outside of bundle coverage or the blanket "paid customer" check.
      const plannersBox = document.getElementById('entitle-planners-list');
      if (plannersBox) {
        plannersBox.innerHTML = planners.length ? '' : '<span class="text-slate-400">No planners yet. Create one under Planners.</span>';
        planners.forEach(pl => {
          plannersBox.innerHTML += `
            <label class="flex items-start space-x-2 cursor-pointer" data-entitle-row="planner" data-item-id="${pl.id}">
              <input type="checkbox" value="${pl.id}" class="entitle-planner-cb mt-0.5 rounded text-amber-500" />
              <span class="truncate">${escapeHtml(pl.label || pl.id)} <span class="via-bundle-badge hidden text-[10px] font-bold text-emerald-600">✓ via bundle</span></span>
            </label>
          `;
        });
      }
    }

    function grantQuickBundle(bundleType) {
      if (!activeSelectedStudent) return alert('Select or load a student profile first.');
      const cb = document.querySelector(`.entitle-pass-cb[value="${bundleType}"]`);
      if (cb) cb.checked = true;
      alert(`${passLabel(bundleType)} ticked. Click "Save Access Entitlements" to confirm.`);
    }

    function loadOrCreateStudentProfile() {
      const email = document.getElementById('entitle-student-email').value.trim().toLowerCase();
      const utr = document.getElementById('entitle-student-utr').value.trim();

      if (!email) return alert('Enter student email address.');

      let student = studentDirectory.find(s => s.email === email);
      if (!student) {
        student = {
          email: email,
          utr: utr || 'MANUAL_OFFLINE',
          status: 'active',
          allowedExams: [],
          allowedPages: [],
          allowedPdfs: [],
          allowedPlanners: [],
          passes: []
        };
        studentDirectory.push(student);
        localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      }

      selectStudent(student);
      renderStudentEntitlementsDesk();
    }

    function selectStudentFromDropdown(email) {
      if (!email) return;
      const s = studentDirectory.find(st => st.email === email);
      if (s) selectStudent(s);
    }

    function selectStudent(student) {
      activeSelectedStudent = student;
      document.getElementById('selected-student-display').innerText = student.email;
      renderSelectedStudentLoginInfo();
      document.getElementById('entitle-student-email').value = student.email;
      document.getElementById('entitle-student-utr').value = student.utr;

      document.querySelectorAll('.entitle-pass-cb').forEach(cb => {
        cb.checked = student.passes.includes(cb.value);
      });
      document.querySelectorAll('.entitle-pass-exp').forEach(el => {
        const exp = (student.passExpiry || {})[el.dataset.bundle];
        el.innerText = student.passes.includes(el.dataset.bundle) && exp ? `${isPassExpired(student, el.dataset.bundle) ? 'expired' : 'until'} ${fmtDate(exp)}` : '';
      });
      document.querySelectorAll('.entitle-paper-cb').forEach(cb => {
        cb.checked = student.allowedExams.includes(cb.value);
      });
      document.querySelectorAll('.entitle-page-cb').forEach(cb => {
        cb.checked = student.allowedPages.includes(cb.value);
      });
      document.querySelectorAll('.entitle-pdf-cb').forEach(cb => {
        cb.checked = student.allowedPdfs.includes(cb.value);
      });
      document.querySelectorAll('.entitle-planner-cb').forEach(cb => {
        cb.checked = (student.allowedPlanners || []).includes(cb.value);
      });
      updateBundleCoverageHighlights();
    }

    // FIX: "bundles not automatically fetching; individual selection has to be done manually" —
    // ticking a bundle pass didn't visually show which papers/pages/PDFs it already covers, so admins
    // re-ticked things by hand that were already granted via the bundle. This reads whichever bundle
    // checkboxes are CURRENTLY ticked in the form (not just the student's saved passes — so admin sees
    // the effect live while building up a new grant) and marks every item those bundles cover as
    // checked + disabled + badged "via bundle". Disabled so it can't be accidentally unticked, and
    // excluded from the individual-grant arrays on save (see saveStudentEntitlements) so bundle
    // coverage never pollutes the permanent individual-grant list.
    function updateBundleCoverageHighlights() {
      const tickedBundleIds = Array.from(document.querySelectorAll('.entitle-pass-cb:checked')).map(cb => cb.value);
      const tickedBundles = tickedBundleIds.map(getBundle).filter(Boolean);

      const applyTo = (selector, coverFn) => {
        document.querySelectorAll(selector).forEach(row => {
          const itemId = row.dataset.itemId;
          const cb = row.querySelector('input[type="checkbox"]');
          const badge = row.querySelector('.via-bundle-badge');
          const covered = tickedBundles.some(b => coverFn(b, itemId));
          if (covered) {
            cb.dataset.viaBundle = 'true';
            if (!cb.checked) cb.checked = true;
            cb.disabled = true;
            if (badge) badge.classList.remove('hidden');
          } else if (cb.dataset.viaBundle === 'true') {
            // Was covered, no longer is (bundle unticked) — release back to a normal editable checkbox.
            // Don't force it unchecked in case the item also happens to be an individual grant already.
            delete cb.dataset.viaBundle;
            cb.disabled = false;
            if (badge) badge.classList.add('hidden');
          }
        });
      };

      applyTo('[data-entitle-row="paper"]', (b, id) => {
        const p = testsCatalog.find(x => x.id === id);
        return bundleCoversPaper(b, p);
      });
      applyTo('[data-entitle-row="page"]', (b, id) => {
        const pg = customPages.find(x => x.id === id);
        return pg && bundleCoversPage(b, pg);
      });
      applyTo('[data-entitle-row="pdf"]', (b, id) => {
        const doc = pdfVault.find(x => x.id === id);
        return doc && bundleCoversPdf(b, doc);
      });
      applyTo('[data-entitle-row="planner"]', (b, id) => bundleCoversPlanner(b, id));
    }

    function renderSelectedStudentLoginInfo() {
      const el = document.getElementById('selected-student-login-info');
      const st = activeSelectedStudent;
      if (!el) return;
      if (!st) { el.innerText = ''; return; }
      const parts = [];
      if (st.name) parts.push(st.name);
      parts.push(st.passwordHash ? 'Password set' : 'No password yet (student can log in with OTP)');
      parts.push(st.lastLoginAt ? `Last login ${new Date(st.lastLoginAt).toLocaleString('en-IN')}` : 'Never logged in');
      parts.push(`Study planners: ${plannerSummary(st.email)}`);
      el.innerText = parts.join('. ') + '.';
    }

    async function clearStudentPassword() {
      const st = activeSelectedStudent;
      if (!st) return alert('Select or load a student profile first.');
      if (!confirm(`Clear the password for ${st.email}?\n\nThey will need to log in with an OTP or use "Forgot password" to set a new one.`)) return;
      delete st.passwordHash;
      delete st.passwordSalt;
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      await pushStudentToCloud(st.email);
      renderSelectedStudentLoginInfo();
      alert(`Password cleared for ${st.email}.`);
    }

    function selectAllEntitlements(checkAll) {
      document.querySelectorAll('.entitle-pass-cb, .entitle-paper-cb, .entitle-page-cb, .entitle-pdf-cb, .entitle-planner-cb').forEach(cb => {
        cb.checked = checkAll;
      });
    }

    async function saveStudentEntitlements() {
  if (!activeSelectedStudent) return alert('Select or load a student profile first.');

  // FIX: checkboxes marked data-via-bundle are checked+disabled purely as a VISUAL indicator that a
  // ticked bundle already covers that item (see updateBundleCoverageHighlights) — they must NOT be
  // saved as individual grants, or bundle coverage would leak into a permanent individual entitlement
  // that outlives the bundle's own expiry.
  const exams = Array.from(document.querySelectorAll('.entitle-paper-cb:checked')).filter(cb => cb.dataset.viaBundle !== 'true').map(cb => cb.value);
  const pages = Array.from(document.querySelectorAll('.entitle-page-cb:checked')).filter(cb => cb.dataset.viaBundle !== 'true').map(cb => cb.value);
  const pdfs = Array.from(document.querySelectorAll('.entitle-pdf-cb:checked')).filter(cb => cb.dataset.viaBundle !== 'true').map(cb => cb.value);
  const plannerGrants = Array.from(document.querySelectorAll('.entitle-planner-cb:checked')).filter(cb => cb.dataset.viaBundle !== 'true').map(cb => cb.value);
  const passes = Array.from(document.querySelectorAll('.entitle-pass-cb:checked')).map(cb => cb.value);

  // Round 2: snapshot what the student had BEFORE this save, so we can email them
  // only when something new was added (pure removals shouldn't trigger a "you have new access" note).
  const before = {
    passes: [...(activeSelectedStudent.passes || [])],
    exams:  [...(activeSelectedStudent.allowedExams || [])],
    pages:  [...(activeSelectedStudent.allowedPages || [])],
    pdfs:   [...(activeSelectedStudent.allowedPdfs  || [])],
    planners: [...(activeSelectedStudent.allowedPlanners || [])]
  };

  [...activeSelectedStudent.passes].forEach(id => { if (!passes.includes(id)) revokePass(activeSelectedStudent, id); });
  passes.forEach(id => { if (!activeSelectedStudent.passes.includes(id) || isPassExpired(activeSelectedStudent, id)) grantPass(activeSelectedStudent, id); });

  activeSelectedStudent.allowedExams = exams;
  activeSelectedStudent.allowedPages = pages;
  activeSelectedStudent.allowedPdfs = pdfs;
  activeSelectedStudent.allowedPlanners = plannerGrants;
  activeSelectedStudent.utr = document.getElementById('entitle-student-utr').value.trim();

  // Save to Supabase Cloud
  const { error } = await supabaseClient
    .from('students')
    .upsert({
      email: activeSelectedStudent.email,
      name: activeSelectedStudent.name || '',
      utr: activeSelectedStudent.utr,
      status: activeSelectedStudent.status || 'active',
      allowed_exams: activeSelectedStudent.allowedExams,
      allowed_pages: activeSelectedStudent.allowedPages,
      allowed_pdfs: activeSelectedStudent.allowedPdfs,
      allowed_planners: activeSelectedStudent.allowedPlanners,
      passes: activeSelectedStudent.passes,
      pass_expiry: activeSelectedStudent.passExpiry || {}
    });

  if (error) {
    alert("Error saving to cloud: " + error.message);
    return;
  }

  // Round 2: notify only if something was actually added
  const added = {
    passes: passes.filter(x => !before.passes.includes(x)),
    exams:  exams.filter(x  => !before.exams.includes(x)),
    pages:  pages.filter(x  => !before.pages.includes(x)),
    pdfs:   pdfs.filter(x   => !before.pdfs.includes(x)),
    planners: plannerGrants.filter(x => !before.planners.includes(x))
  };
  const addedAnything = added.passes.length || added.exams.length || added.pages.length || added.pdfs.length || added.planners.length;
  let emailNote = '';
  if (addedAnything) {
    const bits = [];
    if (added.passes.length) bits.push(added.passes.map(passLabel).join(', '));
    if (added.exams.length)  bits.push(`${added.exams.length} exam paper${added.exams.length > 1 ? 's' : ''}`);
    if (added.pages.length)  bits.push(`${added.pages.length} study page${added.pages.length > 1 ? 's' : ''}`);
    if (added.pdfs.length)   bits.push(`${added.pdfs.length} PDF${added.pdfs.length > 1 ? 's' : ''}`);
    if (added.planners.length) bits.push(`${added.planners.length} planner${added.planners.length > 1 ? 's' : ''}`);
    const summary = bits.join(', ');
    sendAutoEmail('access_granted', activeSelectedStudent.email, {
      name: displayNameFor(activeSelectedStudent.email),
      email: activeSelectedStudent.email,
      item_title: summary
    });
    emailNote = `\n\nA notification email has been sent to the student (see Email tools → Send log).`;
  }

  renderStudentEntitlementsDesk();
  renderSelectedStudentLoginInfo();
  renderStudentDirectoryTable();
  refreshUserScopedViews();

  // Compute a truthful count that includes papers/pages/PDFs unlocked via bundle passes,
  // not just the individually-ticked checkboxes. Otherwise a student who got everything
  // through a bundle sees "Tests: 0" in the confirmation alert, which is misleading.
  const heldBundles = (activeSelectedStudent.passes || [])
    .filter(id => !isPassExpired(activeSelectedStudent, id))
    .map(id => bundles.find(b => b.id === id))
    .filter(Boolean);
  const bundleReach = {
    exams: new Set(),
    pages: new Set(),
    pdfs:  new Set()
  };
  for (const b of heldBundles) {
    if (b.allAccess) {
      testsCatalog.forEach(p => bundleReach.exams.add(p.id));
      customPages.forEach(p => bundleReach.pages.add(p.id));
      pdfVault.forEach(d  => bundleReach.pdfs.add(d.id));
      continue;
    }
    (b.papers || []).forEach(x => bundleReach.exams.add(x));
    (b.pages  || []).forEach(x => bundleReach.pages.add(x));
    (b.pdfs   || []).forEach(x => bundleReach.pdfs.add(x));
    // Category-wide bundles unlock every paper in each covered category (+ sub-category rollup +
    // explicit alsoListCategories cross-listing) — delegates to bundleCoversPaper so this count
    // always matches what isTestUnlockedForUser will actually grant, instead of re-deriving its own
    // (previously slightly different) copy of the same logic.
    if (b.categories && b.categories.length) {
      testsCatalog.filter(p => bundleCoversPaper(b, p)).forEach(p => bundleReach.exams.add(p.id));
    }
  }
  exams.forEach(x => bundleReach.exams.add(x));
  pages.forEach(x => bundleReach.pages.add(x));
  pdfs.forEach(x  => bundleReach.pdfs.add(x));

  const totalTests = bundleReach.exams.size;
  const totalPages = bundleReach.pages.size;
  const totalPdfs  = bundleReach.pdfs.size;
  const viaBundle = {
    exams: Math.max(0, totalTests - exams.length),
    pages: Math.max(0, totalPages - pages.length),
    pdfs:  Math.max(0, totalPdfs  - pdfs.length)
  };
  const suffix = (n, viaB) => viaB > 0 ? `${n} (${viaB} via bundle)` : String(n);

  alert(`Access updated in cloud for ${activeSelectedStudent.email}!\n\n• Passes: ${passes.length ? passes.map(passLabel).join(', ') : 'none'}\n• Tests: ${suffix(totalTests, viaBundle.exams)}\n• Pages: ${suffix(totalPages, viaBundle.pages)}\n• PDFs: ${suffix(totalPdfs, viaBundle.pdfs)}${emailNote}`);
}

  async function revokeCurrentStudent() {
  if (!activeSelectedStudent) return;
  
  if (confirm(`Revoke all access and remove ${activeSelectedStudent.email} from directory?`)) {
    
    // 1. Delete the student from the Supabase cloud
    const { error: studentError } = await supabaseClient
      .from('students')
      .delete()
      .eq('email', activeSelectedStudent.email);

    // 2. Delete their progress (planners and mistakes) from the cloud
    const { error: progressError } = await supabaseClient
      .from('student_progress')
      .delete()
      .eq('email', activeSelectedStudent.email);

    if (studentError) {
      return alert("Failed to delete student from cloud: " + studentError.message);
    }

    // 3. Clear them from local memory
    studentDirectory = studentDirectory.filter(s => s.email !== activeSelectedStudent.email);
    delete plannerStore[activeSelectedStudent.email];
    
    // savePlannerStore is now async, so we await it
    await savePlannerStore(); 
    localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
    
    activeSelectedStudent = null;
    
    // 4. Reset the UI
    document.getElementById('selected-student-display').innerText = 'None Selected';
    renderSelectedStudentLoginInfo();
    document.getElementById('entitle-student-email').value = '';
    document.getElementById('entitle-student-utr').value = '';
    selectAllEntitlements(false);
    
    renderStudentEntitlementsDesk();
    if (typeof filterExamCategory === 'function') filterExamCategory(selectedCategory);
    if (typeof renderStudentDirectoryTable === 'function') renderStudentDirectoryTable();
    
    alert("Student and all associated privileges have been completely revoked.");
  }
}

