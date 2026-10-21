-- ============================================================
--  Evolve+ — "topics covered" description for test papers
--
--  topics_covered: a short admin-editable text description of which sub-
--  topics a paper actually covers (e.g. "Ancient History, Medieval
--  History, Freedom Struggle"). Auto-filled when a paper is created
--  (single sub-topic split -> that topic; merged "Mixed topics" split ->
--  the actual topics pooled into it), but it's a plain editable text
--  field afterward, not a derived value re-synced from the questions --
--  the admin can rewrite it into a real blurb if they want.
--
--  Shown in the admin paper list (so the admin can verify at a glance)
--  and on the public test-paper card (so students can see what a paper
--  covers before buying/opening it).
--
--  tests_catalog_public is a VIEW over tests_catalog and must be
--  recreated too so the public bulk-fetch (js/02a_bundles.js) can see
--  the new column. Per CLAUDE.md: CREATE OR REPLACE VIEW cannot reorder
--  or insert columns among existing ones (Postgres 42P16), so the new
--  column is appended at the end of the SELECT list (after the
--  split_group_id column added in add_tests_catalog_split_group_id.sql).
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS topics_covered text;

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
    split_group_id,
    topics_covered
   FROM public.tests_catalog;

NOTIFY pgrst, 'reload schema';
