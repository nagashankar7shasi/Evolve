    /* ----------------------------------------------------
       2. INITIAL PRICING MASTER & SYSTEM STORAGE
    ----------------------------------------------------- */
    const initialPricingMaster = {
      upiId: 'yourkasacademy@upi',
      payeeName: "Evolve+",
      whatsappNumber: '',    // 10-digit Indian number without +91. Empty = WhatsApp buttons hidden.
      watermarkTemplate: '', // NEW: '' = use the built-in default format. Tokens: {{institute}} {{email}} {{date}}
      qrImageDataUrl: '',    // NEW: admin-uploaded payment QR (data URL). Empty = auto-generate from UPI ID at checkout.
      allAccessPrice: 1499,
      categoryPasses: {
        kpsc_kas: 699,
        karnataka_psi: 499,
        kpsc_fda_sda: 399,
        upsc_cse: 999
      }
    };

    const initialNav = [
      { id: 'm1', label: 'Home', action: 'home', submenus: [] },
      { 
        id: 'm2', 
        label: 'Exam Rooms', 
        action: '#', 
        submenus: [
          { id: 's1', label: 'KPSC KAS Hub', action: 'category:kpsc_kas' },
          { id: 's2', label: 'Karnataka PSI Hub', action: 'category:karnataka_psi' },
          { id: 's3', label: 'FDA / SDA Hub', action: 'category:kpsc_fda_sda' },
          { id: 's4', label: 'UPSC CSE Hub', action: 'category:upsc_cse' }
        ] 
      },
      { id: 'm3', label: 'Current Affairs', action: 'page:p_current_affairs', submenus: [] },
      { id: 'm4', label: 'KAS Syllabus Guide', action: 'page:p_1', submenus: [] }
    ];

    const initialPdfs = [
      {
        id: 'doc_1',
        title: 'Karnataka Economic Survey 2026 Summary',
        category: 'KPSC KAS',
        access: 'paid',
        price: 49,
        url: 'https://finance.karnataka.gov.in',
        autoUrl: 'https://kasportal.in/vault/doc-m51a-karnataka-economic-survey-2026.pdf'
      }
    ];

    const initialPages = [
      {
        id: 'p_current_affairs',
        slug: 'current-affairs',
        title: 'Current Affairs & Karnataka State Snippets',
        isGated: false,
        price: 0,
        content: `
          <h1>Karnataka Current Affairs & Administrative Updates</h1>
          <p>Daily curated summaries mapped to KPSC Gazetted Probationers Preliminary and Mains syllabi.</p>
          <h2>Karnataka Economic Indicators & Budget Highlights</h2>
          <p>The state has registered over 8.2% contribution to national GDP with steady tertiary sector expansion. Aspirants can download the official summary document: <a href="javascript:void(0)" onclick="downloadOrOpenPdf('doc_1')" class="text-amber-600 font-bold underline cursor-pointer">Karnataka Economic Survey 2026 Summary<span class="text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded ml-1 font-sans font-normal">PDF</span></a>.</p>
          <h2>Administrative Reforms & Citizen Services</h2>
          <ul>
            <li><b>Sakala Act Extensions:</b> Over 1,000 public delivery timelines now legally mandated across district offices.</li>
            <li><b>Western Ghats Conservation:</b> Latest status updates on village cluster recommendations under central review.</li>
          </ul>
        `
      },
      {
        id: 'p_1',
        slug: 'kas-syllabus',
        title: 'KPSC KAS Preliminary Examination Blueprint',
        isGated: false,
        price: 0,
        content: `
          <h1>KPSC KAS Preliminary Examination Structure</h1>
          <p>The preliminary examination consists of two objective papers evaluated with strict negative marking.</p>
          <h2>Prescribed Reference Study Material</h2>
          <p>Aspirants must thoroughly review the state economic indicators before taking the mock papers. You can download the complete summary document directly by clicking on the <a href="javascript:void(0)" onclick="downloadOrOpenPdf('doc_1')" class="text-amber-600 font-bold underline cursor-pointer">Karnataka Economic Survey PDF<span class="text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded ml-1 font-sans font-normal">PDF</span></a> provided for this batch.</p>
          <h2>Negative Marking Ratio</h2>
          <p>Each incorrect bubble results in a deduction of <b>0.25 (1/4th)</b> of the marks assigned to that specific question.</p>
        `
      }
    ];

    const initialPapersCatalog = [
      {
        id: 'kas_mock_01',
        category: 'kpsc_kas',
        title: 'KAS Prelims Paper 1: General Studies Mock 01',
        price: 99,
        scheme: { examBadge: 'KPSC KAS', marksCorrect: 2.00, marksWrong: 0.500, duration: 120, cutoff: 120 },
        questions: [
          {
            id: 1,
            q_en: "With reference to the Karnataka State Budget, which sector contributes the highest share to the Gross State Value Added (GSVA)?",
            q_kn: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಬಜೆಟ್‌ನ ಪ್ರಕಾರ, ಈ ಕೆಳಗಿನ ಯಾವ ವಲಯವು ರಾಜ್ಯದ ಒಟ್ಟು ಮೌಲ್ಯವರ್ಧನೆಗೆ (GSVA) ಅತಿ ಹೆಚ್ಚಿನ ಕೊಡುಗೆ ನೀಡುತ್ತದೆ?",
            options_en: ["Agriculture and Allied Activities", "Industry and Manufacturing", "Services Sector", "Mining and Quarrying"],
            options_kn: ["ಕೃಷಿ ಮತ್ತು ಸಂಬಂಧಿತ ಚಟುವಟಿಕೆಗಳು", "ಕೈಗಾರಿಕೆ ಮತ್ತು ಉತ್ಪಾದನೆ", "ಸೇವಾ ವಲಯ", "ಗಣಿಗಾರಿಕೆ ಮತ್ತು ಉತ್ಖನನ"],
            correct: "C",
            subject: "Economy",
            exp: "The Services sector consistently contributes over 64% of Karnataka's GSVA."
          },
          {
            id: 2,
            q_en: "Under the Vijayanagara Empire, the central land revenue assessment department was known as:",
            q_kn: "ವಿಜಯನಗರ ಸಾಮ್ರಾಜ್ಯದ ಆಡಳಿತದಲ್ಲಿ ಭೂಕಂದಾಯ ಇಲಾಖೆಯನ್ನು ಏನೆಂದು ಕರೆಯಲಾಗುತ್ತಿತ್ತು?",
            options_en: ["Athavana", "Kandachara", "Samprathi", "Karanika"],
            options_kn: ["ಅಠವಣೆ (Athavana)", "ಕಂದಾಚಾರ", "ಸಂಪ್ರತಿ", "ಕರಣಿಕ"],
            correct: "A",
            subject: "Karnataka History",
            exp: "'Athavana' was the central land revenue department in Vijayanagara administration."
          }
        ]
      },
      {
        id: 'psi_mock_01',
        category: 'karnataka_psi',
        title: 'Karnataka PSI Civil Paper 2: General Studies Mock 01',
        price: 99,
        scheme: { examBadge: 'Karnataka PSI', marksCorrect: 1.50, marksWrong: 0.375, duration: 90, cutoff: 110 },
        questions: [
          {
            id: 1,
            q_en: "Under the Code of Criminal Procedure (CrPC), who is empowered to establish a Court of Session in a district?",
            q_kn: "ದಂಡ ಪ್ರಕ್ರಿಯಾ ಸಂಹಿತೆಯ (CrPC) ಅಡಿಯಲ್ಲಿ ಜಿಲ್ಲೆಯಲ್ಲಿ ಸೆಷನ್ಸ್ ನ್ಯಾಯಾಲಯವನ್ನು ಸ್ಥಾಪಿಸಲು ಯಾರಿಗೆ ಅಧಿಕಾರವಿದೆ?",
            options_en: ["High Court", "State Government", "District Magistrate", "Supreme Court"],
            options_kn: ["ಉಚ್ಚ ನ್ಯಾಯಾಲಯ", "ರಾಜ್ಯ ಸರ್ಕಾರ", "ಜಿಲ್ಲಾಧಿಕಾರಿ", "ಸರ್ವೋಚ್ಚ ನ್ಯಾಯಾಲಯ"],
            correct: "B",
            subject: "Polity & Law",
            exp: "Section 9 of CrPC empowers the State Government to establish a Court of Session for every sessions division."
          }
        ]
      }
    ];

    const initialStudentDirectory = [
      {
        email: "student@gmail.com",
        utr: "UPI1234567890",
        status: "active",
        allowedExams: ["kas_mock_01"],
        allowedPages: ["p_1", "p_current_affairs"],
        allowedPdfs: ["doc_1"]
      }
    ];

    // ================= STORAGE RETRIEVAL WITH AUTO-MIGRATOR =================
    let pricingMaster = JSON.parse(localStorage.getItem('kas_pricing_master')) || initialPricingMaster;
    let navStructure = JSON.parse(localStorage.getItem('kas_nav_menu')) || initialNav;
    let pdfVault = JSON.parse(localStorage.getItem('kas_pdf_vault')) || initialPdfs;
    let testsCatalog = JSON.parse(localStorage.getItem('kas_tests_catalog')) || initialPapersCatalog;
    let studentDirectory = JSON.parse(localStorage.getItem('kas_student_directory')) || initialStudentDirectory;
    let userAttempts = JSON.parse(localStorage.getItem('kas_user_attempts')) || [];
    let currentUser = JSON.parse(localStorage.getItem('kas_user')) || null;

    // Pages: seed the starter pages on FIRST RUN only, so deleted/renamed pages stay that way.
    let customPages = JSON.parse(localStorage.getItem('kas_custom_pages'));
    if (!Array.isArray(customPages)) {
      customPages = JSON.parse(JSON.stringify(initialPages));
    }

    // Page state. The page ID is the permanent key; the slug is only a friendly link.
    let editingPageId = null;       // page currently open in the editor (null = new page)
    let slugManuallyEdited = false; // stop auto-filling the link from the title
    let currentPageId = null;       // page currently shown to the visitor

    function slugify(text) {
      return (text || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // any run of other characters becomes one dash
        .replace(/^-+|-+$/g, '')      // no dashes at the ends
        .slice(0, 60);
    }

    function escapeHtml(str) {
      return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Accepts a page ID, its current link, or any link it used to have.
    function findPage(ref) {
      if (!ref) return null;
      return customPages.find(p => p.id === ref)
          || customPages.find(p => p.slug === ref)
          || customPages.find(p => (p.oldSlugs || []).includes(ref))
          || null;
    }

    // ---- Page hierarchy ----
    function childPagesOf(parentId) {
      return customPages.filter(p => (p.parentId || null) === (parentId || null))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
    }
    // Root → … → page (stops on loops or missing parents)
    function pageAncestry(page) {
      const chain = [];
      const seen = new Set();
      let cur = page;
      while (cur && !seen.has(cur.id)) {
        chain.unshift(cur);
        seen.add(cur.id);
        cur = cur.parentId ? customPages.find(p => p.id === cur.parentId) : null;
      }
      return chain;
    }
    function descendantIds(pageId) {
      const out = [];
      const walk = id => childPagesOf(id).forEach(c => { out.push(c.id); walk(c.id); });
      walk(pageId);
      return out;
    }
    // Depth-first list for trees, pickers and menus
    function pageTreeList() {
      const out = [];
      const walk = (parentId, depth) => childPagesOf(parentId).forEach(p => { out.push({ page: p, depth }); walk(p.id, depth + 1); });
      walk(null, 0);
      // orphans (parent deleted) at the end so nothing disappears
      customPages.filter(p => !out.some(o => o.page.id === p.id)).forEach(p => out.push({ page: p, depth: 0 }));
      return out;
    }
    function isGatedPage(p) {
      return !!p.isGated && (p.price > 0 || p.bundleOnly);
    }

    function pageLinkHash(page) {
      return '#/page/' + encodeURIComponent(page.slug || page.id);
    }

    // Converts any old slug-based references (menus, student access) to page IDs. Safe to run on every load.
    function normalizePageReferences() {
      customPages.forEach((pg, i) => {
        if (!pg.id) pg.id = 'p_' + Date.now() + '_' + i;
        if (pg.parentId === undefined) pg.parentId = null;
        if (pg.order === undefined) pg.order = i;
        if (!pg.icon) pg.icon = '📄';
        if (!pg.childStyle) pg.childStyle = 'tiles';
        if (!Array.isArray(pg.oldSlugs)) pg.oldSlugs = [];
        if (!pg.slug) pg.slug = slugify(pg.title) || pg.id;
      });
      const toId = ref => { const pg = findPage(ref); return pg ? pg.id : ref; };
      studentDirectory.forEach(st => {
        st.allowedPages = [...new Set((st.allowedPages || []).map(toId))];
      });
      const fixAction = item => {
        if (typeof item.action === 'string' && item.action.startsWith('page:')) {
          item.action = 'page:' + toId(item.action.slice(5));
        }
      };
      navStructure.forEach(m => { fixAction(m); (m.submenus || []).forEach(fixAction); });

      localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      localStorage.setItem('kas_nav_menu', JSON.stringify(navStructure));
    }
    // Students: one record per lower-case email, so access always matches the login.
    function normalizeEmail(email) {
      return (email || '').trim().toLowerCase();
    }

    function normalizeStudentDirectory() {
      const merged = [];
      const listKeys = ['allowedExams', 'allowedPages', 'allowedPdfs', 'allowedPlanners', 'passes'];
      studentDirectory.forEach(st => {
        st.email = normalizeEmail(st.email);
        listKeys.forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
        const existing = merged.find(m => m.email === st.email);
        if (existing) {
          listKeys.forEach(k => { existing[k] = [...new Set([...existing[k], ...st[k]])]; });
          if (!existing.passwordHash && st.passwordHash) {
            existing.passwordHash = st.passwordHash;
            existing.passwordSalt = st.passwordSalt;
          }
        } else {
          merged.push(st);
        }
      });
      studentDirectory = merged;
      userAttempts.forEach(a => { if (a.userEmail) a.userEmail = normalizeEmail(a.userEmail); });
      localStorage.setItem('kas_user_attempts', JSON.stringify(userAttempts));
    }

    // Legal pages: added once. They are normal pages, so edit them in "Word Pages" like any other.
    const LEGAL_PAGES = [
      {
        id: 'p_privacy', slug: 'privacy-policy', title: 'Privacy Policy', isGated: false, price: 0, oldSlugs: [],
        content: `<p><i>Template. Replace everything in [square brackets] and have it reviewed before launch.</i></p>
<h2>Who we are</h2><p>[Academy legal name], [full postal address] ("we", "us") runs this portal.</p>
<h2>What we collect</h2><ul><li>Your name and email address when you create an account.</li><li>Your test answers, scores and study-planner progress.</li><li>UPI reference numbers (UTR) you submit as proof of payment. We never see your UPI PIN or bank details.</li></ul>
<h2>Why we use it</h2><ul><li>To give you access to the tests and material you've paid for.</li><li>To show your scores and progress on your dashboard.</li><li>To verify payments and send you login codes by email.</li></ul><p>We do not sell your data or use it for advertising.</p>
<h2>How long we keep it</h2><p>While your account is active, and for [period] after you ask us to delete it, unless the law requires longer (for example, payment records).</p>
<h2>Your rights</h2><p>Under the Digital Personal Data Protection Act, 2023 you can ask to see, correct or erase your data, and withdraw consent. Email [grievance email] and we will respond within [number] days.</p>
<h2>Grievance officer</h2><p>[Name], [email], [phone].</p>
<p>Last updated: [date]</p>`
      },
      {
        id: 'p_terms', slug: 'terms-of-use', title: 'Terms of Use', isGated: false, price: 0, oldSlugs: [],
        content: `<p><i>Template. Replace everything in [square brackets] and have it reviewed before launch.</i></p>
<h2>About this service</h2><p>This portal is run by [Academy legal name]. It is an independent coaching service and is <b>not affiliated with KPSC, UPSC or any government body</b>. Mock tests and study material are prepared by us and are not official papers.</p>
<h2>Your account</h2><ul><li>One account per person. Keep your password private.</li><li>Do not share your login, tests or paid material with others. We may suspend accounts that do.</li></ul>
<h2>Payments and access</h2><ul><li>Prices are shown in rupees and paid by UPI.</li><li>Access is unlocked after we verify your payment reference, usually within 2 hours between 9 am and 9 pm.</li><li>Passes cover the exam category named in the pass, including papers added later, for [validity period].</li></ul>
<h2>Content</h2><p>All questions, explanations, notes and PDFs belong to [Academy legal name]. You may use them for your own preparation only.</p>
<h2>Liability</h2><p>We work hard to keep content accurate but cannot guarantee it is error-free, or guarantee exam results.</p>
<h2>Contact</h2><p>[email], [phone]. These terms are governed by the laws of India; courts in [city] have jurisdiction.</p>
<p>Last updated: [date]</p>`
      },
      {
        id: 'p_refund', slug: 'refund-policy', title: 'Refund Policy', isGated: false, price: 0, oldSlugs: [],
        content: `<p><i>Template. Replace everything in [square brackets] and have it reviewed before launch.</i></p>
<h2>When you get a full refund</h2><ul><li>You paid twice for the same item.</li><li>You paid but we could not unlock access within [3] working days.</li><li>You paid the wrong amount and we cannot match it to an item.</li></ul>
<h2>When refunds are not given</h2><p>Once a test has been attempted, or paid material has been opened, the purchase is final, because digital content cannot be returned.</p>
<h2>How to ask</h2><p>Email [refund email] within [7] days of payment with your registered email and UPI reference number (UTR). Approved refunds go back to the same UPI account within [7] working days.</p>
<p>Last updated: [date]</p>`
      }
    ];
    // NOTE: these 3 pages used to be seeded directly into the in-memory customPages array here,
    // but that runs BEFORE fetchCloudContent() in the boot sequence — and fetchCloudContent does a
    // full replace of customPages from the cloud, wiping this local-only seed out again on every
    // real page load. They were never actually reaching Supabase. Moved to ensureLegalPagesExist()
    // below, called AFTER the cloud fetch, which also pushes them to Supabase so they persist.

    // FIX: check against customPages AFTER it's been populated from the cloud (not before), and
    // actually push any missing legal page to Supabase — not just add it to the local array — so it
    // survives the very next fetchCloudContent() call instead of silently disappearing again.
    async function ensureLegalPagesExist() {
      const missing = LEGAL_PAGES.filter(lp => !customPages.some(p => p.id === lp.id));
      if (!missing.length) return;
      for (const lp of missing) {
        customPages.push(lp);
        try {
          const { error } = await supabaseClient.from('custom_pages').upsert({
            id: lp.id, slug: lp.slug, title: lp.title, is_gated: lp.isGated, price: lp.price,
            content: lp.content, parent_id: lp.parentId || null, icon: lp.icon || '', image: lp.image || '',
            summary: lp.summary || '', child_style: lp.childStyle || '', order_num: lp.order || 0,
            show_on_home: !!lp.showOnHome, bundle_only: !!lp.bundleOnly, old_slugs: lp.oldSlugs || []
          });
          if (error) throw error;
        } catch (err) {
          console.error(`Failed to push legal page "${lp.id}" to cloud:`, fmtErr(err));
        }
      }
      localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));
      if (typeof renderPagesList === 'function') renderPagesList();
    }

    // Payment claims submitted from checkout: { id, email, name, type, itemId, title, amount, utr, status, createdAt, decidedAt, rejectReason, receiptNo }
    let paymentOrders = JSON.parse(localStorage.getItem('kas_payment_orders')) || [];
    function savePaymentOrders() {
      localStorage.setItem('kas_payment_orders', JSON.stringify(paymentOrders));
    }

