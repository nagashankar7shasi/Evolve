-- Captured from the bot's Telegram channel via telegram-webhook's channel_post/edited_channel_post
-- handling -- powers the public "Channel Updates" scrolling feed page (toggled on/off from
-- Dev Console -> Site branding). Public SELECT because this is already public channel content;
-- only the webhook (service-role, bypasses RLS) ever writes to it.
CREATE TABLE IF NOT EXISTS public.channel_posts (
  id bigint PRIMARY KEY,           -- Telegram message_id (unique within the channel)
  text text NOT NULL,
  link text NOT NULL,              -- https://t.me/<channel_username>/<message_id>
  posted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY channel_posts_read ON public.channel_posts
  FOR SELECT USING (true);
