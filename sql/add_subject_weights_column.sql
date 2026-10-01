-- ============================================================
--  Evolve+ — add per-subject importance weight to exam_subjects
--
--  Backs the new "Weight" dropdown next to each subject in the admin's
--  Exam Categories → Subjects panel. A subject's weight (1-5, default 3)
--  is used by Studio's "Generate from Question Bank" → "Suggest counts"
--  to bias how many questions of that subject get pulled relative to
--  others (e.g. weighting "Fundamental Rights" higher than a minor topic
--  so it gets a bigger share of a generated paper) — it never forces
--  anything; the admin can always hand-edit the suggested counts.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS weights jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
