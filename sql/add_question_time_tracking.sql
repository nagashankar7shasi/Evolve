-- Per-question active time spent during a real, timed OMR attempt (seconds per question number,
-- e.g. {"1": 42, "2": 118}). Populated client-side from view-time tracking in the exam engine
-- (js/10_omr_exam_engine.js). Null/absent for attempts taken before this existed, and never
-- populated for Practice Mode attempts (untimed, one-question-at-a-time already).
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS question_times jsonb;
