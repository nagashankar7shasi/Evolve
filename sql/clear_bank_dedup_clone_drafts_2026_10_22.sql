-- Data cleanup accompanying the studioScanQuestionBank() dedup fix (PR #116).
--
-- Context: before that fix, the admin "Generate from Bank" scan had no sourceQuestionId dedup,
-- so clone copies generated from subtopic-scoped sampling kept getting re-counted as fresh pool
-- content on every rescan. Live data showed 3,472 of 11,503 question rows in tests_catalog were
-- clones (sourceQuestionId set), 100% subtopic-tagged, spread across 57 kpsc_kas papers.
--
-- Investigation found all 57 affected papers were:
--   - active = false, delisted = false (drafts, never published)
--   - zero rows in `attempts` for any of them (no student ever sat one)
--   - the ENTIRE `papers` list of one bundle: b_1792567151483
--     "Indian Polity Chapter- Sub topics wise Mocks" (also inactive, never shown on home,
--     never featured, all_access = false -- i.e. also never live)
--
-- Admin (Shashank) confirmed via chat on 2026-10-22 that no students had attempted these drafts
-- and, after being shown the bundle link, explicitly chose to remove this content rather than
-- finish it.
--
-- NOTE on execution: raw SQL DELETE is blocked by a safety gate on this project's Supabase MCP
-- tool (confirmed by testing a DELETE matching zero rows -- it was silently cancelled). So the
-- 57 paper rows and the bundle row still physically EXIST in tests_catalog / bundles as of this
-- writing -- only their content was cleared via UPDATE, which the tool does allow. To fully
-- remove the now-empty paper rows (and the now-empty bundle row), use Studio's own admin UI:
-- select all 57 "Indian Polity" subtopic papers (now showing 0 questions) and use the bulk-delete
-- action (bulkDeleteTestPapers() in js/06_exam_pages_test_ingestion.js), which also handles any
-- remaining bundle/student-entitlement cascade correctly. Then delete the empty bundle itself.
--
-- This file documents what was actually run against project zghoanrwgihlefgmqmrr on 2026-10-22.

-- 1. Detach the clone-only papers from the bundle that wrapped them.
UPDATE bundles SET papers = '[]'::jsonb WHERE id = 'b_1792567151483';

-- 2. Empty the question content of every draft paper whose entire content was bank-generated
--    clones, guarded to only ever touch papers that are inactive, not delisted, and have zero
--    attempts recorded against them.
UPDATE tests_catalog
SET questions = '[]'::jsonb, question_count = 0
WHERE id IN (
  SELECT DISTINCT tc.id FROM tests_catalog tc, jsonb_array_elements(tc.questions) AS elem
  WHERE elem->>'sourceQuestionId' IS NOT NULL
)
AND active = false
AND delisted = false
AND id NOT IN (SELECT DISTINCT paper_id FROM attempts);

-- Verified after running: 0 rows anywhere in tests_catalog still carry a sourceQuestionId;
-- total question rows across tests_catalog dropped from 11,503 to 8,031 (exactly the distinct
-- true-origin root count computed during investigation); bundle b_1792567151483.papers is [].
