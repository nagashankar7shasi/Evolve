    /* ----------------------------------------------------
       1. EXAM CATEGORY MASTER DEFINITIONS
    ----------------------------------------------------- */
    // FIX: this used to be `const EXAM_CATEGORIES` — a hardcoded, fixed set of exactly 4 categories.
    // Every consumer in the app reads it as EXAM_CATEGORIES[id] or Object.values(EXAM_CATEGORIES),
    // so making it `let` and mutating its contents at runtime (via fetchCloudExamCategories below)
    // makes the WHOLE app treat categories as genuine admin-editable data, with zero changes needed
    // at any of the ~20 existing read sites. The 4 below are the seed/fallback values used before the
    // cloud fetch completes (and for a brand-new install that hasn't run the SQL migration yet).
    let EXAM_CATEGORIES = {
      kpsc_kas: {
        id: 'kpsc_kas',
        name: 'KPSC KAS (Gazetted)',
        desc: 'Official Preliminary Exam: Paper 1 & Paper 2 (+2.00 / -0.50, 120 Mins, Target: 120)',
        defaultScheme: { examBadge: 'KPSC KAS', marksCorrect: 2.00, marksWrong: 0.50, duration: 120, cutoff: 120 },
        order: 1, active: true
      },
      karnataka_psi: {
        id: 'karnataka_psi',
        name: 'Karnataka Police Sub-Inspector (PSI)',
        desc: 'Civil Police Sub-Inspector Paper 2 (+1.50 / -0.375, 90 Mins, Target: 110)',
        defaultScheme: { examBadge: 'Karnataka PSI', marksCorrect: 1.50, marksWrong: 0.375, duration: 90, cutoff: 110 },
        order: 2, active: true
      },
      kpsc_fda_sda: {
        id: 'kpsc_fda_sda',
        name: 'KPSC FDA / SDA / Group C',
        desc: 'First Division Assistant / Second Division Assistant GK (+1.00 / -0.25, 90 Mins, Target: 75)',
        defaultScheme: { examBadge: 'KPSC FDA/SDA', marksCorrect: 1.00, marksWrong: 0.25, duration: 90, cutoff: 75 },
        order: 3, active: true
      },
      upsc_cse: {
        id: 'upsc_cse',
        name: 'UPSC Civil Services Examination',
        desc: 'Union Public Service Commission GS Paper 1 (+2.00 / -0.666, 120 Mins, Target: 95)',
        defaultScheme: { examBadge: 'UPSC CSE', marksCorrect: 2.00, marksWrong: 0.666, duration: 120, cutoff: 95 },
        order: 4, active: true
      }
    };

    // ---- Sub-categories: a category can optionally carry parentId, e.g. a "KAS Current Affairs"
    // sub-category with parentId: 'kpsc_kas'. It's still a completely normal EXAM_CATEGORIES entry
    // (own scheme, own active flag, own everything) — parentId only changes how it's grouped in the
    // Exam Hub nav (nested under its parent's tab instead of getting a top-level tab of its own) and
    // how entitlement rolls up (a bundle covering the parent also covers papers filed directly under
    // any of its children, same as owning "KAS" should reasonably include "KAS Current Affairs").
    function categoryAndAncestors(catId) {
      const out = [];
      let cur = catId;
      let guard = 0; // defends against a corrupted/circular parentId chain
      while (cur && EXAM_CATEGORIES[cur] && guard++ < 10) {
        out.push(cur);
        cur = EXAM_CATEGORIES[cur].parentId || null;
      }
      return out;
    }
    function categoryChildren(catId) {
      return Object.values(EXAM_CATEGORIES).filter(c => c.parentId === catId);
    }
    function categoryAndDescendants(catId) {
      const out = [catId];
      categoryChildren(catId).forEach(c => out.push(...categoryAndDescendants(c.id)));
      return out;
    }
    function categoryDisplayName(catId) {
      const c = EXAM_CATEGORIES[catId];
      return (c && c.name) || catId || '—';
    }

    // Turns a Supabase/Postgres error object (or anything else thrown) into a readable string.
    // Needed because `console.error('label:', err)` prints an inspectable object in a live
    // browser console, but the moment that gets copy/pasted as text (e.g. to report a bug) it
    // collapses to the useless literal "[object Object]" — this makes the actual reason (missing
    // table, RLS denial, bad key, network) visible in the text itself, not just in a live console.
    function fmtErr(err) {
      if (!err) return String(err);
      if (typeof err === 'string') return err;
      const parts = [];
      if (err.message) parts.push(err.message);
      if (err.code) parts.push(`code: ${err.code}`);
      if (err.details) parts.push(`details: ${err.details}`);
      if (err.hint) parts.push(`hint: ${err.hint}`);
      if (parts.length) return parts.join(' | ');
      try { return JSON.stringify(err); } catch (e) { return String(err); }
    }

    // ---- Cloud sync for the exam category master ----
    async function fetchCloudExamCategories() {
      try {
        const { data, error } = await supabaseClient.from('exam_categories').select('*');
        if (error) throw error;
        if (!data || !data.length) return;  // cloud table empty/not migrated yet — keep local defaults
        const cloudIds = new Set(data.map(r => r.id));
        // BUG FIX (caused a real data loss incident): this used to also DELETE any local category
        // missing from `data` here, on the theory that "missing from the cloud" meant "deleted in
        // the cloud". That's unsafe — it's equally true whenever a save/seed silently failed to
        // reach the cloud (as every single one did for a long stretch, while this table was
        // missing its 'desc' column: every upsert errored out, alerted the admin, but still kept
        // the category alive locally). The cloud became the INCOMPLETE copy, and this function
        // blindly trusted it — wiping out categories that only ever existed locally, on every
        // reload. A category is now only ever removed via the explicit "Delete category" admin
        // action (deleteExamCategoryMaster), which deletes it from the cloud and locally together.
        data.forEach(r => {
          EXAM_CATEGORIES[r.id] = {
            id: r.id, name: r.name, desc: r.desc || '',
            defaultScheme: r.default_scheme || { examBadge: r.name, marksCorrect: 2, marksWrong: 0.5, duration: 120, cutoff: 100 },
            order: r.order_num || 0, active: r.active !== false,
            // show_scoring_pattern is a newer column — if it's missing/undefined on an older row
            // (or the column hasn't been added to the cloud table yet), default to shown so
            // nothing changes for existing setups.
            showScoringPattern: r.show_scoring_pattern !== false,
            // parent_id is newer still — missing/undefined/empty-string all mean "top-level", same
            // as it always was before sub-categories existed.
            parentId: r.parent_id || null
          };
        });
        // Self-heal: push up any category that exists locally (including the 4 built-in defaults
        // this app always starts from) but is missing from the cloud, so a repeat of the failure
        // above closes the gap automatically instead of the gap silently persisting forever.
        const missingFromCloud = Object.values(EXAM_CATEGORIES).filter(c => !cloudIds.has(c.id));
        for (const c of missingFromCloud) {
          const { error: upErr } = await supabaseClient.from('exam_categories').upsert({
            id: c.id, name: c.name, desc: c.desc || '', default_scheme: c.defaultScheme,
            order_num: c.order || 0, active: c.active !== false, show_scoring_pattern: c.showScoringPattern !== false,
            parent_id: c.parentId || null
          });
          if (upErr) console.error(`Failed to restore exam category "${c.id}" to the cloud:`, fmtErr(upErr));
        }
        localStorage.setItem('kas_exam_categories', JSON.stringify(EXAM_CATEGORIES));
        refreshAllCategoryUI();
      } catch (err) {
        console.error('fetchCloudExamCategories failed:', fmtErr(err));
      }
    }

    // First-run migration: push the 4 built-in categories to the cloud if the table is empty, so the
    // cloud becomes authoritative without the admin having to manually recreate them.
    async function ensureExamCategoriesSeeded() {
      try {
        const { data, error } = await supabaseClient.from('exam_categories').select('id').limit(1);
        if (error) throw error;
        if (data && data.length) return;  // already seeded
        for (const c of Object.values(EXAM_CATEGORIES)) {
          await supabaseClient.from('exam_categories').upsert({
            id: c.id, name: c.name, desc: c.desc || '', default_scheme: c.defaultScheme,
            order_num: c.order || 0, active: c.active !== false, show_scoring_pattern: c.showScoringPattern !== false,
            parent_id: c.parentId || null
          });
        }
      } catch (err) {
        console.error('ensureExamCategoriesSeeded failed:', fmtErr(err));
      }
    }

    async function saveExamCategory(cat) {
      EXAM_CATEGORIES[cat.id] = cat;
      localStorage.setItem('kas_exam_categories', JSON.stringify(EXAM_CATEGORIES));
      try {
        const { error } = await supabaseClient.from('exam_categories').upsert({
          id: cat.id, name: cat.name, desc: cat.desc || '', default_scheme: cat.defaultScheme,
          order_num: cat.order || 0, active: cat.active !== false, show_scoring_pattern: cat.showScoringPattern !== false,
          parent_id: cat.parentId || null
        });
        if (error) throw error;
        return true;
      } catch (err) {
        alert('Saved locally, but cloud sync failed: ' + err.message);
        return false;
      }
    }

    async function deleteExamCategoryMaster(id) {
      const cat = EXAM_CATEGORIES[id];
      if (!cat) return;
      // Guard: block deletion if anything still references this category. Unlike bundle deletion
      // (where "revoke then delete" is a safe, mechanical fix), a paper or bundle left pointing at a
      // category id that no longer exists would break its rendering everywhere that looks the id up —
      // there's no equally safe automatic fix, so this asks the admin to reassign/remove those first.
      const paperCount = testsCatalog.filter(p => p.category === id || (p.extraCategories || []).includes(id) || (p.alsoListCategories || []).includes(id)).length;
      const bundleCount = bundles.filter(b => (b.categories || []).includes(id)).length;
      const childCount = categoryChildren(id).length;
      if (paperCount || bundleCount || childCount) {
        return alert(
          `Can't delete "${cat.name}" — it's still in use:\n` +
          (paperCount ? `• ${paperCount} test paper(s)\n` : '') +
          (bundleCount ? `• ${bundleCount} bundle(s)\n` : '') +
          (childCount ? `• ${childCount} sub-categor${childCount > 1 ? 'ies' : 'y'} nested under it\n` : '') +
          `\nReassign or delete those first, then delete the category.`
        );
      }
      if (!confirm(`Delete the exam category "${cat.name}"? This cannot be undone.`)) return;
      delete EXAM_CATEGORIES[id];
      localStorage.setItem('kas_exam_categories', JSON.stringify(EXAM_CATEGORIES));
      try {
        const { error } = await supabaseClient.from('exam_categories').delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        alert('Deleted locally, but cloud delete failed: ' + err.message);
      }
      refreshAllCategoryUI();
    }

    // Re-renders every place that displays the category list, called after any add/edit/delete/reorder
    // and after the cloud fetch completes. Centralizing this avoids the exact bug pattern this whole
    // audit was about — 4 separate hardcoded spots that could silently drift out of sync.
    function refreshAllCategoryUI() {
      if (typeof renderCategoryTabs === 'function') renderCategoryTabs();
      if (typeof populateAllCategoryDropdowns === 'function') populateAllCategoryDropdowns();
      if (typeof renderExamCategoriesAdmin === 'function') renderExamCategoriesAdmin();
      if (typeof renderTestsCatalogAdmin === 'function') renderTestsCatalogAdmin();
    }

    // ---- Subject registry ----
    // FIX: "subjects aren't captured clearly" — q.subject used to be pure free text with no
    // canonical list, so "Polity" / "polity" / "Indian Polity" from different uploads all fragmented
    // the Topic Builder's subject filter into near-duplicate chips. examSubjects holds a managed,
    // per-category list of canonical subject names (Studio's manual editor picks from this instead of
    // typing free text); a canonicalizeSubject() helper folds obviously-matching free text (CSV/paste
    // uploads, case/whitespace variants) onto the registry automatically, and the admin cleanup tool
    // (subjectCleanupScan/applySubjectMerge) handles anything that slipped through as a real duplicate.
    let examSubjects = JSON.parse(localStorage.getItem('kas_exam_subjects') || 'null') || {};
    // Per-category, per-subject importance weight (1-5, default 3/"Medium") — e.g. "Fundamental Rights"
    // can be weighted higher than a minor topic so Generate-from-Bank suggests pulling more of it,
    // without needing a separate Topic entity: the existing Subject registry already lets an admin be
    // as granular as they like (nothing stops "Fundamental Rights" from being its own Subject rather
    // than lumped under "Polity"), so weight just rides on top of whatever granularity is already there.
    // Stored as { [categoryId]: { [subjectName]: 1-5 } }; a subject with no entry here defaults to 3.
    let examSubjectWeights = JSON.parse(localStorage.getItem('kas_exam_subject_weights') || 'null') || {};

    async function fetchCloudExamSubjects() {
      try {
        const { data, error } = await supabaseClient.from('exam_subjects').select('*');
        if (error) throw error;
        if (data && data.length) {
          const next = {}, nextWeights = {};
          data.forEach(r => {
            next[r.category_id] = Array.isArray(r.subjects) ? r.subjects : [];
            nextWeights[r.category_id] = (r.weights && typeof r.weights === 'object') ? r.weights : {};
          });
          examSubjects = next;
          examSubjectWeights = nextWeights;
          localStorage.setItem('kas_exam_subjects', JSON.stringify(examSubjects));
          localStorage.setItem('kas_exam_subject_weights', JSON.stringify(examSubjectWeights));
        }
      } catch (err) {
        console.error('fetchCloudExamSubjects failed:', fmtErr(err));
      }
    }

    async function saveExamSubjects(categoryId, list) {
      examSubjects[categoryId] = list;
      localStorage.setItem('kas_exam_subjects', JSON.stringify(examSubjects));
      try {
        const { error } = await supabaseClient.from('exam_subjects').upsert(
          { category_id: categoryId, subjects: list, weights: examSubjectWeights[categoryId] || {}, updated_at: new Date().toISOString() },
          { onConflict: 'category_id' }
        );
        if (error) throw error;
        return true;
      } catch (err) {
        alert('Saved locally, but cloud sync failed: ' + err.message);
        return false;
      }
    }

    // Returns 1-5; a subject with no explicit weight set defaults to 3 ("Medium") rather than being
    // treated as 0/unimportant — an admin who never touches weights should see plain, even sampling.
    function subjectWeight(categoryId, subjectName) {
      const w = (examSubjectWeights[categoryId] || {})[subjectName];
      return (Number.isInteger(w) && w >= 1 && w <= 5) ? w : 3;
    }

    function setSubjectWeight(categoryId, subjectName, weight) {
      examSubjectWeights[categoryId] = examSubjectWeights[categoryId] || {};
      examSubjectWeights[categoryId][subjectName] = weight;
      localStorage.setItem('kas_exam_subject_weights', JSON.stringify(examSubjectWeights));
      saveExamSubjects(categoryId, examSubjects[categoryId] || []); // re-upserts subjects+weights together
    }

    // Case/whitespace-insensitive match against a category's registry. Returns the CANONICAL spelling
    // if a near-match exists (so "polity", "Polity ", "POLITY" all collapse onto whatever the registry
    // already calls it), otherwise returns the trimmed input unchanged (new/unregistered subject —
    // left as-is rather than silently dropped, so bulk upload is never blocked by this).
    function canonicalizeSubject(categoryId, raw) {
      const trimmed = String(raw || '').trim();
      if (!trimmed) return '';
      const list = examSubjects[categoryId] || [];
      const hit = list.find(s => s.toLowerCase() === trimmed.toLowerCase());
      return hit || trimmed;
    }

    // Registers a subject into a category's list if it isn't already there (case-insensitive check),
    // keeping the list alphabetically sorted. Used both by the Studio "+ Add new subject" flow and by
    // CSV/paste ingestion (so a genuinely new subject that appears in an upload becomes a first-class,
    // selectable registry entry going forward, instead of living only as loose text on old questions).
    function registerSubjectIfNew(categoryId, name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      const list = examSubjects[categoryId] || [];
      if (list.some(s => s.toLowerCase() === trimmed.toLowerCase())) return;
      const next = [...list, trimmed].sort((a, b) => a.localeCompare(b));
      saveExamSubjects(categoryId, next);
    }

    // Batched version for bulk ingestion (CSV upload, which can introduce many distinct new
    // subjects in one paper). Registers them all into ONE saveExamSubjects() call/round-trip
    // instead of one per subject -- besides being faster, this means a cloud-sync problem surfaces
    // as at most one alert instead of one per new subject (a 100-question KPSC/UPSC prelims paper
    // can easily span 8-15 subjects, which previously meant clicking through that many blocking
    // alerts in a row for a single underlying failure).
    function registerSubjectsIfNew(categoryId, names) {
      const list = examSubjects[categoryId] || [];
      const have = new Set(list.map(s => s.toLowerCase()));
      const toAdd = [];
      (names || []).forEach(raw => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (have.has(key)) return;
        have.add(key); // dedupe within this same batch too (two rows naming the same new subject)
        toAdd.push(trimmed);
      });
      if (!toAdd.length) return Promise.resolve(true); // nothing new -- treat as a clean no-op success
      const next = [...list, ...toAdd].sort((a, b) => a.localeCompare(b));
      return saveExamSubjects(categoryId, next); // returns the save's own success/failure so a caller can await it
    }

    // ---- Subject groups ----
    // Lets the admin merge several registry subjects (above) into one named group per category --
    // e.g. "History" + "Art & Culture" -> "Humanities" -- purely for display/practice purposes.
    // Unlike the cleanup tool's merge (applySubjectMerge, which rewrites q.subject permanently and
    // is irreversible), this never touches a single question's own subject tag -- it's a separate,
    // editable mapping consulted at render time, so ungrouping a subject is just as easy as grouping
    // it. Driven from Dev Console → Exam Categories → each category's "📚 Subjects" panel.
    // Stored as { [categoryId]: [{ name, members: [subjectName, ...] }, ...] }. A subject belongs to
    // at most one group within its category (enforced by the admin UI, not here).
    let subjectGroups = JSON.parse(localStorage.getItem('kas_subject_groups') || 'null') || {};

    async function fetchCloudSubjectGroups() {
      try {
        const { data, error } = await supabaseClient.from('subject_groups').select('*');
        if (error) throw error;
        const next = {};
        (data || []).forEach(r => {
          next[r.category_id] = next[r.category_id] || [];
          next[r.category_id].push({ name: r.group_name, members: Array.isArray(r.member_subjects) ? r.member_subjects : [] });
        });
        subjectGroups = next;
        localStorage.setItem('kas_subject_groups', JSON.stringify(subjectGroups));
      } catch (err) {
        console.error('fetchCloudSubjectGroups failed:', fmtErr(err));
      }
    }

    async function saveSubjectGroup(categoryId, groupName, members) {
      const list = subjectGroups[categoryId] || [];
      const idx = list.findIndex(g => g.name === groupName);
      subjectGroups[categoryId] = idx >= 0
        ? list.map((g, i) => i === idx ? { name: groupName, members } : g)
        : [...list, { name: groupName, members }];
      localStorage.setItem('kas_subject_groups', JSON.stringify(subjectGroups));
      try {
        const { error } = await supabaseClient.from('subject_groups').upsert(
          { category_id: categoryId, group_name: groupName, member_subjects: members, updated_at: new Date().toISOString() },
          { onConflict: 'category_id,group_name' }
        );
        if (error) throw error;
        return true;
      } catch (err) {
        alert('Saved locally, but cloud sync failed: ' + err.message);
        return false;
      }
    }

    async function deleteSubjectGroup(categoryId, groupName) {
      subjectGroups[categoryId] = (subjectGroups[categoryId] || []).filter(g => g.name !== groupName);
      localStorage.setItem('kas_subject_groups', JSON.stringify(subjectGroups));
      try {
        const { error } = await supabaseClient.from('subject_groups').delete().eq('category_id', categoryId).eq('group_name', groupName);
        if (error) throw error;
      } catch (err) {
        alert('Removed locally, but cloud sync failed: ' + err.message);
      }
    }

    // Returns the group name a raw subject belongs to within a category, or the raw subject
    // itself unchanged if it isn't in any group (case/whitespace-insensitive match, same leniency
    // as canonicalizeSubject -- an old attempt's frozen subject text shouldn't fail to match just
    // because of a casing difference from whatever the registry calls it today).
    function subjectGroupNameFor(categoryId, rawSubject) {
      const trimmed = String(rawSubject || '').trim();
      if (!trimmed) return rawSubject;
      const groups = subjectGroups[categoryId] || [];
      const hit = groups.find(g => g.members.some(m => m.toLowerCase() === trimmed.toLowerCase()));
      return hit ? hit.name : rawSubject;
    }

