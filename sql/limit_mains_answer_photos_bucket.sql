-- Mains answer-upload now accepts a PDF scan as well as a photo (previously images only), with a
-- 10MB cap -- enforced here on the storage bucket itself (not just client-side in
-- js/06c_mains_practice.js, which a student could bypass by skipping the UI).
--
-- NOTE per CLAUDE.md: this file is a record of what was run -- it was applied directly via the
-- Supabase MCP execute_sql tool and verified against storage.buckets before this file was written,
-- not the other way around.

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
WHERE id = 'mains_answer_photos';
