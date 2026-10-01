    /* ----------------------------------------------------
       11a. STUDY PLANNERS: KPSC KAS + UPSC CSE (per-student checklists on the dashboard)
    ----------------------------------------------------- */
    const PLANNER_TAGS = {
      kn: { cls: 'kp-tag-kn', label: '★ KARNATAKA FOCUS' },
      opt: { cls: 'kp-tag-opt', label: 'OPTIONAL SUBJECT' },
      ca: { cls: 'kp-tag-ca', label: 'CURRENT AFFAIRS' }
    };

    const PLANNER_SEED = {
      kpsc: {
        label: 'KPSC KAS',
        title: 'KAS Study Planner',
        sub: 'Karnataka Administrative Service · KPSC',
        category: 'kpsc_kas',
        prelims: {
          title: 'Prelims — 16-Week Plan',
          note: 'Paper 1 (200) + Paper 2 (200) · objective · 2 hrs each',
          mockFrom: 14,
          weeks: [
            { w: 1, focus: "Indian Polity — Constitution, FRs, DPSP, amendments", extra: "Newspaper (The Hindu / Prajavani) 1 hr daily", target: "Core polity notes made", book: "Laxmikanth" },
            { w: 2, focus: "Polity — Union & State, Panchayati Raj, commissions", extra: "Mental ability 30 min daily", target: "Polity complete + topic test", book: "Laxmikanth" },
            { w: 3, focus: "History — Ancient & Medieval India, culture, religions", extra: "Current affairs notes", target: "NCERT-level coverage done", book: "NCERT" },
            { w: 4, focus: "History — Modern India, freedom movement, reformers", extra: "Mental ability 30 min daily", target: "1857–1947 timeline chart", book: "Spectrum" },
            { w: 5, focus: "Karnataka History — Kadambas → Hoysalas, Vijayanagara", extra: "State current affairs", target: "Dynasty + contributions tables", book: "Suryanath Kamath", tag: 'kn' },
            { w: 6, focus: "Karnataka History — Modern Mysore, freedom movement, Unification", extra: "Mental ability 30 min daily", target: "1799–1956 timeline", book: "Suryanath Kamath", tag: 'kn' },
            { w: 7, focus: "Geography — World & India (physical, resources, industry)", extra: "Map practice 15 min daily", target: "Physiography notes", book: "G.C. Leong + NCERT" },
            { w: 8, focus: "Geography of Karnataka — climate, crops, minerals, urbanisation", extra: "State CA revision", target: "Karnataka facts sheet", book: "State Board texts", tag: 'kn' },
            { w: 9, focus: "Indian Economy — growth, planning, five-year plans", extra: "Mental ability mock", target: "Economy basics done", book: "Ramesh Singh" },
            { w: 10, focus: "Karnataka Economy — Economic Survey, budget, rural development", extra: "Data-interpretation drills", target: "State schemes list", book: "K'taka Economic Survey", tag: 'kn' },
            { w: 11, focus: "General Science — Physics, Chemistry, Biology basics", extra: "Current affairs", target: "NCERT 6–10 revised", book: "NCERT 6–10" },
            { w: 12, focus: "Science & Tech — space, energy, IT, biotech", extra: "Mental ability mock", target: "Recent missions & tech list", book: "PIB / Yojana" },
            { w: 13, focus: "Environment & Ecology — ecosystems, pollution, acts, climate", extra: "CA consolidation (national + state)", target: "Acts & policies table", book: "Shankar IAS" },
            { w: 14, focus: "Full Mocks 1 & 2 (Paper 1 + Paper 2) + error analysis", extra: "Weak-area patching", target: "Benchmark score set", book: "KPSC PYQs" },
            { w: 15, focus: "Full Mocks 3 & 4 + PYQ solving", extra: "Karnataka rapid revision", target: "Accuracy above 60%", book: "KPSC PYQs" },
            { w: 16, focus: "Final revision — notes, charts, PYQs only", extra: "Light mocks, good sleep", target: "Exam-ready", book: "Your own notes" },
          ]
        },
        mains: {
          title: 'Mains — 14-Week Plan',
          note: 'Essay + GS I–IV (250 each) · Kannada & English qualifying',
          mockFrom: 13,
          weeks: [
            { w: 1, focus: "GS-I §I: India + Karnataka history (Units 1–3)", aw: "2 answers/day", target: "Dynasty & reformer fact tables", tag: 'kn' },
            { w: 2, focus: "GS-I §I: Vijayanagara, Modern Mysore, Unification (Units 4–6)", aw: "2 answers/day", target: "Karnataka history complete", tag: 'kn' },
            { w: 3, focus: "GS-I §II: Social & political perspective (7 units)", aw: "3 answers/day", target: "Havnur / Nanjundappa report notes", tag: 'kn' },
            { w: 4, focus: "GS-I §III: Economy, planning, rural dev + data analysis", aw: "3 answers/day", target: "Economic Survey data bank" },
            { w: 5, focus: "GS-II §I: Geography — world, India, Karnataka", aw: "3 answers/day", target: "Map diagrams for answers", tag: 'kn' },
            { w: 6, focus: "GS-II §II: Indian Constitution (7 units)", aw: "3/day + sectional test", target: "Articles & amendments reckoner" },
            { w: 7, focus: "GS-II §III: Public admin, management tools, IR", aw: "3 answers/day", target: "PERT/CPM, SWOT, UN bodies notes" },
            { w: 8, focus: "GS-III §I: Science & Tech, IT, space, energy", aw: "3 answers/day", target: "Govt tech missions list" },
            { w: 9, focus: "GS-III §II: Agriculture, health, biotech, husbandry", aw: "3/day + sectional test", target: "Agri schemes (NAIS, WBCIS) table" },
            { w: 10, focus: "GS-III §III: Environment & ecology (6 units)", aw: "3 answers/day", target: "Acts + Karnataka examples", tag: 'kn' },
            { w: 11, focus: "GS-IV: Ethics, integrity, aptitude + case studies", aw: "2 case studies/day", target: "Quote bank of moral thinkers" },
            { w: 12, focus: "Essay practice + Kannada & English qualifying papers", aw: "1 essay + language drills daily", target: "Essay structure templates", tag: 'kn' },
            { w: 13, focus: "Full mocks — GS-I & GS-II + evaluation", aw: "Timed writing", target: "Fix structure & timing" },
            { w: 14, focus: "Full mocks — GS-III, GS-IV, Essay + final revision", aw: "Timed writing", target: "Exam-ready" },
          ]
        },
        answerRule: '✍️ <b>Answer rule:</b> intro → body (sub-headings, flowcharts, maps) → conclusion. Add a <b>Karnataka example</b> in almost every answer. ~8–9 min per question.',
        daily: [
          "2 hrs core subject (per weekly plan)",
          "1 hr current affairs — national + Karnataka",
          "30 min mental ability / aptitude",
          "30 min revision of yesterday's topics",
          "15 min map work / fact tables (Geo weeks)",
        ],
        revision: 'Revise each subject <b style="color:#FFC531">3 times</b>: right after completion → pre-mock phase (weeks 14–15) → final week. One page of notes per topic, everything in tables & charts.',
        resourcesNote: 'From your syllabus book + standard KAS list',
        resources: [
          { g: "Polity", items: ["M. Laxmikanth — Indian Polity"] },
          { g: "History", items: ["NCERT (Ancient & Medieval)", "Spectrum — Modern India", "Suryanath Kamath — Concise History of Karnataka"] },
          { g: "Geography", items: ["G.C. Leong — Physical Geography", "NCERT 11–12", "Karnataka State Board (State Geography)"] },
          { g: "Economy", items: ["Ramesh Singh — Indian Economy", "Karnataka Economic Survey", "Union & Karnataka Budgets"] },
          { g: "Environment", items: ["Shankar IAS — Environment"] },
          { g: "Ethics (GS-IV)", items: ["Lexicon — Ethics, Integrity & Aptitude"] },
          { g: "Mental Ability", items: ["R.S. Aggarwal — Quantitative Aptitude", "R.S. Aggarwal — Verbal & Non-Verbal Reasoning"] },
          { g: "Current Affairs", items: ["The Hindu (daily)", "Prajavani (daily)", "Yojana & Kurukshetra (monthly)", "PIB + PRS Legislative Research", "Spardha Vijetha / Spardha Spoorthi (state CA)"] },
          { g: "Practice", items: ["KPSC previous year question papers"] },
        ]
      },

      upsc: {
        label: 'UPSC CSE',
        title: 'CSE Study Planner',
        sub: 'Civil Services Examination · UPSC',
        category: 'upsc_cse',
        prelims: {
          title: 'Prelims — 16-Week Plan',
          note: 'GS Paper I (200) + CSAT Paper II (200, qualifying at 33%) · objective · 2 hrs each · ⅓ negative marking',
          mockFrom: 14,
          weeks: [
            { w: 1, focus: "Polity — Constitution, Preamble, FRs, DPSP, Parliament", extra: "Newspaper (The Hindu / Indian Express) 1 hr daily", target: "Polity notes, Parts I–V", book: "Laxmikanth" },
            { w: 2, focus: "Polity — Judiciary, federalism, local government, constitutional bodies", extra: "CSAT 30 min daily", target: "Polity complete + 100 MCQs", book: "Laxmikanth" },
            { w: 3, focus: "Ancient & Medieval India — dynasties, society, administration", extra: "Current affairs notes", target: "Chronology chart", book: "Old NCERTs (R.S. Sharma, Satish Chandra)" },
            { w: 4, focus: "Art & Culture — architecture, painting, performing arts, religions", extra: "CSAT 30 min daily", target: "Culture fact tables", book: "Nitin Singhania" },
            { w: 5, focus: "Modern India — 1757–1885, British policies, reform movements", extra: "Current affairs notes", target: "Governors-General & Acts table", book: "Spectrum" },
            { w: 6, focus: "Modern India — national movement 1885–1947", extra: "CSAT 30 min daily", target: "Movement timeline", book: "Spectrum / Bipan Chandra" },
            { w: 7, focus: "Physical Geography — geomorphology, climatology, oceanography", extra: "Map practice 15 min daily", target: "World physical-map notes", book: "G.C. Leong + NCERT 11" },
            { w: 8, focus: "Indian Geography — physiography, rivers, climate, agriculture, resources", extra: "Map practice 15 min daily", target: "India maps: rivers, passes, parks", book: "NCERT 11–12 + Atlas" },
            { w: 9, focus: "Economy — national income, money & banking, inflation, fiscal policy", extra: "CSAT 30 min daily", target: "Economy basics done", book: "Ramesh Singh" },
            { w: 10, focus: "Economy — external sector, budget, Economic Survey, major schemes", extra: "Data-interpretation drills", target: "Survey + Budget highlights", book: "Economic Survey + Union Budget" },
            { w: 11, focus: "Environment — ecology, biodiversity, protected areas, conventions", extra: "Current affairs notes", target: "Conventions & protected-areas table", book: "Shankar IAS" },
            { w: 12, focus: "Science & Tech — space, defence, biotech, IT, health", extra: "CSAT sectional test", target: "Recent S&T developments list", book: "NCERT 6–10 + PIB" },
            { w: 13, focus: "Current affairs consolidation — IR, schemes, reports & indices (last 12–18 months)", extra: "CSAT full mock", target: "Monthly CA revised", book: "Monthly CA compilation", tag: 'ca' },
            { w: 14, focus: "Full Mocks 1–3 (GS + CSAT) + error analysis", extra: "Weak-area patching", target: "Benchmark score set", book: "Test series" },
            { w: 15, focus: "Full Mocks 4–6 + last 10 years' PYQs", extra: "Rapid static revision", target: "Scoring above last year's cutoff", book: "UPSC PYQs" },
            { w: 16, focus: "Final revision — static notes + current affairs only", extra: "Light mocks, good sleep", target: "Exam-ready", book: "Your own notes" },
          ]
        },
        mains: {
          title: 'Mains — 16-Week Plan',
          note: 'Essay + GS I–IV + Optional I & II (250 each) · Indian language & English qualifying (300 each)',
          mockFrom: 14,
          weeks: [
            { w: 1, focus: "GS-I: Indian heritage & culture, modern history", aw: "2 answers/day", target: "Culture & history value-add notes" },
            { w: 2, focus: "GS-I: World history, post-independence consolidation", aw: "2 answers/day", target: "World history timeline" },
            { w: 3, focus: "GS-I: Indian society — diversity, women, urbanisation, globalisation", aw: "3 answers/day", target: "Society data & keyword bank" },
            { w: 4, focus: "GS-I: Geography — resources, industry location, hazards", aw: "3 answers/day", target: "Diagram & map bank" },
            { w: 5, focus: "GS-II: Constitution, federalism, separation of powers, bodies", aw: "3 answers/day", target: "Articles & SC judgments sheet" },
            { w: 6, focus: "GS-II: Governance, social justice, welfare schemes, IR", aw: "3/day + sectional test", target: "Schemes & bilateral-relations tables" },
            { w: 7, focus: "GS-III: Economy — growth, inclusion, budgeting, agriculture, infrastructure", aw: "3 answers/day", target: "Economic Survey data bank" },
            { w: 8, focus: "GS-III: S&T, environment, disaster management, internal security", aw: "3/day + sectional test", target: "Examples & committees list" },
            { w: 9, focus: "GS-IV: Ethics theory, thinkers, attitude, emotional intelligence, probity", aw: "2 answers/day", target: "Quote bank + definitions" },
            { w: 10, focus: "GS-IV: Case studies", aw: "2 case studies/day", target: "Case-study answer framework" },
            { w: 11, focus: "Optional Paper I — full syllabus pass", aw: "2 answers/day", target: "Optional P-I notes + PYQs", tag: 'opt' },
            { w: 12, focus: "Optional Paper II — full syllabus pass", aw: "2 answers/day", target: "Optional P-II notes + PYQs", tag: 'opt' },
            { w: 13, focus: "Essay practice + Indian language & English qualifying papers", aw: "2 essays/week + language drills", target: "Essay structure & quote bank" },
            { w: 14, focus: "Full mocks — Essay, GS-I, GS-II + evaluation", aw: "Timed writing", target: "Fix structure & timing" },
            { w: 15, focus: "Full mocks — GS-III, GS-IV, Optional I & II", aw: "Timed writing", target: "Evaluator feedback applied", tag: 'opt' },
            { w: 16, focus: "Final revision — value-add notes, data, diagrams", aw: "1 answer/day to stay warm", target: "Exam-ready" },
          ]
        },
        answerRule: '✍️ <b>Answer rule:</b> intro → body (sub-headings, diagrams, data) → way forward / conclusion. Cite a <b>committee, report or SC judgment</b> where it fits. ~7 min per 10-marker, ~11 min per 15-marker.',
        daily: [
          "2–3 hrs core subject (per weekly plan)",
          "1 hr newspaper — The Hindu / Indian Express",
          "30 min CSAT — quant, reasoning, comprehension",
          "30 min revision of yesterday's topics",
          "25 MCQs (Prelims weeks) or 1 timed answer (Mains weeks)",
        ],
        revision: 'Revise each static subject <b style="color:#FFC531">3 times</b>: right after completion → pre-mock phase (weeks 14–15) → final week. Keep current affairs linked to the static topic it belongs to.',
        resourcesNote: 'Standard UPSC CSE booklist',
        resources: [
          { g: "Polity", items: ["M. Laxmikanth — Indian Polity"] },
          { g: "History & Culture", items: ["NCERTs (Class 6–12)", "Spectrum — Modern India", "Bipan Chandra — India's Struggle for Independence", "Nitin Singhania — Indian Art & Culture"] },
          { g: "Geography", items: ["G.C. Leong — Physical Geography", "NCERT 11–12", "Oxford School Atlas"] },
          { g: "Economy", items: ["Ramesh Singh — Indian Economy", "Economic Survey (Union)", "Union Budget"] },
          { g: "Environment", items: ["Shankar IAS — Environment"] },
          { g: "Governance & Society", items: ["2nd ARC reports (selected)", "PRS Legislative Research"] },
          { g: "Ethics (GS-IV)", items: ["Lexicon — Ethics, Integrity & Aptitude", "2nd ARC — Ethics in Governance"] },
          { g: "CSAT", items: ["R.S. Aggarwal — Quantitative Aptitude", "R.S. Aggarwal — Verbal & Non-Verbal Reasoning"] },
          { g: "Current Affairs", items: ["The Hindu / Indian Express (daily)", "Yojana & Kurukshetra (monthly)", "PIB releases", "Monthly current-affairs compilation"] },
          { g: "Practice", items: ["UPSC Prelims PYQs", "UPSC Mains PYQs", "Optional subject standard texts"] },
        ]
      }
    };

    // ---- Planners are stored data: { id, label, title, sub, category, advancedAccess, active, order, versions: { basic, advanced } } ----
    function plannerContentOf(p) {
      const { prelims, mains, answerRule, daily, revision, resourcesNote, resources } = p;
      return JSON.parse(JSON.stringify({ prelims, mains, answerRule, daily, revision, resourcesNote, resources }));
    }
    // Used only to seed the Basic version of the 4 original built-in demo planners the very
    // first time the app ever loads with nothing saved yet (see seedPlanners() below) — it used
    // to hard-code a fixed 4-week/2-week slice here, which had nothing to do with how any real
    // planner works: every planner's Basic and Advanced tiers are each their own CSV upload, so
    // the week count is entirely up to whatever the admin puts in that template. Now the seed's
    // Basic tier just starts identical to Advanced — a neutral starting point, not a code-enforced
    // limit — and the admin can upload a shorter Basic CSV for these 4 planners the same way they
    // already do for any planner created via "Add planner".
    function makeBasicVersion(c) {
      return JSON.parse(JSON.stringify(c));
    }
    function seedPlanners() {
      return Object.entries(PLANNER_SEED).map(([id, p], i) => ({
        id, label: p.label, title: p.title, sub: p.sub, category: p.category,
        advancedAccess: 'bundle', active: true, order: i,
        versions: { advanced: plannerContentOf(p), basic: makeBasicVersion(plannerContentOf(p)) }
      }));
    }
    let planners = JSON.parse(localStorage.getItem('kas_planners')) || seedPlanners();
    // NOTE: this only writes the local cache. Deliberately does NOT push to cloud — this line runs at
    // script-load time, before window.onload's fetchCloudPlanners() has had a chance to pull the real
    // cloud copy. Pushing here would risk overwriting real cloud data with local defaults on every page
    // load, before the fetch even runs. Actual edits call savePlanners() below, which does push to cloud.
    localStorage.setItem('kas_planners', JSON.stringify(planners));
    function savePlanners() {
      localStorage.setItem('kas_planners', JSON.stringify(planners));
      saveCloudAppSetting('planners', planners).then(ok => {
        if (!ok) console.warn('Planners saved locally but cloud sync failed — will retry next save.');
      });
    }
    async function fetchCloudPlanners() {
      const cloud = await fetchCloudAppSetting('planners');
      if (Array.isArray(cloud) && cloud.length) {
        planners = cloud;
        localStorage.setItem('kas_planners', JSON.stringify(planners));
        if (typeof renderPlannersAdmin === 'function') renderPlannersAdmin();
        if (typeof renderStudyPlanner === 'function') renderStudyPlanner();
      }
    }

    function plannerList() {
      return planners.filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    function getPlanner(id) {
      return planners.find(p => p.id === id && p.active !== false) || null;
    }
    function canUseAdvancedPlanner(student, pl) {
      if (isAdmin()) return true;
      if (!student || !pl) return false;
      if (pl.advancedAccess === 'free') return true;
      if ((student.allowedPlanners || []).includes(pl.id)) return true;  // NEW: individual grant from Access Desk
      if (pl.advancedAccess === 'paid') return isPaidCustomer(student);
      return activeBundlesFor(student).some(b => bundleCoversPlanner(b, pl.id));
    }
    function plannerVersionFor(student, pl) {
      return canUseAdvancedPlanner(student, pl) ? 'advanced' : 'basic';
    }
    // The planner as this student sees it: shared details + the content of their version
    function plannerFor(id, student) {
      const pl = getPlanner(id);
      if (!pl) return null;
      const version = plannerVersionFor(student, pl);
      return { ...pl.versions[version], id: pl.id, label: pl.label, title: pl.title, sub: pl.sub, category: pl.category, version, advancedAccess: pl.advancedAccess, layout: pl.layout || 'timeline' };
    }

    // Only rows with text count, so a checklist item without a "Detail" or "Target" can still be completed
    function prelimsWeekIds(x) {
      return [`p${x.w}`, ...(x.extra ? [`p${x.w}e`] : []), ...(x.target ? [`p${x.w}t`] : [])];
    }
    function mainsWeekIds(x) {
      return [`m${x.w}`, ...(x.aw ? [`m${x.w}a`] : []), ...(x.target ? [`m${x.w}t`] : [])];
    }

    function plannerIdsFor(examKey, student = getCurrentStudent()) {
      const plan = plannerFor(examKey, student);
      if (!plan) return { prelims: [], mains: [], books: [], daily: [] };
      return {
        prelims: plan.prelims.weeks.flatMap(prelimsWeekIds),
        mains: plan.mains.weeks.flatMap(mainsWeekIds),
        books: plan.resources.flatMap((g, gi) => g.items.map((_, ii) => `r${gi}-${ii}`)),
        daily: plan.daily.map((_, i) => `d${i}`)
      };
    }

    // { "<email>": { active: 'kpsc' | 'upsc', exams: { kpsc: { done, daily: { date, done } }, upsc: {...} }, updatedAt } }
    let plannerStore = JSON.parse(localStorage.getItem('kas_study_planner')) || {};
    let plannerTab = 'prelims';
    let plannerSaveFlash = '';
    let plannerFlashTimer = null;

    function plannerToday() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // First choice: what the student's unlocked papers suggest (UPSC-only access → UPSC), else KPSC.
    function guessPlannerExam(student) {
      const list = plannerList();
      if (!list.length) return null;
      const cats = new Set((student.allowedExams || []).map(id => (testsCatalog.find(p => p.id === id) || {}).category));
      activeBundlesFor(student).forEach(b => b.categories.forEach(c => cats.add(c)));
      const match = list.filter(pl => cats.has(pl.category));
      return (match.length === 1 ? match[0] : list[0]).id;
    }

    function getPlannerRecord(student) {
      const key = normalizeEmail(student.email);
      let rec = plannerStore[key];
      if (!rec) rec = plannerStore[key] = { exams: {} };
      // Older single-planner data becomes the KPSC planner
      if (rec.done && !rec.exams) {
        rec.exams = { kpsc: { done: rec.done, daily: rec.daily } };
        rec.active = 'kpsc';
        delete rec.done;
        delete rec.daily;
      }
      if (!rec.exams) rec.exams = {};
      if (!getPlanner(rec.active)) rec.active = guessPlannerExam(student);
      return rec;
    }

    // Daily routine ticks belong to one date, so they clear by themselves each new day.
    function getExamProgress(rec, examKey) {
      const prog = rec.exams[examKey] = rec.exams[examKey] || { done: {} };
      if (!prog.done) prog.done = {};
      if (!prog.daily || prog.daily.date !== plannerToday()) prog.daily = { date: plannerToday(), done: {} };
      return prog;
    }

    function plannerPct(ids, bucket) {
      return ids.length ? Math.round(ids.filter(i => bucket[i]).length / ids.length * 100) : 0;
    }

    function examOverallPct(done, examKey, student = getCurrentStudent()) {
      const ids = plannerIdsFor(examKey, student);
      return plannerPct([...ids.prelims, ...ids.mains, ...ids.books], done || {});
    }

    // Admin summary, e.g. "KPSC KAS 12%, UPSC CSE 0%"
    function plannerSummary(email) {
      const rec = plannerStore[normalizeEmail(email)];
      const exams = rec && rec.exams ? rec.exams : (rec && rec.done ? { kpsc: { done: rec.done } } : {});
      const student = getStudentRecord(email);
      return plannerList().map(pl => `${pl.label} ${examOverallPct((exams[pl.id] || {}).done, pl.id, student)}%`).join(', ') || 'No planners';
    }

    async function savePlannerStore() {
      try {
        localStorage.setItem('kas_study_planner', JSON.stringify(plannerStore));
        if (currentUser) {
          // BUG FIX: push only this student's own slice — plannerStore holds every student's data
          // keyed by email, and pushing the whole object into one student's row wasted space and
          // meant a later fetch could import stale cross-student data into this row.
          await supabaseClient.from('student_progress').upsert({
            email: normalizeEmail(currentUser.email),
            planner_data: plannerStore[normalizeEmail(currentUser.email)] || {},
            updated_at: new Date().toISOString()
          });
        }
        return true;
      } catch (err) {
        return false;
      }
    }

    function togglePlannerItem(id) {
      const student = getCurrentStudent();
      if (!student) return;
      const rec = getPlannerRecord(student);
      const prog = getExamProgress(rec, rec.active);
      const bucket = id.startsWith('d') ? prog.daily.done : prog.done;
      if (bucket[id]) delete bucket[id];
      else bucket[id] = true;
      rec.updatedAt = new Date().toISOString();
      plannerSaveFlash = savePlannerStore() ? 'saved' : 'error';
      renderStudyPlanner();
      const btn = document.querySelector(`.kp-check[data-id="${id}"]`);
      if (btn) btn.focus({ preventScroll: true });
    }

    function setPlannerExam(examKey) {
      const student = getCurrentStudent();
      if (!student || !getPlanner(examKey)) return;
      const rec = getPlannerRecord(student);
      rec.active = examKey;
      savePlannerStore();
      renderStudyPlanner();
      const btn = document.querySelector(`.kp-switch button[data-exam="${examKey}"]`);
      if (btn) btn.focus({ preventScroll: true });
    }

    // Arrow keys move between the two exams, as in a radio group
    function plannerSwitchKey(e) {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const keys = plannerList().map(pl => pl.id);
      const current = keys.indexOf(e.currentTarget.dataset.exam);
      const next = keys[(current + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
      setPlannerExam(next);
    }

    function setPlannerTab(tab) {
      plannerTab = tab;
      renderStudyPlanner();
      const btn = document.querySelector(`.kp-tab[data-tab="${tab}"]`);
      if (btn) btn.focus({ preventScroll: true });
    }

    function resetStudyPlanner() {
      const student = getCurrentStudent();
      if (!student) return;
      const rec = getPlannerRecord(student);
      const plan = getPlanner(rec.active);
      if (!plan) return;
      if (!confirm(`Clear all your ${plan.label} planner ticks and start fresh?\n\nYour other planner is not affected.`)) return;
      rec.exams[rec.active] = { done: {}, daily: { date: plannerToday(), done: {} } };
      rec.updatedAt = new Date().toISOString();
      plannerSaveFlash = savePlannerStore() ? 'saved' : 'error';
      renderStudyPlanner();
    }

    function plannerRing(pct, size = 88) {
      const r = (size - 12) / 2;
      const circ = 2 * Math.PI * r;
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct}% of the plan complete" style="flex-shrink:0">
          <defs>
            <linearGradient id="kpFlag" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FFC531" /><stop offset="100%" stop-color="#DA3B2B" />
            </linearGradient>
          </defs>
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="9" />
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#kpFlag)" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"
            style="transition: stroke-dashoffset 600ms ease" />
          <text x="50%" y="50%" text-anchor="middle" dy="0.35em" style="fill:#fff; font-size:${size * 0.24}px; font-weight:800; font-family:'Karla',sans-serif">${pct}%</text>
        </svg>`;
    }

    function plannerCheck(id, on, text, large) {
      const tick = on ? '<svg width="60%" height="60%" viewBox="0 0 24 24" fill="none"><path d="M4 12.5 10 18.5 20 6" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
      return `<button type="button" class="kp-check${large ? ' lg' : ''}${on ? ' on' : ''}" data-id="${id}" aria-pressed="${on}"
        aria-label="${escapeHtml(text)}" onclick="togglePlannerItem('${id}')">${tick}</button>`;
    }

    function plannerRow(id, done, text, label, bold) {
      if (!text) return '';
      const on = !!done[id];
      return `
        <div class="kp-row${bold ? ' bold' : ''}${on ? ' on' : ''}">
          ${plannerCheck(id, on, (label ? label + ': ' : '') + text, bold)}
          <div style="flex:1">${label ? `<span class="kp-row-label">${label}</span>` : ''}<span class="kp-row-text">${escapeHtml(text)}</span></div>
        </div>`;
    }

    function openPlannerTests(category) {
      navigate('tests');
      filterExamCategory(category);
      window.scrollTo(0, 0);
    }

    // Set by renderStudyPlanner: { layout, start: Date|null }
    let plannerCtx = { layout: 'timeline', start: null };
    const DAY_MS = 86400000;
    function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function weekRange(start, week) {
      const from = new Date(start.getTime() + (week - 1) * 7 * DAY_MS);
      return [from, new Date(from.getTime() + 6 * DAY_MS)];
    }
    function shortDate(d) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }

    function plannerWeekCard(week, ids, done, tag, mock, rowsHtml, footHtml = '', category = '') {
      const full = ids.every(i => done[i]);
      const t = PLANNER_TAGS[tag] || (tag ? { cls: 'kp-tag-custom', label: String(tag).toUpperCase() } : null);
      const checklist = plannerCtx.layout === 'checklist';
      if (checklist) mock = false;
      let dates = '', isNow = false, behind = false;
      if (!checklist && plannerCtx.start) {
        const [from, to] = weekRange(plannerCtx.start, week);
        const today = startOfToday();
        isNow = today >= from && today <= to;
        behind = to < today && !full;
        dates = `<span class="kp-dates">${shortDate(from)} – ${shortDate(to)}</span>`;
      }
      return `
        <div class="kp-card${mock ? ' mock' : ''}${full ? ' full' : ''}${isNow ? ' now' : ''}">
          <div class="kp-card-top">
            ${checklist ? `<span class="kp-num kp-display">${week}</span>` : `<span class="kp-week kp-display">WEEK ${week}</span>${dates}`}
            ${isNow ? '<span class="kp-tag kp-tag-now">THIS WEEK</span>' : ''}
            ${behind ? '<span class="kp-tag kp-tag-behind">BEHIND</span>' : ''}
            ${t ? `<span class="kp-tag ${t.cls}">${t.label}</span>` : ''}
            ${mock ? '<span class="kp-tag kp-tag-mock">MOCK PHASE</span>' : ''}
            ${full ? '<span class="kp-done-label">✓ Done!</span>' : ''}
          </div>
          ${rowsHtml}${footHtml}
          ${mock && category ? `<button type="button" onclick="openPlannerTests('${category}')" class="kp-reset" style="margin-top:10px; border-color:#DA3B2B; color:#B02A1D; padding:5px 14px">Open mock tests</button>` : ''}
        </div>`;
    }

    function plannerStartBar(section, weeks, done, idsFn) {
      if (plannerCtx.layout === 'checklist' || !weeks.length) return '';
      const start = plannerCtx.start;
      const value = start ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` : '';
      let status = 'Set a start date to see this week\'s target and anything you\'re behind on.';
      if (start) {
        const today = startOfToday();
        const cur = Math.floor((today - start) / (7 * DAY_MS)) + 1;
        const behind = weeks.filter(x => weekRange(start, x.w)[1] < today && !idsFn(x).every(i => done[i])).length;
        const last = Math.max(...weeks.map(x => x.w));
        status = cur < 1 ? `Starts in ${Math.ceil((start - today) / DAY_MS)} day(s).`
          : cur > last ? `Plan period finished.${behind ? ` <b>${behind} week(s) still open.</b>` : ' Everything ticked.'}`
          : `You're in <b>week ${cur} of ${last}</b>.${behind ? ` <b style="color:#B02A1D">${behind} week(s) behind.</b>` : ' On track.'}`;
      }
      return `<div class="kp-start"><label>Plan starts on <input type="date" value="${value}" onchange="setPlannerStart('${section}', this.value)" aria-label="Start date for this plan" /></label><span>${status}</span></div>`;
    }

    function setPlannerStart(section, value) {
      const student = getCurrentStudent();
      if (!student) return;
      const rec = getPlannerRecord(student);
      const prog = getExamProgress(rec, rec.active);
      prog.startDates = prog.startDates || {};
      if (value) prog.startDates[section] = value; else delete prog.startDates[section];
      plannerSaveFlash = savePlannerStore() ? 'saved' : 'error';
      renderStudyPlanner();
    }

    function plannerSectionHead(title, note, pct) {
      return `
        <div class="kp-section-head">
          <div class="kp-section-row">
            <div class="kp-section-title kp-display">${title}</div>
            <div class="kp-section-pct">${pct}%</div>
          </div>
          <div class="kp-note">${note}</div>
          <div class="kp-bar"><div style="width:${pct}%"></div></div>
        </div>`;
    }

    function renderStudyPlanner() {
      const section = document.getElementById('dash-planner-section');
      if (!section) return;
      const student = getCurrentStudent();
      if (!student) {
        section.classList.add('hidden');
        section.innerHTML = '';
        return;
      }
      section.classList.remove('hidden');

      if (!canUseFeature('planner')) {
        if (featureAccess.planner === 'off') { section.classList.add('hidden'); section.innerHTML = ''; }
        else section.innerHTML = lockedFeatureHtml('planner');
        return;
      }
      const rec = getPlannerRecord(student);
      const examKey = rec.active;
      const plan = examKey ? plannerFor(examKey, student) : null;
      if (!plan) { section.classList.add('hidden'); section.innerHTML = ''; return; }
      const fullPlan = getPlanner(examKey).versions.advanced;
      const ids = plannerIdsFor(examKey, student);
      const prog = getExamProgress(rec, examKey);
      const done = prog.done;
      const dailyDone = prog.daily.done;
      const pPct = plannerPct(ids.prelims, done);
      const mPct = plannerPct(ids.mains, done);
      const bPct = plannerPct(ids.books, done);
      const dPct = plannerPct(ids.daily, dailyDone);
      const overall = examOverallPct(done, examKey);

      const checklist = plan.layout === 'checklist';
      const unit = n => checklist ? `${n} item${n === 1 ? '' : 's'}` : `${n} week${n === 1 ? '' : 's'}`;
      const countSub = (sec) => plan.version === 'basic' && fullPlan[sec].weeks.length > plan[sec].weeks.length
        ? `${plan[sec].weeks.length} of ${fullPlan[sec].weeks.length}${checklist ? '' : ' wks'}` : unit(plan[sec].weeks.length);
      const tabs = [
        { id: 'prelims', label: plan.prelims.tab || 'Prelims', sub: countSub('prelims'), show: plan.prelims.weeks.length || fullPlan.prelims.weeks.length },
        { id: 'mains', label: plan.mains.tab || 'Mains', sub: countSub('mains'), show: plan.mains.weeks.length || fullPlan.mains.weeks.length },
        { id: 'daily', label: 'Daily', sub: 'routine', show: plan.daily.length },
        { id: 'books', label: 'Books', sub: 'resources', show: plan.resources.length }
      ].filter(t => t.show);
      if (!tabs.length) { section.classList.add('hidden'); section.innerHTML = ''; return; }
      if (!tabs.some(t => t.id === plannerTab)) plannerTab = tabs[0].id;
      const starts = prog.startDates || {};
      const toDate = v => v ? new Date(v + 'T00:00:00') : null;

      let content = '';
      if (plannerTab === 'prelims') {
        plannerCtx = { layout: plan.layout, start: toDate(starts.prelims) };
        content = plannerSectionHead(plan.prelims.title, plan.prelims.note, pPct)
          + plannerStartBar('prelims', plan.prelims.weeks, done, prelimsWeekIds)
          + plan.prelims.weeks.map(x => plannerWeekCard(
              x.w, prelimsWeekIds(x), done, x.tag, x.w >= plan.prelims.mockFrom,
              plannerRow(`p${x.w}`, done, x.focus, '', true)
              + plannerRow(`p${x.w}e`, done, x.extra, 'Daily')
              + plannerRow(`p${x.w}t`, done, x.target, 'Target'),
              x.book ? `<div class="kp-book">📚 ${escapeHtml(x.book)}</div>` : '', plan.category
            )).join('');
      } else if (plannerTab === 'mains') {
        plannerCtx = { layout: plan.layout, start: toDate(starts.mains) };
        content = plannerSectionHead(plan.mains.title, plan.mains.note, mPct)
          + plannerStartBar('mains', plan.mains.weeks, done, mainsWeekIds)
          + plan.mains.weeks.map(x => plannerWeekCard(
              x.w, mainsWeekIds(x), done, x.tag, x.w >= plan.mains.mockFrom,
              plannerRow(`m${x.w}`, done, x.focus, '', true)
              + plannerRow(`m${x.w}a`, done, x.aw, 'Writing')
              + plannerRow(`m${x.w}t`, done, x.target, 'Target')
            )).join('')
          + (plan.answerRule ? `<div class="kp-callout">${plan.answerRule}</div>` : '');
      } else if (plannerTab === 'daily') {
        content = plannerSectionHead('Daily Routine', 'Tick these off as you go. They clear by themselves each new day.', dPct)
          + `<div class="kp-panel">${plan.daily.map((d, i) => {
              const id = `d${i}`, on = !!dailyDone[id];
              return `<div class="kp-daily-row${on ? ' on' : ''}">${plannerCheck(id, on, d, true)}<div class="kp-daily-text">${escapeHtml(d)}</div></div>`;
            }).join('')}</div>`
          + `<div class="kp-dark">
              <div class="kp-display" style="font-size:15px; margin-bottom:8px">Revision cycles</div>
              <div style="font-size:13px; line-height:1.65; opacity:.92">${plan.revision}</div>
            </div>`;
      } else {
        content = plannerSectionHead('Resource Checklist', plan.resourcesNote, bPct)
          + plan.resources.map((g, gi) => `
              <div class="kp-books${gi % 2 ? ' alt' : ''}">
                <div class="kp-display" style="font-size:14.5px; margin-bottom:6px">${escapeHtml(g.g)}</div>
                ${g.items.map((it, ii) => {
                  const id = `r${gi}-${ii}`, on = !!done[id];
                  return `<div class="kp-book-row${on ? ' on' : ''}">${plannerCheck(id, on, it, false)}<div class="kp-book-text">${escapeHtml(it)}</div></div>`;
                }).join('')}
              </div>`).join('')
          + `<div style="font-size:12.5px; color:#6E6A93; text-align:center; padding:4px 10px 10px; line-height:1.6">One book per subject, read three times, beats five books read once.</div>`;
      }

      // FIX: "need a dropdown to pick a specific planner when enrolled in multiple exam tracks" —
      // the switcher used to list EVERY active planner on the whole site with no regard for which
      // tracks this student actually has access to, so a KAS-only student saw PSI/UPSC/FDA-SDA
      // buttons cluttered in with their own. Now: enrolled tracks sort first and get no badge;
      // others are still browsable (basic content stays open to everyone, unchanged) but marked
      // "· other" so it's clear they're not part of what this student paid for. Renders as compact
      // toggle buttons for 2 tracks, or an actual <select> dropdown for 3+ (a wall of pill buttons
      // doesn't scale once there are several tracks).
      const isEnrolledInPlanner = pl =>
        activeBundlesFor(student).some(b => (b.categories || []).includes(pl.category) || bundleCoversPlanner(b, pl.id)) ||
        (student.allowedExams || []).some(examId => (testsCatalog.find(p => p.id === examId) || {}).category === pl.category) ||
        (student.allowedPlanners || []).includes(pl.id);

      const orderedPlanners = plannerList().slice().sort((a, b) => {
        const ae = isEnrolledInPlanner(a), be = isEnrolledInPlanner(b);
        if (ae !== be) return ae ? -1 : 1;               // enrolled tracks first
        return (a.order || 0) - (b.order || 0);           // then original admin order
      });

      // Exam switch: shows each planner's overall progress so students can see both at a glance
      const switchHtml = orderedPlanners.map(pl => {
        const k = pl.id;
        const pct = examOverallPct((rec.exams[k] || {}).done, k, student);
        const on = k === examKey;
        const enrolled = isEnrolledInPlanner(pl);
        return `<button type="button" role="radio" data-exam="${k}" aria-checked="${on}" tabindex="${on ? 0 : -1}"
          onclick="setPlannerExam('${k}')" onkeydown="plannerSwitchKey(event)">${escapeHtml(pl.label)}<span class="kp-switch-pct">${pct}%</span>${enrolled ? '' : ' <span style="opacity:.6">· other</span>'}</button>`;
      }).join('');
      const switchDropdownHtml = `
        <select onchange="setPlannerExam(this.value)" aria-label="Choose your exam" style="background:rgba(255,255,255,0.12); color:#EAE8FF; border:0; border-radius:10px; padding:8px 12px; font-weight:800; font-size:12.5px; font-family:'Bricolage Grotesque','Karla',sans-serif;">
          ${orderedPlanners.map(pl => {
            const k = pl.id;
            const pct = examOverallPct((rec.exams[k] || {}).done, k, student);
            const enrolled = isEnrolledInPlanner(pl);
            return `<option value="${k}" ${k === examKey ? 'selected' : ''} style="color:#0f172a">${escapeHtml(pl.label)} — ${pct}%${enrolled ? '' : ' (other)'}</option>`;
          }).join('')}
        </select>`;

      // Basic users see what the advanced version adds, and how to get it
      let upgradeHtml = '';
      if (plan.version === 'basic') {
        const offers = plan.advancedAccess === 'paid'
          ? bundlesForSale(() => true).slice(0, 2)
          : bundlesForSale(b => bundleCoversPlanner(b, plan.id)).slice(0, 2);
        upgradeHtml = `
          <div class="kp-upgrade">
            <div class="kp-display" style="font-size:15px">🔒 Advanced ${escapeHtml(plan.label)} planner</div>
            <div style="font-size:13px; opacity:.9; margin-top:6px; line-height:1.55">The full ${fullPlan.prelims.weeks.length}-week prelims and ${fullPlan.mains.weeks.length}-week mains plan, with every weekly target. Your ticks carry over when you upgrade.</div>
            ${offers.map(b => `<button type="button" onclick="openBundleCheckout('${b.id}')">Get ${escapeHtml(b.name)} · ₹${b.price}</button>`).join('')}
          </div>`;
      }

      section.innerHTML = `
        <div class="kp">
          <div class="kp-head">
            <div class="kp-head-row">
              ${plannerRing(overall)}
              <div style="flex:1; min-width:0">
                <div class="kp-title kp-display">${escapeHtml(plan.title)}<span class="kp-version ${plan.version}">${plan.version === 'advanced' ? 'ADVANCED' : 'BASIC'}</span></div>
                <div class="kp-sub">${escapeHtml(plan.sub)}</div>
                <div class="kp-chips">
                  <span class="kp-chip" style="background:rgba(255,197,49,0.18); color:#FFC531">Prelims ${pPct}%</span>
                  <span class="kp-chip" style="background:rgba(218,59,43,0.22); color:#FFB3A9">Mains ${mPct}%</span>
                  <span class="kp-chip" style="background:rgba(255,255,255,0.12); color:#EAE8FF">Books ${bPct}%</span>
                </div>
              </div>
            </div>
            ${plannerList().length > 2 ? `<div class="kp-switch-wrap" role="group" aria-label="Choose your exam">${switchDropdownHtml}</div>`
              : plannerList().length > 1 ? `<div class="kp-switch" role="radiogroup" aria-label="Choose your exam">${switchHtml}</div>` : ''}
            <div id="kp-saved" class="kp-saved${plannerSaveFlash === 'error' ? ' error' : ''}" aria-live="polite">${plannerSaveFlash === 'error' ? "couldn't save" : '✓ saved'}</div>
          </div>
          <div class="kp-body">
            <div class="kp-tabs" role="tablist" aria-label="Planner sections">
              ${tabs.map(t => `
                <button type="button" role="tab" class="kp-tab" data-tab="${t.id}" aria-selected="${plannerTab === t.id}" onclick="setPlannerTab('${t.id}')">
                  <div class="kp-tab-label kp-display">${t.label}</div>
                  <div class="kp-tab-sub">${t.sub}</div>
                </button>`).join('')}
            </div>
            <div role="tabpanel">${content}${upgradeHtml}</div>
            <div class="kp-foot">
              <button type="button" class="kp-reset" onclick="resetStudyPlanner()">Reset ${plan.label} progress</button>
              <div class="kp-foot-note">ಸೇವೆಗೆ ಸಿದ್ಧ · Your ticks are saved to your login automatically</div>
            </div>
          </div>
        </div>`;

      if (plannerSaveFlash) {
        document.getElementById('kp-saved').classList.add('show');
        clearTimeout(plannerFlashTimer);
        plannerFlashTimer = setTimeout(() => { const el = document.getElementById('kp-saved'); if (el) el.classList.remove('show'); }, 1200);
        plannerSaveFlash = '';
      }
    }

