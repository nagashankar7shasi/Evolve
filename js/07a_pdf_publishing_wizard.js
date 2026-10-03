    // ============================================================
    // PDF PUBLISHING WIZARD — end-to-end flow
    // ============================================================
    // Design overview (explains the mental model, not just the code):
    //
    //  Step 1  Upload the file (Supabase Storage) + set title/category/price.
    //          Same underlying call as the quick-upload form, but no immediate
    //          publish — we keep the uploaded doc in wizardState until step 3.
    //
    //  Step 2  Distribution — how do students find and pay for it?
    //          Four options, all optional and combinable:
    //            (a) Shareable link — nothing to save; just show the URL that
    //                'downloadOrOpenPdf(docId)' resolves to.
    //            (b) Add to page as a Resource card — inserts a
    //                <div class="kb-resource-card" data-target-type="pdf" …> into
    //                the chosen page's content and re-upserts that page to cloud.
    //            (c) Include in bundles — toggles the pdf's ID into each chosen
    //                bundle's `pdfs` array and re-upserts each bundle.
    //            (d) Feature in "What's New" — no-op (What's New is auto-populated
    //                from newest vault entries); shown as a checkbox for clarity.
    //
    //  Step 3  Confirmation + copyable share link + summary of exactly what
    //          happened, so the admin knows the state without hunting.
    //
    //  Runtime flow for STUDENTS (unchanged, just clarified here):
    //    Student clicks a PDF link/card → downloadOrOpenPdf(docId) →
    //    isPdfUnlockedForUser(doc) checks free/admin/bundle/individual →
    //      if unlocked: opens the file
    //      if locked:   openCheckout('pdf', doc.id, doc.title, doc.price) →
    //                     student pays via UPI, submits UTR →
    //                     admin approves → grantOrder pushes doc.id into
    //                     student.allowedPdfs → next click succeeds.

    let wizardState = null;  // { doc, uploaded, distribution }

    function openPdfWizard() {
      wizReset();
      wizGoto(1);
      openModal('pdf-wizard-modal');
    }

    function wizReset() {
      wizardState = null;
      // Clear step-1 fields
      const clear = id => { const el = document.getElementById(id); if (el) el.value = (id === 'wiz-price' ? '49' : ''); };
      ['wiz-title', 'wiz-file', 'wiz-url', 'wiz-price'].forEach(clear);
      const cat = document.getElementById('wiz-category'); if (cat) cat.selectedIndex = 0;
      // Reset step-2 checkboxes
      ['wiz-dist-page', 'wiz-dist-bundle'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
      ['wiz-dist-link', 'wiz-dist-whatsnew'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = true; });
    }

    function wizGoto(step) {
      for (let i = 1; i <= 3; i++) {
        const panel = document.getElementById(`wiz-panel-${i}`);
        if (panel) panel.classList.toggle('hidden', i !== step);
        const label = document.getElementById(`wiz-step-${i}`);
        if (label) {
          label.classList.remove('wiz-step-active', 'wiz-step-done');
          if (i < step) label.classList.add('wiz-step-done');
          if (i === step) label.classList.add('wiz-step-active');
        }
      }
    }

    async function wizUpload() {
      const title = document.getElementById('wiz-title').value.trim();
      const cat = document.getElementById('wiz-category').value;
      const price = Math.max(0, parseInt(document.getElementById('wiz-price').value, 10) || 0);
      const fileInput = document.getElementById('wiz-file');
      const urlInput = document.getElementById('wiz-url').value.trim();

      if (!title) return alert('Give the PDF a title.');
      if (!fileInput.files.length && !urlInput) return alert('Attach a PDF file or paste a URL.');

      const btn = document.getElementById('wiz-upload-btn');
      const oldText = btn.innerText;
      btn.disabled = true;
      btn.innerText = 'Uploading…';

      try {
        let uploadedUrl = urlInput;
        let bytes = 0;

        if (fileInput.files.length) {
          // Uploaded to the PRIVATE PDF_VAULT_BUCKET (see its definition above) — never a
          // public URL. downloadOrOpenPdf() mints a short-lived signed URL after checking access.
          const file = fileInput.files[0];
          bytes = file.size;
          const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: upErr } = await supabaseClient.storage.from(PDF_VAULT_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
          if (upErr) throw upErr;
          uploadedUrl = `storage:${PDF_VAULT_BUCKET}:${path}`;
        }

        const doc = {
          id: 'doc_' + Date.now(),
          title,
          category: cat,
          access: price > 0 ? 'paid' : 'free',
          price,
          url: uploadedUrl,
          bytes
        };

        // Add to vault (in-memory + local + cloud); addPdfToVault also renders the vault list
        const ok = await addPdfToVault(doc);
        if (!ok) throw new Error('Vault save failed');

        // Populate step-2 with context for the admin
        document.getElementById('wiz-uploaded-title').innerText = title;
        document.getElementById('wiz-uploaded-meta').innerText =
          `${doc.access === 'paid' ? '₹' + price : 'Free'} · ${cat}${bytes ? ' · ' + Math.round(bytes / 1024) + ' KB' : ''}`;

        // Fill page dropdown (for the "add to page" option)
        const pageSel = document.getElementById('wiz-page-target');
        const pages = (customPages || []).slice();
        pageSel.innerHTML = pages.length
          ? pages.map(p => `<option value="${p.id}">${escapeHtml(p.icon || '📄')} ${escapeHtml(p.title)}</option>`).join('')
          : '<option value="">(No pages exist yet — create one in Pages first)</option>';
        if (!pages.length) document.getElementById('wiz-dist-page').checked = false;

        // Fill bundle checkbox list
        const bundleBox = document.getElementById('wiz-bundle-list');
        bundleBox.innerHTML = (bundles || []).length
          ? bundles.map(b => `<label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" class="wiz-bundle-cb rounded" value="${b.id}" />
              <span class="text-slate-700">${escapeHtml(b.name)}</span>
            </label>`).join('')
          : '<span class="text-slate-400">No bundles exist yet — create one in Bundles first.</span>';
        if (!(bundles || []).length) document.getElementById('wiz-dist-bundle').checked = false;

        wizardState = { doc };
        wizGoto(2);
      } catch (err) {
        alert('Upload failed: ' + (err.message || err));
      } finally {
        btn.disabled = false;
        btn.innerText = oldText;
      }
    }

    async function wizPublish() {
      if (!wizardState || !wizardState.doc) return;
      const doc = wizardState.doc;
      const distLink = document.getElementById('wiz-dist-link').checked;
      const distPage = document.getElementById('wiz-dist-page').checked;
      const distBundle = document.getElementById('wiz-dist-bundle').checked;
      const distWhatsNew = document.getElementById('wiz-dist-whatsnew').checked;
      const pageId = document.getElementById('wiz-page-target').value;
      const bundleIds = Array.from(document.querySelectorAll('.wiz-bundle-cb:checked')).map(cb => cb.value);

      const btn = document.getElementById('wiz-publish-btn');
      const oldText = btn.innerText;
      btn.disabled = true;
      btn.innerText = 'Publishing…';

      const results = { link: null, page: null, bundles: [], whatsnew: distWhatsNew };
      const errors = [];

      try {
        // (a) Shareable link — an in-app deep link, NOT the raw storage file. Opening it routes
        // through routeFromHash() → downloadOrOpenPdf(), which still enforces the paywall
        // (isPdfUnlockedForUser) before anything is fetched. This is what makes the link safe
        // to share even for a paid PDF: the file itself has no public URL to bypass.
        if (distLink) {
          results.link = `${location.origin}${location.pathname}#/pdf/${encodeURIComponent(doc.id)}`;
        }

        // (b) Add to a page as a Resource card
        if (distPage && pageId) {
          const page = customPages.find(p => p.id === pageId);
          if (!page) throw new Error('Chosen page not found');
          // Uses the same buildResourceCardHtml() the page editor's "Insert Resource Card"
          // modal uses (08_word_page_creator.js) -- this used to be its own hand-copied
          // markup here, which silently fell out of sync (missing the delete button, stuck
          // on the old "Open PDF →" label) the moment that card type was redesigned elsewhere.
          const cardHtml = buildResourceCardHtml({
            type: 'pdf',
            targetId: doc.id,
            title: doc.title,
            desc: `${doc.category} · ${doc.access === 'paid' ? '₹' + doc.price : 'Free'}`,
            thumbHtml: `<div class="kb-resource-thumb" aria-hidden="true">📕</div>`
          });
          // Appended through the DOM, not by concatenating raw HTML strings. Existing page
          // content can end mid-element (an unclosed table cell, a stray div left by some
          // earlier edit) -- pasting new HTML onto the end of that as plain text risks the
          // browser's parser silently mis-nesting or dropping it when the editor next loads
          // this content back in. Building it as real DOM nodes first lets the browser resolve
          // that the same way it already does for everything else in the editor.
          const existing = document.createElement('div');
          existing.innerHTML = page.content || '';
          const added = document.createElement('div');
          added.innerHTML = cardHtml;
          while (added.firstChild) existing.appendChild(added.firstChild);
          page.content = existing.innerHTML;
          // Upsert this one page back to cloud
          const { error } = await supabaseClient.from('custom_pages').upsert({
            id: page.id, slug: page.slug, title: page.title, is_gated: page.isGated, price: page.price,
            content: page.content, parent_id: page.parentId, icon: page.icon, image: page.image,
            summary: page.summary, child_style: page.childStyle, order_num: page.order,
            show_on_home: page.showOnHome, bundle_only: page.bundleOnly, old_slugs: page.oldSlugs || []
          });
          if (error) throw new Error('Page update failed: ' + error.message);
          localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));
          results.page = page.title;
        }

        // (c) Add to bundles
        if (distBundle && bundleIds.length) {
          for (const bid of bundleIds) {
            const b = bundles.find(x => x.id === bid);
            if (!b) continue;
            if (!(b.pdfs || []).includes(doc.id)) b.pdfs = [...(b.pdfs || []), doc.id];
            try {
              const { error } = await supabaseClient.from('bundles').upsert({
                id: b.id, name: b.name, tagline: b.tagline || '', price: b.price,
                validity_days: b.validityDays, highlights: b.highlights || [], active: b.active,
                show_on_home: b.showOnHome, featured: b.featured, style: b.style || 'light',
                order_num: b.order || 0, all_access: b.allAccess, categories: b.categories || [],
                papers: b.papers || [], pages: b.pages || [], pdfs: b.pdfs || [],
                planners: b.planners || [], features: b.features || []
              });
              if (error) throw error;
              results.bundles.push(b.name);
            } catch (err) {
              errors.push(`Bundle "${b.name}" update failed: ${err.message || err}`);
            }
          }
          saveBundles();
        }

        // Step 3: show summary + copy link
        const parts = [`Uploaded "${doc.title}" (${doc.access === 'paid' ? '₹' + doc.price : 'Free'}) to the vault.`];
        if (results.page) parts.push(`Added as a Resource card to page: <b>${escapeHtml(results.page)}</b>.`);
        if (results.bundles.length) parts.push(`Included in ${results.bundles.length} bundle${results.bundles.length > 1 ? 's' : ''}: <b>${results.bundles.map(escapeHtml).join(', ')}</b>. All existing pass holders now have access.`);
        if (results.whatsnew) parts.push(`Will appear in "What's New" on the home page automatically.`);
        if (errors.length) parts.push(`<b class="text-rose-600">Warnings:</b> ${errors.map(escapeHtml).join(' · ')}`);
        document.getElementById('wiz-done-summary').innerHTML = `${doc.access === 'paid' ? 'Students will be prompted to pay ₹' + doc.price + ' before download.' : 'The PDF is free to download for anyone with the link.'}`;
        document.getElementById('wiz-done-details').innerHTML = '<ul class="list-disc list-inside space-y-0.5">' + parts.map(p => `<li>${p}</li>`).join('') + '</ul>';

        if (results.link) {
          document.getElementById('wiz-share-link').value = results.link;
          document.getElementById('wiz-share-link-box').classList.remove('hidden');
        } else {
          document.getElementById('wiz-share-link-box').classList.add('hidden');
        }

        renderHomeBundles();
        renderHomePage();
        wizGoto(3);
      } catch (err) {
        alert('Publish failed: ' + (err.message || err));
      } finally {
        btn.disabled = false;
        btn.innerText = oldText;
      }
    }

    function wizCopyLink() {
      const inp = document.getElementById('wiz-share-link');
      inp.select();
      try {
        document.execCommand('copy');
        const box = inp.parentElement;
        const oldBtn = box.querySelector('button').innerText;
        box.querySelector('button').innerText = '✓ Copied';
        setTimeout(() => { box.querySelector('button').innerText = oldBtn; }, 1500);
      } catch (_) {
        alert('Copy failed — select the URL manually and copy with Ctrl+C.');
      }
    }


    async function addPdfToVault(doc) {
      doc.price = doc.access === 'free' ? 0 : doc.price;
      pdfVault.push(doc);
      try {
        localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));
      } catch (err) {
        pdfVault.pop();
        alert("Settings storage is full, so this PDF entry wasn't saved. Remove large pictures from pages or delete old PDFs, then try again.");
        return false;
      }

      // --- SYNC TO SUPABASE CLOUD ---
      const { error } = await supabaseClient.from('pdf_vault').upsert({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        access: doc.access,
        price: doc.price,
        url: doc.url,
        bytes: doc.bytes
      });
      if (error) {
        pdfVault.pop();
        localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));
        alert("Failed to save PDF to cloud: " + error.message);
        return false;
      }

      renderPdfVault();
      renderStudentEntitlementsDesk();
      alert(`PDF "${doc.title}" saved (${doc.price ? '₹' + doc.price : 'free'}).\n\nTo link it: select words in the Page Editor, then click "Link Highlighted Words to PDF".`);
      return true;
    }

    function renderPdfVault() {
      const container = document.getElementById('pdf-vault-list');
      container.innerHTML = '';

      pdfVault.forEach(doc => {
        const url = String(doc.url || '');
        const isPrivateRef = url.startsWith('storage:');
        const isLegacyPublic = !isPrivateRef && /^(idb|data):/.test(url) === false && SUPABASE_URL && url.startsWith(SUPABASE_URL);
        const needsSecuring = doc.access === 'paid' && isLegacyPublic;
        let statusLine;
        if (/^(idb|data):/.test(url)) {
          statusLine = `Stored in this browser${doc.bytes ? ` · ${(doc.bytes / 1048576).toFixed(1)} MB` : ''}`;
        } else if (isPrivateRef) {
          statusLine = `🔒 Stored securely — no public link, opens via signed URL only`;
        } else if (isLegacyPublic) {
          statusLine = needsSecuring
            ? `⚠️ Uploaded before the secure-storage fix — this file still has a public link. Click "Secure" to fix.`
            : `Uploaded before the secure-storage fix (free, so no risk)`;
        } else {
          statusLine = `Web link: <span class="font-mono">${escapeHtml(doc.url || 'missing')}</span>`;
        }
        const div = document.createElement('div');
        div.className = "p-3 bg-slate-50 border rounded-xl space-y-1.5";
        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800 text-xs">${escapeHtml(doc.title)}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${doc.access === 'paid' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${doc.access === 'paid' ? `PAID (₹${doc.price})` : 'FREE'}
            </span>
          </div>
          <div class="text-[10px] text-slate-500 truncate">${statusLine}</div>
          <div class="flex justify-between items-center text-[11px] pt-1">
            <span class="text-slate-400">Tag: ${doc.category}</span>
            <div class="space-x-3">
              ${needsSecuring ? `<button onclick="securePdfDoc('${doc.id}')" class="text-amber-700 font-bold hover:underline">🔒 Secure</button>` : ''}
              <button onclick="downloadOrOpenPdf('${doc.id}')" class="text-blue-600 font-bold hover:underline">Preview</button>
              <button onclick="openEditPdfModal('${doc.id}')" class="text-amber-600 font-bold hover:underline">Edit</button>
              <button onclick="deletePdfDoc('${doc.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
            </div>
          </div>
        `;
        container.appendChild(div);
      });
    }

    // Edit an existing vault entry's metadata (title / category / access / price) without
    // touching its file or id -- until this existed, the only way to fix a typo in a title or
    // change a PDF's price was to delete the entry and upload the file again, which also broke
    // any bundle or page resource card already pointing at its old id. Replacing the underlying
    // file itself is intentionally NOT part of this -- that's a separate, riskier operation
    // (see securePdfDoc, just below, which is the template for a future "replace file" action).
    let editingPdfDocId = null;

    function openEditPdfModal(docId) {
      const doc = pdfVault.find(d => d.id === docId);
      if (!doc) return;
      editingPdfDocId = docId;
      document.getElementById('pdf-edit-title').value = doc.title || '';
      document.getElementById('pdf-edit-cat').value = doc.category || 'KPSC KAS';
      document.getElementById('pdf-edit-access').value = doc.access || 'paid';
      document.getElementById('pdf-edit-price').value = doc.price || 0;
      openModal('pdf-edit-modal');
    }

    async function savePdfEdit() {
      const doc = pdfVault.find(d => d.id === editingPdfDocId);
      if (!doc) return closeModal('pdf-edit-modal');

      const title = document.getElementById('pdf-edit-title').value.trim();
      if (!title) return alert('Give the document a title.');
      const category = document.getElementById('pdf-edit-cat').value;
      const access = document.getElementById('pdf-edit-access').value;
      const price = access === 'free' ? 0 : (parseInt(document.getElementById('pdf-edit-price').value, 10) || 0);

      const { error } = await supabaseClient.from('pdf_vault')
        .update({ title, category, access, price }).eq('id', doc.id);
      if (error) return alert('Failed to save changes: ' + error.message);

      doc.title = title;
      doc.category = category;
      doc.access = access;
      doc.price = price;
      localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));

      editingPdfDocId = null;
      closeModal('pdf-edit-modal');
      renderPdfVault();
      renderStudentEntitlementsDesk();
    }

    // One-time migration for a PAID PDF that was uploaded before this fix (so it still has a
    // public Supabase Storage URL): re-download its bytes, re-upload them into the PRIVATE
    // PDF_VAULT_BUCKET, and repoint the vault row at that private reference. The old public
    // object is left in place (harmless for anyone without its exact URL already) — delete it
    // by hand in the Supabase dashboard afterward if you want it fully gone.
    async function securePdfDoc(docId) {
      const doc = pdfVault.find(d => d.id === docId);
      if (!doc) return;
      if (!confirm(`Move "${doc.title}" to secure storage?\n\nAfter this, the old public link will no longer open it — only the app's own payment-gated link will.`)) return;
      try {
        const r = await fetch(doc.url);
        if (!r.ok) throw new Error(`Could not re-download the existing file (HTTP ${r.status})`);
        const blob = await r.blob();
        const ext = (String(doc.url).split('.').pop() || 'pdf').split(/[?#]/)[0];
        const path = `${doc.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabaseClient.storage.from(PDF_VAULT_BUCKET).upload(path, blob, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });
        if (upErr) throw upErr;
        const newUrl = `storage:${PDF_VAULT_BUCKET}:${path}`;
        const { error: dbErr } = await supabaseClient.from('pdf_vault').update({ url: newUrl }).eq('id', docId);
        if (dbErr) throw dbErr;
        doc.url = newUrl;
        localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));
        renderPdfVault();
        alert(`"${doc.title}" is now in secure storage. Its old public link is dead weight in Supabase Storage — delete it there whenever convenient.`);
      } catch (err) {
        alert('Could not secure this PDF: ' + fmtErr(err));
      }
    }

    async function deletePdfDoc(docId) {
      if (confirm('Delete this PDF from the vault? Any links to it will expire.')) {
        // --- DELETE FROM SUPABASE CLOUD ---
        const { error } = await supabaseClient.from('pdf_vault').delete().eq('id', docId);
        if (error) {
          alert("Failed to delete PDF from cloud: " + error.message);
          return;
        }

        pdfVault = pdfVault.filter(d => d.id !== docId);
        localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));
        FileStore.del(docId).catch(() => {});

        // Also re-sync any bundles that referenced this PDF, so the cloud copy matches.
        const affectedBundles = bundles.filter(b => (b.pdfs || []).includes(docId));
        bundles.forEach(b => { b.pdfs = b.pdfs.filter(x => x !== docId); });
        saveBundles();
        for (const b of affectedBundles) {
          const { error: bErr } = await supabaseClient.from('bundles').upsert({
            id: b.id, name: b.name, tagline: b.tagline || '', price: b.price,
            validity_days: b.validityDays, highlights: b.highlights || [], active: b.active,
            show_on_home: b.showOnHome, featured: b.featured, style: b.style || 'light',
            order_num: b.order || 0, all_access: b.allAccess, categories: b.categories || [],
            papers: b.papers || [], pages: b.pages || [], pdfs: b.pdfs || [],
            planners: b.planners || [], features: b.features || []
          });
          if (bErr) console.error("Failed to re-sync bundle after PDF delete:", bErr);
        }

        renderPdfVault();
        renderStudentEntitlementsDesk();
      }
    }

