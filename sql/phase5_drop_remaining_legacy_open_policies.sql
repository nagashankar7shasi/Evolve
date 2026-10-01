-- ============================================================================
--  Phase 5 — a full sweep across EVERY public table (not just the ones tied
--  to payments/students/papers that the Phase 4 pass covered) found 6 MORE
--  leftover wide-open policies predating any RLS lockdown:
--
--    custom_pages    "Public write pages"     (ALL, true)
--    email_log       "email_log all"          (ALL, true)
--    email_templates "email_templates all"    (ALL, true)
--    exam_categories "exam_categories all"     (ALL, true)
--    nav_menu        "Public write menu"       (ALL, true)
--    pdf_vault       "Public write pdfs"       (ALL, true)
--
--  Each one is a pure duplicate/superset of a correctly-scoped is_admin()
--  policy already sitting right next to it (custom_pages_admin_write,
--  email_templates_admin_write, exam_categories_admin_write,
--  nav_menu_admin_write, pdf_vault_admin_write — all written correctly back
--  in phase2/phase3, just never had their "ALL/true" predecessor dropped).
--
--  Concretely, before this: anyone with the anon key could rewrite the
--  site's custom pages, nav menu, exam category definitions, and PDF vault
--  entries (price / access level / storage path) directly — and, worst of
--  the six, rewrite email templates, which are sent to students using the
--  send-email Edge Function's trusted service-role key. email_log's "ALL"
--  stray also silently defeated its admin-only READ policy (email_log has
--  no admin WRITE policy at all BY DESIGN — see phase3's own comment: the
--  only legitimate inserter is the send-email Edge Function, which uses its
--  service-role key and bypasses RLS entirely regardless of policy).
--
--  Verified both before (anonymous raw UPDATE on email_templates — and
--  separately, on pdf_vault — ran with 0 permission errors) and after
--  (anonymous blocked with 0 rows affected; the real admin session's own
--  write still works) using BEGIN...ROLLBACK tests, same as Phase 4.
--
--  A full re-sweep after this file shows the only remaining wide-open
--  writes are the four genuinely intentional, already-documented ones:
--  feedback_log's public insert (anonymous feedback form, by design),
--  attempts_insert (practice-attempt logging), and student_progress's
--  insert/update (deferred — 6 of 8 students haven't completed the
--  one-time login migration yet; see phase4_close_live_rls_gaps.sql).
-- ============================================================================

DROP POLICY IF EXISTS "Public write pages" ON public.custom_pages;
DROP POLICY IF EXISTS "email_log all" ON public.email_log;
DROP POLICY IF EXISTS "email_templates all" ON public.email_templates;
DROP POLICY IF EXISTS "exam_categories all" ON public.exam_categories;
DROP POLICY IF EXISTS "Public write menu" ON public.nav_menu;
DROP POLICY IF EXISTS "Public write pdfs" ON public.pdf_vault;


-- ============================================================================
--  STILL OPEN — found while investigating pdf_vault specifically, bigger
--  than a policy drop, tracked separately:
--
--  pdf_vault.url (the exact private-bucket storage path for every PDF) is
--  readable by anyone via pdf_vault's own open SELECT policy (correct, by
--  design — the catalog needs to be publicly browsable). storage.objects'
--  SELECT policy for the 'pdf_vault_files' bucket is ALSO open on bucket_id
--  alone (see fix_pdf_vault_private_bucket.sql), with no entitlement check.
--  Together, these mean the "private bucket + signed URL" protection is
--  currently decorative: anyone who reads a PDF's url column already has
--  everything needed to download it directly via the Storage API, with no
--  need to go through downloadOrOpenPdf()'s client-side paywall check or
--  ever mint a signed URL at all. Closing this properly needs a
--  student_can_access_pdf(pdf_id) function (mirroring student_can_access_
--  paper's free/paid/bundle/allowedPdfs logic) and tightening storage.
--  objects' SELECT policy for this one bucket to check it — bigger, riskier
--  surgery than the drops in this file, so deliberately not done here.
-- ============================================================================
