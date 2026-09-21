import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/viewer.spec.mjs',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1600, height: 1000 },
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
