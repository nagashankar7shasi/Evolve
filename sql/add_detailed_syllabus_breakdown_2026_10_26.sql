-- Adds detailed, topic-wise syllabus breakdown sections to the UPSC CSE Syllabus & Strategy page
-- (sql/expand_upsc_cse_syllabus_strategy_page_2026_10_26.sql), per direct follow-up request: "Can
-- it have more sections with detailed breakup of prelims and mains syllabus." Same custom_pages
-- row (p_1792918364955), content column replaced in place again -- no new row, no schema change.
--
-- Grows the page from 10 h2 sections to 16 (4 tables -> 10 tables) by inserting six new sections:
--   - Prelims GS Paper I syllabus, area by area (7-row table: History, Geography, Polity,
--     Economy/Social dev, Environment, Science, Current affairs)
--   - Prelims CSAT (Paper II) syllabus, area by area (6-row table: the 6 official skill areas)
--   - Mains GS Paper I syllabus breakdown (12-row table)
--   - Mains GS Paper II syllabus breakdown (18-row table)
--   - Mains GS Paper III syllabus breakdown (16-row table)
--   - Mains GS Paper IV syllabus breakdown (9-row table)
-- Plus a one-line kb-box noting the Essay paper has no fixed topic list (so isn't broken down the
-- same way), and a disclaimer line after each pair of new tables that these are a plain-English
-- rendering of the syllabus structure, not UPSC's verbatim notification wording -- always
-- cross-check the current year's official notification.
--
-- Content sourced via WebSearch + WebFetch against drishtiias.com/upsc-syllabus and
-- vajiramandravi.com/upsc-exam/upsc-mains-syllabus (both explicitly flagged by the fetch as
-- paraphrased third-party summaries, not UPSC's own text -- hence the disclaimer lines above,
-- rather than presenting the tables as verbatim official wording). The two independent sources
-- corroborated each other closely on every theme, and this matches the well-established, stable
-- UPSC GS syllabus structure that hasn't changed in years.
--
-- Note: "GS Paper I" is UPSC's own name for both a Prelims paper and a (different, much broader)
-- Mains paper -- the new h2 headers are prefixed "Prelims" / "Mains" throughout specifically to
-- avoid that collision reading as a mistake.
--
-- Verified before shipping: re-ran the harness's Playwright structural check (scratchpad
-- verify_upsc_page_v2.js, thresholds updated h2Count 10->16, tableCount 4->10) -- all checks pass
-- (hasStats, hasTimeline, faqCount 4, colsCount 3, boxCount 6, zero leftover editor-chrome nodes,
-- no raw &amp;amp; double-encoding, every onclick resolving to the real navigate('dashboard') call,
-- view visible); the only non-pass is the pre-existing sandbox fonts.googleapis.com restriction
-- (ERR_TUNNEL_CONNECTION_FAILED), unrelated to this content, already documented as an environment
-- limitation in CLAUDE.md-adjacent session notes.
--
-- Shipped using the same chr(59)-concatenation technique recorded in
-- sql/expand_upsc_cse_syllabus_strategy_page_2026_10_26.sql (every literal semicolon in the HTML --
-- &amp; entities and the onclick handlers' "return false;" -- spliced via `|| chr(59) ||` so no
-- literal `;` appears inside a quoted string in the submitted query text). Post-ship, the live
-- row's md5 was confirmed to exactly match a local md5 of the drafted HTML, byte-for-byte (25601
-- chars, md5 e46d8b89562a571f1178269e0390223c).
--
-- Canonical human-readable content below (this is what the live row's content column now holds):

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

<h2>Prelims GS Paper I syllabus, area by area</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Area</th><th>What's tested</th></tr></thead>
<tbody>
<tr><td>History &amp; the freedom movement</td><td>Ancient, medieval and modern Indian history, with special focus on the national movement's major events, phases and leading figures</td></tr>
<tr><td>Geography</td><td>Physical, social and economic geography of India and the world</td></tr>
<tr><td>Polity &amp; governance</td><td>The Constitution, political system, Panchayati Raj and devolution, public policy, and rights issues</td></tr>
<tr><td>Economic &amp; social development</td><td>Sustainable development, poverty, inclusion, demographics, and social-sector initiatives</td></tr>
<tr><td>Environment &amp; ecology</td><td>Biodiversity and climate change, at a general-awareness level rather than specialist depth</td></tr>
<tr><td>General science</td><td>Everyday-science awareness, not specialist or technical depth</td></tr>
<tr><td>Current affairs</td><td>National and international events of the current period</td></tr>
</tbody>
</table></div>

<h2>Prelims CSAT (Paper II) syllabus, area by area</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Area</th><th>What's tested</th></tr></thead>
<tbody>
<tr><td>Comprehension</td><td>Reading passages followed by inference and interpretation questions</td></tr>
<tr><td>Interpersonal &amp; communication skills</td><td>Workplace-style scenario questions probing basic people skills</td></tr>
<tr><td>Logical reasoning &amp; analytical ability</td><td>Puzzles, syllogisms, coding-decoding, direction sense, blood relations, and seating arrangements</td></tr>
<tr><td>Decision-making &amp; problem-solving</td><td>Case-style questions testing judgment rather than a single textbook answer</td></tr>
<tr><td>General mental ability</td><td>Mixed reasoning drawing on more than one of the skills above at once</td></tr>
<tr><td>Basic numeracy &amp; data interpretation</td><td>Class 10-level arithmetic and number systems, plus reading tables, graphs and charts</td></tr>
</tbody>
</table></div>
<p>These area breakdowns are a plain-English rendering of the official syllabus structure, not a word-for-word copy of UPSC's notification text — cross-check the exact wording against the current year's official notification before relying on it for interpretation of a borderline question.</p>

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

<div class="kb-box kb-info"><p><b>Essay</b> has no fixed topic list — candidates choose from a spread of general topics on the day and are scored on structure, coherence and expression rather than on recalling a syllabus area, so it isn't broken down below the way GS I–IV are.</p></div>

<h2>Mains GS Paper I syllabus breakdown</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Theme</th><th>What's covered</th></tr></thead>
<tbody>
<tr><td>Indian heritage &amp; culture</td><td>Art forms, literature and architecture from ancient to modern times</td></tr>
<tr><td>Modern Indian history</td><td>From around the mid-18th century onward</td></tr>
<tr><td>The freedom struggle</td><td>Its important stages and contributors from across the country</td></tr>
<tr><td>Post-independence India</td><td>Consolidation and reorganisation within the country</td></tr>
<tr><td>World history</td><td>From the 18th century — industrial revolution, world wars, redrawing of national boundaries, colonisation and decolonisation, and political philosophies and their effects on society</td></tr>
<tr><td>Indian society</td><td>Salient features and diversity, and the role of women's organisations</td></tr>
<tr><td>Social issues</td><td>Population, poverty, urbanisation, and their associated problems and remedies</td></tr>
<tr><td>Globalisation's effects</td><td>On Indian society</td></tr>
<tr><td>Social movements</td><td>Communalism, regionalism and secularism</td></tr>
<tr><td>World physical geography</td><td>Distribution of key natural resources across the world, including South and Southeast Asia</td></tr>
<tr><td>Industrial location factors</td><td>Factors responsible for the location of primary, secondary and tertiary sector industries</td></tr>
<tr><td>Geophysical phenomena</td><td>Earthquakes, tsunamis, volcanic activity, cyclones; changes in critical geographical features (water bodies, ice caps) and flora/fauna, and the effects of such changes</td></tr>
</tbody>
</table></div>

<h2>Mains GS Paper II syllabus breakdown</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Theme</th><th>What's covered</th></tr></thead>
<tbody>
<tr><td>The Constitution</td><td>Historical underpinnings, evolution, features, amendments, significant provisions and the basic structure</td></tr>
<tr><td>Union-State relations</td><td>Functions and responsibilities of the Union and the States, devolution of powers and finances up to local-body level, and the challenges in that devolution</td></tr>
<tr><td>Separation of powers</td><td>Between organs, and dispute-redressal mechanisms and institutions</td></tr>
<tr><td>Comparative polity</td><td>Comparing India's constitutional scheme with other countries'</td></tr>
<tr><td>Parliament &amp; state legislatures</td><td>Structure, functioning, conduct of business, powers and privileges, and the issues arising from these</td></tr>
<tr><td>Executive &amp; judiciary</td><td>Structure, organisation and functioning of the government and the judiciary, plus Ministries and Departments</td></tr>
<tr><td>Pressure groups</td><td>Formal and informal associations and their role in the polity</td></tr>
<tr><td>Representation of the People Act</td><td>Key features</td></tr>
<tr><td>Appointments to key posts</td><td>Various constitutional, statutory, regulatory and quasi-judicial bodies — their powers, functions and appointment processes</td></tr>
<tr><td>Development processes</td><td>Role of government policies and interventions, and of NGOs, SHGs, various groups, associations and donors, in development</td></tr>
<tr><td>Welfare schemes</td><td>For vulnerable sections and the performance of these schemes, plus the mechanisms, laws, institutions and bodies set up for protecting these sections</td></tr>
<tr><td>Social-sector issues</td><td>Health, education and human-resource development</td></tr>
<tr><td>Poverty &amp; hunger</td><td>Issues relating to both</td></tr>
<tr><td>Governance</td><td>Transparency and accountability, e-governance applications, citizens' charters, and other institutional measures</td></tr>
<tr><td>Role of civil services</td><td>In a democracy</td></tr>
<tr><td>India &amp; its neighbourhood</td><td>Bilateral, regional and global relations, groupings and agreements involving or affecting India's interests</td></tr>
<tr><td>Major powers &amp; the diaspora</td><td>Effect of developed and developing countries' policies and politics on India's interests, and of the Indian diaspora</td></tr>
<tr><td>International institutions</td><td>Important international institutions, agencies and fora — their structure and mandate</td></tr>
</tbody>
</table></div>

<h2>Mains GS Paper III syllabus breakdown</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Theme</th><th>What's covered</th></tr></thead>
<tbody>
<tr><td>Indian economy</td><td>Planning, mobilisation of resources, growth, development and employment</td></tr>
<tr><td>Inclusive growth</td><td>And the issues arising from it, plus government budgeting</td></tr>
<tr><td>Agriculture</td><td>Major crops, cropping patterns, irrigation systems, storage, transport and marketing of produce, and the issues and constraints around these</td></tr>
<tr><td>Farm support systems</td><td>Minimum support prices, the public distribution system, buffer stocks, food security, technology missions, and animal-rearing economics</td></tr>
<tr><td>Food processing</td><td>Scope and significance, location, upstream and downstream requirements, and supply chain management</td></tr>
<tr><td>Land reforms</td><td>In India</td></tr>
<tr><td>Liberalisation's effects</td><td>On the economy, plus changes in industrial policy and their effects on industrial growth</td></tr>
<tr><td>Infrastructure</td><td>Energy, ports, roads, airports and railways, and investment models</td></tr>
<tr><td>Science &amp; technology</td><td>Developments and their applications and effects in everyday life, plus indigenisation of technology and development of new technology</td></tr>
<tr><td>Frontier areas</td><td>IT, space, computers, robotics, nanotechnology and biotechnology, and issues relating to intellectual property rights</td></tr>
<tr><td>Environment</td><td>Conservation, environmental pollution and degradation, and environmental impact assessment</td></tr>
<tr><td>Disaster management</td><td>Principles and practice</td></tr>
<tr><td>Internal security</td><td>Linkages between development and the spread of extremism, and security challenges in border areas</td></tr>
<tr><td>Security actors</td><td>Role of state and non-state actors in internal security challenges, and the mandate of various security forces and agencies</td></tr>
<tr><td>Cyber &amp; media security</td><td>Communication networks, media and social-networking sites in internal security, and basic cyber security</td></tr>
<tr><td>Money-laundering &amp; organised crime</td><td>Money-laundering and its prevention, and the linkages of organised crime with terrorism</td></tr>
</tbody>
</table></div>

<h2>Mains GS Paper IV syllabus breakdown</h2>
<div class="kb-table-wrap"><table class="kb-table">
<thead><tr><th>Theme</th><th>What's covered</th></tr></thead>
<tbody>
<tr><td>Ethics &amp; human interface</td><td>Essence, determinants and consequences of ethics in human actions; dimensions of ethics; ethics in private and public relationships</td></tr>
<tr><td>Human values</td><td>Lessons from the lives and teachings of great leaders, reformers and administrators, and the role of family, society and educational institutions in inculcating values</td></tr>
<tr><td>Attitude</td><td>Content, structure and function; its influence and relation with thought and behaviour; moral and political attitudes; social influence and persuasion</td></tr>
<tr><td>Civil service foundational values</td><td>Integrity, impartiality and non-partisanship, objectivity, dedication to public service, empathy, tolerance and compassion towards the weaker sections</td></tr>
<tr><td>Emotional intelligence</td><td>Concepts and their utility and application in administration and governance</td></tr>
<tr><td>Moral thinkers &amp; philosophers</td><td>Contributions of moral thinkers and philosophers from India and the world</td></tr>
<tr><td>Public service values</td><td>Status and problems of ethics in public administration; ethical concerns and dilemmas in government and private institutions; laws, rules, regulations and conscience as sources of ethical guidance; accountability and ethical governance; corporate governance</td></tr>
<tr><td>Probity in governance</td><td>Philosophical basis of governance and probity; transparency, Right to Information; codes of ethics and conduct, citizens' charters, work culture, quality of service delivery, utilisation of public funds, and challenges of corruption</td></tr>
<tr><td>Case studies</td><td>Applied across all of the above themes — this is how the paper is actually examined, not as standalone theory questions</td></tr>
</tbody>
</table></div>
<p>As with the Prelims tables above, these are plain-English groupings of the official Mains syllabus themes for quick reference — always cross-check exact wording against the current year's official notification.</p>

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
