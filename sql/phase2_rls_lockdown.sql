-- ============================================================================
--  Evolve+ — Phase 2 security fix: lock down every table with Row Level
--  Security (RLS), so the public anon API key can no longer write (or, for
--  a couple of sensitive settings, even read) things it has no business
--  touching — approving your own payments, granting yourself free access,
--  editing exam papers/prices, rewriting the site's pricing/UPI details,
--  deleting other people's data, etc. Right now NONE of your tables have
--  RLS, which means the anon key (public, sitting in your page source) has
--  full read/write access to everything, full stop.
--
--  WHAT THIS DOES:
--   - Every table gets RLS enabled.
--   - Content that's meant to be public (the exam catalog, bundles, pages,
--     nav menu, pricing, announcements, etc.) stays publicly READABLE —
--     no change in what visitors can see.
--   - WRITES (insert/update/delete) to that content become admin-only,
--     checked against a REAL Supabase Auth session (auth.role() =
--     'authenticated') — the same login Phase 1 set up. Anyone using the
--     anon key alone can no longer create/edit/delete catalog items,
--     pricing, pages, menus, etc.
--   - Two tables that legitimately need a public WRITE (payment_orders,
--     for checkout; students/attempts/student_progress, for signup and
--     exam-taking) get a narrower policy: the specific write the app
--     actually needs (e.g. "insert a payment order, but only ever with
--     status = 'pending'") stays open, while admin-only actions (approving
--     a payment, granting entitlements, editing another student's access)
--     require the real admin session.
--   - The `students` table gets an extra trigger (not just a policy) that
--     silently strips out any attempt by a non-admin request to set or
--     change access-granting columns (allowed_exams, passes, status,
--     etc.) — even inside an otherwise-legitimate signup/password-reset
--     call — so a direct API call can't use that same code path to grant
--     itself free access. See the big comment above the trigger function.
--   - The old admin_auth row (the crackable password hash from before
--     Phase 1) is deleted outright, now that Phase 1b's cleanup means
--     nothing in the app reads it any more.
--
--  WHAT THIS DOES NOT DO (on purpose — see the note at the very bottom):
--   Anyone can still READ every row of `students`, `attempts`, and
--   `payment_orders` — every student's email, name, UTR, exam answers,
--   scores, and (yes) password hash. That's because the app currently
--   depends on pulling all of it into the browser at boot and filtering
--   client-side to "my own records" — there's no way for the database to
--   tell "the real Priya" apart from "anyone claiming to be Priya" without
--   students having their own verified login, which the app doesn't have
--   yet (this is exactly the same problem Phase 1 solved for the admin
--   account, just not yet done for students). Locking SELECT down now,
--   before that exists, would break login, the student dashboard, "my
--   attempts", and entitlement checks outright. This is intentionally
--   deferred — ask for "Phase 3" when you're ready to tackle it.
--
--  THIS SUPERSEDES two earlier files you may have already run: fix_rls_everywhere.sql and
--  fix_app_settings_exam_categories.sql both gave several tables fully OPEN policies (anyone can
--  read/write anything) as a quick fix for "row level security" errors you were hitting before this
--  security effort started. This migration explicitly removes those old open policies by name (see
--  the "CLEAN SLATE" section right below) before creating the real ones — you don't need to run
--  anything from those two files again, and can ignore them going forward.
--
--  HOW TO RUN THIS:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file →
--   Run. Safe to run more than once (every statement is idempotent).
--
--  BEFORE YOU RUN THIS: confirm your Supabase Auth admin login (from
--  Phase 1) actually works — log out of the admin panel, log back in with
--  your Supabase Auth email/password, confirm you land in the console. If
--  that doesn't work yet, STOP and fix that first: this migration makes
--  every admin write in the app require that real session, so if it isn't
--  working, every "Approve", "Save", "Delete", etc. button in the admin
--  panel will start failing with a permission error the moment this runs.
--
--  IF SOMETHING BREAKS: you can turn RLS back off for just the one table
--  that's causing trouble, without touching anything else, e.g.:
--    ALTER TABLE public.bundles DISABLE ROW LEVEL SECURITY;
--  That instantly reverts that table to fully open (today's behavior) so
--  you're not stuck, while you tell me what broke so I can fix the policy.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  CLEAN SLATE: two earlier migrations (fix_rls_everywhere.sql and
--  fix_app_settings_exam_categories.sql) already gave several tables fully
--  OPEN policies — named "<table> read" / "<table> insert" / "<table>
--  update" / "<table> delete" (with a space, not the underscore names this
--  file uses). If those are still in place, they'd sit ALONGSIDE the
--  restrictive policies below rather than being replaced by them — RLS
--  policies are additive (OR'd together), so a leftover "USING (true)"
--  policy would silently keep every one of these tables wide open no
--  matter what this migration creates. This section removes exactly
--  those old policies by their exact old names before anything else runs,
--  so the policies created below are the only ones left standing. Safe to
--  run even if those old policies were never created (DROP ... IF EXISTS).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  op text;
  legacy_tables text[] := ARRAY[
    'app_settings', 'exam_categories', 'custom_pages', 'attempts', 'students',
    'student_progress', 'tests_catalog', 'bundles', 'nav_menu', 'pdf_vault',
    'payment_orders', 'email_templates', 'home_config'
  ];
BEGIN
  FOREACH t IN ARRAY legacy_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      FOREACH op IN ARRAY ARRAY['read', 'insert', 'update', 'delete'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' ' || op, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
--  STUDENTS — public self-service signup/password-reset writes stay open,
--  but a trigger strips out any attempt to touch access-granting columns
--  from a non-admin request, regardless of what the client sends.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_student_entitlement_columns()
RETURNS trigger AS $$
BEGIN
  -- The admin (the only real Supabase Auth user this project has) may write anything — this is
  -- exactly what grantOrder / revokeEntitlementItem / saveStudentEntitlements / the bundle & refund
  -- flows in the app already do, and they should keep working unchanged.
  IF auth.role() = 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Everything else is an anonymous request — the app's own public signup (completeSignup) and
  -- password-reset (handleSetPassword) flows, which both go through pushStudentToCloud() and upsert
  -- the student's FULL local record, access columns included, even though they never intend to
  -- change access. Without this trigger, a direct API call using that same shape (any anon key can
  -- do this — it doesn't need to go through the app's UI at all) could set allowed_exams/passes/
  -- status to anything, for any email, and grant itself (or take away someone else's) paid access.
  --
  -- NULL is used instead of a typed "empty" literal (e.g. '[]'::jsonb or '{}'::text[]) because this
  -- migration doesn't assume which type these columns actually are — the app's own read path
  -- already treats null/non-array as "no access" for every one of these
  -- (fetchCloudStudents: `Array.isArray(s.allowed_exams) ? s.allowed_exams : []`, and
  -- `passExpiry: s.pass_expiry || {}`), so this is safe regardless of the underlying column type and
  -- needs no app code changes.
  IF TG_OP = 'INSERT' THEN
    NEW.status            := 'active';  -- a brand-new self-signup account is enabled, just with no access yet
    NEW.allowed_exams     := NULL;
    NEW.allowed_pages     := NULL;
    NEW.allowed_pdfs      := NULL;
    NEW.allowed_planners  := NULL;
    NEW.passes            := NULL;
    NEW.pass_expiry       := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Silently keep whatever access the row already had — an anonymous request can still change its
    -- own name/password (that's the point of the signup/reset flows), just never what it can access.
    NEW.status            := OLD.status;
    NEW.allowed_exams     := OLD.allowed_exams;
    NEW.allowed_pages     := OLD.allowed_pages;
    NEW.allowed_pdfs      := OLD.allowed_pdfs;
    NEW.allowed_planners  := OLD.allowed_planners;
    NEW.passes            := OLD.passes;
    NEW.pass_expiry       := OLD.pass_expiry;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_student_entitlements ON public.students;
CREATE TRIGGER trg_protect_student_entitlements
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.protect_student_entitlement_columns();

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_read" ON public.students;
CREATE POLICY "students_read" ON public.students
  FOR SELECT USING (true);
  -- Deliberately still open to everyone, incl. password_hash/password_salt — see the note at the
  -- bottom of this file. Closing this needs students to have their own verified login (Phase 3).

DROP POLICY IF EXISTS "students_insert" ON public.students;
CREATE POLICY "students_insert" ON public.students
  FOR INSERT WITH CHECK (true);
  -- Needed for public signup. The trigger above is what actually keeps this safe.

DROP POLICY IF EXISTS "students_update" ON public.students;
CREATE POLICY "students_update" ON public.students
  FOR UPDATE USING (true) WITH CHECK (true);
  -- Needed for public password-reset and the admin's own entitlement writes. The trigger is what
  -- actually keeps this safe for the anonymous case; admin writes pass through untouched.

DROP POLICY IF EXISTS "students_admin_delete" ON public.students;
CREATE POLICY "students_admin_delete" ON public.students
  FOR DELETE USING (auth.role() = 'authenticated');


-- ----------------------------------------------------------------------------
--  ATTEMPTS — students can record their own exam results (no way to scope
--  "own" without student identity, see note at bottom), but can no longer
--  tamper with or delete any attempt record once written.
-- ----------------------------------------------------------------------------

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts_read" ON public.attempts;
CREATE POLICY "attempts_read" ON public.attempts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "attempts_insert" ON public.attempts;
CREATE POLICY "attempts_insert" ON public.attempts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "attempts_admin_update" ON public.attempts;
CREATE POLICY "attempts_admin_update" ON public.attempts
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "attempts_admin_delete" ON public.attempts;
CREATE POLICY "attempts_admin_delete" ON public.attempts
  FOR DELETE USING (auth.role() = 'authenticated');


-- ----------------------------------------------------------------------------
--  STUDENT_PROGRESS — planner/practice-log self-service stays open (same
--  "no identity to scope by yet" reasoning); only deletion is admin-only.
-- ----------------------------------------------------------------------------

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_progress_read" ON public.student_progress;
CREATE POLICY "student_progress_read" ON public.student_progress
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "student_progress_insert" ON public.student_progress;
CREATE POLICY "student_progress_insert" ON public.student_progress
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "student_progress_update" ON public.student_progress;
CREATE POLICY "student_progress_update" ON public.student_progress
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "student_progress_admin_delete" ON public.student_progress;
CREATE POLICY "student_progress_admin_delete" ON public.student_progress
  FOR DELETE USING (auth.role() = 'authenticated');


-- ----------------------------------------------------------------------------
--  PAYMENT_ORDERS — checkout can create a new order, but ONLY as 'pending'
--  (the app already only ever sends 'pending' here; this makes the
--  database enforce it too, so a direct API call can't insert a
--  pre-approved order). Approving/rejecting/refunding stays admin-only.
-- ----------------------------------------------------------------------------

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_orders_read" ON public.payment_orders;
CREATE POLICY "payment_orders_read" ON public.payment_orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "payment_orders_insert" ON public.payment_orders;
CREATE POLICY "payment_orders_insert" ON public.payment_orders
  FOR INSERT WITH CHECK (status = 'pending' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "payment_orders_admin_update" ON public.payment_orders;
CREATE POLICY "payment_orders_admin_update" ON public.payment_orders
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "payment_orders_admin_delete" ON public.payment_orders;
CREATE POLICY "payment_orders_admin_delete" ON public.payment_orders
  FOR DELETE USING (auth.role() = 'authenticated');


-- ----------------------------------------------------------------------------
--  PUBLIC CONTENT TABLES — read stays open to everyone (no change from
--  today); every write now requires the real admin session. This is the
--  single biggest win in this migration: right now, ANY of these can be
--  rewritten directly via the anon key by anyone who knows the table name
--  and column shape — exam papers, answer keys, prices, the entire nav
--  menu, every page's content, every PDF's access level, etc.
-- ----------------------------------------------------------------------------

ALTER TABLE public.exam_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_categories_read" ON public.exam_categories;
CREATE POLICY "exam_categories_read" ON public.exam_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "exam_categories_admin_write" ON public.exam_categories;
CREATE POLICY "exam_categories_admin_write" ON public.exam_categories FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_pages_read" ON public.custom_pages;
CREATE POLICY "custom_pages_read" ON public.custom_pages FOR SELECT USING (true);
DROP POLICY IF EXISTS "custom_pages_admin_write" ON public.custom_pages;
CREATE POLICY "custom_pages_admin_write" ON public.custom_pages FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.tests_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tests_catalog_read" ON public.tests_catalog;
CREATE POLICY "tests_catalog_read" ON public.tests_catalog FOR SELECT USING (true);
  -- Still includes `questions` (the answer key) for anyone who queries a specific paper by id — this
  -- is the same deliberate, already-documented gap the app's own code comments flag near
  -- ensurePaperQuestionsLoaded(). Closing it needs entitlement checks the database can verify, which
  -- needs student identity (Phase 3). This migration's win here is stopping WRITES: nobody can
  -- rewrite a paper's questions, price, or active flag without the real admin session any more.
DROP POLICY IF EXISTS "tests_catalog_admin_write" ON public.tests_catalog;
CREATE POLICY "tests_catalog_admin_write" ON public.tests_catalog FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bundles_read" ON public.bundles;
CREATE POLICY "bundles_read" ON public.bundles FOR SELECT USING (true);
DROP POLICY IF EXISTS "bundles_admin_write" ON public.bundles;
CREATE POLICY "bundles_admin_write" ON public.bundles FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.nav_menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nav_menu_read" ON public.nav_menu;
CREATE POLICY "nav_menu_read" ON public.nav_menu FOR SELECT USING (true);
DROP POLICY IF EXISTS "nav_menu_admin_write" ON public.nav_menu;
CREATE POLICY "nav_menu_admin_write" ON public.nav_menu FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.pdf_vault ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pdf_vault_read" ON public.pdf_vault;
CREATE POLICY "pdf_vault_read" ON public.pdf_vault FOR SELECT USING (true);
DROP POLICY IF EXISTS "pdf_vault_admin_write" ON public.pdf_vault;
CREATE POLICY "pdf_vault_admin_write" ON public.pdf_vault FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_templates_read" ON public.email_templates;
CREATE POLICY "email_templates_read" ON public.email_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "email_templates_admin_write" ON public.email_templates;
CREATE POLICY "email_templates_admin_write" ON public.email_templates FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- home_config: also replaces the wide-open USING(true)/WITH CHECK(true) policy that the app's own
-- error-recovery message used to suggest pasting in if this table was ever missing (fixed in the
-- app in this same update — see the comment near saveHomeConfig's alert()). If you ever ran that
-- old snippet, these statements replace those policies with the real admin-gated ones.
ALTER TABLE public.home_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "home_config read" ON public.home_config;     -- old wide-open policy, if present
DROP POLICY IF EXISTS "home_config insert" ON public.home_config;   -- old wide-open policy, if present
DROP POLICY IF EXISTS "home_config update" ON public.home_config;   -- old wide-open policy, if present
DROP POLICY IF EXISTS "home_config delete" ON public.home_config;   -- old wide-open policy, if present
DROP POLICY IF EXISTS "home_config_read" ON public.home_config;
CREATE POLICY "home_config_read" ON public.home_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "home_config_admin_write" ON public.home_config;
CREATE POLICY "home_config_admin_write" ON public.home_config FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- ----------------------------------------------------------------------------
--  APP_SETTINGS — generic key/value table. Most keys (pricing_master,
--  site_branding, planners, feature_access, auth_settings, announcements)
--  are read publicly at boot, same as before; all writes are admin-only.
--  The one exception is 'admin_auth', which is now blocked from ANY read
--  (not just writes) — and deleted outright below, since Phase 1b retired
--  the code that ever used it.
-- ----------------------------------------------------------------------------

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read" ON public.app_settings
  FOR SELECT USING (key <> 'admin_auth');

DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write" ON public.app_settings FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Retired by Phase 1b — nothing in the app reads or writes this row any more. Deleting it removes
-- the crackable password hash it held rather than just hiding it.
DELETE FROM public.app_settings WHERE key = 'admin_auth';


-- ----------------------------------------------------------------------------
--  EMAIL_LOG — admin-only read. No write policy at all: the only inserter
--  is the send-email Edge Function, which uses its service-role key and
--  bypasses RLS entirely (service_role always does, by design) — it needs
--  no policy here to keep working.
-- ----------------------------------------------------------------------------

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_log_admin_read" ON public.email_log;
CREATE POLICY "email_log_admin_read" ON public.email_log
  FOR SELECT USING (auth.role() = 'authenticated');


-- ============================================================================
--  VERIFY: run this after the above to see RLS is on for every table.
--  rowsecurity should read "t" (true) for all 14 rows.
-- ============================================================================
-- select relname as table_name, relrowsecurity as rowsecurity
-- from pg_class
-- where relnamespace = 'public'::regnamespace
--   and relname in (
--     'exam_categories','custom_pages','attempts','students','student_progress',
--     'tests_catalog','bundles','nav_menu','pdf_vault','app_settings',
--     'payment_orders','email_templates','email_log','home_config'
--   )
-- order by relname;


-- ============================================================================
--  WHAT'S STILL OPEN AFTER THIS (deferred to Phase 3 / Phase 4):
--
--  1. Anyone can still read every row of `students` (incl. password_hash/
--     password_salt), `attempts` (incl. other students' answers and the
--     embedded answer key for every paper they've taken), and
--     `payment_orders` (incl. every student's email/UTR/amount). This is
--     unavoidable without giving students their own verified identity the
--     database can check — the same fix Phase 1 gave the admin account.
--     That's "Phase 3": lightweight verified student sessions (or full
--     Supabase Auth for students), which then lets a follow-up ("Phase 4")
--     properly scope these SELECTs to "your own rows only".
--
--  2. A logged-in-looking student can still directly query
--     tests_catalog.questions for a paper they haven't paid for, by id —
--     the app's own client-side entitlement check doesn't stop a direct
--     API call. Same root cause and same fix (Phase 3) as #1.
--
--  3. Because there's no student identity yet, an anonymous request can
--     still overwrite an EXISTING student's password_hash/password_salt/
--     name by crafting the same upsert shape pushStudentToCloud() sends,
--     for any email — i.e. account takeover is still possible via a
--     direct API call, not just through the real signup/reset UI. The
--     trigger in this migration stops the *access-granting* half of that
--     risk (nobody can grant themselves paid content this way any more),
--     but not this identity half. Phase 3 closes this too.
-- ============================================================================
