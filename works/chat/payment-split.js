'use strict';
/**
 * PAYMENT SPLITTING — Split expenses in group chats
 * Add expenses, calculate who owes whom, show settlement summary.
 */
(function () {
  const PaymentSplit = {
    async addExpense(chatId, expense) {
      const uid = window.App?.uid?.() || window.currentUser?.uid;
      const db = window.App?.db;
      if (!uid || !db || !chatId) return;

      const record = {
        chatId,
        description: expense.description,
        amount: parseFloat(expense.amount),
        currency: expense.currency || 'USD',
        paidBy: uid,
        paidByName: expense.paidByName || window.currentUser?.displayName || 'Unknown',
        splitAmong: expense.splitAmong || [],
        perPerson: expense.amount / (expense.splitAmong?.length || 1),
        createdAt: Date.now(),
        settled: false
      };

      try {
        await db.collection('groupExpenses').add(record);
        if (typeof showToast === 'function') showToast('Expense added', 'success');
        return record;
      } catch (e) {
        console.error('[PaymentSplit] Error:', e);
        if (typeof showToast === 'function') showToast('Failed to add expense', 'error');
      }
    },

    async getExpenses(chatId) {
      const db = window.App?.db;
      if (!db || !chatId) return [];

      try {
        const snap = await db.collection('groupExpenses')
          .where('chatId', '==', chatId)
          .orderBy('createdAt', 'desc')
          .get();

        const expenses = [];
        snap.forEach(doc => expenses.push({ id: doc.id, ...doc.data() }));
        return expenses;
      } catch (_) { return []; }
    },

    calculateSettlements(expenses) {
      const balances = {};

      expenses.filter(e => !e.settled).forEach(expense => {
        if (!balances[expense.paidBy]) balances[expense.paidBy] = { name: expense.paidByName, amount: 0 };
        balances[expense.paidBy].amount += expense.amount;

        (expense.splitAmong || []).forEach(uid => {
          if (!balances[uid]) balances[uid] = { name: uid, amount: 0 };
          balances[uid].amount -= expense.perPerson;
        });
      });

      const debtors = [];
      const creditors = [];
      Object.entries(balances).forEach(([uid, data]) => {
        const rounded = Math.round(data.amount * 100) / 100;
        if (rounded < 0) debtors.push({ uid, name: data.name, amount: Math.abs(rounded) });
        else if (rounded > 0) creditors.push({ uid, name: data.name, amount: rounded });
      });

      const settlements = [];
      let i = 0, j = 0;
      while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].amount, creditors[j].amount);
        if (amount > 0.01) {
          settlements.push({
            from: debtors[i],
            to: creditors[j],
            amount: Math.round(amount * 100) / 100
          });
        }
        debtors[i].amount -= amount;
        creditors[j].amount -= amount;
        if (debtors[i].amount < 0.01) i++;
        if (creditors[j].amount < 0.01) j++;
      }

      return settlements;
    },

    async openExpensePanel(chatId) {
      const expenses = await this.getExpenses(chatId);
      const settlements = this.calculateSettlements(expenses);
      const chat = (window.App?.chats || []).find(c => c.id === chatId);
      const members = chat?.members || chat?.memberIds || [];

      const modal = document.createElement('div');
      modal.id = 'expense-panel-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(420px,92vw);max-height:80vh;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--outline-variant,#eee);display:flex;align-items:center;gap:10px;">
            <span class="material-symbols-outlined" style="font-size:20px;color:var(--primary,#00a884);">receipt_long</span>
            <h3 style="margin:0;flex:1;font-size:16px;font-weight:700;">Expenses</h3>
            <button id="add-expense-btn" style="padding:6px 14px;border-radius:10px;border:none;background:var(--primary,#00a884);color:var(--on-primary,#fff);font-size:12px;font-weight:600;cursor:pointer;">+ Add</button>
            <button id="close-expense-panel" style="background:none;border:none;cursor:pointer;color:var(--on-surface-variant,#666);font-size:18px;">✕</button>
          </div>

          ${settlements.length > 0 ? `
          <div style="padding:12px 20px;background:var(--surface-variant,#f8f9fa);border-bottom:1px solid var(--outline-variant,#eee);">
            <div style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#666);margin-bottom:8px;">Settlements</div>
            ${settlements.map(s => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">
                <span style="color:var(--on-surface,#000);font-weight:500;">${this._esc(s.from.name)}</span>
                <span class="material-symbols-outlined" style="font-size:16px;color:var(--primary,#00a884);">arrow_forward</span>
                <span style="color:var(--on-surface,#000);font-weight:500;">${this._esc(s.to.name)}</span>
                <span style="margin-left:auto;font-weight:700;color:var(--primary,#00a884);">$${s.amount.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div style="overflow-y:auto;flex:1;padding:12px 20px;">
            ${expenses.length === 0
              ? '<div style="text-align:center;padding:32px;color:var(--on-surface-variant,#666);">No expenses yet. Tap "+ Add" to record one.</div>'
              : expenses.map(exp => `
                <div style="padding:12px;border-radius:12px;background:var(--surface-variant,#f8f9fa);margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:14px;font-weight:600;color:var(--on-surface,#000);">${this._esc(exp.description)}</span>
                    <span style="font-size:14px;font-weight:700;color:var(--primary,#00a884);">$${exp.amount.toFixed(2)}</span>
                  </div>
                  <div style="font-size:12px;color:var(--on-surface-variant,#666);margin-top:4px;">Paid by ${this._esc(exp.paidByName)} • $${exp.perPerson?.toFixed(2)} each</div>
                </div>
              `).join('')}
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.querySelector('#close-expense-panel').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      modal.querySelector('#add-expense-btn').addEventListener('click', () => {
        modal.remove();
        this._openAddExpense(chatId, members);
      });
    },

    _openAddExpense(chatId, members) {
      const _uid = window.App?.uid?.() || window.currentUser?.uid;
      const modal = document.createElement('div');
      modal.id = 'add-expense-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

      modal.innerHTML = `
        <div style="background:var(--surface-container,#fff);border-radius:20px;width:min(380px,92vw);padding:24px;">
          <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;">Add Expense</h3>
          <input type="text" id="expense-desc" placeholder="What was it for?" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;margin-bottom:12px;background:var(--surface,#fff);color:var(--on-surface,#000);">
          <input type="number" id="expense-amount" placeholder="Amount ($)" step="0.01" min="0" style="width:100%;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;font-size:14px;margin-bottom:12px;background:var(--surface,#fff);color:var(--on-surface,#000);">
          <div style="font-size:12px;font-weight:600;color:var(--on-surface-variant,#666);margin-bottom:8px;">Split among:</div>
          <div id="expense-members" style="max-height:150px;overflow-y:auto;margin-bottom:16px;">
            ${members.map(m => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;">
                <input type="checkbox" value="${m}" class="expense-member-check" checked style="width:16px;height:16px;">
                <span style="font-size:13px;">${this._esc(m)}</span>
              </label>
            `).join('')}
          </div>
          <div style="display:flex;gap:8px;">
            <button id="expense-cancel" style="flex:1;padding:10px;border:1px solid var(--outline-variant,#ccc);border-radius:10px;background:transparent;cursor:pointer;font-size:14px;">Cancel</button>
            <button id="expense-save" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--primary,#00a884);color:var(--on-primary,#fff);cursor:pointer;font-size:14px;font-weight:600;">Add</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.querySelector('#expense-cancel').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      modal.querySelector('#expense-save').addEventListener('click', async () => {
        const desc = modal.querySelector('#expense-desc').value.trim();
        const amount = parseFloat(modal.querySelector('#expense-amount').value);
        const selected = Array.from(modal.querySelectorAll('.expense-member-check:checked')).map(cb => cb.value);
        if (!desc) { if (typeof showToast === 'function') showToast('Enter description', 'error'); return; }
        if (!amount || amount <= 0) { if (typeof showToast === 'function') showToast('Enter amount', 'error'); return; }
        if (selected.length === 0) { if (typeof showToast === 'function') showToast('Select members to split with', 'error'); return; }

        await this.addExpense(chatId, {
          description: desc, amount, paidByName: window.currentUser?.displayName || 'You', splitAmong: selected
        });
        modal.remove();
        this.openExpensePanel(chatId);
      });
    },

    _esc(s) {
      return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    }
  };

  window.PaymentSplit = PaymentSplit;
})();
