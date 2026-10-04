    /* ----------------------------------------------------
       8. WORD PAGE CREATOR & DYNAMIC PAGE UPDATER
    ----------------------------------------------------- */
    // ---- Content blocks for the page editor ----
    let editorRange = null;
    document.addEventListener('selectionchange', () => {
      const canvas = document.getElementById('word-editor-canvas');
      const sel = window.getSelection();
      if (!canvas || !sel.rangeCount) return;
      const node = sel.anchorNode;
      if (node && canvas.contains(node)) {
        editorRange = sel.getRangeAt(0).cloneRange();
        const el = node.nodeType === 1 ? node : node.parentElement;
        const cell = el.closest('td, th');
        const tools = document.getElementById('table-tools');
        tools.classList.toggle('hidden', !cell);
        tools.classList.toggle('inline-flex', !!cell);
        // Same floating-toolbar pattern as tables: shows +/- Column controls only while the
        // caret is actually inside a multi-column block, so they don't clutter the bar otherwise.
        const colsBlock = el.closest('.kb-cols, .kb-cols-3, .kb-cols-4');
        const colsTools = document.getElementById('cols-tools');
        if (colsTools) {
          colsTools.classList.toggle('hidden', !colsBlock);
          colsTools.classList.toggle('inline-flex', !!colsBlock);
        }
      }
    });

    // Inserts HTML for a non-editable block (resource card, page card) and immediately verifies it
    // actually arrived with its real content, not just its opening markup -- execCommand
    // ('insertHTML') re-parses a string in the context of the live, already-edited DOM, and one
    // admin session ended up with a resource card stub (only its ✎/✕ buttons, no title or
    // thumbnail) silently saved to Supabase this way; it only became visible as a broken empty box
    // once that page reached students. Rather than assume this was a one-off, every new-card
    // insertion is checked right after it happens: if the content that should be there isn't, the
    // stub is removed and the admin is told to try again instead of it quietly reaching the
    // database. `validateFn` gets the inserted element and returns whether it looks right.
    function insertHtmlWithIntegrityCheck(html, validateFn, blockLabel) {
      const canvas = document.getElementById('word-editor-canvas');
      const marker = 'kb-just-inserted-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const markedHtml = html.replace(/^(<div\s+class="[^"]+")/, `$1 data-just-inserted="${marker}"`);
      document.execCommand('insertHTML', false, markedHtml);
      const inserted = canvas.querySelector(`[data-just-inserted="${marker}"]`);
      if (!inserted) return; // caret wasn't in the canvas or insertion landed somewhere unexpected -- nothing to validate
      inserted.removeAttribute('data-just-inserted');
      if (!validateFn(inserted)) {
        inserted.remove();
        alert(`Inserting that ${blockLabel} didn't go through cleanly, so nothing was added. Please try again.`);
      }
    }

    function placeCaretInEditor() {
      const canvas = document.getElementById('word-editor-canvas');
      canvas.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      if (editorRange && canvas.contains(editorRange.startContainer)) sel.addRange(editorRange);
      else {
        const r = document.createRange();
        r.selectNodeContents(canvas);
        r.collapse(false);
        sel.addRange(r);
      }
    }

    // Same ✕-overlay pattern as the table-delete button above: an island button, not part of
    // normal editable flow, so a multi-column block can be removed in one obvious click instead
    // of only through the floating per-block toolbar (which, like the old table toolbar, is easy
    // to miss unless the cursor happens to already be inside the block).
    const COLS_DELETE_BTN = '<button type="button" class="kb-block-delete" contenteditable="false" title="Delete this column block" onmousedown="event.preventDefault()" onclick="event.stopPropagation(); removeColsBlock(this);">✕</button>';
    function removeColsBlock(btn) {
      const block = btn.closest('.kb-cols, .kb-cols-3, .kb-cols-4');
      if (block && confirm('Delete this column block?')) block.remove();
    }

    // Recomputes the actual number of columns (every child except the delete-button island) and
    // sets it as an inline style, so the layout tracks columns added/removed after the block was
    // first inserted -- the mobile/tablet breakpoints in main.css override this with !important,
    // so a block with 5 or 6 columns still collapses sensibly on a phone.
    function applyColsWidth(block) {
      const cols = [...block.children].filter(c => c.tagName === 'DIV');
      block.style.gridTemplateColumns = `repeat(${Math.max(1, cols.length)}, minmax(0, 1fr))`;
    }

    // Adds or removes one column from the multi-column block the caret is currently inside.
    // Mirrors tableAction()'s addCol/delCol, which is the existing pattern admins already know
    // from tables -- requested so columns (like table rows/columns) can keep changing after the
    // block is first inserted, not just at insertion time.
    function columnsAction(action) {
      const node = editorRange && editorRange.startContainer;
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      const block = el && el.closest('.kb-cols, .kb-cols-3, .kb-cols-4');
      if (!block) return alert('Click inside a multi-column block first.');
      const cols = [...block.children].filter(c => c.tagName === 'DIV');
      if (action === 'addCol') {
        if (cols.length >= 6) return alert('A column block supports at most 6 columns.');
        const div = document.createElement('div');
        div.innerHTML = `<h3>Column ${cols.length + 1}</h3><p>Text.</p>`;
        block.appendChild(div);
        moveEditorCaretTo(div.querySelector('p'));
      } else if (action === 'delCol') {
        if (cols.length <= 1) return alert('A column block needs at least one column.');
        const caretCol = el.closest('.kb-cols > div, .kb-cols-3 > div, .kb-cols-4 > div');
        (caretCol && cols.includes(caretCol) ? caretCol : cols[cols.length - 1]).remove();
        const remaining = [...block.children].filter(c => c.tagName === 'DIV');
        moveEditorCaretTo(remaining[remaining.length - 1]);
      }
      applyColsWidth(block);
    }

    const BLOCK_TEMPLATES = {
      info: '<div class="kb-box kb-info"><div class="kb-box-title">ℹ️ Note</div><p>Write the note here.</p></div>',
      tip: '<div class="kb-box kb-tip"><div class="kb-box-title">✅ Exam tip</div><p>Write the tip here.</p></div>',
      warn: '<div class="kb-box kb-warn"><div class="kb-box-title">⚠️ Common mistake</div><p>Describe the trap students fall into.</p></div>',
      facts: '<div class="kb-box kb-facts"><div class="kb-box-title">📌 Key facts</div><ul><li>First fact</li><li>Second fact</li><li>Third fact</li></ul></div>',
      cols: '<div class="kb-cols">' + COLS_DELETE_BTN + '<div><h3>Left heading</h3><p>Left column text.</p></div><div><h3>Right heading</h3><p>Right column text.</p></div></div>',
      cols3: '<div class="kb-cols-3">' + COLS_DELETE_BTN + '<div><h3>Column 1</h3><p>Text.</p></div><div><h3>Column 2</h3><p>Text.</p></div><div><h3>Column 3</h3><p>Text.</p></div></div>',
      cols4: '<div class="kb-cols-4">' + COLS_DELETE_BTN + '<div><h3>1</h3><p>Text.</p></div><div><h3>2</h3><p>Text.</p></div><div><h3>3</h3><p>Text.</p></div><div><h3>4</h3><p>Text.</p></div></div>',
      grid: '<div class="kb-grid"><p>Insert Resource cards (or any content) here — this grid auto-flows into as many columns as fit.</p></div>',
      stats: '<div class="kb-stats"><div><b>64%</b><span>Services share of GSVA</span></div><div><b>31</b><span>Districts in Karnataka</span></div><div><b>1956</b><span>State reorganisation</span></div></div>',
      timeline: '<ol class="kb-timeline"><li><b>1336</b>Event or ruler</li><li><b>1565</b>Next event</li><li><b>1799</b>Next event</li></ol>',
      faq: '<details class="kb-faq" open><summary>Write the question here?</summary><p>Write the answer here.</p></details>',
      hr: '<hr class="kb-divider">'
    };

    function insertBlock(kind) {
      let html = BLOCK_TEMPLATES[kind];
      if (kind === 'table') {
        const ans = prompt('Table size as rows x columns (the first row becomes the heading):', '4x3');
        if (!ans) return;
        const m = ans.match(/(\d+)\s*[x×*,]\s*(\d+)/i);
        if (!m) return alert('Type the size like 4x3.');
        const rows = Math.min(30, Math.max(2, +m[1]));
        const cols = Math.min(8, Math.max(1, +m[2]));
        const head = Array.from({ length: cols }, (_, c) => `<th>Heading ${c + 1}</th>`).join('');
        const body = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('');
        // The delete button is its own contenteditable="false" island inside the wrapper, same
        // trick resource/page cards use -- the table itself stays normal editable content (cells
        // are typed into directly), this is the only part that isn't. Without this, the only way
        // to remove a table was the floating per-cell toolbar (table-tools), which only appears
        // once you click inside a cell and is easy to miss -- reported as tables having no way to
        // be deleted at all once inserted.
        html = `<div class="kb-table-wrap">` +
          `<button type="button" class="kb-block-delete" contenteditable="false" title="Delete this table" onclick="event.preventDefault(); event.stopPropagation(); if (confirm('Delete this table?')) this.closest('.kb-table-wrap').remove();">✕</button>` +
          `<table class="kb-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
      }
      if (!html) return;
      placeCaretInEditor();
      document.execCommand('insertHTML', false, html + '<p><br></p>');
    }

    // Keeps the table tools working after the cell holding the cursor is removed
    function moveEditorCaretTo(cell) {
      if (!cell) return;
      const r = document.createRange();
      r.selectNodeContents(cell);
      r.collapse(true);
      editorRange = r;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }

    function tableAction(action) {
      const node = editorRange && editorRange.startContainer;
      const cell = node && (node.nodeType === 1 ? node : node.parentElement).closest('td, th');
      if (!cell) return alert('Click inside a table cell first.');
      const table = cell.closest('table');
      const row = cell.parentElement;
      const colIdx = [...row.children].indexOf(cell);
      if (action === 'addRow') {
        const tr = document.createElement('tr');
        tr.innerHTML = [...row.children].map(() => '<td>&nbsp;</td>').join('');
        (row.parentElement.tagName === 'THEAD' ? table.tBodies[0] || table.createTBody() : row.parentElement)
          .insertBefore(tr, row.parentElement.tagName === 'THEAD' ? (table.tBodies[0] && table.tBodies[0].firstChild) : row.nextSibling);
      } else if (action === 'addCol') {
        [...table.rows].forEach(r => {
          const c = document.createElement(r.parentElement.tagName === 'THEAD' ? 'th' : 'td');
          c.innerHTML = r.parentElement.tagName === 'THEAD' ? 'Heading' : '&nbsp;';
          r.insertBefore(c, r.children[colIdx + 1] || null);
        });
      } else if (action === 'delRow') {
        if (row.parentElement.tagName === 'THEAD') return alert("The heading row can't be removed. Delete the table instead.");
        const next = row.nextElementSibling || row.previousElementSibling || table.rows[0];
        row.remove();
        moveEditorCaretTo(next && next.children[Math.min(colIdx, next.children.length - 1)]);
      } else if (action === 'delCol') {
        if (row.children.length <= 1) return alert('A table needs at least one column.');
        [...table.rows].forEach(r => r.children[colIdx] && r.children[colIdx].remove());
        moveEditorCaretTo(row.children[Math.max(0, colIdx - 1)]);
      } else if (action === 'delTable') {
        if (!confirm('Delete this whole table?')) return;
        (table.closest('.kb-table-wrap') || table).remove();
        document.getElementById('table-tools').classList.add('hidden');
      }
    }

    // ---- Images inside page content ----
    // Pictures are shrunk before saving because everything is stored in the browser (about 5 MB in total)
    function shrinkImageFile(file, maxW = 1000) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) return reject(new Error('Not an image'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.onload = () => {
          if (file.type === 'image/gif' || (file.type === 'image/png' && file.size < 120000)) return resolve(reader.result); // small PNGs keep transparency
          const img = new Image();
          img.onerror = () => reject(new Error('Could not read the image'));
          img.onload = () => {
            const scale = Math.min(1, maxW / img.width);
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/jpeg', 0.8));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function insertFigure(src) {
      placeCaretInEditor();
      document.execCommand('insertHTML', false,
        `<figure class="kb-figure"><img src="${escapeHtml(src)}" alt="" /><figcaption>Add a caption (or delete this line)</figcaption></figure><p><br></p>`);
    }

    async function insertImageFiles(files) {
      for (const f of files) {
        try { insertFigure(await shrinkImageFile(f)); }
        catch (err) { alert(`"${f.name}" couldn't be added: ${err.message}.`); }
      }
    }

    function handleEditorImage(input) {
      const files = [...(input.files || [])];
      input.value = '';
      insertImageFiles(files);
    }

    function insertImageFromLink() {
      const url = prompt('Paste the image web address (it must start with https://):');
      if (!url) return;
      if (!/^https?:\/\//i.test(url.trim())) return alert('The address must start with http:// or https://');
      insertFigure(url.trim());
    }

    let selectedEditorImage = null;
    function imageAction(action) {
      const img = selectedEditorImage;
      if (!img || !document.getElementById('word-editor-canvas').contains(img)) return alert('Click a picture in the editor first.');
      const fig = img.closest('figure.kb-figure');
      if (action === 'delete') {
        (fig || img).remove();
        selectedEditorImage = null;
        document.getElementById('image-tools').classList.add('hidden');
        return;
      }
      if (!fig) return;

      const SIZE_CLASSES  = ['kb-icon', 'kb-tiny', 'kb-small', 'kb-medium', 'kb-large'];
      const ALIGN_CLASSES = ['kb-left', 'kb-right', 'kb-center'];

      // Size actions: icon / tiny / small / medium / large / full (full = no size class)
      if (['icon', 'tiny', 'small', 'medium', 'large', 'full'].includes(action)) {
        SIZE_CLASSES.forEach(c => fig.classList.remove(c));
        if (action !== 'full') fig.classList.add(`kb-${action}`);
        return;
      }

      // Alignment actions
      if (action === 'alignLeft')   { ALIGN_CLASSES.forEach(c => fig.classList.remove(c)); fig.classList.add('kb-left');   return; }
      if (action === 'alignRight')  { ALIGN_CLASSES.forEach(c => fig.classList.remove(c)); fig.classList.add('kb-right');  return; }
      if (action === 'alignCenter') { ALIGN_CLASSES.forEach(c => fig.classList.remove(c)); fig.classList.add('kb-center'); return; }
    }

    // Makes the canvas behave like a word processor instead of a raw contenteditable div.
    // Chrome/Edge's default contenteditable behavior wraps every new line from the Enter key in a
    // bare, unstyled <div> (no spacing, nothing like the <p> every other block here uses) --
    // reported as the editor "creating random boxes" just from typing. defaultParagraphSeparator
    // tells the browser to use <p> for new lines instead, matching Word/Docs and every block
    // template's own markup. Set on every focus (not just once) since nothing else guarantees it
    // survives across tab-aways or the browser resetting editing-mode defaults.
    function ensureWordLikeParagraphs() {
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}
    }

    // Live word/character count shown under the canvas. Character count excludes whitespace,
    // matching how most word processors report it.
    function updateWordCount() {
      const canvas = document.getElementById('word-editor-canvas');
      const el = document.getElementById('word-char-count');
      if (!canvas || !el) return;
      const text = canvas.innerText || '';
      const words = (text.trim().match(/\S+/g) || []).length;
      const chars = text.replace(/\s/g, '').length;
      el.textContent = `${words} word${words === 1 ? '' : 's'} · ${chars} character${chars === 1 ? '' : 's'}`;
    }

    (function wireWordCount() {
      const canvas = document.getElementById('word-editor-canvas');
      if (!canvas) return;
      // A MutationObserver (rather than hooking every insertBlock/resetWordEditorToNew/
      // loadPageIntoWordEditor call individually) catches every way content can change --
      // typing, paste, programmatic block inserts, column/table edits, loading an existing page --
      // without needing to remember to call this everywhere content changes.
      let scheduled = false;
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; updateWordCount(); });
      };
      new MutationObserver(schedule).observe(canvas, { childList: true, subtree: true, characterData: true });
      canvas.addEventListener('input', schedule);
      schedule();
    })();

    (function wireEditorImages() {
      const canvas = document.getElementById('word-editor-canvas');
      if (!canvas) return;
      canvas.addEventListener('focus', ensureWordLikeParagraphs);
      canvas.addEventListener('paste', e => {
        const files = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        editorRange = null;
        const sel = window.getSelection();
        if (sel.rangeCount && canvas.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
        insertImageFiles(files);
      });
      canvas.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => i.type.startsWith('image/'))) e.preventDefault(); });
      canvas.addEventListener('drop', e => {
        const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (pos) editorRange = pos;
        insertImageFiles(files);
      });
      canvas.addEventListener('click', e => {
        canvas.querySelectorAll('img.kb-selected').forEach(i => i.classList.remove('kb-selected'));
        const img = e.target.closest('img');
        selectedEditorImage = img || null;
        if (img) img.classList.add('kb-selected');
        const tools = document.getElementById('image-tools');
        tools.classList.toggle('hidden', !img);
        tools.classList.toggle('inline-flex', !!img);
      });
    })();

    function openPageCardPicker() {
      const sel = document.getElementById('pagecard-select');
      sel.innerHTML = pageTreeList().filter(({ page }) => page.id !== editingPageId).map(({ page, depth }) =>
        `<option value="${page.id}">${'\u00a0\u00a0\u00a0'.repeat(depth)}${escapeHtml(page.icon || '📄')} ${escapeHtml(page.title)}</option>`).join('');
      if (!sel.options.length) return alert('Create another page first.');
      openModal('pagecard-modal');
    }

    function insertPageCard() {
      const id = document.getElementById('pagecard-select').value;
      const p = customPages.find(x => x.id === id);
      closeModal('pagecard-modal');
      if (!p) return;
      placeCaretInEditor();
      insertHtmlWithIntegrityCheck(
        `<div class="kb-pagelink" contenteditable="false" data-page="${p.id}">` +
          `<button type="button" class="kb-block-delete" title="Delete this page card" onclick="event.preventDefault(); event.stopPropagation(); if (confirm('Delete this page card?')) this.closest('.kb-pagelink').remove();">✕</button>` +
          `${escapeHtml(p.icon || '📄')} Page card: ${escapeHtml(p.title)}` +
        `</div><p><br></p>`,
        el => el.innerHTML.includes('Page card:'),
        'page card'
      );
    }

    // ---- Test paper card (clickable, always-live preview of an uploaded test paper) ----
    function openTestPaperCardPicker() {
      const sel = document.getElementById('testpapercard-select');
      sel.innerHTML = testsCatalog.filter(p => p.active !== false).map(p =>
        `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
      if (!sel.options.length) return alert('Upload a test paper first.');
      openModal('testpapercard-modal');
    }

    function insertTestPaperCard() {
      const id = document.getElementById('testpapercard-select').value;
      const p = testsCatalog.find(x => x.id === id);
      closeModal('testpapercard-modal');
      if (!p) return;
      placeCaretInEditor();
      insertHtmlWithIntegrityCheck(
        `<div class="kb-pagelink" contenteditable="false" data-paper="${p.id}">` +
          `<button type="button" class="kb-block-delete" title="Delete this test paper card" onclick="event.preventDefault(); event.stopPropagation(); if (confirm('Delete this test paper card?')) this.closest('.kb-pagelink').remove();">✕</button>` +
          `📝 Test paper card: ${escapeHtml(p.title)}` +
        `</div><p><br></p>`,
        el => el.innerHTML.includes('Test paper card:'),
        'test paper card'
      );
    }

    // Rich, always-current preview tile for a test paper embedded in a custom page. Rebuilt from
    // testsCatalog on every public render (hydratePageCards), so the title/price/lock-status shown
    // always match reality even if the paper's price changed after the page was saved. Clicking it
    // calls launchExamPaper() directly -- same entry point the Exam Hub uses -- which re-checks
    // access itself and routes to checkout if the viewer doesn't have it, so there's no separate
    // locked-state click handler to keep in sync here.
    function testPaperCardHtml(p) {
      const isUnlocked = isTestUnlockedForUser(p.id);
      const s = p.scheme || {};
      const priceLabel = p.price === 0 ? 'FREE' : `₹${p.price}`;
      const metaBits = [
        p.questionCount ? `${p.questionCount} Qs` : '',
        s.duration ? `${s.duration} min` : ''
      ].filter(Boolean).join(' • ');
      return `<a href="javascript:void(0)" onclick="launchExamPaper('${p.id}')" class="kb-paper-card">
        <div class="kb-paper-card-head">
          ${s.examBadge ? `<span class="kb-paper-card-badge">${escapeHtml(s.examBadge)}</span>` : '<span></span>'}
          <span class="kb-paper-card-price${p.price === 0 ? ' is-free' : ''}">${priceLabel}</span>
        </div>
        <span class="kb-paper-card-title">📝 ${escapeHtml(p.title)}</span>
        ${metaBits ? `<span class="kb-paper-card-meta">${metaBits}</span>` : ''}
        <span class="kb-paper-card-cta">${isUnlocked ? 'Start Test →' : `🔒 Unlock Paper (${priceLabel})`}</span>
      </a>`;
    }

    // ---- Resource card (image + text bundled with a PDF or page link) ----
    let resourceCardThumbDataUrl = '';
    let editingResourceCardEl = null; // the .kb-resource-card node being edited, or null when inserting a new one

    // Pass an existing .kb-resource-card element (editCardEl) to edit it in place instead of
    // inserting a new one -- called from that card's own ✎ Edit button. Until this existed, the
    // only way to change a card's title/link after creating it was delete-and-recreate.
    function openResourceCardModal(editCardEl) {
      editingResourceCardEl = editCardEl || null;

      // Reset the form
      document.getElementById('res-card-title').value = '';
      document.getElementById('res-card-desc').value = '';
      document.getElementById('res-card-thumb').value = '';
      const preview = document.getElementById('res-card-thumb-preview');
      preview.src = '';
      preview.classList.add('hidden');
      resourceCardThumbDataUrl = '';

      document.getElementById('resource-card-modal-title').innerText = editingResourceCardEl ? '📚 Edit Resource card' : '📚 Insert Resource card';
      document.getElementById('resource-card-modal-submit').innerText = editingResourceCardEl ? 'Save changes' : 'Insert card';

      if (editingResourceCardEl) {
        // Pre-fill from the existing card's own markup/data attributes.
        document.getElementById('res-card-title').value = editingResourceCardEl.querySelector('.kb-resource-title')?.innerText || '';
        document.getElementById('res-card-desc').value = editingResourceCardEl.querySelector('.kb-resource-desc')?.innerText || '';
        const existingImg = editingResourceCardEl.querySelector('.kb-resource-thumb img');
        if (existingImg) {
          resourceCardThumbDataUrl = existingImg.src;
          preview.src = resourceCardThumbDataUrl;
          preview.classList.remove('hidden');
        }
        const type = editingResourceCardEl.dataset.targetType || 'pdf';
        document.getElementById('res-card-target-type').value = type;
        refreshResourceCardTarget();
        document.getElementById('res-card-target-id').value = editingResourceCardEl.dataset.targetId || '';
      } else {
        // Remember where the cursor was so a brand-new card gets inserted back at the right spot.
        placeCaretInEditor();
        document.getElementById('res-card-target-type').value = 'pdf';
        refreshResourceCardTarget();
      }

      openModal('resource-card-modal');
    }

    function refreshResourceCardTarget() {
      const type = document.getElementById('res-card-target-type').value;
      const sel = document.getElementById('res-card-target-id');
      sel.innerHTML = '';
      sel.disabled = false;

      if (type === 'pdf') {
        if (!pdfVault.length) {
          sel.innerHTML = '<option value="">-- No PDFs uploaded yet. Upload one in the vault first. --</option>';
          sel.disabled = true;
        } else {
          pdfVault.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.innerText = `${d.title}${d.access === 'paid' ? ` [₹${d.price}]` : ' [free]'}`;
            sel.appendChild(opt);
          });
        }
      } else if (type === 'page') {
        const pages = pageTreeList().filter(({ page }) => page.id !== editingPageId);
        if (!pages.length) {
          sel.innerHTML = '<option value="">-- Create another page first --</option>';
          sel.disabled = true;
        } else {
          sel.innerHTML = pages.map(({ page, depth }) =>
            `<option value="${page.id}">${'\u00a0\u00a0\u00a0'.repeat(depth)}${escapeHtml(page.icon || '📄')} ${escapeHtml(page.title)}</option>`
          ).join('');
        }
      } else {
        sel.innerHTML = '<option value="">(No target — display only)</option>';
        sel.disabled = true;
      }
    }

    // Preview + shrink the thumbnail as it's selected
    (function wireResourceCardThumb() {
      // Run after DOM is ready — the modal is in the initial HTML.
      const setup = () => {
        const input = document.getElementById('res-card-thumb');
        if (!input) return;
        input.addEventListener('change', async () => {
          const f = input.files && input.files[0];
          if (!f) { resourceCardThumbDataUrl = ''; return; }
          try {
            resourceCardThumbDataUrl = await shrinkImageFile(f, 600);
            const preview = document.getElementById('res-card-thumb-preview');
            preview.src = resourceCardThumbDataUrl;
            preview.classList.remove('hidden');
          } catch (err) {
            alert("Couldn't read that image: " + err.message);
            input.value = '';
          }
        });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
      else setup();
    })();

    // Builds the markup for one Resource Card. Shared by every place that can create one --
    // this modal (insertResourceCard, below) AND the PDF Publishing Wizard's "Add to page"
    // step (wizPublish, in 07a_pdf_publishing_wizard.js) -- so a fix or design change (like
    // the delete button, or the button's label) only has to happen in one place. Before this
    // was pulled out, the wizard had its own second copy of this markup that silently drifted
    // out of sync with this one: it kept the old "Open PDF →" pill label and never got a
    // delete button when this card type was redesigned.
    function buildResourceCardHtml({ type, targetId, title, desc, thumbHtml }) {
      const ctaLabel = type === 'pdf' ? 'Download' : (type === 'page' ? 'Open page' : '');
      const ctaClass = type === 'pdf' ? 'pdf' : (type === 'page' ? 'page' : '');
      const ctaHtml = (type === 'none' || !ctaLabel) ? '' : `<span class="kb-resource-cta ${ctaClass}">${ctaLabel}</span>`;
      const editorLabel = type === 'pdf'
        ? 'Resource → PDF'
        : (type === 'page' ? 'Resource → Page' : 'Resource card');
      return (
        `<div class="kb-resource-card" contenteditable="false" data-target-type="${type}" data-target-id="${escapeHtml(targetId || '')}" data-editor-label="${editorLabel}">` +
          `<button type="button" class="kb-block-delete kb-block-delete-edit" title="Edit this resource card" onclick="event.preventDefault(); event.stopPropagation(); openResourceCardModal(this.closest('.kb-resource-card'));">✎</button>` +
          `<button type="button" class="kb-block-delete" title="Delete this resource card" onclick="event.preventDefault(); event.stopPropagation(); if (confirm('Delete this resource card?')) this.closest('.kb-resource-card').remove();">✕</button>` +
          thumbHtml +
          `<div class="kb-resource-body">` +
            `<h4 class="kb-resource-title">${escapeHtml(title)}</h4>` +
            (desc ? `<p class="kb-resource-desc">${escapeHtml(desc)}</p>` : '') +
            ctaHtml +
          `</div>` +
        `</div><p><br></p>`
      );
    }

    function insertResourceCard() {
      const title = document.getElementById('res-card-title').value.trim();
      const desc  = document.getElementById('res-card-desc').value.trim();
      const type  = document.getElementById('res-card-target-type').value;
      const targetId = document.getElementById('res-card-target-id').value;

      if (!title) return alert('Give the card a title.');
      if (type !== 'none' && !targetId) return alert('Pick something to link to, or switch "Links to" to "Nothing".');

      const thumbHtml = resourceCardThumbDataUrl
        ? `<div class="kb-resource-thumb"><img src="${escapeHtml(resourceCardThumbDataUrl)}" alt="" /></div>`
        : `<div class="kb-resource-thumb" aria-hidden="true">${type === 'pdf' ? '📕' : (type === 'page' ? '📄' : '📚')}</div>`;

      const card = buildResourceCardHtml({ type, targetId, title, desc, thumbHtml });

      closeModal('resource-card-modal');

      if (editingResourceCardEl) {
        // Replace the existing card in place with a freshly-built one from the edited fields,
        // instead of inserting a new card -- only swap the card div itself, not the trailing
        // <p><br></p> that buildResourceCardHtml also returns, since the original already has
        // its own trailing paragraph and re-adding one on every edit would pile up blank lines.
        const wrap = document.createElement('div');
        wrap.innerHTML = card;
        editingResourceCardEl.replaceWith(wrap.querySelector('.kb-resource-card'));
        editingResourceCardEl = null;
        return;
      }

      placeCaretInEditor();
      insertHtmlWithIntegrityCheck(card, el => !!el.querySelector('.kb-resource-title'), 'resource card');
    }

    function formatWordText(command, value = null) {
      document.execCommand(command, false, value);
      document.getElementById('word-editor-canvas').focus();
    }

    // Apply a font family to the current selection. Uses styleWithCSS so we get inline CSS
    // (e.g. <span style="font-family: Georgia">) instead of deprecated <font face="…"> tags —
    // cleaner markup and safer to persist to the database.
    function setEditorFont(fontStack) {
      if (!fontStack) return;
      const canvas = document.getElementById('word-editor-canvas');
      canvas.focus();
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) {
        return alert('Select some text first, then pick a font.');
      }
      try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
      document.execCommand('fontName', false, fontStack);
    }

    // Font color on the current selection. Same styleWithCSS approach as setEditorFont, so this
    // also persists as inline CSS rather than deprecated <font color> tags.
    function setEditorTextColor(color) {
      if (!color) return;
      const canvas = document.getElementById('word-editor-canvas');
      canvas.focus();
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return alert('Select some text first, then pick a color.');
      try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
      document.execCommand('foreColor', false, color);
    }

    // Highlight (background color) on the current selection. hiliteColor is the cross-browser
    // command once styleWithCSS is on; backColor is the Chrome-only fallback some older engines
    // need instead.
    function setEditorHighlight(color) {
      if (!color) return;
      const canvas = document.getElementById('word-editor-canvas');
      canvas.focus();
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return alert('Select some text first, then pick a highlight.');
      try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
      const value = color === 'none' ? 'transparent' : color;
      try { document.execCommand('hiliteColor', false, value); }
      catch (_) { document.execCommand('backColor', false, value); }
    }

    // Load any existing page (e.g. Current Affairs) into the Word editor, by page ID
    function loadPageIntoWordEditor(id) {
      if (!id) return resetWordEditorToNew();
      const page = findPage(id);
      if (!page) return;

      editingPageId = page.id;
      slugManuallyEdited = true; // existing pages keep their link when the title changes
      document.getElementById('load-existing-page-picker').value = page.id;
      document.getElementById('page-title-input').value = page.title;
      document.getElementById('page-slug-input').value = page.slug;
      document.getElementById('page-gated-check').checked = page.isGated;
      document.getElementById('page-price-input').value = page.price || 0;
      // A seeded empty paragraph, not '', even for a page with genuinely no content yet -- so the
      // very first character typed lands inside a real <p> (with normal spacing) instead of as a
      // bare text node sitting directly in the canvas, which is what an empty contenteditable div
      // does by default. See ensureWordLikeParagraphs() for the same fix applied to every line
      // after the first (via Enter).
      document.getElementById('word-editor-canvas').innerHTML = page.content || '<p><br></p>';
      fillPageMetaFields(page);
      setSlugFieldEditable(false);
      updateSlugHint();
    }

    const PAGE_ICON_PICKS = ['📘', '📜', '🏛️', '🗺️', '⚖️', '💹', '🌿', '🔬', '📰', '📝', '🎯', '🧭', '🌾', '🛡️'];
    let pendingPageImage = '';

    function fillParentPicker(selfId, selected) {
      const blocked = selfId ? new Set([selfId, ...descendantIds(selfId)]) : new Set();
      document.getElementById('page-parent-input').innerHTML = '<option value="">— Top level —</option>' +
        pageTreeList().filter(({ page }) => !blocked.has(page.id)).map(({ page, depth }) =>
          `<option value="${page.id}" ${page.id === selected ? 'selected' : ''}>${'\u00a0\u00a0\u00a0'.repeat(depth)}${depth ? '↳ ' : ''}${escapeHtml(page.title)}</option>`).join('');
    }

    function fillPageMetaFields(page) {
      fillParentPicker(page ? page.id : null, page ? page.parentId : null);
      document.getElementById('page-icon-input').value = page ? (page.icon || '📄') : '📄';
      document.getElementById('page-summary-input').value = page ? (page.summary || '') : '';
      document.getElementById('page-childstyle-input').value = page ? (page.childStyle || 'tiles') : 'tiles';
      document.getElementById('page-order-input').value = page ? (page.order ?? 0) : childPagesOf(null).length;
      document.getElementById('page-home-check').checked = !!(page && page.showOnHome);
      document.getElementById('page-bundleonly-check').checked = !!(page && page.bundleOnly);
      setPageImage(page ? (page.image || '') : '');
      document.getElementById('page-icon-picks').innerHTML = PAGE_ICON_PICKS.map(ic =>
        `<button type="button" onclick="document.getElementById('page-icon-input').value='${ic}'" class="hover:scale-125 transition" aria-label="Use ${ic}">${ic}</button>`).join('');
    }

    function setPageImage(dataUrl) {
      pendingPageImage = dataUrl || '';
      const img = document.getElementById('page-image-preview');
      img.src = pendingPageImage;
      img.classList.toggle('hidden', !pendingPageImage);
      document.getElementById('page-image-remove').classList.toggle('hidden', !pendingPageImage);
    }

    // Shrinks the picture to 640px wide so pages stay small enough to save in the browser
    function handlePageImage(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 640 / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          setPageImage(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => alert("That file couldn't be read as an image.");
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    function newSubPage(parentId) {
      resetWordEditorToNew();
      fillParentPicker(null, parentId);
      document.getElementById('page-order-input').value = childPagesOf(parentId).length;
      document.getElementById('page-title-input').focus();
      document.getElementById('page-title-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function movePage(pageId, dir) {
      const page = customPages.find(p => p.id === pageId);
      if (!page) return;
      const sibs = childPagesOf(page.parentId);
      sibs.forEach((p, i) => { p.order = i; });
      const i = sibs.indexOf(page);
      const j = i + dir;
      if (j < 0 || j >= sibs.length) return;
      [sibs[i].order, sibs[j].order] = [sibs[j].order, sibs[i].order];
      localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));

      // --- SYNC TO SUPABASE CLOUD ---
      // Only the two swapped pages changed order, so upsert just those.
      const rowsToUpdate = [sibs[i], sibs[j]].map(p => ({
        id: p.id, slug: p.slug, title: p.title, is_gated: p.isGated, price: p.price,
        content: p.content, parent_id: p.parentId, icon: p.icon, image: p.image,
        summary: p.summary, child_style: p.childStyle, order_num: p.order,
        show_on_home: p.showOnHome, bundle_only: p.bundleOnly, old_slugs: p.oldSlugs || []
      }));
      const { error } = await supabaseClient.from('custom_pages').upsert(rowsToUpdate);
      if (error) console.error("Failed to sync page order to cloud:", fmtErr(error));

      renderPagesList();
      renderHomeSections();
    }

    function resetWordEditorToNew() {
      editingPageId = null;
      slugManuallyEdited = false;
      document.getElementById('load-existing-page-picker').value = '';
      document.getElementById('page-title-input').value = '';
      document.getElementById('page-slug-input').value = '';
      document.getElementById('page-gated-check').checked = false;
      document.getElementById('page-price-input').value = '0';
      // Seeded with an empty paragraph rather than '' -- see the matching comment in
      // loadPageIntoWordEditor() for why a truly empty canvas breaks the first line typed.
      document.getElementById('word-editor-canvas').innerHTML = '<p><br></p>';
      fillPageMetaFields(null);
      setSlugFieldEditable(false);
      updateSlugHint();
    }

    function syncSlugFromTitle() {
      if (slugManuallyEdited) return;
      document.getElementById('page-slug-input').value = slugify(document.getElementById('page-title-input').value);
      updateSlugHint();
    }

    function setSlugFieldEditable(editable) {
      const input = document.getElementById('page-slug-input');
      input.readOnly = !editable;
      input.classList.toggle('bg-slate-50', !editable);
      input.classList.toggle('text-slate-500', !editable);
      input.classList.toggle('bg-white', editable);
      input.classList.toggle('text-slate-900', editable);
      document.getElementById('page-slug-edit-btn').innerText = editable ? 'Done' : 'Edit';
    }

    function toggleSlugEditing() {
      const input = document.getElementById('page-slug-input');
      if (input.readOnly) {
        slugManuallyEdited = true;
        setSlugFieldEditable(true);
        input.focus();
        input.select();
      } else {
        input.value = slugify(input.value);
        if (!input.value && !editingPageId) {
          slugManuallyEdited = false; // cleared on a new page: go back to following the title
          syncSlugFromTitle();
        }
        setSlugFieldEditable(false);
      }
      updateSlugHint();
    }

    function updateSlugHint() {
      const hint = document.getElementById('page-slug-hint');
      const slugVal = document.getElementById('page-slug-input').value.trim();
      const titleVal = document.getElementById('page-title-input').value.trim();
      if (editingPageId) {
        const page = findPage(editingPageId);
        hint.innerText = (page && slugify(slugVal) !== page.slug)
          ? `The old link (#/page/${page.slug}) will keep working and open this page.`
          : 'Changing the title keeps this link, so shared links and menus stay valid.';
      } else if (titleVal && !slugVal) {
        hint.innerText = 'This title has no English letters, so the link will use the page ID. Click Edit to set a readable one.';
      } else if (slugManuallyEdited) {
        hint.innerText = 'Custom link. Lowercase letters, numbers and dashes only.';
      } else {
        hint.innerText = 'Filled in from the title. Click Edit to change it.';
      }
    }

    function openLinkPdfModal() {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed || !sel.toString().trim()) {
        alert("Please highlight/select the specific words in the Word editor that you want to hyperlink to a PDF first.");
        return;
      }

      savedEditorRange = sel.getRangeAt(0).cloneRange();
      document.getElementById('selected-text-preview').innerText = `"${sel.toString().trim()}"`;

      const picker = document.getElementById('modal-pdf-picker');
      picker.innerHTML = '';
      if (pdfVault.length === 0) {
        picker.innerHTML = '<option value="">-- No PDFs uploaded yet. Upload in Vault first. --</option>';
      } else {
        pdfVault.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.innerText = `${d.title} [₹${d.price}]`;
          picker.appendChild(opt);
        });
      }

      openModal('link-pdf-modal');
    }

    function applyPdfLinkToSelection() {
      const docId = document.getElementById('modal-pdf-picker').value;
      if (!docId) return alert('Select a PDF document.');

      const doc = pdfVault.find(d => d.id === docId);
      if (!doc || !savedEditorRange) return;

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedEditorRange);

      const highlightedText = savedEditorRange.toString();

      const link = document.createElement('a');
      link.href = "javascript:void(0)";
      link.setAttribute('onclick', `downloadOrOpenPdf('${doc.id}')`);
      link.className = "text-amber-600 font-bold underline cursor-pointer hover:text-amber-800 inline-flex items-center gap-0.5";
      link.title = `Attached PDF: ${doc.title} (₹${doc.price})`;
      link.textContent = highlightedText;

      const badge = document.createElement('span');
      badge.className = "text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded ml-1 font-sans font-normal";
      badge.textContent = "PDF";
      link.appendChild(badge);

      savedEditorRange.deleteContents();
      savedEditorRange.insertNode(link);

      closeModal('link-pdf-modal');
      alert(`Hyperlinked "${highlightedText}" to "${doc.title}"!`);
    }

  async function handleSaveCustomPage(e) {
  e.preventDefault();
  const title = document.getElementById('page-title-input').value.trim();
  const slugInput = document.getElementById('page-slug-input');
  const isGated = document.getElementById('page-gated-check').checked;
  const bundleOnly = isGated && document.getElementById('page-bundleonly-check').checked;
  const price = isGated && !bundleOnly ? (parseInt(document.getElementById('page-price-input').value) || 49) : 0;
  document.querySelectorAll('#word-editor-canvas img.kb-selected').forEach(i => i.classList.remove('kb-selected'));
  const htmlContent = document.getElementById('word-editor-canvas').innerHTML;
  const meta = {
    parentId: document.getElementById('page-parent-input').value || null,
    icon: document.getElementById('page-icon-input').value.trim() || '📄',
    image: pendingPageImage,
    summary: document.getElementById('page-summary-input').value.trim(),
    childStyle: document.getElementById('page-childstyle-input').value,
    order: parseInt(document.getElementById('page-order-input').value, 10) || 0,
    showOnHome: document.getElementById('page-home-check').checked,
    bundleOnly
  };

  const id = editingPageId || ('p_' + Date.now());
  let slug = slugify(slugInput.value) || slugify(title) || id;

  const taken = s => customPages.some(p => p.id !== id && (p.slug === s || p.id === s || (p.oldSlugs || []).includes(s)));
  if (taken(slug)) {
    let n = 2;
    while (taken(`${slug}-${n}`)) n++;
    const suggestion = `${slug}-${n}`;
    if (slugManuallyEdited && !confirm(`The link "${slug}" is already used by another page.\n\nUse "${suggestion}" instead?`)) return;
    slug = suggestion;
  }

  const existing = customPages.find(p => p.id === id);
  let oldSlugs = existing ? (existing.oldSlugs || []) : [];
  if (existing && existing.slug && existing.slug !== slug && !oldSlugs.includes(existing.slug)) {
    oldSlugs.push(existing.slug);
  }

  const pageData = {
    id,
    slug,
    title,
    is_gated: isGated,
    price,
    content: htmlContent,
    parent_id: meta.parentId,
    icon: meta.icon,
    image: meta.image,
    summary: meta.summary,
    child_style: meta.childStyle,
    order_num: meta.order,
    show_on_home: meta.showOnHome,
    bundle_only: bundleOnly,
    old_slugs: oldSlugs
  };

  // --- SYNC TO SUPABASE CLOUD ---
  const { error } = await supabaseClient.from('custom_pages').upsert(pageData);
  if (error) {
    return alert("Failed to save page to cloud: " + error.message);
  }

  if (existing) {
    Object.assign(existing, { title, slug, isGated, price, content: htmlContent, oldSlugs, ...meta });
  } else {
    customPages.push({ id, title, slug, isGated, price, content: htmlContent, oldSlugs, ...meta });
  }

  editingPageId = id;
  slugManuallyEdited = true;
  slugInput.value = slug;
  setSlugFieldEditable(false);

  renderPagesList();
  renderNavigation();
  renderGranularNavTree();
  renderStudentEntitlementsDesk();
  renderHomeSections();
  fillParentPicker(id, meta.parentId);
  updateSlugHint();
  alert(`Page "${title}" saved and published live to the cloud!\n\nLink: #/page/${slug}`);
}

    function renderPagesList() {
      const container = document.getElementById('pages-list-display');
      const picker = document.getElementById('load-existing-page-picker');

      container.innerHTML = '';
      picker.innerHTML = '<option value="">-- Choose Existing Page to Edit --</option>';

      pageTreeList().forEach(({ page: p, depth }) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.innerText = `${'\u00a0\u00a0\u00a0'.repeat(depth)}${depth ? '↳ ' : ''}${p.title}`;
        picker.appendChild(opt);

        const gatedHere = isGatedPage(p);
        const inheritsLock = !gatedHere && pageAncestry(p).slice(0, -1).some(isGatedPage);
        const div = document.createElement('div');
        div.className = "p-2 bg-slate-50 border rounded flex flex-wrap justify-between items-center gap-2";
        div.style.marginLeft = `${depth * 22}px`;
        div.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            ${p.image ? `<img src="${p.image}" alt="" class="w-8 h-5 object-cover rounded" />` : `<span class="text-base" aria-hidden="true">${escapeHtml(p.icon || '📄')}</span>`}
            <b class="truncate">${escapeHtml(p.title)}</b>
            <span class="text-slate-400 font-mono hidden md:inline">#/page/${escapeHtml(p.slug)}</span>
            <span class="px-1.5 rounded text-[10px] ${gatedHere ? 'bg-amber-100 text-amber-800 font-bold' : inheritsLock ? 'bg-amber-50 text-amber-700' : 'bg-slate-200'}">
              ${gatedHere ? (p.bundleOnly ? 'PAID · BUNDLES ONLY' : `PAID ₹${p.price}`) : inheritsLock ? 'LOCKED WITH PARENT' : 'FREE'}
            </span>
            ${p.showOnHome ? '<span class="px-1.5 rounded text-[10px] bg-blue-50 text-blue-700">HOME</span>' : ''}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="movePage('${p.id}', -1)" class="text-slate-500 hover:text-slate-900" aria-label="Move up">▲</button>
            <button onclick="movePage('${p.id}', 1)" class="text-slate-500 hover:text-slate-900" aria-label="Move down">▼</button>
            <button onclick="newSubPage('${p.id}')" class="text-emerald-700 font-bold hover:underline">+ Sub-page</button>
            <button onclick="renderDynamicCustomPage('${p.id}')" class="text-blue-600 font-bold hover:underline">View</button>
            <button onclick="copyPageLink('${p.id}')" class="text-slate-600 font-bold hover:underline">Link</button>
            <button onclick="loadPageIntoWordEditor('${p.id}')" class="text-amber-600 font-bold hover:underline">Edit</button>
            <button onclick="deleteCustomPage('${p.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
          </div>
        `;
        container.appendChild(div);
      });
      picker.value = editingPageId || '';
    }

    function copyPageLink(id) {
      const page = findPage(id);
      if (!page) return;
      const url = location.href.split('#')[0] + pageLinkHash(page);
      const fallback = () => prompt('Copy this page link:', url);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => alert(`Link copied:\n${url}`)).catch(fallback);
      } else {
        fallback();
      }
    }

    // Deleting a page also removes menu links to it and student access to it.
    async function deleteCustomPage(pageId) {
      const page = customPages.find(p => p.id === pageId);
      if (!page) return;
      const isRef = action => action === `page:${page.id}`;

      let menuCount = 0;
      navStructure.forEach(m => {
        if (isRef(m.action)) menuCount++;
        (m.submenus || []).forEach(sub => { if (isRef(sub.action)) menuCount++; });
      });
      const studentCount = studentDirectory.filter(st => (st.allowedPages || []).includes(page.id)).length;

      const kids = childPagesOf(page.id);
      let msg = `Delete "${page.title}"?`;
      if (kids.length) msg += `\n\nIts ${kids.length} sub-page(s) will move up one level, so nothing inside is lost.`;
      if (menuCount || studentCount) {
        msg += '\n\nThis will also remove:';
        if (menuCount) msg += `\n• ${menuCount} menu link(s) to this page`;
        if (studentCount) msg += `\n• access to this page for ${studentCount} student(s)`;
      }
      if (!confirm(msg)) return;

      // --- DELETE FROM SUPABASE CLOUD (page itself) ---
      const { error: delErr } = await supabaseClient.from('custom_pages').delete().eq('id', pageId);
      if (delErr) {
        alert("Failed to delete page from cloud: " + delErr.message);
        return;
      }

      kids.forEach(k => { k.parentId = page.parentId || null; });
      const affectedBundles = bundles.filter(b => (b.pages || []).includes(pageId));
      bundles.forEach(b => { b.pages = b.pages.filter(x => x !== pageId); });
      saveBundles();
      customPages = customPages.filter(p => p.id !== pageId);
      // Top menus that only pointed here are removed; ones with submenus become plain dropdowns.
      navStructure = navStructure.filter(m => !(isRef(m.action) && !(m.submenus || []).length));
      navStructure.forEach(m => {
        if (isRef(m.action)) m.action = '#';
        if (m.submenus) m.submenus = m.submenus.filter(sub => !isRef(sub.action));
      });
      studentDirectory.forEach(st => {
        st.allowedPages = (st.allowedPages || []).filter(x => x !== page.id);
      });

      localStorage.setItem('kas_custom_pages', JSON.stringify(customPages));
      localStorage.setItem('kas_nav_menu', JSON.stringify(navStructure));
      localStorage.setItem('kas_student_directory', JSON.stringify(studentDirectory));

      // --- SYNC CASCADES TO SUPABASE CLOUD ---
      // 1. Reparented children need their parent_id updated in cloud.
      if (kids.length) {
        const kidRows = kids.map(k => ({
          id: k.id, slug: k.slug, title: k.title, is_gated: k.isGated, price: k.price,
          content: k.content, parent_id: k.parentId, icon: k.icon, image: k.image,
          summary: k.summary, child_style: k.childStyle, order_num: k.order,
          show_on_home: k.showOnHome, bundle_only: k.bundleOnly, old_slugs: k.oldSlugs || []
        }));
        const { error: kidErr } = await supabaseClient.from('custom_pages').upsert(kidRows);
        if (kidErr) console.error("Failed to re-sync child pages after delete:", kidErr);
      }

      // 2. Bundles that referenced this page need re-syncing.
      for (const b of affectedBundles) {
        const { error: bErr } = await supabaseClient.from('bundles').upsert({
          id: b.id, name: b.name, tagline: b.tagline || '', price: b.price,
          validity_days: b.validityDays, highlights: b.highlights || [], active: b.active,
          show_on_home: b.showOnHome, featured: b.featured, style: b.style || 'light',
          order_num: b.order || 0, all_access: b.allAccess, categories: b.categories || [],
          papers: b.papers || [], pages: b.pages || [], pdfs: b.pdfs || [],
          planners: b.planners || [], features: b.features || []
        });
        if (bErr) console.error("Failed to re-sync bundle after page delete:", bErr);
      }

      // 3. Nav menu changes (removed rows + updated JSONB submenus) — saveNav handles both.
      await saveNav();

      if (editingPageId === pageId) resetWordEditorToNew();
      if (currentPageId === pageId) navigate('home');
      renderHomeSections();
      renderPagesList();
      renderNavigation();
      renderGranularNavTree();
      renderStudentEntitlementsDesk();
    }

    function setPageHash(hash, replace) {
      try {
        history[replace ? 'replaceState' : 'pushState'](null, '', hash);
      } catch (err) {
        // Some browsers block history changes on file:// pages
        if (replace) location.replace(hash); else location.hash = hash;
      }
    }

    function clearPageHash() {
      try {
        history.pushState(null, '', location.pathname + location.search);
      } catch (err) {
        location.hash = '';
      }
    }

    function routeFromHash() {
      // A shared PDF deep link (from the Publishing Wizard's "Shareable link"): open the file
      // through the normal, paywall-gated path, then drop the hash so a refresh doesn't re-fire it.
      const pdfMatch = location.hash.match(/^#\/pdf\/([^?#]+)/);
      if (pdfMatch) {
        const docId = decodeURIComponent(pdfMatch[1]);
        history.replaceState(null, '', location.pathname + location.search);
        downloadOrOpenPdf(docId);
        return;
      }
      const match = location.hash.match(/^#\/page\/([^?#]+)/);
      const pageViewOpen = !document.getElementById('view-custom-page').classList.contains('hidden');
      if (match) {
        const ref = decodeURIComponent(match[1]);
        const page = findPage(ref);
        if (page && page.id === currentPageId && pageViewOpen) return; // already showing it
        renderDynamicCustomPage(ref, { fromRoute: true });
      } else if (pageViewOpen) {
        navigate('home');
      }
    }

    // ref can be a page ID, its link, or an old link.
    async function renderDynamicCustomPage(ref, opts = {}) {
      const page = findPage(ref);
      if (!page) {
        alert('This page no longer exists. It may have been deleted.');
        return navigate('home');
      }
      // Same exam-in-progress guard as navigate() — this function hides view-engine itself just
      // below and is reached independently of navigate() (routeFromHash calls it directly for a
      // #/page/ hash, e.g. from the Back button), so it needs its own copy of the check.
      if (!(await guardLeavingExam())) return;

      currentPageId = page.id;
      const hash = pageLinkHash(page);
      if (location.hash !== hash) {
        // Opened from an old link: quietly switch to the current one without adding history.
        setPageHash(hash, !!opts.fromRoute);
      }

      ['home', 'tests', 'dashboard', 'admin', 'engine'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
      });
      document.getElementById('view-custom-page').classList.remove('hidden');

      document.getElementById('page-render-title').innerText = `${page.icon && page.icon !== '📄' ? page.icon + ' ' : ''}${page.title}`;

      // Breadcrumbs: Home › Section › Chapter › this page
      const chain = pageAncestry(page);
      document.getElementById('page-breadcrumbs').innerHTML =
        `<a href="javascript:void(0)" onclick="navigate('home')" class="hover:text-slate-800 hover:underline">Home</a>` +
        chain.map((p, i) => ` <span class="text-slate-300" aria-hidden="true">›</span> ` + (i === chain.length - 1
          ? `<span class="text-slate-800 font-bold" aria-current="page">${escapeHtml(p.title)}</span>`
          : `<a href="javascript:void(0)" onclick="renderDynamicCustomPage('${p.id}')" class="hover:text-slate-800 hover:underline">${escapeHtml(p.title)}</a>`)).join('');

      const lockedBanner = document.getElementById('page-locked-banner');
      const contentBox = document.getElementById('page-render-content');
      const lockNode = lockingPageFor(page);
      const inherited = lockNode && lockNode.id !== page.id;
      document.getElementById('page-render-badge').innerText = lockNode
        ? (inherited ? `Part of "${lockNode.title}"` : 'Paid study material')
        : (chain.some(isGatedPage) ? 'Unlocked for you' : 'Free resource');

      if (lockNode) {
        lockedBanner.classList.remove('hidden');
        const subCount = descendantIds(lockNode.id).length;
        document.getElementById('page-locked-desc').innerText = inherited
          ? `This page is inside "${lockNode.title}", which is paid material. Unlocking it opens this page and everything else in that section.`
          : `This is paid study material${subCount ? `, with ${subCount} page${subCount > 1 ? 's' : ''} inside` : ''}. Choose how you'd like to unlock it.`;
        const options = [];
        if (!lockNode.bundleOnly && lockNode.price > 0) {
          options.push(`<button onclick="openCheckout('page', '${lockNode.id}', ${JSON.stringify(lockNode.title).replace(/"/g, '&quot;')}, ${lockNode.price})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow">Unlock ${inherited || subCount ? 'this section' : 'this page'} (₹${lockNode.price})</button>`);
        }
        bundlesForSale(b => bundleCoversPage(b, lockNode)).slice(0, 3).forEach(b => {
          options.push(`<button onclick="openBundleCheckout('${b.id}')" class="px-4 py-2 ${b.allAccess ? 'bg-slate-900 hover:bg-slate-800' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'} ${b.allAccess ? 'text-white' : ''} font-bold text-xs rounded-lg shadow">Get ${escapeHtml(b.name)} (₹${b.price})</button>`);
        });
        document.getElementById('page-unlock-options').innerHTML = options.join('') || '<span class="text-xs text-amber-800">Contact the academy to get access.</span>';
        contentBox.innerHTML = page.summary ? `<p class="text-slate-500">${escapeHtml(page.summary)}</p>` : '<p class="text-slate-400 italic">Unlock to read this page.</p>';
      } else {
        lockedBanner.classList.add('hidden');
        contentBox.innerHTML = page.content;
        // The editor overlays small ✎/✕ controls directly onto non-editable blocks (resource
        // cards, page cards, tables) so an admin can edit/delete them in place -- see the CSS
        // comment near #word-editor-canvas .kb-block-delete. That CSS only STYLES them inside the
        // editor; it never removes the <button> elements themselves, so without this they still
        // render here too (unstyled, but present and clickable) -- reported as "there's an X even
        // on the front end". Stripped unconditionally, for every page, regardless of how the
        // content was produced (hand-typed, pasted, or published via the PDF wizard).
        contentBox.querySelectorAll('.kb-block-delete').forEach(btn => btn.remove());
        hydratePageCards(contentBox);
      }

      renderChildPages(page);
      window.scrollTo(0, 0);
    }

    // ---- Tiles for pages (sub-pages, home "Study Rooms", page cards inside content) ----
    function pageTileHtml(p, variant = 'tile') {
      const locked = !isPageUnlockedForUser(p);
      const kids = childPagesOf(p.id).length;
      const meta = `${kids ? `${kids} page${kids > 1 ? 's' : ''} inside` : ''}${locked ? `${kids ? ' · ' : ''}🔒 Paid` : ''}`;
      if (variant === 'list') {
        return `<a href="javascript:void(0)" onclick="renderDynamicCustomPage('${p.id}')" class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 transition">
          <span class="text-xl w-8 text-center shrink-0" aria-hidden="true">${escapeHtml(p.icon || '📄')}</span>
          <span class="flex-1 min-w-0"><span class="block font-bold text-slate-900 truncate">${escapeHtml(p.title)}</span>${p.summary ? `<span class="block text-xs text-slate-500 truncate">${escapeHtml(p.summary)}</span>` : ''}</span>
          ${meta ? `<span class="text-[11px] text-slate-400 shrink-0">${meta}</span>` : ''}
          <span class="text-slate-300" aria-hidden="true">›</span>
        </a>`;
      }
      return `<a href="javascript:void(0)" onclick="renderDynamicCustomPage('${p.id}')" class="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-amber-500 hover:shadow-md transition">
        ${p.image
          ? `<img src="${p.image}" alt="" class="page-tile-img" />`
          : `<div class="h-24 flex items-center justify-center bg-amber-50 text-4xl" aria-hidden="true">${escapeHtml(p.icon || '📄')}</div>`}
        <div class="p-4 flex-1 flex flex-col">
          <span class="font-bold text-slate-900 group-hover:text-amber-700">${escapeHtml(p.title)}</span>
          ${p.summary ? `<span class="text-xs text-slate-500 mt-1 flex-1">${escapeHtml(p.summary)}</span>` : '<span class="flex-1"></span>'}
          ${meta ? `<span class="text-[11px] text-slate-400 mt-2">${meta}</span>` : ''}
        </div>
      </a>`;
    }

    function renderChildPages(page) {
      const box = document.getElementById('page-children');
      const kids = childPagesOf(page.id);
      if (!kids.length || page.childStyle === 'none') { box.classList.add('hidden'); return; }
      box.classList.remove('hidden');
      const grid = document.getElementById('page-children-grid');
      if (page.childStyle === 'list') {
        grid.className = 'space-y-2';
        grid.innerHTML = kids.map(k => pageTileHtml(k, 'list')).join('');
      } else {
        grid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4';
        grid.innerHTML = kids.map(k => pageTileHtml(k)).join('');
      }
    }

    // Page cards placed inside content are stored as placeholders and filled with live details here
    function hydratePageCards(root) {
      root.querySelectorAll('.kb-pagelink[data-page]').forEach(el => {
        const p = customPages.find(x => x.id === el.dataset.page);
        if (!p) { el.remove(); return; }
        const wrap = document.createElement('div');
        wrap.className = 'my-3 max-w-xl not-prose';
        wrap.innerHTML = pageTileHtml(p, 'list');
        el.replaceWith(wrap);
      });

      // Test paper cards: same placeholder-swap pattern as page cards, above. An inactive paper
      // is hidden for everyone (matching the Exam Hub's own catalog filter, which does the same),
      // since an admin reviewing/re-enabling it belongs in the Studio, not a half-broken public card.
      root.querySelectorAll('.kb-pagelink[data-paper]').forEach(el => {
        const p = testsCatalog.find(x => x.id === el.dataset.paper);
        if (!p || p.active === false) { el.remove(); return; }
        const wrap = document.createElement('div');
        wrap.className = 'my-3 max-w-xl not-prose';
        wrap.innerHTML = testPaperCardHtml(p);
        el.replaceWith(wrap);
      });

      // Resource cards: make the whole card a clickable link if it targets a PDF or page.
      root.querySelectorAll('.kb-resource-card[data-target-type]').forEach(card => {
        const type = card.dataset.targetType;
        const id   = card.dataset.targetId;
        if (!type || type === 'none' || !id) return;

        if (type === 'pdf') {
          // Skip if the PDF was deleted from the vault
          if (!pdfVault.find(d => d.id === id)) return;
          card.style.cursor = 'pointer';
          card.setAttribute('role', 'link');
          card.setAttribute('tabindex', '0');
          const open = () => downloadOrOpenPdf(id);
          card.addEventListener('click', open);
          card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        } else if (type === 'page') {
          if (!customPages.find(p => p.id === id)) return;
          card.style.cursor = 'pointer';
          card.setAttribute('role', 'link');
          card.setAttribute('tabindex', '0');
          const open = () => renderDynamicCustomPage(id);
          card.addEventListener('click', open);
          card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        }
      });
    }

    function renderHomeSections() {
      const sec = document.getElementById('home-sections');
      if (!sec) return;
      const list = customPages.filter(p => p.showOnHome).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      sec.classList.toggle('hidden', !list.length);
      document.getElementById('home-sections-grid').innerHTML = list.map(p => pageTileHtml(p)).join('');
    }

    function showBlobInWindow(win, blob, filename) {
      const blobUrl = URL.createObjectURL(blob);
      if (win && !win.closed) {
        win.location.href = blobUrl;
      } else {
        // pop-up blocked: save the file instead
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    }

    // Stamps a small footer onto every page of a PDF using pdf-lib, loaded via CDN in <head>.
    // Only usable on PDFs we actually host (uploaded to Supabase Storage, IndexedDB, or a data: URL) —
    // external links (Google Drive, other sites) can't be modified since we don't own that file, so
    // those are left completely untouched and just open as before.
    async function stampPdfWatermark(bytes, footerText) {
      if (typeof PDFLib === 'undefined') {
        console.warn('pdf-lib failed to load (CDN blocked?) — serving the PDF unwatermarked.');
        return bytes;
      }
      try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        pages.forEach(page => {
          const { width } = page.getSize();
          // A page's own template often already has its own footer text (page numbers, running
          // titles) sitting right at the bottom-left, same spot this watermark used to draw
          // straight into -- the two would overlap into an illegible mess. A light translucent
          // band under the watermark text guarantees it stays readable regardless of what the
          // page itself already has there, without fully hiding that original content.
          page.drawRectangle({ x: 0, y: 0, width, height: 15, color: rgb(1, 1, 1), opacity: 0.72 });
          page.drawText(footerText, {
            x: 24, y: 4.5, size: 7.5, font, color: rgb(0.35, 0.35, 0.35), opacity: 1
          });
        });
        return await pdfDoc.save();
      } catch (err) {
        console.error('PDF watermarking failed, serving original file instead:', fmtErr(err));
        return bytes;  // never block a legitimate download just because stamping failed
      }
    }

    // Builds the footer text: institute name + (if logged in) the student's email + date, so a
    // leaked copy can be traced back to who downloaded it. Admin controls the institute name via
    // pricingMaster.payeeName (same field used on receipts).
    // FIX: this format used to be hardcoded in code with no way for the admin to change what the
    // watermark actually says. Now checks pricingMaster.watermarkTemplate first — a free-text template
    // with {{institute}} / {{email}} / {{date}} tokens — and only falls back to the original built-in
    // format when the admin hasn't set one.
    function watermarkFooterText() {
      const who = currentUser && !isAdmin() ? currentUser.email : '';
      const date = new Date().toLocaleDateString('en-IN');
      const institute = pricingMaster.payeeName || 'Evolve+';
      const template = (pricingMaster.watermarkTemplate || '').trim();
      if (template) {
        return template
          .replace(/\{\{institute\}\}/g, institute)
          .replace(/\{\{email\}\}/g, who)
          .replace(/\{\{date\}\}/g, date);
      }
      const parts = [institute, who, date].filter(Boolean);
      return parts.join('  ·  ') + '  ·  Not for redistribution';
    }

    function downloadOrOpenPdf(docId) {
      const doc = pdfVault.find(d => d.id === docId);
      if (!doc) {
        return alert(isAdmin()
          ? 'This link points to a PDF that is no longer in the vault. Upload it again and re-link the words.'
          : 'This document is not available right now. Please tell the academy.');
      }
      if (!isPdfUnlockedForUser(doc)) {
        openCheckout('pdf', doc.id, doc.title, doc.price || 49);
        return;
      }
      const url = String(doc.url || '');
      const filename = `${slugify(doc.title) || 'document'}.pdf`;
      if (!url) return alert('This PDF has no file or link saved. Upload it again in the PDF Vault.');

      const footer = watermarkFooterText();

      // Open the tab immediately (while the click still "counts" for popup blockers), fill it once
      // the file is read + stamped. Shared by every path that serves a file WE host.
      const openStampedInNewTab = async (arrayBuffer, win) => {
        const stamped = await stampPdfWatermark(new Uint8Array(arrayBuffer), footer);
        showBlobInWindow(win, new Blob([stamped], { type: 'application/pdf' }), filename);
      };

      if (url.startsWith('idb:')) {
        const win = window.open('', '_blank');
        if (win) win.document.write(`<title>${escapeHtml(doc.title)}</title><p style="font-family:sans-serif;padding:2rem;color:#475569">Opening ${escapeHtml(doc.title)}…</p>`);
        FileStore.get(url.slice(4)).then(async blob => {
          if (!blob) {
            if (win) win.close();
            return alert(isAdmin() ? 'The file for this PDF is missing from this browser. Upload it again in the PDF Vault.' : 'This document is not available right now. Please tell the academy.');
          }
          const buf = await (blob.type ? blob : new Blob([blob], { type: 'application/pdf' })).arrayBuffer();
          await openStampedInNewTab(buf, win);
        }).catch(() => { if (win) win.close(); alert("The PDF couldn't be read from this browser's storage."); });
        return;
      }
      if (url.startsWith('data:')) {
        const win = window.open('', '_blank');
        if (win) win.document.write(`<title>${escapeHtml(doc.title)}</title><p style="font-family:sans-serif;padding:2rem;color:#475569">Opening ${escapeHtml(doc.title)}…</p>`);
        (async () => {
          let blob;
          try { blob = dataUrlToBlob(url); } catch (err) { if (win) win.close(); return alert("This stored PDF is damaged and can't be opened. Upload it again."); }
          const buf = await blob.arrayBuffer();
          await openStampedInNewTab(buf, win);
        })();
        return;
      }
      // FIX (watermarking + paywall): our own Supabase Storage files CAN be fetched + stamped,
      // since we host them. Genuinely external links (Google Drive, other sites) are left
      // completely untouched — we don't own that file, can't legally/technically modify it, and
      // fetching it would likely hit CORS anyway. Files in a PRIVATE bucket (new uploads) have no
      // public URL at all — we mint a short-lived signed URL here, AFTER the isPdfUnlockedForUser
      // check above already ran, so a signed link is only ever handed to someone who is entitled.
      const storageRef = parseOwnStorageUrl(url);
      if (storageRef) {
        const win = window.open('', '_blank');
        if (win) win.document.write(`<title>${escapeHtml(doc.title)}</title><p style="font-family:sans-serif;padding:2rem;color:#475569">Opening ${escapeHtml(doc.title)}…</p>`);
        (async () => {
          try {
            let fetchUrl = url;
            if (storageRef.private) {
              const { data: signedData, error: signErr } = await supabaseClient.storage
                .from(storageRef.bucket)
                .createSignedUrl(storageRef.path, 300); // 5 min — enough to open+stamp, short enough to make redistributing it pointless
              if (signErr || !signedData || !signedData.signedUrl) throw signErr || new Error('Could not create a secure link');
              fetchUrl = signedData.signedUrl;
            }
            const r = await fetch(fetchUrl);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = await r.arrayBuffer();
            await openStampedInNewTab(buf, win);
          } catch (err) {
            console.error('Failed to fetch+stamp hosted PDF:', fmtErr(err));
            if (storageRef.private) {
              // No public URL exists to fall back to — that's the whole point of the private bucket.
              if (win && !win.closed) win.close();
              alert(isAdmin() ? 'Could not open this PDF from secure storage. Check the Supabase Storage bucket and policies.' : 'This document could not be opened right now. Please try again in a moment.');
            } else if (win && !win.closed) {
              win.location.href = url; // legacy public file: graceful fallback, unstamped but still works
            }
          }
        })();
        return;
      }
      // Genuinely external web links (Google Drive, other sites) open directly, unmodified
      window.open(url, '_blank', 'noopener');
    }

