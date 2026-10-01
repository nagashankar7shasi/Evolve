-- ============================================================
--  Evolve+ — add a 'mode' column to the attempts table
--  Run this once in the Supabase SQL editor, before using Practice Mode
--  on a full paper (see index.html's launchExamPaperPractice/finishPaperPractice).
--
--  Every attempt row is now tagged 'standard' (a real timed OMR test, scored
--  and counted normally) or 'practice' (untimed, answer shown after each
--  question — still downloadable and shown in "papers attempted", but kept
--  out of peer percentile comparisons since it wasn't taken under the same
--  conditions as a real attempt).
--
--  Existing rows are backfilled to 'standard' since they were all real,
--  timed attempts (Practice Mode didn't exist before this).
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'standard';

UPDATE public.attempts SET mode = 'standard' WHERE mode IS NULL;

NOTIFY pgrst, 'reload schema';
