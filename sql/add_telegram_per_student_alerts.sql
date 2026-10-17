-- ============================================================================
--  Evolve+ — per-student Telegram alerts (task #198 / phase 3 of the Telegram
--  integration — phase 1 was the admin broadcast-to-channel feature).
--
--  WHAT THIS FILE DOES:
--   1. Adds telegram_chat_id + telegram_connect_token to `students`.
--   2. Adds two narrow SECURITY DEFINER RPCs so a logged-in student can start
--      (and undo) their own Telegram connection without needing a direct
--      UPDATE grant on `students` (students_update is is_admin()-only — see
--      phase4/phase8's further tightening of phase2_rls_lockdown.sql's
--      original `USING(true) WITH CHECK(true)`). Same reasoning/pattern as
--      student_upsert_credentials() in phase3b_row_scoping.sql.
--
--  HOW CONNECTING WORKS (full flow, for context — most of it lives in the two
--  new Edge Functions telegram-webhook-setup / telegram-webhook and the app's
--  JS, not in this file):
--   1. Student taps "Connect Telegram" on their dashboard. The app generates
--      a random one-time token client-side and calls
--      student_set_telegram_connect_token(token) to save it on their own row.
--   2. The app opens https://t.me/<bot_username>?start=<token> — Telegram's
--      own deep-link convention for passing a payload to a bot's /start.
--   3. Telegram POSTs that /start update to the telegram-webhook Edge
--      Function (registered once via the admin-only telegram-webhook-setup
--      function), which looks up the matching token, writes the chat_id onto
--      that student's row, and clears the token (single use).
--   4. The dashboard shows "✓ Connected" once it re-reads its own row (either
--      on next load, or via the "Already connected? Refresh" link — there's
--      no way for the open browser tab to know the instant Telegram's /start
--      webhook fires, since that round trip never touches this browser).
-- ============================================================================

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS telegram_connect_token text;

-- student_set_telegram_connect_token(token) — called right before the app sends the student to the
-- Telegram deep link, so telegram-webhook can later match /start <token> back to this exact
-- account. SECURITY DEFINER (students_update is admin-only); scoped to current_student_email(), so
-- a student can only ever set a token on their OWN row, never anyone else's — same scoping
-- current_student_email() already enforces for attempts_insert/students_read.
CREATE OR REPLACE FUNCTION public.student_set_telegram_connect_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.students
  SET telegram_connect_token = p_token
  WHERE lower(trim(email)) = public.current_student_email();
$$;

GRANT EXECUTE ON FUNCTION public.student_set_telegram_connect_token(text) TO authenticated;

-- student_clear_telegram_connection() — lets a student unlink Telegram themselves ("Disconnect" on
-- the dashboard) without needing admin help. Clears both columns so a stale token can't later be
-- replayed against a /start that arrives after the student has already disconnected.
CREATE OR REPLACE FUNCTION public.student_clear_telegram_connection()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.students
  SET telegram_chat_id = NULL, telegram_connect_token = NULL
  WHERE lower(trim(email)) = public.current_student_email();
$$;

GRANT EXECUTE ON FUNCTION public.student_clear_telegram_connection() TO authenticated;


-- ============================================================================
--  VERIFY (run after applying):
-- ============================================================================
-- select column_name from information_schema.columns where table_name = 'students'
--   and column_name in ('telegram_chat_id', 'telegram_connect_token');
-- select proname from pg_proc where proname in
--   ('student_set_telegram_connect_token', 'student_clear_telegram_connection');
