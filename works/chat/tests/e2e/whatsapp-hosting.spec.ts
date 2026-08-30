import { test, expect } from '@playwright/test';

// No-auth regression: the deployed hosting must boot the SPA at /works/chat/
// and serve real JS/CSS (strict MIME). Guards against SPA catch-all rewrites
// that accidentally swallow static assets as index.html.
test.describe('Hosting — boot + static assets', () => {
  test('SPA loads without HTML-as-JS or 404 asset responses', async ({ page }) => {
    const mimeViolations = [];
    const asset404s = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /MIME type/i.test(msg.text())) {
        mimeViolations.push(msg.text().slice(0, 200));
      }
    });
    page.on('response', (resp) => {
      const ct = resp.headers()['content-type'] || '';
      const url = resp.url();
      if (/\.(js|css|json)($|\?)/.test(url) && !/gstatic|cdnjs|cloudfront|unpkg|fonts\./.test(url)) {
        if (ct.includes('html')) mimeViolations.push(`${url} -> ${ct}`);
        if (resp.status() === 404) asset404s.push(url);
      }
    });

    const resp = await page.goto('/works/chat/', { waitUntil: 'networkidle', timeout: 60000 });
    expect(resp?.status()).toBe(200);

    const title = await page.title();
    expect(title).toContain('NSL Chat');

    // Wait a beat for late-rendered assets, then assert no MIME violations.
    await page.waitForTimeout(2500);
    expect(mimeViolations, 'no JS/CSS/JSON served as HTML').toHaveLength(0);
    expect(asset404s, 'no missing asset 404s').toHaveLength(0);
  });
});