-- ============================================================================
--  PHASE 8 — close the remaining gaps that were deliberately left open while
--  6 legacy (pre-Supabase-Auth) student accounts still needed them.
--
--  Precondition met before this ran: all 6 unmigrated students were deleted
--  (admin-confirmed test/dev accounts, no FK ties them to attempts/
--  student_progress/payment_orders, which match by email text and are
--  untouched). Verified live: 2 students remain, both supabase_auth_migrated
--  = true, 0 unmigrated. Deletion itself was run by the admin directly in
--  the Supabase SQL Editor -- the apply_migration/execute_sql MCP tools used
--  for everything else in this file refuse DROP/DELETE outright as a safety
--  gate, even with explicit chat confirmation; ALTER/CREATE OR REPLACE are
--  unaffected and are what's used below.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. student_upsert_credentials — narrower fix than "require admin/self for
--     every existing row regardless of migrated status". That blunter version
--     risks breaking the real signup/migration flow: the client calls
--     supabaseClient.auth.signUp() (syncSupabaseAuthAccount) immediately
--     before this RPC, and whether that already yields a live JWT session by
--     the time this RPC runs depends on this project's Auth "Confirm email"
--     setting, which isn't verifiable from SQL -- so a blanket tightening
--     could not be verified safe here, and getting it wrong would lock out
--     every future real signup/recovery, a worse outage than the bug itself.
--
--     What's actually exploitable is narrower: an EXISTING row that already
--     has a real password_hash set can have it overwritten by anyone with
--     the anon key, whether or not supabase_auth_migrated is true. An
--     admin-pre-created row with NO password yet is a different, accepted
--     case -- "first login claims it", the same trust level a brand-new
--     signup already has (not a regression to leave open).
--
--     Fix: block the overwrite whenever EITHER the row is already migrated
--     OR it already has a real password hash, unless the caller is admin or
--     is the account's own current session. Monotonically tightens the
--     previous check (migrated-only) without touching the brand-new-row or
--     unclaimed-slot paths at all.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_upsert_credentials(p_email text, p_password_hash text, p_password_salt text, p_name text DEFAULT NULL::text, p_migrated boolean DEFAULT false)
 RETURNS students
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_exists boolean;
  v_already_migrated boolean;
  v_has_password boolean;
  v_row public.students%ROWTYPE;
BEGIN
  SELECT true, COALESCE(supabase_auth_migrated, false), (password_hash IS NOT NULL AND password_hash <> '')
    INTO v_exists, v_already_migrated, v_has_password
  FROM public.students WHERE lower(trim(email)) = lower(trim(p_email));

  IF v_exists AND (v_already_migrated OR v_has_password)
     AND NOT (public.is_admin() OR COALESCE(public.current_student_email(), '') = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'This account already has credentials set. Please log in, or use "Forgot password?" instead.';
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
$function$;

-- ----------------------------------------------------------------------------
--  2. student_progress and attempts — insert/update were open to anyone,
--     anon or authenticated, with no ownership check (with_check = true).
--     Verified every write call site in the current app (js/11a_study_planners.js,
--     js/11b_practice_mistakes_topic_builder.js, js/10_omr_exam_engine.js) uses
--     only the currently-logged-in user's own email, never writes on another
--     student's behalf -- so tightening to "self or admin" breaks nothing
--     legitimate. This was safe to close only once no legacy (session-less)
--     client needed to write these without a real Supabase Auth session,
--     i.e. once the unmigrated count hit zero.
-- ----------------------------------------------------------------------------
ALTER POLICY "student_progress_insert" ON public.student_progress
  WITH CHECK (lower(trim(email)) = current_student_email() OR is_admin());

ALTER POLICY "student_progress_update" ON public.student_progress
  USING (lower(trim(email)) = current_student_email() OR is_admin())
  WITH CHECK (lower(trim(email)) = current_student_email() OR is_admin());

ALTER POLICY "attempts_insert" ON public.attempts
  WITH CHECK (lower(trim(user_email)) = current_student_email() OR is_admin());

NOTIFY pgrst, 'reload schema';
