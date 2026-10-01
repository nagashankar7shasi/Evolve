-- ============================================================
--  Evolve+ — add the "show scoring pattern" toggle column to exam_categories
--  Run this once in the Supabase SQL editor.
--
--  WHY: the Exam Categories admin panel now has a per-category checkbox
--  "Show scoring pattern (marks per correct/wrong, max marks) on paper
--  cards in this Exam Hub". That setting is stored as a new
--  `show_scoring_pattern` column. Without this column, saving a category
--  will fail to sync to the cloud with an error like "Could not find the
--  'show_scoring_pattern' column of 'exam_categories' in the schema cache"
--  (same failure mode as the earlier missing-'desc'-column issue) — the
--  app falls back to keeping the setting in your browser only.
--
--  THE FIX: add the column. Existing categories default to `true` (shown),
--  so nothing changes for any category until you explicitly turn it off.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.exam_categories
  ADD COLUMN IF NOT EXISTS show_scoring_pattern boolean DEFAULT true;

NOTIFY pgrst, 'reload schema';
