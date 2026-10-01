    /* ----------------------------------------------------
       15. BACKUP: EXPORT & RESTORE
    ----------------------------------------------------- */
    // Backup key → localStorage key
    const BACKUP_KEYS = {
      pricing: 'kas_pricing_master', nav: 'kas_nav_menu', pages: 'kas_custom_pages', pdfs: 'kas_pdf_vault',
      catalog: 'kas_tests_catalog', students: 'kas_student_directory', attempts: 'kas_user_attempts',
      planner: 'kas_study_planner', orders: 'kas_payment_orders', announcements: 'kas_announcements',
      authSettings: 'kas_auth_settings', practice: 'kas_practice_log',
      bundles: 'kas_bundles', planners: 'kas_planners', featureAccess: 'kas_feature_access'
    };

    // Pulls every Supabase table into a single downloadable JSON.
    // Complements the local export by capturing what's on the cloud (which is what
    // students actually see) instead of just this browser's localStorage.
    async function exportCloudSnapshot() {
      const btn = document.getElementById('cloud-snapshot-btn');
      const status = document.getElementById('cloud-snapshot-status');
      const oldText = btn.innerText;
      btn.disabled = true; btn.innerText = 'Snapshotting…';
      status.className = 'text-xs text-slate-600';
      status.innerText = 'Pulling tables from cloud…';
      const tables = [
        'bundles', 'tests_catalog', 'custom_pages', 'nav_menu', 'pdf_vault',
        'students', 'payment_orders', 'student_progress', 'attempts',
        'home_config', 'email_templates', 'email_log'
      ];
      const snapshot = {
        exported_at: new Date().toISOString(),
        exported_by: 'Evolve+ cloud snapshot',
        version: 1,
        tables: {}
      };
      const failed = [];
      for (const t of tables) {
        try {
          const { data, error } = await supabaseClient.from(t).select('*');
          if (error) throw error;
          snapshot.tables[t] = data || [];
          status.innerText = `Snapshotting… ${t} (${(data || []).length} rows)`;
        } catch (err) {
          console.error(`Snapshot: table "${t}" failed:`, fmtErr(err));
          snapshot.tables[t] = { _error: err.message || String(err) };
          failed.push(t);
        }
      }
      // Also include the local homeConfig + authSettings for portability
      snapshot.local = {
        home_config: (typeof homeConfig !== 'undefined') ? homeConfig : null,
        auth_settings: (typeof authSettings !== 'undefined') ? { ...authSettings, brevo: { ...(authSettings.brevo||{}), }, emailjs: { ...(authSettings.emailjs||{}) } } : null,
        pricing_master: (typeof pricingMaster !== 'undefined') ? pricingMaster : null
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `evolveplus_snapshot_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      btn.disabled = false; btn.innerText = oldText;
      const total = Object.entries(snapshot.tables).reduce((n, [, v]) => n + (Array.isArray(v) ? v.length : 0), 0);
      if (failed.length) {
        status.className = 'text-xs text-amber-700 font-bold';
        status.innerText = `✓ Snapshot saved (${total} rows). ⚠ ${failed.length} tables couldn't be read (${failed.join(', ')}) — check console. Store this file somewhere safe.`;
      } else {
        status.className = 'text-xs text-emerald-700 font-bold';
        status.innerText = `✓ Snapshot saved (${total} rows across ${tables.length} tables). Store this file somewhere safe — Google Drive, Dropbox, external drive.`;
      }
    }

    function exportDataJSON() {
      const backup = { app: 'kas-portal', version: 2, exportedAt: new Date().toISOString() };
      Object.entries(BACKUP_KEYS).forEach(([k, lsKey]) => {
        const raw = localStorage.getItem(lsKey);
        if (raw !== null) backup[k] = JSON.parse(raw);
      });
      // make sure in-memory data is included even if never saved
      Object.assign(backup, {
        pricing: pricingMaster, nav: navStructure, pages: customPages, pdfs: pdfVault, catalog: testsCatalog,
        students: studentDirectory, attempts: userAttempts, planner: plannerStore, orders: paymentOrders, announcements,
        practice: practiceLog, bundles, planners, featureAccess
      });
      const stored = pdfVault.filter(d => String(d.url || '').startsWith('idb:'));
      const withFiles = stored.length && confirm(`Include the ${stored.length} stored PDF file(s) in the backup?

OK = full backup (bigger file). Cancel = settings and content only.`);
      const finish = () => {
        downloadFile(`kas_portal_backup_${todayISO()}.json`, JSON.stringify(backup), 'application/json');
        alert('Backup downloaded. It contains student emails and password hashes, so store it somewhere private.');
      };
      if (!withFiles) return finish();
      Promise.all(stored.map(async d => {
        const blob = await FileStore.get(d.id);
        return blob ? [d.id, await blobToDataUrl(blob)] : null;
      })).then(pairs => {
        backup.pdfFiles = Object.fromEntries(pairs.filter(Boolean));
        finish();
      }).catch(() => { alert("Some PDF files couldn't be read; the backup was made without them."); finish(); });
    }

    function importDataJSON(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try { data = JSON.parse(reader.result); } catch (err) { return alert('That file is not a valid backup (could not read JSON).'); }
        const found = Object.keys(BACKUP_KEYS).filter(k => k in data);
        if (!found.includes('students') && !found.includes('catalog')) {
          return alert('That file does not look like a portal backup (no students or test catalog found).');
        }
        const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString('en-IN') : 'an unknown date';
        if (!confirm(`Restore the backup from ${when}?\n\nThis replaces pages, tests, students, payments and settings on this device with the backup's copy. Export a backup of the current data first if you might need it.`)) return;
        found.forEach(k => localStorage.setItem(BACKUP_KEYS[k], JSON.stringify(data[k])));
        const files = Object.entries(data.pdfFiles || {});
        if (files.length) {
          Promise.all(files.map(([id, dataUrl]) => FileStore.put(id, dataUrlToBlob(dataUrl)))).finally(() => {
            localStorage.setItem('kas_legal_pages_added', '1');
            localStorage.removeItem('kas_user');
            alert('Backup restored, including PDF files. The page will reload; log in again to continue.');
            location.reload();
          });
          return;
        }
        localStorage.setItem('kas_legal_pages_added', '1');
        localStorage.removeItem('kas_user');
        alert('Backup restored. The page will reload; log in again to continue.');
        location.reload();
      };
      reader.readAsText(file);
    }
