    /* ----------------------------------------------------
       13. ANNOUNCEMENTS
    ----------------------------------------------------- */
    let announcements = JSON.parse(localStorage.getItem('kas_announcements')) || [];
    let dismissedAnnouncements = JSON.parse(localStorage.getItem('kas_dismissed_announcements')) || {};
    let editingAnnouncementId = null; // id of the announcement being edited, or null when posting a new one

    function todayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    async function fetchCloudAnnouncements() {
      const cloud = await fetchCloudAppSetting('announcements');
      if (Array.isArray(cloud)) {
        announcements = cloud;
        localStorage.setItem('kas_announcements', JSON.stringify(announcements));
        renderAnnouncements();
      }
    }
    function saveAnnouncementsCloud() {
      saveCloudAppSetting('announcements', announcements).then(ok => {
        if (!ok) console.warn('Announcement saved locally but cloud sync failed — will retry next save.');
      });
    }

    function postAnnouncement(e) {
      e.preventDefault();
      const title = document.getElementById('ann-title').value.trim();
      if (!title) return;
      const fields = {
        title,
        message: document.getElementById('ann-message').value.trim(),
        audience: document.getElementById('ann-audience').value,
        expiresOn: document.getElementById('ann-expires').value || ''
      };

      if (editingAnnouncementId) {
        const a = announcements.find(x => x.id === editingAnnouncementId);
        if (a) Object.assign(a, fields);
        cancelEditAnnouncement();
      } else {
        announcements.unshift({ id: 'ann_' + Date.now(), ...fields, createdAt: new Date().toISOString() });
      }

      localStorage.setItem('kas_announcements', JSON.stringify(announcements));
      saveAnnouncementsCloud();
      e.target.reset();
      renderAnnouncements();
    }

    // Loads an existing announcement's fields back into the post form (reused for edit, same
    // as the bundle/page editors) -- until this existed, fixing a typo meant deleting the
    // announcement and losing its original post date.
    function editAnnouncement(id) {
      const a = announcements.find(x => x.id === id);
      if (!a) return;
      editingAnnouncementId = id;
      document.getElementById('ann-title').value = a.title || '';
      document.getElementById('ann-message').value = a.message || '';
      document.getElementById('ann-audience').value = a.audience || 'all';
      document.getElementById('ann-expires').value = a.expiresOn || '';
      document.getElementById('ann-form-label').innerText = 'Headline (editing)';
      document.getElementById('ann-submit-btn').innerText = 'Save changes';
      document.getElementById('ann-cancel-edit-btn').classList.remove('hidden');
      document.getElementById('ann-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function cancelEditAnnouncement() {
      editingAnnouncementId = null;
      document.getElementById('ann-form-label').innerText = 'Headline';
      document.getElementById('ann-submit-btn').innerText = 'Post announcement';
      document.getElementById('ann-cancel-edit-btn').classList.add('hidden');
      document.getElementById('ann-title').closest('form').reset();
    }

    function deleteAnnouncement(id) {
      if (!confirm('Delete this announcement?')) return;
      announcements = announcements.filter(a => a.id !== id);
      localStorage.setItem('kas_announcements', JSON.stringify(announcements));
      saveAnnouncementsCloud();
      if (editingAnnouncementId === id) cancelEditAnnouncement();
      renderAnnouncements();
    }

    function viewerKey() {
      return currentUser ? normalizeEmail(currentUser.email) : 'guest';
    }

    function dismissAnnouncement(id) {
      const key = viewerKey();
      dismissedAnnouncements[key] = [...new Set([...(dismissedAnnouncements[key] || []), id])];
      localStorage.setItem('kas_dismissed_announcements', JSON.stringify(dismissedAnnouncements));
      renderAnnouncements();
    }

    function renderAnnouncements() {
      const today = todayISO();
      const isStudent = !!getCurrentStudent();
      const hidden = dismissedAnnouncements[viewerKey()] || [];
      const visible = announcements.filter(a =>
        (!a.expiresOn || a.expiresOn >= today) &&
        (a.audience === 'all' || (a.audience === 'students' && (isStudent || isAdmin()))) &&
        !hidden.includes(a.id)).slice(0, 3);

      const card = a => `
        <div class="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
          <span aria-hidden="true">📣</span>
          <div class="flex-1 text-sm">
            <div class="font-bold">${escapeHtml(a.title)}</div>
            ${a.message ? `<div class="text-xs mt-0.5 text-amber-900">${escapeHtml(a.message).replace(/\n/g, '<br>')}</div>` : ''}
          </div>
          <button onclick="dismissAnnouncement('${a.id}')" class="text-amber-700 hover:text-amber-950 text-lg leading-none font-bold" aria-label="Dismiss announcement">&times;</button>
        </div>`;

      const home = document.getElementById('home-announcements');
      document.getElementById('home-announcements-list').innerHTML = visible.map(card).join('');
      home.classList.toggle('hidden', !visible.length);

      const dash = document.getElementById('dash-announcements');
      const dashItems = isAdmin() ? [] : visible;
      dash.innerHTML = dashItems.map(card).join('');
      dash.classList.toggle('hidden', !dashItems.length);

      const list = document.getElementById('ann-admin-list');
      if (list) {
        list.innerHTML = announcements.length ? announcements.map(a => {
          const expired = a.expiresOn && a.expiresOn < today;
          return `
            <div class="p-2 border rounded-lg ${expired ? 'bg-slate-50 text-slate-400' : 'bg-white'}">
              <div class="flex justify-between gap-2">
                <b class="text-slate-800">${escapeHtml(a.title)}</b>
                <span class="space-x-2 shrink-0">
                  <button onclick="editAnnouncement('${a.id}')" class="text-amber-600 font-bold hover:underline">Edit</button>
                  <button onclick="deleteAnnouncement('${a.id}')" class="text-rose-600 font-bold hover:underline">Delete</button>
                </span>
              </div>
              <div class="text-[10px] text-slate-400">${a.audience === 'students' ? 'Students only' : 'Everyone'}${a.expiresOn ? ` · until ${a.expiresOn}` : ''}${expired ? ' · expired' : ''}</div>
            </div>`;
        }).join('') : '<p class="text-slate-400">Nothing posted yet.</p>';
      }
    }

