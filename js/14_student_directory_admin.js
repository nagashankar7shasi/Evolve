    /* ----------------------------------------------------
       14. STUDENT DIRECTORY (admin)
    ----------------------------------------------------- */
    function renderStudentDirectoryTable() {
      const body = document.getElementById('dir-table-body');
      if (!body) return;
      const bulkSel = document.getElementById('dir-bulk-pass');
      if (bulkSel.options.length !== bundles.length) {
        bulkSel.innerHTML = bundles.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
      }
      // Rebuild the filter dropdown so per-bundle options match the current bundle list.
      // Preserves the currently selected value so switching bundles doesn't reset the filter.
      const dirFilter = document.getElementById('dir-filter');
      const prevVal = dirFilter.value;
      const wantOptions = 5 + bundles.length; // 5 built-in + one per bundle
      if (dirFilter.options.length !== wantOptions) {
        const bundleOpts = bundles.map(b => `<option value="pass:${b.id}">Has "${escapeHtml(b.name)}"</option>`).join('');
        dirFilter.innerHTML = `
          <option value="all">All students</option>
          <option value="pass">Has any pass</option>
          <option value="nopass">Has no pass</option>
          <option value="pending">Payment waiting</option>
          <option value="never">Never logged in</option>
          <option value="inactive">Deactivated</option>
          ${bundleOpts ? '<optgroup label="By pass">' + bundleOpts + '</optgroup>' : ''}
        `;
        if (prevVal) dirFilter.value = prevVal;
      }

      const q = document.getElementById('dir-search').value.trim().toLowerCase();
      const filter = dirFilter.value;
      const pendingEmails = new Set(paymentOrders.filter(o => o.status === 'pending').map(o => o.email));
      const rows = studentDirectory.filter(st => {
        if (q && !`${st.email} ${st.name || ''} ${st.phone || ''}`.toLowerCase().includes(q)) return false;
        if (filter === 'pass')     return st.passes.length > 0;
        if (filter === 'nopass')   return !st.passes.length;
        if (filter === 'pending')  return pendingEmails.has(st.email);
        if (filter === 'never')    return !st.lastLoginAt;
        if (filter === 'inactive') return isStudentBlocked(st);
        // Per-bundle filter: "pass:<bundleId>" — student holds that specific pass and it hasn't expired
        if (filter.startsWith('pass:')) {
          const id = filter.slice(5);
          return st.passes.includes(id) && !isPassExpired(st, id);
        }
        return true;
      });
      document.getElementById('dir-count').innerText = `(${studentDirectory.length})`;
      document.getElementById('dir-select-all').checked = false;
      body.innerHTML = rows.length ? rows.map(st => `
        <tr class="${isStudentBlocked(st) ? 'text-slate-400' : ''}">
          <td class="py-2 pr-2"><input type="checkbox" class="dir-row-cb" value="${escapeHtml(st.email)}" aria-label="Select ${escapeHtml(st.email)}" /></td>
          <td class="py-2 pr-3"><div class="font-bold ${isStudentBlocked(st) ? '' : 'text-slate-800'}">${escapeHtml(st.name || '—')}</div><div class="text-slate-500">${escapeHtml(st.email)}</div>${st.phone ? `<div class="text-slate-400 text-[10px]">📱 ${escapeHtml(st.phone)}</div>` : ''}</td>
          <td class="py-2 pr-3">${st.passes.length ? st.passes.map(k => `<span class="inline-block mb-0.5 px-1.5 py-0.5 rounded ${isPassExpired(st, k) ? 'bg-slate-100 text-slate-400 line-through' : 'bg-emerald-50 text-emerald-800'} text-[10px] font-bold" title="${escapeHtml((st.passExpiry || {})[k] ? 'Until ' + fmtDate(st.passExpiry[k]) : 'No expiry')}">${escapeHtml(bundleLabel(k))}</span>`).join(' ') : '<span class="text-slate-300">—</span>'}</td>
          <td class="py-2 pr-3 font-mono">${st.allowedExams.length} / ${st.allowedPages.length} / ${st.allowedPdfs.length}</td>
          <td class="py-2 pr-3 whitespace-nowrap">${st.lastLoginAt ? fmtDateTime(st.lastLoginAt) : '<span class="text-slate-400">Never</span>'}</td>
          <td class="py-2 pr-3 text-[11px]">${plannerSummary(st.email).replace(/KPSC KAS/, 'KPSC').replace(/UPSC CSE/, 'UPSC')}</td>
          <td class="py-2 pr-3">${pendingEmails.has(st.email) ? '<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">Payment waiting</span> ' : ''}${isStudentBlocked(st) ? '<span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">Deactivated</span>' : '<span class="text-emerald-700 text-[10px] font-bold">Active</span>'}</td>
          <td class="py-2 text-right whitespace-nowrap">
            <button onclick="manageStudent('${escapeHtml(st.email)}')" class="text-blue-600 font-bold hover:underline">Manage</button>
            <button onclick="toggleStudentActive('${escapeHtml(st.email)}')" class="ml-2 text-slate-500 font-bold hover:underline">${isStudentBlocked(st) ? 'Reactivate' : 'Deactivate'}</button>
          </td>
        </tr>`).join('') : `<tr><td colspan="8" class="py-6 text-center text-slate-400">No students match this filter.${filter !== 'all' ? ' <button onclick="document.getElementById(\'dir-filter\').value=\'all\'; renderStudentDirectoryTable()" class="underline text-blue-600 font-bold ml-1">Clear filter</button>' : ''}</td></tr>`;
    }

    function manageStudent(email) {
      const st = getStudentRecord(email);
      if (!st) return;
      showAdminPanel('entitlements');
      selectStudent(st);
      document.getElementById('entitlements-desk').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function toggleStudentActive(email) {
      const st = getStudentRecord(email);
      if (!st) return;
      const deactivate = !isStudentBlocked(st);
      if (!confirm(deactivate
        ? `Deactivate ${st.email}? They won't be able to log in, but their access and history are kept.`
        : `Reactivate ${st.email}?`)) return;
      st.status = deactivate ? 'inactive' : 'active';
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      afterStudentDataChange();
    }

    function bulkPass(grant) {
      const pass = document.getElementById('dir-bulk-pass').value;
      const emails = [...document.querySelectorAll('.dir-row-cb:checked')].map(cb => cb.value);
      if (!emails.length) return alert('Tick at least one student first.');
      if (!confirm(`${grant ? 'Grant' : 'Remove'} ${passLabel(pass)} ${grant ? 'to' : 'from'} ${emails.length} student(s)?`)) return;
      emails.forEach(email => {
        const st = getStudentRecord(email);
        if (!st) return;
        if (grant) grantPass(st, pass);
        else revokePass(st, pass);
      });
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));
      afterStudentDataChange();
    }

    function downloadFile(filename, content, type) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type }));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    function exportStudentsCSV() {
      const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['Email', 'Name', 'Status', 'Passes', 'Tests', 'Pages', 'PDFs', 'Joined', 'Last login', 'Planners'];
      const lines = studentDirectory.map(st => [
        st.email, st.name || '', isStudentBlocked(st) ? 'Deactivated' : 'Active', st.passes.map(passLabel).join('; '),
        st.allowedExams.length, st.allowedPages.length, st.allowedPdfs.length,
        st.createdAt ? st.createdAt.slice(0, 10) : '', st.lastLoginAt ? st.lastLoginAt.slice(0, 10) : '', plannerSummary(st.email)
      ].map(cell).join(','));
      downloadFile(`students_${todayISO()}.csv`, '\ufeff' + [header.map(cell).join(','), ...lines].join('\r\n'), 'text/csv;charset=utf-8');
    }

