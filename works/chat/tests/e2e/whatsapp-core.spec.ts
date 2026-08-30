import { test, expect, type Page } from '@playwright/test';

// Verifies the WhatsApp-parity core areas of NSL Chat against the LIVE app:
// message history, Chats/Messages tab, Calls tab + call history, Groups tab,
// and personal (direct) chat. Requires the app entry point at /works/chat/.
//
// Auth: uses the persisted storageState (tests/e2e/.auth/user.json), or signs
// in directly when MUSIC_TEST_EMAIL/MUSIC_TEST_PASSWORD are set. If neither is
// available, tests are SKIPPED (never fail).

const EMAIL = process.env.MUSIC_TEST_EMAIL || '';
const PASSWORD = process.env.MUSIC_TEST_PASSWORD || '';

async function bootApp(page: Page) {
  await page.goto('/works/chat/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof firebase !== 'undefined' && firebase.auth && firebase.auth(), { timeout: 30000 });
  const signedIn = await page.evaluate(() => !!firebase.auth().currentUser);
  if (!signedIn) {
    if (EMAIL && PASSWORD) {
      const login = await page.evaluate(async ({ email, password }) => {
        try {
          await firebase.auth().signInWithEmailAndPassword(email, password);
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }, { email: EMAIL, password: PASSWORD });
      if (!login.success) {
        throw new Error(`Firebase sign-in failed: ${login.error}`);
      }
    } else {
      test.skip(true, 'No valid session in storageState and no MUSIC_TEST_EMAIL/MUSIC_TEST_PASSWORD (run auth-setup first)');
    }
    // SDK sign-in after page load bypasses the app's normal login flow, so the
    // app's own bootstrap (which starts the chats/groups/pins subscriptions on
    // the 'nsl:auth-ready' event) does not run. Trigger the loaders manually.
    await page.evaluate(() => {
      if (typeof (window as any).loadCurrentChatList === 'function') (window as any).loadCurrentChatList();
      if (typeof (window as any).subscribeToPins === 'function') (window as any).subscribeToPins();
    });
  }
  await page.waitForFunction(() => typeof (window as any).openChat === 'function', { timeout: 60000 });
  await page.waitForSelector('#chat-list-skeleton', { state: 'detached', timeout: 30000 }).catch(() => {});
}

test.describe('WhatsApp core — Chats / Messages tab', () => {
  test.beforeEach(async ({ page }) => {
    await bootApp(page);
  });

  test('main tabs exist (Messages, Groups, Calls, Status, Saved)', async ({ page }) => {
    const labels = ['Chats', 'Groups', 'Calls', 'Status', 'Saved Items'];
    for (const label of labels) {
      const count = await page.locator(`[data-action="switchTab"][aria-label="${label}"]`).count();
      if (label === 'Saved Items') {
        expect(count).toBeGreaterThan(0);
      } else {
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('Chats tab is active by default and renders the chat list', async ({ page }) => {
    await expect(page.locator('[data-action="switchTab"][data-action-arg="chats"].active').first()).toBeVisible();
    const chatList = page.locator('#chat-list');
    await expect(chatList).toBeVisible();
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('#chat-list [data-chat-id]');
      const empty = document.getElementById('chats-empty');
      return items.length > 0 || !!(empty && !empty.classList.contains('hidden'));
    }, { timeout: 60000 });
    const itemCount = await page.locator('#chat-list [data-chat-id]').count();
    const emptyVisible = await page.locator('#chats-empty').isVisible().catch(() => false);
    expect(itemCount > 0 || emptyVisible).toBeTruthy();
  });
});

test.describe('WhatsApp core — Message history', () => {
  test('opens a chat and renders message history', async ({ page }) => {
    await bootApp(page);
    await page.waitForTimeout(4000);
    const chatId = await page.evaluate(() => {
      const el = document.querySelector('#chat-list [data-chat-id]');
      return el ? el.getAttribute('data-chat-id') : null;
    });
    test.skip(!chatId, 'No chats available for this account (history needs at least one chat)');

    await page.evaluate((id) => (window as any).openChat(id), chatId);
    await expect(page.locator('#chat-header')).toBeVisible();
    await expect(page.locator('#messages-wrap')).toBeVisible();

    const headerName = (await page.locator('#header-name').textContent())?.trim() || '';
    expect(headerName.length).toBeGreaterThan(0);

    await expect(page.locator('#msg-input, #messageInput').first()).toBeVisible();

    await page.waitForTimeout(3000);
    const bubbleCount = await page.locator('#messages-wrap .message, #messages-wrap .msg').count();
    const wrapText = (await page.locator('#messages-wrap').textContent())?.trim() || '';
    expect(bubbleCount > 0 || wrapText.length > 0).toBeTruthy();
  });

  test('saved messages chat opens with a composer', async ({ page }) => {
    await bootApp(page);
    await page.waitForTimeout(3000);
    const hasSaved = await page.evaluate(() => {
      const el = document.querySelector('#chat-list [data-chat-id="saved"]');
      return !!el;
    });
    test.skip(!hasSaved, 'No Saved Messages entry for this account');
    await page.evaluate(() => (window as any).openChat('saved'));
    await expect(page.locator('#chat-header')).toBeVisible();
    await expect(page.locator('#msg-input, #messageInput').first()).toBeVisible();
  });
});

test.describe('WhatsApp core — Calls tab', () => {
  test('opens calls tab by clicking the real nav button', async ({ page }) => {
    await bootApp(page);
    await page.locator('[data-action="switchTab"][data-action-arg="calls"]').first().click();
    const panel = page.locator('#_te_calls_panel');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(2500);
    const hasRows = await panel.locator('.call-back-btn').count();
    const text = (await panel.textContent()) || '';
    expect(hasRows > 0 || /No calls yet/i.test(text)).toBeTruthy();
  });

  test('call action buttons are present when calls tab is active', async ({ page }) => {
    await bootApp(page);
    await page.locator('[data-action="switchTab"][data-action-arg="calls"]').first().click();
    await expect(page.locator('#_te_calls_panel')).toBeVisible();
    await expect(page.locator('#btn-new-call, #btn-call-delete-selected, #btn-call-multi-select').first()).toBeVisible();
  });
});

test.describe('WhatsApp core — Groups tab', () => {
  test('opens groups tab and renders groups or honest empty state', async ({ page }) => {
    await bootApp(page);
    await page.locator('[data-action="switchTab"][data-action-arg="groups"]').first().click();
    const panel = page.locator('#_te_groups_panel');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(2500);
    const items = await panel.locator('[data-chat-id]').count();
    const text = (await panel.textContent()) || '';
    expect(items > 0 || /No Groups Yet/.test(text)).toBeTruthy();
  });
});

test.describe('WhatsApp core — Personal chat', () => {
  test('chat header shows contact identity (name + presence element)', async ({ page }) => {
    await bootApp(page);
    await page.waitForTimeout(4000);
    const chatId = await page.evaluate(() => {
      const el = document.querySelector('#chat-list [data-chat-id]');
      return el ? el.getAttribute('data-chat-id') : null;
    });
    test.skip(!chatId, 'No chats available for this account');

    await page.evaluate((id) => (window as any).openChat(id), chatId);
    await expect(page.locator('#header-name')).toBeVisible();
    await expect(page.locator('#header-status')).toBeAttached();
  });
});