-- Lets a bundle reference one PDF-vault document as its "schedule / syllabus" -- a promotional
-- info sheet shown on the public bundle card (see bundleCardHtml, js/03c_bundles_admin_editor.js),
-- distinct from `pdfs` (the jsonb array of PDFs the bundle actually ENTITLES a buyer to). Nullable:
-- no schedule PDF set is the default/existing behavior for every current bundle.
--
-- Applied directly against the live project on 2026-10-17 via Supabase MCP (apply_migration) and
-- verified with a follow-up SELECT, per CLAUDE.md's "never trust a migration file alone" rule.
ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS schedule_pdf_id text;
