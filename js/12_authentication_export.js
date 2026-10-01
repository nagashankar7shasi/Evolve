    /* ----------------------------------------------------
       12. AUTHENTICATION & EXPORT
    ----------------------------------------------------- */
    // ---- Settings ----
    const initialAuthSettings = {
      otpMode: 'demo',
      allowSignup: true,
      showOtpLogin: false,
      requireSignupOtp: true,
      emailjs: { serviceId: '', templateId: '', publicKey: '' },
      brevo: { senderEmail: '', senderName: 'Evolve+', replyTo: '' }
    };
    let authSettings = (() => {
      const saved = JSON.parse(localStorage.getItem('kas_auth_settings')) || {};
      return {
        ...initialAuthSettings, ...saved,
        emailjs: { ...initialAuthSettings.emailjs, ...(saved.emailjs || {}) },
        brevo:   { ...initialAuthSettings.brevo,   ...(saved.brevo   || {}) }
      };
    })();


