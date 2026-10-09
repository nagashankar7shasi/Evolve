    /* ----------------------------------------------------
       12b. HOME PAGE CONFIGURATION (sections, ticker, stats, news, toppers, why, faq, cta)
    ----------------------------------------------------- */
    const HOME_CONFIG_DEFAULT = {
      typography: {
        enabled: true,
        headingFont: '',    // '' = keep app default (Inter/system)
        bodyFont: ''
      },
      hero: {
        enabled: true,
        order: 1,
        badge: 'Deep Roots. Higher Tomorrows.',
        headingMain: 'EVOLVE+',
        headingSub: 'KPSC KAS Mock Tests · Karnataka PSI · FDA/SDA Exam Prep',
        description: 'Bilingual OMR mocks, hand-crafted planners and study rooms for KPSC KAS, Karnataka PSI, FDA/SDA and UPSC CSE — under one login.',
        cta1Label: 'Explore Exam Categories',
        cta1Action: 'tests',            // 'tests' | 'signup' | 'dashboard' | 'home' | 'page:<id>' | 'url:<...>'
        cta1Enabled: true,      // NEW: explicit on/off for the primary button, independent of its label text
        cta2Label: 'Current Affairs & Notes',
        cta2Action: 'page:p_current_affairs',
        cta2Enabled: true,      // NEW: explicit on/off for the secondary button
        heroImageDataUrl: '',   // NEW: optional admin-uploaded background photo. '' = plain dark hero (today's look).
        size: 'normal'          // NEW: 'minimal' | 'compact' | 'normal' | 'spacious' — vertical size of the hero panel
      },
      studyrooms: {
        enabled: true,
        order: 2,
        title: 'Study Rooms',
        subtitle: 'Notes, strategy and reference sections. Open one to see everything inside.'
      },
      passes: {
        enabled: true,
        order: 3,
        title: 'Flexible Enrollment Passes',
        subtitle: 'Pay only for the exams you prepare for, or unlock complete access across all batches.',
        showPayPerMock: true   // NEW: the "Pay Per Mock" card was previously hardcoded and unremovable
      },
      ticker: {
        enabled: true,
        order: 4,
        items: [
          'KPSC KAS Preliminary 2026 — bilingual mocks now live',
          'New: Karnataka Current Affairs weekly digest — every Monday',
          'UPSC Prelims 2026 sectional test series starting soon'
        ]
      },
      stats: {
        enabled: true,
        order: 5,
        items: [
          { value: '1,000+', label: 'Aspirants trained' },
          { value: '250+',   label: 'Bilingual mocks' },
          { value: '50+',    label: 'Toppers mentored' },
          { value: '4',      label: 'Exams covered' }
        ]
      },
      upcoming: {
        enabled: true,
        order: 6,
        title: '🗓 Upcoming Live Tests',
        subtitle: 'Scheduled mocks you can bookmark and take at the exact time.',
        limit: 6
      },
      whatsnew: {
        enabled: true,
        order: 7,
        title: "What's New",
        subtitle: 'Latest additions across the portal.',
        limit: 6
      },
      news: {
        enabled: true,
        order: 8,
        title: 'News & Notifications',
        subtitle: 'KPSC, UPSC and portal updates you shouldn\'t miss.',
        items: [
          { date: '2026-09-15', badge: 'exam', title: 'KPSC KAS Prelims 2026 — Notification released', body: 'Applications open from 20th September. Detailed schedule inside.', link: '' },
          { date: '2026-09-10', badge: 'result', title: 'UPSC CSE 2025 Final Results', body: 'Congratulations to all selected candidates. Toppers list and analysis inside.', link: '' },
          { date: '2026-09-05', badge: 'alert', title: 'PSI Recruitment — last date extended', body: 'Karnataka PSI recruitment deadline extended to 25th September.', link: '' }
        ]
      },
      why: {
        enabled: true,
        order: 9,
        title: 'Why Evolve+',
        subtitle: 'Everything you need under one login.',
        items: [
          { icon: '📝', title: 'Real OMR simulation', desc: 'Fill bubbles the way you will in the exam hall — with instant evaluation.' },
          { icon: '📅', title: 'Structured planners', desc: 'Weekly milestones built by mentors who cleared the exams themselves.' },
          { icon: '📚', title: 'Bilingual notes', desc: 'Every core note in English and Kannada, kept current every quarter.' },
          { icon: '💬', title: 'Personal mentoring', desc: 'Doubt resolution and strategy calls with our senior faculty.' }
        ]
      },
      toppers: {
        enabled: true,
        order: 10,
        title: 'Our Achievers',
        subtitle: 'Real students. Real ranks. Real prep.',
        items: [
          { name: 'Aparna S.', exam: 'KPSC KAS 2024', rank: 'Rank 12', quote: 'The bilingual mock series was the single biggest turning point in my prelims prep.', photo: '' },
          { name: 'Ravi Kumar M.', exam: 'UPSC CSE 2024', rank: 'Rank 187', quote: 'Structured planners kept me on track when I was ready to give up. Grateful.', photo: '' },
          { name: 'Deepa H.',  exam: 'Karnataka PSI 2025', rank: 'Selected', quote: 'The OMR simulation made the actual exam feel like just another mock.', photo: '' }
        ]
      },
      ratings: {
        // Off by default: this is a static admin-entered badge (not a live API pull), so it should
        // stay hidden until a real rating/review-count/link has actually been filled in — showing a
        // placeholder "4.8 ★" to visitors before that would be misleading.
        enabled: false,
        order: 10.5,   // sits between Achievers (10) and FAQ (11)
        score: '4.8',
        reviewCount: '200+ Google reviews',
        linkLabel: 'Rated by our students',
        link: ''        // e.g. your Google Business review link
      },
      faq: {
        enabled: true,
        order: 11,
        title: 'Frequently Asked Questions',
        items: [
          { q: 'Do I need to install anything to attempt a mock?', a: 'No — everything runs in the browser. Log in from any device and pick up where you left off.' },
          { q: 'Are the notes available in Kannada?', a: 'Yes. Every core note is bilingual and every mock has a Kannada version of each question.' },
          { q: 'How do payments and access work?', a: 'Pay via UPI, submit the reference number, and access is unlocked once the payment is verified — usually within a few hours.' },
          { q: 'Can I get a refund?', a: 'Refunds are handled case-by-case per our Refund Policy. Reach out through the contact page if you\'ve run into a problem.' }
        ]
      },
      cta: {
        enabled: true,
        order: 12,
        heading: 'Ready to prepare with intent?',
        subtitle: 'Join thousands of aspirants who trust Evolve+ with their daily prep.',
        buttonLabel: 'Explore exam categories',
        buttonAction: 'tests'   // 'tests' | 'signup' | 'dashboard' | 'home'
      }
    };

    function loadHomeConfig() {
      try {
        const saved = JSON.parse(localStorage.getItem('gp_home_config'));
        if (saved && typeof saved === 'object') {
          // Merge with defaults so newly added sections show up for existing users
          const merged = { ...HOME_CONFIG_DEFAULT };
          for (const k of Object.keys(HOME_CONFIG_DEFAULT)) {
            if (saved[k] && typeof saved[k] === 'object') merged[k] = { ...HOME_CONFIG_DEFAULT[k], ...saved[k] };
          }
          return merged;
        }
      } catch (_) { /* fall through */ }
      return JSON.parse(JSON.stringify(HOME_CONFIG_DEFAULT));
    }

    let homeConfig = loadHomeConfig();

    async function saveHomeConfig(silent = false) {
      localStorage.setItem('gp_home_config', JSON.stringify(homeConfig));
      // --- SYNC TO SUPABASE CLOUD ---
      try {
        const rows = Object.keys(homeConfig).map(key => ({
          section_key: key,
          enabled: !!homeConfig[key].enabled,
          data: homeConfig[key],
          updated_at: new Date().toISOString()
        }));
        const { error } = await supabaseClient.from('home_config').upsert(rows, { onConflict: 'section_key' });
        if (error) throw error;
        if (!silent) showHomeConfigSaved(true);
      } catch (err) {
        console.error('Failed to sync home config to cloud:', fmtErr(err));
        if (!silent) {
          // The most common cause is the table not existing yet — spell out the fix.
          const msg = String(err.message || err);
          const isMissing = /relation .*home_config.* does not exist|table.*home_config|Could not find the table/i.test(msg);
          if (isMissing) {
            alert(
              "Home page saved LOCALLY only — the `home_config` table doesn't exist in your Supabase project yet.\n\n" +
              "To fix (one-time setup):\n" +
              "1. Open Supabase Dashboard → SQL Editor → New query\n" +
              "2. Paste this and click Run:\n\n" +
              "CREATE TABLE IF NOT EXISTS public.home_config (\n" +
              "  section_key text PRIMARY KEY,\n" +
              "  enabled boolean DEFAULT true,\n" +
              "  data jsonb DEFAULT '{}'::jsonb,\n" +
              "  updated_at timestamptz DEFAULT now()\n" +
              ");\n" +
              "ALTER TABLE public.home_config ENABLE ROW LEVEL SECURITY;\n" +
              "CREATE POLICY \"home_config public read\" ON public.home_config FOR SELECT USING (true);\n" +
              "CREATE POLICY \"home_config admin write\" ON public.home_config FOR ALL\n" +
              "  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');\n\n" +
              "(Only SELECT is open to everyone — writes need your admin login, matching every other\n" +
              "table's policy. See the Phase 2 RLS migration for the full pattern.)\n\n" +
              "Then come back here and click Save to cloud again."
            );
          } else {
            alert("Home page saved locally, but cloud sync failed:\n\n" + msg + "\n\nCheck browser console for details.");
          }
          showHomeConfigSaved(false, msg.slice(0, 60));
        }
      }
    }

    function showHomeConfigSaved(ok, msg) {
      const el = document.getElementById('home-config-saved');
      if (!el) return;
      el.innerText = ok ? '✓ Saved to cloud' : `⚠ Saved locally — cloud: ${msg || 'error'}`;
      el.className = 'text-xs font-bold ' + (ok ? 'text-emerald-600' : 'text-amber-700');
      setTimeout(() => { el.innerText = ''; }, 3500);
    }

    async function fetchCloudHomeConfig() {
      try {
        const { data, error } = await supabaseClient.from('home_config').select('*');
        if (error) throw error;
        if (data && data.length) {
          for (const row of data) {
            if (homeConfig[row.section_key] && row.data && typeof row.data === 'object') {
              homeConfig[row.section_key] = { ...HOME_CONFIG_DEFAULT[row.section_key], ...row.data, enabled: !!row.enabled };
            }
          }
          localStorage.setItem('gp_home_config', JSON.stringify(homeConfig));
        }
      } catch (err) {
        console.error('Failed to fetch home config:', fmtErr(err));
      }
      renderHomePage();
    }

    // ---------- Renderers ----------
    // Each renderer is wrapped in try/catch so one failing section (e.g. a bad row in
    // homeConfig.news that throws while rendering) doesn't skip every section after it,
    // which was leaving the home page with only 2 sections showing and nothing to scroll to.
    function renderHomePage() {
      const safe = (name, fn) => { try { fn(); } catch (err) { console.error(`renderHomePage: ${name} threw`, fmtErr(err)); } };
      safe('typography', renderHomeTypography);
      safe('hero',        renderHomeHero);
      safe('studyrooms',  renderHomeStudyRooms);
      safe('passes',      renderHomePasses);
      safe('ticker',      renderHomeTicker);
      safe('stats',       renderHomeStats);
      safe('upcoming',    renderHomeUpcoming);
      safe('whatsnew',    renderHomeWhatsNew);
      safe('news',        renderHomeNews);
      safe('why',         renderHomeWhy);
      safe('toppers',     renderHomeToppers);
      safe('ratings',     renderHomeRatings);
      safe('faq',         renderHomeFaq);
      safe('cta',         renderHomeCta);
      safe('order',       applyHomeSectionOrder);
    }

    // FIX: "test papers are making the page long, can it be suitably placed" prompted a scroll-cap
    // fix earlier, but the deeper ask behind this whole thread was that section SEQUENCE was fixed —
    // admin could toggle/edit each section's content but never change what came before what. The
    // render functions above only fill in content; the on-screen order was fixed purely by where each
    // <section> tag physically sits in the HTML source. This actually MOVES the DOM nodes: reads each
    // section's homeConfig.<key>.order, sorts, and re-appends them to their shared parent in sequence
    // (appendChild on a node already in the DOM relocates it rather than duplicating it).
    const HOME_SECTION_DOM_IDS = {
      hero: 'home-hero', studyrooms: 'home-sections', passes: 'home-passes', ticker: 'home-ticker',
      stats: 'home-stats', upcoming: 'home-upcoming', whatsnew: 'home-whatsnew', news: 'home-news',
      why: 'home-why', toppers: 'home-toppers', ratings: 'home-ratings', faq: 'home-faq', cta: 'home-cta'
    };
    function applyHomeSectionOrder() {
      const entries = Object.entries(HOME_SECTION_DOM_IDS)
        .map(([key, domId]) => ({ key, domId, order: (homeConfig[key] && homeConfig[key].order) || 999 }))
        .sort((a, b) => a.order - b.order);
      let parent = null;
      entries.forEach(({ domId }) => {
        const el = document.getElementById(domId);
        if (!el) return;
        parent = parent || el.parentNode;
        parent.appendChild(el);  // moves the existing node to the end, in sorted order
      });
    }

    // Inject/refresh a <style> block that scopes chosen fonts to home page sections only.
    // Scoped so the rest of the app (admin, exam engine) keeps its normal typography.
    function renderHomeTypography() {
      const c = homeConfig.typography || {};
      let sheet = document.getElementById('home-typography-style');
      if (!sheet) {
        sheet = document.createElement('style');
        sheet.id = 'home-typography-style';
        document.head.appendChild(sheet);
      }
      const enabled = !!c.enabled;
      const bodyFont = enabled && c.bodyFont ? c.bodyFont : '';
      const headingFont = enabled && c.headingFont ? c.headingFont : '';
      // Target every home section wrapper: hero, ticker, stats, whatsnew, news, why, toppers, faq, cta, sections, passes
      const sel = '#home-hero, #home-ticker, #home-stats, #home-whatsnew, #home-news, #home-why, #home-toppers, #home-faq, #home-cta, #home-sections, #home-passes';
      sheet.textContent = `
        ${bodyFont ? `${sel} { font-family: ${bodyFont}; }` : ''}
        ${headingFont ? `${sel.split(', ').map(s => `${s} h1, ${s} h2, ${s} h3, ${s} h4`).join(', ')} { font-family: ${headingFont}; }` : ''}
      `;
    }

    // Resolves a stored CTA "action" string into a real navigation call
    function runHomeAction(action) {
      if (!action) return;
      if (action.startsWith('page:')) return renderDynamicCustomPage(action.slice(5));
      if (action.startsWith('url:')) { window.open(action.slice(4), '_blank', 'noopener'); return; }
      if (action === 'signup') { openLoginModal && openLoginModal(); return; }
      navigate(action);
    }

    function handleHeroCta(which) {
      const c = homeConfig.hero || {};
      runHomeAction(which === 2 ? c.cta2Action : c.cta1Action);
    }

    function renderHomeHero() {
      const c = homeConfig.hero || {};
      toggleSection('home-hero', !!c.enabled);
      if (!c.enabled) return;
      const badge = document.getElementById('home-hero-badge');
      const heading = document.getElementById('home-hero-heading');
      const desc = document.getElementById('home-hero-desc');
      const cta1 = document.getElementById('home-hero-cta1');
      const cta2 = document.getElementById('home-hero-cta2');
      if (badge) badge.innerText = c.badge || '';
      if (heading) {
        // Preserve the two-tone EVOLVE/+ (or GRIT/-PRO legacy) style based on which token the heading contains
        const main = c.headingMain || 'EVOLVE+';
        const sub  = c.headingSub  || '';
        const mainHtml =
          main === 'EVOLVE+' ? '<span class="text-white" style="font-family:Playfair Display,Georgia,serif;font-weight:900">EVOLVE</span><span class="hero-plus" style="font-family:Playfair Display,Georgia,serif;font-weight:900">+</span>'
          : main === 'GRIT-PRO' ? '<span class="text-white">GRIT</span><span class="text-amber-400">-PRO</span>'
          : escapeHtml(main);
        heading.innerHTML = `${mainHtml}${sub ? ` <span class="block text-2xl md:text-3xl font-bold text-slate-300 mt-2">${escapeHtml(sub)}</span>` : ''}`;
      }
      if (desc) desc.innerText = c.description || '';
      // A button shows only when it BOTH has a label AND hasn't been explicitly switched off — old saved
      // configs (from before the Show button checkboxes existed) have no cta*Enabled key at all, and the
      // HOME_CONFIG_DEFAULT merge in fetchCloudHomeConfig fills that gap with `true`, so existing hero
      // buttons keep showing exactly as before unless an admin now deliberately unchecks one.
      if (cta1) { cta1.innerText = c.cta1Label || ''; cta1.classList.toggle('hidden', !c.cta1Label || c.cta1Enabled === false); }
      if (cta2) { cta2.innerText = c.cta2Label || ''; cta2.classList.toggle('hidden', !c.cta2Label || c.cta2Enabled === false); }
      // Optional admin-uploaded background photo (see hcImageField in the Home Page editor). Absent
      // by default, which keeps today's plain dark-gradient hero exactly as-is.
      const heroSection = document.getElementById('home-hero');
      const heroImg = document.getElementById('home-hero-img');
      if (heroSection && heroImg) {
        if (c.heroImageDataUrl) {
          heroImg.src = c.heroImageDataUrl;
          heroSection.classList.add('has-photo');
        } else {
          heroImg.src = '';
          heroSection.classList.remove('has-photo');
        }
      }
      // NEW: hero panel size. Outer padding (py-*) alone barely changes the visible height, because the
      // gap BETWEEN the badge/heading/description/buttons (space-y-*) and the padding above the button
      // row (pt-*) add up to more height than the section's own padding does. So "size" swaps all three
      // together. 'normal' matches the three classes that originally shipped hardcoded in the static
      // HTML (py-20 / space-y-6 / pt-4), so anyone who never touches this dropdown sees no change at all.
      const HERO_SIZES = {
        minimal:  { outer: 'py-4',  gap: 'space-y-2', btnTop: 'pt-1' },
        compact:  { outer: 'py-8',  gap: 'space-y-3', btnTop: 'pt-2' },
        normal:   { outer: 'py-20', gap: 'space-y-6', btnTop: 'pt-4' },
        spacious: { outer: 'py-28', gap: 'space-y-8', btnTop: 'pt-6' }
      };
      const sizeKey = HERO_SIZES[c.size] ? c.size : 'normal';
      const sizes = HERO_SIZES[sizeKey];
      const heroInner = document.getElementById('home-hero-inner');
      const heroBtnRow = document.getElementById('home-hero-btnrow');
      if (heroSection) {
        Object.values(HERO_SIZES).forEach(s => heroSection.classList.remove(s.outer));
        heroSection.classList.add(sizes.outer);
      }
      if (heroInner) {
        Object.values(HERO_SIZES).forEach(s => heroInner.classList.remove(s.gap));
        heroInner.classList.add(sizes.gap);
      }
      if (heroBtnRow) {
        Object.values(HERO_SIZES).forEach(s => heroBtnRow.classList.remove(s.btnTop));
        heroBtnRow.classList.add(sizes.btnTop);
      }
    }

    function renderHomeStudyRooms() {
      const c = homeConfig.studyrooms || {};
      const el = document.getElementById('home-sections');
      if (!el) return;
      // The existing renderHomeSections() already hides the block when no home-tiles exist.
      // Here we additionally respect the admin toggle: if disabled, force-hide.
      if (!c.enabled) { el.classList.add('hidden'); return; }
      // renderHomeSections() decides whether to unhide based on content; we just refresh the text.
      const t = document.getElementById('home-sections-title');
      const s = document.getElementById('home-sections-sub');
      if (t) t.innerText = c.title || 'Study Rooms';
      if (s) s.innerText = c.subtitle || '';
    }

    function renderHomePasses() {
      const c = homeConfig.passes || {};
      toggleSection('home-passes', !!c.enabled);
      if (!c.enabled) return;
      const t = document.getElementById('home-passes-title');
      const s = document.getElementById('home-passes-sub');
      if (t) t.innerText = c.title || 'Flexible Enrollment Passes';
      if (s) s.innerText = c.subtitle || '';
      // FIX: this card used to be permanently hardcoded with no way to hide it. Default stays
      // visible (showPayPerMock defaults true if unset, so existing sites don't change unexpectedly).
      toggleSection('home-pay-per-mock-card', c.showPayPerMock !== false);
    }

    function toggleSection(id, show) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    }

    function renderHomeTicker() {
      const c = homeConfig.ticker || {};
      const items = (c.items || []).filter(x => x && String(x).trim());
      const show = !!c.enabled && items.length > 0;
      toggleSection('home-ticker', show);
      if (!show) return;
      // Repeat items twice so the marquee reads continuously
      const spans = items.map(t => `<span class="tick-item"><span class="dot"></span>${escapeHtml(t)}</span>`).join('');
      document.getElementById('home-ticker-track').innerHTML = spans + spans;
    }

    function renderHomeStats() {
      const c = homeConfig.stats || {};
      const items = (c.items || []).filter(x => x && (x.value || x.label));
      const show = !!c.enabled && items.length > 0;
      toggleSection('home-stats', show);
      if (!show) return;
      document.getElementById('home-stats-grid').innerHTML = items.map(it =>
        `<div class="home-stat"><b>${escapeHtml(it.value || '')}</b><span>${escapeHtml(it.label || '')}</span></div>`
      ).join('');
    }

    // Pulls newest items from your live catalogs (tests, PDFs, pages, bundles)
    // Show the next N scheduled tests, sorted by scheduled_for ascending.
    // Papers with scheduled_for in the past are hidden. Papers without scheduled_for are hidden.
    // If no upcoming tests exist, section is auto-hidden entirely.
    function renderHomeUpcoming() {
      const c = homeConfig.upcoming || {};
      const now = Date.now();
      const upcoming = (testsCatalog || [])
        .filter(t => t.scheduled_for && new Date(t.scheduled_for).getTime() > now)
        .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
      const show = !!c.enabled && upcoming.length > 0;
      toggleSection('home-upcoming', show);
      if (!show) return;
      document.getElementById('home-upcoming-title').innerText = c.title || '🗓 Upcoming Live Tests';
      document.getElementById('home-upcoming-sub').innerText = c.subtitle || '';
      const limit = Math.max(3, Math.min(12, parseInt(c.limit, 10) || 6));
      const grid = document.getElementById('home-upcoming-grid');
      grid.innerHTML = upcoming.slice(0, limit).map(t => {
        const dt = new Date(t.scheduled_for);
        const diffMs = dt.getTime() - now;
        const diffMin = Math.round(diffMs / 60000);
        const diffH = Math.round(diffMin / 60);
        const diffD = Math.round(diffH / 24);
        // Humanized countdown
        let countdown;
        if (diffMin < 60)      countdown = `in ${diffMin} min`;
        else if (diffH < 24)   countdown = `in ${diffH} hr`;
        else                   countdown = `in ${diffD} day${diffD === 1 ? '' : 's'}`;
        const dtStr = dt.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const catName = (EXAM_CATEGORIES[t.category]?.name || t.category || '');
        return `
          <a href="javascript:void(0)" onclick="filterExamCategory('${t.category}'); navigate('tests');" class="bg-white rounded-2xl border border-amber-200 hover:border-amber-500 hover:shadow-lg transition p-4 flex flex-col gap-2">
            <div class="flex items-start justify-between gap-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-amber-700">${escapeHtml(catName)}</span>
              <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full whitespace-nowrap">${countdown}</span>
            </div>
            <div class="font-bold text-slate-900 text-sm leading-snug">${escapeHtml(t.title || 'Untitled paper')}</div>
            <div class="text-[11px] text-slate-500 font-mono">🕓 ${escapeHtml(dtStr)}</div>
            <div class="text-[11px] text-slate-500">${t.questionCount || 0} questions · ${t.price === 0 ? 'Free' : '₹' + t.price}</div>
          </a>`;
      }).join('');
    }

    function renderHomeWhatsNew() {
      const c = homeConfig.whatsnew || {};
      const show = !!c.enabled;
      toggleSection('home-whatsnew', show);
      if (!show) return;
      document.getElementById('home-whatsnew-title').innerText = c.title || "What's New";
      document.getElementById('home-whatsnew-sub').innerText = c.subtitle || '';
      const limit = Math.max(3, Math.min(12, parseInt(c.limit, 10) || 6));

      const items = [];
      // Newest tests
      (testsCatalog || []).slice(-8).reverse().forEach(t => items.push({
        kind: 'Test', label: t.title || 'Untitled paper', tag: (EXAM_CATEGORIES[t.category]?.name || t.category || ''),
        icon: '📝', action: `filterExamCategory('${t.category}'); navigate('tests');`
      }));
      // Newest PDFs
      (pdfVault || []).slice(-8).reverse().forEach(d => items.push({
        kind: 'PDF', label: d.title, tag: d.access === 'paid' ? `₹${d.price}` : 'Free',
        icon: '📄', action: `downloadOrOpenPdf('${d.id}')`
      }));
      // Newest custom pages (skip locked ones the visitor can't open)
      (customPages || []).slice(-8).reverse().forEach(p => items.push({
        kind: 'Page', label: p.title, tag: p.summary || '', icon: p.icon || '📚',
        action: `renderDynamicCustomPage('${p.id}')`
      }));

      const grid = document.getElementById('home-whatsnew-grid');
      if (!items.length) { grid.innerHTML = '<p class="text-slate-400 text-sm col-span-full text-center">Nothing added yet.</p>'; return; }
      grid.innerHTML = items.slice(0, limit).map(it => `
        <a href="javascript:void(0)" onclick="${it.action}" class="bg-white rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition p-4 flex items-start gap-3">
          <span class="text-2xl">${it.icon}</span>
          <div class="min-w-0 flex-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-700">${escapeHtml(it.kind)}</span>
            <div class="font-bold text-slate-900 text-sm truncate">${escapeHtml(it.label)}</div>
            ${it.tag ? `<div class="text-[11px] text-slate-500 mt-0.5 truncate">${escapeHtml(it.tag)}</div>` : ''}
          </div>
        </a>`).join('');
    }

    function renderHomeNews() {
      const c = homeConfig.news || {};
      const items = (c.items || []).filter(n => n && (n.title || n.body));
      const show = !!c.enabled && items.length > 0;
      toggleSection('home-news', show);
      if (!show) return;
      document.getElementById('home-news-title').innerText = c.title || 'News & Notifications';
      document.getElementById('home-news-sub').innerText = c.subtitle || '';
      document.getElementById('home-news-grid').innerHTML = items.map(n => {
        const badgeClass = ['exam','result','alert'].includes(n.badge) ? n.badge : '';
        const badgeLabel = n.badge ? escapeHtml(String(n.badge).toUpperCase()) : '';
        const dateTxt = n.date ? new Date(n.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const more = n.link ? `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener" class="more">Read more →</a>` : '';
        return `<div class="home-news-card">
          <div><span class="date">${escapeHtml(dateTxt)}</span>${badgeLabel ? `<span class="badge ${badgeClass}">${badgeLabel}</span>` : ''}</div>
          <h4>${escapeHtml(n.title || '')}</h4>
          ${n.body ? `<p>${escapeHtml(n.body)}</p>` : ''}
          ${more}
        </div>`;
      }).join('');
    }

    function renderHomeWhy() {
      const c = homeConfig.why || {};
      const items = (c.items || []).filter(x => x && (x.title || x.desc));
      const show = !!c.enabled && items.length > 0;
      toggleSection('home-why', show);
      if (!show) return;
      document.getElementById('home-why-title').innerText = c.title || 'Why Evolve+';
      document.getElementById('home-why-sub').innerText = c.subtitle || '';
      document.getElementById('home-why-grid').innerHTML = items.map(x =>
        `<div class="home-why-card"><div class="icon">${escapeHtml(x.icon || '✨')}</div><h4>${escapeHtml(x.title || '')}</h4>${x.desc ? `<p>${escapeHtml(x.desc)}</p>` : ''}</div>`
      ).join('');
    }

    function renderHomeToppers() {
      const c = homeConfig.toppers || {};
      const items = (c.items || []).filter(x => x && x.name);
      const show = !!c.enabled && items.length > 0;
      toggleSection('home-toppers', show);
      if (!show) return;
      document.getElementById('home-toppers-title').innerText = c.title || 'Our Achievers';
      document.getElementById('home-toppers-sub').innerText = c.subtitle || '';
      document.getElementById('home-toppers-grid').innerHTML = items.map(t => {
        const initials = (t.name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const avatar = t.photo
          ? `<div class="avatar" style="background-image:url('${escapeHtml(t.photo)}')"></div>`
          : `<div class="avatar">${escapeHtml(initials)}</div>`;
        return `<div class="home-topper-card">${avatar}<div class="min-w-0 flex-1">
          <h4>${escapeHtml(t.name)}</h4>
          <div class="exam-line">${escapeHtml(t.exam || '')}</div>
          ${t.rank ? `<span class="rank">${escapeHtml(t.rank)}</span>` : ''}
          ${t.quote ? `<blockquote>"${escapeHtml(t.quote)}"</blockquote>` : ''}
        </div></div>`;
      }).join('');
    }

    function renderHomeRatings() {
      const c = homeConfig.ratings || {};
      // Requires a real score AND a link — a badge that doesn't click through anywhere isn't useful,
      // and showing a number with no source to verify it against isn't a good look either.
      const show = !!c.enabled && !!(c.score || '').trim() && !!(c.link || '').trim();
      toggleSection('home-ratings', show);
      if (!show) return;
      document.getElementById('home-ratings-score').innerText = c.score || '';
      document.getElementById('home-ratings-count').innerText = c.reviewCount || '';
      document.getElementById('home-ratings-title').innerHTML = `${escapeHtml(c.linkLabel || 'Rated by our students')} &rarr;`;
      document.getElementById('home-ratings-link').href = c.link || '#';
    }

    function renderHomeFaq() {
      const c = homeConfig.faq || {};
      const items = (c.items || []).filter(x => x && x.q);
      const show = !!c.enabled && items.length > 0;
      toggleSection('home-faq', show);
      if (!show) return;
      document.getElementById('home-faq-title').innerText = c.title || 'Frequently Asked Questions';
      document.getElementById('home-faq-list').innerHTML = items.map(f =>
        `<details class="home-faq-item"><summary>${escapeHtml(f.q)}</summary>${f.a ? `<p>${escapeHtml(f.a)}</p>` : ''}</details>`
      ).join('');
    }

    function renderHomeCta() {
      const c = homeConfig.cta || {};
      const show = !!c.enabled && (c.heading || c.buttonLabel);
      toggleSection('home-cta', show);
      if (!show) return;
      document.getElementById('home-cta-heading').innerText = c.heading || '';
      document.getElementById('home-cta-sub').innerText = c.subtitle || '';
      document.getElementById('home-cta-btn').innerText = c.buttonLabel || 'Get started';
    }

    function handleHomeCtaClick() {
      const action = (homeConfig.cta && homeConfig.cta.buttonAction) || 'tests';
      if (action === 'signup') { openSignupModal && openSignupModal(); return; }
      navigate(action);
    }

    // ---------- Admin editors ----------
    function renderHomeConfigAdmin() {
      const root = document.getElementById('home-config-admin');
      if (!root) return;
      root.innerHTML = `
        ${sectionShell('typography', 'Typography (fonts for the whole home page)',
          hcFontField('typography', 'headingFont', 'Headings font') +
          hcFontField('typography', 'bodyFont', 'Body / paragraph font') +
          `<p class="text-[11px] text-slate-500 pl-1">Leave "Default" to inherit the app's built-in font. Only affects the home page — admin console and exam engine keep their own typography.</p>`
        )}
        ${sectionShell('hero', 'Hero (main banner at the top of home)',
          hcImageField('hero', 'heroImageDataUrl', 'Hero background photo (optional)') +
          `<div class="mb-2">
             <label class="block font-bold text-slate-700 mb-1 text-xs">Panel size</label>
             <select data-hc-field="hero.size" onchange="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg bg-white outline-none text-xs">
               <option value="minimal">Minimal (shortest — tightest spacing throughout)</option>
               <option value="compact">Compact (noticeably shorter than default)</option>
               <option value="normal">Default (today's original size)</option>
               <option value="spacious">Spacious (larger than default)</option>
             </select>
           </div>` +
          hcTextField('hero', 'badge', 'Small badge above the heading') +
          hcTextField('hero', 'headingMain', 'Main heading (keep as "EVOLVE+" for the two-tone Playfair style)') +
          hcTextField('hero', 'headingSub', 'Sub-heading (shown below the main heading)') +
          hcTextareaField('hero', 'description', 'Description paragraph') +
          `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
             <div>
               ${hcTextField('hero', 'cta1Label', 'Primary button label')}
               ${hcActionField('hero', 'cta1Action', 'Primary button goes to')}
               ${hcCheckboxField('hero', 'cta1Enabled', 'Show primary button')}
             </div>
             <div>
               ${hcTextField('hero', 'cta2Label', 'Secondary button label')}
               ${hcActionField('hero', 'cta2Action', 'Secondary button goes to')}
               ${hcCheckboxField('hero', 'cta2Enabled', 'Show secondary button')}
             </div>
           </div>`
        )}
        ${sectionShell('studyrooms', 'Study Rooms strip (auto-populated from your pages)',
          hcTextField('studyrooms', 'title', 'Section title') +
          hcTextField('studyrooms', 'subtitle', 'Subtitle') +
          `<p class="text-[11px] text-slate-500 pl-1">Which tiles appear here comes from Pages — tick "Show as a tile on the home page" on any page.</p>`
        )}
        ${sectionShell('passes', 'Enrollment Passes strip (bundle catalog)',
          hcTextField('passes', 'title', 'Section title') +
          hcTextField('passes', 'subtitle', 'Subtitle') +
          hcCheckboxField('passes', 'showPayPerMock', 'Show the "Pay Per Mock" individual-papers card') +
          `<p class="text-[11px] text-slate-500 pl-1">Which bundle cards appear here is controlled per-bundle in <b>Bundles &amp; passes</b> (the "Show on home" toggle on each row).</p>`
        )}
        ${sectionShell('ticker', 'Ticker (scrolling news bar)', hcListEditor('ticker', 'items', [
          { key: '_', label: 'Message', type: 'text', full: true }
        ], { rowLabel: 'Message' }))}
        ${sectionShell('stats', 'Stats strip', hcListEditor('stats', 'items', [
          { key: 'value', label: 'Value (e.g. 1,000+)', type: 'text' },
          { key: 'label', label: 'Label', type: 'text' }
        ], { rowLabel: 'Stat' }))}
        ${sectionShell('upcoming', 'Upcoming Live Tests (auto-populated from scheduled papers)',
          hcTextField('upcoming', 'title', 'Section title') +
          hcTextField('upcoming', 'subtitle', 'Subtitle') +
          hcNumberField('upcoming', 'limit', 'How many cards (3–12)', 3, 12) +
          `<p class="text-[11px] text-slate-500 pl-1">To schedule a paper, edit it in the studio and set the <b>Scheduled for</b> date. This section only shows papers with a future scheduled date.</p>`
        )}
        ${sectionShell('whatsnew', "What's New (auto-populated)",
          hcTextField('whatsnew', 'title', 'Section title') +
          hcTextField('whatsnew', 'subtitle', 'Subtitle') +
          hcNumberField('whatsnew', 'limit', 'How many cards (3–12)', 3, 12)
        )}
        ${sectionShell('news', 'News & Notifications',
          hcTextField('news', 'title', 'Section title') +
          hcTextField('news', 'subtitle', 'Subtitle') +
          hcListEditor('news', 'items', [
            { key: 'date',  label: 'Date',  type: 'date' },
            { key: 'badge', label: 'Badge (exam/result/alert)', type: 'text' },
            { key: 'title', label: 'Title', type: 'text',    full: true },
            { key: 'body',  label: 'Body',  type: 'textarea',full: true },
            { key: 'link',  label: 'Link URL (optional)', type: 'text', full: true }
          ], { rowLabel: 'News item' })
        )}
        ${sectionShell('why', 'Why Evolve+ (feature bullets)',
          hcTextField('why', 'title', 'Section title') +
          hcTextField('why', 'subtitle', 'Subtitle') +
          hcListEditor('why', 'items', [
            { key: 'icon',  label: 'Emoji', type: 'text' },
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'desc',  label: 'Description', type: 'textarea', full: true }
          ], { rowLabel: 'Feature' })
        )}
        ${sectionShell('toppers', 'Toppers / testimonials',
          hcTextField('toppers', 'title', 'Section title') +
          hcTextField('toppers', 'subtitle', 'Subtitle') +
          hcListEditor('toppers', 'items', [
            { key: 'name',  label: 'Name',  type: 'text' },
            { key: 'exam',  label: 'Exam',  type: 'text' },
            { key: 'rank',  label: 'Rank / status', type: 'text' },
            { key: 'photo', label: 'Photo URL (optional)', type: 'text', full: true },
            { key: 'quote', label: 'Quote', type: 'textarea', full: true }
          ], { rowLabel: 'Achiever' })
        )}
        ${sectionShell('ratings', 'Ratings badge (links out to Google reviews or similar)',
          hcTextField('ratings', 'score', 'Rating score (e.g. "4.8")') +
          hcTextField('ratings', 'reviewCount', 'Review count text (e.g. "200+ Google reviews")') +
          hcTextField('ratings', 'linkLabel', 'Link text (e.g. "Rated by our students")') +
          hcTextField('ratings', 'link', 'Link URL (your Google Business review link, or similar)') +
          `<p class="text-[11px] text-slate-500 pl-1">Stays hidden from visitors until both a score and a link are filled in, even if turned on here — this is a static badge you update yourself, not a live feed, so an empty one would be misleading.</p>`
        )}
        ${sectionShell('faq', 'FAQ',
          hcTextField('faq', 'title', 'Section title') +
          hcListEditor('faq', 'items', [
            { key: 'q', label: 'Question', type: 'text',    full: true },
            { key: 'a', label: 'Answer',   type: 'textarea',full: true }
          ], { rowLabel: 'FAQ' })
        )}
        ${sectionShell('cta', 'Call-to-action strip',
          hcTextField('cta', 'heading', 'Heading') +
          hcTextField('cta', 'subtitle', 'Subtitle') +
          hcTextField('cta', 'buttonLabel', 'Button label') +
          `<div class="mb-2">
             <label class="block font-bold text-slate-700 mb-1 text-xs">Button action</label>
             <select data-hc-field="cta.buttonAction" onchange="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg bg-white outline-none text-xs">
               <option value="tests">Go to Exam Hub</option>
               <option value="signup">Open Sign-up modal</option>
               <option value="dashboard">Go to Dashboard</option>
               <option value="home">Scroll home top</option>
             </select>
           </div>`
        )}
      `;
      // Populate all simple field values
      root.querySelectorAll('[data-hc-field]').forEach(el => {
        const [sec, field] = el.dataset.hcField.split('.');
        const val = (homeConfig[sec] && homeConfig[sec][field]);
        if (val == null) return;
        if (el.type === 'checkbox') el.checked = !!val;
        else el.value = val;
      });
      // Populate the little enabled-dots
      root.querySelectorAll('[data-hc-dot]').forEach(dot => {
        const sec = dot.dataset.hcDot;
        const on = !!(homeConfig[sec] && homeConfig[sec].enabled);
        dot.classList.toggle('bg-slate-300', !on);
        dot.classList.toggle('bg-emerald-500', on);
      });
      // Populate image-field previews (can't set a file input's value, so hcImageField's preview
      // <img>/remove-button are hydrated here instead of the generic [data-hc-field] loop above).
      root.querySelectorAll('[data-hc-image-field]').forEach(el => {
        const [sec, field] = el.dataset.hcImageField.split('.');
        hcRenderImagePreview(sec, field);
      });
    }

    // A dropdown of common navigation targets, plus a text input for free-form page:/url:
    function hcActionField(sec, field, label) {
      const current = (homeConfig[sec] && homeConfig[sec][field]) || '';
      const pageOpts = (customPages || []).map(p => `<option value="page:${p.id}">Page: ${escapeHtml(p.title)}</option>`).join('');
      return `<div class="mb-2">
        <label class="block font-bold text-slate-700 mb-1 text-xs">${escapeHtml(label)}</label>
        <select data-hc-field="${sec}.${field}" onchange="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg bg-white outline-none text-xs">
          <option value="home">Home (scroll to top)</option>
          <option value="tests">Exam Hub</option>
          <option value="dashboard">Dashboard</option>
          <option value="signup">Open login/sign-up modal</option>
          ${pageOpts}
        </select>
        <input type="text" data-hc-field="${sec}.${field}" oninput="hcFieldChange(this)" value="${escapeHtml(current)}" placeholder="…or paste an action like page:p_abc or url:https://…" class="w-full px-2.5 py-1.5 border rounded-lg outline-none text-xs mt-1 font-mono" />
      </div>`;
    }

    function hcTextareaField(sec, field, label) {
      return `<div class="mb-2">
        <label class="block font-bold text-slate-700 mb-1 text-xs">${escapeHtml(label)}</label>
        <textarea data-hc-field="${sec}.${field}" oninput="hcFieldChange(this)" rows="2" class="w-full px-2.5 py-1.5 border rounded-lg outline-none text-xs"></textarea>
      </div>`;
    }

    // Photo upload field for the Home Page editor (e.g. the hero background photo). Same
    // FileReader -> canvas resize -> dataURL pattern used for page/question images and the payment
    // QR upload, stored directly on homeConfig[sec][field] like every other hc*Field. File inputs
    // can't be given a `value`, so the preview <img>/remove-button visibility is hydrated separately
    // in renderHomeConfigAdmin() (see the [data-hc-image-field] pass) rather than in the generic
    // [data-hc-field] value-hydration loop.
    function hcImageField(sec, field, label) {
      const id = `hc-img-${sec}-${field}`;
      return `<div class="mb-3">
        <label class="block font-bold text-slate-700 mb-1 text-xs">${escapeHtml(label)}</label>
        <div class="flex items-center gap-3">
          <div class="w-20 h-14 bg-slate-100 border rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            <img id="${id}-preview" data-hc-image-field="${sec}.${field}" src="" alt="" class="w-full h-full object-cover hidden" />
            <span id="${id}-empty" class="text-[9px] text-slate-400 text-center px-1 leading-tight">No photo</span>
          </div>
          <div class="flex items-center gap-1.5">
            <label class="inline-block px-2.5 py-1.5 border rounded-lg bg-white font-bold cursor-pointer hover:bg-slate-50 text-[11px]">
              Upload
              <input type="file" accept="image/*" class="hidden" onchange="hcImageFieldChange(this, '${sec}', '${field}')" />
            </label>
            <button type="button" id="${id}-remove" onclick="hcRemoveImageField('${sec}', '${field}')" class="hidden px-2.5 py-1.5 border rounded-lg bg-white text-rose-600 font-bold hover:bg-rose-50 text-[11px]">Remove</button>
          </div>
        </div>
      </div>`;
    }

    // Same font list as the page editor — keeps things consistent between the two editors.
    function hcFontField(sec, field, label) {
      return `<div class="mb-2">
        <label class="block font-bold text-slate-700 mb-1 text-xs">${escapeHtml(label)}</label>
        <select data-hc-field="${sec}.${field}" onchange="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg bg-white outline-none text-xs">
          <option value="">Default (Inter / system)</option>
          <optgroup label="Sans-serif">
            <option value="Inter, system-ui, sans-serif">Inter</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Verdana, Geneva, sans-serif">Verdana</option>
            <option value="Tahoma, Geneva, sans-serif">Tahoma</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          </optgroup>
          <optgroup label="Serif">
            <option value="Georgia, 'Times New Roman', serif">Georgia</option>
            <option value="'Times New Roman', Times, serif">Times New Roman</option>
            <option value="'Palatino Linotype', Palatino, serif">Palatino</option>
            <option value="'Book Antiqua', Palatino, serif">Book Antiqua</option>
          </optgroup>
          <optgroup label="Monospace">
            <option value="'Courier New', Courier, monospace">Courier New</option>
            <option value="Consolas, 'Andale Mono', monospace">Consolas</option>
          </optgroup>
          <optgroup label="Kannada">
            <option value="'Noto Sans Kannada', system-ui, sans-serif">Noto Sans Kannada</option>
            <option value="'Tunga', 'Noto Sans Kannada', sans-serif">Tunga</option>
          </optgroup>
          <optgroup label="Fun">
            <option value="'Comic Sans MS', 'Chalkboard SE', sans-serif">Comic Sans MS</option>
          </optgroup>
        </select>
      </div>`;
    }

    function sectionShell(sec, title, inner) {
      // FIX: "test papers making the page long" led to a scroll fix, but the deeper ask was that
      // section SEQUENCE was fixed — you could edit content but never reorder sections. Every section
      // shell now carries an Order field automatically (skipped only for 'typography', which has no
      // visible <section> of its own to move) — see HOME_SECTION_DOM_IDS / applyHomeSectionOrder.
      const hasOrder = Object.prototype.hasOwnProperty.call(HOME_SECTION_DOM_IDS, sec);
      const orderField = hasOrder
        ? `<div class="mb-2 max-w-[140px]"><label class="block font-bold text-slate-700 mb-1 text-xs">Display order</label><input type="number" min="1" max="20" data-hc-field="${sec}.order" oninput="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg outline-none text-xs font-mono" /></div>`
        : '';
      return `<details class="bg-white border border-slate-200 rounded-2xl p-4 group" open>
        <summary class="cursor-pointer flex items-center justify-between gap-3 select-none">
          <span class="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 hc-enabled-dot" data-hc-dot="${sec}"></span>
            ${escapeHtml(title)}
          </span>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer" onclick="event.stopPropagation()">
            <input type="checkbox" data-hc-field="${sec}.enabled" onchange="hcFieldChange(this)" class="w-4 h-4" />
            Show on home
          </label>
        </summary>
        <div class="mt-3 space-y-2">${orderField}${inner}</div>
      </details>`;
    }

    function hcTextField(sec, field, label) {
      return `<div class="mb-2">
        <label class="block font-bold text-slate-700 mb-1 text-xs">${escapeHtml(label)}</label>
        <input type="text" data-hc-field="${sec}.${field}" oninput="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg outline-none text-xs" />
      </div>`;
    }

    function hcNumberField(sec, field, label, min, max) {
      return `<div class="mb-2">
        <label class="block font-bold text-slate-700 mb-1 text-xs">${escapeHtml(label)}</label>
        <input type="number" min="${min}" max="${max}" data-hc-field="${sec}.${field}" oninput="hcFieldChange(this)" class="w-full px-2.5 py-1.5 border rounded-lg outline-none text-xs font-mono" />
      </div>`;
    }

    function hcCheckboxField(sec, field, label) {
      return `<label class="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer mb-2">
        <input type="checkbox" data-hc-field="${sec}.${field}" onchange="hcFieldChange(this)" class="w-4 h-4" />
        ${escapeHtml(label)}
      </label>`;
    }

    function hcListEditor(sec, field, columns, opts) {
      const rows = ((homeConfig[sec] || {})[field] || []);
      const rowsHtml = rows.map((row, idx) => hcListRow(sec, field, columns, row, idx)).join('');
      return `<div class="mt-1">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${escapeHtml(opts.rowLabel || 'Item')}s (${rows.length})</span>
          <button type="button" onclick="hcAddRow('${sec}','${field}', ${JSON.stringify(columns).replace(/"/g,'&quot;')}, '${escapeHtml(opts.rowLabel || 'Item')}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded">+ Add ${escapeHtml(opts.rowLabel || 'Item')}</button>
        </div>
        <div id="hc-${sec}-${field}-rows" class="space-y-2">${rowsHtml}</div>
      </div>`;
    }

    function hcListRow(sec, field, columns, row, idx) {
      // Special-case single-string list (ticker: items is an array of strings)
      const isStringList = columns.length === 1 && columns[0].key === '_';
      const cellsHtml = columns.map(col => {
        const val = isStringList ? (row || '') : (row && row[col.key] != null ? row[col.key] : '');
        const attrs = `data-hc-listfield="${sec}.${field}.${idx}.${col.key}" oninput="hcListFieldChange(this)"`;
        const cls = `w-full px-2 py-1 border rounded outline-none text-xs ${col.type === 'textarea' ? 'font-normal' : ''} ${col.full ? '' : ''}`;
        const label = `<label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">${escapeHtml(col.label)}</label>`;
        const control = col.type === 'textarea'
          ? `<textarea ${attrs} rows="2" class="${cls}">${escapeHtml(val)}</textarea>`
          : `<input type="${col.type || 'text'}" ${attrs} value="${escapeHtml(String(val))}" class="${cls}" />`;
        return `<div class="${col.full ? 'col-span-2' : ''}">${label}${control}</div>`;
      }).join('');
      return `<div class="hc-editor-row">
        <div class="hc-fields grid grid-cols-2 gap-2">${cellsHtml}</div>
        <button type="button" onclick="hcRemoveRow('${sec}','${field}', ${idx})" title="Remove" class="w-7 h-7 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold">×</button>
      </div>`;
    }

    function hcFieldChange(el) {
      const [sec, field] = el.dataset.hcField.split('.');
      if (!homeConfig[sec]) homeConfig[sec] = {};
      if (el.type === 'checkbox') homeConfig[sec][field] = el.checked;
      else if (el.type === 'number') homeConfig[sec][field] = parseInt(el.value, 10) || 0;
      else homeConfig[sec][field] = el.value;
      // Update the little green dot next to the section header
      const dot = document.querySelector(`[data-hc-dot="${sec}"]`);
      if (dot) dot.classList.toggle('bg-slate-300', !homeConfig[sec].enabled), dot.classList.toggle('bg-emerald-500', !!homeConfig[sec].enabled);
      renderHomePage();
    }

    function hcRenderImagePreview(sec, field) {
      const id = `hc-img-${sec}-${field}`;
      const img = document.getElementById(`${id}-preview`);
      const empty = document.getElementById(`${id}-empty`);
      const removeBtn = document.getElementById(`${id}-remove`);
      if (!img) return;
      const val = homeConfig[sec] && homeConfig[sec][field];
      if (val) {
        img.src = val;
        img.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');
      } else {
        img.src = '';
        img.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
      }
    }

    function hcImageFieldChange(input, sec, field) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      if (!file.type || !file.type.startsWith('image/')) { alert('Please choose an image file (PNG, JPG, etc).'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          // Wide banner photo — cap at 1600px on the long edge and encode as JPEG (photos compress
          // far better as JPEG than PNG, unlike the QR upload which needed lossless PNG for scannability).
          const maxDim = 1600;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale) || img.width;
          canvas.height = Math.round(img.height * scale) || img.height;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          if (!homeConfig[sec]) homeConfig[sec] = {};
          homeConfig[sec][field] = canvas.toDataURL('image/jpeg', 0.82);
          hcRenderImagePreview(sec, field);
          renderHomePage();
        };
        img.onerror = () => alert("That file couldn't be read as an image.");
        img.src = reader.result;
      };
      reader.onerror = () => alert("That file couldn't be read.");
      reader.readAsDataURL(file);
    }

    function hcRemoveImageField(sec, field) {
      if (!homeConfig[sec] || !homeConfig[sec][field]) return;
      if (!confirm('Remove this photo? The section goes back to its plain default look.')) return;
      homeConfig[sec][field] = '';
      hcRenderImagePreview(sec, field);
      renderHomePage();
    }

    function hcListFieldChange(el) {
      const [sec, field, idx, key] = el.dataset.hcListfield.split('.');
      const list = homeConfig[sec][field];
      if (!Array.isArray(list)) return;
      if (key === '_') list[+idx] = el.value;
      else {
        if (typeof list[+idx] !== 'object' || list[+idx] == null) list[+idx] = {};
        list[+idx][key] = el.value;
      }
      renderHomePage();
    }

    function hcAddRow(sec, field, columns, rowLabel) {
      if (!homeConfig[sec][field]) homeConfig[sec][field] = [];
      const isStringList = columns.length === 1 && columns[0].key === '_';
      homeConfig[sec][field].push(isStringList ? '' : Object.fromEntries(columns.map(c => [c.key, ''])));
      renderHomeConfigAdmin();  // re-render editor to show new row
      renderHomePage();
    }

    function hcRemoveRow(sec, field, idx) {
      const list = homeConfig[sec][field];
      if (!Array.isArray(list)) return;
      list.splice(idx, 1);
      renderHomeConfigAdmin();
      renderHomePage();
    }


