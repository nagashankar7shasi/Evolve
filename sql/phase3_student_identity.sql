-- ============================================================================
--  Evolve+ — Phase 3: real student identity, and a critical admin-check fix
--  that MUST ship together with the app code update that goes with this file.
--
--  WHAT PHASE 3 IS: students now get a real, verifiable Supabase Auth login,
--  the same kind Phase 1 gave the admin account — instead of every "am I
--  logged in as Priya" check happening only in the browser, which is trivial
--  to fake against the database directly.
--
--  WHAT THIS FILE ACTUALLY DOES:
--
--   1. THE URGENT PART — fixes every policy this project has that used
--      `auth.role() = 'authenticated'` to mean "is the admin". That was true
--      right up until now: your Supabase Auth project had exactly one kind
--      of real login, the admin's. The app update that goes with this file
--      gives STUDENTS real Supabase Auth logins too, on the same project —
--      which means the moment even one student activates it, a plain
--      `auth.role() = 'authenticated'` check can no longer tell your admin
--      account apart from that student's. Every policy still using it would
--      suddenly treat any migrated student as the admin: able to approve
--      their own payments, edit exam papers and prices, grant themselves
--      bundles, delete other students' records, rewrite the pricing master —
--      all of it. This file replaces every one of those checks with a new
--      `is_admin()` function that checks the real email on the session
--      against your two admin addresses, so only you two are ever treated
--      as admin, no matter how many students activate real logins.
--      THIS PART SHIP TOGETHER WITH THE APP UPDATE, NOT SEPARATELY — running
--      the app update without this SQL (or vice versa) leaves the hole open.
--
--   2. THE FORWARD-LOOKING PART — adds `current_student_email()` and
--      `student_can_access_paper()`, plus a `tests_catalog_public` view.
--      These are the building blocks for finally closing the two gaps Phase
--      2 documented as deferred: the answer-key gap (a direct query can
--      still read `tests_catalog.questions` for a paper nobody's paid for)
--      and the "anyone can read every student/attempt/payment row" gap.
--      They're created now so they're ready, but NOT yet wired into any
--      policy — see "WHY THIS IS DELIBERATELY NOT ENFORCED YET" at the
--      bottom before you ask why the gaps aren't actually closed.
--
--  HOW TO RUN THIS:
--   Supabase Dashboard → SQL Editor → New query → paste this whole file →
--   Run. Safe to run more than once (every statement is idempotent).
--
--  BEFORE YOU RUN THIS: this migration assumes Phase 2's
--  phase2_rls_lockdown.sql has already been run (RLS is already enabled on
--  every table, with the `auth.role() = 'authenticated'`-based policies this
--  file replaces). If you haven't run that yet, run it first.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  is_admin() / current_student_email() — the two identity primitives
--  everything else in this file (and future phases) is built on.
-- ----------------------------------------------------------------------------

-- Keep this list in sync with ADMIN_EMAILS in index.html (same two addresses,
-- same reasoning): the client uses its copy to decide what UI to show, the
-- database uses this copy to decide what a request is actually allowed to
-- touch. If you ever add or remove an admin address, update BOTH.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    lower(trim(auth.jwt() ->> 'email')) = ANY (ARRAY['7shashank1992@gmail.com', 'nagashankar7shashi@gmail.com']),
    false
  );
$$ LANGUAGE sql STABLE;

-- NULL for anyone without a real Supabase Auth session (anonymous visitors,
-- and any student who hasn't activated the new login yet) — every caller
-- below already treats "no identity" as "no access", so this never needs a
-- special NULL case of its own.
CREATE OR REPLACE FUNCTION public.current_student_email()
RETURNS text AS $$
  SELECT lower(trim(auth.jwt() ->> 'email'));
$$ LANGUAGE sql STABLE;


-- ----------------------------------------------------------------------------
--  student_can_access_paper(paper_id) — faithfully replicates the app's own
--  client-side isTestUnlockedForUser() / activeBundlesFor() / bundleCoversPaper()
--  logic (index.html), so a direct database query is held to the exact same
--  rule the UI already enforces, not a looser approximation of it.
--
--  SECURITY DEFINER so it can look up the requester's own students/bundles
--  rows regardless of what that request's own SELECT policy currently
--  allows (today those tables are still openly readable anyway, but this
--  keeps the function correct unchanged once that's tightened later).
--
--  Every array/object column below is read through to_jsonb(...) rather
--  than assumed to be a particular Postgres type (jsonb vs. native array):
--  to_jsonb() converts either one into the same jsonb shape, so this
--  function works regardless of which type these columns actually are —
--  same reasoning as the NULL-based trigger in phase2_rls_lockdown.sql.
--  COALESCE(..., '[]'/'{}') guards the common case where a column is
--  genuinely NULL (e.g. a self-signup row, which the Phase 2 trigger
--  deliberately inserts with these columns NULL).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_can_access_paper(p_paper_id text)
RETURNS boolean AS $$
DECLARE
  v_paper   public.tests_catalog%ROWTYPE;
  v_email   text;
  v_student public.students%ROWTYPE;
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT * INTO v_paper FROM public.tests_catalog WHERE id = p_paper_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- An inactive paper is a hard "no" for everyone but the admin, already
  -- handled above.
  IF NOT COALESCE(v_paper.active, true) THEN
    RETURN false;
  END IF;

  -- A free paper is open to everyone, signed in or not — matches
  -- isTestUnlockedForUser's `Number(paper.price) === 0` check, which runs
  -- before any login check at all.
  IF COALESCE(v_paper.price, 0) = 0 THEN
    RETURN true;
  END IF;

  v_email := public.current_student_email();
  IF v_email IS NULL THEN
    RETURN false; -- anonymous, or a student who hasn't activated the new login yet
  END IF;

  SELECT * INTO v_student FROM public.students WHERE lower(trim(email)) = v_email;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- isStudentBlocked(student): a status other than empty/null/'active' blocks
  IF v_student.status IS NOT NULL AND v_student.status <> '' AND v_student.status <> 'active' THEN
    RETURN false;
  END IF;

  -- Direct grant: student.allowedExams.includes(testId)
  IF COALESCE(to_jsonb(v_student.allowed_exams), '[]'::jsonb) ? p_paper_id THEN
    RETURN true;
  END IF;

  -- Any held, non-expired bundle/pass that covers this paper.
  -- Deliberately does NOT filter by bundle.active — a bundle taken off sale
  -- still covers everyone who already holds it (matches bundleCoversPaper,
  -- which never checks b.active; only bundlesForSale, used for the storefront,
  -- does that).
  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(to_jsonb(v_student.passes), '[]'::jsonb)) AS pass_id
    JOIN public.bundles bd ON bd.id = pass_id
    WHERE NOT (
      -- isPassExpired: an expiry date is set AND it's in the past
      (COALESCE(to_jsonb(v_student.pass_expiry), '{}'::jsonb) ->> pass_id) IS NOT NULL
      AND (COALESCE(to_jsonb(v_student.pass_expiry), '{}'::jsonb) ->> pass_id) <> ''
      AND (COALESCE(to_jsonb(v_student.pass_expiry), '{}'::jsonb) ->> pass_id)::timestamptz < now()
    )
    AND (
      bd.all_access
      OR COALESCE(to_jsonb(bd.categories), '[]'::jsonb) ? v_paper.category
      OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements_text(COALESCE(to_jsonb(v_paper.extra_categories), '[]'::jsonb)) AS ec
           WHERE COALESCE(to_jsonb(bd.categories), '[]'::jsonb) ? ec
         )
      OR COALESCE(to_jsonb(bd.papers), '[]'::jsonb) ? p_paper_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ----------------------------------------------------------------------------
--  tests_catalog_public — a safe, answer-key-free view of the catalog for
--  browsing/paywall cards, ready for the app's bulk catalog fetch to switch
--  to once the base table's SELECT is actually tightened (see below).
--  Granted directly since it's a view, not a table RLS applies to.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.tests_catalog_public AS
  SELECT id, category, extra_categories, active, title, price, scheme, scheduled_for, question_count
  FROM public.tests_catalog;

GRANT SELECT ON public.tests_catalog_public TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  THE URGENT FIX — every place phase2_rls_lockdown.sql used
--  `auth.role() = 'authenticated'` to mean "is the admin" now uses
--  is_admin() instead. Behavior for you (the admin) and for anonymous/
--  not-yet-migrated requests is UNCHANGED; the only thing this closes is a
--  migrated student's session no longer being mistaken for yours.
-- ----------------------------------------------------------------------------

-- The entitlement-protecting trigger on students — the single most important
-- one to fix. Unchanged otherwise from phase2_rls_lockdown.sql.
CREATE OR REPLACE FUNCTION public.protect_student_entitlement_columns()
RETURNS trigger AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status            := 'active';
    NEW.allowed_exams     := NULL;
    NEW.allowed_pages     := NULL;
    NEW.allowed_pdfs      := NULL;
    NEW.allowed_planners  := NULL;
    NEW.passes            := NULL;
    NEW.pass_expiry       := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
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
-- (trigger itself already attached by phase2_rls_lockdown.sql — CREATE OR
-- REPLACE FUNCTION above is enough, no need to recreate the trigger)

DROP POLICY IF EXISTS "students_admin_delete" ON public.students;
CREATE POLICY "students_admin_delete" ON public.students
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "attempts_admin_update" ON public.attempts;
CREATE POLICY "attempts_admin_update" ON public.attempts
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attempts_admin_delete" ON public.attempts;
CREATE POLICY "attempts_admin_delete" ON public.attempts
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "student_progress_admin_delete" ON public.student_progress;
CREATE POLICY "student_progress_admin_delete" ON public.student_progress
  FOR DELETE USING (public.is_admin());

-- payment_orders_insert is the sharpest edge of the old check: it let
-- anything satisfying `auth.role() = 'authenticated'` insert an order with
-- ANY status, not just 'pending' — a migrated student could otherwise
-- insert their own pre-approved order directly.
DROP POLICY IF EXISTS "payment_orders_insert" ON public.payment_orders;
CREATE POLICY "payment_orders_insert" ON public.payment_orders
  FOR INSERT WITH CHECK (status = 'pending' OR public.is_admin());

DROP POLICY IF EXISTS "payment_orders_admin_update" ON public.payment_orders;
CREATE POLICY "payment_orders_admin_update" ON public.payment_orders
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_orders_admin_delete" ON public.payment_orders;
CREATE POLICY "payment_orders_admin_delete" ON public.payment_orders
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "exam_categories_admin_write" ON public.exam_categories;
CREATE POLICY "exam_categories_admin_write" ON public.exam_categories FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "custom_pages_admin_write" ON public.custom_pages;
CREATE POLICY "custom_pages_admin_write" ON public.custom_pages FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tests_catalog_admin_write is what stops a migrated student from rewriting
-- answer keys, prices, or the active flag directly — arguably the single
-- highest-value fix in this whole file.
DROP POLICY IF EXISTS "tests_catalog_admin_write" ON public.tests_catalog;
CREATE POLICY "tests_catalog_admin_write" ON public.tests_catalog FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- bundles_admin_write is what stops a migrated student from editing a
-- bundle's price to 0, or adding every paper to a bundle they hold, directly.
DROP POLICY IF EXISTS "bundles_admin_write" ON public.bundles;
CREATE POLICY "bundles_admin_write" ON public.bundles FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "nav_menu_admin_write" ON public.nav_menu;
CREATE POLICY "nav_menu_admin_write" ON public.nav_menu FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "pdf_vault_admin_write" ON public.pdf_vault;
CREATE POLICY "pdf_vault_admin_write" ON public.pdf_vault FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_templates_admin_write" ON public.email_templates;
CREATE POLICY "email_templates_admin_write" ON public.email_templates FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "home_config_admin_write" ON public.home_config;
CREATE POLICY "home_config_admin_write" ON public.home_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- app_settings_admin_write is what stops a migrated student from rewriting
-- the pricing master, UPI/payment details, or feature-access settings
-- directly.
DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write" ON public.app_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_log_admin_read" ON public.email_log;
CREATE POLICY "email_log_admin_read" ON public.email_log
  FOR SELECT USING (public.is_admin());


-- ============================================================================
--  VERIFY: every policy that should now reference is_admin() instead of
--  auth.role() = 'authenticated'. Should return zero rows.
-- ============================================================================
-- select schemaname, tablename, policyname, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and (qual ilike '%auth.role()%' or with_check ilike '%auth.role()%');


-- ============================================================================
--  OPTIONAL SELF-TEST for student_can_access_paper(): run this by hand with
--  one of your own real paper ids and a real student email to sanity-check
--  the function against a simulated logged-in session, without needing a
--  real login. Replace the two placeholder values first. Read-only, and the
--  ROLLBACK at the end undoes the simulated session context either way.
-- ============================================================================
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"email":"REPLACE_WITH_A_REAL_STUDENT_EMAIL"}';
--   SELECT public.student_can_access_paper('REPLACE_WITH_A_REAL_PAPER_ID') AS can_access;
-- ROLLBACK;


-- ============================================================================
--  WHY THIS IS DELIBERATELY NOT ENFORCED YET (read before asking "so is the
--  answer-key gap actually closed now?" — no, not yet, on purpose):
--
--  student_can_access_paper() and current_student_email() both depend on the
--  requester having a REAL Supabase Auth session with an email claim. Today,
--  right after this ships, that's true for exactly nobody — every existing
--  student is still on the legacy password system, and (per your own choice)
--  only moves onto the real login the next time they log in, via the
--  one-time forced reset. If this file had also flipped `tests_catalog`'s
--  base-table SELECT policy to require student_can_access_paper(), or
--  scoped `students`/`attempts`/`payment_orders`/`student_progress` SELECT
--  to "your own row", every one of those not-yet-migrated students would be
--  locked out of paid content they've already bought — and legacy login
--  itself would break outright, because it works by reading a student's
--  password hash out of the students table BEFORE they've proven who they
--  are, which a "your own row only" policy makes impossible by definition
--  (Phase 2 documented this same chicken-and-egg problem).
--
--  So this file ships the identity system and the admin-check fix now
--  (both required immediately, both safe to run today), and leaves
--  `tests_catalog_read` / `students_read` / `attempts_read` /
--  `payment_orders_read` / `student_progress_read` exactly as
--  phase2_rls_lockdown.sql left them — open — for now. Once enough of your
--  students have logged in at least once since this shipped (each one does
--  the one-time reset automatically the next time they log in), say
--  "Phase 3b" and I'll write the short follow-up migration that finally
--  flips those policies to use student_can_access_paper() /
--  current_student_email(), and updates the app's legacy-login fallback to
--  retire itself once nobody needs it — the exact same two-step pattern
--  Phase 1a/1b already used for the admin account.
-- ============================================================================
