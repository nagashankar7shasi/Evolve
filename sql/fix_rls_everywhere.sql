-- ============================================================
--  Evolve+ — fix "row level security" errors, comprehensively
--  Safe to run multiple times. Skips any table that doesn't
--  exist yet (won't error), and only ever widens read/write —
--  matches the app's own architecture (anon key + open RLS,
--  by design, for a solo-admin low-stakes site).
-- ============================================================

-- ---------- 1. THE ONE YOU JUST HIT: PDF Vault storage uploads ----------
-- "new row violates row-level security policy" on PDF upload happens on
-- Supabase's storage.objects table, not on pdf_vault itself — it fires the
-- moment a file is uploaded to the 'study_materials' bucket if that bucket
-- has no storage policy allowing anon inserts (or doesn't exist at all).

-- Create the bucket if it's missing (safe if it already exists)
insert into storage.buckets (id, name, public)
values ('study_materials', 'study_materials', true)
on conflict (id) do update set public = true;

-- Open policies scoped ONLY to this one bucket (does not touch any other
-- bucket's rules)
drop policy if exists "study_materials read"   on storage.objects;
drop policy if exists "study_materials insert" on storage.objects;
drop policy if exists "study_materials update" on storage.objects;
drop policy if exists "study_materials delete" on storage.objects;

create policy "study_materials read"
  on storage.objects for select
  using (bucket_id = 'study_materials');

create policy "study_materials insert"
  on storage.objects for insert
  with check (bucket_id = 'study_materials');

create policy "study_materials update"
  on storage.objects for update
  using (bucket_id = 'study_materials')
  with check (bucket_id = 'study_materials');

create policy "study_materials delete"
  on storage.objects for delete
  using (bucket_id = 'study_materials');

-- ---------- 2. Every OTHER table the app talks to ----------
-- One open policy set per table, applied only if the table exists, so this
-- never errors regardless of what's already been created on your project.
-- If a table is missing entirely, this section is a no-op for it — that's
-- a "table doesn't exist" problem, not an RLS problem; ping me with the
-- exact error text and I'll give you its CREATE TABLE too.

do $$
declare
  t text;
  tables text[] := array[
    'custom_pages', 'attempts', 'students', 'student_progress', 'tests_catalog',
    'bundles', 'nav_menu', 'pdf_vault', 'payment_orders', 'email_templates',
    'home_config'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists %I on public.%I', t || ' read', t);
      execute format('drop policy if exists %I on public.%I', t || ' insert', t);
      execute format('drop policy if exists %I on public.%I', t || ' update', t);
      execute format('drop policy if exists %I on public.%I', t || ' delete', t);

      execute format('create policy %I on public.%I for select using (true)', t || ' read', t);
      execute format('create policy %I on public.%I for insert with check (true)', t || ' insert', t);
      execute format('create policy %I on public.%I for update using (true) with check (true)', t || ' update', t);
      execute format('create policy %I on public.%I for delete using (true)', t || ' delete', t);

      raise notice 'Opened RLS policies on: %', t;
    else
      raise notice 'Skipped (table does not exist): %', t;
    end if;
  end loop;
end $$;

-- Note: app_settings and exam_categories are handled by the other SQL file
-- (fix_app_settings_exam_categories.sql) since those two also need their
-- tables CREATEd if missing, not just their policies opened.
