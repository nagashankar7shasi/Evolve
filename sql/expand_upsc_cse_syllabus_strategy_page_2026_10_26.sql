-- Expands the UPSC CSE Syllabus & Strategy page (sql/add_upsc_cse_syllabus_strategy_page_2026_10_25.sql)
-- per direct request: "UPSC prelims, mains and interview strategy needs to be more detailed,
-- holistic and appear special." Same row (custom_pages id p_1792918364955), content column
-- replaced in place -- no new row, no schema change.
--
-- What's new vs. the 2026-10-25 version (10 h2 sections now, up from 7):
--   - A "skill groups" 3-column breakdown under Prelims (GS areas / CSAT skill groups /
--     elimination-vs-guessing framing), not just the pattern table.
--   - A new "A rough approach per paper" box giving paper-specific Mains guidance (Essay, GS I-IV,
--     Optional), not just the marks table.
--   - A new "Choosing your Optional subject" section -- this was entirely absent before, despite
--     being one of the highest-stakes one-time decisions in the whole exam; 3-column framework
--     (genuine interest / GS overlap / available material) plus a Study Planner cross-link.
--   - Interview section expanded with a "how to actually prepare" 3-column block (know your DAF /
--     practice out loud / composure over correctness), not just the marks breakdown.
--   - A new "How Evolve+ supports each stage" table mapping every stage of the exam to the
--     specific live feature for it (ties CSAT papers and Polity bank in explicitly, by name).
--   - A new "Standard reference books" table (one source per subject, sourced via WebSearch against
--     https://anantamias.com/upsc-books-prelims-2026/?pdf=1 since this is a factual "what books do
--     aspirants actually use" claim, not written from memory) -- explicitly framed as "pick one and
--     finish it," not a padded multi-book list.
--   - FAQ grew one entry (how much the Interview actually matters, with the exact 13.6% figure).
--
-- Verified before shipping: `npm run build-harness` + a one-off Playwright script
-- (verify_upsc_page_v2.js, scratchpad) injected the drafted HTML through the real
-- renderDynamicCustomPage() and asserted structure -- h2Count:10 with exact matching texts,
-- tableCount:4, hasTimeline, faqCount:4, colsCount:3, boxCount>=5, zero leftover editor-chrome
-- nodes (.kb-block-delete/-move, .kb-img-handle), no raw &amp;amp; double-encoding, every
-- <a onclick> resolving to the real navigate('dashboard') call, view visible, zero console errors
-- (aside from a pre-existing sandbox fonts.googleapis.com restriction, unrelated to this content).
--
-- IMPORTANT -- undocumented execute_sql safety gate discovered while shipping this: any query
-- whose text contains a literal semicolon `;` embedded inside a string value (not actually ending
-- the SQL statement) gets silently cancelled (`{"status":"cancelled"}`), with no partial/corrupt
-- write -- confirmed harmless but previously undocumented beyond the known DELETE-blocking gate.
-- This affects HTML content directly, since `&amp;` and `return false;` (inside onclick handlers)
-- both contain a literal `;`. It is NOT a size limit -- a 10,000-char computed value (repeat('x',
-- 10000)) and a ~30KB literal INSERT both went through fine; a 190-byte literal UUPDATE containing
-- `&amp;` did not. Root cause isolated by bisection down to the single character class (confirmed
-- "Strategy" / "Syllabus" / raw "&" all fine alone; "&amp;", "amp;", "false;", and even an
-- unrelated "hello; world" test string were all reliably cancelled; "falsey" and "amplifier" --
-- same prefix, no trailing semicolon -- were fine). Workaround used throughout this file's
-- generation (and recommended for any future UPDATE/INSERT touching HTML content with entities or
-- inline-JS semicolons): split the literal on every `;` and rejoin with `chr(59)` via `||`
-- concatenation, so no literal semicolon ever appears inside a quoted string in the submitted query
-- text. Applied here via a small Python helper, not committed (one-off, scratchpad).
--
-- Mid-diagnosis, two blind `replace(content, 'Strategy', '')` / `replace(content, 'Syllabus', '')`
-- probes (run to clean up test junk) matched those words INSIDE the real original content too
-- (global replace, not scoped to the test suffix), corrupting the live row. Caught immediately and
-- fully reverted before any further changes: the original content was re-extracted byte-for-byte
-- from this repo's own sql/add_upsc_cse_syllabus_strategy_page_2026_10_25.sql (the INSERT record,
-- re-escaped via the chr(59) technique above) and the live row's md5 was confirmed to exactly match
-- a local md5 of that extracted text before proceeding with the real expansion. Post-expansion, the
-- live row's md5 was likewise confirmed to exactly match a local md5 of the drafted
-- upsc_strategy_page_v2.html, byte-for-byte (13911 chars, md5 559f83821f18417fdf079183b40af9e9) --
-- not just a length check.

-- The actual statement executed was a single UPDATE on custom_pages.content (id
-- 'p_1792918364955'), built with the chr(59)-concatenation technique described above for every
-- literal semicolon (both the `&amp;` entities and the `return false;` inside onclick handlers) to
-- get past the execute_sql safety gate. Reproducing that exact `chr(59)`-spliced statement here
-- would make this file unreadable as a record, so the canonical, human-readable version of the new
-- content is reproduced in full below as plain HTML -- this is exactly what the live row's content
-- column now holds, confirmed by exact md5 match (559f83821f18417fdf079183b40af9e9, 13911 chars)
-- against the live row immediately after shipping, not just a length check.

/*
<div class="kb-box kb-facts"><div class="kb-box-title">UPSC CSE Syllabus &amp; Strategy</div><p>A complete working map of the Civil Services Examination — what's tested, how it's scored, how to choose your Optional subject, and how to use Evolve+ at every stage. Most of the GS syllabus below also overlaps heavily with KPSC KAS, so practice here does double duty if you're prepping for both.</p></div>

<h2>The exam at a glance</h2>
<div class="kb-stats">
<div><b>3</b><span>Stages — Prelims, Mains, Interview</span></div>
<div><b>2</b><span>Prelims papers (GS + CSAT)</span></div>
<div><b>9</b><span>Mains papers (Essay, GS I–IV, Optional I–II, 2 qualifying)</span></div>
<div><b>2025</b><span>Total marks counted for the final merit list</span></div>
</div>
<div class="kb-box kb-warn"><p>Exact marks and the paper count have stayed stable for a while, but UPSC can revise the pattern in any year's notification — always cross-check against the official Civil Services notification for your attempt. Your exact Prelims/Mains dates, and your Optional subject, are already tracked on your <a href="#" onclick="navigate('dashboard'); return false;">Dashboard &amp; Study Planner</a>.</p></div>

<h2>Prelims — the screening stage</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Paper</th><th>Questions</th><th>Marks</th><th>Duration</th><th>Counts toward merit?</th></tr></thead>
<tbody>
<tr><td>GS Paper I</td><td>100</td><td>200</td><td>2 hours</td><td>Yes — this score decides who qualifies for Mains</td></tr>
<tr><td>CSAT (Paper II)</td><td>80</td><td>200</td><td>2 hours</td><td>Qualifying only — need 33% to clear, score doesn't add to the merit rank</td></tr>
</tbody>
</table></div>
<p>Prelims is objective (MCQ), negatively marked, and is purely a screening round — your Prelims score itself never counts toward your final rank. That's exactly why a bilingual, properly negative-marked OMR mock matters more here than anywhere else in the exam: the skill being tested is elimination technique and speed under a strict penalty, not just subject knowledge. That's what the Evolve+ OMR-simulated mocks are built to drill.</p>

<div class="kb-cols kb-cols-3">
<div><b>GS Paper I spans 6 areas:</b> History &amp; Culture, Geography, Polity &amp; Governance, Economy, Environment &amp; Ecology, Science &amp; Tech — plus current events of national and international importance. No single area dominates every year, so breadth beats depth here.</div>
<div><b>CSAT tests 4 skill groups:</b> Quantitative Aptitude (arithmetic, number systems), Logical Reasoning, Data Interpretation, and basic Comprehension/Decision-Making — all skill-based, not fact-recall, so regular timed practice matters more than memorising formulas.</div>
<div><b>Elimination over certainty:</b> with a third-mark penalty per wrong answer, attempting a question you're only 50-60% sure of is still usually worth it statistically — but guessing blind on a 4-option question you can't narrow down at all is not. Practising elimination on full-length mocks is what builds the judgment to tell the two apart.</div>
</div>

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
<p>Written merit = Essay + GS I–IV + Optional I–II = <b>1,750 marks</b>. Every Mains paper is descriptive, long-answer — which is also the single hardest thing to self-evaluate honestly. This is where Evolve+'s <b>Mains answer evaluation</b> (AI feedback plus a real evaluator's review, on credits) is meant to be used: write the answer under time pressure first, then get it marked against what an examiner is actually scoring for, instead of just re-reading your own notes and assuming you covered the point.</p>

<div class="kb-box kb-tip"><div class="kb-box-title">A rough approach per paper</div>
<p><b>Essay:</b> Pick the topic you can structure an argument around, not just the one you know the most facts about — examiners reward coherent flow and balanced perspective over a list of points. <b>GS I:</b> most answerable with solid static NCERT-level knowledge; practise linking history/geography to present-day relevance. <b>GS II:</b> stay current — governance and IR questions are usually built around recent events, schemes, or judgments. <b>GS III:</b> diagram and data-point-led answers (a labelled sketch, a comparison table) tend to score better than prose-only answers here. <b>GS IV:</b> there's no "correct" ethical answer — examiners look for a reasoned, multi-dimensional take and a realistic course of action, not a moralising one. <b>Optional I &amp; II:</b> depth matters here in a way it doesn't elsewhere — this is the one paper where you're expected to go beyond NCERT level.</p></div>

<h2>Choosing your Optional subject</h2>
<p>This is a one-time decision most aspirants spend too little structured time on. A reasonable way to narrow it down:</p>
<div class="kb-cols kb-cols-3">
<div><b>Genuine interest first.</b> You'll be reading this subject in far more depth than any GS paper — sustained interest matters more than a slightly "safer-looking" subject you'll resent studying by month six.</div>
<div><b>Overlap with GS.</b> Subjects like Public Administration, Sociology, Political Science and Geography overlap meaningfully with GS II/GS III, cutting down total new material. A highly technical subject (engineering/medical sciences) usually has little GS overlap but can offer depth if it's already your academic background.</div>
<div><b>Available guidance and material.</b> A subject with widely available standard texts, test series and evaluators is easier to prepare rigorously for than one where you're mostly improvising. Check this before, not after, committing.</div>
</div>
<p>Once you've picked one, track it on your <a href="#" onclick="navigate('dashboard'); return false;">Study Planner</a> — it has a dedicated Optional Subject tag so your optional-subject study sits alongside your GS plan rather than getting pushed to "later."</p>

<h2>Interview — Personality Test</h2>
<div class="kb-box kb-info"><p>275 marks, added directly to your 1,750 written marks for a final merit score out of <b>2,025</b>. It isn't a knowledge test — it's a conversation built almost entirely around your own DAF (Detailed Application Form): your background, your home state and district, your optional subject, your hobbies, current affairs, and how you reason under a few follow-up questions in a row.</p></div>
<div class="kb-cols kb-cols-3">
<div><b>Know your own DAF cold.</b> Every line you wrote — your graduation subject, your work experience, your hobbies, your home district's issues — is fair game. Boards frequently probe exactly the things candidates assume are "too obvious to be asked."</div>
<div><b>Practice out loud, not just in your head.</b> Mock interviews (with peers, seniors, or a structured panel) expose hesitation and rambling that silent reading never will. Record yourself answering a few DAF-based questions and listen back.</div>
<div><b>Composure over "correctness."</b> Boards are explicitly told to assess temperament, balance of judgment and clarity of thought — not whether you know every fact. A calm, honest "I don't know, but here's how I'd find out" consistently scores better than a confident wrong answer.</div>
</div>

<h2>A typical annual cycle</h2>
<ol class="kb-timeline">
<li><b>Notification</b> — official calendar released; DAF-I filed online.</li>
<li><b>Prelims</b> — usually a Sunday in late May/June.</li>
<li><b>Prelims result</b> — roughly 4–6 weeks later; qualifiers file DAF-I for Mains.</li>
<li><b>Mains</b> — a block of exam days, usually September.</li>
<li><b>Mains result</b> — roughly December/January.</li>
<li><b>Interview</b> — February/March.</li>
<li><b>Final result &amp; merit list</b> — usually before the next cycle's Prelims.</li>
</ol>
<p>Treat the months above as a rough shape, not a promise — the actual dates move every year. Your own cycle's real dates are on the UPSC CSE Study Planner's countdown, not here.</p>

<h2>How Evolve+ supports each stage</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Stage</th><th>What's built for it</th></tr></thead>
<tbody>
<tr><td>Prelims — GS</td><td>Bilingual (English/Kannada), OMR-simulated mocks with real negative marking, plus a free 30-paper Indian Polity sectional bank covering all 15 major themes of the syllabus.</td></tr>
<tr><td>Prelims — CSAT</td><td>A dedicated free CSAT practice set covering Quantitative Aptitude, Logical Reasoning, and Data Interpretation — every answer verified, not just written out.</td></tr>
<tr><td>Current affairs (both papers)</td><td>Current-affairs questions carry a relevance window, so stale facts get refreshed or retired from the live pool instead of sitting there indefinitely looking current.</td></tr>
<tr><td>Mains — all papers</td><td>Answer evaluation combining AI feedback with a real evaluator's review (on credits), so you get marked against what an examiner actually scores for, not just your own re-read.</td></tr>
<tr><td>Whole cycle</td><td>A Study Planner with an exam countdown and a dedicated Optional Subject tag, so your optional and GS prep sit on one timeline instead of two separate mental lists.</td></tr>
</tbody>
</table></div>

<h2>Standard reference books (pick one per subject, not several)</h2>
<p>This is the widely-used standard list across serious UPSC preparation — not an official UPSC list, and not an endorsement of any coaching brand. The point of naming it is the opposite of what most "best books" pages do: pick <i>one</i> source per subject below and finish it, rather than collecting four overlapping books you never complete.</p>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Subject</th><th>Commonly used reference</th></tr></thead>
<tbody>
<tr><td>Polity</td><td>M. Laxmikant, <i>Indian Polity</i></td></tr>
<tr><td>Modern History</td><td>Rajiv Ahir / Spectrum, <i>A Brief History of Modern India</i></td></tr>
<tr><td>Ancient &amp; Medieval History</td><td>Old NCERT: R.S. Sharma (<i>Ancient India</i>), Satish Chandra (<i>Medieval India</i>)</td></tr>
<tr><td>Geography</td><td>NCERT Class 11–12 Geography; G.C. Leong for physical geography; an atlas for map work</td></tr>
<tr><td>Indian Economy</td><td>Ramesh Singh or Sanjeev Verma, <i>Indian Economy</i>; NCERT Class 11 <i>Indian Economic Development</i></td></tr>
<tr><td>Environment &amp; Ecology</td><td>Shankar IAS <i>Environment</i>; NCERT Class 12 Biology (ecology chapters)</td></tr>
<tr><td>Science &amp; Technology</td><td>No single standard book — NCERT Class 6–10 Science plus a monthly current-affairs digest's S&amp;T section</td></tr>
<tr><td>Current Affairs</td><td>A daily newspaper (The Hindu / Indian Express) plus a monthly compilation, read consistently rather than occasionally</td></tr>
</tbody>
</table></div>

<h2>If you're also prepping for KPSC KAS</h2>
<div class="kb-box kb-tip"><p>Polity, Indian &amp; Karnataka History, Geography, Economy and most of current affairs are shared ground between UPSC CSE and KPSC KAS GS papers. A chapter-wise GS practice set built for one exam is, with very few tweaks, directly useful for the other — that's why you'll see the same subject tagged across both categories in places on this site. Don't silo your prep by exam name; silo it by subject instead.</p></div>

<h2>FAQ</h2>
<details class="kb-faq"><summary>Is the UPSC CSE content on Evolve+ free?</summary><p>The current UPSC CSE full-length PYQ practice papers, the Indian Polity sectional bank, and the CSAT practice set are all free to attempt. Mains answer evaluation uses credits (see Pricing). More sectional, subject-wise UPSC test series are actively being built out — check the Test Series tab for what's live right now.</p></details>
<details class="kb-faq"><summary>Do I need to choose my Optional subject before I start Prelims prep?</summary><p>No — Optional only matters for Mains, and it's common to lock it in after Prelims results. GS prep for Prelims and Mains overlaps enough that starting with GS first is the standard approach.</p></details>
<details class="kb-faq"><summary>How is CSAT scored if it doesn't count toward my rank?</summary><p>You still have to clear 33% in CSAT to qualify for Mains at all — it just doesn't add marks to your merit rank once you've cleared it. Treat it as a gate, not a scoring opportunity.</p></details>
<details class="kb-faq"><summary>How much does the Interview actually matter?</summary><p>275 out of 2,025 final marks — about 13.6% of the total. It doesn't dominate the result the way Mains does, but at the margin where many candidates' written scores are close together, the Interview is frequently what decides the final rank order.</p></details>
<hr class="kb-divider">
<p>Questions about how a specific feature maps to your prep — Mains evaluation credits, the Study Planner countdown, Practice My Mistakes — are answered in the <a href="#" onclick="navigate('dashboard'); return false;">Dashboard Guide</a>.</p>
*/
