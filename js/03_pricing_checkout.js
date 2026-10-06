    /* ----------------------------------------------------
       3. PRICING MASTER CONTROLLER & CHECKOUT
    ----------------------------------------------------- */
    function applyPricingLabels() {
      renderHomeBundles();
      updateCategoryBundleButton();
    }

    function renderPricingMasterSettings() {
      document.getElementById('cfg-upi-id').value = pricingMaster.upiId;
      document.getElementById('cfg-payee-name').value = pricingMaster.payeeName;
      const wa = document.getElementById('cfg-whatsapp-number');
      if (wa) wa.value = pricingMaster.whatsappNumber || '';
      const waId = document.getElementById('cfg-whatsapp-id');
      if (waId) waId.value = pricingMaster.whatsappId || '';
      const waEnabled = document.getElementById('cfg-whatsapp-enabled');
      // whatsappEnabled defaults to true for installs saved before this toggle existed (merged in
      // by the initialPricingMaster spread at load time), so this only reads false when the admin
      // has actually turned it off.
      if (waEnabled) waEnabled.checked = pricingMaster.whatsappEnabled !== false;
      const waModeRadio = document.querySelector(`input[name="cfg-whatsapp-mode"][value="${pricingMaster.whatsappMode === 'id' ? 'id' : 'number'}"]`);
      if (waModeRadio) waModeRadio.checked = true;
      const tgEnabled = document.getElementById('cfg-telegram-enabled');
      if (tgEnabled) tgEnabled.checked = !!pricingMaster.telegramEnabled;
      const tgUser = document.getElementById('cfg-telegram-username');
      if (tgUser) tgUser.value = pricingMaster.telegramUsername || '';
      renderContactConfigVisibility();
      const wm = document.getElementById('cfg-watermark-template');
      if (wm) wm.value = pricingMaster.watermarkTemplate || '';
      const diffMode = document.getElementById('cfg-difficult-mode-enabled');
      // Same default-true-unless-explicitly-off reasoning as whatsappEnabled above, for installs
      // saved before this toggle existed.
      if (diffMode) diffMode.checked = pricingMaster.difficultModeEnabled !== false;
      renderQrPreview();
      renderBundlesAdmin();
    }

    // Shows only the WhatsApp input (phone number vs ID) that matches the selected mode, and dims
    // + disables each contact's fields while its "Show ... option at checkout" box is unticked --
    // so the saved value isn't lost, it's just not being used while hidden.
    function renderContactConfigVisibility() {
      const waOn = document.getElementById('cfg-whatsapp-enabled')?.checked;
      const waMode = document.querySelector('input[name="cfg-whatsapp-mode"]:checked')?.value || 'number';
      const waFields = document.getElementById('cfg-whatsapp-fields');
      const waNumberRow = document.getElementById('cfg-whatsapp-number-row');
      const waIdRow = document.getElementById('cfg-whatsapp-id-row');
      if (waFields) {
        waFields.classList.toggle('opacity-40', !waOn);
        waFields.querySelectorAll('input').forEach(i => i.disabled = !waOn);
      }
      if (waNumberRow) waNumberRow.classList.toggle('hidden', waMode !== 'number');
      if (waIdRow) waIdRow.classList.toggle('hidden', waMode !== 'id');

      const tgOn = document.getElementById('cfg-telegram-enabled')?.checked;
      const tgFields = document.getElementById('cfg-telegram-fields');
      if (tgFields) {
        tgFields.classList.toggle('opacity-40', !tgOn);
        tgFields.querySelectorAll('input').forEach(i => i.disabled = !tgOn);
      }
    }

    // Admin may paste the whole wa.me/message/<id> link or just the bare code after it -- either
    // way the stored value is just the code, so buildWhatsAppUrl() can reassemble a clean link.
    function extractWhatsAppId(raw) {
      const v = (raw || '').trim();
      if (!v) return '';
      const m = v.match(/wa\.me\/message\/([A-Za-z0-9]+)/i);
      if (m) return m[1];
      return v.replace(/^https?:\/\//i, '').replace(/^wa\.me\//i, '');
    }

    // Admin-uploaded payment QR (as opposed to the auto-generated-from-UPI-ID one used at checkout
    // when this is blank). Follows the same FileReader -> canvas resize -> dataURL pattern used for
    // page/question images elsewhere; stored on pricingMaster so it rides along with the existing
    // localStorage + cloud (app_settings) save already wired up in savePricingMasterSettings().
    function renderQrPreview() {
      const img = document.getElementById('cfg-qr-preview');
      const empty = document.getElementById('cfg-qr-preview-empty');
      const removeBtn = document.getElementById('cfg-qr-remove-btn');
      if (!img) return;
      if (pricingMaster.qrImageDataUrl) {
        img.src = pricingMaster.qrImageDataUrl;
        img.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');
      } else {
        img.src = '';
        img.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.add('hidden');
      }
    }

    function handleQrImageUpload(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      if (!file.type || !file.type.startsWith('image/')) { alert('Please choose an image file (PNG, JPG, etc).'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          // Cap dimensions (keeps the stored/cloud-synced value small) without JPEG re-compression,
          // which can blur the fine modules of a QR code and make it unscannable.
          const maxDim = 500;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale) || img.width;
          canvas.height = Math.round(img.height * scale) || img.height;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          pricingMaster.qrImageDataUrl = canvas.toDataURL('image/png');
          renderQrPreview();
        };
        img.onerror = () => alert("That file couldn't be read as an image.");
        img.src = reader.result;
      };
      reader.onerror = () => alert("That file couldn't be read.");
      reader.readAsDataURL(file);
    }

    function removeQrImage() {
      if (!pricingMaster.qrImageDataUrl) return;
      if (!confirm('Remove the uploaded QR? Checkout will go back to an auto-generated QR from the UPI ID.')) return;
      pricingMaster.qrImageDataUrl = '';
      renderQrPreview();
    }

    // Cloud sync for pricingMaster (UPI ID, payee name, WhatsApp number). Previously localStorage-only,
    // which meant managing the site from a second device showed the placeholder UPI ID instead of the
    // real one. Follows the same "generic key/value settings" table as authSettings etc. below.
    async function fetchCloudAppSetting(key) {
      try {
        const { data, error } = await supabaseClient.from('app_settings').select('value').eq('key', key).single();
        if (error) { if (error.code !== 'PGRST116') console.error(`fetchCloudAppSetting(${key}):`, fmtErr(error)); return null; }
        return data ? data.value : null;
      } catch (err) {
        console.error(`fetchCloudAppSetting(${key}) threw:`, fmtErr(err));
        return null;
      }
    }
    async function saveCloudAppSetting(key, value) {
      try {
        const { error } = await supabaseClient.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
        if (error) throw error;
        return true;
      } catch (err) {
        console.error(`saveCloudAppSetting(${key}) failed:`, fmtErr(err));
        return false;
      }
    }

    async function fetchCloudPricingMaster() {
      const cloud = await fetchCloudAppSetting('pricing_master');
      if (cloud) {
        pricingMaster = { ...initialPricingMaster, ...cloud };
        localStorage.setItem('kas_pricing_master', JSON.stringify(pricingMaster));
        renderPricingMasterSettings();
      }
    }

    function savePricingMasterSettings() {
      pricingMaster.upiId = document.getElementById('cfg-upi-id').value.trim() || 'yourkasacademy@upi';
      pricingMaster.payeeName = document.getElementById('cfg-payee-name').value.trim() || "Evolve+";

      const waEnabled = document.getElementById('cfg-whatsapp-enabled');
      if (waEnabled) pricingMaster.whatsappEnabled = waEnabled.checked;
      const waModeChecked = document.querySelector('input[name="cfg-whatsapp-mode"]:checked');
      if (waModeChecked) pricingMaster.whatsappMode = waModeChecked.value;
      const wa = document.getElementById('cfg-whatsapp-number');
      if (wa) {
        const digits = wa.value.replace(/\D/g, '').slice(0, 10);
        pricingMaster.whatsappNumber = digits;
      }
      const waId = document.getElementById('cfg-whatsapp-id');
      if (waId) pricingMaster.whatsappId = extractWhatsAppId(waId.value);

      const tgEnabled = document.getElementById('cfg-telegram-enabled');
      if (tgEnabled) pricingMaster.telegramEnabled = tgEnabled.checked;
      const tgUser = document.getElementById('cfg-telegram-username');
      if (tgUser) pricingMaster.telegramUsername = tgUser.value.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '').replace(/[^a-zA-Z0-9_]/g, '');

      const wm = document.getElementById('cfg-watermark-template');
      if (wm) pricingMaster.watermarkTemplate = wm.value.trim();

      const diffMode = document.getElementById('cfg-difficult-mode-enabled');
      if (diffMode) pricingMaster.difficultModeEnabled = diffMode.checked;

      localStorage.setItem('kas_pricing_master', JSON.stringify(pricingMaster));
      saveCloudAppSetting('pricing_master', pricingMaster).then(ok => {
        if (!ok) console.warn('UPI settings saved locally but cloud sync failed — will retry next save.');
      });
      alert('UPI settings saved.');
    }

    // Build a click-to-WhatsApp URL for the checkout modal, honoring the whole-feature toggle plus
    // whichever contact mode is selected. In 'id' mode this uses WhatsApp's own wa.me/message/<id>
    // short link (generated from the WhatsApp Business app), which never puts the real number
    // anywhere in this page's HTML -- only WhatsApp's servers resolve it to a number. Returns ''
    // when the feature is off or nothing usable is configured — callers hide the button in that case.
    function buildWhatsAppUrl(prefillMessage) {
      if (pricingMaster.whatsappEnabled === false) return '';
      const msg = encodeURIComponent(prefillMessage || 'Hi, I have a question about my Evolve+ purchase.');
      if (pricingMaster.whatsappMode === 'id') {
        const id = (pricingMaster.whatsappId || '').trim();
        if (!id) return '';
        return `https://wa.me/message/${encodeURIComponent(id)}?text=${msg}`;
      }
      const n = (pricingMaster.whatsappNumber || '').replace(/\D/g, '');
      if (n.length !== 10) return '';
      return `https://wa.me/91${n}?text=${msg}`;
    }

    // Telegram's t.me/<username> links are already ID-based (a username, never a phone number), so
    // there's no "number vs ID" choice to make here -- just the one whole-feature toggle.
    function buildTelegramUrl(prefillMessage) {
      if (!pricingMaster.telegramEnabled) return '';
      const username = (pricingMaster.telegramUsername || '').trim();
      if (!username) return '';
      const msg = encodeURIComponent(prefillMessage || 'Hi, I have a question about my Evolve+ purchase.');
      return `https://t.me/${encodeURIComponent(username)}?text=${msg}`;
    }

    let checkoutItem = null;

    function passLabel(key) {
      return bundleLabel(key);
    }

    function filterExamCategory(cat) {
      filterExamCategoryBase(cat);
      updateCategoryBundleButton();
    }

    function openPaperCheckout(paperId) {
      const paper = testsCatalog.find(p => p.id === paperId);
      if (paper) openCheckout('paper', paper.id, paper.title, paper.price);
    }

    function openCheckout(type, id, title, price) {
      if (!currentUser) {
        openLoginModal('Log in or create an account first, so we know whose access to unlock after payment.', () => openCheckout(type, id, title, price));
        return;
      }
      checkoutItem = { type, id, title, price };
      document.getElementById('checkout-utr').value = '';
      document.getElementById('checkout-utr-error').classList.add('hidden');
      const pending = paymentOrders.find(o => o.email === normalizeEmail(currentUser.email) && o.type === type && o.itemId === id && o.status === 'pending');
      if (pending) showCheckoutStatus(pending);
      else {
        document.getElementById('checkout-utr-box').classList.remove('hidden');
        document.getElementById('checkout-status-box').classList.add('hidden');
      }
      document.getElementById('checkout-item-title').innerText = title;
      document.getElementById('checkout-bill-name').innerText = title;
      document.getElementById('checkout-bill-amount').innerText = `₹${price}`;

      let scopeLabel = "Single Item";
      if (type === 'pass') {
        const b = getBundle(id);
        scopeLabel = b && b.validityDays > 0 ? `Bundle, valid ${b.validityDays} days` : 'Bundle, no expiry';
      }
      else if (type === 'paper') scopeLabel = "Standalone Test Paper";
      else if (type === 'pdf') scopeLabel = "Vault Study Document";
      else if (type === 'page') scopeLabel = "Standalone Word Page";

      document.getElementById('checkout-bill-scope').innerText = scopeLabel;
      document.getElementById('checkout-vpa-display').innerText = pricingMaster.upiId;

      // WhatsApp / Telegram buttons: prefill a message with the item + price so the admin has
      // context. Each is hidden individually when its feature is off or unconfigured, and the
      // shared contact box collapses entirely when neither has anything to show (avoids a bare
      // border-top with nothing under it).
      const waUrl = buildWhatsAppUrl(`Hi, I want to buy "${title}" (₹${price}) on Evolve+. Can you help?`);
      const waBox = document.getElementById('checkout-whatsapp-box');
      if (waUrl) document.getElementById('checkout-whatsapp-btn').href = waUrl;
      waBox.classList.toggle('hidden', !waUrl);

      const tgUrl = buildTelegramUrl(`Hi, I want to buy "${title}" (₹${price}) on Evolve+. Can you help?`);
      const tgBox = document.getElementById('checkout-telegram-box');
      if (tgUrl) document.getElementById('checkout-telegram-btn').href = tgUrl;
      tgBox.classList.toggle('hidden', !tgUrl);

      document.getElementById('checkout-contact-box').classList.toggle('hidden', !waUrl && !tgUrl);

      const upsell = bundlesForSale(b => b.allAccess)[0];
      const upsellBox = document.getElementById('checkout-upsell-box');
      if (upsell && !(type === 'pass' && getBundle(id)?.allAccess)) {
        upsellBox.style.display = 'block';
        document.getElementById('checkout-upsell-btn').innerText = `Upgrade to ${upsell.name} (₹${upsell.price})`;
      } else {
        upsellBox.style.display = 'none';
      }

      const upiUrl = `upi://pay?pa=${encodeURIComponent(pricingMaster.upiId)}&pn=${encodeURIComponent(pricingMaster.payeeName)}&am=${price}&cu=INR&tn=${encodeURIComponent(title)}`;
      // Prefer the admin's own uploaded QR image; fall back to an auto-generated one (encodes the
      // exact amount via upi://pay) only when no QR has been uploaded, so nothing breaks for sites
      // that haven't set one.
      const qrApi = pricingMaster.qrImageDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiUrl)}`;
      document.getElementById('checkout-qr-img').src = qrApi;

      openModal('checkout-modal');
    }

    function copyUpiId() {
      const done = () => alert(`UPI ID ${pricingMaster.upiId} copied.`);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pricingMaster.upiId).then(done).catch(() => prompt('Copy this UPI ID:', pricingMaster.upiId));
      else prompt('Copy this UPI ID:', pricingMaster.upiId);
    }

