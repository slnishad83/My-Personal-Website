/**
 * Contact Sync — native address book integration
 * Reads device contacts and matches them against app users
 * Only works on native platforms (iOS/Android) via @capacitor-community/contacts
 */
'use strict';
const ContactSync = (() => {
  const _normalizePhone = (raw) => {
    if (!raw) return '';
    let p = raw.replace(/[\s\-\(\)\.]/g, '');
    if (p.startsWith('+')) return p;
    if (p.startsWith('00')) return '+' + p.slice(2);
    if (p.length === 10) return '+91' + p;
    return '+' + p;
  };

  const _isNative = () => {
    try { return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform(); }
    catch (_) { return false; }
  };

  const _getDeviceContacts = async () => {
    if (!_isNative()) return [];
    try {
      const { Contacts } = Capacitor.Plugins;
      if (!Contacts) return [];
      const perm = await Contacts.requestPermission();
      if (perm?.display !== 'granted') return [];
      const result = await Contacts.getContacts({
        projection: { name: true, phones: true, emails: true, image: true }
      });
      return (result.contacts || []).map(c => ({
        name: [c.name?.first, c.name?.middle, c.name?.last].filter(Boolean).join(' ') || c.name?.display || '',
        phones: (c.phones || []).map(p => p.number || ''),
        emails: (c.emails || []).map(e => e.address || ''),
        avatar: c.image?.dataUrl || null,
      }));
    } catch (e) {
      console.warn('[ContactSync] getDeviceContacts error:', e);
      return [];
    }
  };

  const _matchToAppUsers = async (deviceContacts) => {
    const db = App.db;
    if (!db) return { matched: [], unmatched: [] };
    const allPhones = new Set();
    const phoneToContact = {};
    for (const dc of deviceContacts) {
      for (const raw of dc.phones) {
        const norm = _normalizePhone(raw);
        if (norm) { allPhones.add(norm); phoneToContact[norm] = dc; }
      }
    }
    if (allPhones.size === 0) return { matched: [], unmatched: deviceContacts };
    const chunks = [];
    const arr = Array.from(allPhones);
    for (let i = 0; i < arr.length; i += 10) chunks.push(arr.slice(i, i + 10));
    const matched = [];
    const matchedPhones = new Set();
    for (const chunk of chunks) {
      try {
        const snap = await db.collection('users').where('phone', 'in', chunk).get();
        snap.forEach(doc => {
          const data = doc.data();
          const phone = data.phone || data.phoneNumber || '';
          const norm = _normalizePhone(phone);
          matched.push({ uid: doc.id, name: data.displayName || data.email || 'User', phone: norm, email: data.email || '', photoURL: data.photoURL || null, deviceContact: phoneToContact[norm] || null });
          matchedPhones.add(norm);
        });
      } catch (_) {}
    }
    const unmatched = deviceContacts.filter(dc => !dc.phones.some(p => matchedPhones.has(_normalizePhone(p))));
    return { matched, unmatched };
  };

  const openFindFriends = async () => {
    if (!_isNative()) {
      if (typeof showToast === 'function') showToast('Contact sync is only available on the mobile app', 'info');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'find-friends-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--background,#11131c);display:flex;flex-direction:column;animation:fadeIn 0.2s ease;overflow-y:auto';

    overlay.innerHTML = `
      <div style="position:sticky;top:0;z-index:10;background:var(--background,#11131c);padding:16px;border-bottom:1px solid var(--outline-variant,rgba(255,255,255,0.08))">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="document.getElementById('find-friends-overlay')?.remove()" style="background:none;border:none;color:var(--on-surface);cursor:pointer;padding:4px">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--on-surface)">Find Friends</h2>
        </div>
        <p style="margin:8px 0 0;font-size:12px;color:var(--on-surface-variant)">Match your phone contacts with NSL Chat users</p>
      </div>
      <div id="find-friends-content" style="flex:1;padding:16px;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center;color:var(--on-surface-variant)">
          <span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:12px;color:var(--primary)">contacts</span>
          <p style="font-size:14px">Tap below to scan your contacts</p>
        </div>
      </div>
      <div style="position:sticky;bottom:0;padding:16px;background:var(--background,#11131c);border-top:1px solid var(--outline-variant,rgba(255,255,255,0.08))">
        <button id="ff-scan-btn" style="width:100%;padding:14px;border-radius:12px;border:none;background:var(--primary);color:var(--on-primary);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <span class="material-symbols-outlined" style="font-size:18px">sync</span> Scan Contacts
        </button>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('ff-scan-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('ff-scan-btn');
      const content = document.getElementById('find-friends-content');
      if (!btn || !content) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;animation:spin 1s linear infinite">sync</span> Scanning...';

      try {
        const deviceContacts = await _getDeviceContacts();
        if (deviceContacts.length === 0) {
          content.innerHTML = '<div style="text-align:center;color:var(--on-surface-variant);padding:40px"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:12px">person_search</span><p>No contacts found on this device</p></div>';
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">sync</span> Scan Again';
          return;
        }

        const { matched, unmatched } = await _matchToAppUsers(deviceContacts);
        let html = '';
        if (matched.length > 0) {
          html += `<div style="margin-bottom:20px"><h3 style="font-size:13px;font-weight:600;color:var(--on-surface-variant);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">${matched.length} Contact${matched.length > 1 ? 's' : ''} on NSL Chat</h3>`;
          for (const m of matched) {
            const initial = (m.name || '?')[0].toUpperCase();
            html += `<div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;background:var(--surface-container);margin-bottom:6px;cursor:pointer" onclick="document.getElementById('find-friends-overlay')?.remove(); if(window.App) { /* open chat */ }">
              ${m.photoURL ? `<img src="${m.photoURL}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">` : `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary-container);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">${initial}</div>`}
              <div style="flex:1"><p style="margin:0;font-size:14px;font-weight:600;color:var(--on-surface)">${_escHtml(m.name)}</p><p style="margin:2px 0 0;font-size:11px;color:var(--on-surface-variant)">${_escHtml(m.phone)}</p></div>
              <span class="material-symbols-outlined" style="color:var(--primary);font-size:20px">chat</span>
            </div>`;
          }
          html += '</div>';
        }
        if (unmatched.length > 0) {
          html += `<div><h3 style="font-size:13px;font-weight:600;color:var(--on-surface-variant);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">${unmatched.length} Contact${unmatched.length > 1 ? 's' : ''} Not on NSL Chat</h3>`;
          for (const u of unmatched.slice(0, 20)) {
            const initial = (u.name || '?')[0].toUpperCase();
            html += `<div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;background:var(--surface-container);margin-bottom:6px">
              <div style="width:40px;height:40px;border-radius:50%;background:var(--surface-container-highest);color:var(--on-surface-variant);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">${initial}</div>
              <div style="flex:1"><p style="margin:0;font-size:14px;font-weight:500;color:var(--on-surface)">${_escHtml(u.name || 'Unknown')}</p><p style="margin:2px 0 0;font-size:11px;color:var(--on-surface-variant)">${_escHtml(u.phones[0] || '')}</p></div>
              <button onclick="ContactSync._inviteContact('${_escHtml(u.phones[0] || '')}')" style="padding:6px 12px;border-radius:8px;border:1px solid var(--primary);background:transparent;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer">Invite</button>
            </div>`;
          }
          if (unmatched.length > 20) html += `<p style="text-align:center;font-size:12px;color:var(--on-surface-variant);padding:8px">And ${unmatched.length - 20} more...</p>`;
          html += '</div>';
        }
        content.innerHTML = html || '<div style="text-align:center;color:var(--on-surface-variant);padding:40px"><p>No contacts to display</p></div>';
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">sync</span> Scan Again';
      } catch (e) {
        console.warn('[ContactSync] Scan error:', e);
        content.innerHTML = '<div style="text-align:center;color:var(--error);padding:40px"><p>Failed to scan contacts. Please try again.</p></div>';
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">sync</span> Retry';
      }
    });
  };

  var _escHtml = function(s) { return App && App.escHtml ? App.escHtml(s) : (s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''); };

  const _inviteContact = (phone) => {
    if (!phone) return;
    const msg = `Hey! I'm using NSL Chat. Download it here: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'Join NSL Chat', text: msg }).catch(() => {});
    } else if (/^https?:\/\//.test(msg)) {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return { openFindFriends, _inviteContact, _isNative };
})();

window.ContactSync = ContactSync;
