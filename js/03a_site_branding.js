    /* ----------------------------------------------------
       SITE BRANDING (logo + name + tagline shown top-left in the header on
       every page). Cloud-synced through the same generic app_settings
       key/value store as pricingMaster/authSettings/featureAccess above —
       no new table needed.
    ----------------------------------------------------- */
    let siteBranding = { name: 'EVOLVE+', tagline: 'Transform Potential into Performance', logoImageDataUrl: '', pdfWatermarkImageDataUrl: '', socialLinks: {} };

    // Real brand marks (exact path data from simple-icons, viewBox 0 0 24 24) instead of emoji --
    // emoji glyphs render differently (or not recognizably at all -- 👍 for Facebook, a generic
    // bird for Twitter/X) across OS/browser combinations, which is exactly why the footer icons
    // looked "bad and unidentifiable". `fill="currentColor"` so each one picks up the surrounding
    // link's text color (set below) rather than needing its own per-icon color.
    const SOCIAL_ICON_SVGS = {
      instagram: '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>',
      telegram: '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
      twitter: '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg>',
      youtube: '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>'
    };
    // Platforms shown as footer icons when the admin fills in a link for them. Keyed to match
    // siteBranding.socialLinks and the branding-social-<key> input ids below -- add a new platform
    // by adding one entry here (plus a matching SOCIAL_ICON_SVGS entry above), one input in
    // index.html, and nothing else (applySiteBranding / hydrateBrandingAdmin / saveSiteBranding all
    // loop over this list).
    const SOCIAL_PLATFORMS = [
      { key: 'instagram', label: 'Instagram', icon: SOCIAL_ICON_SVGS.instagram, placeholder: 'https://instagram.com/yourhandle' },
      { key: 'telegram',  label: 'Telegram channel', icon: SOCIAL_ICON_SVGS.telegram, placeholder: 'https://t.me/yourchannel' },
      { key: 'twitter',   label: 'Twitter / X', icon: SOCIAL_ICON_SVGS.twitter, placeholder: 'https://x.com/yourhandle' },
      { key: 'youtube',   label: 'YouTube', icon: SOCIAL_ICON_SVGS.youtube, placeholder: 'https://youtube.com/@yourchannel' },
      { key: 'facebook',  label: 'Facebook', icon: SOCIAL_ICON_SVGS.facebook, placeholder: 'https://facebook.com/yourpage' },
    ];

    // Admin can paste a bare handle/domain ("instagram.com/x" or even "@x") as well as a full URL --
    // this fills in https:// so the footer link always works without the admin needing to think
    // about it. Returns '' unchanged for a blank field.
    function normalizeSocialUrl(raw) {
      let v = (raw || '').trim();
      if (!v) return '';
      if (/^https?:\/\//i.test(v)) return v;
      v = v.replace(/^@/, '');
      return 'https://' + v;
    }

    async function fetchCloudSiteBranding() {
      const cloud = await fetchCloudAppSetting('site_branding');
      if (cloud) siteBranding = { ...siteBranding, ...cloud };
      applySiteBranding();
      hydrateBrandingAdmin();
    }

    // Repaints the actual header (name, tagline, logo) from the current siteBranding state —
    // called on boot, on every keystroke in the admin fields (live preview), and after a save.
    function applySiteBranding() {
      const nameEl = document.getElementById('site-brand-name');
      const tagEl = document.getElementById('site-brand-tagline');
      if (!nameEl || !tagEl) return;
      const name = siteBranding.name || 'EVOLVE+';
      nameEl.innerHTML = name === 'EVOLVE+'
        ? '<span class="text-white">EVOLVE</span><span class="text-amber-400">+</span>'
        : escapeHtml(name);
      tagEl.textContent = siteBranding.tagline || '';
      tagEl.classList.toggle('hidden', !siteBranding.tagline);

      const textEl = document.getElementById('site-logo-text');
      const imgEl = document.getElementById('site-logo-img');
      if (siteBranding.logoImageDataUrl) {
        imgEl.src = siteBranding.logoImageDataUrl;
        imgEl.classList.remove('hidden');
        textEl.classList.add('hidden');
      } else {
        imgEl.classList.add('hidden');
        imgEl.src = '';
        textEl.classList.remove('hidden');
      }

      renderSocialLinks();
    }

    // Paints the footer "follow us" icon row from siteBranding.socialLinks -- one <a> per platform
    // that has a link configured, the whole row hidden when none are set.
    function renderSocialLinks() {
      const box = document.getElementById('site-social-links');
      if (!box) return;
      const links = siteBranding.socialLinks || {};
      const active = SOCIAL_PLATFORMS.filter(p => links[p.key]);
      box.innerHTML = active.map(p => `<a href="${escapeHtml(links[p.key])}" target="_blank" rel="noopener" aria-label="${escapeHtml(p.label)}" title="${escapeHtml(p.label)}" class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition">${p.icon}</a>`).join('');
      box.classList.toggle('hidden', !active.length);
    }

    // Fills the admin form fields from the current siteBranding state (called when the panel is
    // opened, and right after the cloud copy arrives, so a second admin's changes aren't clobbered).
    function hydrateBrandingAdmin() {
      const nameInput = document.getElementById('branding-name');
      const tagInput = document.getElementById('branding-tagline');
      if (!nameInput) return;  // panel not in the DOM yet on first boot call — fine, applySiteBranding() already ran
      nameInput.value = siteBranding.name || '';
      tagInput.value = siteBranding.tagline || '';
      renderLogoPreview();
      renderPdfWatermarkPreview();
      const links = siteBranding.socialLinks || {};
      SOCIAL_PLATFORMS.forEach(p => {
        const input = document.getElementById('branding-social-' + p.key);
        if (input) input.value = links[p.key] || '';
      });
    }

    function renderLogoPreview() {
      const img = document.getElementById('branding-logo-preview');
      const empty = document.getElementById('branding-logo-preview-empty');
      const removeBtn = document.getElementById('branding-logo-remove-btn');
      if (!img) return;
      if (siteBranding.logoImageDataUrl) {
        img.src = siteBranding.logoImageDataUrl;
        img.classList.remove('hidden');
        empty.classList.add('hidden');
        removeBtn.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
        img.src = '';
        empty.classList.remove('hidden');
        removeBtn.classList.add('hidden');
      }
    }

    // Same read-resize-to-dataURL pattern as the hero photo / QR uploads: small so it rides along
    // with the rest of siteBranding in one app_settings row, no separate storage bucket needed.
    function handleLogoUpload(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 256;  // only ever rendered at 40px — generous headroom for retina screens
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          siteBranding.logoImageDataUrl = canvas.toDataURL('image/png');
          renderLogoPreview();
          applySiteBranding();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      input.value = '';
    }

    function removeLogoImage() {
      siteBranding.logoImageDataUrl = '';
      renderLogoPreview();
      applySiteBranding();
    }

    function renderPdfWatermarkPreview() {
      const img = document.getElementById('branding-pdfwm-preview');
      const empty = document.getElementById('branding-pdfwm-preview-empty');
      const removeBtn = document.getElementById('branding-pdfwm-remove-btn');
      if (!img) return;
      if (siteBranding.pdfWatermarkImageDataUrl) {
        img.src = siteBranding.pdfWatermarkImageDataUrl;
        img.classList.remove('hidden');
        empty.classList.add('hidden');
        removeBtn.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
        img.src = '';
        empty.classList.remove('hidden');
        removeBtn.classList.add('hidden');
      }
    }

    // Same read-resize-to-dataURL pattern as the header logo, but bigger (this is shown at ~340px
    // wide on the printed page, not 40px) and with the white/light background stripped to
    // transparent automatically, so any admin-uploaded image — logo, seal, whatever — reads as a
    // faint watermark rather than a pale rectangle, without needing to be pre-edited in Photoshop.
    function handlePdfWatermarkUpload(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 640;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const imgData = ctx.getImageData(0, 0, width, height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const minC = Math.min(d[i], d[i + 1], d[i + 2]);
              const dist = 255 - minC; // 0 for white/near-white, higher for colored/darker ink
              d[i + 3] = Math.min(255, Math.round(dist * 2.2));
            }
            ctx.putImageData(imgData, 0, 0);
          } catch (err) { /* canvas tainted (rare, local file read) — fall back to the plain image */ }
          siteBranding.pdfWatermarkImageDataUrl = canvas.toDataURL('image/png');
          renderPdfWatermarkPreview();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      input.value = '';
    }

    function removePdfWatermarkImage() {
      siteBranding.pdfWatermarkImageDataUrl = '';
      renderPdfWatermarkPreview();
    }

    async function saveSiteBranding() {
      siteBranding.name = (document.getElementById('branding-name').value || '').trim() || 'EVOLVE+';
      siteBranding.tagline = (document.getElementById('branding-tagline').value || '').trim();
      siteBranding.socialLinks = {};
      SOCIAL_PLATFORMS.forEach(p => {
        const input = document.getElementById('branding-social-' + p.key);
        const url = normalizeSocialUrl(input ? input.value : '');
        if (url) siteBranding.socialLinks[p.key] = url;
      });
      applySiteBranding();
      const ok = await saveCloudAppSetting('site_branding', siteBranding);
      const flash = document.getElementById('branding-saved');
      flash.textContent = ok ? '✓ saved' : "couldn't save";
      flash.className = ok ? 'text-xs font-bold text-emerald-600' : 'text-xs font-bold text-rose-600';
      setTimeout(() => { flash.textContent = ''; }, 2500);
    }

