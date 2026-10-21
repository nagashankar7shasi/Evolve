-- Exam Countdown feature: optional Prelims/Mains dates per exam category.
-- Admin sets these in the console per category; the student dashboard shows a
-- countdown chip to whichever date is soonest/still-upcoming, switching from
-- Prelims to Mains once Prelims has passed, hidden when neither applies.
--
-- Applied directly to the live project (zghoanrwgihlefgmqmrr) via
-- mcp__Supabase__apply_migration and verified against
-- information_schema.columns before and after, per CLAUDE.md.

ALTER TABLE exam_categories
  ADD COLUMN IF NOT EXISTS prelims_date date,
  ADD COLUMN IF NOT EXISTS mains_date date;
