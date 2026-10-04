-- ============================================================================
--  PHASE 7 — close the email_log read leak, lock down study_materials writes,
--  and document an intentional SECURITY DEFINER view.
--
--  Found during a routine audit against the LIVE project (not just reading
--  this directory): two issues previously flagged but left open, plus one
--  new one.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. email_log had TWO SELECT policies stacked on top of each other:
--     "email_log read" (qual = true, wide open to anon/authenticated) and a
--     newer "email_log_admin_read" (qual = is_admin()). Postgres OR's RLS
--     policies for the same command together, so the open one silently won
--     regardless of the admin-only one existing — 39 rows covering 9
--     recipients (password resets, payment approvals) were readable by
--     anyone with the anon key. The app itself only ever reads this table
--     from admin-gated screens (Email Tools send log, Backup/Restore), so
--     dropping the open policy breaks nothing legitimate.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_log read" ON public.email_log;

-- ----------------------------------------------------------------------------
--  2. study_materials storage bucket — flagged as a known gap in
--     phase6_pdf_vault_entitlement.sql ("pending a decision on priority") and
--     never actually closed. SELECT stays public by design (question images
--     render as plain <img src>, not worth signed URLs for non-sensitive
--     assets) but INSERT/UPDATE/DELETE had no admin check at all — anyone
--     with the anon key could upload, overwrite, or delete files in this
--     bucket. The only upload call-sites in the live app (Test Paper Studio's
--     question-image upload, the PDF publishing wizard) are both admin-only
--     tools, so requiring is_admin() here breaks no legitimate path.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "study_materials insert" ON storage.objects;
CREATE POLICY "study_materials insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'study_materials' AND public.is_admin());

DROP POLICY IF EXISTS "study_materials update" ON storage.objects;
CREATE POLICY "study_materials update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'study_materials' AND public.is_admin())
  WITH CHECK (bucket_id = 'study_materials' AND public.is_admin());

DROP POLICY IF EXISTS "study_materials delete" ON storage.objects;
CREATE POLICY "study_materials delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'study_materials' AND public.is_admin());

-- study_materials read/SELECT is intentionally left untouched — stays public.

-- ----------------------------------------------------------------------------
--  3. tests_catalog_public is flagged by Supabase's advisor as a "Security
--     Definer View" (ERROR level). This is DELIBERATE, not a bug: the base
--     table's own SELECT policy is scoped to student_can_access_paper(id)
--     (see phase3b_row_scoping.sql), which is correct for the full table
--     (which carries `questions`, i.e. answer keys) but wrong for a catalog
--     listing — every visitor, entitled or not, needs to see every paper's
--     title/price/paywall-card metadata to browse and decide what to buy.
--     SECURITY DEFINER is what lets this metadata-only view bypass that
--     per-row restriction safely, precisely because it was built to expose
--     only non-sensitive columns (no `questions`). Recorded here via COMMENT
--     so a future audit doesn't mistake this for an oversight and "fix" it
--     by making the catalog grid blank for everyone who hasn't bought
--     anything yet (the original bug phase3 was written to fix).
--
--     Minor accepted caveat: because the view returns every row unfiltered,
--     an inactive or delisted paper's title/price/category is still visible
--     to anyone querying this view directly via the REST API, even though
--     the app's own UI (filterExamCategoryBase, siteSearch) hides it. No
--     question content or pricing-sensitive logic is exposed — just a title
--     the app chooses not to show. Left as-is; revisit only if that
--     specific exposure becomes a real concern.
-- ----------------------------------------------------------------------------
COMMENT ON VIEW public.tests_catalog_public IS
  'Intentionally SECURITY DEFINER: bypasses tests_catalog''s per-row '
  'student_can_access_paper() RLS so the Exam Hub catalog grid can show '
  'every paper''s metadata (title/price/scheme) to every visitor, entitled '
  'or not -- this view carries no `questions` column, so there is no '
  'answer-key exposure. Do not "fix" this by switching to SECURITY INVOKER '
  'without also changing how the catalog is browsed; doing so would make '
  'un-entitled visitors see an empty catalog again.';

NOTIFY pgrst, 'reload schema';
