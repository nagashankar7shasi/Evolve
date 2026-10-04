-- ============================================================================
--  New feature: Current Affairs questions now carry a structured "relevant
--  until" expiry date (relevantUntil, ISO "YYYY-MM-DD") alongside the existing
--  free-text relevantPeriod. One year from the day a question is tagged CA,
--  per policy (see CA_RELEVANCE_WINDOW_DAYS in js/06a_test_paper_studio.js).
--  Once relevantUntil passes, isCaLapsedPendingReview() flags the question as
--  "lapsed" and it's automatically excluded from the question bank, Topic
--  Builder, and Generate-from-Bank sampling (same treatment as `retired`) --
--  and it's surfaced in a new admin "Archive" review queue
--  (renderCoverageAndCaReview, js/11d_study_planner_admin_csv.js) where the
--  admin Accepts (-> becomes permanent Static, expiry cleared) or Rejects
--  (-> retired) each one.
--
--  This migration is the one-time backfill for the 10 live CA papers that
--  predate this feature (the same batch whose contentType was fixed in
--  fix_ca_papers_contenttype_unset.sql) -- they had no relevantUntil at all.
--  Every CA question created or edited from now on gets relevantUntil set
--  automatically by the app (CSV import, the single-question edit modal, and
--  the bulk "Mark CA" action all default it to +365 days when left blank) --
--  this file only backfills the pre-existing ones so they don't all look
--  simultaneously "lapsed forever" with no window to measure from.
--
--  Today is 2026-10-04, so relevantUntil = 2027-10-04 (today + 1 year) for
--  all of them -- they'll all become eligible for Archive review on the same
--  day a year from now, which is fine: that's exactly when the admin should
--  revisit this whole batch of pre-feature CA content anyway.
--
--  Verified live before this ran: all 10 papers below, 1000 questions total,
--  100 each, every single one with contentType = 'ca' (already fixed) and
--  relevantUntil absent entirely (0/1000 had the key at all). Verified again
--  after: all 1000 now have relevantUntil = '2027-10-04', question counts
--  unchanged per paper (100 each), contentType still 'ca' for all 1000, and a
--  spot-check of one full question object (paper_1790599089060's first
--  question) confirmed every other field -- text, options, correct answer,
--  explanation, subject -- is untouched; only relevantUntil was added.
-- ============================================================================

UPDATE public.tests_catalog t
SET questions = sub.new_questions
FROM (
  SELECT id, jsonb_agg(elem || jsonb_build_object('relevantUntil', '2027-10-04') ORDER BY ord) AS new_questions
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
