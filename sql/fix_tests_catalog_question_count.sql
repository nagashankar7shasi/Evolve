-- ============================================================
--  Evolve+ — Phase 0 security fix: stop shipping every paper's full
--  question bank (including the answer key) to every visitor's
--  browser on every page load, regardless of whether they've paid.
--
--  Previously, the app fetched `select('*')` on tests_catalog for
--  the whole public catalog listing, which included the `questions`
--  column (every question's text, options AND correct answer) for
--  every paper — even ones the visitor hasn't unlocked. The app only
--  hid locked papers in the UI; the raw answer key was already
--  sitting in the browser (and directly fetchable via the public
--  anon key) the moment the page loaded.
--
--  The app now fetches only lightweight metadata for the public
--  catalog listing, and pulls a specific paper's actual questions
--  only when a signed-in, already-entitled student opens it (or an
--  admin manages it). That listing still needs a QUESTION COUNT to
--  show "42 Bilingual Questions" etc. on paper cards without ever
--  downloading the questions themselves — that's what this column
--  is for.
--
--  question_count: a plain integer, kept in sync by Studio (and the
--  older quick-upload form) every time a paper is published or
--  re-published. Never contains question content itself — just a
--  number — so it's safe to include in the public metadata fetch.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.tests_catalog
  ADD COLUMN IF NOT EXISTS question_count integer DEFAULT 0;

-- Backfill existing rows from their current `questions` column. Handles both a real jsonb array
-- column and a legacy text column holding a JSON string (the app has always defensively supported
-- both — see the JSON.parse fallbacks throughout the code).
UPDATE public.tests_catalog
SET question_count = COALESCE(
  CASE
    WHEN jsonb_typeof(questions::jsonb) = 'array' THEN jsonb_array_length(questions::jsonb)
    ELSE 0
  END,
  0
)
WHERE question_count IS NULL OR question_count = 0;

NOTIFY pgrst, 'reload schema';
