import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'admin-tools.smoke.spec.ts',
    'frontend.smoke.spec.ts',
    'member-spending.smoke.spec.ts',
    'bot-presence.smoke.spec.ts',
    'runtime-expiry-alert.smoke.spec.ts',
    'bot-permissions.smoke.spec.ts',
    'review-credit.smoke.spec.ts',
    'voice-keeper.smoke.spec.ts',
    'wallet-topup.smoke.spec.ts',
    'roblox-payout.smoke.spec.ts',
    'channel-message-triggers.smoke.spec.ts',
    'payment-trigger.smoke.spec.ts',
    'price-reader.smoke.spec.ts',
    'message-sets.smoke.spec.ts',
    'discord-markdown.smoke.spec.ts',
    'account-topup.smoke.spec.ts',
  ],
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:5176',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'bun run dev:smoke',
    url: 'http://127.0.0.1:5176',
    reuseExistingServer: !process.env.CI,
    env: { VITE_BACKEND_URL: 'http://127.0.0.1:5176' },
  },
})
