-- Lets the post-telegram-quiz edge function (which only ever holds the SERVICE_ROLE_KEY, never an
-- anon/user key) read the shared x-cron-secret value out of Supabase Vault without PostgREST
-- needing to expose the `vault` schema directly (Supabase doesn't expose it by default, and
-- shouldn't be made to just for this). SECURITY DEFINER so it can read vault.decrypted_secrets
-- regardless of the caller's own grants.
--
-- EXECUTE is deliberately restricted to service_role only -- Supabase's default privileges
-- auto-grant EXECUTE on every new public-schema function to anon/authenticated/service_role, so a
-- plain `REVOKE ALL ON FUNCTION ... FROM PUBLIC` is NOT enough (that only undoes the implicit PUBLIC
-- grant, not those explicit per-role ones); the per-role REVOKE below is required too, otherwise an
-- anon/authenticated client could call this RPC directly and read the secret out via the REST API.
CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = secret_name;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role;

-- The actual secret row is created once, interactively, directly against the live project -- never
-- pasted into a file that could end up in git:
--   SELECT vault.create_secret('<the real value>', 'telegram_quiz_cron_secret', 'Shared secret pg_cron sends as x-cron-secret when calling the post-telegram-quiz edge function.');
-- To rotate it later, update the existing row in place (vault.create_secret would create a second
-- row with the same name rather than replacing it) -- look up its id from `vault.secrets` by name,
-- then use vault.update_secret(id, new_value), or the Vault UI in the Supabase dashboard.
