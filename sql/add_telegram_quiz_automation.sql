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
-- x-cron-secret must match CRON_SECRET hardcoded in the post-telegram-quiz edge function.
SELECT cron.schedule(
  'post-telegram-quiz-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zghoanrwgihlefgmqmrr.supabase.co/functions/v1/post-telegram-quiz',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'c4f3a9d1b2e6708f5a3c1d9e7b4f2a06d8c5e3b1f7a9d2c6e4b8f1a3d5c7e9b2'
    ),
    body := '{}'::jsonb
  );
  $$
);
