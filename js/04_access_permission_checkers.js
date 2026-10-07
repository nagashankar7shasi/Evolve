    /* ----------------------------------------------------
       4. ACCESS PERMISSION CHECKERS
    ----------------------------------------------------- */
    function isAdmin() {
      // Admin can temporarily "View as student" — during that, isAdmin() returns false so
      // gating / prices / unlock checks all behave like a real student. Toggle via toggleStudentPreview().
      if (window._viewAsStudent) return false;
      return !!currentUser && currentUser.role === 'admin';
    }

    // ---- View-as-student mode ----
    // Lets an admin preview the site exactly as a signed-up student would see it, without logging out.
    // Hides admin UI (buttons, badges, panels), makes isAdmin() return false, and shows a floating
    // banner with an "Exit preview" button. Preserves currentUser so no re-login needed after exit.
    function toggleStudentPreview() {
      window._viewAsStudent = !window._viewAsStudent;
      const on = window._viewAsStudent;
      document.body.classList.toggle('viewing-as-student', on);
      // Refresh views so gating re-evaluates
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderHomePage === 'function') renderHomePage();
      if (typeof filterExamCategory === 'function' && typeof selectedCategory !== 'undefined') filterExamCategory(selectedCategory);
      if (typeof refreshUserScopedViews === 'function') refreshUserScopedViews();
      if (typeof updateAuthUI === 'function') updateAuthUI();
      // Show / hide the banner
      let banner = document.getElementById('student-preview-banner');
      if (on) {
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'student-preview-banner';
          banner.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9998;background:#f59e0b;color:#0f172a;padding:8px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(245,158,11,.4);font-family:system-ui,sans-serif;font-size:12px;font-weight:800;display:flex;align-items:center;gap:10px;';
          banner.innerHTML = `👁️ Viewing as student <button onclick="toggleStudentPreview()" style="background:#0f172a;color:#fff;border:0;padding:4px 10px;border-radius:999px;font-weight:800;cursor:pointer;font-size:11px;">Exit preview</button>`;
          document.body.appendChild(banner);
        }
        navigate('home');
      } else {
        banner && banner.remove();
      }
    }

    function isStudentBlocked(student) {
      return !!student.status && student.status !== 'active';
    }

    function getStudentRecord(email) {
      const e = normalizeEmail(email);
      const st = studentDirectory.find(x => x.email === e) || null;
      if (st) ['allowedExams', 'allowedPages', 'allowedPdfs', 'allowedPlanners', 'passes'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
      return st;
    }

    // The directory record of whoever is logged in (null for guests, admins and deactivated students)
    function getCurrentStudent() {
      if (!currentUser || isAdmin()) return null;
      const student = getStudentRecord(currentUser.email);
      return student && !isStudentBlocked(student) ? student : null;
    }

    function isTestUnlockedForUser(testId) {
      const paper = testsCatalog.find(p => p.id === testId);
      // An inactive paper is a hard "no" for everyone except the admin (who can still open it from
      // the admin studio/list to review or re-enable it) — it should behave as if it doesn't exist,
      // even for a student who already paid for it or holds a covering bundle.
      if (paper && paper.active === false && !isAdmin()) return false;
      // Number() coercion defends against price arriving as a numeric string ("0") from the DB —
      // strict === would otherwise fail to recognize it as free, or (worse, in other spots) a stray
      // truthy-string check could recognize it as free when it shouldn't be. Being explicit here closes
      // that whole class of risk.
      // bundleOnly papers skip this shortcut entirely, even if price is 0/blank -- they're deliberately
      // never "free for everyone", only reachable via a covering bundle or an explicit admin grant
      // below. Without this guard, a bundle-only paper with no standalone price set would otherwise
      // unlock for every visitor, defeating the whole point of marking it bundle-only.
      if (paper && !paper.bundleOnly && Number(paper.price) === 0) return true;
      if (isAdmin()) return true;
      const student = getCurrentStudent();
      if (!student) return false;
      if (activeBundlesFor(student).some(b => bundleCoversPaper(b, paper))) return true;
      return student.allowedExams.includes(testId);
    }

    // A page is open if, for every paid page on its path (itself or above), the student owns that page,
    // owns a page above it, or holds a bundle that includes one of them.
    function pageEntitledNodes(page) {
      const chain = pageAncestry(page);
      if (isAdmin()) return chain.map(() => true);
      const student = getCurrentStudent();
      if (!student) return chain.map(() => false);
      const held = activeBundlesFor(student);
      return chain.map(p => student.allowedPages.includes(p.id) || held.some(b => b.allAccess || b.pages.includes(p.id)));
    }

    // The paid page whose purchase would unlock this one (null if already open)
    function lockingPageFor(page) {
      const chain = pageAncestry(page);
      const entitled = pageEntitledNodes(page);
      for (let i = 0; i < chain.length; i++) {
        if (isGatedPage(chain[i]) && !entitled.slice(0, i + 1).some(Boolean)) return chain[i];
      }
      return null;
    }

    function isPageUnlockedForUser(page) {
      return !lockingPageFor(page);
    }

    function isPdfUnlockedForUser(doc) {
      if (doc.access === 'free' || Number(doc.price) === 0) return true;
      if (isAdmin()) return true;
      const student = getCurrentStudent();
      return !!student && (activeBundlesFor(student).some(b => bundleCoversPdf(b, doc)) || student.allowedPdfs.includes(doc.id));
    }

