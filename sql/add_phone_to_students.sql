-- Adds a `phone` column to students and threads it through student_upsert_credentials.
-- phone is nullable at the DB level (existing rows have none, and admin-pre-created
-- rows may never get one); the app enforces "required, 10-digit Indian mobile" at
-- signup time in JS (js/12a_email.js handleSignup).
--
-- The anti-takeover security check in student_upsert_credentials (hardened across
-- phase3b/phase4/phase8 — see that history before touching this function again) is
-- preserved EXACTLY as-is. Only a new p_phone param (appended last, with a default,
-- so existing 5-arg callers keep working) and its COALESCE-on-update / direct-on-insert
-- handling were added.
--
-- NOTE: in Postgres, CREATE OR REPLACE FUNCTION with a different parameter LIST creates
-- a separate overload rather than replacing the original — it does not behave like
-- CREATE OR REPLACE VIEW. After this migration the live DB has BOTH the original 5-arg
-- student_upsert_credentials(text,text,text,text,boolean) AND this new 6-arg one. The
-- old 5-arg overload is harmless (identical security check, just no phone handling) but
-- is dead code once every caller passes p_phone — a follow-up
-- `DROP FUNCTION public.student_upsert_credentials(text, text, text, text, boolean);`
-- would need an admin to confirm the destructive op (this session couldn't push it
-- through non-interactively).

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.student_upsert_credentials(p_email text, p_password_hash text, p_password_salt text, p_name text DEFAULT NULL::text, p_migrated boolean DEFAULT false, p_phone text DEFAULT NULL::text)
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
      phone                  = COALESCE(p_phone, phone),
      password_hash          = p_password_hash,
      password_salt          = p_password_salt,
      supabase_auth_migrated = p_migrated OR COALESCE(supabase_auth_migrated, false)
    WHERE lower(trim(email)) = lower(trim(p_email))
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.students (email, name, utr, password_hash, password_salt, supabase_auth_migrated, phone)
    VALUES (lower(trim(p_email)), COALESCE(p_name, ''), 'SELF_SIGNUP', p_password_hash, p_password_salt, p_migrated, p_phone)
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$function$;
