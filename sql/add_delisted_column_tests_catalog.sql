-- ----------------------------------------------------------------------------
--  Adds a `delisted` flag to tests_catalog, independent of `active`.
--
--  `active = false` is a hard block: hidden AND unopenable for everyone except
--  the admin (see isTestUnlockedForUser). `delisted = true` is much softer: the
--  paper is skipped by the Test Papers browse grid (filterExamCategoryBase) and
--  site search, but stays fully purchasable/openable via a direct link, a
--  bundle, or a "📝 Test paper card" embedded on a custom page (see
--  testPaperCardHtml/hydratePageCards in js/08_word_page_creator.js) — the whole
--  point being to let an admin feature a paper on a specific page without it
--  also cluttering the general catalog.
--
--  Also updates tests_catalog_public (the metadata-only view the app's bulk
--  catalog fetch reads) to expose both `delisted` and `also_list_categories` —
--  the latter was already a real column on the base table and already read by
--  fetchCloudContent()'s JS mapping, but had been missing from both the view's
--  SELECT list and the app's own `.select(...)` string since whichever earlier,
--  untracked change added the column — meaning cross-listing a paper via
--  "Also list as its own paper under" silently never worked through this fetch.
--  Fixed here as part of touching this view for the same reason anyway.
-- ----------------------------------------------------------------------------

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS delisted boolean NOT NULL DEFAULT false;

-- Column order below matters: CREATE OR REPLACE VIEW can only append new trailing
-- columns, not reorder/insert among existing ones (Postgres error 42P16), so
-- also_list_categories/delisted are appended at the end rather than slotted in
-- next to the related columns they conceptually belong near.
CREATE OR REPLACE VIEW public.tests_catalog_public AS
  SELECT id, category, extra_categories, active, title, price, scheme, scheduled_for, question_count,
         also_list_categories, delisted
  FROM public.tests_catalog;

GRANT SELECT ON public.tests_catalog_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
