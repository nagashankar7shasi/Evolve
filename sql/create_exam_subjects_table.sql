-- ============================================================
--  Evolve+ — new table: exam_subjects
--
--  Backs the new per-category Subject registry (Exam Categories admin →
--  each category's "Subjects" section): a managed, canonical list of
--  subject names per exam category, so Studio's Subject field can offer a
--  dropdown instead of free text (which used to fragment into near-dupes
--  like "Polity" / "polity" / "Indian Polity" across different uploads).
--
--  One row per category; `subjects` is the ordered list of names as a
--  plain JSON array of strings, e.g. ["Economy", "History", "Polity"].
--
--  Admin-only end to end (read and write) — this table is never read by
--  students, only by the Studio admin UI — so it uses the same
--  public.is_admin() pattern as feedback_log rather than the older, more
--  permissive USING (true) policies some earlier tables in this project
--  were created with.
--
--  Run this once in the Supabase SQL editor. Safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  category_id text PRIMARY KEY,
  subjects    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_subjects admin read"   ON public.exam_subjects;
DROP POLICY IF EXISTS "exam_subjects admin insert" ON public.exam_subjects;
DROP POLICY IF EXISTS "exam_subjects admin update" ON public.exam_subjects;
DROP POLICY IF EXISTS "exam_subjects admin delete" ON public.exam_subjects;

CREATE POLICY "exam_subjects admin read"   ON public.exam_subjects FOR SELECT USING (public.is_admin());
CREATE POLICY "exam_subjects admin insert" ON public.exam_subjects FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "exam_subjects admin update" ON public.exam_subjects FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "exam_subjects admin delete" ON public.exam_subjects FOR DELETE USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
