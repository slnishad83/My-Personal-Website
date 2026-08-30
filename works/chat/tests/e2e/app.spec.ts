import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('loads login page with correct title', async ({ page }) => {
    await page.goto('/works/chat/login.html');
    await expect(page).toHaveTitle(/NSL Chat|Login/i);
  });

  test('has email and password inputs', async ({ page }) => {
    await page.goto('/works/chat/login.html');
    await expect(page.locator('input[type="email"], input#email, input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"], input#password, input[name="password"]').first()).toBeVisible();
  });

  test('has sign-in button', async ({ page }) => {
    await page.goto('/works/chat/login.html');
    const signInBtn = page.locator('button:has-text("Sign"), button:has-text("Login"), button[type="submit"]');
    await expect(signInBtn.first()).toBeVisible();
  });

  test('has forgot password link', async ({ page }) => {
    await page.goto('/works/chat/login.html');
    const link = page.locator('a:has-text("Forgot"), button:has-text("Forgot"), a:has-text("forgot"), a[href*="reset"]');
    await expect(link.first()).toBeVisible();
  });

  test('has Google sign-in option', async ({ page }) => {
    await page.goto('/works/chat/login.html');
    const googleBtn = page.locator('button:has-text("Google"), button:has-text("google"), [class*="google"]');
    await expect(googleBtn.first()).toBeVisible();
  });

  test('CSP meta tag is present', async ({ page }) => {
    await page.goto('/works/chat/login.html');
    const csp = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(csp).toHaveCount(1);
    const content = await csp.getAttribute('content');
    expect(content).toContain("frame-ancestors 'self'");
    expect(content).toContain("base-uri 'self'");
  });
});

test.describe('Verify page', () => {
  test('loads verify page', async ({ page }) => {
    await page.goto('/works/chat/verify.html');
    await expect(page).toHaveTitle(/Verif/i);
  });

  test('shows verification status card', async ({ page }) => {
    await page.goto('/works/chat/verify.html');
    // verify.html handles oobCode links automatically (no manual code entry)
    await expect(page.locator('main[aria-label="Email verification status"], #title, .verify-card').first()).toBeVisible();
  });
});

test.describe('Password reset page', () => {
  test('loads reset page', async ({ page }) => {
    await page.goto('/works/chat/reset.html');
    await expect(page).toHaveTitle(/Reset/i);
  });

  test('shows error for invalid link', async ({ page }) => {
    await page.goto('/works/chat/reset.html?mode=resetPassword&oobCode=invalid');
    await page.waitForTimeout(2000);
    const errorState = page.locator('#errorState');
    await expect(errorState).toBeVisible();
  });

  test('shows error for missing params', async ({ page }) => {
    await page.goto('/works/chat/reset.html');
    await page.waitForTimeout(1000);
    const errorState = page.locator('#errorState');
    await expect(errorState).toBeVisible();
  });

  test('has aria-live on error messages', async ({ page }) => {
    await page.goto('/works/chat/reset.html');
    // Alert regions are hidden until a message is shown; assert they exist with live semantics
    const alerts = page.locator('[role="alert"][aria-live="assertive"]');
    await expect(alerts).toHaveCount(2);
  });
});

test.describe('TURN settings page', () => {
  test('loads turn page', async ({ page }) => {
    await page.goto('/works/chat/turn.html');
    await expect(page).toHaveTitle(/Call Network Settings/i);
  });

  test('has main landmark', async ({ page }) => {
    await page.goto('/works/chat/turn.html');
    const main = page.locator('main[role="main"], main');
    await expect(main.first()).toBeVisible();
  });

  test('has textarea for TURN config', async ({ page }) => {
    await page.goto('/works/chat/turn.html');
    const textarea = page.locator('textarea#turnConfig');
    await expect(textarea).toBeVisible();
  });

  test('has accessible buttons', async ({ page }) => {
    await page.goto('/works/chat/turn.html');
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      expect(text?.trim() || ariaLabel).toBeTruthy();
    }
  });
});

test.describe('Calendar page', () => {
  test('loads calendar page', async ({ page }) => {
    await page.goto('/works/chat/calendar.html');
    // Auth-gated: shows calendar when signed in, redirects to login otherwise
    await expect(page).toHaveTitle(/Calendar|Sign In/i);
  });

  test('has heading h1', async ({ page }) => {
    await page.goto('/works/chat/calendar.html');
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();
  });
});

test.describe('Expenses page', () => {
  test('loads expenses page', async ({ page }) => {
    await page.goto('/works/chat/expenses.html');
    // Auth-gated: shows expenses when signed in, redirects to login otherwise
    await expect(page).toHaveTitle(/Expense|Sign In/i);
  });
});

test.describe('Insights page', () => {
  test('loads insights page', async ({ page }) => {
    await page.goto('/works/chat/insights.html');
    // Auth-gated: shows insights when signed in, redirects to login otherwise
    await expect(page).toHaveTitle(/Insights|Sign In/i);
  });
});

test.describe('Offline page', () => {
  test('loads offline page', async ({ page }) => {
    await page.goto('/works/chat/offline.html');
    await expect(page).toHaveTitle(/Offline/i);
  });

  test('is self-contained (no external CSS)', async ({ page }) => {
    await page.goto('/works/chat/offline.html');
    const links = page.locator('link[rel="stylesheet"]');
    await expect(links).toHaveCount(0);
  });
});

test.describe('PWA manifest', () => {
  test('manifest link is present on index.html', async ({ page }) => {
    await page.goto('/works/chat/');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveCount(1);
  });

  test('service worker is registered', async ({ page }) => {
    await page.goto('/works/chat/');
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(swRegistered).toBeTruthy();
  });
});

test.describe('Accessibility — all pages', () => {
  const pages = [
    { url: '/works/chat/login.html', name: 'Login' },
    { url: '/works/chat/verify.html', name: 'Verify' },
    { url: '/works/chat/reset.html', name: 'Reset' },
    { url: '/works/chat/turn.html', name: 'Turn' },
    { url: '/works/chat/calendar.html', name: 'Calendar' },
    { url: '/works/chat/expenses.html', name: 'Expenses' },
    { url: '/works/chat/insights.html', name: 'Insights' },
  ];

  for (const p of pages) {
    test(`${p.name}: has lang attribute`, async ({ page }) => {
      await page.goto(p.url);
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
    });

    test(`${p.name}: has viewport meta`, async ({ page }) => {
      await page.goto(p.url);
      const viewport = page.locator('meta[name="viewport"]');
      await expect(viewport).toHaveCount(1);
    });
  }
});

test.describe('Security headers', () => {
  test('CSP is set on index.html', async ({ page }) => {
    const response = await page.goto('/works/chat/');
    const csp = response?.headers()?.['content-security-policy'] || '';
    const metaCsp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp || metaCsp).toBeTruthy();
  });

  test('X-Content-Type-Options is set', async ({ page }) => {
    const response = await page.goto('/works/chat/');
    const header = response?.headers()?.['x-content-type-options'];
    expect(header).toBe('nosniff');
  });
});
