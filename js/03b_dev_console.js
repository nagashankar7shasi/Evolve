    /* ----------------------------------------------------
       3-. DEV CONSOLE LAYOUT, OVERVIEW, REVENUE
    ----------------------------------------------------- */
    let currentAdminPanel = localStorage.getItem('kas_admin_panel') || 'overview';

    function showAdminPanel(id) {
      const panels = document.querySelectorAll('#admin-panels [data-panel]');
      if (![...panels].some(p => p.dataset.panel === id)) id = 'overview';
      currentAdminPanel = id;
      localStorage.setItem('kas_admin_panel', id);
      panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== id));
      document.querySelectorAll('.admin-nav-btn').forEach(b => {
        const on = b.dataset.panelLink === id;
        b.classList.toggle('bg-slate-900', on);
        b.classList.toggle('text-white', on);
        b.classList.toggle('font-bold', on);
        b.classList.toggle('hover:bg-slate-100', !on);
        b.classList.toggle('text-slate-700', !on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      const sel = document.getElementById('admin-panel-select');
      if (sel) sel.value = id;
      if (id === 'overview') renderOverview();
      if (id === 'revenue') renderRevenue();
      if (id === 'backup') renderStorageUsage();
      if (id === 'payments') renderPaymentOrders();
      if (id === 'students') renderStudentDirectoryTable();
      if (id === 'home') renderHomeConfigAdmin();
      if (id === 'email') { renderEmailTemplatesAdmin(); setEmailTab('templates'); }
      if (id === 'tests') {
        // Full question content (for editing/validation/counts) is fetched once here, when the
        // admin actually opens this panel — not on every visitor's page load. First paint shows a
        // brief loading note only the very first time; after that it's already cached.
        const root = document.getElementById('tests-catalog-list');
        if (root && !_fullTestsCatalogLoadedForAdmin) root.innerHTML = '<p class="text-slate-400 text-center py-6">Loading full paper details…</p>';
        ensureFullTestsCatalogForAdmin().then(renderTestsCatalogAdmin);
      }
      if (id === 'examcats') renderExamCategoriesAdmin();
      if (id === 'feedback') renderFeedbackAdmin();
      if (id === 'branding') hydrateBrandingAdmin();
      const view = document.getElementById('view-admin');
      if (view && !view.classList.contains('hidden')) window.scrollTo(0, 0);
    }

    function rupees(n) {
      return '₹' + Math.round(n || 0).toLocaleString('en-IN');
    }
    function orderTime(o) {
      return new Date(o.status === 'approved' ? (o.decidedAt || o.createdAt) : o.createdAt);
    }
    function statCard(label, value, sub = '', onclick = '') {
      return `<${onclick ? `button onclick="${onclick}"` : 'div'} class="text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-sm ${onclick ? 'hover:border-amber-500 transition' : ''}">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${label}</div>
        <div class="text-2xl font-black text-slate-900 mt-1">${value}</div>
        ${sub ? `<div class="text-[11px] text-slate-500 mt-0.5">${sub}</div>` : ''}
      </${onclick ? 'button' : 'div'}>`;
    }

    function renderOverview() {
      const box = document.getElementById('ov-cards');
      if (!box) return;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekAgo = new Date(now - 7 * 86400000);
      // Complimentary approvals grant access but aren't real money — excluded here so "Collected"
      // and the payment count stay honest instead of being inflated by waived-fee grants.
      const approved = paymentOrders.filter(o => o.status === 'approved' && !o.complimentary);
      const pending = paymentOrders.filter(o => o.status === 'pending');
      const monthRev = approved.filter(o => orderTime(o) >= monthStart).reduce((n, o) => n + orderNetAmount(o), 0);
      const holders = studentDirectory.filter(st => activeBundlesFor(st).length).length;
      const newStudents = studentDirectory.filter(st => st.createdAt && new Date(st.createdAt) >= weekAgo).length;
      const testsWeek = userAttempts.filter(a => attemptTime(a) >= weekAgo.getTime()).length;
      box.innerHTML =
        statCard('Payments waiting', pending.length, pending.length ? `${rupees(pending.reduce((n, o) => n + (+o.amount || 0), 0))} to verify` : 'All caught up', "showAdminPanel('payments')") +
        statCard('Collected this month', rupees(monthRev), `${approved.filter(o => orderTime(o) >= monthStart).length} payment(s)`, "showAdminPanel('revenue')") +
        statCard('Students', studentDirectory.length, `${newStudents} new this week · ${holders} with an active bundle`, "showAdminPanel('students')") +
        statCard('Tests taken', testsWeek, 'in the last 7 days');
      document.getElementById('ov-payments').innerHTML = paymentOrders.slice(0, 6).map(o => `
        <div class="flex justify-between gap-3 p-2 bg-slate-50 border rounded-lg">
          <span class="min-w-0 truncate"><b>${escapeHtml(o.name || o.email)}</b> · ${escapeHtml(o.title)}</span>
          <span class="shrink-0 font-mono">${rupees(o.amount)} <span class="px-1.5 rounded text-[10px] font-bold ${ORDER_STATUS_STYLE[o.status]}">${o.status}</span>${o.complimentary ? ' <span class="px-1.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800">Complimentary</span>' : ''}</span>
        </div>`).join('') || '<p class="text-slate-400">No payments yet.</p>';
      document.getElementById('ov-students').innerHTML = studentDirectory.slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6).map(st => `
        <button onclick="manageStudent('${escapeHtml(st.email)}')" class="w-full flex justify-between gap-3 p-2 bg-slate-50 border rounded-lg text-left hover:border-amber-500">
          <span class="min-w-0 truncate"><b>${escapeHtml(st.name || '—')}</b> · ${escapeHtml(st.email)}</span>
          <span class="shrink-0 text-slate-500">${st.createdAt ? fmtDate(st.createdAt) : ''}</span>
        </button>`).join('') || '<p class="text-slate-400">No students yet.</p>';
    }

    function revenueRange() {
      const period = document.getElementById('rev-period').value;
      const now = new Date();
      document.getElementById('rev-from-wrap').classList.toggle('hidden', period !== 'custom');
      document.getElementById('rev-to-wrap').classList.toggle('hidden', period !== 'custom');
      const y = now.getFullYear(), m = now.getMonth();
      if (period === 'month') return [new Date(y, m, 1), now, 'this month'];
      if (period === 'lastmonth') return [new Date(y, m - 1, 1), new Date(y, m, 1), 'last month'];
      if (period === '3m') return [new Date(y, m - 2, 1), now, 'the last 3 months'];
      if (period === 'fy') { const fy = m >= 3 ? y : y - 1; return [new Date(fy, 3, 1), now, `FY ${fy}–${String(fy + 1).slice(2)}`]; }
      if (period === 'custom') {
        const f = document.getElementById('rev-from').value, t = document.getElementById('rev-to').value;
        return [f ? new Date(f) : new Date(0), t ? new Date(new Date(t).getTime() + 86400000) : now, 'the chosen dates'];
      }
      return [new Date(0), now, 'all time'];
    }

    function ordersInRange() {
      const [from, to] = revenueRange();
      return paymentOrders.filter(o => { const t = orderTime(o); return t >= from && t < to; });
    }

    function renderRevenue() {
      if (!document.getElementById('rev-cards')) return;
      const [, , label] = revenueRange();
      const inRange = ordersInRange();
      // Complimentary approvals grant access but aren't real money received — excluded from every
      // sum/count on this screen so revenue reflects what was actually collected, not waived fees.
      const ok = inRange.filter(o => o.status === 'approved' && !o.complimentary);
      const total = ok.reduce((n, o) => n + orderNetAmount(o), 0);
      const pendingAll = paymentOrders.filter(o => o.status === 'pending');
      const buyers = new Set(ok.map(o => o.email)).size;
      document.getElementById('rev-cards').innerHTML =
        statCard('Collected', rupees(total), label) +
        statCard('Payments', ok.length, `${buyers} student(s)`) +
        statCard('Average payment', rupees(ok.length ? total / ok.length : 0)) +
        statCard('Waiting to verify', rupees(pendingAll.reduce((n, o) => n + (+o.amount || 0), 0)), `${pendingAll.length} payment(s), any date`, "showAdminPanel('payments')") +
        statCard('Rejected', inRange.filter(o => o.status === 'rejected').length, label);

      // last 12 months bar chart
      const now = new Date();
      const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
      const sums = months.map((d, i) => {
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return paymentOrders.filter(o => o.status === 'approved' && !o.complimentary && orderTime(o) >= d && orderTime(o) < next).reduce((n, o) => n + orderNetAmount(o), 0);
      });
      const max = Math.max(1, ...sums);
      const W = 720, H = 190, pad = 28, bw = (W - pad * 2) / 12;
      document.getElementById('rev-chart').innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="w-full min-w-[520px] h-auto" role="img" aria-label="Money collected per month over the last 12 months">
          ${sums.map((v, i) => {
            const h = Math.round((H - 50) * v / max);
            const x = pad + i * bw + 6, y = H - 26 - h;
            return `<rect x="${x}" y="${y}" width="${bw - 12}" height="${Math.max(h, v ? 2 : 0)}" rx="3" fill="${i === 11 ? '#f59e0b' : '#0f172a'}"><title>${months[i].toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}: ${rupees(v)}</title></rect>
              ${v ? `<text x="${x + (bw - 12) / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#475569">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</text>` : ''}
              <text x="${x + (bw - 12) / 2}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#64748b">${months[i].toLocaleDateString('en-IN', { month: 'short' })}</text>`;
          }).join('')}
          <line x1="${pad}" x2="${W - pad}" y1="${H - 26}" y2="${H - 26}" stroke="#cbd5e1" />
        </svg>`;

      const group = key => {
        const map = {};
        ok.forEach(o => { const k = key(o); (map[k] = map[k] || { n: 0, sum: 0 }); map[k].n++; map[k].sum += orderNetAmount(o); });
        return Object.entries(map).sort((a, b) => b[1].sum - a[1].sum);
      };
      const rowHtml = ([k, v]) => `<tr><td class="py-2 pr-3">${escapeHtml(k)}</td><td class="py-2 pr-3">${v.n}</td><td class="py-2 text-right font-mono font-bold">${rupees(v.sum)}</td></tr>`;
      const empty = '<tr><td colspan="3" class="py-4 text-center text-slate-400">No approved payments in this period.</td></tr>';
      document.getElementById('rev-by-item').innerHTML = group(o => o.title).map(rowHtml).join('') || empty;
      const typeName = { pass: 'Bundles', paper: 'Single papers', page: 'Pages', pdf: 'PDFs' };
      document.getElementById('rev-by-type').innerHTML = group(o => typeName[o.type] || o.type).map(rowHtml).join('') || empty;
    }


    function exportPaymentsCSV() {
      const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = ordersInRange().map(o => [
        (o.createdAt || '').slice(0, 10), (o.decidedAt || '').slice(0, 10), o.receiptNo || '', o.name || '', o.email,
        o.title, o.type, o.amount, o.utr, o.status, o.rejectReason || '', o.complimentary ? 'Yes' : '', o.refundedAmount || '', o.refundReason || '', orderNetAmount(o)
      ].map(cell).join(','));
      const head = ['Submitted', 'Decided', 'Receipt', 'Name', 'Email', 'Item', 'Type', 'Amount (₹)', 'UTR', 'Status', 'Reject reason', 'Complimentary', 'Refunded (₹)', 'Refund reason', 'Net (₹)'].map(cell).join(',');
      downloadFile(`payments_${todayISO()}.csv`, '\ufeff' + [head, ...rows].join('\r\n'), 'text/csv;charset=utf-8');
    }

    async function renderStorageUsage() {
      const el = document.getElementById('storage-usage');
      if (!el) return;
      const used = Object.keys(localStorage).reduce((n, k) => n + (localStorage.getItem(k) || '').length, 0) * 2;
      let files = '';
      try {
        const keys = await FileStore.keys();
        let bytes = 0;
        for (const k of keys) { const b = await FileStore.get(k); bytes += b ? b.size : 0; }
        files = ` PDF file storage: ${keys.length} file(s), ${(bytes / 1048576).toFixed(1)} MB.`;
      } catch (err) { /* ignore */ }
      el.innerText = `Settings storage: ${(used / 1048576).toFixed(2)} MB of about 5 MB used (pages, pictures, students, payments).${files}`;
    }

