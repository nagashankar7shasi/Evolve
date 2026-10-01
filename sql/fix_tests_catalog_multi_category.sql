-- ============================================================
--  Evolve+ — multi-category papers + active/inactive toggle
--  Run this once in the Supabase SQL editor before using the new
--  "Also show in" categories and "Active" switch in the paper studio.
--
--  extra_categories: extra exam-hub categories a paper is cross-listed
--  into, besides its main `category` (e.g. a Current Affairs paper
--  shown under both KAS and PSI). Stored as a JSON array of category ids.
--
--  active: false fully hides a paper from the Exam Hub and blocks it
--  from being opened by anyone (even a student who already unlocked it),
--  until it's switched back on. Existing papers default to true so
--  nothing already published disappears.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS extra_categories jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

UPDATE public.tests_catalog SET extra_categories = '[]'::jsonb WHERE extra_categories IS NULL;
UPDATE public.tests_catalog SET active = true WHERE active IS NULL;

NOTIFY pgrst, 'reload schema';
