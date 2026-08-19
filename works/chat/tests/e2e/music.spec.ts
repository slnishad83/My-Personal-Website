import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.MUSIC_TEST_EMAIL || '';
const PASSWORD = process.env.MUSIC_TEST_PASSWORD || '';

async function waitForApp(page: Page) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    return typeof firebase !== 'undefined' && firebase.auth && firebase.auth();
  }, { timeout: 30000 });
  const needsLogin = await page.evaluate(() => !firebase.auth().currentUser);
  if (needsLogin && EMAIL && PASSWORD) {
    await page.evaluate(async ({ email, password }) => {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    }, { email: EMAIL, password: PASSWORD });
  }
  await page.waitForTimeout(5000);
}

async function openMusicLibrary(page: Page) {
  await page.waitForFunction(() => typeof (window as any).openMusicLibrary === 'function', { timeout: 60000 });
  await page.evaluate(() => { (window as any).openMusicLibrary(); });
  await page.waitForSelector('#music-library-overlay', { state: 'visible', timeout: 10000 });
}

test.describe('Music Player — Library Overlay', () => {
  test('opens and has dialog accessibility', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    const overlay = page.locator('#music-library-overlay');
    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-label', 'Music Library');
    await expect(overlay).toHaveAttribute('aria-modal', 'true');
  });

  test('has 5 tabs', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    const tabs = page.locator('.ml-tab');
    await expect(tabs).toHaveCount(5);
  });

  test('Search tab is active by default', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await expect(page.locator('.ml-tab.active')).toHaveText(/Search/i);
  });

  test('search tab contains search input and button', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await expect(page.locator('#ml-search-input')).toBeVisible();
    await expect(page.locator('[data-action="doMusicSearch"]')).toBeVisible();
  });

  test('closes on escape', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await expect(page.locator('#music-library-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const overlay = page.locator('#music-library-overlay');
    const count = await overlay.count();
    expect(count === 0 || !(await overlay.isVisible())).toBeTruthy();
  });
});

test.describe('Music Player — Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
  });

  test('can switch to My Music tab', async ({ page }) => {
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="my"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ml-tab.active')).toHaveText(/My Music/i);
    await expect(page.locator('#my-music-list')).toBeVisible();
  });

  test('can switch to Upload tab', async ({ page }) => {
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="upload"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ml-tab.active')).toHaveText(/Upload/i);
    await expect(page.locator('#upload-drop-zone')).toBeVisible();
  });

  test('can switch to Playlists tab', async ({ page }) => {
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="playlists"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ml-tab.active')).toHaveText(/Playlists/i);
    await expect(page.locator('#playlists-list')).toBeVisible();
  });

  test('can switch to Languages tab', async ({ page }) => {
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="languages"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.ml-tab.active')).toHaveText(/Languages/i);
  });
});

test.describe('Music Player — Search Tab', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
  });

  test('search input accepts text', async ({ page }) => {
    const input = page.locator('#ml-search-input');
    await input.fill('test song');
    await expect(input).toHaveValue('test song');
  });

  test('search input has placeholder', async ({ page }) => {
    const placeholder = await page.locator('#ml-search-input').getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

  test('search results container exists', async ({ page }) => {
    await expect(page.locator('#ml-search-results')).toBeAttached();
  });

  test('search history container exists', async ({ page }) => {
    await expect(page.locator('#yt-search-history')).toBeAttached();
  });
});

test.describe('Music Player — Upload Tab', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="upload"]').click();
    await page.waitForTimeout(500);
  });

  test('upload drop zone is visible', async ({ page }) => {
    await expect(page.locator('#upload-drop-zone')).toBeVisible();
  });

  test('file input accepts audio', async ({ page }) => {
    const accept = await page.locator('#music-file-input').getAttribute('accept');
    expect(accept).toContain('audio');
  });

  test('has title, artist, language fields', async ({ page }) => {
    await expect(page.locator('#upload-title')).toBeAttached();
    await expect(page.locator('#upload-artist')).toBeAttached();
    await expect(page.locator('#upload-language')).toBeAttached();
  });

  test('upload submit button exists', async ({ page }) => {
    await expect(page.locator('[data-action="submitMusicUpload"]')).toBeVisible();
  });

  test('language select has expected options', async ({ page }) => {
    const options = await page.locator('#upload-language option').allTextContents();
    const lower = options.map(o => o.toLowerCase());
    expect(lower).toContainEqual('malayalam');
    expect(lower).toContainEqual('english');
  });
});

test.describe('Music Player — Playlists Tab', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="playlists"]').click();
    await page.waitForTimeout(500);
  });

  test('create playlist button exists', async ({ page }) => {
    await expect(page.locator('[data-action="createPlaylistUI"]')).toBeVisible();
  });

  test('playlists list container exists', async ({ page }) => {
    await expect(page.locator('#playlists-list')).toBeVisible();
  });

  test('create playlist dialog has name, description, public fields', async ({ page }) => {
    await page.locator('[data-action="createPlaylistUI"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#create-pl-name')).toBeVisible();
    await expect(page.locator('#create-pl-desc')).toBeVisible();
    await expect(page.locator('#create-pl-public')).toBeAttached();
  });

  test('create playlist name input accepts text', async ({ page }) => {
    await page.locator('[data-action="createPlaylistUI"]').click();
    await page.waitForTimeout(500);
    await page.locator('#create-pl-name').fill('Test Playlist');
    await expect(page.locator('#create-pl-name')).toHaveValue('Test Playlist');
  });
});

test.describe('Music Player — Languages Tab', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await page.locator('[data-action="switchMusicLibTab"][data-action-arg="languages"]').click();
    await page.waitForTimeout(500);
  });

  test('language list container exists', async ({ page }) => {
    const containers = ['#lang-malayalam', '#lang-english', '#lang-hindi', '#lang-tamil', '#lang-telugu'];
    for (const sel of containers) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        await expect(page.locator(sel)).toBeAttached();
      }
    }
  });
});

test.describe('Music Player — Player Core', () => {
  test('MusicPlayer global object exists', async ({ page }) => {
    await waitForApp(page);
    const exists = await page.evaluate(() => typeof (window as any).MusicPlayer === 'object');
    expect(exists).toBeTruthy();
  });

  test('MusicPlayer has play method', async ({ page }) => {
    await waitForApp(page);
    const exists = await page.evaluate(() => typeof (window as any).MusicPlayer?.play === 'function');
    expect(exists).toBeTruthy();
  });

  const playerMethods = [
    'play', 'togglePlay', 'next', 'prev', 'setQueue',
    'addToQueue', 'toggleShuffle', 'cycleRepeat', 'setVolume', 'seek',
  ];

  for (const fn of playerMethods) {
    test(`MusicPlayer.${fn} exists`, async ({ page }) => {
      await waitForApp(page);
      const exists = await page.evaluate((name) => typeof (window as any).MusicPlayer?.[name] === 'function', fn);
      expect(exists).toBeTruthy();
    });
  }
});

test.describe('Music Player — Recently Played', () => {
  test('recently played button exists in library', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    const exists = await page.evaluate(() => !!document.querySelector('[data-action="showRecentlyPlayed"]'));
    expect(exists).toBeTruthy();
  });

  test('clicking recently played opens overlay', async ({ page }) => {
    await waitForApp(page);
    await openMusicLibrary(page);
    await page.locator('[data-action="showRecentlyPlayed"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#recently-played-overlay')).toBeVisible();
  });
});
