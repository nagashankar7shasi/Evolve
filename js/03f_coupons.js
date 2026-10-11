    /* ----------------------------------------------------
       3f. COUPONS / PROMO CODES (incl. no-code early-bird pricing)
    ----------------------------------------------------- */
    // One engine handles both "type a code at checkout" promo codes AND no-code early-bird pricing:
    // requires_code === false means a coupon auto-applies to every eligible checkout before endsAt,
    // with nothing for the student to type. See sql/add_coupons_and_redemptions.sql for the full
    // schema rationale (scope matching, the two-layer redemption-counting design, and why
    // payment_orders.amount keeps meaning "what was actually charged" rather than being repurposed).
    let coupons = [];             // public: every coupon, active or not (admin list filters client-side)
    let couponRedemptions = [];   // admin-only (RLS) -- empty array for every non-admin visitor, by design
    let checkoutCoupon = null;    // { coupon, discount, finalAmount } currently applied in the open checkout modal, or null
    let editingCouponId = null;

    function getCoupon(id) {
      return coupons.find(c => c.id === id) || null;
    }

    async function fetchCloudCoupons() {
      const { data, error } = await supabaseClient.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) { console.error('fetchCloudCoupons:', fmtErr(error)); return; }
      if (data) {
        coupons = data.map(c => ({
          id: c.id, code: c.code || '', label: c.label || '', type: c.type === 'flat' ? 'flat' : 'percent',
          value: +c.value || 0, maxDiscount: c.max_discount != null ? +c.max_discount : null,
          scope: c.scope || 'all', scopeIds: Array.isArray(c.scope_ids) ? c.scope_ids : [],
          minOrderAmount: +c.min_order_amount || 0,
          startsAt: c.starts_at || null, endsAt: c.ends_at || null,
          requiresCode: c.requires_code !== false,
          usageLimitTotal: c.usage_limit_total != null ? +c.usage_limit_total : null,
          usageLimitPerStudent: c.usage_limit_per_student != null ? +c.usage_limit_per_student : 1,
          redemptionCount: +c.redemption_count || 0,
          active: c.active !== false, createdAt: c.created_at
        }));
        if (typeof renderCouponsAdmin === 'function') renderCouponsAdmin();
      }
    }

    // Admin-only by RLS (see migration) -- for every other visitor this resolves to an empty array
    // without erroring, same "no-op for everyone else" posture fetchCloudVisitStats already uses for
    // an admin-only table. Only used for the admin Coupons panel's per-coupon redemption list.
    async function fetchCloudCouponRedemptions() {
      const { data, error } = await supabaseClient.from('coupon_redemptions').select('*').order('redeemed_at', { ascending: false });
      if (error) { if (error.code !== '42501') console.error('fetchCloudCouponRedemptions:', fmtErr(error)); return; }
      if (data) {
        couponRedemptions = data.map(r => ({
          id: r.id, couponId: r.coupon_id, studentEmail: r.student_email, orderId: r.order_id,
          discountAmount: +r.discount_amount || 0, redeemedAt: r.redeemed_at
        }));
        if (typeof renderCouponsAdmin === 'function') renderCouponsAdmin();
      }
    }

    // Whether `coupon` is even the right kind of coupon for this checkout item at all (ignoring
    // dates/limits -- see couponIsLive for those). `item` is the same shape as checkoutItem:
    // { type: 'paper'|'pass'|'page'|'pdf', id }.
    function couponAppliesToItem(coupon, item) {
      if (!coupon || !item) return false;
      if (coupon.scope === 'all') return true;
      if (coupon.scope === 'bundle') return item.type === 'pass' && coupon.scopeIds.includes(item.id);
      if (coupon.scope === 'paper') return item.type === 'paper' && coupon.scopeIds.includes(item.id);
      if (coupon.scope === 'category') {
        const ids = coupon.scopeIds;
        if (item.type === 'paper') {
          const p = testsCatalog.find(x => x.id === item.id);
          if (!p) return false;
          return ids.includes(p.category) || (p.extraCategories || []).some(c => ids.includes(c)) || (p.alsoListCategories || []).some(c => ids.includes(c));
        }
        if (item.type === 'pass') {
          const b = getBundle(item.id);
          return !!b && (b.categories || []).some(c => ids.includes(c));
        }
        return false; // pages/PDFs aren't tied to an exam category in this app's model
      }
      return false;
    }

    // Date/active/min-amount/total-cap checks -- everything that doesn't depend on who's buying.
    // The per-student cap (usageLimitPerStudent) is deliberately NOT checked here: coupon_redemptions
    // is admin-only to read (see migration comments), so a student's browser can't know how many
    // times THEY personally have used a code. That check happens authoritatively at admin-approval
    // time instead (see approveOrder in 03d_payment_claims.js) -- same place a reused/duplicate UTR
    // already gets caught by a human, not by client-side code.
    function couponIsLive(coupon, price) {
      if (!coupon || !coupon.active) return false;
      const now = new Date();
      if (coupon.startsAt && now < new Date(coupon.startsAt)) return false;
      if (coupon.endsAt && now >= new Date(coupon.endsAt)) return false;
      if (coupon.minOrderAmount && price < coupon.minOrderAmount) return false;
      if (coupon.usageLimitTotal != null && coupon.redemptionCount >= coupon.usageLimitTotal) return false;
      return true;
    }

    // Discount amount for one coupon against one price -- never more than the price itself (so a
    // flat coupon bigger than the item's price can't produce a negative payable amount).
    function computeCouponDiscount(coupon, price) {
      if (!coupon) return 0;
      let discount = coupon.type === 'flat' ? coupon.value : Math.round(price * coupon.value / 100);
      if (coupon.type === 'percent' && coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
      return Math.max(0, Math.min(discount, price));
    }

    // The single best no-code coupon currently eligible for this item/price, or null. "Best" = biggest
    // discount -- if an admin ever has two overlapping early-bird rules live at once, the student gets
    // whichever actually saves them more, not whichever was created first.
    function bestAutoCoupon(item, price) {
      const eligible = coupons.filter(c => !c.requiresCode && couponIsLive(c, price) && couponAppliesToItem(c, item));
      if (!eligible.length) return null;
      return eligible.map(c => ({ coupon: c, discount: computeCouponDiscount(c, price) })).sort((a, b) => b.discount - a.discount)[0].coupon;
    }

    // ---- Checkout-modal wiring (index.html's #checkout-coupon-box, called from openCheckout) ----
    function resetCheckoutCoupon() {
      checkoutCoupon = null;
      const codeInput = document.getElementById('checkout-coupon-code');
      if (codeInput) codeInput.value = '';
      const err = document.getElementById('checkout-coupon-error');
      if (err) err.classList.add('hidden');
    }

    // Called from openCheckout() right after checkoutItem is set, so an eligible early-bird discount
    // is already showing the first time the modal opens -- no code needed, nothing to click.
    function autoApplyCheckoutCoupon() {
      if (!checkoutItem) return;
      const auto = bestAutoCoupon({ type: checkoutItem.type, id: checkoutItem.id }, checkoutItem.price);
      if (auto) applyCoupon(auto);
      else renderCheckoutCouponUI();
    }

    function applyCheckoutCoupon() {
      const input = document.getElementById('checkout-coupon-code');
      const err = document.getElementById('checkout-coupon-error');
      const raw = (input.value || '').trim().toUpperCase();
      err.classList.add('hidden');
      if (!raw) return;
      if (!checkoutItem) return;
      const coupon = coupons.find(c => c.requiresCode && (c.code || '').toUpperCase() === raw);
      if (!coupon) { err.innerText = "That code isn't valid."; err.classList.remove('hidden'); return; }
      if (!couponIsLive(coupon, checkoutItem.price)) { err.innerText = "That code has expired, isn't active yet, or has been fully redeemed."; err.classList.remove('hidden'); return; }
      if (!couponAppliesToItem(coupon, { type: checkoutItem.type, id: checkoutItem.id })) { err.innerText = "That code doesn't apply to this item."; err.classList.remove('hidden'); return; }
      applyCoupon(coupon);
    }

    function applyCoupon(coupon) {
      const discount = computeCouponDiscount(coupon, checkoutItem.price);
      checkoutCoupon = { coupon, discount, finalAmount: Math.max(0, checkoutItem.price - discount) };
      renderCheckoutCouponUI();
    }

    function removeCheckoutCoupon() {
      resetCheckoutCoupon();
      renderCheckoutCouponUI();
    }

    // Repaints everything in the checkout modal that depends on whether a coupon is applied: the
    // coupon box itself, the bill total (struck-through original + discounted final), and -- critical
    // -- the actual UPI amount in both the QR code and the "Pay via UPI App" deep link, since that's
    // what the student really pays. Called from openCheckout() (after auto-apply) and every time the
    // applied coupon changes.
    function renderCheckoutCouponUI() {
      if (!checkoutItem) return;
      const applied = document.getElementById('checkout-coupon-applied');
      const entry = document.getElementById('checkout-coupon-entry');
      const amountEl = document.getElementById('checkout-bill-amount');
      const originalEl = document.getElementById('checkout-bill-original');
      const price = checkoutItem.price;
      const payable = checkoutCoupon ? checkoutCoupon.finalAmount : price;

      if (checkoutCoupon) {
        applied.classList.remove('hidden');
        entry.classList.add('hidden');
        document.getElementById('checkout-coupon-applied-label').innerText = checkoutCoupon.coupon.requiresCode ? checkoutCoupon.coupon.code : (checkoutCoupon.coupon.label || 'Early-bird offer');
        document.getElementById('checkout-coupon-applied-savings').innerText = `₹${checkoutCoupon.discount}`;
        originalEl.innerText = `₹${price}`;
        originalEl.classList.remove('hidden');
      } else {
        applied.classList.add('hidden');
        entry.classList.remove('hidden');
        originalEl.classList.add('hidden');
      }
      amountEl.innerText = `₹${payable}`;

      // Keep the actual payment instructions (QR + UPI deep link) in sync with the discounted amount
      // -- these are rebuilt here rather than only in openCheckout() because applying/removing a
      // coupon happens AFTER the modal is already open.
      const upiUrl = `upi://pay?pa=${encodeURIComponent(pricingMaster.upiId)}&pn=${encodeURIComponent(pricingMaster.payeeName)}&am=${payable}&cu=INR&tn=${encodeURIComponent(checkoutItem.title)}`;
      const qrApi = pricingMaster.qrImageDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiUrl)}`;
      document.getElementById('checkout-qr-img').src = qrApi;
      document.getElementById('checkout-upi-app-btn').href = upiUrl;
      document.getElementById('checkout-upi-app-btn-label').innerText = `Pay ₹${payable} via UPI App`;
    }

    // ---- Admin: Coupons panel ----
    function couponStatusBadge(c) {
      const now = new Date();
      if (!c.active) return '<span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Off</span>';
      if (c.startsAt && now < new Date(c.startsAt)) return '<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">Scheduled</span>';
      if (c.endsAt && now >= new Date(c.endsAt)) return '<span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Expired</span>';
      if (c.usageLimitTotal != null && c.redemptionCount >= c.usageLimitTotal) return '<span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Fully redeemed</span>';
      return '<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Live</span>';
    }

    function couponScopeSummary(c) {
      if (c.scope === 'all') return 'Everything';
      if (c.scope === 'bundle') return `${c.scopeIds.length} bundle(s)`;
      if (c.scope === 'paper') return `${c.scopeIds.length} paper(s)`;
      if (c.scope === 'category') return `${c.scopeIds.length} categor${c.scopeIds.length === 1 ? 'y' : 'ies'}`;
      return c.scope;
    }

    function renderCouponsAdmin() {
      const list = document.getElementById('coupons-admin-list');
      if (!list) return;
      list.innerHTML = coupons.map(c => {
        const valueLabel = c.type === 'flat' ? `₹${c.value} off` : `${c.value}% off${c.maxDiscount != null ? ` (max ₹${c.maxDiscount})` : ''}`;
        const limitLabel = c.usageLimitTotal != null ? `${c.redemptionCount}/${c.usageLimitTotal} used` : `${c.redemptionCount} used`;
        return `
        <div class="p-3 border rounded-xl ${c.active ? 'bg-white' : 'bg-slate-50'}">
          <div class="flex justify-between gap-2">
            <b class="text-slate-900">${escapeHtml(c.label || c.code || 'Untitled coupon')}</b>
            <span class="font-mono font-bold text-emerald-700">${valueLabel}</span>
          </div>
          <p class="text-slate-500 mt-0.5">${c.requiresCode ? `Code: <span class="font-mono font-bold text-slate-700">${escapeHtml(c.code)}</span>` : 'Auto-applies, no code needed'} · Applies to: ${couponScopeSummary(c)}</p>
          <div class="flex flex-wrap gap-1 mt-2 text-[10px] font-bold">
            ${couponStatusBadge(c)}
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${limitLabel}</span>
            ${c.endsAt ? `<span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">Ends ${fmtDateTime(c.endsAt)}</span>` : ''}
          </div>
          <div class="flex gap-3 mt-2 items-center flex-wrap">
            <button onclick="editCoupon('${c.id}')" class="text-blue-600 font-bold hover:underline">Edit</button>
            <button onclick="duplicateCoupon('${c.id}')" class="text-slate-600 font-bold hover:underline">Duplicate</button>
            <button onclick="deleteCoupon('${c.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
            <span class="text-slate-300">|</span>
            <label class="flex items-center gap-1 cursor-pointer text-[11px]" title="Whether this coupon can currently be used">
              <input type="checkbox" ${c.active ? 'checked' : ''} onchange="toggleCouponFlag('${c.id}', 'active', this.checked)" class="rounded" />
              <span class="font-medium text-slate-700">Active</span>
            </label>
          </div>
        </div>`;
      }).join('') || '<p class="text-slate-400">No coupons yet.</p>';
    }

    async function toggleCouponFlag(id, flag, value) {
      const c = getCoupon(id);
      if (!c) return;
      c[flag] = !!value;
      try {
        const { error } = await supabaseClient.from('coupons').update({ [flag]: !!value }).eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to sync coupon toggle to cloud:', fmtErr(err));
        alert('Toggle saved locally, but cloud sync failed: ' + err.message);
      }
      renderCouponsAdmin();
    }

    function couponScopePickerLabel(scope) {
      return { bundle: 'Bundles', paper: 'Test papers', category: 'Exam categories' }[scope] || '';
    }

    function refreshCouponScopeFields() {
      const scope = document.getElementById('cpn-scope').value;
      const wrap = document.getElementById('cpn-scope-ids-wrap');
      wrap.classList.toggle('hidden', scope === 'all');
      if (scope === 'all') return;
      document.getElementById('cpn-scope-ids-label').innerText = couponScopePickerLabel(scope);
      const selected = editingCouponId ? (getCoupon(editingCouponId)?.scopeIds || []) : [];
      if (scope === 'bundle') checkboxList('cpn-scope-ids', bundles.map(b => ({ value: b.id, label: escapeHtml(b.name) })), selected, 'cpn-scope-cb');
      else if (scope === 'paper') checkboxList('cpn-scope-ids', testsCatalog.map(p => ({ value: p.id, label: `${escapeHtml(p.title)} <span class="text-slate-400">₹${p.price}</span>` })), selected, 'cpn-scope-cb');
      else if (scope === 'category') checkboxList('cpn-scope-ids', Object.values(EXAM_CATEGORIES).map(c => ({ value: c.id, label: escapeHtml(c.name) })), selected, 'cpn-scope-cb');
    }

    function editCoupon(id) {
      const c = id ? getCoupon(id) : {
        code: '', label: '', type: 'percent', value: 10, maxDiscount: null, scope: 'all', scopeIds: [],
        minOrderAmount: 0, startsAt: '', endsAt: '', requiresCode: true, usageLimitTotal: null,
        usageLimitPerStudent: 1, active: true
      };
      editingCouponId = id;
      document.getElementById('coupon-editor-title').innerText = id ? `Edit: ${c.label || c.code}` : 'New coupon';
      document.getElementById('cpn-requires-code').checked = c.requiresCode;
      document.getElementById('cpn-code').value = c.code || '';
      document.getElementById('cpn-code-row').classList.toggle('hidden', !c.requiresCode);
      document.getElementById('cpn-label').value = c.label || '';
      document.getElementById('cpn-type').value = c.type;
      document.getElementById('cpn-value').value = c.value;
      document.getElementById('cpn-max-discount').value = c.maxDiscount != null ? c.maxDiscount : '';
      document.getElementById('cpn-min-order').value = c.minOrderAmount || '';
      document.getElementById('cpn-scope').value = c.scope;
      document.getElementById('cpn-starts-at').value = c.startsAt ? c.startsAt.slice(0, 16) : '';
      document.getElementById('cpn-ends-at').value = c.endsAt ? c.endsAt.slice(0, 16) : '';
      document.getElementById('cpn-usage-total').value = c.usageLimitTotal != null ? c.usageLimitTotal : '';
      document.getElementById('cpn-usage-per-student').value = c.usageLimitPerStudent != null ? c.usageLimitPerStudent : 1;
      document.getElementById('cpn-active').checked = !!c.active;
      refreshCouponScopeFields();

      const form = document.getElementById('coupon-editor');
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeCouponEditor() {
      editingCouponId = null;
      document.getElementById('coupon-editor').classList.add('hidden');
    }

    async function saveCoupon(e) {
      e.preventDefault();
      const requiresCode = document.getElementById('cpn-requires-code').checked;
      const code = document.getElementById('cpn-code').value.trim().toUpperCase();
      if (requiresCode && !code) return alert('Give the coupon a code, or switch off "Requires a code" for an auto-applied (early-bird style) discount.');
      if (requiresCode && coupons.some(c => c.id !== editingCouponId && c.requiresCode && c.code.toUpperCase() === code)) {
        return alert(`Code "${code}" is already used by another coupon.`);
      }
      const scope = document.getElementById('cpn-scope').value;
      const scopeIds = scope === 'all' ? [] : [...document.querySelectorAll('.cpn-scope-cb:checked')].map(cb => cb.value);
      const startsAtRaw = document.getElementById('cpn-starts-at').value;
      const endsAtRaw = document.getElementById('cpn-ends-at').value;
      const maxDiscountRaw = document.getElementById('cpn-max-discount').value;
      const usageTotalRaw = document.getElementById('cpn-usage-total').value;

      const couponId = editingCouponId || ('coupon_' + Date.now());
      const data = {
        id: couponId,
        code: requiresCode ? code : null,
        label: document.getElementById('cpn-label').value.trim(),
        type: document.getElementById('cpn-type').value,
        value: Math.max(0, parseFloat(document.getElementById('cpn-value').value) || 0),
        max_discount: maxDiscountRaw ? Math.max(0, parseFloat(maxDiscountRaw)) : null,
        scope, scope_ids: scopeIds,
        min_order_amount: Math.max(0, parseFloat(document.getElementById('cpn-min-order').value) || 0),
        starts_at: startsAtRaw ? new Date(startsAtRaw).toISOString() : null,
        ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
        requires_code: requiresCode,
        usage_limit_total: usageTotalRaw ? Math.max(1, parseInt(usageTotalRaw, 10)) : null,
        usage_limit_per_student: Math.max(1, parseInt(document.getElementById('cpn-usage-per-student').value, 10) || 1),
        active: document.getElementById('cpn-active').checked
      };
      if (!data.label) return alert('Give the coupon a short admin-facing label (e.g. "Diwali Sale").');

      // Preserve redemption_count on an edit -- it's server/approval-maintained, never set from this form.
      if (editingCouponId) {
        const existing = getCoupon(editingCouponId);
        data.redemption_count = existing ? existing.redemptionCount : 0;
      }

      const { error } = await supabaseClient.from('coupons').upsert(data);
      if (error) return alert('Failed to save coupon to cloud: ' + error.message);

      const runtime = {
        id: data.id, code: data.code || '', label: data.label, type: data.type, value: data.value,
        maxDiscount: data.max_discount, scope: data.scope, scopeIds: data.scope_ids,
        minOrderAmount: data.min_order_amount, startsAt: data.starts_at, endsAt: data.ends_at,
        requiresCode: data.requires_code, usageLimitTotal: data.usage_limit_total,
        usageLimitPerStudent: data.usage_limit_per_student, redemptionCount: data.redemption_count || 0,
        active: data.active, createdAt: new Date().toISOString()
      };
      const idx = coupons.findIndex(c => c.id === couponId);
      if (idx >= 0) coupons[idx] = runtime; else coupons.unshift(runtime);

      closeCouponEditor();
      renderCouponsAdmin();
      alert(`Coupon "${data.label}" saved live to the cloud!`);
    }

    async function duplicateCoupon(id) {
      const c = getCoupon(id);
      if (!c) return;
      const newId = 'coupon_' + Date.now();
      const data = {
        id: newId, code: c.requiresCode ? null : null, // never auto-duplicate a code -- would collide
        label: `${c.label} (copy)`, type: c.type, value: c.value, max_discount: c.maxDiscount,
        scope: c.scope, scope_ids: c.scopeIds, min_order_amount: c.minOrderAmount,
        starts_at: c.startsAt, ends_at: c.endsAt,
        requires_code: c.requiresCode, usage_limit_total: c.usageLimitTotal,
        usage_limit_per_student: c.usageLimitPerStudent, redemption_count: 0, active: false
      };
      if (data.requires_code) {
        // Needs a fresh, non-colliding code -- never silently publish a duplicate that can't be used.
        data.code = `${(c.code || 'CODE').toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
      }
      const { error } = await supabaseClient.from('coupons').upsert(data);
      if (error) return alert('Failed to duplicate coupon to cloud: ' + error.message);
      coupons.unshift({
        id: data.id, code: data.code || '', label: data.label, type: data.type, value: data.value,
        maxDiscount: data.max_discount, scope: data.scope, scopeIds: data.scope_ids,
        minOrderAmount: data.min_order_amount, startsAt: data.starts_at, endsAt: data.ends_at,
        requiresCode: data.requires_code, usageLimitTotal: data.usage_limit_total,
        usageLimitPerStudent: data.usage_limit_per_student, redemptionCount: 0, active: false,
        createdAt: new Date().toISOString()
      });
      renderCouponsAdmin();
      alert(`Coupon duplicated as "${data.label}"${data.requires_code ? ` with code ${data.code}` : ''} (inactive -- review before turning it on).`);
    }

    async function deleteCoupon(id) {
      const c = getCoupon(id);
      if (!c) return;
      if (c.redemptionCount > 0 && !confirm(`"${c.label || c.code}" has already been used ${c.redemptionCount} time(s). Its redemption history will stay on past orders, but the coupon itself will be gone. Delete anyway?`)) return;
      if (c.redemptionCount === 0 && !confirm(`Delete the coupon "${c.label || c.code}"?`)) return;
      const { error } = await supabaseClient.from('coupons').delete().eq('id', id);
      if (error) return alert('Failed to delete coupon from cloud: ' + error.message);
      coupons = coupons.filter(x => x.id !== id);
      renderCouponsAdmin();
      alert(`Coupon "${c.label || c.code}" deleted.`);
    }

    // ---- Approval-time enforcement + redemption recording (called from approveOrder, 03d_payment_claims.js) ----
    // payment_orders only stores coupon_code (the student-facing identifier), not a coupon_id, so a
    // code-required coupon resolves by its code and a no-code (early-bird) coupon -- which has no code
    // at all -- resolves by the label that was snapshotted into coupon_code at submit time. If the
    // coupon was since deleted, or an early-bird label collides with another coupon's label, this can
    // return null/the wrong row; that's surfaced as a warning rather than silently failing the approval,
    // consistent with the rest of this flow's warn-don't-block posture.
    function resolveCouponForOrder(order) {
      if (!order || !order.couponCode) return null;
      return coupons.find(c => c.requiresCode ? (c.code || '').toUpperCase() === order.couponCode.toUpperCase() : c.label === order.couponCode) || null;
    }

    // One short warning line for the admin's approve-confirm dialog, or '' if nothing's off. Checked
    // at approval time (not before) because that's the only moment this app can see every OTHER
    // student's redemption of this coupon (coupon_redemptions is admin-only to read -- see migration).
    function couponApprovalWarning(order) {
      const coupon = resolveCouponForOrder(order);
      if (!coupon) return order.couponCode ? `\n\n⚠️ Coupon "${order.couponCode}" on this order could not be matched to a current coupon (may have been deleted or renamed).` : '';
      const total = coupon.usageLimitTotal != null && coupon.redemptionCount >= coupon.usageLimitTotal
        ? `already redeemed ${coupon.redemptionCount}/${coupon.usageLimitTotal} times total` : null;
      const perStudentCount = couponRedemptions.filter(r => r.couponId === coupon.id && normalizeEmail(r.studentEmail) === normalizeEmail(order.email)).length;
      const perStudent = perStudentCount >= coupon.usageLimitPerStudent
        ? `this student has already redeemed it ${perStudentCount}/${coupon.usageLimitPerStudent} time(s)` : null;
      const bits = [total, perStudent].filter(Boolean);
      return bits.length ? `\n\n⚠️ Coupon "${coupon.label || coupon.code}" looks over its limit (${bits.join('; ')}). Approving will still record another redemption -- double-check before proceeding.` : '';
    }

    // Records the redemption (admin-only coupon_redemptions row) and bumps the coupon's public
    // redemption_count by 1 -- both only now, at approval, never at submit (see migration comments:
    // a rejected pending claim must never burn a slot). Best-effort: a failure here doesn't undo the
    // payment approval itself, it just means the counters may need a manual look.
    async function recordCouponRedemption(order) {
      const coupon = resolveCouponForOrder(order);
      if (!coupon) return;
      const { error: insertError } = await supabaseClient.from('coupon_redemptions').insert([{
        coupon_id: coupon.id, student_email: normalizeEmail(order.email), order_id: order.id,
        discount_amount: +order.discountAmount || 0
      }]);
      if (insertError) { console.error('recordCouponRedemption insert:', fmtErr(insertError)); return; }
      couponRedemptions.unshift({ id: null, couponId: coupon.id, studentEmail: normalizeEmail(order.email), orderId: order.id, discountAmount: +order.discountAmount || 0, redeemedAt: new Date().toISOString() });

      coupon.redemptionCount = (coupon.redemptionCount || 0) + 1;
      const { error: updateError } = await supabaseClient.from('coupons').update({ redemption_count: coupon.redemptionCount }).eq('id', coupon.id);
      if (updateError) console.error('recordCouponRedemption count update:', fmtErr(updateError));
      if (typeof renderCouponsAdmin === 'function') renderCouponsAdmin();
    }
