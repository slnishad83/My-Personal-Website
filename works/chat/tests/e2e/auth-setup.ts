import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');
const EMAIL = process.env.MUSIC_TEST_EMAIL || '';
const PASSWORD = process.env.MUSIC_TEST_PASSWORD || '';

setup('login and save auth state', async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('MUSIC_TEST_EMAIL and MUSIC_TEST_PASSWORD env vars required');
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Navigate to login page to load Firebase SDK
  await page.goto('/works/chat/login.html', { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for Firebase to initialize
  await page.waitForFunction(() => {
    return typeof firebase !== 'undefined' && firebase.auth && firebase.auth();
  }, { timeout: 30000 });

  // Sign in directly using Firebase client SDK (bypasses the app's emailVerified UI check)
  const loginResult = await page.evaluate(async ({ email, password }) => {
    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      return { success: true, uid: cred.user?.uid, email: cred.user?.email };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, { email: EMAIL, password: PASSWORD });

  if (!loginResult.success) {
    throw new Error(`Firebase sign-in failed: ${loginResult.error}`);
  }

  // Navigate to main app — use 'load' instead of 'networkidle' (chat app has persistent connections)
  await page.goto('/works/chat/index.html', { waitUntil: 'load', timeout: 60000 });

  // Wait for the app to initialize
  await page.waitForTimeout(5000);

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE });
});
