-- "Coming Soon" flag for test papers (independent of active/delisted/bundle_only -- see
-- js/06a_test_paper_studio.js's studioPublish comments) + optional per-paper revision notes
-- (typed text and/or an uploaded PDF/image, stored as { text, fileUrl, fileName }).
ALTER TABLE tests_catalog ADD COLUMN IF NOT EXISTS coming_soon boolean DEFAULT false;
ALTER TABLE tests_catalog ADD COLUMN IF NOT EXISTS revision_notes jsonb;

-- CREATE OR REPLACE VIEW can't reorder/insert columns among existing ones (Postgres error
-- 42P16) -- new columns must be appended at the end of the SELECT list, even though
-- conceptually they'd sit elsewhere (see CLAUDE.md).
CREATE OR REPLACE VIEW tests_catalog_public AS
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
    revision_notes
FROM tests_catalog;
