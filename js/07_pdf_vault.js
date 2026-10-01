    /* ----------------------------------------------------
       7. PDF VAULT WITH STANDALONE PRICING
    ----------------------------------------------------- */
    /* PDFs are kept in the browser's file database (IndexedDB), which holds hundreds of MB,
       instead of the ~5 MB settings storage. A vault entry's url is then "idb:<doc id>". */
    const MAX_PDF_BYTES = 25 * 1024 * 1024;
    // Priced/paid PDFs are uploaded to this DEDICATED, PRIVATE storage bucket — separate from
    // 'study_materials' (which stays public because question images render as plain <img src>
    // tags and can't easily use short-lived signed URLs). Nothing in this bucket has a public
    // URL; the app must mint a short-lived signed URL via createSignedUrl() to read a file,
    // and only after checking isPdfUnlockedForUser(). See downloadOrOpenPdf() and
    // parseOwnStorageUrl() below, and fix_pdf_vault_private_bucket.sql for the bucket + policies.
    const PDF_VAULT_BUCKET = 'pdf_vault_files';
    // Recognizes a URL that points at our own Supabase Storage and, if so, how to read it:
    // - 'storage:<bucket>:<path>' (new format, always private — needs a signed URL)
    // - a legacy public Storage URL from before this fix (still fetchable directly, since the
    //   bucket it lives in — study_materials — stays public)
    // Returns null for genuinely external links (Google Drive, other sites, etc).
    function parseOwnStorageUrl(url) {
      if (!url) return null;
      if (url.startsWith('storage:')) {
        const rest = url.slice('storage:'.length);
        const i = rest.indexOf(':');
        if (i === -1) return null;
        return { bucket: rest.slice(0, i), path: rest.slice(i + 1), private: true };
      }
      if (SUPABASE_URL && url.startsWith(SUPABASE_URL)) {
        const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
        if (m) return { bucket: m[1], path: decodeURIComponent(m[2]), private: false };
        return { bucket: null, path: null, private: false }; // our host, unrecognized URL shape — fetch as-is
      }
      return null;
    }
    const FileStore = (() => {
      let dbPromise = null;
      const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('kas_files', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('files');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
      const run = async (mode, fn) => {
        const db = await open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('files', mode);
          const out = fn(tx.objectStore('files'));
          tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Storage refused the file'));
        });
      };
      return {
        put: (key, blob) => run('readwrite', st => st.put(blob, key)),
        get: key => run('readonly', st => st.get(key)),
        del: key => run('readwrite', st => st.delete(key)),
        keys: () => run('readonly', st => st.getAllKeys())
      };
    })();

    function dataUrlToBlob(dataUrl) {
      const [head, body] = dataUrl.split(',');
      const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/pdf';
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    }

    // Older versions stored PDFs inside settings storage; move them out to free space
    async function migrateStoredPdfs() {
      let moved = 0;
      for (const doc of pdfVault) {
        if (String(doc.url || '').startsWith('data:')) {
          try {
            const blob = dataUrlToBlob(doc.url);
            await FileStore.put(doc.id, blob);
            doc.url = 'idb:' + doc.id;
            doc.bytes = doc.bytes || blob.size;
            moved++;
          } catch (err) { /* leave it where it is */ }
        }
      }
      if (moved) {
        localStorage.setItem('kas_pdf_vault', JSON.stringify(pdfVault));
        renderPdfVault();
      }
    }

    async function handleUploadPdfDoc(e) {
      e.preventDefault();
      const form = e.target;
      const title = document.getElementById('pdf-doc-title').value.trim();
      const cat = document.getElementById('pdf-doc-cat').value;
      const access = document.getElementById('pdf-doc-access').value;
      const price = parseInt(document.getElementById('pdf-doc-price').value) || 0;
      const fileInput = document.getElementById('pdf-file-input');
      const urlInput = document.getElementById('pdf-url-input').value.trim();
      const btn = form.querySelector('button[type=submit]');

      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!isPdf) return alert('That file is not a PDF.');
        if (file.size > MAX_PDF_BYTES) {
          return alert(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB. The limit is 25 MB.\n\nUpload it to Google Drive (Share → "Anyone with the link"), then paste that link in the box below.`);
        }
        const id = 'doc_' + Date.now();
        btn.disabled = true;
        btn.innerText = 'Saving…';
        try {
          // Upload to Supabase Storage — a PRIVATE, dedicated bucket (see PDF_VAULT_BUCKET
          // above). No public URL is ever generated; the file can only be opened by minting a
          // short-lived signed URL, and only after the paywall check in downloadOrOpenPdf().
          const fileExt = file.name.split('.').pop();
          const fileName = `${id}.${fileExt}`;

          const { error: uploadError } = await supabaseClient.storage
            .from(PDF_VAULT_BUCKET)
            .upload(fileName, file, { cacheControl: '3600', upsert: false });

          if (uploadError) throw uploadError;

          // Save to your Vault catalog using a private storage reference (never a public link)
          if (await addPdfToVault({ id, title, category: cat, access, price, url: `storage:${PDF_VAULT_BUCKET}:${fileName}`, bytes: file.size })) {
             form.reset();
          }
        } catch (err) {
          alert(`Failed to upload PDF to the cloud: ${err.message}`);
        } finally {
          btn.disabled = false;
          btn.innerText = '+ Upload & Save Price';
        }
      } else if (urlInput) {
        if (!/^https?:\/\//i.test(urlInput)) return alert('The link must start with http:// or https://');
        if (await addPdfToVault({ id: 'doc_' + Date.now(), title, category: cat, access, price, url: urlInput, bytes: 0 })) form.reset();
      } else {
        alert('Attach a PDF file or paste a PDF link.');
      }
    }


