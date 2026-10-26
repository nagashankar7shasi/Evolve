-- Adds the first batch of the "Public Administration Notes" series -- short, syllabus-ordered
-- notes for the UPSC CSE Public Administration Optional -- per direct request: "I wanna work on
-- making Public Administration centric resources. Short notes everyday if possible, how do we
-- handle this." Two decisions were made with the user via AskUserQuestion before building:
--   1. Cadence mode: BATCH-WRITE a reviewed backlog now, then a DAILY SCHEDULED TASK mechanically
--      promotes the next pre-approved note live -- never an unreviewed, freshly-generated note
--      going out unattended. (Rejected: fully autonomous daily write+publish, and chat-only
--      on-demand.)
--   2. Pricing: FREE, matching Current Affairs -- an engagement/SEO asset, not gated content.
--
-- Structure, discovered by first checking how the existing recurring-content page ("Weekly
-- Current Affairs", id p_1792570155429) actually works: it turned out to be a grid of
-- kb-resource-card widgets pointing at uploaded PDFs in pdf_vault/Storage, NOT a growing text page
-- -- a format this session cannot replicate (no storage-upload MCP tool, no service-role key, as
-- already established earlier this session for the UPSC image assets). So this series instead
-- uses the same plain-HTML-in-custom_pages approach already proven for the UPSC Syllabus/Calendar
-- pages: a new parent page ("Public Administration Notes", tiles grid) with ONE CHILD custom_pages
-- row PER NOTE, growing day by day.
--
-- Also discovered: custom_pages has NO visibility/hidden flag at all (published_at/date_position
-- are confirmed, from js/02a_bundles.js's own comment, to be a purely cosmetic "Posted <date>"
-- display label, not a gate) -- so true drip-release needed a real staging mechanism, not just a
-- future-dated row. Built a new table, pub_ad_notes_queue (full reviewed note text, order_num,
-- published flag), via apply_migration. The daily scheduled task's ENTIRE job is to run one
-- self-guarding SQL statement that promotes the lowest order_num unpublished queue row into
-- custom_pages and marks it published -- no content generation, no judgment, at publish time.
--
-- Batch-of-10 content: covers the first four topics of UPSC Optional Public Administration
-- PAPER I (Administrative Theory) in syllabus order -- Introduction (3 notes: Wilson's vision,
-- NPA vs NPM, Good Governance), Administrative Thought (4 notes: Taylor, Weber, Follett, Simon),
-- Administrative Behaviour (2 notes: Motivation theories, Leadership theories), and Organisations
-- (1 note: Systems/Contingency theory). The three most fact-dense notes (Weber, Simon, Follett)
-- were cross-checked against legacyias.com's dedicated UPSC Pub-Ad pages before writing, rather
-- than relying on memory alone, given the stakes of a factual slip in paid exam-prep content.
--
-- Shipping mechanics: all ten notes' prose deliberately avoids BOTH ";" and "&" entirely (using
-- "and"/"--" instead), which sidesteps the session's known execute_sql semicolon-cancellation
-- gate completely for this batch -- no chr(59) splicing needed, confirmed by counting literal
-- ';' in every generated SQL file before running it (1 each, the statement terminator only).
--
-- Verified before shipping: all 10 notes rendered through the app's own renderDynamicCustomPage()
-- in the test harness via a dedicated Playwright script -- correct title, >=2 kb-box, >=2 h3,
-- >=2 ul, zero leftover editor-chrome nodes, no raw &amp;amp; double-encoding, view visible, for
-- every note. Only the pre-existing sandboxed fonts.googleapis.com console-error restriction seen
-- on every verification this session.
--
-- 1. New table (apply_migration, name create_pub_ad_notes_queue):
--   CREATE TABLE pub_ad_notes_queue (id text PRIMARY KEY, order_num integer NOT NULL UNIQUE,
--     slug text NOT NULL UNIQUE, title text NOT NULL, paper text NOT NULL, topic text,
--     summary text, content text NOT NULL, published boolean NOT NULL DEFAULT false,
--     published_page_id text, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz);
--
-- 2. New parent page p_1793039540391 (slug public-administration-notes, order_num 4, free,
--    show_on_home true, child_style tiles) -- content reproduced in the comment block below.
--
-- 3. Note 1 shipped immediately and directly into custom_pages (id p_padnote_01, order_num 0,
--    parent_id p_1793039540391, show_on_home FALSE -- children are reachable only via the parent
--    page's tile list, not the home grid, so the catalog doesn't get cluttered as the series
--    grows) -- MD5-verified byte-for-byte (2313 chars, md5 894dd3ae18fb6563a9b48230a2e0b340).
--
-- 4. Notes 2-10 loaded into pub_ad_notes_queue (order_num 2-10, published=false) -- lengths/md5s
--    confirmed matching the locally-drafted text exactly for all 9 rows after insert.
--
-- 5. nav_menu (id nav_1789838140095) submenus gained a "Public Administration Notes" entry
--    (id nav_1793039600000, action page:p_1793039540391), placed between the UPSC Exam Calendar
--    and Karnataka Handbook entries.
--
-- 6. Cross-link added to the UPSC CSE Syllabus and Strategy page's "Choosing your Optional
--    subject" closing sentence (id p_1792918364955), via a targeted replace() rather than
--    resending the whole page -- confirmed matching a local md5 of the amended draft byte-for-byte
--    (29772 chars, md5 b210785042365697df2be66c56764c08).
--
-- 7. Daily scheduled task created (trig_01Bx9NiDe44rDv7SFn1dRNgn, "Publish Daily Pub Ad Note",
--    CRON_TZ=Asia/Kolkata 41 6 * * *, permission_mode auto). Its prompt is entirely mechanical: run
--    one self-guarding SQL statement (promotes the lowest order_num unpublished queue row into
--    custom_pages, guarded against double-publishing on the same calendar day, no-ops cleanly when
--    the queue is empty), verify the copy's length/md5 matches, report the remaining_unpublished
--    count, and explicitly flag (without acting on it) when that count drops to 2 or fewer so a
--    full session can write and review the next batch. Fired once manually via fire_trigger
--    immediately after creation, to confirm the mechanism end-to-end before relying on the
--    schedule -- this test fire genuinely promoted note 2 (paq_002) live (not a dry run): verified
--    cp.content exactly matches q.content, both length 2339 and md5 835ccb4a780a04aa128675385ab1e90a.
--    So as of this record, TWO notes are already live (order 1 and 2), with 8 remaining in queue
--    (order 3-10) -- the real daily cron schedule (06:41 IST) will consume those over the next 8
--    days, so the queue needs a fresh batch roughly 8-9 days after this record's date.
--
-- Canonical content below: the parent page, then note 1 and note 2 (both already live), then
-- notes 3-10 (staged in pub_ad_notes_queue, not yet live -- each will go live on its own day as
-- the schedule runs).

-- Parent page (p_1793039540391, slug public-administration-notes):
/*
<div class="kb-box kb-facts"><div class="kb-box-title">Public Administration Notes</div><p>Short, one-topic-at-a-time notes for the UPSC CSE <b>Public Administration Optional</b> — Administrative Theory (Paper I) and Indian Administration (Paper II). New notes are added regularly, working through the syllabus in order rather than at random, so you can use this as a running companion alongside your main Optional study material.</p></div>

<div class="kb-box kb-info"><p>These notes are a quick-revision aid, not a substitute for a standard Optional textbook — each one is deliberately short enough to read in a few minutes, with the thinkers, terms and critique you need to recall fast, not the full depth a 250-mark paper actually demands. For the exam pattern and how the Optional fits into your overall CSE strategy, see <a href="#/page/upsc-cse-syllabus-strategy">UPSC CSE Syllabus &amp; Strategy</a>.</p></div>

<p>Notes below are tagged by paper and syllabus topic as they're added, so you can track which parts of the syllabus you've already revised.</p>
*/

-- Note 01 (LIVE now) -- What is Public Administration? Meaning, Scope and Wilson's Vision [Paper I - Administrative Theory / Introduction], slug what-is-public-administration-wilsons-vision:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Woodrow Wilson</b>, "The Study of Administration" (1887) -- the essay usually credited with founding Public Administration as a distinct field of study.</p></div>

<p>Public Administration, broadly, is the implementation of government policy -- the organised, cooperative effort of people carrying out the laws and decisions a political system has made. L.D. White called it "the management of men and materials in the accomplishment of the purposes of the state." The field studies how that implementation is organised, staffed, financed and controlled.</p>

<h3>Wilson's vision</h3>
<ul>
<li>Argued that running a constitution is harder than framing one -- administration needed to become a science of its own, separate from politics.</li>
<li>Pointed to the European (especially Prussian and French) administrative tradition as a model of efficient, trained civil service, while insisting American democracy still needed its own version, not a borrowed autocratic one.</li>
<li>Wanted administration to be businesslike and efficient, judged by results rather than by legal form.</li>
<li>Is also the starting point for the <b>politics-administration dichotomy</b> -- the idea that policy (politics) and its execution (administration) are separable, later developed further by Frank Goodnow and challenged by almost every school that came after.</li>
</ul>

<h3>Scope of the discipline</h3>
<ul>
<li>Narrow view (POSDCORB-era): administration is only what happens inside the executive branch -- planning, organising, staffing, directing, coordinating, reporting, budgeting.</li>
<li>Broad (integral) view: includes staff and auxiliary services across all three organs of government, not just the executive.</li>
<li>Modern view: administration shapes policy as much as it executes it -- the dichotomy is now treated as a simplification, not a hard wall.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> questions on "scope and significance" of Public Administration usually want you to move from Wilson's narrow efficiency-focused starting point to the field's later, broader concerns -- policy-making, public accountability, development, and governance -- rather than stopping at a textbook definition.</p></div>
*/

-- Note 02 (LIVE now, as id p_padnote_02, via the fire_trigger test run) -- New Public Administration (NPA) vs New Public Management (NPM) [Paper I - Administrative Theory / Introduction], slug new-public-administration-vs-new-public-management:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>NPA</b>: Minnowbrook Conference, 1968, led by Dwight Waldo and younger scholars. <b>NPM</b>: 1980s-90s reforms associated with Christopher Hood, David Osborne and Ted Gaebler ("Reinventing Government").</p></div>

<p>These two "New" movements are easy to mix up in an exam, but they pull in different directions -- NPA is a values-driven reaction against value-free efficiency, while NPM is a market-driven reaction against a bloated, rule-bound bureaucracy.</p>

<h3>New Public Administration (NPA)</h3>
<ul>
<li>Reacted against the 1950s-60s obsession with scientific, value-neutral efficiency (the legacy of the efficiency-era POSDCORB thinking).</li>
<li>Centred on <b>social equity</b> as a third pillar alongside efficiency and economy -- administrators should actively advocate for disadvantaged clients, not stay neutral.</li>
<li>Embraced change, relevance to real social problems, participative decision-making, and a more "client-focused," less hierarchical administrator.</li>
<li>Associated with the broader 1960s-70s climate of civil rights and anti-Vietnam-War activism in American academia.</li>
</ul>

<h3>New Public Management (NPM)</h3>
<ul>
<li>Treated the citizen as a <b>customer</b> and government as something to be run more like a business.</li>
<li>Key ideas: privatisation and contracting-out, competition between service providers, performance-based pay and targets, decentralised "agencification," separating policy from delivery, and the "3 Es" -- economy, efficiency, effectiveness.</li>
<li>Christopher Hood's "7 doctrines" of NPM include hands-on professional management, explicit performance standards, output control, and greater competition in the public sector.</li>
<li>Criticised for weakening public accountability, treating citizens as mere consumers, and importing private-sector logic into functions (law and order, welfare) where it doesn't fit well.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> the fastest way to show you understand both is one line each -- "NPA asked administration to care about equity, NPM asked it to behave like a business" -- then develop whichever the question actually points at. Don't conflate the two even though both have "New" and "Public" in the name.</p></div>
*/

-- Note 03 (staged in pub_ad_notes_queue, not yet live) -- Good Governance -- Concept and Pillars [Paper I - Administrative Theory / Introduction], slug good-governance-concept-and-pillars:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p>Popularised by the <b>World Bank</b> (from the late 1980s, especially its 1989 report on Sub-Saharan Africa) and elaborated by <b>UNDP</b>'s governance indicators in the 1990s.</p></div>

<p><b>Government</b> is an institution -- the formal machinery that makes and enforces rules. <b>Governance</b> is a process -- how decisions are actually made and implemented, involving government, the private sector and civil society together, not government acting alone. "Good governance" judges that process against a set of normative standards.</p>

<h3>Commonly cited pillars (World Bank / UNDP style)</h3>
<ul>
<li><b>Participation</b> -- all stakeholders, including the marginalised, have a voice in decisions.</li>
<li><b>Rule of law</b> -- fair legal frameworks, impartially enforced, including on human rights.</li>
<li><b>Transparency</b> -- decisions and their enforcement follow rules, and information is freely accessible.</li>
<li><b>Responsiveness</b> -- institutions serve all stakeholders within a reasonable timeframe.</li>
<li><b>Consensus orientation</b> -- mediating different interests to reach a broad agreement on what serves the community best.</li>
<li><b>Equity and inclusiveness</b> -- all groups, especially the most vulnerable, have opportunities to improve their well-being.</li>
<li><b>Effectiveness and efficiency</b> -- processes and institutions produce results that meet needs while using resources well.</li>
<li><b>Accountability</b> -- decision-makers in government, the private sector and civil society are answerable to the public and to institutional stakeholders.</li>
</ul>

<h3>Why it matters for administration</h3>
<ul>
<li>Shifts the administrator's role from sole implementer to one actor among many (government, market, civil society) -- the idea of "steering, not rowing."</li>
<li>Underpins India's own reform vocabulary -- the Right to Information Act, Citizens' Charters, e-governance, and the Second Administrative Reforms Commission's recommendations all draw on good-governance language.</li>
<li>Criticised for being donor-driven and somewhat Western-centric in its original form -- a checklist that doesn't always fit every country's administrative history or capacity.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> don't just list the pillars -- show the government-to-governance shift in one sentence first, then use 3-4 pillars (not all eight) tied to a concrete Indian example such as RTI or e-governance, to keep the answer from reading like a rote list.</p></div>
*/

-- Note 04 (staged in pub_ad_notes_queue, not yet live) -- Taylor's Scientific Management [Paper I - Administrative Theory / Administrative Thought], slug taylors-scientific-management:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Frederick Winslow Taylor</b>, "The Principles of Scientific Management" (1911) -- the founding text of the classical, efficiency-first school of administrative thought.</p></div>

<p>Taylor worked as a mechanical engineer in American steel plants and built his theory from direct observation of shop-floor inefficiency -- what he called "systematic soldiering," workers deliberately working below capacity. His answer was to replace rule-of-thumb methods with a measured, scientifically-determined "one best way" of doing each task.</p>

<h3>Four principles of scientific management</h3>
<ul>
<li>Develop a true science of work for every job, replacing rule-of-thumb methods, through time-and-motion study.</li>
<li>Scientifically select, train and develop workers, rather than leaving them to train themselves.</li>
<li>Bring the science and the trained worker together -- management cooperates with workers to ensure the scientific method is actually followed.</li>
<li>Divide work and responsibility almost equally between management (planning) and workers (execution) -- a sharp separation of "head work" from "hand work."</li>
</ul>

<h3>Key techniques</h3>
<ul>
<li><b>Time and motion study</b> to find the most efficient sequence of movements for a task.</li>
<li><b>Differential piece-rate system</b> -- higher per-unit pay for output above a set standard, to incentivise efficiency.</li>
<li><b>Functional foremanship</b> -- replacing one all-purpose supervisor with several specialist foremen (for routing, speed, discipline, and so on).</li>
<li><b>Standardisation</b> of tools, materials and working conditions.</li>
</ul>

<h3>Critique</h3>
<ul>
<li>Treats the worker as a largely passive, economically-motivated unit ("economic man") -- the Human Relations School later showed social and psychological needs matter just as much.</li>
<li>Assumes management's interests and workers' interests are naturally harmonious, which labour movements of the time strongly disputed.</li>
<li>Works best for simple, repetitive, measurable tasks -- harder to apply to administrative or professional work where output isn't easily timed.</li>
<li>In Public Administration, scientific management fed directly into the mechanical, efficiency-obsessed thinking of the POSDCORB era (Gulick and Urwick), which NPA later reacted against.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> Taylor is most useful in an answer as a contrast point -- state his efficiency logic briefly, then pivot to Follett, Mayo or the Human Relations critique to show the arc of administrative thought moving from "man as a machine part" to "man as a social being."</p></div>
*/

-- Note 05 (staged in pub_ad_notes_queue, not yet live) -- Weber's Bureaucratic Model and Its Critique [Paper I - Administrative Theory / Administrative Thought], slug webers-bureaucratic-model-and-critique:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Max Weber</b> described bureaucracy as the purest form of <b>legal-rational authority</b>, one of his three types of authority (alongside traditional and charismatic). It is an <b>ideal type</b> -- an analytical yardstick, not a claim that any real organisation matches it exactly.</p></div>

<p>For Weber, legitimacy in the modern world rests on belief in formally correct, rule-bound procedure. Bureaucracy is the administrative form that fits that legitimacy -- and he argued it prevails over other forms because of its precision, speed, continuity and reduced friction.</p>

<h3>Key characteristics</h3>
<ul>
<li>Fixed jurisdictional areas, with duties defined by rules.</li>
<li>A clear <b>hierarchy of offices</b>, with each level supervising the one below.</li>
<li>Administration conducted through written documents and files.</li>
<li><b>Expert training</b> as the basis of appointment, not birth or patronage.</li>
<li>The office as a <b>full-time vocation</b>, not a sideline.</li>
<li><b>Impersonality</b> -- authority belongs to the office, not the office-holder, and rules are applied without personal favour.</li>
<li>A defined <b>career structure</b> -- appointment, salary, tenure and pension.</li>
</ul>

<h3>Critique</h3>
<ul>
<li><b>Robert Merton</b> -- "trained incapacity" (narrow training leaves officials unable to adapt when routines fail) and "goal displacement" (rules, which are a means, become an end in themselves), producing a rigid "bureaucratic personality."</li>
<li><b>Philip Selznick</b> -- delegation creates sub-units with their own goals that can displace the organisation's actual goals.</li>
<li><b>Alvin Gouldner</b> -- rules set only a minimum standard, so staff perform at that minimum, which invites tighter supervision and still more rules.</li>
<li><b>Peter Blau</b> -- real bureaucracies survive partly through informal, unofficial departures from the rules, which often improve performance rather than hurting it.</li>
<li><b>Michel Crozier</b> and <b>Victor Thompson</b> add related ideas -- bureaucracies struggle to learn from error, and authority can stay at the top while real expertise sits lower down ("bureau-pathology").</li>
<li><b>Herbert Simon</b>'s bounded rationality challenges the ideal type's assumption of fully rational rule-following behaviour.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> always name it as an <i>ideal type</i> explicitly -- a common mistake is writing as if Weber claimed real bureaucracies work exactly this way. State 3-4 features, then pick 2-3 critics (Merton plus one more) rather than listing all of them, to keep depth over breadth.</p></div>
*/

-- Note 06 (staged in pub_ad_notes_queue, not yet live) -- Mary Parker Follett's Dynamic Administration [Paper I - Administrative Theory / Administrative Thought], slug folletts-dynamic-administration:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Mary Parker Follett</b> (1868-1933), American social worker and management thinker. Her lectures were published posthumously as <b>"Dynamic Administration"</b> (1941), edited by Metcalf and Urwick.</p></div>

<p>Follett shifted the study of organisations away from pure structure and efficiency, toward relationships, groups and conflict -- a socio-psychological approach that anticipated the Human Relations School by roughly a decade.</p>

<h3>Resolving conflict: domination, compromise, integration</h3>
<ul>
<li><b>Domination</b> -- one side wins outright, and the loser simply waits for a chance to reverse the outcome.</li>
<li><b>Compromise</b> -- each side gives up part of its demand -- neither is fully satisfied, so the conflict tends to resurface.</li>
<li><b>Integration</b> -- the parties uncover the real interests behind their stated demands and find a solution that satisfies both without either side sacrificing. Her classic example: two people disagree over a window, one wants it open for air and the other shut against a draught -- opening a window in the next room satisfies both.</li>
</ul>

<h3>Law of the situation and circular response</h3>
<ul>
<li><b>Law of the situation</b> -- neither party simply commands the other -- both study the situation and take their orders from it. Authority, for Follett, belongs to the job and the knowledge it requires, not to rank as such.</li>
<li><b>Circular response</b> -- behaviour is not a straight line of stimulus and response. Each party's action changes the situation the other responds to, so relationships are continuously reconstituted -- the "dynamic" in Dynamic Administration.</li>
<li>Distinguished <b>power-with</b> (coactive, which can grow as people cooperate) from <b>power-over</b> (coercive, which is a fixed, divided quantity).</li>
</ul>

<h3>Critique</h3>
<ul>
<li>Integration assumes interests are genuinely reconcilable and that parties hold roughly equal power -- it offers little guidance for zero-sum conflicts.</li>
<li>The method for actually finding the integrative solution is left fairly vague in practice.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> Follett is a strong bridge answer between the classical and human-relations schools -- use her to show administrative thought moving from rigid hierarchy toward relationships and shared authority, and cite her influence on Chester Barnard and later negotiation theory (Fisher and Ury's "principled negotiation" echoes her integration idea).</p></div>
*/

-- Note 07 (staged in pub_ad_notes_queue, not yet live) -- Herbert Simon's Decision-Making Theory [Paper I - Administrative Theory / Administrative Thought], slug simons-decision-making-theory:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Herbert Simon</b>, "The Proverbs of Administration" (1946) and "Administrative Behavior" (1947) -- shifted Public Administration's unit of analysis from the organisation to the individual <b>decision</b>.</p></div>

<p>Simon argued the classical principles of administration (specialisation, unity of command, narrow span of control, and so on) work like contradictory proverbs -- untestable and offering no way to decide which should win when two of them conflict. His remedy was to make decision-making itself the proper object of study, put on a more scientific footing.</p>

<h3>Fact-value dichotomy</h3>
<ul>
<li>Every decision rests on <b>factual premises</b> (statements about the observable world, which can be tested true or false) and <b>value premises</b> (statements of what ought to be, which cannot be empirically validated).</li>
<li>Simon held a science of administration could only be built on the factual component -- a position Dwight Waldo challenged, arguing the means-ends chain makes a clean separation untenable, since every end is also a means to some further end.</li>
</ul>

<h3>Bounded rationality and satisficing</h3>
<ul>
<li>Real decision-makers are only <b>intendedly</b> rational -- bounded by limited skills and habits, limited values, limited knowledge, and limited time.</li>
<li>Because exhaustive search costs more than it gains, decision-makers typically <b>satisfice</b> -- accept the first alternative that clears an aspiration level -- rather than <b>maximise</b> by evaluating every option for the true optimum.</li>
<li>The aspiration level itself adapts -- rising after success, falling after failure.</li>
</ul>

<h3>Administrative man vs economic man</h3>
<ul>
<li><b>Economic man</b> is a theoretical construct with complete information and consistent preferences, able to maximise.</li>
<li><b>Administrative man</b> is the realistic decision-maker, pursuing genuine goals but limited by cognition and information, so he satisfices -- the bridge between purely rational and purely psychological views of human behaviour.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> "satisficing, not maximising" is the single most quotable line from Simon -- anchor any answer on decision-making or on the limits of rationality in administration around that phrase, then build outward to bounded rationality and the fact-value split.</p></div>
*/

-- Note 08 (staged in pub_ad_notes_queue, not yet live) -- Theories of Motivation -- Maslow, Herzberg and McGregor [Paper I - Administrative Theory / Administrative Behaviour], slug theories-of-motivation-maslow-herzberg-mcgregor:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Abraham Maslow</b> (1943) -- hierarchy of needs. <b>Frederick Herzberg</b> (1959) -- two-factor theory. <b>Douglas McGregor</b> (1960) -- Theory X and Theory Y. All three are reactions against treating workers as purely economically-motivated.</p></div>

<h3>Maslow's hierarchy of needs</h3>
<ul>
<li>Five levels, satisfied broadly in order: <b>physiological</b> (food, shelter), <b>safety</b> (security, stability), <b>social/belongingness</b> (relationships), <b>esteem</b> (recognition, status), and <b>self-actualisation</b> (realising one's full potential).</li>
<li>Once a lower need is reasonably satisfied, it stops motivating and the next level up takes over -- so a well-paid, secure employee is no longer motivated primarily by pay.</li>
</ul>

<h3>Herzberg's two-factor theory</h3>
<ul>
<li><b>Hygiene factors</b> (salary, working conditions, job security, supervision) prevent dissatisfaction if adequate, but do not themselves create satisfaction or motivation.</li>
<li><b>Motivator factors</b> (achievement, recognition, responsibility, growth, the work itself) are what actually drive performance and satisfaction.</li>
<li>Implication for administration: simply improving pay or conditions (hygiene) removes complaints but does not make people work harder -- job enrichment is needed for that.</li>
</ul>

<h3>McGregor's Theory X and Theory Y</h3>
<ul>
<li><b>Theory X</b> assumes the average worker dislikes work, avoids responsibility, and must be closely directed and controlled -- producing authoritarian, tightly-supervised management styles.</li>
<li><b>Theory Y</b> assumes workers can be self-directed, seek responsibility, and are intrinsically motivated by meaningful work -- producing participative, delegative management styles.</li>
<li>McGregor's own preference was clearly for Theory Y as the more accurate and more productive assumption, though later writers (e.g. William Ouchi's Theory Z) added a cultural, group-oriented dimension drawn from Japanese management practice.</li>
</ul>

<h3>Critique common to all three</h3>
<ul>
<li>Largely drawn from Western, often private-sector settings -- applying them directly to a rule-bound, hierarchical public bureaucracy needs care.</li>
<li>Maslow's strict, sequential hierarchy has weak empirical support -- needs often operate simultaneously rather than strictly in order.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> link the three together as one progression -- Maslow explains <i>what</i> people need, Herzberg separates <i>what prevents dissatisfaction</i> from <i>what actually motivates</i>, and McGregor turns that into two contrasting <i>management styles</i> -- rather than describing each in an isolated silo.</p></div>
*/

-- Note 09 (staged in pub_ad_notes_queue, not yet live) -- Leadership Theories in Administration [Paper I - Administrative Theory / Administrative Behaviour], slug leadership-theories-in-administration:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p>Leadership theory moved through three broad phases: <b>trait</b> theories (who leaders are), <b>behavioural</b> theories (what leaders do), and <b>situational/contingency</b> theories (what the context demands).</p></div>

<h3>Trait approach</h3>
<ul>
<li>Early 20th-century assumption: leaders are born with identifiable traits -- intelligence, self-confidence, determination, integrity, sociability.</li>
<li>Critique: traits found in one study rarely replicate in another, and the approach ignores the situation entirely -- a trait that helps in one context can hurt in another.</li>
</ul>

<h3>Behavioural approach</h3>
<ul>
<li>Shifted focus to observable behaviour rather than innate traits, since behaviour can in principle be learned and trained.</li>
<li>The Ohio State and Michigan studies identified two recurring behaviour clusters: <b>task-oriented</b> (structuring, directing work) and <b>people-oriented</b> (consideration, relationships) -- roughly matching Robert Blake and Jane Mouton's later "Managerial Grid," which plots leaders on both dimensions and treats high-high as ideal.</li>
<li>Rensis Likert's related work on participative management described a continuum of styles from exploitative-authoritative to participative-group, with the most participative style generally yielding the best long-run results.</li>
</ul>

<h3>Situational and contingency approach</h3>
<ul>
<li>Argues no single style is universally best -- the right style depends on the follower's maturity, the task, and the organisational context.</li>
<li><b>Fiedler's contingency model</b> matches leadership style to how favourable the situation is (leader-member relations, task structure, position power).</li>
<li><b>Hersey and Blanchard's situational leadership</b> varies the style (telling, selling, participating, delegating) according to the follower's readiness and competence.</li>
</ul>

<h3>Critique</h3>
<ul>
<li>None of the three phases fully explains leadership in a rule-bound public bureaucracy, where legal authority and hierarchy already constrain how much "style" can vary.</li>
<li>Later work (transformational vs transactional leadership) tries to bridge this by distinguishing leaders who merely manage routine exchanges from those who inspire a shared vision -- increasingly cited in public-sector reform discussions.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> frame the answer as an evolution -- "from who a leader is, to what a leader does, to what the situation demands" -- and close with one line connecting it to the civil servant's own dilemma: how much discretion a rule-bound hierarchy actually allows a "leadership style" to operate in.</p></div>
*/

-- Note 10 (staged in pub_ad_notes_queue, not yet live) -- Systems and Contingency Approaches to Organisation Theory [Paper I - Administrative Theory / Organisations], slug systems-and-contingency-approaches-to-organisation:
/*
<div class="kb-box kb-facts"><div class="kb-box-title">At a glance</div><p><b>Systems theory</b> (drawing on Ludwig von Bertalanffy's general systems theory, applied to organisations from the 1950s-60s) and <b>contingency theory</b> (1960s-70s, e.g. Paul Lawrence and Jay Lorsch, Tom Burns and G.M. Stalker) both reject the classical idea of one universally correct organisational structure.</p></div>

<h3>Systems approach</h3>
<ul>
<li>Treats an organisation as an <b>open system</b> -- it takes inputs from its environment (resources, people, demands), transforms them through internal processes, and releases outputs back into that environment, with feedback loops adjusting future behaviour.</li>
<li>This was a direct break from the classical, closed-system view (e.g. scientific management, Weberian bureaucracy), which largely ignored the surrounding environment and treated the organisation as self-contained.</li>
<li>Emphasises interdependence -- a change in one sub-system (say, recruitment policy) ripples through others (training needs, morale, output quality) rather than staying isolated.</li>
<li>Its main limitation is also its main strength -- it is a way of thinking about organisations (a framework) more than a specific, testable theory with concrete predictions.</li>
</ul>

<h3>Contingency approach</h3>
<ul>
<li>Built directly on the systems view's environmental sensitivity, and asked a sharper question: <i>which</i> structure fits <i>which</i> environment?</li>
<li><b>Burns and Stalker</b> distinguished <b>mechanistic</b> organisations (rigid, hierarchical, rule-bound -- suited to stable environments) from <b>organic</b> organisations (flexible, decentralised, adaptive -- suited to rapidly changing environments).</li>
<li><b>Lawrence and Lorsch</b> studied <b>differentiation</b> (how specialised sub-units become) and <b>integration</b> (how well they're coordinated back together) and found high-performing firms matched both to how uncertain their environment was.</li>
<li>Core claim: there is no single "one best way" to organise -- the right structure is <i>contingent</i> on factors like environmental uncertainty, technology, size and task.</li>
</ul>

<h3>Relevance to Public Administration</h3>
<ul>
<li>Explains why identical reforms (say, decentralisation) succeed in one government department and fail in another -- the surrounding environment and task differ.</li>
<li>Underpins later arguments for flexible, semi-autonomous bodies (regulatory authorities, special-purpose agencies) over one uniform departmental structure for every government function.</li>
</ul>

<div class="kb-box kb-tip"><p><b>Answer-writing cue:</b> contingency theory is the natural rebuttal whenever a question asks you to critique the Weberian "one best structure" assumption -- use Burns and Stalker's mechanistic/organic contrast as your concrete anchor rather than describing contingency theory only in the abstract.</p></div>
*/
