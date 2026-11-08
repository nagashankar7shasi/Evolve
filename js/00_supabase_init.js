    /* ----------------------------------------------------
       SUPABASE CLOUD INITIALIZATION
    ----------------------------------------------------- */
    const SUPABASE_URL = 'https://zghoanrwgihlefgmqmrr.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_dCOeR_l-E8jaMmAXDArorQ_qllabilh';

    // Read BEFORE the client is created: supabase-js strips the token from the address bar while it
    // initialises, so this is the only reliable moment to know the page was opened from a password-reset
    // email. restoreSupabaseSession() (js/12a_email.js) uses it to always show "Set a new password"
    // for such a link, even if the client's PASSWORD_RECOVERY event fires after the first check.
    const openedFromRecoveryLink = /(^|[#&?])type=recovery(&|$)/.test((window.location.hash || '') + '&' + (window.location.search || ''));
    const openedFromExpiredLink = /error_code=otp_expired/.test((window.location.hash || '') + '&' + (window.location.search || ''));

    // Initialize the global Supabase client
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // PHASE 3c: catches Supabase's native password-recovery event the moment it fires, which can
    // happen very early (as soon as the client finishes parsing a recovery link's token out of the
    // page URL, before boot()'s own code has run) -- registered here, synchronously, right next to
    // client creation, specifically so it's never missed. Only stashed here; restoreSupabaseSession()
    // (further down, part of the normal boot sequence) is what actually acts on it, so a recovery
    // session is never mistaken for an ordinary "already logged in" session and silently dropped
    // straight onto the dashboard before the student has actually set a new password.
    let pendingPasswordRecoverySession = null;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        pendingPasswordRecoverySession = session;
      }
    });
