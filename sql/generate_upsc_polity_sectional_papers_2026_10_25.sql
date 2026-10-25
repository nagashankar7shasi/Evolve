-- Part of the "UPSC-centric institute" content buildout (companion to PR #117, the
-- exam_categories reorder, and the UPSC CSE Syllabus & Strategy page, all 2026-10-25).
--
-- Investigation found UPSC CSE's apparent content gap wasn't actually empty: a 3,887-question
-- Indian Polity bank ("Lakshmikant Indian Polity All Chapters 1-95", id paper_1792555426736,
-- priced Rs.2000 standalone) was sitting active=false, delisted=true -- serving nobody. It's
-- almost certainly the true root bank the 57 KPSC KAS subtopic clone-papers (deleted in the
-- previous session, see clear_bank_dedup_clone_drafts_2026_10_22.sql) were generated from --
-- except those clones were tagged ONLY to kpsc_kas, so UPSC CSE itself never got anything back
-- from its own bank.
--
-- Its 95 distinct subTopic tags are wildly uneven (one bucket alone, "Indian Constitutional
-- System -- General", has 640 of the 3,887 questions; ~15 others have 1-3 questions each), so a
-- literal 1-paper-per-subtopic split (apparently what the abandoned 57-paper bundle did) produces
-- a lot of unusably tiny papers. Instead, grouped the 95 subtopics into 15 editorially-coherent
-- themes, then split any theme over 160 questions into evenly-sized parts (Postgres NTILE, not a
-- fixed chunk size -- avoids a ragged tiny tail part). Admin confirmed via chat on 2026-10-25:
-- free (not paid), and dual-tagged so the same build feeds both upsc_cse (primary category) and
-- kpsc_kas (extra_categories), reversing the one-sidedness from before.
--
-- Mechanically mirrors studioGenerateFromBank()'s clone pattern (js/06a_test_paper_studio.js):
-- every cloned question keeps all its original fields (q_en/q_kn, options_en/options_kn, exp,
-- correct, subject, subTopic, contentType, askedInYears, etc. -- untouched) and gets exactly two
-- new fields: a fresh unique id, and sourceQuestionId pointing back at its TRUE root
-- ('paper_1792555426736::<original id>'), since the source questions are themselves un-cloned
-- originals (0 already had sourceQuestionId set, 0 retired, all contentType 'static' -- verified
-- before running). The source paper itself is left untouched (still inactive/delisted) -- it
-- stays the dormant source bank, same convention as every other bank-generation in this app.
--
-- Verified before running: every one of the 3,887 source questions mapped to exactly one theme
-- (0 unmapped, 95 distinct subtopics = 95 mapping rows). Verified after running: 30 new papers,
-- summing to exactly 3,887 questions with 3,887 distinct new ids and 3,887 distinct
-- sourceQuestionId values (no accidental duplicate-root clones), one spot-checked clone's content
-- (text, options, correct answer, subTopic) matches its source exactly byte-for-byte.
--
-- This single statement is the subtopic->theme mapping (theme_map), re-grouping into 15 themes
-- and 30 appropriately-sized papers, then one INSERT producing all 30 tests_catalog rows at once.

WITH theme_map(sub_topic, theme) AS (
VALUES
  ('Historical Background', 'Historical Background & Constitution-Making'),
  ('Constituent Assembly', 'Historical Background & Constitution-Making'),
  ('Preamble', 'Historical Background & Constitution-Making'),
  ('Union and Its Territory', 'Historical Background & Constitution-Making'),
  ('Constitutional Prescriptions', 'Historical Background & Constitution-Making'),
  ('Schedules and Articles', 'Historical Background & Constitution-Making'),
  ('Amendment of the Constitution', 'Historical Background & Constitution-Making'),
  ('Indian Constitutional System — General', 'Indian Constitutional System — General'),
  ('Parliament', 'Union Legislature — Parliament'),
  ('Anti-Defection Law', 'Union Legislature — Parliament'),
  ('Delimitation Commission of India', 'Union Legislature — Parliament'),
  ('President and Vice-President', 'Union Executive'),
  ('Prime Minister and Council of Ministers', 'Union Executive'),
  ('Attorney General of India', 'Union Executive'),
  ('Union Public Service Commission', 'Union Executive'),
  ('Governor', 'State Executive & Legislature'),
  ('Chief Minister', 'State Executive & Legislature'),
  ('Chief Minister and State Council of Ministers', 'State Executive & Legislature'),
  ('State Council of Ministers', 'State Executive & Legislature'),
  ('State Legislature', 'State Executive & Legislature'),
  ('Coalition Government', 'State Executive & Legislature'),
  ('State Public Service Commission', 'State Executive & Legislature'),
  ('Advocate General of the State', 'State Executive & Legislature'),
  ('Supreme Court and Judiciary', 'Judiciary'),
  ('High Court', 'Judiciary'),
  ('Subordinate Courts', 'Judiciary'),
  ('High Courts and Subordinate Courts', 'Judiciary'),
  ('Tribunals', 'Judiciary'),
  ('Lok Adalats and Other Courts', 'Judiciary'),
  ('Bar Council of India', 'Judiciary'),
  ('Landmark Judgements and Their Impact', 'Judiciary'),
  ('Important Doctrines of Constitutional Interpretation', 'Judiciary'),
  ('Judgements Relating to the Amendments', 'Judiciary'),
  ('Judgements Expanding the Scope of Article 21', 'Judiciary'),
  ('Judicial Appointments – NJAC (Struck Down in 2015)', 'Judiciary'),
  ('Presidential References – 2G Spectrum (2012)', 'Judiciary'),
  ('Ninth Schedule – Basic Structure Review', 'Judiciary'),
  ('Federalism and Centre-State Relations', 'Centre-State Relations & Emergency Provisions'),
  ('Emergency Provisions', 'Centre-State Relations & Emergency Provisions'),
  ('Special Provisions for Some States', 'Centre-State Relations & Emergency Provisions'),
  ('Special Provisions Relating to Certain Classes', 'Centre-State Relations & Emergency Provisions'),
  ('Scheduled and Tribal Areas', 'Centre-State Relations & Emergency Provisions'),
  ('Zonal Councils — Common Secretariat (States Reorganisation Act, 1956)', 'Centre-State Relations & Emergency Provisions'),
  ('North Eastern Council', 'Centre-State Relations & Emergency Provisions'),
  ('National Emergency — Article 358 and Article 19', 'Centre-State Relations & Emergency Provisions'),
  ('National Disaster Management Authority', 'Centre-State Relations & Emergency Provisions'),
  ('Panchayati Raj', 'Local Government'),
  ('Municipalities', 'Local Government'),
  ('State Election Commission — Article 243K', 'Local Government'),
  ('Local Government', 'Local Government'),
  ('Fundamental Rights', 'Fundamental Rights & Directive Principles'),
  ('Directive Principles', 'Fundamental Rights & Directive Principles'),
  ('Fundamental Duties', 'Fundamental Rights & Directive Principles'),
  ('Elections', 'Elections & Political Parties'),
  ('Election Commission', 'Elections & Political Parties'),
  ('Electoral Reforms', 'Elections & Political Parties'),
  ('Political Parties', 'Elections & Political Parties'),
  ('Pressure Groups', 'Elections & Political Parties'),
  ('Voting Behaviour', 'Elections & Political Parties'),
  ('Role of Regional Parties', 'Elections & Political Parties'),
  ('Election Laws', 'Elections & Political Parties'),
  ('Elections and Political Parties', 'Elections & Political Parties'),
  ('National Commission to Review the Working of the Constitution', 'Rights & Welfare Commissions'),
  ('National Human Rights Commission', 'Rights & Welfare Commissions'),
  ('National Commission for Protection of Child Rights', 'Rights & Welfare Commissions'),
  ('National Commission for SCs', 'Rights & Welfare Commissions'),
  ('National Commission for STs', 'Rights & Welfare Commissions'),
  ('National Commission for Women', 'Rights & Welfare Commissions'),
  ('National Commission for BCs', 'Rights & Welfare Commissions'),
  ('National Commission for Minorities', 'Rights & Welfare Commissions'),
  ('State Human Rights Commission', 'Rights & Welfare Commissions'),
  ('Lokpal and Lokayuktas', 'Rights & Welfare Commissions'),
  ('Comptroller and Auditor General of India', 'Finance, Audit & Vigilance Bodies'),
  ('Central Vigilance Commission', 'Finance, Audit & Vigilance Bodies'),
  ('Central Bureau of Investigation', 'Finance, Audit & Vigilance Bodies'),
  ('National Investigation Agency', 'Finance, Audit & Vigilance Bodies'),
  ('Finance Commission', 'Finance, Audit & Vigilance Bodies'),
  ('Goods and Services Tax Council', 'Finance, Audit & Vigilance Bodies'),
  ('NITI Aayog', 'Finance, Audit & Vigilance Bodies'),
  ('Law Commission of India', 'Finance, Audit & Vigilance Bodies'),
  ('Central Information Commission', 'Information Commissions & Official Language'),
  ('State Information Commission', 'Information Commissions & Official Language'),
  ('Official Language', 'Information Commissions & Official Language'),
  ('Special Officer for Linguistic Minorities', 'Information Commissions & Official Language'),
  ('World Constitutions', 'World Constitutions & Comparative Politics'),
  ('Citizenship', 'Citizenship, Union Territories & Governance Topics'),
  ('Union Territories', 'Citizenship, Union Territories & Governance Topics'),
  ('National Integration', 'Citizenship, Union Territories & Governance Topics'),
  ('Foreign Policy', 'Citizenship, Union Territories & Governance Topics'),
  ('Co-operative Societies', 'Citizenship, Union Territories & Governance Topics'),
  ('Consumer Commissions', 'Citizenship, Union Territories & Governance Topics'),
  ('Public Services', 'Citizenship, Union Territories & Governance Topics'),
  ('Rights and Liabilities of the Government', 'Citizenship, Union Territories & Governance Topics'),
  ('Constitutional Bodies', 'Citizenship, Union Territories & Governance Topics'),
  ('Leader of Opposition — statutory recognition and 10% misconception', 'Citizenship, Union Territories & Governance Topics')
)
, src AS (
  SELECT elem, elem->>'id' AS qid, (elem->>'subTopic') AS sub_topic
  FROM tests_catalog tc, jsonb_array_elements(tc.questions) AS elem
  WHERE tc.id = 'paper_1792555426736'
)
, themed AS (
  SELECT s.elem, s.qid, tm.theme,
         row_number() OVER (PARTITION BY tm.theme ORDER BY (s.qid)::int) AS rn_in_theme,
         count(*) OVER (PARTITION BY tm.theme) AS theme_total
  FROM src s JOIN theme_map tm ON tm.sub_topic = s.sub_topic
)
, parted AS (
  SELECT *, greatest(1, ceil(theme_total/160.0)::int) AS n_parts,
         NTILE(greatest(1, ceil(theme_total/160.0)::int)) OVER (PARTITION BY theme ORDER BY rn_in_theme) AS part_num
  FROM themed
)
, numbered AS (
  SELECT *, row_number() OVER (ORDER BY theme, part_num, rn_in_theme) AS global_rn
  FROM parted
)
, cloned AS (
  SELECT theme, part_num, n_parts, global_rn,
         (elem - 'id') || jsonb_build_object('id', 'q_poly_' || global_rn::text, 'sourceQuestionId', 'paper_1792555426736::' || qid) AS new_q
  FROM numbered
)
, paper_keys AS (
  SELECT DISTINCT theme, part_num, n_parts, dense_rank() OVER (ORDER BY theme, part_num) AS paper_idx
  FROM cloned
)
, agg AS (
  SELECT c.theme, c.part_num, c.n_parts, pk.paper_idx,
         jsonb_agg(c.new_q ORDER BY c.global_rn) AS questions_arr,
         count(*) AS qcount
  FROM cloned c JOIN paper_keys pk ON pk.theme = c.theme AND pk.part_num = c.part_num
  GROUP BY c.theme, c.part_num, c.n_parts, pk.paper_idx
)
INSERT INTO tests_catalog (id, title, category, extra_categories, active, delisted, bundle_only, price, scheme, question_count, questions, order_num, coming_soon, topics_covered)
SELECT
  'paper_poly_gen_' || paper_idx,
  'Indian Polity — ' || theme || CASE WHEN n_parts > 1 THEN ' (Part ' || part_num || ' of ' || n_parts || ')' ELSE '' END,
  'upsc_cse',
  '["kpsc_kas"]'::jsonb,
  true, false, false, 0,
  '{"cutoff":100,"duration":120,"examBadge":"UPSC CSE","marksWrong":0.66,"marksCorrect":2}'::jsonb,
  qcount,
  questions_arr,
  0, false, 'Indian Polity'
FROM agg;
