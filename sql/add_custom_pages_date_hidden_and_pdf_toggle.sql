-- date_position gains a third value: 'hidden' lets the admin suppress the published-date display
-- without clearing published_at itself, so the saved timestamp survives toggling the display off
-- and back on.
ALTER TABLE custom_pages DROP CONSTRAINT custom_pages_date_position_check;
ALTER TABLE custom_pages ADD CONSTRAINT custom_pages_date_position_check CHECK (date_position IN ('above', 'below', 'hidden'));

-- Per-page control over the public "Download as PDF" button -- defaults to true (on) for both new
-- rows and existing ones, since most pages benefit from being downloadable; the admin opts specific
-- pages out (an index/landing page, something not meant to be redistributed) rather than opting in.
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS allow_pdf_download boolean NOT NULL DEFAULT true;
