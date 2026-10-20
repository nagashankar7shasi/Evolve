-- Enables server-side scheduled posting of native Telegram quiz polls (sendPoll, type="quiz") from
-- the question bank (tests_catalog.questions), independent of any Claude session or admin browser
-- tab being open. The actual posting logic lives in the post-telegram-quiz edge function; this
-- migration only wires up the clock that calls it.
--
-- pg_cron fires on a fixed schedule (hourly tick, see below) and pg_net makes the HTTP call to the
-- edge function async (fire-and-forget -- the response, if any, lands in net._http_response and is
-- not read here). The edge function itself self-throttles against telegram_quiz_settings'
-- frequencyHours/lastRunAt, so an hourly tick doesn't post more often than the admin configured in
-- Dev Console -- this keeps the cron schedule itself simple and avoids needing to reschedule it
-- from client code whenever the admin changes the frequency.
--
-- Applied live via Supabase MCP (apply_migration, name "add_telegram_quiz_automation") and verified
-- against pg_extension + cron.job per CLAUDE.md's rule -- this file is the repo's record of that,
-- not what makes the change real.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- cron.schedule() upserts by job name (re-running this migration updates the existing job rather
-- than creating a duplicate), so this migration is safe to apply more than once.
--
-- SECURITY NOTE (2026-10-20): this file originally hardcoded the literal x-cron-secret value here,
-- which GitGuardian flagged as a high-entropy secret exposed on GitHub -- correctly, since this file
-- is in a public repo. Fixed by rotating the secret AND no longer storing the plaintext anywhere
-- that could ever be committed: the job now looks it up from Supabase Vault at run time instead
-- (`vault.create_secret('<new value>', 'telegram_quiz_cron_secret', '...')`, run once, interactively,
-- directly against the live project -- never pasted into a file). See
-- sql/add_get_vault_secret_rpc.sql for how the edge function reads the same secret back out.
SELECT cron.schedule(
  'post-telegram-quiz-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zghoanrwgihlefgmqmrr.supabase.co/functions/v1/post-telegram-quiz',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_quiz_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
