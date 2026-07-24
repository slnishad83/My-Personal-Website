'use strict';
/**
 * SEARCH IN CONTACTS — Search your contact list by name, email, or phone
 * Shows a searchable overlay with all contacts.
 */
(function () {
  const SearchContacts = {
    open() {
      const chats = window.App?.chats || [];
      const contacts = chats.filter(c => c.type === 'direct').map(c => ({
        id: c.id,
        name: c.name || c.displayName || 'Unknown',
        photo: c.photo || c.photoURL || '',
        email: c.email || '',
        phone: c.phone || '',
        uid: c.uid || c.id
      }));

      const modal = document.createElement('div');
      modal.id = 'search-contacts-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding-top:10vh;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(420px,92vw);max-height:70vh;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;">
          <div style="padding:16px;border-bottom:1px solid var(--outline-variant,#eee);display:flex;align-items:center;gap:12px;">
            <span class="material-symbols-outlined" style="font-size:20px;color:var(--on-surface-variant,#666);">search</span>
            <input type="text" id="contact-search-input" placeholder="Search contacts..." autofocus style="flex:1;border:none;background:none;font-size:15px;color:var(--on-surface,#000);outline:none;">
            <button id="close-contact-search" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">✕</button>
          </div>
          <div id="contact-search-results" style="overflow-y:auto;flex:1;max-height:50vh;padding:8px;">
            ${contacts.map(c => `
              <div class="contact-search-item" data-contact-id="${c.id}" data-name="${this._esc(c.name.toLowerCase())}" data-email="${this._esc(c.email.toLowerCase())}" data-phone="${this._esc(c.phone)}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;transition:background 0.15s;">
                ${c.photo
                  ? `<img src="${this._esc(c.photo)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" alt="">`
                  : `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary-container,#e8def8);color:var(--primary,#00a884);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;">${this._esc(c.name.charAt(0).toUpperCase())}</div>`
                }
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--on-surface,#000);">${this._esc(c.name)}</div>
                  <div style="font-size:12px;color:var(--on-surface-variant,#666);">${this._esc(c.email || c.phone || '')}</div>
                </div>
              </div>
            `).join('')}
            ${contacts.length === 0 ? '<div style="text-align:center;padding:32px;color:var(--on-surface-variant,#666);">No contacts yet. Start a chat to add contacts.</div>' : ''}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#contact-search-input');
      const results = modal.querySelector('#contact-search-results');
      const items = results.querySelectorAll('.contact-search-item');

      input.addEventListener('input', App.debounce(() => {
        const query = input.value.toLowerCase().trim();
        let count = 0;
        items.forEach(item => {
          const name = item.dataset.name || '';
          const email = item.dataset.email || '';
          const phone = item.dataset.phone || '';
          const match = !query || name.includes(query) || email.includes(query) || phone.includes(query);
          item.style.display = match ? '' : 'none';
          if (match) count++;
        });
        if (count === 0 && query) {
          let noResult = results.querySelector('.no-results');
          if (!noResult) {
            noResult = document.createElement('div');
            noResult.className = 'no-results';
            noResult.style.cssText = 'text-align:center;padding:32px;color:var(--on-surface-variant,#666);';
            noResult.textContent = 'No contacts found';
            results.appendChild(noResult);
          }
        } else {
          const noResult = results.querySelector('.no-results');
          if (noResult) noResult.remove();
        }
      }, 250));

      items.forEach(item => {
        item.addEventListener('mouseenter', () => item.style.background = 'var(--surface-variant,#f0f2f5)');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
        item.addEventListener('click', () => {
          const chatId = item.dataset.contactId;
          if (chatId && typeof window.selectChat === 'function') {
            window.selectChat(chatId);
            modal.remove();
          }
        });
      });

      modal.querySelector('#close-contact-search').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.remove(); });
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
    }
  };

  window.SearchContacts = SearchContacts;
})();
