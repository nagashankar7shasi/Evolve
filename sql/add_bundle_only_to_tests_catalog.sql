-- ============================================================
--  Evolve+ — "Bundle-only" test papers.
--
--  Previously a test paper's `price` column did two unrelated jobs at
--  once: it was the free/not-free gate `isTestUnlockedForUser()`
--  checks (price 0 = unconditionally free for everyone), AND it was
--  the exact amount shown on a standalone "Unlock Paper (₹price)"
--  button any visitor could click to buy that one paper outright,
--  independent of any bundle. That meant an admin could never price
--  a paper above ₹0 to keep it gated while also preventing it from
--  being sold on its own — pricing it to stop it being free also
--  silently opened an individual-purchase path around any bundle it
--  was meant to be exclusive to.
--
--  `bundle_only` breaks that coupling: when true, the paper skips the
--  free-price shortcut entirely and is never offered for individual
--  purchase (in the main Test Papers grid or in a custom Word Page's
--  embedded paper card) — access comes only from a bundle that
--  covers it (bundleCoversPaper()) or an explicit admin grant
--  (allowedExams). Defaults to false so every existing paper's
--  behavior is unchanged.
-- ============================================================

ALTER TABLE tests_catalog ADD COLUMN IF NOT EXISTS bundle_only boolean NOT NULL DEFAULT false;

-- tests_catalog_public (the metadata-only view every visitor's bulk catalog load reads from, see
-- fetchCloudContent in js/02a_bundles.js) does not automatically pick up new base-table columns —
-- it has to be re-pointed explicitly. CREATE OR REPLACE VIEW can only APPEND columns, never insert
-- or reorder among existing ones (Postgres error 42P16), so bundle_only goes on the end even though
-- it conceptually belongs near `price`/`delisted`.
CREATE OR REPLACE VIEW tests_catalog_public AS
SELECT id, category, extra_categories, active, title, price, scheme, scheduled_for, question_count, also_list_categories, delisted, bundle_only
FROM tests_catalog;
