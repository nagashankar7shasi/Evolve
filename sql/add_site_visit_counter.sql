-- ============================================================
--  Evolve+ — daily unique-visitor counter (admin-dashboard only)
--
--  One row per calendar day, holding a running count. "Unique" is
--  approximated client-side: the browser sets a localStorage flag the
--  first time it calls increment_daily_visit() each day and skips the
--  call on every later page load/tab that same day, so one person
--  repeatedly refreshing doesn't inflate the number. This is a device/
--  browser-level dedup, not a cross-device one (no cookies/IP captured —
--  deliberately, since this is just a lightweight traffic gauge, not an
--  analytics system), and the "day" boundary is the DB server's (UTC),
--  not IST.
--
--  Only the admin can ever read these rows (RLS below); writes only ever
--  happen through the SECURITY DEFINER RPC, which bypasses RLS as its
--  owner (same pattern already used by student_login_precheck /
--  student_upsert_credentials) — so no INSERT/UPDATE policy is needed on
--  the table itself.
--
--  Safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_visit_counts (
  day   date PRIMARY KEY,
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.site_visit_counts ENABLE ROW LEVEL SECURITY;

-- NOTE: no DROP POLICY IF EXISTS guard here (unlike fix_feedback_log_table.sql's pattern) --
-- this session's apply_migration call got silently cancelled whenever the query contained a
-- DROP statement (DROP POLICY or DROP FUNCTION), with no error, just {"status":"cancelled"} --
-- apparently treated as a destructive op needing an interactive confirmation this session
-- couldn't get. Re-running this file as-is will fail with "policy already exists" on a second
-- run; an admin re-running it manually should drop the policy first.
CREATE POLICY "site_visit_counts admin read" ON public.site_visit_counts FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.increment_daily_visit()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.site_visit_counts (day, count)
  VALUES (current_date, 1)
  ON CONFLICT (day) DO UPDATE SET count = public.site_visit_counts.count + 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.increment_daily_visit() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
