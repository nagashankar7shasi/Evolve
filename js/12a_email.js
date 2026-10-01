    /* ----------------------------------------------------
       EMAIL: templates, delivery routing (Demo / EmailJS / Brevo via Supabase), and send log
    ----------------------------------------------------- */

    // Sensible defaults so email works before the admin edits anything.
    // Placeholders: {{otp_code}} {{expiry_minutes}} {{portal_name}} {{name}} {{email}}
    //               {{item_title}} {{amount}} {{receipt_no}} {{reject_reason}}
    const EMAIL_TEMPLATE_DEFAULTS = {
      otp_login: {
        subject: 'Your {{portal_name}} login code',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">{{portal_name}} login code</h2><p style="margin:0 0 8px;color:#475569">Use this code to sign in:</p><p style="font-size:32px;font-weight:800;letter-spacing:4px;background:#fef3c7;color:#78350f;padding:14px 20px;border-radius:12px;text-align:center;margin:16px 0">{{otp_code}}</p><p style="margin:8px 0;color:#64748b;font-size:13px">Expires in {{expiry_minutes}} minutes. If you didn\'t try to sign in, you can safely ignore this email.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— {{portal_name}} team</p></div>',
        text_body: '{{portal_name}} login code: {{otp_code}}\nExpires in {{expiry_minutes}} minutes.'
      },
      otp_signup: {
        subject: 'Verify your email for {{portal_name}}',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">Verify your email</h2><p style="margin:0 0 8px;color:#475569">Hi {{name}},</p><p style="margin:0 0 8px;color:#475569">Welcome to {{portal_name}}. Enter this code to finish creating your account:</p><p style="font-size:32px;font-weight:800;letter-spacing:4px;background:#fef3c7;color:#78350f;padding:14px 20px;border-radius:12px;text-align:center;margin:16px 0">{{otp_code}}</p><p style="margin:8px 0;color:#64748b;font-size:13px">Expires in {{expiry_minutes}} minutes.</p></div>',
        text_body: 'Hi {{name}},\nWelcome to {{portal_name}}. Verify with code: {{otp_code}}\nExpires in {{expiry_minutes}} minutes.'
      },
      otp_reset: {
        subject: 'Reset your {{portal_name}} password',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">Reset your password</h2><p style="margin:0 0 8px;color:#475569">Use this code to set a new password:</p><p style="font-size:32px;font-weight:800;letter-spacing:4px;background:#fef3c7;color:#78350f;padding:14px 20px;border-radius:12px;text-align:center;margin:16px 0">{{otp_code}}</p><p style="margin:8px 0;color:#64748b;font-size:13px">Expires in {{expiry_minutes}} minutes. If you didn\'t request this, you can safely ignore this email.</p></div>',
        text_body: 'Reset code: {{otp_code}}\nExpires in {{expiry_minutes}} minutes.'
      },
      welcome: {
        subject: 'Welcome to {{portal_name}}',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">Welcome, {{name}} 👋</h2><p style="margin:0 0 12px;color:#475569">Your {{portal_name}} account is ready. Log in any time to see your test series, planners and study notes.</p><p style="margin:0 0 12px;color:#475569">If you have any questions, just hit reply — we\'re here to help.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— {{portal_name}} team</p></div>',
        text_body: 'Hi {{name}},\nYour {{portal_name}} account is ready. Log in any time.'
      },
      payment_approved: {
        subject: 'Payment verified — {{item_title}} unlocked',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">Payment verified ✓</h2><p style="margin:0 0 8px;color:#475569">Hi {{name}},</p><p style="margin:0 0 8px;color:#475569">Your payment of <b>₹{{amount}}</b> for <b>{{item_title}}</b> is verified and access has been unlocked in your dashboard.</p><p style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px 16px;border-radius:8px;font-family:ui-monospace,monospace;font-size:13px;margin:16px 0">Receipt no: <b>{{receipt_no}}</b></p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— {{portal_name}} team</p></div>',
        text_body: 'Hi {{name}},\nYour payment of ₹{{amount}} for {{item_title}} is verified.\nReceipt no: {{receipt_no}}'
      },
      payment_rejected: {
        subject: 'Payment issue — {{item_title}}',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">We couldn\'t verify your payment</h2><p style="margin:0 0 8px;color:#475569">Hi {{name}},</p><p style="margin:0 0 8px;color:#475569">Your payment for <b>{{item_title}}</b> couldn\'t be verified.</p><p style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px 16px;border-radius:8px;margin:16px 0"><b>Reason:</b> {{reject_reason}}</p><p style="margin:0 0 8px;color:#475569">Please check the details and try again, or reply to this email and we\'ll help sort it out.</p></div>',
        text_body: 'Hi {{name}},\nWe couldn\'t verify your payment for {{item_title}}.\nReason: {{reject_reason}}'
      },
      access_granted: {
        subject: 'New access on {{portal_name}}',
        html_body: '<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">You have new access</h2><p style="margin:0 0 8px;color:#475569">Hi {{name}},</p><p style="margin:0 0 8px;color:#475569"><b>{{item_title}}</b> has been unlocked on your dashboard.</p><p style="margin:0 0 8px;color:#475569">Log in to start using it right away.</p></div>',
        text_body: 'Hi {{name}},\n{{item_title}} has been unlocked on your dashboard.'
      }
    };

    // Descriptions shown next to each template in the editor
    const EMAIL_TEMPLATE_META = {
      otp_login:        { title: 'Login OTP',           when: 'When a student signs in with a one-time code.' },
      otp_signup:       { title: 'Sign-up verification', when: 'When a new student registers and email verification is on.' },
      otp_reset:        { title: 'Password reset',      when: 'When a student clicks "Forgot password?".' },
      welcome:          { title: 'Welcome',             when: 'Sent right after a student\'s account is created. (Wired in Round 2.)' },
      payment_approved: { title: 'Payment approved',    when: 'Sent when you approve a payment claim. (Wired in Round 2.)' },
      payment_rejected: { title: 'Payment rejected',    when: 'Sent when you reject a payment claim. (Wired in Round 2.)' },
      access_granted:   { title: 'Access granted',      when: 'Sent when you manually grant access from the Access desk. (Wired in Round 2.)' }
    };

    let emailTemplates = JSON.parse(JSON.stringify(EMAIL_TEMPLATE_DEFAULTS));

    // Simple {{key}} → value substitution. Missing keys become empty strings.
    function renderTemplate(str, vars) {
      if (!str) return '';
      return String(str).replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
    }

    async function fetchCloudEmailTemplates() {
      try {
        const { data, error } = await supabaseClient.from('email_templates').select('*');
        if (error) throw error;
        if (data && data.length) {
          for (const row of data) {
            if (row.template_key) {
              emailTemplates[row.template_key] = {
                subject:   row.subject   || (EMAIL_TEMPLATE_DEFAULTS[row.template_key]?.subject   || ''),
                html_body: row.html_body || (EMAIL_TEMPLATE_DEFAULTS[row.template_key]?.html_body || ''),
                text_body: row.text_body || (EMAIL_TEMPLATE_DEFAULTS[row.template_key]?.text_body || '')
              };
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch email templates:', fmtErr(err));
      }
    }

    async function saveEmailTemplate(key, template) {
      emailTemplates[key] = { ...template };
      const { error } = await supabaseClient.from('email_templates').upsert({
        template_key: key,
        subject: template.subject,
        html_body: template.html_body,
        text_body: template.text_body || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'template_key' });
      if (error) throw error;
    }

    // Send a template through the currently-selected delivery mode.
    // Returns { success, error }.
    async function sendTemplatedEmail(templateKey, toEmail, vars) {
      const tpl = emailTemplates[templateKey] || EMAIL_TEMPLATE_DEFAULTS[templateKey];
      if (!tpl) return { success: false, error: `Unknown template: ${templateKey}` };

      const mergedVars = { portal_name: 'Evolve+', expiry_minutes: 10, ...vars };
      const subject   = renderTemplate(tpl.subject, mergedVars);
      const htmlBody  = renderTemplate(tpl.html_body, mergedVars);
      const textBody  = renderTemplate(tpl.text_body || '', mergedVars);

      const mode = authSettings.otpMode;

      if (mode === 'demo') {
        alert(`DEMO EMAIL (${templateKey})\nTo: ${toEmail}\nSubject: ${subject}\n\n${textBody || 'HTML-only body'}`);
        return { success: true };
      }

      if (mode === 'emailjs') {
        // Legacy path — only for OTP templates that already have EmailJS templates configured
        if (!templateKey.startsWith('otp_')) {
          return { success: false, error: 'EmailJS mode only supports OTP emails. Switch to Brevo for other templates.' };
        }
        try {
          const cfg = authSettings.emailjs;
          const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: cfg.serviceId,
              template_id: cfg.templateId,
              user_id: cfg.publicKey,
              template_params: { to_email: toEmail, otp_code: mergedVars.otp_code, expiry_minutes: mergedVars.expiry_minutes, portal_name: mergedVars.portal_name }
            })
          });
          if (!res.ok) throw new Error(await res.text());
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message || String(err) };
        }
      }

      if (mode === 'brevo') {
        try {
          const { data, error } = await supabaseClient.functions.invoke('send-email', {
            body: {
              to_email: toEmail,
              subject,
              html_body: htmlBody,
              text_body: textBody,
              template_key: templateKey,
              sender_email: authSettings.brevo.senderEmail,
              sender_name:  authSettings.brevo.senderName,
              reply_to:     authSettings.brevo.replyTo
            }
          });
          if (error) throw new Error(error.message || 'Edge Function call failed');
          if (data && data.success === false) throw new Error(data.error || 'Brevo rejected the message');
          return { success: true, message_id: data?.message_id };
        } catch (err) {
          return { success: false, error: err.message || String(err) };
        }
      }

      return { success: false, error: `Unknown delivery mode: ${mode}` };
    }

    // Non-blocking helper for auto-triggered emails (welcome, payment approved/rejected, access granted).
    // Never throws, never blocks the caller. Silently skipped in demo mode so admin actions don't get
    // an annoying "DEMO EMAIL" popup every time they approve a payment.
    async function sendAutoEmail(templateKey, toEmail, vars = {}) {
      if (!toEmail) return { success: false, error: 'no recipient' };
      if (authSettings.otpMode === 'demo') {
        console.log(`[email:demo] would send ${templateKey} to ${toEmail}`, vars);
        return { success: true, demo: true };
      }
      try {
        const result = await sendTemplatedEmail(templateKey, toEmail, vars);
        if (!result.success) console.warn(`[email] ${templateKey} to ${toEmail} failed:`, result.error);
        return result;
      } catch (err) {
        console.error(`[email] ${templateKey} to ${toEmail} threw:`, fmtErr(err));
        return { success: false, error: err.message || String(err) };
      }
    }

    // Best-effort display name lookup so auto-emails address the student properly.
    function displayNameFor(email, fallback) {
      const s = (studentDirectory || []).find(st => st.email === email);
      return (s && s.name) || fallback || (email ? email.split('@')[0] : 'there');
    }

    // ---------- Email admin: tabs, template editor, send log ----------
    let currentEditingTemplateKey = null;

    function setEmailTab(tab) {
      const showTemplates = tab === 'templates';
      document.getElementById('email-tab-templates').classList.toggle('hidden', !showTemplates);
      document.getElementById('email-tab-log').classList.toggle('hidden', showTemplates);
      document.getElementById('email-tab-templates-btn').classList.toggle('bg-slate-900', showTemplates);
      document.getElementById('email-tab-templates-btn').classList.toggle('text-white', showTemplates);
      document.getElementById('email-tab-log-btn').classList.toggle('bg-slate-900', !showTemplates);
      document.getElementById('email-tab-log-btn').classList.toggle('text-white', !showTemplates);
      if (tab === 'log') fetchEmailLog();
    }

    function renderEmailTemplatesAdmin() {
      const root = document.getElementById('email-templates-list');
      if (!root) return;
      root.innerHTML = Object.keys(EMAIL_TEMPLATE_DEFAULTS).map(key => {
        const meta = EMAIL_TEMPLATE_META[key] || { title: key, when: '' };
        const tpl = emailTemplates[key] || {};
        const isCustom = JSON.stringify(tpl) !== JSON.stringify(EMAIL_TEMPLATE_DEFAULTS[key]);
        return `<div class="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3 bg-white hover:border-amber-400 transition">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <b class="text-slate-900">${escapeHtml(meta.title)}</b>
              <span class="font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${escapeHtml(key)}</span>
              ${isCustom ? '<span class="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Custom</span>' : '<span class="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Default</span>'}
            </div>
            <p class="text-slate-500 text-[11px] mt-1">${escapeHtml(meta.when)}</p>
            <p class="text-slate-700 text-[11px] mt-1 truncate">Subject: <span class="font-mono">${escapeHtml(tpl.subject || '(empty)')}</span></p>
          </div>
          <button onclick="openTemplateEditor('${key}')" class="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg">Edit</button>
        </div>`;
      }).join('');
    }

    function openTemplateEditor(key) {
      const tpl = emailTemplates[key] || EMAIL_TEMPLATE_DEFAULTS[key];
      const meta = EMAIL_TEMPLATE_META[key] || { title: key, when: '' };
      currentEditingTemplateKey = key;
      document.getElementById('email-tpl-key').innerText = key;
      document.getElementById('email-tpl-title').innerText = meta.title;
      document.getElementById('email-tpl-when').innerText = meta.when;
      // Show placeholders relevant to this template
      const placeholderSet = {
        otp_login:        ['otp_code', 'expiry_minutes', 'portal_name', 'name', 'email'],
        otp_signup:       ['otp_code', 'expiry_minutes', 'portal_name', 'name', 'email'],
        otp_reset:        ['otp_code', 'expiry_minutes', 'portal_name', 'name', 'email'],
        welcome:          ['portal_name', 'name', 'email'],
        payment_approved: ['portal_name', 'name', 'email', 'item_title', 'amount', 'receipt_no'],
        payment_rejected: ['portal_name', 'name', 'email', 'item_title', 'reject_reason'],
        access_granted:   ['portal_name', 'name', 'email', 'item_title']
      };
      const vars = (placeholderSet[key] || []).map(v => `{{${v}}}`).join(' ');
      document.getElementById('email-tpl-vars').innerText = vars;
      document.getElementById('email-tpl-subject').value = tpl.subject || '';
      document.getElementById('email-tpl-html').value = tpl.html_body || '';
      document.getElementById('email-tpl-text').value = tpl.text_body || '';
      openModal('email-template-modal');
    }

    async function saveTemplateFromModal() {
      const key = currentEditingTemplateKey;
      if (!key) return;
      const tpl = {
        subject:   document.getElementById('email-tpl-subject').value,
        html_body: document.getElementById('email-tpl-html').value,
        text_body: document.getElementById('email-tpl-text').value
      };
      if (!tpl.subject || !tpl.html_body) return alert('Subject and HTML body are required.');
      try {
        await saveEmailTemplate(key, tpl);
        closeModal('email-template-modal');
        renderEmailTemplatesAdmin();
        alert('Template saved to cloud.');
      } catch (err) {
        alert('Save failed: ' + err.message);
      }
    }

    function resetTemplateToDefault() {
      const key = currentEditingTemplateKey;
      if (!key || !EMAIL_TEMPLATE_DEFAULTS[key]) return;
      if (!confirm('Reset this template to the built-in default? Your custom version will be lost after Save.')) return;
      const d = EMAIL_TEMPLATE_DEFAULTS[key];
      document.getElementById('email-tpl-subject').value = d.subject;
      document.getElementById('email-tpl-html').value = d.html_body;
      document.getElementById('email-tpl-text').value = d.text_body;
    }

    function previewTemplate() {
      const subj = document.getElementById('email-tpl-subject').value;
      const html = document.getElementById('email-tpl-html').value;
      const sampleVars = {
        otp_code: '482915', expiry_minutes: 10, portal_name: 'Evolve+',
        name: 'Aparna', email: 'aparna@example.com',
        item_title: 'KAS Prelims Full Series', amount: '999', receipt_no: 'RCP-2026-0042',
        reject_reason: 'The UTR provided could not be found on our end.'
      };
      const renderedSubject = renderTemplate(subj, sampleVars);
      const renderedHtml = renderTemplate(html, sampleVars);
      const w = window.open('', '_blank', 'width=640,height=800');
      w.document.write(`<title>Preview: ${renderedSubject}</title><body style="font-family:system-ui,sans-serif;background:#f1f5f9;margin:0;padding:20px"><div style="background:#fff;padding:14px 18px;border-bottom:1px solid #e2e8f0"><small style="color:#94a3b8">Subject:</small><br><b>${renderedSubject}</b></div><div style="background:#fff;margin-top:1px">${renderedHtml}</div></body>`);
    }

    // ---- Send log ----
    let emailLogCache = [];

    async function fetchEmailLog() {
      const status = document.getElementById('email-log-status');
      if (status) status.innerText = 'Loading…';
      try {
        const { data, error } = await supabaseClient
          .from('email_log')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        emailLogCache = data || [];
        renderEmailLog();
        if (status) status.innerText = `${emailLogCache.length} recent send${emailLogCache.length === 1 ? '' : 's'}`;
      } catch (err) {
        emailLogCache = [];
        if (status) status.innerText = 'Failed: ' + err.message;
        document.getElementById('email-log-tbody').innerHTML = `<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400">Couldn't load the log — the <code class="font-mono">email_log</code> table may not exist yet. Run the SQL migration.</td></tr>`;
      }
    }

    function renderEmailLog() {
      const tbody = document.getElementById('email-log-tbody');
      if (!tbody) return;
      const filter = (document.getElementById('email-log-filter') || {}).value || '';
      const search = ((document.getElementById('email-log-search') || {}).value || '').toLowerCase().trim();
      const rows = emailLogCache.filter(r =>
        (!filter || r.status === filter) &&
        (!search || (r.recipient || '').toLowerCase().includes(search))
      );
      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400">No sends match.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(r => {
        const when = r.sent_at ? new Date(r.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const statusClass = r.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
        const errTip = r.error ? ` title="${escapeHtml(r.error).replace(/"/g,'&quot;')}"` : '';
        return `<tr class="border-t hover:bg-slate-50">
          <td class="px-3 py-2 text-slate-500 whitespace-nowrap">${escapeHtml(when)}</td>
          <td class="px-3 py-2 font-mono text-[11px]">${escapeHtml(r.recipient || '')}</td>
          <td class="px-3 py-2"><span class="font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${escapeHtml(r.template_key || '—')}</span></td>
          <td class="px-3 py-2 text-slate-700 truncate max-w-[280px]">${escapeHtml(r.subject || '')}</td>
          <td class="px-3 py-2"><span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${statusClass}"${errTip}>${escapeHtml(r.status || '')}</span></td>
        </tr>`;
      }).join('');
    }


    const OTP_TTL_MS = 10 * 60 * 1000;      // codes expire after 10 minutes
    const OTP_MAX_TRIES = 5;                // wrong guesses allowed per code
    const OTP_RESEND_MS = 30 * 1000;        // wait between resends
    const MAX_PASSWORD_FAILS = 5;           // wrong passwords before a lockout
    const PASSWORD_LOCK_MS = 5 * 60 * 1000;

    let otpState = null;           // { email, purpose, pending, salt, codeHash, expiresAt, triesLeft, resendAt }
    let otpPurpose = 'login';      // 'login' | 'reset'
    let verifiedResetEmail = null; // set after a reset OTP is verified
    // PHASE 3c: true when verifiedResetEmail was proven via Supabase's own password-recovery link
    // (enterPasswordRecoveryMode) rather than this app's own OTP flow -- tells handleSetPassword which
    // of two very different things to do (see there). Always reset back to false once that panel is
    // left one way or another, so it never leaks into a later, unrelated OTP-based reset.
    let isNativePasswordRecovery = false;
    let postLoginAction = null;    // e.g. continue launching the test the student clicked
    let resendTimer = null;
    const passwordFails = {};

    function renderAuthSettings() {
      document.getElementById('cfg-otp-mode').value = authSettings.otpMode;
      document.getElementById('cfg-allow-signup').checked = !!authSettings.allowSignup;
      document.getElementById('cfg-show-otp-login').checked = !!authSettings.showOtpLogin;
      document.getElementById('cfg-require-signup-otp').checked = !!authSettings.requireSignupOtp;
      document.getElementById('cfg-emailjs-service').value = authSettings.emailjs.serviceId;
      document.getElementById('cfg-emailjs-template').value = authSettings.emailjs.templateId;
      document.getElementById('cfg-emailjs-key').value = authSettings.emailjs.publicKey;
      document.getElementById('cfg-brevo-sender-email').value = authSettings.brevo.senderEmail;
      document.getElementById('cfg-brevo-sender-name').value  = authSettings.brevo.senderName;
      document.getElementById('cfg-brevo-reply-to').value     = authSettings.brevo.replyTo;
      toggleDeliveryFields();
      applyAuthModeToLoginModal();  // reflect changes immediately in the modal
    }

    function readAuthSettingsForm() {
      return {
        otpMode: document.getElementById('cfg-otp-mode').value,
        allowSignup: document.getElementById('cfg-allow-signup').checked,
        showOtpLogin: document.getElementById('cfg-show-otp-login').checked,
        requireSignupOtp: document.getElementById('cfg-require-signup-otp').checked,
        emailjs: {
          serviceId: document.getElementById('cfg-emailjs-service').value.trim(),
          templateId: document.getElementById('cfg-emailjs-template').value.trim(),
          publicKey: document.getElementById('cfg-emailjs-key').value.trim()
        },
        brevo: {
          senderEmail: document.getElementById('cfg-brevo-sender-email').value.trim(),
          senderName:  document.getElementById('cfg-brevo-sender-name').value.trim() || 'Evolve+',
          replyTo:     document.getElementById('cfg-brevo-reply-to').value.trim()
        }
      };
    }

    // Show only the provider config box that matches the selected delivery mode
    function toggleDeliveryFields() {
      const mode = document.getElementById('cfg-otp-mode').value;
      document.getElementById('cfg-emailjs-box').style.display = (mode === 'emailjs') ? '' : 'none';
      document.getElementById('cfg-brevo-box').style.display   = (mode === 'brevo')   ? '' : 'none';
    }
    // Legacy alias in case anything still calls it
    const toggleEmailjsFields = toggleDeliveryFields;

    // Show/hide OTP-related bits of the login modal per admin settings
    function applyAuthModeToLoginModal() {
      const otpAlt = document.getElementById('otp-login-alt-wrap');
      if (otpAlt) otpAlt.classList.toggle('hidden', !authSettings.showOtpLogin);
    }

    // Cloud sync for authSettings (OTP mode, Brevo sender). Same rationale as pricingMaster above —
    // configure Brevo on one device, and it should show up when you open admin from another.
    async function fetchCloudAuthSettings() {
      const cloud = await fetchCloudAppSetting('auth_settings');
      if (cloud) {
        authSettings = { ...authSettings, ...cloud, emailjs: { ...authSettings.emailjs, ...(cloud.emailjs||{}) }, brevo: { ...authSettings.brevo, ...(cloud.brevo||{}) } };
        localStorage.setItem('kas_auth_settings', JSON.stringify(authSettings));
        if (typeof renderAuthSettings === 'function') renderAuthSettings();
        applyAuthModeToLoginModal();
      }
    }

    function saveAuthSettings() {
      const next = readAuthSettingsForm();
      if (next.otpMode === 'emailjs') {
        const cfg = next.emailjs;
        if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey)
          return alert('Fill in the EmailJS Service ID, Template ID and Public Key, or switch OTP delivery to another mode.');
      }
      if (next.otpMode === 'brevo') {
        if (!next.brevo.senderEmail)
          return alert('Enter a verified sender email for Brevo (or switch OTP delivery back to Demo).');
      }
      authSettings = next;
      localStorage.setItem('kas_auth_settings', JSON.stringify(authSettings));
      saveCloudAppSetting('auth_settings', authSettings).then(ok => {
        if (!ok) console.warn('Login settings saved locally but cloud sync failed — will retry next save.');
      });
      applyAuthModeToLoginModal();
      alert('Login settings saved.');
    }

    async function sendTestOtpEmail() {
      const to = normalizeEmail(document.getElementById('cfg-test-email').value);
      if (!to) return alert('Enter an email address to send the test code to.');

      // The test uses whatever's on the form right now, so the admin can try new settings before saving.
      const savedSettings = authSettings;
      authSettings = readAuthSettingsForm();
      // Merge the sub-objects properly so we don't lose defaults
      authSettings.emailjs = { ...savedSettings.emailjs, ...authSettings.emailjs };
      authSettings.brevo   = { ...savedSettings.brevo,   ...authSettings.brevo };

      if (authSettings.otpMode === 'demo') {
        authSettings = savedSettings;
        return alert('Switch OTP delivery to Brevo or EmailJS first.');
      }
      try {
        await deliverOtp(to, '123456', { purpose: 'login' });
        alert(`Test code 123456 sent to ${to}. Check the inbox (and spam folder).`);
      } catch (err) {
        alert(`The email could not be sent: ${err.message}`);
      } finally {
        authSettings = savedSettings; // don't persist the transient form values
      }
    }

    // ---- Crypto helpers ----
    function bufToHex(buf) {
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function randomHex(bytes) {
      const arr = new Uint8Array(bytes);
      crypto.getRandomValues(arr);
      return bufToHex(arr);
    }
    function generateOtp() {
      return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    }
    // Fallback for pages served over plain http, where crypto.subtle is unavailable
    function weakHash(str) {
      let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
    }
    async function sha256Hex(text) {
      if (window.crypto && crypto.subtle) {
        return bufToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
      }
      return weakHash(text);
    }
    async function hashPassword(password, salt) {
      if (window.crypto && crypto.subtle) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
        return 'pbkdf2$' + bufToHex(bits);
      }
      let h = salt + password;
      for (let i = 0; i < 2000; i++) h = weakHash(h + salt + password);
      return 'weak$' + h;
    }

    // ---- Modal helpers ----
    function showAuthMessage(text, type = 'error') {
      const el = document.getElementById('auth-msg');
      const styles = {
        error: 'bg-rose-50 text-rose-800 border-rose-200',
        success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        info: 'bg-slate-50 text-slate-700 border-slate-200'
      };
      el.className = `mb-4 p-2.5 rounded-lg border text-xs ${styles[type] || styles.info}`;
      el.innerText = text;
    }
    function clearAuthMessage() {
      const el = document.getElementById('auth-msg');
      el.className = 'hidden';
      el.innerText = '';
    }
    function showAuthPanel(name) {
      if (name === 'signup' && !authSettings.allowSignup) {
        showAuthMessage('New accounts are created by the academy. Please contact us to register.', 'info');
        return;
      }
      document.querySelectorAll('.auth-panel').forEach(p => p.classList.add('hidden'));
      const panel = document.getElementById('auth-panel-' + name);
      panel.classList.remove('hidden');
      clearAuthMessage();
      const first = panel.querySelector('input:not([type=hidden])');
      if (first) setTimeout(() => first.focus(), 30);
    }
    function setBusy(buttonId, busy, busyText) {
      const btn = document.getElementById(buttonId);
      if (!btn) return;
      if (busy) { btn.dataset.label = btn.innerText; btn.innerText = busyText; btn.disabled = true; }
      else { btn.innerText = btn.dataset.label || btn.innerText; btn.disabled = false; }
    }

    function openLoginModal(message, afterLogin) {
      postLoginAction = afterLogin || null;
      document.getElementById('auth-signup-link').classList.toggle('hidden', !authSettings.allowSignup);
      applyAuthModeToLoginModal();
      showAuthPanel('login');
      if (message) showAuthMessage(message, 'info');
      openModal('student-login-modal');
    }

    // ---- Password login ----
    async function handlePasswordLogin(e) {
      e.preventDefault();
      const email = normalizeEmail(document.getElementById('auth-login-email').value);
      const password = document.getElementById('auth-login-pass').value;

      const fails = passwordFails[email];
      if (fails && fails.lockUntil > Date.now()) {
        const mins = Math.ceil((fails.lockUntil - Date.now()) / 60000);
        return showAuthMessage(`Too many wrong passwords. Try again in ${mins} minute(s), or log in with an OTP.`);
      }

      // PHASE 3, dual-path: try the real Supabase Auth session first. This is the ONLY real password
      // check as of PHASE 3b -- an account that has activated the new login succeeds or fails right
      // here, with the database itself as the source of truth.
      const viaSupabase = await trySupabaseStudentLogin(email, password);
      if (viaSupabase) return;

      // PHASE 3b: `students` SELECT is now scoped to "your own row" -- an anonymous request like this
      // one can no longer read a row (or its password_hash) to check it client-side, so the client-side
      // legacy hash comparison this used to do here is gone. student_login_precheck() is a narrow
      // SECURITY DEFINER RPC that reports just enough (exists / blocked / migrated) to route correctly
      // without ever exposing the row itself.
      const pre = await studentLoginPrecheck(email);
      if (!pre.row_exists) {
        return showAuthMessage(authSettings.allowSignup
          ? 'No account found for this email. Check the spelling, or create an account.'
          : 'No account found for this email. Please contact the academy to register.');
      }
      if (pre.blocked) return showAuthMessage('This account has been deactivated. Please contact the academy.');

      if (pre.migrated) {
        // Already on real Supabase Auth, and the signInWithPassword attempt above already was the
        // authoritative check for this account -- getting here means the password was simply wrong.
        const f = passwordFails[email] = passwordFails[email] || { count: 0, lockUntil: 0 };
        f.count++;
        if (f.count >= MAX_PASSWORD_FAILS) {
          f.count = 0;
          f.lockUntil = Date.now() + PASSWORD_LOCK_MS;
          return showAuthMessage('Too many wrong passwords. Try again in 5 minutes, or use "Forgot password?".');
        }
        return showAuthMessage(`Incorrect password. ${MAX_PASSWORD_FAILS - f.count} attempt(s) left.`);
      }

      // Not migrated yet (either a legacy password was never activated onto real Supabase Auth, or no
      // password was ever set at all -- e.g. an admin-pre-created row). Either way there's no longer a
      // client-readable password to compare against, so route through the one-time OTP-verified reset:
      // it verifies the email over OTP and, in handleSetPassword, creates the real Supabase Auth account
      // from a fresh password.
      startOtpFlow('reset', email);
      showAuthMessage("For your security, please verify your email and set your password again — a one-time step.", 'info');
    }

    // ---- OTP: request, deliver, verify ----
    function startOtpFlow(purpose, email) {
      otpPurpose = purpose;
      document.getElementById('auth-otp-request-title').innerText = purpose === 'reset' ? 'Reset your password' : 'Log in with OTP';
      document.getElementById('auth-otp-request-desc').innerText = purpose === 'reset'
        ? "Enter your account email and we'll send a 6-digit code to reset your password."
        : "Enter your account email and we'll send a 6-digit code to log you in.";
      document.getElementById('auth-otp-email').value = email || document.getElementById('auth-login-email').value || '';
      showAuthPanel('otp-request');
    }

    async function handleOtpRequest(e) {
      e.preventDefault();
      const email = normalizeEmail(document.getElementById('auth-otp-email').value);
      // PHASE 3b: this runs anonymously, before any OTP has been sent, so `students` SELECT (now
      // scoped to "your own row") can't be read directly here -- same precheck RPC as handlePasswordLogin.
      const pre = await studentLoginPrecheck(email);
      if (!pre.row_exists) return showAuthMessage('No account found for this email. Check the spelling, or create an account.');
      if (pre.blocked) return showAuthMessage('This account has been deactivated. Please contact the academy.');

      // PHASE 3c: an already-migrated account's real password lives entirely in Supabase Auth -- this
      // app has never had a way to verify a code against it (this app's own OTP is only ever checked
      // client-side, in memory, which is fine for proving email ownership but was never a mechanism
      // that could touch an existing Supabase Auth password). For a migrated account, whether they
      // clicked "Forgot password?" or "Log in with OTP", what they actually need either way is
      // Supabase's own password-recovery email -- clicking its link is what lands back here via
      // enterPasswordRecoveryMode (see restoreSupabaseSession) with a session real enough to set a new
      // password from. Not-yet-migrated accounts have no Supabase Auth password to recover yet, so they
      // keep using this app's own OTP flow below (which is also how they migrate in the first place).
      if (pre.migrated) {
        setBusy('auth-send-otp-btn', true, 'Sending…');
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        });
        setBusy('auth-send-otp-btn', false);
        if (error) {
          console.error('resetPasswordForEmail failed:', fmtErr(error));
          return showAuthMessage("We couldn't send the reset email. Please try again or contact the academy.");
        }
        return showAuthMessage('Check your email for a password reset link.', 'info');
      }

      setBusy('auth-send-otp-btn', true, 'Sending…');
      await sendOtp(email, otpPurpose);
      setBusy('auth-send-otp-btn', false);
    }

    // deliverOtp is now a thin wrapper: it picks the right template for the OTP purpose
    // and routes through sendTemplatedEmail, which handles Demo / EmailJS / Brevo modes.
    async function deliverOtp(email, code, opts = {}) {
      const purpose = opts.purpose || 'login';
      const templateKey = purpose === 'signup' ? 'otp_signup' : (purpose === 'reset' ? 'otp_reset' : 'otp_login');
      const vars = {
        otp_code: code,
        expiry_minutes: Math.round(OTP_TTL_MS / 60000),
        name: opts.name || (email ? email.split('@')[0] : 'there'),
        email
      };
      const result = await sendTemplatedEmail(templateKey, email, vars);
      if (!result.success) throw new Error(result.error || 'delivery failed');
    }

    async function sendOtp(email, purpose, pending = null) {
      if (otpState && otpState.email === email && Date.now() < otpState.resendAt) {
        const secs = Math.ceil((otpState.resendAt - Date.now()) / 1000);
        showAuthMessage(`Please wait ${secs} seconds before requesting another code.`);
        return false;
      }
      const code = generateOtp();
      const salt = randomHex(8);
      const nextState = {
        email, purpose, pending, salt,
        codeHash: await sha256Hex(salt + code),
        expiresAt: Date.now() + OTP_TTL_MS,
        triesLeft: OTP_MAX_TRIES,
        resendAt: Date.now() + OTP_RESEND_MS
      };
      try {
        await deliverOtp(email, code, { purpose, name: pending && pending.name });
      } catch (err) {
        showAuthMessage(`We couldn't send the code (${err.message}). Please try again or contact the academy.`);
        return false;
      }
      otpState = nextState;

      document.getElementById('auth-otp-sent-to').innerText = email;
      document.getElementById('auth-otp-code').value = '';
      showAuthPanel('otp-verify');
      const demoBox = document.getElementById('auth-demo-otp');
      // FIX: this used to only hide the demo box for 'emailjs' mode, leaving it visible (showing the
      // raw code on-screen) for Brevo too — even though Brevo had already sent a real email. That
      // produced the "shows a demo screen and also triggers a mail" confusion. Now it only shows for
      // genuine demo mode.
      if (authSettings.otpMode === 'demo') {
        demoBox.innerHTML = `Demo mode, email delivery isn't set up yet. Your code is <b class="font-mono text-sm">${code}</b>`;
        demoBox.classList.remove('hidden');
      } else {
        demoBox.classList.add('hidden');
      }
      startResendCountdown();
      return true;
    }

    function startResendCountdown() {
      const btn = document.getElementById('auth-resend-btn');
      clearInterval(resendTimer);
      const tick = () => {
        const left = otpState ? Math.ceil((otpState.resendAt - Date.now()) / 1000) : 0;
        if (left > 0) {
          btn.disabled = true;
          btn.innerText = `Resend code (${left}s)`;
        } else {
          btn.disabled = false;
          btn.innerText = 'Resend code';
          clearInterval(resendTimer);
        }
      };
      tick();
      resendTimer = setInterval(tick, 1000);
    }

    async function resendOtp() {
      if (!otpState) return showAuthPanel('otp-request');
      await sendOtp(otpState.email, otpState.purpose, otpState.pending);
    }

    async function handleOtpVerify(e) {
      e.preventDefault();
      if (!otpState) return showAuthMessage('Please request a new code.');
      if (Date.now() > otpState.expiresAt) return showAuthMessage('This code has expired. Tap "Resend code" to get a new one.');

      const code = document.getElementById('auth-otp-code').value.replace(/\D/g, '');
      if (code.length !== 6) return showAuthMessage('Enter the 6-digit code.');

      const ok = (await sha256Hex(otpState.salt + code)) === otpState.codeHash;
      if (!ok) {
        otpState.triesLeft--;
        if (otpState.triesLeft <= 0) {
          otpState.expiresAt = 0;
          return showAuthMessage('Too many wrong codes. Tap "Resend code" to get a new one.');
        }
        return showAuthMessage(`That code isn't right. ${otpState.triesLeft} attempt(s) left.`);
      }

      const { email, purpose, pending } = otpState;
      otpState = null;
      clearInterval(resendTimer);

      // PHASE 3b: "Log in with OTP" no longer logs the student straight in on a bare legacy session --
      // that path never created a real Supabase Auth session (see the old PHASE 3 comment this
      // replaced), which broke outright once `students` SELECT became scoped to "your own row": an
      // anonymous getStudentRecord() lookup here always comes back empty pre-login by definition. OTP
      // has proven the student owns this email either way, so 'login' now folds into the exact same
      // "confirm/set a password" step as 'reset' -- that's also the one moment this app safely creates
      // or refreshes a real Supabase Auth session, via handleSetPassword -> student_upsert_credentials.
      if (purpose === 'reset' || purpose === 'login') {
        verifiedResetEmail = email;
        document.getElementById('auth-setpass-email').innerText = email;
        document.getElementById('auth-new-pass').value = '';
        document.getElementById('auth-new-pass2').value = '';
        showAuthPanel('set-password');
      } else if (purpose === 'signup') {
        await completeSignup(email, pending.name, pending.passwordSalt, pending.passwordHash, true, pending.password);
      }
    }

    // Extracted so signup can also happen without OTP verification when the admin disables that step.
    // plainPassword is the password as the student just typed it -- PHASE 3 uses it, right here at
    // account-creation time, to also create their real Supabase Auth account (it's optional/undefined
    // for any legacy caller that doesn't have it, and signup just falls back to the local-only account).
    async function completeSignup(email, name, passwordSalt, passwordHash, emailVerified, plainPassword) {
      // PHASE 3b: whether this claims an admin-pre-created row (keeping its existing access) or creates
      // a brand-new one is now decided atomically, server-side, by student_upsert_credentials -- it
      // never touches an entitlement column either way. We no longer read the row first: `students`
      // SELECT is scoped to "your own row", so an anonymous pre-login read would always come back empty
      // here regardless of whether an account actually exists (the caller -- handleSignup -- already
      // ran the precheck RPC before starting the OTP round trip that led here).
      //
      // PHASE 3: a brand-new signup has no legacy password to migrate away from, so there's no need to
      // force a separate reset step later -- create the real Supabase Auth account right now, while we
      // still have the plaintext password in hand.
      let synced = false;
      if (plainPassword) {
        synced = await syncSupabaseAuthAccount(email, plainPassword);
      }

      const row = await studentUpsertCredentials(email, passwordHash, passwordSalt, name, synced);
      if (!row) {
        return showAuthMessage('Something went wrong creating your account. Please try again.');
      }
      const student = mapCloudStudentRow(row);
      student.emailVerified = !!emailVerified;
      const idx = studentDirectory.findIndex(s => s.email === student.email);
      if (idx >= 0) studentDirectory[idx] = student; else studentDirectory.push(student);
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));

      renderStudentEntitlementsDesk();

      // Round 2: welcome email — non-blocking, silent in demo mode
      sendAutoEmail('welcome', email, { name: name || email.split('@')[0], email });

      if (synced && await trySupabaseStudentLogin(email, plainPassword)) return;
      loginStudent(student);
    }

    async function handleSetPassword(event) {
      // BUG FIX: this was `e.preventDefault()` while the parameter is named `event` — a plain
      // ReferenceError thrown on every single submission, before any password-setting logic ran.
      // This is the "password reset showing an error" report — the feature has never worked.
      event.preventDefault();
      if (!verifiedResetEmail) return showAuthPanel('login');
      const p1 = document.getElementById('auth-new-pass').value;
      const p2 = document.getElementById('auth-new-pass2').value;
      if (p1.length < 8) return showAuthMessage('Use at least 8 characters.');
      if (p1 !== p2) return showAuthMessage("The two passwords don't match.");

      const email = verifiedResetEmail;
      const wasNativeRecovery = isNativePasswordRecovery;
      isNativePasswordRecovery = false; // never leaks into a later, unrelated reset

      // PHASE 3c: an already-migrated student who forgot their (post-migration) password got here by
      // clicking the link from Supabase's own recovery email (enterPasswordRecoveryMode) -- Supabase
      // has already turned that click into a real, temporary session for this email, which is what lets
      // updateUser() set a brand-new password with no old one on hand. This is the actual fix for the
      // gap Phase 3b flagged and deliberately left open (syncSupabaseAuthAccount's signUp() call can
      // only ever CREATE an account, never change an existing one's password).
      if (wasNativeRecovery) {
        const { data, error } = await supabaseClient.auth.updateUser({ password: p1 });
        if (error || !data || !data.user) {
          console.error('updateUser (password recovery) failed:', fmtErr(error));
          verifiedResetEmail = null;
          return showAuthMessage('That reset link has expired or already been used. Please request a new one.');
        }
        verifiedResetEmail = null;
        // Keep the local mirror in sync (password_hash/salt are otherwise vestigial post-migration --
        // no code compares against them for login anymore -- but student_login_precheck's has_password
        // and supabase_auth_migrated should still reflect reality) -- best-effort, never blocks login.
        const passwordSalt = randomHex(16);
        const passwordHash = await hashPassword(p1, passwordSalt);
        studentUpsertCredentials(email, passwordHash, passwordSalt, null, true).catch(() => {});
        delete passwordFails[email];
        if (ADMIN_EMAILS.includes(email)) {
          // A recovery link can in principle be clicked for the admin's own address too (e.g. "forgot
          // password" done straight from the Supabase dashboard) -- route to the real admin session
          // instead of ever treating the site owner's own account as a student.
          return completeAdminLogin(data.user.email);
        }
        // The recovery session IS a real Supabase Auth session for this student already -- reuse the
        // same fresh own-row fetch applySupabaseStudentSession does on any other login, rather than
        // trying to re-authenticate with the password we just set.
        await applySupabaseStudentSession({ user: data.user });
        closeModal('student-login-modal');
        document.querySelectorAll('#student-login-modal input').forEach(i => { i.value = ''; });
        refreshUserScopedViews();
        if (document.getElementById('view-custom-page').classList.contains('hidden')) navigate('dashboard');
        return;
      }

      const passwordSalt = randomHex(16);
      const passwordHash = await hashPassword(p1, passwordSalt);

      // PHASE 3: this OTP-verified reset is also the one-time migration point onto real Supabase
      // Auth -- we've just confirmed the student owns this email (via OTP) and have their fresh
      // plaintext password in hand, so this is the one safe moment to create their Supabase Auth
      // account. This branch only ever runs for a NOT-yet-migrated account now (PHASE 3c routes an
      // already-migrated "forgot password" through the native-recovery branch above instead), so
      // syncSupabaseAuthAccount's signUp() call here is always a genuine first-time creation.
      const synced = await syncSupabaseAuthAccount(email, p1);

      // PHASE 3b: `students` SELECT is scoped to "your own row" and there's no session yet at this
      // point, so this goes through the same narrow write RPC as completeSignup -- name left untouched
      // (p_name = null), only credentials + the migration flag change.
      const row = await studentUpsertCredentials(email, passwordHash, passwordSalt, null, synced);
      if (!row) {
        return showAuthMessage('Something went wrong updating your password. Please try again.');
      }
      const student = mapCloudStudentRow(row);
      student.emailVerified = true;
      const idx = studentDirectory.findIndex(s => s.email === student.email);
      if (idx >= 0) studentDirectory[idx] = student; else studentDirectory.push(student);
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));

      verifiedResetEmail = null;
      delete passwordFails[student.email];

      // Prefer establishing a real Supabase Auth session now that the account exists; fall back to
      // the legacy local session if that somehow fails (dual-path safety net).
      if (synced && await trySupabaseStudentLogin(email, p1)) return;
      loginStudent(student);
    }

    // ---- Sign-up ----
    async function handleSignup(e) {
      e.preventDefault();
      if (!authSettings.allowSignup) return showAuthMessage('New accounts are created by the academy. Please contact us to register.');
      const name = document.getElementById('auth-signup-name').value.trim();
      const email = normalizeEmail(document.getElementById('auth-signup-email').value);
      const p1 = document.getElementById('auth-signup-pass').value;
      const p2 = document.getElementById('auth-signup-pass2').value;
      if (!name) return showAuthMessage('Enter your name.');
      if (p1.length < 8) return showAuthMessage('Use at least 8 characters for your password.');
      if (p1 !== p2) return showAuthMessage("The two passwords don't match.");

      // PHASE 3b: anonymous, pre-account -- same precheck RPC as handlePasswordLogin/handleOtpRequest,
      // since `students` SELECT no longer lets an anonymous request read a row directly. "Already has
      // credentials" now means either a real Supabase Auth account (migrated) or a legacy password hash
      // that was set but never activated (has_password) -- either way, block re-signup over it. Neither
      // set means this is either a brand-new email or an admin-pre-created row with no password ever
      // set, both of which should proceed to "claim"/create the account below, same as before.
      const pre = await studentLoginPrecheck(email);
      if (pre.row_exists && (pre.migrated || pre.has_password)) {
        return showAuthMessage('An account with this email already exists. Log in, or use "Forgot password?".');
      }
      if (pre.row_exists && pre.blocked) return showAuthMessage('This account has been deactivated. Please contact the academy.');

      const passwordSalt = randomHex(16);
      const passwordHash = await hashPassword(p1, passwordSalt);

      // If the admin turned off email verification, create the account directly and skip the OTP round trip.
      if (!authSettings.requireSignupOtp) {
        setBusy('auth-signup-btn', true, 'Creating account…');
        await completeSignup(email, name, passwordSalt, passwordHash, false, p1);
        setBusy('auth-signup-btn', false);
        return;
      }

      setBusy('auth-signup-btn', true, 'Sending code…');
      // PHASE 3: p1 (plaintext) rides along in `pending` purely so completeSignup can create the
      // real Supabase Auth account once the OTP is verified below -- it's never persisted anywhere,
      // just held in otpState for the few minutes the OTP round trip takes.
      await sendOtp(email, 'signup', { name, passwordSalt, passwordHash, password: p1 });
      setBusy('auth-signup-btn', false);
    }

    // ---- Session ----
    function loginStudent(student) {
      student.lastLoginAt = new Date().toISOString();
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));

      currentUser = { email: student.email, role: 'aspirant', name: student.name || student.email.split('@')[0] };
      localStorage.setItem('kas_user', JSON.stringify(currentUser));

      closeModal('student-login-modal');
      document.querySelectorAll('#student-login-modal input').forEach(i => { i.value = ''; });

      const after = postLoginAction;
      postLoginAction = null;
      refreshUserScopedViews();
      if (after) after();
      else if (document.getElementById('view-custom-page').classList.contains('hidden')) navigate('dashboard');
    }

    // Drop stale sessions (student deleted or deactivated since they last logged in)
    function validateSession() {
      if (!currentUser) return;
      // PHASE 1b/3: admin validity now lives entirely in the real Supabase Auth session, not a local
      // record here. restoreSupabaseSession() (part of the boot sequence, runs right after this)
      // is what actually checks that session and clears a stale local admin flag if it's gone.
      if (isAdmin()) return;
      // PHASE 3b: a real Supabase Auth student session is validated authoritatively by
      // restoreSupabaseSession() right after this runs, via a fresh fetch of the student's own row —
      // safe now that `students` SELECT is scoped to "your own row" (see applySupabaseStudentSession).
      // This function's studentDirectory lookup, by contrast, only ever sees whatever was cached in
      // localStorage from a previous page load, which for a brand-new tab or a cleared cache can be
      // empty at this exact synchronous point (this runs before any network fetch even starts) — that
      // must never be read as "this account no longer exists" and clear a real session out from under
      // the student. A session with no viaSupabaseAuth flag has no such backstop, so it's still checked
      // here exactly as before.
      if (currentUser.viaSupabaseAuth) return;
      const student = getStudentRecord(currentUser.email);
      if (!student || isStudentBlocked(student)) {
        currentUser = null;
        localStorage.removeItem('kas_user');
        return;
      }
      currentUser.email = student.email;
      currentUser.name = student.name || currentUser.name;
      localStorage.setItem('kas_user', JSON.stringify(currentUser));
    }

    // Everything that depends on who is logged in
    function refreshUserScopedViews() {
      updateAuthUI();
      renderAnnouncements();
      filterExamCategory(selectedCategory);
      renderDashboard();
      if (currentPageId && !document.getElementById('view-custom-page').classList.contains('hidden')) {
        renderDynamicCustomPage(currentPageId, { fromRoute: true });
      }
    }

    // ---- Admin + student login (PHASE 1b admin / PHASE 3 students) ----
    // Both the admin account and (as of Phase 3) student accounts are real Supabase Auth users
    // (Authentication -> Users in the Supabase Dashboard) — never a password hash stored in a table
    // the anon key can read. They share the SAME underlying Supabase Auth user table, so this file
    // tells them apart by email: ADMIN_EMAILS is the short, fixed list of addresses that are allowed
    // to open the console. Anyone else who successfully authenticates via Supabase is just a student
    // who has activated the new login (see "Student login (PHASE 3)" below) — never treated as admin,
    // no matter how they got a valid session. Keep this list in sync with the `is_admin()` Postgres
    // function in the Phase 3 SQL migration (same two addresses, same reasoning) — the two need to
    // agree, since the client uses this to decide what UI to show, and the database uses its own copy
    // to decide what a request is actually allowed to touch.
    const ADMIN_EMAILS = ['7shashank1992@gmail.com', 'nagashankar7shashi@gmail.com'];

    function isSupabaseSessionAdmin(session) {
      return !!(session && session.user && session.user.email && ADMIN_EMAILS.includes(normalizeEmail(session.user.email)));
    }

    function showAdminMessage(text, type = 'error') {
      const el = document.getElementById('admin-auth-msg');
      el.className = `mb-4 p-2.5 rounded-lg text-xs border ${type === 'error' ? 'bg-rose-950/60 border-rose-800 text-rose-200' : 'bg-slate-800 border-slate-700 text-slate-200'}`;
      el.innerText = text;
    }

    function completeAdminLogin(email) {
      currentUser = { email, role: 'admin', name: 'Master Admin', viaSupabaseAuth: true };
      localStorage.setItem('kas_user', JSON.stringify(currentUser));
      closeModal('admin-login-modal');
      document.querySelectorAll('#admin-login-modal input').forEach(i => { i.value = ''; });
      showAdminLoginForm();
      refreshUserScopedViews();
      navigate('admin');
    }

    // Sets currentUser for a student who successfully authenticated via real Supabase Auth, with NO
    // UI side effects (used both by the interactive login form and by the silent boot-time restore
    // below). Returns false if the account is blocked, in which case the caller should sign back out.
    //
    // PHASE 3b: now does a fresh, targeted fetch of this student's OWN row instead of trusting whatever
    // is already sitting in studentDirectory. That in-memory cache is populated by fetchCloudStudents(),
    // which as of Phase 3b only ever returns this same one row for a non-admin anyway (students SELECT
    // is scoped to "your own row or admin") — but it can still be stale or simply empty at the exact
    // moment this runs (a brand-new tab, a cleared cache, or fetchCloudStudents() just not having
    // resolved yet). By the time this function runs, `session` is already the live Supabase session
    // supabaseClient itself is using, so a direct `.eq('email', email)` read here is authoritative and
    // safe under that same scoped policy — this is what actually fixes a real paying student
    // momentarily appearing to have zero entitlements immediately after logging in.
    async function applySupabaseStudentSession(session) {
      const email = normalizeEmail(session.user.email);
      let student = null;
      try {
        const { data: row, error } = await supabaseClient.from('students').select('*').eq('email', email).maybeSingle();
        if (error) console.error('applySupabaseStudentSession: failed to fetch own row:', fmtErr(error));
        if (row) {
          student = mapCloudStudentRow(row);
          const idx = studentDirectory.findIndex(s => s.email === student.email);
          if (idx >= 0) studentDirectory[idx] = student; else studentDirectory.push(student);
        }
      } catch (err) {
        console.error('applySupabaseStudentSession: own-row fetch threw:', fmtErr(err));
      }
      if (!student) {
        // Either the fetch above failed outright, or it genuinely found no row -- a Supabase Auth
        // account exists for this email but there's no students row yet. The latter shouldn't normally
        // happen (signup/activation always create the row first via student_upsert_credentials), but
        // stay defensive rather than leaving currentUser half-set. Fall back to whatever's cached
        // locally first (better than nothing if this was just a transient network error), and only
        // synthesize an empty stub as a last resort.
        student = getStudentRecord(email);
      }
      if (!student) {
        student = { email, utr: 'SELF_SIGNUP', status: 'active', allowedExams: [], allowedPages: [], allowedPdfs: [], allowedPlanners: [], passes: [], passExpiry: {}, createdAt: new Date().toISOString() };
        studentDirectory.push(student);
      }
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      if (isStudentBlocked(student)) return false;
      student.lastLoginAt = new Date().toISOString();
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      currentUser = { email: student.email, role: 'aspirant', name: student.name || student.email.split('@')[0], viaSupabaseAuth: true };
      localStorage.setItem('kas_user', JSON.stringify(currentUser));
      return true;
    }

    // PHASE 3c: lands here after someone clicks the link in a native Supabase password-recovery email
    // (see handleOtpRequest's migrated-account branch below, which is what sends that email). Supabase
    // has already turned the link's token into a real, temporary session for this email by this point —
    // that's what makes updateUser() able to set a new password with no old one on hand (see
    // handleSetPassword). This deliberately does NOT log the student in yet: it only proves they own
    // the inbox the recovery link went to, not that they've actually chosen a new password, so it opens
    // straight to the "set a new password" panel and stops there.
    function enterPasswordRecoveryMode(session) {
      const email = normalizeEmail(session.user.email);
      isNativePasswordRecovery = true;
      verifiedResetEmail = email;
      openLoginModal();
      document.getElementById('auth-setpass-email').innerText = email;
      document.getElementById('auth-new-pass').value = '';
      document.getElementById('auth-new-pass2').value = '';
      showAuthPanel('set-password');
    }

    // If a real Supabase Auth session already exists on this device (admin or student, previously
    // logged in and the browser kept the session), recognize it on this load too — belt-and-braces
    // alongside the kas_user localStorage flag completeAdminLogin/the student login path already
    // write. Also clears a stale local flag left with no real session behind it — but ONLY a flag
    // that was itself set via a real Supabase session (viaSupabaseAuth): a legacy-path login (either
    // admin before Phase 1b, or a student who hasn't activated the new login yet) never had one, and
    // must not be logged out here just because supabase auth has no session for them.
    async function restoreSupabaseSession() {
      // PHASE 3c: a pending recovery session takes priority over everything below -- it must never be
      // treated as an ordinary "welcome back, you're logged in" session (which would skip straight to
      // the dashboard with the OLD password still active and no chance to set a new one).
      if (pendingPasswordRecoverySession) {
        const recoverySession = pendingPasswordRecoverySession;
        pendingPasswordRecoverySession = null;
        enterPasswordRecoveryMode(recoverySession);
        return;
      }
      const { data } = await supabaseClient.auth.getSession();
      const session = data && data.session;

      if (!session) {
        if (currentUser && currentUser.viaSupabaseAuth) {
          currentUser = null;
          localStorage.removeItem('kas_user');
        }
        return;
      }

      if (isSupabaseSessionAdmin(session)) {
        if (currentUser && currentUser.role !== 'admin') return; // never clobber a signed-in student
        if (!currentUser || currentUser.role !== 'admin' || currentUser.email !== session.user.email) {
          currentUser = { email: session.user.email, role: 'admin', name: 'Master Admin', viaSupabaseAuth: true };
          localStorage.setItem('kas_user', JSON.stringify(currentUser));
        }
        return;
      }

      // A real, non-admin Supabase session -- a student who has activated the new login.
      if (currentUser && currentUser.role === 'admin') return; // never clobber an active admin
      const email = normalizeEmail(session.user.email);
      if (!currentUser || currentUser.email !== email || !currentUser.viaSupabaseAuth) {
        await applySupabaseStudentSession(session);
      }
    }

    async function trySupabaseAuthLogin(email, password) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error || !data || !data.session) return false;
      if (!isSupabaseSessionAdmin(data.session)) {
        // A real account, but not an admin address -- not this modal's business. Sign back out so we
        // don't leave a stray session active behind the admin login screen.
        await supabaseClient.auth.signOut();
        return false;
      }
      completeAdminLogin(data.session.user.email);
      return true;
    }

    async function handleAdminLogin(e) {
      e.preventDefault();
      const u = normalizeEmail(document.getElementById('dev-user').value);
      const p = document.getElementById('dev-pass').value;
      if (await trySupabaseAuthLogin(u, p)) return;
      showAdminMessage('Wrong email or password.');
    }

    function showAdminLoginForm() {
      document.getElementById('admin-auth-msg').className = 'hidden';
    }

    // ---- Student login (PHASE 3) ----
    // Tried first on every password-login attempt (see handlePasswordLogin below); PHASE 3b retired the
    // client-side legacy hash comparison entirely, so this is now the only way a password login
    // actually succeeds -- an account that hasn't activated the real login yet gets routed through the
    // one-time OTP-verified reset instead (see handlePasswordLogin).
    async function trySupabaseStudentLogin(email, password) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error || !data || !data.session) return false;
      if (isSupabaseSessionAdmin(data.session)) {
        // The admin's own credentials typed into the student box -- not a student match. Sign back
        // out rather than silently opening the site owner's own account as "a student".
        await supabaseClient.auth.signOut();
        return false;
      }
      if (!(await applySupabaseStudentSession(data.session))) {
        await supabaseClient.auth.signOut();
        showAuthMessage('This account has been deactivated. Please contact the academy.');
        return true; // handled (blocked) -- caller must not fall through to the legacy system
      }
      closeModal('student-login-modal');
      document.querySelectorAll('#student-login-modal input').forEach(i => { i.value = ''; });
      const after = postLoginAction;
      postLoginAction = null;
      refreshUserScopedViews();
      if (after) after();
      else if (document.getElementById('view-custom-page').classList.contains('hidden')) navigate('dashboard');
      return true;
    }

    // Best-effort: create a real Supabase Auth account for this email/password pair, so the new
    // (Phase 3) login path can pick this student up. Called from two places, both deliberately
    // OTP-verified moments where we hold a fresh plaintext password: brand-new signup (completeSignup)
    // and a "Forgot password" / one-time forced reset (handleSetPassword). By design this is NOT
    // called from an ordinary legacy password login -- the user chose an explicit one-time reset over
    // a silent background upgrade, so an existing student's plain legacy login intentionally does not
    // sync an account here; handlePasswordLogin instead routes them through the OTP reset flow once,
    // which is what calls this. Never blocks or fails the caller's actual action, which has already
    // succeeded via the app's own verification by the time this runs: if this fails (most commonly
    // because a Supabase Auth account already exists for this email, e.g. a second sync attempt, and
    // changing an existing account's password needs a session we don't have here), the student keeps
    // working exactly as before via the legacy fallback until it succeeds on a later attempt.
    async function syncSupabaseAuthAccount(email, password) {
      try {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
          console.warn(`syncSupabaseAuthAccount(${email}):`, fmtErr(error));
          return false;
        }
        return true;
      } catch (err) {
        console.error(`syncSupabaseAuthAccount(${email}) threw:`, fmtErr(err));
        return false;
      }
    }

    // Quick self-service password change for a signed-in admin — no Dashboard trip needed. Supabase
    // Auth requires no "current password" here since it's already verifying via the live session.
    async function changeAdminPassword(e) {
      e.preventDefault();
      if (!isAdmin()) return;
      const p1 = document.getElementById('adm-new-pass').value;
      const p2 = document.getElementById('adm-new-pass2').value;
      if (p1.length < 10) return alert('Use at least 10 characters.');
      if (p1 !== p2) return alert("The two passwords don't match.");
      const { error } = await supabaseClient.auth.updateUser({ password: p1 });
      if (error) return alert('Could not update password: ' + error.message);
      document.getElementById('adm-new-pass').value = '';
      document.getElementById('adm-new-pass2').value = '';
      alert('Admin password updated.');
    }

    async function logout() {
      currentUser = null;
      otpState = null;
      localStorage.removeItem('kas_user');
      // Harmless no-op for a student (who never has a Supabase Auth session); ends the real admin
      // session if there is one, rather than just forgetting a local flag.
      await supabaseClient.auth.signOut();
      refreshUserScopedViews();
      navigate('home');
    }

    function updateAuthUI() {
      renderMobileMenu();
      const slot = document.getElementById('nav-auth-slot');
      const adminLink = document.getElementById('nav-admin-link');
      const dashLink = document.getElementById('nav-dashboard-link');

      if (!currentUser) {
        slot.innerHTML = `<button onclick="openLoginModal()" class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-1.5 rounded-lg font-bold text-xs transition">Aspirant Login</button>`;
        adminLink.classList.add('hidden');
        dashLink.classList.add('hidden');
      } else {
        // FIX: "My study material" felt oddly placed buried inside the dashboard. Replaced the flat
        // "name + Logout" with a proper account dropdown so profile-ish actions (entitlements,
        // password) live where people expect them — under their name in the header — rather than
        // scattered across the dashboard page.
        slot.innerHTML = `
          <div class="relative text-xs" id="account-dropdown-wrap">
            <button onclick="toggleAccountDropdown()" class="flex items-center gap-1.5 text-amber-400 font-bold hover:text-amber-300" title="${escapeHtml(currentUser.email)}">
              ● ${escapeHtml(currentUser.name)} <span class="text-[9px]">▾</span>
            </button>
            <div id="account-dropdown-menu" class="hidden absolute right-0 mt-2 w-52 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50">
              <button onclick="closeAccountDropdown(); navigate('dashboard')" class="w-full text-left px-3 py-2 hover:bg-slate-50 font-bold flex items-center gap-2">📊 Dashboard</button>
              ${!isAdmin() ? `<button onclick="closeAccountDropdown(); renderMyAccess(); openModal('my-entitlements-modal')" class="w-full text-left px-3 py-2 hover:bg-slate-50 font-bold flex items-center gap-2">📚 My Entitlements</button>
              <button onclick="closeAccountDropdown(); openLoginModal(); startOtpFlow('reset', '${escapeHtml(currentUser.email)}')" class="w-full text-left px-3 py-2 hover:bg-slate-50 font-bold flex items-center gap-2">🔑 Change Password</button>` : ''}
              ${isAdmin() ? `<button onclick="closeAccountDropdown(); navigate('admin')" class="w-full text-left px-3 py-2 hover:bg-slate-50 font-bold flex items-center gap-2">⚙️ Admin Console</button>` : ''}
              <div class="border-t my-1"></div>
              <button onclick="closeAccountDropdown(); logout()" class="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-2">🚪 Logout</button>
            </div>
          </div>
        `;
        dashLink.classList.remove('hidden');
        if (isAdmin()) adminLink.classList.remove('hidden');
        else adminLink.classList.add('hidden');
      }
    }

    function toggleAccountDropdown() {
      const menu = document.getElementById('account-dropdown-menu');
      if (!menu) return;
      menu.classList.toggle('hidden');
    }
    function closeAccountDropdown() {
      const menu = document.getElementById('account-dropdown-menu');
      if (menu) menu.classList.add('hidden');
    }
    // Click-outside-to-close, wired once at boot
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('account-dropdown-wrap');
      if (wrap && !wrap.contains(e.target)) closeAccountDropdown();
    });

