-- ============================================================================
--  Evolve+ — Phase 3b: close the two gaps Phase 3 deliberately left open
--  (see the "WHY THIS IS DELIBERATELY NOT ENFORCED YET" note at the bottom of
--  phase3_student_identity.sql). MUST ship together with the matching app
--  code update (same index.html this file was delivered alongside).
--
--  WHAT THIS FILE DOES:
--
--   1. Adds `supabase_auth_migrated` to `students` — a real, persisted flag
--      (Phase 3 only ever tracked this in the browser, which meant it reset
--      on a new device and couldn't be trusted by anything server-side).
--
--   2. Adds two narrow SECURITY DEFINER RPCs, `student_login_precheck()` and
--      `student_upsert_credentials()`. Once `students` SELECT is scoped
--      below, an anonymous visitor can no longer read a row to check "does
--      this account exist / is it blocked / has it activated the real
--      login" or to safely add credentials to it without clobbering
--      anything — these two functions are the ONLY things that still need
--      to see across rows before a session exists, and each does exactly
--      one narrow, safe thing (see their own comments below).
--
--   3. Flips `tests_catalog_read` to require student_can_access_paper(id) —
--      closes the answer-key gap: a direct query for a paper nobody has
--      paid for no longer returns its `questions` column.
--
--   4. Scopes `students` / `attempts` / `payment_orders` / `student_progress`
--      SELECT to "your own row, or admin" — closes the "anyone can read
--      every student/attempt/payment row" gap.
--
--  BEFORE YOU RUN THIS: both phase2_rls_lockdown.sql and
--  phase3_student_identity.sql must already be applied.
--
--  WHY IT'S SAFE TO DO THIS NOW (deferred from Phase 3 on purpose): Phase 3
--  was written when your only students were on the legacy system — flipping
--  these policies then would have locked every one of them out of content
--  they'd already paid for, and broken legacy login outright (it worked by
--  reading a password hash out of `students` before anyone had proven who
--  they were — impossible once SELECT is "your own row only"). As of this
--  migration, index.html no longer has a legacy password path at all — every
--  password login goes through real Supabase Auth, and an account that
--  hasn't activated it yet is routed through a one-time OTP-verified reset
--  instead (see handlePasswordLogin in index.html). You confirmed you only
--  have test students today, so there's no one left to lock out — this is
--  the safest possible moment to close both gaps for good.
--
--  HOW TO RUN THIS:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file →
--   Run. Safe to run more than once (every statement is idempotent).
-- ============================================================================


-- ----------------------------------------------------------------------------
--  1. supabase_auth_migrated — persisted version of what index.html used to
--     track only as student.supabaseAuthMigrated in the browser/localStorage.
--     Defaults false so every existing row (all still-legacy test students
--     today) is correctly "not yet migrated" until their next login.
-- ----------------------------------------------------------------------------

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS supabase_auth_migrated boolean DEFAULT false;

UPDATE public.students SET supabase_auth_migrated = false WHERE supabase_auth_migrated IS NULL;


-- ----------------------------------------------------------------------------
--  2a. student_login_precheck(email) — read-only, and deliberately returns
--      only three booleans, NEVER the row itself (no name, no password hash,
--      no access list) — just enough for the client to route a login/reset/
--      signup attempt correctly without needing SELECT on the table.
--      SECURITY DEFINER so it can see the row regardless of the caller's own
--      (now scoped) SELECT policy, same reasoning as student_can_access_paper()
--      in phase3_student_identity.sql.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_login_precheck(p_email text)
RETURNS TABLE(row_exists boolean, blocked boolean, migrated boolean, has_password boolean) AS $$
DECLARE
  v_student public.students%ROWTYPE;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE lower(trim(email)) = lower(trim(p_email));
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, false;
    RETURN;
  END IF;
  RETURN QUERY SELECT
    true,
    (v_student.status IS NOT NULL AND v_student.status <> '' AND v_student.status <> 'active'),
    COALESCE(v_student.supabase_auth_migrated, false),
    (v_student.password_hash IS NOT NULL AND v_student.password_hash <> '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.student_login_precheck(text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  2b. student_upsert_credentials(...) — the ONLY write an anonymous or
--      just-OTP-verified request is allowed to make to `students`. Touches
--      name/password/migration-flag alone: an entitlement column (status,
--      allowed_exams/pages/pdfs/planners, passes, pass_expiry) is never even
--      read here, let alone written, so there is nothing in this function
--      for a client-controlled payload to clobber, regardless of whether it
--      lands on a brand-new row or an existing (possibly admin-pre-created,
--      possibly already-entitled) one — that decision is made atomically
--      inside this one function instead of a separate client-side
--      read-then-decide-then-write, which is exactly what a scoped SELECT
--      policy makes impossible to do safely from the client at all.
--
--      p_name: NULL means "don't touch the name" (used by password-reset,
--      which must never overwrite an existing student's name).
--      p_migrated: OR'd into the existing flag, never downgraded — an
--      already-migrated account stays migrated even if a later call (e.g. a
--      second syncSupabaseAuthAccount attempt that fails because the
--      account already exists) passes false.
--
--      SECURITY DEFINER purely so it can SELECT the existing row to decide
--      INSERT vs UPDATE — the INSERT/UPDATE policies on `students` stay wide
--      open (unchanged from Phase 2), protected by the
--      protect_student_entitlement_columns trigger exactly as before; this
--      function's own definer privilege is not what makes the write safe,
--      the trigger is, and it still fires and still reads the true caller's
--      identity via is_admin()/auth.jwt() regardless of this function's
--      SECURITY DEFINER context.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_upsert_credentials(
  p_email text,
  p_password_hash text,
  p_password_salt text,
  p_name text DEFAULT NULL,
  p_migrated boolean DEFAULT false
)
RETURNS public.students AS $$
DECLARE
  v_exists boolean;
  v_row public.students%ROWTYPE;
BEGIN
  SELECT true INTO v_exists FROM public.students WHERE lower(trim(email)) = lower(trim(p_email));

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.student_upsert_credentials(text, text, text, text, boolean) TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  3. tests_catalog_read — the answer-key gap. A paper's `questions` column
--     (full text, options AND correct answers) is now only readable by the
--     admin or someone who actually has access to that paper, exactly the
--     same rule the UI already enforces client-side. Catalog browsing
--     (title/price/paywall cards for EVERY paper, entitled or not) keeps
--     working unchanged via tests_catalog_public, which index.html's
--     fetchCloudContent() already switched to.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "tests_catalog_read" ON public.tests_catalog;
CREATE POLICY "tests_catalog_read" ON public.tests_catalog
  FOR SELECT USING (public.student_can_access_paper(id));


-- ----------------------------------------------------------------------------
--  4. students / attempts / payment_orders / student_progress — scoped to
--     "your own row, or admin". Each table's own email column is used
--     (students.email, attempts.user_email, payment_orders.email,
--     student_progress.email) since they aren't all named the same.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "students_read" ON public.students;
CREATE POLICY "students_read" ON public.students
  FOR SELECT USING (public.is_admin() OR lower(trim(email)) = public.current_student_email());

DROP POLICY IF EXISTS "attempts_read" ON public.attempts;
CREATE POLICY "attempts_read" ON public.attempts
  FOR SELECT USING (public.is_admin() OR lower(trim(user_email)) = public.current_student_email());

DROP POLICY IF EXISTS "payment_orders_read" ON public.payment_orders;
CREATE POLICY "payment_orders_read" ON public.payment_orders
  FOR SELECT USING (public.is_admin() OR lower(trim(email)) = public.current_student_email());

DROP POLICY IF EXISTS "student_progress_read" ON public.student_progress;
CREATE POLICY "student_progress_read" ON public.student_progress
  FOR SELECT USING (public.is_admin() OR lower(trim(email)) = public.current_student_email());


-- ============================================================================
--  A NICE SIDE EFFECT, CONFIRMED BY TESTING (not something this file adds on
--  purpose, just worth knowing): Postgres RLS applies the SELECT policy's
--  USING clause to find the row(s) an UPDATE/DELETE would touch, on top of
--  that statement's own USING/WITH CHECK. `students_update` itself is still
--  wide open (`USING (true) WITH CHECK (true)`, unchanged from Phase 2, kept
--  that way for the admin's own entitlement writes) — but now that
--  `students_read` is scoped, an anonymous UPDATE against another student's
--  row (or an INSERT ... ON CONFLICT DO UPDATE, which Postgres always
--  permission-checks the UPDATE branch for even when no conflict actually
--  occurs) can no longer find or touch a row it can't first SELECT. That's
--  on top of, not instead of, the entitlement-protecting trigger — belt and
--  suspenders. It's also exactly why student_upsert_credentials() above is a
--  SECURITY DEFINER function with its own explicit INSERT/UPDATE branches
--  rather than a client-side upsert: a client-side upsert from an anonymous
--  request would now silently affect zero rows against an existing account.
-- ============================================================================


-- ============================================================================
--  VERIFY: should return zero rows (no policy still says "everyone").
-- ============================================================================
-- select schemaname, tablename, policyname, qual
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('tests_catalog', 'students', 'attempts', 'payment_orders', 'student_progress')
--   and policyname like '%_read'
--   and qual = 'true';


-- ============================================================================
--  A KNOWN GAP THIS FILE DOES NOT FIX (flagging, not silently leaving out):
--  a student who has ALREADY activated the real Supabase Auth login and then
--  forgets that (new, post-migration) password has no way to reset it via
--  this app's OTP flow — syncSupabaseAuthAccount's signUp() call silently
--  fails for an email that's already registered, so handleSetPassword can
--  update the local `students` row's password_hash but can't actually change
--  the real Supabase Auth password. Their supabase_auth_migrated flag is
--  preserved correctly (never downgraded), so they aren't broken, just stuck
--  with their current password. Fixing this properly needs Supabase's own
--  password-recovery email flow (auth.resetPasswordForEmail + a recovery
--  landing page) or an Edge Function using the service role key — a bigger,
--  separate change, not part of this migration. With only test students
--  today this has zero current impact; worth doing before this matters for
--  a real student.
-- ============================================================================
