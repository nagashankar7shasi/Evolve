-- ============================================================
--  Evolve+ — schema additions for:
--    1. Sub-categories (e.g. "KAS Current Affairs" nested under KPSC KAS)
--    2. Splitting "feeds the question bank of" from "also list as its own
--       paper under" (previously the same field, extra_categories — see
--       the code comments on bundleCoversPaper / studioRefreshAlsoListCategoryOptions
--       for why these needed to become two separate, independent fields)
--
--  Run this once in the Supabase SQL editor. Safe to run more than once.
-- ============================================================

-- Sub-categories: a category can optionally point at a parent category.
-- NULL / missing = top-level (today's behavior for every existing category).
ALTER TABLE public.exam_categories
  ADD COLUMN IF NOT EXISTS parent_id text;

-- also_list_categories: NEW, separate from extra_categories. Only this field
-- cross-lists a paper as its own browsable/purchasable card in another exam's
-- hub, and only this field extends bundle entitlement to it. Defaults to an
-- empty array for every existing paper — i.e. nothing that was previously
-- tagged via extra_categories stays cross-listed/unlockable elsewhere unless
-- you explicitly re-tick it in Studio's new "Also list as its own paper under"
-- section. extra_categories keeps its original column and now means ONLY
-- "feeds this exam's practice question bank" (Build a Topic Test).
ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS also_list_categories jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
