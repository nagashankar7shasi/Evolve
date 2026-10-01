    /* ----------------------------------------------------
       3b. PAYMENT CLAIMS, APPROVAL QUEUE & RECEIPTS
    ----------------------------------------------------- */
    const ORDER_STATUS_STYLE = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-rose-100 text-rose-800',
      refunded: 'bg-slate-200 text-slate-700'
    };
    const ORDER_STATUS_LABEL = { pending: 'Being verified', approved: 'Approved', rejected: 'Rejected', refunded: 'Refunded' };
    // Money actually kept from an order: full amount, minus anything refunded back (0 for a fully
    // refunded order, since its status has already moved off 'approved' by then — see refundOrder()).
    function orderNetAmount(o) {
      return Math.max(0, (+o.amount || 0) - (+o.refundedAmount || 0));
    }

    function fmtDateTime(iso) {
      return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    }

    function showCheckoutStatus(order) {
      document.getElementById('checkout-utr-box').classList.add('hidden');
      const box = document.getElementById('checkout-status-box');
      box.className = 'p-4 rounded-xl border text-xs space-y-2 bg-amber-50 border-amber-200 text-amber-950';
      box.innerHTML = `
        <p class="font-bold text-sm">Payment submitted, being verified</p>
        <p>We received UPI reference <b class="font-mono">${escapeHtml(order.utr)}</b> for ₹${order.amount} on ${fmtDateTime(order.createdAt)}.</p>
        <p>We'll unlock <b>${escapeHtml(order.title)}</b> as soon as it matches our bank statement. You can track it under <b>My Payments</b> on your dashboard.</p>
        <button type="button" onclick="closeModal('checkout-modal'); navigate('dashboard')" class="mt-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold">Go to my dashboard</button>`;
      box.classList.remove('hidden');
    }

async function submitPaymentClaim() {
  if (!currentUser || !checkoutItem) return;
  const errBox = document.getElementById('checkout-utr-error');
  const showErr = msg => { errBox.innerText = msg; errBox.classList.remove('hidden'); };
  const utr = document.getElementById('checkout-utr').value.replace(/\s/g, '');

  if (!/^\d{12}$/.test(utr)) return showErr('Enter the 12-digit UPI reference number (numbers only).');

  // Prepare the order object matching your Supabase columns
  const email = normalizeEmail(currentUser.email);
  const order = {
    id: 'ord_' + Date.now(),
    email: email,
    name: currentUser.name,
    type: checkoutItem.type,
    item_id: checkoutItem.id,
    title: checkoutItem.title,
    amount: checkoutItem.price,
    utr: utr,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  // Change the button text to show loading state
  const btn = document.querySelector('button[onclick="submitPaymentClaim()"]');
  const originalText = btn.innerText;
  btn.innerText = "Submitting to server...";
  btn.disabled = true;

  // Insert the record into the Supabase 'payment_orders' table
  const { data, error } = await supabaseClient
    .from('payment_orders')
    .insert([order]);

  // Re-enable button
  btn.innerText = originalText;
  btn.disabled = false;

  if (error) {
    console.error("Supabase Insert Error:", fmtErr(error));
    return showErr("Failed to submit to server. Please try again.");
  }

  // Update the local UI immediately so the user sees success
  paymentOrders.unshift({ ...order, itemId: order.item_id, createdAt: order.created_at }); 
  showCheckoutStatus(order);
  renderPaymentOrders();
  renderDashboard();
}
    async function fetchCloudPayments() {
  const { data, error } = await supabaseClient
    .from('payment_orders')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (data) {
    // Map Supabase snake_case columns back to the camelCase properties the app expects
    paymentOrders = data.map(o => ({
      id: o.id,
      email: o.email,
      name: o.name,
      type: o.type,
      itemId: o.item_id,
      title: o.title,
      amount: o.amount,
      utr: o.utr,
      status: o.status,
      createdAt: o.created_at,
      decidedAt: o.decided_at,
      rejectReason: o.reject_reason,
      receiptNo: o.receipt_no,
      complimentary: !!o.complimentary,
      adminNote: o.admin_note || null,
      refundedAmount: +o.refunded_amount || 0,
      refundedAt: o.refunded_at || null,
      refundReason: o.refund_reason || null
    }));
    
    // Refresh the admin dashboard UI with the cloud data
    renderPaymentOrders();
    if (typeof currentAdminPanel !== 'undefined') {
      if (currentAdminPanel === 'overview') renderOverview();
      if (currentAdminPanel === 'revenue') renderRevenue();
    }
  } else if (error) {
    console.error("Failed to fetch payments:", fmtErr(error));
  }
}

    // Unlocks whatever the order paid for
    async function grantOrder(order) {
  let student = getStudentRecord(order.email);
  if (!student) {
    student = { 
      email: normalizeEmail(order.email), 
      name: order.name, 
      utr: order.utr, 
      status: 'active', 
      allowedExams: [], 
      allowedPages: [], 
      allowedPdfs: [], 
      allowedPlanners: [],
      passes: [], 
      passExpiry: {},
      createdAt: new Date().toISOString() 
    };
    studentDirectory.push(student);
  }
  
  if (order.type === 'pass') grantPass(student, order.itemId);
  const listFor = { paper: 'allowedExams', page: 'allowedPages', pdf: 'allowedPdfs', planner: 'allowedPlanners' }[order.type];
  if (listFor && !student[listFor].includes(order.itemId)) student[listFor].push(order.itemId);
  student.utr = order.utr;

  // Push the updated student access layers to Supabase
  const { error } = await supabaseClient
    .from('students')
    .upsert({
      email: student.email,
      name: student.name,
      utr: student.utr,
      status: student.status,
      allowed_exams: student.allowedExams,
      allowed_pages: student.allowedPages,
      allowed_pdfs: student.allowedPdfs,
      allowed_planners: student.allowedPlanners || [],
      passes: student.passes,
      pass_expiry: student.passExpiry
    });

  if (error) {
    console.error("Failed to sync student permissions to cloud:", fmtErr(error));
  }
}

// Sequential, year-prefixed receipt number: RCP-2026-0001, RCP-2026-0002, ...
// Numbered from approved orders already in the (cloud-synced) paymentOrders list,
// so counts stay consistent as long as fetchCloudPayments has run this session.
function nextReceiptNo() {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const existingThisYear = paymentOrders
    .filter(o => o.receiptNo && String(o.receiptNo).startsWith(prefix))
    .map(o => parseInt(String(o.receiptNo).slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = (existingThisYear.length ? Math.max(...existingThisYear) : 0) + 1;
  return prefix + String(next).padStart(4, '0');
}

async function approveOrder(orderId) {
  const order = paymentOrders.find(o => o.id === orderId);
  if (!order || order.status !== 'pending') return;

  // Complimentary: for when someone asked and you're waiving the fee (a genuine ₹0 favor, not a
  // payment that actually cleared). Read straight off the row's own "Comp" checkbox — ticked before
  // Approve is clicked — so this is a single confirm, not a chain of popups. Tagging it keeps revenue
  // totals honest — a complimentary approval still grants the entitlement below, but is excluded from
  // "Collected" everywhere (see renderOverview/renderRevenue) instead of silently inflating real revenue.
  const complimentary = !!document.getElementById(`comp-${orderId}`)?.checked;

  if (!confirm(`${complimentary ? 'Approve as COMPLIMENTARY (no payment received)' : `Approve ₹${order.amount}`} from ${order.email}?\n\nUPI ref: ${order.utr}\nUnlocks: ${order.title}${complimentary ? '' : '\n\nOnly approve after you\'ve seen this reference in your bank statement.'}`)) return;

  const decidedAt = new Date().toISOString();
  const receiptNo = nextReceiptNo();

  // Update Supabase
  const { error } = await supabaseClient
    .from('payment_orders')
    .update({ status: 'approved', decided_at: decidedAt, receipt_no: receiptNo, complimentary })
    .eq('id', orderId);

  if (error) return alert("Failed to approve in cloud: " + error.message);

  // Update local directory access
  grantOrder(order);
  order.status = 'approved';
  order.decidedAt = decidedAt;
  order.receiptNo = receiptNo;
  order.complimentary = complimentary;

  // Round 2: notify student — non-blocking, silent in demo mode
  sendAutoEmail('payment_approved', order.email, {
    name: displayNameFor(order.email, order.name),
    email: order.email,
    item_title: order.title || 'your purchase',
    amount: order.amount,
    receipt_no: receiptNo
  });

  afterStudentDataChange();
}

async function rejectOrder(orderId) {
  const order = paymentOrders.find(o => o.id === orderId);
  if (!order || order.status !== 'pending') return;
  const reason = prompt(`Reject the payment claim from ${order.email}?\n\nReason shown to the student:`, 'Reference number not found in our bank statement');
  if (reason === null) return;
  
  const rejectReason = reason.trim() || 'Payment could not be verified';
  const decidedAt = new Date().toISOString();

  // Update Supabase
  const { error } = await supabaseClient
    .from('payment_orders')
    .update({ status: 'rejected', decided_at: decidedAt, reject_reason: rejectReason })
    .eq('id', orderId);

  if (error) return alert("Failed to reject in cloud: " + error.message);

  order.status = 'rejected';
  order.rejectReason = rejectReason;
  order.decidedAt = decidedAt;

  // Round 2: notify student — non-blocking, silent in demo mode
  sendAutoEmail('payment_rejected', order.email, {
    name: displayNameFor(order.email, order.name),
    email: order.email,
    item_title: order.title || 'your purchase',
    reject_reason: rejectReason
  });

  afterStudentDataChange();
}

// Removes exactly what one order granted — the paper/page/PDF/planner from the student's individual
// allow-list, or the bundle pass — leaving any other, separately-earned access untouched (a student
// covered by a different bundle, or who bought the same item twice, keeps that other coverage; every
// unlock check re-derives access from current state, so this alone is enough to correctly narrow it).
// Shared low-level "take away this one item" helper — removes a single entitlement (paper/page/pdf/
// planner/pass) from a student's record and syncs the whole entitlement set back to Supabase in one
// upsert (same shape saveStudentEntitlements/grantOrder use). Used by the refund flow's access
// clawback (revokeOrderEntitlement below).
async function revokeEntitlementItem(email, type, itemId) {
  const student = getStudentRecord(email);
  if (!student) return false;
  if (type === 'pass') {
    revokePass(student, itemId);
  } else {
    const listFor = { paper: 'allowedExams', page: 'allowedPages', pdf: 'allowedPdfs', planner: 'allowedPlanners' }[type];
    if (listFor) student[listFor] = (student[listFor] || []).filter(id => id !== itemId);
  }
  const { error } = await supabaseClient.from('students').upsert({
    email: student.email, name: student.name, utr: student.utr, status: student.status,
    allowed_exams: student.allowedExams, allowed_pages: student.allowedPages, allowed_pdfs: student.allowedPdfs,
    allowed_planners: student.allowedPlanners || [], passes: student.passes, pass_expiry: student.passExpiry || {}
  });
  if (error) { console.error('Failed to sync revoked access to cloud:', fmtErr(error)); return false; }
  return true;
}
async function revokeOrderEntitlement(order) {
  await revokeEntitlementItem(order.email, order.type, order.itemId);
}

// Refunds all or part of an approved order's amount. A refund that reaches the full original amount
// (across one or more refund actions) marks the order 'refunded' — which is enough on its own to drop
// it out of every revenue total (they all filter on status === 'approved'). A partial refund leaves
// status 'approved' (the purchase still basically stands) and never touches access — only a full
// refund offers to revoke it, since a partial refund reads as a goodwill adjustment, not an undone
// purchase.
async function refundOrder(orderId) {
  const order = paymentOrders.find(o => o.id === orderId);
  if (!order || order.status !== 'approved') return;

  const alreadyRefunded = +order.refundedAmount || 0;
  const remaining = Math.max(0, (+order.amount || 0) - alreadyRefunded);
  if (remaining <= 0) return alert('This order has already been fully refunded.');

  const raw = prompt(
    `Refund how much of ₹${order.amount} paid by ${order.email} for "${order.title}"?\n\n` +
    `Enter an amount up to ₹${remaining}${alreadyRefunded ? ` (₹${alreadyRefunded} already refunded earlier)` : ''}.`,
    String(remaining)
  );
  if (raw === null) return;
  const refundAmt = Math.round(parseFloat(raw) * 100) / 100;
  if (isNaN(refundAmt) || refundAmt <= 0 || refundAmt > remaining) {
    return alert(`Enter a number between ₹0.01 and ₹${remaining}.`);
  }

  const isFull = refundAmt >= remaining;
  const newRefundedTotal = Math.round((alreadyRefunded + refundAmt) * 100) / 100;
  const reason = (prompt(`Optional reason for this refund (not shown to the student):`, '') || '').trim();

  let revoke = false;
  if (isFull) {
    revoke = confirm(
      `Refund ₹${refundAmt} and mark this order fully refunded?\n\n` +
      `Also remove "${order.title}" from ${order.email}'s access right now?\n\n` +
      `OK = yes, refund AND revoke access.\nCancel = refund only — leave their access exactly as it is.`
    );
  } else {
    if (!confirm(`Refund ₹${refundAmt} of ₹${order.amount} (partial)?\n\nThe student's access is left unchanged — this only adjusts what counts as revenue.`)) return;
  }

  const decidedAt = new Date().toISOString();
  const newStatus = isFull ? 'refunded' : 'approved';

  const { error } = await supabaseClient
    .from('payment_orders')
    .update({ status: newStatus, refunded_amount: newRefundedTotal, refunded_at: decidedAt, refund_reason: reason || null })
    .eq('id', orderId);
  if (error) return alert('Failed to record the refund in cloud: ' + error.message);

  order.status = newStatus;
  order.refundedAmount = newRefundedTotal;
  order.refundedAt = decidedAt;
  order.refundReason = reason || null;

  if (isFull && revoke) await revokeOrderEntitlement(order);

  afterStudentDataChange();
  alert(`✓ ₹${refundAmt} refunded${isFull ? (revoke ? ' — order fully refunded and access revoked.' : ' — order fully refunded; access left as is.') : ' (partial).'}`);
}

