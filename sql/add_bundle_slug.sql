-- Adds a human-readable slug to bundles, mirroring custom_pages.slug/old_slugs (see
-- normalizePageReferences / findPage / pageLinkHash in js/02_pricing_master_storage.js). Needed for
-- #/bundle/{slug} landing pages (task: per-bundle landing page). No DB-level uniqueness constraint,
-- same as custom_pages.slug -- uniqueness is enforced client-side at save time (see saveBundle's
-- `taken()` check in js/03c_bundles_admin_editor.js), not here.
--
-- Applied directly against the live project on 2026-10-17 via Supabase MCP (apply_migration) and
-- verified with a follow-up SELECT, per CLAUDE.md's "never trust a migration file alone" rule.
ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS old_slugs jsonb DEFAULT '[]'::jsonb;

-- Backfill existing rows so they already have a working slug (mirrors slugify() in
-- js/02_pricing_master_storage.js: lowercase, non-alnum runs -> single dash, trim dashes).
UPDATE bundles
SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
