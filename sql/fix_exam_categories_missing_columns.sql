-- ============================================================
--  Evolve+ — patch exam_categories with any columns it's missing
--  Run this once in the Supabase SQL editor.
--
--  THE ERROR: "Saved locally, but cloud sync failed: Could not find the
--  'desc' column of 'exam_categories' in the schema cache"
--
--  WHY: fix_app_settings_exam_categories.sql creates this table with
--  `CREATE TABLE IF NOT EXISTS`, which does nothing if the table already
--  exists. Your exam_categories table was already there (created earlier,
--  possibly before the 'desc' column was part of that script, or created
--  by hand in the Table Editor) — so it's been missing that column ever
--  since, and every edit to a category has been failing to sync to the
--  cloud (saved to your browser only, not to Supabase).
--
--  THE FIX: explicitly add whatever columns are missing. This does NOT
--  touch or reset any existing data — it only adds columns that aren't
--  there yet.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.exam_categories
  ADD COLUMN IF NOT EXISTS "desc" text,
  ADD COLUMN IF NOT EXISTS default_scheme jsonb,
  ADD COLUMN IF NOT EXISTS order_num integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Tell PostgREST to refresh its cached schema right away (it usually
-- notices within a minute anyway, but this makes it instant).
NOTIFY pgrst, 'reload schema';
