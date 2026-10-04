-- ============================================================================
--  Fix: 10 live Current Affairs papers had every question's contentType unset,
--  so they were silently treated as "Static" everywhere contentType matters
--  (the Current Affairs review/staleness tool, the Static/CA mix % when
--  generating a paper from the question bank, and the admin's Static/CA
--  filter in the practice-by-topic builder).
--
--  Root cause: these papers were uploaded via CSV before this specific CSV's
--  "Type" column was set to "Current Affairs" (it was left as the default
--  "Static" in the source files). The importer (js/06a_test_paper_studio.js,
--  studioMapHeaderRow -> field 'contentType') correctly reads that column,
--  but a blank/"Static" value there intentionally (and correctly) maps to
--  no contentType being stored at all -- "unset/missing === 'static'" is the
--  documented convention for pre-existing questions, not a bug in the
--  importer itself.
--
--  Found and fixed after the admin noticed one of these papers
--  (Science and Technology CA Paper 2 2025-26) was entirely current-affairs
--  content but showing as Static in the question bank, and confirmed the
--  same CSV-authoring mistake had been made across all 10 papers in this
--  batch (all uploaded in the same session, same day, same convention).
--
--  Verified live before this ran: all 10 papers below, 1000 questions total,
--  every single one had contentType IS NULL (not even the literal string
--  'static' -- genuinely absent). Verified again after: all 1000 now have
--  contentType = 'ca', question count unchanged per paper (100 each), and a
--  spot-check of one full question object (paper_1790599089060's first
--  question) confirmed every other field -- text, options, correct answer,
--  explanation, subject -- is untouched; only contentType was added.
--
--  relevantPeriod (the sibling field, "only meaningful for Current Affairs
--  rows", used by the staleness review) was intentionally left alone here --
--  it was already blank for these questions and filling it in requires the
--  admin's judgement about what period each paper actually covers, not
--  something to guess at in a blanket SQL fix.
-- ============================================================================

UPDATE public.tests_catalog t
SET questions = sub.new_questions
FROM (
  SELECT id, jsonb_agg(elem || jsonb_build_object('contentType', 'ca') ORDER BY ord) AS new_questions
  FROM public.tests_catalog, jsonb_array_elements(questions) WITH ORDINALITY AS arr(elem, ord)
  WHERE id IN (
    'paper_1790598844931', -- Geography and Environment CA Paper 1
    'paper_1790598875602', -- Geography and Environment CA Paper 2
    'paper_1790598920648', -- History, Art and Culture CA Paper 1 2025-26
    'paper_1790598939117', -- History, Art and Culture CA Paper 2 2025-26
    'paper_1790598955131', -- International Relations CA Test 1 2025-26
    'paper_1790599000567', -- International Relations CA Test 2 2025-26
    'paper_1790599028371', -- Polity CA Test 1 2025-26
    'paper_1790599052142', -- Polity CA Test 2 2025-26
    'paper_1790599068591', -- Science and Technology CA Paper 1 2025-26
    'paper_1790599089060'  -- Science and Technology CA Paper 2 2025-26
  )
  GROUP BY id
) sub
WHERE t.id = sub.id;
