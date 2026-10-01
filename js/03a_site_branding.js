    /* ----------------------------------------------------
       SITE BRANDING (logo + name + tagline shown top-left in the header on
       every page). Cloud-synced through the same generic app_settings
       key/value store as pricingMaster/authSettings/featureAccess above —
       no new table needed.
    ----------------------------------------------------- */
    let siteBranding = { name: 'EVOLVE+', tagline: 'Transform Potential into Performance', logoImageDataUrl: '', pdfWatermarkImageDataUrl: '' };

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
      applySiteBranding();
      const ok = await saveCloudAppSetting('site_branding', siteBranding);
      const flash = document.getElementById('branding-saved');
      flash.textContent = ok ? '✓ saved' : "couldn't save";
      flash.className = ok ? 'text-xs font-bold text-emerald-600' : 'text-xs font-bold text-rose-600';
      setTimeout(() => { flash.textContent = ''; }, 2500);
    }

