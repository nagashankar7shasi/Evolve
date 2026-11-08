-- ============================================================================
--  Evolve+ — email template for the password-reset LINK
--  Used by the edge function `student-password-reset` (supabase/functions/student-password-reset),
--  which sends the link through Brevo instead of Supabase Auth's own SMTP. The admin can edit the
--  wording in Email tools > Templates; the function falls back to the same default if the row is
--  missing. Placeholders: {{portal_name}} {{name}} {{reset_link}} {{email}}
--  Safe to re-run: an existing row (and any admin edits to it) is left alone.
-- ============================================================================
INSERT INTO public.email_templates (template_key, subject, html_body, text_body, updated_at)
VALUES (
  'password_reset_link',
  'Reset your {{portal_name}} password',
  $html$<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">Reset your password</h2><p style="margin:0 0 8px;color:#475569">Hi {{name}},</p><p style="margin:0 0 16px;color:#475569">Tap the button to choose a new password for your {{portal_name}} account.</p><p style="margin:0 0 16px"><a href="{{reset_link}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Set a new password</a></p><p style="margin:0 0 8px;color:#64748b;font-size:13px">This link works once and expires soon, usually within an hour. If you ask for another email, only the newest link works.</p><p style="margin:0 0 8px;color:#64748b;font-size:13px">If the button does not open, copy this address into your browser:<br><span style="word-break:break-all">{{reset_link}}</span></p><p style="margin:0 0 8px;color:#64748b;font-size:13px">If you did not ask for this, you can ignore this email. Your password stays the same.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— {{portal_name}} team</p></div>$html$,
  E'Hi {{name}},\nSet a new password for your {{portal_name}} account: {{reset_link}}\nThe link works once and expires soon. If you did not ask for this, ignore this email.',
  now()
)
ON CONFLICT (template_key) DO NOTHING;
