-- ============================================================
--  Evolve+ — explicit display order for test papers.
--
--  Before this, the Test Papers grid and the admin list had NO sort logic at all: the bulk catalog
--  fetch (fetchCloudContent in js/02a_bundles.js) selects from tests_catalog_public with no
--  ORDER BY, and the view itself has none either. Postgres makes no ordering guarantee for a plain
--  SELECT with no ORDER BY — in practice it tends to reflect something close to physical row/heap
--  order, which drifts after UPDATEs and has no relationship to title, price, or upload date. That's
--  the "arrangement seems vague/odd" the admin is seeing.
--
--  order_num is a plain admin-settable integer (same pattern as bundles.order_num / custom_pages'
--  order_num / nav_menu.order_num already use elsewhere in this app) — lower sorts first. Settable
--  per paper from the Test Paper Studio's new "Display order" field, or quickly nudged via the ▲/▼
--  buttons in the admin Tests list (see moveTestPaper in js/06_exam_pages_test_ingestion.js).
--
--  Backfill below gives every EXISTING paper a distinct starting value, grouped by category and
--  ordered by id (ids are "paper_<creation-epoch-ms>", so ordering by id ascending is chronological
--  within a category) — a reasonable "oldest first, per exam" starting point so nothing visually
--  reshuffles the moment this ships; the admin can then freely reorder from there.
-- ============================================================

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS order_num integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY category ORDER BY id) * 10)::int AS rn
  FROM public.tests_catalog
)
UPDATE public.tests_catalog t
SET order_num = ranked.rn
FROM ranked
WHERE t.id = ranked.id;

-- Column order below matters: CREATE OR REPLACE VIEW can only APPEND new trailing columns, never
-- insert/reorder among existing ones (Postgres error 42P16 — see add_delisted_column_tests_catalog.sql
-- and add_bundle_only_to_tests_catalog.sql for the same constraint hit previously), so order_num goes
-- on the end even though it conceptually belongs near scheduled_for/price.
CREATE OR REPLACE VIEW public.tests_catalog_public AS
  SELECT id, category, extra_categories, active, title, price, scheme, scheduled_for, question_count,
         also_list_categories, delisted, bundle_only, order_num
  FROM public.tests_catalog;

GRANT SELECT ON public.tests_catalog_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
