-- Task #138: Mains access control, scoped by exam category ("gated like test papers").
--
-- Adds an individual-grant allow-list for standalone Mains-access purchases, mirroring the existing
-- allowed_exams / allowed_pages / allowed_pdfs / allowed_planners columns. Values are exam category
-- ids (e.g. 'kpsc_kas', 'upsc_cse') -- Mains is category-scoped, not item-scoped, since one question
-- bank serves every question filed under that category. See isMainsUnlockedForUser() in
-- js/04_access_permission_checkers.js for the full entitlement chain: admin bypass -> covering
-- bundle/pass (category pass or All-Access) -> this allow-list. There is deliberately no free/
-- price-0 shortcut for Mains, unlike test papers.
--
-- NOTE per CLAUDE.md: this file is a record of what was run -- it was applied directly via the
-- Supabase MCP apply_migration tool (migration name: add_allowed_mains_to_students) and verified
-- against information_schema.columns before this file was written, not the other way around.

ALTER TABLE students ADD COLUMN IF NOT EXISTS allowed_mains jsonb DEFAULT '[]'::jsonb;
