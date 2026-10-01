-- ============================================================================
--  Phase 4 — close gaps found by a live audit of the actual deployed database
--  (not just the SQL files). Phase 2/3/3b were correctly written, but this
--  audit found the database itself didn't match what they intended:
--
--  1. Every phase before this one added new, correctly-scoped policies but
--     never dropped the ORIGINAL wide-open policies that predated all of
--     them (names like "Allow public reads", "Public write tests",
--     "payment_orders all"). Postgres OR's multiple permissive policies on
--     the same table/command together, so each leftover silently defeated
--     the correctly-scoped policy sitting right next to it. Net effect in
--     production: password hashes, payment records, and answer keys were
--     all fully public, and pricing/bundles/app settings were all publicly
--     writable, despite the "fixed" policies existing right there in the
--     catalog.
--
--  2. students_update / students_insert were USING(true)/WITH CHECK(true)
--     by original design (the entitlement trigger strips entitlement
--     columns from a non-admin write, but never touched email/password_hash/
--     password_salt). That left two live vectors: directly overwriting
--     password_hash/salt via a raw PATCH, and — more seriously — renaming a
--     victim's `email` column to an attacker's own authenticated email,
--     which makes student_can_access_paper()/students_read treat the
--     attacker as that row's owner and hand over the victim's existing
--     passes/allowed_exams. Confirmed by auditing every
--     .from('students').upsert/update/insert call site in index.html: all
--     of them are admin-side only (pushStudentToCloud, revokeEntitlementItem,
--     the bundle force-delete flow, clearStudentPassword) or go through
--     student_upsert_credentials, a SECURITY DEFINER function that is NOT
--     subject to these table policies at all — so tightening both to
--     admin-only breaks nothing live.
--
--  3. student_upsert_credentials (the one legitimate anonymous write path
--     into `students`, used by signup and the first OTP-verified reset) had
--     no check at all preventing an anonymous caller who merely knows an
--     email from rewriting that account's credentials — including an
--     ALREADY-migrated account's. Every real post-migration caller in
--     index.html already holds a real session for that exact email by the
--     time it calls this RPC (the native-recovery branch in
--     handleSetPassword), so the fix only blocks callers who are neither
--     admin nor that student.
--
--  All three were verified against the live database (pg_policies, a
--  from-scratch read of every .from('students'/...) call site in index.html,
--  and a set of BEGIN...ROLLBACK tests simulating anon / cross-student /
--  self / admin callers against real rows) before being applied, and again
--  immediately after. Safe to run multiple times.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Drop every leftover wide-open policy. Each one dropped here is a pure
--    duplicate/superset of a narrower, correctly-named policy that already
--    exists on the same table and takes over immediately.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public read tests"  ON public.tests_catalog;
DROP POLICY IF EXISTS "Public write tests" ON public.tests_catalog;

DROP POLICY IF EXISTS "Allow public reads"      ON public.students;
DROP POLICY IF EXISTS "Allow public updates"    ON public.students;
DROP POLICY IF EXISTS "Allow public deletions"  ON public.students;
DROP POLICY IF EXISTS "Allow public inserts"    ON public.students;

DROP POLICY IF EXISTS "Allow public reads"   ON public.attempts;
DROP POLICY IF EXISTS "Allow public inserts" ON public.attempts;

DROP POLICY IF EXISTS "payment_orders all"   ON public.payment_orders;
DROP POLICY IF EXISTS "Allow public reads"   ON public.payment_orders;
DROP POLICY IF EXISTS "Allow public updates" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow public inserts" ON public.payment_orders;

DROP POLICY IF EXISTS "Allow public access to progress" ON public.student_progress;

DROP POLICY IF EXISTS "Public write bundles" ON public.bundles;
DROP POLICY IF EXISTS "Public read bundles"  ON public.bundles;

DROP POLICY IF EXISTS "app_settings all" ON public.app_settings;


-- ---------------------------------------------------------------------------
-- 2. Lock raw writes to `students` to admin-only.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "students_update" ON public.students;
CREATE POLICY "students_update" ON public.students FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "students_insert" ON public.students;
CREATE POLICY "students_insert" ON public.students FOR INSERT
  WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 3. Guard student_upsert_credentials against rewriting an already-migrated
--    account unless the caller actually is that student (or admin). COALESCE
--    is required: current_student_email() returns NULL for a true anonymous
--    caller, and `NOT (false OR NULL)` evaluates to NULL (not true) in
--    PL/pgSQL, so a naive version of this guard silently fails open for
--    exactly the caller it's meant to stop.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_upsert_credentials(
  p_email text, p_password_hash text, p_password_salt text,
  p_name text DEFAULT NULL, p_migrated boolean DEFAULT false
)
RETURNS public.students AS $$
DECLARE
  v_exists boolean;
  v_already_migrated boolean;
  v_row public.students%ROWTYPE;
BEGIN
  SELECT true, COALESCE(supabase_auth_migrated, false)
    INTO v_exists, v_already_migrated
  FROM public.students WHERE lower(trim(email)) = lower(trim(p_email));

  IF v_exists AND v_already_migrated
     AND NOT (public.is_admin() OR COALESCE(public.current_student_email(), '') = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'This account has already activated the new login. Please log in, or use "Forgot password?" instead.';
  END IF;

  IF v_exists THEN
    UPDATE public.students SET
      name                   = COALESCE(p_name, name),
      password_hash          = p_password_hash,
      password_salt          = p_password_salt,
      supabase_auth_migrated = p_migrated OR COALESCE(supabase_auth_migrated, false)
    WHERE lower(trim(email)) = lower(trim(p_email))
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.students (email, name, utr, password_hash, password_salt, supabase_auth_migrated)
    VALUES (lower(trim(p_email)), COALESCE(p_name, ''), 'SELF_SIGNUP', p_password_hash, p_password_salt, p_migrated)
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ---------------------------------------------------------------------------
-- 4. Pin a mutable search_path on the two identity primitives (standard
--    hardening against search_path hijacking; no behavior change).
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_student_email() SET search_path = public, pg_temp;


-- ============================================================================
--  STILL OPEN (deliberately not touched by this file — see the review notes
--  this came with for why):
--
--  1. student_progress_update / student_progress's own insert, and
--     attempts_insert, remain USING(true)/WITH CHECK(true). Some currently
--     active students may still be running on a stale local-only legacy
--     session with no real Supabase Auth JWT yet — tightening these to
--     "your own row" would break planner/practice-log sync for exactly
--     those students until they complete the one-time migration. Revisit
--     once `select count(*) from students where not supabase_auth_migrated`
--     reads zero (today: 6 of 8).
--
--  2. The PDF Vault's private bucket ('pdf_vault_files') storage.objects
--     policies are open on bucket_id alone, same anon-key trust model as
--     the rest of this app — the "signed URL" protection is really
--     "unguessable path", not a real access-control check. Low practical
--     risk if paths are random, not yet verified from the app code.
--
--  3. Leaked-password protection is off in Supabase Auth (dashboard-only
--     toggle, Authentication → Policies — not something SQL can flip).
-- ============================================================================
