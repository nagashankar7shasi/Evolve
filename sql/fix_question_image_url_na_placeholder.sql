-- ============================================================================
--  Fix: every question in "Karnataka Current Affairs Mock Jan-Aug 2026"
--  (paper_1791108228903, kpsc_kas) showed a broken-image icon on the live
--  exam-taking page, for all 100 questions in the paper.
--
--  Root cause: the exam engine (js/10_omr_exam_engine.js) rendered
--  `q.image_url ? <img src="${q.image_url}"> : ''` -- a correct truthy
--  check in itself, but every question's image_url field held the literal
--  string "N/A" rather than being genuinely empty. That's a non-empty,
--  truthy string, so the check passed and an <img> tag was rendered with
--  src="N/A" -- not a real URL, hence the broken-link icon on every single
--  question. The CSV/paste importer (js/06a_test_paper_studio.js,
--  studioApplyMappingAndAdd -> field 'image_url') stored whatever the
--  sheet's Image URL column held verbatim, with no filter for the common
--  spreadsheet convention of typing "N/A" into a blank cell to mean
--  "nothing here" -- so this one paper's source CSV almost certainly had
--  "N/A" filled down the entire Image URL column.
--
--  Paired app-code fix (same PR as this file): a shared `isRealImageUrl()`
--  helper (js/02_pricing_master_storage.js) now treats "N/A"/"-"/"none"/etc.
--  as no-image everywhere an image is rendered or previewed, and the CSV
--  template/help text makes an explicit Kannada-only image column available
--  too -- see PR for the full set of touch points. This file only cleans up
--  the already-bad data already sitting live; new uploads won't re-create it.
--
--  Verified live before this ran: exactly 100 rows across the whole
--  tests_catalog table had image_url = 'N/A', every single one inside this
--  one paper (confirmed via a full-table scan grouped by category -- no
--  other category or paper was affected). Verified again after: 0 rows with
--  image_url = 'N/A' anywhere, this paper's question count unchanged (100),
--  and its question ids still run 1..100 in order -- only the image_url
--  field was touched, set to '' (empty string, same convention every other
--  "no image" question already uses).
-- ============================================================================

UPDATE public.tests_catalog t
SET questions = sub.new_questions
FROM (
  SELECT id, jsonb_agg(
    CASE WHEN elem->>'image_url' ~* '^(n/?a|none|null|undefined|-+|tbd|pending)$'
         THEN elem || jsonb_build_object('image_url', '')
         ELSE elem END
    ORDER BY ord
  ) AS new_questions
  FROM public.tests_catalog, jsonb_array_elements(questions) WITH ORDINALITY AS arr(elem, ord)
  WHERE id = 'paper_1791108228903' -- Karnataka Current Affairs Mock Jan-Aug 2026
  GROUP BY id
) sub
WHERE t.id = sub.id;
