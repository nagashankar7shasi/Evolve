-- ============================================================
--  Evolve+ — new table: subject_groups
--
--  Lets the admin merge several raw Subject-registry entries (per exam
--  category, see exam_subjects) into one named group, e.g. "History" +
--  "Art & Culture" -> "Humanities". Driven from Dev Console → Exam
--  Categories → each category's existing "📚 Subjects" panel, right next
--  to the subject registry and the duplicate-spelling cleanup tool.
--
--  Used by the student Weakness/Strength dashboard (renderWeaknessHeatmap,
--  js/11d_study_planner_admin_csv.js) to shorten a long flat subject list
--  into fewer, more useful rows -- a subject with no group still shows on
--  its own, unchanged. Each attempt's own paper->category is resolved at
--  render time, so a student who has attempted papers from more than one
--  exam category still gets the right per-category grouping applied to
--  each attempt's questions.
--
--  One row per (category_id, group_name) pair; member_subjects is a plain
--  JSON array of the raw subject-registry names folded into that group,
--  e.g. ["History", "Art & Culture"].
--
--  Unlike exam_subjects (admin-only read+write, since only the Studio
--  admin UI ever reads it), this table IS read by students too -- the
--  grouping has to apply on their own dashboard, not just an admin
--  screen -- so it follows the public-read/admin-write pattern already
--  used for tests_catalog/exam_categories/bundles/etc. (phase2_rls_lockdown.sql)
--  rather than exam_subjects' admin-only pattern.
--
--  Run this once in the Supabase SQL editor. Safe to run more than once.
--
--  Note: when applying via the Supabase MCP tools instead of the SQL editor, a bare
--  `DROP POLICY IF EXISTS ...` statement (and apparently any batch containing one) comes back
--  as {"status":"cancelled"} with no error -- some kind of silent confirmation gate on
--  destructive-looking statements that doesn't surface an actual prompt. Plain CREATE
--  TABLE/CREATE POLICY/ALTER TABLE ENABLE RLS/NOTIFY all went through fine individually. On a
--  brand-new table (nothing to drop yet) that's moot; re-running this file's DROPs by hand in
--  the SQL editor is the fallback if this table's policies ever need recreating from MCP.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subject_groups (
  category_id     text NOT NULL,
  group_name      text NOT NULL,
  member_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (category_id, group_name)
);

ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subject_groups_read" ON public.subject_groups;
DROP POLICY IF EXISTS "subject_groups_admin_write" ON public.subject_groups;

CREATE POLICY "subject_groups_read" ON public.subject_groups FOR SELECT USING (true);
CREATE POLICY "subject_groups_admin_write" ON public.subject_groups FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
