-- Per-category flag: when true, the student Dashboard shows a "Daily Practice" box for this
-- category -- a date dropdown (that category's papers from the last 30 days, by scheduled_for)
-- plus a one-click "Start Practice" button straight into the existing untimed/instant-feedback
-- Practice Mode engine. Defaults to false so nothing changes for existing categories until the
-- admin explicitly turns it on for e.g. "Daily PIB Current Affairs".
ALTER TABLE exam_categories ADD COLUMN IF NOT EXISTS daily_practice_box boolean NOT NULL DEFAULT false;
