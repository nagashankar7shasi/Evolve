-- ============================================================================
--  Phase 6 — close the real PDF vault paywall bypass.
--
--  THE PROBLEM
--  ------------
--  pdf_vault.url (the exact Supabase Storage path for every PDF) is readable
--  by anyone via pdf_vault's own open SELECT policy -- correct, by design,
--  since the catalog needs to be publicly browsable. But storage.objects'
--  own policies for the 'pdf_vault_files' bucket (set up in
--  fix_pdf_vault_private_bucket.sql) checked only `bucket_id =
--  'pdf_vault_files'` for SELECT/INSERT/UPDATE/DELETE -- no entitlement
--  check anywhere. Together, this meant anyone with the anon key could read
--  a paid PDF's url column and then download the file directly from the
--  Storage API, with zero need to ever go through downloadOrOpenPdf()'s
--  client-side paywall check (isPdfUnlockedForUser) or request a signed
--  URL. The "private bucket + signed URL" protection described in
--  fix_pdf_vault_private_bucket.sql's own comments was decorative: it only
--  stopped someone from *guessing* a path, not from reading the one
--  pdf_vault already handed them.
--
--  (At the time of this migration, both PDFs in the vault are free --
--  so this closes the gap before it's ever exploited against a paid one,
--  rather than in response to an actual loss.)
--
--  THE FIX
--  -------
--  phase6a_student_can_access_pdf_function:
--    student_can_access_pdf(p_pdf_id) -- a SECURITY DEFINER function
--    mirroring student_can_access_paper()'s structure, substituting the
--    PDF-specific checks the client's isPdfUnlockedForUser()/
--    activeBundlesFor()/bundleCoversPdf() actually use:
--      - admin -> true
--      - pdf not found -> false
--      - access = 'free' or price = 0 -> true (open before any login check,
--        matching the client's own check order)
--      - anonymous / not-yet-migrated student -> false
--      - student not found -> false
--      - student.status not empty/'active' (isStudentBlocked) -> false
--      - student.allowed_pdfs contains the id (direct grant) -> true
--      - any held, non-expired bundle/pass where all_access OR
--        bd.pdfs contains the id (bundleCoversPdf -- no category-matching
--        branch for PDFs, unlike papers) -> true
--      - otherwise -> false
--
--  phase6b_lock_pdf_vault_storage_to_entitlement:
--    Replaces storage.objects' 4 open policies for the 'pdf_vault_files'
--    bucket:
--      - SELECT is now gated through student_can_access_pdf(), mapping the
--        object's storage name back to its pdf_vault row via the
--        'storage:pdf_vault_files:<path>' URL convention securePdfDoc() /
--        the PDF Publishing Wizard already write when they upload.
--      - INSERT/UPDATE/DELETE are tightened to is_admin()-only. Confirmed
--        safe by auditing every call site: all 3 .upload() calls in the
--        codebase live in admin-only UI (07_pdf_vault.js,
--        07a_pdf_publishing_wizard.js -- addPdfToVault, the wizard's upload
--        handler, securePdfDoc's one-time migration helper). deletePdfDoc()
--        only ever deletes the pdf_vault *row*; it never calls
--        storage.remove(), by that function's own comment ("delete it by
--        hand in the dashboard if you want it fully gone") -- so no code
--        path, admin or otherwise, currently needs DELETE on this bucket.
--        Kept admin-gated (rather than dropped) so an admin COULD clean up
--        orphaned storage objects by hand later without a further
--        migration. (In testing, direct SQL DELETE on storage.objects is
--        separately blocked for every role, admin included, by Supabase's
--        own "Direct deletion from storage tables is not allowed. Use the
--        Storage API instead." trigger -- this policy only matters for
--        whatever path the real Storage API uses internally.)
--
--  Legacy PDFs with a plain public https:// URL (pre-dating the private
--  bucket) are untouched by this fix -- they were never protected by
--  Storage policy to begin with; their only protection is the obscurity of
--  the URL itself, same as before this migration.
--
--  VERIFICATION
--  ------------
--  Both migrations were verified live via BEGIN...ROLLBACK tests against
--  temporary pdf_vault/bundles/students rows (never committed):
--
--  student_can_access_pdf() directly -- 10 scenarios, all passed:
--    anon+free->true, anon+paid->false, nonexistent-pdf->false,
--    no-entitlement+paid->false, direct-grant+paid->true,
--    all-access-bundle+paid->true, expired-bundle+paid->false,
--    active-bundle+paid->true, blocked-status-with-direct-grant+paid->false,
--    admin+paid->true.
--
--  storage.objects' new policies directly (via SET LOCAL ROLE
--  anon/authenticated + SET LOCAL request.jwt.claims, same pattern used for
--  every RLS fix in phase4/phase5):
--    SELECT on a paid object's path: anon->0 rows, unentitled student->0
--      rows, entitled student->1 row, admin->1 row.
--    INSERT: anon->blocked by RLS, non-admin student->blocked by RLS,
--      admin->allowed.
--
--  One incidental discovery during testing, documented here rather than
--  acted on (it already existed, unrelated to this fix): raw INSERT/UPDATE
--  on public.students silently strips entitlement columns (allowed_pdfs,
--  allowed_exams, passes, pass_expiry, etc. all forced to NULL/OLD value)
--  for any non-admin caller, via trg_protect_student_entitlements /
--  protect_student_entitlement_columns() -- a guard from an earlier phase
--  that isn't mentioned in this file's predecessors but is working exactly
--  as intended and caused the first draft of this migration's own test
--  rows to come back with allowed_pdfs = NULL until the test inserts were
--  done under an admin JWT claim.
-- ============================================================================

-- (Both migrations in this file were already applied live via
--  mcp__Supabase__apply_migration under the names
--  phase6a_student_can_access_pdf_function and
--  phase6b_lock_pdf_vault_storage_to_entitlement. Reproduced below verbatim
--  for the repo's own record, same convention as every phaseN file before
--  it.)

CREATE OR REPLACE FUNCTION public.student_can_access_pdf(p_pdf_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc     public.pdf_vault%ROWTYPE;
  v_email   text;
  v_student public.students%ROWTYPE;
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT * INTO v_doc FROM public.pdf_vault WHERE id = p_pdf_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_doc.access = 'free' OR COALESCE(v_doc.price, 0) = 0 THEN
    RETURN true;
  END IF;

  v_email := public.current_student_email();
  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_student FROM public.students WHERE lower(trim(email)) = v_email;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_student.status IS NOT NULL AND v_student.status <> '' AND v_student.status <> 'active' THEN
    RETURN false;
  END IF;

  IF COALESCE(to_jsonb(v_student.allowed_pdfs), '[]'::jsonb) ? p_pdf_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(to_jsonb(v_student.passes), '[]'::jsonb)) AS pass_id
    JOIN public.bundles bd ON bd.id = pass_id
    WHERE NOT (
      (COALESCE(to_jsonb(v_student.pass_expiry), '{}'::jsonb) ->> pass_id) IS NOT NULL
      AND (COALESCE(to_jsonb(v_student.pass_expiry), '{}'::jsonb) ->> pass_id) <> ''
      AND (COALESCE(to_jsonb(v_student.pass_expiry), '{}'::jsonb) ->> pass_id)::timestamptz < now()
    )
    AND (
      bd.all_access
      OR COALESCE(to_jsonb(bd.pdfs), '[]'::jsonb) ? p_pdf_id
    )
  );
END;
$$;

DROP POLICY IF EXISTS "pdf_vault_files select" ON storage.objects;
DROP POLICY IF EXISTS "pdf_vault_files insert" ON storage.objects;
DROP POLICY IF EXISTS "pdf_vault_files update" ON storage.objects;
DROP POLICY IF EXISTS "pdf_vault_files delete" ON storage.objects;

CREATE POLICY "pdf_vault_files select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'pdf_vault_files'
    AND EXISTS (
      SELECT 1 FROM public.pdf_vault pv
      WHERE pv.url = 'storage:pdf_vault_files:' || storage.objects.name
        AND public.student_can_access_pdf(pv.id)
    )
  );

CREATE POLICY "pdf_vault_files insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'pdf_vault_files' AND public.is_admin());

CREATE POLICY "pdf_vault_files update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'pdf_vault_files' AND public.is_admin())
  WITH CHECK (bucket_id = 'pdf_vault_files' AND public.is_admin());

CREATE POLICY "pdf_vault_files delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'pdf_vault_files' AND public.is_admin());


-- ============================================================================
--  STILL OPEN (new finding, discovered while fixing pdf_vault specifically,
--  not fixed here -- flagged for a decision before touching it):
--
--  storage.objects has a second bucket, 'study_materials', whose SELECT/
--  INSERT/UPDATE/DELETE policies have the exact same shape the pdf_vault
--  bucket had before this migration -- open on bucket_id alone, no
--  entitlement or admin check.
--
--  Checked this one rather than leaving it unknown: it holds question
--  images for the test-paper editor (06a_test_paper_studio.js), rendered
--  as plain <img src> tags and deliberately public by the app's own design
--  (07_pdf_vault.js's comments say so explicitly -- it "stays public
--  because question images render as plain <img src> tags and can't easily
--  use short-lived signed URLs"). So the open SELECT policy here is NOT a
--  paywall bug like pdf_vault's was -- nothing paid is gated behind it.
--
--  What IS still open and NOT by design: INSERT/UPDATE/DELETE on this
--  bucket have no admin check either, so anyone with the anon key can
--  currently upload, overwrite, or delete files in study_materials
--  directly -- a storage-abuse / defacement / quota-exhaustion vector
--  (hosting arbitrary files on the app's own bucket), separate from and
--  smaller than the paywall-bypass class of bug this file fixes. Left
--  alone for now, pending a decision on priority.
-- ============================================================================
