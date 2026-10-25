-- Part of the "UPSC-centric institute" repositioning (companion to PR #117 and the
-- exam_categories reorder, both 2026-10-25). Adds the first UPSC-specific content page --
-- previously the only deep resource page on the whole site was the Karnataka Handbook, with
-- nothing equivalent for UPSC CSE despite UPSC now being the lead identity in the site's copy.
--
-- Content is Prelims/Mains/Interview pattern, marks breakdown, a typical annual cycle, and a
-- cross-link note for KAS/UPSC syllabus overlap -- all stable, evergreen facts about how the
-- exam works, not current-cycle-specific dates (those stay on the real Study Planner countdown,
-- which this page links to rather than duplicating).
--
-- Deliberately uses ONLY non-referential content blocks (kb-box, kb-stats, kb-table-wrap,
-- kb-timeline, kb-faq) -- no kb-resource-card or kb-pagelink widgets, since those carry
-- data-target-id/data-paper references to specific pdf_vault/tests_catalog rows that don't exist
-- yet for UPSC sectional content. Verified by rendering through the app's own
-- renderDynamicCustomPage() in the test harness: all expected blocks present, zero leftover
-- editor-only .kb-block-delete/.kb-block-move nodes, no console errors.
--
-- Also appended to nav_menu's "Resources" submenu (id nav_1789838140095), as the first entry
-- ahead of "Karnataka Handbook":
--   UPDATE nav_menu SET submenus = '[{"id":"nav_1792918520446","label":"UPSC CSE Syllabus & Strategy","action":"page:p_1792918364955"}]'::jsonb || submenus WHERE id = 'nav_1789838140095';

INSERT INTO custom_pages (id, slug, title, is_gated, price, content, parent_id, icon, image, summary, child_style, order_num, show_on_home, bundle_only, old_slugs, published_at, date_position, allow_pdf_download)
VALUES (
  'p_1792918364955',
  'upsc-cse-syllabus-strategy',
  'UPSC CSE Syllabus & Strategy',
  false,
  0,
  '<div class="kb-box kb-facts"><div class="kb-box-title">UPSC CSE Syllabus &amp; Strategy</div><p>A working map of the Civil Services Examination — what''s tested, how it''s scored, and how to use Evolve+ against it. Most of the GS syllabus below also overlaps heavily with KPSC KAS, so practice here does double duty if you''re prepping for both.</p></div>

<h2>The exam at a glance</h2>
<div class="kb-stats">
<div><b>3</b><span>Stages — Prelims, Mains, Interview</span></div>
<div><b>2</b><span>Prelims papers (GS + CSAT)</span></div>
<div><b>9</b><span>Mains papers (Essay, GS I–IV, Optional I–II, 2 qualifying)</span></div>
<div><b>2025</b><span>Total marks counted for the final merit list</span></div>
</div>
<div class="kb-box kb-warn"><p>Exact marks and the paper count have stayed stable for a while, but UPSC can revise the pattern in any year''s notification — always cross-check against the official Civil Services notification for your attempt. Your exact Prelims/Mains dates for this cycle are already tracked on your <a href="#" onclick="navigate(''dashboard''); return false;">Dashboard &amp; Study Planner</a>.</p></div>

<h2>Prelims — the screening stage</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Paper</th><th>Questions</th><th>Marks</th><th>Duration</th><th>Counts toward merit?</th></tr></thead>
<tbody>
<tr><td>GS Paper I</td><td>100</td><td>200</td><td>2 hours</td><td>Yes — this score decides who qualifies for Mains</td></tr>
<tr><td>CSAT (Paper II)</td><td>80</td><td>200</td><td>2 hours</td><td>Qualifying only — need 33% to clear, score doesn''t add to the merit rank</td></tr>
</tbody>
</table></div>
<p>Prelims is objective (MCQ), negatively marked, and is purely a screening round — your Prelims score itself never counts toward your final rank. That''s exactly why a bilingual, properly negative-marked OMR mock matters more here than anywhere else in the exam: the skill being tested is elimination technique and speed under a strict penalty, not just subject knowledge. That''s what the Evolve+ OMR-simulated mocks are built to drill.</p>

<h2>Mains — the stage that actually ranks you</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Paper</th><th>Nature</th><th>Marks</th></tr></thead>
<tbody>
<tr><td>Essay</td><td>Counts toward merit</td><td>250</td></tr>
<tr><td>GS Paper I — Heritage, History, Geography, Society</td><td>Counts toward merit</td><td>250</td></tr>
<tr><td>GS Paper II — Governance, Constitution, Polity, IR, Social Justice</td><td>Counts toward merit</td><td>250</td></tr>
<tr><td>GS Paper III — Economy, Technology, Environment, Security, Disaster Management</td><td>Counts toward merit</td><td>250</td></tr>
<tr><td>GS Paper IV — Ethics, Integrity, Aptitude</td><td>Counts toward merit</td><td>250</td></tr>
<tr><td>Optional Paper I &amp; II (your chosen subject)</td><td>Counts toward merit</td><td>250 + 250</td></tr>
<tr><td>Indian Language &amp; English (compulsory)</td><td>Qualifying only</td><td>300 each</td></tr>
</tbody>
</table></div>
<p>Written merit = Essay + GS I–IV + Optional I–II = <b>1,750 marks</b>. Every Mains paper is descriptive, long-answer — which is also the single hardest thing to self-evaluate honestly. This is where Evolve+''s <b>Mains answer evaluation</b> (AI feedback plus a real evaluator''s review, on credits) is meant to be used: write the answer under time pressure first, then get it marked against what an examiner is actually scoring for, instead of just re-reading your own notes and assuming you covered the point.</p>

<h2>Interview — Personality Test</h2>
<div class="kb-box kb-info"><p>275 marks, added directly to your 1,750 written marks for a final merit score out of <b>2,025</b>. It isn''t a knowledge test — it''s a conversation built around your own DAF (application form): your background, your optional subject, current affairs, and how you reason under a few follow-up questions in a row.</p></div>

<h2>A typical annual cycle</h2>
<ol class="kb-timeline">
<li><b>Notification</b> — official calendar released; DAF-I filed online.</li>
<li><b>Prelims</b> — usually a Sunday in late May/June.</li>
<li><b>Prelims result</b> — roughly 4–6 weeks later; qualifiers file DAF-I for Mains.</li>
<li><b>Mains</b> — a block of exam days, usually September.</li>
<li><b>Mains result</b> — roughly December/January.</li>
<li><b>Interview</b> — February/March.</li>
<li><b>Final result &amp; merit list</b> — usually before the next cycle''s Prelims.</li>
</ol>
<p>Treat the months above as a rough shape, not a promise — the actual dates move every year. Your own cycle''s real dates are on the UPSC CSE Study Planner''s countdown, not here.</p>

<h2>If you''re also prepping for KPSC KAS</h2>
<div class="kb-box kb-tip"><p>Polity, Indian &amp; Karnataka History, Geography, Economy and most of current affairs are shared ground between UPSC CSE and KPSC KAS GS papers. A chapter-wise GS practice set built for one exam is, with very few tweaks, directly useful for the other — that''s why you''ll see the same subject tagged across both categories in places on this site. Don''t silo your prep by exam name; silo it by subject instead.</p></div>

<h2>FAQ</h2>
<details class="kb-faq"><summary>Is the UPSC CSE content on Evolve+ free?</summary><p>The current UPSC CSE full-length PYQ practice papers are free to attempt. Mains answer evaluation uses credits (see Pricing). Sectional, subject-wise UPSC test series are actively being built out — check the Test Series tab for what''s live right now.</p></details>
<details class="kb-faq"><summary>Do I need to choose my Optional subject before I start Prelims prep?</summary><p>No — Optional only matters for Mains, and it''s common to lock it in after Prelims results. GS prep for Prelims and Mains overlaps enough that starting with GS first is the standard approach.</p></details>
<details class="kb-faq"><summary>How is CSAT scored if it doesn''t count toward my rank?</summary><p>You still have to clear 33% in CSAT to qualify for Mains at all — it just doesn''t add marks to your merit rank once you''ve cleared it. Treat it as a gate, not a scoring opportunity.</p></details>
<hr class="kb-divider">
<p>Questions about how a specific feature maps to your prep — Mains evaluation credits, the Study Planner countdown, Practice My Mistakes — are answered in the <a href="#" onclick="navigate(''dashboard''); return false;">Dashboard Guide</a>.</p>
',
  NULL,
  '📘',
  '',
  'UPSC CSE prelims & mains syllabus, exam pattern and preparation strategy -- in one place.',
  'tiles',
  4,
  true,
  false,
  '[]'::jsonb,
  now(),
  'above',
  true
);
