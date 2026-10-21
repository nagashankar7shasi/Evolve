-- ============================================================
--  Evolve+ — split-group lineage for bulk sectional-split papers
--
--  split_group_id: when studioConfirmSectionalSplit() creates several new
--  draft papers in one operation (splitting one big paper into N
--  sections), every sibling created in that same run gets the same
--  split_group_id value (a generated "split_<timestamp>" string).
--  Papers created any other way (manual upload, Studio duplicate, etc.)
--  leave this null. The admin paper list uses it purely to collapse
--  known-related siblings under one group header instead of listing
--  them as N unrelated rows -- it has no effect on access control,
--  pricing, or anything student-facing.
--
--  tests_catalog_public is a VIEW over tests_catalog and must be
--  recreated too so the admin bulk-fetch (js/02a_bundles.js) can see the
--  new column. Per CLAUDE.md: CREATE OR REPLACE VIEW cannot reorder or
--  insert columns among existing ones (Postgres 42P16), so the new
--  column is appended at the end of the SELECT list.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS split_group_id text;

CREATE OR REPLACE VIEW public.tests_catalog_public AS
 SELECT id,
    category,
    extra_categories,
    active,
    title,
    price,
    scheme,
    scheduled_for,
    question_count,
    also_list_categories,
    delisted,
    bundle_only,
    order_num,
    coming_soon,
    revision_notes,
    split_group_id
   FROM public.tests_catalog;

NOTIFY pgrst, 'reload schema';
