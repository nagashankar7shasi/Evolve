-- ============================================================
--  Evolve+ — Mains question bank: subtopic, bilingual (EN/KN) fields,
--  explanation image, and an RLS hardening pass across the whole Mains
--  ecosystem.
--
--  1. New columns on mains_questions, mirroring the Prelims Test Paper
--     Studio's existing vocabulary (subTopic, bilingual question/answer text,
--     an explanation image URL) so the same "finer-grained tag under Subject",
--     "optional Kannada text", "a diagram/mind-map shown with the answer"
--     concepts work the same way in both question banks:
--       - sub_topic: optional, free text, nested under subject (e.g.
--         "Fundamental Rights" under "Polity") -- same free-text convention
--         as the Test Paper Studio's own subTopic field (no controlled
--         registry there either).
--       - question_kn / model_answer_kn: optional Kannada text, parallel to
--         the English question/model_answer. Deliberately NOT required --
--         today's content is English-only; this just makes the schema ready
--         for a bilingual rollout without a later migration.
--       - exp_image_url: one explanation image (e.g. a mind-map, a labeled
--         diagram) shown alongside the model answer. Deliberately just one
--         field, no English/Kannada split like the Test Paper Studio's
--         exp_image_url/exp_image_url_kn pair -- a mind-map or diagram is
--         visual, not language-specific text, so a single image serves
--         both languages. Add a _kn override later if that assumption
--         turns out wrong for some question.
--
--  2. RLS hardening: every admin-write policy in this ecosystem (added back
--     in add_mains_ecosystem.sql) used `auth.role() = 'authenticated'` --
--     true for ANY signed-in Supabase Auth user, not specifically the admin
--     email. The rest of the app (bundles, tests_catalog, and the
--     mains_test_papers table added alongside this one) gates admin writes
--     with `is_admin()` instead, which checks the actual admin email
--     allowlist. This was flagged as a known pre-existing inconsistency when
--     mains_test_papers shipped; this migration closes it across every
--     mains_* table, not just the new one. Functionally a no-op for the real
--     admin (already one of the two is_admin() emails) -- pure hardening,
--     since in practice this app never creates a second Supabase Auth user.
-- ============================================================

ALTER TABLE public.mains_questions
  ADD COLUMN IF NOT EXISTS sub_topic text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS question_kn text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model_answer_kn text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exp_image_url text;

-- ---- RLS hardening: auth.role() = 'authenticated' -> is_admin() ----
-- ALTER POLICY (redefine USING/WITH CHECK on the existing policy) rather than DROP+CREATE --
-- functionally identical here (no other policy properties change), and avoided a destructive-
-- statement confirmation the DROP+CREATE form triggered when this was first applied live.
ALTER POLICY "mains_questions_admin_write" ON public.mains_questions
  USING (is_admin()) WITH CHECK (is_admin());

ALTER POLICY "mains_submissions_admin_modify" ON public.mains_submissions
  USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY "mains_submissions_admin_delete" ON public.mains_submissions
  USING (is_admin());

ALTER POLICY "mains_ai_evaluations_admin_write" ON public.mains_ai_evaluations
  USING (is_admin()) WITH CHECK (is_admin());

ALTER POLICY "mains_human_evaluations_admin_write" ON public.mains_human_evaluations
  USING (is_admin()) WITH CHECK (is_admin());

ALTER POLICY "mains_eval_credits_admin_write" ON public.mains_eval_credits
  USING (is_admin()) WITH CHECK (is_admin());

ALTER POLICY "mains_eval_credit_transactions_admin_read" ON public.mains_eval_credit_transactions
  USING (is_admin());
ALTER POLICY "mains_eval_credit_transactions_admin_write" ON public.mains_eval_credit_transactions
  USING (is_admin()) WITH CHECK (is_admin());

NOTIFY pgrst, 'reload schema';
