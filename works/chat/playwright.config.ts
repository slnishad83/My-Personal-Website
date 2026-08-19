import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  retries: 0,
  use: {
    baseURL: 'https://my-team-chat-2255.web.app',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth-setup\.ts/,
      use: { ...devices['Chromium'] },
    },
    {
      name: 'music-tests',
      testMatch: /music\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        ...devices['Chromium'],
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
    {
      name: 'existing-tests',
      testMatch: /app\.spec\.ts/,
      use: { ...devices['Chromium'] },
    },
  ],
  reporter: 'list',
});
