-- Adds an optional "published date & time" to custom pages (Word Page Editor), so a daily
-- article (current affairs, etc.) can show when it was posted, above or below the heading.
-- published_at: null means "don't show a date" -- the admin clears it to opt out.
-- date_position: where to show it relative to the page title/breadcrumb block.
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE custom_pages ADD COLUMN IF NOT EXISTS date_position text DEFAULT 'above' CHECK (date_position IN ('above', 'below'));
