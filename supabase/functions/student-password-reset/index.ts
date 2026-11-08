// Evolve+ — Supabase Edge Function: student-password-reset
//
// Sends a password-reset LINK to a student through Brevo (the same route the sign-up codes use),
// instead of relying on Supabase Auth's own SMTP settings.
//
// Deployed with verify_jwt = false: the caller is a student who is locked out, so there is no sign-in
// to check. The protections are: a 60-second cooldown and a 5-per-hour cap per address (counted from
// email_log), an allow-list for the redirect address, and answers that are identical for known and
// unknown addresses. The reset link is never returned to the browser; it is only emailed.
//
// Body:    { email: string, redirect_to?: string }
// Returns: 200 { success: true }                         (sent, or nothing to send for this address)
//          429 { success: false, code: 'cooldown', retry_after: <seconds> }
//          400 / 500 { success: false, error: string }
//
// Secrets used: BREVO_API_KEY (already set for send-email). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
// Sender name/address come from app_settings key 'auth_settings' (brevo.senderEmail / senderName /
// replyTo), the same place the admin edits them for the other emails. The wording comes from the
// email_templates row 'password_reset_link' if present, otherwise from the default below.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TEMPLATE_KEY = 'password_reset_link';
const COOLDOWN_SECONDS = 60;
const HOURLY_CAP = 5;
const DEFAULT_REDIRECT = 'https://evolveplus.in/';
const ALLOWED_ORIGINS = ['https://evolveplus.in', 'https://www.evolveplus.in'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_TEMPLATE = {
  subject: 'Reset your {{portal_name}} password',
  html_body:
    '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">' +
    '<h2 style="margin:0 0 12px">Reset your password</h2>' +
    '<p style="margin:0 0 8px;color:#475569">Hi {{name}},</p>' +
    '<p style="margin:0 0 16px;color:#475569">Tap the button to choose a new password for your {{portal_name}} account.</p>' +
    '<p style="margin:0 0 16px"><a href="{{reset_link}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Set a new password</a></p>' +
    '<p style="margin:0 0 8px;color:#64748b;font-size:13px">This link works once and expires soon, usually within an hour. If you ask for another email, only the newest link works.</p>' +
    '<p style="margin:0 0 8px;color:#64748b;font-size:13px">If the button does not open, copy this address into your browser:<br><span style="word-break:break-all">{{reset_link}}</span></p>' +
    '<p style="margin:0 0 8px;color:#64748b;font-size:13px">If you did not ask for this, you can ignore this email. Your password stays the same.</p>' +
    '<p style="color:#94a3b8;font-size:12px;margin-top:24px">— {{portal_name}} team</p></div>',
  text_body:
    'Hi {{name}},\nSet a new password for your {{portal_name}} account: {{reset_link}}\n' +
    'The link works once and expires soon. If you did not ask for this, ignore this email.',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function render(str: string, vars: Record<string, string>): string {
  return String(str || '').replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, k) => (vars[k] != null ? vars[k] : ''));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeRedirect(raw: unknown): string {
  try {
    const u = new URL(String(raw || ''));
    if (ALLOWED_ORIGINS.includes(u.origin)) return u.origin + u.pathname;
  } catch { /* fall through */ }
  return DEFAULT_REDIRECT;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ success: false, error: 'Enter a valid email address.' }, 400);
  }
  const redirectTo = safeRedirect(payload?.redirect_to);

  const brevoKey = Deno.env.get('BREVO_API_KEY');
  if (!brevoKey) return json({ success: false, error: 'Email is not configured on the server.' }, 500);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  // 1. Rate limits, counted from the send log (successful sends only).
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data: recent, error: recentErr } = await supabase
    .from('email_log')
    .select('sent_at')
    .eq('recipient', email)
    .eq('template_key', TEMPLATE_KEY)
    .eq('status', 'sent')
    .gte('sent_at', hourAgo)
    .order('sent_at', { ascending: false });
  if (recentErr) {
    console.error('email_log lookup failed:', recentErr.message);
    return json({ success: false, error: 'Could not check recent requests. Please try again.' }, 500);
  }
  if (recent && recent.length) {
    const sinceLast = (Date.now() - new Date(recent[0].sent_at).getTime()) / 1000;
    if (sinceLast < COOLDOWN_SECONDS) {
      return json({ success: false, code: 'cooldown', retry_after: Math.ceil(COOLDOWN_SECONDS - sinceLast) }, 429);
    }
    if (recent.length >= HOURLY_CAP) {
      return json({ success: false, code: 'cooldown', retry_after: 900 }, 429);
    }
  }

  // 2. Who is this? Unknown or deactivated accounts get the same "success" answer and no email.
  const { data: student } = await supabase
    .from('students')
    .select('name, status')
    .eq('email', email)
    .maybeSingle();
  if (student && student.status && student.status !== 'active') return json({ success: true });

  // 3. Ask Supabase Auth for a one-time recovery link. It is only ever emailed, never returned.
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });
  if (linkErr || !link?.properties?.action_link) {
    const notFound = (linkErr as any)?.code === 'user_not_found' || (linkErr as any)?.status === 404;
    if (notFound) return json({ success: true });
    console.error('generateLink failed:', linkErr?.message);
    return json({ success: false, error: 'Could not create the reset link. Please try again.' }, 500);
  }
  const resetLink: string = link.properties.action_link;

  // 4. Sender and wording.
  const { data: settingRow } = await supabase.from('app_settings').select('value').eq('key', 'auth_settings').maybeSingle();
  const brevo = (settingRow?.value as any)?.brevo || {};
  const senderEmail: string = brevo.senderEmail || 'info@evolveplus.in';
  const senderName: string = brevo.senderName || 'Evolve+';
  const replyTo: string = brevo.replyTo || '';

  const { data: tplRow } = await supabase
    .from('email_templates')
    .select('subject, html_body, text_body')
    .eq('template_key', TEMPLATE_KEY)
    .maybeSingle();
  const tpl = {
    subject: tplRow?.subject || DEFAULT_TEMPLATE.subject,
    html_body: tplRow?.html_body || DEFAULT_TEMPLATE.html_body,
    text_body: tplRow?.text_body || DEFAULT_TEMPLATE.text_body,
  };

  const name = (student?.name as string) || email.split('@')[0];
  const textVars = { portal_name: senderName, name, reset_link: resetLink, email };
  const htmlVars = { ...textVars, name: escapeHtml(name), portal_name: escapeHtml(senderName), reset_link: escapeHtml(resetLink) };
  const subject = render(tpl.subject, textVars);
  const htmlBody = render(tpl.html_body, htmlVars);
  const textBody = render(tpl.text_body, textVars);

  // 5. Send through Brevo and log it (the log never stores the link).
  const brevoBody: Record<string, unknown> = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email }],
    subject,
    htmlContent: htmlBody,
    textContent: textBody,
  };
  if (replyTo) brevoBody.replyTo = { email: replyTo };

  let messageId: string | null = null;
  let errorMsg: string | null = null;
  let success = false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': brevoKey, 'content-type': 'application/json' },
      body: JSON.stringify(brevoBody),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      success = true;
      messageId = data?.messageId || null;
    } else {
      errorMsg = data?.message || `Brevo returned HTTP ${res.status}`;
    }
  } catch (err) {
    errorMsg = (err as Error)?.message || String(err);
  }

  try {
    await supabase.from('email_log').insert({
      recipient: email,
      subject,
      template_key: TEMPLATE_KEY,
      status: success ? 'sent' : 'failed',
      message_id: messageId,
      error: errorMsg,
    });
  } catch (logErr) {
    console.error('Failed to write email_log row:', logErr);
  }

  if (!success) return json({ success: false, error: 'The email could not be sent. Please try again in a few minutes.' }, 502);
  return json({ success: true });
});
