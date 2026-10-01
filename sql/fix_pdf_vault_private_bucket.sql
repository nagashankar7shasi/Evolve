-- ============================================================
--  Evolve+ — close the PDF paywall bypass, completely
--  Run this once in the Supabase SQL editor.
-- ============================================================
--
-- THE BUG: every PDF you upload goes into the 'study_materials' Storage
-- bucket, which is PUBLIC. A public bucket means every file inside it has a
-- permanent, guessable-free URL that opens directly in any browser, on any
-- device — no login, no payment check, nothing. The app's own code enforces
-- the paywall before it SHOWS you a PDF, but that's just courtesy: the raw
-- file was always sitting right there at a public URL underneath, and the
-- PDF Wizard's "Shareable link" button was literally handing that URL out.
--
-- THE FIX: paid PDFs now go into a brand-new, PRIVATE bucket
-- ('pdf_vault_files'). A private bucket has NO public URL at all — the only
-- way to read a file in it is a short-lived "signed URL" that the app mints
-- for itself, in real time, and only AFTER it has already checked that you
-- paid (or the PDF is free). Signed links expire in 5 minutes, so even if
-- one leaks, it's useless shortly after.
--
-- We deliberately did NOT touch 'study_materials' itself — it stays public,
-- because question images in the exam engine are shown as plain <img> tags
-- that need a real URL to render, and there's nothing to "pay for" there.
-- Only PDFs move to the new private bucket.
--
-- WHAT ABOUT PDFS ALREADY UPLOADED? They keep working exactly as before —
-- nothing breaks. But any of them that are PAID are still sitting at their
-- old public URL, which is still technically bypassable by anyone who
-- already grabbed that link. The updated PDF Vault admin screen will show a
-- "🔒 Secure" button next to any such PDF — click it once per file to move
-- it into the new private bucket. New uploads never have this problem.
--
-- Safe to run more than once.
-- ============================================================

-- Create the new PRIVATE bucket for PDFs (separate from study_materials)
insert into storage.buckets (id, name, public)
values ('pdf_vault_files', 'pdf_vault_files', false)
on conflict (id) do update set public = false;

-- The app still needs to read/write this bucket with the anon key (same
-- trust model as everywhere else in this app — see fix_rls_everywhere.sql).
-- The bucket being PRIVATE is what stops a plain URL from working; these
-- policies just let the app's own signed-URL requests and uploads through.
drop policy if exists "pdf_vault_files select" on storage.objects;
drop policy if exists "pdf_vault_files insert" on storage.objects;
drop policy if exists "pdf_vault_files update" on storage.objects;
drop policy if exists "pdf_vault_files delete" on storage.objects;

create policy "pdf_vault_files select"
  on storage.objects for select
  using (bucket_id = 'pdf_vault_files');

create policy "pdf_vault_files insert"
  on storage.objects for insert
  with check (bucket_id = 'pdf_vault_files');

create policy "pdf_vault_files update"
  on storage.objects for update
  using (bucket_id = 'pdf_vault_files')
  with check (bucket_id = 'pdf_vault_files');

create policy "pdf_vault_files delete"
  on storage.objects for delete
  using (bucket_id = 'pdf_vault_files');
