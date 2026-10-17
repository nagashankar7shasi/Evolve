-- Mains Test Papers: a named, priced, bundle-coverable unit built from existing mains_questions
-- ("10-question test", "20-question test"), mirroring tests_catalog's shape for the Prelims side.
-- Deliberately stores only question_ids (references into mains_questions), never the question
-- content itself -- that already lives in, and is already fetched from, mains_questions, so this
-- table carries nothing sensitive and can stay publicly readable the same way mains_questions is.
CREATE TABLE mains_test_papers (
  id text PRIMARY KEY,
  category_id text NOT NULL,
  subject text,
  title text NOT NULL,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  price numeric NOT NULL DEFAULT 0,
  bundle_only boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz,
  active boolean NOT NULL DEFAULT true,
  delisted boolean NOT NULL DEFAULT false,
  order_num integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mains_test_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY mains_test_papers_read ON mains_test_papers FOR SELECT USING (true);
CREATE POLICY mains_test_papers_admin_write ON mains_test_papers FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Per-paper entitlement, parallel to allowed_exams/allowed_mains -- lets a specific Mains test
-- paper be bought/granted on its own, separate from the whole-category Mains grant.
ALTER TABLE students ADD COLUMN IF NOT EXISTS allowed_mains_tests jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Per-paper bundle coverage, parallel to `papers` (Prelims) -- lets a bundle list specific Mains
-- test papers it unlocks, independent of whole-category coverage via `categories`.
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS mains_papers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Links a submission back to the test paper it was written for (null = free-practice, unattached
-- to any paper -- exactly how every existing submission already behaves; nothing changes for them).
ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS test_paper_id text;
